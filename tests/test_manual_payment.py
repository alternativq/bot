"""
Smoke-тест провижининга: ручное подтверждение оплаты, продление, пробный
период. Все обращения к 3x-ui замоканы. Запуск из корня проекта:

    python -m tests.test_manual_payment
"""
from __future__ import annotations

import asyncio
import datetime as dt
from unittest.mock import AsyncMock

from sqlalchemy import select

import panel.xui_client as xui_client
from db.database import get_session, reset_db
from db.models import PaymentRecord, PendingPayment, Subscription, User
from plans import TRIAL_PLAN
from services.provisioning import handle_manual_payment_confirmed, handle_trial_activation


class FakeBot:
    def __init__(self):
        self.sent = []

    async def send_message(self, chat_id, text, **kwargs):
        self.sent.append((chat_id, text))


async def main():
    await reset_db()
    xui_client.provision_client = AsyncMock(return_value=("manual-uuid", 1, "manual-sub"))
    xui_client.renew_client = AsyncMock(return_value=(1, "manual-sub"))
    bot = FakeBot()

    # --- 1. Ручная оплата: первая покупка ---
    async with get_session() as session:
        pending = PendingPayment(user_tg_id=999, plan_id="m1", method_id="yoomoney", order_code="AB12CD")
        session.add(pending)
        await session.commit()
        pending_id = pending.id

    async with get_session() as session:
        pending = await session.get(PendingPayment, pending_id)
        await handle_manual_payment_confirmed(pending, bot)

    async with get_session() as session:
        sub = await session.scalar(select(Subscription).where(Subscription.user_tg_id == 999))
        assert sub is not None
        assert sub.xui_uuid == "manual-uuid"
        assert sub.xui_sub_ids == {"1": "manual-sub"}
        first_period_end = sub.period_end
        rows = (await session.scalars(select(PaymentRecord).where(PaymentRecord.external_id == "manual:AB12CD"))).all()
        assert len(rows) == 1
        assert rows[0].provider == "manual"
    assert len(bot.sent) == 1 and "Оплата прошла успешно" in bot.sent[0][1]
    xui_client.provision_client.assert_awaited_once()
    print("OK: ручное подтверждение провижинит клиента, sub_id сохраняется как словарь по инбаундам")

    # повторное подтверждение той же заявки не должно задвоить платёж/сообщение
    async with get_session() as session:
        pending = await session.get(PendingPayment, pending_id)
        await handle_manual_payment_confirmed(pending, bot)
    assert len(bot.sent) == 1, "повторное подтверждение не должно слать второе сообщение"
    print("OK: повторное подтверждение идемпотентно")

    # --- 2. Продление тем же пользователем ---
    async with get_session() as session:
        pending2 = PendingPayment(user_tg_id=999, plan_id="m1", method_id="ozon", order_code="ZZ99XX")
        session.add(pending2)
        await session.commit()
        pending2_id = pending2.id

    async with get_session() as session:
        pending2 = await session.get(PendingPayment, pending2_id)
        await handle_manual_payment_confirmed(pending2, bot)

    async with get_session() as session:
        sub = await session.scalar(select(Subscription).where(Subscription.user_tg_id == 999))
        assert sub.period_end == first_period_end + dt.timedelta(days=30), \
            "продление должно сдвигать срок на +30 дней от предыдущего конца, а не от now()"
        assert sub.xui_uuid == "manual-uuid", "uuid клиента не должен меняться при продлении"
    xui_client.renew_client.assert_awaited_once()
    call_kwargs = xui_client.renew_client.await_args.kwargs
    assert call_kwargs["client_uuid"] == "manual-uuid"
    assert call_kwargs["existing_sub_id"] == "manual-sub"
    print("OK: продление сдвигает срок от предыдущего period_end и передаёт тот же uuid/sub_ids")

    # --- 3. Пробный период ---
    xui_client.provision_client.reset_mock()
    xui_client.provision_client.return_value = ("trial-uuid", 1, "trial-sub")

    async with get_session() as session:
        session.add(User(tg_id=555, trial_used=True))
        await session.commit()

    await handle_trial_activation(555, TRIAL_PLAN, bot)

    async with get_session() as session:
        sub = await session.scalar(select(Subscription).where(Subscription.user_tg_id == 555))
        assert sub is not None
        assert sub.plan_id == "trial"
        expected_end = dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=TRIAL_PLAN.duration_days)
        assert abs((sub.period_end - expected_end).total_seconds()) < 5
        rows = (await session.scalars(select(PaymentRecord).where(PaymentRecord.external_id == "trial:555"))).all()
        assert len(rows) == 1 and rows[0].provider == "trial" and rows[0].amount_rub == 0
    assert any("Пробный период активирован" in t for cid, t in bot.sent if cid == 555)
    print("OK: пробный период активируется бесплатно и корректно на TRIAL_DURATION_DAYS дней")

    # повторная активация триала (на уровне сервиса) идемпотентна по external_id
    await handle_trial_activation(555, TRIAL_PLAN, bot)
    async with get_session() as session:
        rows = (await session.scalars(select(PaymentRecord).where(PaymentRecord.external_id == "trial:555"))).all()
        assert len(rows) == 1, "повторная активация не должна создавать вторую запись о платеже"
    print("OK: повторная активация триала идемпотентна на уровне сервиса")

    print("\nРУЧНАЯ ОПЛАТА / ТРИАЛ: ВСЕ ПРОВЕРКИ ПРОШЛИ")


if __name__ == "__main__":
    asyncio.run(main())

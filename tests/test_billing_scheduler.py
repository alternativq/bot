"""
Smoke-тест напоминаний об истечении подписки (обычной и пробной).
Запуск из корня проекта:

    python -m tests.test_billing_scheduler
"""
from __future__ import annotations

import asyncio
import datetime as dt

from sqlalchemy import select

import services.billing_scheduler as billing_scheduler
from db.database import get_session, reset_db
from db.models import Subscription, User


class FakeBot:
    def __init__(self):
        self.sent = []

    async def send_message(self, chat_id, text, **kwargs):
        self.sent.append((chat_id, text))


async def main():
    await reset_db()
    bot = FakeBot()
    now = dt.datetime.now(dt.timezone.utc)

    # --- Сценарий 1: обычная подписка истекает через 10 часов (< окна в 2 дня) ---
    async with get_session() as session:
        session.add(User(tg_id=2001))
        await session.flush()
        session.add(
            Subscription(
                user_tg_id=2001,
                plan_id="m1",
                xui_uuid="uuid-1",
                xui_sub_ids={"1": "sub-1"},
                public_token="token-1",
                period_end=now + dt.timedelta(hours=10),
            )
        )
        await session.commit()


    await billing_scheduler.run_expiry_reminders(bot)

    async with get_session() as session:
        sub = await session.scalar(select(Subscription).where(Subscription.user_tg_id == 2001))
        assert sub.reminder_sent is True
    assert any("истекает" in t and "Подписка" in t for cid, t in bot.sent if cid == 2001)
    print("OK: напоминание для обычной подписки отправляется и помечается")

    # повторный прогон не должен слать напоминание ещё раз
    sent_before = len(bot.sent)
    await billing_scheduler.run_expiry_reminders(bot)
    assert len(bot.sent) == sent_before
    print("OK: повторное напоминание не дублируется")

    # --- Сценарий 2: подписка ДАЛЕКО от истечения не трогается ---
    async with get_session() as session:
        session.add(User(tg_id=2002))
        await session.flush()
        session.add(
            Subscription(
                user_tg_id=2002,
                plan_id="m1",
                xui_uuid="uuid-2",
                xui_sub_ids={"1": "sub-2"},
                public_token="token-2",
                period_end=now + dt.timedelta(days=10),
            )
        )
        await session.commit()

    await billing_scheduler.run_expiry_reminders(bot)
    assert not any(cid == 2002 for cid, _ in bot.sent)
    print("OK: подписки вне окна напоминания не трогаются")

    # --- Сценарий 3: пробная подписка получает отдельный текст ---
    async with get_session() as session:
        session.add(User(tg_id=2003))
        await session.flush()
        session.add(
            Subscription(
                user_tg_id=2003,
                plan_id="trial",
                xui_uuid="uuid-3",
                xui_sub_ids={"1": "sub-3"},
                public_token="token-3",
                period_end=now + dt.timedelta(hours=5),
            )
        )
        await session.commit()

    await billing_scheduler.run_expiry_reminders(bot)
    assert any("Пробный доступ заканчивается" in t for cid, t in bot.sent if cid == 2003)
    print("OK: для пробной подписки используется отдельный текст напоминания")

    # --- Сценарий 4: уже истёкшая (не должна получить напоминание "скоро истечёт") ---
    async with get_session() as session:
        session.add(User(tg_id=2004))
        await session.flush()
        session.add(
            Subscription(
                user_tg_id=2004,
                plan_id="m1",
                xui_uuid="uuid-4",
                xui_sub_ids={"1": "sub-4"},
                public_token="token-4",
                period_end=now - dt.timedelta(hours=1),
            )
        )
        await session.commit()


    await billing_scheduler.run_expiry_reminders(bot)
    assert not any(cid == 2004 for cid, _ in bot.sent)
    print("OK: уже истёкшие подписки не получают напоминание 'скоро истечёт'")

    print("\nНАПОМИНАНИЯ: ВСЕ ПРОВЕРКИ ПРОШЛИ")


def test_billing_scheduler_suite() -> None:
    asyncio.run(main())


if __name__ == "__main__":
    asyncio.run(main())


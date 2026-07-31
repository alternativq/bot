"""
Тест обработки ошибок при выдаче ключа:
1. Сбой активации пробного периода не должен "сжигать" единственную попытку.
2. Сбой при подтверждении админом ручной оплаты не должен вешать заявку
   в неразрешимом состоянии - она должна откатываться в pending для повтора.

py3xui и Telegram полностью замоканы. Запуск из корня проекта:

    python -m tests.test_error_handling
"""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from sqlalchemy import select

from bot.handlers import admin_confirm, choose_plan
from config import settings
from db.database import get_session, reset_db
from db.models import PaymentRecord, PendingPayment, User


def fake_call(data: str, user_id: int, username: str = "tester"):
    call = MagicMock()
    call.data = data
    call.from_user.id = user_id
    call.from_user.username = username
    call.answer = AsyncMock()
    call.message.answer = AsyncMock()
    call.message.edit_text = AsyncMock()
    call.message.text = "заявка"
    call.bot = MagicMock()
    return call


async def main():
    await reset_db()

    # --- 1. Сбой активации триала не должен помечать trial_used=True ---
    call = fake_call("plan:trial", user_id=777)

    with patch("bot.handlers.handle_trial_activation", new=AsyncMock(side_effect=RuntimeError("панель недоступна"))):
        await choose_plan(call)

    async with get_session() as session:
        user = await session.get(User, 777)
        assert user is not None
        assert user.trial_used is False, "триал не должен считаться использованным при сбое активации"
    call.message.answer.assert_called_once()
    error_text = call.message.answer.await_args.args[0].lower()
    assert "не получилось" in error_text or "ошибка" in error_text
    print("OK: при сбое активации триала флаг trial_used НЕ выставляется, пользователь видит ошибку")

    # повторный вызов при успешной активации ДОЛЖЕН выставить флаг
    call2 = fake_call("plan:trial", user_id=777)
    with patch("bot.handlers.handle_trial_activation", new=AsyncMock(return_value=None)):
        await choose_plan(call2)

    async with get_session() as session:
        user = await session.get(User, 777)
        assert user.trial_used is True
    print("OK: при успешной активации флаг trial_used выставляется")

    # --- 2. Сбой при подтверждении админом откатывает заявку в pending ---
    if not settings.ADMIN_IDS:
        settings.ADMIN_IDS = "123456789"
    admin_id = settings.admin_ids[0]

    async with get_session() as session:
        session.add(User(tg_id=888))
        pending = PendingPayment(user_tg_id=888, plan_id="m1", method_id="yoomoney", order_code="FAIL01")
        session.add(pending)
        await session.commit()
        pending_id = pending.id

    call3 = fake_call(f"admin_confirm:{pending_id}", user_id=admin_id)
    with patch("bot.handlers.handle_manual_payment_confirmed", new=AsyncMock(side_effect=RuntimeError("панель недоступна"))):
        await admin_confirm(call3)

    async with get_session() as session:
        pending = await session.get(PendingPayment, pending_id)
        assert pending.status == "pending", "при сбое заявка должна откатиться в pending, а не зависнуть в processing/confirmed"
        rows = (await session.scalars(select(PaymentRecord).where(PaymentRecord.external_id == f"manual:{pending.order_code}"))).all()
        assert len(rows) == 0, "платёж не должен считаться проведённым при сбое провижининга"
    print("OK: сбой провижининга откатывает заявку в pending, платёж не засчитывается")

    # повторное подтверждение той же заявки при успехе должно пройти нормально
    call4 = fake_call(f"admin_confirm:{pending_id}", user_id=admin_id)
    with patch("bot.handlers.handle_manual_payment_confirmed", new=AsyncMock(return_value=None)):
        await admin_confirm(call4)

    async with get_session() as session:
        pending = await session.get(PendingPayment, pending_id)
        assert pending.status == "confirmed"
    print("OK: повторное подтверждение после устранения сбоя проходит успешно")

    print("\nОБРАБОТКА ОШИБОК: ВСЕ ПРОВЕРКИ ПРОШЛИ")


if __name__ == "__main__":
    asyncio.run(main())

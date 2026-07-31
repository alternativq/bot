"""
Тест админ-панели: /admin <tg_id>, продление подписки, включение/отключение
клиента, пересинхронизация инбаундов - и что всё это недоступно не-админам.
py3xui и Telegram полностью замокан. Запуск из корня проекта:

    python -m tests.test_admin
"""
from __future__ import annotations

import asyncio
import datetime as dt
from unittest.mock import AsyncMock, MagicMock, patch

from sqlalchemy import select

import panel.xui_client as xui_client
from bot.handlers import admin_extend, admin_find_user, admin_resync, admin_toggle
from config import settings
from db.database import get_session, reset_db
from db.models import Subscription, User
from services.provisioning import admin_extend_subscription, admin_toggle_subscription


def fake_message(text: str, user_id: int):
    msg = MagicMock()
    msg.text = text
    msg.from_user.id = user_id
    msg.from_user.username = "tester"
    msg.answer = AsyncMock()
    return msg


def fake_call(data: str, user_id: int):
    call = MagicMock()
    call.data = data
    call.from_user.id = user_id
    call.from_user.username = "admin"
    call.answer = AsyncMock()
    call.message.answer = AsyncMock()
    call.bot = MagicMock()
    call.bot.send_message = AsyncMock()
    return call


async def seed_subscription(tg_id: int, period_end: dt.datetime, disabled: bool = False) -> None:
    async with get_session() as session:
        session.add(User(tg_id=tg_id, username="petya"))
        session.add(
            Subscription(
                user_tg_id=tg_id,
                plan_id="m1",
                xui_uuid="admin-test-uuid",
                xui_sub_ids={"1": "sub-1"},
                public_token="admin-test-token",
                period_end=period_end,
                disabled=disabled,
            )
        )
        await session.commit()


async def main():
    await reset_db()
    if not settings.ADMIN_IDS:
        settings.ADMIN_IDS = "123456789"
    admin_id = settings.admin_ids[0]
    now = dt.datetime.now(dt.timezone.utc)

    # --- 1. Сервисный слой: admin_extend_subscription продлевает и пересинхронизирует ---
    await seed_subscription(1001, now + dt.timedelta(days=5))
    xui_client.renew_client = AsyncMock(return_value=(1, "sub-1"))

    sub = await admin_extend_subscription(1001, 10)
    assert sub is not None
    assert abs((sub.period_end - (now + dt.timedelta(days=15))).total_seconds()) < 5
    xui_client.renew_client.assert_awaited_once()
    print("OK: admin_extend_subscription продлевает от текущего period_end и вызывает renew_client")

    # days=0 - просто пересинхронизация, период не должен измениться
    xui_client.renew_client.reset_mock()
    period_before = sub.period_end
    sub2 = await admin_extend_subscription(1001, 0)
    assert sub2.period_end == period_before
    xui_client.renew_client.assert_awaited_once()
    print("OK: admin_extend_subscription(days=0) пересинхронизирует инбаунды, не трогая срок")

    # несуществующий пользователь -> None, без исключений
    result = await admin_extend_subscription(999999, 10)
    assert result is None
    print("OK: admin_extend_subscription для несуществующего пользователя возвращает None")

    # --- 2. Сервисный слой: admin_toggle_subscription ---
    xui_client.set_client_enabled = AsyncMock(return_value=None)
    new_disabled = await admin_toggle_subscription(1001)
    assert new_disabled is True
    xui_client.set_client_enabled.assert_awaited_once_with(1001, enabled=False)

    new_disabled_2 = await admin_toggle_subscription(1001)
    assert new_disabled_2 is False
    print("OK: admin_toggle_subscription переключает disabled и синхронизирует enable в панели")

    # --- 3. Хендлер /admin: не-админ получает молчание (не выдаём сам факт существования команды) ---
    msg_non_admin = fake_message("/admin 1001", user_id=222222)
    await admin_find_user(msg_non_admin)
    msg_non_admin.answer.assert_not_called()
    print("OK: /admin от не-админа полностью игнорируется")

    # --- 4. Хендлер /admin: админ получает карточку с трафиком ---
    xui_client.get_client_traffic = AsyncMock(return_value=(1024 ** 3, 2 * 1024 ** 3))  # 1GB up, 2GB down
    msg_admin = fake_message("/admin 1001", user_id=admin_id)
    await admin_find_user(msg_admin)
    msg_admin.answer.assert_called_once()
    card_text = msg_admin.answer.await_args.args[0]
    assert "Тариф" in card_text and "Трафик" in card_text
    print("OK: /admin от админа показывает карточку пользователя с трафиком")

    # --- 5. Хендлер admin_extend через callback ---
    xui_client.renew_client.reset_mock()
    call = fake_call("admin_extend:1001:30", user_id=admin_id)
    await admin_extend(call)
    call.answer.assert_called_once()
    call.message.answer.assert_called_once()  # обновлённая карточка
    call.bot.send_message.assert_awaited_once()  # уведомление самому пользователю
    async with get_session() as session:
        sub_check = await session.scalar(select(Subscription).where(Subscription.user_tg_id == 1001))
        assert sub_check.period_end > now + dt.timedelta(days=40)
    print("OK: callback admin_extend продлевает, обновляет карточку и уведомляет пользователя")

    # не-админ не может дёрнуть callback напрямую
    call_bad = fake_call("admin_extend:1001:30", user_id=222222)
    await admin_extend(call_bad)
    call_bad.answer.assert_called_once_with("Только для администратора", show_alert=True)
    print("OK: callback admin_extend недоступен не-админу")

    # --- 6. Хендлер admin_toggle через callback ---
    call_toggle = fake_call("admin_toggle:1001", user_id=admin_id)
    await admin_toggle(call_toggle)
    async with get_session() as session:
        sub_check = await session.scalar(select(Subscription).where(Subscription.user_tg_id == 1001))
        assert sub_check.disabled is True
    print("OK: callback admin_toggle отключает клиента")

    # --- 7. Хендлер admin_resync через callback ---
    call_resync = fake_call("admin_resync:1001", user_id=admin_id)
    await admin_resync(call_resync)
    call_resync.answer.assert_called_once()
    print("OK: callback admin_resync выполняется без ошибок")

    print("\nАДМИН-ПАНЕЛЬ: ВСЕ ПРОВЕРКИ ПРОШЛИ")


if __name__ == "__main__":
    asyncio.run(main())

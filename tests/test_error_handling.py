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
from unittest.mock import AsyncMock, patch

from aiohttp.test_utils import TestClient, TestServer
from sqlalchemy import select

import sub_server
from api.auth import create_jwt
from config import settings
from db.database import get_session, reset_db
from db.models import PaymentRecord, PendingPayment, User


class FakeBot:
    def __init__(self):
        self.sent = []

    async def send_message(self, chat_id, text, **kwargs):
        self.sent.append((chat_id, text))


async def main():
    await reset_db()
    bot = FakeBot()

    app = sub_server.create_app()
    app["bot"] = bot
    server = TestServer(app)
    client = TestClient(server)
    await client.start_server()

    admin_id = 123456789
    try:
        with patch.object(settings, "BOT_TOKEN", "test_bot_token_123"), \
             patch.object(settings, "ADMIN_IDS", str(admin_id)):

            token_user = create_jwt({"id": 777, "username": "tester"})
            headers_user = {"Authorization": f"Bearer {token_user}"}

            token_admin = create_jwt({"id": admin_id, "username": "admin"})
            headers_admin = {"Authorization": f"Bearer {token_admin}"}

            # --- 1. Сбой активации триала не должен помечать trial_used=True ---
            async with get_session() as session:
                session.add(User(tg_id=777))
                await session.commit()

            with patch("api.routes.handle_trial_activation", new=AsyncMock(side_effect=RuntimeError("панель недоступна"))):
                resp = await client.post("/api/v1/trial/activate", json={}, headers=headers_user)
                assert resp.status == 500

            async with get_session() as session:
                user = await session.get(User, 777)
                assert user is not None
                assert user.trial_used is False, "триал не должен считаться использованным при сбое активации"
            print("OK: при сбое активации триала флаг trial_used НЕ выставляется, клиент получает ошибку")

            # повторный вызов при успешной активации ДОЛЖЕН выставить флаг
            with patch("api.routes.handle_trial_activation", new=AsyncMock(return_value=None)):
                resp2 = await client.post("/api/v1/trial/activate", json={}, headers=headers_user)
                assert resp2.status == 200

            async with get_session() as session:
                user = await session.get(User, 777)
                assert user.trial_used is True
            print("OK: при успешной активации флаг trial_used выставляется")


            # --- 2. Сбой при подтверждении админом откатывает заявку в pending ---
            async with get_session() as session:
                session.add(User(tg_id=888))
                await session.flush()
                pending = PendingPayment(user_tg_id=888, plan_id="m1", method_id="ozon", order_code="FAIL01", status="pending")

                session.add(pending)
                await session.commit()
                pending_id = pending.id

            with patch("services.provisioning.handle_manual_payment_confirmed", new=AsyncMock(side_effect=RuntimeError("панель недоступна"))):
                resp3 = await client.post(f"/api/v1/admin/pending-payments/{pending_id}/resolve", json={"action": "confirm"}, headers=headers_admin)
                assert resp3.status == 500

            async with get_session() as session:
                pending = await session.get(PendingPayment, pending_id)
                assert pending.status == "pending", "при сбое заявка должна откатиться в pending"
                rows = (await session.scalars(select(PaymentRecord).where(PaymentRecord.external_id == f"manual:{pending.order_code}"))).all()
                assert len(rows) == 0, "платёж не должен считаться проведённым при сбое провижининга"
            print("OK: сбой провижининга откатывает заявку в pending, платёж не засчитывается")

            # повторное подтверждение той же заявки при успехе должно пройти нормально
            with patch("services.provisioning.handle_manual_payment_confirmed", new=AsyncMock(return_value=None)):
                resp4 = await client.post(f"/api/v1/admin/pending-payments/{pending_id}/resolve", json={"action": "confirm"}, headers=headers_admin)
                assert resp4.status == 200



            async with get_session() as session:
                pending = await session.get(PendingPayment, pending_id)
                assert pending.status == "confirmed"
            print("OK: повторное подтверждение после устранения сбоя проходит успешно")

    finally:
        await client.close()

    print("\nОБРАБОТКА ОШИБОК: ВСЕ ПРОВЕРКИ ПРОШЛИ")


def test_error_handling_suite() -> None:
    asyncio.run(main())


if __name__ == "__main__":
    asyncio.run(main())



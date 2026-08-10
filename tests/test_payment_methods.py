"""
Тест проверки способов оплаты:
- get_payment_methods: определение ссылок и реквизитов Ozon Банка
- GET /api/v1/payment-methods: возврат payment_url
- POST /api/v1/purchase: возврат payment_url для ручной оплаты со ссылкой
"""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

from aiohttp.test_utils import TestClient, TestServer

import sub_server
from api.auth import create_jwt
from config import settings
from db.database import reset_db
from payment_methods import get_payment_methods


class FakeBot:
    def __init__(self):
        self.sent = []

    async def send_message(self, chat_id, text, **kwargs):
        self.sent.append((chat_id, text))


async def main():
    await reset_db()
    bot = FakeBot()
    sub_server.set_bot_instance(bot)

    # 1. Проверка функции get_payment_methods с URL в OZON_PAY_URL
    with patch.object(settings, "OZON_REQUISITE", "2200111122223333"), \
         patch.object(settings, "OZON_PAY_URL", "https://finance.ozon.ru/pay/test12345"):
        methods = get_payment_methods()
        ozon_method = next((m for m in methods if m.id == "ozon"), None)
        assert ozon_method is not None
        assert ozon_method.payment_url == "https://finance.ozon.ru/pay/test12345"
        assert ozon_method.requisite == "2200111122223333"

    # 2. Проверка функции get_payment_methods с URL прямо в OZON_REQUISITE
    with patch.object(settings, "OZON_REQUISITE", "https://qr.nspk.ru/test-ozon-link"), \
         patch.object(settings, "OZON_PAY_URL", ""):
        methods = get_payment_methods()
        ozon_method = next((m for m in methods if m.id == "ozon"), None)
        assert ozon_method is not None
        assert ozon_method.payment_url == "https://qr.nspk.ru/test-ozon-link"

    # 3. Проверка API эндпоинтов
    with patch.object(settings, "BOT_TOKEN", "test_bot_token_123"), \
         patch.object(settings, "OZON_REQUISITE", "2200111122223333"), \
         patch.object(settings, "OZON_PAY_URL", "https://finance.ozon.ru/pay/test12345"):

        app = sub_server.create_app()
        app["bot"] = bot
        server = TestServer(app)
        client = TestClient(server)
        await client.start_server()

        try:
            token = create_jwt({"id": 12345, "username": "ozon_tester"})
            headers = {"Authorization": f"Bearer {token}"}

            # GET /api/v1/payment-methods
            resp = await client.get("/api/v1/payment-methods", headers=headers)
            assert resp.status == 200
            data = await resp.json()
            ozon_api = next((m for m in data["methods"] if m["id"] == "ozon"), None)
            assert ozon_api is not None
            assert ozon_api["payment_url"] == "https://finance.ozon.ru/pay/test12345"

            # POST /api/v1/purchase
            resp = await client.post(
                "/api/v1/purchase",
                json={"plan_id": "m1", "method_id": "ozon"},
                headers=headers,
            )
            assert resp.status == 200
            p_data = await resp.json()
            assert p_data["payment_url"] == "https://finance.ozon.ru/pay/test12345"
            assert p_data["pending_id"] is not None
        finally:
            await client.close()


def test_payment_methods_suite():
    asyncio.run(main())


if __name__ == "__main__":
    test_payment_methods_suite()
    print("ALL OK: Payment methods and Ozon link tests passed!")

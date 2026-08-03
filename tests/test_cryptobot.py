"""
Smoke-тест оплаты через CryptoBot (@CryptoBot / CryptoPay API):
- Вызов API createInvoice и формирование ссылки на чек
- Обработка входящего вебхука /webhook/cryptopay
- Проверка HMAC подписи crypto-pay-api-signature
- Автоматический провижининг подписки в 3x-ui

Запуск из корня проекта:
    python -m tests.test_cryptobot
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
from unittest.mock import AsyncMock, patch

from aiohttp.test_utils import TestClient, TestServer
from sqlalchemy import select

import panel.xui_client as xui_client
import sub_server
from api.auth import create_jwt
from config import settings
from db.database import get_session, reset_db
from db.models import PaymentRecord, Subscription, User


class FakeBot:
    def __init__(self):
        self.sent = []

    async def send_message(self, chat_id, text, **kwargs):
        self.sent.append((chat_id, text))


async def main():
    await reset_db()
    bot = FakeBot()
    sub_server.set_bot_instance(bot)

    with patch.object(xui_client, "provision_client", new=AsyncMock(return_value=("crypto-uuid", 1, "crypto-sub"))), \
         patch.object(settings, "BOT_TOKEN", "test_bot_token_123"), \
         patch.object(settings, "CRYPTO_PAY_TOKEN", "12345:AA_test_crypto_token"):
        token = create_jwt({"id": 999, "username": "crypto_user"})

        auth_headers = {"Authorization": f"Bearer {token}"}

        fake_api_response = {
            "ok": True,
            "result": {
                "invoice_id": 55555,
                "bot_invoice_url": "https://t.me/CryptoBot?start=IV55555",
            }
        }

        cm = AsyncMock()
        cm.__aenter__.return_value.json = AsyncMock(return_value=fake_api_response)

        app = sub_server.create_app()
        app["bot"] = bot
        server = TestServer(app)
        client = TestClient(server)
        await client.start_server()
        try:
            # 1. POST /api/v1/purchase с method_id="cryptobot"
            with patch("aiohttp.ClientSession.post", return_value=cm):
                resp = await client.post(
                    "/api/v1/purchase",
                    json={"plan_id": "m1", "method_id": "cryptobot"},
                    headers=auth_headers,
                )
                assert resp.status == 200
                data = await resp.json()
                assert data.get("payment_url") == "https://t.me/CryptoBot?start=IV55555"
                print("OK: POST /api/v1/purchase запрашивает инвойс CryptoBot и возвращает payment_url")

            # 2. Симуляция HTTP Webhook от CryptoBot
            payload_body = {
                "update_id": 1,
                "update_type": "invoice_paid",
                "request_date": "2026-07-31T00:00:00Z",
                "payload": {
                    "invoice_id": 55555,
                    "status": "paid",
                    "payload": "crypto:m1:999",
                }
            }
            body_bytes = json.dumps(payload_body).encode("utf-8")

            secret_key = hashlib.sha256(b"12345:AA_test_crypto_token").digest()
            valid_signature = hmac.new(secret_key, body_bytes, hashlib.sha256).hexdigest()

            # 2a. Невалидная подпись -> 400
            resp_bad = await client.post(
                "/webhook/cryptopay",
                data=body_bytes,
                headers={"crypto-pay-api-signature": "wrong_sig", "Content-Type": "application/json"}
            )
            assert resp_bad.status == 400
            print("OK: CryptoBot вебхук с невалидной подписью возвращает 400")

            # 2b. Валидная подпись -> 200 OK и авто-выдача подписки
            resp_ok = await client.post(
                "/webhook/cryptopay",
                data=body_bytes,
                headers={"crypto-pay-api-signature": valid_signature, "Content-Type": "application/json"}
            )
            assert resp_ok.status == 200

            async with get_session() as session:
                sub = await session.scalar(select(Subscription).where(Subscription.user_tg_id == 999))
                assert sub is not None
                assert sub.plan_id == "m1"
                assert sub.xui_uuid == "crypto-uuid"

                record = await session.scalar(select(PaymentRecord).where(PaymentRecord.external_id == "crypto:55555"))
                assert record is not None
                assert record.provider == "crypto"

            assert len(bot.sent) == 1 and "Оплата прошла успешно" in bot.sent[0][1]
            print("OK: Валидный CryptoBot вебхук автоматически выдаёт подписку в 3x-ui")
        finally:
            await client.close()

    print("\nCRYPTOBOT WEBHOOK: ВСЕ ПРОВЕРКИ ПРОШЛИ")


def test_cryptobot_suite() -> None:
    asyncio.run(main())


if __name__ == "__main__":
    asyncio.run(main())



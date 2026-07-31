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
from bot.handlers import choose_payment_method
from db.database import get_session, reset_db
from db.models import PaymentRecord, Subscription
from config import settings


class FakeBot:
    def __init__(self):
        self.sent = []

    async def send_message(self, chat_id, text, **kwargs):
        self.sent.append((chat_id, text))


def fake_call(data: str, user_id: int):
    call = AsyncMock()
    call.data = data
    call.from_user.id = user_id
    call.from_user.username = "crypto_user"
    call.message.answer = AsyncMock()
    return call


async def main():
    await reset_db()
    xui_client.provision_client = AsyncMock(return_value=("crypto-uuid", 1, "crypto-sub"))
    bot = FakeBot()
    sub_server.set_bot_instance(bot)

    with patch.object(settings, "CRYPTO_PAY_TOKEN", "12345:AA_test_crypto_token"):

        # --- 1. choose_payment_method вызывает CryptoPay API ---
        fake_api_response = {
            "ok": True,
            "result": {
                "invoice_id": 55555,
                "bot_invoice_url": "https://t.me/CryptoBot?start=IV55555",
            }
        }

        cm = AsyncMock()
        cm.__aenter__.return_value.json = AsyncMock(return_value=fake_api_response)

        with patch("aiohttp.ClientSession.post", return_value=cm):
            call = fake_call("pay:m1:cryptobot", user_id=999)
            await choose_payment_method(call)

        call.message.answer.assert_called_once()
        answer_kwargs = call.message.answer.call_args.kwargs
        reply_markup = answer_kwargs.get("reply_markup")
        assert reply_markup is not None
        assert reply_markup.inline_keyboard[0][0].url == "https://t.me/CryptoBot?start=IV55555"
        print("OK: choose_payment_method запрашивает чек CryptoBot и отсылает ссылку")

        # --- 2. Симуляция HTTP Webhook от CryptoBot ---
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

        app = sub_server.create_app()
        server = TestServer(app)
        client = TestClient(server)
        await client.start_server()
        try:
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


if __name__ == "__main__":
    asyncio.run(main())

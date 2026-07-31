"""
Smoke-тест автоматической оплаты через ЮMoney Quickpay (HTTP Webhook):
- Генерация ссылки Quickpay в choose_payment_method
- Приём вебхука /webhook/yoomoney с валидацией SHA1 хеша
- Автоматический провижининг подписки в 3x-ui без участия админа

Запуск из корня проекта:
    python -m tests.test_yoomoney_auto
"""
from __future__ import annotations

import asyncio
import hashlib
import urllib.parse
from unittest.mock import AsyncMock, patch

from aiohttp.test_utils import TestClient, TestServer
from sqlalchemy import select

import panel.xui_client as xui_client
import sub_server
from bot.handlers import choose_payment_method
from db.database import get_session, reset_db
from db.models import PaymentRecord, PendingPayment, Subscription
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
    call.from_user.username = "yoo_user"
    call.message.answer = AsyncMock()
    return call


async def main():
    await reset_db()
    xui_client.provision_client = AsyncMock(return_value=("yoo-uuid", 1, "yoo-sub"))
    bot = FakeBot()
    sub_server.set_bot_instance(bot)

    with patch.object(settings, "YOOMONEY_WALLET", "41001234567890"), \
         patch.object(settings, "YOOMONEY_SECRET", "my_super_secret_123"):

        # --- 1. choose_payment_method генерирует ссылку Quickpay с кодом заказа ---
        call = fake_call("pay:m1:yoomoney_auto", user_id=777)
        await choose_payment_method(call)

        call.message.answer.assert_called_once()
        answer_text = call.message.answer.call_args.args[0]
        assert "Перейти к оплате" in answer_text or "ЮMoney" in answer_text
        reply_markup = call.message.answer.call_args.kwargs.get("reply_markup")
        assert reply_markup is not None
        quickpay_url = reply_markup.inline_keyboard[0][0].url
        assert "yoomoney.ru/quickpay" in quickpay_url

        # Находим созданный order_code из базы
        async with get_session() as session:
            pending = await session.scalar(select(PendingPayment).where(PendingPayment.user_tg_id == 777))
            assert pending is not None
            order_code = pending.order_code

        print("OK: choose_payment_method генерирует корректную ссылку ЮMoney Quickpay")

        # --- 2. Симуляция HTTP Webhook от ЮMoney ---
        notification_type = "card-incoming"
        operation_id = "test_op_999"
        amount = "199.00"
        currency = "643"
        datetime_val = "2026-07-31T00:00:00Z"
        sender = ""
        codeproto = "false"
        label = order_code

        check_str = f"{notification_type}&{operation_id}&{amount}&{currency}&{datetime_val}&{sender}&{codeproto}&my_super_secret_123&{label}"
        valid_sha1 = hashlib.sha1(check_str.encode("utf-8")).hexdigest()

        app = sub_server.create_app()
        server = TestServer(app)
        client = TestClient(server)
        await client.start_server()
        try:
            # 2a. Невалидный хеш -> 400
            invalid_post = {
                "notification_type": notification_type,
                "operation_id": operation_id,
                "amount": amount,
                "currency": currency,
                "datetime": datetime_val,
                "sender": sender,
                "codeproto": codeproto,
                "label": label,
                "sha1_hash": "wrong_hash",
            }
            resp_bad = await client.post("/webhook/yoomoney", data=invalid_post)
            assert resp_bad.status == 400
            print("OK: ЮMoney вебхук с невалидным SHA1 возвращает 400 Bad Request")

            # 2b. Валидный хеш -> 200 OK и авто-выдача подписки
            valid_post = {**invalid_post, "sha1_hash": valid_sha1}
            resp_ok = await client.post("/webhook/yoomoney", data=valid_post)
            assert resp_ok.status == 200

            async with get_session() as session:
                sub = await session.scalar(select(Subscription).where(Subscription.user_tg_id == 777))
                assert sub is not None
                assert sub.plan_id == "m1"
                assert sub.xui_uuid == "yoo-uuid"

                p = await session.get(PendingPayment, pending.id)
                assert p.status == "confirmed"

            assert len(bot.sent) == 1 and "Оплата прошла успешно" in bot.sent[0][1]
            print("OK: Валидный ЮMoney вебхук автоматически выдаёт подписку в 3x-ui")
        finally:
            await client.close()

    print("\nYOOMONEY AUTO WEBHOOK: ВСЕ ПРОВЕРКИ ПРОШЛИ")


if __name__ == "__main__":
    asyncio.run(main())

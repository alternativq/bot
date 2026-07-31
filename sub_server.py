"""
Сервер единой подписки: отдаёт по адресу /{token} склеенный конфиг всех
инбаундов пользователя вместе со служебными заголовками (Subscription-
Userinfo, Profile-Title, Profile-Update-Interval), которые клиенты вроде
Happ используют для показа названия/трафика/автообновления - без них
клиент просто показывает домен вместо названия и не знает про трафик.

Нужен только если в .env задан PUBLIC_SUB_BASE_URL (см. config.py) - без
него бот присылает несколько нативных ссылок по одной на инбаунд, что тоже
полностью рабочий вариант, просто менее удобный для клиентов с несколькими
инбаундами/локациями.

Публично наружу этот сервер слушать не должен - принимает трафик только от
локального nginx (SUB_SERVER_HOST по умолчанию 0.0.0.0:8081, проксируется
через nginx location, см. README).
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import logging
from typing import TYPE_CHECKING

from aiohttp import web
from sqlalchemy import select

from config import settings
from db.database import get_session
from db.models import PendingPayment, Subscription
from panel import xui_client
from plans import get_plan

if TYPE_CHECKING:
    from aiogram import Bot

log = logging.getLogger(__name__)

routes = web.RouteTableDef()

_bot_instance: Bot | None = None


@routes.get("/{token}")
async def serve_unified_subscription(request: web.Request) -> web.Response:
    token = request.match_info["token"]

    async with get_session() as session:
        sub = await session.scalar(select(Subscription).where(Subscription.public_token == token))

    if sub is None:
        return web.Response(status=404, text="not found")

    sub_ids = {int(k): v for k, v in (sub.xui_sub_ids or {}).items()}
    if not sub_ids:
        return web.Response(status=404, text="not found")

    try:
        content, userinfo = await xui_client.build_unified_subscription_content(sub_ids)
    except Exception:
        log.exception("Не удалось собрать единую подписку для токена %s", token)
        return web.Response(status=502, text="upstream error")

    profile_title = "base64:" + base64.b64encode(settings.BRAND_NAME.encode("utf-8")).decode("ascii")
    headers = {
        "Subscription-Userinfo": userinfo.as_header(),
        "Profile-Title": profile_title,
        "Profile-Update-Interval": str(settings.SUB_UPDATE_INTERVAL_HOURS),
    }
    return web.Response(text=content, content_type="text/plain", headers=headers)


def set_bot_instance(bot: Bot) -> None:
    global _bot_instance
    _bot_instance = bot


@routes.post("/webhook/yoomoney")
async def webhook_yoomoney(request: web.Request) -> web.Response:
    data = await request.post()
    notification_type = str(data.get("notification_type", ""))
    operation_id = str(data.get("operation_id", ""))
    amount = str(data.get("amount", ""))
    currency = str(data.get("currency", ""))
    datetime_val = str(data.get("datetime", ""))
    sender = str(data.get("sender", ""))
    codeproto = str(data.get("codeproto", ""))
    label = str(data.get("label", ""))
    sha1_hash = str(data.get("sha1_hash", ""))

    if settings.YOOMONEY_SECRET:
        check_str = f"{notification_type}&{operation_id}&{amount}&{currency}&{datetime_val}&{sender}&{codeproto}&{settings.YOOMONEY_SECRET}&{label}"
        expected_hash = hashlib.sha1(check_str.encode("utf-8")).hexdigest()
        if expected_hash.lower() != sha1_hash.lower():
            log.warning("Невалидный SHA1 хеш от ЮMoney для операции %s", operation_id)
            return web.Response(status=400, text="invalid hash")

    if not label:
        return web.Response(text="OK")

    async with get_session() as session:
        pending = await session.scalar(select(PendingPayment).where(PendingPayment.order_code == label))
        if pending is None:
            log.warning("Заявка ЮMoney с кодом %s не найдена", label)
            return web.Response(text="OK")

        if pending.status == "confirmed":
            return web.Response(text="OK")

    from services.provisioning import handle_manual_payment_confirmed
    if _bot_instance is not None:
        try:
            await handle_manual_payment_confirmed(pending, _bot_instance)
            async with get_session() as session:
                p = await session.get(PendingPayment, pending.id)
                if p:
                    p.status = "confirmed"
                    await session.commit()
        except Exception:
            log.exception("Ошибка обработки ЮMoney платежа %s", label)

    return web.Response(text="OK")


@routes.post("/webhook/cryptopay")
async def webhook_cryptopay(request: web.Request) -> web.Response:
    body = await request.read()
    signature = str(request.headers.get("crypto-pay-api-signature", ""))

    if settings.CRYPTO_PAY_TOKEN and signature:
        secret_key = hashlib.sha256(settings.CRYPTO_PAY_TOKEN.encode("utf-8")).digest()
        expected_sig = hmac.new(secret_key, body, hashlib.sha256).hexdigest()
        if expected_sig.lower() != signature.lower():
            log.warning("Невалидная подпись CryptoPay вебхука")
            return web.Response(status=400, text="invalid signature")

    try:
        data = await request.json()
    except Exception:
        return web.Response(status=400, text="invalid json")

    update_type = data.get("update_type")
    payload_data = data.get("payload", {})
    if update_type == "invoice_paid" and isinstance(payload_data, dict):
        invoice_id = payload_data.get("invoice_id")
        payload_str = str(payload_data.get("payload", ""))
        parts = payload_str.split(":")
        if len(parts) >= 3 and parts[0] == "crypto":
            plan_id = parts[1]
            user_id = int(parts[2])
            plan = get_plan(plan_id)
            if plan and _bot_instance:
                from services.provisioning import _finalize_purchase
                try:
                    await _finalize_purchase(
                        tg_id=user_id,
                        plan=plan,
                        external_id=f"crypto:{invoice_id}",
                        provider="crypto",
                        amount_rub=plan.price_rub,
                        bot=_bot_instance,
                    )
                except Exception:
                    log.exception("Ошибка обработки CryptoPay платежа %s", invoice_id)

    return web.Response(text="OK")


def create_app() -> web.Application:
    from api.middleware import auth_middleware, cors_middleware, error_middleware
    from api.routes import api_routes

    app = web.Application(middlewares=[error_middleware, cors_middleware, auth_middleware])
    app.add_routes(routes)      # существующие маршруты (подписки, вебхуки)
    app.add_routes(api_routes)  # новые API для Mini App
    return app


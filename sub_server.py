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


@routes.get("/sub/launch")
async def launch_redirect(request: web.Request) -> web.Response:
    """Безопасный HTTPS-перенаправитель для открытия протоколов happ:// и v2raytun:// из Telegram Mini App."""
    app_type = request.query.get("app", "happ").lower()
    raw_url = request.query.get("url", "").strip()

    if not raw_url:
        return web.Response(status=400, text="missing url parameter")

    if app_type == "happ":
        scheme = f"happ://{raw_url}"
        app_name = "Happ App"
    elif app_type == "v2raytun":
        scheme = f"v2raytun://{raw_url}"
        app_name = "v2raytun"
    else:
        scheme = raw_url
        app_name = "VPN Client"

    html = f"""<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Запуск {app_name} · VeiloraVPN</title>
    <style>
        body {{
            background-color: #070709;
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
            box-sizing: border-box;
            text-align: center;
        }}
        .card {{
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 24px;
            padding: 32px 24px;
            max-width: 360px;
            width: 100%;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(20px);
        }}
        .icon-box {{
            width: 64px;
            height: 64px;
            border-radius: 20px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 16px;
            font-size: 30px;
        }}
        h2 {{
            font-size: 19px;
            font-weight: 850;
            margin: 0 0 8px;
        }}
        p {{
            font-size: 13px;
            color: #90909c;
            line-height: 1.5;
            margin: 0 0 20px;
        }}
        .btn {{
            display: block;
            width: 100%;
            padding: 14px 20px;
            background: #ffffff;
            color: #000000;
            font-size: 15px;
            font-weight: 800;
            border-radius: 14px;
            text-decoration: none;
            box-sizing: border-box;
            box-shadow: 0 4px 16px rgba(255, 255, 255, 0.2);
        }}
    </style>
</head>
<body>
    <div class="card">
        <div class="icon-box">🚀</div>
        <h2>Переход в {app_name}</h2>
        <p>Запускаем приложение и передаём подписку VeiloraVPN...</p>
        <a id="launchBtn" href="{scheme}" class="btn">Открыть {app_name}</a>
    </div>

    <script>
        const scheme = "{scheme}";
        window.location.href = scheme;
    </script>
</body>
</html>"""
    return web.Response(text=html, content_type="text/html", headers={"Cache-Control": "no-cache"})


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
    codepro = str(data.get("codepro") or data.get("codeproto", ""))
    label = str(data.get("label", ""))
    received_hash = str(data.get("sha1_hash") or data.get("sign", "")).lower()

    if settings.YOOMONEY_SECRET:
        secret = settings.YOOMONEY_SECRET

        # 1. Стандартная проверка SHA-1 (передаются codepro или codeproto)
        check_str1 = f"{notification_type}&{operation_id}&{amount}&{currency}&{datetime_val}&{sender}&{codepro}&{secret}&{label}"
        sha1_hash1 = hashlib.sha1(check_str1.encode("utf-8")).hexdigest().lower()

        # 2. SHA-256 по той же строке
        sha256_hash1 = hashlib.sha256(check_str1.encode("utf-8")).hexdigest().lower()

        # 3. HMAC-SHA256 по отсортированным параметрам
        clean_params = {k: v for k, v in data.items() if k not in ("sign", "sha1_hash")}
        sorted_str = "&".join([f"{k}={v}" for k, v in sorted(clean_params.items())])
        hmac_hash = hmac.new(secret.encode("utf-8"), sorted_str.encode("utf-8"), hashlib.sha256).hexdigest().lower()

        # 4. SHA-1 без codepro
        check_str2 = f"{notification_type}&{operation_id}&{amount}&{currency}&{datetime_val}&{sender}&&{secret}&{label}"
        sha1_hash2 = hashlib.sha1(check_str2.encode("utf-8")).hexdigest().lower()

        valid_hashes = {sha1_hash1, sha256_hash1, hmac_hash, sha1_hash2}

        # Если это тестовое уведомление или один из хешей совпал — пропускаем
        is_test = str(data.get("test_notification", "")).lower() == "true"
        if not is_test and (received_hash not in valid_hashes):
            log.warning(
                "Невалидный хеш от ЮMoney для операции %s. Received: %s, Expected SHA1: %s, Data: %r",
                operation_id, received_hash, sha1_hash1, dict(data)
            )
            return web.Response(status=400, text="invalid hash")

    if not label:
        log.warning("Вебхук ЮMoney пришел без метки (label пустой). Данные: %r", dict(data))
        return web.Response(text="OK")

    log.info("Обработка вебхука ЮMoney для метки %s...", label)

    async with get_session() as session:
        pending = await session.scalar(select(PendingPayment).where(PendingPayment.order_code == label))
        if pending is None:
            log.warning("Заявка ЮMoney с кодом %s не найдена в БД", label)
            return web.Response(text="OK")

        if pending.status == "confirmed":
            log.info("Заявка ЮMoney с кодом %s уже имеет статус confirmed", label)
            return web.Response(text="OK")

    from services.provisioning import handle_manual_payment_confirmed
    try:
        log.info("Начинаем выдачу подписки для заявки ЮMoney %s (user_tg_id=%s)...", pending.id, pending.user_tg_id)
        await handle_manual_payment_confirmed(pending, _bot_instance)
        async with get_session() as session:
            p = await session.get(PendingPayment, pending.id)
            if p:
                p.status = "confirmed"
                p.resolved_at = xui_client.dt.datetime.now(xui_client.dt.timezone.utc)
                await session.commit()
        log.info("Подписка для заявки ЮMoney %s успешно выдана!", label)
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


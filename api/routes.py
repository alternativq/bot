"""
REST API endpoints для Telegram Mini App.

Все endpoints используют существующую бизнес-логику из services/ и panel/.
Никакого дублирования — только тонкий HTTP-слой поверх готовых сервисов.
"""
from __future__ import annotations

import base64
import io
import logging
import random
import string

import qrcode
from aiohttp import web
from sqlalchemy import select

from api.auth import create_jwt, validate_init_data
from config import settings
from db.database import get_session
from db.models import PaymentRecord, PendingPayment, Subscription, User
from panel import xui_client
from payment_methods import get_payment_method, get_payment_methods
from plans import ALL_PLANS, PLANS, TRIAL_PLAN, get_plan
from services.promo_system import (
    apply_code,
    calculate_discounted_amount,
    ensure_referral_code,
    get_active_discount_for_user,
)
from services.provisioning import handle_trial_activation

log = logging.getLogger(__name__)
api_routes = web.RouteTableDef()


def _json(data: dict | list, status: int = 200) -> web.Response:
    return web.json_response(data, status=status)


def _error(msg: str, status: int = 400) -> web.Response:
    return web.json_response({"error": msg}, status=status)


def _generate_order_code() -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


# ──────────────────────────────────────────────────────────────
# AUTH
# ──────────────────────────────────────────────────────────────

@api_routes.post("/api/v1/auth")
async def auth(request: web.Request) -> web.Response:
    """Валидация initData → JWT-токен."""
    try:
        body = await request.json()
    except Exception:
        return _error("Invalid JSON")

    init_data = body.get("initData", "")
    if not init_data:
        return _error("initData is required")

    user = validate_init_data(init_data)
    if user is None:
        return _error("Invalid initData signature", 401)

    tg_id = user.get("id")
    username = user.get("username")

    # Создаём пользователя в БД если ещё нет
    async with get_session() as session:
        db_user = await session.get(User, tg_id)
        if db_user is None:
            db_user = User(tg_id=tg_id, username=username)
            session.add(db_user)
            await session.commit()

    token = create_jwt(user)
    return _json({"token": token, "user": user})


# ──────────────────────────────────────────────────────────────
# PROFILE
# ──────────────────────────────────────────────────────────────

@api_routes.get("/api/v1/me")
async def get_me(request: web.Request) -> web.Response:
    """Профиль пользователя + текущая подписка."""
    tg_id = request["user"]["tg_id"]

    async with get_session() as session:
        user = await session.get(User, tg_id)
        sub = await session.scalar(
            select(Subscription).where(Subscription.user_tg_id == tg_id)
        )

    if user is None:
        return _error("User not found", 404)

    plan = get_plan(sub.plan_id) if sub else None
    active = sub.is_active() if sub else False

    # Subscription link
    sub_link = None
    if sub:
        sub_id = next(iter((sub.xui_sub_ids or {}).values()), None)
        if settings.unified_subscription_enabled:
            sub_link = f"{settings.PUBLIC_SUB_BASE_URL.rstrip('/')}/{sub.public_token}"
        elif sub_id:
            sub_link = xui_client.build_subscription_url(sub_id)

    # Referral code
    referral_code = await ensure_referral_code(tg_id)
    _, discount_percent = await get_active_discount_for_user(tg_id)

    result = {
        "tg_id": tg_id,
        "username": user.username,
        "trial_used": user.trial_used,
        "trial_enabled": settings.TRIAL_ENABLED,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "referral_code": referral_code,
        "discount_percent": discount_percent,
        "subscription": None,
    }

    if sub and plan:
        days_left = max(0, (sub.period_end - xui_client.dt.datetime.now(xui_client.dt.timezone.utc)).days) if active else 0
        result["subscription"] = {
            "plan_id": sub.plan_id,
            "plan_title": plan.title,
            "price_rub": plan.price_rub,
            "limit_ip": plan.limit_ip,
            "active": active,
            "disabled": sub.disabled,
            "period_end": sub.period_end.isoformat(),
            "days_left": days_left,
            "sub_link": sub_link,
            "public_token": sub.public_token,
        }

    return _json(result)


# ──────────────────────────────────────────────────────────────
# PLANS
# ──────────────────────────────────────────────────────────────

@api_routes.get("/api/v1/plans")
async def get_plans(request: web.Request) -> web.Response:
    """Список всех тарифов."""
    tg_id = request["user"]["tg_id"]

    async with get_session() as session:
        user = await session.get(User, tg_id)

    trial_available = (
        settings.TRIAL_ENABLED
        and user is not None
        and not user.trial_used
    )

    plans_list = []
    for plan in PLANS.values():
        plans_list.append({
            "id": plan.id,
            "title": plan.title,
            "price_rub": plan.price_rub,
            "price_usdt": plan.price_usdt,
            "duration_days": plan.duration_days,
            "total_gb": plan.total_gb,
            "limit_ip": plan.limit_ip,
            "is_trial": False,
        })

    if trial_available:
        plans_list.insert(0, {
            "id": TRIAL_PLAN.id,
            "title": TRIAL_PLAN.title,
            "price_rub": 0,
            "price_usdt": 0,
            "duration_days": TRIAL_PLAN.duration_days,
            "total_gb": TRIAL_PLAN.total_gb,
            "limit_ip": TRIAL_PLAN.limit_ip,
            "is_trial": True,
        })

    return _json({"plans": plans_list, "trial_available": trial_available})


# ──────────────────────────────────────────────────────────────
# PAYMENT METHODS
# ──────────────────────────────────────────────────────────────

@api_routes.get("/api/v1/payment-methods")
async def get_methods(request: web.Request) -> web.Response:
    """Доступные способы оплаты."""
    methods = get_payment_methods()
    return _json({
        "methods": [
            {
                "id": m.id,
                "title": m.title,
                "requisite_label": m.requisite_label,
                "requisite": m.requisite,
            }
            for m in methods
        ]
    })


# ──────────────────────────────────────────────────────────────
# PURCHASE
# ──────────────────────────────────────────────────────────────

@api_routes.post("/api/v1/purchase")
async def create_purchase(request: web.Request) -> web.Response:
    """Создание заявки на оплату."""
    tg_id = request["user"]["tg_id"]

    try:
        body = await request.json()
    except Exception:
        return _error("Invalid JSON")

    plan_id = body.get("plan_id")
    method_id = body.get("method_id")

    plan = get_plan(plan_id)
    if plan is None:
        return _error("Plan not found")

    # Активация пробного периода — без оплаты
    if plan.is_trial:
        async with get_session() as session:
            user = await session.get(User, tg_id)
            if user is None or user.trial_used:
                return _error("Trial already used")

        bot = request.app.get("bot")
        if bot is None:
            return _error("Bot not available", 503)

        try:
            await handle_trial_activation(tg_id, plan, bot)
        except Exception:
            log.exception("Trial activation failed for %s", tg_id)
            return _error("Trial activation failed", 500)

        async with get_session() as session:
            user = await session.get(User, tg_id)
            user.trial_used = True
            await session.commit()

        return _json({"status": "activated", "plan_id": plan.id})

    # Обычная покупка — требуется способ оплаты
    method = get_payment_method(method_id)
    if method is None:
        return _error("Payment method not found")

    _, discount_percent = await get_active_discount_for_user(tg_id)
    final_amount = calculate_discounted_amount(plan.price_rub, discount_percent)
    order_code = _generate_order_code()

    async with get_session() as session:
        if await session.get(User, tg_id) is None:
            session.add(User(tg_id=tg_id))

        while await session.scalar(
            select(PendingPayment).where(PendingPayment.order_code == order_code)
        ):
            order_code = _generate_order_code()

        pending = PendingPayment(
            user_tg_id=tg_id,
            plan_id=plan.id,
            method_id=method.id,
            order_code=order_code,
            discount_percent=discount_percent,
        )
        session.add(pending)
        await session.commit()
        pending_id = pending.id

    result: dict = {
        "pending_id": pending_id,
        "order_code": order_code,
        "plan_title": plan.title,
        "method_title": method.title,
        "amount_rub": final_amount,
        "discount_percent": discount_percent,
        "requisite_label": method.requisite_label,
        "requisite": method.requisite,
    }

    # Для ЮMoney авто — генерируем ссылку на оплату
    if method_id == "yoomoney_auto":
        import urllib.parse
        params = {
            "receiver": settings.YOOMONEY_WALLET,
            "quickpay-form": "shop",
            "targets": f"VPN {plan.title}",
            "sum": str(final_amount),
            "label": order_code,
        }
        result["payment_url"] = f"https://yoomoney.ru/quickpay/confirm.xml?{urllib.parse.urlencode(params)}"

    # Для CryptoBot — создаём инвойс
    if method_id == "cryptobot":
        import aiohttp
        try:
            headers = {"Crypto-Pay-API-Token": settings.CRYPTO_PAY_TOKEN}
            payload_data = {
                "asset": "USDT",
                "amount": str(plan.price_usdt),
                "description": f"VPN {plan.title}",
                "payload": f"crypto:{plan.id}:{tg_id}",
            }
            async with aiohttp.ClientSession() as http_session:
                async with http_session.post(
                    "https://pay.crypt.bot/api/createInvoice",
                    json=payload_data,
                    headers=headers,
                ) as resp:
                    res = await resp.json()
                    if res.get("ok"):
                        result["payment_url"] = (
                            res["result"].get("bot_invoice_url")
                            or res["result"].get("pay_url")
                        )
        except Exception:
            log.exception("CryptoBot invoice creation failed")

    return _json(result)


@api_routes.post("/api/v1/purchase/{pending_id}/paid")
async def mark_paid(request: web.Request) -> web.Response:
    """Пометить заявку как оплаченную — уведомляет администраторов."""
    tg_id = request["user"]["tg_id"]
    pending_id = int(request.match_info["pending_id"])

    async with get_session() as session:
        pending = await session.get(PendingPayment, pending_id)
        if pending is None or pending.user_tg_id != tg_id:
            return _error("Payment not found", 404)
        if pending.status != "pending":
            return _error(f"Payment already {pending.status}")

    # Уведомляем администраторов через бота
    bot = request.app.get("bot")
    if bot:
        plan = get_plan(pending.plan_id)
        method = get_payment_method(pending.method_id)
        username = request["user"].get("username")

        if plan and method:
            from bot import keyboards, texts
            notification = texts.admin_payment_notification(
                username, tg_id, plan, method, pending.order_code
            )
            for admin_id in settings.admin_ids:
                try:
                    await bot.send_message(
                        admin_id,
                        notification,
                        reply_markup=keyboards.admin_confirm_keyboard(pending_id),
                    )
                except Exception:
                    log.exception("Failed to notify admin %s", admin_id)

    return _json({"status": "notified"})


# ──────────────────────────────────────────────────────────────
# SUBSCRIPTION
# ──────────────────────────────────────────────────────────────

@api_routes.get("/api/v1/subscription")
async def get_subscription(request: web.Request) -> web.Response:
    """Детальная информация о подписке."""
    tg_id = request["user"]["tg_id"]

    async with get_session() as session:
        sub = await session.scalar(
            select(Subscription).where(Subscription.user_tg_id == tg_id)
        )

    if sub is None:
        return _json({"subscription": None})

    plan = get_plan(sub.plan_id)
    active = sub.is_active()
    sub_id = next(iter((sub.xui_sub_ids or {}).values()), None)

    # Ссылка подписки
    if settings.unified_subscription_enabled:
        sub_link = f"{settings.PUBLIC_SUB_BASE_URL.rstrip('/')}/{sub.public_token}"
    elif sub_id:
        sub_link = xui_client.build_subscription_url(sub_id)
    else:
        sub_link = None

    # Трафик
    upload, download = await xui_client.get_client_traffic(tg_id)

    import datetime as dt
    days_left = max(0, (sub.period_end - dt.datetime.now(dt.timezone.utc)).days) if active else 0

    return _json({
        "subscription": {
            "plan_id": sub.plan_id,
            "plan_title": plan.title if plan else sub.plan_id,
            "price_rub": plan.price_rub if plan else 0,
            "duration_days": plan.duration_days if plan else 0,
            "limit_ip": plan.limit_ip if plan else 0,
            "total_gb": plan.total_gb if plan else 0,
            "active": active,
            "disabled": sub.disabled,
            "period_end": sub.period_end.isoformat(),
            "days_left": days_left,
            "sub_link": sub_link,
            "public_token": sub.public_token,
            "traffic": {
                "upload": upload,
                "download": download,
                "total_bytes": (plan.total_gb * 1024**3) if plan and plan.total_gb else 0,
            },
        }
    })


@api_routes.get("/api/v1/subscription/qr")
async def get_subscription_qr(request: web.Request) -> web.Response:
    """QR-код со ссылкой подписки (PNG в base64)."""
    tg_id = request["user"]["tg_id"]

    async with get_session() as session:
        sub = await session.scalar(
            select(Subscription).where(Subscription.user_tg_id == tg_id)
        )

    if sub is None:
        return _error("No subscription", 404)

    sub_id = next(iter((sub.xui_sub_ids or {}).values()), None)
    if settings.unified_subscription_enabled:
        sub_link = f"{settings.PUBLIC_SUB_BASE_URL.rstrip('/')}/{sub.public_token}"
    elif sub_id:
        sub_link = xui_client.build_subscription_url(sub_id)
    else:
        return _error("No subscription link", 404)

    # Генерируем QR
    qr = qrcode.QRCode(version=1, box_size=10, border=2)
    qr.add_data(sub_link)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    qr_b64 = base64.b64encode(buf.getvalue()).decode("ascii")

    return _json({"qr_base64": qr_b64, "sub_link": sub_link})


# ──────────────────────────────────────────────────────────────
# PAYMENT HISTORY
# ──────────────────────────────────────────────────────────────

@api_routes.get("/api/v1/payments/history")
async def payments_history(request: web.Request) -> web.Response:
    """История платежей пользователя."""
    tg_id = request["user"]["tg_id"]

    async with get_session() as session:
        records = await session.scalars(
            select(PaymentRecord)
            .where(PaymentRecord.user_tg_id == tg_id)
            .order_by(PaymentRecord.created_at.desc())
            .limit(50)
        )
        payments = [
            {
                "id": r.id,
                "provider": r.provider,
                "plan_id": r.plan_id,
                "plan_title": (get_plan(r.plan_id) or type("", (), {"title": r.plan_id})).title,
                "amount_rub": r.amount_rub,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in records
        ]

    return _json({"payments": payments})


# ──────────────────────────────────────────────────────────────
# PROMO / REFERRAL
# ──────────────────────────────────────────────────────────────

@api_routes.post("/api/v1/promo/apply")
async def apply_promo(request: web.Request) -> web.Response:
    """Применение промокода или реферального кода."""
    tg_id = request["user"]["tg_id"]

    try:
        body = await request.json()
    except Exception:
        return _error("Invalid JSON")

    code = body.get("code", "").strip()
    if not code:
        return _error("Code is required")

    ok, message = await apply_code(tg_id, code)
    return _json({"success": ok, "message": message})


@api_routes.get("/api/v1/promo/referral")
async def get_referral(request: web.Request) -> web.Response:
    """Реферальный код и ссылка пользователя."""
    tg_id = request["user"]["tg_id"]
    code = await ensure_referral_code(tg_id)

    bot_username = settings.BOT_USERNAME
    ref_link = f"https://t.me/{bot_username}?start={code}" if bot_username else f"ref:{code}"

    return _json({
        "referral_code": code,
        "referral_link": ref_link,
    })


# ──────────────────────────────────────────────────────────────
# TRIAL
# ──────────────────────────────────────────────────────────────

@api_routes.post("/api/v1/trial/activate")
async def activate_trial(request: web.Request) -> web.Response:
    """Активация пробного периода."""
    tg_id = request["user"]["tg_id"]

    if not settings.TRIAL_ENABLED:
        return _error("Trial is disabled")

    async with get_session() as session:
        user = await session.get(User, tg_id)
        if user is None:
            return _error("User not found", 404)
        if user.trial_used:
            return _error("Trial already used")

    bot = request.app.get("bot")
    if bot is None:
        return _error("Bot not available", 503)

    try:
        await handle_trial_activation(tg_id, TRIAL_PLAN, bot)
    except Exception:
        log.exception("Trial activation failed for %s", tg_id)
        return _error("Trial activation failed", 500)

    async with get_session() as session:
        user = await session.get(User, tg_id)
        user.trial_used = True
        await session.commit()

    return _json({"status": "activated"})

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
from services.provisioning import handle_trial_activation, utcnow

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
        "is_admin": tg_id in settings.admin_ids,
        "trial_used": user.trial_used,
        "trial_enabled": settings.TRIAL_ENABLED,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "referral_code": referral_code,
        "discount_percent": discount_percent,
        "subscription": None,
    }

    if sub and plan:
        days_left = max(0, (sub.period_end - xui_client.dt.datetime.now(xui_client.dt.timezone.utc)).days) if active else 0
        total_days = max(plan.duration_days if plan else 30, days_left) if active else 30
        result["subscription"] = {
            "plan_id": sub.plan_id,
            "plan_title": plan.title,
            "price_rub": plan.price_rub,
            "limit_ip": plan.limit_ip,
            "active": active,
            "disabled": sub.disabled,
            "period_end": sub.period_end.isoformat(),
            "days_left": days_left,
            "total_days": total_days,
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

    days_left = 0
    async with get_session() as session:
        user = await session.get(User, tg_id)
        sub = await session.scalar(select(Subscription).where(Subscription.user_tg_id == tg_id))
        if sub and sub.is_active():
            now = utcnow()
            if sub.period_end > now:
                days_left = (sub.period_end - now).days

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

    return _json({
        "plans": plans_list,
        "trial_available": trial_available,
        "days_left": days_left,
        "max_subscription_days": settings.MAX_SUBSCRIPTION_DAYS,
    })


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
                "payment_url": m.payment_url,
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

    # Проверка превышения максимального лимита дней (MAX_SUBSCRIPTION_DAYS)
    async with get_session() as session:
        sub = await session.scalar(select(Subscription).where(Subscription.user_tg_id == tg_id))
        if sub and sub.is_active():
            now = utcnow()
            if sub.period_end > now:
                current_days = (sub.period_end - now).days
                if current_days + plan.duration_days > settings.MAX_SUBSCRIPTION_DAYS:
                    max_allowed = max(0, settings.MAX_SUBSCRIPTION_DAYS - current_days)
                    return _error(
                        f"Максимальный срок подписки — {settings.MAX_SUBSCRIPTION_DAYS} дней. "
                        f"У вас уже осталось {current_days} дн. Вы можете продлить подписку не более чем на {max_allowed} дн."
                    )

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
            status="created",
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

    if method.payment_url:
        result["payment_url"] = method.payment_url

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
        if pending.status not in ("created", "pending"):
            return _error(f"Payment already {pending.status}")
        if pending.status == "created":
            pending.status = "pending"
            await session.commit()

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


@api_routes.get("/api/v1/purchase/{pending_id}/status")
async def get_purchase_status(request: web.Request) -> web.Response:
    """Проверка статуса заявки на оплату (pending / confirmed / rejected)."""
    tg_id = request["user"]["tg_id"]
    try:
        pending_id = int(request.match_info["pending_id"])
    except ValueError:
        return _error("Invalid pending_id")

    async with get_session() as session:
        pending = await session.get(PendingPayment, pending_id)
        if pending is None or pending.user_tg_id != tg_id:
            return _error("Payment not found", 404)
        return _json({
            "pending_id": pending.id,
            "status": pending.status,
            "order_code": pending.order_code,
        })


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
    total_days = max(plan.duration_days if plan else 30, days_left) if active else 30

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
            "total_days": total_days,
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
    img.save(buf)
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


# ──────────────────────────────────────────────────────────────
# ADMIN ENDPOINTS
# ──────────────────────────────────────────────────────────────

def _check_admin(request: web.Request) -> bool:
    tg_id = request["user"].get("tg_id")
    return bool(tg_id and tg_id in settings.admin_ids)


@api_routes.get("/api/v1/admin/users/search")
async def admin_search_users(request: web.Request) -> web.Response:
    if not _check_admin(request):
        return _error("Forbidden", 403)

    q = request.query.get("q", "").strip().lower()
    async with get_session() as session:
        if q.lstrip("-").isdigit():
            target_id = int(q.lstrip("-"))
            users = await session.scalars(select(User).where(User.tg_id == target_id))
        elif q.startswith("@"):
            uname = q[1:]
            users = await session.scalars(select(User).where(User.username.ilike(f"%{uname}%")))
        elif q:
            users = await session.scalars(select(User).where(User.username.ilike(f"%{q}%")))
        else:
            users = await session.scalars(select(User).limit(50))

        result = []
        for u in users:
            sub = await session.scalar(select(Subscription).where(Subscription.user_tg_id == u.tg_id))
            plan = get_plan(sub.plan_id) if sub else None
            result.append({
                "tg_id": u.tg_id,
                "username": u.username,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "subscription": {
                    "plan_title": plan.title if plan else sub.plan_id,
                    "active": sub.is_active(),
                    "disabled": sub.disabled,
                    "period_end": sub.period_end.isoformat(),
                } if sub else None,
            })

    return _json({"users": result})


@api_routes.get("/api/v1/admin/user/{target_tg_id}")
async def admin_get_user(request: web.Request) -> web.Response:
    if not _check_admin(request):
        return _error("Forbidden", 403)

    target_tg_id = int(request.match_info["target_tg_id"])
    async with get_session() as session:
        user = await session.get(User, target_tg_id)
        sub = await session.scalar(select(Subscription).where(Subscription.user_tg_id == target_tg_id))

    if user is None:
        return _error("User not found", 404)

    plan = get_plan(sub.plan_id) if sub else None
    active = sub.is_active() if sub else False
    upload, download = await xui_client.get_client_traffic(target_tg_id)

    inbounds = []
    try:
        raw_inbounds = await xui_client.get_all_inbounds()
        inbounds = [
            {
                "id": ib.id,
                "remark": ib.remark,
                "port": getattr(ib, "port", None),
                "protocol": getattr(ib, "protocol", None),
            }
            for ib in raw_inbounds
        ]
    except Exception:
        log.exception("Failed to fetch 3x-ui inbounds for admin")

    return _json({
        "user": {
            "tg_id": user.tg_id,
            "username": user.username,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        },
        "subscription": {
            "plan_id": sub.plan_id,
            "plan_title": plan.title if plan else sub.plan_id,
            "active": active,
            "disabled": sub.disabled,
            "period_end": sub.period_end.isoformat(),
            "xui_sub_ids": sub.xui_sub_ids or {},
        } if sub else None,
        "traffic": {
            "upload": upload,
            "download": download,
            "total_bytes": (plan.total_gb * 1024**3) if plan and plan.total_gb else 0,
        },
        "inbounds": inbounds,
    })


@api_routes.post("/api/v1/admin/user/{target_tg_id}/extend")
async def admin_extend_user(request: web.Request) -> web.Response:
    if not _check_admin(request):
        return _error("Forbidden", 403)

    target_tg_id = int(request.match_info["target_tg_id"])
    try:
        body = await request.json()
        days = int(body.get("days", 7))
    except Exception:
        return _error("Invalid days argument")

    from services.provisioning import admin_extend_subscription
    try:
        sub = await admin_extend_subscription(target_tg_id, days)
        if sub is None:
            return _error("Subscription not found", 404)
        return _json({"status": "extended", "period_end": sub.period_end.isoformat()})
    except Exception as e:
        log.exception("Admin extend failed")
        return _error(str(e), 500)


@api_routes.post("/api/v1/admin/user/{target_tg_id}/toggle")
async def admin_toggle_user(request: web.Request) -> web.Response:
    if not _check_admin(request):
        return _error("Forbidden", 403)

    target_tg_id = int(request.match_info["target_tg_id"])
    from services.provisioning import admin_toggle_subscription
    try:
        new_disabled = await admin_toggle_subscription(target_tg_id)
        if new_disabled is None:
            return _error("Subscription not found", 404)
        return _json({"disabled": new_disabled})
    except Exception as e:
        log.exception("Admin toggle failed")
        return _error(str(e), 500)


@api_routes.post("/api/v1/admin/user/{target_tg_id}/add-inbound")
async def admin_add_inbound_user(request: web.Request) -> web.Response:
    if not _check_admin(request):
        return _error("Forbidden", 403)

    target_tg_id = int(request.match_info["target_tg_id"])
    try:
        body = await request.json()
        inbound_id = int(body.get("inbound_id"))
    except Exception:
        return _error("Invalid inbound_id")

    from services.provisioning import assign_inbound_to_subscription
    try:
        sub = await assign_inbound_to_subscription(target_tg_id, inbound_id)
        if sub is None:
            return _error("Subscription not found", 404)
        return _json({"status": "inbound_assigned"})
    except Exception as e:
        log.exception("Admin add inbound failed")
        return _error(str(e), 500)


@api_routes.get("/api/v1/admin/pending-payments")
async def admin_pending_payments(request: web.Request) -> web.Response:
    if not _check_admin(request):
        return _error("Forbidden", 403)

    async with get_session() as session:
        pendings = await session.scalars(
            select(PendingPayment)
            .where(
                PendingPayment.status == "pending",
                PendingPayment.method_id.notin_(["yoomoney_auto", "cryptobot"])
            )
            .order_by(PendingPayment.created_at.desc())
        )
        result = []
        for p in pendings:
            user = await session.get(User, p.user_tg_id)
            plan = get_plan(p.plan_id)
            method = get_payment_method(p.method_id)
            final_amount = calculate_discounted_amount(plan.price_rub if plan else 0, p.discount_percent)
            result.append({
                "id": p.id,
                "user_tg_id": p.user_tg_id,
                "username": user.username if user else None,
                "plan_id": p.plan_id,
                "plan_title": plan.title if plan else p.plan_id,
                "method_id": p.method_id,
                "method_title": method.title if method else p.method_id,
                "order_code": p.order_code,
                "amount_rub": final_amount,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            })

    return _json({"pending": result})


@api_routes.post("/api/v1/admin/pending-payments/{pending_id}/resolve")
async def admin_resolve_payment(request: web.Request) -> web.Response:
    if not _check_admin(request):
        return _error("Forbidden", 403)

    pending_id = int(request.match_info["pending_id"])
    try:
        body = await request.json()
        action = body.get("action")
    except Exception:
        return _error("Invalid body")

    async with get_session() as session:
        pending = await session.get(PendingPayment, pending_id)
        if pending is None:
            return _error("Pending payment not found", 404)
        if pending.status != "pending":
            return _error(f"Payment already {pending.status}")

        if action == "reject":
            pending.status = "rejected"
            pending.resolved_at = xui_client.dt.datetime.now(xui_client.dt.timezone.utc)
            pending.resolved_by = request["user"]["tg_id"]
            await session.commit()
            return _json({"status": "rejected"})

        pending.status = "processing"
        await session.commit()

    bot = request.app.get("bot")
    from services.provisioning import handle_manual_payment_confirmed
    try:
        async with get_session() as session:
            pending = await session.get(PendingPayment, pending_id)
        await handle_manual_payment_confirmed(pending, bot)
        async with get_session() as session:
            pending = await session.get(PendingPayment, pending_id)
            if pending:
                pending.status = "confirmed"
                pending.resolved_at = xui_client.dt.datetime.now(xui_client.dt.timezone.utc)
                pending.resolved_by = request["user"]["tg_id"]
                await session.commit()
        return _json({"status": "confirmed"})
    except Exception as e:
        log.exception("Admin payment confirmation failed")
        async with get_session() as session:
            pending = await session.get(PendingPayment, pending_id)
            if pending:
                pending.status = "pending"
                await session.commit()
        return _error(str(e), 500)


@api_routes.post("/api/v1/admin/user/{target_tg_id}/delete-sub")
async def admin_delete_user_sub(request: web.Request) -> web.Response:
    if not _check_admin(request):
        return _error("Forbidden", 403)

    target_tg_id = int(request.match_info["target_tg_id"])
    from services.provisioning import admin_delete_subscription
    try:
        deleted = await admin_delete_subscription(target_tg_id)
        if not deleted:
            return _error("Subscription not found", 404)
        return _json({"status": "deleted"})
    except Exception as e:
        log.exception("Admin delete subscription failed")
        return _error(str(e), 500)


@api_routes.post("/api/v1/admin/user/{target_tg_id}/grant-trial")
async def admin_grant_user_trial(request: web.Request) -> web.Response:
    if not _check_admin(request):
        return _error("Forbidden", 403)

    target_tg_id = int(request.match_info["target_tg_id"])
    from services.provisioning import admin_grant_trial
    try:
        bot = request.app.get("bot")
        sub = await admin_grant_trial(target_tg_id, bot=bot)
        return _json({"status": "granted", "period_end": sub.period_end.isoformat()})
    except Exception as e:
        log.exception("Admin grant trial failed")
        return _error(str(e), 500)


@api_routes.post("/api/v1/admin/user/{target_tg_id}/delete-user")
async def admin_delete_user(request: web.Request) -> web.Response:
    """Полное удаление пользователя из БД и панели 3x-ui."""
    if not _check_admin(request):
        return _error("Forbidden", 403)

    target_tg_id = int(request.match_info["target_tg_id"])
    from services.provisioning import admin_delete_user_completely
    try:
        await admin_delete_user_completely(target_tg_id)
        return _json({"status": "deleted"})
    except Exception as e:
        log.exception("Admin delete user completely failed")
        return _error(str(e), 500)


@api_routes.get("/api/v1/admin/promos")
async def admin_get_promos(request: web.Request) -> web.Response:
    """Получение списка всех промокодов администратора."""
    if not _check_admin(request):
        return _error("Forbidden", 403)

    from db.models import PromoCode, PromoUsage
    async with get_session() as session:
        promos = (await session.scalars(select(PromoCode).order_by(PromoCode.created_at.desc()))).all()
        usages = (await session.scalars(select(PromoUsage))).all()

        usage_counts: dict[str, int] = {}
        for u in usages:
            code_norm = u.code.lower()
            usage_counts[code_norm] = usage_counts.get(code_norm, 0) + 1

        res = []
        for p in promos:
            code_norm = p.code.lower()
            res.append({
                "id": p.id,
                "code": p.code,
                "discount_percent": p.discount_percent,
                "bonus_days": getattr(p, "bonus_days", 0) or 0,
                "uses_left": p.uses_left,
                "is_active": p.is_active,
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "uses_count": usage_counts.get(code_norm, 0),
            })

    return _json({"promos": res})


@api_routes.post("/api/v1/admin/promos")
async def admin_create_promo(request: web.Request) -> web.Response:
    """Создание нового промокода."""
    if not _check_admin(request):
        return _error("Forbidden", 403)

    from db.models import PromoCode
    from services.promo_system import normalize_code

    try:
        body = await request.json()
    except Exception:
        return _error("Invalid JSON")

    raw_code = str(body.get("code", "")).strip()
    discount_percent = int(body.get("discount_percent", 0))
    bonus_days = int(body.get("bonus_days", 0))
    uses_left_val = body.get("uses_left")
    uses_left = int(uses_left_val) if uses_left_val is not None and str(uses_left_val).isdigit() else None

    norm = normalize_code(raw_code)
    if not norm:
        return _error("Введите код промокода")

    async with get_session() as session:
        existing = await session.scalar(select(PromoCode).where(PromoCode.code == norm))
        if existing is not None:
            return _error("Промокод с таким названием уже существует")

        new_promo = PromoCode(
            code=norm,
            discount_percent=discount_percent,
            bonus_days=bonus_days,
            uses_left=uses_left,
            is_active=True,
            created_by_tg_id=request["user"]["tg_id"],
        )
        session.add(new_promo)
        await session.commit()

        return _json({
            "status": "created",
            "promo": {
                "id": new_promo.id,
                "code": new_promo.code,
                "discount_percent": new_promo.discount_percent,
                "bonus_days": new_promo.bonus_days,
                "uses_left": new_promo.uses_left,
                "is_active": new_promo.is_active,
                "uses_count": 0,
            }
        })


@api_routes.delete("/api/v1/admin/promos/{promo_id}")
async def admin_delete_promo(request: web.Request) -> web.Response:
    """Удаление промокода."""
    if not _check_admin(request):
        return _error("Forbidden", 403)

    from db.models import PromoCode
    promo_id = int(request.match_info["promo_id"])

    async with get_session() as session:
        promo = await session.get(PromoCode, promo_id)
        if promo is None:
            return _error("Promo code not found", 404)
        await session.delete(promo)
        await session.commit()

    return _json({"status": "deleted"})


@api_routes.get("/api/v1/admin/stats")
async def admin_get_stats(request: web.Request) -> web.Response:
    """Получение финансовой статистики и сводки пользователей."""
    if not _check_admin(request):
        return _error("Forbidden", 403)

    from db.models import PaymentRecord, Subscription, User
    now = xui_client.dt.datetime.now(xui_client.dt.timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now - xui_client.dt.timedelta(days=30)

    async with get_session() as session:
        total_users = len((await session.scalars(select(User))).all())

        all_subs = (await session.scalars(select(Subscription))).all()
        active_subs = 0
        expiring_3days = 0

        for s in all_subs:
            if s.is_active() and not s.disabled:
                active_subs += 1
                days_rem = (s.period_end - now).days
                if 0 <= days_rem <= 3:
                    expiring_3days += 1

        all_payments = (await session.scalars(select(PaymentRecord))).all()
        total_revenue = sum(p.amount_rub for p in all_payments)
        revenue_today = sum(p.amount_rub for p in all_payments if p.created_at and p.created_at >= today_start)
        revenue_month = sum(p.amount_rub for p in all_payments if p.created_at and p.created_at >= month_start)

    return _json({
        "total_users": total_users,
        "active_subs": active_subs,
        "expiring_3days": expiring_3days,
        "revenue_today": revenue_today,
        "revenue_month": revenue_month,
        "total_revenue": total_revenue,
    })


@api_routes.post("/api/v1/admin/broadcast")
async def admin_broadcast(request: web.Request) -> web.Response:
    """Массовая рассылка сообщений пользователям."""
    if not _check_admin(request):
        return _error("Forbidden", 403)

    try:
        body = await request.json()
    except Exception:
        return _error("Invalid JSON")

    message_text = str(body.get("message", "")).strip()
    if not message_text:
        return _error("Введите текст сообщения")

    if "УВЕДОМЛЕНИЕ" in message_text.upper() or "ОПОВЕЩЕНИЕ" in message_text.upper():
        formatted_text = message_text
    else:
        formatted_text = f"<b>📢 УВЕДОМЛЕНИЕ ОТ VEILORAVPN</b>\n────────────────────────\n\n{message_text}"



    bot = request.app.get("bot")
    if not bot:
        return _error("Bot not configured")

    from db.models import User
    import asyncio

    async with get_session() as session:
        users = (await session.scalars(select(User))).all()

    sent_count = 0
    failed_count = 0

    for u in users:
        try:
            await bot.send_message(
                u.tg_id,
                formatted_text,
                parse_mode="HTML",
                disable_web_page_preview=True
            )
            sent_count += 1
            await asyncio.sleep(0.04)
        except Exception:
            failed_count += 1

    return _json({
        "status": "completed",
        "sent_count": sent_count,
        "failed_count": failed_count,
        "total": len(users),
    })


# ──────────────────────────────────────────────────────────────
# WEB PORTAL / EMERGENCY TRIAL ENDPOINTS (NO VPN ACCESS)
# ──────────────────────────────────────────────────────────────

import hmac
import hashlib
import time
import secrets
import datetime as dt
from db.models import WebTrialSession, User, Subscription, PaymentRecord


@api_routes.get("/api/v1/web/config")
async def get_web_config(request: web.Request) -> web.Response:
    """Общая публичная конфигурация для веб-портала (без авторизации)."""
    return _json({
        "brand_name": settings.BRAND_NAME,
        "bot_username": settings.BOT_USERNAME,
        "web_trial_enabled": settings.WEB_TRIAL_ENABLED and settings.TRIAL_ENABLED,
        "trial_duration_days": settings.TRIAL_DURATION_DAYS,
    })


@api_routes.get("/api/v1/web/captcha")
async def get_web_captcha(request: web.Request) -> web.Response:
    """Генерация легкой капчи (математического примера) для защиты от ботов."""
    num1 = random.randint(1, 9)
    num2 = random.randint(1, 9)
    solution = num1 + num2
    timestamp = int(time.time())
    secret_key = settings.JWT_SECRET or settings.BOT_TOKEN or "default_secret"
    raw_str = f"{solution}:{timestamp}"
    sig = hmac.new(secret_key.encode("utf-8"), raw_str.encode("utf-8"), hashlib.sha256).hexdigest()
    captcha_id = f"{solution}:{timestamp}:{sig}"

    return _json({
        "captcha_id": captcha_id,
        "question": f"Сколько будет {num1} + {num2}?",
    })


def _get_client_ip(request: web.Request) -> str:


    real_ip = request.headers.get("X-Real-IP", "").strip()
    if real_ip:
        return real_ip
    forwarded = request.headers.get("X-Forwarded-For", "").strip()
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote or "127.0.0.1"


async def _find_subscription(session, query_str: str) -> Subscription | None:
    query_str = query_str.strip()
    if not query_str:
        return None

    import re
    candidates = [query_str]

    cleaned = query_str.split("?")[0].rstrip("/")
    if "/" in cleaned:
        last = cleaned.split("/")[-1]
        candidates.append(last)
        if "start=web_" in last:
            candidates.append(last.split("start=web_")[-1])
        elif last.startswith("web_"):
            candidates.append(last[4:])

    if query_str.startswith("@"):
        candidates.append(query_str.lstrip("@"))

    uuids = re.findall(r"[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}", query_str)
    candidates.extend(uuids)

    # 1. Search by public_token or xui_uuid
    for c in candidates:
        sub = await session.scalar(
            select(Subscription).where(
                (Subscription.public_token == c) | (Subscription.xui_uuid == c)
            )
        )
        if sub:
            return sub

    # 2. Search by integer Telegram ID
    for c in candidates:
        if c.lstrip("-").isdigit():
            tg_id_val = int(c)
            sub = await session.scalar(select(Subscription).where(Subscription.user_tg_id == tg_id_val))
            if sub:
                return sub

    # 3. Search by username
    for c in candidates:
        db_user = await session.scalar(select(User).where(User.username.ilike(c)))
        if db_user:
            sub = await session.scalar(select(Subscription).where(Subscription.user_tg_id == db_user.tg_id))
            if sub:
                return sub

    # 4. Search within xui_sub_ids dict values
    all_subs = (await session.scalars(select(Subscription))).all()
    for sub in all_subs:
        if sub.xui_sub_ids:
            for sub_id_val in sub.xui_sub_ids.values():
                for c in candidates:
                    if str(sub_id_val) == c:
                        return sub

    return None


@api_routes.post("/api/v1/web/free-trial")
async def post_web_free_trial(request: web.Request) -> web.Response:
    """Выдача бесплатного пробного VPN ключа через веб-сайт."""
    if not settings.WEB_TRIAL_ENABLED or not settings.TRIAL_ENABLED:
        return _error("Выдача пробного периода на сайте временно отключена", 403)

    try:
        body = await request.json()
    except Exception:
        return _error("Invalid JSON")

    captcha_id = str(body.get("captcha_id", ""))
    answer = str(body.get("answer", "")).strip()

    if not captcha_id or not answer:
        return _error("Заполните проверочный ответ (капчу)")

    # Проверка капчи
    parts = captcha_id.split(":")
    if len(parts) != 3:
        return _error("Невалидная капча", 400)

    solution_str, ts_str, sig = parts
    try:
        ts = int(ts_str)
        if time.time() - ts > 600:  # 10 минут
            return _error("Срок действия капчи истёк, попробуйте снова", 400)
    except ValueError:
        return _error("Невалидная капча", 400)

    secret_key = settings.JWT_SECRET or settings.BOT_TOKEN or "default_secret"
    expected_sig = hmac.new(secret_key.encode("utf-8"), f"{solution_str}:{ts_str}".encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected_sig) or answer != solution_str:
        return _error("Неверный ответ на проверочный вопрос", 400)

    # Проверка IP адреса
    ip_addr = _get_client_ip(request)
    now_utc = utcnow()
    day_ago = now_utc - dt.timedelta(hours=24)

    async with get_session() as session:
        recent_ip_trials = (await session.scalars(
            select(WebTrialSession).where(
                WebTrialSession.ip_address == ip_addr,
                WebTrialSession.created_at >= day_ago
            )
        )).all()

        if len(recent_ip_trials) >= settings.WEB_TRIAL_MAX_PER_IP:
            return _error("С вашего IP-адреса уже был получен бесплатный период за последние 24 часа. Повторное получение подписки недоступно.", 429)

    # Создаём пробную подписку
    synthetic_tg_id = -random.randint(100000000, 999999999)
    period_end = now_utc + dt.timedelta(days=settings.TRIAL_DURATION_DAYS)

    try:
        client_uuid, inbound_id, sub_id = await xui_client.provision_client(
            tg_id=synthetic_tg_id,
            period_end=period_end,
            total_gb=TRIAL_PLAN.total_gb,
            limit_ip=TRIAL_PLAN.limit_ip,
            flow=TRIAL_PLAN.flow,
        )
    except Exception:
        log.exception("Не удалось создать клиента в 3X-UI для веб-пробника")
        return _error("Ошибка панели 3X-UI при создании ключа. Попробуйте позже.", 502)

    public_token = secrets.token_urlsafe(24)
    async with get_session() as session:
        session.add(User(tg_id=synthetic_tg_id, trial_used=True))
        await session.flush()
        sub = Subscription(
            user_tg_id=synthetic_tg_id,
            plan_id=TRIAL_PLAN.id,
            xui_uuid=client_uuid,
            xui_sub_ids={str(inbound_id): sub_id},
            public_token=public_token,
            period_end=period_end,
        )
        session.add(sub)

        session.add(PaymentRecord(
            external_id=f"web_trial:{synthetic_tg_id}",
            provider="web_trial",
            user_tg_id=synthetic_tg_id,
            plan_id=TRIAL_PLAN.id,
            amount_rub=0,
        ))
        session.add(WebTrialSession(
            ip_address=ip_addr,
            public_token=public_token,
        ))
        await session.commit()

    # Формируем ссылки
    if settings.unified_subscription_enabled:
        sub_link = f"{settings.PUBLIC_SUB_BASE_URL.rstrip('/')}/{public_token}"
    else:
        sub_link = xui_client.build_subscription_url(sub_id)

    happ_link = f"happ://{sub_link.replace('https://', '').replace('http://', '')}"
    v2raytun_link = f"v2raytun://{sub_link.replace('https://', '').replace('http://', '')}"
    tg_bot_link = f"https://t.me/{settings.BOT_USERNAME}?start=web_{public_token}" if settings.BOT_USERNAME else ""

    # Генерация QR кода
    qr = qrcode.QRCode(version=1, box_size=8, border=2)
    qr.add_data(sub_link)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf)
    qr_base64 = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")

    return _json({
        "public_token": public_token,
        "sub_link": sub_link,
        "happ_link": happ_link,
        "v2raytun_link": v2raytun_link,
        "tg_link": tg_bot_link,
        "qr_code": qr_base64,
        "period_end": period_end.isoformat(),
        "duration_days": settings.TRIAL_DURATION_DAYS,
    })


@api_routes.post("/api/v1/web/recover")
async def post_web_recover(request: web.Request) -> web.Response:
    """Восстановление ссылок подписки по токену, ссылке, юзернейму или ID."""
    try:
        body = await request.json()
    except Exception:
        return _error("Invalid JSON")

    raw_token = str(body.get("token", "")).strip()
    if not raw_token:
        return _error("Укажите токен, ссылку или имя пользователя")

    async with get_session() as session:
        sub = await _find_subscription(session, raw_token)

    if sub is None:
        return _error("Профиль с таким токеном, ссылкой или именем не найден", 404)

    sub_id = next(iter((sub.xui_sub_ids or {}).values()), None)
    if settings.unified_subscription_enabled:
        sub_link = f"{settings.PUBLIC_SUB_BASE_URL.rstrip('/')}/{sub.public_token}"
    elif sub_id:
        sub_link = xui_client.build_subscription_url(sub_id)
    else:
        return _error("Конфигурация подписки недоступна", 404)

    happ_link = f"happ://{sub_link.replace('https://', '').replace('http://', '')}"
    v2raytun_link = f"v2raytun://{sub_link.replace('https://', '').replace('http://', '')}"
    tg_bot_link = f"https://t.me/{settings.BOT_USERNAME}?start=web_{sub.public_token}" if settings.BOT_USERNAME else ""

    qr = qrcode.QRCode(version=1, box_size=8, border=2)
    qr.add_data(sub_link)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf)
    qr_base64 = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")

    return _json({
        "public_token": sub.public_token,
        "sub_link": sub_link,
        "happ_link": happ_link,
        "v2raytun_link": v2raytun_link,
        "tg_link": tg_bot_link,
        "qr_code": qr_base64,
        "period_end": sub.period_end.isoformat(),
        "is_active": sub.is_active(),
    })




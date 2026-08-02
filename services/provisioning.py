from __future__ import annotations

import datetime as dt
import logging
import secrets

from aiogram import Bot
from sqlalchemy import select

from bot import texts
from config import settings
from db.database import get_session
from db.models import PaymentRecord, PendingPayment, Referral, Subscription, User
from panel import xui_client
from plans import Plan, get_plan
from services.promo_system import get_active_discount_for_user, grant_referral_bonus

log = logging.getLogger(__name__)


def utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


async def _finalize_purchase(
    *,
    tg_id: int,
    plan: Plan,
    external_id: str,
    provider: str,
    amount_rub: int,
    bot: Bot,
) -> None:
    """
    Общая часть для любого подтверждённого платежа (ручное подтверждение
    админом или активация пробного периода): создаёт/продлевает одного
    клиента в 3x-ui, пишет подписку и запись о платеже в БД, отправляет
    пользователю нативную ссылку-подписку панели. Идемпотентна по
    external_id — повторный вызов с тем же значением ничего не задвоит.
    """
    async with get_session() as session:
        already = await session.scalar(select(PaymentRecord).where(PaymentRecord.external_id == external_id))
        if already:
            log.info("Платёж %s уже обработан, пропускаем", external_id)
            return

        if await session.get(User, tg_id) is None:
            session.add(User(tg_id=tg_id))

        sub = await session.scalar(select(Subscription).where(Subscription.user_tg_id == tg_id))

        if sub is None:
            period_end = utcnow() + dt.timedelta(days=plan.duration_days)
            client_uuid, inbound_id, sub_id = await xui_client.provision_client(
                tg_id=tg_id,
                period_end=period_end,
                total_gb=plan.total_gb,
                limit_ip=plan.limit_ip,
                flow=plan.flow,
            )
            sub = Subscription(
                user_tg_id=tg_id,
                plan_id=plan.id,
                xui_uuid=client_uuid,
                xui_sub_ids={str(inbound_id): sub_id},
                public_token=secrets.token_urlsafe(24),
                period_end=period_end,
            )
            session.add(sub)
            is_renewal = False
        else:
            base = max(sub.period_end, utcnow())
            new_period_end = base + dt.timedelta(days=plan.duration_days)
            existing_sub_id = next(iter((sub.xui_sub_ids or {}).values()), None)
            inbound_id, sub_id = await xui_client.renew_client(
                tg_id=tg_id,
                client_uuid=sub.xui_uuid,
                existing_sub_id=existing_sub_id,
                new_period_end=new_period_end,
                total_gb=plan.total_gb,
                limit_ip=plan.limit_ip,
                flow=plan.flow,
            )
            sub.period_end = new_period_end
            sub.plan_id = plan.id
            sub.disabled = False
            sub.reminder_sent = False
            sub.xui_sub_ids = {str(inbound_id): sub_id}
            is_renewal = True

        session.add(
            PaymentRecord(
                external_id=external_id,
                provider=provider,
                user_tg_id=tg_id,
                plan_id=plan.id,
                amount_rub=amount_rub,
            )
        )

        await session.commit()

        public_token = sub.public_token
        sub_id = next(iter(sub.xui_sub_ids.values()), None)

    if external_id.startswith("manual:") or external_id.startswith("trial:") or external_id.startswith("stars:"):
        async with get_session() as session:
            ref_entry = await session.scalar(
                select(Referral).where(Referral.referred_tg_id == tg_id, Referral.reward_granted.is_(False))
            )
        if ref_entry:
            inviter_tg_id = ref_entry.inviter_tg_id
            if inviter_tg_id != tg_id:
                await grant_referral_bonus(inviter_tg_id, tg_id)
                try:
                    await bot.send_message(
                        inviter_tg_id,
                        f"🎉 По вашей реферальной ссылке оформил подписку пользователь {tg_id}. "
                        "К вашей подписке добавлено 5 дней бонуса."
                    )
                except Exception:
                    log.exception("Не удалось уведомить реферала %s о покупке %s", inviter_tg_id, tg_id)

    if settings.unified_subscription_enabled:
        unified_url = f"{settings.PUBLIC_SUB_BASE_URL.rstrip('/')}/{public_token}"
        links = [("", unified_url)]
    elif sub_id:
        links = [("", xui_client.build_subscription_url(sub_id))]
    else:
        links = []

    await bot.send_message(tg_id, texts.subscription_ready_message(plan, links, is_renewal))


async def handle_manual_payment_confirmed(pending: PendingPayment, bot: Bot) -> None:
    """Вызывается после того, как админ нажал "Подтвердить" по заявке на ручную оплату."""
    plan = get_plan(pending.plan_id)
    if plan is None:
        log.error("Заявка %s ссылается на неизвестный тариф %s", pending.id, pending.plan_id)
        return

    await _finalize_purchase(
        tg_id=pending.user_tg_id,
        plan=plan,
        external_id=f"manual:{pending.order_code}",
        provider="manual",
        amount_rub=plan.price_rub,
        bot=bot,
    )


async def handle_trial_activation(tg_id: int, plan: Plan, bot: Bot) -> None:
    """Активация бесплатного пробного периода (без похода к способам оплаты)."""
    await _finalize_purchase(
        tg_id=tg_id,
        plan=plan,
        external_id=f"trial:{tg_id}",
        provider="trial",
        amount_rub=0,
        bot=bot,
    )


async def assign_inbound_to_subscription(tg_id: int, inbound_id: int) -> Subscription | None:
    """Добавляет новый инбаунд в подписку пользователя, если он ещё не привязан."""
    async with get_session() as session:
        sub = await session.scalar(select(Subscription).where(Subscription.user_tg_id == tg_id))
        if sub is None:
            return None
        if str(inbound_id) in (sub.xui_sub_ids or {}):
            return sub

        plan = get_plan(sub.plan_id)
        if plan is None:
            return None

        client_uuid = sub.xui_uuid or f"tg{tg_id}"
        _, assigned_inbound_id, sub_id = await xui_client.attach_client_to_inbound(
            tg_id=tg_id,
            client_uuid=client_uuid,
            existing_sub_id=next(iter((sub.xui_sub_ids or {}).values()), None),
            period_end=sub.period_end,
            total_gb=plan.total_gb,
            limit_ip=plan.limit_ip,
            flow=plan.flow,
            inbound_id=inbound_id,
            email=xui_client.client_email(tg_id),
        )
        sub.xui_sub_ids = {**(sub.xui_sub_ids or {}), str(assigned_inbound_id): sub_id}
        await session.commit()
        await session.refresh(sub)
        return sub


async def admin_extend_subscription(tg_id: int, days: int) -> Subscription | None:
    """
    Продлевает подписку пользователя на N дней (или создаёт новую, если подписки нет).
    Отсчёт продления всегда идёт от актуальной даты (или от текущего момента, если подписка истекла).
    """
    from plans import PLANS, get_plan
    async with get_session() as session:
        sub = await session.scalar(select(Subscription).where(Subscription.user_tg_id == tg_id))
        
        base_time = max(sub.period_end, utcnow()) if (sub and sub.period_end) else utcnow()
        new_period_end = base_time + dt.timedelta(days=days)

        plan_id = sub.plan_id if sub else "m1"
        plan = get_plan(plan_id) or next(iter(PLANS.values()))

        if sub is None:
            sub = Subscription(
                user_tg_id=tg_id,
                plan_id=plan.id,
                period_end=new_period_end,
                public_token=uuid.uuid4().hex,
            )
            session.add(sub)
        else:
            sub.period_end = new_period_end

        existing_sub_id = next(iter((sub.xui_sub_ids or {}).values()), None)
        inbound_id, sub_id = await xui_client.renew_client(
            tg_id=tg_id,
            client_uuid=sub.xui_uuid or f"tg{tg_id}",
            existing_sub_id=existing_sub_id,
            new_period_end=new_period_end,
            total_gb=plan.total_gb,
            limit_ip=plan.limit_ip,
            flow=plan.flow,
        )
        sub.period_end = new_period_end
        sub.xui_sub_ids = {str(inbound_id): sub_id}
        sub.disabled = False
        sub.reminder_sent = False
        await session.commit()
        await session.refresh(sub)
        return sub


async def admin_toggle_subscription(tg_id: int) -> bool | None:
    """
    Переключает флаг disabled у подписки и включает/отключает клиента во
    всех его инбаундах в панели. Возвращает НОВОЕ состояние disabled, или
    None, если у пользователя нет подписки.
    """
    async with get_session() as session:
        sub = await session.scalar(select(Subscription).where(Subscription.user_tg_id == tg_id))
        if sub is None:
            return None
        sub.disabled = not sub.disabled
        new_disabled = sub.disabled
        await session.commit()

    await xui_client.set_client_enabled(tg_id, enabled=not new_disabled)
    return new_disabled


async def admin_delete_subscription(tg_id: int) -> bool:
    """Удаляет подписку пользователя из базы данных и полностью удаляет клиента из 3X-UI панели."""
    async with get_session() as session:
        sub = await session.scalar(select(Subscription).where(Subscription.user_tg_id == tg_id))
        if sub is None:
            return False
        client_uuid = sub.xui_uuid
        sub_ids = sub.xui_sub_ids or {}
        await session.delete(sub)
        await session.commit()

    try:
        await xui_client.delete_client(tg_id, client_uuid=client_uuid, sub_ids=sub_ids)
    except Exception:
        log.exception("Failed to delete 3x-ui client for deleted sub %s", tg_id)

    return True


async def admin_grant_trial(tg_id: int, bot: Bot | None = None) -> Subscription:
    """Принудительно активирует/выдаёт пробный период пользователю администратором."""
    from plans import TRIAL_PLAN
    async with get_session() as session:
        user = await session.get(User, tg_id)
        if user is None:
            user = User(tg_id=tg_id)
            session.add(user)
        user.trial_used = True
        await session.commit()

    return await _finalize_purchase(
        tg_id=tg_id,
        plan=TRIAL_PLAN,
        external_id=f"admin_trial:{tg_id}",
        provider="admin_trial",
        amount_rub=0,
        bot=bot,
    )

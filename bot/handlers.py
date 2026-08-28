from __future__ import annotations

import logging

from aiogram import F, Router
from aiogram.filters import Command, CommandObject
from aiogram.types import CallbackQuery, Message, ReplyKeyboardRemove
from sqlalchemy import select

from bot import keyboards, texts
from config import settings
from db.database import get_session
from db.models import PendingPayment, Subscription, User
from panel import xui_client
from services.promo_system import apply_code, ensure_referral_code, get_promo_stats
from services.provisioning import (
    admin_extend_subscription,
    admin_toggle_subscription,
    assign_inbound_to_subscription,
    handle_manual_payment_confirmed,
    utcnow,
)

log = logging.getLogger(__name__)
router = Router()


async def _send_miniapp_prompt(message: Message, custom_text: str | None = None) -> None:
    text = custom_text or texts.OPEN_APP_PROMPT
    await message.answer(
        text,
        reply_markup=keyboards.open_app_keyboard(),
    )


@router.message(Command("start"))
async def cmd_start(message: Message, command: CommandObject | None = None) -> None:
    web_linked_text = None
    if command and command.args:
        args_str = command.args.strip()
        if args_str.startswith("web_"):
            token_part = args_str[4:]
            try:
                async with get_session() as session:
                    from db.models import WebTrialSession
                    sub = await session.scalar(select(Subscription).where(Subscription.public_token == token_part))
                    web_session = await session.scalar(select(WebTrialSession).where(WebTrialSession.public_token == token_part))
                    if sub:
                        user_id = message.from_user.id
                        db_user = await session.get(User, user_id)
                        if db_user is None:
                            db_user = User(tg_id=user_id, username=message.from_user.username)
                            session.add(db_user)

                        # If sub is assigned to synthetic ID or someone else and not claimed yet
                        existing_sub = await session.scalar(select(Subscription).where(Subscription.user_tg_id == user_id))
                        if existing_sub and existing_sub.id != sub.id:
                            # User already has another active sub in telegram
                            web_linked_text = "ℹ️ Ваш Telegram-аккаунт уже зарегистрирован в системе. Ваша существующая подписка активна!"
                        else:
                            sub.user_tg_id = user_id
                            db_user.trial_used = True
                            if web_session:
                                web_session.claimed_by_tg_id = user_id
                            await session.commit()
                            web_linked_text = "🎉 **Ваш пробный VPN с сайта успешно привязан к вашему аккаунту Telegram!**\nТеперь вы можете управлять подпиской и продлевать ее в нашем боте."
            except Exception:
                log.exception("Ошибка при привязке токена подписки с сайта")
        elif args_str:
            try:
                await apply_code(message.from_user.id, args_str)
            except Exception:
                log.exception("Ошибка при применении реферального кода")

    await message.answer(
        web_linked_text or texts.WELCOME,
        reply_markup=ReplyKeyboardRemove(),
    )
    await message.answer(
        "👇 Открыть личный кабинет и каталог:",
        reply_markup=keyboards.open_app_keyboard(),
    )



@router.message(Command("help"))
async def help_command(message: Message) -> None:
    await message.answer(texts.HELP_TEXT, reply_markup=keyboards.open_app_keyboard())


@router.message(Command("plans"))
@router.message(Command("subscription"))
@router.message(Command("promo"))
@router.message(Command("ref"))
async def miniapp_redirect_commands(message: Message) -> None:
    await _send_miniapp_prompt(message)


# Callback query for admin confirmation/rejection
async def _resolve_payment(call: CallbackQuery, new_status: str) -> None:
    if call.from_user.id not in settings.admin_ids:
        await call.answer("Только для администратора", show_alert=True)
        return

    pending_id = int(call.data.split(":", 1)[1])

    async with get_session() as session:
        pending = await session.get(PendingPayment, pending_id)
        if pending is None:
            await call.answer("Заявка не найдена", show_alert=True)
            return
        if pending.status != "pending":
            await call.answer(texts.payment_already_resolved(pending.status), show_alert=True)
            return

        if new_status == "rejected":
            pending.status = "rejected"
            pending.resolved_at = utcnow()
            pending.resolved_by = call.from_user.id
            await session.commit()
            tg_id = pending.user_tg_id
        else:
            pending.status = "processing"
            await session.commit()

    if new_status == "rejected":
        await call.answer("Готово")
        try:
            await call.message.edit_text(
                call.message.text + texts.admin_resolved_suffix("rejected", call.from_user.username)
            )
        except Exception:
            pass
        try:
            await call.bot.send_message(tg_id, texts.payment_rejected_message())
        except Exception:
            log.exception("Не удалось уведомить пользователя %s об отклонении оплаты", tg_id)
        return

    await call.answer("Выдаю ключ...")
    try:
        async with get_session() as session:
            pending = await session.get(PendingPayment, pending_id)
        await handle_manual_payment_confirmed(pending, call.bot)
    except Exception:
        log.exception("Не удалось выдать ключ по заявке %s", pending_id)
        async with get_session() as session:
            pending = await session.get(PendingPayment, pending_id)
            pending.status = "pending"
            await session.commit()
        try:
            await call.message.answer(
                f"⚠️ Ошибка при выдаче ключа по заявке (код {pending.order_code}) — "
                "заявка снова доступна, попробуйте подтвердить ещё раз."
            )
        except Exception:
            pass
        return

    async with get_session() as session:
        pending = await session.get(PendingPayment, pending_id)
        pending.status = "confirmed"
        pending.resolved_at = utcnow()
        pending.resolved_by = call.from_user.id
        await session.commit()

    try:
        await call.message.edit_text(
            call.message.text + texts.admin_resolved_suffix("confirmed", call.from_user.username)
        )
    except Exception:
        pass


@router.callback_query(F.data.startswith("admin_confirm:"))
async def admin_confirm(call: CallbackQuery) -> None:
    await _resolve_payment(call, "confirmed")


@router.callback_query(F.data.startswith("admin_reject:"))
async def admin_reject(call: CallbackQuery) -> None:
    await _resolve_payment(call, "rejected")


async def _send_admin_card(target: Message, tg_id: int) -> None:
    async with get_session() as session:
        sub = await session.scalar(select(Subscription).where(Subscription.user_tg_id == tg_id))
        user = await session.get(User, tg_id)

        if sub is None:
            await target.answer(texts.admin_user_not_found())
            return

        plan = sub.plan_id
        active = sub.is_active()
        disabled = sub.disabled
        period_end = sub.period_end
        username = user.username if user else None

    try:
        upload, download = await xui_client.get_client_traffic(tg_id)
    except Exception:
        upload, download = 0, 0
    referral_code = await ensure_referral_code(tg_id)
    promo_stats = await get_promo_stats()
    stats_text = f"кодов: {promo_stats['codes']}, рефералов: {promo_stats['referrals']}"

    from plans import get_plan
    p = get_plan(plan)

    await target.answer(
        texts.admin_user_card(
            tg_id, username, p, period_end, active, disabled, upload, download, p.total_gb if p else 0, referral_code, stats_text
        ),
        reply_markup=keyboards.admin_user_keyboard(tg_id, disabled),
    )


@router.message(Command("admin"))
async def admin_find_user(message: Message) -> None:
    if message.from_user.id not in settings.admin_ids:
        return

    parts = (message.text or "").split(maxsplit=1)
    if len(parts) < 2 or not parts[1].strip().lstrip("-").isdigit():
        await message.answer("Использование: /admin <tg_id пользователя>", parse_mode=None)
        return

    tg_id = int(parts[1].strip())
    await _send_admin_card(message, tg_id)


@router.message(Command("admin_stats"))
async def admin_stats(message: Message) -> None:
    if message.from_user.id not in settings.admin_ids:
        return

    stats = await get_promo_stats()
    await message.answer(
        "📊 Статистика по промо и рефералам\n\n"
        f"• активных промокодов: {stats['codes']}\n"
        f"• рефералов: {stats['referrals']}\n"
        f"• использований: {stats['usages']}"
    )


@router.callback_query(F.data.startswith("admin_extend:"))
async def admin_extend(call: CallbackQuery) -> None:
    if call.from_user.id not in settings.admin_ids:
        await call.answer("Только для администратора", show_alert=True)
        return

    _, tg_id_str, days_str = call.data.split(":", 2)
    tg_id, days = int(tg_id_str), int(days_str)

    try:
        sub = await admin_extend_subscription(tg_id, days)
    except Exception:
        log.exception("Не удалось продлить подписку админом для %s", tg_id)
        await call.answer("Ошибка при обращении к панели", show_alert=True)
        return

    if sub is None:
        await call.answer(texts.admin_user_not_found(), show_alert=True)
        return

    await call.answer(texts.admin_extended(days))
    await _send_admin_card(call.message, tg_id)


@router.callback_query(F.data.startswith("admin_toggle:"))
async def admin_toggle(call: CallbackQuery) -> None:
    if call.from_user.id not in settings.admin_ids:
        await call.answer("Только для администратора", show_alert=True)
        return

    tg_id = int(call.data.split(":", 1)[1])

    try:
        new_disabled = await admin_toggle_subscription(tg_id)
    except Exception:
        log.exception("Не удалось переключить статус клиента для %s", tg_id)
        await call.answer("Ошибка при обращении к панели", show_alert=True)
        return

    if new_disabled is None:
        await call.answer(texts.admin_user_not_found(), show_alert=True)
        return

    await call.answer(texts.admin_toggled(enabled=not new_disabled))
    await _send_admin_card(call.message, tg_id)


@router.callback_query(F.data.startswith("admin_add_inbound:"))
async def admin_add_inbound(call: CallbackQuery) -> None:
    if call.from_user.id not in settings.admin_ids:
        await call.answer("Только для администратора", show_alert=True)
        return

    tg_id = int(call.data.split(":", 1)[1])
    try:
        inbounds = await xui_client.get_all_inbounds()
    except Exception:
        log.exception("Не удалось получить список инбаундов для %s", tg_id)
        await call.answer("Ошибка при чтении панели", show_alert=True)
        return

    if not inbounds:
        await call.answer("В панели нет доступных инбаундов", show_alert=True)
        return

    await call.answer()
    await call.message.answer(
        "Выберите инбаунд, который нужно добавить в подписку пользователя:",
        reply_markup=keyboards.admin_inbound_keyboard(tg_id, inbounds),
    )


@router.callback_query(F.data.startswith("admin_assign_inbound:"))
async def admin_assign_inbound(call: CallbackQuery) -> None:
    if call.from_user.id not in settings.admin_ids:
        await call.answer("Только для администратора", show_alert=True)
        return

    _, tg_id_str, inbound_id_str = call.data.split(":", 2)
    tg_id = int(tg_id_str)
    inbound_id = int(inbound_id_str)

    try:
        sub = await assign_inbound_to_subscription(tg_id, inbound_id)
    except Exception:
        log.exception("Не удалось добавить инбаунд %s пользователю %s", inbound_id, tg_id)
        await call.answer("Ошибка при работе с панелью", show_alert=True)
        return

    if sub is None:
        await call.answer(texts.admin_user_not_found(), show_alert=True)
        return

    await call.answer("Инбаунд добавлен в подписку")
    await _send_admin_card(call.message, tg_id)


@router.callback_query(F.data.startswith("admin_resync:"))
async def admin_resync(call: CallbackQuery) -> None:
    if call.from_user.id not in settings.admin_ids:
        await call.answer("Только для администратора", show_alert=True)
        return

    tg_id = int(call.data.split(":", 1)[1])

    try:
        sub = await admin_extend_subscription(tg_id, days=0)
    except Exception:
        log.exception("Не удалось пересинхронизировать инбаунды для %s", tg_id)
        await call.answer("Ошибка при обращении к панели", show_alert=True)
        return

    if sub is None:
        await call.answer(texts.admin_user_not_found(), show_alert=True)
        return

    await call.answer(texts.admin_resync_done())
    await _send_admin_card(call.message, tg_id)


@router.message(F.text, ~F.text.startswith("/"))
async def handle_any_text_message(message: Message) -> None:
    await _send_miniapp_prompt(message)

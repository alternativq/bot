from __future__ import annotations

import logging
import random
import string

from aiogram import F, Router
from aiogram.filters import Command, CommandObject
from aiogram.types import CallbackQuery, LabeledPrice, Message, PreCheckoutQuery
from sqlalchemy import select

from bot import keyboards, texts
from config import settings
from db.database import get_session
from db.models import PendingPayment, Subscription, User
from panel import xui_client
from payment_methods import get_payment_method, get_payment_methods
from plans import get_plan
from services.promo_system import (
    apply_code,
    calculate_discounted_amount,
    ensure_referral_code,
    get_active_discount_for_user,
    get_promo_stats,
)
from services.provisioning import (
    admin_extend_subscription,
    admin_toggle_subscription,
    assign_inbound_to_subscription,
    handle_manual_payment_confirmed,
    handle_trial_activation,
    utcnow,
)

log = logging.getLogger(__name__)
router = Router()


def _generate_order_code() -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


async def _get_or_create_user(tg_id: int, username: str | None) -> User:
    async with get_session() as session:
        user = await session.get(User, tg_id)
        if user is None:
            user = User(tg_id=tg_id, username=username)
            session.add(user)
            await session.commit()
        return user


async def _trial_available(tg_id: int, username: str | None) -> bool:
    if not settings.TRIAL_ENABLED:
        return False
    user = await _get_or_create_user(tg_id, username)
    return not user.trial_used


@router.message(Command("start"))
async def cmd_start(message: Message, command: CommandObject | None = None) -> None:
    if command and command.args:
        ref_code = command.args.strip()
        if ref_code:
            await apply_code(message.from_user.id, ref_code)
    await message.answer(texts.WELCOME, reply_markup=keyboards.main_menu_keyboard())
    trial_available = await _trial_available(message.from_user.id, message.from_user.username)
    await message.answer(texts.CHOOSE_PLAN, reply_markup=keyboards.plans_keyboard(trial_available))


@router.message(Command("help"))
@router.message(F.text == keyboards.BTN_HELP)
async def help_command(message: Message) -> None:
    await message.answer(texts.HELP_TEXT, reply_markup=keyboards.main_menu_keyboard())


@router.message(Command("promo"))
@router.message(F.text == keyboards.BTN_PROMO)
async def promo_command(message: Message) -> None:
    await message.answer(texts.PROMO_HELP)


@router.message(Command("ref"))
@router.message(F.text == keyboards.BTN_REF)
async def referral_command(message: Message) -> None:
    code = await ensure_referral_code(message.from_user.id)
    bot_info = await message.bot.get_me()
    ref_link = f"https://t.me/{bot_info.username}?start={code}" if bot_info and bot_info.username else f"ref:{code}"
    await message.answer(
        "🎁 <b>Ваша реферальная система</b>\n\n"
        f"Код: <code>{code}</code>\n"
        f"Ссылка: <code>{ref_link}</code>\n\n"
        "<i>Нажмите на код или ссылку выше, чтобы мгновенно скопировать её!</i>\n"
        "Отправьте её другу — при его первой покупке вы получите +5 дней бонусом к вашей подписке!"
    )


@router.message(Command("plans"))
@router.message(F.text == keyboards.BTN_PLANS)
@router.callback_query(F.data == "show_plans")
async def show_plans(event: Message | CallbackQuery) -> None:
    user = event.from_user
    trial_available = await _trial_available(user.id, user.username)
    keyboard = keyboards.plans_keyboard(trial_available)
    if isinstance(event, CallbackQuery):
        await event.message.answer(texts.CHOOSE_PLAN, reply_markup=keyboard)
        await event.answer()
    else:
        await event.answer(texts.CHOOSE_PLAN, reply_markup=keyboard)


@router.callback_query(F.data.startswith("duration:"))
async def choose_duration(call: CallbackQuery) -> None:
    duration_id = call.data.split(":", 1)[1]
    await call.answer()
    await call.message.answer(texts.CHOOSE_DEVICE_COUNT, reply_markup=keyboards.device_keyboard(duration_id))


@router.callback_query(F.data.startswith("plan:"))
async def choose_plan(call: CallbackQuery) -> None:
    plan_id = call.data.split(":", 1)[1]
    plan = get_plan(plan_id)
    if plan is None:
        await call.answer("Тариф недоступен", show_alert=True)
        return

    await call.answer()

    if plan.is_trial:
        async with get_session() as session:
            user = await session.get(User, call.from_user.id)
            if user is None:
                user = User(tg_id=call.from_user.id, username=call.from_user.username)
                session.add(user)
                await session.commit()
            if user.trial_used:
                await call.message.answer(texts.TRIAL_ALREADY_USED)
                return

        try:
            await handle_trial_activation(call.from_user.id, plan, call.bot)
        except Exception:
            log.exception("Не удалось активировать пробный период для %s", call.from_user.id)
            await call.message.answer(
                "Не получилось активировать пробный период (ошибка на стороне сервера). "
                "Попробуйте ещё раз чуть позже или напишите администратору."
            )
            return

        # помечаем триал использованным ТОЛЬКО после реального успеха -
        # иначе при сбое пользователь теряет свою единственную попытку впустую
        async with get_session() as session:
            user = await session.get(User, call.from_user.id)
            user.trial_used = True
            await session.commit()
        return

    methods = get_payment_methods()
    if not methods:
        await call.message.answer(texts.NO_PAYMENT_METHODS)
        return

    keyboard = keyboards.payment_methods_keyboard(plan_id, methods)
    await call.message.answer(texts.CHOOSE_PAYMENT_METHOD, reply_markup=keyboard)


@router.callback_query(F.data.startswith("pay:"))
async def choose_payment_method(call: CallbackQuery) -> None:
    _, plan_id, method_id = call.data.split(":", 2)
    plan = get_plan(plan_id)
    if plan is None:
        await call.answer("Тариф недоступен", show_alert=True)
        return

    method = get_payment_method(method_id)
    if method is None:
        await call.answer("Способ оплаты недоступен", show_alert=True)
        return

    _, discount_percent = await get_active_discount_for_user(call.from_user.id)
    final_amount = calculate_discounted_amount(plan.price_rub, discount_percent)
    order_code = _generate_order_code()
    async with get_session() as session:
        if await session.get(User, call.from_user.id) is None:
            session.add(User(tg_id=call.from_user.id, username=call.from_user.username))
        while await session.scalar(select(PendingPayment).where(PendingPayment.order_code == order_code)):
            order_code = _generate_order_code()

        pending = PendingPayment(
            user_tg_id=call.from_user.id,
            plan_id=plan.id,
            method_id=method.id,
            order_code=order_code,
            discount_percent=discount_percent,
        )
        session.add(pending)
        await session.commit()
        pending_id = pending.id

    if method_id == "yoomoney_auto":
        import urllib.parse
        from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup
        params = {
            "receiver": settings.YOOMONEY_WALLET,
            "quickpay-form": "shop",
            "targets": f"VPN {plan.title}",
            "sum": str(final_amount),
            "label": order_code,
        }
        quickpay_url = f"https://yoomoney.ru/quickpay/confirm.xml?{urllib.parse.urlencode(params)}"
        kb = InlineKeyboardMarkup(
            inline_keyboard=[
                [InlineKeyboardButton(text="💳 Перейти к оплате", url=quickpay_url)],
                [InlineKeyboardButton(text="Я оплатил", callback_data=f"paid:{pending_id}")],
            ]
        )
        await call.message.answer(
            f"Тариф «{plan.title}» — {final_amount} ₽\n\n"
            "Нажмите «Перейти к оплате», чтобы оплатить картой любого банка РФ или кошельком ЮMoney.\n"
            "После успешного перевода подписка активируется автоматически!",
            reply_markup=kb,
        )
        return

    if method_id == "cryptobot":
        from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup
        import aiohttp
        amount_usdt = plan.price_usdt
        invoice_url = None
        try:
            headers = {"Crypto-Pay-API-Token": settings.CRYPTO_PAY_TOKEN}
            payload_data = {
                "asset": "USDT",
                "amount": str(amount_usdt),
                "description": f"VPN {plan.title}",
                "payload": f"crypto:{plan.id}:{call.from_user.id}",
            }
            async with aiohttp.ClientSession() as session_http:
                async with session_http.post("https://pay.crypt.bot/api/createInvoice", json=payload_data, headers=headers) as resp:
                    res = await resp.json()
                    if res.get("ok"):
                        invoice_url = res["result"].get("bot_invoice_url") or res["result"].get("pay_url")
        except Exception:
            log.exception("Не удалось создать чек в CryptoBot")

        if not invoice_url:
            await call.message.answer("Не удалось сгенерировать чек CryptoBot. Попробуйте позже или выберите другой способ.")
            return

        kb = InlineKeyboardMarkup(
            inline_keyboard=[[InlineKeyboardButton(text="💎 Оплатить в @CryptoBot", url=invoice_url)]]
        )
        await call.message.answer(
            f"Тариф «{plan.title}» — ${amount_usdt} USDT\n\n"
            "Нажмите кнопку ниже для моментальной оплаты без минимальных пакетов через @CryptoBot.\n"
            "Ключ выдаётся автоматически сразу после оплаты!",
            reply_markup=kb,
        )
        return

    await call.message.answer(
        texts.manual_payment_instructions(plan, method, order_code, amount_rub=final_amount, discount_percent=discount_percent),
        reply_markup=keyboards.manual_paid_keyboard(pending_id),
    )


@router.callback_query(F.data.startswith("paid:"))
async def mark_as_paid(call: CallbackQuery) -> None:
    pending_id = int(call.data.split(":", 1)[1])

    async with get_session() as session:
        pending = await session.get(PendingPayment, pending_id)
        if pending is None or pending.user_tg_id != call.from_user.id:
            await call.answer("Заявка не найдена", show_alert=True)
            return
        if pending.status != "pending":
            await call.answer(texts.payment_already_resolved(pending.status), show_alert=True)
            return

        plan = get_plan(pending.plan_id)
        method = get_payment_method(pending.method_id)

    await call.answer()
    await call.message.answer(texts.payment_request_sent_to_admin())

    if plan is None or method is None:
        log.error("Заявка %s ссылается на неизвестный тариф/способ", pending_id)
        return

    notification = texts.admin_payment_notification(
        call.from_user.username, call.from_user.id, plan, method, pending.order_code
    )
    for admin_id in settings.admin_ids:
        try:
            await call.bot.send_message(
                admin_id, notification, reply_markup=keyboards.admin_confirm_keyboard(pending_id)
            )
        except Exception:
            log.exception("Не удалось уведомить админа %s о заявке %s", admin_id, pending_id)


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
            # промежуточный статус - чтобы повторный/двойной клик не запустил
            # выдачу ключа дважды, пока идёт обращение к 3x-ui
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
            pending.status = "pending"  # откатываем - можно нажать "Подтвердить" ещё раз
            await session.commit()
        try:
            await call.message.answer(
                f"⚠️ Ошибка при выдаче ключа по заявке (код {pending.order_code}) — "
                "заявка снова доступна, попробуйте подтвердить ещё раз. Если не поможет — "
                "проверьте, доступна ли 3x-ui панель и логи бота."
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


@router.message(Command("subscription"))
@router.message(F.text == keyboards.BTN_SUBSCRIPTION)
async def my_subscription(message: Message) -> None:
    async with get_session() as session:
        sub = await session.scalar(select(Subscription).where(Subscription.user_tg_id == message.from_user.id))

        if sub is None:
            await message.answer(texts.my_subscription_message(None, None, False, None))
            return

        plan = get_plan(sub.plan_id)
        active = sub.is_active()
        period_end = sub.period_end
        sub_id = next(iter((sub.xui_sub_ids or {}).values()), None)
        public_token = sub.public_token

    if settings.unified_subscription_enabled:
        unified_url = f"{settings.PUBLIC_SUB_BASE_URL.rstrip('/')}/{public_token}"
        links = [("", unified_url)]
    elif sub_id:
        links = [("", xui_client.build_subscription_url(sub_id))]
    else:
        links = []

    referral_code = await ensure_referral_code(message.from_user.id)
    _, discount_percent = await get_active_discount_for_user(message.from_user.id)
    bonus_days = 5 if active else None
    await message.answer(
        texts.my_subscription_message(plan, period_end, active, links, discount_percent, referral_code, bonus_days),
        reply_markup=keyboards.my_subscription_keyboard(),
    )


@router.callback_query(F.data == "promo_input")
async def promo_input(call: CallbackQuery) -> None:
    await call.answer()
    await call.message.answer("Отправьте промокод или реферальный код для применения скидки.")


async def _send_admin_card(target: Message, tg_id: int) -> None:
    async with get_session() as session:
        sub = await session.scalar(select(Subscription).where(Subscription.user_tg_id == tg_id))
        user = await session.get(User, tg_id)

        if sub is None:
            await target.answer(texts.admin_user_not_found())
            return

        plan = get_plan(sub.plan_id)
        active = sub.is_active()
        disabled = sub.disabled
        period_end = sub.period_end
        username = user.username if user else None

    upload, download = await xui_client.get_client_traffic(tg_id)
    total_gb = plan.total_gb if plan else 0
    referral_code = await ensure_referral_code(tg_id)
    promo_stats = await get_promo_stats()
    stats_text = f"кодов: {promo_stats['codes']}, рефералов: {promo_stats['referrals']}, использований: {promo_stats['usages']}"

    await target.answer(
        texts.admin_user_card(
            tg_id, username, plan, period_end, active, disabled, upload, download, total_gb, referral_code, stats_text
        ),
        reply_markup=keyboards.admin_user_keyboard(tg_id, disabled),
    )


@router.message(Command("admin"))
async def admin_find_user(message: Message) -> None:
    if message.from_user.id not in settings.admin_ids:
        return  # молча игнорируем - не выдаём даже факт существования админки чужим

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
        await call.answer("Ошибка при обращении к панели, см. логи", show_alert=True)
        return

    if sub is None:
        await call.answer(texts.admin_user_not_found(), show_alert=True)
        return

    await call.answer(texts.admin_extended(days))
    await _send_admin_card(call.message, tg_id)

    try:
        await call.bot.send_message(tg_id, texts.autorenew_success_message_admin(days))
    except Exception:
        pass


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
        await call.answer("Ошибка при обращении к панели, см. логи", show_alert=True)
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
        await call.answer("Ошибка при обращении к панели, см. логи", show_alert=True)
        return

    if sub is None:
        await call.answer(texts.admin_user_not_found(), show_alert=True)
        return

    await call.answer(texts.admin_resync_done())
    await _send_admin_card(call.message, tg_id)


@router.message(F.text, ~F.text.startswith("/"))
async def handle_text_message(message: Message) -> None:
    text = message.text or ""
    normalized = text.lower()
    if normalized == keyboards.BTN_HELP.lower():
        await help_command(message)
        return
    if normalized == keyboards.BTN_PROMO.lower():
        await promo_command(message)
        return
    if normalized == keyboards.BTN_SUBSCRIPTION.lower():
        await my_subscription(message)
        return
    if normalized == keyboards.BTN_PLANS.lower():
        await show_plans(message)
        return
    if normalized == keyboards.BTN_REF.lower():
        await referral_command(message)
        return

    if len(text.strip()) < 3 or " " in text:
        return
    if not any(ch.isalnum() for ch in text):
        return
    ok, response_text = await apply_code(message.from_user.id, text)
    await message.answer(response_text)
    if ok:
        await my_subscription(message)

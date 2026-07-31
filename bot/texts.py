from __future__ import annotations

import datetime as dt

from config import settings
from plans import Plan

WELCOME = (
    "Привет! Это бот для покупки доступа к VPN.\n\n"
    "Выберите тариф ниже — после оплаты ключ и инструкция по подключению "
    "придут автоматически, в этот же чат."
)

HELP_TEXT = (
    "🆘 Помощь\n\n"
    "• Как подключиться: откройте раздел «Моя подписка» и используйте ссылку-подписку.\n"
    "• Если ссылка не работает — попробуйте обновить подписку в приложении и проверьте, что время на устройстве выставлено корректно.\n"
    "• Если нужна помощь с оплатой — напишите администратору."
)

PROMO_HELP = (
    "🎁 Промокоды и рефералы\n\n"
    "Отправьте промокод или реферальный код вашего друга.\n"
    "При покупке подписки по реферальному коду ваш друг получит +5 дней бонусом к своей подписке!\n"
    "Узнать свой реферальный код — нажмите /ref"
)

CHOOSE_PLAN = "Выберите срок подписки:"
CHOOSE_DEVICE_COUNT = "Теперь выберите количество устройств:"
CHOOSE_PAYMENT_METHOD = "Выберите удобный способ оплаты:"
NO_PAYMENT_METHODS = (
    "Способы оплаты пока не настроены. В этом случае оформить подписку "
    "можно будет позже, когда администратор добавит их."
)
TRIAL_ALREADY_USED = "Пробный доступ уже был активирован ранее — его можно использовать только один раз."


def plan_button_text(plan: Plan) -> str:
    if plan.is_trial:
        return f"{plan.title} — бесплатно"
    return f"{plan.title} — {plan.price_rub} ₽"


def duration_button_text(duration_id: str) -> str:
    if duration_id == "m1":
        return "✓ 1 месяц — от 199 ₽"
    if duration_id == "m3":
        return "✓ 3 месяца — от 499 ₽"
    if duration_id == "m12":
        return "✓ 12 месяцев — от 1 690 ₽"
    return duration_id


def device_button_text(plan: Plan) -> str:
    if plan.limit_ip <= 1:
        return f"• 1 устройство — {plan.price_rub} ₽"
    if plan.limit_ip == 3:
        return f"• 3 устройства — {plan.price_rub} ₽"
    if plan.limit_ip == 5:
        return f"• 5 устройств — {plan.price_rub} ₽"
    return f"• 7 устройств — {plan.price_rub} ₽"


def manual_payment_instructions(plan, method, order_code: str, amount_rub: int | None = None, discount_percent: int = 0) -> str:
    recipient_line = f"Получатель: {settings.PAYMENT_RECIPIENT_NAME}\n" if settings.PAYMENT_RECIPIENT_NAME else ""
    total_amount = amount_rub if amount_rub is not None else plan.price_rub
    discount_suffix = f" (скидка {discount_percent}%)" if discount_percent else ""
    return (
        f"Тариф «{plan.title}» — {total_amount} ₽{discount_suffix}\n\n"
        f"Переведите {total_amount} ₽ через {method.title}:\n"
        f"{method.requisite_label}: {method.requisite}\n"
        f"{recipient_line}"
        f"\nПосле перевода нажмите кнопку ниже — заявка отправится администратору, "
        "а после подтверждения оплаты мы сразу пришлём ключ и инструкцию."
    )


def payment_request_sent_to_admin() -> str:
    return "Заявка отправлена администратору. После подтверждения оплаты мы сразу пришлём ключ в этот чат."


def payment_already_resolved(status: str) -> str:
    if status == "confirmed":
        return "Эта заявка уже подтверждена."
    if status == "rejected":
        return "Эта заявка уже отклонена. Если это ошибка — напишите администратору."
    if status == "processing":
        return "Заявка сейчас обрабатывается, подождите немного."
    return "Эта заявка уже обработана."


def admin_payment_notification(username: str | None, tg_id: int, plan, method, order_code: str) -> str:
    who = f"@{username}" if username else f"id{tg_id}"
    return (
        "Новая заявка на оплату\n\n"
        f"Пользователь: {who}\n"
        f"Тариф: {plan.title} — {plan.price_rub} ₽\n"
        f"Способ: {method.title}\n"
        f"Код: {order_code}\n\n"
        "Проверьте поступление перевода и подтвердите заявку."
    )


def admin_resolved_suffix(status: str, admin_username: str | None) -> str:
    who = f"@{admin_username}" if admin_username else "админом"
    label = "✅ Подтверждено" if status == "confirmed" else "❌ Отклонено"
    return f"\n\n{label} ({who})"


def payment_rejected_message() -> str:
    return "Оплата не подтверждена администратором. Если это ошибка — напишите нам, и мы поможем."


def format_links(links: list[tuple[str, str]]) -> str:
    """Одна ссылка - просто ссылка; несколько - с подписью по каждому инбаунду."""
    if not links:
        return "(ссылка ещё не готова, напишите администратору)"
    if len(links) == 1:
        return links[0][1]
    return "\n".join(f"{label}:\n{url}" for label, url in links)


def subscription_ready_message(plan: Plan, links: list[tuple[str, str]], is_renewal: bool) -> str:
    if plan.is_trial:
        verb = "Пробный период активирован"
    elif is_renewal:
        verb = "Подписка продлена"
    else:
        verb = "Оплата прошла успешно"
    label = "Ваши персональные ссылки-подписки" if len(links) > 1 else "Ваша персональная ссылка-подписка"
    return (
        f"{verb}.\n\n"
        f"Тариф: {plan.title}\n\n"
        f"{label}:\n{format_links(links)}\n\n"
        + CONNECT_INSTRUCTIONS
    )


def trial_ending_message(period_end: dt.datetime) -> str:
    return (
        f"Пробный доступ заканчивается {period_end.strftime('%d.%m.%Y %H:%M')}.\n"
        "Чтобы не потерять доступ, оформите платную подписку через меню тарифов."
    )


def subscription_ending_message(plan_title: str, period_end: dt.datetime) -> str:
    return (
        f"Подписка «{plan_title}» истекает {period_end.strftime('%d.%m.%Y %H:%M')}.\n"
        "Чтобы не потерять доступ, продлите её через меню тарифов."
    )


def my_subscription_message(plan: Plan | None, period_end: dt.datetime | None, active: bool, links: list[tuple[str, str]] | None, discount_percent: int = 0, referral_code: str | None = None, bonus_days: int | None = None) -> str:
    if plan is None or period_end is None:
        return "У вас пока нет активной подписки. Выберите тариф в меню."
    status = "активна" if active else "истекла"
    status_icon = "✅" if active else "⚠️"
    label = "Ваши ссылки-подписки" if links and len(links) > 1 else "Ваша ссылка-подписка"
    link_line = f"\n\n{label}:\n{format_links(links)}" if links else ""
    promo_line = f"\n🎁 Реферальный код: {referral_code}" if referral_code else ""
    discount_line = f"\n💸 Активная скидка: {discount_percent}%" if discount_percent else ""
    bonus_line = f"\n⭐ Бонус: +{bonus_days} дней" if bonus_days is not None else ""
    rewards_block = ""
    if promo_line or discount_line or bonus_line:
        rewards_block = (
            "\n\n🎁 Бонусы/рефералы"
            f"{promo_line}{discount_line}{bonus_line}"
        )
    return (
        "━━━━━━━━━━━━\n"
        f"📌 Тариф: {plan.title}\n"
        f"{status_icon} Статус: {status}\n"
        f"🗓️ Действует до: {period_end.strftime('%d.%m.%Y %H:%M')}"
        f"{rewards_block}{link_line}\n"
        "━━━━━━━━━━━━"
    )


def _fmt_gb(num_bytes: int) -> str:
    return f"{num_bytes / (1024 ** 3):.2f} ГБ"


def admin_user_not_found() -> str:
    return "Пользователь не найден. Проверьте tg_id или наличие активной подписки."


def admin_user_card(
    tg_id: int,
    username: str | None,
    plan: Plan | None,
    period_end: dt.datetime | None,
    active: bool,
    disabled: bool,
    upload: int,
    download: int,
    total_gb: int,
    referral_code: str | None = None,
    promo_stats: str | None = None,
) -> str:
    who = f"@{username}" if username else f"id{tg_id}"
    if plan is None or period_end is None:
        return f"👤 {who} (id{tg_id})\n\nПодписки нет."

    if disabled:
        status = "отключена вручную"
        status_icon = "🔒"
    elif active:
        status = "активна"
        status_icon = "✅"
    else:
        status = "истекла"
        status_icon = "⚠️"

    used = upload + download
    limit_str = _fmt_gb(total_gb * 1024 ** 3) if total_gb else "безлимит"
    referral_line = f"\n🎁 Реферальный код: {referral_code}" if referral_code else ""
    stats_line = f"\n📊 Статистика промо: {promo_stats}" if promo_stats else ""
    return (
        f"👤 {who} (id{tg_id})\n\n"
        "━━━━━━━━━━━━\n"
        f"📌 Тариф: {plan.title}\n"
        f"{status_icon} Статус: {status}\n"
        f"🗓️ Действует до: {period_end.strftime('%d.%m.%Y %H:%M')}\n"
        f"📡 Трафик: {_fmt_gb(used)} из {limit_str}\n"
        f"{referral_line}{stats_line}\n"
        "━━━━━━━━━━━━\n\n"
        "📦 Подписка\n"
        "• доступ к сервису активен\n"
        "• можно продлить срок, включить или отключить доступ\n\n"
        "⚙️ Управление\n"
        "• продление срока\n"
        "• добавление инбаунда\n"
        "• синхронизация с панелью"
    )


def admin_resync_done() -> str:
    return "✅ Синхронизация завершена. Данные клиента обновлены в панели."


def admin_extended(days: int) -> str:
    return f"✅ Срок подписки продлён на {days} дней."


def admin_toggled(enabled: bool) -> str:
    return "✅ Клиент включён." if enabled else "🔒 Клиент отключён."


def autorenew_success_message_admin(days: int) -> str:
    return f"Подписка продлена администратором на {days} дней."


CONNECT_INSTRUCTIONS = (
    "Как подключиться:\n"
    "1. Установите приложение для своей платформы:\n"
    "   • Android — v2rayNG\n"
    "   • iOS — Streisand / Happ\n"
    "   • Windows — v2rayN / Hiddify\n"
    "   • macOS — Hiddify / FoXray\n"
    "2. В приложении выберите «Добавить подписку по ссылке» (Import from URL / "
    "Add subscription) и вставьте ссылку выше.\n"
    "3. Обновите список серверов (Update subscription) и подключитесь."
)

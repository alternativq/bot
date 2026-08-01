from __future__ import annotations

import datetime as dt

from config import settings
from plans import Plan

WELCOME = (
    "<b>🔥 Добро пожаловать в VeiloraVPN!</b>\n\n"
    "Премиальный высокоскоростной VPN-сервис до 1000 МБ/с с надежной защитой ваших данных.\n\n"
    "Вся работа с тарифами, подписками и подключением устройств теперь проходит в нашем удобном <b>Telegram Mini App</b>.\n\n"
    "👇 Нажмите кнопку ниже, чтобы открыть приложение:"
)

OPEN_APP_PROMPT = (
    "📱 <b>Все функции доступны в Telegram Mini App!</b>\n\n"
    "Покупка тарифов, управление подпиской, генерация QR-кодов и инструкции по подключению — в приложении."
)

HELP_TEXT = (
    "🆘 <b>Поддержка VeiloraVPN</b>\n\n"
    "• Управление подпиской и выбор тарифов — в Telegram Mini App.\n"
    "• Инструкции по настройке для iOS, Android, Windows и macOS доступны в приложении.\n"
    "• Если у вас возникли вопросы по оплате — свяжитесь с поддержкой."
)


def payment_request_sent_to_admin() -> str:
    return "Заявка отправлена администратору. После подтверждения оплаты ваша подписка активируется в Mini App."


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
        "Чтобы не потерять доступ, оформите подписку в нашем Telegram Mini App!"
    )


def subscription_ending_message(plan_title: str, period_end: dt.datetime) -> str:
    return (
        f"Подписка «{plan_title}» истекает {period_end.strftime('%d.%m.%Y %H:%M')}.\n"
        "Чтобы не потерять доступ, продлите её в нашем Telegram Mini App!"
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
        "━━━━━━━━━━━━"
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
    "Откройте Telegram Mini App — там доступны автоматические ссылки и инструкции для iOS, Android, Windows и macOS."
)

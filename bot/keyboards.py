from __future__ import annotations

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, KeyboardButton, ReplyKeyboardMarkup

from bot import texts
from panel.xui_client import InboundInfo
from payment_methods import PaymentMethod
from plans import PLANS, TRIAL_PLAN

BTN_PLANS = "Тарифы"
BTN_SUBSCRIPTION = "Моя подписка"
BTN_HELP = "Помощь"
BTN_PROMO = "Промокоды"
BTN_REF = "Рефералы"


def main_menu_keyboard() -> ReplyKeyboardMarkup:
    """Постоянное меню внизу экрана - показывается один раз после /start и остаётся видимым."""
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text=BTN_PLANS), KeyboardButton(text=BTN_SUBSCRIPTION)],
            [KeyboardButton(text=BTN_HELP), KeyboardButton(text=BTN_PROMO)],
            [KeyboardButton(text=BTN_REF)],
        ],
        resize_keyboard=True,
    )


def plans_keyboard(trial_available: bool) -> InlineKeyboardMarkup:
    rows = []
    if trial_available:
        rows.append([InlineKeyboardButton(text=texts.plan_button_text(TRIAL_PLAN), callback_data=f"plan:{TRIAL_PLAN.id}")])

    rows.append([InlineKeyboardButton(text=texts.duration_button_text("m1"), callback_data="duration:m1")])
    rows.append([InlineKeyboardButton(text=texts.duration_button_text("m3"), callback_data="duration:m3")])
    rows.append([InlineKeyboardButton(text=texts.duration_button_text("m12"), callback_data="duration:m12")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def device_keyboard(duration_id: str) -> InlineKeyboardMarkup:
    device_plans = [
        ("m1", "m1"),
        ("m1-3", "m1-3"),
        ("m1-5", "m1-5"),
        ("m1-7", "m1-7"),
    ]
    if duration_id == "m3":
        device_plans = [("m3", "m3"), ("m3-3", "m3-3"), ("m3-5", "m3-5"), ("m3-7", "m3-7")]
    elif duration_id == "m12":
        device_plans = [("m12", "m12"), ("m12-3", "m12-3"), ("m12-5", "m12-5"), ("m12-7", "m12-7")]

    rows = []
    for index in range(0, len(device_plans), 2):
        chunk = device_plans[index:index + 2]
        rows.append([
            InlineKeyboardButton(text=texts.device_button_text(PLANS[plan_id]), callback_data=f"plan:{plan_id}")
            for plan_id, _ in chunk
        ])
    rows.append([InlineKeyboardButton(text="← Назад", callback_data="show_plans")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def payment_methods_keyboard(plan_id: str, methods: list[PaymentMethod]) -> InlineKeyboardMarkup:
    rows = [
        [InlineKeyboardButton(text=method.title, callback_data=f"pay:{plan_id}:{method.id}")]
        for method in methods
    ]
    return InlineKeyboardMarkup(inline_keyboard=rows)


def manual_paid_keyboard(pending_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text="Я оплатил", callback_data=f"paid:{pending_id}")]]
    )


def admin_inbound_keyboard(tg_id: int, inbounds: list[InboundInfo]) -> InlineKeyboardMarkup:
    rows = [
        [InlineKeyboardButton(text=ib.remark or f"Инбаунд {ib.id}", callback_data=f"admin_assign_inbound:{tg_id}:{ib.id}")]
        for ib in inbounds
    ]
    return InlineKeyboardMarkup(inline_keyboard=rows)


def admin_confirm_keyboard(pending_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="Подтвердить", callback_data=f"admin_confirm:{pending_id}"),
                InlineKeyboardButton(text="Отклонить", callback_data=f"admin_reject:{pending_id}"),
            ]
        ]
    )


def my_subscription_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="Сменить или продлить тариф", callback_data="show_plans")],
            [InlineKeyboardButton(text="🎁 Промокод", callback_data="promo_input")],
        ]
    )


def admin_user_keyboard(tg_id: int, disabled: bool) -> InlineKeyboardMarkup:
    toggle_text = "✓ Включить" if disabled else "✕ Отключить"
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="⏳ +7 дней", callback_data=f"admin_extend:{tg_id}:7"),
                InlineKeyboardButton(text="⏳ +30 дней", callback_data=f"admin_extend:{tg_id}:30"),
            ],
            [
                InlineKeyboardButton(text=toggle_text, callback_data=f"admin_toggle:{tg_id}"),
                InlineKeyboardButton(text="🔗 Добавить инбаунд", callback_data=f"admin_add_inbound:{tg_id}"),
            ],
            [
                InlineKeyboardButton(text="🔄 Синхронизация", callback_data=f"admin_resync:{tg_id}"),
            ],
        ]
    )

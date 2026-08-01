from __future__ import annotations

from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
    WebAppInfo,
)

from config import settings
from panel.xui_client import InboundInfo
from payment_methods import PaymentMethod
from plans import PLANS, TRIAL_PLAN

BTN_OPEN_APP = "🚀 Открыть VeiloraVPN App"


def main_menu_keyboard() -> ReplyKeyboardMarkup:
    """Постоянная кнопка внизу экрана для быстрой помощи и открытия Mini App."""
    url = settings.webapp_url
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text=BTN_OPEN_APP, web_app=WebAppInfo(url=url))],
        ],
        resize_keyboard=True,
    )


def open_app_keyboard() -> InlineKeyboardMarkup:
    """Инлайн-кнопка для моментального перехода в Telegram Mini App."""
    url = settings.webapp_url
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="⚡ Открыть VeiloraVPN App", web_app=WebAppInfo(url=url))],
        ]
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

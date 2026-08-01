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

BTN_OPEN_APP = "🚀 Открыть VeiloraVPN App"


def _is_valid_webapp_url(url: str) -> bool:
    if not url or not url.startswith("https://"):
        return False
    # t.me domains cannot be used as WebAppInfo target URLs
    if "t.me/" in url.lower():
        return False
    return True


def main_menu_keyboard() -> ReplyKeyboardMarkup:
    """Постоянная кнопка внизу экрана для открытия Mini App."""
    url = settings.webapp_url
    if _is_valid_webapp_url(url):
        btn = KeyboardButton(text=BTN_OPEN_APP, web_app=WebAppInfo(url=url))
    else:
        btn = KeyboardButton(text=BTN_OPEN_APP)

    return ReplyKeyboardMarkup(
        keyboard=[[btn]],
        resize_keyboard=True,
    )


def open_app_keyboard() -> InlineKeyboardMarkup:
    """Инлайн-кнопка для моментального перехода в Telegram Mini App."""
    url = settings.webapp_url
    if _is_valid_webapp_url(url):
        btn = InlineKeyboardButton(text="⚡ Открыть VeiloraVPN App", web_app=WebAppInfo(url=url))
    else:
        btn = InlineKeyboardButton(text="⚡ Открыть VeiloraVPN App", url=url if url.startswith("http") else "https://t.me")

    return InlineKeyboardMarkup(inline_keyboard=[[btn]])


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

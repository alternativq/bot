import asyncio
import datetime as dt
import os
from types import SimpleNamespace

os.environ.setdefault("BOT_TOKEN", "test-token")
os.environ.setdefault("BOT_USERNAME", "test-bot")
os.environ.setdefault("XUI_HOST", "https://example.com")
os.environ.setdefault("SUB_DOMAIN", "example.com")

from bot import keyboards
from bot.handlers import handle_text_message
from bot.texts import my_subscription_message
from db.database import reset_db
from plans import Plan
from services.promo_system import (
    apply_code,
    build_referral_code,
    calculate_discounted_amount,
    ensure_referral_code,
    looks_like_promo_code,
    normalize_code,
)


def test_normalize_code_is_case_insensitive() -> None:
    assert normalize_code("  SAVE10 ") == "save10"


def test_discounted_amount_is_calculated_rounding_down() -> None:
    assert calculate_discounted_amount(1000, 10) == 900
    assert calculate_discounted_amount(1000, 0) == 1000


def test_build_referral_code_uses_tg_id() -> None:
    assert build_referral_code(123456) == "123456"


def test_numeric_code_is_treated_as_referral() -> None:
    assert looks_like_promo_code("123456") is True


def test_my_subscription_message_contains_bonus_section() -> None:
    plan = Plan(id="m1", title="1 месяц", price_rub=199, duration_days=30)
    message = my_subscription_message(
        plan,
        dt.datetime(2026, 1, 1, 12, 0),
        True,
        [],
        discount_percent=0,
        referral_code="ref123",
        bonus_days=5,
    )
    assert "Бонусы/рефералы" in message
    assert "Реферальный код: ref123" in message
    assert "Бонус: +5 дней" in message


def test_main_menu_contains_referral_button() -> None:
    keyboard = keyboards.main_menu_keyboard()
    buttons = [button.text for row in keyboard.keyboard for button in row]
    assert keyboards.BTN_REF in buttons


def test_handle_text_message_routes_promo_button(monkeypatch) -> None:
    calls = []

    async def fake_promo_command(message) -> None:
        calls.append(message.text)

    monkeypatch.setattr("bot.handlers.promo_command", fake_promo_command)
    message = SimpleNamespace(text=keyboards.BTN_PROMO)

    asyncio.run(handle_text_message(message))

    assert calls == [keyboards.BTN_PROMO]


async def async_tests() -> None:
    await reset_db()

    # 1. Свой реферальный код использовать нельзя
    code = await ensure_referral_code(100)
    ok, msg = await apply_code(100, code)
    assert ok is False
    assert "собственный" in msg.lower()

    ok_ref, msg_ref = await apply_code(100, "ref100")
    assert ok_ref is False
    assert "собственный" in msg_ref.lower()

    # 2. Использование рефкода другого пользователя даёт 0% скидки
    ok_other, msg_other = await apply_code(200, "100")
    assert ok_other is True
    assert "применён" in msg_other.lower()

    print("PROMO SYSTEM ASYNC TESTS: ALL PASSED")


if __name__ == "__main__":
    test_normalize_code_is_case_insensitive()
    test_discounted_amount_is_calculated_rounding_down()
    test_build_referral_code_uses_tg_id()
    test_numeric_code_is_treated_as_referral()
    test_my_subscription_message_contains_bonus_section()
    test_main_menu_contains_referral_button()
    asyncio.run(async_tests())

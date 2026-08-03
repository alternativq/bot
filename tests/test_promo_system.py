import asyncio
import datetime as dt
import os
from unittest.mock import AsyncMock, patch

from aiohttp.test_utils import TestClient, TestServer

os.environ.setdefault("BOT_TOKEN", "test-token")
os.environ.setdefault("BOT_USERNAME", "test-bot")
os.environ.setdefault("XUI_HOST", "https://example.com")
os.environ.setdefault("SUB_DOMAIN", "example.com")

import sub_server
from api.auth import create_jwt
from config import settings
from db.database import get_session, reset_db
from db.models import User
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


async def async_tests() -> None:
    await reset_db()

    # 1. Свой реферальный код использовать нельзя
    async with get_session() as session:
        session.add(User(tg_id=100))
        session.add(User(tg_id=200))
        await session.commit()

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

    # 3. Проверка REST API /api/v1/promo/apply
    app = sub_server.create_app()
    server = TestServer(app)
    client = TestClient(server)
    await client.start_server()

    try:
        with patch.object(settings, "BOT_TOKEN", "test_bot_token_123"):
            token_user = create_jwt({"id": 200, "username": "user200"})
            headers_user = {"Authorization": f"Bearer {token_user}"}

            # Свой реферальный код -> success: False
            resp_bad = await client.post("/api/v1/promo/apply", json={"code": "200"}, headers=headers_user)
            assert resp_bad.status == 200
            data_bad = await resp_bad.json()
            assert data_bad.get("success") is False
            print("OK: REST API /api/v1/promo/apply отклоняет собственный реферальный код (success: False)")

    finally:
        await client.close()

    print("PROMO SYSTEM ASYNC TESTS: ALL PASSED")


if __name__ == "__main__":
    test_normalize_code_is_case_insensitive()
    test_discounted_amount_is_calculated_rounding_down()
    test_build_referral_code_uses_tg_id()
    test_numeric_code_is_treated_as_referral()
    asyncio.run(async_tests())


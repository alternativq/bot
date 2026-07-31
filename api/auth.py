"""
Авторизация для Telegram Mini App.

Проверяем initData по алгоритму Telegram (HMAC-SHA256),
затем выдаём JWT-токен для последующих запросов.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import time
from urllib.parse import parse_qs, unquote

import jwt

from config import settings

ALGORITHM = "HS256"
TOKEN_TTL_SECONDS = 86400  # 24 часа


def _get_jwt_secret() -> str:
    return settings.JWT_SECRET or settings.BOT_TOKEN


def validate_init_data(init_data: str) -> dict | None:
    """
    Валидация initData по алгоритму Telegram.
    https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app

    Возвращает dict с данными пользователя или None при невалидной подписи.
    """
    parsed = parse_qs(init_data, keep_blank_values=True)

    if "hash" not in parsed:
        return None

    received_hash = parsed.pop("hash")[0]

    # Собираем data_check_string: сортируем пары key=value по ключу
    data_check_pairs = []
    for key in sorted(parsed.keys()):
        val = parsed[key][0]
        data_check_pairs.append(f"{key}={val}")
    data_check_string = "\n".join(data_check_pairs)

    # secret_key = HMAC-SHA256("WebAppData", BOT_TOKEN)
    secret_key = hmac.new(
        b"WebAppData",
        settings.BOT_TOKEN.encode("utf-8"),
        hashlib.sha256,
    ).digest()

    # calculated_hash = HMAC-SHA256(secret_key, data_check_string)
    calculated_hash = hmac.new(
        secret_key,
        data_check_string.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(calculated_hash, received_hash):
        return None

    # Проверяем auth_date — не старше 24 часов
    auth_date_str = parsed.get("auth_date", [None])[0]
    if auth_date_str:
        try:
            auth_date = int(auth_date_str)
            if abs(time.time() - auth_date) > TOKEN_TTL_SECONDS:
                return None
        except ValueError:
            return None

    # Парсим user из JSON
    user_raw = parsed.get("user", [None])[0]
    if not user_raw:
        return None

    try:
        user = json.loads(unquote(user_raw))
    except (json.JSONDecodeError, TypeError):
        return None

    return user


def create_jwt(user: dict) -> str:
    """Создаёт JWT-токен с данными пользователя."""
    payload = {
        "tg_id": user.get("id"),
        "username": user.get("username"),
        "first_name": user.get("first_name", ""),
        "last_name": user.get("last_name", ""),
        "iat": int(time.time()),
        "exp": int(time.time()) + TOKEN_TTL_SECONDS,
    }
    return jwt.encode(payload, _get_jwt_secret(), algorithm=ALGORITHM)


def decode_jwt(token: str) -> dict | None:
    """Декодирует и проверяет JWT. Возвращает payload или None."""
    try:
        return jwt.decode(token, _get_jwt_secret(), algorithms=[ALGORITHM])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None

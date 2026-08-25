"""
Middleware для API: CORS и JWT-авторизация.
"""
from __future__ import annotations

import logging
from typing import Callable

from aiohttp import web

from api.auth import decode_jwt
from config import settings

log = logging.getLogger(__name__)

# Маршруты, не требующие авторизации
PUBLIC_PATHS = frozenset({
    "/api/v1/auth",
})


def is_public(path: str) -> bool:
    return path in PUBLIC_PATHS or path.startswith("/api/v1/web/")



@web.middleware
async def cors_middleware(request: web.Request, handler: Callable) -> web.StreamResponse:
    """CORS middleware — разрешает запросы от Mini App."""
    if request.method == "OPTIONS":
        response = web.Response(status=204)
    else:
        try:
            response = await handler(request)
        except web.HTTPException as exc:
            response = exc

    allowed_origin = settings.MINIAPP_URL or "*"
    response.headers["Access-Control-Allow-Origin"] = allowed_origin
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
    response.headers["Access-Control-Max-Age"] = "3600"
    return response


@web.middleware
async def auth_middleware(request: web.Request, handler: Callable) -> web.StreamResponse:
    """JWT-авторизация: проверяет токен для защищённых маршрутов."""
    path = request.path

    # Пропускаем публичные маршруты, не-API маршруты и OPTIONS
    if request.method == "OPTIONS" or not path.startswith("/api/") or is_public(path):
        return await handler(request)

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise web.HTTPUnauthorized(
            text='{"error": "Missing or invalid Authorization header"}',
            content_type="application/json",
        )

    token = auth_header[7:]
    payload = decode_jwt(token)
    if payload is None:
        raise web.HTTPUnauthorized(
            text='{"error": "Invalid or expired token"}',
            content_type="application/json",
        )

    # Сохраняем данные пользователя в request для использования в handlers
    request["user"] = payload
    return await handler(request)


@web.middleware
async def error_middleware(request: web.Request, handler: Callable) -> web.StreamResponse:
    """Глобальный обработчик ошибок — возвращает JSON вместо HTML."""
    try:
        return await handler(request)
    except web.HTTPException:
        raise
    except Exception:
        log.exception("Необработанная ошибка в API: %s %s", request.method, request.path)
        raise web.HTTPInternalServerError(
            text='{"error": "Internal server error"}',
            content_type="application/json",
        )

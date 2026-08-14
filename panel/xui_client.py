"""
Обёртка над py3xui (pip install py3xui — https://github.com/iwatkot/py3xui).

Бот создаёт ОДНОГО клиента в одном инбаунде (XUI_INBOUND_ID в .env, иначе
первый инбаунд из панели) и отправляет пользователю нативную ссылку-подписку
панели: https://{SUB_DOMAIN}:{SUB_PORT}/sub/{subId}.

Нюансы 3x-ui:
- `email` клиента уникален в рамках всей панели — используем `tg{tg_id}`.
- `id` клиента — UUID/credential (VLESS/VMess). Не путать с `.id` объекта
  из get_by_email() — там внутренний числовой id строки в панели.
- `total_gb` в py3xui называется «в гигабайтах», но API ждёт БАЙТЫ (0 = безлимит).
- `expiry_time` — unix-время в МИЛЛИСЕКУНДАХ (0 = бессрочно).
- Провижининг идемпотентен: перед add проверяем get_by_email, при повторе
  переиспользуем существующего клиента и его subId.
"""
from __future__ import annotations

import asyncio
import datetime as dt
import logging
import uuid
import aiohttp
from dataclasses import dataclass

import pyotp
from py3xui import AsyncApi, Client

from config import settings

log = logging.getLogger(__name__)


GB = 1024 ** 3

_api: AsyncApi | None = None
_api_lock = asyncio.Lock()


@dataclass(frozen=True)
class InboundInfo:
    id: int
    remark: str


async def _get_api() -> AsyncApi:
    """Ленивая авторизация в панели, с переиспользованием сессии между вызовами."""
    global _api
    async with _api_lock:
        if _api is None:
            if settings.XUI_TOKEN:
                _api = AsyncApi(settings.XUI_HOST, token=settings.XUI_TOKEN)
            else:
                _api = AsyncApi(settings.XUI_HOST, settings.XUI_USERNAME, settings.XUI_PASSWORD)
                if settings.XUI_TOTP_SECRET:
                    totp_code = pyotp.TOTP(settings.XUI_TOTP_SECRET).now()
                    await _api.login(totp_code)
                else:
                    await _api.login()
        return _api


async def _with_relogin(coro_factory):
    """Разово перелогиниваемся, если сессия/токен протухли (401/403)."""
    api = await _get_api()
    try:
        return await coro_factory(api)
    except Exception as exc:
        if "401" in str(exc) or "403" in str(exc):
            global _api
            async with _api_lock:
                _api = None
            api = await _get_api()
            return await coro_factory(api)
        raise


async def get_all_inbounds() -> list[InboundInfo]:
    """Актуальный список всех инбаундов панели."""

    async def _list(api: AsyncApi):
        return await api.inbound.get_list()

    inbounds = await _with_relogin(_list)
    return [InboundInfo(id=ib.id, remark=getattr(ib, "remark", "") or f"Инбаунд {ib.id}") for ib in inbounds]


async def get_target_inbound() -> InboundInfo:
    """Инбаунд, в котором создаются клиенты (из XUI_INBOUND_ID или первый в списке)."""
    inbounds = await get_all_inbounds()
    if not inbounds:
        raise RuntimeError("В панели 3x-ui нет ни одного инбаунда")

    if settings.XUI_INBOUND_ID:
        for ib in inbounds:
            if ib.id == settings.XUI_INBOUND_ID:
                return ib
        raise RuntimeError(
            f"Инбаунд id={settings.XUI_INBOUND_ID} не найден в панели. "
            f"Доступные: {[ib.id for ib in inbounds]}"
        )

    return inbounds[0]


def client_email(tg_id: int) -> str:
    return f"tg{tg_id}"


def client_email_for_inbound(tg_id: int, inbound_id: int | None = None) -> str:
    return f"tg{tg_id}" if inbound_id is None else f"tg{tg_id}-inb{inbound_id}"


def to_expiry_ms(period_end: dt.datetime) -> int:
    return int(period_end.timestamp() * 1000)


def build_subscription_url(sub_id: str) -> str:
    """Нативная ссылка-подписка из панели 3x-ui."""
    scheme = "https" if settings.SUB_TLS else "http"
    path = settings.SUB_PATH if settings.SUB_PATH.endswith("/") else settings.SUB_PATH + "/"
    return f"{scheme}://{settings.SUB_DOMAIN}:{settings.SUB_PORT}{path}{sub_id}"


async def _get_client_by_email(email: str):
    """
    Пытаемся получить клиента без лишних ошибок:
    1) сначала используем list API, если он доступен в py3xui;
    2) только затем — get_by_email для точного поиска.
    Это снижает шум в логах панели и избавляет от лишних запросов вида
    /clients/get/<email> для обычных проверок состояния подписки.
    """

    async def _get_from_list(api: AsyncApi, email=email):
        clients = await api.client.get_list()
        for client in clients or []:
            if getattr(client, "email", None) == email:
                return client
        return None

    async def _get(api: AsyncApi, email=email):
        return await api.client.get_by_email(email)

    try:
        return await _with_relogin(_get_from_list)
    except Exception:
        pass

    try:
        return await _with_relogin(_get)
    except ValueError as exc:
        if "not found" in str(exc).lower():
            return None
        raise


async def _sync_client(
    inbound_id: int,
    tg_id: int,
    client_uuid: str,
    existing_sub_id: str | None,
    expiry_ms: int,
    total_bytes: int,
    limit_ip: int,
    flow: str,
    email: str,
) -> str:
    """Создаёт или обновляет клиента в инбаунде, возвращает актуальный subId."""
    existing = await _get_client_by_email(email)

    if existing is not None:
        existing.expiry_time = expiry_ms
        existing.total_gb = total_bytes
        existing.limit_ip = limit_ip
        existing.enable = True
        if not getattr(existing, "tg_id", None):
            existing.tg_id = tg_id

        async def _update(api: AsyncApi, existing=existing):
            await api.client.update(existing.id, existing)

        await _with_relogin(_update)
        return existing.sub_id

    sub_id = existing_sub_id or uuid.uuid4().hex[:16]
    client = Client(
        id=client_uuid,
        email=email,
        enable=True,
        expiry_time=expiry_ms,
        total_gb=total_bytes,
        limit_ip=limit_ip,
        sub_id=sub_id,
        tg_id=tg_id,
        flow=flow,
    )
    if hasattr(client, "tg_id"):
        client.tg_id = tg_id

    async def _add(api: AsyncApi, inbound_id=inbound_id, client=client):
        await api.client.add(inbound_id, [client])

    await _with_relogin(_add)
    return sub_id


async def provision_client(
    tg_id: int,
    period_end: dt.datetime,
    total_gb: int,
    limit_ip: int,
    flow: str,
    inbound_id: int | None = None,
    email: str | None = None,
    client_uuid: str | None = None,
) -> tuple[str, int, str]:
    """
    Создаёт (или восстанавливает после частичного сбоя) одного клиента
    в целевом инбаунде. Возвращает (client_uuid, inbound_id, sub_id).
    """
    if inbound_id is None:
        inbound = await get_target_inbound()
        target_inbound_id = inbound.id
    else:
        target_inbound_id = inbound_id

    expiry_ms = to_expiry_ms(period_end)
    total_bytes = total_gb * GB if total_gb else 0
    resolved_email = email or client_email(tg_id)

    existing = await _get_client_by_email(resolved_email)
    resolved_client_uuid = client_uuid or (existing.uuid if existing and existing.uuid else str(uuid.uuid4()))

    sub_id = await _sync_client(
        target_inbound_id,
        tg_id,
        resolved_client_uuid,
        None,
        expiry_ms,
        total_bytes,
        limit_ip,
        flow,
        resolved_email,
    )
    return resolved_client_uuid, target_inbound_id, sub_id


async def attach_client_to_inbound(
    tg_id: int,
    client_uuid: str,
    existing_sub_id: str | None,
    period_end: dt.datetime,
    total_gb: int,
    limit_ip: int,
    flow: str,
    inbound_id: int,
    email: str | None = None,
) -> tuple[str, int, str]:
    """Привязывает существующего клиента к новому инбаунду без создания отдельной логической подписки."""
    resolved_email = email or client_email(tg_id)
    expiry_ms = to_expiry_ms(period_end)
    total_bytes = total_gb * GB if total_gb else 0

    existing = await _get_client_by_email(resolved_email)
    resolved_client_uuid = client_uuid or (existing.uuid if existing and existing.uuid else str(uuid.uuid4()))
    resolved_sub_id = existing.sub_id if existing and existing.sub_id else existing_sub_id or uuid.uuid4().hex[:16]

    client = Client(
        id=resolved_client_uuid,
        email=resolved_email,
        enable=True,
        expiry_time=expiry_ms,
        total_gb=total_bytes,
        limit_ip=limit_ip,
        sub_id=resolved_sub_id,
        tg_id=tg_id,
        flow=flow,
    )
    if hasattr(client, "tg_id"):
        client.tg_id = tg_id

    async def _add(api: AsyncApi, inbound_id=inbound_id, client=client):
        await api.client.add(inbound_id, [client])

    await _with_relogin(_add)
    return resolved_client_uuid, inbound_id, resolved_sub_id


async def renew_client(
    tg_id: int,
    client_uuid: str,
    existing_sub_id: str | None,
    new_period_end: dt.datetime,
    total_gb: int,
    limit_ip: int,
    flow: str = "xtls-rprx-vision",
    inbound_id: int | None = None,
    email: str | None = None,
) -> tuple[int, str]:
    """
    Продлевает существующего клиента (expiry + лимит трафика).
    Возвращает (inbound_id, sub_id).
    """
    if inbound_id is None:
        inbound = await get_target_inbound()
        target_inbound_id = inbound.id
    else:
        target_inbound_id = inbound_id

    expiry_ms = to_expiry_ms(new_period_end)
    total_bytes = total_gb * GB if total_gb else 0
    resolved_email = email or client_email(tg_id)

    sub_id = await _sync_client(
        target_inbound_id,
        tg_id,
        client_uuid,
        existing_sub_id,
        expiry_ms,
        total_bytes,
        limit_ip,
        flow,
        resolved_email,
    )
    return target_inbound_id, sub_id


async def disable_client(tg_id: int) -> None:
    """Отключает клиента (ручная блокировка администратором)."""
    existing = await _get_client_by_email(client_email(tg_id))
    if existing is None:
        return
    existing.enable = False

    async def _update(api: AsyncApi, existing=existing):
        await api.client.update(existing.id, existing)

    await _with_relogin(_update)


async def set_client_enabled(tg_id: int, enabled: bool) -> None:
    """Включает/отключает клиента (для админ-панели)."""
    existing = await _get_client_by_email(client_email(tg_id))
    if existing is None:
        return
    existing.enable = enabled

    async def _update(api: AsyncApi, existing=existing):
        await api.client.update(existing.id, existing)

    await _with_relogin(_update)


async def get_client_traffic(tg_id: int) -> tuple[int, int]:
    """Расход трафика клиента (upload_bytes, download_bytes)."""
    existing = await _get_client_by_email(client_email(tg_id))
    if existing is None:
        return 0, 0
    return getattr(existing, "up", 0) or 0, getattr(existing, "down", 0) or 0


@dataclass(frozen=True)
class SubUserInfo:
    upload: int = 0
    download: int = 0
    total: int = 0
    expire: int = 0

    def as_header(self) -> str:
        return f"upload={self.upload}; download={self.download}; total={self.total}; expire={self.expire}"


def _parse_userinfo_header(value: str) -> SubUserInfo:
    parts: dict[str, str] = {}
    for chunk in value.split(";"):
        chunk = chunk.strip()
        if "=" in chunk:
            k, v = chunk.split("=", 1)
            parts[k.strip()] = v.strip()

    def _int(key: str) -> int:
        try:
            return int(parts.get(key, 0))
        except ValueError:
            return 0

    return SubUserInfo(upload=_int("upload"), download=_int("download"), total=_int("total"), expire=_int("expire"))


async def fetch_native_configs(
    sub_id: str, session: aiohttp.ClientSession | None = None, user_agent: str | None = None
) -> tuple[list[str], SubUserInfo]:
    """Забирает конфиг с нативного /sub/{sub_id} панели."""
    import base64

    url = build_subscription_url(sub_id)
    req_headers = {"User-Agent": user_agent} if user_agent else None

    async def _fetch(sess: aiohttp.ClientSession) -> tuple[list[str], SubUserInfo]:
        async with sess.get(url, headers=req_headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            resp.raise_for_status()
            raw = (await resp.text()).strip()
            userinfo_header = resp.headers.get("Subscription-Userinfo", "")

        userinfo = _parse_userinfo_header(userinfo_header) if userinfo_header else SubUserInfo()
        if not raw:
            return [], userinfo
        padded = raw + "=" * (-len(raw) % 4)
        decoded = base64.b64decode(padded).decode("utf-8", errors="ignore")
        lines = [line for line in decoded.splitlines() if line.strip()]
        return lines, userinfo

    if session is not None:
        return await _fetch(session)

    connector = aiohttp.TCPConnector(ssl=settings.SUB_FETCH_VERIFY_TLS)
    async with aiohttp.ClientSession(connector=connector) as own_session:
        return await _fetch(own_session)


async def build_unified_subscription_content(
    sub_ids: dict[int, str], user_agent: str | None = None
) -> tuple[str, SubUserInfo]:
    """Склеивает конфиги в одну подписку параллельно (для sub_server.py, если включён)."""
    import base64
    import aiohttp

    if not sub_ids:
        return "", SubUserInfo()

    connector = aiohttp.TCPConnector(ssl=settings.SUB_FETCH_VERIFY_TLS)
    async with aiohttp.ClientSession(connector=connector) as session:
        fetch_fn = globals()["fetch_native_configs"]
        tasks = [fetch_fn(sub_id, session=session, user_agent=user_agent) for sub_id in sub_ids.values()]
        results = await asyncio.gather(*tasks, return_exceptions=True)


    all_lines: list[str] = []
    total_upload = 0
    total_download = 0
    max_total = 0
    max_expire = 0

    for res in results:
        if isinstance(res, Exception):
            log.warning("Ошибка получения нативного конфига: %s", res)
            continue
        lines, info = res
        all_lines.extend(lines)
        total_upload += info.upload
        total_download += info.download
        max_total = max(max_total, info.total)
        max_expire = max(max_expire, info.expire)

    content = base64.b64encode("\n".join(all_lines).encode("utf-8")).decode("ascii")
    userinfo = SubUserInfo(upload=total_upload, download=total_download, total=max_total, expire=max_expire)
    return content, userinfo


async def delete_client(
    tg_id: int,
    client_uuid: str | None = None,
    sub_ids: dict[str, str] | None = None,
) -> None:
    """Полностью удаляет клиента из всех инбаундов 3X-UI панели."""
    email = client_email(tg_id)
    existing = await _get_client_by_email(email)

    target_uuid = client_uuid or (getattr(existing, "id", None) if existing else None)
    if not target_uuid:
        return

    inbound_ids: list[int] = []
    if sub_ids:
        for k in sub_ids.keys():
            try:
                inbound_ids.append(int(k))
            except ValueError:
                pass

    if not inbound_ids:
        try:
            inbounds = await get_all_inbounds()
            inbound_ids = [ib.id for ib in inbounds]
        except Exception:
            inbound_ids = []

    for ib_id in inbound_ids:
        try:
            async def _delete(api: AsyncApi, ib_id=ib_id, target_uuid=target_uuid):
                await api.client.delete(ib_id, target_uuid)

            await _with_relogin(_delete)
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning("Failed to delete client %s from inbound %s: %s", tg_id, ib_id, exc)

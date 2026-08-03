"""
Тест единой агрегированной подписки: sub_server.py должен склеивать уже
готовые (декодированные) конфиги нескольких инбаундов в один base64-блок
И правильно агрегировать/отдавать служебные заголовки (Subscription-
Userinfo суммируется по инбаундам, Profile-Title, Profile-Update-Interval),
без которых клиенты вроде Happ показывают домен вместо названия и не видят
трафик. По неизвестному токену - 404.

HTTP-запросы к самой 3x-ui (fetch_native_configs) замоканы - реальная
панель не нужна. Запуск из корня проекта:

    python -m tests.test_sub_server
"""
from __future__ import annotations

import asyncio
import base64
import datetime as dt
from unittest.mock import AsyncMock, patch

from aiohttp.test_utils import TestClient, TestServer

import panel.xui_client as xui_client
import sub_server
from db.database import get_session, reset_db
from db.models import Subscription, User
from panel.xui_client import SubUserInfo


async def main():
    await reset_db()

    async with get_session() as session:
        session.add(User(tg_id=42))
        await session.commit()

    async with get_session() as session:
        session.add(
            Subscription(
                user_tg_id=42,
                plan_id="m1",
                xui_uuid="uuid-x",
                xui_sub_ids={"1": "sub-nl", "2": "sub-de"},
                public_token="my-secret-token",
                period_end=dt.datetime.now(dt.timezone.utc),
            )
        )
        await session.commit()


    async def fake_fetch(sub_id: str, session=None):
        # разный трафик на разных инбаундах - должен просуммироваться
        if sub_id == "sub-nl":
            return [f"vless://config-for-{sub_id}"], SubUserInfo(upload=100, download=200, total=1000, expire=99999)
        return [f"vless://config-for-{sub_id}"], SubUserInfo(upload=10, download=20, total=1000, expire=99999)


    app = sub_server.create_app()
    with patch.object(xui_client, "fetch_native_configs", new=AsyncMock(side_effect=fake_fetch)):
        server = TestServer(app)
        client = TestClient(server)
        await client.start_server()
        try:
            resp = await client.get("/my-secret-token")
            assert resp.status == 200
            body = await resp.text()
            decoded = base64.b64decode(body).decode()
            lines = decoded.splitlines()
            assert "vless://config-for-sub-nl" in lines
            assert "vless://config-for-sub-de" in lines
            print("OK: единая подписка склеивает конфиги обоих инбаундов в один base64-блок")

            userinfo_header = resp.headers.get("Subscription-Userinfo")
            assert userinfo_header is not None
            assert "upload=110" in userinfo_header, "upload должен просуммироваться (100+10)"
            assert "download=220" in userinfo_header, "download должен просуммироваться (200+20)"
            assert "total=1000" in userinfo_header
            print("OK: Subscription-Userinfo суммирует трафик по всем инбаундам")

            title_header = resp.headers.get("Profile-Title")
            assert title_header is not None and title_header.startswith("base64:")
            print("OK: Profile-Title присутствует в ответе (без него клиент показывает домен вместо имени)")

            assert resp.headers.get("Profile-Update-Interval") is not None
            print("OK: Profile-Update-Interval присутствует (автообновление подписки в клиенте)")

            resp2 = await client.get("/no-such-token")
            assert resp2.status == 404
            print("OK: неизвестный токен -> 404")
        finally:
            await client.close()

    print("\nSUB_SERVER: ВСЕ ПРОВЕРКИ ПРОШЛИ")


def test_sub_server_suite() -> None:
    asyncio.run(main())


if __name__ == "__main__":
    asyncio.run(main())


"""
Тест админ-панели: продление подписки, включение/отключение
клиента, REST API /api/v1/admin/* эндпоинты и разграничение прав.

Запуск из корня проекта:
    python -m tests.test_admin
"""
from __future__ import annotations

import asyncio
import datetime as dt
from unittest.mock import AsyncMock, patch

from aiohttp.test_utils import TestClient, TestServer
from sqlalchemy import select

import panel.xui_client as xui_client
import sub_server
from api.auth import create_jwt
from config import settings
from db.database import get_session, reset_db
from db.models import Subscription, User
from services.provisioning import admin_extend_subscription, admin_toggle_subscription



async def seed_subscription(tg_id: int, period_end: dt.datetime, disabled: bool = False) -> None:
    async with get_session() as session:
        session.add(User(tg_id=tg_id, username="petya"))
        await session.flush()
        session.add(
            Subscription(
                user_tg_id=tg_id,
                plan_id="m1",
                xui_uuid="admin-test-uuid",
                xui_sub_ids={"1": "sub-1"},
                public_token="admin-test-token",
                period_end=period_end,
                disabled=disabled,
            )
        )
        await session.commit()


async def main():
    await reset_db()
    admin_id = 123456789
    now = dt.datetime.now(dt.timezone.utc)

    with patch.object(settings, "BOT_TOKEN", "test_bot_token_123"), \
         patch.object(settings, "ADMIN_IDS", str(admin_id)):

        # --- 1. Сервисный слой: admin_extend_subscription продлевает и пересинхронизирует ---
        await seed_subscription(1001, now + dt.timedelta(days=5))
        mock_renew = AsyncMock(return_value=(1, "sub-1"))
        mock_enabled = AsyncMock(return_value=None)

        with patch.object(xui_client, "renew_client", mock_renew), \
             patch.object(xui_client, "set_client_enabled", mock_enabled):

            sub = await admin_extend_subscription(1001, 10)
            assert sub is not None
            assert abs((sub.period_end - (now + dt.timedelta(days=15))).total_seconds()) < 5
            mock_renew.assert_awaited_once()
            print("OK: admin_extend_subscription продлевает от текущего period_end и вызывает renew_client")

            # days=0 - просто пересинхронизация, период не должен измениться
            mock_renew.reset_mock()
            period_before = sub.period_end
            sub2 = await admin_extend_subscription(1001, 0)
            assert sub2.period_end == period_before
            mock_renew.assert_awaited_once()
            print("OK: admin_extend_subscription(days=0) пересинхронизирует инбаунды, не трогая срок")

            # несуществующий пользователь -> автоматически создаётся подписка
            result = await admin_extend_subscription(999999, 10)
            assert result is not None and result.user_tg_id == 999999
            print("OK: admin_extend_subscription для нового пользователя автоматически создаёт подписку")

            # --- 2. Сервисный слой: admin_toggle_subscription ---
            new_disabled = await admin_toggle_subscription(1001)
            assert new_disabled is True
            mock_enabled.assert_awaited_once_with(1001, enabled=False)

            new_disabled_2 = await admin_toggle_subscription(1001)
            assert new_disabled_2 is False
            print("OK: admin_toggle_subscription переключает disabled и синхронизирует enable в панели")


            # --- 3. REST API: Тест авторизации админских маршрутов ---
            app = sub_server.create_app()
            server = TestServer(app)
            client = TestClient(server)
            await client.start_server()

            try:
                token_user = create_jwt({"id": 222222, "username": "non_admin"})
                token_admin = create_jwt({"id": admin_id, "username": "admin_user"})

                headers_user = {"Authorization": f"Bearer {token_user}"}
                headers_admin = {"Authorization": f"Bearer {token_admin}"}

                # Не-админ получает 403 Forbidden
                resp_forbidden = await client.get("/api/v1/admin/users/search", headers=headers_user)
                assert resp_forbidden.status == 403
                print("OK: Админские эндпоинты возвращают 403 Forbidden для обычных пользователей")

                # Админ получает результаты поиска
                resp_ok = await client.get("/api/v1/admin/users/search?q=1001", headers=headers_admin)
                assert resp_ok.status == 200
                users_data = await resp_ok.json()
                assert len(users_data.get("users", [])) == 1
                print("OK: /api/v1/admin/users/search возвращает результаты для администратора")

                # Админ получает финансовую статистику
                resp_stats = await client.get("/api/v1/admin/stats", headers=headers_admin)
                assert resp_stats.status == 200
                stats = await resp_stats.json()
                assert "total_users" in stats and "active_subs" in stats
                print("OK: /api/v1/admin/stats отдаёт корректную сводку статистики")

                # Админ продлевает подписку через REST API
                mock_renew.reset_mock()
                resp_extend = await client.post(
                    "/api/v1/admin/user/1001/extend",
                    json={"days": 30},
                    headers=headers_admin,
                )
                assert resp_extend.status == 200
                async with get_session() as session:
                    sub_check = await session.scalar(select(Subscription).where(Subscription.user_tg_id == 1001))
                    assert sub_check.period_end > now + dt.timedelta(days=40)
                print("OK: REST API /api/v1/admin/user/{id}/extend успешного продления")

            finally:
                await client.close()


    print("\nАДМИН-ПАНЕЛЬ: ВСЕ ПРОВЕРКИ ПРОШЛИ")


def test_admin_suite() -> None:
    asyncio.run(main())


if __name__ == "__main__":
    asyncio.run(main())



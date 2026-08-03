"""
Тест провижининга одного клиента в одном инбаунде и выдачи нативной
ссылки-подписки панели.

py3xui полностью замокан - реальная 3x-ui панель не нужна.
Запуск из корня проекта:

    python -m tests.test_xui_client
"""
from __future__ import annotations

import asyncio
import datetime as dt
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import panel.xui_client as xui_client
from plans import get_plan

NOT_FOUND = ValueError("Response status is not successful, message:  (record not found)")


def fake_inbound(id_: int, remark: str = ""):
    return SimpleNamespace(id=id_, remark=remark)


async def main():
    xui_client._api = None
    period_end = dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=30)
    xui_client.settings.XUI_INBOUND_ID = 0


    # --- 1. provision_client создаёт одного клиента в первом инбаунде ---
    fake_api = SimpleNamespace(
        inbound=SimpleNamespace(get_list=AsyncMock(return_value=[fake_inbound(1, "NL"), fake_inbound(2, "DE")])),
        client=SimpleNamespace(add=AsyncMock(), get_list=AsyncMock(return_value=[]), get_by_email=AsyncMock(side_effect=NOT_FOUND), update=AsyncMock()),
    )

    with patch("panel.xui_client._get_api", new=AsyncMock(return_value=fake_api)), \
         patch("panel.xui_client.settings.XUI_INBOUND_ID", 0):
        client_uuid, inbound_id, sub_id = await xui_client.provision_client(
            tg_id=42, period_end=period_end, total_gb=0, limit_ip=0, flow="xtls-rprx-vision"
        )

    assert fake_api.client.add.await_count == 1, "клиент должен быть добавлен только в один инбаунд"
    add_inbound_id, add_clients = fake_api.client.add.await_args.args
    assert add_inbound_id == 1, "по умолчанию используется первый инбаунд"
    assert inbound_id == 1
    assert add_clients[0].email == "tg42"
    assert add_clients[0].id == client_uuid
    assert add_clients[0].sub_id == sub_id
    print("OK: provision_client создаёт одного клиента в первом инбаунде")

    # --- 2. renew_client обновляет существующего клиента ---
    existing_client = SimpleNamespace(
        id=6, uuid="existing-uuid", email="tg42", sub_id="existing-sub",
        expiry_time=0, total_gb=0, limit_ip=0, enable=False,
    )
    fake_api_2 = SimpleNamespace(
        inbound=SimpleNamespace(get_list=AsyncMock(return_value=[fake_inbound(1)])),
        client=SimpleNamespace(
            add=AsyncMock(),
            get_by_email=AsyncMock(return_value=existing_client),
            update=AsyncMock(),
        ),
    )
    with patch("panel.xui_client._get_api", new=AsyncMock(return_value=fake_api_2)):
        inbound_id, sub_id = await xui_client.renew_client(
            tg_id=42,
            client_uuid="existing-uuid",
            existing_sub_id="existing-sub",
            new_period_end=period_end,
            total_gb=0,
            limit_ip=0,
        )

    fake_api_2.client.update.assert_awaited_once()
    updated = fake_api_2.client.update.await_args.args[1]
    assert updated.enable is True
    fake_api_2.client.add.assert_not_called()
    assert sub_id == "existing-sub", "subId существующего клиента не должен меняться"
    print("OK: renew_client обновляет существующего клиента без повторного add")

    # --- 3. Повторная попытка provision после частичного сбоя переиспользует клиента ---
    orphan_client = SimpleNamespace(
        id=6, uuid="orphan-uuid", email="tg999", sub_id="orphan-sub",
        expiry_time=123, total_gb=0, limit_ip=0, enable=True,
    )
    fake_api_3 = SimpleNamespace(
        inbound=SimpleNamespace(get_list=AsyncMock(return_value=[fake_inbound(1)])),
        client=SimpleNamespace(
            add=AsyncMock(),
            get_by_email=AsyncMock(return_value=orphan_client),
            update=AsyncMock(),
        ),
    )
    with patch("panel.xui_client._get_api", new=AsyncMock(return_value=fake_api_3)):
        client_uuid_3, inbound_id_3, sub_id_3 = await xui_client.provision_client(
            tg_id=999, period_end=period_end, total_gb=0, limit_ip=0, flow="xtls-rprx-vision"
        )

    assert client_uuid_3 == "orphan-uuid"
    assert sub_id_3 == "orphan-sub"
    fake_api_3.client.add.assert_not_called()
    fake_api_3.client.update.assert_awaited_once()
    print("OK: повторная попытка переиспользует существующего клиента")

    # --- 4. provision_client принимает явный inbound_id ---
    fake_api_4 = SimpleNamespace(
        inbound=SimpleNamespace(get_list=AsyncMock(return_value=[fake_inbound(1), fake_inbound(2)])),
        client=SimpleNamespace(add=AsyncMock(), get_list=AsyncMock(return_value=[]), get_by_email=AsyncMock(side_effect=NOT_FOUND), update=AsyncMock()),
    )

    with patch("panel.xui_client._get_api", new=AsyncMock(return_value=fake_api_4)):
        await xui_client.provision_client(
            tg_id=77,
            period_end=period_end,
            total_gb=0,
            limit_ip=0,
            flow="xtls-rprx-vision",
            inbound_id=2,
        )

    add_inbound_id, _ = fake_api_4.client.add.await_args.args
    assert add_inbound_id == 2, "должен использовать переданный inbound_id"
    print("OK: provision_client поддерживает явный inbound_id")

    # --- 5. _get_client_by_email использует список клиентов, если панель его поддерживает ---
    client_from_list = SimpleNamespace(
        id=7,
        uuid="listed-uuid",
        email="tg77",
        sub_id="listed-sub",
        expiry_time=0,
        total_gb=0,
        limit_ip=0,
        enable=True,
    )
    fake_api_5 = SimpleNamespace(
        inbound=SimpleNamespace(get_list=AsyncMock(return_value=[fake_inbound(1)])),
        client=SimpleNamespace(
            get_list=AsyncMock(return_value=[client_from_list]),
            get_by_email=AsyncMock(side_effect=RuntimeError("boom")),
            add=AsyncMock(),
            update=AsyncMock(),
        ),
    )
    with patch("panel.xui_client._get_api", new=AsyncMock(return_value=fake_api_5)):
        found = await xui_client._get_client_by_email("tg77")
    assert found is client_from_list
    print("OK: _get_client_by_email использует list API без шумных запросов по несуществующему клиенту")

    # --- 6. доступны тарифы для 3/5/7 устройств ---
    plan = get_plan("m1-3")
    assert plan is not None, "тариф для 3 устройств должен быть доступен"
    assert plan.limit_ip == 3, "тариф для 3 устройств должен выставлять лимит подключений 3"
    assert plan.price_rub == 289, "цена тарифа для 3 устройств должна быть выше базовой"

    plan_5 = get_plan("m1-5")
    assert plan_5 is not None and plan_5.price_rub == 389, "тариф для 5 устройств должен стоить дороже"

    plan_7 = get_plan("m1-7")
    assert plan_7 is not None and plan_7.price_rub == 489, "тариф для 7 устройств должен быть самым дорогим"


    # --- 7. build_subscription_url формирует нативную ссылку панели ---
    with patch("panel.xui_client.settings") as mock_settings:
        mock_settings.SUB_TLS = True
        mock_settings.SUB_DOMAIN = "panel.example.com"
        mock_settings.SUB_PORT = 2096
        mock_settings.SUB_PATH = "/sub/"
        url = xui_client.build_subscription_url("abc123")
    assert url == "https://panel.example.com:2096/sub/abc123"
    print("OK: build_subscription_url формирует нативную ссылку панели")

    print("\nXUI_CLIENT (один клиент): ВСЕ ПРОВЕРКИ ПРОШЛИ")


def test_xui_client_suite() -> None:
    asyncio.run(main())


if __name__ == "__main__":
    asyncio.run(main())


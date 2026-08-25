from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch
from aiohttp.test_utils import TestClient, TestServer
from sqlalchemy import select

import sub_server
from config import settings
from db.database import get_session, init_db, reset_db
from db.models import Subscription, User, WebTrialSession
from panel import xui_client


def test_web_portal_suite() -> None:
    asyncio.run(main_test())


async def main_test() -> None:
    await reset_db()

    class FakeBot:
        async def send_message(self, *args, **kwargs):
            pass

    bot = FakeBot()
    sub_server.set_bot_instance(bot)

    app = sub_server.create_app()
    app["bot"] = bot
    server = TestServer(app)
    client = TestClient(server)
    await client.start_server()

    try:
        # 1. GET /api/v1/web/config
        resp = await client.get("/api/v1/web/config")
        assert resp.status == 200
        config_data = await resp.json()
        assert config_data["brand_name"] == settings.BRAND_NAME
        assert config_data["web_trial_enabled"] is True
        print("OK: GET /api/v1/web/config")

        # 2. GET /api/v1/web/captcha
        resp = await client.get("/api/v1/web/captcha")
        assert resp.status == 200
        captcha_data = await resp.json()
        assert "captcha_id" in captcha_data
        assert "question" in captcha_data

        captcha_id = captcha_data["captcha_id"]
        # Extract correct solution from captcha_id (format: solution:ts:sig)
        solution = captcha_id.split(":")[0]
        print("OK: GET /api/v1/web/captcha")

        # 3. POST /api/v1/web/free-trial (Wrong Captcha -> 400)
        resp_wrong = await client.post(
            "/api/v1/web/free-trial",
            json={"captcha_id": captcha_id, "answer": "999"}
        )
        assert resp_wrong.status == 400
        print("OK: Wrong captcha rejected with 400")

        # 4. POST /api/v1/web/free-trial (Valid Request)
        with patch.object(xui_client, "provision_client", new=AsyncMock(return_value=("web-uuid", 1, "web-sub-123"))):
            resp_trial = await client.post(
                "/api/v1/web/free-trial",
                json={"captcha_id": captcha_id, "answer": solution}
            )
            assert resp_trial.status == 200
            trial_res = await resp_trial.json()
            assert "public_token" in trial_res
            assert "sub_link" in trial_res
            assert "qr_code" in trial_res

            public_token = trial_res["public_token"]

            # Verify in DB
            async with get_session() as session:
                sub = await session.scalar(select(Subscription).where(Subscription.public_token == public_token))
                assert sub is not None
                web_session = await session.scalar(select(WebTrialSession).where(WebTrialSession.public_token == public_token))
                assert web_session is not None

            print("OK: POST /api/v1/web/free-trial successfully generated VPN trial key")

            # 5. Rate limiting check (2nd request from same IP -> 429)
            resp_captcha2 = await client.get("/api/v1/web/captcha")
            captcha_data2 = await resp_captcha2.json()
            solution2 = captcha_data2["captcha_id"].split(":")[0]

            resp_rate = await client.post(
                "/api/v1/web/free-trial",
                json={"captcha_id": captcha_data2["captcha_id"], "answer": solution2}
            )
            assert resp_rate.status == 429
            print("OK: IP rate limiting correctly blocked 2nd trial within 24h")

            # 6. POST /api/v1/web/recover
            resp_rec = await client.post(
                "/api/v1/web/recover",
                json={"token": public_token}
            )
            assert resp_rec.status == 200
            rec_data = await resp_rec.json()
            assert rec_data["public_token"] == public_token
            print("OK: POST /api/v1/web/recover retrieved subscription info")

    finally:
        await client.close()

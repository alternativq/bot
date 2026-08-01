from __future__ import annotations

import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.client.session.aiohttp import AiohttpSession
from aiogram.enums import ParseMode
from aiogram.types import BotCommand
from aiohttp import web

from bot.handlers import router
from config import settings
from db.database import init_db
from payment_methods import get_payment_methods
from services.billing_scheduler import setup_scheduler
from sub_server import create_app

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger(__name__)


async def start_sub_server(bot: Bot) -> web.AppRunner:
    app = create_app()
    app["bot"] = bot  # доступ к bot из API endpoints
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, settings.SUB_SERVER_HOST, settings.SUB_SERVER_PORT)
    await site.start()
    log.info(
        "HTTP-сервер (API + подписки) слушает http://%s:%s",
        settings.SUB_SERVER_HOST, settings.SUB_SERVER_PORT,
    )
    return runner


async def main() -> None:
    await init_db()

    if not get_payment_methods():
        log.warning(
            "Ни один способ оплаты не настроен (YOOMONEY_WALLET/OZON_REQUISITE пусты) - "
            "бот запустится, но платные тарифы будут недоступны. Пробный период "
            "продолжит работать, если TRIAL_ENABLED=true."
        )

    session = AiohttpSession(proxy=settings.BOT_PROXY_URL) if settings.BOT_PROXY_URL else None
    if session:
        log.info("Bot API запросы пойдут через прокси %s", settings.BOT_PROXY_URL.split("@")[-1])
    bot = Bot(token=settings.BOT_TOKEN, session=session, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    await bot.set_my_commands([
        BotCommand(command="start", description="🚀 Открыть VeiloraVPN App"),
        BotCommand(command="help", description="🆘 Помощь"),
    ])
    dp = Dispatcher()
    dp.include_router(router)

    scheduler = setup_scheduler(bot)
    scheduler.start()

    from sub_server import set_bot_instance
    set_bot_instance(bot)

    runner = await start_sub_server(bot)

    try:
        await dp.start_polling(bot)
    finally:
        log.info("Завершение работы бота и веб-сервера...")
        await runner.cleanup()
        scheduler.shutdown(wait=False)
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())

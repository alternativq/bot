from __future__ import annotations

import datetime as dt
import logging

from aiogram import Bot
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select

from bot import texts
from db.database import get_session
from plans import get_plan

log = logging.getLogger(__name__)

REMINDER_WINDOW = dt.timedelta(days=2)


def utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


async def run_expiry_reminders(bot: Bot) -> None:
    """
    Раз в несколько часов проверяет все подписки (обычные и пробные — при
    ручной оплате автопродления не бывает вообще) и примерно за 2 дня до
    истечения шлёт разовое напоминание продлить вручную через меню тарифов.
    """
    from db.models import Subscription

    async with get_session() as session:
        due = await session.scalars(
            select(Subscription).where(
                Subscription.disabled.is_(False),
                Subscription.reminder_sent.is_(False),
                Subscription.period_end <= utcnow() + REMINDER_WINDOW,
                Subscription.period_end > utcnow(),
            )
        )
        due_subs = list(due)
        for sub in due_subs:
            sub.reminder_sent = True
        await session.commit()

    for sub in due_subs:
        plan = get_plan(sub.plan_id)
        try:
            if plan and plan.is_trial:
                text = texts.trial_ending_message(sub.period_end)
            else:
                plan_title = plan.title if plan else sub.plan_id
                text = texts.subscription_ending_message(plan_title, sub.period_end)
            await bot.send_message(sub.user_tg_id, text)
        except Exception:
            log.exception("Не удалось отправить напоминание пользователю %s", sub.user_tg_id)


def setup_scheduler(bot: Bot) -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(
        run_expiry_reminders,
        trigger="interval",
        hours=6,
        kwargs={"bot": bot},
        id="expiry_reminders",
        misfire_grace_time=3600,
    )
    return scheduler

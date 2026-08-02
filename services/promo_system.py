from __future__ import annotations

import re
from typing import Tuple

from sqlalchemy import select

from db.database import get_session
from db.models import PromoCode, PromoUsage, Referral, Subscription, User


def normalize_code(raw: str | None) -> str:
    if not raw:
        return ""
    return re.sub(r"\s+", "", raw).strip().lower()


def build_referral_code(tg_id: int) -> str:
    return str(tg_id)


def calculate_discounted_amount(amount_rub: int, discount_percent: int) -> int:
    if discount_percent <= 0:
        return amount_rub
    return max(0, amount_rub - int(amount_rub * discount_percent / 100))


def looks_like_promo_code(raw: str | None) -> bool:
    normalized = normalize_code(raw)
    if not normalized:
        return False
    if normalized.startswith("ref") and normalized[3:].isdigit():
        return True
    return bool(re.fullmatch(r"[a-z0-9]{3,24}", normalized))


async def ensure_referral_code(tg_id: int) -> str:
    code = build_referral_code(tg_id)
    async with get_session() as session:
        existing = await session.scalar(select(PromoCode).where(PromoCode.code == code))
        if existing is None:
            session.add(PromoCode(code=code, discount_percent=0, uses_left=None, is_active=True, created_by_tg_id=tg_id))
            await session.commit()
        return code


async def apply_code(tg_id: int, code: str) -> Tuple[bool, str]:
    normalized = normalize_code(code)
    if not normalized:
        return False, "Введите корректный промокод."
    if not looks_like_promo_code(normalized):
        return False, "Похоже, это не промокод."

    # Запрет использования собственного реферального кода
    if normalized == str(tg_id) or (normalized.startswith("ref") and normalized[3:] == str(tg_id)):
        return False, "Вы не можете использовать свой собственный реферальный код."

    async with get_session() as session:
        existing_usage = await session.scalar(
            select(PromoUsage).where(PromoUsage.user_tg_id == tg_id, PromoUsage.code == normalized)
        )
        if existing_usage is not None:
            return False, "Этот код уже использован ранее."

        promo = await session.scalar(select(PromoCode).where(PromoCode.code == normalized))

        if promo is not None and promo.created_by_tg_id == tg_id:
            return False, "Вы не можете использовать свой собственный реферальный код."

        if promo is None:
            inviter_tg_id = None
            if normalized.startswith("ref") and normalized[3:].isdigit():
                inviter_tg_id = int(normalized[3:])

            if inviter_tg_id is not None:
                if inviter_tg_id == tg_id:
                    return False, "Вы не можете использовать свой собственный реферальный код."

                owner = await session.get(User, inviter_tg_id)
                if owner is None:
                    return False, "Такого промокода не существует."

                ref_record = await session.scalar(
                    select(Referral).where(
                        Referral.inviter_tg_id == inviter_tg_id,
                        Referral.referred_tg_id == tg_id,
                    )
                )
                if ref_record is None:
                    session.add(Referral(inviter_tg_id=inviter_tg_id, referred_tg_id=tg_id))

                session.add(PromoCode(code=normalized, discount_percent=0, uses_left=None, is_active=True, created_by_tg_id=inviter_tg_id))
                session.add(PromoUsage(user_tg_id=tg_id, code=normalized, discount_percent=0, source="referral"))
                await session.commit()
                return True, "Реферальный код применён. При покупке подписки ваш пригласивший получит +5 дней бонусом."

            return False, "Такого промокода не существует."

        if not promo.is_active:
            return False, "Промокод больше недоступен."
        if promo.uses_left is not None and promo.uses_left <= 0:
            return False, "Промокод уже исчерпан."

        # Если это реферальный код
        if promo.created_by_tg_id is not None:
            inviter_tg_id = promo.created_by_tg_id
            if inviter_tg_id == tg_id:
                return False, "Вы не можете использовать свой собственный реферальный код."

            ref_record = await session.scalar(
                select(Referral).where(
                    Referral.inviter_tg_id == inviter_tg_id,
                    Referral.referred_tg_id == tg_id,
                )
            )
            if ref_record is None:
                session.add(Referral(inviter_tg_id=inviter_tg_id, referred_tg_id=tg_id))

            session.add(PromoUsage(user_tg_id=tg_id, code=normalized, discount_percent=0, source="referral"))
            await session.commit()
            return True, "Реферальный код применён. При покупке подписки ваш пригласивший получит +5 дней бонусом."

        # Административный промокод
        if promo.uses_left is not None:
            promo.uses_left -= 1

        b_days = getattr(promo, "bonus_days", 0) or 0
        if b_days > 0:
            import datetime as dt
            sub = await session.scalar(select(Subscription).where(Subscription.user_tg_id == tg_id))
            now = dt.datetime.now(dt.timezone.utc)
            if sub is not None:
                base = max(sub.period_end, now)
                sub.period_end = base + dt.timedelta(days=b_days)
            msg = f"Промокод применён! Вам добавлено +{b_days} дн. к подписке."
            if promo.discount_percent > 0:
                msg += f" И скидка {promo.discount_percent}% на следующую покупку."
        else:
            msg = f"Промокод применён. Скидка {promo.discount_percent}%."

        session.add(PromoUsage(user_tg_id=tg_id, code=normalized, discount_percent=promo.discount_percent, source="promo"))
        await session.commit()
        return True, msg


async def get_active_discount_for_user(tg_id: int) -> Tuple[str | None, int]:
    async with get_session() as session:
        usage = await session.scalar(
            select(PromoUsage).where(PromoUsage.user_tg_id == tg_id).order_by(PromoUsage.applied_at.desc())
        )
        if usage is None:
            return None, 0
        return usage.code, usage.discount_percent


async def grant_referral_bonus(inviter_tg_id: int, referred_tg_id: int, bonus_days: int = 5) -> None:
    async with get_session() as session:
        referral = await session.scalar(
            select(Referral).where(
                Referral.inviter_tg_id == inviter_tg_id,
                Referral.referred_tg_id == referred_tg_id,
            )
        )
        if referral is None:
            return
        if referral.reward_granted:
            return

        sub = await session.scalar(select(Subscription).where(Subscription.user_tg_id == inviter_tg_id))
        if sub is None:
            referral.reward_granted = True
            await session.commit()
            return

        sub.period_end = sub.period_end + __import__("datetime").timedelta(days=bonus_days)
        referral.reward_granted = True
        await session.commit()


async def get_promo_stats() -> dict[str, int]:
    async with get_session() as session:
        codes = await session.scalars(select(PromoCode))
        referrals = await session.scalars(select(Referral))
        usages = await session.scalars(select(PromoUsage))
        return {
            "codes": len(list(codes)),
            "referrals": len(list(referrals)),
            "usages": len(list(usages)),
        }

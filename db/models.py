from __future__ import annotations

import datetime as dt

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, JSON, String, TypeDecorator
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


def utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class UTCDateTime(TypeDecorator):
    """
    DateTime(timezone=True) в SQLite на практике не хранит tzinfo и при
    чтении отдаёт naive datetime — сравнение с tz-aware utcnow() падает с
    TypeError. Этот тип всегда хранит naive UTC внутри БД и всегда отдаёт
    приложению aware-UTC datetime, независимо от диалекта (SQLite/Postgres).
    """
    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: dt.datetime | None, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=dt.timezone.utc)
        return value.astimezone(dt.timezone.utc).replace(tzinfo=None)

    def process_result_value(self, value: dt.datetime | None, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=dt.timezone.utc)
        return value.astimezone(dt.timezone.utc)


class User(Base):
    __tablename__ = "users"

    tg_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    username: Mapped[str | None] = mapped_column(String(64), nullable=True)
    trial_used: Mapped[bool] = mapped_column(Boolean, default=False)  # пробный период выдаётся один раз
    created_at: Mapped[dt.datetime] = mapped_column(UTCDateTime, default=utcnow)


class Subscription(Base):
    """
    Одна активная подписка на пользователя. При покупке нового периода
    существующая подписка продлевается (period_end сдвигается), а не
    создаётся новая — так у пользователя всегда один ключ/ссылка.
    """
    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_tg_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.tg_id"), unique=True)

    plan_id: Mapped[str] = mapped_column(String(32))
    xui_uuid: Mapped[str] = mapped_column(String(64))     # credential-uuid клиента в панели
    # {inbound_id (строкой): sub_id} — одна ссылка-подписка панели /sub/{sub_id}
    xui_sub_ids: Mapped[dict] = mapped_column(JSON, default=dict)
    # случайный токен для ЕДИНОЙ агрегированной ссылки-подписки (sub_server.py),
    # стабилен на весь срок жизни подписки, не меняется при продлении
    public_token: Mapped[str] = mapped_column(String(48), unique=True, index=True)

    period_end: Mapped[dt.datetime] = mapped_column(UTCDateTime, index=True)

    disabled: Mapped[bool] = mapped_column(Boolean, default=False, index=True)  # принудительно отключена вручную
    reminder_sent: Mapped[bool] = mapped_column(Boolean, default=False)  # напоминание об истечении уже отправлено

    created_at: Mapped[dt.datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[dt.datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    def is_active(self) -> bool:
        return not self.disabled and self.period_end > utcnow()


class PendingPayment(Base):
    """
    Заявка на ручную оплату: пользователь выбрал способ и нажал "Я оплатил",
    администратор подтверждает или отклоняет кнопкой в чате с ботом.
    """
    __tablename__ = "pending_payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_tg_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.tg_id"), index=True)
    plan_id: Mapped[str] = mapped_column(String(32))
    method_id: Mapped[str] = mapped_column(String(32))
    order_code: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    promo_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    discount_percent: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(16), default="pending", index=True)  # pending / confirmed / rejected
    created_at: Mapped[dt.datetime] = mapped_column(UTCDateTime, default=utcnow)
    resolved_at: Mapped[dt.datetime | None] = mapped_column(UTCDateTime, nullable=True)
    resolved_by: Mapped[int | None] = mapped_column(BigInteger, nullable=True)  # tg_id админа


class PaymentRecord(Base):
    """История платежей — используется в том числе для идемпотентности
    ручных подтверждений (повторное подтверждение той же заявки не задвоится)."""
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # "manual:<order_code>" для ручных оплат или "trial:<tg_id>" для пробного периода
    external_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    provider: Mapped[str] = mapped_column(String(16))  # manual / trial
    user_tg_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.tg_id"), index=True)
    plan_id: Mapped[str] = mapped_column(String(32))
    amount_rub: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[dt.datetime] = mapped_column(UTCDateTime, default=utcnow)


class PromoCode(Base):
    __tablename__ = "promo_codes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    discount_percent: Mapped[int] = mapped_column(Integer, default=10)
    bonus_days: Mapped[int] = mapped_column(Integer, default=0)
    uses_left: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by_tg_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(UTCDateTime, default=utcnow)


class PromoUsage(Base):
    __tablename__ = "promo_usage"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_tg_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.tg_id"), index=True)
    code: Mapped[str] = mapped_column(String(64), index=True)
    discount_percent: Mapped[int] = mapped_column(Integer, default=0)
    source: Mapped[str] = mapped_column(String(16), default="promo")
    applied_at: Mapped[dt.datetime] = mapped_column(UTCDateTime, default=utcnow)


class Referral(Base):
    __tablename__ = "referrals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    inviter_tg_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.tg_id"), index=True)
    referred_tg_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.tg_id"), index=True)
    reward_granted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[dt.datetime] = mapped_column(UTCDateTime, default=utcnow)

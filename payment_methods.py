"""
Способы ручной оплаты (без эквайринга). Пользователь переводит деньги сам
по этим реквизитам, дальше вручную подтверждаете оплату кнопкой в боте.

Список формируется динамически из .env — если реквизит не заполнен,
способ просто не появится в боте. Если понадобится третий способ —
достаточно добавить новую запись сюда и соответствующую настройку в config.py.
"""
from __future__ import annotations

from dataclasses import dataclass

from config import settings


@dataclass(frozen=True)
class PaymentMethod:
    id: str
    title: str          # короткое название на кнопке
    requisite_label: str  # подпись перед реквизитом, например "Кошелёк ЮMoney"
    requisite: str       # сам номер кошелька/карты/телефона


def get_payment_methods() -> list[PaymentMethod]:
    methods: list[PaymentMethod] = []

    if settings.YOOMONEY_WALLET:
        methods.append(
            PaymentMethod(
                id="yoomoney_auto",
                title="💳 SberPay / Карта РФ (авто)",
                requisite_label="Автоматическая выдача ключа",
                requisite="Оплата картой любого банка РФ / ЮMoney 24/7",
            )
        )

    if settings.CRYPTO_PAY_TOKEN:
        methods.append(
            PaymentMethod(
                id="cryptobot",
                title="💎 CryptoBot (USDT / TON)",
                requisite_label="Оплата в CryptoBot",
                requisite="Мгновенная оплата в @CryptoBot без минималок",
            )
        )



    if settings.OZON_REQUISITE:
        methods.append(
            PaymentMethod(
                id="ozon",
                title="Карта Ozon Банк",
                requisite_label="Перевод на карту Ozon Банк",
                requisite=settings.OZON_REQUISITE,
            )
        )

    return methods


def get_payment_method(method_id: str) -> PaymentMethod | None:
    for method in get_payment_methods():
        if method.id == method_id:
            return method
    return None

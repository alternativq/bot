"""
Тарифы. Правьте под себя — цены, сроки, лимиты трафика/устройств.

Инбаунды больше не указываются вручную — при выдаче/продлении ключа клиент
автоматически подключается КО ВСЕМ инбаундам, которые сейчас есть в вашей
3x-ui панели (список запрашивается через API в момент выдачи). Если позже
добавите новый инбаунд в панели — новые покупки и продления его подхватят
сами, без правки этого файла.
"""
from __future__ import annotations

from dataclasses import dataclass

from config import settings


@dataclass(frozen=True)
class Plan:
    id: str
    title: str
    price_rub: int
    duration_days: int
    total_gb: int = 0        # 0 = безлимит трафика
    limit_ip: int = 0        # 0 = без ограничения одновременных подключений
    flow: str = "xtls-rprx-vision"  # для VLESS+Reality; для остальных протоколов не используется
    is_trial: bool = False   # пробный период — бесплатный, доступен один раз на пользователя

    @property
    def price_usdt(self) -> float:
        if self.is_trial or self.price_rub <= 0:
            return 0.0
        # Конвертация рубль -> USDT по курсу ~95 ₽ за 1 USDT
        return round(max(0.5, self.price_rub / 95.0), 2)


PLANS: dict[str, Plan] = {
    "m1": Plan(
        id="m1",
        title="1 месяц",
        price_rub=199,
        duration_days=30,
        limit_ip=1,
    ),
    "m1-3": Plan(
        id="m1-3",
        title="1 месяц · 3 устройства",
        price_rub=299,
        duration_days=30,
        limit_ip=3,
    ),
    "m1-5": Plan(
        id="m1-5",
        title="1 месяц · 5 устройств",
        price_rub=399,
        duration_days=30,
        limit_ip=5,
    ),
    "m1-7": Plan(
        id="m1-7",
        title="1 месяц · 7 устройств",
        price_rub=499,
        duration_days=30,
        limit_ip=7,
    ),
    "m3": Plan(
        id="m3",
        title="3 месяца",
        price_rub=499,
        duration_days=90,
        limit_ip=1,
    ),
    "m3-3": Plan(
        id="m3-3",
        title="3 месяца · 3 устройства",
        price_rub=699,
        duration_days=90,
        limit_ip=3,
    ),
    "m3-5": Plan(
        id="m3-5",
        title="3 месяца · 5 устройств",
        price_rub=899,
        duration_days=90,
        limit_ip=5,
    ),
    "m3-7": Plan(
        id="m3-7",
        title="3 месяца · 7 устройств",
        price_rub=1099,
        duration_days=90,
        limit_ip=7,
    ),
    "m12": Plan(
        id="m12",
        title="12 месяцев",
        price_rub=1690,
        duration_days=365,
        limit_ip=1,
    ),
    "m12-3": Plan(
        id="m12-3",
        title="12 месяцев · 3 устройства",
        price_rub=2290,
        duration_days=365,
        limit_ip=3,
    ),
    "m12-5": Plan(
        id="m12-5",
        title="12 месяцев · 5 устройств",
        price_rub=2890,
        duration_days=365,
        limit_ip=5,
    ),
    "m12-7": Plan(
        id="m12-7",
        title="12 месяцев · 7 устройств",
        price_rub=3490,
        duration_days=365,
        limit_ip=7,
    ),
}

# Пробный тариф добавляется в список отдельно, чтобы им нельзя было
# случайно "накинуть" себе платный период — обрабатывается особым путём
# в bot/handlers.py (без выбора способа оплаты, сразу выдаёт ключ один раз).
TRIAL_PLAN = Plan(
    id="trial",
    title=f"Пробный период ({settings.TRIAL_DURATION_DAYS} дн.)",
    price_rub=0,
    duration_days=settings.TRIAL_DURATION_DAYS,
    is_trial=True,
)

ALL_PLANS: dict[str, Plan] = {**PLANS, TRIAL_PLAN.id: TRIAL_PLAN}


def get_plan(plan_id: str) -> Plan | None:
    return ALL_PLANS.get(plan_id)

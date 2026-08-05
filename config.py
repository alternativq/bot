"""
Настройки приложения. Все значения читаются из .env (см. .env.example).
"""
from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


def find_env_file(start_dir: Path | None = None) -> Path | None:
    base = (start_dir or Path(__file__).resolve().parent).resolve()
    for current in [base, *base.parents]:
        candidate = current / ".env"
        if candidate.is_file():
            return candidate
    return None


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=find_env_file(),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Telegram
    BOT_TOKEN: str = ""
    BOT_USERNAME: str = ""
    ADMIN_IDS: str = ""
    # если api.telegram.org недоступен напрямую (блокировка/DPI у провайдера) -
    # укажите прокси в формате protocol://[user:pass@]host:port
    # protocol: http, socks4, socx4a или socks5
    BOT_PROXY_URL: str = ""

    # DB
    DATABASE_URL: str = "sqlite+aiosqlite:///./bot.db"

    # --- Ручная оплата (без эквайринга): пользователь переводит сам, вы
    # подтверждаете вручную кнопкой в боте. Можно настроить любой набор
    # способов ниже — какие заполните, те и появятся в боте. ---
    PAYMENT_RECIPIENT_NAME: str = ""   # ФИО получателя, показывается во всех способах

    YOOMONEY_WALLET: str = ""          # номер кошелька ЮMoney, например 4100XXXXXXXXXXXX
    YOOMONEY_SECRET: str = ""          # секретный ключ для проверки HTTP-уведомлений ЮMoney
    OZON_REQUISITE: str = ""           # номер карты Ozon Банк или телефон для перевода по СБП

    # CryptoBot (@CryptoBot / CryptoPay)
    CRYPTO_PAY_TOKEN: str = ""         # API токен CryptoPay от @CryptoBot (раздел Crypto Pay -> My Apps)

    # 3x-ui
    XUI_HOST: str = ""
    XUI_USERNAME: str = ""
    XUI_PASSWORD: str = ""
    XUI_TOKEN: str = ""
    # id инбаунда, в котором создаётся клиент (0 = первый инбаунд из панели)
    XUI_INBOUND_ID: int = 0
    # base32-секрет 2FA панели (та строка под QR-кодом при включении 2FA в
    # Settings -> Access -> Two-Factor Authentication). Нужен, только если
    # в панели включена двухфакторная аутентификация и XUI_TOKEN не задан.
    XUI_TOTP_SECRET: str = ""

    # Subscription-сервис 3x-ui
    SUB_DOMAIN: str = ""
    SUB_PORT: int = 2096
    SUB_PATH: str = "/sub/"
    SUB_TLS: bool = True
    # у панели часто самоподписанный сертификат на порту подписки - проверять
    # его или нет при АГРЕГАЦИИ (см. ниже), никак не влияет на ссылку для юзера
    SUB_FETCH_VERIFY_TLS: bool = False

    # --- Единая подписка на все инбаунды (опционально) ---
    # Начиная с 3x-ui 3.2.5 панель не даёт нативно объединить несколько
    # инбаундов в одну ссылку (subId обязан быть уникален у каждого клиента).
    # Если хотите ОДНУ ссылку вместо нескольких - поднимите у себя небольшой
    # HTTP-сервер (см. sub_server.py и README), который сам склеивает уже
    # готовые конфиги из нативных /sub/... в одну подписку, и укажите здесь
    # публичный адрес, по которому он будет доступен снаружи (через nginx).
    # Если оставить пустым - пользователь получит несколько ссылок (по одной
    # на инбаунд), это тоже полностью рабочий вариант, просто менее удобный.
    PUBLIC_SUB_BASE_URL: str = ""   # например https://ваш-домен.ru/mysub
    SUB_SERVER_HOST: str = "0.0.0.0"
    SUB_SERVER_PORT: int = 8081
    # имя, которое клиент (Happ и т.п.) покажет как название подписки
    # (без этого некоторые приложения показывают домен вместо названия)
    BRAND_NAME: str = "VeiloraVPN"
    # как часто клиент должен сам обновлять список серверов (часы)
    SUB_UPDATE_INTERVAL_HOURS: int = 12

    # Mini App
    MINIAPP_URL: str = ""       # URL где развёрнут фронтенд Mini App (для CORS)
    JWT_SECRET: str = ""        # секрет для JWT; если пуст — используется BOT_TOKEN

    # Пробный период и лимиты
    TRIAL_ENABLED: bool = True
    TRIAL_DURATION_DAYS: int = 2
    MAX_SUBSCRIPTION_DAYS: int = 100

    @property
    def admin_ids(self) -> list[int]:
        return [int(x) for x in self.ADMIN_IDS.split(",") if x.strip()]

    @property
    def webapp_url(self) -> str:
        if self.MINIAPP_URL:
            return self.MINIAPP_URL
        if self.PUBLIC_SUB_BASE_URL:
            return self.PUBLIC_SUB_BASE_URL.rstrip('/')
        return "https://t.me"

    @property
    def unified_subscription_enabled(self) -> bool:
        return bool(self.PUBLIC_SUB_BASE_URL)


settings = Settings()  # type: ignore[call-arg]  # значения приходят из .env

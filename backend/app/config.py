from typing import List
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_INSECURE_JWT_DEFAULTS = {
    "change-this-secret-key-in-production",
    "dev-secret-key-replace-in-production-minimum-32-chars",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",  # ignore unknown keys in .env (safe for local tweaks)
    )

    # App
    APP_NAME: str = "Divya Luxury Seafoods API"
    DEBUG: bool = False

    # Database
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "divyafoods"

    # JWT
    JWT_SECRET_KEY: str = "change-this-secret-key-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS — frontend origins allowed to call this API
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://divya-foods.vercel.app",
    ]

    # Public site URL — used to build absolute links in the sitemap (products/categories
    # are only known to this API; the frontend is a separate static SPA deployment)
    FRONTEND_URL: str = "https://divya-foods.vercel.app"

    # Cloudinary — image CDN
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    # Razorpay — payment gateway
    # Same variable names work for both TEST and LIVE mode — Razorpay encodes the
    # mode into the key itself (rzp_test_... vs rzp_live_...), so switching to
    # production is just swapping these three values in the environment, no code
    # change needed. RAZORPAY_WEBHOOK_SECRET comes from the separate webhook
    # config in the Razorpay dashboard (Settings → Webhooks), not the API keys.
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""

    # SMTP Email
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = "salesdivyafoods@gmail.com"
    # Where new-order alerts and contact-form submissions are sent. Defaults to
    # the same shared business inbox as EMAIL_FROM — override if the owner
    # wants operational alerts routed somewhere else.
    ADMIN_NOTIFICATION_EMAIL: str = "salesdivyafoods@gmail.com"

    # Web Push (VAPID)
    VAPID_PUBLIC_KEY: str = ""
    VAPID_PRIVATE_KEY: str = ""
    VAPID_EMAIL: str = "mailto:salesdivyafoods@gmail.com"

    # AI Chat
    ANTHROPIC_API_KEY: str = ""

    @model_validator(mode="after")
    def _reject_insecure_jwt_secret_in_production(self) -> "Settings":
        """
        DEBUG=False means this is a real deployment. Refuse to boot rather than
        silently sign tokens with a known placeholder — anyone who has read the
        source (or this file) could forge a valid JWT against a live deployment
        that forgot to set JWT_SECRET_KEY.
        """
        if not self.DEBUG:
            if self.JWT_SECRET_KEY in _INSECURE_JWT_DEFAULTS:
                raise ValueError(
                    "JWT_SECRET_KEY is still a placeholder default. Set a real "
                    "secret (openssl rand -hex 32) in the production environment."
                )
            if len(self.JWT_SECRET_KEY) < 32:
                raise ValueError(
                    "JWT_SECRET_KEY is too short for production use (need >= 32 "
                    "characters). Set a stronger secret (openssl rand -hex 32)."
                )
        return self


settings = Settings()

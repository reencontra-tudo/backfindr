from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Backfindr"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://backfindr:backfindr_dev_pass@localhost:5432/backfindr"

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # Auth
    SECRET_KEY: str = "dev-secret-key-change-in-production-minimum-32-chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # CORS
    CORS_ORIGINS: str = '["http://localhost:3000","http://localhost:8081","http://localhost:19006"]'

    # Storage
    STORAGE_BACKEND: str = "local"  # local | r2
    LOCAL_UPLOAD_DIR: str = "uploads"
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY: str = ""
    R2_SECRET_KEY: str = ""
    R2_BUCKET: str = ""
    R2_PUBLIC_URL: str = ""

    # Push (VAPID)
    VAPID_PRIVATE_KEY: str = ""
    VAPID_PUBLIC_KEY: str = ""
    VAPID_CLAIMS_EMAIL: str = "admin@backfindr.com"

    # App URL
    APP_URL: str = "http://localhost:3000"

    def get_cors_origins(self) -> List[str]:
        try:
            return json.loads(self.CORS_ORIGINS)
        except Exception:
            return [self.CORS_ORIGINS]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

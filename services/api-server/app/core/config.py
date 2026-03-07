from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_ignore_empty=True, extra="ignore")

    app_name: str = "aibidder-api"
    env: str = "dev"
    database_url: str | None = None
    postgres_db: str = "aibidder"
    postgres_user: str = "aibidder"
    postgres_password: str = "aibidder"
    postgres_host: str | None = None
    postgres_port: int = 5432
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 120
    storage_root: str = "./storage"
    model_provider: str = "openai_compatible"
    default_model_name: str = "gpt-4.1-mini"
    model_api_base_url: str | None = None
    model_api_key: str | None = None

    @model_validator(mode="after")
    def assemble_database_url(self) -> "Settings":
        if not self.database_url:
            if self.postgres_host:
                self.database_url = (
                    f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
                    f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
                )
            else:
                self.database_url = "sqlite:///./aibidder.db"
        return self


settings = Settings()

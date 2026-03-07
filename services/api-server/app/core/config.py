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
    cors_allowed_origins: str = (
        "http://localhost:3000,"
        "http://127.0.0.1:3000,"
        "http://localhost:13000,"
        "http://127.0.0.1:13000"
    )
    model_provider: str = "openai_compatible"
    default_model_name: str = "gpt-4.1-mini"
    model_api_base_url: str | None = None
    model_api_key: str | None = None
    runtime_provider: str = "openai_compatible"
    runtime_api_base_url: str = "https://api.siliconflow.cn/v1"
    runtime_api_key: str | None = None
    ocr_role_model: str = "deepseek-ai/DeepSeek-OCR"
    decomposition_navigator_role_model: str = "deepseek-ai/DeepSeek-V3.2"
    decomposition_extractor_role_model: str = "Qwen/Qwen3-30B-A3B-Instruct-2507"
    writer_role_model: str = "deepseek-ai/DeepSeek-V3"
    reviewer_role_model: str = "deepseek-ai/DeepSeek-R1"
    adjudicator_role_model: str = "deepseek-ai/DeepSeek-R1"

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

    def runtime_default_models(self) -> dict[str, str]:
        return {
            "ocr_role": self.ocr_role_model,
            "decomposition_navigator_role": self.decomposition_navigator_role_model,
            "decomposition_extractor_role": self.decomposition_extractor_role_model,
            "writer_role": self.writer_role_model,
            "reviewer_role": self.reviewer_role_model,
            "adjudicator_role": self.adjudicator_role_model,
        }

    def cors_allowed_origins_list(self) -> list[str]:
        return [item.strip() for item in self.cors_allowed_origins.split(",") if item.strip()]


settings = Settings()

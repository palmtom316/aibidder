from pydantic import BaseModel, ConfigDict


class RuntimeModelDefaults(BaseModel):
    ocr_role: str
    decomposition_navigator_role: str
    decomposition_extractor_role: str
    writer_role: str
    reviewer_role: str
    adjudicator_role: str


class RuntimeSettingsResponse(BaseModel):
    provider: str
    api_base_url: str | None
    api_key_configured: bool
    cors_allowed_origins: list[str]
    default_models: RuntimeModelDefaults


class ConnectivityCheckRequest(BaseModel):
    provider: str
    api_base_url: str
    api_key: str
    model: str


class ConnectivityCheckResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ok: bool
    provider: str
    api_base_url: str
    model: str
    status_code: int | None = None
    message: str

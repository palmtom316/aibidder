from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps.auth import get_current_user
from app.core.config import settings
from app.schemas.auth import UserIdentity
from app.schemas.runtime_settings import (
    ConnectivityCheckRequest,
    ConnectivityCheckResult,
    RuntimeModelDefaults,
    RuntimeSettingsResponse,
)
from app.services.runtime_connectivity import probe_connectivity

router = APIRouter(prefix="/api/v1/runtime-settings", tags=["runtime-settings"])


@router.get("", response_model=RuntimeSettingsResponse)
def get_runtime_settings(current_user: UserIdentity = Depends(get_current_user)) -> RuntimeSettingsResponse:
    _ = current_user
    return RuntimeSettingsResponse(
        provider=settings.runtime_provider,
        api_base_url=settings.runtime_api_base_url,
        api_key_configured=bool(settings.runtime_api_key),
        cors_allowed_origins=settings.cors_allowed_origins_list(),
        default_models=RuntimeModelDefaults(**settings.runtime_default_models()),
    )


@router.post("/connectivity-check", response_model=ConnectivityCheckResult)
async def connectivity_check(
    payload: ConnectivityCheckRequest,
    current_user: UserIdentity = Depends(get_current_user),
) -> ConnectivityCheckResult:
    _ = current_user
    try:
        return await probe_connectivity(
            provider=payload.provider,
            api_base_url=payload.api_base_url,
            api_key=payload.api_key,
            model=payload.model,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

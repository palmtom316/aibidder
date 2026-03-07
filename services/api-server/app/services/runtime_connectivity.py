from http import HTTPStatus

import httpx

from app.schemas.runtime_settings import ConnectivityCheckResult

SUPPORTED_PROVIDER = "openai_compatible"


async def probe_connectivity(
    *,
    provider: str,
    api_base_url: str,
    api_key: str,
    model: str,
) -> ConnectivityCheckResult:
    if provider != SUPPORTED_PROVIDER:
        raise ValueError(f"Unsupported provider: {provider}")

    models_url = f"{api_base_url.rstrip('/')}/models"
    headers = {"Authorization": f"Bearer {api_key}"}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(models_url, headers=headers)
    except httpx.HTTPError as exc:
        return ConnectivityCheckResult(
            ok=False,
            provider=provider,
            api_base_url=api_base_url,
            model=model,
            message=str(exc),
        )

    message = _extract_message(response)
    if response.status_code != HTTPStatus.OK:
        return ConnectivityCheckResult(
            ok=False,
            provider=provider,
            api_base_url=api_base_url,
            model=model,
            status_code=response.status_code,
            message=message,
        )

    payload = response.json()
    model_ids = {
        item.get("id")
        for item in payload.get("data", [])
        if isinstance(item, dict) and isinstance(item.get("id"), str)
    }
    if model not in model_ids:
        return ConnectivityCheckResult(
            ok=False,
            provider=provider,
            api_base_url=api_base_url,
            model=model,
            status_code=response.status_code,
            message=f"Model not found in provider catalog: {model}",
        )

    return ConnectivityCheckResult(
        ok=True,
        provider=provider,
        api_base_url=api_base_url,
        model=model,
        status_code=response.status_code,
        message="Model is reachable",
    )


def _extract_message(response: httpx.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        return response.text or response.reason_phrase

    if isinstance(payload, dict):
        error = payload.get("error")
        if isinstance(error, dict):
            detail = error.get("message")
            if isinstance(detail, str) and detail:
                return detail
        message = payload.get("message")
        if isinstance(message, str) and message:
            return message

    return response.text or response.reason_phrase

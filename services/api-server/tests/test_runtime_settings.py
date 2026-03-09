from fastapi.testclient import TestClient

from app.main import app


def _login(email: str = "admin@example.com", password: str = "admin123456") -> str:
    client = TestClient(app)
    response = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def test_runtime_settings_returns_debug_defaults() -> None:
    client = TestClient(app)
    token = _login()

    response = client.get(
        "/api/v1/runtime-settings",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["provider"] == "openai_compatible"
    assert payload["api_base_url"] == "https://api.siliconflow.cn/v1"
    assert payload["api_key_configured"] is False
    assert payload["default_models"] == {
        "ocr_role": "deepseek-ai/DeepSeek-OCR",
        "decomposition_navigator_role": "deepseek-ai/DeepSeek-V3.2",
        "decomposition_extractor_role": "Qwen/Qwen3-30B-A3B-Instruct-2507",
        "writer_role": "deepseek-ai/DeepSeek-V3",
        "reviewer_role": "deepseek-ai/DeepSeek-R1",
        "adjudicator_role": "deepseek-ai/DeepSeek-R1",
    }
    assert payload["platform_config"] == {
        "provider": "openai_compatible",
        "api_base_url": "https://api.siliconflow.cn/v1",
        "api_key_configured": False,
    }
    assert payload["role_configs"] == {
        "ocr_role": {
            "api_base_url": "https://api.siliconflow.cn/v1",
            "api_key_configured": False,
            "model": "deepseek-ai/DeepSeek-OCR",
        },
        "decomposition_navigator_role": {
            "api_base_url": "https://api.siliconflow.cn/v1",
            "api_key_configured": False,
            "model": "deepseek-ai/DeepSeek-V3.2",
        },
        "decomposition_extractor_role": {
            "api_base_url": "https://api.siliconflow.cn/v1",
            "api_key_configured": False,
            "model": "Qwen/Qwen3-30B-A3B-Instruct-2507",
        },
        "writer_role": {
            "api_base_url": "https://api.siliconflow.cn/v1",
            "api_key_configured": False,
            "model": "deepseek-ai/DeepSeek-V3",
        },
        "reviewer_role": {
            "api_base_url": "https://api.siliconflow.cn/v1",
            "api_key_configured": False,
            "model": "deepseek-ai/DeepSeek-R1",
        },
        "adjudicator_role": {
            "api_base_url": "https://api.siliconflow.cn/v1",
            "api_key_configured": False,
            "model": "deepseek-ai/DeepSeek-R1",
        },
    }


def test_connectivity_check_validates_selected_model(monkeypatch) -> None:
    from app.api.routes import runtime_settings
    from app.schemas.runtime_settings import ConnectivityCheckResult

    async def fake_probe(*, provider: str, api_base_url: str, api_key: str, model: str) -> ConnectivityCheckResult:
        assert provider == "openai_compatible"
        assert api_base_url == "https://api.siliconflow.cn/v1"
        assert api_key == "test-key"
        assert model == "deepseek-ai/DeepSeek-V3"
        return ConnectivityCheckResult(
            ok=True,
            provider=provider,
            api_base_url=api_base_url,
            model=model,
            status_code=200,
            message="Model is reachable",
        )

    monkeypatch.setattr(runtime_settings, "probe_connectivity", fake_probe)

    client = TestClient(app)
    token = _login()
    response = client.post(
        "/api/v1/runtime-settings/connectivity-check",
        json={
            "provider": "openai_compatible",
            "api_base_url": "https://api.siliconflow.cn/v1",
            "api_key": "test-key",
            "model": "deepseek-ai/DeepSeek-V3",
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "provider": "openai_compatible",
        "api_base_url": "https://api.siliconflow.cn/v1",
        "model": "deepseek-ai/DeepSeek-V3",
        "status_code": 200,
        "message": "Model is reachable",
    }


def test_cors_allows_localhost_origins_on_any_port() -> None:
    client = TestClient(app)

    for origin in ("http://127.0.0.1:3202", "http://localhost:3202"):
        response = client.options(
            "/api/v1/auth/login",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )

        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") == origin
        assert response.headers.get("access-control-allow-credentials") == "true"

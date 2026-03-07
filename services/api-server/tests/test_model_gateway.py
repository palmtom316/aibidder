from app.core.config import Settings
from app.core.model_gateway import (
    ModelGateway,
    ModelGatewayRequest,
    OpenAICompatibleProvider,
    build_model_gateway,
)


def test_tenant_credentials_override_provider_defaults() -> None:
    provider = OpenAICompatibleProvider(
        model="gpt-4o-mini",
        base_url="https://default.example/v1",
        api_key="global-key",
    )
    gateway = ModelGateway(provider=provider)

    prepared = gateway.prepare(
        ModelGatewayRequest(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": "Write a short summary"}],
        ),
        tenant_credentials={
            "api_key": "tenant-key",
            "base_url": "https://tenant.example/v1",
        },
    )

    assert prepared.credentials.api_key == "tenant-key"
    assert prepared.credentials.base_url == "https://tenant.example/v1"
    assert prepared.payload["model"] == "gpt-4o-mini"


def test_prepare_emits_redacted_audit_event() -> None:
    events = []
    provider = OpenAICompatibleProvider(
        model="gpt-4o-mini",
        base_url="https://default.example/v1",
        api_key="global-key",
    )
    gateway = ModelGateway(
        provider=provider,
        audit_sink=events.append,
        redaction_hook=lambda text: text.replace("secret", "[REDACTED]"),
    )

    gateway.prepare(
        ModelGatewayRequest(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": "Use the secret bid template"}],
            organization_id=7,
            request_id="req-123",
            metadata={"section": "technical-proposal"},
        )
    )

    assert len(events) == 1
    event = events[0]
    assert event.provider == "openai_compatible"
    assert event.organization_id == 7
    assert event.request_id == "req-123"
    assert event.metadata == {"section": "technical-proposal"}
    assert event.messages == [{"role": "user", "content": "Use the [REDACTED] bid template"}]


def test_build_model_gateway_uses_settings_defaults() -> None:
    settings = Settings(
        model_provider="openai_compatible",
        default_model_name="gpt-4.1-mini",
        model_api_base_url="https://models.example/v1",
        model_api_key="settings-key",
    )

    gateway = build_model_gateway(settings)
    prepared = gateway.prepare(
        ModelGatewayRequest(messages=[{"role": "user", "content": "Draft section 1"}])
    )

    assert prepared.provider == "openai_compatible"
    assert prepared.model == "gpt-4.1-mini"
    assert prepared.credentials.api_key == "settings-key"
    assert prepared.credentials.base_url == "https://models.example/v1"

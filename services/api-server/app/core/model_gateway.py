from dataclasses import dataclass, field
from typing import Any, Callable, Mapping

from app.core.config import Settings

RedactionHook = Callable[[str], str]
AuditSink = Callable[["ModelGatewayAuditEvent"], None]


@dataclass(frozen=True)
class ProviderCredentials:
    api_key: str | None = None
    base_url: str | None = None


@dataclass(frozen=True)
class ModelGatewayRequest:
    model: str | None = None
    messages: list[dict[str, Any]] = field(default_factory=list)
    organization_id: int | None = None
    request_id: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ModelGatewayAuditEvent:
    provider: str
    model: str
    organization_id: int | None
    request_id: str | None
    metadata: dict[str, Any]
    messages: list[dict[str, Any]]


@dataclass(frozen=True)
class PreparedModelCall:
    provider: str
    model: str
    credentials: ProviderCredentials
    payload: dict[str, Any]
    audit_event: ModelGatewayAuditEvent


class OpenAICompatibleProvider:
    name = "openai_compatible"

    def __init__(self, model: str, base_url: str | None = None, api_key: str | None = None) -> None:
        self.model = model
        self.base_url = base_url
        self.api_key = api_key

    def resolve_credentials(self, tenant_credentials: Mapping[str, str] | None = None) -> ProviderCredentials:
        tenant_credentials = tenant_credentials or {}
        return ProviderCredentials(
            api_key=tenant_credentials.get("api_key", self.api_key),
            base_url=tenant_credentials.get("base_url", self.base_url),
        )

    def resolve_model(self, request: ModelGatewayRequest) -> str:
        return request.model or self.model

    def build_payload(self, request: ModelGatewayRequest) -> dict[str, Any]:
        return {
            "model": self.resolve_model(request),
            "messages": [message.copy() for message in request.messages],
        }


class ModelGateway:
    def __init__(
        self,
        provider: OpenAICompatibleProvider,
        audit_sink: AuditSink | None = None,
        redaction_hook: RedactionHook | None = None,
    ) -> None:
        self.provider = provider
        self.audit_sink = audit_sink
        self.redaction_hook = redaction_hook or (lambda text: text)

    def prepare(
        self,
        request: ModelGatewayRequest,
        tenant_credentials: Mapping[str, str] | None = None,
    ) -> PreparedModelCall:
        payload = self.provider.build_payload(request)
        model = payload["model"]
        credentials = self.provider.resolve_credentials(tenant_credentials)
        audit_event = ModelGatewayAuditEvent(
            provider=self.provider.name,
            model=model,
            organization_id=request.organization_id,
            request_id=request.request_id,
            metadata=request.metadata.copy(),
            messages=self._redact_messages(request.messages),
        )

        if self.audit_sink is not None:
            self.audit_sink(audit_event)

        return PreparedModelCall(
            provider=self.provider.name,
            model=model,
            credentials=credentials,
            payload=payload,
            audit_event=audit_event,
        )

    def _redact_messages(self, messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
        redacted_messages: list[dict[str, Any]] = []
        for message in messages:
            redacted_message = message.copy()
            content = redacted_message.get("content")
            if isinstance(content, str):
                redacted_message["content"] = self.redaction_hook(content)
            redacted_messages.append(redacted_message)
        return redacted_messages


def build_model_gateway(settings: Settings) -> ModelGateway:
    if settings.model_provider != OpenAICompatibleProvider.name:
        raise ValueError(f"Unsupported model provider: {settings.model_provider}")

    provider = OpenAICompatibleProvider(
        model=settings.default_model_name,
        base_url=settings.model_api_base_url,
        api_key=settings.model_api_key,
    )
    return ModelGateway(provider=provider)

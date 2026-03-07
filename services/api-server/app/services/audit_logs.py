import json

from fastapi import Request
from sqlalchemy.orm import Session

from app.db.models import AuditLog
from app.schemas.auth import UserIdentity


def client_ip_from_request(request: Request | None) -> str:
    if request is None:
        return ""
    forwarded_for = request.headers.get("X-Forwarded-For", "").strip()
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return ""


def request_id_from_request(request: Request | None) -> str:
    if request is None:
        return ""
    return getattr(request.state, "request_id", "") or request.headers.get("X-Request-ID", "")


def record_audit_log(
    db: Session,
    *,
    action: str,
    entity_type: str = "system",
    entity_id: int | str | None = None,
    current_user: UserIdentity | None = None,
    actor_email: str | None = None,
    organization_id: int | None = None,
    project_id: int | None = None,
    document_id: int | None = None,
    status: str = "success",
    request: Request | None = None,
    details: dict | None = None,
) -> AuditLog:
    log = AuditLog(
        organization_id=organization_id if organization_id is not None else getattr(current_user, "organization_id", None),
        user_id=getattr(current_user, "id", None),
        project_id=project_id,
        document_id=document_id,
        actor_email=actor_email or getattr(current_user, "email", "") or "",
        action=action,
        resource_type=entity_type,
        resource_id=str(entity_id or ""),
        status=status,
        request_id=request_id_from_request(request),
        ip_address=client_ip_from_request(request),
        detail_json=json.dumps(details or {}, ensure_ascii=False),
    )
    db.add(log)
    db.flush()
    return log

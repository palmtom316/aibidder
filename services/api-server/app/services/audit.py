import json
from typing import Any

from sqlalchemy.orm import Session

from app.db.models import AuditLog


def record_audit_event(
    db: Session,
    *,
    action: str,
    resource_type: str,
    resource_id: str = "",
    status: str = "succeeded",
    organization_id: int | None = None,
    user_id: int | None = None,
    project_id: int | None = None,
    document_id: int | None = None,
    request_id: str = "",
    actor_email: str = "",
    ip_address: str = "",
    detail: dict[str, Any] | None = None,
) -> AuditLog:
    entry = AuditLog(
        organization_id=organization_id,
        user_id=user_id,
        project_id=project_id,
        document_id=document_id,
        actor_email=actor_email,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        status=status,
        request_id=request_id,
        ip_address=ip_address,
        detail_json=json.dumps(detail or {}, ensure_ascii=False),
    )
    db.add(entry)
    return entry

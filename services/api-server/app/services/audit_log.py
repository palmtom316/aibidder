from fastapi import Request
from sqlalchemy.orm import Session

from app.db.models import UserRole
from app.schemas.auth import UserIdentity
from app.services.audit_logs import record_audit_log


def write_audit_log(
    db: Session,
    *,
    action: str,
    organization_id: int | None = None,
    project_id: int | None = None,
    user_id: int | None = None,
    resource_type: str = "system",
    resource_id: str | int | None = None,
    request_id: str = "",
    status: str = "success",
    detail: dict | None = None,
    request: Request | None = None,
    current_user: UserIdentity | None = None,
    document_id: int | None = None,
) -> None:
    if request is None and request_id:
        class _State:
            pass
        class _Req:
            headers = {}
            client = None
            state = _State()
        req = _Req()
        req.state.request_id = request_id
        request = req  # type: ignore[assignment]

    if current_user is None and user_id is not None and organization_id is not None:
        current_user = UserIdentity(
            id=user_id,
            organization_id=organization_id,
            email="",
            role=UserRole.VIEWER,
        )

    record_audit_log(
        db,
        action=action,
        entity_type=resource_type,
        entity_id=str(resource_id or ""),
        current_user=current_user,
        organization_id=organization_id,
        project_id=project_id,
        document_id=document_id,
        status=status,
        request=request,
        details=detail,
        actor_email=getattr(current_user, "email", "") if current_user is not None else "",
    )

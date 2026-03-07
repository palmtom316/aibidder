from collections import defaultdict, deque
from time import time

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    REFRESH_TOKEN_KIND,
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.db.models import User, utc_now
from app.db.session import get_db
from app.schemas.auth import RefreshTokenRequest, TokenResponse
from app.services.audit import record_audit_event

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

_FAILED_LOGIN_ATTEMPTS: dict[str, deque[float]] = defaultdict(deque)


@router.post("/login", response_model=TokenResponse)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> TokenResponse:
    rate_limit_key = _build_rate_limit_key(request, form_data.username)
    user = db.scalar(select(User).where(User.email == form_data.username))
    is_valid_login = user is not None and verify_password(form_data.password, user.hashed_password)
    if not is_valid_login and _is_rate_limited(rate_limit_key):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many login attempts")

    if not is_valid_login:
        _record_failed_attempt(rate_limit_key)
        record_audit_event(
            db,
            action="auth.login.failed",
            resource_type="user",
            resource_id=form_data.username,
            status="failed",
            organization_id=getattr(user, "organization_id", None),
            user_id=getattr(user, "id", None),
            request_id=getattr(request.state, "request_id", ""),
            actor_email=form_data.username,
            ip_address=_request_ip(request),
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    _FAILED_LOGIN_ATTEMPTS.pop(rate_limit_key, None)
    user.last_login_at = utc_now()
    record_audit_event(
        db,
        action="auth.login.succeeded",
        resource_type="user",
        resource_id=str(user.id),
        organization_id=user.organization_id,
        user_id=user.id,
        request_id=getattr(request.state, "request_id", ""),
        actor_email=user.email,
        ip_address=_request_ip(request),
        detail={"email": user.email},
    )
    db.commit()

    return TokenResponse(
        access_token=create_access_token(user.email),
        refresh_token=create_refresh_token(user.email),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_access_token(payload: RefreshTokenRequest, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        token_payload = decode_token(payload.refresh_token, expected_kind=REFRESH_TOKEN_KIND)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    subject = token_payload.get("sub")
    user = db.scalar(select(User).where(User.email == subject))
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return TokenResponse(
        access_token=create_access_token(user.email),
        refresh_token=create_refresh_token(user.email),
    )


def _build_rate_limit_key(request: Request, username: str) -> str:
    client_host = _request_ip(request)
    if not client_host:
        client_host = "unknown"
    return f"{client_host}:{username.lower()}"


def _request_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
    if forwarded:
        return forwarded
    if request.client is not None and request.client.host:
        return request.client.host
    return "anonymous"


def _record_failed_attempt(key: str) -> None:
    if not key:
        return
    attempts = _FAILED_LOGIN_ATTEMPTS[key]
    now = time()
    attempts.append(now)
    _prune_attempts(attempts, now)


def _is_rate_limited(key: str) -> bool:
    if not key:
        return False
    attempts = _FAILED_LOGIN_ATTEMPTS[key]
    now = time()
    _prune_attempts(attempts, now)
    return len(attempts) >= settings.login_rate_limit_attempts


def _prune_attempts(attempts: deque[float], now: float) -> None:
    window_start = now - settings.login_rate_limit_window_seconds
    while attempts and attempts[0] < window_start:
        attempts.popleft()

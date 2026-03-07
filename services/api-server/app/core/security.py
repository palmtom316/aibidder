from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

ACCESS_TOKEN_KIND = "access"
REFRESH_TOKEN_KIND = "refresh"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: str, expires_minutes: int | None = None) -> str:
    return _create_token(
        subject=subject,
        token_kind=ACCESS_TOKEN_KIND,
        expires_minutes=expires_minutes or settings.access_token_expire_minutes,
    )


def create_refresh_token(subject: str, expires_minutes: int | None = None) -> str:
    return _create_token(
        subject=subject,
        token_kind=REFRESH_TOKEN_KIND,
        expires_minutes=expires_minutes or settings.refresh_token_expire_minutes,
    )


def decode_token(token: str, *, expected_kind: str | None = None) -> dict[str, Any]:
    payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    subject = payload.get("sub")
    token_kind = payload.get("type")
    if not subject:
        raise JWTError("Missing token subject")
    if expected_kind is not None and token_kind != expected_kind:
        raise JWTError("Invalid token type")
    return payload


def validate_password_policy(password: str) -> None:
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")


def _create_token(*, subject: str, token_kind: str, expires_minutes: int) -> str:
    expire_at = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    payload: dict[str, Any] = {"sub": subject, "exp": expire_at, "type": token_kind, "jti": uuid4().hex}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)

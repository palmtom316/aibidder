from collections.abc import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import User, UserRole
from app.db.session import get_db
from app.schemas.auth import UserIdentity

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> UserIdentity:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        subject = payload.get("sub")
        if not subject:
            raise credentials_error
    except JWTError as exc:
        raise credentials_error from exc

    user = db.scalar(select(User).where(User.email == subject))
    if user is None or not user.is_active:
        raise credentials_error

    return UserIdentity.model_validate(user)


def require_roles(*allowed_roles: UserRole) -> Callable[[UserIdentity], UserIdentity]:
    def dependency(current_user: UserIdentity = Depends(get_current_user)) -> UserIdentity:
        if current_user.role not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user

    return dependency

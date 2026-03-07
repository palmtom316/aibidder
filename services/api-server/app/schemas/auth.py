from pydantic import BaseModel, ConfigDict

from app.db.models import UserRole


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserIdentity(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    email: str
    role: UserRole

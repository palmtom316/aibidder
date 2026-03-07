from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.db.models import UserRole


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    organization_id: int
    created_by_user_id: int
    created_at: datetime


class DocumentCreate(BaseModel):
    filename: str = Field(min_length=1, max_length=512)
    document_type: str = Field(min_length=1, max_length=64)


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    filename: str
    document_type: str
    created_by_user_id: int
    created_at: datetime


class ProjectMemberCreate(BaseModel):
    user_email: str
    role: UserRole


class ProjectMemberResponse(BaseModel):
    project_id: int
    user_id: int
    user_email: str
    role: UserRole
    created_at: datetime

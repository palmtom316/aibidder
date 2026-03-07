from datetime import datetime

from pydantic import BaseModel, ConfigDict


class EvidenceUnitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    project_id: int
    document_id: int
    document_version_id: int
    document_type: str
    unit_type: str
    section_title: str
    section_path: str
    anchor: str
    page_start: int
    page_end: int
    content: str
    fts_text: str
    metadata_json: str
    created_at: datetime


class EvidenceSearchResult(BaseModel):
    id: int
    document_id: int
    filename: str
    document_type: str
    unit_type: str
    section_title: str
    anchor: str
    page_start: int
    page_end: int
    content: str

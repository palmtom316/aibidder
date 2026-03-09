from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class HistoricalBidImportRequest(BaseModel):
    document_id: int
    source_type: str = Field(min_length=1, max_length=64)
    project_type: str = Field(min_length=1, max_length=128)
    region: str = Field(min_length=1, max_length=128)
    year: int = Field(ge=2000, le=2100)
    is_recommended: bool = False


class HistoricalBidResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    document_id: int
    library_record_id: int | None
    source_type: str
    project_type: str
    region: str
    year: int
    is_recommended: bool
    default_usage_mode: str
    ingestion_status: str
    created_at: datetime


class HistoricalBidSectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    historical_bid_document_id: int
    title: str
    section_path: str
    section_type: str
    anchor: str
    page_start: int
    page_end: int
    raw_text: str
    fts_text: str
    created_at: datetime


class HistoricalReuseUnitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    historical_bid_section_id: int
    unit_type: str
    raw_text: str
    sanitized_text: str
    reuse_mode: str
    fact_density_score: int
    risk_level: str
    created_at: datetime


class ReusePackItem(BaseModel):
    id: int
    historical_bid_section_id: int
    unit_type: str
    sanitized_text: str
    reuse_mode: str
    fact_density_score: int
    risk_level: str


class HistoricalReusePackResponse(BaseModel):
    query: dict[str, str | None]
    safe_reuse: list[ReusePackItem]
    slot_reuse: list[ReusePackItem]
    style_only: list[ReusePackItem]

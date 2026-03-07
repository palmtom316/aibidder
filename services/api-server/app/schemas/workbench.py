from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ModuleSummary(BaseModel):
    module_key: str
    title: str
    count: int
    status: str
    description: str


class WorkbenchOverviewResponse(BaseModel):
    project_id: int | None
    modules: list[ModuleSummary]


class KnowledgeBaseEntryCreate(BaseModel):
    project_id: int | None = None
    source_document_id: int | None = None
    category: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=255)
    owner_name: str = Field(default="", max_length=255)


class KnowledgeBaseEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    project_id: int | None
    source_document_id: int | None
    category: str
    title: str
    owner_name: str
    ingestion_status: str
    detection_status: str
    detected_summary: str
    created_by_user_id: int
    created_at: datetime


class PipelineRunCreate(BaseModel):
    project_id: int
    source_document_id: int | None = None
    run_name: str = Field(min_length=1, max_length=255)


class DecompositionRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    project_id: int
    source_document_id: int | None
    run_name: str
    status: str
    progress_pct: int
    summary_json: str
    created_by_user_id: int
    created_at: datetime


class GenerationJobCreate(BaseModel):
    project_id: int
    source_document_id: int | None = None
    job_name: str = Field(min_length=1, max_length=255)
    target_sections: int = Field(ge=0, le=200, default=0)


class GenerationJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    project_id: int
    source_document_id: int | None
    job_name: str
    target_sections: int
    status: str
    created_by_user_id: int
    created_at: datetime


class ReviewRunCreate(BaseModel):
    project_id: int
    source_document_id: int | None = None
    run_name: str = Field(min_length=1, max_length=255)
    review_mode: str = Field(min_length=1, max_length=64)


class ReviewRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    project_id: int
    source_document_id: int | None
    run_name: str
    review_mode: str
    status: str
    simulated_score: int | None
    blocking_issue_count: int
    created_by_user_id: int
    created_at: datetime


class LayoutJobCreate(BaseModel):
    project_id: int
    source_document_id: int | None = None
    job_name: str = Field(min_length=1, max_length=255)
    template_name: str = Field(min_length=1, max_length=128)


class LayoutJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    project_id: int
    source_document_id: int | None
    job_name: str
    template_name: str
    status: str
    created_by_user_id: int
    created_at: datetime


class SubmissionRecordCreate(BaseModel):
    project_id: int
    source_document_id: int | None = None
    title: str = Field(min_length=1, max_length=255)
    status: str = Field(min_length=1, max_length=64)


class SubmissionRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    project_id: int
    source_document_id: int | None
    title: str
    status: str
    created_by_user_id: int
    created_at: datetime

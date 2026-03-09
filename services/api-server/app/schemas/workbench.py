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


class LibraryProjectCategoryOption(BaseModel):
    key: str
    label: str


class LibraryRecordCreateBase(BaseModel):
    project_id: int | None = None
    title: str = Field(min_length=1, max_length=255)
    project_category: str = Field(min_length=1, max_length=128)
    owner_name: str = Field(default="", max_length=255)


class LibraryDocumentRecordCreate(LibraryRecordCreateBase):
    source_document_id: int = Field(ge=1)
    record_type: str = Field(min_length=1, max_length=64)


class CompanyQualificationRecordCreate(LibraryRecordCreateBase):
    qualification_name: str = Field(min_length=1, max_length=255)
    qualification_level: str = Field(default="", max_length=128)
    valid_until: str = Field(default="", max_length=64)
    certificate_no: str = Field(default="", max_length=255)


class CompanyPerformanceRecordCreate(LibraryRecordCreateBase):
    contract_name: str = Field(min_length=1, max_length=255)
    project_features: str = Field(default="")
    contract_amount: str = Field(default="", max_length=128)
    start_date: str = Field(default="", max_length=64)
    completion_date: str = Field(default="", max_length=64)


class CompanyAssetRecordCreate(LibraryRecordCreateBase):
    equipment_name: str = Field(min_length=1, max_length=255)
    equipment_brand: str = Field(default="", max_length=255)
    equipment_model: str = Field(default="", max_length=255)
    purchase_date: str = Field(default="", max_length=64)


class PersonnelQualificationRecordCreate(LibraryRecordCreateBase):
    person_name: str = Field(min_length=1, max_length=255)
    education: str = Field(default="", max_length=255)
    title_name: str = Field(default="", max_length=255)
    qualification_name: str = Field(default="", max_length=255)
    qualification_valid_until: str = Field(default="", max_length=64)


class PersonnelPerformanceRecordCreate(LibraryRecordCreateBase):
    person_name: str = Field(min_length=1, max_length=255)
    project_name: str = Field(min_length=1, max_length=255)
    project_role: str = Field(default="", max_length=255)


class LibraryRecordReviewUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    project_category: str | None = Field(default=None, min_length=1, max_length=128)
    owner_name: str | None = Field(default=None, max_length=255)
    summary_text: str | None = None
    tags_json: str | None = None
    profile_json: str | None = None
    review_notes: str | None = None
    status: str | None = Field(default=None, max_length=64)
    confidence_weight: float | None = None


class LibraryAttachmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    library_record_id: int
    document_id: int | None
    attachment_role: str
    filename: str
    mime_type: str
    storage_path: str
    page_count: int
    ocr_status: str
    extracted_text: str
    metadata_json: str
    created_by_user_id: int
    created_at: datetime


class LibraryChunkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    project_id: int | None
    library_record_id: int
    library_record_version_id: int | None
    attachment_id: int | None
    chunk_type: str
    title: str
    section_path: str
    anchor: str
    page_start: int
    page_end: int
    content: str
    summary_text: str
    tags_json: str
    source_priority: str
    retrieval_weight: float
    fts_text: str
    metadata_json: str
    created_at: datetime


class LibraryRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    project_id: int | None
    source_document_id: int | None
    record_type: str
    title: str
    project_category: str
    owner_name: str
    source_priority: str
    confidence_weight: float
    status: str
    ingestion_mode: str
    summary_text: str
    tags_json: str
    profile_json: str
    metadata_json: str
    current_version_no: int
    created_by_user_id: int
    created_at: datetime
    updated_at: datetime


class LibraryRecordDetailResponse(LibraryRecordResponse):
    attachments: list[LibraryAttachmentResponse]
    chunks: list[LibraryChunkResponse]


class LibrarySearchResult(BaseModel):
    record: LibraryRecordResponse
    chunks: list[LibraryChunkResponse]


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


class QualificationCreate(BaseModel):
    qualification_name: str = Field(min_length=1, max_length=255)
    qualification_level: str = Field(default="", max_length=128)
    certificate_no: str = Field(default="", max_length=255)
    valid_until: str = Field(default="", max_length=64)
    metadata_json: str = Field(default="{}")


class QualificationUpdate(BaseModel):
    qualification_name: str | None = Field(default=None, min_length=1, max_length=255)
    qualification_level: str | None = Field(default=None, max_length=128)
    certificate_no: str | None = Field(default=None, max_length=255)
    valid_until: str | None = Field(default=None, max_length=64)
    metadata_json: str | None = None


class QualificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    qualification_name: str
    qualification_level: str
    certificate_no: str
    valid_until: str
    metadata_json: str
    created_at: datetime


class PersonnelAssetCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    role_title: str = Field(default="", max_length=255)
    certificate_no: str = Field(default="", max_length=255)
    metadata_json: str = Field(default="{}")


class PersonnelAssetUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    role_title: str | None = Field(default=None, max_length=255)
    certificate_no: str | None = Field(default=None, max_length=255)
    metadata_json: str | None = None


class PersonnelAssetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    full_name: str
    role_title: str
    certificate_no: str
    metadata_json: str
    created_at: datetime


class EquipmentAssetCreate(BaseModel):
    equipment_name: str = Field(min_length=1, max_length=255)
    model_no: str = Field(default="", max_length=255)
    quantity: int = Field(default=1, ge=0)
    metadata_json: str = Field(default="{}")


class EquipmentAssetUpdate(BaseModel):
    equipment_name: str | None = Field(default=None, min_length=1, max_length=255)
    model_no: str | None = Field(default=None, max_length=255)
    quantity: int | None = Field(default=None, ge=0)
    metadata_json: str | None = None


class EquipmentAssetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    equipment_name: str
    model_no: str
    quantity: int
    metadata_json: str
    created_at: datetime


class ProjectCredentialCreate(BaseModel):
    project_name: str = Field(min_length=1, max_length=255)
    credential_type: str = Field(default="project_performance", max_length=128)
    owner_name: str = Field(default="", max_length=255)
    metadata_json: str = Field(default="{}")


class ProjectCredentialUpdate(BaseModel):
    project_name: str | None = Field(default=None, min_length=1, max_length=255)
    credential_type: str | None = Field(default=None, max_length=128)
    owner_name: str | None = Field(default=None, max_length=255)
    metadata_json: str | None = None


class ProjectCredentialResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    project_name: str
    credential_type: str
    owner_name: str
    metadata_json: str
    created_at: datetime


class GeneratedSectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    project_id: int
    source_document_id: int | None
    section_key: str
    title: str
    status: str
    draft_text: str
    evidence_summary_json: str
    created_by_user_id: int
    created_at: datetime
    updated_at: datetime


class VerificationIssueResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    project_id: int
    generated_section_id: int | None
    severity: str
    issue_type: str
    title: str
    detail: str
    status: str
    created_at: datetime


class ReviewIssueResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    project_id: int
    review_run_id: int
    generated_section_id: int | None
    severity: str
    category: str
    title: str
    detail: str
    is_blocking: bool
    status: str
    created_at: datetime


class RenderedOutputResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    project_id: int
    source_document_id: int | None
    layout_job_id: int | None
    output_type: str
    storage_path: str
    version_tag: str
    created_by_user_id: int
    created_at: datetime

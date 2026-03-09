from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import Boolean, DateTime, Enum as SqlEnum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class UserRole(str, Enum):
    ADMIN = "admin"
    PROJECT_MANAGER = "project_manager"
    WRITER = "writer"
    VIEWER = "viewer"


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(SqlEnum(UserRole), nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(64), nullable=False, default="active", index=True)
    deadline_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class ProjectMember(Base):
    __tablename__ = "project_members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    role: Mapped[UserRole] = mapped_column(SqlEnum(UserRole), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    document_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    mime_type: Mapped[str] = mapped_column(String(255), nullable=False, default="application/octet-stream")
    file_size: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class DocumentVersion(Base):
    __tablename__ = "document_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id"), nullable=False, index=True)
    version_no: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    file_hash: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(64), nullable=False, default="uploaded")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class DocumentArtifact(Base):
    __tablename__ = "document_artifacts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    document_version_id: Mapped[int] = mapped_column(ForeignKey("document_versions.id"), nullable=False, index=True)
    artifact_type: Mapped[str] = mapped_column(String(64), nullable=False)
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class EvidenceUnit(Base):
    __tablename__ = "evidence_units"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id"), nullable=False, index=True)
    document_version_id: Mapped[int] = mapped_column(ForeignKey("document_versions.id"), nullable=False, index=True)
    document_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    unit_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    section_title: Mapped[str] = mapped_column(String(255), nullable=False)
    section_path: Mapped[str] = mapped_column(String(512), nullable=False)
    anchor: Mapped[str] = mapped_column(String(128), nullable=False)
    page_start: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    page_end: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    fts_text: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class HistoricalBidDocument(Base):
    __tablename__ = "historical_bid_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id"), nullable=False, unique=True, index=True)
    library_record_id: Mapped[int | None] = mapped_column(ForeignKey("library_records.id"), nullable=True, unique=True, index=True)
    source_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    project_type: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    region: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    is_recommended: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    default_usage_mode: Mapped[str] = mapped_column(String(64), nullable=False, default="reuse_allowed")
    ingestion_status: Mapped[str] = mapped_column(String(64), nullable=False, default="imported")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class HistoricalBidSection(Base):
    __tablename__ = "historical_bid_sections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    historical_bid_document_id: Mapped[int] = mapped_column(
        ForeignKey("historical_bid_documents.id"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    section_path: Mapped[str] = mapped_column(String(512), nullable=False)
    section_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    anchor: Mapped[str] = mapped_column(String(128), nullable=False)
    page_start: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    page_end: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    fts_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class HistoricalReuseUnit(Base):
    __tablename__ = "historical_reuse_units"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    historical_bid_section_id: Mapped[int] = mapped_column(
        ForeignKey("historical_bid_sections.id"), nullable=False, index=True
    )
    unit_type: Mapped[str] = mapped_column(String(64), nullable=False, default="paragraph")
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    sanitized_text: Mapped[str] = mapped_column(Text, nullable=False)
    reuse_mode: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    fact_density_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    risk_level: Mapped[str] = mapped_column(String(32), nullable=False, default="low")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class HistoricalRiskMark(Base):
    __tablename__ = "historical_risk_marks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    historical_reuse_unit_id: Mapped[int] = mapped_column(
        ForeignKey("historical_reuse_units.id"), nullable=False, index=True
    )
    risk_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    raw_value: Mapped[str] = mapped_column(String(255), nullable=False)
    start_offset: Mapped[int] = mapped_column(Integer, nullable=False)
    end_offset: Mapped[int] = mapped_column(Integer, nullable=False)
    replacement_token: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class TenderRequirement(Base):
    __tablename__ = "tender_requirements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    source_document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.id"), nullable=True, index=True)
    parent_requirement_id: Mapped[int | None] = mapped_column(ForeignKey("tender_requirements.id"), nullable=True)
    requirement_type: Mapped[str] = mapped_column(String(64), nullable=False, default="general")
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    detail: Mapped[str] = mapped_column(Text, nullable=False, default="")
    source_anchor: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    priority: Mapped[str] = mapped_column(String(32), nullable=False, default="normal")
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class RequirementConstraint(Base):
    __tablename__ = "requirement_constraints"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    tender_requirement_id: Mapped[int] = mapped_column(ForeignKey("tender_requirements.id"), nullable=False, index=True)
    constraint_type: Mapped[str] = mapped_column(String(64), nullable=False)
    constraint_key: Mapped[str] = mapped_column(String(128), nullable=False)
    expected_value: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String(32), nullable=False, default="warning")
    source_anchor: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class GeneratedSection(Base):
    __tablename__ = "generated_sections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    source_document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.id"), nullable=True, index=True)
    section_key: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(64), nullable=False, default="draft")
    draft_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    evidence_summary_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)


class SectionEvidenceBinding(Base):
    __tablename__ = "section_evidence_bindings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    generated_section_id: Mapped[int] = mapped_column(ForeignKey("generated_sections.id"), nullable=False, index=True)
    evidence_unit_id: Mapped[int | None] = mapped_column(ForeignKey("evidence_units.id"), nullable=True, index=True)
    historical_reuse_unit_id: Mapped[int | None] = mapped_column(
        ForeignKey("historical_reuse_units.id"), nullable=True, index=True
    )
    binding_type: Mapped[str] = mapped_column(String(64), nullable=False, default="citation")
    quote_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    anchor: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class VerificationIssue(Base):
    __tablename__ = "verification_issues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    generated_section_id: Mapped[int | None] = mapped_column(ForeignKey("generated_sections.id"), nullable=True, index=True)
    severity: Mapped[str] = mapped_column(String(32), nullable=False, default="warning")
    issue_type: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    detail: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(64), nullable=False, default="open")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class DecompositionRun(Base):
    __tablename__ = "decomposition_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    source_document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.id"), nullable=True, index=True)
    run_name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(64), nullable=False, default="queued")
    progress_pct: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    summary_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class GenerationJob(Base):
    __tablename__ = "generation_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    source_document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.id"), nullable=True, index=True)
    job_name: Mapped[str] = mapped_column(String(255), nullable=False)
    target_sections: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(64), nullable=False, default="drafting")
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class ReviewRun(Base):
    __tablename__ = "review_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    source_document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.id"), nullable=True, index=True)
    run_name: Mapped[str] = mapped_column(String(255), nullable=False)
    review_mode: Mapped[str] = mapped_column(String(64), nullable=False, default="simulated_scoring")
    status: Mapped[str] = mapped_column(String(64), nullable=False, default="queued")
    simulated_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    blocking_issue_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class ReviewIssue(Base):
    __tablename__ = "review_issues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    review_run_id: Mapped[int] = mapped_column(ForeignKey("review_runs.id"), nullable=False, index=True)
    generated_section_id: Mapped[int | None] = mapped_column(ForeignKey("generated_sections.id"), nullable=True, index=True)
    severity: Mapped[str] = mapped_column(String(32), nullable=False, default="warning")
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    detail: Mapped[str] = mapped_column(Text, nullable=False, default="")
    is_blocking: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(64), nullable=False, default="open")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class LayoutJob(Base):
    __tablename__ = "layout_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    source_document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.id"), nullable=True, index=True)
    job_name: Mapped[str] = mapped_column(String(255), nullable=False)
    template_name: Mapped[str] = mapped_column(String(128), nullable=False, default="corporate-default")
    status: Mapped[str] = mapped_column(String(64), nullable=False, default="queued")
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class RenderedOutput(Base):
    __tablename__ = "rendered_outputs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    source_document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.id"), nullable=True, index=True)
    layout_job_id: Mapped[int | None] = mapped_column(ForeignKey("layout_jobs.id"), nullable=True, index=True)
    output_type: Mapped[str] = mapped_column(String(64), nullable=False, default="docx")
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    version_tag: Mapped[str] = mapped_column(String(64), nullable=False, default="v1")
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class SubmissionRecord(Base):
    __tablename__ = "submission_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    source_document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(64), nullable=False, default="draft")
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class Qualification(Base):
    __tablename__ = "qualifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    qualification_name: Mapped[str] = mapped_column(String(255), nullable=False)
    qualification_level: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    certificate_no: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    valid_until: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    metadata_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class PersonnelAsset(Base):
    __tablename__ = "personnel_assets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role_title: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    certificate_no: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    metadata_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class EquipmentAsset(Base):
    __tablename__ = "equipment_assets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    equipment_name: Mapped[str] = mapped_column(String(255), nullable=False)
    model_no: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    metadata_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class ProjectCredential(Base):
    __tablename__ = "project_credentials"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    project_name: Mapped[str] = mapped_column(String(255), nullable=False)
    credential_type: Mapped[str] = mapped_column(String(128), nullable=False, default="project_performance")
    owner_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    metadata_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class LibraryRecord(Base):
    __tablename__ = "library_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"), nullable=True, index=True)
    source_document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.id"), nullable=True, index=True)
    record_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    project_category: Mapped[str] = mapped_column(String(128), nullable=False, default="", index=True)
    owner_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    source_priority: Mapped[str] = mapped_column(String(64), nullable=False, default="fact", index=True)
    confidence_weight: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    status: Mapped[str] = mapped_column(String(64), nullable=False, default="draft", index=True)
    ingestion_mode: Mapped[str] = mapped_column(String(64), nullable=False, default="manual_form")
    summary_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    tags_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    profile_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    metadata_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    current_version_no: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)


class LibraryRecordVersion(Base):
    __tablename__ = "library_record_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    library_record_id: Mapped[int] = mapped_column(ForeignKey("library_records.id"), nullable=False, index=True)
    version_no: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(String(64), nullable=False, default="draft")
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    summary_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    tags_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    profile_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    metadata_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    review_notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class LibraryAttachment(Base):
    __tablename__ = "library_attachments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    library_record_id: Mapped[int] = mapped_column(ForeignKey("library_records.id"), nullable=False, index=True)
    document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.id"), nullable=True, index=True)
    attachment_role: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(255), nullable=False, default="application/octet-stream")
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    page_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ocr_status: Mapped[str] = mapped_column(String(64), nullable=False, default="pending")
    extracted_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    metadata_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class LibraryChunk(Base):
    __tablename__ = "library_chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"), nullable=True, index=True)
    library_record_id: Mapped[int] = mapped_column(ForeignKey("library_records.id"), nullable=False, index=True)
    library_record_version_id: Mapped[int | None] = mapped_column(
        ForeignKey("library_record_versions.id"), nullable=True, index=True
    )
    attachment_id: Mapped[int | None] = mapped_column(ForeignKey("library_attachments.id"), nullable=True, index=True)
    chunk_type: Mapped[str] = mapped_column(String(64), nullable=False, default="section", index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    section_path: Mapped[str] = mapped_column(String(512), nullable=False, default="")
    anchor: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    page_start: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    page_end: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    summary_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    tags_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    source_priority: Mapped[str] = mapped_column(String(64), nullable=False, default="fact", index=True)
    retrieval_weight: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    fts_text: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class LibraryReview(Base):
    __tablename__ = "library_reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    library_record_id: Mapped[int] = mapped_column(ForeignKey("library_records.id"), nullable=False, index=True)
    library_record_version_id: Mapped[int | None] = mapped_column(
        ForeignKey("library_record_versions.id"), nullable=True, index=True
    )
    review_status: Mapped[str] = mapped_column(String(64), nullable=False, default="pending", index=True)
    reviewer_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    review_notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    diff_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class CompanyQualificationProfile(Base):
    __tablename__ = "company_qualification_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    library_record_id: Mapped[int] = mapped_column(ForeignKey("library_records.id"), nullable=False, unique=True, index=True)
    qualification_name: Mapped[str] = mapped_column(String(255), nullable=False)
    qualification_level: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    valid_until: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    certificate_no: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class CompanyPerformanceProfile(Base):
    __tablename__ = "company_performance_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    library_record_id: Mapped[int] = mapped_column(ForeignKey("library_records.id"), nullable=False, unique=True, index=True)
    contract_name: Mapped[str] = mapped_column(String(255), nullable=False)
    project_features: Mapped[str] = mapped_column(Text, nullable=False, default="")
    contract_amount: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    project_category: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    start_date: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    completion_date: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class CompanyAssetProfile(Base):
    __tablename__ = "company_asset_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    library_record_id: Mapped[int] = mapped_column(ForeignKey("library_records.id"), nullable=False, unique=True, index=True)
    equipment_name: Mapped[str] = mapped_column(String(255), nullable=False)
    equipment_brand: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    equipment_model: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    purchase_date: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class PersonnelQualificationProfile(Base):
    __tablename__ = "personnel_qualification_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    library_record_id: Mapped[int] = mapped_column(ForeignKey("library_records.id"), nullable=False, unique=True, index=True)
    person_name: Mapped[str] = mapped_column(String(255), nullable=False)
    education: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    title_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    qualification_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    qualification_valid_until: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class PersonnelPerformanceProfile(Base):
    __tablename__ = "personnel_performance_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    library_record_id: Mapped[int] = mapped_column(ForeignKey("library_records.id"), nullable=False, unique=True, index=True)
    person_name: Mapped[str] = mapped_column(String(255), nullable=False)
    project_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    project_category: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    project_role: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organization_id: Mapped[int | None] = mapped_column(ForeignKey("organizations.id"), nullable=True, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"), nullable=True, index=True)
    document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.id"), nullable=True, index=True)
    actor_email: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    action: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    resource_type: Mapped[str] = mapped_column(String(64), nullable=False, default="system")
    resource_id: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="succeeded")
    detail_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    request_id: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    ip_address: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

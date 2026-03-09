"""add unified knowledge library tables

Revision ID: 20260309_0003
Revises: 20260308_0002
Create Date: 2026-03-09 16:30:00
"""

from alembic import op
import sqlalchemy as sa

revision = "20260309_0003"
down_revision = "20260308_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "library_records",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=True),
        sa.Column("source_document_id", sa.Integer(), sa.ForeignKey("documents.id"), nullable=True),
        sa.Column("record_type", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("project_category", sa.String(length=128), nullable=False, server_default=""),
        sa.Column("owner_name", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("source_priority", sa.String(length=64), nullable=False, server_default="fact"),
        sa.Column("confidence_weight", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("status", sa.String(length=64), nullable=False, server_default="draft"),
        sa.Column("ingestion_mode", sa.String(length=64), nullable=False, server_default="manual_form"),
        sa.Column("summary_text", sa.Text(), nullable=False, server_default=""),
        sa.Column("tags_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("profile_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("metadata_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("current_version_no", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_library_records_organization_id", "library_records", ["organization_id"])
    op.create_index("ix_library_records_project_id", "library_records", ["project_id"])
    op.create_index("ix_library_records_source_document_id", "library_records", ["source_document_id"])
    op.create_index("ix_library_records_record_type", "library_records", ["record_type"])
    op.create_index("ix_library_records_project_category", "library_records", ["project_category"])
    op.create_index("ix_library_records_source_priority", "library_records", ["source_priority"])
    op.create_index("ix_library_records_status", "library_records", ["status"])

    op.create_table(
        "library_record_versions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("library_record_id", sa.Integer(), sa.ForeignKey("library_records.id"), nullable=False),
        sa.Column("version_no", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(length=64), nullable=False, server_default="draft"),
        sa.Column("title", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("summary_text", sa.Text(), nullable=False, server_default=""),
        sa.Column("tags_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("profile_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("metadata_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("review_notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_library_record_versions_library_record_id", "library_record_versions", ["library_record_id"])

    op.create_table(
        "library_attachments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("library_record_id", sa.Integer(), sa.ForeignKey("library_records.id"), nullable=False),
        sa.Column("document_id", sa.Integer(), sa.ForeignKey("documents.id"), nullable=True),
        sa.Column("attachment_role", sa.String(length=64), nullable=False),
        sa.Column("filename", sa.String(length=512), nullable=False),
        sa.Column("mime_type", sa.String(length=255), nullable=False, server_default="application/octet-stream"),
        sa.Column("storage_path", sa.Text(), nullable=False),
        sa.Column("page_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("ocr_status", sa.String(length=64), nullable=False, server_default="pending"),
        sa.Column("extracted_text", sa.Text(), nullable=False, server_default=""),
        sa.Column("metadata_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_library_attachments_library_record_id", "library_attachments", ["library_record_id"])
    op.create_index("ix_library_attachments_document_id", "library_attachments", ["document_id"])
    op.create_index("ix_library_attachments_attachment_role", "library_attachments", ["attachment_role"])

    op.create_table(
        "library_chunks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=True),
        sa.Column("library_record_id", sa.Integer(), sa.ForeignKey("library_records.id"), nullable=False),
        sa.Column("library_record_version_id", sa.Integer(), sa.ForeignKey("library_record_versions.id"), nullable=True),
        sa.Column("attachment_id", sa.Integer(), sa.ForeignKey("library_attachments.id"), nullable=True),
        sa.Column("chunk_type", sa.String(length=64), nullable=False, server_default="section"),
        sa.Column("title", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("section_path", sa.String(length=512), nullable=False, server_default=""),
        sa.Column("anchor", sa.String(length=128), nullable=False, server_default=""),
        sa.Column("page_start", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("page_end", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("summary_text", sa.Text(), nullable=False, server_default=""),
        sa.Column("tags_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("source_priority", sa.String(length=64), nullable=False, server_default="fact"),
        sa.Column("retrieval_weight", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("fts_text", sa.Text(), nullable=False),
        sa.Column("metadata_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_library_chunks_organization_id", "library_chunks", ["organization_id"])
    op.create_index("ix_library_chunks_project_id", "library_chunks", ["project_id"])
    op.create_index("ix_library_chunks_library_record_id", "library_chunks", ["library_record_id"])
    op.create_index("ix_library_chunks_library_record_version_id", "library_chunks", ["library_record_version_id"])
    op.create_index("ix_library_chunks_attachment_id", "library_chunks", ["attachment_id"])
    op.create_index("ix_library_chunks_chunk_type", "library_chunks", ["chunk_type"])
    op.create_index("ix_library_chunks_source_priority", "library_chunks", ["source_priority"])

    op.create_table(
        "company_qualification_profiles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("library_record_id", sa.Integer(), sa.ForeignKey("library_records.id"), nullable=False, unique=True),
        sa.Column("qualification_name", sa.String(length=255), nullable=False),
        sa.Column("qualification_level", sa.String(length=128), nullable=False, server_default=""),
        sa.Column("valid_until", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("certificate_no", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_company_qualification_profiles_library_record_id", "company_qualification_profiles", ["library_record_id"], unique=True)

    op.create_table(
        "company_performance_profiles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("library_record_id", sa.Integer(), sa.ForeignKey("library_records.id"), nullable=False, unique=True),
        sa.Column("contract_name", sa.String(length=255), nullable=False),
        sa.Column("project_features", sa.Text(), nullable=False, server_default=""),
        sa.Column("contract_amount", sa.String(length=128), nullable=False, server_default=""),
        sa.Column("project_category", sa.String(length=128), nullable=False, server_default=""),
        sa.Column("start_date", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("completion_date", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_company_performance_profiles_library_record_id", "company_performance_profiles", ["library_record_id"], unique=True)

    op.create_table(
        "company_asset_profiles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("library_record_id", sa.Integer(), sa.ForeignKey("library_records.id"), nullable=False, unique=True),
        sa.Column("equipment_name", sa.String(length=255), nullable=False),
        sa.Column("equipment_brand", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("equipment_model", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("purchase_date", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_company_asset_profiles_library_record_id", "company_asset_profiles", ["library_record_id"], unique=True)

    op.create_table(
        "personnel_qualification_profiles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("library_record_id", sa.Integer(), sa.ForeignKey("library_records.id"), nullable=False, unique=True),
        sa.Column("person_name", sa.String(length=255), nullable=False),
        sa.Column("education", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("title_name", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("qualification_name", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("qualification_valid_until", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_personnel_qualification_profiles_library_record_id", "personnel_qualification_profiles", ["library_record_id"], unique=True)

    op.create_table(
        "personnel_performance_profiles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("library_record_id", sa.Integer(), sa.ForeignKey("library_records.id"), nullable=False, unique=True),
        sa.Column("person_name", sa.String(length=255), nullable=False),
        sa.Column("project_name", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("project_category", sa.String(length=128), nullable=False, server_default=""),
        sa.Column("project_role", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_personnel_performance_profiles_library_record_id", "personnel_performance_profiles", ["library_record_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_personnel_performance_profiles_library_record_id", table_name="personnel_performance_profiles")
    op.drop_table("personnel_performance_profiles")
    op.drop_index("ix_personnel_qualification_profiles_library_record_id", table_name="personnel_qualification_profiles")
    op.drop_table("personnel_qualification_profiles")
    op.drop_index("ix_company_asset_profiles_library_record_id", table_name="company_asset_profiles")
    op.drop_table("company_asset_profiles")
    op.drop_index("ix_company_performance_profiles_library_record_id", table_name="company_performance_profiles")
    op.drop_table("company_performance_profiles")
    op.drop_index("ix_company_qualification_profiles_library_record_id", table_name="company_qualification_profiles")
    op.drop_table("company_qualification_profiles")
    op.drop_index("ix_library_chunks_source_priority", table_name="library_chunks")
    op.drop_index("ix_library_chunks_chunk_type", table_name="library_chunks")
    op.drop_index("ix_library_chunks_attachment_id", table_name="library_chunks")
    op.drop_index("ix_library_chunks_library_record_version_id", table_name="library_chunks")
    op.drop_index("ix_library_chunks_library_record_id", table_name="library_chunks")
    op.drop_index("ix_library_chunks_project_id", table_name="library_chunks")
    op.drop_index("ix_library_chunks_organization_id", table_name="library_chunks")
    op.drop_table("library_chunks")
    op.drop_index("ix_library_attachments_attachment_role", table_name="library_attachments")
    op.drop_index("ix_library_attachments_document_id", table_name="library_attachments")
    op.drop_index("ix_library_attachments_library_record_id", table_name="library_attachments")
    op.drop_table("library_attachments")
    op.drop_index("ix_library_record_versions_library_record_id", table_name="library_record_versions")
    op.drop_table("library_record_versions")
    op.drop_index("ix_library_records_status", table_name="library_records")
    op.drop_index("ix_library_records_source_priority", table_name="library_records")
    op.drop_index("ix_library_records_project_category", table_name="library_records")
    op.drop_index("ix_library_records_record_type", table_name="library_records")
    op.drop_index("ix_library_records_source_document_id", table_name="library_records")
    op.drop_index("ix_library_records_project_id", table_name="library_records")
    op.drop_index("ix_library_records_organization_id", table_name="library_records")
    op.drop_table("library_records")

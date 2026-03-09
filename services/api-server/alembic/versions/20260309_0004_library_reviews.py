"""add library reviews table

Revision ID: 20260309_0004
Revises: 20260309_0003
Create Date: 2026-03-09 18:10:00
"""

from alembic import op
import sqlalchemy as sa

revision = "20260309_0004"
down_revision = "20260309_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "library_reviews",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("library_record_id", sa.Integer(), sa.ForeignKey("library_records.id"), nullable=False),
        sa.Column("library_record_version_id", sa.Integer(), sa.ForeignKey("library_record_versions.id"), nullable=True),
        sa.Column("review_status", sa.String(length=64), nullable=False, server_default="pending"),
        sa.Column("reviewer_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("review_notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("diff_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_library_reviews_library_record_id", "library_reviews", ["library_record_id"])
    op.create_index("ix_library_reviews_library_record_version_id", "library_reviews", ["library_record_version_id"])
    op.create_index("ix_library_reviews_review_status", "library_reviews", ["review_status"])
    op.create_index("ix_library_reviews_reviewer_user_id", "library_reviews", ["reviewer_user_id"])


def downgrade() -> None:
    op.drop_index("ix_library_reviews_reviewer_user_id", table_name="library_reviews")
    op.drop_index("ix_library_reviews_review_status", table_name="library_reviews")
    op.drop_index("ix_library_reviews_library_record_version_id", table_name="library_reviews")
    op.drop_index("ix_library_reviews_library_record_id", table_name="library_reviews")
    op.drop_table("library_reviews")

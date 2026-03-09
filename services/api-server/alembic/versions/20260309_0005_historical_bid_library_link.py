"""link historical bids to unified library records

Revision ID: 20260309_0005
Revises: 20260309_0004
Create Date: 2026-03-09 22:40:00
"""

from alembic import op
import sqlalchemy as sa

revision = "20260309_0005"
down_revision = "20260309_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "historical_bid_documents",
        sa.Column("library_record_id", sa.Integer(), sa.ForeignKey("library_records.id"), nullable=True),
    )
    op.create_index(
        "ix_historical_bid_documents_library_record_id",
        "historical_bid_documents",
        ["library_record_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_historical_bid_documents_library_record_id", table_name="historical_bid_documents")
    op.drop_column("historical_bid_documents", "library_record_id")

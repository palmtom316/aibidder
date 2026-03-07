"""baseline schema

Revision ID: 20260307_0001
Revises:
Create Date: 2026-03-07 16:00:00
"""

from alembic import op
from sqlalchemy import text

from app.db.session import Base
from app.db import models  # noqa: F401

revision = "20260307_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)

    if bind.dialect.name == "postgresql":
        statements = (
            """
            ALTER TABLE evidence_units
            ADD COLUMN IF NOT EXISTS fts_vector tsvector GENERATED ALWAYS AS (
                to_tsvector('simple', coalesce(fts_text, ''))
            ) STORED
            """,
            "CREATE INDEX IF NOT EXISTS ix_evidence_units_fts_vector ON evidence_units USING GIN (fts_vector)",
            """
            ALTER TABLE historical_bid_sections
            ADD COLUMN IF NOT EXISTS fts_vector tsvector GENERATED ALWAYS AS (
                to_tsvector('simple', coalesce(fts_text, ''))
            ) STORED
            """,
            "CREATE INDEX IF NOT EXISTS ix_historical_bid_sections_fts_vector ON historical_bid_sections USING GIN (fts_vector)",
        )
        for statement in statements:
            bind.execute(text(statement))


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        bind.execute(text("DROP INDEX IF EXISTS ix_historical_bid_sections_fts_vector"))
        bind.execute(text("DROP INDEX IF EXISTS ix_evidence_units_fts_vector"))
    Base.metadata.drop_all(bind=bind)

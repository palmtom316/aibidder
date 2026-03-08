"""align legacy schema columns

Revision ID: 20260308_0002
Revises: 20260307_0001
Create Date: 2026-03-08 16:00:00
"""

from alembic import op
from sqlalchemy import text

revision = "20260308_0002"
down_revision = "20260307_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    statements = (
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ",
        "ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE projects ADD COLUMN IF NOT EXISTS status VARCHAR(64) NOT NULL DEFAULT 'active'",
        "ALTER TABLE projects ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMPTZ",
        "CREATE INDEX IF NOT EXISTS ix_projects_status ON projects (status)",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS mime_type VARCHAR(255) NOT NULL DEFAULT 'application/octet-stream'",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_size INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS file_hash VARCHAR(128)",
        "CREATE INDEX IF NOT EXISTS ix_document_versions_file_hash ON document_versions (file_hash)",
    )
    for statement in statements:
        bind.execute(text(statement))


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    statements = (
        "DROP INDEX IF EXISTS ix_document_versions_file_hash",
        "ALTER TABLE document_versions DROP COLUMN IF EXISTS file_hash",
        "ALTER TABLE documents DROP COLUMN IF EXISTS file_size",
        "ALTER TABLE documents DROP COLUMN IF EXISTS mime_type",
        "DROP INDEX IF EXISTS ix_projects_status",
        "ALTER TABLE projects DROP COLUMN IF EXISTS deadline_at",
        "ALTER TABLE projects DROP COLUMN IF EXISTS status",
        "ALTER TABLE projects DROP COLUMN IF EXISTS description",
        "ALTER TABLE users DROP COLUMN IF EXISTS last_login_at",
    )
    for statement in statements:
        bind.execute(text(statement))

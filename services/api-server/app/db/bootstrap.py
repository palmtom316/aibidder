from sqlalchemy import select, text
from sqlalchemy.exc import OperationalError

from app.core.config import settings
from app.core.security import hash_password
from app.db.models import Organization, User, UserRole
from app.db.session import Base, SessionLocal, engine

DEFAULT_ORG_NAME = "Default Organization"
SEED_USERS: tuple[tuple[str, str, UserRole], ...] = (
    ("admin@example.com", "admin123456", UserRole.ADMIN),
    ("project_manager@example.com", "manager123456", UserRole.PROJECT_MANAGER),
    ("writer@example.com", "writer123456", UserRole.WRITER),
)


def initialize_database() -> None:
    if _should_bootstrap_schema():
        Base.metadata.create_all(bind=engine)
        _ensure_postgresql_fts_objects()

    try:
        with SessionLocal() as db:
            organization = db.scalar(select(Organization).where(Organization.name == DEFAULT_ORG_NAME))
            if organization is None:
                organization = Organization(name=DEFAULT_ORG_NAME)
                db.add(organization)
                db.commit()
                db.refresh(organization)

            for email, password, role in SEED_USERS:
                existing_user = db.scalar(select(User).where(User.email == email))
                if existing_user is not None:
                    continue

                db.add(
                    User(
                        organization_id=organization.id,
                        email=email,
                        hashed_password=hash_password(password),
                        role=role,
                    )
                )

            db.commit()
    except OperationalError as exc:
        raise RuntimeError(
            "Database schema is not ready. Run `alembic upgrade head` or enable AUTO_CREATE_SCHEMA`."
        ) from exc


def _should_bootstrap_schema() -> bool:
    return engine.dialect.name == "sqlite" or settings.auto_create_schema


def _ensure_postgresql_fts_objects() -> None:
    if engine.dialect.name != "postgresql":
        return

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

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))

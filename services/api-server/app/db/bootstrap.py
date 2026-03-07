from sqlalchemy import select

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
    Base.metadata.create_all(bind=engine)

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

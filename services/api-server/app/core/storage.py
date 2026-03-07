from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from app.core.config import settings

ALLOWED_UPLOAD_EXTENSIONS = {".pdf", ".docx"}


def validate_upload(filename: str) -> None:
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_UPLOAD_EXTENSIONS:
        raise ValueError("Unsupported file type")


def save_upload(project_id: int, file: UploadFile) -> str:
    suffix = Path(file.filename or "").suffix.lower()
    target_dir = Path(settings.storage_root) / f"project-{project_id}"
    target_dir.mkdir(parents=True, exist_ok=True)

    target_path = target_dir / f"{uuid4().hex}{suffix}"
    payload = file.file.read()
    target_path.write_bytes(payload)
    return str(target_path.resolve())


def save_generated_artifact(
    project_id: int,
    document_id: int,
    version_no: int,
    artifact_type: str,
    content: str,
    extension: str,
) -> str:
    target_dir = Path(settings.storage_root) / f"project-{project_id}" / f"document-{document_id}" / f"v{version_no}"
    target_dir.mkdir(parents=True, exist_ok=True)

    target_path = target_dir / f"{artifact_type}{extension}"
    target_path.write_text(content, encoding="utf-8")
    return str(target_path.resolve())

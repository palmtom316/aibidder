from __future__ import annotations

import mimetypes
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Protocol
from uuid import uuid4

from fastapi import UploadFile
from fastapi.responses import FileResponse, Response

from app.core.config import settings

ALLOWED_UPLOAD_EXTENSIONS = {".pdf", ".docx", ".doc"}
ALLOWED_LIBRARY_ATTACHMENT_EXTENSIONS = {".pdf", ".docx", ".doc", ".png", ".jpg", ".jpeg", ".webp"}
_ENSURED_MINIO_BUCKETS: set[str] = set()


class StorageBackend(Protocol):
    def save_bytes(self, *, relative_path: str, payload: bytes, content_type: str | None = None) -> str: ...

    def read_bytes(self, locator: str) -> bytes: ...

    def materialize(self, locator: str) -> str: ...

    def filename(self, locator: str) -> str: ...


class LocalStorageBackend:
    def save_bytes(self, *, relative_path: str, payload: bytes, content_type: str | None = None) -> str:
        target_path = Path(settings.storage_root) / relative_path
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_bytes(payload)
        return str(target_path.resolve())

    def read_bytes(self, locator: str) -> bytes:
        return Path(locator).read_bytes()

    def materialize(self, locator: str) -> str:
        return locator

    def filename(self, locator: str) -> str:
        return Path(locator).name


class MinioStorageBackend:
    prefix = "minio://"

    def save_bytes(self, *, relative_path: str, payload: bytes, content_type: str | None = None) -> str:
        bucket, key = self._bucket_and_key(relative_path)
        client = self._client()
        self._ensure_bucket(client, bucket)
        client.put_object(Bucket=bucket, Key=key, Body=payload, ContentType=content_type or "application/octet-stream")
        return f"{self.prefix}{bucket}/{key}"

    def read_bytes(self, locator: str) -> bytes:
        bucket, key = self._parse_locator(locator)
        response = self._client().get_object(Bucket=bucket, Key=key)
        body = response["Body"].read()
        response["Body"].close()
        return body

    def materialize(self, locator: str) -> str:
        suffix = Path(self.filename(locator)).suffix
        temp_file = NamedTemporaryFile(delete=False, suffix=suffix)
        temp_file.write(self.read_bytes(locator))
        temp_file.flush()
        temp_file.close()
        return temp_file.name

    def filename(self, locator: str) -> str:
        _, key = self._parse_locator(locator)
        return Path(key).name

    def _client(self):
        try:
            import boto3
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError("boto3 is required when STORAGE_BACKEND=minio") from exc

        return boto3.client(
            "s3",
            endpoint_url=settings.minio_endpoint,
            aws_access_key_id=settings.minio_access_key,
            aws_secret_access_key=settings.minio_secret_key,
        )

    def _ensure_bucket(self, client, bucket: str) -> None:
        if bucket in _ENSURED_MINIO_BUCKETS:
            return
        head_bucket = getattr(client, "head_bucket", None)
        create_bucket = getattr(client, "create_bucket", None)
        if head_bucket is None or create_bucket is None:
            _ENSURED_MINIO_BUCKETS.add(bucket)
            return
        try:
            head_bucket(Bucket=bucket)
        except Exception as exc:  # pragma: no cover - backend-specific
            error = getattr(exc, "response", {}).get("Error", {}) if hasattr(exc, "response") else {}
            error_code = str(error.get("Code", ""))
            if error_code not in {"", "404", "NoSuchBucket", "NotFound"}:
                raise
            create_bucket(Bucket=bucket)
        _ENSURED_MINIO_BUCKETS.add(bucket)

    def _bucket_and_key(self, relative_path: str) -> tuple[str, str]:
        return settings.minio_bucket, relative_path.lstrip("/")

    def _parse_locator(self, locator: str) -> tuple[str, str]:
        if not locator.startswith(self.prefix):
            raise ValueError(f"Unsupported MinIO locator: {locator}")
        remainder = locator[len(self.prefix) :]
        bucket, _, key = remainder.partition("/")
        if not bucket or not key:
            raise ValueError(f"Malformed MinIO locator: {locator}")
        return bucket, key


def validate_upload(filename: str) -> None:
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_UPLOAD_EXTENSIONS:
        raise ValueError("Unsupported file type")


def validate_library_attachment(filename: str) -> None:
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_LIBRARY_ATTACHMENT_EXTENSIONS:
        raise ValueError("Unsupported library attachment type")


def storage_backend() -> StorageBackend:
    backend = settings.storage_backend.lower().strip()
    if backend == "minio":
        return MinioStorageBackend()
    return LocalStorageBackend()


def save_upload(project_id: int, file: UploadFile) -> str:
    suffix = Path(file.filename or "").suffix.lower()
    relative_path = f"project-{project_id}/{uuid4().hex}{suffix}"
    payload = file.file.read()
    return storage_backend().save_bytes(relative_path=relative_path, payload=payload, content_type=file.content_type)


def save_library_attachment(organization_id: int, record_type: str, file: UploadFile) -> str:
    suffix = Path(file.filename or "").suffix.lower()
    relative_path = f"library/org-{organization_id}/{record_type}/{uuid4().hex}{suffix}"
    payload = file.file.read()
    return storage_backend().save_bytes(relative_path=relative_path, payload=payload, content_type=file.content_type)


def save_generated_artifact(
    project_id: int,
    document_id: int,
    version_no: int,
    artifact_type: str,
    content: str,
    extension: str,
) -> str:
    relative_path = f"project-{project_id}/document-{document_id}/v{version_no}/{artifact_type}{extension}"
    return storage_backend().save_bytes(
        relative_path=relative_path,
        payload=content.encode("utf-8"),
        content_type="text/plain; charset=utf-8",
    )


def save_binary_artifact(
    project_id: int,
    document_id: int,
    version_no: int,
    artifact_type: str,
    payload: bytes,
    extension: str,
) -> str:
    relative_path = f"project-{project_id}/document-{document_id}/v{version_no}/{artifact_type}{extension}"
    content_type = mimetypes.guess_type(f"artifact{extension}")[0] or "application/octet-stream"
    return storage_backend().save_bytes(relative_path=relative_path, payload=payload, content_type=content_type)


def read_binary_artifact(locator: str) -> bytes:
    return storage_backend().read_bytes(locator) if _is_remote_locator(locator) else LocalStorageBackend().read_bytes(locator)


def read_text_artifact(locator: str, *, encoding: str = "utf-8") -> str:
    return read_binary_artifact(locator).decode(encoding)


def materialize_artifact(locator: str) -> str:
    return storage_backend().materialize(locator) if _is_remote_locator(locator) else LocalStorageBackend().materialize(locator)


def artifact_filename(locator: str) -> str:
    return storage_backend().filename(locator) if _is_remote_locator(locator) else LocalStorageBackend().filename(locator)


def build_download_response(locator: str, *, filename: str | None = None) -> Response:
    resolved_name = filename or artifact_filename(locator)
    if not _is_remote_locator(locator):
        return FileResponse(path=locator, filename=resolved_name)

    payload = read_binary_artifact(locator)
    media_type = mimetypes.guess_type(resolved_name)[0] or "application/octet-stream"
    return Response(
        content=payload,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{resolved_name}"'},
    )


def _is_remote_locator(locator: str) -> bool:
    return locator.startswith("minio://")

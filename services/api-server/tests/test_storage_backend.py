from pathlib import Path
import sys
from types import SimpleNamespace

from app.core.config import settings
from app.core.storage import read_binary_artifact, save_binary_artifact


def test_local_storage_backend_roundtrip(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(settings, "storage_backend", "local")
    monkeypatch.setattr(settings, "storage_root", str(tmp_path))

    locator = save_binary_artifact(
        project_id=1,
        document_id=2,
        version_no=3,
        artifact_type="source",
        payload=b"hello-storage",
        extension=".bin",
    )

    assert Path(locator).exists()
    assert read_binary_artifact(locator) == b"hello-storage"


class _FakeBody:
    def __init__(self, payload: bytes) -> None:
        self._payload = payload

    def read(self) -> bytes:
        return self._payload

    def close(self) -> None:
        return None


class _FakeS3Client:
    def __init__(self) -> None:
        self.objects: dict[tuple[str, str], bytes] = {}

    def put_object(self, *, Bucket: str, Key: str, Body: bytes, ContentType: str | None = None) -> None:
        self.objects[(Bucket, Key)] = Body

    def get_object(self, *, Bucket: str, Key: str) -> dict:
        return {"Body": _FakeBody(self.objects[(Bucket, Key)])}


class _FakeBoto3Module:
    def __init__(self, client: _FakeS3Client) -> None:
        self._client = client

    def client(self, *_args, **_kwargs):
        return self._client



def test_minio_storage_backend_roundtrip_with_optional_boto3(tmp_path, monkeypatch) -> None:
    fake_client = _FakeS3Client()
    monkeypatch.setattr(settings, "storage_backend", "minio")
    monkeypatch.setattr(settings, "storage_root", str(tmp_path))
    monkeypatch.setattr(settings, "minio_bucket", "aibidder")
    monkeypatch.setitem(sys.modules, "boto3", _FakeBoto3Module(fake_client))

    locator = save_binary_artifact(
        project_id=7,
        document_id=8,
        version_no=9,
        artifact_type="source",
        payload=b"hello-minio",
        extension=".bin",
    )

    assert locator.startswith("minio://aibidder/")
    assert read_binary_artifact(locator) == b"hello-minio"

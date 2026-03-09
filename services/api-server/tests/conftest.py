import os
import sys
import tempfile
from contextlib import contextmanager
from pathlib import Path

import fastapi.testclient
import starlette.testclient
from httpx import ASGITransport, AsyncClient


PROJECT_ROOT = Path(__file__).resolve().parents[1]
TEST_DB_PATH = Path(tempfile.gettempdir()) / "aibidder-api-tests.db"
DEFAULT_TEST_DATABASE_URL = f"sqlite:///{TEST_DB_PATH}"
database_url = os.environ.setdefault("DATABASE_URL", DEFAULT_TEST_DATABASE_URL)
os.environ.setdefault("ENV", "test")

if database_url == DEFAULT_TEST_DATABASE_URL and TEST_DB_PATH.exists():
    TEST_DB_PATH.unlink(missing_ok=True)

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


class CompatTestClient:
    __test__ = False

    def __init__(
        self,
        app,
        base_url: str = "http://testserver",
        headers: dict[str, str] | None = None,
        cookies=None,
        follow_redirects: bool = True,
        **_kwargs,
    ) -> None:
        self.app = app
        self.base_url = base_url
        self.headers = headers
        self.cookies = cookies
        self.follow_redirects = follow_redirects

    async def _do_request(self, method: str, url: str, **kwargs):
        async with AsyncClient(
            transport=ASGITransport(app=self.app),
            base_url=self.base_url,
            headers=self.headers,
            cookies=self.cookies,
            follow_redirects=self.follow_redirects,
        ) as client:
            response = await client.request(method, url, **kwargs)
            self.cookies = client.cookies
            return response

    def request(self, method: str, url: str, **kwargs):
        import asyncio

        return asyncio.run(self._do_request(method, url, **kwargs))

    def get(self, url: str, **kwargs):
        return self.request("GET", url, **kwargs)

    def post(self, url: str, **kwargs):
        return self.request("POST", url, **kwargs)

    def put(self, url: str, **kwargs):
        return self.request("PUT", url, **kwargs)

    def patch(self, url: str, **kwargs):
        return self.request("PATCH", url, **kwargs)

    def delete(self, url: str, **kwargs):
        return self.request("DELETE", url, **kwargs)

    @contextmanager
    def stream(self, method: str, url: str, **kwargs):
        response = self.request(method, url, **kwargs)
        yield response

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


fastapi.testclient.TestClient = CompatTestClient
starlette.testclient.TestClient = CompatTestClient

from app.db.bootstrap import initialize_database  # noqa: E402
from app.db.session import Base, engine  # noqa: E402

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)
initialize_database()

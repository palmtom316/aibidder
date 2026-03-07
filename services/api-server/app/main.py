from contextlib import asynccontextmanager
import logging
from time import perf_counter
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.auth import router as auth_router
from app.api.routes.health import router as health_router
from app.api.routes.historical_bids import router as historical_bids_router
from app.api.routes.projects import router as projects_router
from app.api.routes.runtime_settings import router as runtime_settings_router
from app.api.routes.workbench import router as workbench_router
from app.core.config import settings
from app.db.bootstrap import initialize_database

request_logger = logging.getLogger("aibidder.request")

initialize_database()


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_database()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router)
app.include_router(health_router)
app.include_router(historical_bids_router)
app.include_router(projects_router)
app.include_router(runtime_settings_router)
app.include_router(workbench_router)


@app.middleware("http")
async def add_request_observability(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", uuid4().hex)
    request.state.request_id = request_id
    started_at = perf_counter()

    try:
        response = await call_next(request)
    except Exception:
        duration_ms = round((perf_counter() - started_at) * 1000, 2)
        request_logger.exception(
            "request.failed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": 500,
                "duration_ms": duration_ms,
            },
        )
        raise

    duration_ms = round((perf_counter() - started_at) * 1000, 2)
    response.headers["X-Request-ID"] = request_id
    request_logger.info(
        "request.completed",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": duration_ms,
        },
    )
    return response


@app.get("/")
def root() -> dict[str, str]:
    return {"service": settings.app_name, "status": "running"}

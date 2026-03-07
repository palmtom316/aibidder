# aibidder

AI Bid Writing Platform (Phase 1 bootstrap + review remediations).

## Project Layout

- `services/api-server`: FastAPI gateway and business APIs
- `services/worker`: Celery-compatible background worker scaffold
- `src/frontend`: Next.js frontend scaffold
- `docs`: requirements, plans, and review artifacts

## Quick Start

1. Copy envs:
   - `cp .env.example .env`
2. Start local stack with migration:
   - `docker compose up -d --build migrate api worker web`
3. API health check:
   - `curl -sS http://localhost:8080/health`
4. Frontend console:
   - open `http://localhost:13000`

Local default host ports are parameterized to avoid conflicts:

- web: `13000`
- api: `8080`
- postgres: `15432`
- redis: `16379`
- minio api: `19000`
- minio console: `19001`

## What Changed in This Remediation Pass

- Added Alembic baseline migration and `migrate` compose service
- Defaulted non-test local runtime to PostgreSQL instead of SQLite
- Added Phase 1 core tables: requirements, constraints, generated sections, bindings, issues, audit logs, rendered outputs, and enterprise fact tables
- Added PostgreSQL FTS migration objects for `evidence_units` and `historical_bid_sections`
- Added refresh-token auth flow, login rate limiting, and startup protection for default production JWT secrets
- Added structured audit logging for login, project creation, evidence rebuild, upload, historical import, and leakage verification
- Added parser support for DOCX tables and optional `pypdf`-based PDF extraction
- Added API list pagination with `limit` / `offset` and `X-Total-Count` on scalar list endpoints
- Added Celery-compatible worker scaffold for future async ingestion wiring

## Local Integration Console

The local integration target is a console-style workbench that validates:

- login against `/api/v1/auth/login`
- project creation and document upload
- `tender` / `norm` evidence search
- historical bid import, reuse search, and leakage verification
- BYOK runtime settings with SiliconFlow defaults and role-based model selection

Default seeded users:

- `admin@example.com` / `admin123456`
- `project_manager@example.com` / `manager123456`
- `writer@example.com` / `writer123456`

## Phase 1 Constraints

- Lexical retrieval only (PostgreSQL FTS)
- No embeddings / vector DB / rerank
- OpenAI-compatible model provider abstraction
- PDF/DOCX/DOC in, template DOCX out

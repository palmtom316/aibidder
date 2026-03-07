# aibidder

AI Bid Writing Platform (Phase 1 bootstrap).

## Project Layout

- `services/api-server`: FastAPI gateway and business APIs
- `services/worker`: async background job worker scaffold
- `src/frontend`: Next.js frontend scaffold
- `docs`: requirements and implementation plans

## Quick Start

1. Copy envs:
   - `cp .env.example .env`
2. Start local infra and app containers:
   - `docker compose up -d --build`
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

Important runtime defaults for local debugging:

- API base URL: `http://localhost:8080`
- BYOK provider: `openai_compatible`
- BYOK runtime base URL: `https://api.siliconflow.cn/v1`
- OCR model: `deepseek-ai/DeepSeek-OCR`
- Navigator model: `deepseek-ai/DeepSeek-V3.2`
- Extractor model: `Qwen/Qwen3-30B-A3B-Instruct-2507`
- Writer model: `deepseek-ai/DeepSeek-V3`
- Reviewer model: `deepseek-ai/DeepSeek-R1`

## Phase 1 Constraints

- Lexical retrieval only (PostgreSQL FTS)
- No embeddings / vector DB / rerank
- OpenAI-compatible model provider abstraction
- PDF/DOCX/DOC in, template DOCX out

## Historical Bid Reuse Controls

- Historical bids are imported as managed reference assets, not fact truth sources.
- Historical ingestion reuses the document pipeline:
  - `pdf` via OCR/parser adapters
  - `docx` via structured OOXML parsing
  - `doc` via normalization to `docx` before parsing
- Historical bid processing creates:
  - document-level metadata
  - section records
  - paragraph-level reuse units
  - risk marks for legacy project names, dates, durations, personnel names, and similar fields
- Writing-time retrieval returns a sanitized `reuse_pack` only. Runtime packs exclude raw historical text and expose sanitized candidate text grouped as `safe_reuse`, `slot_reuse`, and `style_only`.
- Generated text must pass historical leakage verification before it can move forward. Leakage checks combine explicit forbidden legacy terms with the selected reuse units' recorded risk marks.

## Truth-Source Evidence Layer

- `evidence_units` are the project-scoped truth-source retrieval objects for `tender` and `norm` documents only.
- Evidence units are derived from parsed JSON artifacts and preserve `section_title`, `anchor`, and page references for later citation and verification.
- Project evidence search is available through the project APIs and remains separate from historical bid `reuse_pack` retrieval.
- `proposal` documents do not populate `evidence_units`; they stay outside the truth-source evidence layer.

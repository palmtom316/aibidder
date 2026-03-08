# Review Remediation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the still-valid remediation gaps from the 2026-03-07 review by upgrading storage, parser/search, verification persistence, SSE progress streaming, and the oversized frontend workbench page.

**Architecture:** Keep the current monolith and public APIs compatible while extracting shared abstractions underneath. Backend changes focus on adapter layers and tighter persistence wiring; frontend changes focus on view decomposition rather than introducing a new state library.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, PostgreSQL FTS, Celery, Next.js, React, TypeScript.

---

### Task 1: Add storage backend abstraction

**Files:**
- Modify: `services/api-server/app/core/config.py`
- Modify: `services/api-server/app/core/storage.py`
- Modify: `services/api-server/app/api/routes/projects.py`
- Modify: `services/api-server/app/api/routes/workbench.py`
- Test: `services/api-server/tests/test_storage_backend.py`

1. Write failing tests for local backend behavior and MinIO backend selection.
2. Run the storage tests and confirm failure.
3. Implement `StorageBackend`, `LocalStorageBackend`, and `MinioStorageBackend` with a shared accessor.
4. Update downloads and saves to use the storage facade.
5. Re-run focused tests.

### Task 2: Upgrade PDF ingestion failure model and OCR adapter hook

**Files:**
- Modify: `services/api-server/app/core/config.py`
- Modify: `services/api-server/app/core/document_parser.py`
- Modify: `services/api-server/app/core/document_ingestion.py`
- Test: `services/api-server/tests/test_document_parser.py`
- Test: `services/api-server/tests/test_project_document_lifecycle.py`

1. Write failing tests for OCR fallback invocation and structured parse error codes.
2. Run focused parser/ingestion tests and confirm failure.
3. Add OCR adapter hook, optional config, and structured parse failure payloads.
4. Re-run focused tests.

### Task 3: Add historical text search with FTS fallback

**Files:**
- Modify: `services/api-server/app/services/historical_search.py`
- Modify: `services/api-server/app/api/routes/historical_bids.py`
- Test: `services/api-server/tests/test_historical_search.py`

1. Write failing tests for `q` text search on historical sections/reuse retrieval.
2. Run focused historical search tests and confirm failure.
3. Implement PostgreSQL FTS / SQLite fallback search.
4. Re-run focused tests.

### Task 4: Persist verification issues and stronger evidence bindings

**Files:**
- Modify: `services/api-server/app/services/generation_pipeline.py`
- Modify: `services/api-server/app/services/review_pipeline.py`
- Modify: `services/api-server/app/api/routes/workbench.py`
- Test: `services/api-server/tests/test_workbench_generation_approval.py`
- Test: `services/api-server/tests/test_workbench_review_remediation.py`
- Test: `services/api-server/tests/test_workbench_pipeline.py`

1. Write failing tests that assert `verification_issues` are created.
2. Write failing tests that assert evidence bindings keep `evidence_unit_id` when resolvable.
3. Run focused workbench tests and confirm failure.
4. Implement minimal persistence changes.
5. Re-run focused tests.

### Task 5: Make SSE endpoints stream live status snapshots

**Files:**
- Modify: `services/api-server/app/api/routes/workbench.py`
- Test: `services/api-server/tests/test_async_workbench_pipelines.py`

1. Write failing tests that read multiple SSE events until terminal state.
2. Run focused async pipeline tests and confirm failure.
3. Implement polling event stream helper.
4. Re-run focused tests.

### Task 6: Split frontend workbench views

**Files:**
- Create: `src/frontend/components/workspace-views/*.tsx`
- Modify: `src/frontend/app/page.tsx`
- Test/Verify: `src/frontend/package.json`

1. Extract module render blocks into dedicated components with current props.
2. Keep page shell responsible only for state, routing, and top-level layout.
3. Run `npm run build` to verify the refactor.

### Task 7: Final verification

**Files:**
- Verify: `services/api-server/tests/*`
- Verify: `src/frontend/*`
- Update: `docs/2026-03-07-module-restructuring-walkthrough.md` if behavior changed materially.

1. Run focused backend tests touched by this work.
2. Run broader backend test suite.
3. Run frontend build.
4. Summarize remaining gaps honestly if any verification fails.

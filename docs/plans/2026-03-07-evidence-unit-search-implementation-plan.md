# Evidence Unit Search Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a narrow Phase 1 truth-source evidence layer for `tender` and `norm` documents, including extraction, listing, and project-scoped lexical search.

**Architecture:** Reuse parsed JSON artifacts from the existing document ingestion flow, persist derived `evidence_units` per document version, and expose project APIs for rebuild, listing, and search. Keep `proposal` outside this layer so historical reuse and truth-source evidence remain separate.

**Tech Stack:** FastAPI, SQLAlchemy, SQLite/PostgreSQL-compatible queries, pytest, existing document ingestion and storage services

---

### Task 1: Evidence Unit Model and Rebuild Service

**Files:**
- Modify: `services/api-server/app/db/models.py`
- Create: `services/api-server/app/services/evidence_unit_builder.py`
- Create: `services/api-server/app/schemas/evidence.py`
- Test: `services/api-server/tests/test_evidence_unit_rebuild.py`

**Step 1: Write the failing test**

Add tests that:
- rebuild evidence units for a parsed `tender` document
- create section and paragraph units with section title, anchor, and page references
- skip or reject `proposal` documents for truth-source evidence rebuild

**Step 2: Run test to verify it fails**

Run: `./.venv/bin/pytest -q services/api-server/tests/test_evidence_unit_rebuild.py`
Expected: FAIL because `evidence_units` storage and rebuild service do not exist

**Step 3: Write minimal implementation**

Implement:
- `evidence_units` model
- `EvidenceUnitResponse` schema
- rebuild service that:
  - reads the latest parsed JSON artifact for a document
  - deletes prior units for the latest `document_version_id`
  - creates one `section_summary` per parsed section
  - creates paragraph units from section content
  - only allows `tender` and `norm`

**Step 4: Run test to verify it passes**

Run: `./.venv/bin/pytest -q services/api-server/tests/test_evidence_unit_rebuild.py`
Expected: PASS

**Step 5: Commit**

```bash
git add services/api-server/app/db/models.py services/api-server/app/services/evidence_unit_builder.py services/api-server/app/schemas/evidence.py services/api-server/tests/test_evidence_unit_rebuild.py
git commit -m "feat: add evidence unit rebuild service"
```

### Task 2: Evidence Unit Rebuild and List APIs

**Files:**
- Modify: `services/api-server/app/api/routes/projects.py`
- Modify: `services/api-server/app/main.py`
- Modify: `services/api-server/app/schemas/project.py`
- Modify: `services/api-server/app/schemas/evidence.py`
- Test: `services/api-server/tests/test_evidence_unit_rebuild.py`

**Step 1: Write the failing test**

Extend tests to:
- call `POST /api/v1/projects/{project_id}/documents/{document_id}/rebuild-evidence-units`
- call `GET /api/v1/projects/{project_id}/documents/{document_id}/evidence-units`
- verify only project members can access those endpoints

**Step 2: Run test to verify it fails**

Run: `./.venv/bin/pytest -q services/api-server/tests/test_evidence_unit_rebuild.py -k api`
Expected: FAIL because rebuild/list endpoints do not exist

**Step 3: Write minimal implementation**

Implement:
- document-scoped rebuild endpoint
- document-scoped list endpoint
- project membership checks
- response serialization for evidence units

**Step 4: Run test to verify it passes**

Run: `./.venv/bin/pytest -q services/api-server/tests/test_evidence_unit_rebuild.py -k api`
Expected: PASS

**Step 5: Commit**

```bash
git add services/api-server/app/api/routes/projects.py services/api-server/app/main.py services/api-server/app/schemas/project.py services/api-server/app/schemas/evidence.py services/api-server/tests/test_evidence_unit_rebuild.py
git commit -m "feat: add evidence unit rebuild and list APIs"
```

### Task 3: Project Evidence Search API

**Files:**
- Create: `services/api-server/app/services/evidence_search.py`
- Modify: `services/api-server/app/api/routes/projects.py`
- Modify: `services/api-server/app/schemas/evidence.py`
- Test: `services/api-server/tests/test_evidence_search.py`

**Step 1: Write the failing test**

Add tests that:
- search evidence units within a project by query text
- optionally filter by `document_type`
- return filename, anchor, section title, page refs, and content
- exclude `proposal` uploads from search results even when text matches

**Step 2: Run test to verify it fails**

Run: `./.venv/bin/pytest -q services/api-server/tests/test_evidence_search.py`
Expected: FAIL because evidence search service and endpoint do not exist

**Step 3: Write minimal implementation**

Implement:
- project-scoped lexical search over `evidence_units`
- optional `document_type` filter
- deterministic ordering for local tests
- `GET /api/v1/projects/{project_id}/evidence/search`

Use SQLAlchemy queries compatible with SQLite local tests.

**Step 4: Run test to verify it passes**

Run: `./.venv/bin/pytest -q services/api-server/tests/test_evidence_search.py`
Expected: PASS

**Step 5: Commit**

```bash
git add services/api-server/app/services/evidence_search.py services/api-server/app/api/routes/projects.py services/api-server/app/schemas/evidence.py services/api-server/tests/test_evidence_search.py
git commit -m "feat: add project evidence search API"
```

### Task 4: Upload Integration for Truth-Source Evidence

**Files:**
- Modify: `services/api-server/app/api/routes/projects.py`
- Modify: `services/api-server/app/core/document_ingestion.py`
- Modify: `services/api-server/app/services/evidence_unit_builder.py`
- Test: `services/api-server/tests/test_project_document_lifecycle.py`
- Test: `services/api-server/tests/test_evidence_search.py`

**Step 1: Write the failing test**

Add tests that:
- uploading a parsed `tender` document automatically makes evidence units searchable
- uploading a `norm` document does the same
- uploading a `proposal` document does not populate `evidence_units`

**Step 2: Run test to verify it fails**

Run: `./.venv/bin/pytest -q services/api-server/tests/test_project_document_lifecycle.py -k evidence`
Expected: FAIL because upload flow does not rebuild evidence units

**Step 3: Write minimal implementation**

Implement:
- upload-path hook that rebuilds evidence units after successful parse for `tender` and `norm`
- no-op behavior for `proposal`
- any small service helpers needed to keep route logic readable

**Step 4: Run test to verify it passes**

Run: `./.venv/bin/pytest -q services/api-server/tests/test_project_document_lifecycle.py -k evidence`
Expected: PASS

**Step 5: Commit**

```bash
git add services/api-server/app/api/routes/projects.py services/api-server/app/core/document_ingestion.py services/api-server/app/services/evidence_unit_builder.py services/api-server/tests/test_project_document_lifecycle.py services/api-server/tests/test_evidence_search.py
git commit -m "feat: auto-build evidence units for truth-source documents"
```

### Task 5: Full Regression and Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/plans/2026-03-06-phase1-implementation-plan.md`
- Test: `services/api-server/tests/test_evidence_unit_rebuild.py`
- Test: `services/api-server/tests/test_evidence_search.py`
- Test: `services/api-server/tests/test_project_document_lifecycle.py`
- Test: `services/api-server/tests`

**Step 1: Write the missing checks**

Review new evidence-unit behavior and ensure coverage exists for:
- truth-source boundary (`tender/norm` only)
- document-level rebuild replacement
- traceable search responses

Add missing tests only where gaps remain.

**Step 2: Run targeted tests**

Run: `./.venv/bin/pytest -q services/api-server/tests/test_evidence_unit_rebuild.py services/api-server/tests/test_evidence_search.py services/api-server/tests/test_project_document_lifecycle.py`
Expected: PASS

**Step 3: Run full API suite**

Run: `./.venv/bin/pytest -q services/api-server/tests`
Expected: PASS

**Step 4: Update docs**

Update project docs to reflect:
- `evidence_units` scope and truth-source boundary
- project evidence search behavior
- separation between `evidence_pack` and historical `reuse_pack`

**Step 5: Commit**

```bash
git add README.md docs/plans/2026-03-06-phase1-implementation-plan.md services/api-server/tests
git commit -m "docs: describe evidence unit truth-source layer"
```

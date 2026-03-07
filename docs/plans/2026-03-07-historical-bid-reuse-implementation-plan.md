# Historical Bid Reuse Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Phase 1 historical-bid ingestion and constrained reuse pipeline that lets historical proposals participate in drafting without becoming fact truth sources.

**Architecture:** Reuse the existing document ingestion foundation for file storage and parsed artifacts, then add a dedicated historical-proposal semantic layer with document, section, reuse-unit, and risk-mark records. Writing-time integration must keep `constraint_pack`, `evidence_pack`, and historical reuse materials separate, and must sanitize historical candidates before they can influence drafting.

**Tech Stack:** FastAPI, SQLAlchemy, PostgreSQL or SQLite for local dev, pytest, existing document parser and storage layers, lexical retrieval with PostgreSQL FTS-compatible fields

---

### Task 1: Historical Bid Document Base

**Files:**
- Modify: `services/api-server/app/db/models.py`
- Modify: `services/api-server/app/db/bootstrap.py`
- Modify: `services/api-server/app/api/routes/projects.py`
- Create: `services/api-server/app/api/routes/historical_bids.py`
- Create: `services/api-server/app/schemas/historical_bid.py`
- Modify: `services/api-server/app/main.py`
- Test: `services/api-server/tests/test_historical_bid_ingestion.py`

**Step 1: Write the failing test**

Add a test that:
- uploads or promotes a parsed document as a historical bid
- stores light metadata
- lists the historical bid through a dedicated API

**Step 2: Run test to verify it fails**

Run: `./.venv/bin/pytest -q services/api-server/tests/test_historical_bid_ingestion.py -k import`
Expected: FAIL because historical bid schema, route, or model does not exist

**Step 3: Write minimal implementation**

Implement:
- `historical_bid_documents` model
- request and response schemas
- `POST /api/v1/historical-bids/import`
- `GET /api/v1/historical-bids`

Keep required metadata minimal:
- `source_type`
- `project_type`
- `region`
- `year`
- `is_recommended`

**Step 4: Run test to verify it passes**

Run: `./.venv/bin/pytest -q services/api-server/tests/test_historical_bid_ingestion.py -k import`
Expected: PASS

**Step 5: Commit**

```bash
git add services/api-server/app/db/models.py services/api-server/app/api/routes/historical_bids.py services/api-server/app/schemas/historical_bid.py services/api-server/app/main.py services/api-server/tests/test_historical_bid_ingestion.py
git commit -m "feat: add historical bid document ingestion"
```

### Task 2: Historical Section Extraction

**Files:**
- Modify: `services/api-server/app/db/models.py`
- Create: `services/api-server/app/services/historical_bid_ingestion.py`
- Create: `services/api-server/app/services/section_classifier.py`
- Modify: `services/api-server/app/api/routes/historical_bids.py`
- Test: `services/api-server/tests/test_historical_bid_ingestion.py`

**Step 1: Write the failing test**

Add a test that:
- imports a historical bid from a parsed DOCX artifact
- rebuilds sections
- returns section records with `title`, `section_path`, `section_type`, and `anchor`

**Step 2: Run test to verify it fails**

Run: `./.venv/bin/pytest -q services/api-server/tests/test_historical_bid_ingestion.py -k sections`
Expected: FAIL because section extraction records do not exist

**Step 3: Write minimal implementation**

Implement:
- `historical_bid_sections` model
- section rebuild service using existing parsed JSON artifact
- rule-based `section_type` classification from headings and path text
- `GET /api/v1/historical-bids/{id}/sections`
- `POST /api/v1/historical-bids/{id}/rebuild-sections`

Use rules only. Do not add model-based classification in this task.

**Step 4: Run test to verify it passes**

Run: `./.venv/bin/pytest -q services/api-server/tests/test_historical_bid_ingestion.py -k sections`
Expected: PASS

**Step 5: Commit**

```bash
git add services/api-server/app/db/models.py services/api-server/app/services/historical_bid_ingestion.py services/api-server/app/services/section_classifier.py services/api-server/app/api/routes/historical_bids.py services/api-server/tests/test_historical_bid_ingestion.py
git commit -m "feat: add historical bid section extraction"
```

### Task 3: Reuse Units and Risk Marks

**Files:**
- Modify: `services/api-server/app/db/models.py`
- Create: `services/api-server/app/services/reuse_unit_builder.py`
- Create: `services/api-server/app/services/risk_marker.py`
- Modify: `services/api-server/app/api/routes/historical_bids.py`
- Test: `services/api-server/tests/test_historical_bid_reuse_units.py`

**Step 1: Write the failing test**

Add a test that:
- rebuilds reuse units from a historical section
- detects risky legacy terms such as project names, dates, durations, or personnel names
- stores `sanitized_text`
- assigns one of `safe_reuse`, `slot_reuse`, or `style_only`

**Step 2: Run test to verify it fails**

Run: `./.venv/bin/pytest -q services/api-server/tests/test_historical_bid_reuse_units.py`
Expected: FAIL because reuse-unit and risk-mark storage do not exist

**Step 3: Write minimal implementation**

Implement:
- `historical_reuse_units` model
- `historical_risk_marks` model
- paragraph-level reuse-unit extraction from section text
- rule-based risk detection for:
  - project names
  - owner names
  - money
  - date
  - duration
  - person names
  - qualification codes
- `sanitized_text` generation using replacement tokens
- initial `reuse_mode` assignment using simple risk-density rules

**Step 4: Run test to verify it passes**

Run: `./.venv/bin/pytest -q services/api-server/tests/test_historical_bid_reuse_units.py`
Expected: PASS

**Step 5: Commit**

```bash
git add services/api-server/app/db/models.py services/api-server/app/services/reuse_unit_builder.py services/api-server/app/services/risk_marker.py services/api-server/app/api/routes/historical_bids.py services/api-server/tests/test_historical_bid_reuse_units.py
git commit -m "feat: add historical bid reuse units and sanitization"
```

### Task 4: Historical Search and Reuse Pack Assembly

**Files:**
- Create: `services/api-server/app/services/historical_search.py`
- Create: `services/api-server/app/services/reuse_pack_builder.py`
- Modify: `services/api-server/app/api/routes/historical_bids.py`
- Test: `services/api-server/tests/test_historical_search.py`

**Step 1: Write the failing test**

Add tests that:
- search reuse units by `project_type` and `section_type`
- exclude high-risk raw text from runtime output
- return separated `safe_reuse`, `slot_reuse`, and `style_only` packs

**Step 2: Run test to verify it fails**

Run: `./.venv/bin/pytest -q services/api-server/tests/test_historical_search.py`
Expected: FAIL because historical search and reuse-pack services do not exist

**Step 3: Write minimal implementation**

Implement:
- lexical search over `historical_bid_sections` and `historical_reuse_units`
- filtering by `project_type`, `section_type`, `source_type`, and recommendation flag
- reuse-pack builder returning:
  - `safe_reuse`
  - `slot_reuse`
  - `style_only`

Do not build vector search or rerank logic.

**Step 4: Run test to verify it passes**

Run: `./.venv/bin/pytest -q services/api-server/tests/test_historical_search.py`
Expected: PASS

**Step 5: Commit**

```bash
git add services/api-server/app/services/historical_search.py services/api-server/app/services/reuse_pack_builder.py services/api-server/app/api/routes/historical_bids.py services/api-server/tests/test_historical_search.py
git commit -m "feat: add historical bid search and reuse packs"
```

### Task 5: Writing-Time Historical Leakage Verification

**Files:**
- Create: `services/api-server/app/services/historical_leakage_checker.py`
- Create: `services/api-server/app/schemas/writing_runtime.py`
- Modify: `services/api-server/app/api/routes/projects.py`
- Test: `services/api-server/tests/test_historical_leakage_checker.py`

**Step 1: Write the failing test**

Add tests that:
- verify a generated section fails when legacy project names or other risky terms remain
- verify the checker passes when the draft uses sanitized or current-project replacements only

**Step 2: Run test to verify it fails**

Run: `./.venv/bin/pytest -q services/api-server/tests/test_historical_leakage_checker.py`
Expected: FAIL because leakage verification does not exist

**Step 3: Write minimal implementation**

Implement:
- runtime schema for `history_candidate_pack`, `reuse_pack`, and `verification_pack`
- leakage checker that scans generated text against:
  - recorded legacy raw values
  - forbidden historical terms
  - required evidence-backed slot values
- `POST /api/v1/projects/{project_id}/sections/{section_id}/verify-historical-leakage`

Do not attempt full section drafting in this task. Only add the verification step and runtime pack schema.

**Step 4: Run test to verify it passes**

Run: `./.venv/bin/pytest -q services/api-server/tests/test_historical_leakage_checker.py`
Expected: PASS

**Step 5: Commit**

```bash
git add services/api-server/app/services/historical_leakage_checker.py services/api-server/app/schemas/writing_runtime.py services/api-server/app/api/routes/projects.py services/api-server/tests/test_historical_leakage_checker.py
git commit -m "feat: add historical leakage verification"
```

### Task 6: Full Regression and Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/plans/2026-03-06-phase1-implementation-plan.md`
- Test: `services/api-server/tests/test_historical_bid_ingestion.py`
- Test: `services/api-server/tests/test_historical_bid_reuse_units.py`
- Test: `services/api-server/tests/test_historical_search.py`
- Test: `services/api-server/tests/test_historical_leakage_checker.py`
- Test: `services/api-server/tests/test_project_document_lifecycle.py`

**Step 1: Write the failing or missing checks**

Review all new historical-bid behaviors and ensure each has:
- one focused test
- one regression path
- one explicit leakage-control check

Add missing tests only where coverage is absent.

**Step 2: Run targeted tests**

Run: `./.venv/bin/pytest -q services/api-server/tests/test_historical_bid_ingestion.py services/api-server/tests/test_historical_bid_reuse_units.py services/api-server/tests/test_historical_search.py services/api-server/tests/test_historical_leakage_checker.py`
Expected: PASS

**Step 3: Run full API suite**

Run: `./.venv/bin/pytest -q services/api-server/tests`
Expected: PASS

**Step 4: Update docs**

Update project docs to reflect:
- historical bid ingestion scope
- truth-source boundary
- reuse-pack and leakage-verification behavior

**Step 5: Commit**

```bash
git add README.md docs/plans/2026-03-06-phase1-implementation-plan.md services/api-server/tests
git commit -m "docs: describe historical bid reuse controls"
```

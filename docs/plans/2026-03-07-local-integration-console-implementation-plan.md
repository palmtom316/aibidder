# Local Integration Console Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a local integration console that can start with frontend, backend, and database services and exercise the current project, evidence, and historical-bid APIs end to end.

**Architecture:** Keep the backend API surface mostly intact, add only minimal runtime settings and CORS support, and build a single-route Next.js console that drives existing APIs. The first milestone prioritizes operational coverage over final UX polish.

**Tech Stack:** Docker Compose, FastAPI, Next.js App Router, React client components, local browser storage, pytest, lightweight frontend integration helpers

---

### Task 1: Local Stack Wiring and Runtime Config Baseline

**Files:**
- Modify: `docker-compose.yml`
- Modify: `.env.example`
- Modify: `services/api-server/app/core/config.py`
- Modify: `services/api-server/app/main.py`
- Modify: `README.md`
- Test: `services/api-server/tests/test_health.py`

**Step 1: Write the failing test**

Add or extend a test that verifies:
- backend app can expose CORS headers for configured frontend origins
- runtime config fields for provider/base URL/model defaults are loaded from settings

**Step 2: Run test to verify it fails**

Run: `./.venv/bin/pytest -q services/api-server/tests/test_health.py -k cors`
Expected: FAIL because CORS/runtime settings are not fully wired

**Step 3: Write minimal implementation**

Implement:
- frontend API URL env wiring in compose
- backend CORS settings
- backend runtime config defaults for BYOK role model matrix
- README local startup notes

**Step 4: Run test to verify it passes**

Run: `./.venv/bin/pytest -q services/api-server/tests/test_health.py -k cors`
Expected: PASS

**Step 5: Commit**

```bash
git add docker-compose.yml .env.example services/api-server/app/core/config.py services/api-server/app/main.py services/api-server/tests/test_health.py README.md
git commit -m "chore: wire local integration runtime settings"
```

### Task 2: Backend Debug Runtime Settings and Connectivity API

**Files:**
- Create: `services/api-server/app/api/routes/runtime_settings.py`
- Create: `services/api-server/app/schemas/runtime_settings.py`
- Modify: `services/api-server/app/main.py`
- Test: `services/api-server/tests/test_runtime_settings.py`

**Step 1: Write the failing test**

Add tests that:
- fetch current runtime defaults for provider/base URL/role models
- accept a runtime connectivity check payload
- return a stable debug response without persisting secrets

**Step 2: Run test to verify it fails**

Run: `./.venv/bin/pytest -q services/api-server/tests/test_runtime_settings.py`
Expected: FAIL because runtime settings route does not exist

**Step 3: Write minimal implementation**

Implement:
- `GET /api/v1/runtime-settings`
- `POST /api/v1/runtime-settings/connectivity-check`
- schema for role-based model config
- lightweight mock or HTTP-based connectivity response path suitable for local debugging

**Step 4: Run test to verify it passes**

Run: `./.venv/bin/pytest -q services/api-server/tests/test_runtime_settings.py`
Expected: PASS

**Step 5: Commit**

```bash
git add services/api-server/app/api/routes/runtime_settings.py services/api-server/app/schemas/runtime_settings.py services/api-server/app/main.py services/api-server/tests/test_runtime_settings.py
git commit -m "feat: add runtime settings debug API"
```

### Task 3: Frontend API Client and Auth/Project/Document Console

**Files:**
- Create: `src/frontend/lib/api.ts`
- Create: `src/frontend/lib/session.ts`
- Modify: `src/frontend/app/page.tsx`
- Modify: `src/frontend/app/layout.tsx`
- Create: `src/frontend/app/globals.css`
- Test: `src/frontend` build or typecheck command

**Step 1: Write the failing check**

Add a build/typecheck check that fails because:
- the frontend does not yet have API helpers
- the page does not support login/project/document flows

**Step 2: Run check to verify it fails**

Run: `cd src/frontend && npm run build`
Expected: FAIL or missing functionality baseline

**Step 3: Write minimal implementation**

Implement:
- API helper with auth header support
- browser session token storage
- single-page console for:
  - login
  - project list
  - create project
  - upload document
  - document list

**Step 4: Run check to verify it passes**

Run: `cd src/frontend && npm run build`
Expected: PASS

**Step 5: Commit**

```bash
git add src/frontend/lib/api.ts src/frontend/lib/session.ts src/frontend/app/page.tsx src/frontend/app/layout.tsx src/frontend/app/globals.css
git commit -m "feat: add local integration console shell"
```

### Task 4: Evidence and Historical Bid Panels

**Files:**
- Modify: `src/frontend/app/page.tsx`
- Create: optional helper files under `src/frontend/components/`
- Test: `src/frontend` build command

**Step 1: Write the failing check**

Add coverage or manual assertions for console sections that need:
- evidence search
- document evidence unit inspection
- historical bid import
- rebuild sections/reuse units
- reuse search
- leakage verify

**Step 2: Run check to verify it fails**

Run: `cd src/frontend && npm run build`
Expected: FAIL or missing panels/workflow

**Step 3: Write minimal implementation**

Implement:
- evidence panel bound to current project
- historical bids panel with debugging actions
- result cards and response viewers for current APIs

**Step 4: Run check to verify it passes**

Run: `cd src/frontend && npm run build`
Expected: PASS

**Step 5: Commit**

```bash
git add src/frontend/app/page.tsx src/frontend/components
git commit -m "feat: add evidence and historical bid console panels"
```

### Task 5: BYOK Settings Panel and End-to-End Local Verification

**Files:**
- Modify: `src/frontend/app/page.tsx`
- Modify: `README.md`
- Modify: `docker-compose.yml`
- Test: `services/api-server/tests`
- Test: `src/frontend` build

**Step 1: Write the missing checks**

Ensure there is coverage or documented manual verification for:
- BYOK settings visibility
- role model defaults
- local startup sequence
- minimum local flow validation

**Step 2: Run targeted verification**

Run:
- `./.venv/bin/pytest -q services/api-server/tests`
- `cd src/frontend && npm run build`

Expected: PASS

**Step 3: Run local stack verification**

Run:
- `docker compose up -d --build`
- `curl -sS http://localhost:8080/health`
- `curl -sS http://localhost:3000`

Expected:
- services reachable
- frontend renders
- API healthy

**Step 4: Update docs**

Document:
- local startup steps
- BYOK/runtime settings usage
- supported first-pass UI flows

**Step 5: Commit**

```bash
git add README.md docker-compose.yml src/frontend/app/page.tsx
git commit -m "docs: describe local integration console workflow"
```

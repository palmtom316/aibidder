# Local Integration Console Design

**Context**

This design defines the first end-to-end local integration milestone for the AI bid writing platform.

The target is not a polished product UI. The target is a working local stack where frontend, backend, and database can be started together and used to exercise the current Phase 1 vertical slices:

- authentication
- projects and document upload
- truth-source evidence search
- historical bid import and constrained reuse debugging
- BYOK and role-based model settings for local experimentation

---

## 1. Design Goals

- Make `docker compose up -d --build` sufficient to start frontend, backend, and supporting services for local testing.
- Provide a frontend console that can drive the currently implemented backend APIs without manual curl work.
- Expose BYOK and role-based model defaults so local debugging does not depend on hardcoded providers.
- Keep the first UI intentionally narrow and operational rather than brand-heavy.

## 2. Non-Goals

- This milestone does not build the full tender decomposition workbench yet.
- This milestone does not implement final writing orchestration or DOCX export UI.
- This milestone does not add a full frontend design system.
- This milestone does not add production auth flows beyond the current token-based login path.

## 3. Minimum Local Integration Scope

The first local integration console should cover four functional areas:

1. `Login`
   - username/password login
   - token persistence in browser runtime

2. `Projects and Documents`
   - project list
   - create project
   - upload `tender`, `norm`, or `proposal`
   - view project documents

3. `Evidence`
   - search `evidence_units`
   - inspect document-level evidence units
   - validate that only `tender/norm` populate truth-source evidence

4. `Historical Bids`
   - import historical bid from an uploaded document
   - rebuild sections
   - rebuild reuse units
   - search sanitized reuse packs
   - call leakage verification for debugging

## 4. Console Information Architecture

The frontend should be a console-style single route first.

Recommended structure:

- top bar
  - environment indicator
  - current API base URL
  - current provider and key status
- left navigation
  - `Projects`
  - `Evidence`
  - `Historical Bids`
  - `Model Settings`
- main content
  - selected project details
  - upload forms
  - search panels
  - debug result panels

This should evolve later into the decomposition workbench, but the first milestone should remain operational and low-friction.

## 5. BYOK and Role Model Configuration

Local debugging must support runtime model configuration.

The frontend should provide:

- provider
- base URL
- API key
- role-based model IDs
- connectivity test action
- restore recommended defaults action

Initial defaults should assume SiliconFlow OpenAI-compatible access:

- `base_url = https://api.siliconflow.cn/v1`
- `ocr_role = deepseek-ai/DeepSeek-OCR`
- `decomposition_navigator_role = deepseek-ai/DeepSeek-V3.2`
- `decomposition_extractor_role = Qwen/Qwen3-30B-A3B-Instruct-2507`
- `writer_role = deepseek-ai/DeepSeek-V3`
- `reviewer_role = deepseek-ai/DeepSeek-R1`
- `adjudicator_role = deepseek-ai/DeepSeek-R1`

The first implementation may store these settings in browser local storage and send them to the backend only when an API call or connectivity test requires them.

## 6. Backend Integration Requirements

To support local integration cleanly, the backend should expose:

- CORS for the frontend dev origin and compose origin
- a small runtime settings/connectivity surface for BYOK testing
- stable JSON errors for invalid requests

The backend does not need a full persistent settings subsystem in this milestone. A debug-oriented runtime route is sufficient if it is clearly scoped.

## 7. Compose and Environment Expectations

The local stack should support these services together:

- `web`
- `api`
- `postgres`
- `redis`
- `minio`
- optional `worker`

The compose setup should also support:

- frontend API base URL wiring
- backend database URL wiring
- storage path stability in containers
- a predictable local startup sequence

## 8. Acceptance Criteria

- The local stack starts successfully with docker compose.
- The frontend loads and can call backend health/auth/project/document endpoints.
- A user can log in, create a project, and upload a document from the UI.
- Uploading `tender/norm` makes evidence units searchable from the UI.
- A user can import and inspect historical bid reuse data from the UI.
- BYOK settings and role model defaults are visible and editable for local debugging.

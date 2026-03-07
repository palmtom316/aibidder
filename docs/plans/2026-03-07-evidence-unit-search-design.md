# Evidence Unit Search Design

**Context**

This design defines the first truth-source evidence layer for Milestone B of the AI bid writing platform.

The scope is intentionally narrow:

- only `tender` and `norm` documents may produce `evidence_units`
- `proposal` documents do not enter this truth-source layer
- historical bid reuse remains on the separate historical-bid pipeline
- this batch builds retrieval and traceability, not drafting

---

## 1. Design Goals

- Create a stable truth-source evidence model for parsed tender and norm documents.
- Preserve source traceability through document, section, anchor, and page references.
- Provide a project-scoped evidence search API that later drafting and verification steps can reuse.
- Keep the first implementation simple enough to work on SQLite in local tests and PostgreSQL in later deployment.

## 2. Non-Goals

- This batch does not include `proposal` in truth-source evidence retrieval.
- This batch does not build an evidence-pack ranking strategy beyond simple lexical matching.
- This batch does not add embedding, vector retrieval, reranking, or semantic chunk scoring.
- This batch does not build drafting orchestration or evidence binding persistence yet.

## 3. Core Boundary

`evidence_units` are the canonical truth-source retrieval objects for Phase 1.

They may only be created from:

- `tender`
- `norm`

They may not be created from:

- `proposal`
- historical bid reuse assets

This keeps runtime boundaries explicit:

- `evidence_pack` comes from `evidence_units`
- `reuse_pack` comes from historical bid reuse units

The two layers must never be mixed at storage or runtime.

## 4. Data Model

Phase 1 should introduce a single `evidence_units` table with these core fields:

- `id`
- `organization_id`
- `project_id`
- `document_id`
- `document_version_id`
- `document_type`
- `unit_type`
- `section_title`
- `section_path`
- `anchor`
- `page_start`
- `page_end`
- `content`
- `fts_text`
- `metadata_json`
- `created_at`

Field intent:

- `document_type` must remain constrained to `tender` or `norm`
- `unit_type` starts with:
  - `section_summary`
  - `paragraph`
  - `table_text`
- `metadata_json` is reserved for parser-side details without overcomplicating the relational schema

## 5. Extraction Strategy

Extraction should reuse parsed JSON artifacts already created by the document ingestion pipeline.

For each eligible document version:

1. read the latest parsed JSON artifact
2. iterate through parsed sections
3. create one `section_summary` per section
4. split section content into paragraph evidence units
5. create `table_text` units only when the parser exposes table-like payloads

The first version may stay rule-based and conservative.

If a document version is rebuilt, its prior `evidence_units` should be fully replaced rather than diffed.

## 6. Retrieval API

The first version should expose three endpoints:

- `POST /api/v1/projects/{project_id}/documents/{document_id}/rebuild-evidence-units`
- `GET /api/v1/projects/{project_id}/documents/{document_id}/evidence-units`
- `GET /api/v1/projects/{project_id}/evidence/search?q=...`

Search results should return enough traceability to support later drafting:

- `evidence_unit_id`
- `document_id`
- `filename`
- `document_type`
- `unit_type`
- `section_title`
- `anchor`
- `page_start`
- `page_end`
- `content`

## 7. Search Behavior

Phase 1 search should stay lexical and portable.

The initial implementation may:

- filter by current project
- filter by `document_type`
- match against `fts_text` using `ilike`-style semantics in local development

This keeps SQLite tests straightforward while preserving a path to PostgreSQL FTS later.

## 8. Upload Integration

For the first working loop:

- uploading `tender` or `norm` should automatically rebuild evidence units for the created document version
- uploading `proposal` should skip evidence-unit extraction

This gives the project an immediate searchable evidence layer without introducing a separate async job dependency in the first cut.

## 9. Acceptance Criteria

- Uploading a parsed `tender` or `norm` yields searchable `evidence_units`.
- Uploading a `proposal` does not populate the truth-source evidence layer.
- Evidence search results include section and anchor traceability.
- Rebuilding evidence units replaces prior units for the same document version.
- Full API regression remains green after integration.

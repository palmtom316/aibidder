# AI Bid Writing Platform Requirements

> Standalone requirements document for starting a new project outside the current repository.
>
> Intended use: hand this document to Codex or an engineering team as the starting spec for a new implementation.

## 1. Product Goal

Build a hybrid-deployable AI bid writing platform for enterprise proposal teams.

The platform is not a generic RAG chatbot. It is a controlled writing system for tender response work. Its core job is to turn uploaded company materials, norms, prior proposals, and tender documents into:

- structured requirements checklists
- constrained draft content
- evidence-backed writing assistance
- template-driven DOCX output
- project-level collaboration and version tracking

The system must support private deployment first and preserve a future path to SaaS.

## 2. Confirmed Scope

### 2.1 Deployment Shape

- Primary target: hybrid architecture
- Phase 1 default: private deployment in enterprise environment
- Future-ready: SaaS-compatible boundaries, tenant-aware data model, OpenAI-compatible model gateway abstraction

### 2.2 Phase 1 Inputs and Outputs

- Input formats: `PDF`, `DOCX`
- Output formats: `DOCX`
- Layout strategy: fixed enterprise templates
- Final delivery model: system generates DOCX, user may do final manual adjustment in Word
- Phase 1 explicitly excludes bid pricing, quotation calculation, and price recommendation

### 2.3 User and Permission Scope

- Multi-user organization-level collaboration
- Initial roles:
  - `admin`
  - `project_manager`
  - `writer`
  - `viewer`
- No complex approval workflow in Phase 1
- Must support project collaboration, document versioning, and operation history

### 2.4 Model Strategy

- All model interfaces must be OpenAI-compatible
- Model providers may be direct vendors or relay gateways
- OCR provider options:
  - `SiliconFlow OCR`
  - `MinerU`
- Primary model routing:
  - default main model: `DeepSeek-V3.2` class
  - fallback main model: `Qwen3-32B` class
  - complex planning / long-form fallback: `GLM-5` or `Kimi-K2.5`
  - optional vision repair model: `Qwen3.5-VL-7B`
- Explicitly excluded from Phase 1 main path:
  - `embedding`
  - `rerank`

### 2.5 Search Strategy

- Phase 1 retrieval backbone: `PostgreSQL Full-Text Search / BM25-style lexical retrieval`
- No `OpenSearch` in Phase 1
- No vector retrieval in Phase 1
- OpenSearch may be introduced later only if data volume, search latency, or query complexity justifies it

### 2.6 Re-ingestion / Feedback Loop

- System-generated proposals may be re-ingested after human confirmation
- Re-ingested materials must be split into:
  - writing templates / expression assets
  - project fact snapshots
- Re-ingested content must not become fact truth by default
- Only human-approved content may enter the curated “excellent proposal” library

## 3. Primary Business Modules

### 3.1 File Upload and Processing Module

Responsibilities:

- upload `PDF` and `DOCX`
- classify document type
- parse to normalized `Markdown` and `JSON`
- extract metadata
- store original files and parsed artifacts
- prefer OCR table reconstruction for table-heavy tender pages such as BoQ, qualification tables, and deviation tables
- support re-ingestion of approved generated proposals

Supported source categories:

- norms and standards
- historical tender/proposal documents
- curated high-quality proposal examples
- company qualifications and certificates
- company project performance records
- company hard and soft assets
- personnel qualifications
- personnel performance records

### 3.2 Tender Decomposition Module

Responsibilities:

- ingest tender documents
- extract project basics
- identify qualification requirements
- identify technical requirements
- identify business requirements
- identify scoring points
- prioritize starred items, invalid-bid clauses, and other hard-fail requirements
- identify mandatory response items
- extract a minimal hard-constraint snapshot for key fields such as bid validity period, duration, quality target, project manager qualification, and certificate requirements
- generate document checklist and response checklist

Outputs:

- structured requirement tree
- response task list
- evidence requirement list
- hard-constraint and risk checklist
- writing outline suggestions

### 3.3 Proposal Generation Module

Responsibilities:

- generate section-level drafts under hard constraints
- use norms and company facts as truth sources
- use excellent / historical proposals as writing-style references only
- support iterative section rewrite
- support gap detection and missing-evidence warnings
- show source page references for generated claims

Outputs:

- draft sections
- evidence packs
- cited source references
- structured quality / compliance checks

### 3.4 Proposal Formatting Module

Responsibilities:

- render output into enterprise DOCX templates
- support cover page, table of contents, header/footer, numbering, table styles, appendix list
- merge generated content into template placeholders
- export final `DOCX`

Explicitly out of scope for Phase 1:

- WYSIWYG online editor
- free-form layout editor
- browser-grade desktop publishing

### 3.5 Project Management Module

Responsibilities:

- create and manage bid projects
- manage tender source documents and internal materials
- track decomposition results, writing progress, and versions
- track responsible users and timestamps
- maintain artifact history
- support draft comparison and rollback

## 4. Product Principles

- The platform is a controlled writing system, not a freeform AI chat toy.
- Norms and company facts are truth sources.
- Historical and excellent proposals are style sources, not truth sources, unless explicitly approved.
- Every generated statement should be traceable to a source or marked as unsupported.
- Retrieval must be explainable and reproducible.
- Prompt orchestration must be separated from business data storage.
- The system must degrade safely if a model provider is unavailable.

## 5. High-Level Architecture

### 5.1 Architectural Overview

Use a modular service architecture with clear separation between:

- ingestion and parsing
- knowledge modeling
- lexical retrieval
- agent orchestration
- document generation
- formatting
- project management

Recommended deployment units:

1. `web-app`
2. `api-gateway`
3. `document-service`
4. `knowledge-service`
5. `generation-service`
6. `formatting-service`
7. `project-service`
8. `postgres`
9. `object-storage`
10. `queue/worker`

### 5.2 Core Data Flow

1. User uploads `PDF` or `DOCX`
2. Document service stores original file
3. OCR / parser generates normalized `Markdown` and parse `JSON`
4. Knowledge service classifies the material and writes structured records
5. Lexical search indexes are updated in PostgreSQL
6. Tender decomposition builds a requirement tree and response checklist
7. Generation service calls models with tool-based retrieval
8. Formatting service renders the approved content into DOCX template
9. Approved final proposals may be re-ingested into curated libraries

## 6. Knowledge Model

### 6.1 Library Types

The system should maintain logically separate libraries:

- `norm_library`
- `tender_history_library`
- `excellent_proposal_library`
- `company_qualification_library`
- `company_performance_library`
- `company_asset_library`
- `personnel_qualification_library`
- `personnel_performance_library`
- `generated_proposal_feedback_library`

### 6.2 Truth vs Reference Separation

Truth sources:

- norms and standards
- company qualifications
- company performance records
- company assets
- personnel records

Reference-only sources:

- historical proposals
- excellent proposals
- generated proposal exemplars

### 6.3 Granularity

Recommended indexing units:

- norms: `document -> chapter -> clause -> page`
- proposals: `document -> section -> paragraph`
- fact documents: `record -> attachment -> page`
- tender requirements: `document -> requirement item -> risk tag -> evidence need`

## 7. Retrieval Strategy

### 7.1 Core Approach

Phase 1 retrieval must be lexical and structured, not vector-based.

Use:

- PostgreSQL FTS
- PostgreSQL ranking / BM25-style lexical scoring
- domain dictionary and synonym normalization for construction terminology
- explicit structured filters
- deterministic tool flows

Do not use:

- embeddings
- vector databases
- rerankers

### 7.2 Retrieval Tools Exposed to Agents

The generation layer should not receive a single generic search endpoint. It should receive multiple purpose-specific tools:

- `search_norms`
- `read_norm_clause`
- `search_company_qualifications`
- `search_company_performance`
- `search_company_assets`
- `search_personnel_records`
- `search_proposal_examples`
- `search_tender_requirements`
- `get_evidence_pack`
- `check_missing_evidence`

Retrieval should support light but high-value filters where available:

- `industry_tag`
- validity date / project date window
- mandatory vs reference-only requirement type

### 7.3 Why No Embedding / Rerank in Phase 1

- proposal writing needs precision more than fuzzy semantics
- standards numbers, clause numbers, certificates, dates, voltages, amounts, and role names are lexical / structured targets
- lexical retrieval is easier to debug, test, and audit
- OCR noise hurts vector quality disproportionately
- removing vector layers reduces moving parts, latency variance, and operator fear

## 8. AI Orchestration Strategy

### 8.1 Agent Responsibilities

Agents should be tool-using orchestrators, not memory-based answer generators.

Agent tasks:

- decompose tender requirements
- identify needed evidence
- request retrieval by library type
- draft section content under constraints
- verify generated content against source evidence
- flag unsupported claims

### 8.2 Generation Pattern

Use a strict four-stage loop:

1. `plan`
2. `retrieve`
3. `draft`
4. `verify`

Verification must check:

- missing evidence
- unsupported facts
- conflicting parameters
- expired qualifications
- absent mandatory responses
- starred or invalid-bid clauses not yet explicitly addressed

### 8.3 Suggested Prompt Discipline

- system prompts define role and hard boundaries
- task prompts define section goal and expected deliverable
- tool outputs provide structured evidence
- fact-constraint prompts must forbid invention beyond the provided evidence pack
- style prompts should enforce professional, rigorous, objective construction-writing language
- final writing prompts may use references and constraints but must not invent facts

## 9. Recommended Technology Stack

### 9.1 Backend

- `Python 3.12+`
- `FastAPI`
- `Pydantic`
- `SQLAlchemy`
- `Alembic`
- `Celery` or `RQ` or `Arq` for background jobs
- `PostgreSQL`
- `Redis` for queue/cache/locks
- `MinIO` or S3-compatible object storage

### 9.2 Frontend

- `Next.js`
- `React`
- `TypeScript`
- `Tailwind CSS`
- component library may be `shadcn/ui` or an equivalent lightweight design system

### 9.3 Document Processing

- `MinerU` or `SiliconFlow OCR`
- `python-docx`
- `docxtpl` or equivalent DOCX templating library
- optional PDF utilities for artifact inspection

### 9.4 Search and Storage

- `PostgreSQL` as primary operational database
- PostgreSQL FTS indexes on normalized searchable units
- object storage for originals, OCR artifacts, Markdown, JSON, and rendered outputs

### 9.5 Observability and Security

- structured JSON logging
- metrics and health endpoints
- audit log for sensitive actions
- role-based access control
- per-project and per-organization data boundaries
- secrets via environment or secret manager

## 10. Model Recommendations

### 10.1 Main Generation Models

- default: `DeepSeek-V3.2` class
- backup: `Qwen3-32B` class

Use for:

- tender decomposition
- draft writing
- rewriting
- section summarization
- evidence-aware response generation

### 10.2 Long-Form / Complex Planning Models

- `GLM-5`
- `Kimi-K2.5`

Use for:

- long tender decomposition
- chapter plan synthesis
- difficult cross-section consistency review

### 10.3 OCR and Vision

- parser: `MinerU` or `SiliconFlow OCR`
- optional vision repair: `Qwen3.5-VL-7B`

Use for:

- page recovery
- table repair
- OCR exception inspection

### 10.4 Interface Contract

All model integrations must use an internal provider abstraction with:

- OpenAI-compatible request/response surface
- configurable base URL
- configurable API key
- configurable model name
- per-task fallback configuration
- provider-independent retry, timeout, and logging

## 11. Data Model Guidance

Minimum entities:

- `organizations`
- `users`
- `projects`
- `project_members`
- `documents`
- `document_versions`
- `document_artifacts`
- `knowledge_items`
- `knowledge_units`
- `requirements`
- `evidence_links`
- `draft_sections`
- `rendered_outputs`
- `audit_logs`

Suggested important fields on searchable units:

- `organization_id`
- `project_id`
- `library_type`
- `document_type`
- `doc_id`
- `version_id`
- `page_no`
- `section_path`
- `clause_id`
- `standard_no`
- `industry_tag`
- `certificate_no`
- `person_name`
- `role_name`
- `project_name`
- `effective_date`
- `expiry_date`
- `is_mandatory`
- `risk_level`
- `text`
- `search_text`
- `source_locator_json`
- `metadata_json`

## 12. Phase 1 Functional Requirements

### 12.1 Upload and Ingestion

- upload `PDF` and `DOCX`
- virus / file type / size validation
- document classification
- OCR or parser conversion to Markdown and JSON
- table reconstruction for tender tables must be supported
- metadata extraction
- searchable unit generation
- lexical index refresh

### 12.2 Tender Decomposition

- parse tender requirements into structured checklist
- identify starred items, invalid-bid clauses, and mandatory response items with highest priority
- produce qualification and technical requirement groups
- extract a minimal hard-constraint snapshot for critical bid parameters
- produce writing task tree
- produce evidence request list

### 12.3 Controlled Proposal Writing

- generate by section, not one-shot whole-document generation
- each section must bind to evidence packs
- user can request rewrite by tone, detail, or emphasis
- unsupported claims must be flagged
- visible source page references must be available for generated sections
- cross-section parameter consistency must be checked before export

### 12.4 Formatting

- render to enterprise DOCX template
- preserve heading hierarchy
- generate appendix references
- support re-render after section edits

### 12.5 Project Management

- create project workspace
- track uploaded sources
- track decomposition status
- track draft versions
- track final rendered outputs

## 13. Phase 1 Non-Functional Requirements

- private deployment support
- tenant-aware data isolation
- auditable actions for uploads, generation, approvals, and exports
- deterministic retrieval and source traceability
- acceptable degraded behavior if one model provider fails
- no hard dependency on embeddings or vector DB
- retry-safe background processing

## 14. Out of Scope for Phase 1

- vector search
- rerank
- bid pricing
- quotation calculation
- price recommendation
- free-form design editor
- complex BPM approval engine
- Excel-heavy bidding workflows
- multimodal knowledge graph
- fully autonomous submission without human review

## 15. Implementation Phases

### Phase A: Foundation

- project scaffolding
- auth and RBAC
- project and document lifecycle
- OCR / parser integration
- Markdown / JSON artifact pipeline

### Phase B: Knowledge Layer

- library classification
- searchable unit extraction
- PostgreSQL FTS indexes
- domain dictionary / synonym normalization
- evidence pack assembly

### Phase C: Tender Decomposition

- tender parsing
- requirement checklist generation
- hard-constraint snapshot extraction
- starred-item / invalid-bid clause recognition
- writing task generation

### Phase D: Controlled Generation

- agent tool orchestration
- section-level drafting
- evidence verification
- cross-section consistency checking
- iterative rewrite support

### Phase E: Formatting and Delivery

- DOCX template system
- render pipeline
- export history

### Phase F: Feedback Loop

- proposal approval
- curated re-ingestion
- template asset accumulation

## 16. Codex Startup Prompts

The following prompts are intended for a fresh Codex session starting a new repository from this requirements document.

### 16.1 Project Kickoff Prompt

```text
Read this requirements document fully before proposing any code.

Project type:
- AI bid writing platform
- private deployment first, SaaS-compatible architecture later
- no embedding
- no rerank
- PostgreSQL FTS / lexical retrieval only
- OpenAI-compatible model provider abstraction

Your job:
1. derive a production-grade system design
2. break the system into services and modules
3. propose an MVP delivery plan
4. identify data model, APIs, workers, and testing strategy
5. do not implement until the design is explicit and approved

Constraints:
- inputs are PDF and DOCX
- output is DOCX
- no bid pricing, quotation calculation, or price recommendation in Phase 1
- OCR can use MinerU or SiliconFlow OCR
- default generation model is DeepSeek-V3.2 class
- fallback generation model is Qwen3-32B class
- planning fallback is GLM-5 or Kimi-K2.5
- optional vision repair is Qwen3.5-VL-7B
- fixed enterprise templates, no WYSIWYG editor
- generated proposals may be re-ingested only after human approval
```

### 16.2 Architecture Prompt

```text
Design the system architecture for this AI bid writing platform.

Focus on:
- deployment topology
- service boundaries
- database schema groups
- document ingestion and artifact flow
- lexical retrieval design using PostgreSQL FTS
- tool-based AI orchestration
- DOCX rendering pipeline
- project management boundaries

Do not suggest vector DB, embedding, or rerank in Phase 1.
Every recommendation must align with private deployment first and future SaaS compatibility.
```

### 16.3 Backend Planning Prompt

```text
Create a backend implementation plan for the platform.

Include:
- API gateway
- auth and RBAC
- document ingestion
- knowledge indexing
- tender decomposition
- generation orchestration
- formatting service
- project management APIs
- background job processing
- tests

Use Python, FastAPI, PostgreSQL, Redis, MinIO, Alembic, SQLAlchemy.
Assume all model calls are OpenAI-compatible.
```

### 16.4 Frontend Planning Prompt

```text
Create a frontend implementation plan for the platform.

Main surfaces:
- login and organization switch
- project dashboard
- upload center
- tender decomposition view
- evidence / requirement checklist view
- section writing workspace
- proposal preview and export
- project version history

Use Next.js, React, TypeScript.
Do not propose a rich text editor as Phase 1 core.
Favor workflow clarity over visual complexity.
```

### 16.5 AI Orchestration Prompt

```text
Design the AI orchestration layer for a controlled writing system.

Requirements:
- use tool-calling agents
- separate planning, retrieval, drafting, and verification
- norms and company facts are truth sources
- historical/excellent proposals are style references only
- every generated section should be backed by evidence packs
- unsupported claims must be surfaced explicitly
- fact prompts must forbid invention beyond the provided evidence pack
- style prompts must keep language professional, rigorous, and objective
- verification must explicitly check hard constraints and cross-section parameter consistency

Do not use embeddings or rerankers.
Use lexical retrieval and structured lookups only.
```

### 16.6 DOCX Rendering Prompt

```text
Design the DOCX rendering subsystem.

Requirements:
- template-based output
- cover, TOC, heading numbering, headers/footers, tables, appendices
- render from structured section data
- support rerender after edits
- allow final manual Word adjustment after export
```

## 17. Acceptance Criteria for MVP

- a user can create a project
- a user can upload tender files and internal source files
- the system can parse files into Markdown and JSON artifacts
- the system can preserve usable table structure for tender tables
- the system can generate a tender requirement checklist
- the system can identify starred items, invalid-bid clauses, and other mandatory responses
- the system can retrieve norms and company facts lexically
- the system can draft proposal sections with visible evidence references
- the system can detect expired qualifications and major cross-section parameter conflicts before export
- the system can export a template-based DOCX
- the system can store project versions and re-ingest approved final proposals

## 18. Final Recommendation

Build this as a controlled writing platform, not as a general-purpose chatbot and not as a vector-search-first RAG system.

Phase 1 should optimize for:

- explainability
- operational simplicity
- enterprise deployability
- section-level controlled generation
- evidence-backed writing

Keep vector search, rerank, and advanced semantic retrieval out of the critical path until the lexical and structured foundation is proven.

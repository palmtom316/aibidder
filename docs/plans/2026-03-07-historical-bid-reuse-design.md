# Historical Bid Reuse Design

**Context**

This design covers how historical bid documents should be ingested and how they may constrain AI-assisted writing in Phase 1 of the AI bid writing platform.

The design follows the existing product rules already stated in the project requirements:

- norms and company facts are truth sources
- historical and excellent proposals are style and structure references
- historical proposals may participate in drafting, but must not become fact truth by default
- every generated section must remain evidence-bound and constraint-checked

---

## 1. Design Goals

- Allow historical bid files to be ingested as managed assets rather than loose attachments.
- Reuse valuable writing patterns from historical proposals without allowing legacy project facts to leak into new bids.
- Keep the Phase 1 architecture lexical and structured, consistent with the current `FTS + SQL/API facts + controlled generation` direction.
- Avoid heavy manual tagging workflows that would slow adoption and require highly trained operators.

## 2. Non-Goals

- Historical proposals are not a fact truth source.
- Phase 1 does not build a full semantic knowledge graph for historical proposals.
- Phase 1 does not support one-click whole-document rewriting from a legacy proposal.
- Phase 1 does not require dense manual paragraph-by-paragraph labeling before historical documents become usable.

## 3. Core Asset Model

Historical proposals must be split into two logical layers:

- `reference layer`
  - used for structure, tone, argument order, and chapter organization
- `reuse layer`
  - used for candidate paragraphs, table skeletons, and reusable phrasing that may participate in drafting

Both layers may originate from the same historical file, but they must remain separate at runtime.

Historical proposals never enter the runtime as `evidence_pack`.
They only contribute to:

- `style_pack`
- `history_candidate_pack`
- `reuse_pack`

## 4. Runtime Control Principles

Historical content may influence AI writing only under the following hard rules:

1. `constraint_pack` has the highest priority.
2. `evidence_pack` defines current-project facts.
3. Historical proposals may only shape expression, ordering, or draft seed text.
4. Historical candidate text must be sanitized before reaching the model.
5. Generated output must be blocked if legacy project residue remains.

Priority order:

`constraints > evidence > reuse > style`

## 5. Lightweight Ingestion Strategy

Heavy manual tagging is intentionally avoided.

Phase 1 ingestion should use:

- light document-level metadata entered by the operator
- automatic section extraction
- automatic section-type classification
- automatic risk field detection
- automatic reuse-mode initialization

Required operator inputs should remain minimal:

- source type
- project type
- region
- year
- whether the sample is recommended

All deeper labeling should be automated first and refined later through feedback, not up-front labor.

## 6. Historical Writing Control Flow

The writing path for a section should follow this sequence:

1. `plan`
   - derive section scope, must-cover items, forbidden points, and required slots from tender requirements and constraint matrix
2. `retrieve`
   - build `evidence_pack` from tender clauses, norms, and company facts
   - build `history_candidate_pack` from historical reuse candidates filtered by project type and section type
3. `sanitize`
   - detect high-risk legacy facts in historical candidates
   - replace them with placeholders or downgrade the candidate to `style_only`
4. `slot_fill`
   - fill reusable placeholders only from current-project evidence and constraints
5. `draft`
   - generate section text with explicit prompt priority: constraints first, evidence second, sanitized reuse third, style last
6. `verify`
   - check evidence binding
   - check hard-constraint consistency
   - check legacy leakage
7. `output`
   - store section draft plus evidence usage and historical reuse references

This means the system does not do:

`retrieve old proposal -> send raw text to model -> accept rewritten result`

It must instead do:

`retrieve -> sanitize -> align with current evidence -> draft -> verify`

## 7. Reuse Modes

Each historical reuse unit should end up in one of three modes:

- `safe_reuse`
  - generic, low-risk content that can be rewritten safely
- `slot_reuse`
  - structurally reusable text containing project-specific fields that must be replaced from current evidence
- `style_only`
  - useful for tone or structure, but too risky to directly seed text

The first version should derive this mode automatically from section type, rule-based detection, and risk density rather than from heavy human review.

## 8. Data Model

Phase 1 should introduce four new historical-proposal tables:

- `historical_bid_documents`
  - document-level metadata and ingestion status
- `historical_bid_sections`
  - section tree, section type, and lexical retrieval text
- `historical_reuse_units`
  - paragraph or table-skeleton level reuse candidates with sanitized text
- `historical_risk_marks`
  - detected risk spans such as project names, owner names, amounts, dates, personnel names, and qualification codes

Deferred tables for later phases:

- `historical_slot_templates`
- `historical_usage_logs`

## 9. Runtime Packs

The writing runtime must keep materials separated into explicit structured packs:

- `constraint_pack`
- `evidence_pack`
- `history_candidate_pack`
- `reuse_pack`
- `verification_pack`

This separation is required to keep truth sources and reuse sources auditable and enforceable.

## 10. Implementation Path

Recommended rollout:

1. historical bid ingestion base
2. section extraction and section-type recognition
3. reuse-unit extraction and risk marking
4. historical search and reuse-pack assembly
5. writing-pipeline integration and legacy leakage verification
6. later template and feedback enhancements

Phase 1 scope should stop after:

- ingesting historical proposals
- section and reuse extraction
- sanitization
- constrained drafting integration
- leakage verification

Phase 1 should not yet include:

- dense manual tagging
- complex scoring systems
- full template DSL
- whole-document automated legacy rewriting

## 11. Acceptance Criteria

- Historical proposals can be ingested as first-class managed assets.
- Historical proposals can be filtered by light metadata and section type.
- Historical candidate units can be sanitized before they reach the model.
- Generated section text cannot rely on historical proposals as fact truth.
- Generated output is blocked if it contains legacy project residue.
- Evidence-backed writing remains the system’s default truth discipline.

## 12. Key Tradeoff

The chosen design optimizes for operational practicality over ontology purity.

It gives the team:

- low-friction ingestion
- reusable historical writing value
- strong runtime controls against leakage

while avoiding:

- expensive up-front manual labeling
- brittle governance workflows
- architectural drift away from the project’s lexical and evidence-first foundation

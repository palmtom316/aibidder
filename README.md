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

## Phase 1 Constraints

- Lexical retrieval only (PostgreSQL FTS)
- No embeddings / vector DB / rerank
- OpenAI-compatible model provider abstraction
- PDF/DOCX in, template DOCX out

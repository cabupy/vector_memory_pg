# Roadmap

This roadmap summarizes the public direction for `vector-memory-pg`.
Long-form planning notes are archived under `docs/archive/`.

Versión en español: [ROADMAP.md](./ROADMAP.md)

---

## Shipped

- PostgreSQL + pgvector storage with HNSW vector search.
- Hybrid ranking: vector similarity, full-text search, criticality and verification boosts.
- MCP server with 12 tools for search, retrieval, write, verification, deprecation, timeline, stats and reflect.
- HTTP API and local web UI at `http://localhost:3010/ui`.
- Reflect workflow for contradictions, duplicates, gaps and suggested memories.
- Docker-first setup via `vector-memory up` and `vector-memory migrate`.
- Global config via `~/.vector-memory.env` and dedicated `VECTOR_MEMORY_DATABASE_URL`.
- Multi-agent onboarding via `vector-memory init --tools`.
- `skills install` for Claude Code, Cursor, Codex, OpenCode and OpenClaw.
- Slash commands for Claude Code, OpenCode and OpenClaw.
- Memory banks via `bank`, `doc` and `manifest` commands.
- Cookbook docs for architecture decisions, known bugs, security rules and session summaries.

---

## Near Term

- Add screenshots or a short GIF of the local UI.
- Add an end-to-end demo: an agent remembers a decision and avoids repeating a known mistake.
- Expand cookbook examples for real agent workflows.
- Improve contributor-facing examples for MCP, HTTP API and CLI flows.
- Add lightweight smoke tests for critical CLI commands.

---

## Exploring

- Desktop app / tray app exploration on top of the existing CLI + worker.
- Official memory governance: review queues, approval workflow and authority levels.
- Entities and relationships extraction for richer retrieval.
- Benchmarks for retrieval quality and deprecated-memory leakage.
- Export/import workflows for JSONL or Markdown backups.

---

## Later

- GitHub, Jira, Confluence and ADR ingestion.
- Permissions and visibility by organization, project, team or role.
- Official JS/TS and Python clients if external application usage grows.
- Optional hosted/shared deployment templates.

---

## Non-Goals For Now

- Replacing PostgreSQL with a local-only store.
- Making the desktop app required for CLI or MCP usage.
- Adding heavy dependencies to the base npm package without a clear adoption benefit.

---

## Historical Notes

Older planning documents were kept for reference:

- `docs/archive/mejoras.md`
- `docs/archive/mejoras-2.md`

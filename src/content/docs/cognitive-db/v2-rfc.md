---
title: v2 RFC — Structure-Native Architecture
description: Proposed cognitive-db v2 — dissolve the engine's parallel node store into Structure, recast the engine as an intelligence filter, and incorporate the library cleanly into the module system.
sidebar:
  order: 7
  label: "v2 RFC (Structure-native)"
---

> **Status:** Accepted — Phase 1 shipped (Structure v1.16.0, 2026-07-15) · **Date:** 2026-07-15 · **Supersedes:** the v1 "engine owns `cog_node`" model
> This is a design map to redline, not an implementation. Phases 2–5 are not yet built.

## 1. Motivation

A review of the current data flow (14 Jul 2026) found heavy duplication: a single `ingest()` fans writes into three stores — the engine's `cog_node`, the module's `cog_ingest_job` (which re-stores the whole extracted graph as JSON), and, optionally, Structure's `structure_node` (a lossy copy of entities). The same content/entities/counts are persisted 2–3× per ingest, and `cog_ingest_mapping` is vestigial (never read at ingest).

The root cause is that **two "everything is a node" stores exist in parallel** — `cog_node` (the engine) and `structure_node` (Structure) — for what is largely the same data. The fix is not to bridge them but to **collapse to one record store and re-cast the engine as an intelligence layer over it.**

Nothing is in production, so this is the moment to do it properly.

## 2. The three layers

| Layer | Owns | Role |
|-------|------|------|
| **Structure** | `structure_node` (records) + `structure_node_type` / `structure_connection_type` (the **ontology**) + the embedding vector | The single source of truth: the database table and the schema of "what kinds of things exist and how they connect". |
| **cog-ingest** | The pipeline config (Intake → Acquisition → Preprocessing → Extraction → Actions) + presentation (tabs/widgets) | How content comes in, gets parsed, and how results surface in the app. |
| **cognitive-db** | `cog_intelligence_*` process tables (provenance log, consolidation & discovery buffers, activation weights) + embedding generation + semantic queries | The intelligence **filter**: decides *what/how* to save into Structure, **assembles** chat/working context from it, and enriches it. Owns no records — and no user-facing state. |

"John Smith" becomes **one `structure_node`** (type Person). The ontology is Structure's node/connection *types*. The engine no longer stores records — it perceives content, decides what records to create/update, and annotates them.

## 3. Why this fits Structure (grounding)

- `structure_node` is already **"everything is a node, connections are nodes"** (`fromNodeId`/`toNodeId`/`connectionType` on the row) — the engine's connection-as-node model drops straight on.
- `structure_node_type.features` is a boolean capability bag (home for `cognitiveIngest`); `structure_connection_type` already has `fromTypes`/`toTypes` = the engine's relationship-type **domain/range**.
- Node/connection **types have nullable `userId`** ("null = system/module defaults") → the engine's shared base ontology becomes **system-level types**, while user records stay `userId`-owned.
- Structure deliberately ships **no** search/embeddings today ("AI-discovered connections → cog-ingest / cognitive-db") — so a vector column is a *new, opt-in* capability, not a conflict.
- Structure already exposes a full cross-module service (`createNode`, `bulkCreateNodes`, `createConnection`, `getNodeContext`, `updateNodeMetadata` with atomic `jsonb_set`, node/connection-type CRUD) — the engine writes through this, never into another module's tables directly.

## 4. Settled decisions

1. **Embeddings** — a vector column on `structure_node`, **opt-in** (Structure adds pgvector + an HNSW index when the app enables cognitive features). Structure owns *storage*; the engine owns *generation* (its providers) and the *semantic queries* (now targeting `structure_nodes`). Rationale: search/patterns belong "at the app level," and embedding-on-the-record gives the simplest, lowest-token context assembly (one pgvector query returns the relevant records; `getNodeContext` adds the pre-built graph with no vector search at all).
2. **Raw content** — a **field on the node**, not its own type. The uploaded court doc *is* a `structure_node` (type "Court Document") with its text in a field; cog-ingest hands it to the engine to parse; it stays referable.
3. **Ontology growth** — a **configurable mode (auto / prompt / approve)**, split by level: a new node **TYPE** → *admin* approves (app schema); a new node **INSTANCE** → *user* ("create this node?") or auto (the engine is connecting the user's own data — instance creation isn't an app-admin gate).
4. **Connections** — **all in Structure as connection-nodes, tagged by origin** (`explicit` vs `discovered`) so the engine reads *both* the user's and its own. New discovered connections are written **pending** and confirmed via a promotion step (auto above a confidence threshold, or review).
5. **Engine shape** — **full dissolve.** `cog_node` is retired; Structure is the one node store. The engine keeps only `cog_intelligence_*` process tables, all keyed by `structure_node.id`.
6. **Working memory is user-facing, not engine plumbing.** "What the user is working on" and **chat context** live in Structure — a Session / Workspace / Chat node plus its active-context connections — so the app reads and drives them. The engine only *assembles* that context (semantic search + the pre-built graph) and *consolidates* it (learning from what got used); only the transient consolidation buffers stay `cog_intelligence_*`.

## 5. Concern-by-concern migration (`cog_node` → new home)

| v1 concern (in `cog_node`) | v2 home |
|---|---|
| Ontology concepts / relationship types | `structure_node_type` / `structure_connection_type` (system-level = null `userId`) |
| Content nodes (`rawContent`) | `structure_node` of the source type, text in a **field** |
| Entity nodes | `structure_node` (typed) |
| Connections (edges) | `structure_node` connection-nodes, `data.origin` = explicit \| discovered, `status` = active \| pending |
| Patterns | `structure_node` (type Pattern), evidence via connections |
| Questions / insights / suggestions | `structure_node` (types Question / Insight) — app-visible |
| Embeddings (pgvector) | **column on `structure_node`** (opt-in); engine generates + queries |
| Confidence (current) | field/metadata on the `structure_node` |
| **Working memory** — the active set / session / **chat context** (what the user is working on) | **`structure_node`** (Session / Workspace / Chat nodes) + active-context connections — *user-facing* |
| Consolidation mechanics (learning from what got used) | `cog_intelligence_*` (transient buffers only) |
| Processing + provenance/reasoning trail | `cog_intelligence_log` |
| Discovery candidates (pre-promotion buffer) | `cog_intelligence_discovery` |
| (future) activation weights, consolidation state | `cog_intelligence_*` |

## 6. The engine as a filter (new runtime shape)

On ingest, cog-ingest resolves the target Structure node (or type) and hands the parsed content to the engine. The engine then:

1. **Perceives** — LLM extraction of candidate entities, relationships, emotions, concepts, questions (unchanged internally).
2. **Types against the ontology** — reads `structure_node_type` / `structure_connection_type` (via the Structure service) instead of `cog_node` ontology rows. Unknown types follow the decision-3 mode.
3. **Resolves / dedups** — semantic + name/alias match against existing `structure_node`s (the vector query now runs over `structure_nodes`), so the same person across documents is one node.
4. **Writes records** — `createNode` / `updateNode` / `bulkCreateNodes` through the Structure service; the "smart save" (what to create vs merge) is the engine's job.
5. **Enriches** — generates + writes the embedding onto the record; writes discovered connections (pending); detects patterns (as nodes); updates the **session's active-context in Structure**; records provenance + transient consolidation buffers in `cog_intelligence_*`.

**Hard-coupling to retire:** the raw-SQL that names `cog_nodes` (semantic search, embedding writes) is rewritten to target `structure_nodes`; `getById`-over-one-ID-space traversal becomes Structure-service calls or queries; `createVersion`'s two-row supersede chain is replaced by Structure's own record state + a `cog_intelligence_log` provenance entry.

## 7. Working memory — a pluggable node type + hook surface

Working memory is a *generic, cross-module* concept: "what the user has been working on," their recent thought process, and the context a chat/LLM call draws on. **cog-ingest registers it** — a `working-memory` Structure node type plus an action/filter hook surface (the starter's [hook registry](/starter-template/hooks/)) — so any module can *contribute to* or *react to* it without cog-ingest knowing those modules exist.

### The node type
cog-ingest registers a `working-memory` node type (via `structureRegistry` / node-type registration). Instances are Structure nodes (user-owned); granularity is app-defined (a rolling "current focus" per user, or one per session/chat). Shape:
- **active set** → *connections* to the nodes currently in focus (origin `active`) — a real graph edge, not a copy.
- **recent thought process / notes** → a text field.
- **session/chat linkage** → `parentId` or a connection to the Session/Chat node.
- **last-active / focus** metadata.

Because it's a Structure node, it is searchable, has Structure state, and renders in the app like any other node.

### Hook surface (cog-ingest is the provider; any module plumbs in)
**Filters** — modules *contribute* to a value (`filterRegistry.applyAll`, backend sync+async):
- `cog-ingest.working-memory.assemble` — build the working set. Seeded, then every module appends its "what the user is working on" (a Tasks module adds active tasks; Documents adds recently-opened files; the engine adds semantically-relevant nodes). `applyAll('cog-ingest.working-memory.assemble', items, { userId, sessionId })`.
- `cog-ingest.working-memory.context` — shape the context handed to a chat/LLM (add / trim / rank, token-aware). This is the "context for chats" seam.

**Actions** — modules *react* (`actionRegistry.doActionAll`):
- `cog-ingest.working-memory.updated` — `{ userId, workingMemoryId, change }`. The engine **consolidates** (learns from what got used); a chat refreshes its context.
- `cog-ingest.working-memory.item.added` / `.item.removed` — active-set changes.
- `cog-ingest.working-memory.session.started` / `.ended` — session lifecycle (if the app models sessions).

### Flow
1. Something needs context (a chat turn, or the user shifts focus).
2. cog-ingest runs `filterRegistry.applyAll('cog-ingest.working-memory.assemble', seed, ctx)` → modules + the engine contribute → the working set is reflected on the `working-memory` node (active-set connections).
3. For a chat, `filterRegistry.applyAll('cog-ingest.working-memory.context', prompt, ctx)` lets modules finalise what goes into the prompt.
4. cog-ingest fires `actionRegistry.doActionAll('cog-ingest.working-memory.updated', ctx)` → the engine consolidates; modules react.

Working memory is user-facing (Structure holds it) but *composed* by many sources and *consumed* by many (chats, the engine). The hook surface is the starter's decoupling pattern applied: cog-ingest owns the node type + the events; everyone else plugs in. The engine only *assembles* (semantic + graph) and *consolidates* — it never owns the state.

## 8. Per-repo changes

**Structure** (smallest surface):
- Add `features.cognitiveIngest?: { enabled?: boolean }` to node types (mirrors the existing `features.publicApi.enabled` precedent) — the per-node-type "run cognitive processing" trigger.
- Opt-in **embedding**: a nullable `vector` column + pgvector extension + HNSW index, provisioned when a cognitive app is detected (e.g. cog-ingest installed / a Structure setting). Structure exposes a write path for the engine to set embeddings; semantic-search query helpers may live here or be issued by the engine.
- Ensure the service exposes what the engine needs: programmatic node-type **proposal/approval** (for ontology growth), connection `origin`/`status` fields, and a semantic-search entrypoint. Fire existing action hooks so cog features react.

**cog-ingest**:
- The pipeline creates/updates `structure_node`s (via the Structure service) as the primary output; `cog_ingest_mapping` becomes **real** (drives source → node type + which types extract). Retire the parallel taxonomy in `source.config`.
- Stop storing the whole engine graph in `cog_ingest_job.result` — keep IDs / counts / summary only. Pick one system-of-record for content (the Structure node field). Fix RSS double-ingest.
- Presentation unchanged in spirit: tabs/widgets render from `structure_node` + `cog_intelligence_*` on demand.

**cognitive-db** (largest surface — the v2):
- Remove the `cog_node` store; operate over Structure via its service + the `cog_intelligence_*` tables.
- Keep: perception, entity matching, discovery, pattern detection, ontology *reading*, condensation logic — re-pointed at Structure records and the vector-on-record.
- Retarget all pgvector raw SQL and traversal; replace in-table version chains with provenance entries.

## 9. Phased migration

1. **Foundations** — Structure: `cognitiveIngest` flag, opt-in embedding column + index, connection `origin`/`status`, node-type proposal/approval API, semantic-search entrypoint. (Additive, ships first, harmless when unused.) ✅ **Shipped in [Structure v1.16.0](/modules/structure/cognitive/).**
2. **Engine core** — retarget storage: records + ontology reads + embeddings + dedup against Structure; stand up `cog_intelligence_*`. Behind a flag alongside v1 if practical.
3. **cog-ingest rewire** — pipeline writes Structure nodes; make the mapping real; slim `cog_ingest_job`; content-as-field.
4. **Intelligence** — patterns/questions/insights as nodes; discovered-connection promotion; provenance/working-memory.
5. **Retire v1** — remove `cog_node` + the duplicated payloads; cut **cognitive-db v2.0.0** (breaking).

## 10. Risks & open questions

- **Scope**: this is a v2 rewrite of a just-audited v1.0.0 engine — the biggest single change in the project. Sequencing and a flag-guarded transition matter.
- **Cross-store latency**: dedup/discovery now query Structure + vector-on-record rather than one local table — index carefully (`@@index([userId, nodeType, status])` exists; add the HNSW vector index).
- **Structure taking on pgvector**: opt-in keeps non-cognitive apps lean, but Structure now owns a vector column's lifecycle (re-embed on content change — driven by the engine via action hooks).
- **Pattern/insight nodes** could proliferate; the decision-3 modes and connection promotion gate this.
- **Documents module** (planned) may later own file *content*; the "content is a field" decision should leave room for a reference-to-Documents variant.
- Confirm whether the engine ever needs a node with **no** Structure counterpart (pure-intelligence node) — current answer: no, those become `cog_intelligence_*` rows, not nodes.

## 11. Impact

**cognitive-db v2.0.0** (breaking) · **cog-ingest** minor→major (pipeline output changes) · **Structure** minor (additive: flag, opt-in embedding, connection origin, proposal API, working-memory node type). Net result: **one record store (Structure), one intelligence layer (`cog_intelligence_*`), one pipeline (cog-ingest) — zero record duplication.**

## 12. Incorporating cognitive-db into the module template system

cognitive-db is a **library**, not a scaffold module — here is the clean pattern for how it lives in the ecosystem (and the template for any future library):

- **Delivery — vendored into a module.** The library is not published to npm. `cog-ingest` packs a pinned build (`vendor/cognitive-db.tgz`) and installs it into the host backend via its `onInstall`/`onUpdate` lifecycle hook — no registry or GitHub auth, version locked to the module release. App developers install *one module* and the library rides along. A local `npm link cognitive-db` overrides it for engine development.
- **Docs — in the shared site under Libraries.** The library's *published* docs (this section) live in `module-system-docs` under the **Libraries** sidebar group — discoverable alongside the modules, versioned with the site — **not** siloed in the engine repo. The engine repo keeps only its working history (design notes, the code audit) and the canonical `CHANGELOG.md` that the site mirrors; forward-looking design (this RFC) is published here.
- **Versioning — inline with the system.** Semantic versioning + a `CHANGELOG.md`, matching the module/starter convention, with `version:*` scripts in the library. (Engine currently at v1.0.0.)
- **Conventions — aligned.** The library's `CLAUDE.md` references the authoritative [LLM rules](/getting-started/llm-rules/) and captures the library-applicable subset (file headers, no `console.*`, SQL binding, public-export deprecation); `tenantId === userId` throughout.
- **Consumed via a module, not app-installed directly.** App developers never wire the engine themselves — cog-ingest generates the `initConfig` and owns the pipeline. The library's public surface is its named exports; breaking changes follow the deprecation cycle.

**The pattern in one line:** *vendored delivery through a module · published docs in the shared Libraries group · semver + changelog · `CLAUDE.md` aligned to the LLM rules.*

## 13. Handoff — for the implementation chat

The design is settled enough to start; this section orients a fresh session.

**Repos** (work on `master`/`main` directly — module-system convention):
- Engine: `C:/Users/kimbe/ReactApps/Cog/cognitive-db`
- Module: `C:/Users/kimbe/ReactApps/Cog/cognitive-ingest`
- Structure: `C:/Users/kimbe/ReactApps/structure`
- This RFC's source: `cognitive-ingest/docs/src/content/docs/cognitive-db/v2-rfc.md` (published under Libraries → cognitive-db → *v2 RFC*)

**Read first:** §4 (the six settled decisions) and §5 (the concern-by-concern migration) — those are the contract. `tenantId === userId` throughout (no multi-tenant).

**Order of work (additive-first, so v1 keeps running):**
1. **Phase 1 — Structure foundations** (§9.1, all additive): `features.cognitiveIngest` flag; opt-in embedding column + HNSW index; connection `origin`/`status`; node-type proposal/approval API; a semantic-search entrypoint. ✅ **Shipped in [Structure v1.16.0](/modules/structure/cognitive/).**
2. **Working-memory node type + hook surface** (§7) — also additive; cog-ingest registers the `working-memory` type and the `cog-ingest.working-memory.*` hooks. ✅ **Shipped in [cog-ingest v1.12.0](/modules/cog-ingest/working-memory/).**
3. **Engine core retarget** (§6 + §9.2) — the large, breaking v2 work (records/ontology/embeddings/dedup → Structure; stand up `cog_intelligence_*`). Flag-guard alongside v1.
4. **cog-ingest rewire** (§9.3) — pipeline writes Structure nodes; make `cog_ingest_mapping` real; slim `cog_ingest_job`; content-as-field.
5. **Intelligence + retire v1** (§9.4–9.5) — patterns/questions as nodes; discovered-connection promotion; delete `cog_node`; cut **v2.0.0**.

**Also true:** cognitive-db is currently **v1.0.0** (audited, all 84 findings fixed) and vendored into cog-ingest **v1.11.10**. Nothing here is in production, so breaking changes are fine.

**Phase 1 outcome:** everything landed as specified (the §4 decisions are intact), with two deviations from the original sketch. The `data->>'origin'` expression index was dropped — Prisma's JSON path filter emits a different expression, so the index could never be used; revisit when the review UI's query shape settles. And the embeddings code ships as a separate when-gated service file registered as `structureEmbeddings` (not inline flags in existing files), so flipping the opt-in later regenerates cleanly. See [Cognitive foundations](/modules/structure/cognitive/) for the shipped surface.

**Item 2 outcome:** the `working-memory` node type and the full `cog-ingest.working-memory.*` hook surface shipped as specified in §7, with six recorded deviations. Hook contexts carry `sessionNodeId` (a Structure node id), not `sessionId`; the context filter's value is a structured `WorkingMemoryContext`, not a prompt string (add/trim/rank is not implementable over an opaque string); assemble is a **rebuild** (pinned items + fresh contributions), not append-over-current — nothing ratchets into permanent focus and `.item.removed` actually fires; a full flow emits two `updated` events (`assemble` then `context`), each carrying a change/usage payload the engine can consolidate from; no connection-type row is seeded for `working-memory` edges (Structure has no shared-row API for connection types — untyped connections skip validation by design); and session linkage is `parentId`-only for now (Structure doesn't enforce hierarchy rules server-side, so the "or a connection" alternative is deferred until it does). See [Working memory](/modules/cog-ingest/working-memory/) for the shipped surface.

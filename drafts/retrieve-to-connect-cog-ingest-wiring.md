# cog-ingest wiring note — activate extraction end-to-end + retrieve-to-connect

Status: handoff for a **cog-ingest** session. Companion to `retrieve-to-connect-brief.md`.
Engine side is **done** (cognitive-db **v1.12.6**, pushed + tagged). Everything below is host work.

## TL;DR

Two independent things are gating the graph today, both on the cog-ingest side:

1. **A full document extract still fails** — cog-ingest never seeds the engine's `cognitive-db/*` language + embed ops (the long-standing **A4** blocker). Fix this first; nothing works without it.
2. **Retrieve-to-connect stays dark by design** until cog-ingest resolves + pushes the active scope. The engine skips the feature (and logs a warning) whenever no `scopeRootId` arrives — that is the intended safe default, not a bug.

Do them in the order below.

---

## 0. Re-vendor the engine → v1.12.6 (prerequisite for everything)

veradai currently vendors **v1.11.1** — before the `./operations` export (v1.12.0) and everything since.

- In `cognitive-ingest`: `npm run build` (prebuild re-packs `vendor/cognitive-db.tgz`) → `npm run release:patch`, then commit the refreshed tarball.
- Confirm `veradai/backend/node_modules/cognitive-db` is **1.12.6** after the module update.

---

## 1. A4 — seed the engine's ops (THE extraction blocker)

Today `cog-ingest.ai.ts` seeds its *own* ops (vision / parse-qa / contextualise / embed) but **none** of
`cognitive-db/extract-entities | -with-proposals | -concepts | infer-implicit | summarise`, and the
engine's embed ids `cognitive-db/embed-document | -embed-query` are unseeded. So the first
`runLanguage('cognitive-db/extract-entities')` hard-fails → empty graph, and `adapter.embed` fails on the
unseeded embed id.

**In `veradai/backend/src/features/cog-ingest/cog-ingest.ai.ts`** (the seeder helpers already exist and match the catalogue shape):

- Add `seedEngineOperations()`:
  - `import { COGNITIVE_DB_OPERATIONS } from 'cognitive-db/operations'`
  - loop `approaches[]` → `ensureApproach({ key, name, promptText })`
  - loop `markers[]` → `ensureMarker({ id, meaning })`  ← this seeds `cognitive-db/related-entities` for free
  - loop `operations[]` → `ensureSegment(objective / format / approaches from approachKeys)` + `ensureOperation({ id: opId, model: { kind: 'language' }, segmentKeys, inputItems, sensitivity: 'normal' })`
  - seed `cognitive-db/embed-document` + `cognitive-db/embed-query` (map to your embed model — you already seed `cog-ingest/embed-*`).
- Call `seedEngineOperations()` at boot **and** lazily.
- Update **`buildAiAdapter`** to route by `AiContextItem.role`: `role:'input'` → the op's input segment; `role:'context'` → context, keyed by `item.marker` (which now always equals a seeded `markers[]` id). It currently frames every item `type:'context'` with `marker = item.marker ?? item.label`.

**Done when:** ingesting a document produces a graph on Neon (entities/relationships/emotions).

---

## 2. Retrieve-to-connect activation (engine v1.12.5/6)

The `related-entities` marker is seeded for free by step 1. Remaining:

a. **Push scope on `ingest()`.** cog-ingest's `retrieve()` (v1.21.13) already resolves the active-scope root and the user's unreadable node types. Resolve the same two and pass them on the engine `ingest()` call as the **new `IngestInput` fields**:
   - `scopeRootId: string` — the active space's `rootNodeId`
   - `unreadableTypes: string[]` — from `getUnreadableTypes(userId, …)`

b. **Forward scope through the adapter.** In `buildStructureAdapter` (`cog-ingest.structure-adapter.ts`), `semanticSearchNodes` and `findSimilarNodes` must forward the engine-supplied `options.scopeRootId` and `options.excludeNodeTypes` to Structure's `structureEmbeddings` service, which honours both (`scopeRootId` since Structure v1.34.2, `excludeNodeTypes` since v1.34.13). If the adapter currently whitelists options, add these two.

c. **Enable the flag.** `initConfig({ features: { retrieveToConnect: true } })` (default off). Requires embeddings enabled (same `getCognitiveCapabilities` gate as discovery). Without `scopeRootId` from (a) the engine skips retrieval and logs a warning — so (a) is a hard prerequisite, not optional.

**Done when:** ingesting a second document that mentions an existing entity (flag on, scope pushed) links to the existing node instead of creating a duplicate, and the `related-entities` context reached the op.

---

## 3. relationClass persistence (ontology-sprawl guard)

When you approve/persist a proposed relationship type (`IngestResult.proposedRelationshipTypes`), write its
`relationClass` (`associative | sequential | hierarchical | descriptive`) onto the Structure **connection
type** (a field / tag). The engine now supplies it per proposal, so a growing relationship vocabulary stays
anchored to the fixed four-value backbone rather than every grown type defaulting to `associative`.

---

## 4. §7 (next, optional) — per-source extraction guidance

Add an **"extraction guidance"** field to the ingest-source admin config (free text, and/or relationship→
`relationClass` hints) and flow it into the engine `ingest()` call as `context` (rides in as the engine's
`additional-context` item). Keeps the shared seeded prompt generic and reusable; domain vocabulary stays
config-driven per source. The engine already consumes it — no engine change.

---

## 5. Pre-existing follow-ups (fold in while you're here)

- Wire **`StructureAdapter.updateConnection`** into `buildStructureAdapter` (**F3** — unblocks working-memory consolidation's strengthen path). Structure's connection field-update exists.
- Ensure these connection types are seeded: `co-activated` (consolidation), `qualifies` / `may_answer` / `answers` (proactive). Accept the `consolidation` connection origin. Pass `userId` to `markAnswered`.
- Provision `cog_content_archive` (`node_id`, `content`, `archived_at`) and configure the `cognitive-db/summarise` op (**C3** — else aged-content summarisation safely skips).

---

## Residual (Structure-side, NOT cog-ingest)

The engine's **exact-name** entity-dedup stage is still cross-scope — `listNodes` / `StructureNodeQuery`
has no scope/parent filter. (The **semantic** dedup stage *is* scope-confined.) Closing it needs a
scope/parent filter on `StructureNodeQuery`, a Structure change. Low priority — it only bites on a same-name
collision across two matters for one user.

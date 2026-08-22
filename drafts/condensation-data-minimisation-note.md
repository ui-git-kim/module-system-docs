# Note for the engine session — condensation → data minimisation (please update your docs)

**From:** cog-ingest session (2026-08-22). **Status:** decision + a docs ask; no engine code change requested yet.

## What we decided (host side)
The engine's **condensation** pass (summarise old content + archive originals, merge duplicates, archive unused nodes) is **dormant** under Structure-native storage — `summariseOldContent` selects from `cog_nodes`, nothing in the ingest path triggers it, so in the default (Structure) mode it never runs. Nothing is broken; the feature is just asleep in the new storage.

cog-ingest has **parked** it and **reframed** the whole area, and your docs (condensation section + changelog/roadmap) should be updated to match so the two repos don't drift:

- **Reframe: "archiving" → "data minimisation".** The goal is *save space without losing the possible connections.* Target the **bulky, regenerable** data (raw document text, chunk text, embedding vectors). **Never touch the connection graph** (entities + relationships) — it is tiny in storage but the most expensive to recreate, and retrieve-to-connect actively grows it.
- **Drop the staleness-based "archive unused" job.** Hiding whole nodes because they haven't been accessed recently is the wrong target (recency ≠ importance) and violates the engine's own **never-decay** principle. `archival.ts`'s recency-based `archiveUnused` is the piece to retire / not carry into the Structure path.
- **Keep the safe levers:** summarise-old-content **with the original preserved + restorable** (this is tiering, not decay — compatible with never-decay) and duplicate collapsing. `cog_content_archive` is now provisioned host-side (cog-ingest v1.21.22) and `cognitive-db/summarise` is seeded, so the summarise lane's plumbing is ready.
- **Ownership:** cog-ingest orchestrates (it is the pipeline conductor and owns the trigger); the engine lends only the `summarise` primitive; Structure owns the storage. So the engine should stop presenting condensation as an engine-owned automatic pass and describe it as a host-triggered capability over the summarise op.
- **Structure prerequisite for the blocked levers:** merge-duplicates and re-parent need a Structure node **archive / merge / re-parent** API (Structure's `updateNode` allowlist drops `status` / `parentId`). That's a cross-repo prerequisite if/when that path is chosen — worth listing in the engine's open cross-repo asks too.

## The ask
Update the engine's condensation docs (and any "condensation runs automatically" wording in the changelog/roadmap) to reflect: dormant-in-structure-mode, host-orchestrated, reframed as data-minimisation-that-preserves-connections, staleness-based archival dropped. No code change is being requested right now — it's parked pending a proper design process on the host side.

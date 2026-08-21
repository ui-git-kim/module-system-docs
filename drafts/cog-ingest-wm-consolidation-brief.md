# Design brief — wire working-memory consolidation (cog-ingest, C2)

Status: DRAFT for Kim's approval. Nothing built yet. Prereqs shipped: `updateConnection`
adapter + engine v1.12.2 vendored (v1.21.18).

## 1. The two gaps (recap)

The engine (cognitive-db v1.12.2) has everything on its side: it consolidates co-retrieval
patterns into `co-activated` edges (`origin: 'consolidation'`), routing the WRITE to the v1
`cog_node` store or the Structure adapter by the resolved storage mode. Two host-side pieces
are missing before it can actually run:

1. **No event input.** Consolidation READS from the storage-agnostic `cog_working_memory_events`
   table (via the engine's `trackEvent`/`getCoRetrievalPatterns`) in *both* modes — only the
   graph writes are storage-routed. cog-ingest records **no** events: `retrieve()` records
   nothing, and nothing bridges the working-memory usage hook to `trackEvent`. So the table is
   empty and consolidation is a no-op. (Note: the structure-native `recordActivation` writes a
   *different* table, `cog_intelligence_events`, which consolidation never reads — so we must use
   `trackEvent`, not `recordActivation`.)
2. **`co-activated` connection type is untyped.** It works (Structure's `createConnection` needs
   no registered type), but there's no Structure path to seed a *shared* connection type.

## 2. Contract facts (verified in the vendored engine)

Event model — `trackEvent(prisma, input: TrackingInput)` → INSERT `cog_working_memory_events`:

```
TrackingInput = {
  sessionId: string;           // groups events; consolidateSession filters on it
  nodeId: string;              // the node this event is about
  eventType: 'activated' | 'retrieved' | 'used' | 'deactivated';
  userId: string;
  activatedBy?: string;
  usedWith?: string[];         // the co-retrieved node ids (the co-activation signal)
  wasHelpful?: boolean;        // helpfulness feedback (optional)
  feedbackNote?: string;
}
```

Co-retrieval derivation (`getCoRetrievalPatterns` → `extractCoRetrievals`):
- Reads events WHERE `eventType IN ('retrieved','used')` AND `usedWith` non-empty.
- **[wm-01] SYMMETRIC events**: a retrieval returning nodes {A,B,C} must write **one event per
  node**, each carrying `usedWith` = the *other* nodes (A→[B,C], B→[A,C], C→[A,B]). The pair
  tally counts once per unordered pair (canonical lower-id ordering), so writing per-node is the
  contract — not one event for the whole set.
- A pair must reach `frequency >= minFrequency` (default **2**) to create/strengthen an edge —
  i.e. two nodes must co-occur across at least two retrievals before an edge forms.

Consolidation API (engine exports):
- `consolidate(prisma, userId, options?)` — user-wide: reads all the user's co-retrieval events,
  applies patterns (create/strengthen edges via the resolved store), then `cleanupOldEvents`.
- `consolidateSession(prisma, sessionId, userId, options?)` — same but scoped to one session
  (no cleanup).
- `consolidateHelpfulness(prisma, userId)` — adjusts node confidence from `wasHelpful` stats.
- Under Structure mode these use `getStructureAdapter()` (set by `initConfig`) — already wired.

## 3. Proposed design

### 3a. Record co-retrieval events in `retrieve()`
After `retrieve()` collapses chunk hits to its `nodes` set, write one `'retrieved'` event per
returned node id, `usedWith` = the other returned node ids ([wm-01]). Skip when the set has < 2
nodes (a single node has no co-retrieval). Fire-and-forget + try/caught — event recording must
never fail or slow a retrieval (mirror the working-memory action-dispatch pattern).

- Use the engine's exported `trackEvent(prisma, …)` with the host prisma.
- **`sessionId`** — `retrieve()` has none today. Options:
  - (A) add an optional `sessionId?` to `retrieve()`'s options, supplied by the caller (chat/WM
    session). `getCoRetrievalPatterns` (the user-wide path) ignores session, so a **stable
    fallback** (e.g. `'retrieve:' + userId`) is fine when the caller passes none.
  - (B) always use the user's rolling working-memory node id as the session key.
  - Recommendation: **(A)** — optional `sessionId`, fallback to a per-user constant.

### 3b. Trigger consolidation
Nothing calls `consolidate()` today. Options:
- (A) **On working-memory `endSession`** → `consolidateSession(sessionNodeId, userId)`. Natural
  lifecycle boundary; already a hook in `workingMemoryService.endSession`.
- (B) **Periodic batch** (a scheduled job / cron) → `consolidate(userId)` per active user.
- (C) **Opportunistic** — after every Nth retrieval.
- Recommendation: **(A) now** (cheap, bounded, lifecycle-aligned), leave (B) as a follow-up for
  users who never formally end a session. Guard: only meaningful once ≥ 2 co-retrievals exist,
  which the frequency gate already enforces.

### 3c. `co-activated` connection type (step 5) — RESOLVED by Structure, no blocker
Confirmed with the Structure session:
- `origin: 'consolidation'` is accepted — open-vocabulary kebab-case (`/^[a-z][a-z0-9-]{0,49}$/`)
  on both the service and HTTP paths.
- `createConnection` **never requires** the type to exist — the `fromTypes`/`toTypes`/`isUnique`/
  `maxConnections` checks are gated behind `if (connType)`, so an unregistered `co-activated` slug
  just creates the edge. It works untyped.
- The type **can** be seeded via the serviceRegistry `createConnectionType` (the service path has
  **no slug-format check** — only the admin HTTP route enforces the kebab regex). `co-activated`
  is already kebab-case in v1.12.2, so it also passes the HTTP regex. This is user-scoped
  (`createConnectionType` writes `userId`); there's no `userId: null` shared path, but user-scoped
  is fine for solo-business. The adapter has no `createConnectionType`, so if we type it, **cog-ingest
  seeds it** via `serviceRegistry.get('structure').createConnectionType` (same pattern as the
  working-memory node-type seed).

Options:
- (A) **Leave untyped** — ship as-is; edges show the raw `co-activated` slug in the graph UI.
  Structure's own recommendation ("ship as-is").
- (B) **Seed it user-scoped** for rendering polish — `createConnectionType(userId, { slug:
  'co-activated', isSystem: true, bidirectional: true })`, **unrestricted** (no `fromTypes`/
  `toTypes`), called at first consolidation for the user.
- Recommendation: **(A) for v1** (works, zero new seed code), **(B) as an easy follow-up** if we
  want the edges labelled/coloured in the graph. No Structure change either way.

(Separate, engine-side: the *discovered* relation types `followed_by`/`analogous_to` are snake_case
and Kim is moving the engine to kebab for admin parity — unrelated to consolidation, which already
uses kebab `co-activated`.)

### 3d. Helpfulness — deferred
`consolidateHelpfulness` + the `wasHelpful` field need a feedback signal cog-ingest doesn't
capture yet (no thumbs-up/down on a retrieval). Defer until a feedback surface exists; co-retrieval
consolidation works from `'retrieved'` events alone.

## 4. Storage-mode note
cog-ingest defaults to `cog_node` storage (`COG_ENGINE_STORAGE` unset). Consolidation routes writes
correctly in both modes, but the whole intelligence value lands under **Structure mode**. Events
are storage-agnostic, so record them always; the consolidation trigger can run in both modes (it
picks the right store). No mode gate needed on recording.

## 5. Open decisions for Kim
1. `sessionId` for `retrieve()` events — optional param + per-user fallback (3a-A)? 
2. Consolidation trigger — on `endSession` now, batch later (3b-A)?
3. `co-activated` type — leave untyped for v1 (3c-A, Structure's recommendation), or seed it
   user-scoped for rendering polish (3c-B)? (Not a blocker either way — no Structure change.)
4. Confirm helpfulness is deferred (3d).
5. Should `'used'` events also be recorded (e.g. from the working-memory `context` usage summary,
   which lists the itemIds actually used), or is `'retrieved'` from `retrieve()` enough for v1?

## 6. Build plan (once approved)
- `services.ts` `retrieve()` — after the node set is assembled, write per-node `'retrieved'`
  events via `trackEvent` (fire-and-forget, guarded); add optional `sessionId` to options.
- `working-memory.ts` `endSession()` — call `consolidateSession(sessionNodeId, userId)`
  (guarded, non-fatal), if trigger (3b-A) is approved.
- (3c-B) a small `ensureCoActivatedConnectionType(userId)` helper (unrestricted, isSystem) called
  before/at first consolidation.
- Verify: check:templates / type-check / build / conformance / contract / parity + esbuild
  gen-check + adversarial review; host-tsc via `npx cognitive-ingest update`.

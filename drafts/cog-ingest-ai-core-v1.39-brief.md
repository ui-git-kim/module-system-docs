# Cog Ingest × AI Core v1.39 — Integration Rework Brief

**Status:** Draft for review · **Date:** 2026-08-20
**cog-ingest:** v1.21.10 · **AI Core (veradai):** v1.39.1 (Kim actively reworking — several items below are in-flight)
**Decision:** Plan approved by Kim (2026-08-20). cog-ingest code held until AI Core lands the three additions in §9 ("almost there — will let you know once done"). This brief is the shared spec we build from.

---

## 0. Why this exists

The AI Core prompt model was redesigned between v1.22 and v1.39. cog-ingest's AI seam (`src/templates/backend/ai.ts`) is written against the *old* model and is broken in two ways on a plain veradai boot:

1. **Seeding break** — `ensureSegment` sends `type: 'method'`; the field is now `slotType` (a required enum) and `'method'` no longer exists → Prisma *"Argument `slotType` is missing"* → none of cog-ingest's six language ops seed. Non-fatal WARN at **boot** (module init, `services.ts:2855`), not on ingest.
2. **Run-path break** — the runtime segment type is now `'input' | 'context'` (was `task | context`, and `external` is gone); cog-ingest still passes `task`/`external`, both of which AI Core silently drops (`run.ts:1626`).

But the redesign also changed the *shape* of a good operation (objective / approaches / disciplines / format / input-contract), so the fix is not a rename — it's a re-modelling. This brief captures the target model, the ownership split, the per-op decomposition, and the build order.

**Terminology — "cog-op" vs "operation".** To stop "operation" meaning two things, this brief uses **cog-op** for a *cog-ingest pipeline step* (the unit cog-ingest — the conductor — orchestrates) and **AI operation** for an *AI Core registered operation* (a model call). A cog-op is backed by one of: an **AI operation** (parse-QA, vision, contextualise, embed), an **engine call** (extraction / inference / summarise — which itself calls `cognitive-db/*` AI operations), or a **deterministic transform** (clean, chunk, dedup, quarantine — no model). cog-ingest *registers* AI operations but *thinks in* cog-ops. Whether "cog-op" becomes a formal pipeline registry/type or stays a naming convention is an open question (§11).

---

## 1. The v1.39 model (glossary)

### Authored / standing side (seeded once; admin owns thereafter)
A prompt is assembled from **segments**, each filling a **slot** (`SlotType`, unchanged):

| Slot | What it holds | Source |
|---|---|---|
| **objective** | What the operation is *trying to achieve* ("extract a rich collection of entities…") | authored text |
| **approaches** | *How* to approach it — **role + non-measurable rules** ("You are a strict parse-quality judge", "use Australian spelling", "report only what's observable") | composed from **`ai_approach` records** by reference |
| **disciplines** | The same, but **measurable** — if you can score it, it's a discipline ("confidence 0–1", "coverage 0–1") | composed from **`ai_discipline` records** by reference |
| **format** | The output shape ("respond ONLY with valid JSON …") | authored text |
| **examples / edge-cases** | Few-shot / boundary guidance | authored text |
| **context** | Background info **from the DB / Structure** — AI Core pulls it (see Context builder) | retrieved |

Approaches/disciplines are **records** so they're reusable across operations; a segment of `slotType: 'approaches'` (or `'disciplines'`) just lists member keys/ids with a per-membership `important` flag.

### Runtime side (per call)
`ConsumerSegment.type` is now **`'input' | 'context'`**:

- **input** — the **raw thing the user supplies this run**, typed by the **`ai_input_type` catalogue** (`text`, `upload` seeded; admin-extensible). For cog-ingest this is almost always **`upload`**; for chat it'd be typed-text *and* uploads.
- **context** — **information from the database / Structure**, which AI Core fetches itself via a **Context builder**, not something the caller hand-stuffs.

### Injection risk + markers (the security axis)
A boolean on a segment / input item. When on, you attach a **marker**; AI Core fences the content between that marker's tags (the marker carries a preamble telling the model what it is). A prompt can carry several markers. **Terminology: "injection risk", never "untrusted"** — the flag is about *content that may carry text posing as instructions*, not about distrusting the content's validity.

### Input contract (`inputItems`, per operation)
An operation declares what the caller supplies each run: `[{ label, kind (input-type id), marker?, injectionRisk? }]`. Rule (from the admin UI): *an item that carries a marker or is injection-risk reaches the model as **material to examine**; an unmarked text item with the risk off is **the instruction** the operation acts on.* The editor **requires ≥1 non-risk text item** as the instruction slot, or the run carries no instruction.

### Context builder
An operation with `builderRole: 'context'` produces a prompt slice (never calls the model), composing **blocks**: `text`, `segment`, **`retrieval` (reads Structure)**, `memory`, `session`. A normal op points at one via `contextOperationId`, framed by `contextMarker` (default `source`). This is the idiomatic home for cog-ingest's **intelligence/retrieval lane** (see §7).

### Tools
A provider-hosted capability catalogue (`web_search` first): `{ id, name, kind: 'provider-native'|'function', providerToolId, config, egress, enabled }`. Operations opt in via `toolIds`; an `egress: true` tool is refused on a `sensitive` operation. Not used by cog-ingest today; noted for extraction/verification enrichment later (§8).

---

## 2. Two operation sets, two owners

The word "operation" was blurring two verbs. Separate them:

- **Register** (seed the op into AI Core) — **cog-ingest owns *all* of it.** Its own ops *and* the engine's. One registrar = "install one module, whole stack configured".
- **Call** (invoke at runtime) — **split by who's doing the work at that moment:**

| Operation set | Registered by | Called at runtime by | How |
|---|---|---|---|
| **cog-ingest's own** — `cog-ingest/analyse-image`, `-analyse-image-enhanced`, `-analyse-url-screenshot`, `-analyse-pdf-page`, `-contextualise-chunk`, `-parse-qa`, `-embed-document`, `-embed-query` | cog-ingest | **cog-ingest** (pipeline steps, in order) | `ai.run` / `ai.embed` directly from `ai.ts` |
| **the engine's** — `cognitive-db/extract-entities`, `-extract-entities-with-proposals`, `-extract-concepts`, `-infer-implicit`, `-summarise`, `-embed-document`, `-embed-query` | cog-ingest | **the engine** (mid-processing) | via the injected `buildAiAdapter` (`config.ai.runLanguage/embed`) |

**The engine is not "just prompts".** cognitive-db does perception, extraction *orchestration*, connection discovery, ontology growth, graph storage, dedup/condensation, working memory, versioning. The AI Core ops are the LLM-facing slices it invokes partway through; between them it does non-LLM graph work. **cog-ingest is the conductor** of the whole pipeline; the engine is one (big) stage inside it that makes its own model calls against operations cog-ingest already registered.

### The gap this exposes
Nothing seeds the engine's ops today — `ai.ts:818/850` assume they're *"pre-configured in AI Core by importing the engine's operations catalogue"* (a manual import). So on a fresh app the engine's first `extract-entities` call → `resolveOperation` **NotFound** → ingest fails. **cog-ingest must own seeding the engine ops** too.

---

## 3. One seeding surface

cog-ingest gets a single seeding helper that turns a decomposed op spec into AI Core records. Ideal shape (depends on §9): **one extended `ensureOperation` call per op** that inlines `objective`, `approaches`, `disciplines`, `format`, `inputItems` (and optionally `toolIds`). If AI Core keeps those on separate `ensure*` calls, the helper orchestrates `ensureApproach` → `ensureDiscipline` → `ensureSegment(slotType:'approaches'|'disciplines'|…)` → `ensureOperation(segmentKeys:[…])` in order.

Both op sets flow through this one helper — cog-ingest's own six, and the engine's set read from the manifest (§5).

---

## 4. Decomposition — cog-ingest's own ops

Each op's current single `IMAGE_VISION_METHOD`-style blob is split by slot. Proposed (content lifted from today's method text, re-slotted):

> **AS BUILT (cog-ingest, this session — see `src/templates/backend/ai.ts`; the sketch below was the pre-build proposal, code is authoritative).** Seeding shape per op (no inline decomposition on `EnsureOperationSpec`): `ensureApproach` (shared) → `ensureSegment(slotType:'approaches', approaches:[keys])` → `ensureSegment(slotType:'objective')` → optional `ensureSegment(slotType:'format')` → `ensureMarker` → `ensureOperation({ segmentKeys, inputItems, schema?, model, sensitivity })`, via a `seedLanguageOperation` helper + `ensureFoundations`.
> - **Shared approaches:** `aus-spelling`, `observable-only`, `precise-language`, `kg-precision`, `judge-strict` (role), `situate-chunk` (role), `context-only-output`.
> - **Markers:** `captured-media`, `chunk-to-situate`, `source-document`, `extracted-text`.
> - **No disciplines** — the only measurable rules (coverage/faithfulness ∈ [0,1]) are enforced by the op's JSON schema; a discipline would need a guardrail. **Instruction lives in the `objective`**, so the runtime passes only the material as `input` (confirmed against `applyInputContract`).
> - **Input contracts:** vision → `[{Image, upload, captured-media, untrusted}]`; contextualise → `[{Chunk, text, chunk-to-situate, untrusted}]` + a `context` segment `{source-document}` for the doc; parse-qa → `[{Extracted text, text, extracted-text, untrusted}]` + `schema`. Run path passes the material as `{type:'input', marker, injectionRisk:true, media?}`; engine adapter `task`→`input`.
> - **Deferred:** URL multi-kind input (copy+code alongside the screenshot) needs the URL processor to supply them — a Stage-2.4 follow-up. parse-QA fenced-material control-char trade-off noted (built fenced).

**Shared approach library** (create once, reference from many ops):
- `cog-ingest/australian-spelling` — "Use Australian spelling (behaviour, colour, organisation)."
- `cog-ingest/observable-only` — "Report only what is directly observable; do not infer emotions, intentions, or narrative."
- `cog-ingest/precise-language` — "Use precise language (‘a red ceramic mug’, not ‘a cup’)."

**Vision ops** (`analyse-image`, `-image-enhanced`, `-url-screenshot`, `-pdf-page`):
- **objective** — per op ("Describe this image in thorough detail, focusing on observable facts" / "Analyse this web-page screenshot for layout, colour, typography, imagery, UI components…" / "Extract structural and visual information from this PDF page…").
- **approaches** — `observable-only`, `precise-language` (+ `australian-spelling`); role approach where useful ("You are a visual-analysis assistant building a knowledge graph, so precise entity identification matters").
- **disciplines** — mostly none (prose output). The enhanced op's numbered extraction checklist stays as `objective`/`format` guidance.
- **format** — the numbered "extract ALL of: 1. CONTENT … 8. DESIGN ELEMENTS" checklist (enhanced), or "be specific and structured" (basic).
- **input contract** — **one or more input items of different kinds**, each injection-risk-marked, plus a text instruction item. Simple image analysis is a single `upload`/image item (marker `captured-media`). A **website cog-op** is the richer case: the page **copy** (text input), the **screenshot** (image input) and the **code / HTML** (text input) are *all inputs* of different kinds — so the model gets the visual, the textual and the structural together, not just a screenshot. cog-ingest picks each item's kind from the `ai_input_type` catalogue.

**`contextualise-chunk`:**
- **objective** — "Situate a chunk of text within its source document for retrieval; write 1–2 sentences (≈50–100 tokens) stating what the chunk is about and where it sits."
- **approaches** — "Output only the context sentences — no preamble, labels, or quotes"; "Do not repeat the chunk verbatim or add facts not present."
- **format** — plain text (no JSON).
- **input contract** — `upload` **chunk** (injection-risk, marker `chunk-to-situate`) + the document as context/background (see §6 open question) + instruction item.

**`parse-qa`:**
- **objective** — "Judge how faithfully and completely extracted text represents its source document, and flag likely parse failures."
- **approaches** — role: "You are a strict parse-quality judge"; "judge only what the text itself evidences — never assume content you cannot see."
- **disciplines** (measurable) — "coverage ∈ [0,1]", "faithfulness ∈ [0,1]".
- **format** — the JSON shape; the JSON **schema** stays enforced via `ensureOperation({ schema })`.
- **input contract** — one `upload` item (the extracted text), injection-risk on, marker `extracted-text` + instruction item. ⚠️ **See §11 open question** (fencing may strip the very control chars the judge is meant to detect).

**Embed ops** (`embed-document`, `embed-query`): unchanged — no segments, `ensureOperation({ model: { kind: 'embedding', dimensions } })`. Already correct in `ai.ts`.

---

## 5. Engine ops — seed from the manifest

`../cognitive-db/docs/ai-core-operations.json` already organises each op by objective / approaches / disciplines / format / edge-cases — it's the template. Two adjustments so cog-ingest can seed from it:

1. **Reshape** — `approaches` and `disciplines` are plain string arrays; AI Core needs **records** (id + text) so they can be composed by reference, plus an explicit **input contract** per op (which item is the content upload vs the instruction, markers, injection-risk). Reference data the engine passes (`ontology`, `entity-types`, `relationship-types`) is `context`, not injection-risk `input`.
2. **Export, don't document** — the manifest is a `docs/*.json` today. Make it a real **engine package export** so the vendored tarball ships it and it can't drift from the shipped engine. cog-ingest reads the export and seeds each op through the §3 helper at boot (idempotent — existing records are never touched).

Engine ops to seed: `extract-entities`, `extract-entities-with-proposals`, `extract-concepts`, `infer-implicit`, `summarise`, `embed-document`, `embed-query`.

---

## 6. The run path (blocked on §9)

For cog-ingest's own pipeline ops, at call time:
- **material** (image / screenshot / PDF page / chunk / extracted text) → `type: 'input'`, kind `upload`, injection-risk on, with its marker; media rides on the input segment for vision.
- **instruction** → carried by the op's standing `objective`/`approaches`; the input contract still needs a non-risk text item as the instruction slot (a short per-call ask, or a fixed one).
- **background** (e.g. contextualise's parent document) → `context`.

**Engine adapter (`buildAiAdapter`)** needs the same treatment: `runLanguage` currently pushes `{ type: 'task', … }` → rename to `input`; `engineContextToSegment` maps injection-risk engine items — decide per item whether the *content being extracted* is an `upload` input vs `context` (see §11).

This whole section is **blocked** until AI Core honours injection-risk on `input` and lets a consumer declare the input contract (§9).

---

## 7. Context builder — the intelligence/retrieval lane (follow-on)

cog-ingest's `retrieve()` + working memory (the read path) map onto a **Context builder** with a `retrieval` block reading Structure — instead of cog-ingest embedding a query, searching chunks, and hand-assembling a prompt. This is the "you'll use it a lot" piece and folds into the **Stage-3 retrieval assembly** roadmap item (rerank / MMR / history-query), now unblocked because AI Core is live. Out of scope for the seeding fix; tracked as the next lane.

---

## 8. Tools (note, not now)

Web-search (provider-native, `egress: true`) could later back entity verification / enrichment / freshness checks in extraction. Needs `toolIds` on the consumer seeding path (currently admin/config-io only). Parked.

---

## 9. AI Core additions this depended on — ✅ LANDED (verified v1.42.0, 2026-08-20)

1. **Injection-risk honoured on an `input` item** — ✅ `run.ts` now fences a marked/untrusted upload input on every path (`run.ts:1208/1264/1341`).
2. **Consumer input contract** — ✅ `inputItems?: OperationInputItem[]` (`{ label, kind, marker?, untrusted? }`) on `EnsureOperationSpec`; also `toolIds?`. ⚠️ **Inline `objective`/`approaches`/`disciplines` did NOT land** on the consumer spec (admin-only) → seed those as **segments** + `segmentKeys`. The input-item flag is **`untrusted`** (bridged to runtime `injectionRisk` by `applyInputContract`, positional nth-input→nth-item).
3. **`ensureApproach` + `ensureDiscipline` on the facade** — ✅ both present, plus `ensureGuardrail`. ⚠️ **a discipline needs ≥1 guardrail or it fails every run** → we skip disciplines initially (see §4).

---

## 10. Build order

1. **AI Core** lands §9.1–9.3 (Kim, in progress).
2. **Engine** reshapes the manifest to records + input contracts and exports it from the package (§5).
3. **cog-ingest** (one PR/version):
   - Seeding helper (§3); decompose the own six ops (§4); seed engine ops from the manifest (§5).
   - Run-path rework: `input`/marker/injection-risk for the six ops; engine-adapter `task`→`input` (§6).
   - Seed the marker catalogue (`captured-media`, `chunk-to-situate`, `extracted-text`, `source-document`, …) with preambles.
4. **Verify:** `npm run type-check && build && check:templates && conformance:check && contract:check && parity:check` + esbuild gen-check + adversarial review; then host-tsc via Kim's `npx cognitive-ingest update` in veradai (his gate — no manual veradai edits).
5. **Release:** `version:patch` (or minor — new seeding subsystem), changelog + roadmap, push docs submodule then parent (`cognitive-ingest` remote).

---

## 11. Open questions

- **parse-QA vs fencing.** Injection-risk sanitisation strips control/bidi/zero-width chars — the very "stray control characters" parse-QA is meant to flag. Mojibake still survives (valid UTF-8), so detection is only partly blunted. Decide: accept the trade-off, or let parse-QA's extracted-text item opt out of sanitisation while keeping the marker.
- **Approach granularity.** Op-specific role text ("strict parse-quality judge") as its own `ai_approach` record, or folded into `objective`? Leaning: role = approach record (reusable, admin-visible), keeps `objective` about the goal.
- **Engine-adapter content item** — the *content being extracted* is an `upload` input; `ontology`/`entity-types` are `context`. Confirm the split when reshaping the manifest.
- **Seed timing** — engine-op seeding at **boot** (idempotent `ensure*`, self-heals if AI Core registered late) vs **install** hook. Leaning boot, matching the existing own-op seeding.
- **Marker set + preambles** — final list and wording; admin-editable after seed.
- **cog-op as a formal abstraction?** Keep "cog-op" as naming only, or make the pipeline a data-driven registry of cog-ops (each declaring its backing — AI operation / engine call / transform — and its input kinds)? The 5-stage pipeline already exists; formalising it is a separate call from the seeding rework.

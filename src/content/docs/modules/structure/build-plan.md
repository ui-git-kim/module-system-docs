---
title: Build Plan (Veradai-Driven)
description: Phased implementation plan for the current veradai-driven structure work, grounded with file:line insertion points.
sidebar:
  order: 13
---

The current veradai-driven build plan, grounded against the structure code on 2026-07-26. Each phase is self-contained; do them in order (later phases assume earlier config patterns). Companion to the [Roadmap](/modules/structure/roadmap/)'s "Veradai-Driven Build Sequence" section.

## How to work in this repo (read first)

- **Templates are string constants.** `src/templates/**` are backtick strings that generate host-app code; their `@/` imports resolve in the **target app**, not here. The module's own `tsc` can't type-check generated code.
- **Validate every change:** `npm run check:templates` (catches unescaped `${` — but NOT stray backticks, so also type-check) → `npm run type-check` → `npm run build` → **host tsc**: in the veradai app, run `tsc --noEmit -p tsconfig.json` in **both** `backend/` and `frontend/` (structure must show **0 errors in `features/structure`**; billing/document-management carry pre-existing errors — ignore those). Update the host to the new version first.
- **Escaping:** a literal backtick or `${...}` in *generated* code must be written as an escaped backtick / `\${` inside the template string.
- **Config lives in TWO hand-maintained copies:** `NodeTypeConfig`/`NodeTypeRules`/`NodeTypeField` exist in `src/templates/frontend/index.ts` **and** `src/templates/backend/index.ts`. Add every new config field to **both**.
- **Ship flow per feature:** feature commit → `npm run version:patch` → build → docs (changelog + roadmap in the `docs/` submodule; commit+push docs, then bump the module's docs pointer) → host-validate → push module.
- **`conformance:check`** must stay clean (scaffold ≥1.30.0). Backend module code: no `console.*` (use `createModuleLogger`), fire `actionRegistry.doActionAll` after CRUD, `.js` on relative imports.

### Adding a per-node-type config object — the 12 mirror sites
Use `workflowConfig` (full, has an admin editor) or `contextConfig` (stored, no editor) as the copy-paste exemplar. For a new config `foo`:

1. **Prisma column** — `src/templates/schema.ts` `model structure_node_type` (config block ~L213-234): `foo Json @default("{}")`. **No `migrations.ts` entry is needed** for a plain JSON column — the host's `prisma migrate dev` (run by `structure update`) adds it; `migrations.ts` is only for raw SQL Prisma can't express (pgvector extension / HNSW indexes). Confirmed against git history: the `permissions` and `conditionalColor` config columns were added schema-only, with no `migrations.ts` entry. *(Corrected 2026-07-29 during Phase 1 — the earlier "⇒ a migration entry" note was wrong.)*
2. **Frontend type** — `frontend/index.ts` `NodeTypeConfig` (starts L244), after the `permissions` block (~L299).
3. **Backend type copy** — `backend/index.ts` `NodeTypeConfig` (L5956, after ~L5993) and `NodeTypeProposal` (L6061) if it should ride proposals.
4. **Backend 8 mapping sites** (each has a `workflowConfig`/`contextConfig` line adjacent): `mapNodeTypeProposal` L2507/2509 · `listNodeTypes` L3881/3886 · `getNodeType` L3990/3997 (keep parity with listNodeTypes — noted bug at L3991) · `createNodeType` L4048/4053 · `updateNodeType` L4113/4118 · `exportNodeTypes` L4236/4241 · `importNodeTypes` L4295/4300 · `proposeNodeType` L4446/4448.
5. **Zod** — `backend/index.ts` `createNodeTypeSchema` L5603 (~L5627). `updateNodeTypeSchema` (`.partial()`, L5635) and `proposeNodeTypeSchema` (`.extend()`, L5638) inherit automatically.
6. **Admin form** — `frontend/pages.ts` `NodeTypeForm` (L3489): **seed it in `formData` init (~L3567)** — the form PATCHes the whole object, so an unseeded key is wiped on save — then add a UI section (model on the `conditionalColor` block ~L4045 or the workflow editor ~L5106). `updateField('foo.key', v)` supports dotted nested paths.

## Phase 1 — Primary-node scope selector + parent enforcement (✅ SHIPPED v1.24.0)

> **Shipped in v1.24.0** (2026-07-29). Delivered as designed: `primaryScope` config (`isPrimary` + `scopedTypes`) via the mirror-site pattern (11 sites — **no `migrations.ts` entry**, see the correction above); `useCurrentScope` store cloning the registry singleton, persisted through `patchSetting`; a `ScopeSelector` header component (`type: 'custom'`, self-hiding until a primary type exists); `pathPrefix` injection in `NodeListPage` (self-type never scoped; empty/`*` = all, else listed); and `enforceHierarchyRules` in `createNode`/`moveNode` (opt-in per rule → no regression for unconfigured types). Host-validated against veradai's installed types (type-clean; the only host errors were the expected `primaryScope` Prisma-column regen). **Deferred follow-ups:** `bulkCreateNodes` does not run enforcement; `moveNode`'s `maxDepth` checks the moved node's own new depth, not each descendant of a moved subtree; scoped **tree** (`getTree` `pathPrefix`) untouched. Original plan retained below for provenance.

**Goal:** an admin marks a node type as the *primary scope* (e.g. Matter); a header dropdown picks the current instance; list/detail queries scope to that node's subtree. Scoped types are an **admin choice** (a list; empty/`*` = everything). Also close the must-have enforcement gap: `createNode` must require a valid parent for non-root types and reject disallowed parent/child.

**What already exists:**

- **Subtree scoping is fully wired via `pathPrefix`** — `NodeListQuery.pathPrefix` (`frontend/index.ts:131`) → service serialises (`:2023`) → backend `listNodes` `where.path = { startsWith: pathPrefix }` (`backend/index.ts:2667`). So `useNodes({ type, pathPrefix: scopeNode.path + '/' })` scopes to a subtree today. **No backend work for scoping.**
- **Header slot** — `headerToolbarRegistry.register({ id, type, position, order, component })` (example: `HEADER_TOOLBAR_REGISTRATION`, `registrations.ts:403`). Use `type: 'custom'` for a live trigger.
- **NodeSelector** — controlled combobox, filter by `allowedTypes` (`components.ts:911`). Fine for a root-type primary picker.
- **Persistence** — `structure_settings` via `structureService.patchSetting(key, value)` + `useStructureSettings()` (`frontend/index.ts:2255-2267, 2348`).

**Net-new to build:**

1. **`primaryScope` config** on the node type — `isPrimary` + `scopedTypes` (empty/`*` = scope everything). Add via the 12-site pattern. Admin UI: an `isPrimary` toggle + a multi-select of node-type slugs (populate from the form's `availableTypes`/`typesBySlug`, ~`pages.ts:3581`).
2. **`useCurrentScope()` store** — there is **no zustand/context in the module**; clone the `NodeTypeRegistry` reactive-singleton pattern (`frontend/index.ts:1201`, `onSync`/`notifySync`) into a `currentScopeStore` holding the selected primary node id, hydrated from and written through to `patchSetting('currentScopeNodeId', id)`. Expose `useCurrentScope()`.
3. **Header component** — a `ScopeSelector` (in `components/toolbar/`) registered via `headerToolbarRegistry` (`type:'custom'`). Renders a `NodeSelector` for the primary type bound to `useCurrentScope()`. Only register when a primary-scope type exists.
4. **Query wiring** — where list pages call `useNodes(query)`, inject `pathPrefix: scopeNode.path + '/'` when the queried type is in the active `scopedTypes` (or `*`). Central spot: `NodeListPage` (`pages.ts`). Unscoped/reference types ignore the scope. (Scoped tree would need `getTree`/`useNodeTree` to accept `pathPrefix` — `frontend/index.ts:3136`, `backend/index.ts:3514` — defer.)
5. **Parent enforcement (the trust-fix half)** — in `createNode` (`backend/index.ts:2839`, after the parent-existence check ~L2867) and `moveNode` (L3119): read the child + parent type `rules` and **reject** when a non-`isRoot` type has no parent; the parent's type is not in the child's `allowedParents` (if set); the child's type is not in the parent's `allowedChildren` (if set); `maxChildren`/`maxDepth` exceeded. `rules` is currently mapping-only, **never enforced** — net-new server logic.

## Phase 2 — AI fields (when AI Core is installed) (✅ NODE-TYPE HALF SHIPPED v1.30.0)

> **Node-type half shipped in v1.30.0** (2026-08-01). Delivered the Structure-side **storage + exposure**: an `AiFieldsConfig` type (`{ promptSegments?: Array<{ type: 'context'|'task'|'external'; label?; content }>, outputExamples?: Array<{ label?; input?; output }> }`) + an `aiFields` config on node types via the `contextHints`/`governance` mirror-site pattern (schema `aiFields Json @default("{}")` column + both `NodeTypeConfig` copies + `NodeTypeProposal` + the 8 CRUD mapping sites + Zod — round-trips through export/import). **The shape was grounded against AI Core's real contract** (`Modules/ai-core` `assembler.ts` + `types.ts`): `promptSegments[].type` is identical to AI Core's `ConsumerSegment.type` and carries `content: string`, so a consumer maps a structure segment straight onto an AI Core `run({ segments })` call. **Structure builds NO UI and never interprets `aiFields`** — AI Core self-registers its AI tab via `StructureModuleRegistration.tabs` (no frontend module-presence check exists; a tab is present iff its module registered it) and owns editing + consumption. Host-reviewed clean vs veradai's installed types (mirror-site completeness + ai-core contract alignment; 0 defects). **Deferred (the connection-type half):** `contextHints`/`contextConfig`/`aiFields` on **connection types** — connection types have no context surface today, so that is a separate connection-type-config mirror surface (its own schema column + `ConnectionTypeConfig` copies + connection-type CRUD mapping sites). Original plan retained below.

**Goal:** an admin surface to define per-node-type and per-connection-type AI config — context hints, **prompt segments, output examples** — that plumb into AI Core's prompt-assembly. Visible only when ai-core is present.

**What exists:** `contextHints` + `contextConfig` per node type (drives `GET /nodes/:id/context`, `backend/index.ts:4963`). Connection types have no context.

**Key decision — the conditional tab:** structure has **no frontend module-presence check** today. Recommended: **ai-core self-registers the AI tab** via `StructureModuleRegistration.tabs` (`frontend/index.ts:1150`, registered through `structureRegistry` at `:1810`) — presence is implicit, matches "other modules park their cars." Structure's job: store an `aiFields` config on node types AND connection types, expose it on reads, provide the registration slot (exists).

**Net-new:** `aiFields` config (12-site pattern); the same context on `ConnectionTypeConfig` (`frontend/index.ts:809`) + `structure_connection_type` schema + connection-type CRUD (`backend/index.ts` ~L5143). **Coordinate the `aiFields` shape with ai-core's prompt-assembly contract first** (cross-module contract).

## Phase 3 — Generic node-type "rules" section (sensitivity first) (✅ SHIPPED v1.25.0)

> **Shipped in v1.25.0** (2026-07-30). Built as a generic `governance` config sibling to `primaryScope` (14 mirror sites — the block is generic so retention/access rules can join `classification` later), plus per-field `sensitivity?` on `NodeTypeField`, a per-node `structure_node.classification` override column (full `workflowState` mirror + a `classificationChanged` hook), and exported pure evaluators `getEffectiveClassification` / `isExportSafe(node, type, level)` (rank-ordered; unclassified = fail-open, unknown level = fail-closed; an empty-string override falls through to the type default — a fail-open closed during review, with `.min(1)` on the classification zod fields as defence-in-depth). Admin UI: a levels/default editor on the Hierarchy tab + a per-field Sensitivity picker. Host-validated against veradai's installed types (type-clean; only the expected `governance`/`classification` Prisma-column regen). **Design calls:** levels are **per-type** (own-config, NOT inherited via `superClasses`), the per-node override is **API-only** (no UI picker yet), and export-pipeline enforcement stays a consuming module's job. Original plan retained below for provenance.

**Goal:** an extensible per-type rules block; first rule type is **sensitivity/privilege classification** (court-ready / internal / privilege-claimed).

**What exists:** `NodeTypeRules` (`frontend/index.ts:357`, backend `:6025`) = isRoot/allowedParents/allowedChildren/maxDepth/maxChildren — **config-only, unenforced** (Phase 1 adds parent enforcement). No classification concept exists (`secret`/`editableBy` is encryption/permissions, different).

**Net-new:** a classification block (extend `NodeTypeRules` or a sibling `rules` config via the 12-site pattern): per-type **default** sensitivity + optional per-field sensitivity (add `sensitivity?` to `NodeTypeField`, both copies) + per-node override. Plus an **`isExportSafe(node, level)`** helper (structure stores + evaluates; the export pipeline in a consuming module enforces the gate). Keep the block generic/extensible; ship only classification now.

## Phase 4 — Field UX: collapsible fields + repeater `allData` fix (✅ SHIPPED v1.26.0)

> **Shipped in v1.26.0** (2026-07-30). `defaultCollapsed?: boolean` on the **frontend** `NodeTypeField` only (a pure render concern — the backend copy omits UI flags like `isHidden` by design; it rides in the fields JSON). `NodeFieldRenderer` wraps the field container (edit **and** read-only) in a shadcn `Collapsible` when set — which also covers `field-group`s, since they render through that container, so a whole repeater group collapses. Field-editor toggle added. The repeater `allData` fix passes `{ ...allData, ...item }` to the nested sub-field renderer (row wins on id collision) — a **behaviour change** for existing repeater sub-fields with `visibleWhen`/`computedTemplate` (previously silent no-ops, now live), noted in the changelog. Frontend-only, no schema change; host-validated type-clean against veradai (Collapsible present, no regen needed). Original plan retained below.

**Net-new / fix:**

**Net-new / fix:**

1. **`collapsed?`/`defaultCollapsed?: boolean`** on `NodeTypeField` (`frontend/index.ts` ~L488, and backend copy `:6188`). Honour in `NodeFieldRenderer` (`components.ts:1648`): wrap the field container (~L2387) or the field-group Card (~L1957) in a shadcn `Collapsible`, default-collapsed per the flag. Add the toggle to the admin field editor. `visibleWhen` already works; this is the "hidden until revealed" complement.
2. **Repeater `allData` bug (confirmed):** in the field-group sub-field loop (`components.ts:1974-1986`) the nested `NodeFieldRenderer` is rendered **without `allData`**, so `computedTemplate` and `visibleWhen` silently no-op inside repeaters (guards at L1659/1666/1674/2322). Fix: pass `allData={item}` (the current row) at ~L1984. **Single centralized site** — fixes both `NodeForm` and `NodeInfoTab`. (Decide: row-only `item`, or merge top-level + row.)

## Phase 5 — Merge-field exposure (rescopes Custom Detail Page Layouts) (✅ SHIPPED v1.28.0)

> **Shipped in v1.28.0** (2026-07-31). All three net-new pieces delivered, plus the `cardTemplateId` resolution fix. **(1) Metadata API:** a single pure `flattenMergeFields(fields, refFieldsBySlug)` core in a new React-free `utils/merge-fields.ts`, wrapped by `getMergeFieldSchema(nodeType)` → `MergeFieldToken[]` (`path` / `insertText` / `label` / `type` / `kind` + optional `via` / `multiple` / `inheritedFrom`; kinds `builtin` / `field` / `group-subfield` / `node-ref`; full resolver parity — built-ins + top-level + `{group.sub}` + one-hop `{ref->field}`). The token shape is the settled useFoundry contract. **(2) Reusable resolver:** `resolveTemplateAsync` moved into `utils/merge-fields.ts`, now **exported** with an injectable `fetchNode` (defaults to `structureService.getNode`) + a `resolveMergeFields(template, node)` convenience that folds `name`/`description`/`slug` into the data bag; `useResolvedTemplate` (unchanged, still exported from `NodeFieldRenderer`) wraps it. **(3) Card:** `titleTemplate`/`bodyTemplate` on `CardTemplateConfig` **and** `navigation.listPage.card`, resolved by `NodeCard` (falls back to `node.name`); `NodeCard` now also resolves `cardTemplateId` → the referenced `structure_template` row (precedence `templateOverrides.card` > `navigation.listPage.card` > shared row) — a **behaviour change** (previously the pointer was ignored). Plus: the admin "Insert field…" pickers now surface group + deref tokens via `getMergeFieldSchema`, and a public **`GET /:type/schema`** endpoint returns `{ type, fields, referencedTypes }` (secret-filtered lean descriptors = the flattener's inputs; unexposed reference targets redacted to honour the no-existence-leak rule). **Design decision (settled in-session with the useFoundry owner):** *both* an in-app util (`getMergeFieldSchema`) *and* the public endpoint, with **one** flattener — achieved by having the endpoint return the flattener's raw inputs rather than a second server-side token generator (`check:templates` forbids sharing a source fragment across template constants). Host-type-reviewed clean against veradai's installed types (4-dimension adversarial pass, 0 confirmed defects); **host tsc pending user-side.** **Deferred:** linking a node type's card/page to a useFoundry component *file* (the built-in card is the baseline); inherited (superClass) fields in the admin picker; per-node-type card-template *editor* UI for the new slots (settable via JSON/template config today). Original plan retained below for provenance.

**Goal:** expose structure merge fields so the external **useFoundry** visual builder can bind components to a project's fields (the JetEngine / Dynamic.ooo ↔ Elementor model); ship a simple merge-field-driven card as the baseline. Structure = data + merge-field exposure; useFoundry = presentation.

**What exists:** the resolver `resolveTemplateAsync(template, data, cache)` (`components.ts:1471`; 7 token forms — `{field}`, `{group[sub=val].x}`, `{group[0].x}`, `{field->nodeField}`, etc.; one node + one-hop node-ref; **no aggregation**). `useResolvedTemplate` is exported (React hook); **`resolveTemplateAsync` is NOT exported**. `NodeCard` (`components.ts:100`) renders **raw** `node.data[id]` and never calls the resolver; `CardTemplateConfig` (`frontend/index.ts:664`) has **no template-string slot**. No merge-field **metadata/listing** API exists.

**Net-new (three pieces):**

1. **Merge-field metadata API** (the main piece) — returns the flattened set of **bindable tokens** for a node type: top-level fields + field-group subfields + `->` node-ref deref targets, each as `token / label / type`. Build on `NodeTypeField` + `getFieldsForNodeType` (`frontend/index.ts:1859`). Expose in-app (admin picker) and, for useFoundry, consider a schema surface on the public API (`GET /:type/schema`; the public API is instances-only today, `backend/index.ts:1825`).
2. **Reusable resolver** — extract/export the pure `resolveTemplateAsync` (or a `resolveMergeFields(template, node)`), so useFoundry and a card renderer can resolve tokens without the React hook.
3. **Merge-field-driven card (baseline)** — add template-string slots to `CardTemplateConfig` (e.g. `titleTemplate`, `bodyTemplate`) and have `NodeCard` run the resolver. Optionally let a node type **link its card/page to a useFoundry component file** instead of the built-in card.

**Coordination:** the metadata shape is the contract useFoundry consumes — spec it with the builder. The `merge-fields.mdx` doc's caution about built-in templates is stale (resolved in v1.23.3).

## Lower priority / as-pulled

- **Rename `workflow` → `status`** — **ON HOLD (name TBD, 2026-07-30):** `status` collides with the existing node-lifecycle column (`active`/`archived`/`deleted`), so a different target name is being chosen before this public-API + DB rename. Keep it **first-class** (the status-changed hook is the automation / task-module plug-in point); rename `workflowState`/`workflowConfig`/`workflowStateChanged` via a **deprecation shim** (public API — no cold-delete; `@deprecated` + one-minor-version window). Status **transition enforcement** (the allowlist, unenforced at `updateNode`) is net-new.
- **Search widening** — ✅ **SHIPPED v1.27.0.** `listNodes` `search` now also matches custom `data` field VALUES via a guarded raw query (`jsonb_typeof = 'object'` guard + `jsonb_each_text(...) ILIKE`, ORDER BY id, LIMIT 5000) folded into `where.OR`. Values only (nested groups match as JSON text); best-effort/unindexed. Structured querying stays the `dataFilters` engine; retrieval/ranking stays cog-ingest/AI-Core.
- **Bulk connection creation** — ✅ **SHIPPED v1.27.0.** `bulkCreateConnections(userId, connections[], { skipHooks? })` service method (partial-success like `bulkCreateNodes`, reuses `createConnection` for full validation) + `POST /connections/bulk` + `bulkCreateConnectionsSchema`. Reachable via `serviceRegistry.get('structure')` for cog-ingest; `skipHooks` fires one `structure.connections.bulkCreated` summary (XOR with per-row hooks, `structure.node.classificationChanged` + `structure.connections.bulkCreated` added to the action-hook doc table).

## Parked / not structure's job

- **Server-side field validation** (min/max/pattern/required-if) — native-HTML-only today; **parked** (not form-heavy).
- **Graph-derived values** — **cog-ingest/db computes**; structure stores the result in an `editableBy:'system'` field. Storage already exists — no structure work.
- **Audit-log storage** — **Activity module** (structure already fires `doActionAll` CRUD hooks).
- **Tree view** — deferred (was for a different app; stays on the general roadmap).

## Shared field templates across node types (✅ SHIPPED v1.29.0)

> **Shipped in v1.29.0** (2026-08-01). Built as a dedicated **`structure_field_template`** table `{ name, slug, description, fields }` (NOT overloading the rendering-only `structure_template`) + a `fieldTemplateIds: string[]` config on `structure_node_type` (14-mirror-site pattern, no `migrations.ts` entry). **Merge:** template fields are threaded through the `TypeGraph` (new optional `TypeGraphEntry.templateFields`, populated in `loadTypeGraph` + `listNodeTypes`) and spliced in `resolveTypeInGraph` between own and inherited fields (own › template › inherited, id-shadowed, tagged `fieldTemplateId`). **The security-critical half:** the write-path walker `getFieldDefs` was made template-aware too (it re-reads raw fields for secret-sealing + `editableBy` — splicing only into `resolved.fields` would have left template secrets in plaintext and template locked fields writable). `getFieldDefs` and `resolveTypeInGraph` agree on precedence and both exclude ancestors' templates (**attach-only** — templates are NOT inherited via `superClasses`; a subtype attaches its own). `stripInheritedFields` also drops `fieldTemplateId`-marked fields on write. **Surface:** field-template CRUD service/routes/Zod (admin-gated) + a GDPR erasure handler; frontend types/service/hooks (`useFieldTemplates`/`useFieldTemplateMutations`); a dedicated **Field Templates** admin page (JSON authoring, `adminPagesRegistry`); and a NodeTypeForm **Fields**-tab attach picker (badge multi-select) + template-provenance preview. Host-reviewed clean vs veradai's installed types (5-dimension adversarial pass, 0 confirmed defects; the secret-sealing inclusion independently re-verified). **Design calls (settled in-session, delegated):** attach-only precedence own › template › inherited; JSON-based authoring for v1 (visual field-set editor deferred — the existing editor is coupled to `mergeTokens`/governance); dangling `fieldTemplateIds` (deleted template) are tolerated (silently skipped). **Follow-ups — both now shipped:** visual field-set editor ✅ **v1.31.0** (extracted a shared `NodeFieldSetEditor` from the node-type field editor; the Field Templates page now uses the full visual builder instead of JSON); per-field-group nested-secret sealing ✅ **v1.30.1** (`getFieldDefs`/`sealSecretFields`/`unsealSecretFields` + the `editableBy` guard now recurse one level into `field-group` sub-fields — a secret sub-field was previously stored plaintext). Original candidate analysis retained below.

**Does this exist? No** (verified 2026-07-29 — this section predates the v1.29.0 build). There is no first-class, admin-authorable "define a field or field-group once, reuse across many node types" feature. Candidate mechanisms and why they fall short:

- **`structure_template` is a false friend** — it stores **rendering/layout** templates only (`type: card | listItem | detailHeader | overview`; `config` = slots/layout + a `showFields` *display filter*). No field sets, no `fieldTemplateId`. (`schema.ts:321-354`; zod enum `backend/index.ts:5873`.)
- **`superClasses` (type hierarchy)** — the closest *admin-usable* mechanism: a multi-parent is-a DAG (≤10 parents) whose fields merge into `resolved.fields` (id-shadowed, tagged `inheritedFrom`) via `resolveTypeInGraph` (`backend/index.ts:2429`). But it's **is-a inheritance, not free composition** — reusing a field group means making unrelated types subtype a shared base, which also drags in that base's `features`, subsumption, scope-expansion, etc. You inherit the *whole* base, not a named, selectable bundle.
- **Module-registered fields** (`structureRegistry.register({ fields })`, `nodeTypes: '*' | slug[]`, `frontend/index.ts:1811/1865`) — genuine "define-once, attach-to-many," but authored in **TypeScript at boot, not by admins**; admins can only toggle/relabel via `fieldIntegrations`.
- **`field-group`** — a **within-one-type** repeater; sub-fields live in that type's own config, not shared.

**Net-new to build (reusing existing pieces):**
1. A **shared field-set entity** — a dedicated `structure_field_template` table `{ name, slug, description, fields: NodeTypeField[] }` (cleaner than overloading `structure_template`, whose semantics are rendering-only).
2. An **attachment point** on `structure_node_type` — a `fieldTemplateIds` column parallel to the per-view `*TemplateId` columns (`schema.ts:241-245`) + an admin picker.
3. **Merge into effective fields** — splice the attached template's fields into `resolved.fields` inside `resolveTypeInGraph` (`:2429`) and/or `getFieldsForNodeType` (`:1865`), tagged with provenance like `inheritedFrom` so they render but aren't persisted as own fields. The single read-path `resolved.fields ?? fields` (used by every consumer) is the one integration point.
4. **Watch-out:** the server field-def walkers — `getFieldDefs`/`getSecretFieldIds` + `editableBy` enforcement (`backend/index.ts:2175-2199`) — MUST include template fields, or secret sealing and permission checks would silently skip fields coming from a shared template.

**UX is not yet designed** — settle before building: how templates are authored/edited; how a type attaches one (ordering/precedence vs its own + inherited fields); how same-id conflicts resolve; whether a template may contain a `field-group`; how the admin distinguishes template vs own vs inherited fields. Worth deciding whether this, `superClasses`, and the Phase 5 merge-field exposure should share one coherent "reusable fields" story.

## Suggested phase order & sizing

1. Primary scope + parent enforcement — ✅ **SHIPPED v1.24.0**.
2. AI fields tab — **M**, blocked on ai-core contract alignment.
3. Generic rules / sensitivity — **M**.
4. Field UX (collapse + repeater fix) — **S** (the repeater fix alone is a one-line high-value bug fix).
5. Merge-field exposure — **L**, spec with useFoundry; rescopes custom layouts.
6. Shared field templates across node types — **L**, UX design first (candidate; section above).

---

# Generic Platform Hardening — Stages 1–3 (2026-08-09)

The next build sequence, from the 2026-08-09 gap-analysis audit. Framing and the standing calls live in [Design Decisions](/modules/structure/decisions/); this section is the grounded, phase-by-phase plan. It is **generic** — Structure is the admin-configurable architecture, not any one app's domain.

> **The dominant audit finding:** the field/type **definition** layer is already rich; what's missing is **server-side enforcement** and a few platform features. The write path validates only the request envelope (`data` is `z.record(z.string(), z.unknown())`, `backend/index.ts:7566`) — every value contract (required / pattern / min-max / enum / coercion / computed correctness / node-type permissions) is currently enforced only in the React `NodeForm` and accepted verbatim by the server. cog-ingest writes into Structure through the same service, so the write path must be safe for **both** human and programmatic writers.

## Stage 1 — write-path integrity + the two new requirements

### S1.1 — Server-side field validation (**M–L**)
One shared validator over the resolved field set, run on every write path.

- **Where:** a new `validateNodeData(fields, data, { partial })` helper beside `getFieldDefs` (`backend/index.ts:3074`, which already resolves own + `superClass`-inherited + shared-template fields — the single source of truth). Enforce `required` / `requiredWhen`, `validation.pattern` / `min` / `max`, `select`/`multiselect` enum membership (from `options[]`), and type coercion per field `type`. Evaluate `visibleWhen` server-side and skip hidden fields (mirror `getMissingRequiredFields`, `frontend/components.ts:783`).
- **Call sites:** `createNode` (`:4178`, after the `beforeCreate` filter and before persist), `updateNode` (`:4292`, `partial` — validate only supplied keys), `bulkCreateNodes` (`:4993`, per row, hoist the resolved defs once per type), and the public-API write paths (`:2826` POST / `:2846` PATCH).
- **Programmatic writers:** skip validation only for `editableBy:'system'` fields written by trusted service callers (cog-ingest's graph-derived values) — reuse the `editableBy` classification already read at `:4346-4367`.
- **Decision D9:** application-layer only (no DB CHECK / `pg_jsonschema`).

### S1.2 — Computed-value server trust (**M**)
`formula` (`calcConfig`) and `computedTemplate` values are client-computed and accepted verbatim (`frontend/index.ts:580`; no server evaluation). Port the safe evaluator (`utils/formula.ts`, already React-free) and the merge-field resolver (`utils/merge-fields.ts`) to the backend and, on write, **recompute** computed/formula fields server-side (or reject client-supplied values for them). Fold into the S1.1 validation pass in `createNode`/`updateNode`.

### S1.3 — Node-type permission enforcement + `inputScope` (**M**)
Make the config-only `permissions` block real, and add `inputScope`.

- **Config:** extend `permissions.{create,edit,archive,delete}` to the `'anyone' | 'admin' | 'system'` tier (`frontend/index.ts:340`); add two node-type fields — `inputScope: 'system' | 'admin' | 'user'` (who *creates*) and `global: boolean` (shared + scope-exempt) — via the [12-mirror-site pattern](#adding-a-per-node-type-config-object--the-12-mirror-sites). *(The "this one field is AI-written only" case stays field-level `editableBy: 'system'`.)*
- **Enforce in the service methods** (not routes — `serviceRegistry.register` at `:104` and the public API bypass route middleware): thread `isAdmin` into `createNode` (`:4178`), `duplicateNode` (`:4613`), `bulkCreateNodes` (`:4993`), `moveNode` (`:4538`), `archiveNode` (`:4803`), `deleteNode` (`:4473`), `restoreNode` (`:4823`) + the bulk variants (`:5112`), exactly as `updateNode` already takes `options.isAdmin` (`:4296`). Load the node-type `permissions` the way `updateNode` loads `builtInFieldConfig`.
- **Routes:** add `attachRole` (`:1630`, currently only on PATCH) to every node-write route so `req.user.role` is present; public API passes `isAdmin:false` (as PATCH already does at `:2864`).
- **UI:** add the missing `permissions` + `inputScope` + `global` editor to `NodeTypeForm` (block is already in form state, no editor); add archive/delete client gates to match `pages.ts:177/814`.

### S1.4 — Shared / reference (`global`) nodes via nullable owner (**L**, D2)
- **Schema:** make `structure_node.userId` nullable (`schema.ts:30`); `null` = a shared row, written only for `global`-type nodes. Rework the userId-prefixed uniques (`@@unique([userId, slug])`, `@@unique([userId, parentId, name])`, `:133-134`) with **partial unique indexes** for null-owner rows (raw SQL in `migrations.ts`, since Prisma can't express partial uniques).
- **Reads:** visibility predicates become `{ OR: [{ userId }, { userId: null }] }` (the idiom type lookups already use, e.g. `:4247`); **writes** stay strict `{ userId }` (only an admin/system provisions `global` rows).
- **Connectable-to-shared:** relax the `createConnection` target-endpoint ownership check (`:6241-6248`) to accept a null-owner `global` node; source stays caller-owned; `fromTypes`/`toTypes` still gate (`:6268-6278`).
- **Cascade:** the account-deletion handler (`backend/registrations.ts:95`) already deletes only `where:{userId}`, so null-owner rows are spared — keep the unscoped-refusal guard.

### S1.5 — Enforced scoping / `rootNodeId` (**L**, D6)
- **Schema:** add `rootNodeId String?` to `structure_node` (hierarchy block `:45-51`) + `@@index([userId, rootNodeId])` and `@@index([userId, nodeType, rootNodeId])`. Backfill from `path[0]` (migration).
- **Maintenance:** in `calculatePath`/`createNode`, `rootNodeId = parent.rootNodeId ?? parent.id` (a root sets its own id). In `moveNode` (`:4538`), recompute `rootNodeId` for the node **and every descendant** in the same transaction (piggyback `updateDescendantPaths`). A move that **crosses** an `enforced` space boundary is rejected **unless** the moved node's type sets `rules.allowCrossSpaceMove` — then it is permitted and the `structure.node.moved` payload carries old/new `rootNodeId` for audit (D3).
- **Config:** `primaryScope.isolation: 'filter' | 'enforced'` (`schema.ts:243`; extend the type at `frontend/index.ts:312`), plus an admin-set per-node-type `rules.allowCrossSpaceMove` (default false).
- **Request scope:** a validated `scopeRootId` param (validate: exists, owned, `isPrimary`, `enforced`) — never trust the client store. `enforced` + missing/invalid scope → fail closed.
- **Read surfaces (inject `where.rootNodeId`):** `listNodes` (`:3930`), `getNode` (`:4135`), `searchNodes` (`:6516`), `getTree` (`:4954`), `getNodeConnections` (`:6370`), `listConnections` (`:6600`), `expandGraph` (`:6437`), `getNodeContext` (`:6778`), `dataFilters` (`:4031`), both public-API reads (`:2715`, `:2740+`), and `moveNode`/`duplicateNode` targets.
- **Connection joint rule (Decision A):** reject cross-space connections unless one endpoint is a `global` type — in `createConnection` (`:6241-6278`), `bulkCreateConnections`, and `expandGraph`.
- **Cross-module:** add `rootNodeId` to node lifecycle payloads (`structure.node.created` `:4286`, `.updated` `:4420`, `.moved` `:4607`) and connection payloads (`:6752`) — consumed by cog-ingest and document-management.

### S1.6 — Node revision history + restore + `auditEvents` contract (**L**, D8)
- **Schema:** new self-contained `structure_node_revision` table (`{ id, userId, nodeId, revision, data snapshot (name/description/data/stage/classification), changedBy, createdAt }`, `@@index([userId, nodeId, revision])`). **Node-record only** — no file bytes, no hash chain (document-management owns file versioning/hashing).
- **Write:** in `updateNode` (`:4420`), snapshot prior state before the in-place mutation; add `getNodeRevisions` + `restoreNodeRevision` service methods + routes; fire `structure.node.revisionCreated` / `.reverted`.
- **Audit contract:** declare the already-fired lifecycle events in the security manifest's `auditEvents` (`backend/registrations.ts` — currently absent), aligned to the starter's Typed Hook Catalogue, so a consuming audit module has a formal contract instead of hard-coded strings.
- **Erasure + manifest:** add `structure_node_revisions` to `dataCategories` + a deletion handler.

## Stage 2 — make it a real platform (raised priorities)

### S2.1 — Config env-promotion (**L**)
Server-side, **atomic** full-bundle export/import covering node types **+ connection types + groups + field templates + functions** (today `exportNodeTypes`/`importNodeTypes` are node-types-only at `:5809`/`:5871`; `connectionTypes` is accepted in the schema but silently ignored; the rest ride a client-side best-effort loop at `pages.ts:2283`). Add a diff/dry-run preview and per-definition versioning so admin-built structures promote dev→staging→prod reliably. *("Will bite downstream app teams immediately.")*

### S2.2 — Node-instance import/export (CSV/JSON) (**M**)
Generic bulk instance-data management (distinct from config): import a CSV/JSON of node instances with field mapping + per-row validation (reuse S1.1) + error reporting; export a node list. On Structure's own "Under Consideration" list; currently absent.

### S2.3 — jsonb + path indexing at scale (**M**)
`dataFilters` emits `"data"->>field` with **no GIN on `data`** (`migrations.ts:28` documents the seq-scan); add a GIN (`jsonb_path_ops`) or functional indexes on hot fields. Path-prefix `LIKE 'x%'` may not use the btree `path` index on default-collation Postgres — the `rootNodeId` equality index (S1.5) is the durable fix for scoped reads.

### S2.4 — Retention / purge (**S–M**)
Soft-deleted nodes (`status='deleted'`) live forever (`:4499`); add admin-configurable retention/purge for trashed nodes and old revisions (mirror document-management's artefact-retention pattern).

## Stage 3 / Roadmap — future & breadth

- **Blueprints / starter-packs** — a first-class "stamp out a whole node-type + connection set" primitive (a CRM pack, a PM pack). **Deferred to the roadmap** — relevant if the module system is distributed to third parties; a hand-authored JSON bundle is the interim.
- Outbound **webhooks** (H12 — not owned by Notifications, which deliberately excludes webhooks), saved **full views** (columns + sort, beyond filter presets), **slug** auto-derive + `publishedSlug` serving, **i18n** labels, **sibling drag-reorder** UI (the `/reorder` endpoint + hook exist, unused on node lists), bulk-**update**/bulk-**move** endpoints.
- One-off infra: **adopt scaffold v1.31.14** (self-heal migrations + `scaffold:update` fetch fixes).

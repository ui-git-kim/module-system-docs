---
title: Build Plan (historical)
description: The retired veradai-driven and generic-hardening build plan, kept for provenance. Superseded by the Roadmap at v1.34.27.
sidebar:
  order: 99
---

> **⚠️ HISTORICAL — do not work from this page.** This is the retired build plan (veradai-driven phases, then Generic Platform Hardening Stages 1–3). It was **superseded by the [Roadmap](/modules/structure/roadmap/) at v1.34.27**, which is the single live source for what is open and what is next. Nearly everything below has shipped, and the retained plan text describes designs that were later changed or abandoned — most notably S1.4's nullable-owner sharing model, which the code does **not** implement. The page is retained only for **provenance**: it records why each design was chosen and what was rejected. If you are picking up work, start at the Roadmap.

The original veradai-driven build plan, grounded against the structure code on 2026-07-26 and extended on 2026-08-09 with the Generic Platform Hardening stages. Each phase was self-contained and meant to be done in order. Companion to [Design Decisions](/modules/structure/decisions/).

> **All `file:line` insertion points have been removed.** Every code citation on this page is now a **symbol name only** — the line numbers were stale by 500–1,100 lines and a stale address is worse than none. Locate any site with `grep -n '<symbol>' src/templates/backend/index.ts` (and the frontend equivalents). Historical version claims in the SHIPPED banners have **not** been re-verified past the release they name.

## How to work in this repo (read first)

> **This section is the one part of the page still worth reading** — the repo conventions below, and the mirror-site recipe that follows, are not tied to any particular release. They are being promoted into `CLAUDE.md`; treat that as the source once it lands.

- **Templates are string constants.** `src/templates/**` are backtick strings that generate host-app code; their `@/` imports resolve in the **target app**, not here. The module's own `tsc` can't type-check generated code.
- **Validate every change:** `npm run check:templates` (catches unescaped `${` — but NOT stray backticks, so also type-check) → `npm run type-check` → `npm run build` → **host tsc**: in the veradai app, run `tsc --noEmit -p tsconfig.json` in **both** `backend/` and `frontend/` (structure must show **0 errors in `features/structure`**; billing/document-management carry pre-existing errors — ignore those). Update the host to the new version first.
- **Escaping:** a literal backtick or `${...}` in *generated* code must be written as an escaped backtick / `\${` inside the template string.
- **Config lives in TWO hand-maintained copies:** `NodeTypeConfig`/`NodeTypeRules`/`NodeTypeField` exist in `src/templates/frontend/index.ts` **and** `src/templates/backend/index.ts`. Add every new config field to **both**.
- **Ship flow per feature:** feature commit → `npm run version:patch` → build → docs (changelog + roadmap in the `docs/` submodule; commit+push docs, then bump the module's docs pointer) → host-validate → push module.
- **`conformance:check`** must stay clean (scaffold ≥1.30.0). Backend module code: no `console.*` (use `createModuleLogger`), fire `actionRegistry.doActionAll` after CRUD, `.js` on relative imports.

### Adding a per-node-type config object — the 14 mirror sites
Use `stageConfig` (full, has an admin editor) or `contextConfig` (stored, no editor) as the copy-paste exemplar. **Watch the `stageConfig` schema line:** the `workflow`→`stage` rename kept the physical Prisma column as `workflowConfig` via `@map`, so the schema declaration reads `stageConfig Json @default("{}") @map("workflowConfig")` while every TypeScript site uses `stageConfig`. (`workflowConfig` now survives only inside the rename SQL in `migrations.ts`.) For a new config `foo`:

1. **Prisma column** — `src/templates/schema.ts` `model structure_node_type` (config block): `foo Json @default("{}")`. **No `migrations.ts` entry is needed** for a plain JSON column — the host's `prisma migrate dev` (run by `structure update`) adds it; `migrations.ts` is only for raw SQL Prisma can't express (pgvector extension / HNSW indexes). Confirmed against git history: the `permissions` and `conditionalColor` config columns were added schema-only, with no `migrations.ts` entry. *(Corrected 2026-07-29 during Phase 1 — the earlier "⇒ a migration entry" note was wrong.)*
2. **Frontend type** — `frontend/index.ts` `NodeTypeConfig` (`grep -n 'export interface NodeTypeConfig'`), after the `permissions` block.
3. **Backend type copy** — `backend/index.ts` `NodeTypeConfig` and `NodeTypeProposal` if it should ride proposals.
4. **Backend 8 mapping sites** (each has a `stageConfig`/`contextConfig` line adjacent): `mapNodeTypeProposal` · `importNodeTypesTx` (the extracted transaction helper — both `importNodeTypes` and `importConfigBundle` delegate to it, so mapping it once covers both) · `listNodeTypes` · `getNodeType` (keep parity with `listNodeTypes`) · `createNodeType` · `updateNodeType` · `exportNodeTypes` · `proposeNodeType`.
5. **Zod** — `backend/index.ts` `createNodeTypeSchema`. `updateNodeTypeSchema` (`.partial()`) and `proposeNodeTypeSchema` (`.extend()`) inherit automatically.
6. **Admin form** — `frontend/pages.ts` `NodeTypeForm`: **seed it in `formData` init** — the form PATCHes the whole object, so an unseeded key is wiped on save — then add a UI section (model on the `conditionalColor` block or the stage editor). `updateField('foo.key', v)` supports dotted nested paths.

## Phase 1 — Primary-node scope selector + parent enforcement (✅ SHIPPED v1.24.0)

> **Shipped in v1.24.0** (2026-07-29). Delivered as designed: `primaryScope` config (`isPrimary` + `scopedTypes`) via the mirror-site pattern (11 sites — **no `migrations.ts` entry**, see the correction above); `useCurrentScope` store cloning the registry singleton, persisted through `patchSetting`; a `ScopeSelector` header component (`type: 'custom'`, self-hiding until a primary type exists); `pathPrefix` injection in `NodeListPage` (self-type never scoped; empty/`*` = all, else listed); and `enforceHierarchyRules` in `createNode`/`moveNode` (opt-in per rule → no regression for unconfigured types). Host-validated against veradai's installed types (type-clean; the only host errors were the expected `primaryScope` Prisma-column regen). **Deferred follow-ups:** `bulkCreateNodes` did not run enforcement, and `moveNode`'s `maxDepth` checked the moved node's own new depth rather than the deepest descendant of a moved subtree — **both fixed in v1.34.28**, along with the same hole on `duplicateNode`'s re-parenting path; scoped **tree** (`getTree` `pathPrefix`) untouched — **that last one is superseded**: S1.5 gave `getTree` an `options?: { scopeRootId?, isSystem?, isAdmin? }` bag instead, so the tree *is* scope-aware, just not by the deferred mechanism. Original plan retained below for provenance.

**Goal:** an admin marks a node type as the *primary scope* (e.g. Matter); a header dropdown picks the current instance; list/detail queries scope to that node's subtree. Scoped types are an **admin choice** (a list; empty/`*` = everything). Also close the must-have enforcement gap: `createNode` must require a valid parent for non-root types and reject disallowed parent/child.

**What already exists:**

- **Subtree scoping is fully wired via `pathPrefix`** — `NodeListQuery.pathPrefix` (`frontend/index.ts`) → service serialises → backend `listNodes` `where.path = { startsWith: pathPrefix }` (`backend/index.ts`). So `useNodes({ type, pathPrefix: scopeNode.path + '/' })` scopes to a subtree today. **No backend work for scoping.**
- **Header slot** — `headerToolbarRegistry.register({ id, type, position, order, component })` (example: `HEADER_TOOLBAR_REGISTRATION`, `registrations.ts`). Use `type: 'custom'` for a live trigger.
- **NodeSelector** — controlled combobox, filter by `allowedTypes` (`components.ts`). Fine for a root-type primary picker.
- **Persistence** — `structure_settings` via `structureService.patchSetting(key, value)` + `useStructureSettings()` (`frontend/index.ts`).

**Net-new to build:**

1. **`primaryScope` config** on the node type — `isPrimary` + `scopedTypes` (empty/`*` = scope everything). Add via the 12-site pattern. Admin UI: an `isPrimary` toggle + a multi-select of node-type slugs (populate from the form's `availableTypes`/`typesBySlug`, ~`pages.ts`).
2. **`useCurrentScope()` store** — there is **no zustand/context in the module**; clone the `NodeTypeRegistry` reactive-singleton pattern (`frontend/index.ts`, `onSync`/`notifySync`) into a `currentScopeStore` holding the selected primary node id, hydrated from and written through to `patchSetting('currentScopeNodeId', id)`. Expose `useCurrentScope()`.
3. **Header component** — a `ScopeSelector` (in `components/toolbar/`) registered via `headerToolbarRegistry` (`type:'custom'`). Renders a `NodeSelector` for the primary type bound to `useCurrentScope()`. Only register when a primary-scope type exists.
4. **Query wiring** — where list pages call `useNodes(query)`, inject `pathPrefix: scopeNode.path + '/'` when the queried type is in the active `scopedTypes` (or `*`). Central spot: `NodeListPage` (`pages.ts`). Unscoped/reference types ignore the scope. (Scoped tree would need `getTree`/`useNodeTree` to accept `pathPrefix` — deferred, and later solved differently via `scopeRootId`; see S1.5.)
5. **Parent enforcement (the trust-fix half)** — in `createNode` (`backend/index.ts`, after the parent-existence check) and `moveNode`: read the child + parent type `rules` and **reject** when a non-`isRoot` type has no parent; the parent's type is not in the child's `allowedParents` (if set); the child's type is not in the parent's `allowedChildren` (if set); `maxChildren`/`maxDepth` exceeded. `rules` is currently mapping-only, **never enforced** — net-new server logic.

## Phase 2 — AI fields (when AI Core is installed) (✅ SHIPPED v1.30.0 + connection-type half)

> **Node-type half shipped in v1.30.0** (2026-08-01). Delivered the Structure-side **storage + exposure**: an `AiFieldsConfig` type (`{ promptSegments?: Array<{ type: 'context'|'task'|'external'; label?; content }>, outputExamples?: Array<{ label?; input?; output }> }`) + an `aiFields` config on node types via the `contextHints`/`governance` mirror-site pattern (schema `aiFields Json @default("{}")` column + both `NodeTypeConfig` copies + `NodeTypeProposal` + the 8 CRUD mapping sites + Zod — round-trips through export/import). **The shape was grounded against AI Core's real contract** (`Modules/ai-core` `assembler.ts` + `types.ts`): `promptSegments[].type` is identical to AI Core's `ConsumerSegment.type` and carries `content: string`, so a consumer maps a structure segment straight onto an AI Core `run({ segments })` call. **Structure builds NO UI and never interprets `aiFields`** — AI Core self-registers its AI tab via `StructureModuleRegistration.tabs` (no frontend module-presence check exists; a tab is present iff its module registered it) and owns editing + consumption. Host-reviewed clean vs veradai's installed types (mirror-site completeness + ai-core contract alignment; 0 defects). **Connection-type half — ✅ also shipped since.** `contextHints` and `aiFields` now mirror onto connection types: `structure_connection_type` carries both columns (`schema.ts`), `ConnectionTypeConfig` carries both keys (`frontend/index.ts`), and all four connection-type CRUD mapping sites map them (`listConnectionTypes` :8657 · `getConnectionType` :8698 · `createConnectionType` :8739 · `updateConnectionType` :8781) with Zod. **The only remaining gap** is `contextConfig` on connection types — the node type's context-assembly block has no connection-type counterpart, if one is still wanted. Original plan retained below.

**Goal:** an admin surface to define per-node-type and per-connection-type AI config — context hints, **prompt segments, output examples** — that plumb into AI Core's prompt-assembly. Visible only when ai-core is present.

**What exists:** `contextHints` + `contextConfig` per node type (drives `GET /nodes/:id/context`, `backend/index.ts`). Connection types have no context.

**Key decision — the conditional tab:** structure has **no frontend module-presence check** today. Recommended: **ai-core self-registers the AI tab** via `StructureModuleRegistration.tabs` (`frontend/index.ts`, registered through `structureRegistry`) — presence is implicit, matches "other modules park their cars." Structure's job: store an `aiFields` config on node types AND connection types, expose it on reads, provide the registration slot (exists).

**Net-new:** `aiFields` config (12-site pattern); the same context on `ConnectionTypeConfig` (`frontend/index.ts`) + `structure_connection_type` schema + connection-type CRUD (`backend/index.ts`). **Coordinate the `aiFields` shape with ai-core's prompt-assembly contract first** (cross-module contract).

## Phase 3 — Generic node-type "rules" section (sensitivity first) (✅ SHIPPED v1.25.0)

> **Shipped in v1.25.0** (2026-07-30). Built as a generic `governance` config sibling to `primaryScope` (14 mirror sites — the block is generic so retention/access rules can join `classification` later), plus per-field `sensitivity?` on `NodeTypeField`, a per-node `structure_node.classification` override column (full `workflowState` mirror + a `classificationChanged` hook), and exported pure evaluators `getEffectiveClassification` / `isExportSafe(node, type, level)` (rank-ordered; unclassified = fail-open, unknown level = fail-closed; an empty-string override falls through to the type default — a fail-open closed during review, with `.min(1)` on the classification zod fields as defence-in-depth). Admin UI: a levels/default editor on the Hierarchy tab + a per-field Sensitivity picker. Host-validated against veradai's installed types (type-clean; only the expected `governance`/`classification` Prisma-column regen). **Design calls:** levels are **per-type** (own-config, NOT inherited via `superClasses`), the per-node override is **API-only** (no UI picker yet), and export-pipeline enforcement stays a consuming module's job. Original plan retained below for provenance.

**Goal:** an extensible per-type rules block; first rule type is **sensitivity/privilege classification** (court-ready / internal / privilege-claimed).

**What exists:** `NodeTypeRules` (`frontend/index.ts`, backend) = isRoot/allowedParents/allowedChildren/maxDepth/maxChildren — **config-only, unenforced** (Phase 1 adds parent enforcement). No classification concept exists (`secret`/`editableBy` is encryption/permissions, different).

**Net-new:** a classification block (extend `NodeTypeRules` or a sibling `rules` config via the 12-site pattern): per-type **default** sensitivity + optional per-field sensitivity (add `sensitivity?` to `NodeTypeField`, both copies) + per-node override. Plus an **`isExportSafe(node, level)`** helper (structure stores + evaluates; the export pipeline in a consuming module enforces the gate). Keep the block generic/extensible; ship only classification now.

## Phase 4 — Field UX: collapsible fields + repeater `allData` fix (✅ SHIPPED v1.26.0)

> **Shipped in v1.26.0** (2026-07-30). `defaultCollapsed?: boolean` on the **frontend** `NodeTypeField` only (a pure render concern — the backend copy omits UI flags like `isHidden` by design; it rides in the fields JSON). `NodeFieldRenderer` wraps the field container (edit **and** read-only) in a shadcn `Collapsible` when set — which also covers `field-group`s, since they render through that container, so a whole repeater group collapses. Field-editor toggle added. The repeater `allData` fix passes `{ ...allData, ...item }` to the nested sub-field renderer (row wins on id collision) — a **behaviour change** for existing repeater sub-fields with `visibleWhen`/`computedTemplate` (previously silent no-ops, now live), noted in the changelog. Frontend-only, no schema change; host-validated type-clean against veradai (Collapsible present, no regen needed). Original plan retained below.

**Net-new / fix:**

1. **`collapsed?`/`defaultCollapsed?: boolean`** on `NodeTypeField` (`frontend/index.ts`, and backend copy). Honour in `NodeFieldRenderer` (`components.ts`): wrap the field container or the field-group Card in a shadcn `Collapsible`, default-collapsed per the flag. Add the toggle to the admin field editor. `visibleWhen` already works; this is the "hidden until revealed" complement.
2. **Repeater `allData` bug (confirmed):** in the field-group sub-field loop (`components.ts`) the nested `NodeFieldRenderer` is rendered **without `allData`**, so `computedTemplate` and `visibleWhen` silently no-op inside repeaters (the renderer's `visibleWhen`/`computedTemplate` guards all key off `allData`). Fix: pass `allData={item}` (the current row) into the nested renderer. **Single centralized site** — fixes both `NodeForm` and `NodeInfoTab`. (Decide: row-only `item`, or merge top-level + row.)

## Phase 5 — Merge-field exposure (rescopes Custom Detail Page Layouts) (✅ SHIPPED v1.28.0)

> **Shipped in v1.28.0** (2026-07-31). All three net-new pieces delivered, plus the `cardTemplateId` resolution fix. **(1) Metadata API:** a single pure `flattenMergeFields(fields, refFieldsBySlug)` core in a new React-free `utils/merge-fields.ts`, wrapped by `getMergeFieldSchema(nodeType)` → `MergeFieldToken[]` (`path` / `insertText` / `label` / `type` / `kind` + optional `via` / `multiple` / `inheritedFrom`; kinds `builtin` / `field` / `group-subfield` / `node-ref`; full resolver parity — built-ins + top-level + `{group.sub}` + one-hop `{ref->field}`). The token shape is the settled useFoundry contract. **(2) Reusable resolver:** `resolveTemplateAsync` moved into `utils/merge-fields.ts`, now **exported** with an injectable `fetchNode` (defaults to `structureService.getNode`) + a `resolveMergeFields(template, node)` convenience that folds `name`/`description`/`slug` into the data bag; `useResolvedTemplate` (unchanged, still exported from `NodeFieldRenderer`) wraps it. **(3) Card:** `titleTemplate`/`bodyTemplate` on `CardTemplateConfig` **and** `navigation.listPage.card`, resolved by `NodeCard` (falls back to `node.name`); `NodeCard` now also resolves `cardTemplateId` → the referenced `structure_template` row (precedence `templateOverrides.card` > `navigation.listPage.card` > shared row) — a **behaviour change** (previously the pointer was ignored). Plus: the admin "Insert field…" pickers now surface group + deref tokens via `getMergeFieldSchema`, and a public **`GET /:type/schema`** endpoint returns `{ type, fields, referencedTypes }` (secret-filtered lean descriptors = the flattener's inputs; unexposed reference targets redacted to honour the no-existence-leak rule). **Design decision (settled in-session with the useFoundry owner):** *both* an in-app util (`getMergeFieldSchema`) *and* the public endpoint, with **one** flattener — achieved by having the endpoint return the flattener's raw inputs rather than a second server-side token generator (`check:templates` forbids sharing a source fragment across template constants). Host-type-reviewed clean against veradai's installed types (4-dimension adversarial pass, 0 confirmed defects); **host tsc pending user-side.** **Deferred:** linking a node type's card/page to a useFoundry component *file* (the built-in card is the baseline); inherited (superClass) fields in the admin picker; per-node-type card-template *editor* UI for the new slots (settable via JSON/template config today). Original plan retained below for provenance.

**Goal:** expose structure merge fields so the external **useFoundry** visual builder can bind components to a project's fields (the JetEngine / Dynamic.ooo ↔ Elementor model); ship a simple merge-field-driven card as the baseline. Structure = data + merge-field exposure; useFoundry = presentation.

**What exists:** the resolver `resolveTemplateAsync(template, data, cache)` (`components.ts`; 7 token forms — `{field}`, `{group[sub=val].x}`, `{group[0].x}`, `{field->nodeField}`, etc.; one node + one-hop node-ref; **no aggregation**). `useResolvedTemplate` is exported (React hook); **`resolveTemplateAsync` is NOT exported**. `NodeCard` (`components.ts`) renders **raw** `node.data[id]` and never calls the resolver; `CardTemplateConfig` (`frontend/index.ts`) has **no template-string slot**. No merge-field **metadata/listing** API exists.

**Net-new (three pieces):**

1. **Merge-field metadata API** (the main piece) — returns the flattened set of **bindable tokens** for a node type: top-level fields + field-group subfields + `->` node-ref deref targets, each as `token / label / type`. Build on `NodeTypeField` + `getFieldsForNodeType` (`frontend/index.ts`). Expose in-app (admin picker) and, for useFoundry, consider a schema surface on the public API (`GET /:type/schema`; the public API is instances-only today, `backend/index.ts`).
2. **Reusable resolver** — extract/export the pure `resolveTemplateAsync` (or a `resolveMergeFields(template, node)`), so useFoundry and a card renderer can resolve tokens without the React hook.
3. **Merge-field-driven card (baseline)** — add template-string slots to `CardTemplateConfig` (e.g. `titleTemplate`, `bodyTemplate`) and have `NodeCard` run the resolver. Optionally let a node type **link its card/page to a useFoundry component file** instead of the built-in card.

**Coordination:** the metadata shape is the contract useFoundry consumes — spec it with the builder. The `merge-fields.mdx` doc's caution about built-in templates is stale (resolved in v1.23.3).

## Lower priority / as-pulled

- **Rename `workflow` → `stage`** — ✅ **SHIPPED.** `status` was rejected (it collides with the node-lifecycle column `active`/`archived`/`deleted`), so the chosen target name is **`stage`**. The per-node column is now `stage` and the per-type config `stageConfig`; both keep their physical DB columns via Prisma `@map("workflowState")` / `@map("workflowConfig")`, so **no data move** was needed, and the hook is now `structure.node.stageChanged`. It stays **first-class** — the stage-changed hook is the automation / task-module plug-in point. Stage **transition enforcement** is also live in `updateNode`: an unknown target stage is rejected, and the `transitions` allowlist is enforced from the current stage. Both checks are **opt-in** — an empty `stages`/`transitions` config imposes no constraint, and a `null` target always clears the stage.
- **Search widening** — ✅ **SHIPPED v1.27.0**, since upgraded. `listNodes` `search` also matches custom `data` field VALUES. The **primary path is now indexed**: a trigger-maintained `searchVector` column queried with a prefix `to_tsquery` and served by its GIN index (`backend/index.ts`, ORDER BY id, LIMIT 5000), folded into `where.OR`. The original `jsonb_each_text(...) ILIKE` value scan is retained only as a **self-healing fallback** for hosts where the column/index could not be provisioned — a warning is logged when it fires. Values only (nested groups match as JSON text). Structured querying stays the `dataFilters` engine; retrieval/ranking stays cog-ingest/AI-Core.
- **Bulk connection creation** — ✅ **SHIPPED v1.27.0.** `bulkCreateConnections(userId, connections[], { skipHooks? })` service method (partial-success like `bulkCreateNodes`, reuses `createConnection` for full validation) + `POST /connections/bulk` + `bulkCreateConnectionsSchema`. Reachable via `serviceRegistry.get('structure')` for cog-ingest; `skipHooks` fires one `structure.connections.bulkCreated` summary (XOR with per-row hooks, `structure.node.classificationChanged` + `structure.connections.bulkCreated` added to the action-hook doc table).

## Parked / not structure's job

- **Graph-derived values** — **cog-ingest/db computes**; structure stores the result in an `editableBy:'system'` field. Storage already exists — no structure work.
- **Audit-log storage** — **Activity module** (structure already fires `doActionAll` CRUD hooks).

*(Two entries have left this list: **server-side field validation** shipped — see **S1.1** below — and the **tree view** shipped as the fourth list view alongside grid/list/table, with tree search/filter, roving-tabindex keyboard navigation, and expand state persisted into `structure_settings.treeExpanded`.)*

## Shared field templates across node types (✅ SHIPPED v1.29.0)

> **Shipped in v1.29.0** (2026-08-01). Built as a dedicated **`structure_field_template`** table `{ name, slug, description, fields }` (NOT overloading the rendering-only `structure_template`) + a `fieldTemplateIds: string[]` config on `structure_node_type` (14-mirror-site pattern, no `migrations.ts` entry). **Merge:** template fields are threaded through the `TypeGraph` (new optional `TypeGraphEntry.templateFields`, populated in `loadTypeGraph` + `listNodeTypes`) and spliced in `resolveTypeInGraph` between own and inherited fields (own › template › inherited, id-shadowed, tagged `fieldTemplateId`). **The security-critical half:** the write-path walker `getFieldDefs` was made template-aware too (it re-reads raw fields for secret-sealing + `editableBy` — splicing only into `resolved.fields` would have left template secrets in plaintext and template locked fields writable). `getFieldDefs` and `resolveTypeInGraph` agree on precedence and both exclude ancestors' templates (**attach-only** — templates are NOT inherited via `superClasses`; a subtype attaches its own). `stripInheritedFields` also drops `fieldTemplateId`-marked fields on write. **Surface:** field-template CRUD service/routes/Zod (admin-gated) + a GDPR erasure handler; frontend types/service/hooks (`useFieldTemplates`/`useFieldTemplateMutations`); a dedicated **Field Templates** admin page (JSON authoring, `adminPagesRegistry`); and a NodeTypeForm **Fields**-tab attach picker (badge multi-select) + template-provenance preview. Host-reviewed clean vs veradai's installed types (5-dimension adversarial pass, 0 confirmed defects; the secret-sealing inclusion independently re-verified). **Design calls (settled in-session, delegated):** attach-only precedence own › template › inherited; JSON-based authoring for v1 (visual field-set editor deferred — the existing editor is coupled to `mergeTokens`/governance); dangling `fieldTemplateIds` (deleted template) are tolerated (silently skipped). **Follow-ups — both now shipped:** visual field-set editor ✅ **v1.31.0** (extracted a shared `FieldSetEditor` — `components/admin/FieldSetEditor.tsx` — from the node-type field editor; the Field Templates page now uses the full visual builder instead of JSON); per-field-group nested-secret sealing ✅ **v1.30.1** (`getFieldDefs`/`sealSecretFields`/`unsealSecretFields` + the `editableBy` guard now recurse one level into `field-group` sub-fields — a secret sub-field was previously stored plaintext). Original candidate analysis retained below.

**Does this exist? No** (verified 2026-07-29 — this section predates the v1.29.0 build). There is no first-class, admin-authorable "define a field or field-group once, reuse across many node types" feature. Candidate mechanisms and why they fall short:

- **`structure_template` is a false friend** — it stores **rendering/layout** templates only (`type: card | listItem | detailHeader | overview`; `config` = slots/layout + a `showFields` *display filter*). No field sets, no `fieldTemplateId`. (`schema.ts`; zod enum `backend/index.ts`.)
- **`superClasses` (type hierarchy)** — the closest *admin-usable* mechanism: a multi-parent is-a DAG (≤10 parents) whose fields merge into `resolved.fields` (id-shadowed, tagged `inheritedFrom`) via `resolveTypeInGraph` (`backend/index.ts`). But it's **is-a inheritance, not free composition** — reusing a field group means making unrelated types subtype a shared base, which also drags in that base's `features`, subsumption, scope-expansion, etc. You inherit the *whole* base, not a named, selectable bundle.
- **Module-registered fields** (`structureRegistry.register({ fields })`, `nodeTypes: '*' | slug[]`, `frontend/index.ts`) — genuine "define-once, attach-to-many," but authored in **TypeScript at boot, not by admins**; admins can only toggle/relabel via `fieldIntegrations`.
- **`field-group`** — a **within-one-type** repeater; sub-fields live in that type's own config, not shared.

**Net-new to build (reusing existing pieces):**
1. A **shared field-set entity** — a dedicated `structure_field_template` table `{ name, slug, description, fields: NodeTypeField[] }` (cleaner than overloading `structure_template`, whose semantics are rendering-only).
2. An **attachment point** on `structure_node_type` — a `fieldTemplateIds` column parallel to the per-view `*TemplateId` columns (`schema.ts`) + an admin picker.
3. **Merge into effective fields** — splice the attached template's fields into `resolved.fields` inside `resolveTypeInGraph` and/or `getFieldsForNodeType`, tagged with provenance like `inheritedFrom` so they render but aren't persisted as own fields. The single read-path `resolved.fields ?? fields` (used by every consumer) is the one integration point.
4. **Watch-out:** the server field-def walkers — `getFieldDefs`/`getSecretFieldIds` + `editableBy` enforcement (`backend/index.ts`) — MUST include template fields, or secret sealing and permission checks would silently skip fields coming from a shared template.

**UX is not yet designed** — settle before building: how templates are authored/edited; how a type attaches one (ordering/precedence vs its own + inherited fields); how same-id conflicts resolve; whether a template may contain a `field-group`; how the admin distinguishes template vs own vs inherited fields. Worth deciding whether this, `superClasses`, and the Phase 5 merge-field exposure should share one coherent "reusable fields" story.

## Suggested phase order & sizing — all shipped

The veradai-driven sequence is complete; every item below has landed.

1. Primary scope + parent enforcement — ✅ **SHIPPED v1.24.0**.
2. AI fields tab — ✅ **SHIPPED v1.30.0** (node-type half) **+ the connection-type half** (`contextHints`/`aiFields` on `structure_connection_type`).
3. Generic rules / sensitivity — ✅ **SHIPPED v1.25.0** (`governance` config + per-node `classification` override).
4. Field UX (collapse + repeater fix) — ✅ **SHIPPED v1.26.0** (`defaultCollapsed` + the repeater `allData` fix).
5. Merge-field exposure — ✅ **SHIPPED v1.28.0** (`getMergeFieldSchema`, exported resolver, `titleTemplate`/`bodyTemplate`).
6. Shared field templates across node types — ✅ **SHIPPED v1.29.0** (`structure_field_template` + `fieldTemplateIds`), with the visual field-set editor in **v1.31.0**.

### What is actually still open (corrected at v1.34.27)

This paragraph used to name a "genuinely open queue" that included two items which have since shipped or been dropped. Corrected:

- **S1.3's remainder — closed.** `global` shipped in v1.34.27 as `primaryScope.global`; `inputScope` was superseded by `permissions.create` and never existed in the code.
- **S1.4 (nullable owner) — closed, superseded.** v1.34.27 keys sharing on the type; `structure_node.userId` stays non-nullable.
- **Still genuinely open, and tracked on the [Roadmap](/modules/structure/roadmap/), not here:** **S1.6**'s `structure_node_revision` table + restore (`grep structure_node_revision src/` still returns nothing), **S2.1**'s per-definition versioning, **S2.2** (node-instance import/export), **S2.3** (jsonb + path indexing at scale) and **S2.4** (retention/purge).

### Three loose ends recorded only on this page

These came out of the Phase 2 and Phase 5 ship notes and are **not** phase-level work; they are small, real, and were tracked nowhere else. They are being lifted onto the Roadmap — this list is the provenance record, not the tracker.

1. **Inherited (superClass) fields are missing from the admin merge-field picker.** `getMergeFieldSchema` itself is inheritance-aware — it reads `getEffectiveFields`, i.e. `resolved.fields ?? fields`. But `NodeTypeForm` calls it with the editable `formData`, which is assembled key-by-key from `initialData` and carries **no `resolved` block**, so the picker falls back to the type's **own** fields only. An admin editing a subtype cannot insert a token for a field it inherits.
2. **No editor UI for the card `titleTemplate` / `bodyTemplate` slots.** Both keys exist on `CardTemplateConfig` and on `navigation.listPage.card` in `frontend/index.ts`, and `NodeCard` resolves them with the documented precedence (`templateOverrides.card` › `navigation.listPage.card` › the shared template row). Neither slot appears anywhere in `pages.ts` — they are settable only by hand-editing JSON / template config.
3. **`contextConfig` is still not mirrored onto connection types.** `contextHints` and `aiFields` were mirrored onto `structure_connection_type` (both in `schema.ts` and on `ConnectionTypeConfig`), but the node type's context-assembly block `contextConfig` (`includeAncestors` / `ancestorDepth` / `includeConnections` / `includeChildCounts`) has **no** connection-type counterpart. Decide whether one is wanted before treating this as a gap.

---

# Generic Platform Hardening — Stages 1–3 (2026-08-09)

The build sequence that followed the 2026-08-09 gap-analysis audit — **historical**, like the rest of this page. Framing and the standing calls live in [Design Decisions](/modules/structure/decisions/); this section is the grounded, phase-by-phase plan. It is **generic** — Structure is the admin-configurable architecture, not any one app's domain.

> **The dominant audit finding** (as recorded 2026-08-09): the field/type **definition** layer is already rich; what's missing is **server-side enforcement** and a few platform features. At the time of the audit the write path validated only the request envelope — every value contract (required / pattern / min-max / enum / coercion / computed correctness / node-type permissions) was enforced only in the React `NodeForm` and accepted verbatim by the server. cog-ingest writes into Structure through the same service, so the write path must be safe for **both** human and programmatic writers.
>
> **Status now:** the request envelope is still an open bag (`data` is `z.record(z.string(), z.unknown())`, `backend/index.ts`), **but** value contracts are enforced behind it — `validateNodeData` runs over the resolved field set on `createNode`, `updateNode` and `bulkCreateNodes`, and per-node-type `permissions` are enforced in the service layer. What remains open from this finding is **S1.6**'s revision history, not the validation gap itself — S1.4's shared-owner work was superseded by the type-keyed sharing that shipped in v1.34.27.

## Stage 1 — write-path integrity + the two new requirements

### S1.1 — Server-side field validation (✅ SHIPPED v1.33.31)
One shared validator over the resolved field set, run on every write path.

> **Shipped in v1.33.31.** Delivered as `validateNodeData(defs, data, { isCreate })` (`backend/index.ts`) — note the options bag is `{ isCreate }`, not the planned `{ partial }`. It sits beside `getFieldDefs`, which resolves own + `superClass`-inherited + shared-template fields, and is wired into `createNode`, `updateNode` (`isCreate: false` — only supplied keys are validated) and `bulkCreateNodes` (per row). `getMissingRequiredFields` — the client-side mirror the plan pointed at — now lives in the shared `utils/field-conditions` module and is imported by `components.ts`, so both sides read the same `visibleWhen`/`requiredWhen` semantics. Original plan retained below for provenance.

- **Where:** a new `validateNodeData(fields, data, { partial })` helper beside `getFieldDefs` (`backend/index.ts`, which already resolves own + `superClass`-inherited + shared-template fields — the single source of truth). Enforce `required` / `requiredWhen`, `validation.pattern` / `min` / `max`, `select`/`multiselect` enum membership (from `options[]`), and type coercion per field `type`. Evaluate `visibleWhen` server-side and skip hidden fields (mirror `getMissingRequiredFields`, `frontend/components.ts`).
- **Call sites:** `createNode` (after the `beforeCreate` filter and before persist), `updateNode` (`partial` — validate only supplied keys), `bulkCreateNodes` (per row, hoist the resolved defs once per type), and the public-API write paths (POST / PATCH).
- **Programmatic writers:** skip validation only for `editableBy:'system'` fields written by trusted service callers (cog-ingest's graph-derived values) — reuse the `editableBy` classification the write path already reads.
- **Decision D9:** application-layer only (no DB CHECK / `pg_jsonschema`).

### S1.2 — Computed-value server trust — ❌ REMOVED (2026-08-09)
Dropped from the plan. It was purely anti-spoofing (recomputing `formula` / `computedTemplate` server-side so an *untrusted* caller can't submit a fake value). veradai is **solo**, and its only external surface is the **API-key-authed** public REST API — the user's own keys — so there is **no untrusted writer** to spoof anything. A faithful server-recompute would also mean re-implementing the ~500-line evaluator + the frontend-registry-coupled merge resolver on the backend, risking divergence from the client values that drive cards and formulas. The formula (v1.33.15) and merge-field (v1.28.0) features are untouched and keep working client-side. Revisit only if an app ever adds genuine multi-user or an *unauthenticated* write surface.

### S1.3 — Node-type permission enforcement (✅ SHIPPED v1.33.32) + the `global` flag (✅ SHIPPED v1.34.27)
Make the config-only `permissions` block real, and add the "who creates" / "shared type" flags.

> **Permission half shipped in v1.33.32**, with the per-type READ tier following in v1.34.12. Delivered **more** than the plan asked for: `permissions` now carries **five** keys — `read` / `create` / `edit` / `archive` / `delete` — each on the `'anyone' | 'admin' | 'system'` tier (`frontend/index.ts`); `'system'` means only trusted in-process callers (e.g. cog-ingest), so no user or admin can perform it via the UI or API. Enforcement is in the **service methods** as planned, `attachRole` is now applied to **every** node-write route (POST `/nodes`, `/nodes/bulk`, bulk-archive, bulk-delete, bulk-restore, PATCH, DELETE, move, duplicate, archive, restore), and the `NodeTypeForm` permission editor exists on the Permissions section (`pages.ts`).
>
> **The `global` flag also shipped, in v1.34.27 — this block previously claimed it did not exist, which was wrong.** It landed as **`primaryScope.global`**, not as a standalone node-type key: the config lives on `NodeTypeConfig.primaryScope` in `frontend/index.ts` (carrying a contract docblock), the backend read-scoping helpers are `isSharedTypeConfig` / `loadGlobalTypes` / `ownerScope` / `ownerSql` / `scopeSql` / `canHydrateEndpoint` / `sanitizeSharedNode` in `backend/index.ts` and `structure.service.ts`, and the admin UI is in `pages.ts` (seeded in the `NodeTypeForm` `formData` init, with `isPrimary` and `global` handled as mutually exclusive). Two rules are stated explicitly in the backend code: **connections are not shared**, and **writes are not relaxed**. Critically, it did **not** need S1.4 — see the correction under S1.4 below.
>
> **`inputScope` was never built and never will be — superseded.** A repo-wide grep for `inputScope` returns zero hits. The "who creates" question is answered exactly by `permissions.create?: 'anyone' | 'admin' | 'system'` (`frontend/index.ts`), enforced by `assertNodePermission` with an admin control in `NodeTypeForm`. Ignore every `inputScope` mention in the retained plan below.

- **Config:** extend `permissions.{create,edit,archive,delete}` to the `'anyone' | 'admin' | 'system'` tier (`frontend/index.ts`); add two node-type fields — `inputScope: 'system' | 'admin' | 'user'` (who *creates*) and `global: boolean` (shared + scope-exempt) — via the [14-mirror-site pattern](#adding-a-per-node-type-config-object--the-14-mirror-sites). *(The "this one field is AI-written only" case stays field-level `editableBy: 'system'`.)*
- **Enforce in the service methods** (not routes — `serviceRegistry.register` and the public API bypass route middleware): thread `isAdmin` into `createNode`, `duplicateNode`, `bulkCreateNodes`, `moveNode`, `archiveNode`, `deleteNode`, `restoreNode` + the bulk variants, exactly as `updateNode` already takes `options.isAdmin`. Load the node-type `permissions` the way `updateNode` loads `builtInFieldConfig`.
- **Routes:** add `attachRole` (currently only on PATCH) to every node-write route so `req.user.role` is present; public API passes `isAdmin:false` (as PATCH already does).
- **UI:** add the missing `permissions` + `inputScope` + `global` editor to `NodeTypeForm` (block is already in form state, no editor); add archive/delete client gates to match `pages.ts`.

### S1.4 — Shared / reference nodes — ❌ SUPERSEDED (v1.34.27): sharing is keyed on the TYPE, not a nullable owner

> **The design below was not built, and the code contradicts it.** Shared node types shipped in v1.34.27 by keying sharing on the **node type** (`primaryScope.global`, see S1.3) rather than on a nullable row owner. Verified against the templates: `structure_node.userId` is still a **non-nullable** `String` in `schema.ts`; the userId-prefixed uniques `@@unique([userId, slug])` and `@@unique([userId, parentId, name])` are **untouched**; **no partial unique indexes** were added and `migrations.ts` gained no entry for any of this. A note in `backend/index.ts` records that rows still physically carry their creator's `userId`. The read predicate, the write/cascade reasoning and the connection relaxation described below are therefore all **obsolete** — the shipped read path goes through `ownerScope` / `ownerSql`, and connections are explicitly **not** shared.
>
> Retained only to show which design was considered and rejected. Do not implement it.

- ~~**Schema:** make `structure_node.userId` nullable; `null` = a shared row, written only for `global`-type nodes. Rework the userId-prefixed uniques (`@@unique([userId, slug])`, `@@unique([userId, parentId, name])`) with **partial unique indexes** for null-owner rows (raw SQL in `migrations.ts`, since Prisma can't express partial uniques).~~
- ~~**Reads:** visibility predicates become `{ OR: [{ userId }, { userId: null }] }`; **writes** stay strict `{ userId }` (only an admin/system provisions `global` rows).~~
- ~~**Connectable-to-shared:** relax the `createConnection` target-endpoint ownership check to accept a null-owner `global` node; source stays caller-owned; `fromTypes`/`toTypes` still gate.~~
- ~~**Cascade:** the account-deletion handler (`backend/registrations.ts`) already deletes only `where:{userId}`, so null-owner rows are spared — keep the unscoped-refusal guard.~~

### S1.5 — Enforced scoping / `rootNodeId` (✅ SHIPPED v1.34.0-1)
> **Shipped in v1.34.0–v1.34.1**, essentially as specified. Delivered: `rootNodeId String?` on `structure_node` (`schema.ts`) with `@@index([userId, rootNodeId])` and `@@index([userId, rootNodeId, nodeType])` plus a backfill migration; `primaryScope.isolation?: 'filter' | 'enforced'` (`frontend/index.ts`); a per-node-type `rules.allowCrossSpaceMove` (`frontend/index.ts`) enforced in `moveNode` (`backend/index.ts`) and surfaced in the admin form (`pages.ts`); a validated `scopeRootId` request param; and cross-space connection rejection in `createConnection` (`backend/index.ts`). Original plan retained below for provenance.

- **Schema:** add `rootNodeId String?` to `structure_node` (hierarchy block) + `@@index([userId, rootNodeId])` and `@@index([userId, nodeType, rootNodeId])`. Backfill from `path[0]` (migration).
- **Maintenance:** in `calculatePath`/`createNode`, `rootNodeId = parent.rootNodeId ?? parent.id` (a root sets its own id). In `moveNode`, recompute `rootNodeId` for the node **and every descendant** in the same transaction (piggyback `updateDescendantPaths`). A move that **crosses** an `enforced` space boundary is rejected **unless** the moved node's type sets `rules.allowCrossSpaceMove` — then it is permitted and the `structure.node.moved` payload carries old/new `rootNodeId` for audit (D3).
- **Config:** `primaryScope.isolation: 'filter' | 'enforced'` (`schema.ts`; extend the type at `frontend/index.ts`), plus an admin-set per-node-type `rules.allowCrossSpaceMove` (default false).
- **Request scope:** a validated `scopeRootId` param (validate: exists, owned, `isPrimary`, `enforced`) — never trust the client store. `enforced` + missing/invalid scope → fail closed.
- **Read surfaces (inject `where.rootNodeId`):** `listNodes`, `getNode`, `searchNodes`, `getTree`, `getNodeConnections`, `listConnections`, `expandGraph`, `getNodeContext`, `dataFilters`, both public-API reads, and `moveNode`/`duplicateNode` targets.
- **Connection joint rule (Decision A):** reject cross-space connections unless one endpoint is a `global` type — in `createConnection`, `bulkCreateConnections`, and `expandGraph`.
- **Cross-module:** add `rootNodeId` to node lifecycle payloads (`structure.node.created`, `.updated`, `.moved`) and connection payloads — consumed by cog-ingest and document-management.

### S1.6 — Node revision history + restore (**L**, D8) · `auditEvents` contract ✅ SHIPPED v1.34.2
> **The audit-contract half shipped in v1.34.2.** The already-fired lifecycle events are now declared in the security manifest's `auditEvents` (`backend/registrations.ts`), grouped by domain and kept in lockstep with the `doActionAll(...)` call sites, so a consuming audit module reads the authoritative list via `securityRegistry.getAuditEvents()` instead of hard-coding hook strings. **The substantive half is still open:** `structure_node_revision` does not exist in `schema.ts`, and `getNodeRevisions` / `restoreNodeRevision` / `structure.node.revisionCreated` have no occurrences in `backend/index.ts`. The remaining plan is below (the `auditEvents` bullet is done).

- **Schema:** new self-contained `structure_node_revision` table (`{ id, userId, nodeId, revision, data snapshot (name/description/data/stage/classification), changedBy, createdAt }`, `@@index([userId, nodeId, revision])`). **Node-record only** — no file bytes, no hash chain (document-management owns file versioning/hashing).
- **Write:** in `updateNode`, snapshot prior state before the in-place mutation; add `getNodeRevisions` + `restoreNodeRevision` service methods + routes; fire `structure.node.revisionCreated` / `.reverted`.
- ~~**Audit contract:** declare the already-fired lifecycle events in the security manifest's `auditEvents`, aligned to the starter's Typed Hook Catalogue, so a consuming audit module has a formal contract instead of hard-coded strings.~~ ✅ done in v1.34.2 (`backend/registrations.ts`).
- **Erasure + manifest:** add `structure_node_revisions` to `dataCategories` + a deletion handler.

## Stage 2 — make it a real platform (raised priorities)

### S2.1 — Config env-promotion (✅ SHIPPED v1.33.34-35 + dry-run v1.34.2)
> **Shipped.** Server-side, **atomic** full-bundle export/import now covers node types **+ connection types + groups + field templates + functions**: `exportConfigBundle` (`backend/index.ts`) and `importConfigBundle(..., { dryRun })`, Zod `importConfigBundleSchema` with `dryRun`, admin-gated routes `GET /config/export` and `POST /config/import`, and the client wrappers at `frontend/index.ts` driven from the admin page (`pages.ts`). The **diff/dry-run preview** landed in v1.34.2. The older node-types-only `exportNodeTypes` / `importNodeTypes` remain as the narrower surface; `importNodeTypes` and `importConfigBundle` both delegate to the shared `importNodeTypesTx` helper.
>
> **Still open:** **per-definition versioning**, so a promoted bundle can be reconciled against what the target environment already has. *("Will bite downstream app teams immediately.")*

### S2.2 — Node-instance import/export (CSV/JSON) (**M**)
Generic bulk instance-data management (distinct from config): import a CSV/JSON of node instances with field mapping + per-row validation (reuse S1.1) + error reporting; export a node list. On Structure's own "Under Consideration" list; currently absent.

### S2.3 — jsonb + path indexing at scale (**M**)
`dataFilters` emits `"data"->>field` with **no GIN on `data`** (`migrations.ts` documents the seq-scan); add a GIN (`jsonb_path_ops`) or functional indexes on hot fields. Path-prefix `LIKE 'x%'` may not use the btree `path` index on default-collation Postgres — the `rootNodeId` equality index (S1.5) is the durable fix for scoped reads.

### S2.4 — Retention / purge (**S–M**)
Soft-deleted nodes (`status='deleted'`) live forever; add admin-configurable retention/purge for trashed nodes and old revisions (mirror document-management's artefact-retention pattern).

## Stage 3 / Roadmap — future & breadth

- **Blueprints / starter-packs** — a first-class "stamp out a whole node-type + connection set" primitive (a CRM pack, a PM pack). **Deferred to the roadmap** — relevant if the module system is distributed to third parties. The named interim now materially exists: the five-category `exportConfigBundle` / `importConfigBundle` pair with dry-run diff (S2.1) is a usable stamp-out mechanism short of a first-class primitive.
- Outbound **webhooks** (H12 — not owned by Notifications, which deliberately excludes webhooks), saved **full views** (columns + sort, beyond filter presets), **slug** auto-derive + `publishedSlug` serving, **i18n** labels, **sibling drag-reorder** UI (the `/reorder` endpoint + hook exist, unused on node lists), bulk-**update**/bulk-**move** endpoints.
- One-off infra: ✅ **done** — the repo is on **scaffold v1.31.15** (self-heal migrations + `scaffold:update` fetch fixes, plus installed-module discovery in lifecycle hooks).

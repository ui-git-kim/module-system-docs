---
title: Build Plan (Veradai-Driven)
description: Phased implementation plan for the current veradai-driven structure work, grounded with file:line insertion points.
sidebar:
  order: 12
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

1. **Prisma column** — `src/templates/schema.ts` `model structure_node_type` (config block ~L213-234): `foo Json @default("{}")`. New column ⇒ a migration entry in `src/templates/migrations.ts` (JSON defaults `{}`, no backfill).
2. **Frontend type** — `frontend/index.ts` `NodeTypeConfig` (starts L244), after the `permissions` block (~L299).
3. **Backend type copy** — `backend/index.ts` `NodeTypeConfig` (L5956, after ~L5993) and `NodeTypeProposal` (L6061) if it should ride proposals.
4. **Backend 8 mapping sites** (each has a `workflowConfig`/`contextConfig` line adjacent): `mapNodeTypeProposal` L2507/2509 · `listNodeTypes` L3881/3886 · `getNodeType` L3990/3997 (keep parity with listNodeTypes — noted bug at L3991) · `createNodeType` L4048/4053 · `updateNodeType` L4113/4118 · `exportNodeTypes` L4236/4241 · `importNodeTypes` L4295/4300 · `proposeNodeType` L4446/4448.
5. **Zod** — `backend/index.ts` `createNodeTypeSchema` L5603 (~L5627). `updateNodeTypeSchema` (`.partial()`, L5635) and `proposeNodeTypeSchema` (`.extend()`, L5638) inherit automatically.
6. **Admin form** — `frontend/pages.ts` `NodeTypeForm` (L3489): **seed it in `formData` init (~L3567)** — the form PATCHes the whole object, so an unseeded key is wiped on save — then add a UI section (model on the `conditionalColor` block ~L4045 or the workflow editor ~L5106). `updateField('foo.key', v)` supports dotted nested paths.

## Phase 1 — Primary-node scope selector + parent enforcement (NEXT)

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

## Phase 2 — AI fields tab (when AI Core is installed)

**Goal:** an admin surface to define per-node-type and per-connection-type AI config — context hints, **prompt segments, output examples** — that plumb into AI Core's prompt-assembly. Visible only when ai-core is present.

**What exists:** `contextHints` + `contextConfig` per node type (drives `GET /nodes/:id/context`, `backend/index.ts:4963`). Connection types have no context.

**Key decision — the conditional tab:** structure has **no frontend module-presence check** today. Recommended: **ai-core self-registers the AI tab** via `StructureModuleRegistration.tabs` (`frontend/index.ts:1150`, registered through `structureRegistry` at `:1810`) — presence is implicit, matches "other modules park their cars." Structure's job: store an `aiFields` config on node types AND connection types, expose it on reads, provide the registration slot (exists).

**Net-new:** `aiFields` config (12-site pattern); the same context on `ConnectionTypeConfig` (`frontend/index.ts:809`) + `structure_connection_type` schema + connection-type CRUD (`backend/index.ts` ~L5143). **Coordinate the `aiFields` shape with ai-core's prompt-assembly contract first** (cross-module contract).

## Phase 3 — Generic node-type "rules" section (sensitivity first)

**Goal:** an extensible per-type rules block; first rule type is **sensitivity/privilege classification** (court-ready / internal / privilege-claimed).

**What exists:** `NodeTypeRules` (`frontend/index.ts:357`, backend `:6025`) = isRoot/allowedParents/allowedChildren/maxDepth/maxChildren — **config-only, unenforced** (Phase 1 adds parent enforcement). No classification concept exists (`secret`/`editableBy` is encryption/permissions, different).

**Net-new:** a classification block (extend `NodeTypeRules` or a sibling `rules` config via the 12-site pattern): per-type **default** sensitivity + optional per-field sensitivity (add `sensitivity?` to `NodeTypeField`, both copies) + per-node override. Plus an **`isExportSafe(node, level)`** helper (structure stores + evaluates; the export pipeline in a consuming module enforces the gate). Keep the block generic/extensible; ship only classification now.

## Phase 4 — Field UX: collapsible fields + repeater `allData` fix

**Net-new / fix:**

1. **`collapsed?`/`defaultCollapsed?: boolean`** on `NodeTypeField` (`frontend/index.ts` ~L488, and backend copy `:6188`). Honour in `NodeFieldRenderer` (`components.ts:1648`): wrap the field container (~L2387) or the field-group Card (~L1957) in a shadcn `Collapsible`, default-collapsed per the flag. Add the toggle to the admin field editor. `visibleWhen` already works; this is the "hidden until revealed" complement.
2. **Repeater `allData` bug (confirmed):** in the field-group sub-field loop (`components.ts:1974-1986`) the nested `NodeFieldRenderer` is rendered **without `allData`**, so `computedTemplate` and `visibleWhen` silently no-op inside repeaters (guards at L1659/1666/1674/2322). Fix: pass `allData={item}` (the current row) at ~L1984. **Single centralized site** — fixes both `NodeForm` and `NodeInfoTab`. (Decide: row-only `item`, or merge top-level + row.)

## Phase 5 — Merge-field exposure (rescopes Custom Detail Page Layouts)

**Goal:** expose structure merge fields so the external **useFoundry** visual builder can bind components to a project's fields (the JetEngine / Dynamic.ooo ↔ Elementor model); ship a simple merge-field-driven card as the baseline. Structure = data + merge-field exposure; useFoundry = presentation.

**What exists:** the resolver `resolveTemplateAsync(template, data, cache)` (`components.ts:1471`; 7 token forms — `{field}`, `{group[sub=val].x}`, `{group[0].x}`, `{field->nodeField}`, etc.; one node + one-hop node-ref; **no aggregation**). `useResolvedTemplate` is exported (React hook); **`resolveTemplateAsync` is NOT exported**. `NodeCard` (`components.ts:100`) renders **raw** `node.data[id]` and never calls the resolver; `CardTemplateConfig` (`frontend/index.ts:664`) has **no template-string slot**. No merge-field **metadata/listing** API exists.

**Net-new (three pieces):**

1. **Merge-field metadata API** (the main piece) — returns the flattened set of **bindable tokens** for a node type: top-level fields + field-group subfields + `->` node-ref deref targets, each as `token / label / type`. Build on `NodeTypeField` + `getFieldsForNodeType` (`frontend/index.ts:1859`). Expose in-app (admin picker) and, for useFoundry, consider a schema surface on the public API (`GET /:type/schema`; the public API is instances-only today, `backend/index.ts:1825`).
2. **Reusable resolver** — extract/export the pure `resolveTemplateAsync` (or a `resolveMergeFields(template, node)`), so useFoundry and a card renderer can resolve tokens without the React hook.
3. **Merge-field-driven card (baseline)** — add template-string slots to `CardTemplateConfig` (e.g. `titleTemplate`, `bodyTemplate`) and have `NodeCard` run the resolver. Optionally let a node type **link its card/page to a useFoundry component file** instead of the built-in card.

**Coordination:** the metadata shape is the contract useFoundry consumes — spec it with the builder. The `merge-fields.mdx` doc's caution about built-in templates is stale (resolved in v1.23.3).

## Lower priority / as-pulled

- **Rename `workflow` → `status`** — keep it **first-class** (the status-changed hook is the automation / task-module plug-in point). Rename `workflowState`/`workflowConfig`/`workflowStateChanged` → `status*` via a **deprecation shim** (public API — no cold-delete; `@deprecated` + one-minor-version window). Status **transition enforcement** (the allowlist, unenforced at `updateNode` ~L3006) is net-new — add here or fold into Phase 3.
- **Search widening** — the keyword search matches name+description only (`listNodes` `search` → `contains`, `backend/index.ts:2690`). Widen it to scan custom `data` field values. The `dataFilters` engine (13 operators) already queries data structurally (dates/ranges); surface it well. Retrieval/ranking stays cog-ingest/AI-Core.
- **Bulk connection creation** — a structure bulk-create service method (or a `cog-ingest.connections.discovered` event structure subscribes to), queue-backed; cog-ingest is the consumer. Single-create is the only path today.

## Parked / not structure's job

- **Server-side field validation** (min/max/pattern/required-if) — native-HTML-only today; **parked** (not form-heavy).
- **Graph-derived values** — **cog-ingest/db computes**; structure stores the result in an `editableBy:'system'` field. Storage already exists — no structure work.
- **Audit-log storage** — **Activity module** (structure already fires `doActionAll` CRUD hooks).
- **Tree view** — deferred (was for a different app; stays on the general roadmap).

## Suggested phase order & sizing

1. Primary scope + parent enforcement — **M** (mostly frontend + a focused backend enforcement block; scoping is free via `pathPrefix`).
2. AI fields tab — **M**, blocked on ai-core contract alignment.
3. Generic rules / sensitivity — **M**.
4. Field UX (collapse + repeater fix) — **S** (the repeater fix alone is a one-line high-value bug fix).
5. Merge-field exposure — **L**, spec with useFoundry; rescopes custom layouts.

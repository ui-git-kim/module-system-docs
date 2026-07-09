---
description: Audit the whole docs collection (template, module starter, modules) for consistency and drift, and triage findings into Issues / Fixes / Roadmap.
---

# Docs consistency audit

You are auditing the **Module System documentation** in this repo — the single docs site for the **starter template**, the **module starter**, and every **module**. Goal: catch drift that has crept in as the system iterated, and triage each finding so it can be actioned. This is Australian English; do not invent features; where a claim is code-level, verify it against the docs source (the module *code* lives in other repos — flag anything you cannot confirm here).

## 0. Orient (do this first)
1. **Sync check.** `git fetch origin` then confirm local `main` is not behind `origin/main` (this repo deploys from `main`; a stale local checkout looks like "missing pages"). If behind, `git merge --ff-only origin/main` before auditing. Confirm the live set via `/sitemap-0.xml` if unsure.
2. **Mechanical checks.** Run `npm run build` (this also runs `npm run check:docs`, which fails on orphan pages and broken internal links). Record any failures.
3. Read `.claude/CLAUDE.md` and the memory files under the project memory dir for known conventions (tenancy framing, no `useModuleQuery` wrapper, 13 filter operators, Pickers retired, deploy-from-main).

## 1. Scaffold-placeholder leakage
- Grep `src/content/docs` for `initMyFeature`, `myFeatureConfig`, and any unreplaced `MyFeature` / `myFeature` **outside** the module-starter pages that legitimately document the placeholder family. The snake_case `my_feature` placeholder is legitimate in module-starter/template docs — do not flag it there.
- Every module's init function should be `init<ModuleName>` and match its real code.

## 2. Cross-module pattern consistency (the core of this audit)
For each module (Structure, Builder, Style, Cog Ingest, Document Management, Billing, and any new ones), compare these repeated patterns and flag divergence from the **reference implementations (Structure & Builder)**:
- **Admin JSON import/export** — is there one `$schema`-versioned envelope, or do modules each ship a different shape (Structure `json-reference` `"version":"1.0"`, Builder `importComponentsJson`, cog-ingest `$schema: cog-ingest-config-v1`)?
- **`security.registration.ts` manifest + deletion handler** — present? Modules without one don't participate in the deletion cascade.
- **`serviceRegistry` key + `ServiceTypes` augmentation** — consistent quoting for hyphenated IDs?
- **Query-key namespacing** — `[moduleId, ...]`; the system deliberately has **no** `useModuleQuery` wrapper (optional `createModuleQueryKeys` factory only) — flag any doc that reintroduces a wrapper.
- **`structure.node.deleted` cascade-vs-retain** — does each module declare its policy?
- **Registry naming / self-registration / no cross-module `@relation`** — still consistent.

## 3. Count & framing consistency
- Registry counts (starter registries; Structure "ten registries"), filter-operator count (**13**, per the `DataFilterOperator` union), action/filter-hook counts — same number everywhere they're stated.
- Tenancy framing — "single-tenant product on tenant-keyed isolation"; no page should reassert an unresolved multi-tenant contradiction or hard-code "tenantId resolves to userId".
- Roadmap freshness — shipped items still listed as Planned; retired modules still referenced; `lastUpdated` present on recently-edited pages.

## 4. Template-vs-module boundary
- Anything more than one module needs, or that the security tier references, is a **foundation** candidate (audit logging already moved). Flag module-level things that should be promoted (or foundation things that should be extracted).

## Output — a triaged report
Group every finding under exactly one bucket, most-important first, each with `file:line` and a one-line suggested action:
- **🔴 Fix now** — factual errors, placeholder leaks, broken links, stale "shipped-as-planned" (correct in this repo directly).
- **🟠 Issue** — cross-module inconsistency needing a decision or a change in a *module's own repo* (the user will raise it there).
- **🟡 Roadmap** — genuinely new work; propose the exact roadmap entry and which roadmap page it belongs on.

End with a one-paragraph summary and, if any 🔴 items are pure-docs, offer to fix them in this repo now (build + `npm run check:docs` must stay green).

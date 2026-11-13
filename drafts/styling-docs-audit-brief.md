# Styling docs audit: brief for the starter session

Written 2026-11-13 from the Style module session, at the owner's request ("get you to start, and i get starter to finish it off").
Not published (outside `src/content`). Delete it when the work is done.

## What was done already (by the Style module session)

- **New page: [Styling Modules](/module-starter/styling/)** (`src/content/docs/module-starter/styling.mdx`, sidebar under Module Starter → Building Modules, after "Building Your Module"). The single page every module is pointed at before it styles anything: where the look of an app lives, what module markup may use, which tool for which job, Style snippets, "don't register styles yourself", hooks, packages, how to check (the audit), a checklist and common mistakes.
- Linked from Building Modules (a tip before "Typography in module UI") and from LLM Rule 7's closing note.
- Earlier the same day: LLM rules, Building Modules and the Registry Guide gained "Style snippets" sections (`snippetsRegistry`, Style module v1.16.14).

## What the starter session should finish

### 1. Apply the decision: only the Style module registers styling

**Decided by the owner on 2026-11-13: "Only Style module".** In the module system, the Style module is the only module that calls `styleRegistry.register()`. Other modules ship looks for their own parts as Style snippets (`snippetsRegistry`), ask the Style module for catalogue entries for shadcn components, and never set the app's tokens (`--primary`, `--radius`, `--background` …). The starter itself still uses `styleRegistry` for its own foundation entries: it is the host pipeline, not a module.

The pages that disagree, and what each needs:

| Page | Says |
|------|------|
| Style module `modules/style/design.mdx` ("One module, one voice") and `modules/style/integration.mdx` | The Style module is the only stylist; other modules don't call `styleRegistry.register()`. One accepted exception: the colour module's status tokens in `@layer base`. |
| New `module-starter/styling.mdx` | Follows the Style module's rule (it is the owner-approved architecture). |
| `starter-template/style-system.mdx` "The module contract" and "Which layer do I use?" | Any module registers an entry, including global tokens: the example sets `--primary` and `--radius`. "If you're writing a module, the answer is almost always `styleRegistry`." |
| `getting-started/llm-rules.mdx` "Style System & styleRegistry" | "Modules contribute styling through the unified `styleRegistry`", example sets `--primary`. |
| `module-starter/registry-guide.mdx` "Style Registry" and `module-starter/templates.mdx` (the scaffold's `STYLE_REGISTRATION` template) | Same: a module registers `my-feature.theme` with `--primary`. |

What to change:

- Keep `styleRegistry` documented as the host pipeline (the starter's own foundation entries, and the Style module, use it).
- On each page above that disagrees, state that **in the module system the Style module is the only module that registers styling**, and point module authors at [Styling Modules](/module-starter/styling/).
- Change every example so no module sets `--primary` / `--radius` or other app tokens. Where an example has to show an entry, show it as the Style module's (or the host's), with `darkTokens` for any palette token and a `radix-*` style.
- The scaffold's `STYLE_REGISTRATION` template (`module-starter/templates.mdx`, and the template itself in the module-starter repo) teaches every new module to register styling. Retire it, or reduce it to a comment pointing at Style snippets. That is a module-starter change: log it in `module-starter/upstream-issues.mdx` if the starter session can't make it.
- Rule 7's lane 4 ("`data-slot` + a Style Registry entry") and `typography.mdx` L28 should read "`data-slot` + a Style snippet (or a Style module catalogue entry)" for module code.
- Already consistent: `modules/style/design.mdx`, `modules/style/integration.mdx`, `module-starter/styling.mdx`, and the "Style snippets" sections in the LLM rules, Building Modules and the Registry Guide.

**The colour module's status tokens: settled.** The owner chose to move them into Style (2026-11-13, "Move them into Style"). Style v1.16.16 ships them as the always-on `style.status-tokens` entry, and the colour module stops registering `colour.status-tokens` in its own next release. So there are no exceptions to the rule; the docs that described one are updated.

### 2. Fix `starter-template/style-system.mdx`

- **"The module contract", step 2** says the module-starter scaffold declares `componentsJsonContribution` in the manifest. It never writes it (already logged in `module-starter/upstream-issues.mdx`, 2026-11-11). Say so, or remove the step until the scaffold does it.
- **Step 3** (a module writes its new contribution to the manifest through its own backend endpoint) is superseded by v2.16.5: the sync reads the admin's saved style from `appTheme.componentsJson` through `GET /api/v1/theme` (described further up the same page). Rewrite step 3 to point at that.
- **"Which layer do I use?"**: add rows for `<Heading>` / `<Text>`, `typeset`, Style snippets and Style catalogue entries, and link [Styling Modules](/module-starter/styling/) for module authors.
- **The top caution box** summarises Rule 7 but misses the v2.16.2 rule (no radius, padding, gap or background classes on shadcn primitives). Add it, or just link Rule 7 and Styling Modules.
- **The diagram** doesn't show the saved-theme read (v2.16.5) feeding `components:sync`.

### 3. Fill the gaps module authors hit

- **A styling hooks inventory**: every `data-slot` (and `data-table-part`, state attributes) the starter's own blocks and shell expose, with the file, what it marks, and whether the foundation registration styles it. Best on Style System (or its own page), linked from Styling Modules' "Hooks" section. The audit agent's table is below as a starting point.
- **The styling audit** (`scripts/audit-template-styling.mjs`) is only described in the LLM rules and Scripts; link it from Style System too.

### 4. The fact-check against the starter code

See the next section (added from the audit agent's report). Verify each item before changing a page; the agent was read-only and marks what it couldn't confirm.

### 5. When done

- Push the docs repo, then bump the `docs` submodule pointer in the starter and module-starter repos (both still point at an older docs commit).
- Delete this brief.

## Fact-check findings

From a read-only agent that compared the pages with the starter checkout on 2026-11-13. Line numbers are the pages' at that time. The Style session spot-checked three (marked ✔); confirm the rest before editing.

### Wrong or outdated claims

**`starter-template/style-system.mdx`**
- L57: modules can "set `--typeset-*` values via their `css`/`tokens`". A `tokens` value never reaches prose: `typeset.css` redeclares every `--typeset-*` on `.typeset` itself ✔. Set them in `css` on `.typeset` or a preset class.
- L79: "`darkTokens` skip the `theme.cssVariables` filter". The light `tokens` value of a property named in `darkTokens` skips it too, and `theme.changed` carries neither (style-pipeline.ts:95-100, 114).
- L87: "runs `npx shadcn@latest add --overwrite` for every component". Only when style, baseColor or cssVariables changed; otherwise `add --missing`, files kept (sync-components.ps1:338-412). Contradicts L152 on the same page.
- L124: overrides "loaded by `AppSettingsContext` on bootstrap". `BrandingProvider` applies the public map too (BrandingContext.tsx:173-177), and main.tsx:91-94 replays the cache. Name all three.
- L66: lists three foundation slots. `foundation.slots` also styles `header-toolbar-badge`, `separator[data-variant=dashed]`, `data-table-part=column-header`, `navigation-menu-trigger[data-active]` and the top-bar scroll padding (foundation-style.registration.ts:181-238).

**`starter-template/typography.mdx`**
- L62: `<Text variant="label" as="label" htmlFor="x">`. `TextProps` extends `ComponentPropsWithoutRef<'p'>` (Text.tsx:42), which has no `htmlFor`: a type error (reasoned from the types, not compiled). The Style module hit exactly this and used shadcn `Label` instead. Make `Text` polymorphic or change the example.
- L119: "`--ui-<role>-transform` … have no default". Overline defaults to `uppercase` and `--tracking-wider` (foundation-style.registration.ts:156-157).
- L78/L138: the style lists leave out Rhea (a `text-base` medium CardTitle at shadcn 4.23, per the Style module's vendored style sheets; unverified against the starter).

**`starter-template/theme.mdx`**
- L79/L135: `resetThemeVariables()` "reverting them to globals.css". The style pipeline writes through `applyThemeVariables`, so a reset also strips every styleRegistry token until the registry next changes (theme.ts:78-92, 109-117). Add a caution.
- L11: the registry "clears tokens that fall out of the active merge" doesn't cover variables a `theme.cssVariables` filter injects (style-pipeline.ts:117-120).

**`starter-template/registries.mdx` (Style Registry)**
- L681-684: `--primary` / `--sidebar` in `tokens` without `darkTokens` (flattens dark mode).
- L692: `style: 'new-york'`. The doctor reports any non-`radix-*` style as an error (shadcn-foundation.mjs:197-199). Use `'radix-nova'`.
- L719: "The `AppSettingsContext` loads overrides" (as style-system L124).
- L742/L746: "run shadcn add --overwrite" leaves out the saved-theme style, the baseline restyle and the add-missing default. Link style-system's sync steps.
- L754: the hook "re-renders … on override changes". False: `applyOverrides`, `setOverride` and `clearOverride` only call `reapply()` and never notify listeners ✔ (style.registry.ts:328-351); the JSDoc at style.registry.ts:481-482 says the same false thing.

**`starter-template/admin-feature.mdx`**
- L675: as style-system L124.
- L680-693: an `isEnabled(entry.id)` row won't update after `setOverride`, because the hook doesn't re-render. Keep the toggled state in React state. (The PUT body `{ overrides }` is right.)

**`starter-template/scripts.mdx`**
- L344-350 "What it does" is out of date: no saved-style read (`saved-theme-style.mjs`), no baseline on a restyle, no add-missing default, no Typeset wiring, no closing `doctor --quiet`.
- L357-367: the flags table lacks `-ForceReinstall` / `--force-reinstall` and `-ApiUrl` / `--api-url` (sync-components.ps1:39-45; .sh:68-71).
- L375: "rewrites the same files" — with no change it runs `add --missing`.
- L785-792: the audit rules table lacks `dead-token` ✔ (audit-template-styling.mjs:65-68, 147).

**`getting-started/llm-rules.mdx`**
- L739: `applyThemeVariables({ '--color-primary': … })`. `--color-*` are build-time aliases no utility reads (theme.ts:17-21; theme.mdx says so). Use `'--primary'`.
- L755: `--primary` in `tokens` without `darkTokens`.
- L413: "Its rule ids are …" lists six; there are seven (`dead-token`), which L379 itself cites.

**`module-starter/registry-guide.mdx` (Style Registry)**
- L292: "admins can toggle entries … in the Admin UI". The starter ships no toggle UI: nothing in `frontend/src` calls `setOverride` ✔ (the Style module's Style catalogue tab is one such UI). Two starter code comments claim a Branding page that doesn't exist (foundation-style.registration.ts:41-42; admin/style.registration.ts:10-11).
- L304: `--primary` without `darkTokens`. L311: `'new-york'`. L334: "re-renders on … override changes" is false.

**`module-starter/templates.mdx` (the scaffold's STYLE_REGISTRATION)**
- L854: `'new-york'`. No `darkTokens`. L865 typo "Documents this".

### Contradictions between pages (besides item 1 above)

- **Palette tokens and dark mode:** style-system L79-81 and theme.mdx L65-67 say a palette token needs `darkTokens`; llm-rules L755, registry-guide L304 and registries L682-683 put `--primary` in `tokens` alone.
- **`--color-*` names:** llm-rules L739 uses them; theme.mdx L63 and style-system L77 say they change nothing.
- **`components:sync`:** style-system L87, registries L742 and scripts L350/L375 say it always overwrites; style-system L152 (and the code) say only when the look changed.
- **`useStyleRegistry` reactivity:** registries L754 and registry-guide L334 say it re-renders on override changes; admin-feature L683 and the code say it doesn't.
- **Audit rule ids:** six in llm-rules L413 and scripts L785-792; seven in the code.
- **Bespoke parts:** typography L28 and llm-rules L360 say "data-slot plus a Style Registry entry"; Styling Modules says a Style snippet. Settle with item 1.

### Gaps, in priority order

1. **A starter hooks inventory** (table below). Partly on shell-layout.mdx and data-table.mdx; some hooks are only in the changelog or nowhere: `header-toolbar-badge`, `navigation-menu-trigger[data-active]`, `data-nav-action`, `data-top-nav-entry` / `-more`, `settings-table-frame`, `admin-item-swatch`, `logo-preview-frame`, `separator[data-variant=dashed]`, `data-config-transfer-part`.
2. **The starter's entry ids and retune variables:** `foundation.slots`, `admin.stat-value`, and `--plan-name-size/-weight`, `--widget-stat-size/-leading/-weight`, `--toolbar-badge-size/-weight/-bg/-foreground`, `--divider-dashed-color`, `--data-table-sort-offset`, `--auth-wordmark-font/-size/-weight`, `--nav-trigger-active-bg`, `--nav-topbar-offset`, `--admin-stat-size/-leading/-weight`. Most are documented nowhere outside the changelog.
3. **Caveats:** override changes aren't reactive; `resetThemeVariables` wipes registry tokens; `--typeset-*` can't be set from `:root`; filter-injected tokens are never cleared.
4. **No toggle UI in the starter**, and `.module-state.json` as the source of `installedShadcnComponents`: neither is stated.

### Styling hooks inventory (frontend/src, `components/ui` excluded)

| Hook | Where | Marks | Foundation styles it? |
|---|---|---|---|
| `data-nav-layout="side\|top"` | AppShell.tsx:219 | Shell root | Only `html:has([data-nav-layout=top])` scroll padding |
| `app-header` | SiteHeader.tsx:48 | Page header (no background) | No |
| `app-content` | AppShell.tsx:242 | Content area | No |
| `app-topbar` (+ `data-state=loading\|unavailable`) | AppTopbar.tsx:32; AppShell.tsx:147,163 | Top bar and its stand-ins | No |
| `app-brand` | AppTopbar.tsx:42 | Brand link | No |
| `app-topbar-secondary` (buttons `data-active`) | TopbarSecondaryNav.tsx:30,54 | Secondary nav | No |
| `app-topbar-mobile-nav` | TopbarMobileNav.tsx:89 | Mobile sheet nav | No |
| `navigation-menu-trigger[data-active]`, `data-top-nav-entry`, `data-top-nav-more` | TopNavMenu.tsx:378-388,493-495 | Active dropdown; entries | Trigger `data-active` only |
| `data-nav-action` | NavMain.tsx:76; TopNavMenu.tsx:336 | Nav action link | No |
| `user-menu-account` | UserMenuContent.tsx:66 | Account header in the menu | No |
| `header-toolbar-badge` | HeaderToolbarItem.tsx:140 | Toolbar count badge | Yes |
| `data-active` | SettingsLayout.tsx:82 | Settings nav item | No |
| `widget-stat-value` | ExampleWidgets.tsx:138 | Dashboard stat | Yes |
| `admin-stat-value` | AdminDashboardPage.tsx:13; SystemAdminPage.tsx:25; system-blocks.tsx:115-148; ConfigImportParts.tsx:118 | Admin stats | Yes (`admin.stat-value`) |
| `admin-item-swatch`; Item `data-active` / `-disabled`; `data-hidden` | AdminComponents.tsx:206-244; NavigationManagementPage.tsx:114 | Admin nav editor | No |
| `logo-preview-frame` | AppSettingsPage.tsx:275 | Logo preview | No |
| `data-signup-enforcement` | SignupPolicySection.tsx:84,95 | Sign-up policy state | No |
| `plan-name` | PlanCard.tsx:60 | Plan title | Yes |
| `separator[data-variant=dashed]` | Divider.tsx:21 | Dashed divider | Yes |
| `settings-table-frame` | settings-blocks Table.tsx:91 | Table frame | No |
| `data-disabled` | Row3Col.tsx:70; ToggleGroup.tsx:62 | Disabled rows / items | No |
| `auth-wordmark` | Sign-in, sign-up, forgot and reset password pages | Text wordmark | Yes |
| `data-table` (+ `data-density`), `data-table-frame`, `-toolbar`, `-pagination`, `-row-actions` (+ `data-intent`), `-status` (+ `data-selected`), `-status-error` | DataTable.tsx:668-700; DataTableToolbar.tsx:270; DataTablePagination.tsx:52; DataTableRowActions.tsx:76-88; DataTableStatusBar.tsx:103-154 | DataTable parts | No (the Style module's catalogue styles several) |
| `data-table-part=column-header` (+ `data-sorted`, `data-align`) | DataTableColumnHeader.tsx:55-60 | Sort header | Offset only |
| `data-table-part`: search, view-options, reset-columns, density, primary-action, filter, more-filters (+ `data-active`), copy (+ `data-copied`), confirm, skeleton-row, error-state, retry, truncate, expanded-row, missing, person, link, id, progress (+ `data-state` / `data-value`) | DataTableToolbar.tsx; DataTableFacetedFilter.tsx:86; DataTableMoreFilters.tsx:92; DataTableCopyButton.tsx:83; DataTableConfirm.tsx:118; DataTable.tsx:748-858; columns.tsx:107-648 | Table sub-parts | No |
| Row `data-state=selected`, `data-depth`; Badge `data-status`; Avatar `data-size` | DataTable.tsx:796-797; columns.tsx:398,491; UserAvatar.tsx:179,191 | Row / status / avatar state | No |
| `config-transfer` + `data-config-transfer-part` (14 values), `data-dragging` / `-strategy` / `-change` / `-state` | components/config-transfer/* | Import / export UI | No |
| `inline-code` | NotFoundPage.tsx:45 | Path chip | No |
| `email-*` (19 slots) + `data-situation` / `-reason` / `-state` / `-step` / `-mode`, `data-auth-email`, `data-warning` / `-severity` | features/email/components/* | Email setup | No |
| `data-unread` | NotificationsPage.tsx:53 | Unread notification | No |

Once the inventory is published, link it from [Styling Modules](/module-starter/styling/#hooks-how-your-parts-become-styleable) ("Hooks").

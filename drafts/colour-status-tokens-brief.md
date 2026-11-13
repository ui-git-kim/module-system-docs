# Colour module: stop registering the status colours (brief)

Written 2026-11-13 from the Style module session. Not published (outside `src/content`). Delete it when the work is done.

## Why

The owner decided that **only the Style module registers styling** ("Only Style module"), and then that the colour module's status colours **move into Style** ("Move them into Style"). Style v1.16.16 has shipped its half:

- `style.status-tokens` (Style's `registrations/style.registration.ts`, order 12, always on) defines `--success`, `--warning`, `--info` and their `-foreground` pairs for light and dark mode inside `@layer base`. Every app with the Style module has them from the first paint; a saved Style theme or the app's own values win.
- Light warning is now a deep amber, `oklch(0.555 0.163 48.998)`, with `oklch(0.987 0.022 95.277)` as its text colour: the colour module's own values. Every default passes 4.5:1 both as text on the page and under its own foreground (Style's tests hold it there), so the colour module's `text-(--warning)` stays readable.
- Until the colour module stops registering, both entries exist. Style's comes later (order 12 against the colour module's 10), so Style's values are already the ones in force: nothing breaks in the meantime.

## What the colour module session should do (repo `Blocks/colour`, v2.57.0 at the time of writing)

1. **Remove the registration.** `src/templates/frontend/registrations.ts` → `STYLE_REGISTRATION` (the `my-feature.status-tokens` entry), its entry in `src/module.ts` (around line 377, `registrations/style.registration.ts`), its export in `src/templates/frontend/index.ts`, and the side-effect import in the frontend barrel (`src/templates/frontend/routes.ts`, `import './registrations/style.registration';`). Check whether the scaffold's update removes the orphaned generated file from apps, or whether an `uninstall`/orphan step is needed.
2. **Keep the markup.** The 17 uses of `text-(--warning)`, `bg-(--success)` and the like stay: they now read Style's values. Update the comments that say the colour module registers them (`colour-knowledge-card.ts` around line 30, `pages.ts` around line 98).
3. **Decide what happens without the Style module.** With no Style module the variables are undefined: warning text inherits its parent's colour and the tinted backgrounds go transparent (the colour module's own comment already describes this for a switched-off entry). Either accept that and say so in the docs, or add a fallback in the markup (for example `text-(--warning,var(--destructive))`). Adding `'style'` to `depends` is the other option; ask the owner if unsure.
4. **Tests.** Remove or update any test that expects the entry.
5. **Docs** (the shared docs repo, `src/content/docs/colour-palette/`): `integration.mdx` and `changelog.mdx` mention `colour.status-tokens`. Say the status colours come from the Style module (Style v1.16.16+, `style.status-tokens`), and add a changelog entry. Style's own pages are already updated.
6. **Release** per the colour module's CLAUDE.md: version bump, build, push the docs first, then the module (remote `origin`, `ui-git-kim/block-colour`).

# App swatch palette for the colour picker (brief)

Written 2026-11-15 from the Style module session. Not published (outside `src/content`). Delete it when the work is done.

## Why

The owner wants to choose, from the Style module, the colours in the circles of the starter's `QuickColourPicker`. Today every module passes its own hard-coded list (`colours={...}`), and nothing can change them. Of the two ways offered, the owner chose **"One app palette, opt-in"** (2026-11-15):

- an admin sets one palette in Style (Theme tab → Colours → **Swatches**);
- the starter's picker can show "the app's swatches";
- each module switches its **general** colour pickers to the app palette, and keeps its own list where the colours mean something (status badges, for example).

The other option, Style replacing every picker's list with no module change, was turned down because it would also replace lists chosen for a reason.

## What the Style module already does (Style v1.16.21)

- `StyleConfig.swatches?: { value: string; label?: string }[]`, edited in the Colours view, saved with the app theme (`AppSettings.appTheme`).
- Values are checked (`utils/swatches.ts`): a theme token or Tailwind hue-shade name (`primary`, `chart-1`, `rose-500`), a hex code, or a plain `oklch()` / `oklab()` / `rgb()` / `hsl()` colour. Nothing else is stored or sent. Each value appears once; at most 24; every colour gets a label (its own, or one made from the value: `chart-1` → "Chart 1").
- **The hand-over:** when the theme loads (start-up) and on every save, Style calls `setAppSwatches(colours)` with that list, or `null` when the theme has no palette. It finds the function with
  ```ts
  import.meta.glob('../../../components/colour-picker/app-swatches.ts', { eager: true })
  ```
  from `features/style/registrations/style.registration.ts`, and calls `setAppSwatches` only if the file exports a function by that name. On a starter without the file nothing happens, so Style needs no new minimum host.

**So the file path and the function name below are the contract.** Please keep them exactly, or tell the Style session what changed.

## What the starter should add

1. **`frontend/src/components/colour-picker/app-swatches.ts`**: a small store with no UI imports (it is pulled into the first download by the style registration):
   - `setAppSwatches(colours: ColourOption[] | null): void`: replace the palette (`null` or `[]` = no app palette) and notify subscribers.
   - `getAppSwatches(): ColourOption[] | null`.
   - `useAppSwatches(): ColourOption[] | null`: `useSyncExternalStore` over the store, so pickers re-render when Style loads or saves the palette (start-up loads it after first paint).
   - Re-export all three from the `@/components/colour-picker` barrel. Only the Style module should call `setAppSwatches`; say so in the JSDoc and the docs.
2. **`QuickColourPicker`**: a new prop `palette?: 'app'`.
   - `palette="app"`: show the app palette when it has colours; otherwise fall back to `colours` (or `QUICK_COLOURS`). A module passes both: `<QuickColourPicker palette="app" colours={MY_DEFAULTS} … />`, so nothing changes in an app without a palette.
   - Suggested: with no `colours` prop at all, prefer the app palette over `QUICK_COLOURS` too.
   - **A stored value that isn't in the palette must still show as selected** (for example, through the custom chip when `allowCustom` is on), so switching a picker to the app palette never hides a colour someone already chose.
3. **Optional: `ColourPicker`** (the popover) could list the app palette first, as an "App colours" group, when it has colours.
4. **The avatar picker** (`AVATAR_COLOUR_OPTIONS`) is the starter's choice. Its colours were picked for contrast with white or black initials, so keeping its own list seems right.
5. **Docs:** the colour picker page (the `palette` prop, `app-swatches.ts`, "only the Style module sets it"), the changelog, and the shared [Styling Modules](/module-starter/styling/) page's "Which tool for which job" table (a row: "Let people choose a colour → `QuickColourPicker palette="app"` with your own list as the fallback"). A patch release; Style needs no change when it ships.

## What each module should do afterwards

Switch the **general** pickers to the app palette, keeping the current list as the fallback: `palette="app" colours={…}`. From veradai's code (2026-11-15):

- **structure:** `NodeTypeForm` (`COLOUR_SWATCHES`), `NodeTypesAdminPage` (connection types and groups, `COLOUR_SWATCHES`), `NodeForm` and `NodeSettingsTab` (`ENTRY_COLOUR_SWATCHES`), `NodeFieldRenderer` and `ConditionsDialog` (`COLOUR_FIELD_SWATCHES`), `DetailPageEditor` (`HEADER_COLOURS`). Keep `BadgeEditor` (`BADGE_SWATCHES`) on its own list if those colours carry meaning.
- **ai-chat:** `AiChatPersonaEditor` (`PERSONA_COLOURS`).

**Values can now be any shape of the picker's value contract**, not only hex: a token (`chart-1`), a hue-shade, or `oklch(…)`. Code that applies a stored colour must render it with `resolveColourPreview(value)`. Anything that assumes a hex code, such as a contrast helper that parses `#rrggbb`, needs a path for the other shapes. Lower-casing a value is harmless (tokens are lower case already).

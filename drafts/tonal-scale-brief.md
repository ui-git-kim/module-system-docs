# Paint-Mix Tonal Scale Brief — `generateTonalScalePaintMix`

> **Purpose of this doc:** a research brief for writing the final Starlight page at `docs/src/content/docs/colour-palette/tonal-scale.mdx`. Extracted from the original design conversation. Style the final page to match `harmony-map.mdx`.

## The problem being solved

A tonal scale generator takes a single anchor colour and produces a ramp — lighter tints above it, darker shades below — that reads as **the same colour at different brightness levels**. UI frameworks need this for backgrounds, hover states, borders, disabled variants, chart accents etc.

The hard part isn't the lights; it's the darks. Three things go wrong if you do it naively:

1. **Linear L interpolation darkens with the wrong shape.** The OKLCH gamut boundary isn't a straight line — it's a triangle from (0,0) through the cusp to (1,0). Linear L + fixed chroma punches through the boundary and either clips to ugly mud or requires aggressive gamut mapping that kills vividness.

2. **Equal-L spacing looks uneven perceptually.** Yellow has its cusp at L≈0.89; darkening it from 0.89 to 0.59 (a 0.30 drop) passes through visually dramatic territory because chroma changes fast in that region. The same 0.30 drop starting from L=0.45 for blue is perceptually subtle. Uniform L spacing produces a scale with a perceptually-crowded dark end and thin light end (or vice versa) depending on hue.

3. **Hue drift.** As L drops, warm hues (orange, yellow) tend to desaturate and drift cool — orange becomes brown, yellow becomes olive. Without a warm-side hue correction the dark shades feel like a different colour family.

## Design history — approaches tried and rejected

The current paint-mix algorithm is the result of many iterations. The previous approaches are preserved in `colour-reference.ts` for posterity — understanding why they were rejected is the key to understanding what the final one does differently.

### Attempt 1: Hybrid (chroma-weighted darks)

Even L spacing across a per-hue range, with chroma ease-off on the light side and chroma-weighted interpolation on the dark side. Worked reasonably but had a visible jump from the anchor to the first darker step — the first dark was perceptually further from the anchor than the first light was.

### Attempt 2: Power-curve hybrid

Same as the hybrid, but dark side used `t^1.6` L spacing to pack more steps near the anchor. Fixed the anchor-to-first-dark jump. The user approved this but wasn't thrilled with the character of the darks — they felt computed rather than natural.

### Attempt 3: Paint-mix (linear lerp between endpoints)

Completely different approach: compute two tinted endpoints (tinted white at lMax, tinted black at lMin), then linearly interpolate between them. Produced rich colours in the middle but the lights came out too close to white. The user's feedback:

> "the paint mix, feels like it was done incorrectly so using the yellow, you have the anchor — and for the dark side, mix anchor with #0e0b04, and for the light side mix anchor with #fbf5e1."

The reframe that unlocked the final version:

> "it's using the lightEnd mixed with the anchor, and darkEnd mixed with anchor — and the amount in the dab is perceptually equal."

This is the mental model: **a painter dipping a brush into pure colour (the anchor), then mixing in progressively larger dabs of a lightest-colourful endpoint for tints, and progressively larger dabs of a darkest-colourful endpoint for shades.** Not a scale calculation. Not white and black pots. Two pots of *colourful* paint (the lightest and darkest vivid points on the hue's gamut), dabbed into the anchor in increasing amounts.

### Attempt 4: Paint-mix with ΔE equalisation

Sample the anchor→darkEnd path at 200 points, measure ΔE from anchor at each, then for each dark step find the `t` where ΔE matches the mirror light step's ΔE. Theoretically perceptually equal. Failed for blue — the dark path was shorter than the light path, so proportional scaling clumped the dark steps together.

### Attempt 5 (final): Paint-mix with power-curve dark side

Light side: linear dabs (equal increments of the light endpoint).
Dark side: `t^1.7` power curve — dabs grow nonlinearly, packing more steps near the anchor and accelerating toward the dark endpoint.

The asymmetry — linear lights, power-curve darks — reflects the asymmetry in the gamut geometry. The light side typically has less perceptual range (the cusp is close to white), so equal dabs work. The dark side has more range (often 0.4+ L units), so a power curve is needed to keep the early shades close to the anchor without losing resolution at the dark extreme.

## The current algorithm — `generateTonalScalePaintMix`

Located in `src/templates/frontend/colour-gamut.ts`.

**Inputs:**
- `colour` — the source OKLCH colour
- `opts.lighter` — number of lighter steps (default 5)
- `opts.darker` — number of darker steps (default 5)
- `opts.range` — `[start, end]` fractions of the full L range (default `[0, 1]`)

**Output:** `{ steps: OklchColor[], anchorIndex: number }` where `steps` is the scale lightest→darkest and `anchorIndex` points to the anchor's position.

### Step 1 — Anchor via `gamutMap3D`

```ts
const anchor = gamutMap3D(colour);
const cusp = findCuspForHue(anchor.h);
```

The anchor is the gamut-mapped source — same colour that appears on the "3D Nearest" card in the gamut page. All subsequent work is relative to this colour, not the raw input.

### Step 2 — Measure anchor's chroma fraction

```ts
const anchorMaxC = maxChromaAtLH(anchor.l, anchor.h);
const anchorFraction = anchorMaxC > 0
  ? Math.min(anchor.c / anchorMaxC, 1)
  : 0.85;
```

This is the anchor's position relative to the gamut boundary *at its own L* (not relative to the cusp). The endpoints will inherit this fraction — if the anchor is at 70% of its max chroma, the lightest and darkest endpoints will also sit at 70% of *their* max chromas. This keeps the scale's "richness" consistent across steps.

(Note: the harmony-map doc discusses why `anchor.c / maxChromaAtLH` is a problematic measure for *harmony rotation* — it inflates at high L because `maxChromaAtLH` collapses near white. For the tonal scale it's the right measure because we're staying at the same hue, so the gamut shape is identical for every step.)

### Step 3 — Find the L range

```ts
const threshold = cuspC * 0.08;
let lMaxFull = cusp.l;
for (let testL = cusp.l; testL <= 0.98; testL += 0.01) {
  if (maxChromaAtLH(testL, anchor.h) < threshold) break;
  lMaxFull = testL;
}
lMaxFull = Math.min(lMaxFull + 0.02, 0.985);
// mirror for lMinFull toward L=0
```

Walk outward from the cusp until chroma drops below 8% of cusp max. This gives a per-hue L range that reflects where useful colour exists. Yellow's range is tall (cusp at 0.89, maybe down to 0.55); blue's is narrower (cusp at 0.45, maybe down to 0.15). Every hue gets its own tuned range without per-hue constants.

The 8% threshold was picked empirically. 5% extended too far into near-black olive territory for yellow; 15% cut off too early for low-saturation hues.

The `opts.range` fractions let callers extract just a slice of this full range — `[0.2, 0.8]` takes the middle 60%.

### Step 4 — Build the two endpoint pots

```ts
const lightMC = maxChromaAtLH(lMax, anchor.h);
const lightEnd = gamutMap3D(
  { l: lMax, c: lightMC * anchorFraction, h: anchor.h }, 0.05, 3,
);

const darkMC = maxChromaAtLH(lMin, anchor.h);
const darkEnd = gamutMap3D(
  { l: lMin, c: darkMC * anchorFraction, h: anchor.h }, 0.05, 3,
);
```

The two "paint pots" — the lightest colourful version of the hue and the darkest colourful version. Both at the anchor's chroma fraction of their respective L's gamut max. Both gamut-mapped with small L/H shifts (±0.05 L, ±3°) to nudge them into the widest-gamut neighbourhood without wandering off the hue.

Critically, **these are not white and black** — they are colourful endpoints with real saturation. Mixing toward them preserves the hue family all the way to the extremes.

### Step 5 — Light side (linear dabs, blended chroma)

```ts
for (let i = lighterCount; i >= 1; i--) {
  const t = i / lighterCount;
  const stepL = lerp(anchor.l, lightEnd.l, t);
  const linearC = lerp(anchor.c, lightEnd.c, t);
  const gamutC = maxChromaAtLH(stepL, anchor.h) * anchorFraction;
  lightSteps.push(gamutMap3D({
    l: stepL,
    c: linearC * 0.65 + gamutC * 0.35,
    h: lerpHue(anchor.h, lightEnd.h, t),
  }, 0.05, 3));
}
```

Equal linear dabs — step `i` out of `lighterCount` gets a dab of size `i/lighterCount`. Chroma is a 65/35 blend of two candidates:
- `linearC` — pure linear interpolation anchor→lightEnd
- `gamutC` — what the gamut boundary would allow at the step's L (with the anchor's chroma fraction)

The 65/35 blend keeps the light side rich without punching through the gamut wall. Pure linear (`1.0 × linearC`) undershoots the gamut boundary curve and produces dull mids; pure gamut-following (`1.0 × gamutC`) hits the wall too hard and produces neon-ish mids.

Each result is run through `gamutMap3D` with small shifts (0.05, 3°) — enough to polish the chroma/hue without wandering.

### Step 6 — Dark side (power-curve dabs)

```ts
for (let i = 1; i <= darkerCount; i++) {
  const linearT = i / darkerCount;
  const t = Math.pow(linearT, 1.7);
  darkSteps.push(gamutMap3D({
    l: lerp(anchor.l, darkEnd.l, t),
    c: lerp(anchor.c, darkEnd.c, t),
    h: lerpHue(anchor.h, darkEnd.h, t),
  }, 0.05, 3));
}
```

Dabs grow on a `t^1.7` curve. The first dark step has a dab size of only `(1/5)^1.7 = 0.066` — a gentle nudge toward the dark endpoint. The last step gets the full `1.0` dab. This packs the early darks close to the anchor (small perceptual jumps) and accelerates toward the dark extreme.

The `1.7` exponent was chosen empirically. `1.0` (linear) put the first dark too far from the anchor. `2.0` pushed it so close that steps 1–2 were nearly indistinguishable. `1.7` is the sweet spot.

L, C, and H are all interpolated — which implicitly produces the warm shift for warm hues. If `lightEnd.h` and `darkEnd.h` drifted during `gamutMap3D` (which they typically do toward the warmer side for warm hues as chroma constraints change), the dark steps inherit that drift. No separate "warm shift" constant is needed.

### Step 7 — Assemble

```ts
return {
  steps: [...lightSteps, anchor, ...darkSteps],
  anchorIndex: lighterCount,
};
```

Lightest first, anchor in the middle, darkest last.

## Tuning constants

| Constant | Value | Rationale |
|---|---|---|
| Anchor via `gamutMap3D` | default (no cap) | The anchor should be the most vivid version of the source — same as the gamut page's "3D Nearest". |
| Chroma threshold for L range | 8% of cusp C | Where "useful colour" gives way to near-neutral. Too low produces olive darks; too high crops interesting shades. |
| Light side blend ratio | 65% linear + 35% gamut-following | Keeps rich without neon. |
| Dark side curve exponent | 1.7 | First dark close to anchor, last dark fully at darkEnd. Tuned empirically. |
| Per-step `gamutMap3D` shifts | 0.05 L, 3° H | Polish without wandering. Matches the harmony-map's per-step call. |
| Default `lighter / darker` | 5 / 5 | 11 total including anchor — the shadcn/MD standard. |

## Master scale + sampling

The final piece: `generateTonalMaster` produces a 51-step master scale at very high resolution (25 lighter + anchor + 25 darker), and `sampleTonalScale` downsamples to any count and any sub-range. Used when different UI contexts need different step counts from the same base colour — hovered border wants 3 light steps, chart series wants 7 mid steps, etc.

```ts
export function generateTonalMaster(colour: OklchColor): TonalMaster {
  const result = generateTonalScalePaintMix(colour, { lighter: 25, darker: 25 });
  return { steps: result.steps, anchorIndex: result.anchorIndex, anchor: result.steps[result.anchorIndex] };
}

export function sampleTonalScale(
  master: TonalMaster,
  steps: number,
  rangeStart = 0,
  rangeEnd = 1,
): { steps: OklchColor[]; anchorIndex: number };
```

Generated once per colour, sampled cheaply afterwards. The anchor always snaps to the nearest sample if it falls within the requested range.

## Structure suggestions for the final MDX

Mirror `harmony-map.mdx`:

1. **The three failure modes** — linear gamut punch-through, equal-L looks uneven, hue drift on darks. Frame the problem.
2. **The painter's metaphor** — anchor as pure paint, two colourful endpoint pots, dabs of increasing size. This is the mental model that makes the algorithm click.
3. **The algorithm** — seven steps, code blocks + prose.
4. **Why asymmetric (linear lights, power-curve darks)** — highlight this as the key geometric insight.
5. **Why 65/35 chroma blend on lights** — the gamut boundary isn't straight, neither is pure linear.
6. **Why the endpoints aren't white and black** — colourful endpoints preserve hue family.
7. **Iteration history** — brief. Hybrid, power-curve, linear paint-mix, ΔE equalisation, final. Why each was rejected.
8. **Master scale + sampling** — one short section.
9. **Tuning constants** — the table above.

Target ~2000 words of MDX. The painter metaphor is the hook — lead with it.

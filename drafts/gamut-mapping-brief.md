# Gamut Mapping Brief — `gamutMap3D` and `gamutMap3DShaded`

> **Purpose of this doc:** a research brief for writing the final Starlight page at `docs/src/content/docs/colour-palette/gamut-mapping.mdx`. Extracted from the original design conversation. Style the final page to match `harmony-map.mdx`.

## The problem being solved

Standard CSS Color 4 gamut mapping (what `culori.clampChroma` does) holds L and H constant and binary-searches chroma downward until the colour lands in sRGB. It's correct but over-aggressive: it kills more chroma than necessary because it only works along the chroma axis at a fixed (L, H) coordinate.

For vivid OKLCH colours — the saturated input the palette generator produces — this produces dull output. Yellow at `L=0.74, C=0.19, H=90` becomes a muddy olive, not a bright yellow. The W3C CSS WG has documented this extensively (issue [#10579](https://github.com/w3c/csswg-drafts/issues/10579)) and is actively exploring replacements.

The core reframe that unlocked `gamutMap3D`:

> **Don't ask "how do I clip this colour back in?" Ask "where is the nearest vivid in-gamut point?"**

OKLCH is a 3D cylinder — L × C × H — and the sRGB gamut boundary is a complex surface inside it. The "best" nearby colour isn't necessarily at the same (L, H). For yellow, the gamut widens considerably as L approaches the cusp (L≈0.89); shifting L a little toward the cusp recovers dramatically more chroma than clipping at the input L. Similarly, small hue shifts (±5°) can land on a wider patch of the gamut surface.

## References cited during design

All of these were read and informed the approach:

1. **Björn Ottosson's gamut clipping post** — the analytical direct-projection method. We ported this as `ottosonGamutMap` and kept it as a reference on the gamut page. It's fast (O(1), no iteration) and has best hue preservation (ΔH ≈ 2.28), but like CSS Color 4 it holds hue and doesn't exploit the 3D neighbourhood.

2. **Björn Ottosson's OKLab post** — background on the colour space itself. OKLab's perceptual uniformity is what makes lightness-shifting tractable.

3. **dokozero's OKLCH gamut clipping tests** — visual comparisons of every major gamut mapping algorithm. Convinced us that the clipping algorithm itself wasn't the interesting knob; it was the choice of target coordinate.

4. **dokozero's OKLCH relative chroma** — the "generate colours that are already in gamut" reframing. Led directly to the decision to search the 3D neighbourhood for the widest-gamut point.

5. **Smashing Magazine — OKLCH Color Spaces, Gamuts, and CSS** — practical OKLCH overview.

6. **W3C CSS WG issue #10579** — current research on replacing the CSS Color 4 gamut mapping algorithm. Edge Seeker, Chromium, Raytrace and Ottosson are the leading candidates. Confirmed we weren't reinventing; we were combining insights the CSS working group itself finds valid.

7. **Simon Cozens' blog** and **colorjs/coloraide** — practical comparisons showing Ottosson works well but every algorithm calling `gamutMap` / `clampChroma` as a final step inherits the over-reduction problem.

## The `gamutMap3D` algorithm — full derivation

**Inputs:**
- `(L, C, H)` — the target OKLCH colour (may be out of gamut)
- `maxLShift` — maximum L search distance toward the cusp (default 0.15)
- `maxHueShift` — maximum hue search distance in degrees (default ±5)

**Prerequisite primitives:**
- `maxChromaAtLH(L, H)` — binary search for max in-gamut C at a given (L, H). ~13 iterations on the sRGB boundary.
- `peakLightnessForHue(H)` — cusp L for hue H. Pre-computed 360-entry lookup.
- `gamutMap(L, C, H)` — standard CSS Color 4 chroma clip (via culori's `clampChroma`). Safety-net at the end.
- `lerpHue(a, b, t)` — shortest-path hue interpolation around the circle.

### Step 1 — Analyse

```ts
const C_here = maxChromaAtLH(L, H);
const L_cusp = peakLightnessForHue(H);
const L_dir  = Math.sign(L_cusp - L);
const L_bound = L + L_dir * maxLShift;
```

Two facts extracted from the input: how much chroma is available *right here*, and which direction the cusp sits. We only search *toward* the cusp — searching away from it can only reduce available chroma.

### Step 2 — Find the vivid spot

Grid search in the (L', H') neighbourhood for the widest-gamut coordinate:

```ts
// 16 L steps × 10 H steps = 160 candidates
for (let i = 0; i <= 16; i++) {
  const L_prime = lerp(L, L_bound, i / 16);
  for (let j = 0; j <= 10; j++) {
    const H_prime = H + lerp(-maxHueShift, maxHueShift, j / 10);
    const C_avail = maxChromaAtLH(L_prime, H_prime);
    if (C_avail > best) { L_vivid = L_prime; H_vivid = H_prime; C_vivid = C_avail; }
  }
}
```

No distance metric, no weighting — just a `max` over `maxChromaAtLH`. The gamut boundary itself drives every decision; there's no per-hue tuning.

### Step 3 — Blend (the triangle ratio)

Rather than jumping all the way to the vivid spot (which would overcorrect), blend from the original toward it by exactly enough to reach the target chroma.

Target chroma is 80% of the originally requested C (keeps a 20% margin — aggressive jumps look unnatural):

```ts
const C_target = C * 0.80;
const deltaC_range  = C_vivid - C_here;
const deltaC_needed = C_target - C_here;
const t_blend = clamp(1 - deltaC_needed / deltaC_range, 0, 1);

const L_blended = lerp(L, L_vivid, t_blend);
const H_blended = lerpHue(H, H_vivid, t_blend);
```

The blend fraction comes directly from the gamut geometry — `(Δneeded / Δavailable)`. No binary search on the blend; the triangle shape tells us the right amount.

### Step 4 — Temperature correction

The hue search tends to drift cool, because green/cyan regions have wider gamuts than red/magenta. Without correction, saturated oranges drift toward yellow-green. We pull the hue back toward the original, proportional to how much of the search range got used:

```ts
const hueShift = abs(H_blended - H);  // shortest-path
const t = clamp(hueShift / maxHueShift, 0, 1);
const alpha = Math.pow(t, 1.5);
const H_final = lerpHue(H_blended, H, alpha);
```

`t^1.5` ease-in means:
- At full search range (`t=1`): `alpha=1`, full correction back to original hue
- At half range (`t=0.5`): `alpha=0.35`, moderate correction
- At quarter range (`t=0.25`): `alpha=0.125`, light correction

The curve was chosen because the hue drift is only a problem at significant shifts; small shifts are usually a genuine gamut preference and shouldn't be corrected.

### Step 5 — Fill chroma

At the final (L, H), fill to 97% of available chroma (3% margin keeps us off the gamut wall and avoids banding):

```ts
const C_available = maxChromaAtLH(L_blended, H_final);
const C_final = min(C, C_available * 0.97);
return gamutMap(L_blended, C_final, H_final);  // safety net
```

The trailing `gamutMap` is defensive — the preceding logic should land us inside the gamut, but numerical noise in the boundary search can leave a few thousandths of a point outside. The final clip handles that.

## Key properties

1. **In-gamut inputs pass through unchanged.** If the input already fits in sRGB, `C_here = C` and `deltaC_needed = 0`, so `t_blend = 1` and we return the input.

2. **No per-hue tuning.** Yellow, blue, red all get different treatment, but that treatment comes from `maxChromaAtLH` returning different numbers — not from hue-specific constants. The algorithm stays correct as the gamut boundary data is updated or replaced.

3. **The blend is derived from the triangle.** `(C_target - C_here) / (C_vivid - C_here)` is the gamut boundary's chroma gradient translated into a blend fraction. Pure geometry.

4. **Temperature correction is proportional.** `(ΔH / maxHueShift)^1.5` scales with the search parameters — if `maxHueShift` changes from 5° to 10°, the correction curve adapts automatically.

5. **Cost.** Dominated by 160 `maxChromaAtLH` calls in step 2, each ~13 iterations on the sRGB boundary. Total ~2,000 gamut checks per colour. Fine for palette generation (dozens of colours), not for per-pixel rendering.

## The shaded wrapper — `gamutMap3DShaded`

The 3D search only does useful work when the input is *out of gamut* — an in-gamut input short-circuits through step 1 and returns unchanged. But most palette inputs arrive as in-gamut hex colours (e.g., `#149898`) because they came from a colour picker.

The shaded wrapper forces the pipeline to run:

```ts
export function gamutMap3DShaded(color: OklchColor): OklchColor {
  const shadedL = Math.max(0.01, color.l - 0.15);
  const shadedInGamut = inSrgb({ mode: 'oklch', l: shadedL, c: color.c, h: color.h });

  if (!shadedInGamut) {
    // Shaded is out of gamut — use it to drive gamutMap3D's full pipeline
    return gamutMap3D({ ...color, l: shadedL });
  }
  // Shaded is still in gamut — use original
  return gamutMap3D(color);
}
```

Why `-0.15`? It's large enough to push most mid-chroma colours past the gamut boundary (forcing the 3D search to find the vivid neighbourhood and pull L back up), but not so large that it distorts already-dark inputs. For colours so low in chroma that even the shaded version stays in gamut, we fall through to the unshaded path — the input is genuinely a muted colour and doesn't need 3D optimisation.

This is the function used throughout the pipeline (harmony generators, the working colour store, the palette generator's chart colour step). The plain `gamutMap3D` is only exposed because test/debug code and the comparison page on the gamut tool want to run it directly on a chosen input.

## Iteration history and rejected approaches

Context for why the current shape is what it is:

- **`gamutMap` alone** — CSS Color 4 clip. Too dull. Starting point.
- **`gamutMapVivid` with `bias` param** — clip first, then slide L toward the cusp to recover chroma. Worked partially but the bias was a hand-waved knob with no principled value.
- **`ottosonGamutMap`** — Ottosson's direct analytical projection. Ported and kept as reference, but holds hue fixed like CSS Color 4 so it inherits the same dullness for hues whose widest-gamut point isn't at the input H.
- **`projectTowardGrey`, `projectTowardCusp`, `projectAdaptive`** — various targeted-projection experiments. Live on the comparison page as reference implementations but none of them matched `gamutMap3D` in practice.
- **`mindeMap`, `cssColor4Map`** — straight implementations of the CSS approaches, kept for comparison baselines.

The 3D search was the insight that worked because it combines *all three* degrees of freedom OKLCH offers — L shift, H shift, C scaling — into a single step that finds the widest gamut point then blends toward it by a geometrically-derived amount.

## Tuning constants

| Constant | Default | Rationale |
|---|---|---|
| `maxLShift` | 0.15 | Large enough to reach most cusp regions, small enough to preserve input L character. |
| `maxHueShift` | 5° | Wide enough to find better gamut patches (green/cyan have wide belts), narrow enough that the temperature correction can pull the hue back without washing it out. |
| L grid steps | 16 | 160 total candidates (16×10) — cost vs resolution trade-off. |
| H grid steps | 10 | Same. |
| `C_target` factor | 0.80 | 20% back-off from the originally-requested C. Any higher produces jumpy, over-saturated output. Any lower is visibly dull. |
| Temperature curve | `t^1.5` | Ease-in — small hue shifts ignored, large ones corrected hard. `t^1.0` over-corrects at mid shifts; `t^2` under-corrects. |
| Chroma fill | 0.97 | 3% gamut margin for clean rendering, prevents banding from landing on the wall. |
| Shaded L offset | −0.15 | Large enough to push most mid-chroma inputs out of gamut; not so large it distorts already-dark inputs. |

## Structure suggestions for the final MDX

Mirror `harmony-map.mdx`:

1. **Why a naive clip fails** — CSS Color 4 over-reduction, reference the W3C issue.
2. **The 3D reframe** — OKLCH is a cylinder, the gamut is a surface, the right target isn't necessarily at the same (L, H).
3. **The 5-step pipeline** — Analyse → Find → Blend → Temperature correct → Fill. Code blocks + prose rationale at each step.
4. **Triangle ratio as a derived quantity** — this is the clever bit; highlight it.
5. **Key properties** — in-gamut passthrough, no per-hue tuning, cost.
6. **`gamutMap3DShaded`** — short section, why the wrapper exists, the −0.15 shading trick.
7. **Iteration history** — condensed from the above; brief mentions of rejected approaches so the comparison page's reference implementations have context.
8. **Tuning constants** — the table above.
9. **References** — numbered list with links.

Target ~1800 words of MDX. Code blocks are dense; rely on them to carry the formal content and use prose only for rationale.

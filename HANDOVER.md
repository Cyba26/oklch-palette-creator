# OKLCH Palette Creator — Handover

Web app to generate parametric design-system palettes in OKLCH, with a picker and curves that drive the whole palette around a single anchor color. Combines the precision of [oklch.com](https://oklch.com) (per-color picking) with the systemic generation of tools like Coolors/Radix, but built on OKLCH math so palettes stay perceptually uniform and gamut-aware.

The target user is **designers / design-system architects** who want fine-grained, paramétric control. Not a "give me 5 random pretty colors" tool.

---

## Stack

- **SvelteKit + TypeScript**, Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`, `untrack`)
- **culori** — OKLCH ↔ sRGB/P3 conversions, gamut detection
- **bezier-easing** — cubic bezier sampling for curve presets
- **zod** — installed but not heavily used (was planned for URL hydration validation; current code uses a hand-rolled `isPalette` type guard in `serialize.ts`)
- No UI framework, no Tailwind — pure CSS with scoped Svelte styles
- Deploys to Vercel (the user already has a project set up)

Dev: `cd "OKLCH palette creator" && npm run dev -- --port 3737`. Typecheck: `npx svelte-check --tsconfig ./tsconfig.json`.

---

## File map

```
src/
├── lib/
│   ├── types.ts                            # Palette, OKLCH, BezierCurve, Swatch, HarmonyType, Gamut
│   ├── color/
│   │   ├── convert.ts                      # oklchToHex, parseToOklch, formatOklch, formatRgb
│   │   ├── gamut.ts                        # isInGamut, maxChroma (binary search), clampToGamut, gamutScore
│   │   ├── fast.ts                         # oklchToSrgbBytes — inline Björn Ottosson math, ~5× faster than culori in hot loops
│   │   └── harmonies.ts                    # harmonyOffsets, harmonyLabels
│   ├── palette/
│   │   ├── curves.ts                       # PRESETS map, makeCurve, sampleCurve (bell = sin(πt))
│   │   ├── generate.ts                     # generatePalette, generateHarmonies, anchorIndex helper
│   │   └── serialize.ts                    # encodePalette/decodePalette (base64 URL hash)
│   ├── stores/
│   │   ├── picker.svelte.ts                # createPickerStore — color, hex, gamut, inGamut, setColor (atomic), setL/C/H, setFromString
│   │   └── palette.svelte.ts               # createPaletteStore — palette state, swatches/$derived, harmonies/$derived, shareUrl, syncFromPicker, pinAnchor, …
│   ├── components/
│   │   ├── pickers/
│   │   │   ├── ColorPicker.svelte          # topbar (swatch + chips + gamut segmented + collapse) + graphs grid
│   │   │   └── SliceGraph.svelte           # one 2D canvas slice + slider; supports compact mode (slider only)
│   │   ├── palette/
│   │   │   ├── CurveEditor.svelte          # SVG curve + handles + mirror range slider with dual gradient bars
│   │   │   ├── CurvePanel.svelte           # 3 CurveEditors + builds gradient stops for each axis
│   │   │   ├── PaletteView.svelte          # grid of SwatchCells; click pins anchor
│   │   │   └── SwatchCell.svelte           # one swatch (square + hex/rgb/oklch lines) — used by PaletteView and HarmonyPicker
│   │   ├── harmonies/
│   │   │   └── HarmonyPicker.svelte        # segmented (none/complementary/…) + tracks, each using SwatchCell
│   │   └── export/
│   │       └── ExportPanel.svelte          # tabs CSS/Tailwind/JSON/Figma + copy + share URL
│   └── export/
│       ├── css.ts                          # CSS variables; stepName(i, total) does Tailwind-style 50/100/.../950 naming
│       ├── tailwind.ts                     # tailwind.config snippet
│       ├── json.ts                         # raw JSON
│       └── figma-tokens.ts                 # W3C Design Tokens format (importable by Tokens Studio)
└── routes/
    └── +page.svelte                        # main layout; wires picker + palette stores; sticky picker section
```

---

## Core data model

```ts
type OKLCH = { l: number; c: number; h: number; alpha?: number };

type BezierCurve = {
  preset: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bell' | 'custom';
  controls: [number, number, number, number];
  range: [number, number];
};

type Palette = {
  steps: number;                  // 2..24
  baseHue: number;                // driven by picker.h
  curves: { lightness: BezierCurve; chroma: BezierCurve; hue: BezierCurve };
  harmonies: HarmonyType;
  gamut: 'sRGB' | 'P3';
  anchor: OKLCH | null;           // = picker color (atomic)
  anchorIdx: number | null;       // pinned step when user clicks a swatch; null = auto-search
  shiftLightness: boolean;        // default true
  shiftHue: boolean;              // default true
};
```

The **chroma curve is semantically a saturation curve**: its sampled value (0–1) is multiplied by `maxChroma(L, H, gamut)` at each step. This keeps the palette feeling consistently saturated across all lightness levels instead of fading to white/black where the gamut is narrow. Label in the UI is "Saturation".

---

## Architecture

Two reactive stores: `picker` (single color the user is editing) and `palette` (entire palette state). They're wired in `+page.svelte`:

```ts
$effect(() => {
  const color = picker.color;
  const gamut = picker.gamut;
  untrack(() => {
    // Release pin if picker drifted away from the pinned swatch (= user dragged
    // sliders / typed hex, didn't click in palette).
    const pinned = palette.palette.anchorIdx;
    if (pinned !== null && pinned >= 0 && pinned < palette.swatches.length) {
      const s = palette.swatches[pinned].oklch;
      const dL = Math.abs(s.l - color.l);
      const dC = Math.abs(s.c - color.c);
      const dH = Math.abs(((s.h - color.h + 540) % 360) - 180);
      if (dL > 0.005 || dC > 0.005 || dH > 0.5) palette.setAnchorIdx(null);
    }
    palette.syncFromPicker(color, gamut);
  });
});
```

The `untrack` is **critical** — without it, `syncFromPicker` reads `palette.curves.chroma` to copy/mutate it, which would re-trigger this effect on every palette write → infinite loop → rAF queue saturation → app freezes. Don't remove it.

### syncFromPicker

Called on every picker change. Writes:
- `baseHue = picker.h`
- `gamut = picker.gamut`
- `anchor = { l: picker.l, c: picker.c, h: baseHue }`
- `curves.chroma.range = [pickerSat * 0.6, pickerSat]` where `pickerSat = picker.c / maxChroma(picker.l, baseHue, gamut)`
- **Does NOT touch the hue offset curve** — user-set hue offsets are preserved

### pinAnchor

When the user clicks a swatch in PaletteView or HarmonyPicker, we call `palette.pinAnchor(idx, color)` **before** `picker.setColor(color)`. This sets `anchorIdx + anchor + baseHue` in one atomic mutation so the `$derived` swatches see a consistent state. Otherwise the swatch at the pinned index gets overridden with the *previous* anchor color → the divergence check above sees a mismatch → releases the pin → search → wrong step gets the picker tag. Order matters here.

### generatePalette — two-pass

In `src/lib/palette/generate.ts`. Key flow:

1. **Pass 1 (rough)**: sample curves naively → array of `{l, c, h}` per step.
2. **Anchor resolution**:
   - If `palette.anchorIdx !== null` → use it directly (pinned).
   - Else → find closest rough step in weighted (L, C, H) space (hue diff weighted by `anchor.c` so low-chroma hue differences are downweighted).
3. **Compute shifts** based on `anchorT`:
   - `lShift = anchor.l - L_curve(anchorT)` if `shiftLightness`
   - `hShift = -hue_curve(anchorT)` if `shiftHue`
   - `satScale = pickerSat / sat_curve(anchorT)` (always applied)
4. **Pass 2 (final)**: apply shifts, compute `c = sat * maxChroma(l, h, gamut)`.
5. **Override**: swatch at `anchorIdx` is replaced bit-for-bit with `{ anchor.l, anchor.c, anchor.h }` to correct rounding drift.

The two-pass is what gives the picker color a guaranteed spot in the palette while keeping neighbors smooth.

---

## Picker rendering (SliceGraph)

Each of the 3 graphs renders a 2D slice of OKLCH space with two free axes and one fixed (the picker's current value on the third axis). Implementation details that cost us cycles:

- **DPR-aware canvas**: buffer is `cssW * dpr` × `cssH * dpr`. We render the gradient ImageData at full DPR resolution (`block = 1` per physical pixel). Marker stroke widths scale with `dpr` to stay visually constant.
- **putImageData ignores ctx.scale**: this is a classic Canvas footgun. Earlier I scaled the context with `setTransform(dpr,…)` and wrote a `W × H` ImageData — on Retina the image only filled the top-left quarter of the buffer. Fix is to write at physical resolution and never call `setTransform` for the gradient pass.
- **Inline OKLCH→sRGB math** in `src/lib/color/fast.ts` (Björn Ottosson's matrices) — ~5× faster than going through culori per pixel. Used in the sRGB path. P3 still falls back to culori.
- **rAF coalescing**: `$effect` schedules a `requestAnimationFrame(draw)` and cancels the previous handle. Without it, fast drag piles up renders.
- **Slider tracks**: gradient with 40 stops along the primary axis, OOG positions filled with `#0a0a0a` so the user sees achievable range at a glance. Thumb is a hollow circle (transparent fill, white stroke) sized to feel substantial.
- **Compact mode**: when the user collapses the picker section, SliceGraph hides the canvas + numeric input and shows just the slider in a flex row (3 sliders side by side). State held in ColorPicker.

---

## CurveEditor — what's tricky

- **Dynamic viewBox**: SVG width is tracked via ResizeObserver and the viewBox is set to actual pixel dimensions so the control-point circles stay round (no `preserveAspectRatio="none"` stretching them into ellipses).
- **SVG pattern id sanitization**: id `grid-Hue offset` (with a space) silently broke the `fill="url(#…)"` reference and made the Hue chart appear without grid. We now slugify the label (`label.toLowerCase().replace(/[^a-z0-9]+/g, '-')`).
- **Mirror range slider** is a custom widget (NOT `<input type="range">`):
  - Two parallel bars (10px tall) stacked with a 5px gap; container 25px
  - Each bar's gradient = `picker → rangeBounds extreme` (e.g., picker → black for Lightness top, picker → white for Lightness bottom; picker → grey vs picker → max-chroma for Saturation; picker → +180° vs picker → −180° for Hue)
  - Single thumb (26px hollow circle) positioned at `spread / maxSpread * 100%`
  - Thumb fill = the color at the thumb's position on the *top* gradient stops array (sampled by index)
  - Pointer events handled manually; the stops arrays are passed from CurvePanel
- **Handles only visible in `custom` preset**. Linear / ease-* / bell show just the curve and small filled endpoints (r=4).
- **Recommended preset chip** in two rows: one large "STANDARD · linear" (or "bell"/"linear") chip and a separate row of the others. Standards are:
  - Lightness: `linear` (OKLCH is perceptually uniform → linear gives even steps)
  - Saturation: `bell` (universal: peak chroma at middle, fade at extremes)
  - Hue offset: `linear`

---

## Harmonies

`harmonyOffsets()` returns hue offsets per harmony type (complementary = `[0, 180]`, triadic = `[0, 120, 240]`, etc.). `generateHarmonies()` builds N parallel palettes by re-running `generatePalette` with each offset as `hueShift`. The primary track (offset 0) is filtered out of HarmonyPicker since it duplicates the main palette already shown. Each harmony track now uses the full SwatchCell layout (hex/rgb/oklch + copy buttons + click-to-retarget).

---

## Export

Four formats, all derived from `store.swatches`:
- **CSS variables** — `--brand-50` style names via `stepName(i, total)`; Tailwind-like naming (50,100,…,900,950) when 10/11 steps, otherwise `01..NN`
- **Tailwind config** — `colors.brand.{50: '#…', …}` snippet
- **JSON** — raw `{ palette: { 50: {hex, oklch, inGamut}, … } }`
- **Figma tokens** — W3C Design Tokens Community Group format (`{ palette: { 50: { $type: 'color', $value: '#…' } } }`) — Tokens Studio Figma plugin imports this natively

Plus URL sharing: `palette → JSON → base64-url-safe → window.location.hash`. Hydrated on page load if hash present.

---

## Known gotchas / pitfalls for the next person

1. **Never read palette state inside a `$effect` that mutates palette** without `untrack()`. The store is a single big object reassigned via spread, so any read auto-subscribes.
2. **Atomic mutations matter**: `palette.setAnchorIdx(K); picker.setColor(swatch_K)` was the wrong order — replaced with `palette.pinAnchor(idx, color)` that sets `anchorIdx + anchor + baseHue` in one assignment.
3. **The chroma curve label is "Saturation"**: don't confuse the curve sample (0–1) with absolute chroma. Multiply by `maxChroma(L, H, gamut)` to get actual C. Tests/exports use absolute C.
4. **Bell preset y values exceed [0,1] if expressed as bezier controls** (`[0.5, 1, 0.5, 0]`) — bezier-easing rejects them. We hand-roll bell as `sin(π·t)` in `sampleCurve`.
5. **URL hydration may load stale state** from old sessions. The "Reset curves" button (next to "PALETTE CURVES" title) is the user's escape hatch.
6. **OKLCH hue is in degrees, not radians** in our code (consistent with CSS). Internal math converts when needed (e.g., `cos(h * π/180)` in `fast.ts`).
7. **Compact SliceGraph mode shares state** with the full version — same canvas refs would mount/unmount on toggle. The `bind:this={canvas}` still works because Svelte rebinds, but be careful adding effects that depend on canvas existence.

---

## Quick UX tour

- Top section (sticky): picker with swatch, OKLCH/HEX/gamut chips, collapse button, and 3 SliceGraphs (Lightness, Chroma, Hue). Each graph has gradient slider with OOG zones blacked out, palette steps shown as faint dots, hollow-circle marker.
- Curves section: 3 editors (Lightness, Saturation, Hue offset) with bezier curve + mirror range slider showing dual gradient bars from picker to bounds extremes.
- Generated palette: stepper (− 10 +) under the title. Grid of swatches, each cell has hex, rgb, oklch — all three are independent copy buttons. The closest match to the picker color is tagged "PICKER".
- Harmonies: segmented control (none/complementary/analogous/triadic/tetradic/split-complementary). Each non-primary track uses the full swatch cell style; clicking a harmony swatch retargets the picker (resets `anchorIdx`).
- Export: tabbed (CSS / Tailwind / JSON / Figma tokens) + name field. Copy buttons for the output and for a shareable URL.

---

## Open / nice-to-have

Stuff that's been mentioned but not built:
- **Accessibility (WCAG / APCA contrast)**: deliberately deferred per user. Would compute pairwise contrast ratios between palette steps and surface them as a column or matrix.
- **Lock mode for curves**: currently `syncFromPicker` rewrites the saturation curve range on every picker change. A "lock" toggle would freeze the curve so the user can edit freely after picking.
- **Better hue gamut visualization**: the gamut-aware chroma is solid, but the SliceGraph Hue panel only shows in-gamut areas — would be cool to overlay the achievable chroma envelope as a guide curve.
- **Multi-palette / collections**: currently one palette + N harmony tracks. No support for managing multiple named palettes side by side.
- **Keyboard a11y for the custom mirror slider**: pointer events only.

---

## When you sit down

1. `cd "OKLCH palette creator" && npm run dev -- --port 3737`
2. Open http://localhost:3737/
3. `npx svelte-check --tsconfig ./tsconfig.json` for typecheck
4. The user's preferred workflow: pick a color in the topbar, click a palette swatch to pin a specific step, tweak curves, export.
5. If the palette ever looks "broken", click **Reset curves** (top-right of PALETTE CURVES section) — most weird states come from stale URL hash from earlier sessions.

Good luck.

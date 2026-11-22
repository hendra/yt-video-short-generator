# Cerpenek Characters Redesign — Nusantara Figurine (Opsi C)

**Date:** 2026-11-21
**Status:** Approved

## Intent & Why

Cerpenek (`ops/accounts/cerpenek.md`) is an Indonesian children's storytelling channel (ages 5–10). The existing character prefabs in `src/engine/kit.ts` (`figure`, `animal`, `bird`, `swimmer`) had visual flaws and uneven quality:

- **`kerudung` looked like a helmet:** a detached top dome + two side ear-muff ovals + rigid cylinder left gaps around the face and read as headgear rather than draped cloth.
- **Unappealing mouth geometry:** a thick 3D brown `TorusGeometry` floating at `z = 0.97r` protruded like a handlebar/staple instead of sitting smoothly on the face.
- **Unpolished character family:** `figure` lacked a neck, had abrupt ball shoulders, sharp box shoes, and awkward child hair; `animal`, `bird`, and `swimmer` (`ikan`, `buaya`) looked like bare geometric primitives with tiny dot eyes and no two-tone markings, joints, or sculpted features.

The goal is to upgrade all four Cerpenek character prefabs to a cohesive, warm, child-friendly **Nusantara Figurine (Opsi C)** aesthetic while preserving backward-compatible APIs and keeping CPU (`--gl=swangle`) render cost low.

## Goals

- Replace the helmet-like `kerudung` with a layered, draped pashmina/bergo silhouette (inner *ciput* band, smooth head wrap, chin/neck wrap, diagonal chest fold, and back drape).
- Replace the protruding torus mouth with a smooth, surface-hugging smile curve (single `TubeGeometry` mesh for low draw-call cost) paired with a small button nose and softer eye/brow/blush proportions.
- Upgrade `kit.figure` to **Nusantara Figurine (Opsi C)** proportions across all variants (`age`: `"anak" | "dewasa" | "lansia"`; `headwear`: `"none" | "caping" | "mahkota" | "ikat" | "kerudung"`; `costume`: `"none" | "selempang" | "rompi"`), including:
  - Distinct **baju kurung / kain** continuous silhouette when wearing `kerudung`, and clean tapered torso, neck, collar, shoulders, and rounded shoes for other figures.
  - **Jambul Ceria** child hairstyle (`age === "anak"`, `headwear === "none"`): full smooth hair cap to the nape plus playful sculpted front/top cowlick tufts and small temple locks.
  - Refined `caping` (wide woven brim + ring sitting on an inner *kopiah* band), `ikat` (*udeng* with front fold, back knot, and tapered cloth tails), `mahkota` (tiered Nusantara crown with pointed rim and center gem), and `lansia` (*sanggul* bun + hairpin).
- Upgrade `kit.animal`, `kit.bird`, and `kit.swimmer` (`ikan`, `buaya`) to match **Nusantara Figurine (Opsi C)** with **Mata Kartun Ekspresif** (sclera + pupil + specular catchlight):
  - `animal`: sculpted neck, two-tone chest/belly, soft snout + nose + smile, two-tone inner/outer ears, curved buffalo horns (`horns: true`), wrap-hugging tiger stripes (`stripes: true`), legs with rounded hooves/paws, and a pivoted `tail` (with tuft when `tail === "panjang"`).
  - `bird`: plump teardrop body with cream breast, head crest tuft, rounded beak, layered wings, fanned tail feathers, and small feet/claws.
  - `swimmer`:
    - `ikan`: two-tone belly, pectoral side fins, dorsal fin, and forked tail fin.
    - `buaya`: friendly storybook crocodile with wide rounded snout, lower jaw, brow ridges with raised cartoon eyes, nostrils, tiny rounded side teeth, dorsal scutes, 4 stubby legs with webbed feet, and tapered tail.

## Non-Goals & Anti-Goals

- **Non-goals:** Changing non-Cerpenek mechanical/explainer builders (`worker`, `gear`, `tube`, `fan`, etc.); adding a separate `poseAnimal` choreography helper (beyond an optional `tail` pivot on `animal`); adding gender options to `FigureOpts`; changing `sample-karakter` into a production video.
- **Anti-goals:**
  - Breaking existing `FigureParts` (`root`, `torso`, `head`, `blink`, `armL`, `armR`, `legL`, `legR`), `bird` (`root`, `wingL`, `wingR`), `swimmer` (`root`, `tail`), or `animal` (`root`, `head`) return contracts.
  - Using high-segment meshes, environment maps, bump maps, or multi-mesh bead smiles that inflate `--gl=swangle` render time.
  - Letting `torso` rotation tilt the lower `kerudung` skirt from the ankles (`torso` pivot remains at waist height `y ≈ 0.35`).

## Constraints

- **CPU render performance (`--gl=swangle`):** Keep segment counts modest (≤ 24 radial segments on major body parts, ≤ 12 on small details; single `TubeGeometry` for the mouth curve instead of multiple spheres).
- **Determinism:** Pure construction and pure `poseFigure(fig, t, mode, seed)` function of `t` — zero `Math.random()` or `Date.now()`.
- **Existing tests & brief contracts:**
  - `scripts/kit.test.mts` asserts `poseFigure` preserves outward arm splay (`armL.rotation.z < 0`, `armR.rotation.z > 0` in `"sad"`, zero Y yaw in `"talk"`, `"wave"`, `"point"`, `"sad"`), deterministic poses, and `blink.children.length >= 4`.
  - `scripts/topics.test.mts` asserts `ops/accounts/cerpenek.md` still mentions `kit.figure(`, `kit.animal(`, `kit.bird(`, `kit.swimmer(`, `poseFigure(`, `` `armR`, `legL` ``, etc.

## Approaches Considered

1. **Approach 1 — In-place upgrade of `figure`, `animal`, `bird`, `swimmer` in `src/engine/kit.ts` (Selected):**
   - Directly replaces the geometry inside the existing 4 prefab methods and aligns `poseFigure` / `ops/accounts/cerpenek.md` / `scripts/kit.test.mts`.
   - *Pros:* Zero code duplication, backward-compatible signatures/return shapes, every future Cerpenek video automatically gets the polished characters.
   - *Cons:* Replaces the old wooden-toy shapes completely (acceptable because repo search confirms only Cerpenek uses these four prefabs).
2. **Approach 2 — Add parallel `cerpenekFigure` / `style` flag alongside legacy prefabs:**
   - Keeps legacy shapes intact and adds new builders or a `style` option.
   - *Rejected:* Leaves dead code and complicates `ops/accounts/cerpenek.md` with no other consumer needing the legacy style.

## Technical Design

### 1. Shared Face & Eye Helpers (`src/engine/kit.ts`)

- **`face(parent, c, r, o)`** (for `figure`):
  - Eyes (`eyesTo: blink`): sclera + pupil + specular catchlight dot, slightly softer proportions (`0.185r` sclera, `0.12r` pupil, `0.045r` dot; `1.05x` scale when `age === "anak"`).
  - Rounded brows (`CapsuleGeometry`) and soft rosy blush ovals (`#eba090`) for warm storybook look.
  - Small button nose (`SphereGeometry(r * 0.072)`) slightly tinted warmer (`#d99e74` or blended from `skin` — builder may use a clean warm nose tint or darkened `skin`).
  - **Mouth:** One `TubeGeometry` along a smooth 5-point `CatmullRomCurve3` smile arc seated at radius `~0.96r` across the lower face (tube radius `~0.014r`), dark warm brown `#7a3f32`, so it hugs the face curvature cleanly from front and side with 1 draw call.
- **`creatureEye(parent, pos, r)`** (for `animal`, `bird`, `swimmer`):
  - Cartoon eye (sclera + pupil + white catchlight dot) matching `figure`'s expressive style, oriented toward the creature's facing direction (+z on `animal`/`bird`/`buaya`, outward lateral + forward on `ikan`).

### 2. `Kit.figure(x, z, ry, o)` — Nusantara Figurine (Opsi C)

- **Scale:** `anak = 0.78`, `lansia = 0.95`, `dewasa = 1.0`.
- **Torso (`torso` pivot at `[0, 0.35, 0]` — waist height so `poseFigure`'s `torso.rotation.x` bends naturally at the waist):**
  - Tapered upper torso (`CylinderGeometry(0.13, 0.17, 0.36)`), rounded shoulders (`SphereGeometry`), visible neck (`CylinderGeometry` in `skin`), and clean collar torus (`#f5efe2`, omitted when `kerudung` covers the neck).
  - `costume`: `"selempang"` (diagonal sash + gold trim adjusted to slimmer `0.13..0.17` torso radius) and `"rompi"` (two front open-vest panels + gold trim adjusted to slimmer torso).
- **Lower Body & Limbs (`root` children):**
  - When `headwear === "kerudung"`: continuous tapered *kain/baju kurung* skirt (`CylinderGeometry` from `y = 0` to `y ≈ 0.39`, top radius matching the waist hem `~0.165` so `poseFigure`'s `torso.rotation.x` tilt bends cleanly inside/over the waist without clipping through the skirt rim) on `root`, plus `legL` / `legR` pivots kept inside/underneath so `poseFigure(..., "walk")` remains valid without visual clipping.
  - Otherwise: `legL` / `legR` (`CapsuleGeometry` pants + rounded `CapsuleGeometry` shoes) pivoted at `[±0.072, 0.34, 0]`.
  - `armL` / `armR` pivoted at `[±0.155, 0.7, 0]` with outward z-splay `±0.18` (tapered `CapsuleGeometry` sleeves + `SphereGeometry` hands).
  - `poseFigure` updated to reset `armL.rotation.z = -0.18` / `armR.rotation.z = 0.18` (and adjust `"walk"` swing around `±0.18`).
- **Head (`head` pivot at `[0, 0.91, 0]`, `r = 0.19` scaled `[0.96, 1.04, 0.98]`):**
  - `kerudung`: inner cream *ciput* forehead rim (`#efe6d6`), smooth outer wrap (`SphereGeometry` dome covering top/back/sides cleanly without ear-muff bumps), chin/neck wrap (`TorusGeometry` framing the lower face), diagonal pashmina chest fold on `torso`, and tapered back veil drape on `torso`.
  - Non-kerudung hair: full hair cap hugging crown + back down to nape (`SphereGeometry` cap + nape volume so zero bald gap from behind):
    - `age === "anak"`: **Jambul Ceria** (layered front hair sweep + 2 playful rounded cowlick tufts + neat temple locks).
    - `age === "dewasa"`: neat side-swept hair cap.
    - `age === "lansia"`: grey hair (`#d8d4ce`) with back *sanggul* bun + gold hairpin.
  - Other headwear:
    - `caping`: inner dark *kopiah* headband + wide low-pitched woven cone (`r ≈ 0.32`) with rim torus seated snugly on the head.
    - `ikat`: Nusantara *udeng* band + small front fold + back knot + two tapered cloth tails.
    - `mahkota`: flared gold crown band + base ring + 6 pointed crown tips + red front gem.

### 3. `Kit.animal`, `Kit.bird`, `Kit.swimmer`

- **`Kit.animal(x, z, ry, o)`** returns `{ root, head, tail }` (adding `tail` pivot cleanly extends the return type without breaking `{ root, head }` callers):
  - Body capsule + lighter two-tone underbelly + angled neck cylinder connecting body to head.
  - `stripes`: curved dark bands hugging the torso (`TorusGeometry` arcs) instead of protruding rings.
  - Legs: 4 capsule legs with rounded hooves (when `horns`) or paws.
  - Head (`head` pivot): rounded head + lighter muzzle + nose + subtle smile + `creatureEye` pair + two-tone ears (`runcing`, `panjang`, `bulat` with `#e8baa8` inner ear) + curved two-segment horns when `horns: true`.
  - Tail (`tail` pivot at rear): pivoted at hip so callers can wag `tail.rotation.y`/`z` if desired; tufted tip for `tail === "panjang"`, fluffy puff for `tail === "pendek"`.
- **`Kit.bird(x, y, z, ry, o)`** returns `{ root, wingL, wingR }`:
  - Teardrop body + cream breast patch + head + small crest tuft + rounded beak + `creatureEye` pair + layered wings on `wingL`/`wingR` pivots + 3-blade fanned tail + tiny orange legs/claws.
- **`Kit.swimmer(x, z, ry, o)`** returns `{ root, tail }`:
  - `ikan`: fish body + lighter belly + `creatureEye` pair + pectoral fins + dorsal fin + forked 2-paddle tail on `tail` pivot.
  - `buaya`: wide friendly rounded snout + cream lower jaw/belly + brow ridges with raised `creatureEye` pair + nostrils + 2 tiny rounded cheek teeth + 5 low spine scutes + 4 stubby splayed legs with webbed feet + tapered tail on `tail` pivot.

### 4. Documentation & Verification

- Update `ops/accounts/cerpenek.md` to describe the **Nusantara Figurine** look (while preserving all required literal tokens tested by `scripts/topics.test.mts`) and document optional `animal.tail` pivot.
- Update/extend `scripts/kit.test.mts` to verify:
  - All `figure` variants (`anak`, `dewasa`, `lansia`, all `headwear`, all `costume`) build cleanly with finite transforms and stay within triangle/mesh sanity bounds.
  - `poseFigure` keeps outward arm splay (`±0.18`) and purity of `t`.
  - `animal` (including `tail` pivot), `bird`, and `swimmer` (`ikan`, `buaya`) build cleanly with finite transforms.
- Visual check: render Remotion stills (`npx remotion bundle` + `npx remotion still` with `--gl=swangle` or local preview) of a temporary/sample showcase scene covering all human variants + animals + birds + swimmers and eyeball the rendered PNGs before finishing.

## Left to the Builder

- Exact vertex coordinates/curve control points for the `TubeGeometry` smile and `kerudung` drape so there is zero z-fighting or gap from front, 3/4, and side angles.
- Handling the pre-existing uncommitted `sample-karakter` entry in `src/videos/registry.ts` (decide during implementation/cleanup whether to update `sample-karakter` temporarily for visual verification stills and restore `registry.ts` clean before committing).

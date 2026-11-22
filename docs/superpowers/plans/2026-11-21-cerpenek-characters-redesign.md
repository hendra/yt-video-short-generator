# Cerpenek Characters Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade all four Cerpenek character prefabs (`figure`, `animal`, `bird`, `swimmer`) and `poseFigure` in `src/engine/kit.ts` to the cohesive Nusantara Figurine (Opsi C) aesthetic, update `ops/accounts/cerpenek.md`, and verify with unit tests, lint, and Remotion stills.

**Architecture:** Perform an in-place geometry and proportion upgrade inside `src/engine/kit.ts` while keeping all existing method signatures and return shapes backward-compatible (`animal` adds an optional `tail` pivot). Keep CPU `--gl=swangle` render cost bounded by using modest segment counts and a single `TubeGeometry` smile curve per figure instead of multiple beads.

**Tech Stack:** TypeScript, Three.js (`0.178.0`), Node test runner (`tsx --test`), Remotion CLI (`bundle` + `still`), ESLint + `tsc`.

**Spec:** `docs/superpowers/specs/2026-11-21-cerpenek-characters-redesign-design.md`

## Global Constraints

- **Determinism:** Pure functions of `t` and build parameters — zero `Math.random()` or `Date.now()`.
- **CPU (`--gl=swangle`) render budget:** Keep radial segments ≤ 24 on major meshes, ≤ 12 on small details; single `TubeGeometry` mesh for figure smile; no environment maps, bump maps, or post-processing.
- **API & brief compatibility:** Preserve `FigureParts` (`root`, `torso`, `head`, `blink`, `armL`, `armR`, `legL`, `legR`), `bird` (`root`, `wingL`, `wingR`), `swimmer` (`root`, `tail`), and `animal` (`root`, `head`, plus new `tail`); preserve all literal tokens in `ops/accounts/cerpenek.md` verified by `scripts/topics.test.mts`.
- **Static & test gates:** `npm run lint` (`eslint src && tsc && tsc -p scripts`) and `npm test` (`tsx --test scripts/*.test.mts`) must pass.

## Review Focus

- **`kerudung` waist overlap under `poseFigure` tilt:** When `torso.rotation.x` tilts (`"sad"` `+0.1`, `"walk"` `-0.05`), the `torso`-mounted top/pashmina drape must not poke outside or leave a gap above the `root`-mounted skirt rim (`y ≈ 0.35`, skirt top radius `~0.165` matching torso waist).
- **`poseFigure` arm splay parity:** `Kit.figure` builds arms at `±0.18`; `poseFigure` must reset `armL.rotation.z = -0.18` / `armR.rotation.z = 0.18` (and keep `armL.rotation.z < 0`, `armR.rotation.z > 0` in `"sad"`, zero Y yaw across `"talk"`, `"wave"`, `"point"`, `"sad"`).
- **`costume: "selempang" | "rompi"` fit on slimmer torso:** Sash and open-vest panels must hug the slimmer `0.13..0.17` torso without floating or clipping into the `kerudung` chest drape.
- **Single-mesh mouth curvature & segment budget:** `face()` must render the smile as one `TubeGeometry` arc seated flush on the face (`z ≈ 0.96r`) rather than multiple spheres or a protruding torus.
- **`ops/accounts/cerpenek.md` brief contract:** Editing the visual style text must keep every literal prefab/pose string asserted by `scripts/topics.test.mts`.

---

### Task 1: Upgrade `Kit.figure`, `face`, and `poseFigure` to Nusantara Figurine (Opsi C)

**Files:**
- Modify: `src/engine/kit.ts:289-408` (`face`, `figure`) and `src/engine/kit.ts:993-1054` (`poseFigure`)
- Test: `scripts/kit.test.mts:125-195`

**Interfaces:**
- Consumes: `Kit` private helpers (`part`, `pivot`, `mat`, `add`), `FigureOpts`, `FigureParts`, `PoseMode`, `sway` (`src/engine/math.ts`), `CatmullRomCurve3`, `TubeGeometry`, `CapsuleGeometry`, `ConeGeometry`, `CylinderGeometry`, `SphereGeometry`, `TorusGeometry`, `BoxGeometry`.
- Produces:
  - `Kit.prototype.figure(x: number, z: number, ry: number, o?: FigureOpts): FigureParts`
  - `poseFigure(fig: FigureParts, t: number, mode: PoseMode, seed?: number): void`

- [ ] **Step 1: Write the failing tests for Opsi C `figure` variants, waist pivot, costume fit, and `±0.18` arm splay**

Append a new `describe` block in `scripts/kit.test.mts` and update the splay expectation comment if needed (existing splay test only asserts `< 0` and `> 0` and `abs(y) < 1e-9`, plus add exact `±0.18` idle check):

```ts
describe("Opsi C figure polish", () => {
  test("all age, headwear, and costume combinations build with finite transforms and waist torso pivot", () => {
    const ages = ["anak", "dewasa", "lansia"] as const;
    const headwears = ["none", "caping", "mahkota", "ikat", "kerudung"] as const;
    const costumes = ["none", "selempang", "rompi"] as const;
    for (const age of ages) {
      for (const headwear of headwears) {
        for (const costume of costumes) {
          const root = new Group();
          const kit = new Kit(root);
          const f = kit.figure(0, 0, 0, { age, headwear, costume });
          assert.ok(f.torso.position.y >= 0.3, `torso pivot too low (${f.torso.position.y}) for ${age}/${headwear}`);
          assert.ok(f.blink.children.length >= 4, `missing blink eyes for ${age}/${headwear}`);
          assert.ok(Math.abs(f.armL.rotation.z + 0.18) < 1e-6 && Math.abs(f.armR.rotation.z - 0.18) < 1e-6);
          root.traverse((o) => {
            assert.ok(Number.isFinite(o.position.x + o.position.y + o.position.z));
            assert.ok(Number.isFinite(o.rotation.x + o.rotation.y + o.rotation.z));
          });
        }
      }
    }
  });

  test("kerudung skirt stays on root while torso tilts cleanly around waist", () => {
    const kit = new Kit(new Group());
    const f = kit.figure(0, 0, 0, { headwear: "kerudung", costume: "selempang" });
    poseFigure(f, 1, "sad", 1);
    assert.ok(f.torso.rotation.x > 0, "sad pose should tilt torso at waist");
    assert.equal(f.root.rotation.x, 0, "root must stay upright when torso tilts");
  });

  test("poseFigure resets idle arms to ±0.18 splay", () => {
    const kit = new Kit(new Group());
    const f = kit.figure(0, 0, 0);
    poseFigure(f, 0, "talk", 1);
    poseFigure(f, 0, "idle", 1);
    assert.ok(Math.abs(f.armL.rotation.z + 0.18) < 0.05);
    assert.ok(Math.abs(f.armR.rotation.z - 0.18) < 0.05);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx tsx --test scripts/kit.test.mts`
Expected: FAIL on `armL.rotation.z + 0.18` (currently `-0.22`).

- [ ] **Step 3: Implement `face`, `figure`, and `poseFigure` updates in `src/engine/kit.ts`**

Update `src/engine/kit.ts`:
- **`face(parent, c, r, o)`**:
  - Sclera (`r * 0.185`, scaled `1.05` when `o.blush` or child-sized), pupil (`r * 0.12`), white specular dot (`r * 0.045`), rounded `CapsuleGeometry` brows (`r * 0.02`, `r * 0.16`), soft blush (`#eba090`), small button nose (`SphereGeometry(r * 0.072)`, `#d99e74` at `[c[0], eyeY - r * 0.15, c[2] + r * 0.98]`).
  - Smile: single `TubeGeometry` along a 5-point `CatmullRomCurve3` arc across `u ∈ [-1, 1]` hugging `z = c[2] + Math.cos(ang) * r * 0.96`, `y = eyeY - r * 0.35 + u * u * r * 0.075`, `x = c[0] + Math.sin(ang) * r * 0.96`, `tubularSegments = 10`, `tubeR = r * 0.016`, `radialSegments = 6`, material `#7a3f32`.
- **`figure(x, z, ry, o)`**:
  - Scale `anak = 0.78`, `lansia = 0.95`, `dewasa = 1.0`.
  - `torso` pivot at `[0, 0.35, 0]`: upper tapered torso (`CylinderGeometry(0.13, 0.17, 0.36, 22)` shifted `y = 0.19`), rounded shoulder dome (`SphereGeometry(0.14, 18, 12)` at `y = 0.35`), hip transition sphere (`SphereGeometry(0.168, 18, 12)` at `y = 0.02`, `bottom` color — bridges waist cleanly inside `kerudung` skirt), `skin` neck (`CylinderGeometry(0.048, 0.06, 0.09, 14)` at `y = 0.41`), and collar torus (`#f5efe2` at `y = 0.38`, omitted when `headwear === "kerudung"`).
  - `costume`: `"selempang"` (diagonal sash + gold edge fitted to `z = 0.158` on the slimmer torso) and `"rompi"` (two vest panels + gold edge fitted at `x = ±0.075, z = 0.145`).
  - Lower body on `root`: `legL` / `legR` pivots at `[±0.072, 0.34, 0]` with `CapsuleGeometry` legs + `CapsuleGeometry` rounded shoes (`#4d3d36`). When `headwear === "kerudung"`, also add the tapered *kain/baju kurung* skirt (`CylinderGeometry(0.165, 0.215, 0.39, 22)` at `[0, 0.195, 0]`) directly on `root` (skirt top radius `0.165` wraps cleanly around `torso`'s `0.17` base so `torso.rotation.x` bends without rim clipping).
  - `armL` / `armR` pivots at `[±0.155, 0.7, 0]`, `rotation.z = sx * 0.18`, `CapsuleGeometry(0.042, 0.2, 6, 12)` sleeve + `SphereGeometry(0.046, 14, 10)` hand.
  - `head` pivot at `[0, 0.91, 0]`, `r = 0.19` (`SphereGeometry(r, 22, 16)` scaled `[0.96, 1.04, 0.98]`), `face(head, [0, 0, 0], r, { blush: true, brows: true, eyesTo: blink, child: age === "anak" })`.
  - `kerudung`: inner cream *ciput* (`#efe6d6`), smooth outer wrap (`SphereGeometry` covering top/back/sides cleanly), lower chin/neck wrap (`TorusGeometry`), diagonal pashmina fold on `torso` (`y = 0.26` relative to waist pivot), and back veil cone on `torso` (`y = 0.22, z = -0.06`).
  - Non-kerudung hair: full hair cap + nape hair sphere (`[0, -0.07, -0.085]`):
    - `age === "anak"`: **Jambul Ceria** (front sweep + 2 sculpted top cowlick tufts + small temple locks).
    - `age === "dewasa"`: neat side-swept hair.
    - `age === "lansia"`: `#d8d4ce` grey hair + back *sanggul* bun + gold hairpin.
  - `caping`: dark *kopiah* headband + wide low woven cone (`r = 0.32, h = 0.145`) + outer rim torus.
  - `ikat`: Nusantara *udeng* band + front fold + back knot + two tapered `CapsuleGeometry` tails.
  - `mahkota`: flared gold crown + base ring + 6 pointed `ConeGeometry` tips + red center gem.
- **`poseFigure(fig, t, mode, seed)`**:
  - Reset `armL.rotation.z = -0.18`, `armR.rotation.z = 0.18`, and update `"walk"` / `"idle"` arm swing bases from `±0.22` to `±0.18`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --test scripts/kit.test.mts`
Expected: PASS (all existing and new `figure` / `poseFigure` tests pass).

- [ ] **Step 5: Commit**

```bash
git add src/engine/kit.ts scripts/kit.test.mts
git commit -m "feat(kit): redesign figure and poseFigure in Nusantara Figurine style"
```

---

### Task 2: Upgrade `Kit.animal`, `Kit.bird`, and `Kit.swimmer` with `creatureEye` + Opsi C Polish

**Files:**
- Modify: `src/engine/kit.ts:282-287` (`eyes` → `creatureEye`) and `src/engine/kit.ts:703-789` (`animal`, `bird`, `swimmer`)
- Test: `scripts/kit.test.mts`

**Interfaces:**
- Consumes: `Kit` private helpers (`part`, `pivot`, `mat`, `add`), `AnimalOpts`, `Vec3`.
- Produces:
  - `Kit.prototype.animal(x: number, z: number, ry: number, o?: AnimalOpts): { root: Group; head: Group; tail: Group }`
  - `Kit.prototype.bird(x: number, y: number, z: number, ry: number, o?: { s?: number; color?: string }): { root: Group; wingL: Group; wingR: Group }`
  - `Kit.prototype.swimmer(x: number, z: number, ry: number, o?: { s?: number; color?: string; kind?: "ikan" | "buaya" }): { root: Group; tail: Group }`

- [ ] **Step 1: Write the failing tests for `animal` (`tail` pivot & options), `bird`, `swimmer` (`ikan` & `buaya`), and triangle budget**

Append to `scripts/kit.test.mts`:

```ts
describe("Opsi C creatures (animal, bird, swimmer)", () => {
  test("animal exposes head and tail pivots and builds all ear/horn/stripe/tail variants cleanly", () => {
    const configs = [
      { s: 1.8, color: "#5c5650", horns: true, tail: "panjang" as const },
      { s: 1.4, color: "#e08a2e", tail: "panjang" as const, stripes: true },
      { s: 0.9, color: "#b98a5a", ears: "runcing" as const },
      { s: 1.0, color: "#e8dfd5", ears: "panjang" as const, tail: "pendek" as const },
    ];
    for (const o of configs) {
      const root = new Group();
      const kit = new Kit(root);
      const a = kit.animal(0, 0, 0, o);
      assert.ok(isGroup(a.root) && isGroup(a.head) && isGroup(a.tail));
      assert.ok(a.tail.children.length >= 1, "animal tail pivot must hold tail geometry");
      root.traverse((obj) => {
        assert.ok(Number.isFinite(obj.position.x + obj.position.y + obj.position.z));
        assert.ok(Number.isFinite(obj.rotation.x + obj.rotation.y + obj.rotation.z));
      });
    }
  });

  test("bird and swimmers (ikan, buaya) build multi-part geometry with finite transforms inside CPU triangle budget", () => {
    const root = new Group();
    const kit = new Kit(root);
    const b = kit.bird(0, 1, 0, 0, { s: 1.2 });
    const f = kit.swimmer(0, 0, 0, { kind: "ikan" });
    const c = kit.swimmer(1, 0, 0, { kind: "buaya" });
    kit.animal(-1, 0, 0, { horns: true, stripes: true, tail: "panjang" });
    assert.ok(isGroup(b.wingL) && isGroup(b.wingR));
    assert.ok(isGroup(f.tail) && isGroup(c.tail));
    let tris = 0;
    root.traverse((o) => {
      assert.ok(Number.isFinite(o.position.x + o.position.y + o.position.z));
      const g = (o as Mesh).geometry as { index?: { count: number } | null; attributes?: { position?: { count: number } } } | undefined;
      if (!g?.attributes?.position) return;
      tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    });
    assert.ok(tris < 25000, `creatures use ${tris} triangles, budget is 25000`);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx tsx --test scripts/kit.test.mts`
Expected: FAIL because `a.tail` is undefined (`Kit.animal` currently returns `{ root, head }`).

- [ ] **Step 3: Implement `creatureEye`, `animal`, `bird`, and `swimmer` in `src/engine/kit.ts`**

Update `src/engine/kit.ts`:
- Replace `eyes()` with `creatureEye(parent: Object3D, pos: Vec3, r: number, sxSign = 1)` building cartoon eyes (sclera + pupil + white catchlight dot).
- **`animal(x, z, ry, o)`**:
  - Two-tone body + cream/tan belly patch + angled neck cylinder connecting body to `head`.
  - When `stripes`: 3 curved dark `TorusGeometry` bands hugging the torso.
  - 4 capsule legs with rounded hooves (`horns`) or paws.
  - `head` pivot: rounded head + lighter muzzle + nose + small curved smile + `creatureEye` pair + two-tone ears (`runcing`, `panjang`, `bulat` with `#e8baa8` inner ear) + curved two-segment horns when `horns: true`.
  - `tail` pivot at `[0, 0.34, -0.28]`: `panjang` capsule + tufted tip, or `pendek` fluffy puff; return `{ root, head, tail }`.
- **`bird(x, y, z, ry, o)`**:
  - Plump teardrop body + `#fff9ef` breast patch + head + small crest tuft + rounded beak + `creatureEye` pair + layered wings on `wingL` / `wingR` pivots + 3-blade fanned tail + tiny orange legs/claws.
- **`swimmer(x, z, ry, o)`**:
  - `ikan`: fish body + `#ffe3b8` belly + `creatureEye` pair + pectoral side fins + dorsal fin + forked 2-paddle tail on `tail` pivot.
  - `buaya`: wide rounded snout + cream lower jaw & belly + raised brow ridges with `creatureEye` pair + nostrils + 2 tiny rounded cheek teeth + 5 low spine scutes + 4 stubby splayed legs with webbed feet + tapered tail on `tail` pivot.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --test scripts/kit.test.mts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/kit.ts scripts/kit.test.mts
git commit -m "feat(kit): polish animal, bird, and swimmer prefabs with cartoon eyes"
```

---

### Task 3: Update `ops/accounts/cerpenek.md`, Run Full Checks, and Eyeball Remotion Stills

**Files:**
- Modify: `ops/accounts/cerpenek.md:68-109`
- Verify: `scripts/topics.test.mts`, `npm run lint`, `npm test`, and Remotion still renders

**Interfaces:**
- Consumes: `Kit` prefabs (`figure`, `animal`, `bird`, `swimmer`), `poseFigure`, `scripts/topics.test.mts` literal checks.
- Produces: Updated `ops/accounts/cerpenek.md` documenting Nusantara Figurine look and optional `animal.tail` pivot, plus verified stills.

- [ ] **Step 1: Update `ops/accounts/cerpenek.md`**

In `ops/accounts/cerpenek.md` (lines 68–109):
- Update the style summary from `"diorama mainan kayu ... tokoh seperti boneka kayu"` to describe the **diorama mainan *Nusantara Figurine*** look (warm, rounded, expressive cartoon eyes, draped kerudung/pashmina, smooth smile).
- Add `animal.tail.rotation.y = Math.sin(t * 4) * 0.3;` example in the movement snippet while keeping every required literal token tested by `scripts/topics.test.mts` (`kit.figure(`, `kit.island(`, `kit.palm(`, `kit.boat(`, `kit.mountain(`, `kit.hut(`, `kit.animal(`, `kit.bird(`, `kit.swimmer(`, `poseFigure(`, `kit.cloud(`, `kit.prop(`, `kit.ripple(`, `` `armR`, `legL` ``, `anak.legL.rotation.x`, `tanpa \`callouts\``).

- [ ] **Step 2: Run full lint and test suite**

Run: `npm run lint && npm test`
Expected: Exit 0 with all tests passing (including `scripts/kit.test.mts` and `scripts/topics.test.mts`).

- [ ] **Step 3: Render Remotion stills covering all redesigned characters and eyeball them**

Use a temporary showcase (either updating the existing untracked `src/videos/sample-karakter/` temporarily or a short temporary test composition, ensuring `src/videos/registry.ts` is restored cleanly afterward if needed — note the pre-existing `sample-karakter` edit in `registry.ts`, check `git status` before and after):
1. Bundle: `npx remotion bundle --out-dir /tmp/opencode/rbundle`
2. Render stills (`--gl=swangle` or default): e.g. `npx remotion still /tmp/opencode/rbundle <id> /tmp/opencode/cerpenek-human.jpg --frame=15` and creatures frame.
3. Inspect the rendered `.jpg` images with the `read` tool to confirm:
   - `kerudung` reads cleanly as draped cloth (no helmet look)
   - `figure` smile hugs the face cleanly, child `Jambul Ceria` hair looks natural, `caping`/`ikat`/`mahkota`/`lansia` sit properly
   - `poseFigure` poses (`talk`, `walk`, `sad`, `wave`) have zero waist/skirt clipping
   - `animal` (kerbau, harimau, kancil), `bird`, `ikan`, and `buaya` all render cleanly with cartoon eyes and crisp silhouettes.

- [ ] **Step 4: Commit `ops/accounts/cerpenek.md`**

```bash
git add ops/accounts/cerpenek.md
git commit -m "docs(cerpenek): update character style brief to Nusantara Figurine"
```

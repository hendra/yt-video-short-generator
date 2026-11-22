# Mandor Bangunan Channel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the 6th channel account `mandor-bangunan` (construction, buildings, bridges, infrastructure, and civil engineering) matching `kali-aja`'s 3D `"cream"` diorama engine, script rules, and Gemini voice, with a researched popular-construction topic backlog.

**Architecture:** Register `mandor-bangunan` in `src/accounts.ts` with `TODO_` Buffer placeholders (including `instagramChannelId`), add its brief (`ops/accounts/mandor-bangunan.md`) and researched topic backlog (`ops/topics/mandor-bangunan.md`), wire a construction-tuned `MANDOR_BANGUNAN` pool in `scripts/pick-format.mts`, reuse `kali-aja`'s three music moods (`teknik`, `misteri`, `fenomena`) in `public/mandor-bangunan/music/`, and enforce 3D/`"cream"` conformance via `mandorBangunanVideoProblems` in `scripts/account-core.mts` + `scripts/account-gate.mts`.

**Tech Stack:** TypeScript, Node `node:test`, Remotion + Three.js (`Kit` 3D engine), Gemini 3.8 Flash TTS (`id-id-podcaster-1`).

**Spec:** `docs/superpowers/specs/2026-11-22-mandor-bangunan-channel-design.md`

## Global Constraints

- Content language: Indonesian (santai-profesional), numbers spelled out in words.
- Script length: 10–14 lines (`NN  text`), ≤ 130 words, 45–55 s duration, loop ending connecting grammatically to line 01, no CTA, `config.json` `tail ≤ 0.3 s`.
- Visual mode & voice: 3D (`world.ts`) with default `"cream"` theme (no custom theme), Gemini voice `id-id-podcaster-1` with style `"natural, warm, conversational"`.
- Platforms: YouTube (`categoryId: "27"`, `madeForKids: false`), TikTok, and Instagram Reels (`instagramCaption` required, ≤ 2,200 chars, no `#shorts`/`#short`/`#fyp`).
- Buffer IDs stay `TODO_` placeholders; `ops/cloudflare-cron/wrangler.toml` MUST NOT include `mandor-bangunan` yet.
- TypeScript snippets in `ops/accounts/mandor-bangunan.md` must pass `topics.test.mts` copy-paste safety checks (`noUnusedLocals` + engine export checks).
- Verification: `npm run lint` (`eslint src && tsc && tsc -p scripts`) and `npm test` must pass.

## Review Focus

- `mandor-bangunan` video sets an explicit off-brand `theme` (e.g. `"blueprint"`, `"dark-tech"`, `"upwayyy"`) → `mandorBangunanVideoProblems` strips comments and rejects any `theme` other than `"cream"` (while allowing omitted `theme`).
- `mandor-bangunan` video sets `mode: "motion"` or `mode: "footage"` or lacks `world.ts` → `mandorBangunanVideoProblems` rejects it.
- `publish.json` for `mandor-bangunan` omits `instagramCaption` or includes `#shorts`/`#fyp` → `instagramCaptionProblems` rejects it.
- `config.json` for `mandor-bangunan` uses a mood from another account (e.g. `"rakit"` or `"build"`) → `resolveMusicTrack` and `accountMusicProblems` reject it naming `teknik, misteri, fenomena`.
- `ops/accounts/mandor-bangunan.md` snippets declare unused locals or omit `beat(t, L(` / `pulse(t, L(` → `scripts/topics.test.mts` catches it before CI.

---

### Task 1: Channel brief, researched topic backlog, and brief/backlog tests

**Files:**
- Create: `ops/accounts/mandor-bangunan.md`
- Create: `ops/topics/mandor-bangunan.md`
- Modify: `scripts/topics.test.mts`

**Interfaces:**
- Produces: `ops/accounts/mandor-bangunan.md` (referenced by `ACCOUNTS["mandor-bangunan"].agent.files`) and `ops/topics/mandor-bangunan.md` (≥ 30 researched entries with verified `https://` URLs and categories `Gedung | Jembatan | Infrastruktur | Pondasi | Terowongan & Bendungan`).

- [ ] **Step 1: Write failing tests for `mandor-bangunan` brief and backlog in `scripts/topics.test.mts`**

Add tests checking:
- `ops/accounts/mandor-bangunan.md` exists and contains required headings: `## Brand`, `## Suara`, `## Format`, `## Topik`, `## Riset`, `## Naskah`, `## Scene 3D`, `## Batas isi`, `## Musik latar`, `## publish.json`, `## Refill backlog`.
- Brief pins `brand: { prefix: "Mandor ", accent: "Bangunan" },`, `"account": "mandor-bangunan"`, `npm run tts -- <slug> --account mandor-bangunan`, `pick-format.mts --account mandor-bangunan`, loop ending without CTA, `tail` ≤ 0,3, and moods `"teknik"`, `"misteri"`, `"fenomena"`.
- Include `"ops/accounts/mandor-bangunan.md"` in the existing `briefs teach line-beat choreography` 3D list (`beat(t, L(`, `pulse(t, L(`, `kit.tube(`, `kit.gear(`, `kit.flowDots(`, `kit.cutaway(`, `kit.glowMat(`) and in both `brief TypeScript snippets are copy-paste safe` file arrays.
- `ops/topics/mandor-bangunan.md` exists, has ≥ 30 entries matching `/^- [a-z0-9]+(?:-[a-z0-9]+)*: .+ — https:\/\/\S+ \((Gedung|Jembatan|Infrastruktur|Pondasi|Terowongan & Bendungan)\)$/`, no malformed `- ` lines, unique slugs, unique source URLs, and at least one entry per category.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test scripts/topics.test.mts`
Expected: FAIL with missing `ops/accounts/mandor-bangunan.md` and `ops/topics/mandor-bangunan.md`.

- [ ] **Step 3: Research and verify ≥ 30 popular construction/civil-engineering source URLs**

Use web search / `webfetch` to verify ≥ 30 reachable `https://` engineering reference URLs covering all 5 categories (`Gedung`, `Jembatan`, `Infrastruktur`, `Pondasi`, `Terowongan & Bendungan`) inspired by high-viewership construction explainer topics (e.g., tuned mass damper, seismic base isolation, caisson foundations, cofferdams, tunnel boring machines, immersed tubes, prestressed concrete, tower cranes, suspension & cable-stayed bridges, expansion joints, concrete dams & spillways, gabions/retaining walls, asphalt vs concrete pavements, pile foundations, diaphragm walls, launching gantries, etc.). Confirm each URL returns HTTP 200 content describing real specs/mechanisms.

- [ ] **Step 4: Create `ops/accounts/mandor-bangunan.md` and `ops/topics/mandor-bangunan.md`**

- `ops/accounts/mandor-bangunan.md`: mirror `docs/AUTOPILOT.md`'s 3D `"cream"` scene rules, script rules (10–14 lines, ≤ 130 words, 45–55 s, 4-beat retention arc, ending loop without CTA, `tail ≤ 0.3 s`), `id-id-podcaster-1` voice (`--account mandor-bangunan`), music moods (`teknik`, `misteri`, `fenomena`, volume `0.14`), and `publish.json` rules (including `instagramCaption`), adapted to construction/civil engineering and backlog selection from `ops/topics/mandor-bangunan.md` instead of daily Indonesian news. Ensure every ```ts snippet uses every declared `const` and only valid engine exports.
- `ops/topics/mandor-bangunan.md`: write the ≥ 30 verified construction entries grouped by category, plus a short refill rule explaining periodic research of top-viewed construction videos.

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --import tsx --test scripts/topics.test.mts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add ops/accounts/mandor-bangunan.md ops/topics/mandor-bangunan.md scripts/topics.test.mts
git commit -m "feat(mandor-bangunan): add channel brief and researched topic backlog"
```

---

### Task 2: Register `mandor-bangunan` in `src/accounts.ts`

**Files:**
- Modify: `src/accounts.ts:12-140`
- Test: `scripts/accounts.test.mts`

**Interfaces:**
- Consumes: `ops/accounts/mandor-bangunan.md`, `ops/topics/mandor-bangunan.md` (from Task 1).
- Produces: `AccountId` including `"mandor-bangunan"`, `ACCOUNT_IDS` including `"mandor-bangunan"`, `ACCOUNTS["mandor-bangunan"]` with `TODO_` Buffer placeholders (`orgId`, `youtubeChannelId`, `tiktokChannelId`, `instagramChannelId`).

- [ ] **Step 1: Write the failing test in `scripts/accounts.test.mts`**

Update `"holds exactly the five known accounts..."` → six known accounts (`["kali-aja", "ai-labs", "cerpenek", "sastra-mesin", "upwayyy", "mandor-bangunan"]`), and add test `"Mandor Bangunan has its own identity with placeholder Buffer ids"` asserting:
- `label === "Mandor Bangunan"`
- `brand` is `{ prefix: "Mandor ", accent: "Bangunan" }`
- `youtubeCategoryId === "27"`, `madeForKids === false`
- `tts` is `{ voice: "id-id-podcaster-1", style: "natural, warm, conversational" }`
- `agent.model === "opencode/deepseek-v4.1-flash-free"`
- `agent.files` is `["AGENTS.md", "ops/ci-prompt.md", "ops/accounts/mandor-bangunan.md", "ops/topics/mandor-bangunan.md"]`
- `agent.prompt` mentions `ops/accounts/mandor-bangunan.md`, `ops/topics/mandor-bangunan.md`, `override ops/ci-prompt.md`, and `docs/AUTOPILOT.md does NOT apply`
- `isConfigured(ACCOUNTS["mandor-bangunan"]) === false` and `missingConfigFields(ACCOUNTS["mandor-bangunan"])` equals `["buffer.orgId", "buffer.youtubeChannelId", "buffer.tiktokChannelId", "buffer.instagramChannelId"]`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test scripts/accounts.test.mts`
Expected: FAIL (`ACCOUNT_IDS` missing `"mandor-bangunan"` and `ACCOUNTS["mandor-bangunan"]` undefined).

- [ ] **Step 3: Add `"mandor-bangunan"` to `src/accounts.ts`**

Extend `AccountId`, `ACCOUNT_IDS`, and `ACCOUNTS` in `src/accounts.ts` with the exact config from the spec (`TODO_MANDOR_*` placeholders for all four Buffer fields).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test scripts/accounts.test.mts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/accounts.ts scripts/accounts.test.mts
git commit -m "feat(mandor-bangunan): register account in src/accounts.ts"
```

---

### Task 3: Add `MANDOR_BANGUNAN` format pool in `scripts/pick-format.mts`

**Files:**
- Modify: `scripts/pick-format.mts:87-94`
- Test: `scripts/pick-format.test.mts`

**Interfaces:**
- Consumes: `AccountId` from `src/accounts.ts` (Task 2).
- Produces: `FORMATS_BY_ACCOUNT["mandor-bangunan"]` (`MANDOR_BANGUNAN` pool of 7 construction-explainer formats with loop-ending instructions and no CTA).

- [ ] **Step 1: Write the failing test in `scripts/pick-format.test.mts`**

Add `describe("Mandor Bangunan pool", ...)` asserting:
- `formatsFor("mandor-bangunan").map((f) => f.id)` equals `["bedah-struktur", "cara-bangun", "mitos-konstruksi", "misteri-teknik", "sebelum-sesudah", "tantangan-lapangan", "duel-material"]`
- Weights equal `[3, 3, 2, 2, 2, 1, 1]`
- Every format's `instruction` mentions `loop` and does not require a `CTA`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test scripts/pick-format.test.mts`
Expected: FAIL (`TypeError` / missing `"mandor-bangunan"` entry in `FORMATS_BY_ACCOUNT`).

- [ ] **Step 3: Add `MANDOR_BANGUNAN` to `scripts/pick-format.mts`**

Define `const MANDOR_BANGUNAN: Format[]` with the 7 construction-focused formats (each ending on a loop line connecting grammatically back to line 01, no CTA) and register `"mandor-bangunan": MANDOR_BANGUNAN` in `FORMATS_BY_ACCOUNT`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test scripts/pick-format.test.mts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/pick-format.mts scripts/pick-format.test.mts
git commit -m "feat(mandor-bangunan): add construction narrative format pool"
```

---

### Task 4: Add `mandor-bangunan` music moods and tracks

**Files:**
- Modify: `scripts/music.mts:18-24`
- Create: `public/mandor-bangunan/music/teknik.mp3`
- Create: `public/mandor-bangunan/music/misteri.mp3`
- Create: `public/mandor-bangunan/music/fenomena.mp3`
- Test: `scripts/music.test.mts`

**Interfaces:**
- Consumes: `AccountId` from `src/accounts.ts` (Task 2), `public/kali-aja/music/{teknik,misteri,fenomena}.mp3`.
- Produces: `MOODS_BY_ACCOUNT["mandor-bangunan"] = ["teknik", "misteri", "fenomena"]` and committed MP3 files in `public/mandor-bangunan/music/`.

- [ ] **Step 1: Write the failing test in `scripts/music.test.mts`**

Add assertion in `rejects unknown, empty, or cross-channel mood strings` for `resolveMusicTrack("build", "mandor-bangunan", "/tmp/m", () => true)` throwing `/teknik, misteri, fenomena/`, and assert the real files exist at `musicDirFor("mandor-bangunan")` for `teknik`, `misteri`, and `fenomena`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test scripts/music.test.mts`
Expected: FAIL (`MOODS_BY_ACCOUNT["mandor-bangunan"]` is undefined and MP3 files do not exist).

- [ ] **Step 3: Add `"mandor-bangunan"` moods to `scripts/music.mts` and copy MP3 tracks**

Add `"mandor-bangunan": ["teknik", "misteri", "fenomena"]` to `MOODS_BY_ACCOUNT` in `scripts/music.mts`, and copy `public/kali-aja/music/{teknik,misteri,fenomena}.mp3` to `public/mandor-bangunan/music/`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test scripts/music.test.mts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/music.mts scripts/music.test.mts public/mandor-bangunan/music/
git commit -m "feat(mandor-bangunan): add music moods and tracks"
```

---

### Task 5: Account gate (`mandorBangunanVideoProblems`) and duplicate stopwords

**Files:**
- Modify: `scripts/account-core.mts`
- Modify: `scripts/account-gate.mts`
- Modify: `scripts/duplicate-core.mts:25-31`
- Test: `scripts/account-core.test.mts`

**Interfaces:**
- Produces: `export const mandorBangunanVideoProblems = (opts: { indexSource: string; hasWorldFile: boolean }): string[]` in `scripts/account-core.mts`.

- [ ] **Step 1: Write failing tests in `scripts/account-core.test.mts`**

Add `describe("mandorBangunanVideoProblems", ...)` covering Review Focus items:
- Accepts valid 3D `index.ts` (omitted `theme`, or explicit `theme: "cream"`, and commented-out `// theme: "blueprint"`) with `hasWorldFile: true`.
- Rejects `mode: "motion"`, `mode: "footage"`, `hasWorldFile: false`, and explicit non-cream `theme` (`"blueprint"`, `"dark-tech"`, `"upwayyy"`).
- Also add `"mandor-bangunan"` mood checks in `accountMusicProblems` (`["teknik", "misteri", "fenomena"]`) and IG caption checks in `instagramCaptionProblems` (`ACCOUNTS["mandor-bangunan"]`).

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test scripts/account-core.test.mts`
Expected: FAIL (`mandorBangunanVideoProblems` is not exported).

- [ ] **Step 3: Implement `mandorBangunanVideoProblems`, wire `account-gate.mts`, and add `"mandor"` stopword**

- In `scripts/account-core.mts`: implement `mandorBangunanVideoProblems({ indexSource, hasWorldFile })` stripping JS/TS comments, rejecting `mode: "motion"` / `mode: "footage"` / `!hasWorldFile`, and rejecting any `theme` property whose string literal is not `"cream"`.
- In `scripts/account-gate.mts`: import `mandorBangunanVideoProblems` and run it when `account.id === "mandor-bangunan"`.
- In `scripts/duplicate-core.mts`: add `"mandor"` to `STOP` (do not add `"bangunan"`, which distinguishes building topics).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test scripts/account-core.test.mts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/account-core.mts scripts/account-gate.mts scripts/duplicate-core.mts scripts/account-core.test.mts
git commit -m "feat(mandor-bangunan): enforce 3D cream gate and brand stopword"
```

---

### Task 6: CI prompt, workflow input, and documentation updates

**Files:**
- Modify: `ops/ci-prompt.md`
- Modify: `.github/workflows/video.yml:17-21`
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `ops/README.md`
- Modify: `docs/PUBLISHING.md`

**Interfaces:**
- Consumes: `mandor-bangunan` account, brief, backlog, and gate (Tasks 1–5).

- [ ] **Step 1: Update `ops/ci-prompt.md` and `.github/workflows/video.yml`**

- In `ops/ci-prompt.md`: add `mandor-bangunan` (`ops/accounts/mandor-bangunan.md` + `ops/topics/mandor-bangunan.md`) to the per-account instruction list, 3D channels list, script length note (10–14 lines, ≤ 130 words per brief), and Instagram-enabled accounts list.
- In `.github/workflows/video.yml`: update `inputs.account.description` to `(kali-aja | ai-labs | cerpenek | sastra-mesin | upwayyy | mandor-bangunan)`.
- Leave `ops/cloudflare-cron/wrangler.toml` untouched (must not schedule before Buffer IDs + GitHub Environment are configured).

- [ ] **Step 2: Update `AGENTS.md`, `README.md`, `ops/README.md`, and `docs/PUBLISHING.md`**

Document `mandor-bangunan` as the 6th channel (same 3D `"cream"` engine & `id-id-podcaster-1` voice as `kali-aja`, YouTube + TikTok + Instagram Reels, `TODO_` placeholders until connected, and activation checklist before adding to `wrangler.toml`).

- [ ] **Step 3: Run full verification suite**

Run: `npm run lint && npm test`
Expected: `eslint src && tsc && tsc -p scripts` exits 0; all `node:test` suites pass.

- [ ] **Step 4: Commit**

```bash
git add ops/ci-prompt.md .github/workflows/video.yml AGENTS.md README.md ops/README.md docs/PUBLISHING.md
git commit -m "docs(mandor-bangunan): wire CI prompt, workflow input, and channel docs"
```

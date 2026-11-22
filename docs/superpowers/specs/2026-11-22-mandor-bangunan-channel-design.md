# Mandor Bangunan — channel design

**Date:** 2026-11-22
**Scope:** Project — 6th channel account (`mandor-bangunan`) reusing `kali-aja`'s 3D diorama engine, `"cream"` theme, script rules, and Gemini voice, plus a curated popular-construction topic backlog.

## Intent & why

Add **Mandor Bangunan**, a dedicated vertical Shorts channel (YouTube Shorts, TikTok, and Instagram Reels) focused on **construction, buildings, bridges, infrastructure, and civil engineering projects**. Topics are curated periodically from research on the highest-viewed construction videos/topics and stored in a backlog with verified source URLs, then turned into detailed Indonesian 3D cutaway animations and engaging scripts by the existing CI pipeline.

Why a separate channel: `kali-aja` covers general trending Indonesian science/tech news (only occasionally touching infrastructure), while `sastra-mesin` explicitly forbids heavy construction, buildings, and civil engineering megaprojects. `mandor-bangunan` owns that construction/civil-engineering niche cleanly with its own audience and Buffer channels.

## Goals

- Register `mandor-bangunan` as a first-class account in `src/accounts.ts`, scoped through the existing CI pipeline (`cron → build → render → publish`) with `TODO_` Buffer placeholders until channels are connected.
- Match `kali-aja`'s visual look, animation quality, script structure, and voice: 3D cutaway dioramas in `Kit`, default `"cream"` overlay theme, line-beat choreography (`L(n)`), 10–14 lines (≤ 130 words, 45–55 s, loop ending without CTA, `tail ≤ 0.3 s`), and Gemini 3.8 Flash TTS (`id-id-podcaster-1`, `"natural, warm, conversational"`).
- Support YouTube, TikTok, and Instagram Reels publishing via `publish.json` (including `instagramCaption` validation).
- Provide a dedicated brief (`ops/accounts/mandor-bangunan.md`), construction-oriented narrative format pool (`scripts/pick-format.mts`), background music tracks (`public/mandor-bangunan/music/`), and an initial researched backlog (`ops/topics/mandor-bangunan.md`) of popular construction/civil-engineering topics with verified `https://` sources.

## Non-goals

- Creating a new overlay theme (reuse `"cream"`, `kali-aja`'s default 3D theme).
- Creating a new render mode (`mode: "motion"` or `mode: "footage"`), new `Kit` prefabs, or new engine components.
- Live YouTube/TikTok trending scraping inside CI (`websearch` is unavailable in CI; topic research happens periodically offline/via PR into `ops/topics/mandor-bangunan.md`).
- Adding `mandor-bangunan` to `ops/cloudflare-cron/wrangler.toml` before Buffer IDs and the GitHub Environment are configured.

## Anti-goals

- Letting `mandor-bangunan` drift into `mode: "motion"`, `mode: "footage"`, or another channel's overlay theme (`"blueprint"`, `"dark-tech"`, `"upwayyy"`).
- Invented engineering specs, depths, loads, or costs not found in the fetched source URL.
- Non-construction topics (pure gadget reviews, software/AI tutorials, fairy tales, gaming lore).
- Tragedies/fatalities, partisan politics, or unverified disaster rumours.
- Reusing `kali-aja`'s `"1–3 days recent Indonesian news"` requirement — construction topics come from the curated high-interest backlog (global or Indonesian projects/structures), not daily news.

## Constraints (from the repo)

- Account config single source of truth in `src/accounts.ts`; `missingConfigFields` / `--require-configured` blocks publishing while Buffer IDs hold `TODO_` placeholders.
- FPS 30, 1080×1920, duration 45–55 s, ≤ 130 words, `config.json` `tail ≤ 0.3 s`, loop ending connecting grammatically back to line 01, no CTA.
- All 3D animation must be a pure function of `t`, bound to `L(n)` via `beat`/`pulse`/`between`/`stepIndex`/`focusOffset`, with ≥ 15 meshes and real object movement per shot (`check-motion` gate).
- Render cost rules from `AGENTS.md` apply (no env maps, bump maps, or post-processing).
- Captions ≤ 3 tokens per chunk (spelled-out numbers preserved), y ≈ 1270, max 3 callouts per shot inside header-to-y≈1240 zone.
- `instagramCaption` required in `publish.json` (≤ 2,200 chars, no `#shorts`/`#short`/`#fyp`).
- `check-duplicates` checks against `mandor-bangunan`'s own Buffer snapshot (`/tmp/published-videos-mandor-bangunan.json`).
- Posting schedule matches the other channels: 2×/day cron slots (`siang` 12:00 WIB and `malam` 19:00 WIB via `SLOT_TIMES` in `scripts/publish-lib.mts`), once activated in `ops/cloudflare-cron/wrangler.toml`.

## Approaches

1. **Full account identity on `kali-aja`'s 3D engine *(picked)*** — Register `mandor-bangunan` in `src/accounts.ts` with `TODO_` Buffer IDs (including `instagramChannelId`), write `ops/accounts/mandor-bangunan.md` and researched `ops/topics/mandor-bangunan.md`, add a construction-tuned narrative pool in `scripts/pick-format.mts`, copy the 3 `kali-aja` music beds (`teknik`, `misteri`, `fenomena`) into `public/mandor-bangunan/music/`, and add a `mandorBangunanVideoProblems` 3D/`"cream"` gate in `scripts/account-core.mts` + `scripts/account-gate.mts`.
   - *Trade-off:* Slightly more tests and a dedicated gate function, but guarantees CI never drifts into motion/footage/blueprint modes or non-construction rules.
2. **Thin alias of `kali-aja`** — Reuse `KALI_AJA` formats directly without a dedicated gate.
   - *Trade-off:* Fewer lines, but CI format instructions would still tell the agent to hunt Indonesian daily news, and nothing stops mode/theme drift.
3. **Custom overlay theme** — Add a new construction-themed palette in `Overlays.tsx`.
   - *Trade-off:* Diverges from the user's explicit choice to match `kali-aja`'s animation/look and adds UI maintenance.

## Design

### 1. Account registry (`src/accounts.ts`)

- Add `"mandor-bangunan"` to `AccountId` and `ACCOUNT_IDS`.
- Entry in `ACCOUNTS`:
  - `id`: `"mandor-bangunan"`
  - `label`: `"Mandor Bangunan"`
  - `brand`: `{ prefix: "Mandor ", accent: "Bangunan" }`
  - `buffer`: `{ orgId: "TODO_MANDOR_ORG_ID", youtubeChannelId: "TODO_MANDOR_YT_ID", tiktokChannelId: "TODO_MANDOR_TT_ID", instagramChannelId: "TODO_MANDOR_IG_ID" }`
  - `youtubeCategoryId`: `"27"` (Education, same as `kali-aja`)
  - `madeForKids`: `false`
  - `tts`: `{ voice: "id-id-podcaster-1", style: "natural, warm, conversational" }`
  - `agent`:
    - `model`: `"opencode/deepseek-v4.1-flash-free"`
    - `prompt`: `"You are in CI. Follow AGENTS.md and ops/ci-prompt.md exactly. Follow ops/accounts/mandor-bangunan.md (channel brief) and ops/topics/mandor-bangunan.md (topic backlog) — they are part of your instructions, they override ops/ci-prompt.md where they differ, and docs/AUTOPILOT.md does NOT apply to this channel. Stop before any publish/upload/render step."`
    - `files`: `["AGENTS.md", "ops/ci-prompt.md", "ops/accounts/mandor-bangunan.md", "ops/topics/mandor-bangunan.md"]`

### 2. Narrative format pool (`scripts/pick-format.mts`)

Add `MANDOR_BANGUNAN` format pool preserving `kali-aja`'s 4-beat retention arc (hook → konteks + re-hook → twist + re-hook → ending loop, no CTA) while framing every instruction for construction and civil engineering mechanisms:
- `bedah-struktur` (weight 3) — Authority/number hook on an extreme structure; 1–3 load-bearing/engineering mechanism steps; everyday analogy; loop ending.
- `cara-bangun` (weight 3) — How engineers actually build/install an impossible-looking structure step-by-step on site; key engineering constraint; loop ending.
- `mitos-konstruksi` (weight 2) — Common misconception about buildings/bridges/materials; real structural evidence; why it survives; corrected physics; loop ending.
- `misteri-teknik` (weight 2) — Counter-intuitive engineering fact (e.g., why buildings sway, why foundations float); ordered structural clues; reveal; loop ending.
- `sebelum-sesudah` (weight 2) — Viewer's default intuition about a structure; flip with real site/stress evidence; show mechanism; changed mental model; loop ending.
- `tantangan-lapangan` (weight 1) — Concrete site problem (soft soil, deep water, seismic zone, wind); engineered solution; quantified benefit and limit; loop ending.
- `duel-material` (weight 1) — Quick structural Q&A/comparison between two construction methods or materials; why the tempting intuition fails; why the chosen engineering method wins; loop ending.

### 3. Background music (`scripts/music.mts` + `public/mandor-bangunan/music/`)

- Add `"mandor-bangunan": ["teknik", "misteri", "fenomena"]` to `MOODS_BY_ACCOUNT` in `scripts/music.mts`.
- Copy `public/kali-aja/music/{teknik,misteri,fenomena}.mp3` into `public/mandor-bangunan/music/` so the channel has identical audio identity out of the box without requiring new Suno generation.

### 4. Channel brief (`ops/accounts/mandor-bangunan.md`)

Covers all required sections (`## Brand`, `## Suara`, `## Format`, `## Topik`, `## Riset`, `## Naskah`, `## Scene 3D`, `## Batas isi`, `## Musik latar`, `## publish.json`, `## Refill backlog`):
- **Brand:** `brand: { prefix: "Mandor ", accent: "Bangunan" }` (no `theme` override — defaults to `"cream"`, matching `kali-aja`).
- **Voice:** `npm run tts -- <slug> --account mandor-bangunan` (`id-id-podcaster-1`, `natural, warm, conversational`).
- **Niche & Topic selection:** Construction, buildings, bridges, tunnels/dams, foundations, infrastructure, and civil engineering techniques. Pick an unused entry from `ops/topics/mandor-bangunan.md` (cross-checked against `/tmp/published-videos-mandor-bangunan.json`), fetch its `https://` source via `WebFetch`, and verify every dimension, tonnage, depth, and mechanism before scripting. Stop and report if fewer than 3 unused entries remain.
- **Script rules (matching `kali-aja`):** 10–14 lines (`NN  text`), ≤ 130 words, 45–55 s in `timeline.json`, spoken santai-profesional Indonesian, numbers written in words, 4-beat retention arc, ending loop that grammatically connects back to line 01, no CTA, `config.json` `tail ≤ 0.3 s`.
- **3D Scene rules (matching `kali-aja`):** `Kit` cutaway/structural dioramas (`kit.lights()`, `kit.box/cyl/ball/tube/flowDots/gear/arrow/ring/cutaway/glowMat`, cut face at `z = 0`, deep ground layers `BOT ≈ -11` for foundations/piles/tunnels, FOV 44, line-beat choreography via `beat`/`pulse`/`between`/`stepIndex`/`focusOffset`, max 3 callouts per shot inside safe anchor zone, `tag: "ILUSTRASI"` on schematic views, warm aerial/orbit last shot matching shot 1 framing for loop).
- **`publish.json`:** `account: "mandor-bangunan"`, YouTube `title` (≤ 100 chars, no `<`/`>`), `description` (summary + `Sumber: <URL>` + `Animasi bersifat ilustrasi. Suara: AI (Google AI Studio).` + `#shorts` + 5–6 hashtags), `tiktokTitle` (≤ 90 chars), `tiktokCaption`, `instagramCaption` (≤ 2,200 chars, hook line ≤ 90 chars, IG keywords, 1 specific Save/Share/comment CTA, `Sumber:` + AI line, 3–5 hashtags, no `#shorts`/`#short`/`#fyp`), `catatan: "format: <id>; ..."`.

### 5. Researched topic backlog (`ops/topics/mandor-bangunan.md`)

- Line format: `- <slug>: <judul ide> — <URL sumber https> (<Gedung|Jembatan|Infrastruktur|Pondasi|Terowongan & Bendungan>)`
- Populated initially with ≥ 30 curated topics inspired by high-viewership construction/civil-engineering explainers (e.g., Tuned Mass Damper Taipei 101, fondasi tiang pancang/caisson di tanah lunak & bawah air, jembatan kabel/gantung & expansion joint, TBM terowongan bawah laut/MRT, bendungan beton raksasa & spillway, metode top-down basement, pracetak jembatan tol layang, beton bertulang vs prategang, penahan gempa/base isolation, rumah tahan gempa Jepang/Indonesia, jalan tol laut di atas rawa/bambu matras, dsb.), every entry paired with a verified reachable `https://` reference URL (e.g., Wikipedia / Britannica / ExplainThatStuff / official engineering pages verified during implementation).
- Also documents the periodic refill workflow (research top-viewed construction videos externally, verify technical facts against authoritative `https://` sources, append via PR).

### 6. Gates, duplicate checking & CI wiring

- `scripts/account-core.mts` & `scripts/account-gate.mts`: add `mandorBangunanVideoProblems` requiring `world.ts` (3D mode, not `motion` or `footage`) and forbidding non-`"cream"` `theme` overrides (`"blueprint"`, `"dark-tech"`, `"upwayyy"`), so CI rejects off-style renders.
- `scripts/duplicate-core.mts`: add `"mandor"` to `STOP` (leaving descriptive civil words like `"jembatan"`, `"gedung"`, `"beton"` intact so duplicate detection remains accurate).
- `ops/ci-prompt.md`: include `mandor-bangunan` in the per-account instruction list, 3D channels list, and Instagram-enabled accounts list, and note `10–14 lines, ≤ 130 words` per its brief.
- `.github/workflows/video.yml`: add `mandor-bangunan` to `inputs.account` description.
- `docs/PUBLISHING.md`, `AGENTS.md`, `README.md`, `ops/README.md`: document `mandor-bangunan` and its activation steps (`Buffer IDs` + GitHub Environment `mandor-bangunan` + `dry_run=true` check before adding to `ops/cloudflare-cron/wrangler.toml`).
- `ops/cloudflare-cron/wrangler.toml`: **untouched** until real Buffer IDs and GitHub Environment exist.

### 7. Tests

- `scripts/accounts.test.mts`: update account count/list (`6` accounts), verify `mandor-bangunan` identity, `TODO_` placeholders (`isConfigured === false`), `id-id-podcaster-1` voice, `madeForKids: false`, `youtubeCategoryId: "27"`, and existing agent files.
- `scripts/pick-format.test.mts`: verify `mandor-bangunan` format pool (≥ 7 formats, unique IDs, positive weights, loop-ending instructions).
- `scripts/topics.test.mts`: validate `ops/accounts/mandor-bangunan.md` sections/literals (`brand`, `account`, `tts`, `pick-format`, `beat`/`pulse`) and `ops/topics/mandor-bangunan.md` (≥ 30 entries, valid category tags, unique slugs, `https://` URLs, no duplicate URLs or malformed dash lines).
- `scripts/music.test.mts`: verify `mandor-bangunan` moods (`teknik`, `misteri`, `fenomena`) and reject cross-channel moods.
- `scripts/account-core.test.mts`: test `mandorBangunanVideoProblems` (accepts 3D with default/cream theme; rejects `mode: "motion"`, `mode: "footage"`, missing `world.ts`, and `theme: "blueprint"`).

## Left to the builder

- Exact `MANDOR_BANGUNAN` format wording and weights in `scripts/pick-format.mts`.
- Verifying all ≥ 30 `https://` source URLs in `ops/topics/mandor-bangunan.md` are live and explain the engineering mechanism before committing.
- Exact wording of `ops/accounts/mandor-bangunan.md` prose and `catatan` examples.

## Open items for the user (post-implementation, before cron activation)

- Create the YouTube, TikTok, and Instagram Reels channels for Mandor Bangunan, connect them to Buffer, create GitHub Environment `mandor-bangunan` with secrets, and replace the `TODO_` placeholders in `src/accounts.ts`.
- Run `workflow_dispatch` with `account=mandor-bangunan` and `dry_run=true` to verify end-to-end before adding `mandor-bangunan` to `ops/cloudflare-cron/wrangler.toml`.

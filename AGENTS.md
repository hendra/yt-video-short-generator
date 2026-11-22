# AGENTS.md — explainer-3d

Vertical (1080×1920) Shorts for YouTube/TikTok (plus Instagram Reels when configured, e.g. Sastra Mesin): Remotion + React Three Fiber, AI voiceover (Google AI Studio TTS, free) with per-word timing, karaoke captions. Content language is Indonesian (santai-profesional; the children's story channel Cerpenek has its own storytelling voice and wooden-toy diorama look — see `ops/accounts/cerpenek.md`; Sastra Mesin explains how everyday objects work in the light `"blueprint"` theme — see `ops/accounts/sastra-mesin.md`; Upwayyy tells the lore of recent horror games over official Steam trailer footage in `mode: "footage"` — see `ops/accounts/upwayyy.md`).

**Three render modes:** `3d` (default), `motion` (2D React cards, AI Labs), `footage` (one silent Steam trailer clip per shot, Upwayyy). Footage videos have no `world.ts`/`state.ts`; clips come from `npm run footage` and are gitignored.

**This pipeline publishes to more than one channel account.** Account config lives in `src/accounts.ts` (brand, Buffer org/channel ids, YouTube category, made-for-kids flag, voice, agent instruction files). A run is scoped to one account; `publish.json` carries `account` and the publish channel follows it. Brand is per video (`VideoDef.brand`) — do not hardcode one channel's brand.

Requires Node ≥ 20.19. Verification is `npm run lint` + `npm test` (node:test, offline/mocked) + bundling + eyeballing stills.

## Commands (all repo-specific)

- `npm run dev` — Remotion Studio. `predev` auto-synthesizes missing `public/<id>/music.wav` (local, no API key needed).
- `npm run lint` — the only static check: `eslint src && tsc && tsc -p scripts`. Run this after any change. (`scripts/` has its own tsconfig because it uses `allowImportingTsExtensions`; root `tsc` covers only `src/`.)
- `npm run render -- <id> out/<id>.mp4` — `--gl=angle` (GPU) by default. **Local renders and stills always use the GPU** (never pass `--gl=swangle` on a machine that has one); swangle is only for GPU-less CI/servers. Add `--scale=2` for a 2160×3840 master (the 3D canvas follows the scale; ~4× the pixels, GPU only in practice). Server/CI without GPU: add `--gl=swangle` (much slower, ~0.8 s/frame). CI (`.github/workflows/video.yml`) runs on GitHub-hosted `ubuntu-latest` with `--gl=swangle`.
- `npm run footage -- <id> --appid <steamAppId> [--min 8]` — footage accounts only: downloads official Steam trailers and cuts silent 1080p clips into `public/<id>/clips/NN.mp4` + `public/<id>/clips.json` (gitignored), exits 1 if fewer than `--min`. Pure selection logic lives in `scripts/footage-core.mts`.
- Video pipeline (per `<id>`, in order): `npm run footage -- <id> --appid <steamAppId>` (footage accounts only) → `npm run tts -- <id>` *or* `npm run align -- <id> <vo.mp3>` → `npm run timeline -- <id>` → `npm run music -- <id>` (only if duration changed) → dev/render. `npm run tts` is locked to Gemini 3.8 Flash TTS and speaks in the **voice of the run's account** (`tts` in `src/accounts.ts`: Indonesian male `id-id-podcaster-1` for Kali Aja, AI Labs and Upwayyy, female young storyteller `id-id-storyteller-1` for Cerpenek, female tutor `id-id-tutor-1` for Sastra Mesin). The account comes from `--account`, else the `ACCOUNT` env var (CI sets it), else Kali Aja; there is no provider fallback and no other voice switch. Timing comes from the built-in offline aligner (pauses pinned to punctuation; ±0.1 s words inside a phrase) — no timestamps API needed. There is **no word-alignment dependency** for the default path.
- `npm run credits` — legacy ElevenLabs quota check (not part of the locked `npm run tts` path).
- CI: `.github/workflows/video.yml` (Cloudflare cron → GitHub-hosted runners → full free pipeline) — jobs `build` → `render` (4 parallel shards, video only) → `publish` (audio via `audioOnly` prop, concat, loudnorm, upload); `workflow_dispatch -f dry_run=true` runs everything except publishing. Runbook: `ops/README.md`.
- Args always go through `--`: `npm run <script> -- <id>`. Scripts take the video id; folders are in `src/videos/`.
- Smoke-check a build without rendering: `npx remotion bundle --out-dir /tmp/rbundle`, then `npx remotion still <bundle> <id> <out.jpg> --frame=<f>` and view the image.

## Pipeline & generated files

- `naskah.txt` lines must match `NN  text` (2-digit number, two spaces). Narrative format is picked per run with `npx tsx scripts/pick-format.mts` (do not reuse the fixed taught pattern); line numbering stays fixed. Bind all animation timing to script lines via `L(n).s` / `L(n).e` (see `Ctx` in `src/engine/types.ts`), never raw seconds — VO regeneration re-times everything automatically.
- `timeline.json` is **generated, never committed** — re-run `npm run timeline -- <id>` after editing `naskah.txt`, `config.json`, or `alignment.json`.
- `alignment.json`, `naskah.txt`, `config.json`, `timeline.json`, `state/world/shots/index.ts` per video are generated and gitignored — video source lives only in the CI VM. `public/*/vo.mp3` is deleted from the tree after every publish (durable upstream) and gitignored — never commit it. `public/*/music.wav` is gitignored (regenerated by `predev`/`prerender`). `public/*/clips/` and `public/*/clips.json` are gitignored (regenerated by `npm run footage`). `out/` is gitignored.
- `.env` (gitignored) holds `GEMINI_API_KEY` (Gemini 3.8 voices, chosen per account). Legacy `GCLOUD_TTS_KEY` / `AZURE_SPEECH_KEY`+`AZURE_SPEECH_REGION` and `ELEVENLABS_*` remain in code but are not selectable through `npm run tts`; do not use them to change the production voice. Scripts load `.env` themselves via `loadDotenv` in `scripts/lib.mts` — no dotenv dependency. Never commit or print keys.

## Architecture

- `src/engine/` is video-agnostic: `Explainer.tsx` (ThreeCanvas + overlays + audio), `overlays/Overlays.tsx` (header, callouts, chips, karaoke caption, CTA, SAFE text areas), `kit.ts` (bevelled PBR building blocks, surface presets, standard light rig), `surface.ts` (procedural grain texture), `math.ts` (deterministic helpers, `rng`, physical easing `spring`/`drop`/`sway`), `types.ts` (`VideoDef`, `Timeline`, `Ctx`).
- `src/videos/<id>/` per video (generated in CI, gitignored): `naskah.txt`, `config.json` (`shots: [[shotId, firstLine], …]` + `tail`), `state.ts`, `world.ts` (scene built once, `update(t)` per frame), `shots.ts`, `index.ts`. Motion videos replace `state/world/shots.ts` with `shots.tsx`; footage videos (`mode: "footage"`) have `shots.ts` returning `FootageShotDef` (`clip`, `from`, `clipDur` — one distinct clip per shot) and no `world.ts`/`state.ts`, and their clips in `public/<id>/clips/` are gitignored. Registry: `src/videos/registry.ts` — a video exists only if registered there; composition id = registry key.
- FPS 30, 1080×1920, duration = `ceil(timeline.dur * 30)` (`src/Root.tsx`).
- `scripts/*.mts` run with `tsx`; shared helpers/env loading in `scripts/lib.mts`.
- `public/fonts/` = Inter + DejaVu Sans Mono, bundled so renders are identical offline. Don't swap font sources.

## Look & render cost (measured — don't undo without re-measuring)

- Build scenes from `Kit`: `kit.lights()` once per world (never hand-place ambient/directional lights), `kit.box/cyl/ball` for shapes, `kit.mat(color, "matte" | "gloss" | "metal" | "glass" | "water")` for materials. Raw `new Mesh(...)` is fine for special shapes but give round things ≥ 16 segments and pass `{ flatShading: true }` only for deliberately faceted rock/foliage.
- Ease motion physically: `spring()` for things that land/pop, `drop()` for falling objects, `sway()` for idle drift; plain `ramp()` only for slow continuous change.
- CPU (`--gl=swangle`) per-frame cost is dominated by fragment shading. Measured on 4 cores: soft shadows ≈ 30%, MSAA ≈ 10%, surface grain ≈ 8%; `--concurrency` makes no difference (SwiftShader already uses every core). **No environment maps / IBL** (3× slower), **no bump maps** (alias into noise at grazing angles), **no VSM shadows** (slower + dark artefacts), no post-processing passes.

## Hard rules (render correctness)

- **Everything visible must be a pure function of `t` (seconds).** No `Math.random()`, `Date.now()`, or cross-frame state — Remotion renders frames in parallel, out of order. Use `rng(seed)` from `engine/math.ts`.
- Particles with changing speed: integrate the rate from 0 to `t`, never `t * speed`.
- Caption: one chunk at a time, never two; ≤ 3 tokens per chunk, except spelled-out number runs are joined and may exceed 3 words (phrases with long numbers split on token boundaries to stay within 2 lines); use an `inline-block` card with `line-height: 1.32` in `Overlays.tsx`; don't move captions above y≈1270 or shrink SAFE areas (YouTube UI covers edges).
- Callout anchors should sit inside the zone between header bottom and y≈1240, or the overlay auto-pinning/hide logic will drop or edge-pin them. Max 3 callouts per shot; `orange` = focus, `red` = danger. No stacked/overlapping text.
- Diorama schematic maps get `tag: "ILUSTRASI"`.
- After building a video or changing scenes: render stills of the busiest frame of each shot and eyeball them before a full render (full swangle renders take ~35–40 min).

## Publishing & automation

- `docs/AUTOPILOT.md` is the scheduled-task runbook (Mon/Wed/Fri) for end-to-end production → YouTube + TikTok. If asked to "make a video" end-to-end, read it first — topic rules, quality bar, commit expectations (CI commits nothing after publish). Publishing mechanics (Buffer GraphQL, Cloudinary signed upload, token scopes, poll `post(input:{id})`): **`docs/PUBLISHING.md`** (tested 2026-11-11) — read BEFORE any upload; no "| 11.ai" suffix for Gemini VO (ElevenLabs-Free only).
- **Nothing generated lands in git.** The duplicate/republication lookup is fetched from Buffer into `/tmp/published-videos-<account>.json` during CI; no catalog is committed. Buffer remains the source of truth; source, VO, alignment, and render output are never committed.

## Gotchas

- Remotion composition props must be JSON — compositions only carry `videoId`; the video object is looked up in `VIDEOS` inside `Explainer.tsx`.
- `build-timeline` fails if fewer than 80% of script words match the alignment (then naskah.txt ≠ spoken text); the rest are interpolated. It does not check total duration — verify 45–55 s yourself in `timeline.json` (Cerpenek: 60–90 s per its brief).
- `npm run tts` refuses scripts over 130 words (Cerpenek exempt) before calling Gemini, and trims the VO before alignment: no leading silence, pauses ≤ 0.2 s, 0.05 s tail (seamless loop). Scripts end with a loop line that flows into line 01, not a CTA, and `config.json` `tail` ≤ 0.3 s (account gate enforces it; Cerpenek keeps its own CTA and tail). Alignment runs on the raw take (line breaks are the longest pauses there) and is then mapped onto the trimmed audio.
- 3D cuts ease the camera from the previous shot's pose over 0.3 s (`CUT_BLEND` in `engine/math.ts`) instead of hard-cutting; motion mode has its own 0.36 s transitions.
- TTS failure on all providers (or a provider analysis failure): an existing `vo.mp3`/`alignment.json` pair is left untouched — fresh audio lands in `os.tmpdir()/vo-<id>-failed.mp3`. Don't hand-edit `.env` mid-run; fix the key/quota and re-run.
- Local Node needs no special proxy; cloud workspaces need `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt` for the TTS provider API calls (see AUTOPILOT §1).

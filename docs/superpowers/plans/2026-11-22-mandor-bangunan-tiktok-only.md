# Mandor Bangunan TikTok-Only Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable per-platform optional Buffer channel IDs, configure `mandor-bangunan` for TikTok-only live publishing (`orgId: "6b02ca2707e3daab8001434d"`, `tiktokChannelId: "6b02cab28541f09ecb623894"`), fix TikTok-only Slack reporting, and add `mandor-bangunan` to `ops/cloudflare-cron/wrangler.toml`.

**Architecture:** Make `youtubeChannelId` and `tiktokChannelId` optional alongside `instagramChannelId` on `Account["buffer"]`, guard Buffer query/post/settle/report paths per configured platform, and keep `publish.json`'s `title`/`description` intact while `instagramCaption` stays optional when `instagramChannelId` is absent.

**Tech Stack:** TypeScript, Node `node:test`, Buffer GraphQL API, Wrangler config.

**Spec:** `docs/superpowers/specs/2026-11-22-mandor-bangunan-tiktok-only-design.md`

## Global Constraints

- Never commit `BUFFER_ACCESS_TOKEN` or any API secret anywhere in the repo.
- At least one of `youtubeChannelId`, `tiktokChannelId`, or `instagramChannelId` must be present and non-`TODO_` for `isConfigured(account)` to return `true`.
- Keep `publish.json` fields `title` and `description` required (`validatePublishJson` unchanged) so `check-duplicates` and `publish-result.json` stay consistent; `instagramCaption` remains conditional on `buffer.instagramChannelId`.
- Verification: `npm run lint` (`eslint src && tsc && tsc -p scripts`) and `npm test` must pass.

## Review Focus

- Account has `orgId` set but zero channel IDs (`youtubeChannelId`, `tiktokChannelId`, `instagramChannelId` all omitted) → `missingConfigFields` reports `"buffer.channels"` and `isConfigured` returns `false`.
- `bufferChannelIds` called on TikTok-only `mandor-bangunan` → returns `["6b02cab28541f09ecb623894"]` with no `undefined` elements.
- `publish.mts` runs on TikTok-only account → skips YouTube and Instagram `createPost`/polling, writes `schedule: { tiktok: ... }` and `links: { tiktok: ... }` without empty/null YouTube keys.
- `buildReportText` renders live `linkMap: { tiktok: "https://tt/1" }` without `youtube` → outputs `🎵 https://tt/1` and does NOT render `▶️` with a TikTok link or `?`.
- `instagramCaptionProblems` skips `mandor-bangunan` while `instagramChannelId` is omitted, and `scripts/account-core.test.mts` reflects that.

---

### Task 1: Optional platform channels in `src/accounts.ts` & live TikTok IDs for `mandor-bangunan`

**Files:**
- Modify: `src/accounts.ts:14-163`
- Modify: `scripts/accounts.test.mts:114-177`
- Modify: `scripts/account-core.test.mts:328-358`

**Interfaces:**
- Produces: `Account["buffer"]` with `youtubeChannelId?: string; tiktokChannelId?: string; instagramChannelId?: string;`, `missingConfigFields(account)` returning `"buffer.channels"` when all three channel IDs are missing/blank, and `ACCOUNTS["mandor-bangunan"].buffer = { orgId: "6b02ca2707e3daab8001434d", tiktokChannelId: "6b02cab28541f09ecb623894" }`.

- [ ] **Step 1: Update tests in `scripts/accounts.test.mts` and `scripts/account-core.test.mts`**

- In `scripts/accounts.test.mts`:
  - Update `"Mandor Bangunan has its own identity..."` to assert `buffer` equals `{ orgId: "6b02ca2707e3daab8001434d", tiktokChannelId: "6b02cab28541f09ecb623894" }`, `isConfigured(m) === true`, `missingConfigFields(m)` is `[]`, and Buffer IDs do not collide with any other account.
  - Add test `"an account with no channel ids counts as unconfigured"`: `missingConfigFields({ ...ACCOUNTS["mandor-bangunan"], buffer: { orgId: "6b02ca2707e3daab8001434d" } })` equals `["buffer.channels"]` and `isConfigured(...) === false`.
- In `scripts/account-core.test.mts`:
  - Move `ACCOUNTS["mandor-bangunan"]` into `"skips accounts without Instagram"` alongside `cerpenek` and remove it from the IG-enabled loops.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test scripts/accounts.test.mts scripts/account-core.test.mts`
Expected: FAIL (`mandor-bangunan` still has `TODO_` placeholders, `missingConfigFields` returns `[]` when zero channels are passed).

- [ ] **Step 3: Update `src/accounts.ts`**

- Change `Account["buffer"]` to `{ orgId: string; youtubeChannelId?: string; tiktokChannelId?: string; instagramChannelId?: string }`.
- In `missingConfigFields(account)`: check `orgId`, `youtubeChannelId`, `tiktokChannelId`, `instagramChannelId` for `TODO_` as before; also push `"buffer.channels"` if none of `youtubeChannelId`, `tiktokChannelId`, `instagramChannelId` is a non-empty string.
- Set `ACCOUNTS["mandor-bangunan"].buffer` to `{ orgId: "6b02ca2707e3daab8001434d", tiktokChannelId: "6b02cab28541f09ecb623894" }`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --import tsx --test scripts/accounts.test.mts scripts/account-core.test.mts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/accounts.ts scripts/accounts.test.mts scripts/account-core.test.mts
git commit -m "feat(accounts): allow optional YouTube/TikTok channels and configure mandor-bangunan TikTok"
```

---

### Task 2: Platform-optional publishing (`publish-lib.mts`, `publish.mts`) and Slack reporting (`report-lib.mts`)

**Files:**
- Modify: `scripts/publish-lib.mts:147-153`
- Modify: `scripts/publish.mts:115-217`
- Modify: `scripts/report-lib.mts:32-36`
- Modify: `scripts/publish.test.mts:194-205`
- Modify: `scripts/report.test.mts:50-61`

**Interfaces:**
- Consumes: `Account["buffer"]` with optional `youtubeChannelId` / `tiktokChannelId` / `instagramChannelId` (Task 1).
- Produces: `bufferChannelIds(buffer)` returning only configured non-empty channel IDs; `publish.mts` posting/polling/recording only configured platforms; `buildReportText` rendering live links per-platform from `linkMap` when present.

- [ ] **Step 1: Write failing tests in `scripts/publish.test.mts` and `scripts/report.test.mts`**

- In `scripts/publish.test.mts`:
  - Update `bufferChannelIds` test to assert `bufferChannelIds(ACCOUNTS["mandor-bangunan"].buffer)` equals `["6b02cab28541f09ecb623894"]` and `bufferChannelIds({ orgId: "o", youtubeChannelId: undefined, tiktokChannelId: "tt" })` equals `["tt"]`.
- In `scripts/report.test.mts`:
  - Add test `"live report with TikTok-only linkMap omits YouTube and renders the TikTok link"`: `buildReportText({ slug: "video-id", links: "https://tt/2", linkMap: { tiktok: "https://tt/2" }, account: "mandor-bangunan" })` matches `/🎵 https:\/\/tt\/2/`, matches `/\*\[Mandor Bangunan\] Video baru live\*/`, and does NOT contain `▶️`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test scripts/publish.test.mts scripts/report.test.mts`
Expected: FAIL (`bufferChannelIds` returns `[undefined, "6b02cab28541f09ecb623894"]`, `buildReportText` puts `https://tt/2` on `▶️` line).

- [ ] **Step 3: Update `scripts/publish-lib.mts`, `scripts/publish.mts`, and `scripts/report-lib.mts`**

- In `scripts/publish-lib.mts`: `bufferChannelIds` filters `[buffer.youtubeChannelId, buffer.tiktokChannelId, buffer.instagramChannelId]` for non-empty strings.
- In `scripts/publish.mts`:
  - Guard `ytTiming`, `ttTiming`, `igTiming` on `YT`, `TT`, `IG` presence; create Buffer posts and poll/settle only for configured platforms (`if (YT && ytTiming) ...`, `if (TT && ttTiming) ...`, `if (IG && igTiming) ...`).
  - Guard the failure message and `/tmp/publish-result.json` `schedule` and `links` objects so omitted platforms are not emitted as `undefined`/`null` keys.
- In `scripts/report-lib.mts`:
  - When `links` is present: if `Object.keys(linkMap).length > 0`, build platform lines from `PLATFORM_LINES.filter(([p]) => linkMap[p])` and set `*Judul:* lihat di ${linkMap.youtube ?? linkMap.tiktok ?? linkMap.instagram ?? ""}`; otherwise preserve legacy `links.split(",")` fallback for manual `--links` CLI usage.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --import tsx --test scripts/publish.test.mts scripts/report.test.mts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/publish-lib.mts scripts/publish.mts scripts/report-lib.mts scripts/publish.test.mts scripts/report.test.mts
git commit -m "feat(publish): skip unconfigured platforms and fix TikTok-only Slack report"
```

---

### Task 3: Cron activation (`wrangler.toml`) and updated briefs/docs

**Files:**
- Modify: `ops/cloudflare-cron/wrangler.toml:8`
- Modify: `ops/accounts/mandor-bangunan.md`
- Modify: `ops/ci-prompt.md`
- Modify: `docs/PUBLISHING.md`
- Modify: `ops/README.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: `mandor-bangunan` TikTok-only configuration (Tasks 1–2).

- [ ] **Step 1: Add `mandor-bangunan` to `ops/cloudflare-cron/wrangler.toml` and update briefs/docs**

- `ops/cloudflare-cron/wrangler.toml`: set `ACCOUNTS = "kali-aja,ai-labs,cerpenek,sastra-mesin,upwayyy,mandor-bangunan"`.
- `ops/accounts/mandor-bangunan.md`: note under `## publish.json` that `mandor-bangunan` currently publishes to **TikTok only** (`youtubeChannelId` & `instagramChannelId` not connected yet, so `instagramCaption` is optional for now), while keeping `title`, `description`, `tiktokTitle`, `tiktokCaption`, and `catatan`.
- `ops/ci-prompt.md`: move `mandor-bangunan` note so `instagramCaption` is documented as required only when `instagramChannelId` is configured (or list `kali-aja`, `ai-labs`, `sastra-mesin` for now and note `mandor-bangunan` is TikTok-only until IG is connected).
- `docs/PUBLISHING.md`, `ops/README.md`, `README.md`: update `mandor-bangunan` status to **TikTok-only active in `wrangler.toml` cron** (`orgId: 6b02ca2707e3daab8001434d`, `tiktokChannelId: 6b02cab28541f09ecb623894`), noting the operator must set `BUFFER_ACCESS_TOKEN` in GitHub Environment `mandor-bangunan` and run `npx wrangler deploy --config ops/cloudflare-cron/wrangler.toml`, and can later add `youtubeChannelId` / `instagramChannelId` without code changes.

- [ ] **Step 2: Run full verification suite**

Run: `npm run lint && npm test`
Expected: `eslint src && tsc && tsc -p scripts` exits 0; all `node:test` suites pass.

- [ ] **Step 3: Commit**

```bash
git add ops/cloudflare-cron/wrangler.toml ops/accounts/mandor-bangunan.md ops/ci-prompt.md docs/PUBLISHING.md ops/README.md README.md
git commit -m "chore(mandor-bangunan): activate TikTok-only cron and update docs"
```

# Mandor Bangunan — TikTok-only publishing (short design)

**Date:** 2026-11-22
**Scope:** Small change — optional per-platform Buffer channels, live TikTok config for `mandor-bangunan`, and cron wiring.

## Intent & why

`mandor-bangunan` currently has a Buffer organization (`6b02ca2707e3daab8001434d`) and a connected TikTok channel (`6b02cab28541f09ecb623894`), with YouTube and Instagram Reels to be connected later. Right now `src/accounts.ts`, `scripts/publish-lib.mts`, `scripts/publish.mts`, and `scripts/report-lib.mts` assume every configured account has both YouTube and TikTok channels, and `mandor-bangunan` still holds `TODO_` placeholders.

## Goals & non-goals

- **Goals:** Allow any subset of `{ youtube, tiktok, instagram }` per account (at least one required); configure `mandor-bangunan` with its real `orgId` and `tiktokChannelId`; wire `mandor-bangunan` into `ops/cloudflare-cron/wrangler.toml`; report TikTok-only scheduled/live posts accurately in Slack.
- **Non-goals:** Changing `publish.json` schema (`title` and `description` stay required for `check-duplicates` and `publish-result.json`, while `instagramCaption` remains conditional on `instagramChannelId`); committing secrets (`BUFFER_ACCESS_TOKEN` stays in GitHub Environment `mandor-bangunan`).

## Constraints

- At least one of `youtubeChannelId`, `tiktokChannelId`, or `instagramChannelId` must be configured and non-placeholder for `isConfigured(account)` to be `true`.
- Never commit `BUFFER_ACCESS_TOKEN` to the repository; operator creates GitHub Environment `mandor-bangunan` and redeploys the Cloudflare Worker (`ops/cloudflare-cron/wrangler.toml`).

## Approaches

1. **Optional per-platform Buffer channel IDs *(picked)*** — Make `youtubeChannelId` and `tiktokChannelId` optional alongside `instagramChannelId` in `Account["buffer"]`, guard `bufferChannelIds`, `publish.mts`, and `report-lib.mts` per configured platform, set `mandor-bangunan`'s `orgId` + `tiktokChannelId`, and add `mandor-bangunan` to `ops/cloudflare-cron/wrangler.toml`. Cleanly supports 1/2/3 platforms without changing `publish.json`.
2. **Conditional `publish.json` schema** — Drop `title`/`description` for TikTok-only accounts. Rejected because `publish-result.json` and `check-duplicates` rely on `title`/`description`, and it would require another schema change when YouTube is connected.
3. **Hardcoded `mandor-bangunan` special case in `publish.mts`** — Duplicates Buffer/polling branches for one account instead of fixing the shared platform assumption. Rejected.

## Design

- **`src/accounts.ts`:** Make `youtubeChannelId?: string` and `tiktokChannelId?: string` optional on `Account["buffer"]`. Update `missingConfigFields` to check defined `buffer` fields for `TODO_` and report `"buffer.channels"` if none of `youtubeChannelId`, `tiktokChannelId`, or `instagramChannelId` is provided. Set `ACCOUNTS["mandor-bangunan"].buffer` to `{ orgId: "6b02ca2707e3daab8001434d", tiktokChannelId: "6b02cab28541f09ecb623894" }`.
- **`scripts/publish-lib.mts` & `scripts/publish.mts`:** Update `bufferChannelIds` to include `youtubeChannelId` and `tiktokChannelId` only when defined. In `publish.mts`, compute timing, create Buffer posts, poll/settle, and emit `schedule`/`links` in `/tmp/publish-result.json` only for configured platforms.
- **`scripts/report-lib.mts`:** When reporting live links without `schedule`, render each present platform from `linkMap` (`youtube`, `tiktok`, `instagram`) instead of assuming positional `links.split(",")` `[yt, tt, ig]`, falling back to positional CSV only when `linkMap` is absent (so `--links yt,tt` CLI calls stay compatible).
- **Cron & docs (`ops/cloudflare-cron/wrangler.toml`, `ops/accounts/mandor-bangunan.md`, `ops/ci-prompt.md`, `docs/PUBLISHING.md`, `ops/README.md`, `README.md`):** Add `mandor-bangunan` to `ACCOUNTS` in `wrangler.toml`; document that `mandor-bangunan` currently publishes to TikTok only (`instagramCaption` omitted until IG is connected) and requires GitHub Environment `mandor-bangunan` (`BUFFER_ACCESS_TOKEN`) + `wrangler deploy`.
- **Tests:** Cover TikTok-only `bufferChannelIds`, `missingConfigFields` (0 channels vs TikTok-only configured), `mandor-bangunan` `isConfigured === true`, and `buildReportText` with TikTok-only `linkMap` and `schedule`.

## Left to the builder

- Exact test assertions and helper signature refinements in `publish.mts` / `report-lib.mts`.

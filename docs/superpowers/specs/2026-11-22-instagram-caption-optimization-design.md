# Instagram Reels Caption Optimization (Kali Aja, AI Labs, Sastra Mesin) — Design

**Date:** 2026-11-22
**Scope:** Small change — add dedicated, algorithm-optimized `instagramCaption` support to `publish.json`, sanitizer/fallback in `publish-lib.mts`, account-gate enforcement, duplicate checking, briefs, and tests across all Instagram-enabled accounts (`kali-aja`, `ai-labs`, `sastra-mesin`).

## Intent & Why

`kali-aja` (`6aed5544e29c69a1717ba62e`) and `ai-labs` (`6af92062ece6dfde5fcba082`) now have `instagramChannelId` configured in `src/accounts.ts`, joining `sastra-mesin` (`6afe07c2ece6dfde5f116be8`). Currently `scripts/publish.mts` posts `PUB.tiktokCaption` directly to Instagram, which leaks `#shorts` and misses Instagram Reels engagement signals (tap *"... more"* dwell time, Saves, Shares/DM, Comments, and IG search keywords).

## Goals, Non-Goals & Anti-Goals

- **Goals:**
  - Add dedicated `instagramCaption` in `publish.json` for accounts with `instagramChannelId` (`kali-aja`, `ai-labs`, `sastra-mesin`), optimized for Instagram Reels (curiosity hook on line 1, searchable Indonesian keywords, specific Save/Share/Comment trigger, `Sumber:` + AI voice credit, no `#shorts`/`#fyp`, 3–5 niche hashtags, ≤ 2,200 chars).
  - Add `instagramCaptionFor(pub)` in `scripts/publish-lib.mts`: uses `instagramCaption` when present, falls back to `tiktokCaption` for backwards compatibility, and deterministically strips cross-platform tags (`#shorts`, `#short`, `#youtubeshorts`, `#fyp`, `#foryou`, `#foryoupage`, `#tiktok`) while cleaning whitespace.
  - Enforce `instagramCaption` presence and absence of `#shorts`/`#fyp` in `scripts/account-gate.mts` (via `scripts/account-core.mts`) for accounts with `instagramChannelId` (and require `"Prompt siap copy:"` in `instagramCaption` when `ai-labs` uses `<PromptCard>`).
  - Include optional `instagramCaption` in `scripts/duplicate-core.mts` and `scripts/check-duplicates.mts`.
  - Update channel briefs and docs (`ops/ci-prompt.md`, `docs/AUTOPILOT.md`, `ops/accounts/ai-labs.md`, `ops/accounts/sastra-mesin.md`, `docs/PUBLISHING.md`) and tests.
- **Non-Goals:**
  - Rendering a separate MP4 or altering video dimensions/looping/schedule slots (already optimal: 1080×1920, `tail ≤ 0.3s`, `type: "reel"`, `shouldShareToFeed: true`, `isAiGenerated: true`, `SLOT_TIMES` 08:00/12:00/20:00 WIB).
  - Enabling Instagram for `cerpenek`.
- **Anti-Goals:**
  - Breaking backwards compatibility in `validatePublishJson` for older `publish.json` files without `instagramCaption`.
  - Changing Buffer GraphQL `metadata.instagram` fields beyond tested keys.

## Constraints

- Instagram Reels caption cap is 2,200 characters (`validatePublishJson` enforces `instagramCaption.length <= 2200` when provided).
- Existing `publish.test.mts` asserts `bufferChannelIds(ACCOUNTS["kali-aja"].buffer).length === 2` — must be updated now that `kali-aja` has 3 channels (keep 2-channel coverage using `ACCOUNTS.cerpenek.buffer`).
- `scripts/topics.test.mts` checks required headings in account briefs — existing headings must remain intact.

## Approaches

1. **Transform `tiktokCaption` at publish time only** — zero agent/brief changes, strips `#shorts` and appends a generic footer. Rejected: cannot craft a topic-specific line-1 hook for *"... more"* or a topic-specific Save/Comment question.
2. **Dedicated `instagramCaption` in `publish.json` + sanitizer/fallback in `publish-lib.mts`** *(picked)* — gives each platform tailored copy for IG Reels ranking signals while keeping a deterministic sanitizer and `tiktokCaption` fallback as safety net.

## Design

- **`scripts/publish-lib.mts`**:
  - Extend `PublishMeta` with optional `instagramCaption?: string`.
  - Update `validatePublishJson`: if `PUB.instagramCaption !== undefined`, validate it is a non-empty string with length `<= 2200`.
  - Add `sanitizeInstagramCaption(text: string): string`: strips `#shorts`, `#short`, `#youtubeshorts`, `#fyp`, `#foryou`, `#foryoupage`, `#tiktok` (case-insensitive hashtag tokens), collapses redundant horizontal spaces and >2 consecutive newlines, trims, and preserves up to 2,200 chars.
  - Add `instagramCaptionFor(pub: Pick<PublishMeta, "tiktokCaption" | "instagramCaption">): string`: picks `pub.instagramCaption?.trim() ? pub.instagramCaption : pub.tiktokCaption` and passes through `sanitizeInstagramCaption`.
- **`scripts/publish.mts`**:
  - Read `instagramCaption?: string` from `publish.json` and pass `instagramCaptionFor(PUB)` to `instagramInput(...)`.
- **`scripts/account-core.mts` & `scripts/account-gate.mts`**:
  - Add `instagramCaptionProblems(publishJson, account)`: when `account.buffer.instagramChannelId` is set, require non-empty `instagramCaption` (`<= 2200` chars) and reject `#shorts` / `#short` / `#fyp` tokens.
  - In `aiLabsVideoProblems`: when `shotsSource` contains `<PromptCard` and `publishJson.instagramCaption` is a string, also require `"Prompt siap copy:"`.
- **`scripts/duplicate-core.mts` & `scripts/check-duplicates.mts`**:
  - Add optional `instagramCaption?: string` to `CandidatePost`; check it in `findDuplicate` when non-empty.
- **Briefs & docs**:
  - Update `ops/ci-prompt.md`, `docs/AUTOPILOT.md`, `ops/accounts/ai-labs.md`, `ops/accounts/sastra-mesin.md`, and `docs/PUBLISHING.md` with the IG Channel IDs and the 5-part `instagramCaption` formula (line-1 curiosity hook, searchable keywords, topic-specific Save/Share/Comment CTA, `Sumber:` + AI voice credit, 3–5 niche hashtags without `#shorts`/`#fyp`).
- **Tests**:
  - Update `scripts/accounts.test.mts`, `scripts/publish.test.mts`, `scripts/account-core.test.mts`, and `scripts/duplicate-core.test.mts`.

## Left to the Builder

Exact regex details in `sanitizeInstagramCaption` and wording of the IG caption examples in the markdown briefs.

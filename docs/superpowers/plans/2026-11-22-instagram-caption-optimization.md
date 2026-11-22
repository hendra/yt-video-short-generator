# Instagram Reels Caption Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable algorithm-optimized, dedicated `instagramCaption` publishing for `kali-aja`, `ai-labs`, and `sastra-mesin` with sanitizer fallback, pre-render account gates, duplicate checks, updated briefs/docs, and passing tests.

**Architecture:** `src/accounts.ts` already carries `instagramChannelId` for `kali-aja`, `ai-labs`, and `sastra-mesin`. We extend `publish.json` (`PublishMeta`) with optional `instagramCaption` (for backward compatibility with older fixtures), add a pure sanitizer/fallback helper in `scripts/publish-lib.mts` consumed by `scripts/publish.mts`, enforce `instagramCaption` presence and clean tags in `scripts/account-core.mts` / `scripts/account-gate.mts` for IG-enabled accounts, include `instagramCaption` in `scripts/duplicate-core.mts` / `scripts/check-duplicates.mts`, and document the Reels caption formula in all channel briefs.

**Tech Stack:** TypeScript (`tsx` + `node:test`), `eslint`, `tsc`.

**Spec:** `docs/superpowers/specs/2026-11-22-instagram-caption-optimization-design.md`

## Global Constraints

- Instagram Reels caption length cap is `<= 2200` characters.
- Cross-platform tags (`#shorts`, `#short`, `#youtubeshorts`, `#fyp`, `#foryou`, `#foryoupage`, `#tiktok`) must never reach Instagram (`sanitizeInstagramCaption` strips them; `instagramCaptionProblems` rejects `#shorts` / `#short` / `#fyp` before render).
- Accounts with `instagramChannelId` (`kali-aja`, `ai-labs`, `sastra-mesin`) require `instagramCaption` in `account-gate.mts`; `cerpenek` (no `instagramChannelId`) must remain unaffected.
- `validatePublishJson` keeps `instagramCaption` optional for backwards compatibility with older `publish.json` payloads, while `publish.mts` falls back to sanitized `tiktokCaption` when `instagramCaption` is absent.
- `scripts/topics.test.mts` enforces required headings across `ops/accounts/{ai-labs,cerpenek,sastra-mesin}.md` and `docs/AUTOPILOT.md`; preserve all existing section headings.

## Review Focus

- Hashtags sharing a prefix (e.g. `#shortcuts`, `#shortcut`, `#fyppemula`) must not be stripped or corrupted when removing `#shorts`, `#short`, or `#fyp`.
- Whitespace-only `instagramCaption` (`"   "`) must be rejected by `validatePublishJson` and `instagramCaptionProblems`, and `instagramCaptionFor` must fall back to `tiktokCaption` when `instagramCaption` is blank.
- Stripping cross-platform tags must not leave double spaces, trailing line spaces, or `> 2` consecutive newlines, and result length must stay `<= 2200` chars.
- `cerpenek` (no `instagramChannelId`) must return `[]` from `instagramCaptionProblems` when `instagramCaption` is omitted.
- `check-duplicates.mts` and `findDuplicate` must not crash or reject candidates when `instagramCaption` is omitted, and must detect matches in `instagramCaption` when present.

---

### Task 1: Align Account Registry Tests with Added Instagram Channel IDs

**Files:**
- Verify: `src/accounts.ts:37-76` (user already added `instagramChannelId` for `kali-aja` and `ai-labs`)
- Modify: `scripts/accounts.test.mts:16-88`

**Interfaces:**
- Consumes: `ACCOUNTS` from `../src/accounts.ts` (`kali-aja.buffer.instagramChannelId === "6aed5544e29c69a1717ba62e"`, `ai-labs.buffer.instagramChannelId === "6af92062ece6dfde5fcba082"`).
- Produces: Verified account registry test suite covering all 3 IG-enabled accounts and cross-account Buffer ID uniqueness.

- [ ] **Step 1: Update `scripts/accounts.test.mts` assertions**

In `"Kali Aja keeps its current identity"`, assert `assert.equal(k.buffer.instagramChannelId, "6aed5544e29c69a1717ba62e");`.
In `"AI Labs has its own identity"`, assert `assert.equal(a.buffer.instagramChannelId, "6af92062ece6dfde5fcba082");`.

- [ ] **Step 2: Run account registry tests**

Run: `npx tsx --test scripts/accounts.test.mts`
Expected: PASS (all tests green, including uniqueness and 24-hex validation).

- [ ] **Step 3: Commit**

```bash
git add src/accounts.ts scripts/accounts.test.mts
git commit -m "feat(accounts): enable Instagram channel IDs for kali-aja and ai-labs"
```

---

### Task 2: `instagramCaption` Schema, Sanitizer/Fallback, and Publish Wiring

**Files:**
- Modify: `scripts/publish-lib.mts:15-50,116-125`
- Modify: `scripts/publish.mts:30,61,169`
- Test: `scripts/publish.test.mts:36-65,112-173`

**Interfaces:**
- Consumes: `ACCOUNTS` from `../src/accounts.ts`.
- Produces in `scripts/publish-lib.mts`:
  - `export type PublishMeta = { title: string; description: string; tiktokTitle: string; tiktokCaption: string; instagramCaption?: string; catatan?: string };`
  - `export const sanitizeInstagramCaption = (text: string): string`
  - `export const instagramCaptionFor = (pub: Pick<PublishMeta, "tiktokCaption" | "instagramCaption">): string`
  - `validatePublishJson(obj)` checks `instagramCaption` if `PUB.instagramCaption !== undefined` (must be non-empty string, `<= 2200` chars).

- [ ] **Step 1: Write the failing tests in `scripts/publish.test.mts`**

1. In `validatePublishJson`:
   - Accept `{ ...ok, instagramCaption: "Hook\n\n#kaliajatau" }` (`deepEqual(..., [])`).
   - Reject `{ ...ok, instagramCaption: "   " }` (`includes("instagramCaption")`).
   - Reject `{ ...ok, instagramCaption: "x".repeat(2201) }` (`includes("instagramCaption > 2200")`).
2. Add `describe("sanitizeInstagramCaption and instagramCaptionFor", () => { ... })`:
   - Strips `#shorts`, `#short`, `#youtubeshorts`, `#fyp`, `#foryou`, `#foryoupage`, `#tiktok` (case-insensitive) while keeping `#shortcuts`, `#fyppemula`, `#kaliajatau`, `#ailabs`.
   - Cleans trailing spaces and collapses `3+` consecutive newlines to `\n\n`, and caps output at `2200` chars.
   - `instagramCaptionFor({ tiktokCaption: "Info #shorts #fyp #sains", instagramCaption: "Hook IG\n#sains" })` returns `"Hook IG\n#sains"`.
   - `instagramCaptionFor({ tiktokCaption: "Info #shorts #fyp #sains", instagramCaption: "   " })` falls back to `"Info #sains"`.
   - `instagramCaptionFor({ tiktokCaption: "Info #shorts #sains" })` returns `"Info #sains"`.
3. In `describe("bufferChannelIds and mapBufferPostNode")`:
   - Update `"includes instagramChannelId only when configured"` to check `bufferChannelIds(ACCOUNTS.cerpenek.buffer).length === 2` (2-channel account) and `bufferChannelIds(ACCOUNTS["kali-aja"].buffer).length === 3` and `bufferChannelIds(ACCOUNTS["ai-labs"].buffer).length === 3`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test scripts/publish.test.mts`
Expected: FAIL (`sanitizeInstagramCaption` / `instagramCaptionFor` not exported, and `kali-aja` length mismatch).

- [ ] **Step 3: Implement in `scripts/publish-lib.mts` and wire in `scripts/publish.mts`**

In `scripts/publish-lib.mts`:
- Add `instagramCaption?: string` to `PublishMeta`.
- In `validatePublishJson`: if `PUB.instagramCaption !== undefined`:
  - if `typeof PUB.instagramCaption !== "string" || !PUB.instagramCaption.trim()` push `'missing/empty "instagramCaption"'`
  - else if `PUB.instagramCaption.length > 2200` push `` `instagramCaption > 2200 chars (${PUB.instagramCaption.length})` ``
- Implement `sanitizeInstagramCaption(text: string): string`:
  - Strip cross-platform hashtag tokens using `/(^|[^\w])#(?:shorts|short|youtubeshorts|fyp|foryoupage|foryou|tiktok)(?![\w-])/gi` (replacing with `$1`).
  - Collapse repeated horizontal spaces per line (`/[ \t]{2,}/g` → `" "`), trim each line's trailing/leading spaces (`replace(/^[ \t]+|[ \t]+$/gm, "")`), collapse `3+` newlines (`/\n{3,}/g` → `"\n\n"`), `.trim()`, and slice `.slice(0, 2200)` if still over 2200.
- Implement `instagramCaptionFor(pub)`: choose `pub.instagramCaption?.trim() ? pub.instagramCaption : pub.tiktokCaption` and pass to `sanitizeInstagramCaption`.

In `scripts/publish.mts`:
- Import `instagramCaptionFor` from `./publish-lib.mts`.
- Extend `PUB` type annotation with `instagramCaption?: string`.
- Replace `PUB.tiktokCaption` with `instagramCaptionFor(PUB)` in `instagramInput(IG, up.secure_url!, instagramCaptionFor(PUB), igTiming)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test scripts/publish.test.mts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/publish-lib.mts scripts/publish.mts scripts/publish.test.mts
git commit -m "feat(publish): add instagramCaption support, sanitizer, and fallback"
```

---

### Task 3: Account Gate & Duplicate Gate Support for `instagramCaption`

**Files:**
- Modify: `scripts/account-core.mts:103-129` (add `instagramCaptionProblems` + update `aiLabsVideoProblems`)
- Modify: `scripts/account-gate.mts:10,38-48`
- Modify: `scripts/duplicate-core.mts:11-22,54-67`
- Modify: `scripts/check-duplicates.mts:61-74`
- Test: `scripts/account-core.test.mts`
- Test: `scripts/duplicate-core.test.mts`

**Interfaces:**
- Consumes: `Account` from `../src/accounts.ts`, `CandidatePost` from `./duplicate-core.mts`.
- Produces:
  - `export const instagramCaptionProblems = (publishJson: { instagramCaption?: unknown } | null, account: Account): string[]` in `scripts/account-core.mts`
  - Extended `aiLabsVideoProblems` checking `publishJson.instagramCaption` for `"Prompt siap copy:"` when `<PromptCard` is rendered and `instagramCaption` is a string.
  - Extended `CandidatePost` (`instagramCaption?: string`) in `scripts/duplicate-core.mts`.

- [ ] **Step 1: Write failing tests in `scripts/account-core.test.mts` and `scripts/duplicate-core.test.mts`**

In `scripts/account-core.test.mts`:
- Add `describe("instagramCaptionProblems", () => { ... })`:
  - Returns `[]` for `cerpenek` (no `instagramChannelId`) when `instagramCaption` is omitted.
  - Rejects missing/whitespace `instagramCaption` for `kali-aja`, `ai-labs`, and `sastra-mesin`.
  - Rejects `instagramCaption` `> 2200` chars.
  - Rejects `instagramCaption` containing `#shorts`, `#short`, or `#fyp` (case-insensitive), while accepting `#shortcuts`.
  - Accepts clean `instagramCaption` `<= 2200` chars for `kali-aja`, `ai-labs`, and `sastra-mesin`.
- In `describe("aiLabsVideoProblems")`:
  - Rejects `<PromptCard` when `description` has `"Prompt siap copy:"` but `instagramCaption` is a string lacking `"Prompt siap copy:"`.
  - Accepts `<PromptCard` when both `description` and `instagramCaption` include `"Prompt siap copy:"`.

In `scripts/duplicate-core.test.mts`:
- Add test in `describe("findDuplicate")`:
  - Matches a candidate whose `instagramCaption` overlaps a recent post even when other fields do not (and still returns `null` when `instagramCaption` is omitted).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsx --test scripts/account-core.test.mts scripts/duplicate-core.test.mts`
Expected: FAIL (`instagramCaptionProblems` not exported, `PromptCard` IG check missing, `instagramCaption` field not scanned).

- [ ] **Step 3: Implement in `account-core.mts`, `account-gate.mts`, `duplicate-core.mts`, `check-duplicates.mts`**

In `scripts/account-core.mts`:
- Export `instagramCaptionProblems(publishJson: { instagramCaption?: unknown } | null, account: Account): string[]`:
  - If `!account.buffer.instagramChannelId` return `[]`.
  - Read `const ig = publishJson?.instagramCaption;`.
  - If `typeof ig !== "string" || ig.trim() === ""` push `'publish.json: field "instagramCaption" wajib diisi untuk akun dengan Instagram'` and return `problems`.
  - If `ig.length > 2200` push `` `publish.json: instagramCaption ${ig.length} karakter, maksimal 2200` ``.
  - If `/(?:^|[^\w])#(?:shorts|short|fyp)(?![\w-])/i.test(ig)` push `'publish.json: instagramCaption dilarang memakai #shorts, #short, atau #fyp'`.
  - Return `problems`.
- In `aiLabsVideoProblems`: widen `publishJson` parameter type to `{ description?: unknown; instagramCaption?: unknown } | null`. When `opts.shotsSource && /<PromptCard\b/.test(opts.shotsSource)`, also check: if `typeof opts.publishJson?.instagramCaption === "string" && !/Prompt siap copy:/i.test(opts.publishJson.instagramCaption)`, push `'shots pakai PromptCard — publish.json instagramCaption wajib berisi "Prompt siap copy:"'`.

In `scripts/account-gate.mts`:
- Import `instagramCaptionProblems` from `./account-core.mts`.
- Widen `publishJson` type to `{ description?: unknown; instagramCaption?: unknown } | null`.
- After `accountProblems(publishJson, account.id)`, push `...instagramCaptionProblems(publishJson, account)`.

In `scripts/duplicate-core.mts`:
- Add `instagramCaption?: string;` to `CandidatePost`.
- In `findDuplicate`, iterate `(["title", "tiktokTitle", "description", "tiktokCaption", "instagramCaption"] as const)`, reading `const text = candidate[field]; if (typeof text !== "string" || !text.trim()) continue;` before computing `significantTokens(text)`.

In `scripts/check-duplicates.mts`:
- Allow optional `instagramCaption` in `publish.json`: if `publish.instagramCaption !== undefined && (typeof publish.instagramCaption !== "string" || !publish.instagramCaption.trim())` fail cleanly; otherwise leave optional so older/non-IG videos work.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --test scripts/account-core.test.mts scripts/duplicate-core.test.mts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/account-core.mts scripts/account-gate.mts scripts/duplicate-core.mts scripts/check-duplicates.mts scripts/account-core.test.mts scripts/duplicate-core.test.mts
git commit -m "feat(gates): validate and dedupe instagramCaption for IG-enabled accounts"
```

---

### Task 4: Channel Briefs, Documentation & Full Verification

**Files:**
- Modify: `ops/ci-prompt.md:19-26`
- Modify: `docs/AUTOPILOT.md:1,14,138-146`
- Modify: `ops/accounts/ai-labs.md:103-124`
- Modify: `ops/accounts/sastra-mesin.md:112-132`
- Modify: `docs/PUBLISHING.md:25-39,118-123,153-160`

**Interfaces:**
- Consumes: Preserved section headings pinned by `scripts/topics.test.mts` (`## Brand`, `## Format`, `## Topik`, `## Naskah`, `## publish.json`, etc.).
- Produces: Consistent agent instructions teaching the 5-part Instagram Reels caption formula across all IG-enabled channels.

- [ ] **Step 1: Update `ops/ci-prompt.md` and `docs/PUBLISHING.md`**

- In `ops/ci-prompt.md`:
  - Update `publish.json` shape to include `"instagramCaption": "..."` for accounts with Instagram (`kali-aja`, `ai-labs`, `sastra-mesin`).
  - Document the `instagramCaption` rules: baris 1 hook pendek penarik klik `"... more"` (≤ 90 karakter), ringkasan dengan keyword pencarian IG, 1 CTA spesifik Save/Share/komentar (bukan follow/like), `Sumber: …` + `Animasi bersifat ilustrasi. Suara: AI (Google AI Studio).`, 3–5 hashtag relevan **tanpa** `#shorts`, `#short`, atau `#fyp` (≤ 2.200 karakter).
- In `docs/PUBLISHING.md`:
  - Add Instagram Reels channel IDs for `kali-aja` (`6aed5544e29c69a1717ba62e`) and `ai-labs` (`6af92062ece6dfde5fcba082`) to the Channel IDs table.
  - Update Instagram Reels section (line 38 & line 118–122) to document `instagramCaption` (≤ 2.200 karakter, fallback ke `tiktokCaption` tersanitasi bila absen, tanpa `#shorts`/`#fyp`).

- [ ] **Step 2: Update `docs/AUTOPILOT.md`, `ops/accounts/ai-labs.md`, and `ops/accounts/sastra-mesin.md`**

- Keep every existing markdown heading intact (required by `scripts/topics.test.mts`).
- In `docs/AUTOPILOT.md`:
  - Update title/header & §0 channel table to include Instagram `6aed5544e29c69a1717ba62e`.
  - In §9 Publish: add `instagramCaption` requirements for `kali-aja` (hook penarik `"... more"`, keyword SEO IG, CTA Save/Share/pertanyaan komentar topik, `Sumber:` + credit AI, 3–5 hashtag niche tanpa `#shorts`/`#fyp`).
- In `ops/accounts/ai-labs.md`:
  - Add `"instagramCaption": "…"` to the `publish.json` JSON template.
  - Require `instagramCaption` ≤ 2.200 karakter: baris 1 hook penarik klik `"... more"`, keyword pencarian IG, blok `Prompt siap copy:` bila memakai `<PromptCard>` (plus CTA *"Simpan Reels ini biar prompt-nya nggak hilang"*), `Sumber: …` + `Animasi bersifat ilustrasi. Suara: AI (Google AI Studio).`, dan 3–5 hashtag relevan tanpa `#shorts`/`#fyp`.
- In `ops/accounts/sastra-mesin.md`:
  - Add `"instagramCaption": "…"` to the `publish.json` JSON template.
  - Replace `(caption ini juga dipakai otomatis untuk Instagram Reels Sastra Mesin, maks 2.200 karakter)` with explicit `instagramCaption` rules (baris 1 hook penasaran penarik klik `"... more"`, keyword benda sehari-hari untuk SEO IG, 1 CTA Save/Share/pertanyaan komentar, `Sumber:` + `Animasi bersifat ilustrasi. Suara: AI (Google AI Studio).`, 3–5 hashtag relevan seperti `#sastramesin #carakerja`, tanpa `#shorts`/`#fyp`, maks 2.200 karakter).

- [ ] **Step 3: Run full static check and unit test suite**

Run: `npm run lint && npm test`
Expected: `eslint src && tsc && tsc -p scripts` exits 0; all `node:test` suites in `scripts/*.test.mts` pass (including `topics.test.mts`, `accounts.test.mts`, `publish.test.mts`, `account-core.test.mts`, `duplicate-core.test.mts`).

- [ ] **Step 4: Commit**

```bash
git add ops/ci-prompt.md docs/AUTOPILOT.md ops/accounts/ai-labs.md ops/accounts/sastra-mesin.md docs/PUBLISHING.md
git commit -m "docs(briefs): add algorithm-optimized Instagram Reels caption rules"
```

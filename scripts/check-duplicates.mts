/**
 * Deterministic near-duplicate gate for generated videos.
 *   npx tsx scripts/check-duplicates.mts <slug> [--db /tmp/published-videos-<id>.json]
 * Without --db, the catalog path is derived from the video's publish.json `account`.
 * Exits non-zero before render/publish when the candidate is too close to a published video.
 */
import fs from "node:fs";
import path from "node:path";
import { videoDir, readScript, publishedVideosPath } from "./lib.mts";
import { DEFAULT_ACCOUNT, isAccountId, type AccountId } from "../src/accounts.ts";
import { findDuplicate, type CandidatePost, type RecentPost } from "./duplicate-core.mts";

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: npx tsx scripts/check-duplicates.mts <slug> [--db /tmp/published-videos-<id>.json]");
  process.exit(1);
}

const publishPathForSlug = path.join(videoDir(slug), "publish.json");
const defaultCatalogPath = (): string => {
  try {
    if (!fs.existsSync(publishPathForSlug)) return publishedVideosPath(DEFAULT_ACCOUNT);
    const parsed = JSON.parse(fs.readFileSync(publishPathForSlug, "utf8")) as { account?: unknown };
    const account = typeof parsed.account === "string" ? parsed.account : DEFAULT_ACCOUNT;
    if (!isAccountId(account)) {
      console.error(`publish.json: account "${String(parsed.account)}" is not a known account (valid: kali-aja, ai-labs)`);
      process.exit(1);
    }
    return publishedVideosPath(account as AccountId);
  } catch (e) {
    console.error(`duplicate gate: could not read ${publishPathForSlug}: ${(e as Error).message ?? e}`);
    process.exit(1);
  }
};

const inline = process.argv.find((a) => a.startsWith("--db="));
const flagIdx = process.argv.indexOf("--db");
const requestedPath = inline ? inline.slice("--db=".length) : flagIdx > 0 ? process.argv[flagIdx + 1] : defaultCatalogPath();
const dbPath = path.isAbsolute(requestedPath) ? requestedPath : path.resolve(requestedPath);
if (!fs.existsSync(dbPath)) {
  console.error(`published-video catalog not found at ${dbPath} — run scripts/fetch-published-videos.mts first or let the workflow fetch it`);
  process.exit(1);
}
let recent: RecentPost[];
try {
  const parsed = JSON.parse(fs.readFileSync(dbPath, "utf8")) as unknown;
  recent = Array.isArray(parsed)
    ? parsed as RecentPost[]
    : (parsed as { videos?: RecentPost[] }).videos ?? [];
  if (!Array.isArray(recent) || recent.some((post) => typeof post?.text !== "string")) throw new Error("expected an array of Buffer post records");
} catch (e) {
  console.error(`duplicate gate: ${(e as Error).message}`);
  process.exit(1);
}

const publishPath = path.join(videoDir(slug), "publish.json");
if (!fs.existsSync(publishPath)) {
  console.error(`missing ${publishPath}`);
  process.exit(1);
}
const publish = JSON.parse(fs.readFileSync(publishPath, "utf8")) as Partial<CandidatePost>;
for (const field of ["title", "tiktokTitle", "description", "tiktokCaption"] as const) {
  if (typeof publish[field] !== "string" || !publish[field]!.trim()) {
    console.error(`publish.json: missing or invalid ${field}`);
    process.exit(1);
  }
}
if (publish.instagramCaption !== undefined && (typeof publish.instagramCaption !== "string" || !publish.instagramCaption.trim())) {
  console.error("publish.json: invalid instagramCaption");
  process.exit(1);
}
// Keep naskah in scope for validation, but duplicates are judged on the publish copy — naskah is full text and would over-match.
if (readScript(slug).length === 0) {
  console.error(`missing or empty ${path.join(videoDir(slug), "naskah.txt")}`);
  process.exit(1);
}
const candidate = publish as CandidatePost;
const match = findDuplicate(candidate, recent);
if (match) {
  const summary = (match.post.title ?? match.post.text).replace(/\s+/g, " ").slice(0, 90);
  console.error(`duplicate gate: candidate ${match.field} is too close to a published ${match.post.platform ?? ""} video (containment=${match.containment.toFixed(2)}, jaccard=${match.jaccard.toFixed(2)}): ${summary}`);
  console.error("choose a new topic, angle, or title; then re-run the gate");
  process.exit(1);
}
console.log(`duplicate gate: ${recent.length} published catalog entries checked; no close match for ${slug}`);

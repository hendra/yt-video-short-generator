/**
 * Publish a finished video to YouTube + TikTok (+ Instagram) via Cloudinary (signed upload) and Buffer (GraphQL).
 *   npm run publish -- <slug> [--account <id>] [--slot <pagi|siang|malam> --date <YYYY-MM-DD>]
 *
 * Posts are scheduled (Buffer customScheduled) at the slot's WIB air time per platform (SLOT_TIMES in
 * publish-lib.mts); the pagi slot has no YouTube post (Buffer free allows 2 YouTube posts/day). CI fixes
 * the slot at run start and passes --slot/--date; without them the slot for "now" is used. An air time
 * that already passed is shared now instead.
 *
 * Requirements:
 *   - out/<slug>-final.mp4 must exist (run render + loudnorm first)
 *   - src/videos/<slug>/publish.json must exist: { account, title, description, tiktokTitle, tiktokCaption, catatan? }
 *   - .env keys: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, BUFFER_ACCESS_TOKEN
 *
 * The channel is decided by publish.json's `account`. --account (optional) is a cross-check:
 * if it disagrees, the publish is refused before anything is uploaded. An account whose buffer
 * config still holds TODO_ placeholders is refused the same way.
 * Buffer is checked again before upload and the candidate is refused if it matches a recently posted video.
 * No source, VO, video data, or catalog file is committed by this script.
 * Once Buffer accepted every post (scheduled, or sent for share-now posts), deletes the
 * local intermediates: out/<slug>*.mp4, public/<slug>/music.wav, public/<slug>/vo.mp3.
 * Don't re-add vo.mp3 to git — it's removed from the tree after every publish.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ROOT, loadDotenv } from "./lib.mts";
import { fetchPublishedVideos } from "./fetch-published-videos.mts";
import { findDuplicate, type CandidatePost } from "./duplicate-core.mts";
import { cloudinarySign, validatePublishJson, extractBufferError, instagramCaptionFor, instagramInput, youtubeSafe, youtubeMetadata, resolveSlot, dueAt, postTiming, settleAction, type Platform, type PostTiming } from "./publish-lib.mts";
import { ACCOUNT_IDS, accountById, isAccountId, isConfigured, missingConfigFields } from "../src/accounts.ts";

loadDotenv();

const args = process.argv.slice(2);
let slug = "";
let runAccount: string | undefined;
let slotArg: string | undefined, dateArg: string | undefined;
for (let i = 0; i < args.length; i += 1) {
  const a = args[i];
  if (a === "--account") { runAccount = args[i + 1]; i += 1; }
  else if (a.startsWith("--account=")) runAccount = a.slice("--account=".length);
  else if (a === "--slot") { slotArg = args[i + 1]; i += 1; }
  else if (a === "--date") { dateArg = args[i + 1]; i += 1; }
  else if (!a.startsWith("--")) slug = a;
}
if (!slug) { console.error("Usage: npm run publish -- <slug> [--account <id>] [--slot <pagi|siang|malam> --date <YYYY-MM-DD>]"); process.exit(1); }

const fail = (msg: string): never => { console.error(msg); process.exit(1); };
const today = () => new Date().toISOString().slice(0, 10);

const mp4Path = path.join(ROOT, "out", `${slug}-final.mp4`);
const publishPath = path.join(ROOT, "src", "videos", slug, "publish.json");

if (!fs.existsSync(mp4Path)) fail(`No final mp4 at ${mp4Path} — render + loudnorm first.`);
if (!fs.existsSync(publishPath)) fail(`Missing ${publishPath} — the agent must write publish.json (see ops/ci-prompt.md).`);

const PUB = JSON.parse(fs.readFileSync(publishPath, "utf8")) as { account: string; title: string; description: string; tiktokTitle: string; tiktokCaption: string; instagramCaption?: string; catatan?: string };
{
  const problems = validatePublishJson(PUB);
  if (problems.length) fail(`publish.json: ${problems.join("; ")}`);
}

// ---------- Account resolution: the video's own account decides the channels; the run account only cross-checks
const account = accountById(PUB.account);
if (runAccount !== undefined && !isAccountId(runAccount)) {
  fail(`--account "${runAccount}" tidak dikenal (valid: ${ACCOUNT_IDS.join(", ")})`);
}
if (runAccount && runAccount !== account.id) {
  fail(`publish refused: video account "${account.id}" != run account "${runAccount}" — refusing before upload`);
}
if (!isConfigured(account)) {
  fail(`publish refused: akun ${account.id} belum dikonfigurasi (missing: ${missingConfigFields(account).join(", ")}) — refusing before upload`);
}

const slotRes = resolveSlot(slotArg, dateArg, new Date(), account.id);
if (typeof slotRes === "string") fail(slotRes);
const { slot, date: slotDate } = slotRes as Exclude<typeof slotRes, string>;
if (
  !dueAt(slot, slotDate, "youtube", account.id) &&
  !dueAt(slot, slotDate, "tiktok", account.id) &&
  !(account.buffer.instagramChannelId && dueAt(slot, slotDate, "instagram", account.id))
) {
  fail(`publish refused: slot "${slot}" tidak punya jadwal tayang untuk akun ${account.id}`);
}

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME, CLOUD_KEY = process.env.CLOUDINARY_API_KEY, CLOUD_SECRET = process.env.CLOUDINARY_API_SECRET;
const BUFFER = process.env.BUFFER_ACCESS_TOKEN;
for (const [n, v] of [["CLOUDINARY_CLOUD_NAME", CLOUD_NAME], ["CLOUDINARY_API_KEY", CLOUD_KEY], ["CLOUDINARY_API_SECRET", CLOUD_SECRET], ["BUFFER_ACCESS_TOKEN", BUFFER]] as const) {
  if (!v) fail(`Missing ${n} in .env (see .env.example / docs/PUBLISHING.md).`);
}

// ---------- Final near-duplicate check: Buffer is the source of truth; never upload a video already posted
const published = await fetchPublishedVideos(BUFFER, account.id);
{
  const match = findDuplicate(PUB as CandidatePost, published);
  if (match) fail(`publish refused: candidate is too similar to a live Buffer post (${match.field}; containment ${match.containment.toFixed(2)}, jaccard ${match.jaccard.toFixed(2)}) — choose a different video or inspect YouTube/TikTok. Kalau post itu adalah video yang sama dari retry run yang sebelumnya setengah gagal (YouTube live, TikTok belum), purge post itu di Buffer atau tayangkannya manual, lalu jalankan lagi`);
}

// ---------- 1. Cloudinary signed upload
const publicId = `shorts/${today()}/${slug}`;
const ts = Math.floor(Date.now() / 1000);
const sign = cloudinarySign({ public_id: publicId, overwrite: "true", timestamp: ts }, CLOUD_SECRET!);
const fileBuf = fs.readFileSync(mp4Path);
const form = new FormData();
form.append("file", new Blob([new Uint8Array(fileBuf)], { type: "video/mp4" }), `${slug}-final.mp4`);
form.append("public_id", publicId);
form.append("timestamp", String(ts));
form.append("overwrite", "true");
form.append("api_key", CLOUD_KEY!);
form.append("signature", sign);
console.log(`uploading ${mp4Path} (${fileBuf.length} bytes) -> Cloudinary ${publicId} …`);
const upRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`, { method: "POST", body: form });
const upRaw = await upRes.text();
let up: { secure_url?: string; bytes?: number; resource_type?: string; error?: { message: string } } = {};
try { up = JSON.parse(upRaw); } catch { fail(`Cloudinary HTTP ${upRes.status}: non-JSON response (${upRaw.slice(0, 200)})`); }
if (!upRes.ok) fail(`Cloudinary ${upRes.status}: ${up.error?.message ?? JSON.stringify(up)}`);
if (up.bytes !== fileBuf.length) fail(`Cloudinary bytes mismatch: expected ${fileBuf.length}, got ${up.bytes}`);
if (up.resource_type && up.resource_type !== "video") fail(`Cloudinary resource_type is "${up.resource_type}" (expected "video") — refusing to publish.`);
console.log(`  -> ${up.secure_url}`);

// ---------- 2. Buffer GraphQL createPost, scheduled at the slot's air time per platform
const YT = account.buffer.youtubeChannelId, TT = account.buffer.tiktokChannelId, IG = account.buffer.instagramChannelId;
const bufferPost = async (input: Record<string, unknown>) => {
  const query = `mutation($input: CreatePostInput!) {
  createPost(input: $input) {
    __typename
    ... on PostActionSuccess { post { id status channelService externalLink sharedNow dueAt } }
    ... on NotFoundError { message }
    ... on UnauthorizedError { message }
    ... on UnexpectedError { message }
    ... on InvalidInputError { message }
    ... on LimitReachedError { message }
    ... on RestProxyError { message }
  }
}`;
  const res = await fetch("https://api.buffer.com/graphql", {
    method: "POST",
    headers: { "Authorization": `Bearer ${BUFFER}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { input } }),
  });
  const raw = await res.text();
  let body: any = null;
  try { body = JSON.parse(raw); } catch { fail(`Buffer HTTP ${res.status}: non-JSON response (${raw.slice(0, 200)})`); }
  if (!res.ok) fail(`Buffer HTTP ${res.status}: ${extractBufferError(body) || raw.slice(0, 200)}`);
  const errDetail = extractBufferError(body);
  if (errDetail) fail(`Buffer: ${errDetail}`);
  const data = body?.data?.createPost;
  return data.post as { id: string; status: string; channelService: string; externalLink?: string | null };
};

const now = new Date();
const timingFor = (p: Platform): PostTiming | null => {
  const due = dueAt(slot, slotDate, p, account.id);
  return due ? postTiming(due, now) : null;
};
const ytTiming = timingFor("youtube"), ttTiming = timingFor("tiktok"), igTiming = IG ? timingFor("instagram") : null;
const describeTiming = (t: PostTiming | null) => (t === null ? "skip" : t.mode === "shareNow" ? "now" : t.dueAt);
console.log(`slot=${slot} date=${slotDate} youtube=${describeTiming(ytTiming)} tiktok=${describeTiming(ttTiming)}${IG ? ` instagram=${describeTiming(igTiming)}` : ""}`);

const ytInput = ytTiming && {
  channelId: YT, ...ytTiming, schedulingType: "automatic", needsApproval: false,
  text: youtubeSafe(PUB.description),
  assets: [{ video: { url: up.secure_url! } }],
  metadata: { youtube: youtubeMetadata(account, PUB.title) },
};
const ttInput = ttTiming && {
  channelId: TT, ...ttTiming, schedulingType: "automatic", needsApproval: false,
  text: PUB.tiktokCaption,
  assets: [{ video: { url: up.secure_url! } }],
  metadata: { tiktok: { isAiGenerated: true, title: PUB.tiktokTitle } },
};
const yt = ytInput ? await bufferPost(ytInput) : null;
if (yt) console.log(`youtube: ${yt.id} status=${yt.status} ${yt.externalLink ?? ""}`);
const tt = ttInput ? await bufferPost(ttInput) : null;
if (tt) console.log(`tiktok:  ${tt.id} status=${tt.status} ${tt.externalLink ?? ""}`);
const ig = IG && igTiming ? await bufferPost(instagramInput(IG, up.secure_url!, instagramCaptionFor(PUB), igTiming)) : null;
if (ig) console.log(`instagram: ${ig.id} status=${ig.status} ${ig.externalLink ?? ""}`);

// ---------- 3. Share-now posts: poll until they settle (max 5 min). Scheduled posts: accepted = done.
const deadline = Date.now() + 5 * 60_000;
const poll = async (id: string) => {
  let lastStatus = "unknown";
  while (Date.now() < deadline) {
    const res = await fetch("https://api.buffer.com/graphql", {
      method: "POST",
      headers: { "Authorization": `Bearer ${BUFFER}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: "{ post(input: { id: \"" + id + "\" }) { id status externalLink } }" }),
    });
    const raw = await res.text();
    let body: any = null;
    try { body = JSON.parse(raw); } catch { console.error(`poll ${id}: non-JSON response (HTTP ${res.status}): ${raw.slice(0, 200)}`); }
    if (body?.errors?.length) console.error(`poll ${id}: ${body.errors.map((e: any) => e?.message ?? JSON.stringify(e)).join("; ")}`);
    const p = body?.data?.post;
    if (p?.status) lastStatus = p.status;
    if (p?.status === "sent") return { link: p.externalLink as string, status: p.status };
    if (p?.status === "error") return { link: null, status: p.status };
    await new Promise((r) => setTimeout(r, 20_000));
  }
  return { link: null, status: lastStatus };
};
type Settled = { link: string | null; status: string; ok: boolean };
const settle = async (post: { id: string; status: string; externalLink?: string | null } | null, timing: PostTiming | null): Promise<Settled | null> => {
  if (!post || !timing) return null;
  const action = settleAction(timing, post.status);
  if (action !== "poll") return { link: null, status: post.status, ok: action === "accept" };
  const p = await poll(post.id);
  return { ...p, ok: Boolean(p.link) };
};
const [ytP, ttP, igP] = await Promise.all([settle(yt, ytTiming), settle(tt, ttTiming), settle(ig, igTiming)]);
const ytLink = ytP?.link ?? null, ttLink = ttP?.link ?? null, igLink = igP?.link ?? null;
if ([ytP, ttP, igP].some((p) => p && !p.ok)) {
  const fmt = (n: string, p: Settled | null) => (p ? `${n}=${p.status}/${p.link ?? "pending"}` : `${n}=skip`);
  fail(`post settled with error or timeout (${fmt("yt", ytP)}, ${fmt("tt", ttP)}${IG ? `, ${fmt("ig", igP)}` : ""}) — do NOT retry blindly; check Buffer UI.`);
}
const scheduleOf = (t: PostTiming | null) => (t === null ? undefined : t.mode === "shareNow" ? "now" : t.dueAt);

// ---------- 4. Temporary same-run result — used by the Slack report, never committed
const resultPath = path.join(os.tmpdir(), "publish-result.json");
fs.writeFileSync(
  resultPath,
  JSON.stringify({
    slug, account: account.id, date: today(), title: PUB.title, slot, slotDate,
    schedule: { youtube: scheduleOf(ytTiming), tiktok: scheduleOf(ttTiming), instagram: scheduleOf(igTiming) },
    links: { youtube: ytLink, tiktok: ttLink, ...(igLink ? { instagram: igLink } : {}) },
  }, null, 1),
);
console.log(`publish result: wrote ${resultPath}`);

// Cleanup after the publish is durable (Cloudinary + every Buffer post accepted). The Cloudinary
// asset itself is never deleted: Buffer fetches it at the scheduled air time.
// Local intermediates are disposable; no catalog or video metadata is committed by CI.
// Never fail the publish over this.
try {
  for (const f of [
    path.join(ROOT, "out", `${slug}-final.mp4`),
    path.join(ROOT, "out", `${slug}.mp4`),
    path.join(ROOT, "public", slug, "music.wav"),
    path.join(ROOT, "public", slug, "vo.mp3"),
  ]) fs.rmSync(f, { force: true });
  console.log("cleanup: removed out/ + public/ intermediates");
} catch (e) {
  console.error(`cleanup: ${(e as Error).message ?? e} (publish is already durable — ignoring)`);
}

console.log(`publish: done`);

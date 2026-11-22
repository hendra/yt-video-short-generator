/**
 * Pure helpers for publish.mts — exported so publish.test.mts can unit-test the
 * shipped code instead of a re-implementation. No I/O, no env access.
 */
import crypto from "node:crypto";
import { ACCOUNT_IDS, isAccountId, type Account } from "../src/accounts.ts";
import type { RecentPost } from "./duplicate-core.mts";

/** Cloudinary signed-upload signature: sha1 of the alphabetically sorted "k=v&…" param string + <secret>. */
export const cloudinarySign = (params: Record<string, string | number>, secret: string): string =>
  crypto.createHash("sha1")
    .update(Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&") + secret)
    .digest("hex");

export type PublishMeta = { title: string; description: string; tiktokTitle: string; tiktokCaption: string; instagramCaption?: string; catatan?: string };

/** YouTube rejects "<" and ">" in titles and descriptions; swap them for full-width look-alikes. */
export const youtubeSafe = (text: string): string => text.replaceAll("<", "＜").replaceAll(">", "＞");

/** Minimal schema for publish.json: required non-empty strings, platform length caps. Returns a list of problems ([] = valid). */
/** YouTube metadata for a Buffer post: category and the made-for-kids declaration follow the account. */
export const youtubeMetadata = (account: Account, title: string) => ({
  title: youtubeSafe(title),
  categoryId: account.youtubeCategoryId,
  privacy: "public" as const,
  madeForKids: account.madeForKids,
  isAiGenerated: true as const,
  notifySubscribers: true as const,
});

export const validatePublishJson = (obj: unknown): string[] => {
  const problems: string[] = [];
  if (!obj || typeof obj !== "object") return ["publish.json: not an object"];
  const PUB = obj as Record<string, unknown>;
  for (const k of ["title", "description", "tiktokTitle", "tiktokCaption", "account"] as const) {
    if (typeof PUB[k] !== "string" || !(PUB[k] as string).trim()) problems.push(`missing/empty "${k}"`);
  }
  if (typeof PUB.account === "string" && PUB.account.trim() && !isAccountId(PUB.account)) {
    problems.push(`unknown account "${PUB.account}" (valid: ${ACCOUNT_IDS.join(", ")})`);
  }
  if (typeof PUB.title === "string" && PUB.title.length > 100) problems.push(`title > 100 chars (${PUB.title.length})`);
  if (typeof PUB.tiktokTitle === "string" && PUB.tiktokTitle.length > 90) problems.push(`tiktokTitle > 90 chars (${PUB.tiktokTitle.length})`);
  if (typeof PUB.description === "string") {
    // YouTube caps the description in UTF-8 bytes, measured on the text it actually receives.
    const bytes = Buffer.byteLength(youtubeSafe(PUB.description));
    if (bytes > 5000) problems.push(`description > 5000 bytes (${bytes})`);
  }
  if (typeof PUB.tiktokCaption === "string" && PUB.tiktokCaption.length > 2200) problems.push(`tiktokCaption > 2200 chars (${PUB.tiktokCaption.length})`);
  if (PUB.instagramCaption !== undefined) {
    if (typeof PUB.instagramCaption !== "string" || !PUB.instagramCaption.trim()) problems.push('missing/empty "instagramCaption"');
    else if (PUB.instagramCaption.length > 2200) problems.push(`instagramCaption > 2200 chars (${PUB.instagramCaption.length})`);
  }
  return problems;
};

/** Extract Buffer GraphQL error detail: HTTP errors[] messages, or the createPost union member's message. */
export const extractBufferError = (body: any): string => {
  if (body?.errors?.length) {
    return body.errors.map((e: any) => e?.message ?? JSON.stringify(e)).join("; ");
  }
  const d = body?.data?.createPost;
  if (!d) return `no createPost payload: ${JSON.stringify(body)}`;
  if (d.__typename === "PostActionSuccess") return "";
  return `${d.__typename ?? "unknown"}: ${d.message ?? JSON.stringify(d)}`;
};

// ---------- Daily slots: two videos per day, aired across all platforms at 12:00 and 19:00 WIB.
export type Slot = "siang" | "malam";
export type Platform = "youtube" | "tiktok" | "instagram";
export const SLOT_TIMES: Record<Slot, Record<Platform, string>> = {
  siang: { youtube: "12:00", tiktok: "12:00", instagram: "12:00" },
  malam: { youtube: "19:00", tiktok: "19:00", instagram: "19:00" },
};
const SLOTS = Object.keys(SLOT_TIMES) as Slot[];
const WIB_MS = 7 * 3_600_000; // UTC+7, no DST

export const isSlot = (s: string): s is Slot => (SLOTS as string[]).includes(s);

/** UTC ISO for a WIB "HH:MM" on WIB date YYYY-MM-DD. */
const wibToIso = (date: string, hhmm: string): string => new Date(Date.parse(`${date}T${hhmm}:00Z`) - WIB_MS).toISOString();

/** ISO UTC air time for a platform in a slot. */
export const dueAt = (slot: Slot, date: string, platform: Platform): string => wibToIso(date, SLOT_TIMES[slot][platform]);

/** First slot whose earliest air time is still ahead of `now`; after the last one, next WIB day's first slot. */
export const slotFor = (now: Date): { slot: Slot; date: string } => {
  const today = new Date(now.getTime() + WIB_MS).toISOString().slice(0, 10);
  for (const slot of SLOTS) {
    const earliest = Object.values(SLOT_TIMES[slot]).sort()[0]!;
    if (Date.parse(wibToIso(today, earliest)) > now.getTime()) return { slot, date: today };
  }
  return { slot: SLOTS[0], date: new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10) };
};

/** Slot for a publish run: --slot/--date as a pair (fixed at run start by CI), else the slot for `now`. Returns an error string when invalid. */
export const resolveSlot = (
  slot: string | undefined,
  date: string | undefined,
  now: Date,
): { slot: Slot; date: string } | string => {
  if (slot === undefined && date === undefined) return slotFor(now);
  if (slot === undefined || date === undefined) return "--slot and --date must be given together";
  if (!isSlot(slot)) return `--slot "${slot}" tidak dikenal (valid: ${SLOTS.join(", ")})`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return `--date "${date}" bukan YYYY-MM-DD`;
  return { slot, date };
};

export type PostTiming = { mode: "customScheduled"; dueAt: string } | { mode: "shareNow" };
const SCHEDULE_MARGIN_MS = 2 * 60_000; // posts are created one by one; never hand Buffer a dueAt that may be past on arrival
/** Schedule at the air time, or share now if it passed / is too close (a slow run must not fail the publish). */
export const postTiming = (due: string, now: Date): PostTiming =>
  Date.parse(due) - now.getTime() >= SCHEDULE_MARGIN_MS ? { mode: "customScheduled", dueAt: due } : { mode: "shareNow" };

/** After createPost: a scheduled post must come back "scheduled" (draft/needs-approval would never air); sent or share-now posts are polled. */
export const settleAction = (timing: PostTiming, status: string): "accept" | "poll" | "fail" => {
  if (timing.mode === "shareNow" || status === "sent") return "poll";
  return status === "scheduled" ? "accept" : "fail";
};

const IG_STRIPPED_TAGS = /(^|[^\w])#(?:shorts|short|youtubeshorts|fyp|foryoupage|foryou|tiktok)(?![\w-])/gi;

/** Strip cross-platform tags (#shorts, #fyp, etc.), tidy whitespace, and cap at Instagram's 2,200-char limit. */
export const sanitizeInstagramCaption = (text: string): string =>
  text
    .replace(IG_STRIPPED_TAGS, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^[ \t]+|[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 2200);

/** Pick instagramCaption when provided, otherwise fall back to tiktokCaption, always sanitized for IG. */
export const instagramCaptionFor = (pub: Pick<PublishMeta, "tiktokCaption" | "instagramCaption">): string =>
  sanitizeInstagramCaption(pub.instagramCaption?.trim() ? pub.instagramCaption : pub.tiktokCaption);

/** Buffer CreatePostInput for an Instagram Reel shared to the main feed as well. */
export const instagramInput = (channelId: string, videoUrl: string, caption: string, timing: PostTiming) => ({
  channelId,
  ...timing,
  schedulingType: "automatic",
  needsApproval: false,
  text: caption,
  assets: [{ video: { url: videoUrl } }],
  metadata: { instagram: { type: "reel", shouldShareToFeed: true, isAiGenerated: true } },
});

/** Buffer channel IDs belonging to an account (YouTube, TikTok, and optional Instagram). */
export const bufferChannelIds = (buffer: Account["buffer"]): string[] => [
  buffer.youtubeChannelId,
  buffer.tiktokChannelId,
  ...(buffer.instagramChannelId ? [buffer.instagramChannelId] : []),
];

/** Buffer posts filter for the duplicate lookup: sent plus still-queued posts, so a scheduled video is not made twice. */
export const bufferPostsFilter = (buffer: Account["buffer"]) => ({ channelIds: bufferChannelIds(buffer), status: ["sent", "scheduled"] });

export type BufferNode = {
  id?: string;
  channelService?: string;
  createdAt?: string;
  sentAt?: string | null;
  dueAt?: string | null;
  text?: string;
  externalLink?: string | null;
  metadata?: { title?: string | null };
};

export const mapBufferPostNode = (node: BufferNode): RecentPost | null => {
  if (!node.id || !node.text) return null;
  const service = (node.channelService ?? "").toLowerCase();
  const platform = service.includes("tiktok") ? "tiktok" : service.includes("instagram") ? "instagram" : "youtube";
  return {
    id: `buffer:${node.id}`,
    platform,
    date: (node.sentAt ?? node.dueAt ?? node.createdAt ?? new Date().toISOString()).slice(0, 10),
    title: node.metadata?.title ?? null,
    text: node.text,
    link: node.externalLink ?? null,
    source: "buffer",
  };
};

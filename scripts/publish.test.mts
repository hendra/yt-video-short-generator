import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, test } from "node:test";
import {
  bufferChannelIds,
  bufferPostsFilter,
  cloudinarySign,
  extractBufferError,
  instagramCaptionFor,
  instagramInput,
  dueAt,
  isSlot,
  mapBufferPostNode,
  postTiming,
  sanitizeInstagramCaption,
  settleAction,
  resolveSlot,
  slotFor,
  validatePublishJson,
  youtubeMetadata,
  youtubeSafe,
} from "./publish-lib.mts";
import { ACCOUNTS } from "../src/accounts.ts";

describe("cloudinary signature (shipped helper)", () => {
  test("sorts params alphabetically", () => {
    // keys deliberately out of order; sorted -> overwrite, public_id, timestamp
    assert.equal(
      cloudinarySign({ public_id: "shorts/x", timestamp: 123, overwrite: "true" }, "s3cr3t"),
      crypto.createHash("sha1").update("overwrite=true&public_id=shorts/x&timestamp=123s3cr3t").digest("hex"),
    );
  });
  test("sign is independent of key order", () => {
    assert.equal(cloudinarySign({ a: "1", b: "2" }, "k"), cloudinarySign({ b: "2", a: "1" }, "k"));
  });
});

describe("validatePublishJson", () => {
  const ok = { account: "kali-aja", title: "Judul", description: "desc", tiktokTitle: "tt", tiktokCaption: "tc" };
  test("valid metadata has no problems", () => assert.deepEqual(validatePublishJson(ok), []));
  test("missing required keys is reported", () => {
    assert.ok(validatePublishJson({ title: "x" }).length >= 4);
    assert.deepEqual(validatePublishJson(null), ["publish.json: not an object"]);
  });
  test("empty strings count as missing", () => {
    assert.ok(validatePublishJson({ ...ok, description: "   " }).join().includes("description"));
    assert.ok(validatePublishJson({ ...ok, account: "   " }).join().includes("account"));
  });
  test("account must be a known account id", () => {
    assert.ok(validatePublishJson({ ...ok, account: "bogus" }).join().includes("bogus"));
    assert.ok(validatePublishJson({ title: "Judul", description: "desc", tiktokTitle: "tt", tiktokCaption: "tc" }).join().includes("account"));
    assert.deepEqual(validatePublishJson({ ...ok, account: "ai-labs" }), []);
  });
  test("length caps enforced", () => {
    assert.ok(validatePublishJson({ ...ok, title: "x".repeat(101) }).join().includes("title > 100"));
    assert.ok(validatePublishJson({ ...ok, tiktokTitle: "x".repeat(91) }).join().includes("tiktokTitle > 90"));
    assert.ok(validatePublishJson({ ...ok, description: "x".repeat(5001) }).join().includes("description > 5000"));
    assert.ok(validatePublishJson({ ...ok, tiktokCaption: "x".repeat(2201) }).join().includes("tiktokCaption > 2200"));
    assert.ok(validatePublishJson({ ...ok, instagramCaption: "   " }).join().includes("instagramCaption"));
    assert.ok(validatePublishJson({ ...ok, instagramCaption: "x".repeat(2201) }).join().includes("instagramCaption > 2200"));
    assert.deepEqual(validatePublishJson({ ...ok, description: "x".repeat(5000), tiktokCaption: "x".repeat(2200), instagramCaption: "Hook\n\n#kaliajatau" }), []);
  });
  test("description cap counts UTF-8 bytes of the text YouTube receives", () => {
    assert.ok(validatePublishJson({ ...ok, description: "é".repeat(2501) }).join().includes("description > 5000"));
    // each "<" becomes a 3-byte full-width character before it is sent
    assert.ok(validatePublishJson({ ...ok, description: "<".repeat(1667) }).join().includes("description > 5000"));
    assert.deepEqual(validatePublishJson({ ...ok, description: "é".repeat(2500) }), []);
  });
});

describe("youtubeSafe", () => {
  test("replaces every < and > with full-width look-alikes", () => {
    assert.equal(youtubeSafe("Lidar (>4.400 km) <b>x</b>"), "Lidar (＞4.400 km) ＜b＞x＜/b＞");
  });
  test("leaves other text unchanged", () => {
    assert.equal(youtubeSafe("±183.000 km² — #shorts & co"), "±183.000 km² — #shorts & co");
  });
});

describe("extractBufferError", () => {
  test("returns empty string for a successful createPost", () => {
    assert.equal(extractBufferError({ data: { createPost: { __typename: "PostActionSuccess", post: { id: "p1" } } } }), "");
  });
  test("extracts HTTP-level errors array", () => {
    assert.equal(extractBufferError({ errors: [{ message: "bad token" }] }), "bad token");
  });
  test("extracts typed error union member message", () => {
    assert.equal(
      extractBufferError({ data: { createPost: { __typename: "LimitReachedError", message: "daily limit" } } }),
      "LimitReachedError: daily limit",
    );
  });
  test("reports null payload instead of crashing", () => {
    assert.match(extractBufferError(null), /no createPost payload/);
    assert.match(extractBufferError({}), /no createPost payload/);
  });
});

describe("youtubeMetadata", () => {
  test("existing accounts are unchanged", () => {
    for (const id of ["kali-aja", "ai-labs"] as const) {
      const m = youtubeMetadata(ACCOUNTS[id], "Judul <a>");
      assert.equal(m.madeForKids, false);
      assert.equal(m.notifySubscribers, true);
      assert.equal(m.isAiGenerated, true);
      assert.equal(m.privacy, "public");
      assert.equal(m.categoryId, ACCOUNTS[id].youtubeCategoryId);
      assert.equal(m.title, "Judul ＜a＞");
    }
  });

  test("follows the account flag", () =>
    assert.equal(youtubeMetadata({ ...ACCOUNTS["kali-aja"], madeForKids: true }, "x").madeForKids, true));
});

describe("instagramInput", () => {
  test("builds a Buffer Reel payload sharing to feed with AI flag", () => {
    const p = instagramInput("6afe07c2ece6dfde5f116be8", "https://cdn/v.mp4", "Caption #shorts", { mode: "shareNow" });
    assert.deepEqual(p, {
      channelId: "6afe07c2ece6dfde5f116be8",
      mode: "shareNow",
      schedulingType: "automatic",
      needsApproval: false,
      text: "Caption #shorts",
      assets: [{ video: { url: "https://cdn/v.mp4" } }],
      metadata: { instagram: { type: "reel", shouldShareToFeed: true, isAiGenerated: true } },
    });
  });
  test("carries a customScheduled timing", () => {
    const p = instagramInput("c", "u", "t", { mode: "customScheduled", dueAt: "2026-11-21T01:00:00.000Z" });
    assert.equal(p.mode, "customScheduled");
    assert.equal((p as { dueAt?: string }).dueAt, "2026-11-21T01:00:00.000Z");
  });
});

describe("sanitizeInstagramCaption and instagramCaptionFor", () => {
  test("strips cross-platform tags without touching valid prefix-sharing hashtags", () => {
    assert.equal(
      sanitizeInstagramCaption("Hook seru!\n\n#Shorts #short #YouTubeShorts #FYP #foryou #ForYouPage #tiktok #shortcuts #fyppemula #kaliajatau #ailabs"),
      "Hook seru!\n\n#shortcuts #fyppemula #kaliajatau #ailabs",
    );
  });

  test("collapses redundant spaces/newlines and caps length at 2200 chars", () => {
    assert.equal(sanitizeInstagramCaption("Baris 1  #shorts   akhir\n\n\n\n#fyp\n\n#sains  "), "Baris 1 akhir\n\n#sains");
    assert.equal(sanitizeInstagramCaption("a".repeat(2250)).length, 2200);
  });

  test("instagramCaptionFor uses instagramCaption when present and falls back to sanitized tiktokCaption", () => {
    assert.equal(
      instagramCaptionFor({ tiktokCaption: "Info #shorts #fyp #sains", instagramCaption: "Hook IG\n#sains" }),
      "Hook IG\n#sains",
    );
    assert.equal(
      instagramCaptionFor({ tiktokCaption: "Info #shorts #fyp #sains", instagramCaption: "   " }),
      "Info #sains",
    );
    assert.equal(
      instagramCaptionFor({ tiktokCaption: "Info #shorts #sains" }),
      "Info #sains",
    );
  });
});

describe("slot scheduling", () => {
  test("slotFor picks the slot by WIB time, including the cron runs", () => {
    assert.deepEqual(slotFor(new Date("2026-11-20T22:30:00Z")), { slot: "pagi", date: "2026-11-21" }); // 05:30 WIB
    assert.deepEqual(slotFor(new Date("2026-11-21T03:30:00Z")), { slot: "siang", date: "2026-11-21" }); // 10:30
    assert.deepEqual(slotFor(new Date("2026-11-21T10:30:00Z")), { slot: "malam", date: "2026-11-21" }); // 17:30
  });
  test("slotFor after the last slot rolls to next WIB day's pagi", () => {
    assert.deepEqual(slotFor(new Date("2026-11-21T12:30:00Z")), { slot: "pagi", date: "2026-11-22" }); // 19:30
  });
  test("dueAt converts WIB air times to UTC; pagi has no YouTube", () => {
    assert.equal(dueAt("pagi", "2026-11-21", "tiktok"), "2026-11-21T00:00:00.000Z");
    assert.equal(dueAt("pagi", "2026-11-21", "youtube"), null);
    assert.equal(dueAt("malam", "2026-11-21", "instagram"), "2026-11-21T13:00:00.000Z");
    assert.equal(dueAt("siang", "2026-11-21", "youtube"), "2026-11-21T05:00:00.000Z");
  });
  test("postTiming falls back to shareNow once the air time passed", () => {
    assert.deepEqual(postTiming("2026-11-21T00:00:00.000Z", new Date("2026-11-21T00:30:00Z")), { mode: "shareNow" });
    assert.deepEqual(postTiming("2026-11-21T01:00:00.000Z", new Date("2026-11-21T00:30:00Z")), { mode: "customScheduled", dueAt: "2026-11-21T01:00:00.000Z" });
  });
  test("isSlot", () => {
    assert.equal(isSlot("siang"), true);
    assert.equal(isSlot("sore"), false);
  });
});

describe("bufferChannelIds and mapBufferPostNode", () => {
  test("includes instagramChannelId only when configured", () => {
    assert.equal(bufferChannelIds(ACCOUNTS.cerpenek.buffer).length, 2);
    assert.equal(bufferChannelIds(ACCOUNTS["kali-aja"].buffer).length, 3);
    assert.equal(bufferChannelIds(ACCOUNTS["ai-labs"].buffer).length, 3);
    assert.deepEqual(bufferChannelIds(ACCOUNTS["sastra-mesin"].buffer), [
      "6afdf52fece6dfde5f101631",
      "6afdf54bece6dfde5f101af0",
      "6afe07c2ece6dfde5f116be8",
    ]);
  });

  test("maps instagram, tiktok, and youtube nodes and drops incomplete nodes", () => {
    assert.equal(mapBufferPostNode({ id: "1", text: "x", channelService: "instagram" })?.platform, "instagram");
    assert.equal(mapBufferPostNode({ id: "2", text: "x", channelService: "tiktok" })?.platform, "tiktok");
    assert.equal(mapBufferPostNode({ id: "3", text: "x", channelService: "youtube" })?.platform, "youtube");
    assert.equal(mapBufferPostNode({ id: "4" }), null);
  });
});

describe("duplicate lookup sees queued posts", () => {
  test("filter asks Buffer for sent and scheduled posts", () => {
    const f = bufferPostsFilter(ACCOUNTS["kali-aja"].buffer);
    assert.deepEqual(f.status, ["sent", "scheduled"]);
    assert.deepEqual(f.channelIds, bufferChannelIds(ACCOUNTS["kali-aja"].buffer));
  });
  test("a scheduled post is dated by its dueAt", () => {
    assert.equal(mapBufferPostNode({ id: "9", text: "x", createdAt: "2026-11-21T00:00:00Z", dueAt: "2026-11-22T00:00:00Z" })?.date, "2026-11-22");
  });
});

describe("resolveSlot (publish --slot/--date)", () => {
  const now = new Date("2026-11-21T03:30:00Z");
  test("no args uses the slot for now", () => assert.deepEqual(resolveSlot(undefined, undefined, now), { slot: "siang", date: "2026-11-21" }));
  test("explicit slot and date are kept", () => assert.deepEqual(resolveSlot("pagi", "2026-11-21", now), { slot: "pagi", date: "2026-11-21" }));
  test("rejects unknown slot, bad date, or only one of the pair", () => {
    assert.equal(typeof resolveSlot("sore", "2026-11-21", now), "string");
    assert.equal(typeof resolveSlot("pagi", "21-11-2026", now), "string");
    assert.equal(typeof resolveSlot("pagi", undefined, now), "string");
    assert.equal(typeof resolveSlot(undefined, "2026-11-21", now), "string");
  });
});

describe("final review fixes", () => {
  test("postTiming shares now when the air time is under 2 minutes away", () => {
    assert.deepEqual(postTiming("2026-11-21T12:00:00.000Z", new Date("2026-11-21T11:59:00Z")), { mode: "shareNow" });
    assert.deepEqual(postTiming("2026-11-21T12:00:00.000Z", new Date("2026-11-21T11:57:00Z")), { mode: "customScheduled", dueAt: "2026-11-21T12:00:00.000Z" });
  });
  test("settleAction: only a truly scheduled post is accepted without polling", () => {
    const sched = { mode: "customScheduled" as const, dueAt: "2026-11-21T12:00:00.000Z" };
    assert.equal(settleAction(sched, "scheduled"), "accept");
    assert.equal(settleAction(sched, "sent"), "poll");
    assert.equal(settleAction(sched, "draft"), "fail");
    assert.equal(settleAction(sched, "needs_approval"), "fail");
    assert.equal(settleAction(sched, "error"), "fail");
    assert.equal(settleAction({ mode: "shareNow" }, "sending"), "poll");
  });
});

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildReportText, formatLinksCsv } from "./report-lib.mts";

describe("buildReportText (Slack payload, shipped helper)", () => {
  test("error report mentions step and truncates message", () => {
    const t = buildReportText({ slug: "x", step: "gates", error: "e".repeat(400) });
    assert.match(t, /run gagal di \*gates\*/);
    assert.equal(t.includes("e".repeat(301)), false);
  });
  test("error report without step says unknown step", () => {
    assert.match(buildReportText({ slug: "x", error: "boom" }), /\*unknown step\*/);
  });
  test("error report without account stays channel-neutral", () => {
    const t = buildReportText({ slug: "x", step: "publish", error: "boom" });
    assert.equal(t.includes("Kali Aja Tau"), false);
    assert.equal(t.includes("AI Labs"), false);
  });
  test("error report appends the account channel label when known", () => {
    const t = buildReportText({ slug: "x", step: "publish", error: "boom", account: "ai-labs" });
    assert.match(t, / — AI Labs/);
    const t2 = buildReportText({ slug: "x", step: "publish", error: "boom", account: "kali-aja" });
    assert.match(t2, / — Kali Aja Tau/);
  });
  test("success report embeds both links and slug", () => {
    const t = buildReportText({ slug: "video-id", links: "https://yt/1,https://tt/2", account: "kali-aja" });
    assert.match(t, /https:\/\/yt\/1/);
    assert.match(t, /https:\/\/tt\/2/);
    assert.match(t, /`video-id`/);
  });
  test("success report for kali-aja keeps the existing channel label", () => {
    const t = buildReportText({ slug: "video-id", links: "https://yt/1,https://tt/2", account: "kali-aja" });
    assert.match(t, /\*\[Kali Aja Tau\] Video baru live\*/);
  });
  test("success report for ai-labs is labelled for that channel", () => {
    const t = buildReportText({ slug: "video-id", links: "https://yt/1,https://tt/2", account: "ai-labs" });
    assert.match(t, /\*\[AI Labs\] Video baru live\*/);
  });
  test("success report without account is channel-neutral", () => {
    const t = buildReportText({ slug: "video-id", links: "https://yt/1,https://tt/2" });
    assert.match(t, /\*\[video-short CI\] Video baru live\*/);
  });
  test("success report does not claim a self-hosted runner", () => {
    const t = buildReportText({ slug: "video-id", links: "https://yt/1,https://tt/2", account: "kali-aja" });
    assert.doesNotMatch(t, /self-hosted/);
  });
  test("empty links and no error yields the informational fallback", () => {
    assert.match(buildReportText({ slug: "x" }), /tidak ada links\/error/);
  });
  test("success report includes instagram line when a 3rd link is provided and omits it for 2 links", () => {
    const two = buildReportText({ slug: "video-id", links: "https://yt/1,https://tt/2", account: "kali-aja" });
    assert.equal(two.includes("📸"), false);
    const three = buildReportText({ slug: "video-id", links: "https://yt/1,https://tt/2,https://ig/3", account: "sastra-mesin" });
    assert.match(three, /📸 https:\/\/ig\/3/);
  });
  test("live report with TikTok-only linkMap omits YouTube and renders the TikTok link", () => {
    const t = buildReportText({
      slug: "video-id",
      links: "https://tt/2",
      linkMap: { tiktok: "https://tt/2" },
      account: "mandor-bangunan",
    });
    assert.match(t, /\*\[Mandor Bangunan\] Video baru live\*/);
    assert.match(t, /🎵 https:\/\/tt\/2/);
    assert.equal(t.includes("▶️"), false);
  });
  test("formatLinksCsv omits null/missing links cleanly", () => {
    assert.equal(formatLinksCsv({ youtube: "https://yt/1", tiktok: "https://tt/2" }), "https://yt/1,https://tt/2");
    assert.equal(formatLinksCsv({ youtube: "https://yt/1", tiktok: "https://tt/2", instagram: "https://ig/3" }), "https://yt/1,https://tt/2,https://ig/3");
    assert.equal(formatLinksCsv({ youtube: "https://yt/1", tiktok: null, instagram: null }), "https://yt/1");
  });
});

describe("buildReportText scheduled posts", () => {
  test("shows WIB air time per platform and the slug", () => {
    const t = buildReportText({ slug: "x", account: "kali-aja", schedule: { youtube: "2026-11-21T05:00:00.000Z", tiktok: "2026-11-21T06:00:00.000Z" } });
    assert.match(t, /:calendar:/);
    assert.match(t, /\[Kali Aja Tau\] Video dijadwalkan/);
    assert.match(t, /YouTube 12:00 WIB/);
    assert.match(t, /TikTok 13:00 WIB/);
    assert.match(t, /`x`/);
    assert.doesNotMatch(t, /Instagram/);
  });
  test("share-now posts say sekarang and carry their link", () => {
    const t = buildReportText({ slug: "x", schedule: { tiktok: "now", instagram: "2026-11-21T01:00:00.000Z" }, linkMap: { tiktok: "https://tt/1" } });
    assert.match(t, /TikTok sekarang — https:\/\/tt\/1/);
    assert.match(t, /Instagram 08:00 WIB/);
    assert.doesNotMatch(t, /YouTube/);
  });
  test("error still wins over schedule", () => {
    assert.match(buildReportText({ slug: "x", error: "boom", schedule: { tiktok: "now" } }), /run gagal/);
  });
});

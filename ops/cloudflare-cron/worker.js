/**
 * Cron weker untuk pipeline video (semua akun di ACCOUNTS).
 * Setiap 22:30, 03:30, 10:30 UTC (= 05:30, 10:30, 17:30 WIB — slot pagi/siang/malam; jam tayang per platform
 * dijadwalkan di Buffer oleh scripts/publish.mts, lihat SLOT_TIMES di scripts/publish-lib.mts)
 * memicu `repository_dispatch` di repo GitHub **sekali per akun** — workflow video.yml tahu akun mana
 * yang harus dijalankan dari `client_payload.account`.
 * Weker saja — semua kerja berat terjadi di runner GitHub-hosted (ubuntu-latest).
 *
 * Env:
 *   ACCOUNTS            — comma-separated account ids to dispatch. Default: "kali-aja".
 *                        Daftar produksi ada di wrangler.toml; akun baru masuk setelah ID Buffer
 *                        + GitHub Environment-nya terisi.
 *   VIDEO_SHORT_PAT     — fine-grained PAT with Contents: read+write on the repo
 *   SLACK_BOT_TOKEN, SLACK_SOCIAL_CHANNEL_ID — warning saat dispatch gagal
 */

const DEFAULT_ACCOUNTS = "kali-aja";
// Accounts whose TikTok airs on YouTube's 2x/day schedule (no pagi 05:30 WIB run).
const NO_MORNING_ACCOUNTS = new Set(["upwayyy"]);

/** Dispatch one account; returns null on success, or a failure record. */
async function dispatchOne(account, env) {
  const res = await fetch("https://api.github.com/repos/hendra/yt-video-short-generator/dispatches", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.VIDEO_SHORT_PAT}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "video-short-cron",
    },
    body: JSON.stringify({
      event_type: "video-run",
      client_payload: { account, source: "cloudflare-cron", at: new Date().toISOString() },
    }),
  });
  if (res.ok) return null; // dispatch diterima (HTTP 204)
  const detail = (await res.text()).slice(0, 200);
  return { account, status: res.status, detail };
}

export default {
  async scheduled(event, env, ctx) {
    const isMorningTick = new Date(event.scheduledTime || Date.now()).getUTCHours() === 22;
    const accounts = (env.ACCOUNTS || DEFAULT_ACCOUNTS)
      .split(",")
      .map((s) => s.trim())
      .filter((a) => Boolean(a) && !(isMorningTick && NO_MORNING_ACCOUNTS.has(a)));
    const results = await Promise.allSettled(accounts.map((account) => dispatchOne(account, env)));
    const failures = [];
    for (const [i, result] of results.entries()) {
      if (result.status === "fulfilled") {
        if (result.value) failures.push(result.value);
      } else {
        failures.push({ account: accounts[i], status: "error", detail: String(result.reason?.message ?? result.reason) });
      }
    }
    if (failures.length === 0) return; // semua dispatch diterima
    // Peringatan Slack: satu pesan per akun yang gagal, jangan ganti akun lain jadi gagal.
    ctx.waitUntil(
      (async () => {
        for (const failure of failures) {
          try {
            const slackRes = await fetch("https://slack.com/api/chat.postMessage", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${env.SLACK_BOT_TOKEN}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                channel: env.SLACK_SOCIAL_CHANNEL_ID,
                text: `:warning: [video-short-cron] repository_dispatch gagal untuk akun *${failure.account}* (${failure.status}): ${failure.detail}`,
                unfurl_links: false,
              }),
            });
            const body = await slackRes.json().catch(() => null);
            if (!slackRes.ok || !body?.ok) {
              console.log(`slack warning post failed: HTTP ${slackRes.status} ${body?.error ?? ""}`);
            }
          } catch (e) {
            console.log(`slack warning post threw: ${e?.message ?? e}`);
          }
        }
      })(),
    );
  },
};

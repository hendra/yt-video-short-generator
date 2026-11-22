/**
 * Cron weker untuk pipeline video (semua akun di ACCOUNTS).
 * Setiap 02:00, 09:00 UTC (= 09:00, 16:00 WIB — 3 jam sebelum tayang, slot siang/malam; jam tayang semua platform 12:00 & 19:00 WIB
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
    const accounts = (env.ACCOUNTS || DEFAULT_ACCOUNTS)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
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

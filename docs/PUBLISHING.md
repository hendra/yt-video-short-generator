# Publishing: Cloudinary → Buffer (YouTube + TikTok + Instagram, terjadwal)

Tested end-to-end 2026-11-11. Read this before any upload; `git log --oneline docs/PUBLISHING.md` shows changes since.

## Env keys (`.env`, always gitignored)

Kredensial disimpan **dengan nama yang sama di setiap level** — tidak ada prefix `AI_LABS_*`. Di CI, level repo (yang sekarang: milik Kali Aja, apa adanya) adalah *default untuk semua akun*; level environment `ai-labs` hanya berisi kunci khusus AI Labs yang kamu set. Environment secrets menimpa repo secrets dengan nama yang sama; kalau environment tidak meng-set suatu secret, dipakai repo secret. Lokal, `.env` diisi dengan kunci yang sedang dipakai:

```
BUFFER_ACCESS_TOKEN=      # Buffer API token. Scopes in use: posts:read + posts:write ONLY.
                          # It CANNOT list channels or account (those need account:read) — use the fixed channel IDs below.
CLOUDINARY_CLOUD_NAME=    # e.g. opqimovw
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

- Kali Aja: kunci repo (yang sudah ada) = apa yang dipakai di CI, tidak berubah.
- AI Labs: di CI diisi dari environment `ai-labs` (hanya yang kamu set); yang tidak di-set otomatis fallback ke repo secret Kali Aja.
- Prasyarat: **dua GitHub Environments harus dibuat** (`kali-aja` boleh kosong, `ai-labs`); job `build`/`publish` mereferensi environment sesuai id akun — environment yang tidak ada membatalkan run.

## Channel IDs (lihat juga docs/AUTOPILOT.md §0)

Sekarang di `src/accounts.ts` (sumber kebenaran tunggal). Ringkasan:

| Channel | Akun `kali-aja` | Akun `ai-labs` |
|---|---|---|
| YouTube | `6aedb753e29c69a171803f6e` | `6af91d59ece6dfde5fcb8689` |
| TikTok | `6aedb7fee29c69a171804662` | `6af91d8bece6dfde5fcb87ac` |
| Instagram Reels | `6aed5544e29c69a1717ba62e` | `6af92062ece6dfde5fcba082` |
| Buffer organization | `6aed53e7ec5c7c6d73f3e437` | `67654dffc44cce0b50102d9e` |
| `categoryId` YouTube | `27` (Education) | `28` (Science & Technology) |
| Brand overlay | prefix `Kali Aja ` + accent `Tau` | prefix `AI ` + accent `Labs` |
| Token Buffer (scope `posts:read`+`posts:write`) | `BUFFER_ACCESS_TOKEN` (repo) | `BUFFER_ACCESS_TOKEN` (di environment `ai-labs`) |

Kedua akun sudah **aktif dan tayang**: AI Labs tayang perdana pada **2026-11-15** (slug `claude-skills-packaging`, `workflow_dispatch` manual; `Resolve account` → video dibangun → posting ke kedua platform). Environment `kali-aja` kosong (fallback repo secrets), `ai-labs` berisi 5 kunci AI Labs dan dipakai oleh job `build` serta `publish`.

**Akun `cerpenek` (aktif di cron sejak 2026-11-16).** Brand prefix `Cerpe` + accent `nek`, `categoryId` `27`, `madeForKids: true`, voice `id-id-storyteller-1`. Buffer organization `6af9a85ef0ed12641d69eab4`, YouTube `6af9a8caece6dfde5fd19e00`, TikTok `6af9a8e0ece6dfde5fd19e93`. Urutan aktivasi: (1) GitHub Environment `cerpenek` berisi `BUFFER_ACCESS_TOKEN`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `GEMINI_API_KEY` (Slack boleh fallback ke repo secret); (2) tiga ID Buffer di `src/accounts.ts` (sudah); (3) setel audiens channel YouTube "untuk anak" di YouTube Studio; (4) `gh workflow run video-run --ref main -f account=cerpenek -f dry_run=true`; (5) tambahkan `cerpenek` ke `ACCOUNTS` di `ops/cloudflare-cron/wrangler.toml` dan deploy ulang worker (sudah). Backlog `ops/topics/cerpenek.md` diisi ulang kira-kira sebulan sekali lewat PR yang ditinjau pemilik channel.

**Akun `sastra-mesin` (masuk cron).** Brand prefix `Sastra ` + accent `Mesin`, `categoryId` `27`, `madeForKids: false`, voice `id-id-tutor-1`, tema 3D `blueprint`. Buffer organization `6afdf08dd10011a8be72ed75`, YouTube `6afdf52fece6dfde5f101631`, TikTok `6afdf54bece6dfde5f101af0`, Instagram Reels `6afe07c2ece6dfde5f116be8` (memakai `instagramCaption`, fallback ke `tiktokCaption` tersanitasi bila absen). Urutan aktivasi: (1) ID Buffer di `src/accounts.ts` (sudah); (2) GitHub Environment `sastra-mesin` (sudah); (3) tiga track instrumental `public/sastra-mesin/music/{rakit,aliran,rahasia}.mp3` (sudah); (4) `sastra-mesin` masuk ke `ACCOUNTS` di `ops/cloudflare-cron/wrangler.toml` (deploy ulang worker dengan `npx wrangler deploy --config ops/cloudflare-cron/wrangler.toml`).

**"Made for kids" per akun.** `madeForKids` di `src/accounts.ts` menentukan nilai yang dikirim ke YouTube di setiap post (`youtubeMetadata` di `scripts/publish-lib.mts`); `kali-aja` dan `ai-labs` = `false`. Akun yang ditujukan untuk anak memakai `true` — akibatnya komentar dan notifikasi mati di video itu — dan audiens channel juga disetel "untuk anak" di YouTube Studio. TikTok tidak punya setelan setara.

Publikasi tetap per akun: `npm run publish -- <slug>` membaca `account` dari `src/videos/<slug>/publish.json`; `--account <id>` (opsional) hanyalah cross-check dan menolak kalau tidak cocok. Hal yang sama berlaku untuk `scripts/fetch-published-videos.mts --account` dan `scripts/check-duplicates.mts --db`.

## Jadwal tayang

Buffer free membatasi post YouTube maksimal 2×/hari per channel (`LimitReachedError: … maximum number of posts YouTube allows in a day (2)`). Karena itu: 2 run/hari per akun, satu video per slot, ditayangkan serentak di semua platform (YouTube, TikTok, Instagram\*) pada jam tetap (WIB). Sumber kebenaran: `SLOT_TIMES` di `scripts/publish-lib.mts`.

| Slot (run mulai) | YouTube | TikTok | Instagram* |
|---|---|---|---|
| siang (09:00) | 12:00 | 12:00 | 12:00 |
| malam (16:00) | 19:00 | 19:00 | 19:00 |

\* hanya akun dengan `instagramChannelId`.

- Slot ditetapkan di awal run (`scripts/slot.mts`, job `build`) dan diteruskan ke `npm run publish -- <slug> --slot <s> --date <YYYY-MM-DD>`; tanpa flag, publish memakai slot berikutnya dari jam sekarang.
- Jam tayang yang sudah lewat saat publish → platform itu `shareNow` (tidak gagal).
- Publish selesai begitu Buffer menerima semua post (`scheduled`); hanya post `shareNow` yang dipoll. Slack melaporkan jam tayang, link menyusul di Buffer.
- Run manual tambahan di slot yang sama membuat post kedua (YouTube bisa kena limit lagi) — sengaja tidak diblokir.
- Aset Cloudinary tidak dihapus: Buffer mengambilnya saat jam tayang.

## Step 1 — Host the MP4 (Cloudinary signed upload)

Shorts go to `shorts/YYYY-MM-DD/<slug>`, resource type **video**.

```bash
set -a; source .env; set +a
TS=$(date +%s)
PUB="shorts/2026-11-11/<slug>"
SIG=$(printf 'public_id=%s&timestamp=%s%s' "$PUB" "$TS" "$CLOUDINARY_API_SECRET" | sha1sum | cut -d' ' -f1)   # params sorted alphabetical, joined by &, NO trailing &
curl -sS -m 300 -X POST "https://api.cloudinary.com/v1_1/$CLOUDINARY_CLOUD_NAME/video/upload" \
  -F "file=@out/<slug>-final.mp4" -F "public_id=$PUB" -F "timestamp=$TS" \
  -F "api_key=$CLOUDINARY_API_KEY" -F "signature=$SIG"
```

Checks: response `bytes` must equal the file size (`ls -la out/<slug>-final.mp4 | awk '{print $5}'`); `resource_type` must be `video`. URL format: `https://res.cloudinary.com/<cloud>/video/upload/v<version>/<public_id>.mp4`.

## Step 2 — Create the post(s) (Buffer **GraphQL**)

⚠️ Do NOT use `api.bufferapp.com` / the v1 REST API: it rejects these tokens (`Public API tokens are not accepted for REST API access`; retired 2027-02-01). ⚠️ Do NOT try `{ me }` or `channels(...)`: the token lacks `account:read`; both fail with "Insufficient scope". Verification happens via the post object and `post(input:)` polling instead.

```bash
curl -sS -m 60 -X POST https://api.buffer.com/graphql \
  -H "Authorization: Bearer $BUFFER_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d @payload.json
```

`payload.json` for YouTube (adjust `text`, `title`):

```json
{
  "query": "mutation($input: CreatePostInput!) {\n  createPost(input: $input) {\n    __typename\n    ... on PostActionSuccess { post { id status channelService sharedNow externalLink } }\n    ... on NotFoundError { message }\n    ... on UnauthorizedError { message }\n    ... on UnexpectedError { message }\n    ... on InvalidInputError { message }\n    ... on LimitReachedError { message }\n    ... on RestProxyError { message }\n  }\n}",
  "variables": { "input": {
    "channelId": "6aedb753e29c69a171803f6e",
    "mode": "customScheduled",
    "dueAt": "<ISO UTC jam tayang, mis. 2026-11-21T05:00:00.000Z = 12:00 WIB>",
    "schedulingType": "automatic",
    "needsApproval": false,
    "text": "<deskripsi>",
    "assets": [{ "video": { "url": "<cloudinary-url>" } }],
    "metadata": { "youtube": {
      "title": "<judul ≤ 100 karakter — Tanpa \"| 11.ai\" untuk VO Gemini; WAJIB diakhiri \"| 11.ai\" untuk VO ElevenLabs-Free>",
      "categoryId": "27",
      "privacy": "public",
      "madeForKids": false,
      "isAiGenerated": true,
      "notifySubscribers": true
    } }
  } }
}
```

TikTok — same mutation with:
- `channelId`: `6aedb7fee29c69a171804662`
- `metadata`: `{ "tiktok": { "isAiGenerated": true, "title": "<hook singkat>" } }`
- `text`: caption hook + CTA + sumber + "Suara: AI (Google AI Studio)" + hashtags

Instagram Reels (accounts with optional `instagramChannelId`, i.e. `kali-aja`, `ai-labs`, `sastra-mesin`) — same mutation with:
- `channelId`: per account (`6aed5544e29c69a1717ba62e` / `6af92062ece6dfde5fcba082` / `6afe07c2ece6dfde5f116be8`)
- `metadata`: `{ "instagram": { "type": "reel", "shouldShareToFeed": true, "isAiGenerated": true } }`
- `text`: `instagramCaption` (≤ 2,200 chars, fallback to sanitized `tiktokCaption` when absent; `#shorts`/`#short`/`#fyp`/`#tiktok` stripped automatically by `instagramCaptionFor`)

Terjadwal vs sekarang: `mode: "customScheduled"` + `dueAt` (ISO UTC) menjadwalkan — ini yang dipakai `npm run publish`; `mode: "shareNow"` menayangkan langsung (dipakai bila jam tayang sudah lewat). To hold for review: drop `mode` (or `saveToDraft` — see enums `ShareMode`: `shareNow | shareNext | addToQueue | customScheduled`) and set `"saveToDraft": true`.
- Error union (`PostActionPayload`): `PostActionSuccess | NotFoundError | UnauthorizedError | UnexpectedError | RestProxyError | LimitReachedError | InvalidInputError` — every error branch carries **one** `message` field. Non-200 → stop and report; do not retry blindly.
- Success path returns `post { id status channelService sharedNow externalLink }`. `status: "sent"` for YouTube usually comes back immediately with the link; TikTok sits at `"sending"` for minutes.

## Step 3 — Verify

```json
{ "query": "{ post(input: { id: \"<post-id>\" }) { id status externalLink sharedNow channelService } }" }
```

IMPORTANT: `Query.post` takes an **input object** (`PostInput { id: PostId! }`), NOT a bare `id:` argument — `post(id: "...")` fails with "Unknown argument \"id\"". Poll until `status == "sent"` (externalLink filled) or `"error"`. For TikTok this typically takes 1–5 minutes. Post terjadwal berstatus `scheduled` sampai jam tayang; `npm run publish` tidak menunggunya.

## Step 3.5 — Notify Slack (optional but usual)

Autopilot uses the `slack_send_message` MCP tool when available. Without it, the Web API works with `SLACK_BOT_TOKEN` (xoxb-…, `chat:write`) and `SLACK_SOCIAL_CHANNEL_ID` (#social, `C0CDV7Y555K`):

```bash
curl -sS -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" -H "Content-Type: application/json" \
  -d '{"channel":"'"$SLACK_SOCIAL_CHANNEL_ID"'","text":"<ringkasan + YouTube + TikTok links>","unfurl_links":false}'
```

Success: `{ "ok": true, "channel": "C0CDV7Y555K", "ts": "..." }` (a harmless `missing_charset` warning may appear).

## Step 4 — Done — committed catalog

Video source is not committed: source lives only in the CI VM and is discarded when the job ends. CI fetches Buffer history (post `sent` **dan** `scheduled`) into `/tmp/published-videos-<account>.json` for duplicate/republication checks; nothing from it is committed or preserved. The publish command fetches Buffer again before uploading and refuses a candidate that matches a live or scheduled post.

**Retry setelah publish setengah gagal:** kalau sebagian `createPost` sudah sukses (post live **atau masih terjadwal**) tapi platform lain gagal/timeout, pipeline berhenti dengan error. Menjalankan ulang akan **menolak** video yang sama karena kandidatnya cocok dengan post yang sudah live/terjadwal di Buffer. Pulihkan dengan salah satu: (a) di Buffer, hapus semua post video itu (termasuk yang masih terjadwal) lalu jalankan lagi, atau (b) buat post platform yang gagal manual lewat Buffer. Tidak ada jalur otomatis yang melanjutkan hanya sisi TikTok — jika Anda butuh itu, buat issue/request terlebih dulu.

## Content requirements (not negotiable for this channel)

- Title ≤ 100 chars; `| 11.ai` suffix ONLY for ElevenLabs-Free VO (its ToS). Gemini/other VO: no suffix.
- Description (YouTube): 2–3 kalimat ringkasan + CTA `Mau dibongkar apa lagi? Tulis di komentar.` + `Sumber: …` + "Animasi bersifat ilustrasi. Suara: AI (Google AI Studio)" + hashtag (`#shorts` + 5–6 topik). CategoryId `27` (Education). `isAiGenerated: true`, `madeForKids` per akun (`false` untuk dua akun ini), `notifySubscribers: true`, `privacy: "public"`.
- YouTube menolak `<` dan `>` di judul dan deskripsi (`InvalidInputError`), dan deskripsi maks 5.000 byte. `npm run publish` otomatis mengganti keduanya dengan `＜` / `＞`; kalau posting manual lewat GraphQL, ganti sendiri atau tulis "lebih dari" / "kurang dari".
- Caption (TikTok): hook + CTA + sumber + `Suara: AI (Google AI Studio)` + hashtag yang sama.
- Caption (Instagram Reels): baris 1 hook penarik klik `"... more"` + ringkasan keyword pencarian IG + 1 CTA Save/Share/pertanyaan komentar spesifik + `Sumber: …` + `Animasi bersifat ilustrasi. Suara: AI (Google AI Studio)` + 3–5 hashtag niche tanpa `#shorts`/`#fyp` (≤ 2.200 chars).
- Video file: 1080×1920, 30 fps, h264 + AAC, durasi ≈ `timeline.dur`; loudness −14 LUFS (sudah termasuk di `-af loudnorm=I=-14:TP=-1.5:LRA=11`); `notification` scheduling hanya kalau halaman upload sengaja menunggu approval.
- If in doubt on quality/facts but the video is complete: `saveToDraft: true` + report. If not complete: do NOT post.

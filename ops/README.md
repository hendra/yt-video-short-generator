# ops — CI: Cloudflare cron → GitHub Actions (hosted) → pipeline video

Chain: **Cloudflare Worker** (cron 2×/hari 09:00/16:00 WIB → tayang terjadwal jam 12:00 & 19:00 WIB untuk semua platform, lihat `docs/PUBLISHING.md` § Jadwal tayang) → `repository_dispatch` **sekali per akun** (`kali-aja`, `ai-labs`) → **GitHub-hosted `ubuntu-latest`** → workflow `.github/workflows/video.yml` → fetch katalog Buffer (per akun) ke `/tmp/published-videos-<akun>.json` → agent (opencode, free model) + duplicate gate → gates (lint/test/bundle/still-per-shot) → render (`--gl=swangle`, 4 runner paralel) → gabung + audio + loudnorm → publish (Cloudinary → Buffer YouTube + TikTok + IG, terjadwal) → Slack #social. Video source tidak di-commit; katalog tidak di-commit dan hanya di-fetch ke `/tmp` saat CI.

Repo **public** (wajib untuk free hosted minutes; unlimited). Tidak ada runner self-hosted — PC lokal bebas.

## Susunan job

| Job | Isi | Secret |
|---|---|---|
| `build` | resolve akun (gagal cepat kalau belum dikonfigurasi) → fetch katalog Buffer per akun ke `/tmp/published-videos-<akun>.json`, agent membuat video, account gate (video milik akun + brand yang benar), duplicate gate dari file itu, gates, still per shot, bundle → artifact `bundle` (situs Remotion lengkap + `public/`) dan `meta` (`publish.json`, `naskah.txt`) | agent hanya `GEMINI_API_KEY`; `BUFFER_ACCESS_TOKEN` hanya untuk step fetch katalog |
| `render` ×4 (matrix `shard`) | tiap runner merender seperempat frame, **tanpa audio** (`--frames=a-b --muted`) → artifact `chunk-<i>` | tidak ada |
| `publish` | render audio sekali (`audioOnly`, < 1 menit), sambung chunk tanpa encode ulang + audio + loudnorm, cek jumlah frame, Fetch Buffer lagi lalu tolak near-duplicate, publish, lalu laporan sukses | Cloudinary, Buffer, Slack |
| `report-failure` | jalan hanya kalau ada job gagal; checkout bersih → Slack #social dengan nama step/job yang gagal | Slack |

Kenapa dipecah: render CPU sudah memakai semua core (`--concurrency` tidak berpengaruh), jadi satu-satunya cara mempercepat adalah menambah mesin. Jumlah shard = `env.SHARDS` **dan** daftar `matrix.shard` di workflow — ubah keduanya bersamaan. Audio dirender terpisah karena potongan AAC tidak bisa disambung tanpa celah.

## Komponen

| Apa | Di mana |
|---|---|
| Worker (weker) | `ops/cloudflare-cron/worker.js` — ter-deploy di akun CF; crons di `wrangler.toml` |
| Runner | GitHub-hosted `ubuntu-latest` (swangle-only, tidak ada GPU); render dibagi ke 4 runner paralel |
| Workflow | `.github/workflows/video.yml` — `repository_dispatch[video-run]` (+ `client_payload.account`) dan `workflow_dispatch` (manual, opsional input `slug`, `dry_run`, `account`); concurrency group per akun |
| Publish | `scripts/publish.mts` (`npm run publish -- <slug>`) — Cloudinary signed upload → Buffer GraphQL; publish fetch Buffer lagi sebelum upload dan menolak kandidat yang sudah dekat dengan post live |
| Report | `scripts/report.mts` (`npm run report -- <slug>`) — Slack #social; otomatis membaca links dari `/tmp/publish-result.json` bila `--links` kosong |
| Publikasi history | `scripts/fetch-published-videos.mts` — fetch seluruh post Buffer sent ke `/tmp/published-videos-<akun>.json` (org + channel ID per akun dari `src/accounts.ts`); dipakai duplicate gate dan publish-time check; tidak di-commit |
| Agent | `ops/ci-prompt.md` — opencode, `--model opencode/deepseek-v4.1-flash-free` |

## Setup sekali jalan (baru)

1. **Repo → public** (Settings → Danger Zone). Jangan di-public-kan bila ada secret di tree/history — cek dulu: `git ls-files | grep -E '(^|/)\.env($|\.)|\.key$|secret|service-account'` harus bersih.
2. **Secrets GitHub Actions** (Settings → Secrets and variables → Actions). Repo secrets yang sudah ada **tidak disentuh** — tetap dipakai Kali Aja, sekaligus jadi *fallback* AI Labs: `GEMINI_API_KEY`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `BUFFER_ACCESS_TOKEN`, `SLACK_BOT_TOKEN`, `SLACK_SOCIAL_CHANNEL_ID`. Tidak ada prefix `AI_LABS_*`; semua kunci memakai nama yang sama di level repo dan environment.
   **Wajib: buat dua GitHub Environments** (Settings → Environments → New environment; salah satunya harus ada karena job `build` dan `publish` mereferensi `environment:` sesuai id akun — **environment yang tidak ada membatalkan run**): `kali-aja` (boleh kosong) dan `ai-labs` (isi hanya kredensial khusus AI Labs). Environment secrets menimpa repo secrets dengan nama yang sama; kalau environment tidak meng-set suatu secret, otomatis dipakai repo secret. Jadi AI Labs boleh tidak setup apa-apa (kredensial Kali Aja dipakai — termasuk kuota TTS sama) atau hanya beberapa kunci (mis. `GEMINI_API_KEY` di environment `ai-labs` untuk kuota TTS terpisah).
   AI Labs juga butuh 3 ID Buffer di `src/accounts.ts` (lihat `docs/PUBLISHING.md`).
3. **`VIDEO_SHORT_PAT`** (fine-grained, repo `hendra/yt-video-short-generator`, minimal **Contents: write**) → Cloudflare Worker secret (`npx wrangler secret put VIDEO_SHORT_PAT`) — dipakai Worker untuk memicu dispatch.
4. **Worker deploy**: `npx wrangler deploy --config ops/cloudflare-cron/wrangler.toml` (butuh `CF_ACCOUNT_ID` + `CF_API_TOKEN` dengan izin Workers Scripts:Edit). Cron dipicu 2×/hari (09:00 & 16:00 WIB, 3 jam sebelum tayang); setiap tick dispatch **sekali per akun** (`ACCOUNTS` di `wrangler.toml`).
5. opencode tidak perlu dipasang manual — workflow meng-install sendiri via `https://opencode.ai/v2/install` pada path autopilot.

## Trigger manual

Autopilot (agent bikin video baru):

```bash
gh workflow run video-run --ref main                    # channel Kali Aja
gh workflow run video-run --ref main -f account=ai-labs # channel AI Labs
```

Channel ketiga `cerpenek` (dongeng anak) sudah terkonfigurasi (ID Buffer + environment `cerpenek`) dan **sudah masuk cron** sejak 2026-11-16 — catatan aktivasi di `docs/PUBLISHING.md`.

Channel keempat `sastra-mesin` (cara kerja benda sehari-hari, tema 3D `blueprint`) sudah terkonfigurasi dan masuk `ACCOUNTS` di `ops/cloudflare-cron/wrangler.toml` (deploy ulang worker dengan `npx wrangler deploy --config ops/cloudflare-cron/wrangler.toml` agar aktif di Cloudflare).

### Channel kelima `upwayyy` — belum aktif, belum di cron

`upwayyy` (lore game horor baru di atas cuplikan trailer Steam, `mode: "footage"`) sudah terdaftar di `src/accounts.ts` + `video.yml` dengan ID Buffer `TODO_`. Karena itu resolve akun gagal sampai siap. Urutan setup:

1. Sambungkan YouTube **dan** TikTok Upwayyy ke Buffer, ambil org id + kedua channel id, isi `buffer` di `src/accounts.ts` (ganti semua `TODO_`).
2. Buat GitHub Environment `upwayyy`, isi secret Buffer/Cloudinary/`GEMINI_API_KEY` untuk channel ini (repo secrets tetap jadi fallback).
3. Taruh tiga track Suno milik user di `public/upwayyy/music/mencekam.mp3`, `misteri.mp3`, `klimaks.mp3` (di-commit seperti track channel lain; lisensi monetisasi butuh paket Suno berbayar saat dibuat).
4. Uji lewat `gh workflow run video-run --ref main -f account=upwayyy -f dry_run=true` sampai satu video utuh keluar. `npm run footage` butuh `ffmpeg` — sudah dipasang preflight CI.
5. **Baru setelah itu** tambahkan `upwayyy` ke `ACCOUNTS` di `ops/cloudflare-cron/wrangler.toml` lalu deploy worker. Sebelum itu channel ini hanya jalan manual.

### Channel keenam `mandor-bangunan` — TikTok-only, masuk cron

`mandor-bangunan` (konstruksi, gedung, jembatan, infrastruktur, dan proyek teknik sipil; gaya naskah, animasi 3D `cream`, dan suara `id-id-podcaster-1` disamakan dengan `kali-aja`) sudah terkonfigurasi di `src/accounts.ts` untuk **TikTok saja** (`orgId: 6b02ca2707e3daab8001434d`, `tiktokChannelId: 6b02cab28541f09ecb623894`) dan sudah masuk `ACCOUNTS` di `ops/cloudflare-cron/wrangler.toml`. Prasyarat sebelum tick cron berikutnya:

1. Buat GitHub Environment `mandor-bangunan` dan isi `BUFFER_ACCESS_TOKEN` khusus org ini (secret Cloudinary/Gemini/Slack fallback ke repo secret jika tidak diset).
2. Deploy ulang worker (`npx wrangler deploy --config ops/cloudflare-cron/wrangler.toml`).
3. Uji opsional via `gh workflow run video-run --ref main -f account=mandor-bangunan -f dry_run=true`.
4. Ketika YouTube / Instagram Reels siap nanti, cukup tambahkan `youtubeChannelId` / `instagramChannelId` di `src/accounts.ts`.

⚠️ Dispatch manual **tanpa `dry_run` adalah live run** — video akan benar-benar diposting ke YouTube + TikTok. Untuk rehearsal, pakai `-f dry_run=true` (lihat bawah). Video untuk `account=ai-labs` butuh isi `accounts.ts` (ID Buffer AI Labs — sudah terisi) dan environment `ai-labs` (sudah terpasang).

Render+publish video yang **sudah di-commit & push ke main** (mis. video yang kamu bangun sendiri, tanpa agent):

```bash
gh workflow run video-run --ref main -f slug=<slug>
```

Prasyarat manual path: video source `src/videos/<slug>/` harus ada di tree (tidak di-commit — generated di CI; untuk manual path kamu tambahkan sendiri sementara, boleh lewat `git add -f`, lalu hapus lagi), `public/<slug>/vo.mp3` ada di tree, dan `src/videos/<slug>/publish.json` harus berisi `"account"` yang sama dengan akun run ini (`kali-aja`, `ai-labs`, `cerpenek`, `sastra-mesin`, `upwayyy`, atau `mandor-bangunan`) — job `Account gate` menolak kalau tidak cocok dengan akun yang dipakai run ini. Untuk channel footage (`upwayyy`) `public/<slug>/clips/` juga gitignored, jadi jalankan `npm run footage -- <slug> --appid <id>` dulu sebelum render/dispatch manual. Buffer harus berisi publish sebelumnya karena duplicate/re-publish lookup di-fetch dari sana. Jalankan gates lokal dulu (`npm run lint && npm test`). Manual path tetap publish **for real** ke YouTube + TikTok kecuali `dry_run=true`; tidak ada katalog yang di-commit atau di-push.

Dry-run (semua langkah kecuali Publish + laporan sukses; MP4 final disimpan sebagai artifact `final-video` selama 3 hari):

```bash
gh workflow run video-run --ref <branch> -f dry_run=true
```

Pakai ini untuk menguji perubahan workflow sebelum merge. `repository_dispatch` (cron) tidak punya dry-run: **cron berikutnya adalah live run**.

## Kalau gagal

- **Agent/no-video**: agent exits non-zero but Discover/Gates still run. Jika tidak ada satu folder video baru, job gagal di "Discover slug"; kalau output parsial/rusak, job gagal di duplicate gate/gates/still per shot. Slack #social melaporkan. Tidak ada commit, tidak ada upload.
- **Resolve account gagal** (mis. `TODO_` placeholder atau environment hilang): job berhenti **sebelum** agent dan render dimulai — tidak ada video, tidak ada upload. Cek ID Buffer di `src/accounts.ts` + Settings → Environments (`kali-aja`, `ai-labs` harus ada).
- **`Account gate` gagal**: video yang dihasilkan tidak cocok dengan akun run (mis. `publish.json.account` ≠ akun run, atau brand bukan milik akun itu di `src/videos/<slug>/index.ts`). Tidak ada upload/post.
- **Duplicate gate gagal**: kandidat terlalu mirip dengan post YouTube/TikTok yang tercatat di Buffer; ganti topik/angle/title dan jalankan ulang. Jangan cukup ubah beberapa kata.
- **Agent install gagal**: step "Install opencode" gagal → failure report ke Slack, publish tidak jalan. Installer upstream `opencode.ai/v2/install` berubah/mati → pin ulang URL atau pasang via npm `@opencode/cli`.
- **Quota**: opencode free model menolak/rate-limit → publish tidak terjadi; coba lagi lewat `workflow_dispatch` nanti.
- **Satu shard render gagal** → shard lain dibatalkan (fail-fast), `publish` dilewati, Slack melaporkan `render`. Re-run job yang gagal saja dari UI Actions selama artifact `bundle` masih ada (1 hari).
- **`assemble` gagal dengan "assembled video has N frames, expected M"** → ada chunk yang tidak lengkap; jangan publish manual, re-run job `render`.
- **Publish selesai tetapi laporan/network gagal**: video sudah tayang; publish step menulis `/tmp/publish-result.json` untuk report. Jangan re-run buta; cek YouTube/TikTok dan Buffer. Publish juga menolak kandidat yang terlalu mirip dengan post live sebelum upload.

## Regenerate

| Yang habis | Cara |
|---|---|
| `VIDEO_SHORT_PAT` | GitHub → Settings → Developer settings → Fine-grained PAT → generate (Contents: write) → `npx wrangler secret put VIDEO_SHORT_PAT --config ops/cloudflare-cron/wrangler.toml` |
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey → set GitHub secret `GEMINI_API_KEY` kembali |
| Buffer/Cloudinary/Slack keys | → GitHub secrets; `.env` kalau untuk run manual |

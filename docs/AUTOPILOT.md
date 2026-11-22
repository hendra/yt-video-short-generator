# Autopilot: 3D explainer Short → YouTube + TikTok + Instagram Reels

(Ada juga varian otomatis penuh via GitHub Actions — 6×/hari — lihat `ops/README.md`. Runbook ini berlaku untuk keduanya.)

Dibaca oleh scheduled task (Sen/Rab/Jum) dan oleh CI `video-run` (cron harian ×2: 09:00/16:00 WIB, tayang terjadwal jam 12:00 & 19:00 WIB untuk semua platform — lihat `docs/PUBLISHING.md` § Jadwal tayang). Ikuti persis. Bahasa konten: Indonesia santai-profesional. Zona waktu WIB.

> **Multi-akun:** dokumen ini adalah runbook khusus channel **Kali Aja Tau** (ID channel, brand, niche sains). Channel kedua **AI Labs** punya brief sendiri di `ops/accounts/ai-labs.md` + backlog topik di `ops/topics/ai-labs.md`; konfigurasi kedua channel ada di `src/accounts.ts`. CI menjalankan keduanya di slot yang sama, sekali per akun — AI Labs hanya lewat CI (bukan scheduled task lokal).

## 0. Konstanta

| | |
|---|---|
| Repo | `hendra/yt-video-short-generator` (branch `main`) |
| Channel | YouTube **Kali Aja Tau** `6aedb753e29c69a171803f6e` · TikTok **kaliajatau01** `6aedb7fee29c69a171804662` · Instagram **Kali Aja Tau** `6aed5544e29c69a1717ba62e` |
| Buffer org | `6aed53e7ec5c7c6d73f3e437` |
| Cloudinary | cloud `opqimovw`, folder `shorts/YYYY-MM-DD/<slug>` (resource type **video**) |
| Publish | Ikuti **`docs/PUBLISHING.md`** (upload → Buffer GraphQL → poll). Env keys wajib: `BUFFER_ACCESS_TOKEN` (scope posts:read + posts:write; tidak bisa list channels), `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — kalau .env tidak punya ini, video tidak bisa di-upload/post |
| TTS | **Gemini 3.8 Flash TTS** (`gemini-3.8-flash-tts`) lewat Google AI Studio — gratis, tanpa billing; env `GEMINI_API_KEY`. **Dikunci** ke voice library Indonesian male `id-id-podcaster-1` (Podcaster 1: Standard Indonesian, clear, confident, natural) dengan style pendek tetap `natural, warm, conversational`. Tidak ada fallback otomatis — kalau voice/model tidak tersedia, run berhenti dan lapor. `--provider` hanya menerima `auto|gemini`; voice tidak bisa diganti lewat `npm run tts`. `auto` = Gemini saja |
| Brand overlay | `{ prefix: "Kali Aja ", accent: "Tau" }` |
| Laporan | Slack **#social** `C0CDV7Y555K` (`slack_send_message`) |
| Contoh referensi | tidak ada — seluruh `src/videos/*/` digenerate di CI |

`GEMINI_API_KEY` diberikan oleh prompt scheduled task sebagai env var. **Jangan pernah** mencetak, meng-commit, atau menyertakannya di pesan/memory/Project. Tulis ke `.env` (sudah di-.gitignore) dengan `umask 077`. Keys lain (`BUFFER_ACCESS_TOKEN`, `CLOUDINARY_*`) **tidak** disuntik lewat prompt — di-copy manual oleh operator ke `.env` workspace sekali saja (lihat §1). **Operator juga wajib menambahkan `GEMINI_API_KEY` ke prompt scheduled task** (di luar repo ini) sebelum run berikutnya — kalau tidak, `npm run tts` akan gagal dan run berhenti.

## 1. Setup

```bash
# add_repo hendra/yt-video-short-generator (access: read — tidak ada yang di-push), lalu:
git clone https://github.com/hendra/yt-video-short-generator && cd yt-video-short-generator
npm ci
# workspace cloud: Node fetch harus lewat proxy + CA bundle (tanpa ini: ENOTFOUND untuk API TTS)
[ -n "$HTTPS_PROXY" ] && export NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt
umask 077; printf 'GEMINI_API_KEY=%s\n' "$KEY_DARI_PROMPT" > .env
# Sekali saja per workspace baru (keys tidak dari prompt, jangan dicetak di log):
printf 'BUFFER_ACCESS_TOKEN=%s\nCLOUDINARY_CLOUD_NAME=opqimovw\nCLOUDINARY_API_KEY=%s\nCLOUDINARY_API_SECRET=%s\n' "$BUFFER_KEY" "$CLOUDINARY_KEY" "$CLOUDINARY_SECRET" >> .env
# (BUFFER_ACCESS_TOKEN scope: posts:read+posts:write — tanpa account:read, channels tidak bisa di-list; channel ID di §0 / docs/PUBLISHING.md)
```
Render di workspace: `--browser-executable=/usr/bin/google-chrome --gl=swangle` (tanpa GPU, ±0,8 dtk/frame → 85 dtk video ≈ 35–40 menit; jalankan di background).

## 2. Tidak ada gerbang kuota

Tidak ada API kuota gratis untuk Gemini TTS. Kuota AI Studio gratis ±10 request/hari per model — cukup untuk 1–3 video/minggu (1 request = 1 video). Jika `npm run tts` gagal (429, kuota habis, voice/model tidak tersedia, atau analisis timing gagal): **berhenti**, jangan riset/render/publish. Jangan ganti voice, model, atau provider untuk memecahkan kegagalan. Laporkan ke Slack #social (§10): langkah gagal + error singkat.

## 3. Topik (riset hari ini)

- Cari topik "**kok bisa?**" sains/teknik/infrastruktur yang **ramai di Indonesia 1–3 hari terakhir** (berita proyek, fenomena alam, teknologi, rekor). **Jangan panggil WebSearch** — tool itu tidak tersedia dan akan membatalkan run setelah agent selesai. Gunakan `WebFetch` ke sumber asli (ANTARA, Kompas, Detik, CNBC Indonesia, dsb.). Kalau sumber yang dibutuhkan tidak bisa di-fetch, ganti topik atau berhenti.
- Bisa divisualkan sebagai **diorama 3D potongan/cutaway** dengan mekanisme bertahap (langkah 1-2-3).
- **Jangan membuat ulang video**: `/tmp/published-videos-<account>.json` adalah snapshot seluruh sent post YouTube + TikTok dari Buffer yang dibuat CI sebelum agent (untuk channel ini: akun Kali Aja). Alihkan ke topik/angle/title yang jelas berbeda; gate deterministik `npx tsx scripts/check-duplicates.mts <slug> --db /tmp/published-videos-kali-aja.json` wajib lolos sebelum render/publish. Kalau hampir mirip, jangan "sedikit ubah judul" — ganti topik atau sudut pandang.
- **Aman:** tidak ada tragedi/korban, politik partisan, SARA, klaim medis/keuangan. Bencana boleh hanya sebagai sains netral tanpa korban.
- Setiap angka harus dari sumber yang dibaca; angka turunan dihitung dengan Python. Fakta tak terverifikasi → buang atau ganti topik.

## 4. Naskah — `src/videos/<slug>/naskah.txt`

- Format baris `NN  teks` (10–14 baris), **maksimal 130 kata** (≈ 45–55 detik; `npm run tts` menolak naskah > 130 kata sebelum memanggil Gemini). Baris `NN  teks` tetap sama; **format naratif** tidak boleh dikunci ke satu pola.
- **Format harus diacak setiap run**: sebelum menulis, jalankan `npx tsx scripts/pick-format.mts` dan pakai format yang dipilih. Jangan mengganti pilihan karena "lebih enak". Di `publish.json`, tulis `catatan` dimulai dengan `format: <id>;`.
- Pool yang dipakai (format populer/favorit YouTube Shorts + TikTok 2026; dibobot sesuai performa): `expert-explainer` (paling kuat untuk edukasi), `how-to-tutorial`, `numbered-listicle`, `myth-buster`, `mystery-story`, `before-after`, `storytime`, `qa-rapid`, `viewer-challenge`, `problem-solution`, `mini-documentary`.
- Semua format mengikuti 4 babak: **hook** (0–4 dtk, kontradiksi + angka spesifik/paradoks, tanpa basa-basi seperti "Tahukah kamu…"/"Bayangkan…") → **konteks cepat + re-hook** (≤ 2 kalimat, ditutup pertanyaan baru) → **twist + re-hook** (fakta paling mengejutkan disimpan di sini, bukan di tengah) → **ending loop**. Satu ide per video, konteks Indonesia.
- **Ending loop, tanpa CTA:** dilarang "jangan lupa subscribe", "tulis di komentar", "sampai jumpa". Kalimat terakhir menggantung dan menyambung secara tata bahasa ke kalimat pertama, jadi saat video berputar ulang terdengar satu kalimat utuh. Cek dengan membaca `[baris terakhir] + [baris pertama]` berurutan.
- Jangan pakai template lama `hook → "Tapi tunggu… kok bisa…?" → langkah 1/2/3 → "Jadi…"` setiap kali; variasikan sintaks kalimat, urutan bukti, dan jenis opening sesuai format.
- `expert-explainer`: authority/number hook → mekanisme → implikasi. `how-to-tutorial`: janji hasil → 3 langkah → kesalahan umum. `numbered-listicle`: janji angka → 3 poin bukti → punchline. `myth-buster`: miskonsepsi → bukti → kenapa salah. `mystery-story`: fakta mustahil → petunjuk → reveal. `before-after`: asumsi → bukti mengejutkan → mekanisme → mental model baru. `storytime`: turning point → urutan fakta → pelajaran/konsekuensi. `qa-rapid`: pertanyaan → jawaban salah yang menggoda → jawaban benar. `viewer-challenge`: tebakan nyata → jawaban → aturan berpikir. `problem-solution`: masalah → mekanisme → benefit/batasan. `mini-documentary`: scene → turning point → consequence.
- Kalimat lisan, santai ("nggak", "kayak"), angka ditulis dengan kata ("dua puluh delapan meter"). Kata hati-hati untuk temuan awal ("diduga", "menurut…").

## 5. Suara + timing

```bash
npm run tts -- <slug>        # vo.mp3 + alignment.json (Gemini 3.8 locked voice; jeda dipotong otomatis ≤ 0,2 dtk, ekor 0,05 dtk; timing dari aligner offline, ±0,2 dtk/kata)
npm run timeline -- <slug>   # caption + rentang shot
npm run music -- <slug>      # musik latar dari koleksi Kali Aja sesuai field "music" di config.json
```
Cek `timeline.json`: semua kata ter-match, durasi 45–55 dtk. Jika TTS gagal (kunci salah, 429, kuota habis, voice/model tidak tersedia, atau analisis timing gagal): **berhenti dan laporkan** (§10) — jangan coba berulang-ulang, jangan ganti voice/model/provider. Audio gagal menyimpan take segar di `os.tmpdir()/vo-<slug>-failed.mp3`; `vo.mp3`/`alignment.json` lama tidak tersentuh.

## 6. Adegan 3D — pola scene

File: `config.json` (shot → baris pertama, `tail` **≤ 0,3** dtk agar video langsung loop — gate CI menolak lebih dari itu, dan `"music"` wajib salah satu dari `"teknik"` untuk mekanisme teknik/infrastruktur, `"misteri"` untuk teka-teki *"kok bisa?"*/myth-buster, atau `"fenomena"` untuk fenomena alam/sains skala besar), `state.ts` (semua animasi = fungsi murni dari `t`, terikat `L(n)`), `world.ts` (diorama dibuat sekali, `update(t)` per frame), `shots.ts` (label, judul `*hijau*`, kamera keyframe, callout, chip), `index.ts` (`music: { src: "<slug>/music.wav", volume: 0.14 }`), lalu daftarkan di `src/videos/registry.ts`.

Supaya setiap objek tampak nyata (bukan kotak polos), bangun adegan dari `Kit` (`src/engine/kit.ts`):
- **Cahaya:** panggil `kit.lights()` sekali di `createWorld` (matahari hangat + bayangan lembut + langit/pantulan tanah). Jangan menambah `AmbientLight`/`DirectionalLight` sendiri. `reach` = setengah lebar area yang perlu bayangan (default 16).
- **Bentuk:** `kit.box(...)` (tepi membulat), `kit.cyl(x, y0, z, r, h, mat)` untuk pipa/tiang/tangki, `kit.ball(x, y, z, r, mat)`; prefab `kit.house/tree/worker`. Bentuk khusus boleh `new Mesh(...)`, tapi benda bulat minimal 16 segmen.
- **Material:** `kit.mat(warna, "matte" | "gloss" | "metal" | "glass" | "water")` — beton/tanah/kayu = `matte` (default, bertekstur halus), plastik/cat = `gloss`, baja/pipa = `metal`, kaca/panel = `glass`, air = `water`.
- **Gerak:** benda yang mendarat/muncul pakai `spring(u)`, benda jatuh pakai `drop(u)`, goyangan diam (daun, kabel, benda mengapung) pakai `sway(t, seed)` — semuanya di `engine/math.ts`, murni fungsi `t`. Hindari gerak linear kaku.
- Jangan pakai environment map, bump map, atau post-processing: di render CPU (CI) biayanya 3× lipat.

Standar kualitas (pelajaran dari video sebelumnya):
- **Koreografi per baris (wajib).** Setiap shot mengikat animasinya ke baris yang sedang diucapkan, bukan satu `ramp` panjang sepanjang shot. Pakai helper di `engine/math.ts`:
  ```ts
  import { beat, between, pulse, stepIndex } from "../../engine/math";
  const on = beat(t, L(4));               // 0 sebelum baris 4, naik halus ke 1 saat baris itu mulai
  const hi = pulse(t, L(4));              // 1 hanya selama baris 4 diucapkan
  const openU = between(t, L(4), L(6));   // 1 dari awal baris 4 sampai akhir baris 6
  const step = stepIndex(t, [L(4), L(5), L(6)]); // 0,1,2 — langkah mana yang sedang dibahas

  valve.rotation.z = on * 1.2;            // bagian mulai bergerak saat barisnya diucapkan
  pipeGlow.emissiveIntensity = hi * 0.8;  // bagian yang dibahas menyala selama barisnya
  kit.cutaway([casing], openU, [0, 0, 2.4]); // cangkang terbuka selama dua baris itu
  const activePart = parts[Math.max(0, step)]; // langkah maju satu per satu
  activePart.position.y = hi * 0.12;
  ```
  Setiap shot **wajib** punya minimal satu bagian yang bergerak nyata sepanjang shot (gerigi berputar, `flowDots` mengalir, cangkang `kit.cutaway` bergeser, atau material `kit.glowMat` berdenyut). Kamera saja tidak cukup — gate CI menolaknya.
- **Bagian mekanis siap pakai:** `kit.tube(points, r, mat)` (pipa/kabel/wire melengkung; `at(u)` untuk menempelkan objek di jalurnya), `kit.flowDots(points, count, color, { speed })` (partikel mengalir di jalur; panggil `dots.update(flowPhase(t, L(n)))` supaya aliran makin cepat saat dijelaskan — **jangan** `dots.update(t * rate)`, itu membuat partikel melompat mundur), `kit.gear(x, y, z, { teeth, axis })` (putar `rotor.rotation[axis]`), `kit.fan(...)` (baling-baling/turbin, `rotor`), `kit.coil(...)` (pegas/kumparan pemanas), `kit.arrow(from, to, mat)` (vektor gaya/panas; `setProgress(u)`), `kit.ring(...)` (flens/seal).
- **Cutaway & sorotan:** `kit.cutaway([...parts], openU, [dx, dy, dz])` menggeser cangkang luar dan menyembunyikannya saat `openU >= 0.99`; `kit.glowMat(color, emissive)` adalah material **tanpa cache** untuk bagian yang menyala — set `mat.emissiveIntensity = pulse(t, L(n)) * 0.8`. Jangan mengubah material dari `kit.mat()` karena material itu dipakai bersama.
- **Kamera bergerak per bit:** `keyframes` minimal dua posisi, lalu beri dorongan halus saat baris penting:
  ```ts
  import { focusOffset, keyframes } from "../../engine/math";
  import type { Vec3 } from "../../engine/types";
  const base = keyframes(ctx, "s3", [[[0, 5, 10], [0, 1, 0]], [[0, 5, 8], [0, 1, 0]]] as [Vec3, Vec3][]);
  const camera = (t: number) => focusOffset(base(t), t, [{ at: L(6).s, offset: [0, 0.4, -1.4] as Vec3 }]);
  // `camera` dipakai sebagai field shot:
  const shots = { s3: { label: "ALIRAN 03", title: "Air *naik*", camera } };
  export default shots;
  ```
- **Potongan tanah (cut face) di z = 0**, tanah dalam (BOT ≈ −11) supaya separuh bawah frame tidak kosong; strata warna + titik air.
- Frame **potret**: FOV 44, objek utama mengisi ≥ 50% lebar; diorama yang memanjang diputar agar memanjang ke arah kamera.
- 1 shot ≈ 1–2 baris naskah (8–12 shot). Setiap shot punya gerak nyata (bukan still).
- Callout menunjuk objek 3D (anchor), maks 3 per shot, varian `orange` untuk fokus, `red` untuk bahaya.
- **Tidak boleh ada teks bertumpuk.** `Overlays.tsx` otomatis: label dijauhkan satu sama lain (jarak ≥ 16 px), tetap di bawah header/chip/CTA dan di atas zona caption (y < 1242); anchor di luar zona dipin ke tepi tanpa titik; label yang tetap tak muat disembunyikan. Jadi rancang anchor agar berada **di dalam zona** (antara bawah header dan y ≈ 1240) — kalau tidak, label bisa hilang atau garisnya menunjuk ke tepi. Caption: satu potongan (≤ 3 token; rangkaian angka tertulis yang dieja tidak dipecah, jadi bisa lebih dari 3 kata) per saat, tidak pernah dua sekaligus. Caption dua baris harus punya jarak antarbaris yang jelas (card `inline-block`, line-height 1.32 di `Overlays.tsx`, jangan diubah).
- Partikel kecil (r ≤ 0,05) di close-up; sembunyikan yang menghalangi kamera.
- Diorama skematis (peta, jalur) diberi `tag: "ILUSTRASI"`.
- Shot terakhir: aerial/orbit hangat, tanpa CTA; frame terakhirnya sebaiknya mendekati framing shot pertama agar loop mulus. Pergantian shot 3D otomatis diberi gerak kamera 0,3 dtk (tidak perlu diatur).
- Ganti visual setiap 2–3 dtk: tiap shot (≈ 5 dtk) butuh minimal satu `focusOffset` cue atau peristiwa animasi di tengahnya.

## 7. Verifikasi sebelum render penuh

```bash
npm run lint && npm test
npx remotion bundle --out-dir /tmp/rbundle
npx remotion still /tmp/rbundle <slug> /tmp/s_<f>.jpg --frame=<f> --browser-executable=/usr/bin/google-chrome --gl=swangle --image-format=jpeg
```
Render 1 still per shot di momen terpadat, gabung jadi contact sheet, **lihat dengan Read**: teks terbaca, **tidak ada label/caption/header yang saling menimpa**, tidak ada label yang hilang karena anchor di luar zona, objek utama jelas. Perbaiki maks 3 iterasi.

## 8. Render + finishing

```bash
npx remotion render /tmp/rbundle <slug> out/<slug>.mp4 --browser-executable=/usr/bin/google-chrome --gl=swangle --log=error   # background
ffmpeg -i out/<slug>.mp4 -c:v copy -af loudnorm=I=-14:TP=-1.5:LRA=11 -ar 48000 -c:a aac -b:a 192k -movflags +faststart out/<slug>-final.mp4
```
Cek: durasi ≈ `timeline.dur`, 1080×1920, ada audio, loudness ≈ −14 LUFS, 8–12 frame sampel terlihat benar.

## 9. Publish — ikuti `docs/PUBLISHING.md`

Ringkas jalurnya (detail di file itu, sudah teruji 2026-11-11):
1. Upload MP4 final ke Cloudinary (signed upload, `shorts/YYYY-MM-DD/<slug>`); cek `bytes` == ukuran file.
2. Buffer **GraphQL** `createPost` (bukan REST — token di .env hanya berlaku GraphQL): YouTube channel `6aedb753e29c69a171803f6e`, TikTok `6aedb7fee29c69a171804662`, Instagram `6aed5544e29c69a1717ba62e`. `mode: "shareNow"` (atau `customScheduled` via `npm run publish`), `schedulingType: "automatic"`, `needsApproval: false`.
3. `metadata.youtube`: `title` ≤ 100 karakter (tanpa `| 11.ai` untuk VO Gemini; **diakhiri** `| 11.ai` untuk VO ElevenLabs-Free), `categoryId: "27"`, `privacy: "public"`, `madeForKids: false`, `isAiGenerated: true`, `notifySubscribers: true`. `text` = deskripsi: ringkasan 2–3 kalimat, CTA, `Sumber: …`, "Animasi bersifat ilustrasi. Suara: AI (Google AI Studio)", hashtag (`#shorts` + 5–6 topik).
4. `metadata.tiktok`: `{isAiGenerated: true, title: "<hook singkat>"}`. Caption: hook + CTA + sumber + `Suara: AI (Google AI Studio)` + hashtag sama.
5. `metadata.instagram`: `{type: "reel", shouldShareToFeed: true, isAiGenerated: true}`. Field `instagramCaption` di `publish.json` (≤ 2.200 karakter): baris 1 hook pendek penarik klik `"... more"` (≤ 90 karakter), ringkasan dengan keyword pencarian IG, 1 CTA spesifik Save/Share/pertanyaan komentar topik (bukan spam follow/like), `Sumber: …`, `Animasi bersifat ilustrasi. Suara: AI (Google AI Studio).`, dan 3–5 hashtag niche relevan (mis. `#kaliajatau #sainsindonesia`) — **dilarang** `#shorts`, `#short`, atau `#fyp`.
6. Verifikasi: `post(input: { id: … })` sampai `status == "sent"` (argumen `input`, bukan `id` langsung — detail di PUBLISHING.md). TikTok bisa beberapa menit. `error` → laporkan, jangan retry buta.

Jika ada keraguan kualitas/fakta tapi video lengkap → `saveToDraft: true` dan laporkan; jika tidak lengkap → jangan posting.

## 10. Simpan & laporan

- Source video, `vo.mp3`, `alignment.json`, dan render output **tidak di-commit**. Tidak ada katalog video atau metadata publish di-commit. CI fetch data Buffer hanya ke `/tmp`; Buffer tetap sebagai source of truth. Tidak ada commit/push manual atau source video ke repo.
- Laporan ke Slack **#social** (`slack_send_message`, channel `C0CDV7Y555K`) untuk **setiap** hasil run — sukses, dilewati, draft (ragu), atau gagal (langkah + error singkat). Isi sukses: judul, link YouTube & TikTok, sumber, provider/voice yang dipakai (Gemini 3.8 Flash TTS / `id-id-podcaster-1`), format naskah yang dipilih (`format:` dari `catatan`), dan konfirmasi duplicate gate lolos. Jangan pernah menyertakan API key. Jika Slack gagal, pakai `SendUserMessage` sebagai cadangan.

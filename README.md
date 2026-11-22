# yt-video-short-generator

**yt = YouTube & TikTok video short generator** — [hendra/yt-video-short-generator](https://github.com/hendra/yt-video-short-generator).

Template video **explainer 3D vertikal** (YouTube Shorts / Reels / TikTok, 1080×1920) dengan **Remotion + React Three Fiber**:
animasi 3D low-poly, voiceover **AI** (Google AI Studio TTS, gratis — lihat `.env.example`) dengan timing per kata, caption karaoke, callout berlabel, chip angka, dan musik latar orisinal.

**Channel ketiga: Cerpenek** — dongeng anak 5–10 tahun (sejarah, legenda, asal-usul Indonesia) dengan suara wanita dan diorama mainan kayu; tayang otomatis di slot cron yang sama (lihat `docs/PUBLISHING.md`).

**Multi-channel, satu pipeline.** Brand yang aktif tayang otomatis di slot cron yang sama (2×/hari: run 09:00/16:00 WIB, tayang terjadwal jam 12:00 & 19:00 WIB untuk semua platform), masing-masing sekali run per akun: **Kali Aja Tau** (sains & teknik Indonesia), **AI Labs** (tips & trik Claude/ChatGPT/Gemini/OpenCode), **Cerpenek** (dongeng anak), **Sastra Mesin** (cara kerja benda sehari-hari, tema 3D `blueprint`, suara `id-id-tutor-1`), **Upwayyy** (lore game horor, `mode: "footage"`), dan **Mandor Bangunan** (konstruksi, gedung, jembatan & teknik sipil — gaya 3D `cream` & suara `id-id-podcaster-1` sama dengan Kali Aja, menunggu ID Buffer). Konfigurasi akun ada di `src/accounts.ts`; kredensial terpisah lewat GitHub Environments — detail & fallback di `docs/PUBLISHING.md` dan `ops/README.md`.

Repo ini adalah **pipeline** — video generated tidak tersimpan di git, dan tidak ada katalog video yang di-commit. Duplicate/re-publish lookup diambil dari Buffer di CI ke `/tmp/published-videos-<account>.json` (satu run = satu akun; lihat `src/accounts.ts`); source, VO, dan render output tetap tidak di-commit.

## Mulai cepat

```bash
npm install
npm run dev          # Remotion Studio: preview + scrub timeline
npm run render -- <id> out/<id>.mp4
```

Butuh Node ≥ 20.19. `predev`/`prerender` otomatis membuat `public/<id>/music.wav` kalau belum ada.

## Published-video catalog

CI fetches Buffer's public sent-post history into `/tmp/published-videos-<account>.json` at the start of each run (per account, using that account's org + channel IDs). Duplicate gate and publish-time near-duplicate checks use that temporary file; nothing from it is committed. To create the same local snapshot manually:

```bash
BUFFER_ACCESS_TOKEN=... npx tsx scripts/fetch-published-videos.mts --account kali-aja --out /tmp/published-videos-kali-aja.json
```

## Alur membuat video

```
naskah.txt ──► npm run tts      (Google AI Studio TTS, gratis: suara + timing otomatis)
          └──► npm run align    (audio sudah ada? timing per kata via ElevenLabs / align:local)
                     │
                     ▼
              alignment.json ──► npm run timeline ──► timeline.json ──► npm run dev / render
```

1. Tulis naskah di `src/videos/<id>/naskah.txt`, satu baris per kalimat, format `NN  teks` (baris lain diabaikan). Format naratif tidak dipatok — ikuti format yang dipilih `npx tsx scripts/pick-format.mts` untuk video otomatis.
2. Isi `.env` (salin dari `.env.example`): `GEMINI_API_KEY` (gratis di [aistudio.google.com/apikey](https://aistudio.google.com/apikey), tanpa billing).
3. Pilih salah satu:
   ```bash
   npm run tts   -- <id>                 # generate suara (Gemini 3.8, voice mengikuti akun) + timing
   npm run align -- <id> path/ke/vo.mp3  # audio sudah ada -> timing per kata (ElevenLabs Forced Alignment)
   npm run align:local -- <id>           # timing gratis & offline (±0,2 detik per kata)
   ```
   `npm run tts` memakai voice akun (`tts` di `src/accounts.ts`; `--account <id>` atau env `ACCOUNT`, default Kali Aja): pria `id-id-podcaster-1` untuk Kali Aja, AI Labs, Upwayyy, dan Mandor Bangunan, wanita muda `id-id-storyteller-1` untuk Cerpenek, wanita `id-id-tutor-1` untuk Sastra Mesin. Tidak ada pengganti voice lain.
4. `npm run timeline -- <id>` → caption, timing baris, dan rentang shot.
5. `npm run music -- <id>` (opsional, kalau durasi berubah) → musik baru sesuai titik potong shot.
6. `npm run dev` untuk cek, lalu `npm run render -- <id> out/<id>.mp4`.

## Struktur

```
src/
  engine/                 # generik, dipakai semua video
    Explainer.tsx         # komposisi: ThreeCanvas + overlay + audio
    overlays/Overlays.tsx # header, callout, chip, caption karaoke, CTA, flash antar-shot
    kit.ts                # balok bangunan PBR bertepi bulat: lights, box, cyl, ball, level air, rumah, pohon, pekerja, partikel
    surface.ts            # tekstur butiran prosedural (deterministik, tanpa file gambar)
    math.ts               # ramp/smooth, PRNG deterministik, kamera keyframe/orbit, proyeksi 3D→2D
    types.ts              # VideoDef, ShotDef, Timeline
  videos/
    registry.ts           # daftar video (id → VideoDef); kosong di git — diisi saat generate
    <id>/                 # generated di CI, gitignored
      naskah.txt          # naskah voiceover
      config.json         # urutan shot + baris pertama tiap shot
      alignment.json      # timing kata (hasil tts/align)
      timeline.json       # hasil build-timeline (gitignored)
      state.ts            # cerita sebagai fungsi waktu
      world.ts            # dunia 3D (dibuat sekali, diupdate tiap frame)
      shots.ts            # judul, kamera, callout, chip per shot
scripts/                  # tts.mts (+lib-tts.mts), align.mts, align-core.mts, align-local.mts, build-timeline.mts, music.mts, pick-format.mts, fetch-published-videos.mts, check-duplicates.mts (+*-core/test.mts)
public/fonts              # Inter + DejaVu Sans Mono (OFL / Bitstream Vera), dibundel supaya render identik offline
```

## Video baru

1. Buat `src/videos/<id>/` dari nol (ikuti `AGENTS.md` untuk pola `state.ts`/`world.ts`/`shots.ts`), mulai dari `naskah.txt` dan `config.json` (`shots: [["A", 1], ["B", 4], …]`).
2. Ubah `state.ts`, `world.ts`, dan `shots.ts`. Ikat semua waktu ke baris naskah lewat `L(n).s` / `L(n).e`, bukan detik mentah. Dengan begitu, kalau VO di-generate ulang, animasi otomatis ikut.
3. Daftarkan di `src/videos/registry.ts`.
4. Jalankan alur di atas.

### Aturan supaya render benar

- **Deterministik:** semua yang terlihat harus fungsi murni dari `t` (detik). Jangan pakai `Math.random()`, `Date.now()`, atau state antar-frame. Pakai `rng(seed)` dari `engine/math.ts`. Remotion merender frame **paralel dan tidak berurutan**.
- Partikel yang kecepatannya berubah: integralkan lajunya dari 0 sampai `t` (lihat `flowPhase` di `world.ts`), jangan `t * speed`.
- Teks di layar: area aman Shorts sudah diatur (`SAFE` di `Overlays.tsx`). Caption di y≈1270, tidak tertutup UI YouTube.

## Render

- Laptop/desktop dengan GPU: default `--gl=angle` (lihat `remotion.config.ts`).
- Master 4K (2160×3840) dengan GPU: tambahkan `--scale=2` — lapisan 3D ikut dirender di resolusi penuh, bukan di-upscale.
- Server/CI tanpa GPU: `npm run render -- <id> out/<id>.mp4 --gl=swangle` (WebGL software, jauh lebih lambat: ±0,8 detik/frame/core).
- Loudness standar YouTube (−14 LUFS), opsional:
  ```bash
  ffmpeg -i out/<id>.mp4 -c:v copy -af loudnorm=I=-14:TP=-1.5:LRA=11 -c:a aac -b:a 192k out/<id>-final.mp4
  ```

## Catatan

- **YouTube:** suara AI → centang *Altered or synthetic content* saat upload.
- **Lisensi:** kode template MIT (lihat `LICENSE.md`). **Remotion** gratis untuk individu, tapi perusahaan tertentu wajib lisensi berbayar: [remotion.dev/license](https://www.remotion.dev/license). Font: OFL (Inter) dan Bitstream Vera (DejaVu), lisensi ada di `public/fonts`. Musik di-synthesize dari nol oleh `scripts/music.mts`, jadi bebas royalti.


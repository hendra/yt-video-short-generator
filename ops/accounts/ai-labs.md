# AI Labs — brief channel

Brief ini **bagian dari instruksi kamu** di CI. Baca sebelum menulis naskah.
Brief lain (`AGENTS.md`, `ops/ci-prompt.md`) mengatur pipeline; file ini mengatur **isi** channel.

Channel: **AI Labs** — tips & trik AI untuk orang Indonesia: Claude, ChatGPT, Gemini, OpenCode.
Bidang: edit foto & video dengan AI, coding & debugging, agent & plugin, prompt, setting yang jarang orang tahu.
Bahasa: Indonesia santai-profesional. Satu ide per video.

## Brand

Di `src/videos/<slug>/index.ts` tulis **persis**:

```ts
brand: { prefix: "AI ", accent: "Labs" },
```

Jangan pakai brand channel lain. Gate CI menolak video yang brand-nya beda.

## Format

1. Jalankan `npx tsx scripts/pick-format.mts --account ai-labs` → dapat satu format (acak, berbobot).
2. **Pakai format itu verbatim** sebagai kerangka naskah; jangan ganti format lain.
3. Catat di `publish.json`: `catatan` diawali `format: <id>;`.
4. **Dilarang** kerangka "masalah → 3 langkah → kesalahan umum" — itu format channel lain dan bikin video ini terasa sama.
5. Variasikan sintaks hook dari run ke run: pertanyaan, klaim outrageous, before-after, demo, keluhan, angka. Hook dibayar dalam 2–3 detik pertama.
6. Bentuk kalimat varyasi: jangan opening "Halo, kali ini kita…" atau "Pernah nggak kamu…". Boleh buka dari hasil, dari scene, atau dari konsekuensi.

## Topik

1. Lihat `ops/topics/ai-labs.md` (backlog kurasi, tiap baris ada URL sumber resmi).
2. **Baca katalog video yang sudah tayang** (path ada di prompt run). Pilih topik yang judulnya belum pernah muncul di sana. Kalau mirip → ganti topik, jangan "sedikit ubah judul".
3. **Verifikasi** klaim ke URL sumbernya dengan WebFetch sebelum menulis naskah: fitur, nama model, batas, angka. Sumber tidak terjangkau → ganti topik atau berhenti.
4. **Sisa topik yang belum terpakai < 3 → berhenti dan lapor** (jangan mengarang topik, jangan pakai topik lama).
5. Jangan panggil WebSearch — tool itu tidak ada di runner ini dan akan membatalkan run.

## Naskah

- `src/videos/<slug>/naskah.txt`: 10–14 baris, format `NN  teks` (dua digit, dua spasi), **maksimal 130 kata** (≈ 45–55 detik; `npm run tts` menolak naskah lebih panjang).
- Kalimat lisan: "nggak", "kayak", "gitu deh". Angka ditulis dengan kata ("empat belas gambar").
- Alur naskah: hook → isi → payoff → **ending loop** (kalimat terakhir menyambung ke kalimat pertama). **Tanpa CTA** — tidak ada "subscribe", "komentar", atau "cek deskripsi". Tidak ada "Tapi tunggu… kok bisa…?". `config.json` `tail` ≤ 0,3 dtk (gate CI).
- Boleh pakai istilah teknis (MCP, hook, context window) tapi jelaskan sekali dengan analogi sederhana.

## Visual: Motion Graphics (Dark Tech Studio)

`ai-labs` memakai engine **motion graphics 2D** (`mode: "motion"`), **bukan** scene 3D.

- Di `src/videos/<slug>/index.ts`, tulis `mode: "motion"` dan `captions: false` (opsional `theme: "dark-tech"`, default sudah `"dark-tech"`). Caption teks di layar dimatikan agar kartu motion tidak penuh/bertumpuk. **Jangan** tulis `fov`, `createWorld`, `world.ts`, `state.ts`, atau `Kit` — gate CI menolak video `ai-labs` yang memakai `world.ts`, tidak memakai `mode: "motion"`, atau lupa `captions: false`.
- Di `src/videos/<slug>/shots.tsx`, bangun tiap shot sebagai `MotionShotDef` dengan helper & blok dari `../../engine/motion`:
  ```ts
  import {
    BentoGrid, ComparisonSplit, IllustrationStage, KineticHeadline,
    MetricPanel, NodeFlow, PromptCard, TechIcon, TerminalCard,
    countValue, ramp, spring, stagger, sway, typewriter,
    type MotionShotDef, type TransitionKind,
  } from "../../engine/motion";
  ```
- Setiap entry `MotionShotDef`: `{ label, title, tag?, transition?: TransitionKind, chip?: (t) => ChipState | null, render: (frame) => ReactNode }` (`frame = { t, local, dur, progress }`). Pilihan `TransitionKind`: `"zoom-cross"` (default), `"slide-up"`, `"slide-left"`, `"wipe"`, `"scale-fade"`.
- 8 blok visual + `TechIcon` (semua menerima `t` atau `at` berbasis `ctx.L(n).s` / `ctx.L(n).e`):
  1. `KineticHeadline`: `{ t, at, kicker?, text, sub?, align?: "left" | "center" }` — `*kata*` otomatis jadi aksen mint.
  2. `NodeFlow`: `{ t, direction?: "vertical" | "horizontal", nodes: NodeFlowItem[] }` — item `{ id, icon, title, subtitle?, badge?, accent?: "mint" | "cyan" | "amber" | "red", at, activeAt? }`. Batas padat: 3–4 node vertikal atau 2–3 horizontal.
  3. `TerminalCard`: `{ t, title?, lines: TerminalLine[] }` — baris `{ text, kind?: "cmd" | "info" | "ok" | "err" | "dim", at, highlight? }`. Batas padat: maks 5–6 baris singkat.
  4. `PromptCard`: `{ t, title?, badge?, copyHint?, sections: PromptSection[] }` — section `{ role, text, accent?: "mint" | "cyan" | "amber" | "violet", at, activeAt? }`. Batas padat: 2–4 section.
  5. `ComparisonSplit`: `{ t, before: ComparisonSide, after: ComparisonSide }` — sisi `{ label, title, points: string[], at }`. Batas padat: maks 3–4 poin pendek per sisi.
  6. `MetricPanel`: `{ t, headline?: { label, from, to, unit?, decimals?, at, dur? }, bars?: Array<{ label, value, max?, display?, accent?: "mint" | "cyan" | "amber", at }>, meter?: { label, used, total, unit?, at } }`. Batas padat: maks 1 headline + 3 bar (atau 1 meter).
  7. `BentoGrid`: `{ t, columns?: 1 | 2, items: BentoItem[] }` — item `{ icon, title, detail, accent?: "mint" | "cyan" | "amber" | "violet", at, activeAt? }`. Batas padat: maks 4 item (grid 2×2).
  8. `IllustrationStage`: `{ t, at, title?, caption?, variant?: "photo-wipe" | "mcp-bridge" | "doc-to-json" | "custom", children? }` — SVG ilustrasi bawaan atau custom.
  - `TechIcon`: `{ name: TechIconName, size?, color?, accent? }`. Nilai `TECH_ICON_NAMES` yang tersedia: `"sparkle"`, `"terminal"`, `"code"`, `"brain"`, `"bot"`, `"folder"`, `"file"`, `"git"`, `"plug"`, `"shield"`, `"lock"`, `"image"`, `"video"`, `"clock"`, `"bolt"`, `"check"`, `"x"`, `"warning"`, `"search"`, `"copy"`, `"sliders"`, `"layers"`, `"database"`, `"globe"`.
- **Kepadatan vertikal & zona aman:** karena caption di layar dimatikan (`captions: false`), `MotionStage` membatasi stage di atas `y = 1480` (`NO_CAPTION_SAFE_BOTTOM`, dengan `overflow: "hidden"`). Isi shot di-zoom 1,75× (`STAGE_ZOOM`) agar terbaca di HP, jadi satu blok per shot dengan batas padat di atas sudah mengisi layar. Jangan tumpuk terlalu banyak blok dalam satu shot agar tidak terpotong di bagian bawah, dan sisakan sedikit ruang di kanan bawah untuk tombol YouTube Shorts/TikTok.
- **Aturan gerak murni:** semua animasi harus fungsi murni dari `t` yang diikat ke `ctx.L(n).s` / `ctx.L(n).e` (`spring`, `ramp`, `sway`, `stagger`, `typewriter`, `countValue`). Dilarang `Math.random()`, state lintas-frame, atau CSS `@keyframes`.
- **Koreografi per baris (wajib):** setiap shot minimal 2–3 beat internal yang waktunya diambil dari `ctx.L(n).s`, bukan semua muncul di `ctx.shot(id).s`. Pakai `at` untuk kemunculan dan `activeAt` untuk sorotan:
  ```tsx
  import { BentoGrid, type BentoItem } from "../../engine/motion";
  const cards: BentoItem[] = [
    { icon: "terminal", title: "Jalankan", detail: "satu perintah", at: ctx.L(3).s, activeAt: ctx.L(3).s },
    { icon: "check", title: "Cek hasil", detail: "baca output", at: ctx.L(4).s, activeAt: ctx.L(4).s },
  ];
  <BentoGrid t={t} items={cards} />
  ```
  Tulis `const cards: BentoItem[] = [...]` — tanpa anotasi itu `icon` melebar jadi `string` dan `tsc` menolak. `TerminalCard` (`lines[].activeAt`), `MetricPanel` (`bars[].activeAt`), `BentoGrid` (`items[].activeAt`), `NodeFlow` (`nodes[].activeAt`), `PromptCard` (`sections[].activeAt`), dan `ComparisonSplit` (`before.pointsAt` / `after.pointsAt`) memakai `activeAt` untuk menyorot baris yang sedang diucapkan dan meredupkan sisanya. Gate CI menolak shot yang tampilannya tidak berubah sepanjang shot.
- **`BeatCallout`** — pil nomor langkah yang muncul tepat saat barisnya diucapkan: `<BeatCallout t={t} at={ctx.L(4).s} until={ctx.L(5).s} step={1} text="Parse" />`.
- **Ilustrasi bawaan `IllustrationStage`:** `"agent-loop"` (putaran Think → Tool Call → Observe → Verify dengan token berjalan), `"context-window"` (blok token mengisi jendela lalu dipadatkan), `"code-diff"` (baris merah diganti baris mint lalu lencana centang).
  **`activeStep` adalah nomor langkah 0-based, bukan nomor baris naskah.** Isi dengan `stepIndex` atas baris-baris langkahnya:
  ```tsx
  import { IllustrationStage, stepIndex } from "../../engine/motion";
  const step = stepIndex(t, [ctx.L(4), ctx.L(5), ctx.L(6), ctx.L(7)]); // -1 sebelum langkah pertama, lalu 0..3
  <IllustrationStage t={t} at={ctx.L(4).s} variant="agent-loop" activeStep={step} />
  ```
  `"agent-loop"` menyorot node `0..3`, `"context-window"` menyorot blok token ke-`step`, `"code-diff"` menampilkan lencana centang saat `step >= 2`. Nilai di luar rentang (mis. nomor baris 12) membuat semua node meredup dan tidak ada yang disorot.
- **Tidak boleh** screenshot UI asli (CI tidak bisa login ke akun mana pun) — gambar ulang bentuknya memakai blok motion atau SVG di `IllustrationStage`.
- Diagram/ilustrasi skematis diberi `tag: "ILUSTRASI"`.
- **Caption:** teks karaoke di layar **dimatikan** untuk `ai-labs` (`captions: false` di `index.ts`); `timeline.json` tetap dibuat seperti biasa lewat `npm run timeline -- <slug>`.

## Musik latar

Di `src/videos/<slug>/config.json`, **wajib** isi field `"music"` sesuai jenis konten (dipakai `scripts/music.mts` untuk meracik `public/<slug>/music.wav` dari koleksi track AI Labs). Di `index.ts`, tetap pakai `music: { src: "<slug>/music.wav", volume: 0.14 }`.

Pilih satu dari 3 suasana ini:
- `"build"` — coding, CLI, MCP, agent workflows, prompt recipes.
- `"debug"` — debug postmortem, pitfalls, security, troubleshooting config.
- `"showcase"` — fitur baru AI, edit foto/video, perbandingan tool, demo AI.

## publish.json

`src/videos/<slug>/publish.json` — bentuk persis:

```json
{
  "account": "ai-labs",
  "title": "…",
  "description": "…",
  "tiktokTitle": "…",
  "tiktokCaption": "…",
  "instagramCaption": "…",
  "catatan": "format: <id>; …"
}
```

- `account` wajib `"ai-labs"` (kena gate CI kalau beda).
- `title` ≤ 100 karakter, tanpa `<` dan `>` (YouTube menolaknya).
- `description`: ringkasan 2–3 kalimat + (jika pakai `<PromptCard>`, lihat aturan di bawah) + `Sumber: <URL sumber resmi>` + `Animasi bersifat ilustrasi. Suara: AI (Google AI Studio).` + `#shorts` + 5–6 hashtag topik.
- **Aturan wajib `PromptCard` (gate CI):** setiap kali `shots.tsx` memakai `<PromptCard>`, `publish.json.description` **wajib** mengandung `Prompt siap copy:` diikuti teks prompt lengkap yang bisa langsung disalin penonton (pakai kurung siku `[placeholder]`, **jangan pernah** `<placeholder>` karena YouTube menolak `<` dan `>`). Masukkan juga blok `Prompt siap copy:` ini ke `tiktokCaption` dan `instagramCaption` selama totalnya masing-masing masih ≤ 2.200 karakter (gate CI menolak `instagramCaption` tanpa `Prompt siap copy:` saat memakai `<PromptCard>`).
- `tiktokTitle` ≤ 90 karakter (hook saja), `tiktokCaption` seperti description + `Suara: AI (Google AI Studio)`.
- `instagramCaption` ≤ 2.200 karakter (wajib untuk Instagram Reels, lolos gate CI): baris 1 hook pendek penarik klik `"... more"` (≤ 90 karakter), diikuti ringkasan dengan keyword pencarian IG, blok `Prompt siap copy:` bila memakai `<PromptCard>` + CTA Save (*"Simpan Reels ini biar prompt-nya nggak hilang"* atau pertanyaan komentar spesifik topik), `Sumber: <URL sumber resmi>`, `Animasi bersifat ilustrasi. Suara: AI (Google AI Studio).`, dan 3–5 hashtag relevan (mis. `#ailabs #tipsai`) — **dilarang** `#shorts`, `#short`, atau `#fyp`.
- `catatan` diawali `format: <id>;` dari `pick-format`.

## Batas klaim

- Hanya boleh menyebut fitur/limitasi yang **ada di sumber resmi** yang kamu fetch. Kalau tidak ada di sumber → jangan sebut.
- Tidak mengarang angka benchmark, kuota, harga, atau kecepatan. Kalau angkanya tidak ada di sumber → bulatkan jadi kualitatif ("jauh lebih cepat").
- Tidak menyebut model/fitur yang belum rilis sebagai kalau sudah ada. Kalau sumbernya release-notes, sebut statusnya ("pratinjau", "umum").
- Tanpa nasihat medis, finansial, atau hukum. Tanpa klaim kesehatan/keuangan.
- Tidak menjatuhkan produk lain. Bandingkan fitur secara faktual, atau lewati perbandingan.
- credits: writing "Suara: AI (Google AI Studio)" dan `isAiGenerated` (sudah di set pipeline).

## Refill backlog

Backlog diisi manual oleh operator (on demand), bukan otomatis. Kalau sisa topik menipis dan refill belum datang, channel berhenti dengan laporan ke Slack, bukan mengarang konten. Isi ulang: operator meminta "isi backlog AI Labs", lalu assistant memverifikasi URL sumber resmi, menambah baris baru ke `ops/topics/ai-labs.md` (format sama, slug unik), lalu commit.

# Mandor Bangunan — brief channel

Brief ini **bagian dari instruksi kamu** di CI. Baca sebelum menulis naskah.
`AGENTS.md` dan `ops/ci-prompt.md` mengatur pipeline; file ini mengatur **isi** dan **tampilan** channel. Kalau aturan di sini berbeda dari `ops/ci-prompt.md` (panjang naskah, scene, CTA, deskripsi), **file ini yang berlaku**. `docs/AUTOPILOT.md` tidak berlaku di channel ini.

Channel: **Mandor Bangunan** — explainer 3D untuk penonton Indonesia umum tentang **konstruksi, pembangunan gedung, jembatan, pondasi, terowongan, bendungan, dan proyek teknik sipil**. Naskah, animasi 3D, gaya suara, dan pilihan suara disamakan dengan **Kali Aja Tau**, dengan fokus topik dari daftar riset konstruksi populer.

## Brand

Di `src/videos/<slug>/index.ts` tulis **persis**:

```ts
brand: { prefix: "Mandor ", accent: "Bangunan" },
```

Jangan pakai brand channel lain, jangan set `mode: "motion"` atau `mode: "footage"`, dan jangan set `theme: "blueprint"` / `"dark-tech"` / `"upwayyy"` — biarkan `theme` default 3D (`"cream"`). Gate CI menolak video yang tidak memakai 3D (`world.ts`) atau memakai tema channel lain.

## Suara

- Suara dibuat dengan **`npm run tts -- <slug> --account mandor-bangunan`** (selalu tulis `--account mandor-bangunan`).
- Suara akun ini adalah `id-id-podcaster-1` (gaya `natural, warm, conversational`, sama persis dengan Kali Aja Tau). Jangan mengganti suara atau provider.

## Format

1. Jalankan `npx tsx scripts/pick-format.mts --account mandor-bangunan` → dapat satu format narasi konstruksi (acak, berbobot).
2. **Pakai format itu** sebagai alur naskah; jangan ganti dengan kerangka lain (termasuk pola lama `hook → "Tapi tunggu… kok bisa…?" → langkah 1/2/3`).
3. Catat di `publish.json`: `catatan` diawali `format: <id>;`.

## Topik

1. Lihat `ops/topics/mandor-bangunan.md` (backlog kurasi dari riset topik konstruksi berpenonton terbanyak lintas 5 kategori: `Gedung`, `Jembatan`, `Infrastruktur`, `Pondasi`, `Terowongan & Bendungan`).
2. **Baca katalog video yang sudah tayang** (path ada di prompt run, `/tmp/published-videos-mandor-bangunan.json`). Pilih topik yang belum pernah tayang di channel ini; loloskan `npx tsx scripts/check-duplicates.mts <slug> --db /tmp/published-videos-mandor-bangunan.json`.
3. **Batas topik ketat (konstruksi & teknik sipil saja):**
   - **Boleh:** pembangunan gedung tinggi, jembatan, pondasi dalam/bawah air, terowongan, bendungan, jalan layang/tol, material struktur (beton prategang, tulangan baja), alat konstruksi (tower crane, TBM, launching gantry), serta teknik mitigasi gempa/tanah lunak.
   - **Dilarang:** gadget/aplikasi AI, dongeng anak, lore game, benda rumah tangga kecil tanpa struktur sipil (masuk `sastra-mesin`), atau berita politik proyek.
   - Jangan memakai aturan "berita Indonesia 1–3 hari terakhir" dari `kali-aja`; ambil dari backlog terkurasi.

## Riset

- **Jangan panggil WebSearch** — tool itu tidak tersedia di CI dan akan membatalkan run setelah selesai.
- **Baca sumbernya** dengan `WebFetch` ke URL di `ops/topics/mandor-bangunan.md` sebelum menulis naskah. Jika sumber tidak terjangkau, ganti ke entri backlog lain atau berhenti.
- **Jangan mengarang:** setiap ukuran, kedalaman, tonase, bentang jembatan, atau nama komponen teknik harus berasal dari sumber yang dibaca. Angka turunan dihitung dengan tepat; fakta tak terverifikasi → buang atau ganti topik.

## Naskah

- `src/videos/<slug>/naskah.txt`: format `NN  teks` (10–14 baris), **maksimal 130 kata** (`npm run tts` menolak naskah lebih panjang; verifikasi durasi akhir di `timeline.json` antara **45–55 detik**).
- Bahasa Indonesia lisan, santai-profesional ("nggak", "kayak"), angka ditulis dengan kata ("delapan ratus dua puluh delapan meter", "enam ratus enam puluh ton"). Kata hati-hati untuk estimasi atau temuan awal ("diduga", "menurut…").
- Mengikuti 4 babak retensi: **hook** (0–4 dtk, kontradiksi + angka spesifik/paradoks, tanpa basa-basi seperti "Tahukah kamu…"/"Bayangkan…") → **konteks cepat + re-hook** (≤ 2 kalimat, ditutup pertanyaan baru) → **twist + re-hook** (fakta teknik paling mengejutkan disimpan di sini, bukan di tengah) → **ending loop**.
- **Ending loop, tanpa CTA:** dilarang "jangan lupa subscribe", "tulis di komentar", "sampai jumpa". Kalimat terakhir menggantung dan menyambung secara tata bahasa ke kalimat pertama, sehingga saat video berputar ulang terdengar satu kalimat utuh. Cek dengan membaca `[baris terakhir] + [baris pertama]` berurutan. `config.json` `tail` **≤ 0,3 detik** (gate CI).

## Scene 3D

Gaya visual, komponen `Kit`, tema `"cream"`, dan aturan render **sama persis dengan Kali Aja Tau**:

- **Cahaya:** panggil `kit.lights()` sekali di `createWorld` (`reach` = setengah lebar area bayangan, default 16). Jangan menambah `AmbientLight`/`DirectionalLight` sendiri.
- **Bentuk & material:** `kit.box(...)` (tepi membulat), `kit.cyl(...)` untuk tiang pancang/pilar/pipa, `kit.ball(...)`, prefab `kit.house/tree/worker`; benda bulat ≥ 16 segmen. Material `kit.mat(warna, "matte" | "gloss" | "metal" | "glass" | "water")` — beton/tanah/batu = `matte`, baja/kabel/crane = `metal`, air = `water`, kaca = `glass`.
- **Gerak fisik:** `spring(u)` untuk bagian yang mendarat/muncul, `drop(u)` untuk beban/tiang pancang jatuh, `sway(t, seed)` untuk kabel/pohon/ombak; hindari gerak linear kaku.
- Jangan pakai environment map, bump map, atau post-processing.
- **Koreografi per baris (wajib).** Setiap shot mengikat animasinya ke baris `L(n)` yang sedang diucapkan:
  ```ts
  import { beat, between, pulse, stepIndex } from "../../engine/math";
  const on = beat(t, L(4));
  const hi = pulse(t, L(4));
  const openU = between(t, L(4), L(6));
  const step = stepIndex(t, [L(4), L(5), L(6)]);

  valve.rotation.z = on * 1.2;
  pipeGlow.emissiveIntensity = hi * 0.8;
  kit.cutaway([casing], openU, [0, 0, 2.4]);
  const activePart = parts[Math.max(0, step)];
  activePart.position.y = hi * 0.12;
  ```
  Setiap shot **wajib** punya minimal satu bagian yang bergerak nyata sepanjang shot (kamera saja ditolak gate CI).
- **Bagian mekanis siap pakai:** `kit.tube(points, r, mat)` (kabel/pipa/tendon prategang), `kit.flowDots(points, count, color, { speed })` (aliran air/slurry/gaya tekan; panggil `dots.update(flowPhase(t, L(n)))`, jangan `t * rate`), `kit.gear(x, y, z, { teeth, axis })`, `kit.fan(...)`, `kit.coil(...)`, `kit.arrow(from, to, mat)` (vektor beban/gaya tekan-tarik; `setProgress(u)`), `kit.ring(...)`.
- **Cutaway & sorotan:** `kit.cutaway([...parts], openU, [dx, dy, dz])` untuk mengiris dinding beton/tanah; `kit.glowMat(color, emissive)` untuk bagian yang menyala (`mat.emissiveIntensity = pulse(t, L(n)) * 0.8`). Jangan mengubah material dari `kit.mat()`.
- **Kamera bergerak per bit:**
  ```ts
  import { focusOffset, keyframes } from "../../engine/math";
  import type { Vec3 } from "../../engine/types";
  const base = keyframes(ctx, "s3", [[[0, 5, 10], [0, 1, 0]], [[0, 5, 8], [0, 1, 0]]] as [Vec3, Vec3][]);
  const camera = (t: number) => focusOffset(base(t), t, [{ at: L(6).s, offset: [0, 0.4, -1.4] as Vec3 }]);
  const shots = { s3: { label: "STRUKTUR 03", title: "Beban *turun*", camera } };
  export default shots;
  ```
- **Potongan tanah (cut face) di z = 0**, tanah dalam (`BOT ≈ -11`) dengan strata tanah/batuan agar pondasi tiang pancang, caisson, dan terowongan terlihat jelas memenuhi frame.
- Frame potret: FOV 44, objek utama mengisi ≥ 50% lebar, 1 shot ≈ 1–2 baris (8–12 shot).
- Callout maksimal 3 per shot (`orange` = fokus, `red` = gaya bahaya/batas gagal), anchor di zona aman (bawah header sampai y ≈ 1240). Diorama skematis diberi `tag: "ILUSTRASI"`.
- Shot terakhir: aerial/orbit hangat, tanpa CTA, framing mendekati shot pertama agar loop mulus.
- Pastikan semua frame fungsi murni dari `t` (tanpa `Math.random()`, `Date.now()`). Render 1 still per shot dan periksa hasilnya sebelum render penuh.

## Batas isi

- Tidak ada tragedi berdarah/korban jiwa sebagai sensasi (jika membahas sejarah kegagalan struktur seperti Tacoma Narrows, fokus ke fisika dan pelajarannya secara netral).
- Tidak ada politik partisan, SARA, klaim investasi/keuangan, atau tuduhan proyek tertentu tanpa sumber.
- Tidak ada aset gambar/video AI — seluruh visual 3D murni kode Three.js + Remotion.

## Musik latar

Di `src/videos/<slug>/config.json`, **wajib** isi field `"music"` dengan salah satu mood berikut (sama dengan Kali Aja Tau):
- `"teknik"` — mekanisme konstruksi, cara kerja alat berat, jembatan, beton prategang.
- `"misteri"` — teka-teki teknik (*"kok bisa berdiri?"*), mitos konstruksi, pelajaran kegagalan struktur.
- `"fenomena"` — kekuatan alam terhadap struktur (gempa, likuifaksi, angin topan, bendungan raksasa).

Di `index.ts`, pakai `music: { src: "<slug>/music.wav", volume: 0.14 }`.

## publish.json

`src/videos/<slug>/publish.json` — bentuk persis:

```json
{
  "account": "mandor-bangunan",
  "title": "…",
  "description": "…",
  "tiktokTitle": "…",
  "tiktokCaption": "…",
  "instagramCaption": "…",
  "catatan": "format: <id>; …"
}
```

- `account` wajib `"mandor-bangunan"`.
- Saat ini `mandor-bangunan` tayang di **TikTok saja** (`youtubeChannelId` & `instagramChannelId` belum disambungkan). Field `title` dan `description` tetap wajib diisi di `publish.json` untuk pengecekan duplikat dan log hasil publish; `instagramCaption` bersifat **opsional** selama `instagramChannelId` belum diisi di `src/accounts.ts`.
- `title` ≤ 100 karakter, tanpa `<` dan `>`, jelas menyebut struktur/proyeknya.
- `description`: ringkasan 2–3 kalimat + `Sumber: <URL sumber yang dibaca>` + `Animasi bersifat ilustrasi. Suara: AI (Google AI Studio).` + `#shorts` + 5–6 hashtag konstruksi (mis. `#tekniksipil #konstruksi #arsitektur`).
- `tiktokTitle` ≤ 90 karakter (hook singkat), `tiktokCaption` mengikuti deskripsi + `Suara: AI (Google AI Studio).`
- `instagramCaption` (opsional sampai Instagram terhubung, wajib jika `instagramChannelId` diisi; ≤ 2.200 karakter): baris 1 hook pendek penarik klik `"... more"` (≤ 90 karakter), ringkasan dengan keyword konstruksi untuk pencarian IG, 1 CTA spesifik Save/Share/pertanyaan komentar (bukan spam follow/like), `Sumber: <URL sumber yang dibaca>`, `Animasi bersifat ilustrasi. Suara: AI (Google AI Studio).`, dan 3–5 hashtag relevan (mis. `#mandorbangunan #tekniksipil #konstruksi`) — **dilarang** `#shorts`, `#short`, atau `#fyp`.
- `catatan` diawali `format: <id>;` dari `pick-format`.

## Refill backlog

Backlog diisi berkala lewat PR berdasarkan hasil riset video konstruksi/teknik sipil berpenonton terbanyak, lalu setiap ide dipasangkan dengan URL referensi `https://` yang bisa diakses oleh `WebFetch` dan memuat angka/mekanisme terverifikasi. Jika entri belum-tayang tinggal kurang dari 3, hentikan run dan lapor agar backlog diisi ulang.

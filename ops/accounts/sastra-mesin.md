# Sastra Mesin — brief channel

Brief ini **bagian dari instruksi kamu** di CI. Baca sebelum menulis naskah.
`AGENTS.md` dan `ops/ci-prompt.md` mengatur pipeline; file ini mengatur **isi** dan **tampilan** channel. Kalau aturan di sini berbeda dari `ops/ci-prompt.md` (panjang naskah, scene, tema visual, CTA, deskripsi), **file ini yang berlaku**.

Channel: **Sastra Mesin** (*Cerita di Balik Cara Kerja Benda*) — explainer 3D untuk penonton Indonesia umum tentang bagaimana benda sehari-hari bekerja. Tidak mengasumsikan penonton punya latar belakang teknik.

## Brand

Di `src/videos/<slug>/index.ts` tulis **persis**:

```ts
brand: { prefix: "Sastra ", accent: "Mesin" },
theme: "blueprint",
```

Jangan pakai brand channel lain dan jangan hilangkan `theme: "blueprint"`. Gate CI menolak video yang tidak memakai 3D (`world.ts`) atau tidak memakai `theme: "blueprint"`.

## Suara

- Suara dibuat dengan **`npm run tts -- <slug> --account sastra-mesin`** (selalu tulis `--account sastra-mesin`; tanpa itu suaranya bisa jadi suara channel lain).
- Suara akun ini adalah `id-id-tutor-1` (guru perempuan, artikulasi jelas, tempo sedang). Jangan mengganti suara atau provider.

## Format

1. Jalankan `npx tsx scripts/pick-format.mts --account sastra-mesin` → dapat satu kerangka cerita (acak, berbobot).
2. **Pakai kerangka itu** sebagai alur naskah; jangan ganti dengan kerangka lain (termasuk pola lama `hook → "Tapi tunggu… kok bisa…?" → langkah 1/2/3`).
3. Catat di `publish.json`: `catatan` diawali `format: <id>;`.

## Topik

1. Lihat `ops/topics/sastra-mesin.md` (backlog kurasi lintas 6 kategori).
2. **Baca katalog video yang sudah tayang** (path ada di prompt run). Pilih benda yang belum pernah tayang di channel ini.
3. **Batas topik ketat (benda sehari-hari saja):**
   - **Boleh:** peralatan rumah tangga, dapur, benda pribadi, elektronik sehari-hari, utilitas rumah, transportasi sehari-hari.
   - **Dilarang:** mesin pabrik/industri, alat berat konstruksi, mesin pesawat, pembangkit listrik skala besar, kapal/kapal selam, proyek teknik sipil raksasa, berita teknologi umum, sains abstrak tanpa kaitan dengan satu benda sehari-hari.
   - Topik di luar batas ini → ganti ke entri backlog lain.

## Riset

- **Baca sumbernya** dengan `WebFetch` ke URL di backlog sebelum menulis naskah. Jika sumber tidak terjangkau, cari sumber tepercaya lain (dokumentasi pabrikan, ensiklopedia, materi edukasi sains) atau ganti topik.
- **Jangan mengarang:** nama komponen, prinsip fisika, angka, suhu, spesifikasi listrik, hubungan mekanik. Setiap klaim teknis harus ada di sumber yang dibaca.
- Bedakan dengan jelas antara fakta teknis terverifikasi, penyederhanaan edukatif, dan ilustrasi visual.
- Jika mekanisme berbeda antar merek/model, jelaskan prinsip umumnya dengan kata hati-hati ("umumnya…", "pada kebanyakan model…").

## Naskah

- `src/videos/<slug>/naskah.txt`: format `NN  teks`, **10–14 baris**, **maksimal 130 kata** (`npm run tts` menolak naskah lebih panjang; verifikasi durasi akhir di `timeline.json` antara 45–55 dtk).
- Bahasa Indonesia lisan yang ramah, jelas, penasaran — seperti teman berpengetahuan yang menjelaskan ke teman lain. Bukan ceramah kaku, bukan gaya anak-anak.
- Kalimat pendek; **satu gagasan per kalimat**.
- **Aturan istilah teknis:** jangan lempar istilah asing begitu saja. Jika istilah penting (mis. *kompresor*, *bimetal*, *magnet*):
  1. Sebutkan namanya,
  2. Jelaskan langsung maknanya dengan kata sederhana,
  3. Beri analogi benda sehari-hari yang akrab.
- Angka ditulis dengan kata ("seratus derajat", "dua puluh empat milimeter").
- Buka dengan **hook 2–3 detik** (pertanyaan atau pengamatan yang membuat penasaran tentang benda itu). Akhiri dengan **ending loop**, **tanpa CTA**: kalimat terakhir menggantung dan menyambung secara tata bahasa ke kalimat pertama, sehingga saat video berputar ulang terdengar utuh. `config.json` `tail` ≤ 0,3 dtk (gate CI).

## Scene 3D

- Gunakan `theme: "blueprint"` di `index.ts` agar latar kertas teknis terang (`#F4F5F6` + grid sian), judul biru tua + aksen sian + garis oranye, label bernomor, takarir putih berbingkai, dan transisi garis pindai aktif otomatis.
- **Semantik warna bahan 3D (wajib konsisten dengan makna fisik):**
  - **Electric Cyan (`#20C9C3`):** aliran energi, aliran air, aliran udara, jalur listrik, komponen sensor/inti aktif.
  - **Industrial Orange (`#FF8A36`):** panas, elemen pemanas, komponen mekanis yang sedang bergerak/bergesekan, titik interaksi utama.
  - **Steel Gray (`#81909C`) & Soft White (`#F4F5F6`):** rangka luar, bagian diam, detail struktural.
  - Jangan memakai warna yang membalik makna proses (mis. panas berwarna biru/sian).
- **Wajib tunjukkan mekanismenya:** potong cangkang luar (*cutaway*) atau pisahkan lapisan (*exploded view*) agar bagian dalam terlihat jelas. Semua komponen yang terhubung secara mekanik bergerak selaras — bukan gerak hiasan yang keliru secara fisika.
- **Koreografi per baris (wajib).** Setiap shot mengikat geraknya ke `L(n)` yang sedang diucapkan, bukan satu `ramp` panjang. Helper di `engine/math.ts`:
  ```ts
  import { beat, between, pulse } from "../../engine/math";
  const on = beat(t, L(5));        // 0 → 1 saat baris 5 mulai
  const hi = pulse(t, L(5));       // 1 hanya selama baris 5 diucapkan
  const openU = between(t, L(5), L(7)); // 1 dari awal baris 5 sampai akhir baris 7

  rotor.rotation.z = on * 2.4;             // komponen mulai berputar saat dijelaskan
  hotCoil.emissiveIntensity = hi * 0.9;    // bagian panas menyala selama barisnya
  kit.cutaway([shell], openU, [0, 0, 1.8]); // cangkang terbuka untuk dua baris itu
  ```
  Bagian yang sedang diceritakan harus bagian yang bergerak/menyala pada detik yang sama. Gate CI menolak shot yang objeknya tidak bergerak (kamera saja tidak cukup).
- **Bagian mekanis siap pakai:** `kit.tube(points, r, mat)` (pipa/kabel/duct melengkung, `at(u)` untuk menempel objek), `kit.flowDots(points, count, color, { speed })` (aliran air/udara/listrik/panas; `dots.update(flowPhase(t, L(n)))` — **jangan** `dots.update(t * rate)`, itu membuat partikel melompat mundur), `kit.gear(x, y, z, { teeth, axis })` (putar `rotor.rotation[axis]`), `kit.fan(...)` (baling-baling, `rotor`), `kit.coil(...)` (pegas/kumparan pemanas/kumparan induksi), `kit.arrow(from, to, mat)` (vektor gaya/panas/arus; `setProgress(u)`), `kit.ring(...)` (flens, seal, cincin medan magnet).
- **Cutaway & sorotan:** `kit.cutaway([...shell], openU, [dx, dy, dz])` menggeser cangkang luar (sembunyi saat `openU >= 0.99`). Untuk bagian yang menyala, pakai `kit.glowMat(color, "#20C9C3")` — material **tanpa cache** — lalu `mat.emissiveIntensity = pulse(t, L(n)) * 0.8`. Jangan mengubah material dari `kit.mat()`; material itu dipakai bersama oleh banyak mesh.
- **Kamera:** minimal dua keyframe, plus dorongan halus saat baris penting:
  ```ts
  import { focusOffset, keyframes } from "../../engine/math";
  import type { Vec3 } from "../../engine/types";
  const base = keyframes(ctx, "s3", [[[0, 4, 9], [0, 1, 0]], [[0, 4, 7.5], [0, 1, 0]]] as [Vec3, Vec3][]);
  const camera = (t: number) => focusOffset(base(t), t, [{ at: L(6).s, offset: [0, 0.3, -1.2] as Vec3 }]);
  // `camera` dipakai sebagai field shot:
  const shots = { s3: { label: "ALIRAN 03", title: "Air *naik*", camera } };
  export default shots;
  ```
- Setiap proses penting yang sedang diceritakan di narasi harus tampak terjadi di layar pada detik yang sama (ikat animasi ke `L(n).s` / `L(n).e`).
- Skema internal yang disederhanakan untuk kejelasan diberi `tag: "ILUSTRASI"` di shot terkait.
- `label` di `shots.ts` berbentuk nomor langkah/komponen ringkas (mis. `"KOMPONEN 01"`, `"ALIRAN 02"`). `title` pendek dengan kata kunci di `*bintang*`.
- Callout maksimal 3 per shot, `orange` untuk komponen bergerak/panas yang sedang disorot, `red` hanya untuk batas bahaya/gagal. Pastikan jangkar tidak tertutup judul atau takarir (antara bawah header dan y≈1240).
- Caption: mengikuti aturan mesin (`≤ 3` token per potong, jangan ubah posisi).
- Pastikan frame selalu fungsi murni dari `t` (tanpa `Math.random()`, `Date.now()`, atau state lintas frame). Render minimal satu still tiap shot yang sibuk dan periksa hasilnya sebelum render penuh.

## Batas isi

- Tidak ada klaim medis, keuangan, saran hukum, politik partisan, SARA, atau tragedi/korban.
- Tidak ada animasi atau aset gambar/video AI — seluruh visual 3D murni dari Three.js + Remotion di kode.

## Musik latar

Di `src/videos/<slug>/config.json`, **wajib** isi field `"music"` sesuai jenis mekanisme:
- `"rakit"` — membongkar susunan komponen, roda gigi, pegas, kunci, ritsleting.
- `"aliran"` — aliran air, udara, listrik, pendingin (kulkas, AC, keran, charger).
- `"rahasia"` — prinsip mengejutkan atau mitos tentang benda (rice cooker, microwave, lampu LED).

Di `index.ts`, pakai `music: { src: "<slug>/music.wav", volume: 0.25 }`.

## publish.json

`src/videos/<slug>/publish.json` — bentuk persis:

```json
{
  "account": "sastra-mesin",
  "title": "…",
  "description": "…",
  "tiktokTitle": "…",
  "tiktokCaption": "…",
  "instagramCaption": "…",
  "catatan": "format: <id>; …"
}
```

- `account` wajib `"sastra-mesin"`.
- `title` ≤ 100 karakter, tanpa `<` dan `>`, jelas menyebut bendanya tanpa clickbait berlebihan.
- `description`: 2 kalimat penjelasan singkat + `Sumber: <URL sumber yang dibaca>` + `Animasi bersifat ilustrasi. Suara: AI (Google AI Studio).` + `#shorts` + 4–6 hashtag relevan (mis. `#sastramesin #carakerja #teknologi`).
- `tiktokTitle` ≤ 90 karakter, `tiktokCaption` mengikuti `description` + `Suara: AI (Google AI Studio).`
- `instagramCaption` ≤ 2.200 karakter (wajib untuk Instagram Reels, lolos gate CI): baris 1 hook penasaran penarik klik `"... more"` (≤ 90 karakter), diikuti ringkasan dengan keyword nama benda untuk pencarian IG, 1 CTA spesifik Save/Share/pertanyaan komentar (mis. *"Simpan Reels ini atau kirim ke teman yang sering pakai benda ini."*), `Sumber: <URL sumber yang dibaca>`, `Animasi bersifat ilustrasi. Suara: AI (Google AI Studio).`, dan 3–5 hashtag relevan (mis. `#sastramesin #carakerja #edukasisains`) — **dilarang** `#shorts`, `#short`, atau `#fyp`.
- `catatan` diawali `format: <id>;` dari `pick-format`.

## Refill backlog

Backlog diisi manual lewat PR setelah tiap URL sumber dicek bisa diakses dan menjelaskan cara kerja bendanya. Jika entri belum-tayang tinggal kurang dari 3, hentikan run dan lapor agar backlog diisi ulang.

# Cerpenek — brief channel

Brief ini **bagian dari instruksi kamu** di CI. Baca sebelum menulis naskah.
`AGENTS.md` dan `ops/ci-prompt.md` mengatur pipeline; file ini mengatur **isi** channel. Kalau aturan di sini berbeda dari `ops/ci-prompt.md` (panjang naskah, scene, CTA, deskripsi), **file ini yang berlaku**.

Channel: **Cerpenek** (*Cerita Pendek Nenek*) — dongeng untuk anak **5–10 tahun** yang ditonton bersama orang tua.
Isi: sejarah, legenda, dan asal-usul yang **semuanya dari Indonesia**. Tujuan: hiburan yang mendidik.
Satu cerita per video.

## Brand

Di `src/videos/<slug>/index.ts` tulis **persis**:

```ts
brand: { prefix: "Cerpe", accent: "nek" },
```

Jangan pakai brand channel lain. Gate CI menolak video yang brand-nya beda.

## Suara dan gaya bercerita

- Naratornya **kakak perempuan muda** yang bercerita ke adik kecil: hangat, ceria, bersemangat, intonasi naik-turun. Bukan Nenek. Kata "Nenek" dan sapaan "Cucuku" **dilarang** di naskah.
- Sapaan **"adik-adik"** boleh, **maksimal sekali** per naskah, dan **tidak di baris pertama**.
- Kalimat pendek, satu gagasan per kalimat. Kata sehari-hari yang dipahami anak SD. Hindari kata serapan sulit dan istilah teknis.
- Angka ditulis dengan kata ("tujuh hari", "seribu candi").
- Suara dibuat dengan **`npm run tts -- <slug> --account cerpenek`** (selalu tulis `--account cerpenek`; tanpa itu suaranya bisa jadi suara channel lain). Jangan mengganti suara atau provider.

## Format

1. Jalankan `npx tsx scripts/pick-format.mts --account cerpenek` → dapat satu kerangka cerita (acak, berbobot).
2. **Pakai kerangka itu** sebagai alur naskah; jangan ganti dengan kerangka lain. Kerangka mulai dari **baris kedua** — baris pertama tetap hook (lihat §Naskah), juga kalau kerangka itu membuka dengan tempat atau benda.
3. Pilih cerita dari backlog yang **cocok** dengan kerangka itu: `tokoh-sejarah` → bagian "Tokoh sejarah"; `asal-usul-tempat` → legenda tempat atau bagian "Kerajaan, peristiwa, dan tempat bersejarah"; `asal-usul-benda` → bagian "Asal-usul benda…"; `sahabat-hewan` → legenda yang punya hewan penolong; sisanya → "Legenda dan cerita rakyat". Kalau tidak ada cerita belum-tayang yang cocok, jalankan `pick-format` sekali lagi (paling banyak tiga kali) — jangan memaksa cerita masuk kerangka yang salah.
4. Catat di `publish.json`: `catatan` diawali `format: <id>;`.
5. **Dilarang** gaya explainer: daftar bernomor, "tiga fakta", "mitos vs fakta", tutorial langkah demi langkah.

## Topik

1. Lihat `ops/topics/cerpenek.md` (backlog kurasi; tiap baris ada URL sumber dan daerah asal).
2. **Baca katalog video yang sudah tayang** (path ada di prompt run). Pilih cerita yang belum pernah tayang. Kalau mirip → ganti cerita, jangan "sedikit ubah judul".
3. **Baca sumbernya** dengan WebFetch sebelum menulis naskah. Ceritakan sesuai sumber; jangan menambah tokoh, tempat, atau kejadian yang tidak ada di sana. Sumber tidak terjangkau → ganti cerita atau berhenti.
4. **Sisa cerita yang belum terpakai < 3 → berhenti dan lapor** (jangan mengarang cerita, jangan pakai cerita lama).
5. Jangan panggil WebSearch — tool itu tidak ada di runner ini dan akan membatalkan run.

## Batas isi

Penontonnya anak 5–10 tahun. Ini aturan keras:

- **Tidak menakutkan.** Tanpa darah, luka, horor, hantu yang seram, atau detail kekerasan. Kalau cerita aslinya punya bagian seperti itu, lewati atau sampaikan dengan satu kalimat lembut ("lalu raksasa itu pun kalah").
- **Kutukan boleh, tetapi tidak seram.** Sampaikan sebagai akibat, bukan tontonan ("dan ia pun berubah menjadi batu"). Jangan menggambarkan rasa sakit atau ketakutan.
- **Tanpa tema dewasa.** Tanpa percintaan yang jadi inti cerita, tanpa pernikahan paksa, tanpa hal yang tidak pantas untuk anak. Cerita yang intinya tema dewasa tidak boleh dipakai walau ada di backlog — ganti cerita.
- **Tidak merendahkan** suku, agama, daerah, atau orang miskin. Tokoh jahat salah karena perbuatannya, bukan karena asalnya.
- **Satu pesan moral** yang jelas di akhir, dengan kata-kata anak ("Jadi, sayangi ibumu ya.").
- **Jujur soal jenis cerita.** Legenda disebut legenda: "ini legenda dari [daerah]" atau "begitulah cerita orang [daerah]". Jangan menyampaikan legenda sebagai kejadian nyata.
- **Sejarah harus benar.** Nama, tahun, dan tempat hanya boleh disebut kalau ada di sumber yang kamu fetch. Tidak ada di sumber → jangan disebut. Perang dan kematian tokoh disampaikan singkat dan tenang.
- Tanpa nasihat medis, finansial, atau hukum. Tanpa iklan.

## Naskah

- `src/videos/<slug>/naskah.txt`: 13–16 baris, format `NN  teks` (dua digit, dua spasi).
- Durasi 60–90 detik. Total **800–1000 karakter** (suara kakak perempuan, kira-kira 11–13 karakter per detik) — jauh lebih pendek daripada angka di `ops/ci-prompt.md`. Lebih dari 1050 karakter berisiko melewati 90 detik.
- **Baris pertama adalah hook 3 detik.** Wajib berbentuk pertanyaan, suara, atau aksi langsung, sekitar delapan kata. **Dilarang** membuka dengan sapaan ("Adik-adik…", "Halo…", "Cucuku…") atau dengan "Pada zaman dahulu" / "Alkisah". Baris pertama harus membuat penonton ingin tahu apa yang terjadi.
- Alur: hook → cerita → akibat → pesan moral → ajakan.
- **Ajakan penutup (CTA):** ajak menonton cerita berikutnya bersama ayah atau ibu ("Besok kakak cerita lagi ya. Ajak ayah dan ibu."). **Jangan meminta komentar, like, atau subscribe** — komentar mati di video anak.
- Di `index.ts`, `cta.text` berisi ajakan yang sama.

## Scene 3D

Tampilannya **diorama *Nusantara Figurine***: adegan kecil hangat di atas alas bulat, tokoh bergaya figurin Nusantara yang rapi dan bulat dengan mata kartun ekspresif, senyum lembut, serta kerudung pashmina bertumpuk (bukan kotak kaku).

**Pakai prefab di bawah ini. Jangan merakit tokoh atau hewan sendiri dari `kit.box/cyl/ball`.** `kit.box/cyl/ball` hanya untuk benda: benda kecil pendukung (batu, peti, meja) dan benda pusat cerita (lihat "Cerita tentang benda dan bangunan").

```ts
const kit = new Kit(root);
kit.lights();                                    // sekali saja di createWorld

// Alas dan latar
kit.island(0, 0, 3, "pasir");                    // alas diorama: "pasir" atau "rumput"; permukaan di y = 0
kit.palm(2.2, 1.0, 1.6);                         // pohon kelapa (x, z, skala)
kit.tree(-1.5, -0.8, 1.4);                       // pohon biasa
kit.mountain(1.5, -2.6, 2.4);                    // gunung; argumen ke-4 true = gunung berapi
kit.hut(1.2, 0.6, 1.5, -0.3);                    // rumah panggung (x, z, skala, putaran)
kit.boat(-2.4, 3.2, 1.4, 0.3);                   // perahu layar di permukaan air; argumen ke-5 false = tanpa layar
const laut = kit.box(-8, 8, -0.5, -0.02, -8, 8, kit.mat("#4aa3b8", "water"));  // air di sekeliling pulau

// Tokoh: age "anak" | "dewasa" | "lansia"; headwear "none" | "caping" | "mahkota" | "ikat" | "kerudung"
const ibu = kit.figure(0.3, 1.2, 0.2, { age: "lansia", top: "#b5523f", bottom: "#8f3d30", headwear: "kerudung" });
const anak = kit.figure(-0.6, 1.4, 0.1, { age: "anak", top: "#e0a23a", bottom: "#3f6a8a" });
const raja = kit.figure(1.0, 0.4, -0.2, { top: "#7a2f2f", bottom: "#3a2a4a", headwear: "mahkota" });

// Hewan
const kerbau = kit.animal(-1.2, 0.2, 1.0, { s: 1.8, color: "#5c5650", horns: true, tail: "panjang" });
const harimau = kit.animal(0.8, 1.0, 0.9, { s: 1.4, color: "#e08a2e", tail: "panjang", stripes: true });
const kancil = kit.animal(0.2, 1.3, -0.9, { s: 0.9, color: "#b98a5a", ears: "runcing" });
const burung = kit.bird(0.4, 1.6, 0.2, 0.3, { s: 1.3 });            // (x, y, z, putaran)
const ikan = kit.swimmer(-0.5, 2.6, 1.2, { s: 1.2 });               // kind "ikan" (default) atau "buaya"
const buaya = kit.swimmer(1.0, 2.8, -1.0, { kind: "buaya" });
```

Menggerakkan tokoh di `update(t)` (semua fungsi murni dari `t`, pakai `sway`, `spring`, `ramp` dari `engine/math.ts`). Tokoh mengembalikan `root`, `head`, `armL`, `armR`, `legL`, `legR`:

```ts
ibu.armR.rotation.z = 0.35 + sway(t, 1) * 0.12;   // melambai (armL: nilai negatif)
anak.head.rotation.x = 0.25;                      // menunduk; rotation.y = menoleh
anak.legL.rotation.x = Math.sin(t * 6) * 0.3;     // berjalan di tempat
raja.root.position.x = lerp(1.0, 0.2, ramp(t, L(4).s, L(4).e));   // berjalan
burung.wingL.rotation.z = -0.5 + Math.sin(t * 9) * 0.5;
burung.wingR.rotation.z = 0.5 - Math.sin(t * 9) * 0.5;
kancil.tail.rotation.y = Math.sin(t * 4) * 0.3;   // animal mengembalikan root, head, tail
ikan.tail.rotation.y = Math.sin(t * 5) * 0.5;
```

Aturan scene:

- Paling banyak **3 tokoh** (orang atau hewan besar) per shot, supaya anak tahu siapa yang sedang diceritakan.
- Tokoh yang sama memakai **warna dan `headwear` yang sama** di semua shot.
- **Beri tokoh pose, jangan biarkan berdiri kaku.** Lengan yang sedang diceritakan selalu diberi gerak (`armR.rotation.z`), kepala sedikit menoleh ke arah lawan bicara, dan tokoh anak boleh diberi langkah kaki kecil.
- **Koreografi per baris (wajib):** jangan tulis pose manual per shot. Pakai preset `poseFigure` dan ganti mode sesuai baris yang sedang diucapkan:
  ```ts
  import { poseFigure } from "../../engine/kit";
  import { beat, pulse, stepIndex } from "../../engine/math";
  const step = stepIndex(t, [L(3), L(5), L(7)]);
  poseFigure(anak, t, step === 0 ? "walk" : step === 1 ? "talk" : "wave", 1); // "idle" | "talk" | "walk" | "wave" | "sad" | "point"
  anak.armR.rotation.z += beat(t, L(5)) * 0.5;   // gerakan besar tepat saat baris 5 diucapkan
  lentera.material.emissiveIntensity = pulse(t, L(5)) * 0.9; // benda yang diceritakan menyala selama barisnya
  ```
  `poseFigure` sudah mengurus napas, anggukan, dan kedipan mata (bagian `blink`), jadi tokoh tidak pernah membeku. Gate CI menolak shot yang objeknya tidak bergerak.
- **Isi latar dan hidupkan air:** `kit.cloud(x, y, z, s)` untuk awan yang bergeser (`sway`), `kit.ripple(x, z, maxR)` untuk riak air — panggil `ripple.setPhase(t * 0.4)`; `kit.prop(kind, x, y, z, s)` untuk benda cerita yang dikenali ("lantern" | "crate" | "pot" | "torch" | "scroll" | "rock" | "flower") alih-alih kotak polos.
- **Latar belakang harus terisi.** Selain alas diorama, taruh satu atau dua `kit.mountain` jauh di belakang (`z` sekitar -6 sampai -8), dan tutup sisa ruang dengan pohon atau bukit. Jangan tinggalkan dinding atau langit kosong setinggi setengah layar.
- **Isi lantai di sekitar tokoh:** 3–6 batu kecil, beberapa rumpun rumput, pagar pendek, jalan setapak. Alas kosong membuat adegan terasa belum jadi.
- **Tanpa `callouts` dan tanpa `chip`** di `shots.ts`. Layar hanya berisi adegan, judul, dan teks cerita. Cerita disampaikan lewat gerak tokoh, bukan label.
- `label` = jenis cerita dan daerah (mis. `"LEGENDA · SUMATRA BARAT"`); `title` = judul cerita.
- Warna cerah dan hangat. Latar langit terang; jangan gelap atau suram, juga di adegan sedih.
- Peta skematis (kalau perlu menunjukkan pulau) diberi `tag: "ILUSTRASI"`.
- Tidak boleh `Math.random()` atau `Date.now()`.
- Setiap frame dihitung ulang dari `t` dan frame bisa dirender tidak berurutan. Jadi **tulis `visible` dan posisi setiap frame dengan nilai langsung** — `putri.root.visible = t >= L(7).s;` — jangan hanya di dalam `if` yang mengubah satu arah (`if (belum) x.visible = false`), karena nilainya akan tertinggal dari frame sebelumnya.
- Caption: satu potongan ≤ 3 token per saat, tidak pernah dua.
- Kamera pelan dan tenang (`keyframes` dengan dua atau tiga posisi); jangan berputar cepat.
- **Bingkai:** tokoh yang sedang diceritakan harus berada di **tengah layar**, di antara judul (atas) dan teks cerita (bawah). Arahkan `target` kamera sedikit **di atas** kepala tokoh dan mundurkan kamera secukupnya, supaya adegan tidak menumpuk di balik judul dan separuh bawah layar tidak kosong.
- **Setiap shot punya sesuatu yang jelas untuk dilihat** — tokoh atau tempat. Kalau cerita membuat tokoh pergi atau tempat hilang (tenggelam, berubah jadi batu), shot penutup tetap menampilkan hasilnya dengan jelas (danau dengan pulau dan perahu, batu di pantai), bukan layar yang hampir kosong.

## Cerita tentang benda dan bangunan

Banyak cerita di backlog tentang benda (batik, angklung, keris, rendang), bangunan (candi, tugu, istana, jembatan), atau kendaraan (perahu, kapal, pesawat). Untuk cerita seperti itu:

- **Benda pusat cerita boleh dirakit** dari `kit.box/cyl/ball` dengan bentuk sederhana seperti mainan balok: candi = tumpukan balok yang mengecil ke atas; tugu = silinder tinggi dengan bola di puncak; angklung = beberapa silinder bambu berjajar; kain = balok tipis berwarna dengan garis-garis; makanan = bentuk bulat atau kerucut di atas piring silinder. Cukup dikenali, tidak perlu detail.
- Buat benda itu **besar dan di tengah**, lalu letakkan satu atau dua `kit.figure` di dekatnya yang membuat, memakai, atau menunjuknya. Tokoh tetap dari prefab.
- Kapal memakai `kit.boat`; pesawat cukup silinder badan dengan dua balok sayap.
- Jangan mencoba menggambar wajah, tulisan, atau ukiran pada benda.

## Musik latar

Di `src/videos/<slug>/config.json`, **wajib** isi field `"music"` sesuai suasana cerita (dipakai `scripts/music.mts` untuk meracik `public/<slug>/music.wav` dari koleksi track Cerpenek). Di `index.ts`, tetap pakai `music: { src: "<slug>/music.wav", volume: 0.14 }`.

Pilih satu dari 5 suasana ini:
- `"ceria"` — cerita jenaka, fabel lucu, permainan/jajanan tradisional (mis. *Si Kabayan*, *Kancil*, *Congklak*).
- `"hangat"` — kisah kasih sayang, keluarga, pendidikan, ketulusan (mis. *Malin Kundang*, *Kartini*, *Batu Menangis*).
- `"petualang"` — kisah keberanian, pahlawan, perjalanan penuh aksi ringan (mis. *Diponegoro*, *Cut Nyak Dhien*, *Timun Mas*).
- `"nusantara"` — kerajaan, candi, budaya daerah, alat musik & kain adat (mis. *Borobudur*, *Majapahit*, *Batik*, *Angklung*).
- `"ajaib"` — legenda asal-usul danau/alam/benda ajaib yang penuh rasa ingin tahu (mis. *Danau Toba*, *Keong Mas*, *Rawa Pening*).

## publish.json

`src/videos/<slug>/publish.json` — bentuk persis:

```json
{
  "account": "cerpenek",
  "title": "…",
  "description": "…",
  "tiktokTitle": "…",
  "tiktokCaption": "…",
  "catatan": "format: <id>; …"
}
```

- `account` wajib `"cerpenek"` (kena gate CI kalau beda).
- `title` ≤ 100 karakter, tanpa `<` dan `>`. Judul cerita dengan kata-kata khasnya sendiri, mis. "Malin Kundang, Anak yang Lupa pada Ibunya". **Jangan menaruh nama daerah atau kata "Legenda dari …" di judul** — itu membuat judul mirip dengan video lain dari daerah yang sama dan ditolak gate duplikat. Daerah cukup di deskripsi.
- `description`: ringkasan 2–3 kalimat untuk orang tua + `Legenda dari <daerah>.` atau `Kisah sejarah dari <daerah>.` + `Sumber: <URL sumber>` + `Animasi bersifat ilustrasi. Suara: AI (Google AI Studio).` + `#shorts` + 5–6 hashtag (mis. `#dongenganak #ceritarakyat`).
- `tiktokTitle` ≤ 90 karakter, `tiktokCaption` seperti description + `Suara: AI (Google AI Studio)`.
- `catatan` diawali `format: <id>;` dari `pick-format`.
- Tidak ada ajakan berkomentar di judul atau deskripsi.

## Refill backlog

Backlog diisi manual, kira-kira sebulan sekali, lewat PR yang ditinjau pemilik channel — konten anak tidak diisi otomatis. Kalau sisa cerita menipis dan isi ulang belum datang, channel berhenti dengan laporan ke Slack, bukan mengarang cerita.

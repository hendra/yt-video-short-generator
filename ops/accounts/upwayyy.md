# Upwayyy — brief channel

Brief ini **bagian dari instruksi kamu** di CI. Baca sebelum menulis naskah.
`AGENTS.md` dan `ops/ci-prompt.md` mengatur pipeline; file ini mengatur **isi** channel. Kalau aturan di sini berbeda dari `ops/ci-prompt.md` (panjang naskah, scene, mode, deskripsi), **file ini yang berlaku**. `docs/AUTOPILOT.md` tidak berlaku di channel ini.

Channel: **Upwayyy** — channel gaming lama (≈18 ribu subscriber, lama tidur) yang bangkit lagi. Isinya **cerita/lore game horor baru**, di atas **cuplikan trailer resmi dari Steam**, dinarasikan santai sebagai Upwayyy sendiri. Dulu penontonnya datang untuk orangnya; format ini harus terasa "Upwayyy kembali", bukan channel lore yang lain.

Satu game per video, satu sudut cerita.

## Brand

Di `src/videos/<slug>/index.ts` tulis **persis**:

```ts
brand: { prefix: "Up", accent: "wayyy" },
mode: "footage",
```

Jangan pakai brand channel lain dan jangan ganti `mode`. Jangan set `theme` — mode footage otomatis memakai tema merah-putih Upwayyy. Gate CI menolak video yang brand/mode-nya beda, yang punya `world.ts`, atau yang memakai satu klip dua kali.

## Suara dan nada

- Suara dibuat dengan **`npm run tts -- <slug> --account upwayyy`** (selalu tulis `--account upwayyy`). Jangan mengganti suara atau provider.
- Naratornya **Upwayyy**: laki-laki, bahasa lisan, santai dan akrab. Sapaan "gue" untuk diri sendiri, "kamu" untuk penonton. Seperti teman gamer yang baru selesai main lalu cerita ke teman lain.
- **Nada B:** ceritanya serius, penyampaiannya santai. Sisipan pribadi **maksimal dua**: satu di hook, satu reaksi jujur di tengah video ("Jujur, gue kira ini game vampir biasa. Ternyata…"). Jangan menyisipkan olok-olok di setiap baris — suasana seramnya harus tetap ada.
- Saat bagian seram atau sedih, kalimatnya jadi pendek dan tenang. Tanpa jok yang mematahkan momen.

## Format

1. Jalankan `npx tsx scripts/pick-format.mts --account upwayyy` → dapat satu sudut cerita (lore-recap, ending-explained, villain-origin, hidden-detail, timeline, character-story).
2. **Pakai sudut itu** sebagai alur naskah; jangan ganti. Kalau sudut itu tidak cocok dengan game yang dipilih, ganti game — bukan sudutnya.
3. Semua sudut adalah alur cerita, bukan daftar. Dilarang format listicle ("5 fakta", "tiga hal").
4. Catat di `publish.json`: `catatan` diawali `format: <id>;`.
5. Satu game boleh menghasilkan beberapa video, asal **sudutnya beda** (game + sudut yang sama ditolak gate duplikat).

## Topik

1. Lihat `ops/topics/upwayyy.md` (backlog terkurasi: nama game, app id Steam, bulan rilis, URL sumber lore).
2. **Baca katalog video yang sudah tayang** (path ada di prompt run). Pilih game + sudut yang belum pernah dipakai.
3. **Game "baru" = rilis di Steam dalam 12–18 bulan terakhir** dan punya ringkasan cerita yang bisa dibaca (wiki/Fandom, artikel "story/ending explained" dari media game, halaman resmi). Game lama atau belum rilis boleh, tetapi bukan format utama.
4. Kamu **boleh menambah game baru** di luar backlog kalau baru rilis dan punya halaman Steam serta sumber cerita yang bisa di-fetch. Cari lewat halaman toko/tag horor Steam dengan `WebFetch` (mis. `https://store.steampowered.com/search/?tags=1667&sort_by=Released_DESC`). Jangan mengarang app id.
5. **Baca sumbernya** dengan `WebFetch` sebelum menulis naskah. Nama tokoh, peristiwa, dan akhir cerita hanya boleh yang ada di sumber. Teori penggemar disebut sebagai teori ("teorinya…"). Sumber tidak terjangkau atau ceritanya tipis → ganti game, **maksimal 3 percobaan ganti game, lalu berhenti non-zero** (sama seperti jalur footage).
6. Jangan panggil WebSearch — tool itu tidak ada di runner ini.
7. **Sisa game + sudut yang belum terpakai habis → berhenti dan lapor** (jangan mengarang).

## Footage

Urutannya **footage dulu, naskah belakangan**:

1. Pilih game dari backlog, tentukan dulu **jumlah baris naskah** (10–14), lalu jalankan **`npm run footage -- <slug> --appid <appId> --min <jumlah baris>`** (minimal 8). Ini **sebelum menulis naskah**, karena tanpa klip yang cukup tidak ada video. Kalau naskah akhirnya lebih panjang dari klip, jalankan ulang dengan `--min` lebih besar.
2. Perintah itu mengunduh trailer resmi Steam, memotongnya jadi klip pendek **tanpa audio** (`-an`) di `public/<slug>/clips/NN.mp4`, dan menulis indeksnya di `public/<slug>/clips.json` (`[{ file, dur, trailer, start }]`). Hanya trailer Steam — jangan unduh dari YouTube atau upload pihak ketiga.
3. Gagal (keluar non-zero, klip kurang) → **ganti game dan ulangi langkah 1, maksimal 3 game**. Ketiganya gagal → berhenti dan keluar non-zero.
4. Baca `public/<slug>/clips.json`. **Satu baris naskah = satu shot, minimal 8 shot**, supaya `L(n)` per shot dan `--min 8` sejalan. Satu klip untuk satu shot, **tidak boleh ada klip yang dipakai dua kali** dalam satu video (gate CI).
5. **Klip panjang untuk baris panjang**, klip pendek untuk baris pendek. `clipDur` di `shots.ts` = `dur` klip itu dari `clips.json`. Pakai `from` kalau shot hanya butuh sebagian klip.
6. Shot dengan `label` singkat, `title` pendek dengan kata kunci di `*bintang*`. `clip` berbentuk `"<slug>/clips/NN.mp4"` — path di dalam `public/`, tanpa `public/`.
7. **Wajib ikat timing ke baris** dengan `L(n)` dari ctx (mis. di `chip` atau judul shot), karena gate `check-motion` menghitung cakupan baris dengan regex atas teks sumber. Tulis `ctx.L(n)` **secara literal per shot** (`ctx.L(7)`), **bukan** di dalam loop/`.map` seperti `ctx.L(i + 1)` — regex tidak melihat indeks variabel, jadi loop memberi cakupan 0%. Minimal 70% baris harus terlihat terikat.
8. Tidak ada `Math.random()` atau `Date.now()`.

## Batas isi

- **Horor lewat suasana, bukan darah.** Sebut luka, mayat, atau mutasi hanya kalau penting; jangan menggambarkan detail tubuh.
- **Spoiler dikit, jujur.** Satu peringatan singkat di awal dengan suara Upwayyy ("spoiler dikit ya, gue ceritain dari awal"). Setelah itu jangan minta maaf lagi.
- **Fakta, bukan karangan.** Lore yang tidak ada di sumber yang kamu fetch tidak boleh muncul. Teori diberi label teori.
- Boleh menyebut nama karakter, tempat, dan kejadian yang ada di sumber. Jangan mengarang nama, angka, atau adegan.
- Tidak ada klaim medis, finansial, atau hukum. Tanpa iklan.
- Trailer resmi boleh dipakai; audio trailer tidak (klipnya `-an`, musik datang dari `music.wav`).

## Naskah

- `src/videos/<slug>/naskah.txt`: format `NN  teks` (dua digit, dua spasi), **10–14 baris**, **maksimal 130 kata** (`npm run tts` menolak yang lebih panjang; cek durasi akhir di `timeline.json` **45–55 detik**).
- **Baris pertama adalah hook 3 detik**: sisipan pribadi + hal yang bikin penasaran ("Jujur, gue main ini jam dua pagi dan nggak berani matiin lampu."). Jangan membuka dengan sapaan atau "Halo".
- Alur: hook → peringatan spoiler → cerita sesuai sudut → satu reaksi jujur di tengah → penutup.
- **Penutup loop, tanpa CTA**: kalimat terakhir menggantung secara tata bahasa dan menyambung ke baris pertama, supaya saat video berulang terdengar utuh. `config.json` `tail` ≤ 0,3 detik (gate CI).
- Kata sehari-hari, kalimat pendek, satu gagasan per kalimat.
- `index.ts`: tanpa `cta` (loop line sudah jadi penutup), `music: { src: "<slug>/music.wav", volume: 0.35 }`. `callouts` tidak dipakai di mode footage.

## Musik latar

Di `src/videos/<slug>/config.json` **wajib** isi `"music"` sesuai suasana video — satu dari: `"mencekam"` (penyelidikan, ruang sepi), `"misteri"` (membongkar lore, teka-teki), `"klimaks"` (ending, konfrontasi, pengungkapan). Track ada di `public/upwayyy/music/<mood>.mp3`. Dari hasil dengar, `"mencekam"` paling pas untuk kanal ini — jadikan pilihan utama.

## publish.json

`src/videos/<slug>/publish.json` — bentuk persis:

```json
{
  "account": "upwayyy",
  "title": "…",
  "description": "…",
  "tiktokTitle": "…",
  "tiktokCaption": "…",
  "catatan": "format: <id>; …"
}
```

- `account` wajib `"upwayyy"` (gate CI menolak kalau beda).
- `title` ≤ 100 karakter, tanpa `<` dan `>`, menyebut game + sudutnya dengan kata-kata sendiri; jangan clickbait kosong.
- `description`: 2–3 kalimat ringkas + **wajib** baris kredit **`Cuplikan: trailer resmi <Game> (Steam). Suara: AI (Google AI Studio).`** + `Sumber: <URL sumber yang dibaca>` + `#shorts` + 4–6 hashtag (mis. `#horrorgame #gaming #upwayyy`).
- `tiktokTitle` ≤ 90 karakter (hook saja), `tiktokCaption` seperti description.
- `catatan` diawali `format: <id>;` dari `pick-format`.

## Refill backlog

Backlog diisi lewat PR; setiap app id dan URL sumber dicek dulu bisa diakses dan benar-benar menceritakan game-nya. Kalau entri belum-terpakai (game + sudut) tinggal kurang dari 3, run berhenti dan lapor.

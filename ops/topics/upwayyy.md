# Topik — channel Upwayyy

Backlog game horor Steam untuk **Upwayyy**: lore/cerita satu game per video, di atas trailer resminya.
Format baris: `- <slug>: <judul sudut> — appid <appId Steam> — rilis <YYYY-MM> — <URL sumber lore> <URL sumber lore>`.

Semua entri: rilis Steam **2025-05 atau lebih baru** (diperiksa lewat `api/appdetails` saat entri ditulis) dan punya minimal satu sumber yang benar-benar menceritakan plotnya. Satu game boleh dipakai lebih dari sekali dengan **sudut berbeda** dari `pick-format`; game + sudut sama ditolak gate duplikat.

Aturan pakai: pilih entri yang belum tayang, jalankan `npm run footage -- <slug> --appid <appId> --min <jumlah baris>` dulu, lalu baca kedua URL dengan `WebFetch` sebelum menulis naskah. Tambah game baru hanya dari halaman toko/tag horor Steam (`https://store.steampowered.com/search/?tags=1667&sort_by=Released_DESC`) — jangan mengarang app id.

## Horor naratif & survival horror

- silent-hill-f: Shimizu Hinako, desa Ebisugaoka, dan pernikahan yang mengubah segalanya — appid 2947440 — rilis 2025-09 — https://en.wikipedia.org/wiki/Silent_Hill_f https://stevivor.com/guides/silent-hill-f-story-explained
- cronos-the-new-dawn: The Change, Orphans, dan Weronika yang harus dikembalikan ke masa lalu — appid 2101960 — rilis 2025-09 — https://en.wikipedia.org/wiki/Cronos:_The_New_Dawn https://fandomwire.com/cronos-the-new-dawn-ending-explained
- directive-8020: Cassiopeia, kru yang terbangun di luar jadwal, dan sesuatu yang memakai wajah kru — appid 2255370 — rilis 2026-05 — https://en.wikipedia.org/wiki/Directive_8020 https://directive8020.org/story
- resident-evil-requiem: Grace Ashcroft, Wrenwood Hotel, dan warisan Raccoon City — appid 3764200 — rilis 2026-02 — https://en.wikipedia.org/wiki/Resident_Evil_Requiem https://screenrant.com/resident-evil-requiem-ending-explained
- tormented-souls-2: Caroline Walker, Anna, dan biara yang mengejar dua bersaudara Wildberger — appid 2464280 — rilis 2025-10 — https://pqube.co.uk/news/tormented-souls-2-steam-demo-new-story-teaser-trailer https://www.useapotion.com/2025/10/tormented-souls-2-playstation-5-review
- dead-take: pesta produser film, aktor yang hilang, dan rekaman yang harus disambung — appid 3352690 — rilis 2025-07 — https://adventuregamehotspot.com/review/5172/dead-take https://gamingtrend.com/reviews/dead-take-review-looking-for-the-leading-role
- little-nightmares-iii: Low, Alone, dan Spiral yang harus mereka lewati — appid 1392860 — rilis 2025-10 — https://en.wikipedia.org/wiki/Little_Nightmares_III https://www.escapistmagazine.com/little-nightmares-3-ending-explained
- the-midnight-walk: the Burnt One, Potboy, dan api yang dijaga sampai puncak Moon Mountain — appid 2863640 — rilis 2025-05 — https://en.wikipedia.org/wiki/The_Midnight_Walk https://gamingbolt.com/the-midnight-walk-review-a-dance-of-light-and-dark
- dementium-the-ward: William Redmoor bangun di bangsal tanpa ingatan, dan dokternya punya rencana — appid 3909960 — rilis 2025-10 — https://en.wikipedia.org/wiki/Dementium:_The_Ward
- dementium-ii: kartu pos dari dirinya sendiri dan rumah sakit yang berubah di antara dua dunia — appid 5342930 — rilis 2026-10 — https://en.wikipedia.org/wiki/Dementium_II
- dummy-house: ruang riset tertutup, "Experiment Nights", dan makhluk yang meniru manusia di kegelapan — appid 3681450 — rilis 2026-11 — https://thecrossover.studio https://store.steampowered.com/app/3681450
- house-2: Tabby, kutukan yang ikut pindah rumah, dan loop yang tak mau berhenti — appid 2586440 — rilis 2026-08 — https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/House2020 https://www.gamespress.com/HOUSE-2-LAUNCHES-AUGUST-28TH

## Catatan per entri

`dementium-ii`: sumbernya plot game DS aslinya (2010); rilis 2026 memakai cerita yang sama, jadi pakai sudut yang tidak bergantung pada detail baru. Kalau butuh detail versi 2026, baca juga halaman Steam-nya.

`vampire-the-masquerade-oaths-ashes`: visual novel bercabang — lebih cocok untuk sudut `lore-recap` atau `character-story` daripada `ending-explained` (banyak ending, tidak ada satu kanon).

`dummy-house`: sumbernya baru premis (belum ada artikel cerita/ending yang terbit), jadi cocok untuk sudut `lore-recap` saja; kalau tidak cukup, ganti game.

## Horor aksi, remake, dan horor unik

- the-house-of-the-dead-2-remake: agen AMS di kota yang sudah diambil alih Goldman dan ciptaannya — appid 3376690 — rilis 2025-08 — https://en.wikipedia.org/wiki/The_House_of_the_Dead_2
- midwest-90-rapid-city: rumah makan di tengah apokalips monster dan kota yang harus dipilih — appid 1818480 — rilis 2026-11 — https://www.gamespress.com/Midwest-90-Rapid-City-enters-Early-Access-November-10-with-a-new-trail https://steamcommunity.com/app/1818480
- vampire-the-masquerade-oaths-ashes: Alice, Lenz, dan Berlin yang harus tetap terpecah — appid 4191110 — rilis 2026-11 — https://gameinformer.com/2026/04/30/vampire-the-masquerade-oaths-and-ashes-is-a-visual-novel-set-in-contemporary-berlin https://finalweapon.net/2026/11/09/vampire-the-masquerade-oaths-ashes-review

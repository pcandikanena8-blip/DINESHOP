# Panduan: Web Pembayaran DOKU di Cloudflare

Project ini adalah versi Cloudflare dari script `doku_payment_nodejs`.
Isinya halaman toko, halaman status pembayaran, dan backend yang bicara dengan DOKU.

## Cara kerjanya

```
Pelanggan pilih paket ──► POST /api/create-payment ──► DOKU (buat halaman bayar)
        ▲                          │                          │
        │                          ▼                          ▼
  /sukses.html  ◄── redirect ── Pelanggan membayar di halaman resmi DOKU
        │                                                     │
        └─► GET /api/check-payment ──► DOKU (cek status)      │
                                                              ▼
                               POST /api/doku-notify ◄── DOKU (webhook: "sudah lunas")
```

Kunci rahasia DOKU **hanya** ada di sisi server (Cloudflare Worker), tidak pernah dikirim ke browser.

---

## Langkah 1. Ambil Client ID dan Secret Key dari DOKU

Ini yang tadinya kosong di script Anda (`client_id = ""` dan `secret_key = ""`).

1. Daftar akun **Sandbox** (uji coba, gratis, tanpa uang asli):
   https://sandbox.doku.com/bo/sandbox-registration
2. Login ke https://sandbox.doku.com/bo/login
3. Di menu samping pilih **Settings**, lalu di bagian *Account* pilih **API Keys**.
4. **Client ID** langsung terlihat (bentuknya `BRN-xxxx-xxxxxxxxxxxxx`).
5. Klik **Reveal Key** di Secret Key, masukkan kode OTP 6 digit yang dikirim ke email Anda.
   Secret Key (bentuknya `SK-xxxx...`) hanya tampil 30 detik, jadi langsung salin.

> Kunci Sandbox dan kunci Production **berbeda**. Sekarang pakai yang Sandbox dulu.

---

## Langkah 2. Jalankan di komputer sendiri

Butuh Node.js (versi LTS) dari https://nodejs.org

```bash
cd toko-doku
npm install
cp .dev.vars.example .dev.vars      # Windows: copy .dev.vars.example .dev.vars
```

Buka file `.dev.vars`, isi Client ID dan Secret Key dari Langkah 1:

```
DOKU_CLIENT_ID=BRN-0000-0000000000000
DOKU_SECRET_KEY=SK-xxxxxxxxxxxxxxxxxxxx
```

Lalu jalankan:

```bash
npm run dev
```

Buka http://localhost:8787, pilih paket, isi data, klik **Bayar**. Anda akan diarahkan ke halaman
pembayaran DOKU Sandbox. Untuk "membayar" tanpa uang asli, pakai simulator DOKU:
https://sandbox.doku.com/integration/simulator/

---

## Langkah 3. Upload ke Cloudflare

```bash
npx wrangler login                       # membuka browser, izinkan akses ke akun Cloudflare
npm run deploy                           # upload web Anda
npx wrangler secret put DOKU_CLIENT_ID   # tempel Client ID lalu Enter
npx wrangler secret put DOKU_SECRET_KEY  # tempel Secret Key lalu Enter
```

Selesai deploy, Cloudflare menampilkan alamat seperti `https://toko-doku.NAMA-ANDA.workers.dev`.
Buka alamat itu dan coba lagi seperti di Langkah 2.

**Pakai domain sendiri:** di dashboard Cloudflare buka *Workers & Pages* → `toko-doku` →
*Settings* → *Domains & Routes* → *Add* → *Custom Domain*. Setelah aktif, buka `wrangler.jsonc`,
hapus tanda `//` di baris `SITE_URL` dan isi dengan domain Anda, lalu `npm run deploy` lagi.

---

## Langkah 4. Pasang Notification URL di DOKU (penting)

Webhook adalah cara DOKU memberi tahu web Anda bahwa pelanggan **sudah membayar**.

URL Anda: `https://DOMAIN-ANDA/api/doku-notify`

1. Login ke dashboard DOKU Sandbox.
2. Buka menu **Configuration** (di tampilan baru bisa bernama **Settings**).
3. Pilih jenis pembayaran yang Anda aktifkan (*Virtual Account*, *Credit Card*, *E-Money*, dll).
4. Klik **Configure** pada tiap channel, isi kolom **Notification URL** dengan URL di atas, simpan.

Ini harus dilakukan **per channel**. DOKU tidak bisa mengirim ke `localhost`, jadi webhook baru
bisa dites setelah web ter-deploy (atau lewat tunnel seperti localhost.run).

**Catatan QRIS:** QRIS di DOKU Checkout perlu diaktifkan lebih dulu lewat tim DOKU, dan format
notifikasinya berbeda dari channel lain. Webhook di project ini tidak membaca format QRIS.
Sebagai gantinya, halaman `sukses.html` bertanya langsung ke DOKU dan mencatat lunas dari sana,
jadi pesanan QRIS tetap tercatat selama pelanggan kembali ke halaman itu.

---

## Langkah 5. Tes

1. Buat pesanan di web Anda.
2. Bayar lewat simulator DOKU Sandbox.
3. Halaman `sukses.html` harus berubah menjadi **Pembayaran berhasil**.
4. Lihat log langsung: `npx wrangler tail`. Anda akan melihat baris `PEMBAYARAN SUKSES ...`.
5. Notifikasi yang tidak masuk bisa dikirim ulang dari dashboard DOKU: *Tools → HTTP Notification*.

---

## Langkah 6. Go live (terima uang asli)

1. Daftar di https://dashboard.doku.com/bo/register, lengkapi data bisnis (proses verifikasi/KYB oleh DOKU).
2. Setelah disetujui, ambil Client ID dan Secret Key **Production** (caranya sama seperti Langkah 1).
3. Di `wrangler.jsonc` ubah `"DOKU_ENV": "sandbox"` menjadi `"DOKU_ENV": "production"`.
4. Ganti secret dengan kunci Production:
   ```bash
   npx wrangler secret put DOKU_CLIENT_ID
   npx wrangler secret put DOKU_SECRET_KEY
   npm run deploy
   ```
5. Pasang lagi Notification URL di dashboard **Production** (Langkah 4 dilakukan ulang, karena Sandbox dan Production terpisah).
6. Coba satu transaksi kecil sungguhan sebelum diumumkan.

---

## Menyimpan pesanan (disarankan sebelum go live)

Tanpa penyimpanan, web hanya menulis log saat pembayaran sukses. Untuk mencatat pesanan
dan mencegah logika bisnis jalan dua kali, aktifkan Cloudflare KV:

```bash
npx wrangler kv namespace create ORDERS
```

Salin `id` yang muncul, buka `wrangler.jsonc`, hapus tanda `//` pada bagian `kv_namespaces`,
tempel id-nya, lalu `npm run deploy`.

Logika setelah lunas (kirim email/WhatsApp, aktifkan akun, kirim link download) ditaruh di
`src/orders.js`, di bagian bertanda `TARUH LOGIKA BISNIS ANDA DI SINI`.

---

## Mengubah isi web

| Yang ingin diubah | File |
| --- | --- |
| Produk dan harga | `src/products.js` |
| Nama toko, teks, tampilan | `public/index.html`, `public/style.css` |
| Batasi metode bayar (mis. hanya QRIS dan BCA VA) | `DOKU_PAYMENT_METHODS` di `wrangler.jsonc` |
| Batas waktu bayar | `PAYMENT_DUE_MINUTES` di `wrangler.jsonc` |

Harga sengaja ditentukan di `src/products.js` (server). Jangan pernah menerima harga dari browser.

---

## Kalau ada masalah

| Gejala | Kemungkinan penyebab |
| --- | --- |
| "Kunci DOKU belum diisi" | Secret belum dipasang. Lokal: cek `.dev.vars`. Cloudflare: jalankan `wrangler secret put` lagi. |
| "Gagal membuat pembayaran" dengan detail *signature* atau *client id* | Client ID/Secret Key salah, atau kunci Sandbox dipakai di mode `production` (atau sebaliknya). Cek `DOKU_ENV`. |
| Metode bayar yang dipilih tidak muncul / ditolak | Channel itu belum aktif di akun DOKU Anda. Kosongkan `DOKU_PAYMENT_METHODS` untuk menampilkan semua yang aktif. |
| Sudah bayar tapi tidak tercatat | Notification URL belum dipasang untuk channel itu (Langkah 4). Cek log dengan `npx wrangler tail`. |
| Log menulis "Notifikasi ditolak: signature tidak valid" | Secret Key di Cloudflare tidak sama dengan yang dipakai DOKU untuk mengirim notifikasi. |

## Keamanan

- Jangan menaruh Secret Key di file mana pun di folder `public/`, dan jangan ikut mengunggah `.dev.vars` ke GitHub (sudah ada di `.gitignore`).
- Kalau Secret Key pernah bocor: dashboard DOKU → *Settings* → *API Keys* → *Regenerate Secret Key*, lalu pasang yang baru dengan `wrangler secret put`. Kunci lama langsung tidak berlaku.
- Status "berhasil" di halaman sukses selalu berasal dari server Anda yang bertanya ke DOKU, bukan dari alamat di browser, jadi tidak bisa dipalsukan hanya dengan mengetik URL.

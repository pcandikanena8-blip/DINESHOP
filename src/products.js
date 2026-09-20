// >>> GANTI ISI FILE INI DENGAN PRODUK/LAYANAN ANDA <<<
//
// Harga sengaja disimpan di server. Kalau harga dikirim dari browser,
// siapa pun bisa membuka DevTools lalu mengubah harga Rp 50.000 jadi Rp 1.
//
// price = rupiah, tanpa desimal.
export const PRODUCTS = {
  "paket-hemat": {
    name: "Paket Hemat",
    description: "Cocok untuk mencoba dulu.",
    price: 10000,
  },
  "paket-standar": {
    name: "Paket Standar",
    description: "Pilihan paling banyak dipakai.",
    price: 25000,
  },
  "paket-lengkap": {
    name: "Paket Lengkap",
    description: "Semua fitur, tanpa batas.",
    price: 50000,
  },
};

export function listProducts() {
  return Object.entries(PRODUCTS).map(([id, p]) => ({ id, ...p }));
}

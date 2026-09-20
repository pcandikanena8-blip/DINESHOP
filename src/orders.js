// Pencatatan pesanan. Semua fungsi di sini AMAN dipakai walaupun Anda belum
// membuat penyimpanan: kalau binding KV bernama ORDERS belum dipasang,
// fungsi-fungsi ini hanya menulis log dan tidak melakukan apa-apa.
//
// Untuk mengaktifkan penyimpanan, lihat bagian "Menyimpan pesanan" di PANDUAN.md.

const NINETY_DAYS = 60 * 60 * 24 * 90;

const key = (invoice) => `order:${invoice}`;

export async function saveOrder(env, order) {
  if (!env.ORDERS) return;
  await env.ORDERS.put(key(order.invoice), JSON.stringify(order), { expirationTtl: NINETY_DAYS });
}

export async function getOrder(env, invoice) {
  if (!env.ORDERS) return null;
  const raw = await env.ORDERS.get(key(invoice));
  return raw ? JSON.parse(raw) : null;
}

/**
 * Dipanggil SETELAH notifikasi dari DOKU terverifikasi dan statusnya SUCCESS.
 * Fungsi ini bisa terpanggil dari beberapa jalur (webhook DOKU, dan halaman
 * sukses yang mengecek status), bahkan lebih dari sekali. Supaya logika bisnis
 * di bawah tidak jalan dua kali (mis. email terkirim dobel), AKTIFKAN
 * penyimpanan KV (lihat PANDUAN.md) atau pakai database Anda sendiri.
 * Dengan KV, panggilan kedua dan seterusnya langsung berhenti di pengecekan "PAID".
 */
export async function markPaid(env, invoice, info) {
  console.log("PEMBAYARAN SUKSES", invoice, JSON.stringify(info));

  const order = (await getOrder(env, invoice)) || { invoice };
  if (order.status === "PAID") return order; // sudah diproses sebelumnya

  // Jaga-jaga: nominal yang dibayar harus sama dengan nominal pesanan kita.
  if (order.amount && info.amount && Number(order.amount) !== Number(info.amount)) {
    console.warn("NOMINAL TIDAK COCOK", invoice, order.amount, info.amount);
    order.status = "REVIEW";
  } else {
    order.status = "PAID";
  }
  order.paidAt = info.paidAt || new Date().toISOString();
  order.channel = info.channel || null;

  if (env.ORDERS) {
    await env.ORDERS.put(key(invoice), JSON.stringify(order), { expirationTtl: NINETY_DAYS });
  }

  // >>> TARUH LOGIKA BISNIS ANDA DI SINI <<<
  // Contoh: kirim email/WhatsApp konfirmasi, aktifkan akun premium,
  // kurangi stok, kirim link download, dan sebagainya.
  // Hanya jalankan kalau order.status === "PAID".

  return order;
}

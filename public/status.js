(() => {
  const invoice = new URLSearchParams(location.search).get("invoice") || "";
  const card = document.getElementById("card");

  const VIEWS = {
    SUCCESS: {
      icon: "✓", tone: "",
      title: "Pembayaran berhasil",
      text: "Terima kasih! Pembayaran Anda sudah kami terima.",
      final: true,
    },
    PENDING: {
      icon: "…", tone: "warn",
      title: "Menunggu pembayaran",
      text: "Kami belum menerima pembayaran Anda. Kalau Anda baru saja membayar, halaman ini diperbarui otomatis.",
    },
    FAILED: {
      icon: "!", tone: "bad",
      title: "Pembayaran belum berhasil",
      text: "Transaksi belum selesai. Anda bisa membuka lagi halaman pembayaran atau membuat pesanan baru.",
    },
    EXPIRED: {
      icon: "!", tone: "bad",
      title: "Waktu pembayaran habis",
      text: "Pesanan ini kedaluwarsa. Silakan buat pesanan baru.",
      final: true,
    },
  };
  VIEWS.NOT_FOUND = VIEWS.PENDING;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function paint(status) {
    const v = VIEWS[status] || VIEWS.PENDING;
    card.innerHTML = `
      <div class="status-icon ${v.tone}" aria-hidden="true">${v.icon}</div>
      <h1>${v.title}</h1>
      <p>${v.text}</p>
      <div class="invoice-line"><span>Nomor invoice</span><code>${esc(invoice)}</code></div>
      <div class="actions">
        <a class="btn" href="/">Kembali ke toko</a>
      </div>`;
    return Boolean(v.final);
  }

  if (!invoice) {
    card.innerHTML = `
      <div class="status-icon bad" aria-hidden="true">!</div>
      <h1>Nomor invoice tidak ditemukan</h1>
      <p>Buka halaman ini lewat tautan setelah pembayaran.</p>
      <div class="actions"><a class="btn" href="/">Kembali ke toko</a></div>`;
    return;
  }

  // Cek ke server tiap 4 detik, maksimal 30 kali (2 menit).
  // Status "SUCCESS" di sini datang dari server kita yang bertanya langsung ke DOKU,
  // bukan dari parameter di URL, jadi tidak bisa dipalsukan.
  let attempts = 0;
  async function check() {
    attempts++;
    try {
      const res = await fetch(`/api/check-payment?invoice=${encodeURIComponent(invoice)}`);
      const data = await res.json();
      if (res.ok) {
        const done = paint(data.status);
        if (done) return;
      }
    } catch { /* jaringan putus sesaat, coba lagi */ }
    if (attempts < 30) setTimeout(check, 4000);
  }
  check();
})();

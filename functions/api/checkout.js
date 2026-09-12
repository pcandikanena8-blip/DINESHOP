// File ini letaknya di: functions/api/checkout.js (di root project Cloudflare Pages kamu)
// Endpoint otomatis jadi: https://namasitus-kamu.pages.dev/api/checkout
//
// Environment Variables yang dipakai (Cloudflare Pages > Settings > Variables and secrets):
//   BOT_TOKEN        -> WAJIB, set sebagai tipe "Secret". Token dari @BotFather.
//   ADMIN_CHAT_ID    -> WAJIB. Chat id kamu.
//   FRONTEND_ORIGIN  -> opsional. Kalau diisi, hanya request dari origin ini yang diterima.
//   MAX_UPLOAD_MB    -> opsional. Batas ukuran file bukti bayar (default 8MB kalau kosong).

export async function onRequestPost({ request, env }) {
  try {
    // Validasi origin, kalau FRONTEND_ORIGIN diisi
    const origin = request.headers.get("Origin");
    if (env.FRONTEND_ORIGIN && origin && origin !== env.FRONTEND_ORIGIN) {
      return json({ ok: false, error: "Origin tidak diizinkan." }, 403);
    }

    if (!env.BOT_TOKEN || !env.ADMIN_CHAT_ID) {
      return json({ ok: false, error: "BOT_TOKEN / ADMIN_CHAT_ID belum diset di environment variables." }, 500);
    }

    const formData = await request.formData();

    const order = formData.get("order") || "-";
    const username = formData.get("username") || "-";
    const phone = normalizePhone(formData.get("phone"));
    const payment = formData.get("payment") || "-";
    const total = formData.get("total") || "-";
    const productsList = formData.get("products") || "-";
    const proof = formData.get("proof"); // file, bisa kosong

    if (!phone) {
      return json({ ok: false, error: "Nomor WhatsApp tidak valid." }, 400);
    }

    const maxBytes = (Number(env.MAX_UPLOAD_MB) || 8) * 1024 * 1024;
    if (proof && typeof proof === "object" && proof.size > maxBytes) {
      return json({ ok: false, error: `File terlalu besar. Maksimal ${Number(env.MAX_UPLOAD_MB) || 8}MB.` }, 413);
    }

    const caption =
      `🛒 *Pesanan Baru*\n` +
      `No: ${order}\n` +
      `Username Roblox: ${username}\n` +
      `WhatsApp: ${phone}\n` +
      `[Buka chat WhatsApp](https://wa.me/${phone})\n` +
      `Metode: ${payment}\n` +
      `Total: ${total}\n\n` +
      `Produk:\n${productsList}`;

    const hasProof = proof && typeof proof === "object" && proof.size > 0;

    const tgForm = new FormData();
    tgForm.append("chat_id", env.ADMIN_CHAT_ID);
    tgForm.append("parse_mode", "Markdown");

    let tgUrl;
    if (hasProof) {
      tgUrl = `https://api.telegram.org/bot${env.BOT_TOKEN}/sendPhoto`;
      tgForm.append("caption", caption);
      tgForm.append("photo", proof, proof.name || "bukti.jpg");
    } else {
      tgUrl = `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`;
      tgForm.append("text", caption);
    }

    const tgRes = await fetch(tgUrl, { method: "POST", body: tgForm });

    if (!tgRes.ok) {
      const errText = await tgRes.text();
      return json({ ok: false, error: `Telegram API error: ${errText}` }, 502);
    }

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("8")) return `62${digits}`;
  return "";
}

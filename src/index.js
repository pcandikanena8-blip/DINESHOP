import { PRODUCTS, listProducts } from "./products.js";
import { createCheckout, getOrderStatus, verifyNotification, isConfigured } from "./doku.js";
import { saveOrder, getOrder, markPaid } from "./orders.js";

// Membersihkan kunci dari spasi, enter, atau tanda kutip yang tak sengaja ikut ter-paste.
const clean = (v) => String(v ?? "").trim().replace(/^["'`]+|["'`]+$/g, "").trim();
function cleanEnv(env) {
  return { ...env, DOKU_CLIENT_ID: clean(env.DOKU_CLIENT_ID), DOKU_SECRET_KEY: clean(env.DOKU_SECRET_KEY), DOKU_ENV: clean(env.DOKU_ENV) };
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

// Nomor invoice unik, contoh: INV-MFK3Z9QA7B2C (maks 30 karakter, aman untuk kartu kredit)
function makeInvoice() {
  const rand = crypto.getRandomValues(new Uint8Array(5));
  const suffix = Array.from(rand, (b) => b.toString(36).padStart(2, "0")).join("").toUpperCase();
  return `INV-${Date.now().toString(36).toUpperCase()}${suffix}`.slice(0, 30);
}

// 0812-3456-7890 -> 6281234567890
function normalizePhone(input) {
  const digits = String(input || "").replace(/\D/g, "");
  if (digits.startsWith("0")) return "62" + digits.slice(1);
  if (digits.startsWith("62")) return digits;
  return digits ? "62" + digits : "";
}

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/* -------------------------- GET /api/products -------------------------- */
function handleProducts(env) {
  return json({
    env: env.DOKU_ENV === "production" ? "production" : "sandbox",
    products: listProducts(),
  });
}

/* ------------------------ POST /api/create-payment ---------------------- */
async function handleCreate(request, env, url) {
  if (!isConfigured(env)) {
    return json(
      { error: "Kunci DOKU belum diisi. Isi DOKU_CLIENT_ID dan DOKU_SECRET_KEY (lihat PANDUAN.md)." },
      500
    );
  }

  const input = await readBody(request);
  if (!input) return json({ error: "Data yang dikirim tidak valid." }, 400);

  const product = PRODUCTS[input.productId];
  if (!product) return json({ error: "Produk tidak ditemukan." }, 400);

  const quantity = Number.parseInt(input.quantity, 10);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    return json({ error: "Jumlah harus antara 1 dan 10." }, 400);
  }

  const name = String(input.name || "").trim().slice(0, 100);
  if (name.length < 2) return json({ error: "Nama wajib diisi." }, 400);

  const phone = normalizePhone(input.phone);
  if (phone.length < 9 || phone.length > 16) {
    return json({ error: "Nomor WhatsApp tidak valid." }, 400);
  }

  const email = String(input.email || "").trim().slice(0, 128);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Format email tidak valid." }, 400);
  }

  // Nominal dihitung di server dari daftar produk, bukan dari browser.
  const amount = product.price * quantity;
  const invoice = makeInvoice();
  const siteUrl = (env.SITE_URL || url.origin).replace(/\/$/, "");

  const customer = { name, phone, country: "ID" };
  if (email) customer.email = email;

  const result = await createCheckout(env, {
    invoice,
    amount,
    callbackUrl: `${siteUrl}/sukses.html?invoice=${encodeURIComponent(invoice)}`,
    cancelUrl: `${siteUrl}/batal.html`,
    customer,
    lineItems: [
      {
        id: String(input.productId).slice(0, 64),
        sku: String(input.productId).slice(0, 64),
        name: product.name,
        price: product.price,
        quantity,
      },
    ],
  });

  const paymentUrl = result.data?.response?.payment?.url;
  if (!result.ok || !paymentUrl) {
    console.error("DOKU menolak permintaan:", result.status, JSON.stringify(result.data));
    const detail = result.data?.error?.message || result.data?.message?.join?.(", ") || null;
    return json(
      {
        error: "Gagal membuat pembayaran. Coba lagi sebentar lagi.",
        detail,
        // Info diagnostik (aman, bukan isi kunci). Hapus blok ini kalau sudah beres.
        debug: {
          dokuStatus: result.status,
          mode: env.DOKU_ENV === "production" ? "production" : "sandbox",
          clientIdAwalBRN: env.DOKU_CLIENT_ID.startsWith("BRN-"),
          clientIdPanjang: env.DOKU_CLIENT_ID.length,
          secretAwalSK: env.DOKU_SECRET_KEY.startsWith("SK-"),
          secretPanjang: env.DOKU_SECRET_KEY.length,
        },
      },
      502
    );
  }

  await saveOrder(env, {
    invoice,
    productId: input.productId,
    quantity,
    amount,
    customer: { name, phone, email },
    status: "PENDING",
    createdAt: new Date().toISOString(),
  });

  return json({ invoice, paymentUrl });
}

/* ------------------------ GET /api/check-payment ------------------------ */
async function handleCheck(url, env) {
  const invoice = url.searchParams.get("invoice") || "";
  if (!/^[A-Za-z0-9._-]{4,64}$/.test(invoice)) {
    return json({ error: "Nomor invoice tidak valid." }, 400);
  }

  // Kalau webhook sudah mencatat lunas, langsung jawab.
  const order = await getOrder(env, invoice);
  if (order?.status === "PAID") return json({ invoice, status: "SUCCESS" });

  if (!isConfigured(env)) return json({ error: "Kunci DOKU belum diisi." }, 500);

  const result = await getOrderStatus(env, invoice);
  if (result.ok) {
    const status = result.data?.transaction?.status || "PENDING";
    // Jaring pengaman: jawaban ini datang langsung dari DOKU (bukan dari browser),
    // jadi boleh dipercaya. Berguna untuk QRIS (format notifikasinya berbeda) dan
    // kalau webhook terlambat. markPaid() aman dipanggil berulang.
    if (status === "SUCCESS") {
      await markPaid(env, invoice, {
        amount: result.data?.order?.amount,
        channel: result.data?.channel?.id,
        paidAt: result.data?.transaction?.date,
      });
    }
    return json({ invoice, status });
  }
  if (result.status === 404) return json({ invoice, status: "NOT_FOUND" });

  console.error("Cek status gagal:", result.status, JSON.stringify(result.data));
  return json({ error: "Gagal mengecek status pembayaran." }, 502);
}

/* ------------------------ POST /api/doku-notify ------------------------- */
// URL inilah yang Anda masukkan sebagai "Notification URL" di dashboard DOKU.
async function handleNotify(request, env) {
  const rawBody = await request.text(); // harus teks mentah, jangan di-parse dulu

  const valid = await verifyNotification(request, rawBody, env);
  if (!valid) {
    console.warn("Notifikasi ditolak: signature tidak valid");
    return json({ error: "Signature tidak valid." }, 401);
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "Body bukan JSON." }, 400);
  }

  const invoice = payload?.order?.invoice_number;
  const status = payload?.transaction?.status;

  // Untuk DOKU Checkout, status FAILED diabaikan: pelanggan masih boleh mencoba
  // metode lain di halaman yang sama. Hanya SUCCESS yang kita proses.
  if (invoice && status === "SUCCESS") {
    await markPaid(env, invoice, {
      amount: payload?.order?.amount,
      channel: payload?.channel?.id,
      paidAt: payload?.transaction?.date,
    });
  }

  // Wajib balas 2xx supaya DOKU berhenti mengirim ulang.
  return json({ ok: true });
}

/* --------------------------------- Router -------------------------------- */
export default {
  async fetch(request, rawEnv) {
    const env = cleanEnv(rawEnv);
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/products" && request.method === "GET") return handleProducts(env);
      if (url.pathname === "/api/create-payment" && request.method === "POST") return await handleCreate(request, env, url);
      if (url.pathname === "/api/check-payment" && request.method === "GET") return await handleCheck(url, env);
      if (url.pathname === "/api/doku-notify" && request.method === "POST") return await handleNotify(request, env);
      if (url.pathname.startsWith("/api/")) return json({ error: "Tidak ditemukan." }, 404);

      // Selain /api/*, layani file statis dari folder public/
      return env.ASSETS.fetch(request);
    } catch (err) {
      console.error("Error tak terduga:", err);
      return json({ error: "Terjadi kesalahan di server." }, 500);
    }
  },
};

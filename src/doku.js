// Semua urusan bicara dengan DOKU ada di file ini.
//
// Kenapa berbeda dari script Node.js asli?
// Cloudflare Workers TIDAK menjalankan Node.js. Modul `crypto` bawaan Node dan
// library `axios` tidak tersedia, jadi diganti dengan:
//   - Web Crypto API  (crypto.subtle)  -> untuk SHA-256 dan HMAC-SHA256
//   - fetch()                          -> untuk memanggil API DOKU
// Rumus signature-nya SAMA PERSIS dengan script asli.

const encoder = new TextEncoder();

function bytesToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** Digest = base64(SHA-256(body)) */
export async function sha256Base64(text) {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(text));
  return bytesToBase64(hash);
}

async function hmacSha256Base64(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return bytesToBase64(signature);
}

/** Signature = "HMACSHA256=" + base64(HMAC-SHA256(secret, komponen)) */
export async function buildSignature({ clientId, requestId, timestamp, target, digest, secret }) {
  let component =
    `Client-Id:${clientId}\n` +
    `Request-Id:${requestId}\n` +
    `Request-Timestamp:${timestamp}\n` +
    `Request-Target:${target}`;
  if (digest) component += `\nDigest:${digest}`;
  return "HMACSHA256=" + (await hmacSha256Base64(secret, component));
}

/** Format waktu yang diminta DOKU: UTC, tanpa milidetik. Contoh: 2026-09-19T08:30:00Z */
export function nowTimestamp() {
  return new Date().toISOString().slice(0, 19) + "Z";
}

/** sandbox = uji coba (uang palsu). production = uang asli. */
export function apiBase(env) {
  return env.DOKU_ENV === "production"
    ? "https://api.doku.com"
    : "https://api-sandbox.doku.com";
}

export function isConfigured(env) {
  return Boolean(env.DOKU_CLIENT_ID && env.DOKU_SECRET_KEY);
}

async function readJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

/**
 * Membuat halaman pembayaran DOKU Checkout dan mengembalikan payment.url
 * (setara dengan generate_payment_url.js).
 */
export async function createCheckout(env, { invoice, amount, callbackUrl, cancelUrl, customer, lineItems }) {
  const target = "/checkout/v1/payment";

  const body = {
    order: {
      amount,
      invoice_number: invoice,
      currency: "IDR",
      callback_url: callbackUrl,
      callback_url_cancel: cancelUrl,
      auto_redirect: true,
      line_items: lineItems,
    },
    payment: {
      payment_due_date: Number(env.PAYMENT_DUE_MINUTES) || 60,
    },
    customer,
  };

  // Kosongkan DOKU_PAYMENT_METHODS = tampilkan semua channel yang aktif di akun DOKU.
  const methods = (env.DOKU_PAYMENT_METHODS || "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  if (methods.length) body.payment.payment_method_types = methods;

  // Penting: string yang di-digest HARUS sama persis dengan yang dikirim.
  const bodyString = JSON.stringify(body);
  const requestId = crypto.randomUUID();
  const timestamp = nowTimestamp();
  const digest = await sha256Base64(bodyString);
  const signature = await buildSignature({
    clientId: env.DOKU_CLIENT_ID,
    requestId,
    timestamp,
    target,
    digest,
    secret: env.DOKU_SECRET_KEY,
  });

  const res = await fetch(apiBase(env) + target, {
    method: "POST",
    headers: {
      "Client-Id": env.DOKU_CLIENT_ID,
      "Request-Id": requestId,
      "Request-Timestamp": timestamp,
      Signature: signature,
      "Content-Type": "application/json",
    },
    body: bodyString,
  });

  return { ok: res.ok, status: res.status, data: await readJson(res) };
}

/**
 * Menanyakan status pembayaran ke DOKU berdasarkan nomor invoice
 * (setara dengan cek_payment.js). Request GET tidak punya Digest.
 */
export async function getOrderStatus(env, invoice) {
  const target = "/orders/v1/status/" + invoice;
  const requestId = crypto.randomUUID();
  const timestamp = nowTimestamp();
  const signature = await buildSignature({
    clientId: env.DOKU_CLIENT_ID,
    requestId,
    timestamp,
    target,
    digest: "",
    secret: env.DOKU_SECRET_KEY,
  });

  const res = await fetch(apiBase(env) + target, {
    method: "GET",
    headers: {
      "Client-Id": env.DOKU_CLIENT_ID,
      "Request-Id": requestId,
      "Request-Timestamp": timestamp,
      Signature: signature,
    },
  });

  return { ok: res.ok, status: res.status, data: await readJson(res) };
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Memastikan notifikasi benar-benar dari DOKU (bukan orang iseng yang
 * memanggil URL webhook Anda). Memakai rumus signature yang sama, dengan
 * Request-Target = path URL notifikasi Anda (mis. /api/doku-notify).
 */
export async function verifyNotification(request, rawBody, env) {
  const h = request.headers;
  const clientId = h.get("Client-Id");
  const requestId = h.get("Request-Id");
  const timestamp = h.get("Request-Timestamp");
  const received = h.get("Signature");
  if (!clientId || !requestId || !timestamp || !received) return false;
  if (clientId !== env.DOKU_CLIENT_ID) return false;

  const digest = await sha256Base64(rawBody);
  const expected = await buildSignature({
    clientId,
    requestId,
    timestamp,
    target: new URL(request.url).pathname,
    digest,
    secret: env.DOKU_SECRET_KEY,
  });
  return safeEqual(expected, received);
}

(() => {
  const rupiah = (n) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

  const $ = (id) => document.getElementById(id);
  const els = {
    list: $("products"),
    badge: $("env-badge"),
    form: $("order-form"),
    sumName: $("sum-name"),
    sumPrice: $("sum-price"),
    qtyValue: $("qty-value"),
    qtyMinus: $("qty-minus"),
    qtyPlus: $("qty-plus"),
    total: $("total"),
    error: $("form-error"),
    pay: $("pay-btn"),
  };

  const state = { products: [], selectedId: null, qty: 1 };
  const selected = () => state.products.find((p) => p.id === state.selectedId) || null;

  function showError(message) {
    els.error.textContent = message;
    els.error.hidden = !message;
  }

  function render() {
    const p = selected();
    els.qtyValue.textContent = state.qty;
    els.qtyMinus.disabled = state.qty <= 1;
    els.qtyPlus.disabled = state.qty >= 10;
    if (p) {
      els.sumName.textContent = p.name;
      els.sumPrice.textContent = `${state.qty} × ${rupiah(p.price)}`;
      els.total.textContent = rupiah(p.price * state.qty);
      els.pay.textContent = `Bayar ${rupiah(p.price * state.qty)}`;
    } else {
      els.sumName.textContent = "Belum ada paket dipilih";
      els.sumPrice.textContent = "";
      els.total.textContent = rupiah(0);
      els.pay.textContent = "Bayar sekarang";
    }
  }

  function renderProducts() {
    els.list.querySelectorAll("label.product, #products-loading").forEach((n) => n.remove());
    for (const p of state.products) {
      const label = document.createElement("label");
      label.className = "product";
      label.innerHTML = `
        <input type="radio" name="product" value="${p.id}">
        <span class="product-body">
          <span class="product-name"></span>
          <span class="product-price"></span>
          <span class="product-desc"></span>
        </span>`;
      label.querySelector(".product-name").textContent = p.name;
      label.querySelector(".product-price").textContent = rupiah(p.price);
      label.querySelector(".product-desc").textContent = p.description || "";
      const input = label.querySelector("input");
      input.checked = p.id === state.selectedId;
      input.addEventListener("change", () => {
        state.selectedId = p.id;
        showError("");
        render();
      });
      els.list.appendChild(label);
    }
  }

  async function load() {
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      state.products = data.products || [];
      els.badge.hidden = data.env === "production";
      if (state.products.length) state.selectedId = state.products[0].id;
      renderProducts();
      render();
    } catch {
      els.list.innerHTML = '<p class="error">Gagal memuat paket. Muat ulang halaman ini.</p>';
    }
  }

  els.qtyMinus.addEventListener("click", () => { state.qty = Math.max(1, state.qty - 1); render(); });
  els.qtyPlus.addEventListener("click", () => { state.qty = Math.min(10, state.qty + 1); render(); });

  els.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showError("");

    const p = selected();
    if (!p) return showError("Pilih salah satu paket terlebih dahulu.");

    const name = $("name").value.trim();
    const phone = $("phone").value.trim();
    const email = $("email").value.trim();
    if (name.length < 2) return showError("Nama wajib diisi.");
    if (phone.replace(/\D/g, "").length < 9) return showError("Nomor WhatsApp belum lengkap.");

    els.pay.disabled = true;
    const label = els.pay.textContent;
    els.pay.textContent = "Menyiapkan pembayaran…";

    try {
      const res = await fetch("/api/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: p.id, quantity: state.qty, name, phone, email }),
      });
      const data = await res.json();
      if (!res.ok || !data.paymentUrl) {
        throw new Error(data.error || "Gagal membuat pembayaran.");
      }
      window.location.href = data.paymentUrl;
    } catch (err) {
      showError(err.message);
      els.pay.disabled = false;
      els.pay.textContent = label;
    }
  });

  load();
})();

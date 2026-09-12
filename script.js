const products=[
 {id:1,name:"Gamepass Drag",price:15000,icon:"🎮",desc:"Gamepass untuk fitur Drag di game kamu."},
 {id:2,name:"Gamepass VIP",price:25000,icon:"👑",desc:"Akses fitur VIP dan fasilitas khusus."},
 {id:3,name:"Gamepass Speed",price:30000,icon:"⚡",desc:"Dapatkan kemampuan speed tambahan."},
 {id:4,name:"Gamepass Premium",price:50000,icon:"💎",desc:"Paket premium dengan fitur eksklusif."},
 {id:5,name:"Gamepass Super",price:75000,icon:"🔥",desc:"Gamepass spesial untuk pemain pilihan."},
 {id:6,name:"Custom Request",price:100000,icon:"✨",desc:"Produk custom. Hubungi admin setelah checkout."}
];
let cart=[];

const rupiah=n=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n);

function renderProducts(){
 const q=document.getElementById("search").value.toLowerCase();
 const list=products.filter(p=>p.name.toLowerCase().includes(q));
 document.getElementById("productGrid").innerHTML=list.map(p=>`
 <article class="product">
   <div class="product-img">${p.icon}</div>
   <div class="product-body">
     <h3>${p.name}</h3><p>${p.desc}</p>
     <div class="price">${rupiah(p.price)}</div>
     <button class="primary-btn add" onclick="addToCart(${p.id})">+ Tambah ke Keranjang</button>
   </div>
 </article>`).join("");
}
function addToCart(id){const p=products.find(x=>x.id===id);const found=cart.find(x=>x.id===id);if(found)found.qty++;else cart.push({...p,qty:1});updateCart();openCart()}
function updateCart(){
 document.getElementById("cartCount").textContent=cart.reduce((a,b)=>a+b.qty,0);
 document.getElementById("cartItems").innerHTML=cart.length?cart.map(x=>`
 <div class="cart-item"><div><b>${x.name}</b><br><span class="muted">${rupiah(x.price)} × ${x.qty}</span></div>
 <button class="remove" onclick="removeItem(${x.id})">Hapus</button></div>`).join(""):"<p class='muted'>Keranjang masih kosong.</p>";
 document.getElementById("cartTotal").textContent=rupiah(cart.reduce((a,b)=>a+b.price*b.qty,0));
}
function removeItem(id){cart=cart.filter(x=>x.id!==id);updateCart()}
function openCart(){document.getElementById("cartModal").classList.remove("hidden");updateCart()}
function closeCart(){document.getElementById("cartModal").classList.add("hidden")}
function goCheckout(){
 if(!cart.length)return alert("Keranjang masih kosong.");
 closeCart();
 document.getElementById("checkoutProducts").innerHTML=cart.map(x=>`${x.name} × ${x.qty} — ${rupiah(x.price*x.qty)}`).join("<br>");
 document.getElementById("checkoutModal").classList.remove("hidden");
}
function closeCheckout(){document.getElementById("checkoutModal").classList.add("hidden")}
function closeSuccess(){document.getElementById("successModal").classList.add("hidden")}

document.getElementById("checkoutForm").addEventListener("submit", async e=>{
 e.preventDefault();
 const username=document.getElementById("robloxUsername").value.trim();
 const phone=document.getElementById("phone").value.trim();
 const payment=document.getElementById("payment").value;
 const proofFile=document.getElementById("paymentProof").files[0];
 if(!username)return alert("Masukkan username Roblox.");
 if(!phone)return alert("Masukkan nomor WhatsApp.");
 if(!proofFile)return alert("Upload bukti pembayaran dulu.");

 const order="DINE-"+Date.now().toString().slice(-7);
 const total=cart.reduce((a,b)=>a+b.price*b.qty,0);
 const productsText=cart.map(x=>`${x.name} x${x.qty} - ${rupiah(x.price*x.qty)}`).join("\n");

 const submitBtn=e.target.querySelector("button[type=submit]");
 const originalLabel=submitBtn.textContent;
 submitBtn.disabled=true;submitBtn.textContent="Mengirim...";

 const fd=new FormData();
 fd.append("order",order);
 fd.append("username",username);
 fd.append("phone",phone);
 fd.append("payment",payment);
 fd.append("total",rupiah(total));
 fd.append("products",productsText);
 fd.append("proof",proofFile);

 try{
   const res=await fetch("/api/checkout",{method:"POST",body:fd});
   const data=await res.json();
   if(!data.ok) throw new Error(data.error||"Gagal mengirim pesanan.");

   document.getElementById("orderResult").innerHTML=`Nomor pesanan: <b>${order}</b><br>Username: <b>${username}</b><br>Total: <b>${rupiah(total)}</b><br><br>Pesanan & bukti bayar sudah kami terima. Admin akan segera memproses.`;
   cart=[];updateCart();closeCheckout();
   e.target.reset();
   document.getElementById("successModal").classList.remove("hidden");
 }catch(err){
   alert("Terjadi kesalahan: "+err.message);
 }finally{
   submitBtn.disabled=false;submitBtn.textContent=originalLabel;
 }
});

renderProducts();updateCart();

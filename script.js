const products=[
 {id:1,name:"Gamepass Drag",price:15000,image:"assets/products/DRAG.png",desc:"Gamepass untuk fitur Drag di game kamu."},
 {id:2,name:"Gamepass Mewah",price:16000,image:"assets/products/MEWAH.png",desc:"Gamepass untuk fitur MEWAH di game kamu."},
 {id:3,name:"Gamepass x2 gaji",price:60000,image:"assets/products/X2 GAJI.png",desc:"Gamepass untuk fitur X2 GAJI di game kamu."},
 {id:4,name:"Gamepass PEMBUKA BATASAN SLOT",price:11000,image:"assets/products/BATAS SLOT.png",desc:"Gamepass untuk fitur PEMBUKA BATASAN SLOT di game kamu."},
 {id:5,name:"Gamepass PREMIUM AKSESORIS",price:8000,image:"assets/products/AKSESORIS.png",desc:"Gamepass untuk fitur PREMIUM AKSESORIS di game kamu."},
 {id:6,name:"Gamepass PLAT",price:10000,image:"assets/products/PLAT.png",desc:"Gamepass untuk fitur PLAT di game kamu."},
 {id:7,name:"Gamepass POLISI",price:18000,image:"assets/products/POLISI.png",desc:"Gamepass untuk fitur POLISI di game kamu."},
 {id:8,name:"Gamepass VELEG",price:10000,image:"assets/products/VELEG.png",desc:"Gamepass untuk fitur VELEG di game kamu."},
 {id:9,name:"Gamepass ADVANCE PAINT/ WARNA",price:10000,image:"assets/products/CAT.png",desc:"Gamepass untuk fitur ADVANCE PAINT/ WARNA di game kamu."},
 {id:10,name:"Gamepass SUSPENSI",price:5000,image:"assets/products/PRO SUSPENSI.png",desc:"Gamepass untuk fitur SUSPENSI di game kamu."},
 {id:11,name:"Gamepass RADIO",price:5000,image:"assets/products/RADIO BOOMBOX.png",desc:"Gamepass untuk fitur RADIO di game kamu."},
 {id:12,name:"DUIT DDS 10.000.000",price:5000,image:"assets/products/DUIT.png",desc:"Gamepass untuk fitur DUIT DDS 10JT di game kamu."},
 {id:13,name:"DUIT DDS 50.000.000",price:8000,image:"assets/products/DUIT.png",desc:"Gamepass untuk fitur DUIT DDS 50JT di game kamu."},
 {id:14,name:"DUIT DDS 100.000.000",price:15000,image:"assets/products/DUIT.png",desc:"Gamepass untuk fitur DUIT DDS 100JT di game kamu."},
 {id:15,name:"DUIT DDS 500.000.000",price:55000,image:"assets/products/DUIT.png",desc:"Gamepass untuk fitur DUIT DDS 500JT di game kamu."},
 {id:16,name:"DUIT DDS 1.000.000.000",price:110000,image:"assets/products/DUIT.png",desc:"Gamepass untuk fitur DUIT DDS 1M di game kamu."}

];
let cart=[];

const rupiah=n=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n);

function makeQrisSvgDataUrl(){
 const cell=7, size=29, offset=0;
 const svg=[];
 svg.push(`<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 ${size*cell} ${size*cell}">`);
 svg.push(`<rect width="100%" height="100%" fill="#ffffff"/>`);
 const drawFinder=(x,y)=>{
  for(let row=0; row<7; row++){
   for(let col=0; col<7; col++){
    const edge = row===0 || col===0 || row===6 || col===6;
    const center = row>=2 && row<=4 && col>=2 && col<=4;
    if(edge || center) svg.push(`<rect x="${x+col*cell}" y="${y+row*cell}" width="${cell}" height="${cell}" fill="#111827"/>`);
   }
  }
 };
 drawFinder(offset,offset);
 drawFinder(offset,(size-7)*cell);
 drawFinder((size-7)*cell,offset);
 for(let y=0; y<size; y++){
  for(let x=0; x<size; x++){
   const inFinder = (x<7 && y<7) || (x>=size-7 && y<7) || (x<7 && y>=size-7);
   if(inFinder) continue;
   const bit = ((x*13 + y*17 + (x*y % 9)) % 5) < 2;
   if(bit) svg.push(`<rect x="${x*cell+1}" y="${y*cell+1}" width="${cell-2}" height="${cell-2}" fill="#111827"/>`);
  }
 }
 svg.push(`</svg>`);
 return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.join(""))}`;
}

function updatePaymentInfo(){
 const payment=document.getElementById("payment").value;
 const qrisBox=document.getElementById("qrisBox");
 if(payment!=="QRIS"){
  qrisBox.classList.add("hidden");
  qrisBox.innerHTML="";
  return;
 }
 qrisBox.classList.remove("hidden");
 qrisBox.innerHTML=`
  <div class="qris-card">
    <img src="${makeQrisSvgDataUrl()}" alt="QRIS admin DINE SHOP">
    <p>Scan QRIS admin di bawah ini, lalu upload bukti pembayaran setelah transfer berhasil.</p>
  </div>
 `;
}

function renderProducts(){
 const q=document.getElementById("search").value.toLowerCase();
 const list=products.filter(p=>p.name.toLowerCase().includes(q));
 document.getElementById("productGrid").innerHTML=list.map(p=>`
 <article class="product">
   <div class="product-img">
     <img src="${p.image || "assets/products/default.png"}" alt="${p.name}" onerror="this.onerror=null;this.src='assets/products/default.png'">
   </div>
   <div class="product-body">
     <h3>${p.name}</h3><p>${p.desc}</p>
     <div class="price">${rupiah(p.price)}</div>
     <button class="primary-btn add" onclick="addToCart(${p.id})">Tambah ke Keranjang</button>
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

document.getElementById("payment").addEventListener("change", updatePaymentInfo);

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

renderProducts();updateCart();updatePaymentInfo();

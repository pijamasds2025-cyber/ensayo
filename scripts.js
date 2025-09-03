
import { PRODUCTS_API } from "./config.js";

const contenedor = document.getElementById("productos");
const loading = document.getElementById("loading");
const cartCount = document.getElementById("cart-count");
const q = document.getElementById("q");

const fmtCOP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const WHOLESALE_THRESHOLD = 7; // >6 unidades
let lastRemoved = null; // para deshacer

let ALL = [];
let state = {
  category: "Todos",
  sizeAdult: new Set(),
  sizeKid: new Set(),
  search: ""
};

// === Helpers de carrito ===
function getCart() {
  return JSON.parse(localStorage.getItem("carrito")) || [];
}
function setCart(cart) {
  localStorage.setItem("carrito", JSON.stringify(cart));
  updateCartCount();
  renderMiniCart();
}
function updateCartCount() {
  const carrito = getCart();
  const units = carrito.reduce((a,b)=>a + (Number(b.cantidad)||1),0);
  cartCount && (cartCount.textContent = String(units));
}
updateCartCount();

function parseSizes(s) {
  return String(s || "").split(",").map(x => x.trim()).filter(Boolean);
}

function inferCategory(name, explicitCat) {
  const c = String(explicitCat || "").toLowerCase();
  if (c.includes("niñ")) return "Niño";
  if (c.includes("caballer") || c.includes("hombre")) return "Caballero";
  if (c.includes("dama") || c.includes("mujer")) return "Dama";
  const n = String(name || "").toLowerCase();
  if (/(niñ|kids|infantil)/.test(n)) return "Niño";
  if (/(caballer|hombre)/.test(n)) return "Caballero";
  return "Dama";
}

function satisfiesSizeFilter(productSizes) {
  const adultSelected = state.sizeAdult.size > 0;
  const kidSelected = state.sizeKid.size > 0;

  if (!adultSelected && !kidSelected) return true;

  const hasAdult = productSizes.some(s => /^[smlx]{1,2}$/i.test(s));
  const hasKid = productSizes.some(s => /^\d{1,2}$/.test(s));

  if (adultSelected && hasAdult) {
    for (const s of productSizes) {
      const up = s.toUpperCase();
      if (state.sizeAdult.has(up)) return true;
    }
  }
  if (kidSelected && hasKid) {
    for (const s of productSizes) {
      const onlyNum = s.replace(/\D/g, "");
      if (state.sizeKid.has(onlyNum)) return true;
    }
  }
  return false;
}

function wholesalePrice(p) {
  const base = Number(p.Precio || p.precio || 0);
  const pm = Number(p.PrecioMayorista || p.precioMayorista || 0);
  return pm > 0 ? pm : Math.round(base * 0.85); // fallback 15% off
}

function computeTotals(cart) {
  const unidades = cart.reduce((a,b)=>a + (Number(b.cantidad)||1),0);
  const mayorista = unidades >= WHOLESALE_THRESHOLD;
  let subtotal = 0;
  cart.forEach(item => {
    const unit = mayorista ? (item.precioMayorista ?? wholesalePrice(item)) : item.precio;
    subtotal += unit * (item.cantidad || 1);
  });
  return { unidades, mayorista, subtotal };
}

// === Snackbar ===
const snackbar = document.getElementById("snackbar");
function showSnack(msg, withUndo=false) {
  snackbar.innerHTML = "";
  const span = document.createElement("span");
  span.textContent = msg;
  snackbar.appendChild(span);
  if (withUndo) {
    const btn = document.createElement("button");
    btn.textContent = "Deshacer";
    btn.onclick = () => {
      snackbar.classList.remove("show");
      if (lastRemoved) {
        const cart = getCart();
        cart.splice(lastRemoved.index, 0, lastRemoved.item);
        setCart(cart);
        lastRemoved = null;
      }
    };
    snackbar.appendChild(btn);
  }
  snackbar.classList.add("show");
  setTimeout(() => snackbar.classList.remove("show"), 4500);
}

// === Mini-cart ===
const miniCart = document.getElementById("miniCart");
const miniCartItems = document.getElementById("miniCartItems");
const miniCartSubtotal = document.getElementById("miniCartSubtotal");
const cartToggle = document.getElementById("cartToggle");

if (cartToggle && miniCart) {
  cartToggle.addEventListener("click", (e) => {
    // Allow normal navigation if user aims for checkout; we'll toggle but not prevent link
    e.preventDefault();
    miniCart.classList.toggle("open");
  });
  document.addEventListener("click", (e) => {
    if (!miniCart.contains(e.target) && !cartToggle.contains(e.target)) {
      miniCart.classList.remove("open");
    }
  });
}

function renderMiniCart() {
  if (!miniCart || !miniCartItems) return;
  const cart = getCart();
  miniCartItems.innerHTML = "";
  if (cart.length === 0) {
    miniCartItems.innerHTML = "<p class='muted small'>Tu carrito está vacío.</p>";
    miniCartSubtotal.textContent = fmtCOP.format(0);
    return;
  }
  const totals = computeTotals(cart);
  cart.forEach((p, idx) => {
    const li = document.createElement("div");
    li.className = "item";
    const priceUnit = totals.mayorista ? (p.precioMayorista ?? wholesalePrice(p)) : p.precio;
    li.innerHTML = `
      <img src="${p.imagen}" alt="${p.nombre}">
      <div>
        <div style="font-weight:700">${p.nombre}</div>
        <div class="small muted">Talla: ${p.talla||"-"}</div>
        <div class="small">${fmtCOP.format(priceUnit)} ${totals.mayorista ? "<span class='muted'>(mayorista)</span>":""}</div>
        <div class="qty" style="margin-top:4px">
          <button aria-label="Disminuir">-</button>
          <span>${p.cantidad||1}</span>
          <button aria-label="Aumentar">+</button>
          <button aria-label="Eliminar" style="margin-left:auto;color:var(--danger);background:#fff;border:1px solid #f4cfd3;border-radius:8px;padding:.2rem .5rem">Eliminar</button>
        </div>
      </div>
      <div style="font-weight:800">${fmtCOP.format(priceUnit*(p.cantidad||1))}</div>
    `;
    const [btnMinus, , btnPlus, btnDel] = li.querySelectorAll("button");
    btnMinus.onclick = () => {
      const cart = getCart();
      cart[idx].cantidad = Math.max(1, (cart[idx].cantidad||1) - 1);
      setCart(cart);
    };
    btnPlus.onclick = () => {
      const cart = getCart();
      cart[idx].cantidad = (cart[idx].cantidad||1) + 1;
      setCart(cart);
    };
    btnDel.onclick = () => {
      const cart = getCart();
      lastRemoved = { item: cart[idx], index: idx };
      cart.splice(idx,1);
      setCart(cart);
      showSnack("Producto eliminado del carrito.", true);
    };
    miniCartItems.appendChild(li);
  });
  miniCartSubtotal.textContent = fmtCOP.format(totals.subtotal);
}
renderMiniCart();

// === Render catálogo ===
function render(products) {
  // clear
  const oldGrid = contenedor?.querySelector(".products-grid");
  if (oldGrid) oldGrid.remove();
  if (!contenedor) return;

  const grid = document.createElement("div");
  grid.className = "products-grid";
  contenedor.appendChild(grid);

  products.forEach(p => {
    const tallas = parseSizes(p.Talla);
    const colores = parseSizes(p.Color);
    const precio = Number(p.Precio || p.precio || 0);
    const pMayor = wholesalePrice(p);
    const nombre = p.Nombre || p.nombre || "Producto";
    const categoria = inferCategory(nombre, p.Categoria || p.categoria);
    const img = p.Imagen || p.imagen || "https://via.placeholder.com/1200x1200?text=Producto";

    const card = document.createElement("article");
    card.className = "producto";
    card.innerHTML = `
      <div class="img-wrap">
        <img src="${img}" alt="${nombre}" loading="lazy" width="1200" height="1200">
        <span class="zoom-hint">Zoom</span>
      </div>
      <h3>${nombre}</h3>
      <div class="meta">
        <span class="chip">${categoria}</span>
        ${tallas.length ? `<span class="chip">Tallas: ${tallas.join(", ")}</span>` : ""}
      </div>
      <p class="price"><span class="old">${fmtCOP.format(precio)}</span> <span class="wholesale">${fmtCOP.format(pMayor)}</span></p>
      <div class="size-row">
        <label for="sel-${btoa(nombre).slice(0,6)}" class="small">Talla</label>
        <select id="sel-${btoa(nombre).slice(0,6)}">
          <option value="">Selecciona…</option>
          ${tallas.map(t => `<option>${t}</option>`).join("")}
        </select>
        <button class="btn btn-light" data-action="ver">Ver grande</button>
      </div>
      <button class="carrito-btn" aria-label="Añadir ${nombre} al carrito" disabled>Añadir al carrito</button>
      <p class="small muted" style="margin:.4rem 0 0">Después de 6 unidades el precio es al por mayor.</p>
    `;

    // size selection enables add
    const select = card.querySelector("select");
    const addBtn = card.querySelector(".carrito-btn");
    select.addEventListener("change", () => {
      addBtn.disabled = !select.value;
    });

    // open detail (new window) with zoom + add from there
    const ver = card.querySelector('[data-action="ver"]');
    ver.addEventListener("click", () => openDetailWindow({nombre, img, precio, precioMayorista: pMayor, tallas}));

    // add to cart
    addBtn.onclick = () => {
      if (!select.value) { showSnack("Selecciona una talla antes de añadir."); return; }
      const item = { 
        nombre, 
        precio, 
        precioMayorista: pMayor, 
        imagen: img, 
        talla: select.value, 
        cantidad: 1 
      };
      const carrito = getCart();
      // si ya existe mismo producto+talla, aumentar qty
      const idx = carrito.findIndex(i => i.nombre === item.nombre && i.talla === item.talla);
      if (idx >= 0) carrito[idx].cantidad = (carrito[idx].cantidad||1) + 1;
      else carrito.push(item);
      setCart(carrito);
      showSnack("Añadido al carrito.");
    };

    // clicking on image also opens detail
    card.querySelector(".img-wrap").addEventListener("click", () => openDetailWindow({nombre, img, precio, precioMayorista: pMayor, tallas}));

    grid.appendChild(card);
  });
}

// New window detail with zoom + size + add
function openDetailWindow({nombre, img, precio, precioMayorista, tallas}){
  const w = window.open("", "_blank", "noopener,width=580,height=720");
  const s = `
    <html><head><meta charset="utf-8"><title>${nombre}</title>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>
      body{font-family:Poppins,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:0;padding:12px}
      .imgbox{position:relative;overflow:hidden;border-radius:12px;border:1px solid #eee}
      img{width:100%;height:auto;transform-origin:center center;transition:transform .15s ease}
      .controls{display:flex;gap:8px;align-items:center;margin:10px 0}
      .price{font-weight:800;margin:.25rem 0}
      .price .old{text-decoration:line-through;opacity:.6;margin-right:8px}
      .price .wh{color:#2e7d32}
      .note{font-size:.92rem;background:#fff0fa;border:1px dashed #e6b3e3;border-radius:12px;padding:.35rem .6rem;color:#6a1b9a}
      button{padding:.5rem .8rem;border-radius:10px;border:1px solid #eee;background:#fff;cursor:pointer}
      .primary{background:#a626a4;color:#fff;border-color:#a626a4}
    </style></head>
    <body>
      <h2>${nombre}</h2>
      <div class="imgbox"><img id="bigImg" src="${img}" alt="${nombre}"></div>
      <div class="controls">
        <label>Talla
          <select id="sizeSel">
            <option value="">Selecciona…</option>
            ${tallas.map(t=>`<option>${t}</option>`).join("")}
          </select>
        </label>
        <button id="zoomIn">+</button><button id="zoomOut">−</button><button id="zoomReset">100%</button>
      </div>
      <div class="price"><span class="old">${fmtCOP.format(precio)}</span> <span class="wh">${fmtCOP.format(precioMayorista)}</span></div>
      <p class="note">Después de 6 unidades el precio es al por mayor.</p>
      <button id="add" class="primary">Añadir al carrito</button>
      <script>
        let z=1;
        const imgEl = document.getElementById('bigImg');
        document.getElementById('zoomIn').onclick=()=>{z=Math.min(3,z+0.15);imgEl.style.transform='scale('+z+')';};
        document.getElementById('zoomOut').onclick=()=>{z=Math.max(1,z-0.15);imgEl.style.transform='scale('+z+')';};
        document.getElementById('zoomReset').onclick=()=>{z=1;imgEl.style.transform='scale(1)';};
        document.getElementById('add').onclick=()=>{
          const talla = document.getElementById('sizeSel').value;
          if(!talla){ alert('Selecciona una talla.'); return; }
          const item = {nombre: %s, precio:%d, precioMayorista:%d, imagen:%s, talla, cantidad:1};
          const cart = JSON.parse(localStorage.getItem('carrito')||'[]');
          const idx = cart.findIndex(i => i.nombre===item.nombre && i.talla===item.talla);
          if (idx>=0) cart[idx].cantidad = (cart[idx].cantidad||1)+1; else cart.push(item);
          localStorage.setItem('carrito', JSON.stringify(cart));
          window.close();
        };
      </script>
    </body></html>
  `.replace("%s", JSON.stringify(nombre)).replace("%d", Math.round(precio)).replace("%d", Math.round(precioMayorista)).replace("%s", JSON.stringify(img));
  w.document.open(); w.document.write(s); w.document.close();
}

function applyFilters() {
  const filtered = ALL.filter(p => {
    const nombre = (p.Nombre || p.nombre || "").toLowerCase();
    const categoria = inferCategory(p.Nombre || p.nombre, p.Categoria || p.categoria);
    const tallas = parseSizes(p.Talla);
    if (state.category !== "Todos" && categoria !== state.category) return false;
    if (state.search && !nombre.includes(state.search)) return false;
    if (!satisfiesSizeFilter(tallas)) return false;
    return true;
  });
  render(filtered);
}

async function init() {
  try {
    const res = await fetch(PRODUCTS_API, { credentials: "omit" });
    if (!res.ok) throw new Error("No se pudo conectar con la base de datos");
    const productos = await res.json();
    ALL = Array.isArray(productos) ? productos : [];
    if (loading) loading.remove();
    applyFilters();
  } catch (e) {
    console.error(e);
    if (loading) loading.textContent = "⚠️ No se pudieron cargar los productos. Intenta de nuevo más tarde.";
  }
}
init();

// === UI events ===
document.querySelectorAll('input[name="cat"]').forEach(r => {
  r.addEventListener("change", (ev) => {
    state.category = ev.target.value;
    applyFilters();
  });
});

document.querySelectorAll(".size-adult").forEach(cb => {
  cb.addEventListener("change", (ev) => {
    const v = ev.target.value.toUpperCase();
    if (ev.target.checked) state.sizeAdult.add(v);
    else state.sizeAdult.delete(v);
    applyFilters();
  });
});
document.querySelectorAll(".size-kid").forEach(cb => {
  cb.addEventListener("change", (ev) => {
    const v = ev.target.value.replace(/\D/g, "");
    if (ev.target.checked) state.sizeKid.add(v);
    else state.sizeKid.delete(v);
    applyFilters();
  });
});

const clearBtn = document.getElementById("clearFilters");
if (clearBtn) clearBtn.addEventListener("click", () => {
  state = { category: "Todos", sizeAdult: new Set(), sizeKid: new Set(), search: "" };
  const tot = document.querySelector('input[name="cat"][value="Todos"]'); if (tot) tot.checked = true;
  document.querySelectorAll(".size-adult, .size-kid").forEach(cb => cb.checked = false);
  if (q) q.value = "";
  applyFilters();
});

if (q) {
  q.addEventListener("input", (e) => {
    state.search = e.target.value.trim().toLowerCase();
    applyFilters();
  });
}

// Sync mini-cart on storage changes (other tabs/windows)
window.addEventListener("storage", (e) => {
  if (e.key === "carrito") {
    updateCartCount();
    renderMiniCart();
  }
});

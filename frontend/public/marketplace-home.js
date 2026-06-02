/**
 * marketplace-home.js — SELA Marketplace Home Dashboard
 * Loads everything from /api/marketplace/stats (one request)
 */
(function () {
  'use strict';
  const API = window.SELA_API || 'http://localhost:5000/api';
const BASE = window.SELA_BASE || 'http://localhost:5000';
function fixImg(src){ if(!src)return''; if(src.startsWith('http'))return src; if(src.startsWith('/'))return BASE+src; return src; }
  function fmt(n){ return Number(n||0).toLocaleString('en-KE'); }

  /* ─── CSS ──────────────────────────────────────────────────────────────── */
  const CSS = `
.mh-stats-bar{background:linear-gradient(135deg,#060a10,#0b0e14);border-bottom:1px solid #1a2235}
.mh-stats-inner{max-width:1400px;margin:0 auto;padding:.6rem 1.5rem;display:flex;align-items:stretch;overflow-x:auto;scrollbar-width:none;gap:0}
.mh-stats-inner::-webkit-scrollbar{display:none}
.mh-stat{display:flex;align-items:center;gap:.6rem;padding:.5rem 1.4rem;border-right:1px solid #1a2235;flex-shrink:0;min-width:0}
.mh-stat:last-child{border-right:none}
.mh-stat-icon{width:36px;height:36px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0}
.mh-stat-num{font-family:'Montserrat',sans-serif;font-size:1.2rem;font-weight:900;color:#fff;line-height:1.1}
.mh-stat-lbl{font-size:.6rem;color:#4a5a78;text-transform:uppercase;letter-spacing:.07em}
.mh-stat-sub{font-size:.6rem;color:#00e676;margin-top:.1rem}

.mh-ticker{background:#040710;border-bottom:1px solid #0f1520;padding:.38rem 0;overflow:hidden;white-space:nowrap}
.mh-ticker-track{display:inline-block;animation:mhTick 35s linear infinite;padding-left:100vw}
.mh-ticker:hover .mh-ticker-track{animation-play-state:paused}
@keyframes mhTick{to{transform:translateX(-100%)}}
.mh-tick-item{display:inline-flex;align-items:center;gap:.4rem;font-size:.7rem;color:#4a5a78;margin-right:3rem}
.mh-tick-dot{display:inline-block;width:5px;height:5px;border-radius:50%;background:#00e676;flex-shrink:0}
.mh-tick-item strong{color:#00d4ff}

.mh-wrap{max-width:1400px;margin:0 auto;padding:0 1.5rem}
.mh-hd{display:flex;align-items:center;justify-content:space-between;padding:1.75rem 0 1rem;flex-wrap:wrap;gap:.5rem}
.mh-hd-left{display:flex;align-items:center;gap:.6rem;font-family:'Montserrat',sans-serif;font-size:.98rem;font-weight:800;color:#e8edf5}
.mh-badge{font-size:.58rem;font-weight:700;padding:.15rem .5rem;border-radius:20px;background:rgba(0,212,255,.1);color:#00d4ff;border:1px solid rgba(0,212,255,.2);letter-spacing:.06em;text-transform:uppercase}
.mh-link{font-size:.78rem;color:#00d4ff;font-weight:600;background:none;border:none;cursor:pointer;text-decoration:none}
.mh-link:hover{opacity:.75}
.mh-divider{height:1px;background:linear-gradient(90deg,transparent,#1a2235 15%,#1a2235 85%,transparent);margin:.5rem 0}

/* Metrics grid */
.mh-metrics{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:.85rem;padding-bottom:.5rem}
.mh-mc{background:#131720;border:1px solid #1a2235;border-radius:13px;padding:1.2rem 1rem;position:relative;overflow:hidden;transition:border-color .2s}
.mh-mc:hover{border-color:var(--mc,#00d4ff)}
.mh-mc::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--mc,#00d4ff)}
.mh-mc-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.85rem}
.mh-mc-icon{font-size:1.5rem}
.mh-mc-tag{font-size:.58rem;font-weight:700;padding:.15rem .45rem;border-radius:20px}
.mh-mc-tag.up{background:rgba(0,230,118,.12);color:#00e676}
.mh-mc-tag.hot{background:rgba(255,107,53,.12);color:#ff6b35}
.mh-mc-tag.info{background:rgba(0,212,255,.1);color:#00d4ff}
.mh-mc-tag.gold{background:rgba(212,160,23,.12);color:#d4a017}
.mh-mc-num{font-family:'Montserrat',sans-serif;font-size:1.55rem;font-weight:900;color:#fff;line-height:1;margin-bottom:.2rem}
.mh-mc-lbl{font-size:.7rem;color:#4a5a78;margin-bottom:.5rem}
.mh-mc-sub{font-size:.62rem;color:#8899b8;padding-top:.45rem;border-top:1px solid #1a2235}

/* Hscroll */
.mh-hscroll{display:flex;gap:.85rem;overflow-x:auto;padding-bottom:.5rem;scrollbar-width:thin;scrollbar-color:#1a2235 transparent}
.mh-hscroll::-webkit-scrollbar{height:3px}
.mh-hscroll::-webkit-scrollbar-thumb{background:#252f47;border-radius:2px}

/* Store card */
.mh-store{flex:0 0 230px;background:#131720;border:1px solid #1a2235;border-radius:13px;overflow:hidden;cursor:pointer;transition:all .22s;text-decoration:none;display:block}
.mh-store:hover{border-color:rgba(0,212,255,.3);transform:translateY(-4px);box-shadow:0 12px 32px rgba(0,0,0,.5)}
.mh-store-banner{height:76px;background:var(--c,#1a2035);position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center}
.mh-store-banner img{width:100%;height:100%;object-fit:cover}
.mh-store-logo{position:absolute;bottom:-14px;left:.9rem;width:34px;height:34px;border-radius:8px;border:2px solid #0b0e14;background:#1a2035;object-fit:contain}
.mh-store-logo-ph{position:absolute;bottom:-14px;left:.9rem;width:34px;height:34px;border-radius:8px;border:2px solid #0b0e14;display:flex;align-items:center;justify-content:center;font-size:.9rem}
.mh-store-live{position:absolute;top:.4rem;right:.4rem;font-size:.55rem;font-weight:700;background:rgba(0,230,118,.15);color:#00e676;border:1px solid rgba(0,230,118,.25);padding:.12rem .4rem;border-radius:20px;letter-spacing:.05em}
.mh-store-body{padding:1.2rem .9rem .85rem}
.mh-store-name{font-family:'Montserrat',sans-serif;font-size:.8rem;font-weight:800;color:#e8edf5;margin-bottom:.18rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mh-store-loc{font-size:.62rem;color:#4a5a78;margin-bottom:.55rem}
.mh-store-row{display:flex;gap:.75rem}
.mh-store-row span{font-size:.62rem;color:#8899b8;display:flex;align-items:center;gap:.2rem}
.mh-store-row strong{color:#00d4ff;font-family:'Montserrat',sans-serif}

/* Category grid */
.mh-catgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:.65rem}
.mh-cat{background:#131720;border:1px solid #1a2235;border-radius:12px;padding:1rem .7rem;text-align:center;cursor:pointer;transition:all .2s;text-decoration:none;display:block}
.mh-cat:hover{border-color:var(--cc,#00d4ff33);transform:translateY(-3px);background:#1a2035}
.mh-cat-icon{font-size:1.7rem;margin-bottom:.4rem}
.mh-cat-name{font-size:.68rem;font-weight:700;color:#8899b8;line-height:1.3}
.mh-cat:hover .mh-cat-name{color:#e8edf5}
.mh-cat-count{font-size:.58rem;color:#4a5a78;margin-top:.18rem}

/* Product mini card */
.mh-prod{flex:0 0 168px;background:#131720;border:1px solid #1a2235;border-radius:12px;overflow:hidden;text-decoration:none;display:block;transition:all .2s;position:relative}
.mh-prod:hover{border-color:rgba(0,212,255,.28);transform:translateY(-3px)}
.mh-prod-img img{width:100%;height:100%;object-fit:cover;display:block}
.mh-prod-img{height:120px;background:#0f1219;display:flex;align-items:center;justify-content:center;font-size:2.2rem;overflow:hidden}
.mh-prod-img img{width:100%;height:100%;object-fit:cover;transition:transform .35s}
.mh-prod:hover .mh-prod-img img{transform:scale(1.06)}
.mh-prod-body{padding:.7rem .75rem}
.mh-prod-name{font-size:.72rem;font-weight:700;color:#e8edf5;line-height:1.35;margin-bottom:.22rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.mh-prod-price{font-family:'Montserrat',sans-serif;font-size:.88rem;font-weight:800;color:#00e676}
.mh-prod-shop{font-size:.58rem;color:#4a5a78;margin-top:.15rem}
.mh-prod-badge{position:absolute;top:.45rem;left:.45rem;font-size:.55rem;font-weight:700;padding:.12rem .4rem;border-radius:4px;letter-spacing:.04em}
.mh-sale{background:rgba(212,160,23,.18);color:#d4a017;border:1px solid rgba(212,160,23,.25)}
.mh-new{background:rgba(0,230,118,.15);color:#00e676;border:1px solid rgba(0,230,118,.25)}

/* Activity */
.mh-activity{display:flex;flex-direction:column;gap:.45rem}
.mh-act-item{display:flex;align-items:center;gap:.8rem;padding:.65rem .9rem;background:#131720;border:1px solid #1a2235;border-radius:10px;transition:border-color .15s}
.mh-act-item:hover{border-color:#252f47}
.mh-act-icon{font-size:1.1rem;flex-shrink:0;width:28px;text-align:center}
.mh-act-text{flex:1;font-size:.77rem;color:#8899b8;line-height:1.5}
.mh-act-text strong{color:#e8edf5}
.mh-act-time{font-size:.6rem;color:#4a5a78;white-space:nowrap}

/* CTA */
.mh-cta{background:linear-gradient(135deg,#0c1033,#1a1060,#0a1a40);border:1px solid rgba(99,102,241,.2);border-radius:16px;padding:2.5rem 2rem;display:flex;align-items:center;justify-content:space-between;gap:2rem;flex-wrap:wrap;margin:2rem 0}
.mh-cta-tag{font-size:.62rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#6366f1;margin-bottom:.4rem}
.mh-cta-h{font-family:'Montserrat',sans-serif;font-size:1.55rem;font-weight:900;color:#fff;line-height:1.25;margin-bottom:.55rem}
.mh-cta-h em{font-style:normal;color:#a5b4fc}
.mh-cta-p{font-size:.85rem;color:#818cf8;line-height:1.7}
.mh-cta-nums{display:flex;gap:2rem;flex-wrap:wrap;margin-bottom:1.35rem}
.mh-cta-num{text-align:center}
.mh-cta-num-val{font-family:'Montserrat',sans-serif;font-size:1.7rem;font-weight:900;color:#fff}
.mh-cta-num-lbl{font-size:.62rem;color:#818cf8;text-transform:uppercase;letter-spacing:.07em}
.mh-cta-btns{display:flex;gap:.65rem;flex-wrap:wrap}
.mh-cta-btn{padding:.72rem 1.4rem;border-radius:9px;font-family:'Montserrat',sans-serif;font-weight:800;font-size:.82rem;cursor:pointer;transition:all .2s;border:none;text-decoration:none;display:inline-flex;align-items:center;gap:.4rem}
.mh-cta-btn.solid{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff}
.mh-cta-btn.solid:hover{box-shadow:0 6px 20px rgba(99,102,241,.4);transform:translateY(-2px)}
.mh-cta-btn.ghost{background:transparent;color:#a5b4fc;border:1.5px solid rgba(99,102,241,.4)}
.mh-cta-btn.ghost:hover{border-color:#6366f1;background:rgba(99,102,241,.08)}

/* Two-column */
.mh-2col{display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;align-items:start}
@media(max-width:900px){
  .mh-2col{grid-template-columns:1fr}
  .mh-metrics{grid-template-columns:1fr 1fr}
  .mh-catgrid{grid-template-columns:repeat(3,1fr)}
}
@media(max-width:560px){
  .mh-metrics{grid-template-columns:1fr 1fr}
  .mh-catgrid{grid-template-columns:repeat(2,1fr)}
  .mh-cta{flex-direction:column}
}
`;

  /* ─── Inject CSS ────────────────────────────────────────────────────────── */
  if (!document.getElementById('mh-css')) {
    const s = document.createElement('style');
    s.id = 'mh-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ─── Inject HTML skeleton ──────────────────────────────────────────────── */
  function injectSkeleton() {
    const main = document.getElementById('products');
    if (!main || document.getElementById('mh-root')) return;

    const div = document.createElement('div');
    div.id = 'mh-root';
    div.innerHTML = `
<div class="mh-stats-bar"><div class="mh-stats-inner" id="mhStats"></div></div>
<div class="mh-ticker"><div class="mh-ticker-track" id="mhTicker"></div></div>
<div class="mh-wrap">
  <div class="mh-hd"><div class="mh-hd-left">📊 Platform Overview</div></div>
  <div class="mh-metrics" id="mhMetrics"><div style="grid-column:1/-1;padding:1rem;color:#4a5a78;font-size:.8rem">Loading stats…</div></div>
  <div class="mh-divider" style="margin:1.25rem 0"></div>
  <div class="mh-hd">
    <div class="mh-hd-left">🏪 Active Vendor Stores <span class="mh-badge" id="mhShopsCount">—</span></div>
    <a href="shop.html" class="mh-link">View all →</a>
  </div>
  <div class="mh-hscroll" id="mhStores"><div style="padding:1rem;color:#4a5a78;font-size:.8rem">Loading stores…</div></div>
  <div class="mh-divider" style="margin:1.25rem 0"></div>
  <div class="mh-hd"><div class="mh-hd-left">🗂️ Shop by Category</div></div>
  <div class="mh-catgrid" id="mhCats"><div style="padding:1rem;color:#4a5a78;font-size:.8rem">Loading categories…</div></div>
  <div class="mh-divider" style="margin:1.25rem 0"></div>
  <div class="mh-hd">
    <div class="mh-hd-left">⭐ Featured Products <span class="mh-badge" id="mhFeatCount">—</span></div>
  </div>
  <div class="mh-hscroll" id="mhFeatured"><div style="padding:1rem;color:#4a5a78;font-size:.8rem">Loading…</div></div>
  <div class="mh-divider" style="margin:1.25rem 0"></div>
  <div class="mh-2col">
    <div>
      <div class="mh-hd" style="padding-top:.25rem"><div class="mh-hd-left">🆕 New Arrivals</div></div>
      <div class="mh-hscroll" id="mhNew"><div style="padding:1rem;color:#4a5a78;font-size:.8rem">Loading…</div></div>
    </div>
    <div>
      <div class="mh-hd" style="padding-top:.25rem"><div class="mh-hd-left">📡 Platform Activity</div></div>
      <div class="mh-activity" id="mhActivity"></div>
    </div>
  </div>
  <div class="mh-cta" id="mhCta"></div>
</div>`;
    main.parentNode.insertBefore(div, main);
  }

  /* ─── Render helpers ────────────────────────────────────────────────────── */
  function renderStats(s) {
    const items = [
      { icon:'🏪', bg:'rgba(99,102,241,.1)',  num:s.shops,        lbl:'Active Stores',   sub:s.branches+' branches' },
      { icon:'📦', bg:'rgba(0,212,255,.08)',  num:s.products,     lbl:'Total Products',  sub:s.shopProducts+' from vendors' },
      { icon:'🗂️', bg:'rgba(236,72,153,.08)', num:s.categories,   lbl:'Categories',      sub:'All product types' },
      { icon:'🔥', bg:'rgba(255,107,53,.08)', num:s.onSale,       lbl:'On Sale Now',     sub:s.featured+' featured' },
      { icon:'💰', bg:'rgba(0,230,118,.08)',  num:'KES '+fmt(s.avgPrice), lbl:'Avg Price', sub:'Competitive rates' },
      { icon:'✨', bg:'rgba(212,160,23,.08)', num:s.newThisWeek,  lbl:'New This Week',   sub:'Fresh arrivals' },
    ];
    document.getElementById('mhStats').innerHTML = items.map(i => `
      <div class="mh-stat">
        <div class="mh-stat-icon" style="background:${i.bg}">${i.icon}</div>
        <div>
          <div class="mh-stat-num">${i.num}</div>
          <div class="mh-stat-lbl">${i.lbl}</div>
          <div class="mh-stat-sub">${i.sub}</div>
        </div>
      </div>`).join('');
  }

  function renderTicker(s, shops) {
    const msgs = [
      `🟢 SELA is live — <strong>${fmt(s.products)}</strong> products listed`,
      ...shops.slice(0,4).map(sh => `🏪 <strong>${sh.name}</strong> is on SELA`),
      `🔥 <strong>${fmt(s.onSale)}</strong> products currently on sale`,
      `📍 <strong>${s.branches}</strong> vendor branches across Kenya`,
      `⭐ <strong>${fmt(s.featured)}</strong> editor-picked products`,
      `🆕 <strong>${s.newThisWeek}</strong> new products this week`,
      `🚀 Open your store free — no upfront cost`,
    ];
    document.getElementById('mhTicker').innerHTML = msgs.map(m =>
      `<span class="mh-tick-item"><span class="mh-tick-dot"></span><span>${m}</span></span>`
    ).join('');
  }

  function renderMetrics(s, shops) {
    const totalBranches = shops.reduce((sum,sh) => sum+(sh.branches||1), 0) || s.branches;
    const cards = [
      { mc:'#6366f1', icon:'🏪', tag:'LIVE',    tagType:'info', num:s.shops,       lbl:'Active Vendor Stores',  sub:`${totalBranches} branch locations across Kenya` },
      { mc:'#00d4ff', icon:'📦', tag:'↑ GROWING',tagType:'up',  num:s.products,    lbl:'Products Listed',       sub:`${s.shopProducts} from vendor stores` },
      { mc:'#ec4899', icon:'🗂️', tag:'ALL',      tagType:'info', num:s.categories,  lbl:'Product Categories',    sub:'Electronics, accessories & more' },
      { mc:'#ff6b35', icon:'🔥', tag:'HOT',      tagType:'hot',  num:s.onSale,      lbl:'Products On Sale',      sub:'Live discounts from vendors' },
      { mc:'#00e676', icon:'💰', tag:'MARKET',   tagType:'up',   num:'KES '+fmt(s.avgPrice), lbl:'Average Price', sub:'Competitive vendor pricing' },
      { mc:'#d4a017', icon:'✨', tag:'FRESH',    tagType:'gold', num:s.newThisWeek, lbl:'New This Week',         sub:'Recently added to SELA' },
    ];
    document.getElementById('mhMetrics').innerHTML = cards.map(c => `
      <div class="mh-mc" style="--mc:${c.mc}">
        <div class="mh-mc-top">
          <div class="mh-mc-icon">${c.icon}</div>
          <span class="mh-mc-tag ${c.tagType}">${c.tag}</span>
        </div>
        <div class="mh-mc-num">${c.num}</div>
        <div class="mh-mc-lbl">${c.lbl}</div>
        <div class="mh-mc-sub">${c.sub}</div>
      </div>`).join('');
  }

  function renderStores(shops) {
    const el = document.getElementById('mhStores');
    const countEl = document.getElementById('mhShopsCount');
    if (countEl) countEl.textContent = shops.length;
    if (!shops.length) {
      el.innerHTML = `<div style="padding:2rem;color:#4a5a78;text-align:center;width:100%">No vendor stores yet. <a href="javascript:void(0)" onclick="(window._requireLogin||function(d){window.location.href=d})('shop-create.html')" style="color:#6366f1;font-weight:700">Be the first →</a></div>`;
      return;
    }
    el.innerHTML = shops.map(s => {
      const c = s.themeColor||'#6366f1';
      const id = s.id||s._id;
      const storeUrl = 'shop-store.html?slug=' + (s.slug||'') + '&id=' + (s.id||s._id||'');
      return `<a class="mh-store" href="${storeUrl}" style="--c:${c}22">
        <div class="mh-store-banner" style="background:linear-gradient(135deg,${c}22,${c}44)">
          ${s.banner?`<img src="${fixImg(s.banner)}" alt="" onerror="this.style.display='none'"/>` :''}
          <span class="mh-store-live">● LIVE</span>
          ${s.logo
            ? `<img class="mh-store-logo" src="${fixImg(s.logo)}" alt="" onerror="this.style.display='none'"/>`
            : `<div class="mh-store-logo-ph" style="background:linear-gradient(135deg,${c},${c}88)">🏪</div>`}
        </div>
        <div class="mh-store-body">
          <div class="mh-store-name">${s.name}</div>
          <div class="mh-store-loc">📍 ${s.location||'Kenya'}</div>
          <div class="mh-store-row">
            <span>⭐ <strong>${s.rating?s.rating.toFixed(1):'4.5'}</strong></span>
            ${s.totalSales?`<span>🛒 <strong>${fmt(s.totalSales)}</strong></span>`:''}
          </div>
        </div>
      </a>`;
    }).join('');
  }

  function renderCategories(cats) {
    const ICONS = { 'Laptops & Computers':'💻','Phones & Tablets':'📱','Accessories':'🎧','Gaming':'🎮','Networking':'📡','Smart Devices':'⌚','Computer Peripherals':'🖥️','Storage Devices':'💾','Power & Charging':'⚡','Cables & Accessories':'🔌','Networking Gear':'🌐','Other':'📦' };
    const COLORS = ['#6366f1','#ec4899','#f59e0b','#ef4444','#22c55e','#0ea5e9','#8b5cf6','#06b6d4','#fbbf24','#64748b','#10b981','#00d4ff'];
    if (!cats.length) { document.getElementById('mhCats').innerHTML = '<div style="padding:1rem;color:#4a5a78;font-size:.82rem">No categories yet — add products to see them here.</div>'; return; }
    document.getElementById('mhCats').innerHTML = cats.slice(0,12).map((c,i) => `
      <a class="mh-cat" style="--cc:${COLORS[i%COLORS.length]}33"
         onclick="if(typeof filterByCategory==='function'){var catName=this.dataset.cat;filterByCategory(catName,this);document.getElementById('products').scrollIntoView({behavior:'smooth'});}return false" data-cat="${c.name}"
         href="#">
        <div class="mh-cat-icon">${ICONS[c.name]||'📦'}</div>
        <div class="mh-cat-name">${c.name}</div>
        <div class="mh-cat-count">${c.count} products</div>
      </a>`).join('');
  }

  function prodCard(p) {
    const price = p.onSale && p.salePrice ? p.salePrice : p.price;
    const img = fixImg((p.images&&p.images[0]) || p.image || '');
    const isNew = new Date()-new Date(p.createdAt||0) < 7*86400000;
    const dest  = p.slug ? `product.html?slug=${p.slug}` : `product.html?id=${p.id||p._id}`;
    return `<a class="mh-prod" href="${dest}">
      ${p.onSale?'<span class="mh-prod-badge mh-sale">SALE</span>':isNew?'<span class="mh-prod-badge mh-new">NEW</span>':''}
      <div class="mh-prod-img">${img?`<img src="${img}" alt="" onerror="this.parentElement.textContent='📦'"/>`:'📦'}</div>
      <div class="mh-prod-body">
        <div class="mh-prod-name">${p.name||''}</div>
        <div class="mh-prod-price">KES ${fmt(price)}</div>
        ${p._shopName?`<div class="mh-prod-shop">🏪 ${p._shopName}</div>`:''}
      </div>
    </a>`;
  }

  function renderProducts(featuredProds, recentProds) {
    const fc = document.getElementById('mhFeatCount');
    if (fc) fc.textContent = featuredProds.length;
    document.getElementById('mhFeatured').innerHTML = featuredProds.length
      ? featuredProds.map(prodCard).join('')
      : '<div style="padding:1.5rem;color:#4a5a78;font-size:.8rem">No featured products yet — mark products as featured in your dashboard.</div>';
    document.getElementById('mhNew').innerHTML = recentProds.length
      ? recentProds.map(prodCard).join('')
      : '<div style="padding:1.5rem;color:#4a5a78;font-size:.8rem">No new products yet.</div>';
  }

  function renderActivity(shops, featuredProds, onSaleCount) {
    const acts = [
      ...shops.slice(0,3).map(s => ({ icon:'🏪', text:`<strong>${s.name}</strong> joined SELA`, time: s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-KE',{month:'short',day:'numeric'}) : 'Recently' })),
      ...featuredProds.slice(0,2).map(p => ({ icon:'⭐', text:`<strong>${p.name}</strong> is now featured${p._shopName?' by '+p._shopName:''}`, time:'Featured' })),
      ...(onSaleCount > 0 ? [{ icon:'🔥', text:`<strong>${fmt(onSaleCount)}</strong> products are currently on sale across all stores`, time:'Live' }] : []),
      { icon:'🚀', text:'<strong>SELA Marketplace</strong> is live and open for new vendors', time:'Today' },
    ];
    document.getElementById('mhActivity').innerHTML = acts.slice(0,6).map(a =>
      `<div class="mh-act-item"><div class="mh-act-icon">${a.icon}</div><div class="mh-act-text">${a.text}</div><div class="mh-act-time">${a.time}</div></div>`
    ).join('');
  }

  function renderCTA(s) {
    document.getElementById('mhCta').innerHTML = `
      <div>
        <div class="mh-cta-tag">🚀 Join SELA Marketplace</div>
        <h2 class="mh-cta-h">Sell to <em>Thousands of Buyers</em><br>Across Kenya</h2>
        <p class="mh-cta-p">Open your vendor store in minutes. List unlimited products, manage inventory, accept WhatsApp orders and grow your business.</p>
      </div>
      <div>
        <div class="mh-cta-nums">
          <div class="mh-cta-num"><div class="mh-cta-num-val">${s.shops}</div><div class="mh-cta-num-lbl">Stores</div></div>
          <div class="mh-cta-num"><div class="mh-cta-num-val">${fmt(s.products)}</div><div class="mh-cta-num-lbl">Products</div></div>
          <div class="mh-cta-num"><div class="mh-cta-num-val">Free</div><div class="mh-cta-num-lbl">To Start</div></div>
        </div>
        <div class="mh-cta-btns">
          <a href="javascript:void(0)" onclick="(window._requireLogin||function(d){window.location.href=d})('shop-create.html')" class="mh-cta-btn solid">🏪 Open Your Store</a>
          <a href="shop.html" class="mh-cta-btn ghost">Browse Stores →</a>
        </div>
      </div>`;
  }

  /* ─── Main loader ───────────────────────────────────────────────────────── */
  async function load() {
    try {
      const r = await fetch(`${API}/marketplace/stats`);
      if (!r.ok) throw new Error('Stats API failed');
      const data = await r.json();
      if (!data.success) throw new Error('Bad response');

      const { stats, categories, shops, recentProducts, featuredProducts } = data;

      renderStats(stats);
      renderTicker(stats, shops);
      renderMetrics(stats, shops);
      renderStores(shops);
      renderCategories(categories);
      renderProducts(featuredProducts, recentProducts);
      renderActivity(shops, featuredProducts, stats.onSale);
      renderCTA(stats);
    } catch(e) {
      // Graceful degradation — show empty states
      const ids = ['mhStats','mhMetrics','mhStores','mhCats','mhFeatured','mhNew','mhActivity','mhCta'];
      const msg = `<div style="padding:1rem;color:#4a5a78;font-size:.78rem">Start backend: <code style="color:#00d4ff">cd backend &amp;&amp; npm start</code></div>`;
      ids.forEach(id => { const el = document.getElementById(id); if(el) el.innerHTML = msg; });
    }
  }

  function boot() { injectSkeleton(); load(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

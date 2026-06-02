// ── SELA Auth Utilities (embedded in header.js) ───────────────────────────
// Single source of truth for auth state on the frontend

window.SELA = window.SELA || {};

// Get the active token (user or admin)
window.SELA.getToken = function() {
  return localStorage.getItem('ac_user_token') || 
         localStorage.getItem('td_token') || '';
};

// Get the current user object
window.SELA.getUser = function() {
  try { return JSON.parse(localStorage.getItem('ac_user') || '{}'); } 
  catch { return {}; }
};

// Is logged in?
window.SELA.isLoggedIn = function() {
  const tok  = window.SELA.getToken();
  const user = window.SELA.getUser();
  return !!(tok && (user.id || user.email));
};

// Is admin?
window.SELA.isAdmin = function() {
  const user = window.SELA.getUser();
  return !!(user.isAdmin || user.role === 'admin');
};

// Auth headers for fetch
window.SELA.authHeaders = function() {
  return {
    'Content-Type':  'application/json',
    'Authorization': 'Bearer ' + window.SELA.getToken()
  };
};

// Require login before action
window.SELA.requireLogin = window._requireLogin = function(dest) {
  dest = dest || 'shop-create.html';
  if (window.SELA.isLoggedIn()) {
    window.location.href = dest;
  } else {
    sessionStorage.setItem('post_login_redirect', dest);
    window.location.href = 'auth.html?redirect=' + encodeURIComponent(dest);
  }
};

// Clear all auth data (logout)
window.SELA.logout = function() {
  ['ac_user_token','td_token','ac_user',
   '_sela_my_shop','_sela_shops','_sela_pending_shop'
  ].forEach(k => localStorage.removeItem(k));
  sessionStorage.clear();
};

// Save login response
window.SELA.saveLogin = function(token, user, isAdmin) {
  if (isAdmin) {
    localStorage.removeItem('ac_user_token');
    localStorage.setItem('td_token', token);
  } else {
    localStorage.removeItem('td_token');
    localStorage.setItem('ac_user_token', token);
  }
  // Always clear stale shop data on new login
  ['_sela_my_shop','_sela_shops','_sela_pending_shop'].forEach(k => localStorage.removeItem(k));
  localStorage.setItem('ac_user', JSON.stringify(user));
};


/**
 * header.js — SELA Global Header
 * Injects the site-wide header on every page.
 */
(function () {
  'use strict';




  const API  = 'http://localhost:5000/api';
  const PATH = location.pathname.split('/').pop() || 'index.html';
  const SEARCH = new URLSearchParams(location.search);

  // ── CSS ──────────────────────────────────────────────────────────────────────
  const css = `
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800;900&family=Inter:wght@400;500;600&display=swap');
.ac-header{position:sticky;top:0;z-index:1000;background:#0b0e14;border-bottom:1px solid #1e2435;font-family:'Inter',sans-serif}
.ac-topbar{background:#060a0f;border-bottom:1px solid #131820;padding:.28rem 1.5rem;display:flex;align-items:center;justify-content:space-between;font-size:.68rem;color:#4a5a78;gap:1rem}
.ac-topbar-left{display:flex;align-items:center;gap:1rem;flex-wrap:nowrap;overflow:hidden}
.ac-topbar-right{display:flex;align-items:center;gap:1.25rem;flex-shrink:0}
.ac-topbar-right a,.ac-topbar-right span{color:#4a5a78;cursor:pointer;white-space:nowrap;transition:color .18s;font-size:.68rem;text-decoration:none}
.ac-topbar-right a:hover,.ac-topbar-right span:hover{color:#00d4ff}
.ac-ticker{flex:1;overflow:hidden;white-space:nowrap;min-width:0}
.ac-ticker-inner{display:inline-block;animation:acTick 28s linear infinite}
@keyframes acTick{0%{transform:translateX(60vw)}100%{transform:translateX(-100%)}}
.ac-header-inner{max-width:1400px;margin:0 auto;padding:.6rem 1.5rem;display:flex;align-items:center;gap:1rem}
.ac-logo{font-family:'Montserrat',sans-serif;font-size:1.3rem;font-weight:900;color:#fff;text-decoration:none;display:flex;align-items:center;gap:.15rem;flex-shrink:0;letter-spacing:-.02em}
.ac-logo-dot{color:#00d4ff}
.ac-logo-badge{font-size:.48rem;font-weight:700;background:#00d4ff;color:#0b0e14;padding:.1rem .3rem;border-radius:3px;margin-left:.2rem;letter-spacing:.05em;vertical-align:middle}
.ac-search{flex:1;max-width:420px;display:flex;align-items:center;background:#131720;border:1px solid #1e2435;border-radius:8px;overflow:hidden;transition:border-color .2s;margin:0 .5rem}
.ac-search:focus-within{border-color:#00d4ff}
.ac-search-context{padding:.4rem .65rem;font-size:.65rem;font-weight:700;color:#00d4ff;background:#0a0d14;border-right:1px solid #1e2435;white-space:nowrap;font-family:'Montserrat',sans-serif;letter-spacing:.06em;text-transform:uppercase;flex-shrink:0}
.ac-search input{flex:1;padding:.4rem .65rem;background:transparent;border:none;outline:none;color:#e8edf5;font-size:.82rem;font-family:'Inter',sans-serif;min-width:0}
.ac-search input::placeholder{color:#4a5a78}
.ac-search-btn{padding:.4rem .75rem;background:none;border:none;color:#4a5a78;cursor:pointer;font-size:.9rem;flex-shrink:0}
.ac-search-btn:hover{color:#00d4ff}
.ac-nav{display:flex;align-items:center;gap:.15rem;flex-shrink:0}
.ac-nav-link{display:inline-flex;align-items:center;gap:.3rem;padding:.42rem .72rem;border-radius:7px;font-size:.78rem;font-weight:600;color:#8899b8;text-decoration:none;transition:all .18s;white-space:nowrap;cursor:pointer;background:none;border:none;font-family:'Inter',sans-serif}
.ac-nav-link:hover{background:#1a2035;color:#e8edf5}
.ac-nav-link.active{color:#00d4ff;background:rgba(0,212,255,.07)}
.ac-deals{color:#ff6b35!important}
.ac-deals:hover{background:rgba(255,107,53,.08)!important}
/* Right side */
.ac-right{display:flex;align-items:center;gap:.6rem;flex-shrink:0;margin-left:auto}
.ac-sell-btn{display:inline-flex;align-items:center;gap:.35rem;padding:.42rem 1rem;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;border-radius:8px;font-size:.73rem;font-weight:700;cursor:pointer;white-space:nowrap;font-family:'Montserrat',sans-serif;letter-spacing:.02em;transition:all .2s}
.ac-sell-btn:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(99,102,241,.4)}
/* Login button */
.ac-login-btn{display:inline-flex;align-items:center;gap:.35rem;padding:.42rem 1rem;background:rgba(255,255,255,.07);color:#e8edf5;border:1.5px solid rgba(255,255,255,.18);border-radius:8px;font-size:.73rem;font-weight:700;cursor:pointer;white-space:nowrap;font-family:'Montserrat',sans-serif;letter-spacing:.02em;transition:all .2s;text-decoration:none}
.ac-login-btn:hover{background:rgba(0,212,255,.12);border-color:rgba(0,212,255,.5);color:#00d4ff}
/* Account button (logged in) */
.ac-account-btn{display:inline-flex;align-items:center;gap:.45rem;padding:.38rem .85rem;background:rgba(99,102,241,.12);color:#a5b4fc;border:1.5px solid rgba(99,102,241,.3);border-radius:8px;font-size:.73rem;font-weight:700;cursor:pointer;white-space:nowrap;font-family:'Montserrat',sans-serif;letter-spacing:.02em;transition:all .2s}
.ac-account-btn:hover{background:rgba(99,102,241,.2);border-color:#6366f1;color:#c7d2fe}
.ac-account-btn svg{width:14px;height:14px;flex-shrink:0}
/* Dropdown */
.ac-dd-wrap{position:relative}
.ac-dropdown{position:absolute;top:calc(100% + .6rem);right:0;width:220px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 10px 40px rgba(0,0,0,.16);z-index:9999;overflow:hidden;display:none}
.ac-dropdown.open{display:block;animation:ddFade .15s ease}
@keyframes ddFade{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
.ac-dd-head{padding:.85rem 1rem .7rem;border-bottom:1px solid #f1f5f9;background:#f8fafc}
.ac-dd-name{font-weight:700;font-size:.88rem;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ac-dd-email{font-size:.72rem;color:#94a3b8;margin-top:.1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ac-dd-item{display:flex;align-items:center;gap:.65rem;padding:.68rem 1rem;font-size:.84rem;font-weight:600;color:#475569;cursor:pointer;border:none;background:none;width:100%;text-align:left;transition:background .15s;font-family:'Inter',sans-serif;text-decoration:none}
.ac-dd-item:hover{background:#f8fafc;color:#0f172a}
.ac-dd-icon{width:20px;text-align:center;font-size:.88rem;flex-shrink:0}
.ac-dd-sep{height:1px;background:#f1f5f9;margin:.3rem 0}
.ac-dd-item.danger{color:#ef4444}.ac-dd-item.danger:hover{background:#fef2f2}
.ac-admin-badge{display:inline-flex;align-items:center;gap:.35rem;background:rgba(99,102,241,.08);color:#6366f1;font-size:.65rem;font-weight:700;padding:.2rem .65rem;border-radius:20px;letter-spacing:.06em;text-transform:uppercase;margin:.3rem 1rem .1rem}
/* Hamburger */
.ac-hamburger{display:none;flex-direction:column;gap:4px;padding:.45rem;background:none;border:none;cursor:pointer;margin-left:.25rem}
.ac-hamburger span{display:block;width:20px;height:2px;background:#8899b8;border-radius:1px;transition:all .25s}
.ac-hamburger.open span:nth-child(1){transform:rotate(45deg) translate(4px,4px)}
.ac-hamburger.open span:nth-child(2){opacity:0}
.ac-hamburger.open span:nth-child(3){transform:rotate(-45deg) translate(4px,-4px)}
/* Mobile drawer */
.ac-drawer{position:fixed;inset:0;z-index:2000;pointer-events:none}
.ac-drawer.open{pointer-events:auto}
.ac-drawer-overlay{position:absolute;inset:0;background:rgba(0,0,0,.55);opacity:0;transition:opacity .3s;backdrop-filter:blur(4px)}
.ac-drawer.open .ac-drawer-overlay{opacity:1}
.ac-drawer-panel{position:absolute;top:0;right:0;width:280px;height:100%;background:#0f1219;transform:translateX(100%);transition:transform .3s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;overflow-y:auto;box-shadow:-8px 0 32px rgba(0,0,0,.4)}
.ac-drawer.open .ac-drawer-panel{transform:translateX(0)}
.ac-drawer-head{padding:1.25rem 1.25rem 1rem;border-bottom:1px solid #1e2435;display:flex;align-items:center;justify-content:space-between}
.ac-drawer-logo{font-family:'Montserrat',sans-serif;font-size:1.1rem;font-weight:900;color:#fff}
.ac-drawer-logo span{color:#00d4ff}
.ac-drawer-close{background:none;border:none;color:#4a5a78;font-size:1.2rem;cursor:pointer;line-height:1}
.ac-drawer-links{padding:.5rem 0;flex:1}
.ac-drawer-link{display:flex;align-items:center;gap:.65rem;padding:.75rem 1.25rem;color:#8899b8;font-size:.88rem;font-weight:600;cursor:pointer;border:none;background:none;width:100%;text-align:left;transition:all .18s;font-family:'Inter',sans-serif;text-decoration:none}
.ac-drawer-link:hover{background:#1a2035;color:#e8edf5}
.ac-drawer-icon{font-size:1rem;width:20px;text-align:center;flex-shrink:0}
.ac-drawer-sep{height:1px;background:#1e2435;margin:.4rem 1.25rem}
.ac-drawer-footer{padding:1rem 1.25rem;border-top:1px solid #1e2435;font-size:.68rem;color:#4a5a78}
@media(max-width:900px){.ac-nav,.ac-search{display:none!important}.ac-hamburger{display:flex}}.ac-logo{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px}@media(max-width:400px){.ac-logo{max-width:100px;font-size:.9rem!important}}.ac-sell-btn{white-space:nowrap}@media(max-width:480px){.ac-sell-btn span{display:none}}
@media(min-width:901px){.ac-drawer{display:none!important}}
  `;

  const NAV_ITEMS = [
    { id:'marketplace', label:'🛍️ Marketplace', href:'index.html', cls:'' },
    { id:'branches',    label:'🏪 Browse Stores', href:'shop.html',  cls:'' },
    { id:'hotdeals',    label:'🔥 Hot Deals',    href:'hotdeals.html', cls:'ac-deals' },
    { id:'blog',        label:'📝 Blog',         href:'blog.html', cls:'' },
    { id:'help',        label:'💬 Help',         href:'help.html', cls:'' },
    { id:'about',       label:'🏢 About Us',     href:'about.html', cls:'' },
  ];

  const PAGE_MAP = {
    'index.html':        { id:'marketplace', search:'products',  placeholder:'Search products, shops, categories…' },
    'shop.html':         { id:'branches',    search:'stores',    placeholder:'Search stores and products…' },
    'hotdeals.html':     { id:'hotdeals',    search:'hotdeals',  placeholder:'Search hot deals…' },
    'blog.html':         { id:'blog',        search:'blog',      placeholder:'Search articles & tips…' },
    'blog-post.html':    { id:'blog',        search:'blog',      placeholder:'Search articles…' },
    'help.html':         { id:'help',        search:'help',      placeholder:'Search help topics…' },
    'help-post.html':    { id:'help',        search:'help',      placeholder:'Search help topics…' },
    'about.html':        { id:'about',       search:'site',      placeholder:'Search Aircoast Solutions…' },
    'shop-store.html':   { id:'branches',    search:'stores',    placeholder:'Search products…' },
    'shops.html':        { id:'branches',    search:'stores',    placeholder:'Search shops…' },
    'shop-dashboard.html':{ id:'',           search:'site',      placeholder:'Search SELA…' },
    'shop-create.html':  { id:'',            search:'site',      placeholder:'Search SELA…' },
    'auth.html':         { id:'',            search:'site',      placeholder:'Search SELA…' },
    'user-settings.html':{ id:'',            search:'site',      placeholder:'Search SELA…' },
  };

  const ctx = PAGE_MAP[PATH] || { id:'', search:'site', placeholder:'Search SELA…' };

  function isLoggedIn() {
    return !!(localStorage.getItem('td_token') || localStorage.getItem('ac_user_token'));
  }
  function isAdminUser() {
    return !!localStorage.getItem('td_token');
  }
  function getUser() {
    try { return JSON.parse(localStorage.getItem('ac_user') || '{}'); } catch { return {}; }
  }
  function getUserName() {
    if (isAdminUser()) return 'Admin';
    const u = getUser();
    return (u.firstName || u.name || u.email || '').trim();
  }

  // ── Build nav ──────────────────────────────────────────────────────────────
  function buildNav() {
    return NAV_ITEMS.map(n =>
      `<a class="ac-nav-link ${n.cls} ${n.id === ctx.id ? 'active' : ''}" href="${n.href}">${n.label}</a>`
    ).join('');
  }

  // ── Build right side (auth-aware, rendered fresh each time) ───────────────
  function buildRight() {
    const loggedIn = isLoggedIn();
    const name     = getUserName();

    const sellBtn = `<button class="ac-sell-btn" onclick="window._acGoSell()">🏪 Sell with Us</button>`;

    if (!loggedIn) {
      return `${sellBtn}
      <a class="ac-login-btn" href="auth.html?redirect=${encodeURIComponent(PATH)}">🔐 Login / Register</a>`;
    }

    const label = name ? name : 'Account';
    const admin = isAdminUser() ? ' 🛡️' : '';

    return `${sellBtn}
    <a class="wl-nav-btn" href="wishlist.html" title="Wishlist" style="position:relative;display:inline-flex;align-items:center;padding:.4rem .6rem;color:var(--ac-text2,#9aa0b0);text-decoration:none;font-size:1.1rem;transition:color .2s" onmouseover="this.style.color='var(--ac-accent,#00d4ff)'" onmouseout="this.style.color='var(--ac-text2,#9aa0b0)'">
      ❤️
      <span class="wl-badge" style="position:absolute;top:0;right:0;background:#ef4444;color:#fff;font-size:.55rem;font-weight:700;border-radius:10px;padding:.05rem .3rem;min-width:14px;text-align:center;display:none"></span>
    </a>
    <div class="ac-dd-wrap">
      <button class="ac-account-btn" id="acAccountBtn" onclick="window._acToggleDropdown()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
        ${label}${admin}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:10px;height:10px;opacity:.6"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div class="ac-dropdown" id="acDropdown">
        <div class="ac-dd-head">
          <div class="ac-dd-name">${name || 'My Account'}</div>
          <div class="ac-dd-email">${getUser().email || ''}</div>
        </div>
        <div id="acDdMenuItems"></div>
        ${isAdminUser() ? '<span class="ac-admin-badge">🛡️ SELA Admin</span>' : ''}
      </div>
    </div>`;
  }

  // ── Build drawer (mobile) ──────────────────────────────────────────────────
  function buildDrawer() {
    const loggedIn = isLoggedIn();
    const name     = getUserName();
    return `
<div class="ac-drawer" id="acDrawer">
  <div class="ac-drawer-overlay" onclick="window._acCloseDrawer()"></div>
  <div class="ac-drawer-panel">
    <div class="ac-drawer-head">
      <div class="ac-drawer-logo">SELA<span>.</span></div>
      <button class="ac-drawer-close" onclick="window._acCloseDrawer()">✕</button>
    </div>
    <div class="ac-drawer-links">
      ${NAV_ITEMS.map(n => `<a class="ac-drawer-link" href="${n.href}" onclick="window._acCloseDrawer()"><span class="ac-drawer-icon">${n.label.split(' ')[0]}</span> ${n.label.replace(/^[^ ]+ /,'')}</a>`).join('')}
      <div class="ac-drawer-sep"></div>
      <button class="ac-drawer-link" onclick="window._acCloseDrawer();window._acGoSell()"><span class="ac-drawer-icon">🏪</span> Sell with Us</button>
      ${loggedIn ? `
      <button class="ac-drawer-link" onclick="window._acCloseDrawer();window.location.href='user-settings.html'"><span class="ac-drawer-icon">⚙️</span> Settings & Profile</button>
      <button class="ac-drawer-link" onclick="window._acCloseDrawer();window._acGoMyStore()"><span class="ac-drawer-icon">🏪</span> My Store</button>
      <div class="ac-drawer-sep"></div>
      <button class="ac-drawer-link" style="color:#ef4444" onclick="window._acCloseDrawer();window._acLogout()"><span class="ac-drawer-icon">🚪</span> Logout</button>
      ` : `
      <a class="ac-drawer-link" href="auth.html"><span class="ac-drawer-icon">🔐</span> Login / Register</a>
      `}
    </div>
    <div class="ac-drawer-footer">SELA — Kenya's Multi-Vendor Marketplace</div>
  </div>
</div>`;
  }

  // ── Inject ─────────────────────────────────────────────────────────────────
  function inject() {
    // Inject CSS
    if (!document.getElementById('ac-header-css')) {
      const st = document.createElement('style');
      st.id = 'ac-header-css';
      st.textContent = css;
      document.head.appendChild(st);
    }

    // Remove any old static header
    document.querySelectorAll('header:not(.ac-header), .ac-header').forEach(el => el.remove());
    document.getElementById('acDrawer')?.remove();

    // Build header HTML
    const header = document.createElement('header');
    header.className = 'ac-header';
    header.id = 'acMainHeader';
    header.innerHTML = `
  <div class="ac-topbar">
    <div class="ac-topbar-left">
      <span>📍 Nairobi, Kenya</span>
      <span class="ac-ticker"><span class="ac-ticker-inner">🎉 Welcome to SELA — Kenya's Multi-Vendor Marketplace &nbsp;&nbsp; 🏪 Open your store from KES 1,500/mo &nbsp;&nbsp; 📦 Products from verified Kenyan vendors</span></span>
    </div>
    <div class="ac-topbar-right">
      <a href="help.html">Help</a>
      <a href="about.html">About</a>
      <a href="shops.html">Become a Vendor</a>
    </div>
  </div>
  <div class="ac-header-inner">
    <a class="ac-logo" href="index.html">
      <span>SELA</span><span class="ac-logo-dot">.</span>
      <span class="ac-logo-badge">KE</span>
    </a>
    <div class="ac-search" id="acSearchBar">
      <span class="ac-search-context">${ctx.search || 'search'}</span>
      <input type="text" id="acSearchInput" placeholder="${ctx.placeholder}" onkeydown="if(event.key==='Enter')window._acDoSearch(this.value)" oninput="window._acOnInput(this.value)"/>
      <button class="ac-search-btn" onclick="window._acDoSearch(document.getElementById('acSearchInput').value)">🔍</button>
    </div>
    <nav class="ac-nav" id="acNav">${buildNav()}</nav>
    <div class="ac-right" id="acRight">${buildRight()}</div>
    <button class="ac-hamburger" id="acHamburger" onclick="window._acToggleDrawer()"><span></span><span></span><span></span></button>
  </div>`;

    document.body.insertBefore(header, document.body.firstChild);

    // Inject drawer
    const drawerEl = document.createElement('div');
    drawerEl.innerHTML = buildDrawer();
    document.body.appendChild(drawerEl.firstElementChild);

    // Build dropdown menu items
    buildDropdownMenu();
  }

  // ── Dropdown menu items (depends on store) ─────────────────────────────────
  async function buildDropdownMenu() {
    const wrap = document.getElementById('acDdMenuItems');
    if (!wrap) return;

    if (isAdminUser()) {
      wrap.innerHTML =
        '<a class="ac-dd-item" href="admin.html"><span class="ac-dd-icon">📊</span> Admin Dashboard</a>' +
        '<a class="ac-dd-item" href="admin.html#users"><span class="ac-dd-icon">👥</span> Manage Users</a>' +
        '<a class="ac-dd-item" href="admin.html#stores"><span class="ac-dd-icon">🏪</span> Manage Stores</a>' +
        '<a class="ac-dd-item" href="admin.html#create-user"><span class="ac-dd-icon">➕</span> Create User</a>' +
        '<div class="ac-dd-sep"></div>' +
        '<button class="ac-dd-item danger" onclick="window._acLogout()"><span class="ac-dd-icon">🚪</span> Logout</button>';
      return;
    }

    if (!isLoggedIn()) return;

    const tok = (window.SELA&&window.SELA.getToken)?window.SELA.getToken():(localStorage.getItem('ac_user_token')||localStorage.getItem('td_token')||'');

    // Show loading state immediately
    wrap.innerHTML = '<div style="padding:.75rem 1rem;font-size:.78rem;color:var(--ac-text2,#9aa0b0)">Loading…</div>';

    // Check if user has a store
    let hasStore = false;
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch((window.SELA_API||'/api').replace('/api','') + '/api/shops/mine', {
        headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer ' + tok },
        signal: ctrl.signal
      });
      if (r && r.ok) {
        const j = await r.json().catch(()=>({}));
        hasStore = !!(j.data && j.data.length > 0);
        if (hasStore && j.data[0]) {
          const sid = j.data[0].id || (j.data[0]._id&&j.data[0]._id.toString()) || '';
          wrap.innerHTML =
            '<a class="ac-dd-item" href="shop-dashboard.html?id='+sid+'"><span class="ac-dd-icon">🏪</span> My Store Dashboard</a>' +
            '<a class="ac-dd-item" href="wishlist.html"><span class="ac-dd-icon">❤️</span> My Wishlist</a>' +
            '<a class="ac-dd-item" href="user-settings.html"><span class="ac-dd-icon">⚙️</span> Settings & Profile</a>' +
            '<div class="ac-dd-sep"></div>' +
            '<button class="ac-dd-item danger" onclick="window._acLogout()"><span class="ac-dd-icon">🚪</span> Sign Out</button>';
          return;
        }
      }
    } catch(e) { console.warn('shops/mine failed:', e.message); }

    // Check staff access
    let staffAccess = [];
    try {
      const sa = await fetch((window.SELA_API||'/api').replace('/api','') + '/api/me/staff-access', {
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},
        signal: AbortSignal.timeout(4000)
      });
      if (sa.ok) {
        const sj = await sa.json().catch(()=>({}));
        staffAccess = sj.data || [];
      }
    } catch {}

    if (staffAccess.length) {
      const staffLinks = staffAccess.map(s =>
        '<a class="ac-dd-item" href="shop-dashboard.html?id='+s.shopId+'"><span class="ac-dd-icon">🏪</span> '+s.shopName+' Dashboard</a>'
      ).join('');
      wrap.innerHTML =
        staffLinks +
        '<a class="ac-dd-item" href="user-settings.html"><span class="ac-dd-icon">⚙️</span> Settings</a>' +
        '<div class="ac-dd-sep"></div>' +
        '<button class="ac-dd-item danger" onclick="window._acLogout()"><span class="ac-dd-icon">🚪</span> Sign Out</button>';
      return;
    }

    // No store found
    wrap.innerHTML =
      '<a class="ac-dd-item" href="shop-create.html"><span class="ac-dd-icon">✨</span> Create a Store</a>' +
      '<a class="ac-dd-item" href="wishlist.html"><span class="ac-dd-icon">❤️</span> My Wishlist</a>' +
      '<a class="ac-dd-item" href="user-settings.html"><span class="ac-dd-icon">⚙️</span> Settings & Profile</a>' +
      '<div class="ac-dd-sep"></div>' +
      '<button class="ac-dd-item danger" onclick="window._acLogout()"><span class="ac-dd-icon">🚪</span> Sign Out</button>';
  }

  // ── Dropdown toggle ────────────────────────────────────────────────────────
  window._acToggleDropdown = function () {
    const dd = document.getElementById('acDropdown');
    if (!dd) return;
    const open = dd.classList.toggle('open');
    if (open) setTimeout(() => document.addEventListener('click', _outsideClick, { once: true }), 0);
  };
  function _outsideClick(e) {
    const dd  = document.getElementById('acDropdown');
    const btn = document.getElementById('acAccountBtn');
    if (dd && !dd.contains(e.target) && btn && !btn.contains(e.target)) dd.classList.remove('open');
  }
  window._acCloseDropdown = function () {
    const dd = document.getElementById('acDropdown');
    if (dd) dd.classList.remove('open');
  };

  // ── Drawer ─────────────────────────────────────────────────────────────────
  window._acToggleDrawer = function () {
    const d = document.getElementById('acDrawer');
    const h = document.getElementById('acHamburger');
    if (!d) return;
    const open = d.classList.toggle('open');
    if (h) h.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  };
  window._acCloseDrawer = function () {
    const d = document.getElementById('acDrawer');
    const h = document.getElementById('acHamburger');
    if (d) d.classList.remove('open');
    if (h) h.classList.remove('open');
    document.body.style.overflow = '';
  };

  // ── Auth actions ───────────────────────────────────────────────────────────
  window._acLogin = function () {
    window.location.href = 'auth.html?redirect=' + encodeURIComponent(PATH);
  };
  window._acLogout = function () {
    window._acCloseDropdown();
    window._acCloseDrawer();
    localStorage.removeItem('td_token');
    localStorage.removeItem('ac_user_token');
    localStorage.removeItem('ac_user');
    window.location.href = 'index.html';
  };

  // ── Navigation helpers ─────────────────────────────────────────────────────
  window._acGoSell = async function () {
    window._acCloseDropdown();
    if (!isLoggedIn()) {
      window.location.href = 'auth.html?redirect=' + encodeURIComponent('shop-dashboard.html');
      return;
    }
    const tok = localStorage.getItem('td_token') || localStorage.getItem('ac_user_token');
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 3000);
      const r = await fetch(`${API}/shops/mine`, { headers: { 'Authorization': 'Bearer ' + tok }, signal: ctrl.signal });
      if (r && r.ok) {
        const j = await r.json();
        if (j.data && j.data.length > 0) { window.location.href = 'shop-dashboard.html?id=' + j.data[0].id; return; }
      }
    } catch {}
    window.location.href = 'shop-create.html';
  };
  window._acGoMyStore = async function () {
    window._acCloseDropdown();
    window.location.href = 'shop-dashboard.html';
  };
  window._acGoCreateStore = function () {
    window._acCloseDropdown();
    window.location.href = 'shop-create.html';
  };
  window._acGoSettings = function () {
    window._acCloseDropdown();
    window.location.href = 'user-settings.html';
  };
  window._acGoProfile = function () {
    window._acCloseDropdown();
    window.location.href = 'user-settings.html';
  };
  window._acPostAction = function () {
    if (typeof window.openPostForm === 'function') window.openPostForm();
    else window.location.href = 'index.html';
  };

  // ── Search ─────────────────────────────────────────────────────────────────
  window._acDoSearch = function (q) {
    if (!q) return;
    if ((PATH === 'index.html' || PATH === '') && typeof window.doSearch === 'function') { window.doSearch(); return; }
    if (PATH === 'shop.html' && typeof window.onSearch === 'function') { window.onSearch(q); return; }
    if (PATH === 'blog.html' && typeof window.handleSearch === 'function') { window.handleSearch(q); return; }
    if (PATH === 'hotdeals.html' && typeof window.handleSearch === 'function') { window.handleSearch(q); return; }
    window.location.href = 'index.html?search=' + encodeURIComponent(q);
  };
  window._acOnInput = function (q) {
    if ((PATH === 'index.html' || PATH === '') && typeof window.filterBySearch === 'function') window.filterBySearch(q);
  };

  // ── Reactivity on auth change ──────────────────────────────────────────────
  // Re-render the right side whenever auth state changes
  const _origSet = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function (key, value) {
    _origSet(key, value);
    if (key === 'td_token' || key === 'ac_user_token' || key === 'ac_user') {
      setTimeout(() => {
        const right = document.getElementById('acRight');
        if (right) { right.innerHTML = buildRight(); buildDropdownMenu(); }
      }, 50);
    }
  };
  const _origRemove = localStorage.removeItem.bind(localStorage);
  localStorage.removeItem = function (key) {
    _origRemove(key);
    if (key === 'td_token' || key === 'ac_user_token' || key === 'ac_user') {
      setTimeout(() => {
        const right = document.getElementById('acRight');
        if (right) { right.innerHTML = buildRight(); }
      }, 50);
    }
  };

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    inject();
    const qParam = SEARCH.get('search');
    if (qParam) {
      const inp = document.getElementById('acSearchInput');
      if (inp) { inp.value = qParam; setTimeout(() => window._acOnInput(qParam), 300); }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

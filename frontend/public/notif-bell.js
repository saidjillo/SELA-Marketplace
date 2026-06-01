/**
 * notif-bell.js — Global Admin Notification Bell
 * Drop this script into any page and it auto-injects the bell for admins.
 * Requires: API constant defined on the page, td_token in localStorage.
 */
(function () {
  'use strict';

  // ── Shared auth helpers (safe to re-declare if not already defined) ──────────
  if (typeof window._nbGetToken === 'undefined') {
    window._nbGetToken = () => localStorage.getItem('td_token');
    window._nbIsAdmin  = () => !!localStorage.getItem('td_token');
  }

  // ── Inject CSS once ──────────────────────────────────────────────────────────
  if (!document.getElementById('nb-style')) {
    const style = document.createElement('style');
    style.id = 'nb-style';
    style.textContent = `
      #nb-bell{position:fixed;top:70px;right:1.25rem;z-index:9000;display:none}
      #nb-bell.nb-show{display:block}
      #nb-bell .nb-btn{
        width:44px;height:44px;border-radius:50%;
        background:#1a2035;border:1.5px solid #252f47;
        color:#8a97b0;font-size:1.1rem;cursor:pointer;
        display:flex;align-items:center;justify-content:center;
        position:relative;transition:all .2s;
        box-shadow:0 2px 12px rgba(0,0,0,.4);
      }
      #nb-bell .nb-btn:hover{border-color:#00d4ff;color:#00d4ff}
      #nb-bell .nb-badge{
        position:absolute;top:-4px;right:-4px;
        min-width:20px;height:20px;
        background:#ff4757;color:#fff;
        border-radius:10px;font-size:.6rem;font-weight:800;
        display:flex;align-items:center;justify-content:center;
        padding:0 4px;font-family:'Montserrat',sans-serif;
        border:2px solid #0b0e14;
      }
      #nb-bell .nb-badge.nb-hidden{display:none}
      #nb-bell .nb-panel{
        position:absolute;top:52px;right:0;width:310px;
        background:#1a2035;border:1px solid #252f47;
        border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,.5);
        display:none;overflow:hidden;z-index:9001;
      }
      #nb-bell .nb-panel.nb-open{display:block;animation:nbFadeDown .18s ease}
      @keyframes nbFadeDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
      #nb-bell .nb-head{
        background:#161b27;padding:.65rem 1rem;
        border-bottom:1px solid #252f47;
        display:flex;align-items:center;justify-content:space-between;
        font-family:'Montserrat',sans-serif;font-size:.75rem;font-weight:700;color:#8a97b0;
      }
      #nb-bell .nb-clear{
        font-size:.65rem;color:#5a6a8a;cursor:pointer;
        border:none;background:none;font-family:inherit;
      }
      #nb-bell .nb-clear:hover{color:#00d4ff}
      #nb-bell .nb-item{
        padding:.65rem 1rem;border-bottom:1px solid #252f47;
        cursor:pointer;transition:background .15s;
      }
      #nb-bell .nb-item:hover{background:#1f2740}
      #nb-bell .nb-item:last-child{border-bottom:none}
      #nb-bell .nb-item-name{
        font-family:'Montserrat',sans-serif;font-size:.75rem;
        font-weight:700;color:#e8edf5;display:flex;align-items:center;gap:.4rem;
      }
      #nb-bell .nb-item-body{
        font-size:.72rem;color:#8a97b0;
        overflow:hidden;white-space:nowrap;text-overflow:ellipsis;margin-top:.15rem;
      }
      #nb-bell .nb-item-meta{font-size:.65rem;color:#5a6a8a;margin-top:.15rem;display:flex;gap:.5rem}
      #nb-bell .nb-empty{padding:1.25rem;text-align:center;font-size:.78rem;color:#5a6a8a}
      #nb-bell .nb-footer{
        background:#161b27;padding:.5rem 1rem;
        border-top:1px solid #252f47;text-align:center;
      }
      #nb-bell .nb-footer a{
        font-size:.72rem;color:#00d4ff;
        font-family:'Montserrat',sans-serif;font-weight:700;
        text-decoration:none;
      }
      #nb-bell .nb-footer a:hover{opacity:.8}
      #nb-bell .nb-new-dot{
        width:7px;height:7px;border-radius:50%;
        background:#00e676;flex-shrink:0;display:inline-block;
      }
      #nb-bell .nb-avatar{
        width:26px;height:26px;border-radius:50%;
        background:#252f47;display:inline-flex;
        align-items:center;justify-content:center;
        font-size:.6rem;font-weight:800;color:#e8edf5;
        flex-shrink:0;font-family:'Montserrat',sans-serif;
      }
    `;
    document.head.appendChild(style);
  }

  // ── Build HTML ───────────────────────────────────────────────────────────────
  if (!document.getElementById('nb-bell')) {
    const wrap = document.createElement('div');
    wrap.id = 'nb-bell';
    wrap.innerHTML = `
      <button class="nb-btn" id="nb-btn" title="New comments">
        🔔
        <span class="nb-badge nb-hidden" id="nb-badge">0</span>
      </button>
      <div class="nb-panel" id="nb-panel">
        <div class="nb-head">
          Recent Comments
          <button class="nb-clear" id="nb-clear">Mark all read</button>
        </div>
        <div id="nb-items"><div class="nb-empty">Loading…</div></div>
        <div class="nb-footer">
          <a href="blog.html">View all blog posts →</a>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    document.getElementById('nb-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      nbTogglePanel();
    });
    document.getElementById('nb-clear').addEventListener('click', (e) => {
      e.stopPropagation();
      nbMarkRead();
    });
    document.addEventListener('click', () => nbClosePanel());
  }

  // ── State ────────────────────────────────────────────────────────────────────
  let _nbOpen = false;
  let _nbLastCheck = (() => {
    const stored = localStorage.getItem('nb_last_check');
    return stored ? new Date(stored) : new Date(0);
  })();

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function nbGetAPI() {
    // Use the page's API constant if defined, otherwise default
    try { return window.API || 'http://localhost:5000/api'; } catch { return 'http://localhost:5000/api'; }
  }

  function nbEscape(str) {
    return String(str || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function nbTimeAgo(date) {
    const s = Math.floor((Date.now() - new Date(date)) / 1000);
    if (s < 60)   return 'just now';
    if (s < 3600) return Math.floor(s/60) + 'm ago';
    if (s < 86400) return Math.floor(s/3600) + 'h ago';
    return new Date(date).toLocaleDateString('en-KE', {day:'numeric', month:'short'});
  }

  function nbAvatarColor(name) {
    const colors = ['#E91E63','#9C27B0','#3F51B5','#2196F3','#009688','#4CAF50','#FF5722','#607D8B'];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return colors[Math.abs(h) % colors.length];
  }

  // ── Panel toggle ─────────────────────────────────────────────────────────────
  function nbTogglePanel() {
    _nbOpen = !_nbOpen;
    document.getElementById('nb-panel').classList.toggle('nb-open', _nbOpen);
    if (_nbOpen) nbLoadNotifications();
  }

  function nbClosePanel() {
    if (_nbOpen) {
      _nbOpen = false;
      document.getElementById('nb-panel')?.classList.remove('nb-open');
    }
  }

  // ── Load notifications ───────────────────────────────────────────────────────
  async function nbLoadNotifications() {
    const token = window._nbGetToken();
    if (!token) return;
    try {
      const since = _nbLastCheck.toISOString();
      const r = await fetch(
        `${nbGetAPI()}/comments/notifications?since=${encodeURIComponent(since)}`,
        { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) }
      );
      const j = await r.json();
      if (!j.success) return;

      const badge = document.getElementById('nb-badge');
      if (badge) {
        const cnt = j.count || 0;
        badge.textContent = cnt > 99 ? '99+' : cnt;
        badge.classList.toggle('nb-hidden', cnt === 0);
      }

      const items = document.getElementById('nb-items');
      if (!items) return;

      if (!j.latest || !j.latest.length) {
        items.innerHTML = '<div class="nb-empty">No new comments</div>';
        return;
      }

      items.innerHTML = j.latest.map(c => {
        const color  = c.isAdmin ? '#00d4ff' : nbAvatarColor(c.authorName || '?');
        const letter = (c.authorName || '?')[0].toUpperCase();
        return `<div class="nb-item" onclick="window.location.href='blog-post.html?id=${nbEscape(c.postId)}'">
          <div class="nb-item-name">
            <span class="nb-avatar" style="background:${color};color:${color === '#00d4ff' ? '#0b0e14' : '#fff'}">${letter}</span>
            ${nbEscape(c.authorName)}
            <span class="nb-new-dot"></span>
          </div>
          <div class="nb-item-body">${nbEscape((c.body || '').substring(0, 80))}${(c.body||'').length > 80 ? '…' : ''}</div>
          <div class="nb-item-meta">
            <span>${nbTimeAgo(c.createdAt)}</span>
            <span>Post: ${nbEscape(c.postId)}</span>
          </div>
        </div>`;
      }).join('');

    } catch { /* offline */ }
  }

  // ── Mark all read ────────────────────────────────────────────────────────────
  function nbMarkRead() {
    _nbLastCheck = new Date();
    localStorage.setItem('nb_last_check', _nbLastCheck.toISOString());
    const badge = document.getElementById('nb-badge');
    if (badge) { badge.textContent = '0'; badge.classList.add('nb-hidden'); }
    const items = document.getElementById('nb-items');
    if (items) items.innerHTML = '<div class="nb-empty">All caught up! ✓</div>';
  }

  // ── Poll every 30s ───────────────────────────────────────────────────────────
  async function nbPoll() {
    if (!window._nbIsAdmin()) return;
    const token = window._nbGetToken();
    if (!token) return;
    try {
      const since = _nbLastCheck.toISOString();
      const r = await fetch(
        `${nbGetAPI()}/comments/notifications?since=${encodeURIComponent(since)}`,
        { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) }
      );
      const j = await r.json();
      if (j.success) {
        const cnt = j.count || 0;
        const badge = document.getElementById('nb-badge');
        if (badge) {
          badge.textContent = cnt > 99 ? '99+' : cnt;
          badge.classList.toggle('nb-hidden', cnt === 0);
        }
      }
    } catch { /* offline */ }
  }

  // ── Init ─────────────────────────────────────────────────────────────────────
  async function nbInit() {
    // Verify token if needed
    const token = window._nbGetToken();
    if (!token) { document.getElementById('nb-bell')?.classList.remove('nb-show'); return; }

    try {
      const r = await fetch(`${nbGetAPI()}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
        signal: AbortSignal.timeout(4000)
      });
      const j = await r.json();
      if (!j.valid) {
        localStorage.removeItem('td_token');
        document.getElementById('nb-bell')?.classList.remove('nb-show');
        return;
      }
    } catch {
      // Offline — show bell anyway if token exists (optimistic)
    }

    document.getElementById('nb-bell')?.classList.add('nb-show');
    await nbPoll();
    setInterval(nbPoll, 30000);
  }

  // Run after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', nbInit);
  } else {
    nbInit();
  }

})();

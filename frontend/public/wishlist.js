// ── SELA Wishlist (localStorage) ────────────────────────────────────────────
window.Wishlist = (function() {
  const KEY = 'sela_wishlist';

  function getAll() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch { return []; }
  }
  function save(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
    _updateBadge();
  }
  function isIn(id) {
    return getAll().some(p => p.id === String(id));
  }
  function add(item) {
    const list = getAll();
    if (!list.some(p => p.id === String(item.id))) {
      list.unshift({ ...item, id: String(item.id), addedAt: Date.now() });
      save(list);
    }
    return true;
  }
  function remove(id) {
    save(getAll().filter(p => p.id !== String(id)));
    return false;
  }
  function toggle(item) {
    return isIn(item.id) ? remove(item.id) : add(item);
  }
  function count() { return getAll().length; }

  function _updateBadge() {
    const n = count();
    document.querySelectorAll('.wl-badge').forEach(el => {
      el.textContent = n > 0 ? n : '';
      el.style.display = n > 0 ? '' : 'none';
    });
  }

  // Init badge on page load
  document.addEventListener('DOMContentLoaded', _updateBadge);

  return { getAll, add, remove, toggle, isIn, count };
})();

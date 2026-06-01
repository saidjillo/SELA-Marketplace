// Auto-detect API base URL
window.SELA_API = (function() {
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://localhost:5000/api';
  }
  return window.location.origin + '/api';
})();

// Base URL (without /api) for images etc
window.SELA_BASE = window.SELA_API.replace('/api', '');

'use strict';

/* ══════════════════════════════════════
   API CLIENT
   Wraps all fetch calls to /api/*
   Handles auth headers, token refresh,
   and consistent error handling.
══════════════════════════════════════ */

const API = (() => {
  let _accessToken = localStorage.getItem('accessToken') || null;

  function setToken(t) {
    _accessToken = t;
    if (t) localStorage.setItem('accessToken', t);
    else    localStorage.removeItem('accessToken');
  }

  function getToken() { return _accessToken; }

  async function request(method, path, body = null, isFormData = false) {
    const headers = {};
    if (_accessToken) headers['Authorization'] = 'Bearer ' + _accessToken;
    if (!isFormData && body) headers['Content-Type'] = 'application/json';

    const opts = { method, headers };
    if (body) opts.body = isFormData ? body : JSON.stringify(body);

    let res = await fetch('/api' + path, opts);

    // Auto-refresh on 401
    if (res.status === 401 && path !== '/auth/login' && path !== '/auth/refresh') {
      const refreshed = await tryRefresh();
      if (refreshed) {
        headers['Authorization'] = 'Bearer ' + _accessToken;
        opts.headers = headers;
        res = await fetch('/api' + path, opts);
      }
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw { status: res.status, message: data.message || 'Request failed' };
    return data.data !== undefined ? data.data : data;
  }

  async function tryRefresh() {
    try {
      const res  = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (res.ok && data?.data?.accessToken) {
        setToken(data.data.accessToken);
        return true;
      }
    } catch (_) {}
    setToken(null);
    window.dispatchEvent(new Event('auth:expired'));
    return false;
  }

  // Auth
  const auth = {
    register: (body)  => request('POST', '/auth/register', body),
    login:    (body)  => request('POST', '/auth/login',    body),
    logout:   ()      => request('POST', '/auth/logout'),
    refresh:  ()      => request('POST', '/auth/refresh'),
    getMe:    ()      => request('GET',  '/auth/me'),
    updateMe: (body)  => request('PUT',  '/auth/me', body),
    googleUrl: () => window.location.href = '/api/auth/google',
  };

  // Transactions
  const transactions = {
    getAll:   (q = {}) => request('GET', '/transactions?' + new URLSearchParams(q)),
    getById:  (id)     => request('GET', `/transactions/${id}`),
    create:   (fd)     => request('POST', '/transactions', fd, true),
    update:   (id, fd) => request('PUT',  `/transactions/${id}`, fd, true),
    remove:   (id)     => request('DELETE', `/transactions/${id}`),
  };

  // Budgets
  const budgets = {
    getAll:  ()         => request('GET',    '/budgets'),
    create:  (body)     => request('POST',   '/budgets', body),
    update:  (id, body) => request('PUT',    `/budgets/${id}`, body),
    remove:  (id)       => request('DELETE', `/budgets/${id}`),
  };

  // Categories
  const categories = {
    getAll:  (type)     => request('GET',    '/categories' + (type ? '?type='+type : '')),
    create:  (body)     => request('POST',   '/categories', body),
    update:  (id, body) => request('PUT',    `/categories/${id}`, body),
    remove:  (id)       => request('DELETE', `/categories/${id}`),
  };

  // Reports
  const reports = {
    dashboard:         (q = {}) => request('GET', '/reports/dashboard?'         + new URLSearchParams(q)),
    monthly:           (q = {}) => request('GET', '/reports/monthly?'           + new URLSearchParams(q)),
    categoryBreakdown: (q = {}) => request('GET', '/reports/category-breakdown?'+ new URLSearchParams(q)),
    netWorth:          (q = {}) => request('GET', '/reports/net-worth?'         + new URLSearchParams(q)),
  };

  // AI — Part B
  const ai = {
    chat:           (question) => request('POST',   '/ai/chat',            { question }),
    getHistory:     ()         => request('GET',    '/ai/chat/history'),
    clearHistory:   ()         => request('DELETE', '/ai/chat/history'),
    getInsight:     ()         => request('GET',    '/ai/insight'),
    importStatement:(fd)       => request('POST',   '/ai/import',          fd, true),
    importStatus:   (id)       => request('GET',    `/ai/import/${id}/status`),
    importHistory:  ()         => request('GET',    '/ai/import/history'),
    detectAnomalies:()         => request('POST',   '/ai/anomalies/detect'),
    getAnomalies:   ()         => request('GET',    '/ai/anomalies'),
    dismissAnomaly: (id)       => request('PATCH',  `/ai/anomalies/${id}/dismiss`),
  };

  return { setToken, getToken, auth, transactions, budgets, categories, reports, ai };
})();

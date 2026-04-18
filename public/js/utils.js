'use strict';

/* ── TOAST ── */
const Toast = (() => {
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  function show(msg, type = 'info', ms = 4000) {
    const wrap = document.getElementById('toastWrap');
    const el   = document.createElement('div');
    el.className = `toast t-${type}`;
    el.innerHTML = `<span style="font-size:15px;flex-shrink:0">${icons[type]}</span><span>${msg}</span>`;
    wrap.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .3s,transform .3s';
      el.style.opacity = '0'; el.style.transform = 'translateX(20px)';
      setTimeout(() => el.remove(), 300);
    }, ms);
  }
  return { show };
})();

/* ── MODAL ── */
const Modal = (() => {
  function open(id)  { const e = document.getElementById(id); if (e) { e.classList.add('open');    document.body.style.overflow = 'hidden'; } }
  function close(id) { const e = document.getElementById(id); if (e) { e.classList.remove('open'); document.body.style.overflow = '';       } }
  function init() {
    document.querySelectorAll('.modal-backdrop').forEach(b => {
      b.addEventListener('click', e => { if (e.target === b) close(b.id); });
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') document.querySelectorAll('.modal-backdrop.open').forEach(b => close(b.id));
    });
  }
  return { open, close, init };
})();

/* ── CHART REGISTRY ── */
const Charts = (() => {
  const _reg = {};
  Chart.defaults.font.family = "'Plus Jakarta Sans',system-ui,sans-serif";
  Chart.defaults.color = '#4a5568';

  function destroy(id) { if (_reg[id]) { _reg[id].destroy(); delete _reg[id]; } }

  function _tooltip(cur) {
    return {
      backgroundColor: '#1c2538', borderColor: 'rgba(255,255,255,.1)', borderWidth: 1,
      padding: 12, titleColor: '#eef1f7', bodyColor: '#8a94a8', cornerRadius: 10,
      callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmtCur(ctx.raw, cur)}` },
    };
  }
  function _scales(cur) {
    return {
      x: { ticks: { color:'#4a5568',font:{size:11} }, grid: { color:'rgba(255,255,255,.04)', drawBorder:false } },
      y: { ticks: { color:'#4a5568',font:{size:11}, callback: v => fmtCur(v,cur) }, grid: { color:'rgba(255,255,255,.04)', drawBorder:false } },
    };
  }
  function _legend() {
    return { labels: { color:'#8a94a8', font:{size:12}, padding:16, boxWidth:10, boxHeight:10, usePointStyle:true, pointStyle:'circle' } };
  }
  function _grad(ctx, hex, hi, lo) {
    const g = ctx.createLinearGradient(0,0,0,280);
    const r = parseInt(hex.slice(1,3),16), gv = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    g.addColorStop(0, `rgba(${r},${gv},${b},${hi})`);
    g.addColorStop(1, `rgba(${r},${gv},${b},${lo})`);
    return g;
  }

  function lineChart(id, labels, datasets, cur) {
    destroy(id);
    const ctx = document.getElementById(id)?.getContext('2d');
    if (!ctx) return;
    _reg[id] = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: { responsive:true, maintainAspectRatio:false, interaction:{mode:'index',intersect:false}, plugins:{legend:_legend(), tooltip:_tooltip(cur)}, scales:_scales(cur) },
    });
  }

  function barChart(id, labels, datasets, cur) {
    destroy(id);
    const ctx = document.getElementById(id)?.getContext('2d');
    if (!ctx) return;
    _reg[id] = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets },
      options: { responsive:true, maintainAspectRatio:false, interaction:{mode:'index',intersect:false}, plugins:{legend:_legend(), tooltip:_tooltip(cur)}, scales:_scales(cur), borderRadius:5 },
    });
  }

  function doughnut(id, labels, data, colors) {
    destroy(id);
    const ctx = document.getElementById(id)?.getContext('2d');
    if (!ctx) return;
    _reg[id] = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor:colors, borderWidth:0, hoverOffset:8, borderRadius:4 }] },
      options: { responsive:true, maintainAspectRatio:false, cutout:'70%', plugins:{legend:{position:'bottom',labels:{color:'#8a94a8',font:{size:11},padding:12,boxWidth:10,boxHeight:10,usePointStyle:true}}} },
    });
  }

  function incomeExpenseLine(id, labels, incomeData, expenseData, cur) {
    destroy(id);
    const ctx = document.getElementById(id)?.getContext('2d');
    if (!ctx) return;
    _reg[id] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label:'Income', data:incomeData, borderColor:'#2dd4a0', backgroundColor:_grad(ctx,'#2dd4a0',.14,0), tension:.42, fill:true, pointRadius:4, pointHoverRadius:7, pointBackgroundColor:'#2dd4a0', pointBorderColor:'#0f1520', pointBorderWidth:2, borderWidth:2.5 },
          { label:'Expenses', data:expenseData, borderColor:'#ff5c5c', backgroundColor:_grad(ctx,'#ff5c5c',.12,0), tension:.42, fill:true, pointRadius:4, pointHoverRadius:7, pointBackgroundColor:'#ff5c5c', pointBorderColor:'#0f1520', pointBorderWidth:2, borderWidth:2.5 },
        ],
      },
      options: { responsive:true, maintainAspectRatio:false, interaction:{mode:'index',intersect:false}, plugins:{legend:_legend(), tooltip:_tooltip(cur)}, scales:_scales(cur) },
    });
  }

  function ringPath(pct) {
    const r = 22, circ = 2*Math.PI*r;
    return { circ, offset: circ - (Math.min(pct,100)/100)*circ };
  }

  return { lineChart, barChart, doughnut, incomeExpenseLine, ringPath, destroy };
})();

/* ── NAVIGATION ── */
const Nav = (() => {
  const META = {
    dashboard:    { title:'Dashboard',         sub:'Your financial overview' },
    transactions: { title:'Transactions',      sub:'All income, expenses & investments' },
    budgets:      { title:'Budgets',           sub:'Track spending against your limits' },
    reports:      { title:'Reports',           sub:'Analyse trends and generate insights' },
    profile:      { title:'Profile & Settings',sub:'Manage your account and preferences' },
    ai:           { title:'AI Assistant',      sub:'Ask anything about your finances' },
    import:       { title:'Import Statement',  sub:'Upload bank statements for auto-import' },
    anomalies:    { title:'Anomaly Detection', sub:'Identify unusual spending patterns' },
  };
  let _cb = null;
  function go(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('page-'+id)?.classList.add('active');
    document.querySelector(`.nav-item[data-page="${id}"]`)?.classList.add('active');
    const m = META[id] || {};
    document.getElementById('topbarTitle').textContent   = m.title || id;
    document.getElementById('topbarSubtitle').textContent = m.sub   || '';
    if (_cb) _cb(id);
  }
  function onNav(fn) { _cb = fn; }
  return { go, onNav };
})();

/* ── FORMAT CURRENCY ── */
const SYMBOLS = { INR:'₹', USD:'$', EUR:'€', GBP:'£', JPY:'¥', AED:'د.إ', SGD:'S$' };
function fmtCur(amount, currency = 'INR') {
  const sym = SYMBOLS[currency] || currency+' ';
  const abs = Math.abs(+amount || 0);
  const str = currency === 'INR'
    ? abs.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})
    : abs.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  return (+amount < 0 ? '-' : '') + sym + str;
}

/* ── DATE HELPERS ── */
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
}
function todayISO() { return new Date().toISOString().split('T')[0]; }

/* ── ESCAPE HTML ── */
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ── INITIALS ── */
function initials(name) { return (name||'').split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2) || '?'; }

/* ── CATEGORY EMOJI ── */
const CAT_EMOJI = {
  'Salary':'💼','Freelance':'💻','Business':'🏢','Dividend':'📊','Rental Income':'🏠','Bonus':'🎁','Other Income':'💰',
  'Food & Dining':'🍽️','Transport':'🚗','Shopping':'🛍️','Entertainment':'🎬','Health':'🏥','Utilities':'💡',
  'Rent':'🏠','Travel':'✈️','Education':'📚','Subscriptions':'📱','Insurance':'🛡️','EMI / Loan':'🏦','Other Expense':'💸',
  'Stocks / Equity':'📈','Mutual Funds':'📊','Fixed Deposit':'🏛️','PPF / EPF':'🏛️','Real Estate':'🏢',
  'Gold / SGB':'🪙','Crypto':'₿','NPS':'🎯','Other Investment':'💹',
};
function catEmoji(name) { return CAT_EMOJI[name] || '📊'; }

/* ── SPINNER ── */
function showSpinner(id, show) {
  const el = document.getElementById(id);
  if (el) el.style.display = show ? 'flex' : 'none';
}

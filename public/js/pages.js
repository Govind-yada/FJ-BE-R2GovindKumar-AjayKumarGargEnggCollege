'use strict';

/* ══════════════════════════════════════
   DASHBOARD
══════════════════════════════════════ */
const DashboardPage = (() => {
  async function render() {
    try {
      const cur = AppState.user?.preferred_currency || 'INR';
      const [summary, txRes, budgets] = await Promise.all([
        API.reports.dashboard({ currency: cur }),
        API.transactions.getAll({ limit: 7, page: 1 }),
        API.budgets.getAll(),
      ]);
      _renderStats(summary);
      _renderCharts(summary, cur);
      _renderRecentTx(txRes.data || []);
      _renderBudgetMini(budgets);
    } catch (err) {
      Toast.show(err.message || 'Failed to load dashboard', 'error');
    }
  }

  function _renderStats(s) {
    const cur = AppState.user?.preferred_currency || 'INR';
    _set('statIncome',   fmtCur(s.income,   cur));
    _set('statExpense',  fmtCur(s.expense,  cur));
    _set('statSavings',  fmtCur(s.savings,  cur));
  }

  async function _renderCharts(summary, cur) {
    try {
      const year = new Date().getFullYear();
      const monthly = await API.reports.monthly({ year, currency: cur });
      const MONTHS  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const labels  = MONTHS.slice(Math.max(0, new Date().getMonth()-5), new Date().getMonth()+1);
      const startIdx = Math.max(0, new Date().getMonth()-5);
      const incomeD  = monthly.slice(startIdx, new Date().getMonth()+1).map(m => m.income);
      const expenseD = monthly.slice(startIdx, new Date().getMonth()+1).map(m => m.expense);
      Charts.incomeExpenseLine('chartIncomeExpense', labels, incomeD, expenseD, cur);

      const catData = await API.reports.categoryBreakdown({ year, currency: cur });
      const expCat  = catData.filter(c => c.type === 'expense').slice(0,7);
      const PALETTE = ['#d4a843','#2dd4a0','#ff5c5c','#4a9eff','#a78bfa','#f59e0b','#34d399'];
      Charts.doughnut('chartCategory', expCat.map(c=>c.category), expCat.map(c=>c.amount), PALETTE);
    } catch (_) {}
  }

  function _renderRecentTx(txs) {
    const el = document.getElementById('recentTxList');
    if (!txs.length) { el.innerHTML = _emptyMini('No transactions yet'); return; }
    el.innerHTML = txs.map(t => {
      const name = t.category_name || 'Uncategorised';
      const emoji = t.category_emoji || catEmoji(name);
      const bg = { income:'var(--green-dim)', expense:'var(--red-dim)', investment:'var(--blue-dim)' }[t.type];
      const cls = { income:'income', expense:'expense', investment:'investment' }[t.type];
      return `<div style="display:flex;align-items:center;gap:12px;padding:13px 0;border-bottom:1px solid var(--border-dim)">
        <div style="width:36px;height:36px;border-radius:var(--r-sm);display:flex;align-items:center;justify-content:center;font-size:16px;background:${bg};flex-shrink:0">${emoji}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13.5px;font-weight:500;color:var(--text-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.description)}</div>
          <div style="font-size:11.5px;color:var(--text-3);margin-top:2px">${esc(name)} · ${fmtDate(t.date)}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-family:var(--font-m);font-size:13.5px;font-weight:500" class="td-amount ${cls}">${+t.amount<0?'−':''}${fmtCur(Math.abs(+t.amount), t.currency)}</div>
          <div style="margin-top:2px"><span class="cur-tag">${t.currency}</span></div>
        </div>
      </div>`;
    }).join('');
  }

  function _renderBudgetMini(budgets) {
    const el = document.getElementById('dashBudgetList');
    const cur = AppState.user?.preferred_currency || 'INR';
    if (!budgets.length) { el.innerHTML = _emptyMini('No budgets set'); return; }
    el.innerHTML = budgets.slice(0,6).map(b => {
      const pct = b.pct || 0;
      const barCls = pct >= 100 ? 'bar-danger' : pct >= 80 ? 'bar-warning' : 'bar-safe';
      return `<div style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-size:13px;font-weight:500;color:var(--text-1)">${catEmoji(b.category_name)} ${esc(b.category_name)}</span>
          <span style="font-family:var(--font-m);font-size:12px;color:var(--text-3)">${fmtCur(b.spent_inr,cur)} / ${fmtCur(b.amount,cur)}</span>
        </div>
        <div class="budget-bar-bg"><div class="budget-bar ${barCls}" style="width:${Math.min(pct,100)}%"></div></div>
        <div style="text-align:right;margin-top:3px;font-size:11px;color:var(--text-3);font-family:var(--font-m)">${pct}%</div>
      </div>`;
    }).join('');
  }

  function _emptyMini(msg) {
    return `<div style="text-align:center;padding:32px;color:var(--text-3);font-size:13px">${msg}</div>`;
  }

  return { render };
})();

/* ══════════════════════════════════════
   TRANSACTIONS
══════════════════════════════════════ */
const TxPage = (() => {
  let _filter = 'all', _search = '', _currency = '', _page = 1, _total = 0, _perPage = 15;
  let _editId = null, _file = null;

  async function render() { await _loadTable(); }

  async function _loadTable() {
    const tbody = document.getElementById('txTableBody');
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px"><div class="spinner"></div></td></tr>`;
    try {
      const params = { page: _page, limit: _perPage };
      if (_filter !== 'all') params.type = _filter;
      if (_currency) params.currency = _currency;
      if (_search)   params.search   = _search;
      const res = await API.transactions.getAll(params);
      _total = res.total || 0;
      _renderTable(res.data || []);
      _renderPagination();
    } catch (err) {
      Toast.show(err.message || 'Failed to load transactions', 'error');
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-3)">Failed to load. Please retry.</td></tr>`;
    }
  }

  function _renderTable(txs) {
    const tbody = document.getElementById('txTableBody');
    if (!txs.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">🔍</div><h3>Nothing found</h3><p>No transactions match your filters.</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = txs.map(t => {
      const catName  = t.category_name || 'Uncategorised';
      const catEmoji_ = t.category_emoji || catEmoji(catName);
      return `<tr>
        <td>
          <div class="td-icon-cell">
            <div class="td-icon ${t.type}">${catEmoji_}</div>
            <div>
              <div class="td-name">${esc(t.description)}</div>
              <div class="td-sub">${fmtDate(t.date)}</div>
            </div>
          </div>
        </td>
        <td><span class="badge badge-${t.type}">${t.type}</span></td>
        <td style="color:var(--text-2)">${esc(catName)}</td>
        <td><span class="cur-tag">${t.currency}</span></td>
        <td class="td-amount ${t.type}">${+t.amount<0?'−':''}${fmtCur(Math.abs(+t.amount), t.currency)}</td>
        <td>${t.receipt_url ? `<a href="${esc(t.receipt_url)}" target="_blank" style="font-size:18px;text-decoration:none" title="View receipt">📎</a>` : `<span style="color:var(--text-4)">—</span>`}</td>
        <td>
          <div class="row-actions">
            <button class="action-btn" onclick="TxPage.openEdit('${t.id}')" title="Edit">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="action-btn danger" onclick="TxPage.confirmDelete('${t.id}','${esc(t.description)}')" title="Delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  function _renderPagination() {
    const totalPages = Math.ceil(_total / _perPage);
    document.getElementById('paginationInfo').textContent =
      _total ? `${(_page-1)*_perPage+1}–${Math.min(_page*_perPage,_total)} of ${_total}` : '0 results';
    const btns = document.getElementById('paginationBtns');
    btns.innerHTML = '';
    for (let i = 1; i <= Math.min(totalPages, 8); i++) {
      const b = document.createElement('div');
      b.className = 'page-btn' + (i===_page?' active':'');
      b.textContent = i;
      b.addEventListener('click', () => { _page = i; _loadTable(); });
      btns.appendChild(b);
    }
  }

  function setFilter(type, el) {
    _filter = type; _page = 1;
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    _loadTable();
  }
  function setSearch(v)   { _search = v; _page = 1; _loadTable(); }
  function setCurrency(v) { _currency = v; _page = 1; _loadTable(); }

  function openAdd() {
    _editId = null; _file = null;
    document.getElementById('txModalTitle').textContent = 'New Transaction';
    document.getElementById('txDesc').value    = '';
    document.getElementById('txAmount').value  = '';
    document.getElementById('txDate').value    = todayISO();
    document.getElementById('txCurrency').value = AppState.user?.preferred_currency || 'INR';
    document.getElementById('uploadFileName').textContent = 'Click or drag to upload (JPEG, PNG, PDF — max 5 MB)';
    _selectType('expense');
    Modal.open('txModal');
  }

  async function openEdit(id) {
    try {
      const t = await API.transactions.getById(id);
      _editId = id; _file = null;
      document.getElementById('txModalTitle').textContent = 'Edit Transaction';
      _selectType(t.type);
      document.getElementById('txDesc').value     = t.description;
      document.getElementById('txAmount').value   = t.amount;
      document.getElementById('txDate').value     = t.date;
      document.getElementById('txCurrency').value = t.currency;
      // load category options then select
      _updateCatOptions(t.type);
      setTimeout(() => { document.getElementById('txCategory').value = t.category_id || ''; }, 20);
      Modal.open('txModal');
    } catch (err) { Toast.show(err.message, 'error'); }
  }

  function _selectType(type) {
    document.querySelectorAll('.type-opt').forEach(el => {
      el.dataset.selected = 'false';
      el.className = 'type-opt';
    });
    const sel = document.querySelector(`.type-opt[data-type="${type}"]`);
    if (sel) { sel.dataset.selected = 'true'; sel.className = `type-opt sel-${type}`; }
    _updateCatOptions(type);
  }

  async function _updateCatOptions(type) {
    const sel = document.getElementById('txCategory');
    sel.innerHTML = '<option value="">— Uncategorised —</option>';
    try {
      const cats = await API.categories.getAll(type);
      cats.forEach(c => {
        const o = document.createElement('option');
        o.value = c.id; o.textContent = `${c.emoji||'📊'} ${c.name}`;
        sel.appendChild(o);
      });
    } catch (_) {}
  }

  async function save() {
    const type   = document.querySelector('.type-opt[data-selected="true"]')?.dataset.type || 'expense';
    const desc   = document.getElementById('txDesc').value.trim();
    const amount = document.getElementById('txAmount').value;
    const cur    = document.getElementById('txCurrency').value;
    const catId  = document.getElementById('txCategory').value;
    const date   = document.getElementById('txDate').value;
    if (!desc)   { Toast.show('Please enter a description','error'); return; }
    if (!amount) { Toast.show('Please enter an amount','error'); return; }
    if (!date)   { Toast.show('Please select a date','error'); return; }

    const fd = new FormData();
    fd.append('type', type); fd.append('description', desc);
    fd.append('amount', amount); fd.append('currency', cur);
    fd.append('date', date);
    if (catId) fd.append('categoryId', catId);
    if (_file) fd.append('receipt', _file);

    const saveBtn = document.querySelector('#txModal .btn-primary');
    saveBtn.disabled = true; saveBtn.innerHTML = '<span class="spinner"></span>';
    try {
      if (_editId) {
        await API.transactions.update(_editId, fd);
        Toast.show('Transaction updated', 'success');
      } else {
        await API.transactions.create(fd);
        Toast.show('Transaction added', 'success');
      }
      Modal.close('txModal');
      _loadTable();
      DashboardPage.render();
    } catch (err) {
      Toast.show(err.message || 'Save failed', 'error');
    } finally {
      saveBtn.disabled = false; saveBtn.innerHTML = 'Save Transaction';
    }
  }

  async function confirmDelete(id, desc) {
    if (!confirm(`Delete "${desc}"?\nThis cannot be undone.`)) return;
    try {
      await API.transactions.remove(id);
      Toast.show('Transaction deleted', 'info');
      _loadTable(); DashboardPage.render();
    } catch (err) { Toast.show(err.message, 'error'); }
  }

  function handleFile(file) {
    if (!file) return;
    if (file.size > 5*1024*1024) { Toast.show('File exceeds 5 MB limit', 'error'); return; }
    if (!['image/jpeg','image/png','application/pdf'].includes(file.type)) {
      Toast.show('Only JPEG, PNG or PDF allowed', 'error'); return;
    }
    _file = file;
    document.getElementById('uploadFileName').textContent = `✓ ${file.name}`;
    Toast.show(`Receipt "${file.name}" attached`, 'success');
  }

  return { render, setFilter, setSearch, setCurrency, openAdd, openEdit, save, confirmDelete, handleFile, _selectType };
})();

/* ══════════════════════════════════════
   BUDGETS
══════════════════════════════════════ */
const BudgetPage = (() => {
  let _editId = null;

  async function render() {
    try {
      const budgets = await API.budgets.getAll();
      _renderCards(budgets);
      _renderChart(budgets);
    } catch (err) { Toast.show(err.message, 'error'); }
  }

  function _renderCards(budgets) {
    const cur  = AppState.user?.preferred_currency || 'INR';
    const grid = document.getElementById('budgetGrid');
    if (!budgets.length) {
      grid.innerHTML = `<div style="grid-column:1/-1"><div class="empty-state"><div class="empty-state-icon">🎯</div><h3>No budgets yet</h3><p>Set spending limits to track your money.</p><button class="btn btn-primary btn-sm" onclick="BudgetPage.openAdd()">+ Set Budget</button></div></div>`;
      return;
    }
    grid.innerHTML = budgets.map(b => {
      const pct = b.pct || 0;
      const status = pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : 'safe';
      const ringColor = { safe:'#2dd4a0', warning:'#f59e0b', danger:'#ff5c5c' }[status];
      const barCls    = { safe:'bar-safe', warning:'bar-warning', danger:'bar-danger' }[status];
      const badgeCls  = { safe:'badge-success', warning:'badge-warning', danger:'badge-danger' }[status];
      const statusLabel = { safe:'On track', warning:'Approaching', danger:'Overrun!' }[status];
      const { circ, offset } = Charts.ringPath(pct);
      const left = Math.max(0, +b.amount - (+b.spent_inr || 0));
      return `<div class="budget-card">
        <div class="budget-card-top">
          <div style="display:flex;align-items:center;gap:12px">
            <div class="budget-cat-icon">${catEmoji(b.category_name)}</div>
            <div>
              <div class="budget-card-name">${esc(b.category_name)}</div>
              <div class="budget-card-period">${b.period === 'monthly' ? 'Monthly' : 'Weekly'}</div>
            </div>
          </div>
          <div class="budget-pct-ring">
            <svg width="52" height="52" viewBox="0 0 52 52">
              <circle cx="26" cy="26" r="22" stroke-width="4" fill="none" stroke="var(--bg-elevated)"/>
              <circle cx="26" cy="26" r="22" stroke-width="4" fill="none"
                stroke="${ringColor}" stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"
                style="transform-origin:center;transform:rotate(-90deg)" stroke-linecap="round"/>
            </svg>
            <div class="budget-pct-text" style="color:${ringColor}">${Math.round(pct)}%</div>
          </div>
        </div>
        <div class="budget-bar-bg"><div class="budget-bar ${barCls}" style="width:${Math.min(Math.round(pct),100)}%"></div></div>
        <div class="budget-amounts-row">
          <div class="budget-spent">${fmtCur(b.spent_inr||0, cur)}</div>
          <div class="budget-limit">of ${fmtCur(b.amount, cur)}</div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px">
          <span class="badge ${badgeCls}">${statusLabel}</span>
          <span style="font-size:11.5px;color:var(--text-3)">${fmtCur(left,cur)} left</span>
        </div>
        <div class="budget-card-actions">
          <button class="btn btn-secondary btn-sm" style="flex:1" onclick="BudgetPage.openEdit('${b.id}','${esc(b.category_name)}',${b.amount},'${b.period}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="BudgetPage.confirmDelete('${b.id}','${esc(b.category_name)}')">Remove</button>
        </div>
      </div>`;
    }).join('');
  }

  function _renderChart(budgets) {
    const cur = AppState.user?.preferred_currency || 'INR';
    Charts.barChart('chartBudget',
      budgets.map(b => b.category_name),
      [
        { label:'Budget', data:budgets.map(b=>b.amount), backgroundColor:'rgba(212,168,67,.18)', borderColor:'#d4a843', borderWidth:1.5, borderRadius:5 },
        { label:'Spent',  data:budgets.map(b=>b.spent_inr||0), backgroundColor:'rgba(255,92,92,.18)', borderColor:'#ff5c5c', borderWidth:1.5, borderRadius:5 },
      ],
      cur
    );
  }

  function openAdd() {
    _editId = null;
    document.getElementById('budgetModalTitle').textContent = 'Set Budget Goal';
    document.getElementById('budgetCategory').value = 'Food & Dining';
    document.getElementById('budgetAmount').value   = '';
    document.getElementById('budgetPeriod').value   = 'monthly';
    Modal.open('budgetModal');
  }
  function openEdit(id, catName, amount, period) {
    _editId = id;
    document.getElementById('budgetModalTitle').textContent = 'Edit Budget';
    document.getElementById('budgetCategory').value = catName;
    document.getElementById('budgetAmount').value   = amount;
    document.getElementById('budgetPeriod').value   = period;
    Modal.open('budgetModal');
  }

  async function save() {
    const cat    = document.getElementById('budgetCategory').value;
    const amount = parseFloat(document.getElementById('budgetAmount').value);
    const period = document.getElementById('budgetPeriod').value;
    if (!cat || isNaN(amount) || amount <= 0) { Toast.show('Enter a valid budget amount', 'error'); return; }
    const saveBtn = document.querySelector('#budgetModal .btn-primary');
    saveBtn.disabled = true; saveBtn.innerHTML = '<span class="spinner"></span>';
    try {
      if (_editId) {
        await API.budgets.update(_editId, { categoryName: cat, amount, period });
        Toast.show('Budget updated', 'success');
      } else {
        await API.budgets.create({ categoryName: cat, amount, period });
        Toast.show('Budget set!', 'success');
      }
      Modal.close('budgetModal');
      render(); DashboardPage.render();
    } catch (err) {
      Toast.show(err.message || 'Save failed', 'error');
    } finally {
      saveBtn.disabled = false; saveBtn.innerHTML = 'Save Budget';
    }
  }

  async function confirmDelete(id, catName) {
    if (!confirm(`Remove budget for "${catName}"?`)) return;
    try {
      await API.budgets.remove(id);
      Toast.show('Budget removed', 'info');
      render(); DashboardPage.render();
    } catch (err) { Toast.show(err.message, 'error'); }
  }

  return { render, openAdd, openEdit, save, confirmDelete };
})();

/* ══════════════════════════════════════
   REPORTS
══════════════════════════════════════ */
const ReportsPage = (() => {
  let _tab = 'monthly';
  function setTab(tab, el) {
    _tab = tab;
    document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    render();
  }
  async function render() {
    const cur  = document.getElementById('reportCurrency')?.value || AppState.user?.preferred_currency || 'INR';
    const year = document.getElementById('reportYear')?.value || new Date().getFullYear();
    const el   = document.getElementById('reportContent');
    el.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px"><div class="spinner"></div></div>`;
    try {
      if (_tab === 'monthly')   await _monthly(el, cur, year);
      if (_tab === 'category')  await _category(el, cur, year);
      if (_tab === 'networth')  await _netWorth(el, cur, year);
    } catch (err) { Toast.show(err.message, 'error'); }
  }

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  async function _monthly(el, cur, year) {
    const data = await API.reports.monthly({ year, currency: cur });
    el.innerHTML = `
      <div style="grid-column:1/-1"><div class="card">
        <div class="card-header"><div><div class="card-title">Income vs Expenses — ${year}</div><div class="card-subtitle">Monthly comparison</div></div></div>
        <div class="card-body"><div class="chart-wrap" style="height:300px"><canvas id="rChartMonthly"></canvas></div></div>
      </div></div>
      <div class="card">
        <div class="card-header"><div class="card-title">Monthly Breakdown</div></div>
        <div class="card-body" style="padding-top:12px">
          <table class="report-summary-table">
            <thead><tr>
              <th>Month</th>
              <th style="text-align:right;color:var(--green)">Income</th>
              <th style="text-align:right;color:var(--red)">Expense</th>
              <th style="text-align:right;color:var(--gold)">Net</th>
            </tr></thead>
            <tbody>${data.map((m,i) => `<tr>
              <td>${MONTHS[i]}</td>
              <td style="text-align:right;font-family:var(--font-m);color:var(--green)">${fmtCur(m.income,cur)}</td>
              <td style="text-align:right;font-family:var(--font-m);color:var(--red)">${fmtCur(m.expense,cur)}</td>
              <td style="text-align:right;font-family:var(--font-m);color:${m.net>=0?'var(--gold)':'var(--red)'}">${m.net<0?'−':''}${fmtCur(Math.abs(m.net),cur)}</td>
            </tr>`).join('')}</tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Investments — ${year}</div></div>
        <div class="card-body"><div class="chart-wrap" style="height:200px"><canvas id="rChartInvest"></canvas></div></div>
      </div>`;
    setTimeout(() => {
      Charts.barChart('rChartMonthly', MONTHS,
        [
          { label:'Income', data:data.map(m=>m.income), backgroundColor:'rgba(45,212,160,.18)', borderColor:'#2dd4a0', borderWidth:1.5, borderRadius:5 },
          { label:'Expense', data:data.map(m=>m.expense), backgroundColor:'rgba(255,92,92,.18)', borderColor:'#ff5c5c', borderWidth:1.5, borderRadius:5 },
        ], cur);
      Charts.lineChart('rChartInvest', MONTHS,
        [{ label:'Investments', data:data.map(m=>m.investment), borderColor:'#4a9eff', backgroundColor:'rgba(74,158,255,.08)', tension:.42, fill:true, pointRadius:3, pointBackgroundColor:'#4a9eff', borderWidth:2 }],
        cur);
    }, 0);
  }

  async function _category(el, cur, year) {
    const data = await API.reports.categoryBreakdown({ year, currency: cur });
    const exp  = data.filter(c => c.type === 'expense');
    const total = exp.reduce((s,c) => s+c.amount, 0);
    const PALETTE = ['#d4a843','#2dd4a0','#ff5c5c','#4a9eff','#a78bfa','#f59e0b','#34d399','#f472b6'];
    el.innerHTML = `<div style="grid-column:1/-1"><div class="card">
      <div class="card-header"><div class="card-title">Expense by Category — ${year}</div></div>
      <div class="card-body" style="display:grid;grid-template-columns:1fr 1.4fr;gap:24px;align-items:center">
        <div class="chart-wrap" style="height:300px"><canvas id="rChartCat"></canvas></div>
        <div>${exp.map((c,i) => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:11px 0;border-bottom:1px solid var(--border-dim)">
            <div style="display:flex;align-items:center;gap:10px">
              <div style="width:10px;height:10px;border-radius:2px;background:${PALETTE[i%PALETTE.length]};flex-shrink:0"></div>
              <span style="font-size:13.5px;color:var(--text-1)">${catEmoji(c.category)} ${esc(c.category)}</span>
            </div>
            <div style="text-align:right">
              <div style="font-family:var(--font-m);font-size:13px;color:var(--text-1)">${fmtCur(c.amount,cur)}</div>
              <div style="font-size:11px;color:var(--text-3)">${total>0?Math.round((c.amount/total)*100):0}%</div>
            </div>
          </div>`).join('')}
        </div>
      </div>
    </div></div>`;
    setTimeout(() => Charts.doughnut('rChartCat', exp.map(c=>c.category), exp.map(c=>c.amount), PALETTE), 0);
  }

  async function _netWorth(el, cur, year) {
    const data = await API.reports.netWorth({ year, currency: cur });
    el.innerHTML = `<div style="grid-column:1/-1"><div class="card">
      <div class="card-header"><div class="card-title">Net Worth Trend — ${year}</div></div>
      <div class="card-body"><div class="chart-wrap" style="height:340px"><canvas id="rChartNet"></canvas></div></div>
    </div></div>`;
    setTimeout(() => Charts.lineChart('rChartNet', MONTHS,
      [{ label:'Net Worth', data:data.map(m=>m.netWorth), borderColor:'#d4a843', backgroundColor:'rgba(212,168,67,.08)', tension:.42, fill:true, pointRadius:5, pointHoverRadius:8, pointBackgroundColor:'#d4a843', pointBorderColor:'#0f1520', pointBorderWidth:2, borderWidth:2.5 }],
      cur), 0);
  }

  return { render, setTab };
})();

/* ══════════════════════════════════════
   PROFILE
══════════════════════════════════════ */
const ProfilePage = (() => {
  async function render() {
    const u = AppState.user;
    if (!u) return;
    document.getElementById('profileAvatarLg').textContent    = initials(u.first_name+' '+u.last_name);
    document.getElementById('profileDisplayName').textContent = u.first_name+' '+u.last_name;
    document.getElementById('profileDisplayEmail').textContent= u.email;
    document.getElementById('pfFirstName').value  = u.first_name || '';
    document.getElementById('pfLastName').value   = u.last_name  || '';
    document.getElementById('pfEmail').value      = u.email      || '';
    document.getElementById('pfCurrency').value   = u.preferred_currency || 'INR';
    document.getElementById('notifBudgetOverrun').checked  = !!u.notif_budget_overrun;
    document.getElementById('notifBudgetWarning').checked  = !!u.notif_budget_warning;
    document.getElementById('notifMonthlySummary').checked = !!u.notif_monthly_summary;
    document.getElementById('profileJoined').textContent =
      new Date(u.created_at).toLocaleDateString('en-IN',{month:'long',year:'numeric'});
    // Counts
    try {
      const txRes = await API.transactions.getAll({ limit:1 });
      document.getElementById('profileTxCount').textContent = txRes.total || 0;
      const budgets = await API.budgets.getAll();
      document.getElementById('profileBudgetCount').textContent = budgets.length;
      // Net worth
      const cur = u.preferred_currency || 'INR';
      const nw  = await API.reports.netWorth({ year: new Date().getFullYear(), currency: cur });
      const last = nw[new Date().getMonth()];
      document.getElementById('profileNetWorth').textContent = fmtCur(last?.netWorth || 0, cur);
    } catch (_) {}
  }

  async function savePersonal() {
    const fn = document.getElementById('pfFirstName').value.trim();
    const ln = document.getElementById('pfLastName').value.trim();
    const em = document.getElementById('pfEmail').value.trim();
    if (!fn||!ln||!em) { Toast.show('Please fill all fields','error'); return; }
    if (!/^\S+@\S+\.\S+$/.test(em)) { Toast.show('Enter a valid email','error'); return; }
    try {
      const user = await API.auth.updateMe({ firstName:fn, lastName:ln });
      AppState.user = { ...AppState.user, ...user };
      AppState.updateChrome();
      Toast.show('Profile updated','success');
    } catch (err) { Toast.show(err.message,'error'); }
  }

  async function savePreferences() {
    const cur = document.getElementById('pfCurrency').value;
    const body = {
      preferredCurrency:   cur,
      notifBudgetOverrun:  document.getElementById('notifBudgetOverrun').checked,
      notifBudgetWarning:  document.getElementById('notifBudgetWarning').checked,
      notifMonthlySummary: document.getElementById('notifMonthlySummary').checked,
    };
    try {
      const user = await API.auth.updateMe(body);
      AppState.user = { ...AppState.user, ...user };
      AppState.updateChrome();
      Toast.show('Preferences saved','success');
    } catch (err) { Toast.show(err.message,'error'); }
  }

  return { render, savePersonal, savePreferences };
})();

/* ── shared helper ── */
function _set(id, v) { const e = document.getElementById(id); if(e) e.textContent=v; }

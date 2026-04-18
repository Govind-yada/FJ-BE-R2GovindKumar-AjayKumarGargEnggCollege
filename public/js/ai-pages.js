'use strict';

const AiPage = (() => {
  let _initialised = false;

  async function render() {
    if (!_initialised) {
      _initialised = true;
      await _loadHistory();
    }
  }

  async function _loadHistory() {
    try {
      const history = await API.ai.getHistory();
      const el = document.getElementById('aiChatMessages');
      if (!history.length) return; // keep welcome screen

      el.innerHTML = '';
      history.forEach(msg => _appendMessage(msg.role, msg.content, false));
      _scrollToBottom();
    } catch (_) {}
  }

  async function sendMessage() {
    const input = document.getElementById('aiChatInput');
    const question = input.value.trim();
    if (!question) return;

    input.value = '';
    const btn = document.getElementById('aiSendBtn');
    btn.disabled = true;

    // Remove welcome screen if present
    const welcome = document.querySelector('.ai-welcome');
    if (welcome) welcome.remove();

    // Show user message immediately
    _appendMessage('user', question, true);

    // Show typing indicator
    const typingId = _showTyping();

    try {
      const result = await API.ai.chat(question);
      _removeTyping(typingId);
      _appendMessage('assistant', result.answer, true);
    } catch (err) {
      _removeTyping(typingId);
      _appendMessage('assistant', `Sorry, I couldn't process that. ${err.message || 'Please try again.'}`, true);
    } finally {
      btn.disabled = false;
      input.focus();
    }
  }

  function usePrompt(btn) {
    const input = document.getElementById('aiChatInput');
    input.value = btn.textContent.trim();
    input.focus();
    sendMessage();
  }

  async function getInsight() {
    const btn = document.querySelector('[onclick="AiPage.getInsight()"]');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Generating…'; }

    try {
      const result = await API.ai.getInsight();
      const box  = document.getElementById('aiInsightBox');
      const text = document.getElementById('aiInsightText');
      const date = document.getElementById('aiInsightDate');

      text.textContent = result.insight;
      date.textContent = `Generated ${new Date(result.generatedAt).toLocaleString('en-IN')}`;
      box.style.display = 'block';
      box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      Toast.show('Monthly insight generated!', 'success');
    } catch (err) {
      Toast.show(err.message || 'Could not generate insight. Is your OpenAI key set?', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Get Monthly Insight`; }
    }
  }

  async function clearChat() {
    if (!confirm('Clear the entire conversation history?')) return;
    try {
      await API.ai.clearHistory();
      document.getElementById('aiChatMessages').innerHTML = `
        <div class="ai-welcome">
          <div style="text-align:center;padding:40px 20px">
            <div style="font-size:40px;margin-bottom:12px">🤖</div>
            <h3 style="font-family:var(--font-d);font-size:20px;color:var(--text-1);margin-bottom:8px">Finflow AI</h3>
            <p style="font-size:13.5px;color:var(--text-3);max-width:360px;margin:0 auto">Ask me anything about your spending, savings, and budgets.</p>
          </div>
        </div>`;
      Toast.show('Conversation cleared', 'info');
    } catch (err) { Toast.show(err.message, 'error'); }
  }

  function _appendMessage(role, content, animate) {
    const el   = document.getElementById('aiChatMessages');
    const div  = document.createElement('div');
    div.className = `ai-msg ${role}`;
    if (!animate) div.style.animation = 'none';

    const userInitials = initials((AppState.user?.first_name || '') + ' ' + (AppState.user?.last_name || ''));
    const avatarHtml = role === 'user'
      ? `<div class="ai-msg-avatar">${userInitials}</div>`
      : `<div class="ai-msg-avatar">🤖</div>`;

    const time = new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });

    div.innerHTML = `
      ${avatarHtml}
      <div>
        <div class="ai-msg-bubble">${esc(content).replace(/\n/g, '<br>')}</div>
        <div class="ai-msg-time">${time}</div>
      </div>`;
    el.appendChild(div);
    _scrollToBottom();
  }

  function _showTyping() {
    const el  = document.getElementById('aiChatMessages');
    const div = document.createElement('div');
    const id  = 'typing-' + Date.now();
    div.id = id;
    div.className = 'ai-msg assistant';
    div.innerHTML = `
      <div class="ai-msg-avatar">🤖</div>
      <div class="ai-msg-bubble ai-typing"><span></span><span></span><span></span></div>`;
    el.appendChild(div);
    _scrollToBottom();
    return id;
  }

  function _removeTyping(id) {
    document.getElementById(id)?.remove();
  }

  function _scrollToBottom() {
    const el = document.getElementById('aiChatMessages');
    el.scrollTop = el.scrollHeight;
  }

  return { render, sendMessage, usePrompt, getInsight, clearChat };
})();

const ImportPage = (() => {
  let _selectedFile = null;
  let _activeImportId = null;
  let _pollInterval = null;

  function render() {
    loadHistory();
    _selectedFile = null;
    document.getElementById('importUploadBtn').disabled = true;
    document.getElementById('importFileName').style.display = 'none';
  }

  function handleFile(file) {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv','pdf'].includes(ext)) {
      Toast.show('Only CSV and PDF files are supported', 'error'); return;
    }
    if (file.size > 10 * 1024 * 1024) {
      Toast.show('File exceeds 10 MB limit', 'error'); return;
    }
    _selectedFile = file;
    const nameEl = document.getElementById('importFileName');
    nameEl.textContent = `✓ ${file.name} (${(file.size/1024).toFixed(1)} KB)`;
    nameEl.style.display = 'block';
    document.getElementById('importUploadBtn').disabled = false;
    document.getElementById('importDropZone').classList.remove('dragover');
  }

  function handleDrop(e) {
    e.preventDefault();
    handleFile(e.dataTransfer.files[0]);
  }

  async function upload() {
    if (!_selectedFile) { Toast.show('Please select a file first', 'error'); return; }

    const btn = document.getElementById('importUploadBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Uploading…';

    try {
      const fd = new FormData();
      fd.append('statement', _selectedFile);
      const record = await API.ai.importStatement(fd);

      _activeImportId = record.id;
      Toast.show('Import started! Processing in background…', 'success');
      _renderActiveStatus(record);
      _startPolling(record.id);
      loadHistory();

      // Reset UI
      _selectedFile = null;
      document.getElementById('importFileName').style.display = 'none';
    } catch (err) {
      Toast.show(err.message || 'Upload failed', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Upload & Import`;
    }
  }

  function _startPolling(importId) {
    if (_pollInterval) clearInterval(_pollInterval);
    _pollInterval = setInterval(async () => {
      try {
        const status = await API.ai.importStatus(importId);
        _renderActiveStatus(status);
        if (status.status === 'done' || status.status === 'failed') {
          clearInterval(_pollInterval);
          _pollInterval = null;
          loadHistory();
          if (status.status === 'done') {
            Toast.show(`Import complete! ${status.imported_rows} transactions imported, ${status.duplicate_rows} duplicates skipped.`, 'success');
          } else {
            Toast.show(`Import failed: ${status.error_msg}`, 'error');
          }
        }
      } catch (_) { clearInterval(_pollInterval); }
    }, 2000);
  }

  function refreshStatus() {
    if (_activeImportId) {
      API.ai.importStatus(_activeImportId).then(_renderActiveStatus).catch(() => {});
    }
  }

  function _renderActiveStatus(record) {
    const el = document.getElementById('importStatusBox');
    if (!record) return;
    const statusColors = { pending:'pending', processing:'processing', done:'done', failed:'failed' };
    const statusIcons  = { pending:'⏳', processing:'⚙️', done:'✅', failed:'❌' };
    const pct = record.total_rows > 0 ? Math.round((record.imported_rows / record.total_rows) * 100) : 0;

    el.innerHTML = `
      <div class="import-status-card" style="border-color:${record.status==='done'?'var(--green-border)':record.status==='failed'?'var(--red-border)':'var(--border-mid)'}">
        <div class="import-status-header">
          <div class="import-filename" title="${esc(record.filename)}">${statusIcons[record.status]} ${esc(record.filename)}</div>
          <span class="import-badge ${statusColors[record.status]}">${record.status}</span>
        </div>
        <div class="import-stats">
          <div>
            <div class="import-stat-val">${record.total_rows}</div>
            <div>Total rows</div>
          </div>
          <div>
            <div class="import-stat-val" style="color:var(--green)">${record.imported_rows}</div>
            <div>Imported</div>
          </div>
          <div>
            <div class="import-stat-val" style="color:var(--amber)">${record.duplicate_rows}</div>
            <div>Duplicates skipped</div>
          </div>
          <div>
            <div class="import-stat-val" style="color:var(--text-3)">${record.file_type.toUpperCase()}</div>
            <div>Format</div>
          </div>
        </div>
        ${record.status === 'failed' && record.error_msg ? `<div style="margin-top:10px;font-size:12.5px;color:var(--red);background:var(--red-dim);padding:8px 12px;border-radius:var(--r-xs)">${esc(record.error_msg)}</div>` : ''}
        ${record.status !== 'failed' ? `<div class="import-progress-bar"><div class="import-progress-fill" style="width:${record.status==='done'?100:pct}%"></div></div>` : ''}
      </div>`;
  }

  async function loadHistory() {
    try {
      const history = await API.ai.importHistory();
      const el = document.getElementById('importHistoryList');
      if (!history.length) {
        el.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-3);font-size:13.5px">No imports yet</div>`;
        return;
      }
      const statusIcons = { pending:'⏳', processing:'⚙️', done:'✅', failed:'❌' };
      el.innerHTML = history.map(r => `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border-dim)">
          <div style="font-size:20px">${statusIcons[r.status]}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13.5px;font-weight:500;color:var(--text-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.filename)}</div>
            <div style="font-size:12px;color:var(--text-3);margin-top:2px">${new Date(r.created_at).toLocaleString('en-IN')} · ${r.file_type.toUpperCase()}</div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-family:var(--font-m);font-size:13px;color:var(--green)">${r.imported_rows} imported</div>
            <div style="font-size:11.5px;color:var(--text-3)">${r.duplicate_rows} duplicates</div>
          </div>
          <span class="import-badge ${r.status}">${r.status}</span>
        </div>`).join('');
    } catch (err) {
      Toast.show(err.message, 'error');
    }
  }

  return { render, handleFile, handleDrop, upload, refreshStatus, loadHistory };
})();

const AnomalyPage = (() => {

  async function render() {
    await _loadAnomalies();
  }

  async function runDetection() {
    const btn = document.querySelector('[onclick="AnomalyPage.runDetection()"]');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Analysing…'; }
    const listEl = document.getElementById('anomalyList');
    listEl.innerHTML = `<div style="text-align:center;padding:48px;color:var(--text-3)"><div class="spinner" style="width:32px;height:32px;border-width:3px;margin:0 auto 16px"></div><p>Running statistical analysis on your transactions…</p></div>`;

    try {
      const result = await API.ai.detectAnomalies();
      Toast.show(`Detection complete. Found ${result.count} anomal${result.count === 1 ? 'y' : 'ies'}.`, result.count > 0 ? 'warning' : 'success');
      _renderAnomalies(result.data || []);
      _updateCounts(result.data || []);
    } catch (err) {
      Toast.show(err.message || 'Detection failed', 'error');
      listEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Detection failed</h3><p>${esc(err.message || 'Please try again.')}</p></div>`;
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Run Detection`; }
    }
  }

  async function _loadAnomalies() {
    try {
      const result = await API.ai.getAnomalies();
      _renderAnomalies(result);
      _updateCounts(result);
    } catch (_) {}
  }

  function _renderAnomalies(anomalies) {
    const el = document.getElementById('anomalyList');
    if (!anomalies.length) {
      el.innerHTML = `
        <div class="empty-state" style="padding:48px 20px">
          <div class="empty-state-icon">🔍</div>
          <h3>No anomalies detected</h3>
          <p>Click "Run Detection" to analyse your spending patterns.</p>
          <button class="btn btn-primary btn-sm" onclick="AnomalyPage.runDetection()">Run Detection Now</button>
        </div>`;
      return;
    }

    const typeLabels = {
      unusual_amount:   'Unusual Amount',
      high_frequency:   'High Frequency',
      large_transaction:'Large Transaction',
    };
    const typeIcons = {
      unusual_amount:   '💰',
      high_frequency:   '📅',
      large_transaction:'💸',
    };

    el.innerHTML = anomalies.map(a => `
      <div class="anomaly-card" id="anomaly-${a.id}">
        <div class="anomaly-icon ${a.severity}">${typeIcons[a.anomaly_type] || '⚠️'}</div>
        <div class="anomaly-body">
          <div class="anomaly-title">
            <span class="anomaly-type">${typeLabels[a.anomaly_type] || a.anomaly_type}</span>
            <span class="anomaly-severity ${a.severity}">${a.severity}</span>
          </div>
          <div class="anomaly-desc">${esc(a.description)}</div>
          <div class="anomaly-meta">
            ${a.category ? `<span>📊 ${esc(a.category)}</span>` : ''}
            ${a.amount   ? `<span>₹${parseFloat(a.amount).toFixed(2)}</span>` : ''}
            ${a.z_score  ? `<span>Z-score: ${parseFloat(a.z_score).toFixed(2)}</span>` : ''}
            <span>🕐 ${new Date(a.detected_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span>
          </div>
        </div>
        <div class="anomaly-actions">
          <button class="btn btn-ghost btn-sm" onclick="AnomalyPage.dismiss('${a.id}')">Dismiss</button>
        </div>
      </div>`).join('');
  }

  async function dismiss(id) {
    try {
      await API.ai.dismissAnomaly(id);
      const el = document.getElementById(`anomaly-${id}`);
      if (el) {
        el.style.transition = 'opacity .3s,transform .3s';
        el.style.opacity = '0';
        el.style.transform = 'translateX(20px)';
        setTimeout(() => {
          el.remove();
          _loadAnomalies(); // refresh counts
        }, 300);
      }
      Toast.show('Anomaly dismissed', 'info');
    } catch (err) { Toast.show(err.message, 'error'); }
  }

  function _updateCounts(anomalies) {
    const high   = anomalies.filter(a => a.severity === 'high').length;
    const medium = anomalies.filter(a => a.severity === 'medium').length;
    document.getElementById('anomalyCountHigh').textContent  = high;
    document.getElementById('anomalyCountMed').textContent   = medium;
    document.getElementById('anomalyCountTotal').textContent = anomalies.length;
  }

  return { render, runDetection, dismiss };
})();

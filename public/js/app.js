'use strict';

const AppState = {
  user: null,
  updateChrome() {
    const u = this.user;
    if (!u) return;
    const name = (u.first_name || '') + ' ' + (u.last_name || '');
    document.getElementById('sidebarAvatar').textContent    = initials(name);
    document.getElementById('sidebarUserName').textContent  = name.trim() || u.email;
    document.getElementById('sidebarUserEmail').textContent = u.email;
  },
};

const Auth = (() => {
  function showScreen(id) {
    ['loginScreen','registerScreen'].forEach(s => {
      document.getElementById(s).style.display = s===id ? 'flex' : 'none';
    });
    document.getElementById('app').classList.remove('active');
    document.getElementById('app').style.display = 'none';
  }

  async function launchApp(userData) {
    AppState.user = userData;
    API.setToken(userData.accessToken || API.getToken());
    AppState.updateChrome();

    document.getElementById('loginScreen').style.display    = 'none';
    document.getElementById('registerScreen').style.display = 'none';
    const appEl = document.getElementById('app');
    appEl.style.display = 'flex';
    setTimeout(() => appEl.classList.add('active'), 10);

    Nav.onNav(pageId => {
      if (pageId === 'dashboard')    DashboardPage.render();
      if (pageId === 'transactions') TxPage.render();
      if (pageId === 'budgets')      BudgetPage.render();
      if (pageId === 'reports')      ReportsPage.render();
      if (pageId === 'profile')      ProfilePage.render();
      if (pageId === 'ai')           AiPage.render();
      if (pageId === 'import')       ImportPage.render();
      if (pageId === 'anomalies')    AnomalyPage.render();
    });
    Nav.go('dashboard');
    const firstName = userData.first_name || userData.email?.split('@')[0] || 'there';
    Toast.show(`Welcome back, ${firstName}! 🙏`, 'success');
  }

  async function login() {
    const email = document.getElementById('loginEmail').value.trim();
    const pass  = document.getElementById('loginPassword').value;
    const errEl = document.getElementById('loginError');
    errEl.style.display = 'none';
    if (!email || !pass) { errEl.textContent='Please enter email and password.'; errEl.style.display='block'; return; }
    const btn = document.getElementById('loginBtn');
    btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Signing in…';
    try {
      const res = await API.auth.login({ email, password: pass });
      API.setToken(res.accessToken);
      await launchApp(res.user);
    } catch (err) {
      errEl.textContent = err.message || 'Invalid credentials.';
      errEl.style.display = 'block';
    } finally { btn.disabled=false; btn.innerHTML='Sign In'; }
  }

  async function register() {
    const fn   = document.getElementById('regFirstName').value.trim();
    const ln   = document.getElementById('regLastName').value.trim();
    const em   = document.getElementById('regEmail').value.trim();
    const pass = document.getElementById('regPassword').value;
    const cur  = document.getElementById('regCurrency').value;
    const errEl = document.getElementById('registerError');
    errEl.style.display = 'none';
    if (!fn||!ln||!em||!pass) { errEl.textContent='All fields are required.'; errEl.style.display='block'; return; }
    if (pass.length < 8)       { errEl.textContent='Password must be at least 8 characters.'; errEl.style.display='block'; return; }
    const btn = document.getElementById('registerBtn');
    btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Creating account…';
    try {
      const res = await API.auth.register({ firstName:fn, lastName:ln, email:em, password:pass, preferredCurrency:cur });
      API.setToken(res.accessToken);
      await launchApp(res.user);
    } catch (err) {
      errEl.textContent = err.message || 'Registration failed.';
      errEl.style.display = 'block';
    } finally { btn.disabled=false; btn.innerHTML='Create Account'; }
  }

  async function logout() {
    try { await API.auth.logout(); } catch (_) {}
    API.setToken(null);
    AppState.user = null;
    document.getElementById('app').classList.remove('active');
    document.getElementById('app').style.display = 'none';
    showScreen('loginScreen');
    Toast.show('Signed out successfully','info');
  }

  // Handle Google OAuth token in URL
  async function checkOAuthRedirect() {
    const params = new URLSearchParams(window.location.search);
    const token  = params.get('token');
    const err    = params.get('error');
    if (err) { Toast.show('Google sign-in failed. Please try again.','error'); return; }
    if (token) {
      API.setToken(token);
      window.history.replaceState({}, '', '/');
      try {
        const user = await API.auth.getMe();
        await launchApp(user);
      } catch (_) { API.setToken(null); }
    }
  }

  // Try to auto-login from stored token
  async function tryAutoLogin() {
    const token = API.getToken();
    if (!token) return false;
    try {
      const user = await API.auth.getMe();
      await launchApp(user);
      return true;
    } catch (_) {
      API.setToken(null);
      return false;
    }
  }

  return { showScreen, login, register, logout, checkOAuthRedirect, tryAutoLogin };
})();

document.addEventListener('DOMContentLoaded', async () => {
  Modal.init();
  _bindEvents();

  // Token expired → push to login
  window.addEventListener('auth:expired', () => Auth.logout());

  // Show loading while auto-login attempts
  document.getElementById('app').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('registerScreen').style.display = 'none';

  await Auth.checkOAuthRedirect();
  if (!AppState.user) await Auth.tryAutoLogin();
});

function _bindEvents() {
  // Auth screen toggles
  document.getElementById('showRegisterLink')?.addEventListener('click', () => Auth.showScreen('registerScreen'));
  document.getElementById('showLoginLink')?.addEventListener('click',    () => Auth.showScreen('loginScreen'));

  // Forms
  document.getElementById('loginForm')?.addEventListener('submit',    e => { e.preventDefault(); Auth.login(); });
  document.getElementById('registerForm')?.addEventListener('submit', e => { e.preventDefault(); Auth.register(); });

  // Enter key on search
  document.getElementById('txSearch')?.addEventListener('input', e => TxPage.setSearch(e.target.value));
  document.getElementById('txCurrencyFilter')?.addEventListener('change', e => TxPage.setCurrency(e.target.value));

  // Type selector in tx modal
  document.querySelectorAll('.type-opt').forEach(el =>
    el.addEventListener('click', () => TxPage._selectType(el.dataset.type))
  );

  // Receipt upload zone
  const zone = document.getElementById('uploadZone');
  zone?.addEventListener('click',     () => document.getElementById('receiptInput').click());
  zone?.addEventListener('dragover',  e  => { e.preventDefault(); zone.classList.add('dragover'); });
  zone?.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone?.addEventListener('drop',      e  => { e.preventDefault(); zone.classList.remove('dragover'); TxPage.handleFile(e.dataTransfer.files[0]); });
  document.getElementById('receiptInput')?.addEventListener('change', e => TxPage.handleFile(e.target.files[0]));

  // Report controls
  document.getElementById('reportYear')?.addEventListener('change',     () => ReportsPage.render());
  document.getElementById('reportCurrency')?.addEventListener('change', () => ReportsPage.render());

  // Notification bell
  document.getElementById('notifBell')?.addEventListener('click', () => Toast.show('No new notifications','info'));

  // Sign out
  document.getElementById('logoutBtn')?.addEventListener('click', () => Auth.logout());
}

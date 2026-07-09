/**
 * auth.js — centralized auth for CCTV AMC Manager (admin side)
 * Include this on EVERY protected page (dashboard, staff-management, etc.)
 * and on login.html.
 *
 * Relies on httpOnly cookies (admin_token / refresh_token) set by the backend.
 * We can't read httpOnly cookies from JS — so "am I logged in" is determined
 * by calling a protected endpoint and checking for 401, not by reading cookies.
 */

const AUTH_BASE = 'http://localhost:5000/api/admin/auth';
const LOGIN_PAGE = '/page/admin-login.html';

const Auth = {

  async login(mobile, password) {
    const res = await fetch(`${AUTH_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // required so Set-Cookie is stored
      body: JSON.stringify({ mobile, password })
    });

    let data = {};
    try { data = await res.json(); } catch (_) {}

    if (!res.ok) {
      const msg = typeof data === 'string' ? data : (data.error || data.message || 'Login failed');
      throw new Error(msg);
    }
    return data;
  },

  async logout() {
    try {
      await fetch(`${AUTH_BASE}/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (_) {
      // even if the network call fails, still kick the user out client-side
    }
    window.location.href = LOGIN_PAGE;
  },

  async refresh() {
    try {
      const res = await fetch(`${AUTH_BASE}/refresh`, {
        method: 'POST',
        credentials: 'include'
      });
      return res.ok;
    } catch (e) {
      console.warn('Refresh check failed (network):', e.message);
      return false;
    }
  },

  /**
   * Call this at the top of every protected page.
   *
   * admin_token / refresh_token are httpOnly, so we CANNOT read them from
   * document.cookie to check "am I logged in" client-side — that's the whole
   * point of httpOnly (XSS protection). The only reliable check is asking
   * the server. We reuse /api/admin/auth/refresh for this: it only succeeds
   * if a valid, unexpired refresh_token cookie is present, and as a bonus it
   * rotates the access token too. If it fails (401 / network reject), the
   * session is dead and we hard-redirect to admin-login.html.
   */
  async guard() {
    const ok = await this.refresh();
    if (!ok) {
      window.location.href = LOGIN_PAGE;
      return false;
    }
    return true;
  },

  /**
   * Wire up a logout button + confirmation modal that already exist in the page.
   * Pass the element IDs used across your dashboards.
   */
  bindLogoutUI({
    logoutBtnId = 'logoutBtn',
    backdropId = 'logoutBackdrop',
    cancelId = 'cancelLogout',
    confirmId = 'confirmLogout',
    dropdownId = 'profileDropdown'
  } = {}) {
    const logoutBtn = document.getElementById(logoutBtnId);
    const backdrop = document.getElementById(backdropId);
    const cancelBtn = document.getElementById(cancelId);
    const confirmBtn = document.getElementById(confirmId);
    const dropdown = document.getElementById(dropdownId);

    if (logoutBtn && backdrop) {
      logoutBtn.onclick = () => {
        if (dropdown) dropdown.classList.remove('open');
        backdrop.classList.add('open');
      };
    }
    if (cancelBtn && backdrop) {
      cancelBtn.onclick = () => backdrop.classList.remove('open');
    }
    if (confirmBtn) {
      confirmBtn.onclick = () => Auth.logout();
    }
  }
};

window.Auth = Auth;
/**
 * user-auth.js — centralized auth for CCTV AMC Manager (STAFF/ENGINEER side)
 * Mirrors admin-auth.js but talks to /api/staff/auth/** and uses the
 * staff_token / staff_refresh_token httpOnly cookies.
 *
 * Include this on every staff-facing page (inspection-form.html, etc.)
 * and on the staff login page.
 *
 * ASSUMPTION: staff login page lives at /page/login.html — update
 * LOGIN_PAGE below if the actual path differs.
 */

const STAFF_AUTH_BASE = 'http://localhost:5000/api/staff/auth';
const STAFF_LOGIN_PAGE = '/staff-login.html';
const STAFF_PROFILE_KEY = 'amc_staff_profile'; // sessionStorage — display data only, NEVER tokens

const UserAuth = {

  /**
   * Logs in and stores only non-sensitive display fields returned by the
   * backend (empId, employeePrimeId, firstName, lastName, role) in
   * sessionStorage for UI purposes. The actual auth tokens are httpOnly
   * cookies set by the server — this app never sees or stores them.
   */
  async login(mobile, password) {
    const res = await fetch(`${STAFF_AUTH_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ mobile, password })
    });

    let data = {};
    try { data = await res.json(); } catch (_) {}

    if (!res.ok) {
      const msg = typeof data === 'string' ? data : (data.error || data.message || 'Login failed');
      throw new Error(msg);
    }

    const profile = {
      empId: data.empId || '',
      employeePrimeId: data.employeePrimeId || null,
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      role: data.role || ''
    };
    try { sessionStorage.setItem(STAFF_PROFILE_KEY, JSON.stringify(profile)); } catch (_) {}

    return profile;
  },

  async logout() {
    try {
      await fetch(`${STAFF_AUTH_BASE}/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (_) {
      // proceed with client-side cleanup even if the network call fails
    }
    try { sessionStorage.removeItem(STAFF_PROFILE_KEY); } catch (_) {}
    window.location.href = STAFF_LOGIN_PAGE;
  },

  async refresh() {
    try {
      const res = await fetch(`${STAFF_AUTH_BASE}/refresh`, {
        method: 'POST',
        credentials: 'include'
      });
      return res.ok;
    } catch (e) {
      console.warn('Staff refresh check failed (network):', e.message);
      return false;
    }
  },

  /**
   * Call at the top of every protected staff page. staff_token/staff_refresh_token
   * are httpOnly, so the only reliable "am I logged in" check is asking the
   * server via /refresh. Redirects to STAFF_LOGIN_PAGE if the session is dead.
   */
  async guard() {
    const ok = await this.refresh();
    if (!ok) {
      try { sessionStorage.removeItem(STAFF_PROFILE_KEY); } catch (_) {}
      window.location.href = STAFF_LOGIN_PAGE;
      return false;
    }
    return true;
  },

  /**
   * Returns the last-known display profile (name, empId, role) from
   * sessionStorage, or null if unavailable. Use this to populate the
   * header/profile UI instead of hardcoded dummy data.
   */
  getProfile() {
    try {
      const raw = sessionStorage.getItem(STAFF_PROFILE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  },

  /**
   * Wires up a logout menu item / button that already exists in the page.
   * Fires immediately with no confirmation — kept for backward compatibility.
   * Prefer bindLogoutUI() below if you have a confirm modal in the page.
   */
  bindLogout(elementId = 'logoutMenuItem') {
    const el = document.getElementById(elementId);
    if (el) {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        UserAuth.logout();
      });
    }
  },

  /**
   * Wires a logout trigger (menu item/button) to open a confirm modal
   * ("Are you sure?" Yes/No) instead of logging out immediately.
   * The modal markup must already exist in the page with matching IDs.
   */
  bindLogoutUI({
    triggerId = 'logoutMenuItem',
    backdropId = 'logoutBackdrop',
    cancelId = 'cancelLogout',
    confirmId = 'confirmLogout',
    dropdownId = 'userDropdown'
  } = {}) {
    const trigger = document.getElementById(triggerId);
    const backdrop = document.getElementById(backdropId);
    const cancelBtn = document.getElementById(cancelId);
    const confirmBtn = document.getElementById(confirmId);
    const dropdown = document.getElementById(dropdownId);

    if (trigger && backdrop) {
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        if (dropdown) dropdown.classList.add('hidden');
        backdrop.classList.remove('hidden');
        backdrop.classList.add('flex');
      });
    }
    if (cancelBtn && backdrop) {
      cancelBtn.addEventListener('click', () => {
        backdrop.classList.add('hidden');
        backdrop.classList.remove('flex');
      });
    }
    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          backdrop.classList.add('hidden');
          backdrop.classList.remove('flex');
        }
      });
    }
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => UserAuth.logout());
    }
  }
};

window.UserAuth = UserAuth;
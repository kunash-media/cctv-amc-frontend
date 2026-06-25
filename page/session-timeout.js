/* ==========================================================================
   AMC Manager — Session Timeout Watcher
   Include this script on every authenticated page (after login):
   <script src="session-timeout.js"></script>
   ========================================================================== */

(function () {
  'use strict';

  const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes inactivity
  const LOGIN_PAGE_PATH = '/page/login.html'; // adjust to your actual login page path
  const CHECK_INTERVAL_MS = 30 * 1000; // check every 30s

  function getSession() {
    try {
      return JSON.parse(sessionStorage.getItem('amc_session') || 'null');
    } catch (e) {
      return null;
    }
  }

  function setSession(session) {
    try {
      sessionStorage.setItem('amc_session', JSON.stringify(session));
    } catch (e) {}
  }

  function clearSessionAndRedirect() {
    try {
      sessionStorage.removeItem('amc_session');
      sessionStorage.setItem('amc_session_timed_out', 'true');
    } catch (e) {}
    window.location.href = LOGIN_PAGE_PATH;
  }

  // If no session exists at all, this page shouldn't be reachable —
  // redirect to login immediately (basic route guard).
  let session = getSession();
  if (!session) {
    window.location.href = LOGIN_PAGE_PATH;
    return;
  }

  // Stamp initial activity time if missing
  if (!session.last_active_at) {
    session.last_active_at = Date.now();
    setSession(session);
  }

  function touchActivity() {
    session = getSession();
    if (!session) return;
    session.last_active_at = Date.now();
    setSession(session);
  }

  // Activity listeners (throttled via simple flag to avoid excessive writes)
  let activityThrottle = false;
  function onActivity() {
    if (activityThrottle) return;
    activityThrottle = true;
    setTimeout(() => { activityThrottle = false; }, 1000);
    touchActivity();
  }

  ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'].forEach(evt => {
    window.addEventListener(evt, onActivity, { passive: true });
  });

  // Periodic idle check
  setInterval(() => {
    const s = getSession();
    if (!s) {
      clearSessionAndRedirect();
      return;
    }
    const idleFor = Date.now() - (s.last_active_at || 0);
    if (idleFor >= SESSION_TIMEOUT_MS) {
      clearSessionAndRedirect();
    }
  }, CHECK_INTERVAL_MS);

  // Also catch the case where the tab was in background a long time
  // and just regained focus/visibility.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const s = getSession();
      if (!s) { clearSessionAndRedirect(); return; }
      const idleFor = Date.now() - (s.last_active_at || 0);
      if (idleFor >= SESSION_TIMEOUT_MS) {
        clearSessionAndRedirect();
      } else {
        touchActivity();
      }
    }
  });
})();
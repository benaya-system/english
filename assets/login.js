(function () {
  const { qs, qsa, hashPassword, saveSession, toast, setLoading } = window.AppUtils;
  const guardianForm = qs('#guardian-login-form');
  const adminForm = qs('#admin-login-form');
  const tabButtons = qsa('.auth-tab');
  const tabPanels = qsa('[data-auth-panel]');

  function activateTab(name) {
    tabButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.authTab === name));
    tabPanels.forEach((panel) => panel.classList.toggle('hide', panel.dataset.authPanel !== name));
  }

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => activateTab(button.dataset.authTab));
  });

  guardianForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = guardianForm.querySelector('button[type="submit"]');
    try {
      setLoading(button, true);
      const username = qs('[name="username"]', guardianForm).value.trim();
      const password = qs('[name="password"]', guardianForm).value;
      const password_hash = await hashPassword(password);
      const response = await window.AppApi.get('loginGuardian', { username, password_hash });
      saveSession({ token: response.token, role: response.role, guardian: response.guardian, students: response.students });
      window.location.href = 'app.html';
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setLoading(button, false);
    }
  });

  adminForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = adminForm.querySelector('button[type="submit"]');
    try {
      setLoading(button, true);
      const username = qs('[name="username"]', adminForm).value.trim();
      const password = qs('[name="password"]', adminForm).value;
      const password_hash = await hashPassword(password);
      const response = await window.AppApi.get('loginAdmin', { username, password_hash });
      saveSession({ token: response.token, role: response.role, username: response.username });
      window.location.href = 'admin.html';
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setLoading(button, false);
    }
  });

  activateTab('guardian');
})();

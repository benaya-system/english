(function () {
  const U = window.AppUtils;
  const guardianForm = U.qs('#guardian-login-form');
  const adminForm = U.qs('#admin-login-form');
  const tabs = U.qsa('.auth-tab');
  const panels = U.qsa('[data-auth-panel]');

  if (guardianForm) {
    guardianForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = guardianForm.querySelector('button[type="submit"]');
      try {
        U.setLoading(button, true);
        const username = U.qs('[name="username"]', guardianForm).value.trim();
        const password = U.qs('[name="password"]', guardianForm).value;
        const password_hash = await U.hashPassword(password);
        const response = await window.AppApi.get('loginGuardian', { username, password_hash });
        U.saveSession({ token: response.token, role: response.role, guardian: response.guardian });
        U.toast('Acesso liberado.', 'success');
        window.location.href = 'app.html';
      } catch (error) {
        U.toast(error.message, 'error');
      } finally {
        U.setLoading(button, false);
      }
    });
  }

  if (adminForm) {
    adminForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = adminForm.querySelector('button[type="submit"]');
      try {
        U.setLoading(button, true);
        const username = U.qs('[name="username"]', adminForm).value.trim();
        const password = U.qs('[name="password"]', adminForm).value;
        const password_hash = await U.hashPassword(password);
        const response = await window.AppApi.get('loginAdmin', { username, password_hash });
        U.saveSession({ token: response.token, role: response.role, username: response.username });
        U.toast('Acesso administrativo liberado.', 'success');
        window.location.href = 'admin.html';
      } catch (error) {
        U.toast(error.message, 'error');
      } finally {
        U.setLoading(button, false);
      }
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((item) => item.classList.toggle('is-active', item === tab));
      panels.forEach((panel) => panel.classList.toggle('hide', panel.dataset.authPanel !== tab.dataset.authTab));
    });
  });
})();

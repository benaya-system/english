window.AppApi = (() => {
  let callbackCounter = 0;
  let iframeReady = false;
  let pendingPostResolver = null;

  function apiUrl() {
    const url = window.APP_CONFIG && window.APP_CONFIG.API_URL;
    if (!url || /COLE_AQUI/.test(url)) {
      throw new Error('Defina a API_URL em assets/config.js');
    }
    return url;
  }

  function get(action, params = {}) {
    return new Promise((resolve, reject) => {
      const callbackName = `__studentPortalCallback${Date.now()}_${callbackCounter++}`;
      const script = document.createElement('script');
      const search = new URLSearchParams({ action, callback: callbackName });

      Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        if (typeof value === 'object') {
          search.set(key, JSON.stringify(value));
        } else {
          search.set(key, String(value));
        }
      });

      const cleanup = () => {
        delete window[callbackName];
        script.remove();
      };

      window[callbackName] = (response) => {
        cleanup();
        if (!response || response.ok === false) {
          reject(new Error(response && response.error ? response.error : 'Falha na API.'));
          return;
        }
        resolve(response);
      };

      script.onerror = () => {
        cleanup();
        reject(new Error('Não foi possível alcançar a API.'));
      };

      script.src = `${apiUrl()}?${search.toString()}`;
      document.body.appendChild(script);
    });
  }

  function ensureIframe() {
    if (iframeReady) return;
    const iframe = document.createElement('iframe');
    iframe.name = 'student_portal_api_sink';
    iframe.id = 'student_portal_api_sink';
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    window.addEventListener('message', (event) => {
      if (!event.data || !event.data.__studentPortal || !pendingPostResolver) return;
      const { resolve, reject } = pendingPostResolver;
      pendingPostResolver = null;
      if (!event.data.payload || event.data.payload.ok === false) {
        reject(new Error(event.data.payload && event.data.payload.error ? event.data.payload.error : 'Falha ao salvar.'));
        return;
      }
      resolve(event.data.payload);
    });

    iframeReady = true;
  }

  function post(action, payload = {}) {
    ensureIframe();
    return new Promise((resolve, reject) => {
      if (pendingPostResolver) {
        reject(new Error('Já existe uma operação em andamento.'));
        return;
      }

      pendingPostResolver = { resolve, reject };
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = apiUrl();
      form.target = 'student_portal_api_sink';
      form.style.display = 'none';

      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'payload';
      input.value = JSON.stringify(Object.assign({}, payload, { action }));
      form.appendChild(input);
      document.body.appendChild(form);
      form.submit();
      setTimeout(() => form.remove(), 120);

      setTimeout(() => {
        if (!pendingPostResolver) return;
        pendingPostResolver = null;
        reject(new Error('A API demorou demais para responder.'));
      }, 20000);
    });
  }

  return { get, post };
})();

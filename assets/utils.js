window.AppUtils = (() => {
  const SESSION_KEY = 'studentPortalSession';
  const SELECTED_STUDENT_KEY = 'studentPortalSelectedStudent';

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function markdownLite(md) {
    const source = String(md || '').trim();
    if (!source) return '<p class="muted">Sem conteúdo.</p>';

    const lines = source.split(/\r?\n/);
    let html = '';
    let inList = false;

    const closeList = () => {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
    };

    lines.forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line) {
        closeList();
        return;
      }
      if (line.startsWith('## ')) {
        closeList();
        html += `<h3>${escapeHtml(line.replace(/^##\s+/, ''))}</h3>`;
        return;
      }
      if (line.startsWith('# ')) {
        closeList();
        html += `<h2>${escapeHtml(line.replace(/^#\s+/, ''))}</h2>`;
        return;
      }
      if (line.startsWith('- ')) {
        if (!inList) {
          html += '<ul>';
          inList = true;
        }
        html += `<li>${escapeHtml(line.replace(/^-\s+/, ''))}</li>`;
        return;
      }
      closeList();
      html += `<p>${escapeHtml(line).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>`;
    });

    closeList();
    return html;
  }

  function formatDateBR(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Recife' }).format(date);
  }

  function hashPassword(text) {
    return window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text || '')))
      .then((buffer) => Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join(''));
  }

  function saveSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    } catch (error) {
      return null;
    }
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SELECTED_STUDENT_KEY);
  }

  function saveSelectedStudent(studentId) {
    localStorage.setItem(SELECTED_STUDENT_KEY, studentId);
  }

  function getSelectedStudent() {
    return localStorage.getItem(SELECTED_STUDENT_KEY) || '';
  }

  function toast(message, kind = 'info') {
    let box = document.querySelector('.toast-box');
    if (!box) {
      box = document.createElement('div');
      box.className = 'toast-box';
      document.body.appendChild(box);
    }
    const item = document.createElement('div');
    item.className = `toast toast-${kind}`;
    item.textContent = message;
    box.appendChild(item);
    setTimeout(() => item.classList.add('is-visible'), 10);
    setTimeout(() => {
      item.classList.remove('is-visible');
      setTimeout(() => item.remove(), 240);
    }, 3200);
  }

  function setLoading(button, isLoading, label = 'Salvar') {
    if (!button) return;
    button.disabled = Boolean(isLoading);
    button.dataset.originalLabel = button.dataset.originalLabel || button.textContent;
    button.textContent = isLoading ? 'Carregando...' : (button.dataset.originalLabel || label);
  }

  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  }

  return {
    qs,
    qsa,
    escapeHtml,
    markdownLite,
    formatDateBR,
    hashPassword,
    saveSession,
    getSession,
    clearSession,
    saveSelectedStudent,
    getSelectedStudent,
    toast,
    setLoading,
    initials
  };
})();

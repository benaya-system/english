window.AppUtils = (() => {
  const SESSION_KEY = 'studentPortalSession';
  const SELECTED_STUDENT_KEY = 'studentPortalSelectedStudent';
  const CACHE_PREFIX = 'studentPortalCache:';

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
    if (!source) return '<p class="muted">Sem conteúdo no momento.</p>';
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
      if (/^##\s+/.test(line)) {
        closeList();
        html += `<h3>${escapeHtml(line.replace(/^##\s+/, ''))}</h3>`;
        return;
      }
      if (/^#\s+/.test(line)) {
        closeList();
        html += `<h2>${escapeHtml(line.replace(/^#\s+/, ''))}</h2>`;
        return;
      }
      if (/^-\s+/.test(line)) {
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

  function parseMarkdownSections(md) {
    const source = String(md || '').trim();
    if (!source) return [];
    const lines = source.split(/\r?\n/);
    const sections = [];
    let current = { title: 'Introdução', lines: [] };

    lines.forEach((line) => {
      if (/^##\s+/.test(line.trim())) {
        if (current.lines.length || current.title) sections.push(current);
        current = { title: line.trim().replace(/^##\s+/, ''), lines: [] };
        return;
      }
      current.lines.push(line);
    });

    if (current.lines.length || current.title) sections.push(current);

    return sections
      .map((section) => ({
        title: section.title,
        text: section.lines.join('\n').trim(),
        bullets: section.lines
          .map((line) => line.trim())
          .filter((line) => /^-\s+/.test(line))
          .map((line) => line.replace(/^-\s+/, ''))
      }))
      .filter((section) => section.text || section.bullets.length);
  }

  function pickSection(sections, keywords) {
    const lowerKeywords = (keywords || []).map((item) => String(item).toLowerCase());
    return sections.find((section) => {
      const title = String(section.title || '').toLowerCase();
      return lowerKeywords.some((keyword) => title.includes(keyword));
    }) || null;
  }

  function textWithoutBullets(text) {
    return String(text || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !/^- /.test(line))
      .join(' ');
  }

  function bulletListHtml(items) {
    const list = (items || []).filter(Boolean);
    if (!list.length) return '<p class="muted">Sem itens cadastrados.</p>';
    return `<ul>${list.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  }

  function formatDateBR(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Recife' }).format(date);
  }

  function formatShortDateBR(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Recife',
      day: '2-digit',
      month: '2-digit'
    }).format(date);
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

  function cacheKey(key) {
    return `${CACHE_PREFIX}${key}`;
  }

  function saveCache(key, value) {
    localStorage.setItem(cacheKey(key), JSON.stringify({
      saved_at: Date.now(),
      value
    }));
  }

  function readCache(key, maxAgeMs) {
    try {
      const raw = JSON.parse(localStorage.getItem(cacheKey(key)) || 'null');
      if (!raw) return null;
      if (maxAgeMs && Date.now() - Number(raw.saved_at || 0) > maxAgeMs) return null;
      return raw.value;
    } catch (error) {
      return null;
    }
  }

  function clearCacheByPrefix(prefix) {
    const full = cacheKey(prefix);
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(full)) localStorage.removeItem(key);
    });
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
    requestAnimationFrame(() => item.classList.add('is-visible'));
    setTimeout(() => {
      item.classList.remove('is-visible');
      setTimeout(() => item.remove(), 240);
    }, 3200);
  }

  function setLoading(button, isLoading) {
    if (!button) return;
    button.disabled = Boolean(isLoading);
    button.dataset.originalLabel = button.dataset.originalLabel || button.textContent;
    button.textContent = isLoading ? 'Carregando...' : button.dataset.originalLabel;
  }

  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '--';
  }

  async function forceDownload(url, fileName) {
    const absoluteUrl = new URL(url, window.location.href).href;
    const response = await fetch(absoluteUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error('Não foi possível baixar o arquivo.');
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName || absoluteUrl.split('/').pop() || 'arquivo';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  function slugify(text) {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
  }

  return {
    qs,
    qsa,
    escapeHtml,
    markdownLite,
    parseMarkdownSections,
    pickSection,
    textWithoutBullets,
    bulletListHtml,
    formatDateBR,
    formatShortDateBR,
    hashPassword,
    saveSession,
    getSession,
    clearSession,
    saveSelectedStudent,
    getSelectedStudent,
    saveCache,
    readCache,
    clearCacheByPrefix,
    toast,
    setLoading,
    initials,
    forceDownload,
    slugify
  };
})();

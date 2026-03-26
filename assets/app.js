(function () {
  const U = window.AppUtils;
  const config = window.APP_CONFIG || {};
  const session = U.getSession();

  if (!session || session.role !== 'guardian') {
    window.location.href = 'index.html';
    return;
  }

  const state = {
    me: null,
    currentStudentId: '',
    bundle: null,
    refreshHandle: null
  };

  const nodes = {
    logout: U.qs('#logout-button'),
    studentList: U.qs('#student-list'),
    studentName: U.qs('#student-name'),
    studentMeta: U.qs('#student-meta'),
    studentSummary: U.qs('#student-summary'),
    studentAvatar: U.qs('#student-avatar'),
    studentAvatarFallback: U.qs('#student-avatar-fallback'),
    guardianName: U.qs('#guardian-name'),
    tabButtons: U.qsa('.tab-button'),
    tabContents: U.qsa('.tab-content'),
    summaryCard: U.qs('#summary-card'),
    graphWrap: U.qs('#graph-wrap'),
    graphStage: U.qs('#graph-stage'),
    graphExam: U.qs('#graph-exam'),
    graphNote: U.qs('#graph-note'),
    profileRichText: U.qs('#profile-rich-text'),
    activities: U.qs('#activities-list'),
    downloads: U.qs('#downloads-list'),
    packageButton: U.qs('#download-package-button'),
    selectedButton: U.qs('#download-selected-button'),
    allButton: U.qs('#download-all-button'),
    printButton: U.qs('#print-profile-button'),
    printDate: U.qs('#print-date'),
    printName: U.qs('#print-name'),
    printMeta: U.qs('#print-meta'),
    printPhoto: U.qs('#print-photo'),
    printSummary: U.qs('#print-summary'),
    printStage: U.qs('#print-stage'),
    printExam: U.qs('#print-exam'),
    printGraph: U.qs('#print-graph'),
    printNote: U.qs('#print-note'),
    printOverview: U.qs('#print-overview'),
    printStrategies: U.qs('#print-strategies'),
    printFeedback: U.qs('#print-feedback'),
    printAvoid: U.qs('#print-avoid'),
    printHighlights: U.qs('#print-highlights')
  };

  function cacheKeyMe() {
    return `me:${session.token}`;
  }

  function cacheKeyBundle(studentId) {
    return `bundle:${session.token}:${studentId}`;
  }

  async function init() {
    bindEvents();
    revealOnScroll();
    await loadMe();
    startAutoRefresh();
  }

  function bindEvents() {
    nodes.logout.addEventListener('click', async () => {
      try {
        await window.AppApi.get('logout', { token: session.token });
      } catch (error) {
      } finally {
        U.clearSession();
        window.location.href = 'index.html';
      }
    });

    nodes.tabButtons.forEach((button) => {
      button.addEventListener('click', () => activateTab(button.dataset.tab));
    });

    nodes.selectedButton.addEventListener('click', handleSelectedDownloads);
    nodes.packageButton.addEventListener('click', handlePackageDownload);
    nodes.allButton.addEventListener('click', handleAllDownloads);
    nodes.printButton.addEventListener('click', () => window.print());

    window.addEventListener('online', () => {
      if (state.currentStudentId) refreshBundle(state.currentStudentId, true);
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && state.currentStudentId) refreshBundle(state.currentStudentId, true);
    });
  }

  function activateTab(tabName) {
    nodes.tabButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.tab === tabName));
    nodes.tabContents.forEach((panel) => panel.classList.toggle('is-active', panel.id === `tab-${tabName}`));
  }

  async function loadMe() {
    const ttl = Number(config.CACHE_TTL_MS || 180000);
    const cached = U.readCache(cacheKeyMe(), ttl);

    if (cached) {
      state.me = cached;
      renderMe(cached);
    }

    try {
      const fresh = await window.AppApi.get('me', { token: session.token });
      state.me = fresh;
      U.saveCache(cacheKeyMe(), fresh);
      renderMe(fresh);

      const remembered = U.getSelectedStudent();
      const fallback = (fresh.students && fresh.students[0] && fresh.students[0].student_id) || '';
      const nextStudent = (fresh.students || []).some((item) => item.student_id === remembered) ? remembered : fallback;
      if (nextStudent) {
        await selectStudent(nextStudent, false);
      }
    } catch (error) {
      if (!cached) {
        U.toast(error.message, 'error');
        U.clearSession();
        window.location.href = 'index.html';
      }
    }
  }

  function renderMe(me) {
    nodes.guardianName.textContent = me.guardian ? me.guardian.full_name : 'Responsável';
    renderStudentList(me.students || []);
  }

  function renderStudentList(students) {
    nodes.studentList.innerHTML = '';
    students.forEach((student) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'student-option';
      button.dataset.studentId = student.student_id;
      button.innerHTML = `
        <div class="student-thumb">
          ${student.photo_url ? `<img src="${U.escapeHtml(student.photo_url)}" alt="${U.escapeHtml(student.full_name)}">` : `<div class="avatar-fallback">${U.escapeHtml(U.initials(student.full_name))}</div>`}
        </div>
        <div class="student-option-copy">
          <strong>${U.escapeHtml(student.first_name || student.full_name)}</strong>
          <span>${U.escapeHtml(student.school_year || '')}</span>
          <span>${U.escapeHtml(student.stage_label || '')}</span>
        </div>
      `;
      button.addEventListener('click', () => selectStudent(student.student_id, false));
      nodes.studentList.appendChild(button);
    });
  }

  async function selectStudent(studentId, forceRefresh) {
    state.currentStudentId = studentId;
    U.saveSelectedStudent(studentId);
    U.qsa('.student-option', nodes.studentList).forEach((button) => button.classList.toggle('is-active', button.dataset.studentId === studentId));

    const ttl = Number(config.CACHE_TTL_MS || 180000);
    const cached = !forceRefresh ? U.readCache(cacheKeyBundle(studentId), ttl) : null;

    if (cached) {
      state.bundle = cached;
      renderBundle(cached);
      refreshBundle(studentId, false);
      return;
    }

    await refreshBundle(studentId, true);
  }

  async function refreshBundle(studentId, loud) {
    try {
      const bundle = await window.AppApi.get('getStudentBundle', { token: session.token, student_id: studentId });
      state.bundle = bundle;
      U.saveCache(cacheKeyBundle(studentId), bundle);
      renderBundle(bundle);
    } catch (error) {
      if (loud) U.toast(error.message, 'error');
    }
  }

  function renderBundle(bundle) {
    const student = bundle.student;
    nodes.studentName.textContent = student.full_name;
    nodes.studentMeta.textContent = `${student.age || '--'} anos • ${student.school_year || '--'}`;
    nodes.studentSummary.textContent = student.pedagogical_summary || 'Sem resumo cadastrado no momento.';

    if (student.photo_url) {
      nodes.studentAvatar.src = student.photo_url;
      nodes.studentAvatar.alt = student.full_name;
      nodes.studentAvatar.classList.remove('hide');
      nodes.studentAvatarFallback.classList.add('hide');
    } else {
      nodes.studentAvatar.classList.add('hide');
      nodes.studentAvatarFallback.classList.remove('hide');
      nodes.studentAvatarFallback.textContent = U.initials(student.full_name);
    }

    nodes.summaryCard.innerHTML = `
      <div class="section-title">
        <h3>${U.escapeHtml(student.pedagogical_title || 'Perfil pedagógico')}</h3>
        <span class="badge">Síntese</span>
      </div>
      <p class="lead">${U.escapeHtml(student.pedagogical_summary || 'Sem resumo cadastrado.')}</p>
      <div class="button-row no-print">
        <button class="soft-button" type="button" id="print-profile-button-inline">Imprimir perfil</button>
      </div>
    `;
    U.qs('#print-profile-button-inline', nodes.summaryCard).addEventListener('click', () => window.print());

    nodes.profileRichText.innerHTML = `<div class="rich-text">${U.markdownLite(student.pedagogical_profile_md)}</div>`;
    renderGraph(bundle.performance || [], bundle.stage, bundle.recommended_exam);
    renderActivities(bundle.activities || []);
    const downloads = normalizeDownloads(bundle.downloads || []);
    state.bundle.downloads = downloads;
    renderDownloads(downloads);
    renderPrintSheet(bundle);
    activateTab('perfil');
  }

  function buildLineGraphSvg(performance, options = {}) {
    const pointsData = performance || [];
    if (!pointsData.length) {
      return `<p class="muted">Ainda não há registros de desempenho.</p>`;
    }

    const width = options.width || 620;
    const height = options.height || 230;
    const paddingX = 34;
    const paddingY = 28;
    const rangeWidth = width - paddingX * 2;
    const rangeHeight = height - paddingY * 2;
    const points = pointsData.map((item, index) => {
      const x = paddingX + (rangeWidth / Math.max(pointsData.length - 1, 1)) * index;
      const score = Math.max(0, Math.min(100, Number(item.score || 0)));
      const y = height - paddingY - (rangeHeight * score / 100);
      return { x, y, score, date: item.assessment_date || '' };
    });
    const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ');
    const area = `${path} L ${points[points.length - 1].x},${height - paddingY} L ${points[0].x},${height - paddingY} Z`;

    return `
      <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" aria-label="Gráfico de desempenho">
        <defs>
          <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(138, 21, 56, 0.18)"></stop>
            <stop offset="100%" stop-color="rgba(138, 21, 56, 0)"></stop>
          </linearGradient>
        </defs>
        <g stroke="rgba(26, 26, 26, 0.12)" stroke-width="1">
          <line x1="${paddingX}" y1="${height - paddingY}" x2="${width - paddingX}" y2="${height - paddingY}"></line>
          <line x1="${paddingX}" y1="${paddingY}" x2="${paddingX}" y2="${height - paddingY}"></line>
          <line x1="${paddingX}" y1="${paddingY + rangeHeight * 0.25}" x2="${width - paddingX}" y2="${paddingY + rangeHeight * 0.25}"></line>
          <line x1="${paddingX}" y1="${paddingY + rangeHeight * 0.5}" x2="${width - paddingX}" y2="${paddingY + rangeHeight * 0.5}"></line>
          <line x1="${paddingX}" y1="${paddingY + rangeHeight * 0.75}" x2="${width - paddingX}" y2="${paddingY + rangeHeight * 0.75}"></line>
        </g>
        <path d="${area}" fill="url(#lineFill)"></path>
        <path d="${path}" fill="none" stroke="#8a1538" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"></path>
        <g fill="#111827" font-size="11" font-family="system-ui, sans-serif">
          ${points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4.2" fill="#8a1538"></circle>`).join('')}
          ${points.map((point) => `<text x="${point.x}" y="${point.y - 11}" text-anchor="middle">${point.score}</text>`).join('')}
          ${points.map((point) => `<text x="${point.x}" y="${height - 8}" text-anchor="middle">${U.escapeHtml(U.formatShortDateBR(point.date))}</text>`).join('')}
        </g>
      </svg>
    `;
  }

  function renderGraph(performance, stage, exam) {
    nodes.graphWrap.innerHTML = buildLineGraphSvg(performance);
    nodes.graphStage.textContent = stage || '--';
    nodes.graphExam.textContent = exam || '--';
    const latest = performance.length ? performance[performance.length - 1] : null;
    nodes.graphNote.textContent = latest && latest.note ? latest.note : 'Sem observação registrada no momento.';
  }

  function renderActivities(items) {
    if (!items.length) {
      nodes.activities.innerHTML = '<p class="muted">Nenhuma atividade cadastrada nesta etapa.</p>';
      return;
    }

    nodes.activities.innerHTML = items.map((item) => `
      <article class="activity-card">
        <div class="activity-head">
          <div>
            <h4>${U.escapeHtml(item.title || '')}</h4>
            <p>${U.escapeHtml(item.description || '')}</p>
          </div>
          <span class="badge">${U.escapeHtml(item.status || 'Pendente')}</span>
        </div>
        <div class="activity-meta">
          <span>${U.escapeHtml(item.week_label || '')}</span>
          <span>${U.escapeHtml(U.formatDateBR(item.due_date) || '')}</span>
          ${item.link_url ? `<a href="${U.escapeHtml(item.link_url)}" target="_blank" rel="noopener">Abrir apoio</a>` : ''}
        </div>
      </article>
    `).join('');
  }

  function normalizeDownloads(items) {
    return items.map((item) => {
      const fileName = item.file_name || '';
      const type = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
      return Object.assign({}, item, {
        file_name: fileName,
        file_type: type,
        file_url: item.file_url || (fileName ? `${config.DOWNLOAD_BASE_PATH || 'download/'}${fileName}` : ''),
        pack_zip_url: item.pack_zip_url || ''
      });
    });
  }

  function renderDownloads(items) {
    if (!items.length) {
      nodes.downloads.innerHTML = '<p class="muted">Nenhum arquivo disponível no momento.</p>';
      nodes.packageButton.classList.add('hide');
      return;
    }

    nodes.downloads.innerHTML = items.map((item, index) => `
      <article class="download-card">
        <label class="download-select">
          <input type="checkbox" data-download-index="${index}">
          <span></span>
        </label>
        <div class="download-body">
          <div class="download-top">
            <div>
              <h4>${U.escapeHtml(item.title || item.file_name || 'Arquivo')}</h4>
              <p>${U.escapeHtml(item.description || '')}</p>
            </div>
            <span class="file-tag">${U.escapeHtml((item.file_type || 'arquivo').toUpperCase())}</span>
          </div>
          <div class="download-meta">
            <span>${U.escapeHtml(item.file_name || '')}</span>
            <button class="soft-button" type="button" data-download-url="${U.escapeHtml(item.file_url)}" data-download-name="${U.escapeHtml(item.file_name || 'arquivo')}">Baixar</button>
          </div>
        </div>
      </article>
    `).join('');

    U.qsa('[data-download-url]', nodes.downloads).forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          await U.forceDownload(button.dataset.downloadUrl, button.dataset.downloadName);
        } catch (error) {
          U.toast(error.message, 'error');
        }
      });
    });

    const firstPack = items.find((item) => item.pack_zip_url);
    if (firstPack) {
      nodes.packageButton.classList.remove('hide');
      nodes.packageButton.dataset.url = firstPack.pack_zip_url;
      nodes.packageButton.dataset.name = firstPack.pack_name || 'materiais.zip';
    } else {
      nodes.packageButton.classList.add('hide');
      delete nodes.packageButton.dataset.url;
      delete nodes.packageButton.dataset.name;
    }
  }

  async function handleSelectedDownloads() {
    const indexes = U.qsa('input[type="checkbox"][data-download-index]:checked', nodes.downloads).map((input) => Number(input.dataset.downloadIndex));
    if (!indexes.length) {
      U.toast('Selecione pelo menos um arquivo.', 'info');
      return;
    }
    const items = indexes.map((index) => state.bundle.downloads[index]).filter(Boolean);
    await sequentialDownload(items);
  }

  async function handleAllDownloads() {
    const items = (state.bundle && state.bundle.downloads) || [];
    if (!items.length) {
      U.toast('Nenhum arquivo disponível.', 'info');
      return;
    }
    await sequentialDownload(items);
  }

  async function sequentialDownload(items) {
    for (const item of items) {
      try {
        await U.forceDownload(item.file_url, item.file_name || 'arquivo');
        await new Promise((resolve) => setTimeout(resolve, 250));
      } catch (error) {
        U.toast(`Falha em ${item.file_name || 'arquivo'}.`, 'error');
      }
    }
  }

  async function handlePackageDownload() {
    const url = nodes.packageButton.dataset.url;
    const name = nodes.packageButton.dataset.name || 'materiais.zip';
    if (!url) {
      U.toast('Nenhum pacote ZIP foi configurado.', 'info');
      return;
    }
    try {
      await U.forceDownload(url, name.endsWith('.zip') ? name : `${name}.zip`);
    } catch (error) {
      U.toast(error.message, 'error');
    }
  }


  function compactText(text, maxChars) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    if (!maxChars || clean.length <= maxChars) return clean;
    const cut = clean.slice(0, maxChars - 1);
    const lastSpace = cut.lastIndexOf(' ');
    const safe = lastSpace > 30 ? cut.slice(0, lastSpace) : cut;
    return `${safe.trim()}…`;
  }

  function compactSentences(text, maxSentences, maxChars) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    const sentences = clean.match(/[^.!?]+[.!?]?/g) || [clean];
    const picked = sentences.slice(0, Math.max(1, maxSentences || 2)).join(' ').trim();
    return compactText(picked, maxChars || 320);
  }

  function normalizeList(items, maxItems, maxCharsEach) {
    return (items || [])
      .filter(Boolean)
      .map((item) => compactText(item, maxCharsEach || 120))
      .slice(0, Math.max(0, maxItems || 4));
  }

  function buildHighlightTags(items) {
    const safe = normalizeList(items, 5, 90);
    if (!safe.length) return '<p class="muted">Sem destaques cadastrados.</p>';
    return safe.map((item) => `<span class="print-highlight-tag">${U.escapeHtml(item)}</span>`).join('');
  }

  function renderPrintSheet(bundle) {
    const student = bundle.student || {};
    const sections = U.parseMarkdownSections(student.pedagogical_profile_md || '');
    const overview = U.pickSection(sections, ['visão geral', 'visao geral', 'hipótese central', 'hipotese central']);
    const strategies = U.pickSection(sections, ['estratégias', 'estrategias', 'funcionar melhor', 'como aprende']);
    const feedback = U.pickSection(sections, ['feedback']);
    const avoid = U.pickSection(sections, ['evitar', 'cuidados']);
    const highlights = String(student.print_highlights_md || '')
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/^-\s*/, ''))
      .filter(Boolean);
    const performance = bundle.performance || [];
    const latest = performance.length ? performance[performance.length - 1] : null;
    const summaryText = compactText(student.pedagogical_summary || '', 175);
    const overviewText = compactSentences(U.textWithoutBullets(overview ? overview.text : student.pedagogical_summary || ''), 2, 320);
    const strategyItems = normalizeList((strategies && strategies.bullets.length ? strategies.bullets : highlights.slice(0, 4)), 4, 92);
    const feedbackItems = normalizeList((feedback && feedback.bullets.length ? feedback.bullets : highlights.slice(0, 3)), 3, 88);
    const avoidItems = normalizeList((avoid && avoid.bullets.length ? avoid.bullets : highlights.slice(-3)), 3, 88);
    const highlightItems = normalizeList(highlights, 5, 86);

    nodes.printDate.textContent = new Intl.DateTimeFormat('pt-BR').format(new Date());
    nodes.printName.textContent = student.full_name || '';
    nodes.printMeta.textContent = `${student.age || '--'} anos • ${student.school_year || '--'}`;
    nodes.printSummary.textContent = summaryText || 'Sem síntese pedagógica cadastrada.';
    nodes.printStage.textContent = bundle.stage || student.stage_label || '--';
    nodes.printExam.textContent = bundle.recommended_exam || student.recommended_exam || '--';
    nodes.printNote.textContent = compactText(latest && latest.note ? latest.note : 'Sem observação adicional registrada nesta etapa.', 150);
    nodes.printGraph.innerHTML = buildLineGraphSvg(performance, { width: 500, height: 132 });
    nodes.printOverview.textContent = overviewText || summaryText || 'Sem leitura pedagógica cadastrada.';
    nodes.printStrategies.innerHTML = U.bulletListHtml(strategyItems);
    nodes.printFeedback.innerHTML = U.bulletListHtml(feedbackItems);
    nodes.printAvoid.innerHTML = U.bulletListHtml(avoidItems);
    nodes.printHighlights.innerHTML = buildHighlightTags(highlightItems);

    nodes.printPhoto.innerHTML = student.photo_url
      ? `<img src="${U.escapeHtml(student.photo_url)}" alt="${U.escapeHtml(student.full_name || 'Aluno')}">`
      : `<div class="print-photo-fallback">${U.escapeHtml(U.initials(student.full_name || ''))}</div>`;
  }

  function revealOnScroll() {
    const items = U.qsa('.reveal');
    if (!('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add('is-visible');
      });
    }, { threshold: 0.12 });
    items.forEach((item) => observer.observe(item));
  }

  function startAutoRefresh() {
    const interval = Number(config.REFRESH_INTERVAL_MS || 90000);
    if (state.refreshHandle) clearInterval(state.refreshHandle);
    state.refreshHandle = setInterval(() => {
      if (document.hidden || !state.currentStudentId) return;
      refreshBundle(state.currentStudentId, false);
    }, interval);
  }

  init();
})();

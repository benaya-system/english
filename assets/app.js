(function () {
  const U = window.AppUtils;
  const session = U.getSession();
  if (!session || session.role !== 'guardian') {
    window.location.href = 'index.html';
    return;
  }

  const state = {
    me: null,
    currentStudentId: '',
    bundle: null
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
    printButton: U.qs('#print-profile-button'),
    printName: U.qs('#print-name'),
    printMeta: U.qs('#print-meta'),
    printPhoto: U.qs('#print-photo'),
    printSummary: U.qs('#print-summary'),
    printStage: U.qs('#print-stage'),
    printExam: U.qs('#print-exam'),
    printGraph: U.qs('#print-graph'),
    printNote: U.qs('#print-note'),
    printOverview: U.qs('#print-overview'),
    printLearn: U.qs('#print-learn'),
    printFeedback: U.qs('#print-feedback'),
    printAvoid: U.qs('#print-avoid')
  };

  async function init() {
    bindEvents();
    revealOnScroll();
    try {
      const me = await window.AppApi.get('me', { token: session.token });
      state.me = me;
      nodes.guardianName.textContent = me.guardian ? me.guardian.full_name : 'Responsável';
      renderStudentList(me.students || []);
      const remembered = U.getSelectedStudent();
      const fallback = (me.students && me.students[0] && me.students[0].student_id) || '';
      const nextStudent = (me.students || []).some((item) => item.student_id === remembered) ? remembered : fallback;
      if (nextStudent) {
        await selectStudent(nextStudent);
      }
    } catch (error) {
      U.toast(error.message, 'error');
      U.clearSession();
      window.location.href = 'index.html';
    }
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
    nodes.printButton.addEventListener('click', () => window.print());
  }

  function activateTab(tabName) {
    nodes.tabButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.tab === tabName));
    nodes.tabContents.forEach((panel) => panel.classList.toggle('is-active', panel.id === `tab-${tabName}`));
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
        <div>
          <strong>${U.escapeHtml(student.first_name || student.full_name)}</strong>
          <span>${U.escapeHtml(student.school_year || '')}</span>
          <span>${U.escapeHtml(student.stage_label || '')}</span>
        </div>
      `;
      button.addEventListener('click', () => selectStudent(student.student_id));
      nodes.studentList.appendChild(button);
    });
  }

  async function selectStudent(studentId) {
    state.currentStudentId = studentId;
    U.saveSelectedStudent(studentId);
    U.qsa('.student-option', nodes.studentList).forEach((button) => button.classList.toggle('is-active', button.dataset.studentId === studentId));
    try {
      const bundle = await window.AppApi.get('getStudentBundle', { token: session.token, student_id: studentId });
      state.bundle = bundle;
      renderBundle(bundle);
    } catch (error) {
      U.toast(error.message, 'error');
    }
  }

  function renderBundle(bundle) {
    const student = bundle.student;
    nodes.studentName.textContent = student.full_name;
    nodes.studentMeta.textContent = `${student.age || '--'} anos | ${student.school_year || '--'}`;
    nodes.studentSummary.textContent = student.pedagogical_summary || 'Sem resumo pedagógico no momento.';

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
        <span class="badge">Visão geral</span>
      </div>
      <p>${U.escapeHtml(student.pedagogical_summary || 'Sem resumo cadastrado.')}</p>
      <div class="button-row no-print">
        <button class="soft-button" type="button" id="print-profile-button-inline">Imprimir perfil</button>
      </div>
    `;
    U.qs('#print-profile-button-inline', nodes.summaryCard).addEventListener('click', () => window.print());

    nodes.profileRichText.innerHTML = `<div class="rich-text">${U.markdownLite(student.pedagogical_profile_md)}</div>`;
    renderGraph(bundle.performance || [], bundle.stage, bundle.recommended_exam);
    renderActivities(bundle.activities || []);
    renderDownloads(normalizeDownloads(bundle.downloads || [], student.student_id));
    renderPrintSheet(bundle);
    activateTab('perfil');
  }

  function buildLineGraphSvg(performance, options = {}) {
    const pointsData = performance || [];
    if (!pointsData.length) {
      return `<div class="muted">Ainda não há registros de desempenho.</div>`;
    }

    const width = options.width || 560;
    const height = options.height || 220;
    const padding = options.padding || 28;
    const lineColor = options.lineColor || '#72aee5';
    const textColor = options.textColor || '#46729a';
    const gridColor = options.gridColor || '#dce9f5';
    const gradientId = options.gradientId || `lineFill${Date.now()}`;
    const labelMode = options.labelMode || 'full';

    const points = pointsData.map((item, index) => {
      const x = padding + ((width - padding * 2) / Math.max(pointsData.length - 1, 1)) * index;
      const y = height - padding - ((height - padding * 2) * (Number(item.score || 0) / 100));
      return { x, y, score: item.score, date: item.assessment_date || '', label: item.label || '' };
    });

    const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ');
    const circles = points.map((point) => `
      <circle cx="${point.x}" cy="${point.y}" r="4.5"></circle>
      <text x="${point.x}" y="${point.y - 10}" font-size="10" text-anchor="middle">${U.escapeHtml(String(point.score))}</text>
    `).join('');
    const labels = points.map((point) => {
      const label = labelMode === 'short' ? U.formatDateBR(point.date).slice(0, 5) : U.formatDateBR(point.date).slice(0, 5);
      return `<text x="${point.x}" y="${height - 8}" font-size="10" text-anchor="middle">${U.escapeHtml(label || '')}</text>`;
    }).join('');

    return `
      <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" aria-label="Gráfico de desempenho">
        <defs>
          <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(114, 174, 229, 0.22)"></stop>
            <stop offset="100%" stop-color="rgba(114, 174, 229, 0)"></stop>
          </linearGradient>
        </defs>
        <g stroke="${gridColor}" stroke-width="1">
          <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}"></line>
          <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}"></line>
          <line x1="${padding}" y1="${padding + 32}" x2="${width - padding}" y2="${padding + 32}"></line>
          <line x1="${padding}" y1="${padding + 68}" x2="${width - padding}" y2="${padding + 68}"></line>
          <line x1="${padding}" y1="${padding + 104}" x2="${width - padding}" y2="${padding + 104}"></line>
        </g>
        <path d="${path} L ${width - padding},${height - padding} L ${padding},${height - padding} Z" fill="url(#${gradientId})"></path>
        <path d="${path}" fill="none" stroke="${lineColor}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>
        <g fill="${textColor}" font-family="Inter, sans-serif">${circles}${labels}</g>
      </svg>
    `;
  }

  function renderGraph(performance, stage, exam) {
    if (!performance.length) {
      nodes.graphWrap.innerHTML = '<p class="muted">Ainda não há registros de desempenho.</p>';
      nodes.graphStage.textContent = stage || '--';
      nodes.graphExam.textContent = exam || '--';
      nodes.graphNote.textContent = 'Sem observação registrada.';
      return;
    }

    nodes.graphWrap.innerHTML = buildLineGraphSvg(performance, { width: 560, height: 220, padding: 28, gradientId: 'screenLineFill' });
    const latest = performance[performance.length - 1];
    nodes.graphStage.textContent = stage || latest.stage_label || '--';
    nodes.graphExam.textContent = exam || latest.recommended_exam || '--';
    nodes.graphNote.textContent = latest.note || 'Sem observação registrada.';
  }

  function renderActivities(activities) {
    if (!activities.length) {
      nodes.activities.innerHTML = '<p class="muted">Nenhuma atividade cadastrada para esta semana.</p>';
      return;
    }
    nodes.activities.innerHTML = activities.map((item) => `
      <article class="activity-item reveal">
        <div class="item-header">
          <div>
            <h4 class="item-title">${U.escapeHtml(item.title)}</h4>
            <span class="muted">${U.escapeHtml(item.week_label || '')} • entrega ${U.escapeHtml(U.formatDateBR(item.due_date) || item.due_date || '--')}</span>
          </div>
          <span class="badge">${U.escapeHtml(item.status || 'Pendente')}</span>
        </div>
        <p>${U.escapeHtml(item.description || '')}</p>
        ${item.link_url ? `<div class="button-row"><a class="ghost-button" href="${U.escapeHtml(item.link_url)}" target="_blank" rel="noopener">Abrir apoio</a></div>` : ''}
      </article>
    `).join('');
    revealOnScroll();
  }

  function getConfiguredDefaultDownloads(studentId) {
    const defaults = Array.isArray(window.APP_CONFIG && window.APP_CONFIG.DEFAULT_DOWNLOADS) ? window.APP_CONFIG.DEFAULT_DOWNLOADS : [];
    return defaults.map((item, index) => ({
      download_id: `DEFAULT-${studentId || 'STU'}-${index + 1}`,
      student_id: studentId || '',
      title: item.title || `Arquivo ${index + 1}`,
      description: item.description || '',
      file_name: item.file_name || '',
      file_url: item.file_url || '',
      pack_name: item.pack_name || 'Pacote inicial',
      pack_zip_url: item.pack_zip_url || '',
      active: 'true'
    }));
  }

  function resolveDownloadUrl(item) {
    const rawUrl = String(item.file_url || '').trim();
    if (rawUrl && !/SEU-USUARIO|COLE_AQUI/i.test(rawUrl)) return rawUrl;
    const fileName = String(item.file_name || '').trim();
    if (!fileName) return '';
    const basePath = (window.APP_CONFIG && window.APP_CONFIG.DOWNLOAD_BASE_PATH) || 'download/';
    return `${basePath.replace(/\/?$/, '/')}${fileName}`;
  }

  function normalizeDownloads(downloads, studentId) {
    const validCustom = (downloads || [])
      .filter((item) => String(item.active || 'true') !== 'false')
      .filter((item) => !/SEU-USUARIO|COLE_AQUI/i.test(String(item.file_url || '')))
      .map((item) => Object.assign({}, item, { file_url: resolveDownloadUrl(item) }))
      .filter((item) => item.file_url);

    const merged = [...validCustom, ...getConfiguredDefaultDownloads(studentId)];
    const seen = new Set();
    return merged.filter((item) => {
      const key = `${item.file_name || ''}|${item.file_url || ''}`.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function renderDownloads(downloads) {
    state.bundle.downloads = downloads;
    if (!downloads.length) {
      nodes.downloads.innerHTML = '<p class="muted">Nenhum arquivo publicado ainda.</p>';
      nodes.packageButton.classList.add('hide');
      return;
    }

    nodes.downloads.innerHTML = downloads.map((item) => `
      <article class="download-item reveal">
        <label class="download-check">
          <input type="checkbox" class="download-selector" value="${U.escapeHtml(item.download_id)}">
          <div class="download-body">
            <div class="item-header">
              <div>
                <h4 class="item-title">${U.escapeHtml(item.title)}</h4>
                <span class="muted">${U.escapeHtml(item.file_name || '')}</span>
              </div>
              <span class="badge">${U.escapeHtml(item.pack_name || 'Arquivo')}</span>
            </div>
            <p>${U.escapeHtml(item.description || '')}</p>
            <div class="button-row">
              <a class="ghost-button" href="${U.escapeHtml(item.file_url)}" target="_blank" rel="noopener">Baixar arquivo</a>
            </div>
          </div>
        </label>
      </article>
    `).join('');

    const packageUrls = downloads.map((item) => String(item.pack_zip_url || '').trim()).filter(Boolean);
    nodes.packageButton.classList.toggle('hide', !packageUrls.length);
    nodes.packageButton.dataset.packageUrls = JSON.stringify([...new Set(packageUrls)]);
    revealOnScroll();
  }

  function handleSelectedDownloads() {
    const selectedIds = U.qsa('.download-selector:checked', nodes.downloads).map((input) => input.value);
    if (!selectedIds.length) {
      U.toast('Selecione pelo menos um arquivo.', 'error');
      return;
    }
    const downloads = (state.bundle && state.bundle.downloads) || [];
    downloads.filter((item) => selectedIds.includes(item.download_id)).forEach((item, index) => {
      setTimeout(() => window.open(item.file_url, '_blank', 'noopener'), index * 180);
    });
  }

  function handlePackageDownload() {
    const urls = JSON.parse(nodes.packageButton.dataset.packageUrls || '[]').filter(Boolean);
    if (!urls.length) {
      U.toast('Nenhum pacote ZIP foi cadastrado.', 'error');
      return;
    }
    window.open(urls[0], '_blank', 'noopener');
  }

  function normalizeText(text) {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function parseProfileSections(md) {
    const lines = String(md || '').split(/\r?\n/);
    const sections = [];
    let current = null;

    function pushCurrent() {
      if (!current) return;
      sections.push({
        title: current.title,
        paragraphs: current.paragraphs.filter(Boolean),
        bullets: current.bullets.filter(Boolean)
      });
    }

    lines.forEach((raw) => {
      const line = String(raw || '').trim();
      if (!line) return;
      if (line.startsWith('## ')) {
        pushCurrent();
        current = { title: line.replace(/^##\s+/, ''), paragraphs: [], bullets: [] };
        return;
      }
      if (!current) {
        current = { title: 'Resumo', paragraphs: [], bullets: [] };
      }
      if (line.startsWith('- ')) {
        current.bullets.push(line.replace(/^-\s+/, '').replace(/^“|”$/g, ''));
      } else {
        current.paragraphs.push(line);
      }
    });
    pushCurrent();
    return sections;
  }

  function findSection(sections, keywords) {
    const lookups = keywords.map(normalizeText);
    return sections.find((section) => lookups.some((key) => normalizeText(section.title).includes(key)));
  }

  function firstSentences(text, count) {
    const chunks = String(text || '').match(/[^.!?]+[.!?]?/g) || [];
    return chunks.slice(0, count).join(' ').trim() || String(text || '').trim();
  }

  function listHtml(items, maxItems) {
    const safe = (items || []).filter(Boolean).slice(0, maxItems);
    if (!safe.length) return '<p class="print-empty">Sem observações cadastradas.</p>';
    return `<ul class="print-list">${safe.map((item) => `<li>${U.escapeHtml(item)}</li>`).join('')}</ul>`;
  }

  function extractSectionBullets(section, fallbackItems, maxItems) {
    const list = (section && section.bullets && section.bullets.length) ? section.bullets : (fallbackItems || []);
    return listHtml(list, maxItems);
  }

  function renderPrintSheet(bundle) {
    const student = bundle.student;
    const performance = bundle.performance || [];
    const sections = parseProfileSections(student.pedagogical_profile_md);
    const overview = findSection(sections, ['visao geral']) || { paragraphs: [student.pedagogical_summary || ''] };
    const learn = findSection(sections, ['o que tende a funcionar melhor', 'marcas principais']);
    const feedback = findSection(sections, ['estilo de feedback ideal']);
    const avoid = findSection(sections, ['o que evitar']);
    const highlightBullets = parseProfileSections(`## Destaques
${student.print_highlights_md || ''}`)[0]?.bullets || [];
    const latest = performance.length ? performance[performance.length - 1] : null;

    nodes.printName.textContent = student.full_name;
    nodes.printMeta.textContent = `${student.age || '--'} anos | ${student.school_year || '--'}`;
    nodes.printSummary.textContent = student.pedagogical_summary || '';
    nodes.printStage.textContent = bundle.stage || student.stage_label || '--';
    nodes.printExam.textContent = bundle.recommended_exam || student.recommended_exam || '--';
    nodes.printOverview.textContent = firstSentences((overview.paragraphs || []).join(' '), 2) || student.pedagogical_summary || '';
    nodes.printLearn.innerHTML = extractSectionBullets(learn, highlightBullets, 5);
    nodes.printFeedback.innerHTML = extractSectionBullets(feedback, highlightBullets.slice(0, 4), 4);
    nodes.printAvoid.innerHTML = extractSectionBullets(avoid, highlightBullets.slice(2), 4);
    nodes.printNote.textContent = latest && latest.note ? latest.note : 'Sem observação registrada.';

    if (student.photo_url) {
      nodes.printPhoto.innerHTML = `<img src="${U.escapeHtml(student.photo_url)}" alt="${U.escapeHtml(student.full_name)}">`;
    } else {
      nodes.printPhoto.innerHTML = `<div class="avatar-fallback">${U.escapeHtml(U.initials(student.full_name))}</div>`;
    }

    nodes.printGraph.innerHTML = performance.length
      ? buildLineGraphSvg(performance, { width: 300, height: 150, padding: 22, gradientId: 'printLineFill', labelMode: 'short' })
      : '<p class="print-empty">Ainda não há registros de desempenho.</p>';
  }

  function revealOnScroll() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });

    U.qsa('.reveal').forEach((el) => {
      if (!el.classList.contains('is-visible')) observer.observe(el);
    });
  }

  init();
})();

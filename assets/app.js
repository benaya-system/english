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
    printHighlights: U.qs('#print-highlights'),
    printStage: U.qs('#print-stage'),
    printExam: U.qs('#print-exam')
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
        <span class="badge">Resumo do momento</span>
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
    renderDownloads(bundle.downloads || []);
    renderPrintSheet(bundle);
    activateTab('perfil');
  }

  function renderGraph(performance, stage, exam) {
    if (!performance.length) {
      nodes.graphWrap.innerHTML = '<p class="muted">Ainda não há registros de desempenho.</p>';
      nodes.graphStage.textContent = stage || '--';
      nodes.graphExam.textContent = exam || '--';
      nodes.graphNote.textContent = 'Sem observação registrada.';
      return;
    }

    const width = 560;
    const height = 220;
    const padding = 28;
    const scores = performance.map((item) => Number(item.score || 0));
    const points = performance.map((item, index) => {
      const x = padding + ((width - padding * 2) / Math.max(performance.length - 1, 1)) * index;
      const y = height - padding - ((height - padding * 2) * (Number(item.score || 0) / 100));
      return { x, y, label: item.label, score: item.score, date: item.assessment_date };
    });

    const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ');
    const circles = points.map((point) => `
      <circle cx="${point.x}" cy="${point.y}" r="5"></circle>
      <text x="${point.x}" y="${point.y - 12}" font-size="11" text-anchor="middle">${U.escapeHtml(String(point.score))}</text>
    `).join('');
    const labels = points.map((point) => `
      <text x="${point.x}" y="${height - 8}" font-size="11" text-anchor="middle">${U.escapeHtml(U.formatDateBR(point.date).slice(0, 5))}</text>
    `).join('');

    nodes.graphWrap.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" width="100%" height="220" aria-label="Gráfico de desempenho">
        <defs>
          <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(114, 174, 229, 0.22)"></stop>
            <stop offset="100%" stop-color="rgba(114, 174, 229, 0)"></stop>
          </linearGradient>
        </defs>
        <g stroke="#dce9f5" stroke-width="1">
          <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}"></line>
          <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}"></line>
          <line x1="${padding}" y1="${padding + 40}" x2="${width - padding}" y2="${padding + 40}"></line>
          <line x1="${padding}" y1="${padding + 82}" x2="${width - padding}" y2="${padding + 82}"></line>
          <line x1="${padding}" y1="${padding + 124}" x2="${width - padding}" y2="${padding + 124}"></line>
        </g>
        <path d="${path} L ${width - padding},${height - padding} L ${padding},${height - padding} Z" fill="url(#lineFill)"></path>
        <path d="${path}" fill="none" stroke="#72aee5" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>
        <g fill="#46729a" font-family="Inter, sans-serif">${circles}${labels}</g>
      </svg>
    `;

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

  function renderDownloads(downloads) {
    if (!downloads.length) {
      nodes.downloads.innerHTML = '<p class="muted">Nenhum arquivo publicado ainda.</p>';
      nodes.packageButton.classList.add('hide');
      return;
    }
    nodes.downloads.innerHTML = downloads.map((item) => `
      <article class="download-item reveal">
        <label class="download-check">
          <input type="checkbox" class="download-selector" value="${U.escapeHtml(item.download_id)}">
          <div>
            <div class="item-header">
              <div>
                <h4 class="item-title">${U.escapeHtml(item.title)}</h4>
                <span class="muted">${U.escapeHtml(item.file_name || '')}</span>
              </div>
              <span class="badge">${U.escapeHtml(item.pack_name || 'Arquivo avulso')}</span>
            </div>
            <p>${U.escapeHtml(item.description || '')}</p>
            <div class="button-row">
              <a class="ghost-button" href="${U.escapeHtml(item.file_url)}" target="_blank" rel="noopener">Baixar arquivo</a>
            </div>
          </div>
        </label>
      </article>
    `).join('');

    const hasPackage = downloads.some((item) => item.pack_zip_url);
    nodes.packageButton.classList.toggle('hide', !hasPackage);
    nodes.packageButton.dataset.packageUrls = JSON.stringify(downloads.filter((item) => item.pack_zip_url).map((item) => item.pack_zip_url));
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

  function renderPrintSheet(bundle) {
    const student = bundle.student;
    nodes.printName.textContent = student.full_name;
    nodes.printMeta.textContent = `${student.age || '--'} anos | ${student.school_year || '--'} | ${bundle.stage || student.stage_label || '--'}`;
    nodes.printSummary.textContent = student.pedagogical_summary || '';
    nodes.printHighlights.innerHTML = U.markdownLite(student.print_highlights_md || 'Sem destaques cadastrados.');
    nodes.printStage.textContent = bundle.stage || student.stage_label || '--';
    nodes.printExam.textContent = bundle.recommended_exam || student.recommended_exam || '--';
    if (student.photo_url) {
      nodes.printPhoto.innerHTML = `<img src="${U.escapeHtml(student.photo_url)}" alt="${U.escapeHtml(student.full_name)}">`;
    } else {
      nodes.printPhoto.innerHTML = `<div class="avatar-fallback">${U.escapeHtml(U.initials(student.full_name))}</div>`;
    }
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

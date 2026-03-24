(function () {
  const U = window.AppUtils;
  const session = U.getSession();
  const adminForm = U.qs('#admin-login-inline');
  const loginGate = U.qs('#admin-login-gate');
  const adminApp = U.qs('#admin-app');

  const state = {
    token: session && session.token,
    currentStudentId: '',
    students: []
  };

  let loginBound = false;

  const nodes = {
    logout: U.qs('#admin-logout-button'),
    studentList: U.qs('#admin-student-list'),
    studentSearch: U.qs('#student-search'),
    studentForm: U.qs('#student-form'),
    performanceForm: U.qs('#performance-form'),
    activityForm: U.qs('#activity-form'),
    downloadForm: U.qs('#download-form'),
    selfGuardian: U.qs('#self_guardian'),
    guardianFields: U.qs('#guardian-fields'),
    credentialsBox: U.qs('#generated-credentials'),
    credentialsText: U.qs('#generated-credentials-text'),
    performanceList: U.qs('#performance-list'),
    activitiesList: U.qs('#admin-activities-list'),
    downloadsList: U.qs('#admin-downloads-list')
  };

  function bindCommon() {
    nodes.logout.addEventListener('click', async () => {
      try {
        if (state.token) await window.AppApi.get('logout', { token: state.token });
      } catch (error) {
      } finally {
        U.clearSession();
        window.location.href = 'index.html';
      }
    });

    nodes.selfGuardian.addEventListener('change', () => {
      nodes.guardianFields.classList.toggle('hide', nodes.selfGuardian.checked);
    });

    nodes.studentSearch.addEventListener('input', () => renderStudentButtons(nodes.studentSearch.value.trim().toLowerCase()));

    nodes.studentForm.addEventListener('submit', saveStudent);
    nodes.performanceForm.addEventListener('submit', savePerformance);
    nodes.activityForm.addEventListener('submit', saveActivity);
    nodes.downloadForm.addEventListener('submit', saveDownload);
  }

  async function bootstrap() {
    bindCommon();
    bindLoginGate();
    if (!session || session.role !== 'admin') {
      loginGate.classList.remove('hide');
      adminApp.classList.add('hide');
      return;
    }
    state.token = session.token;
    await loadAdmin();
  }

  function bindLoginGate() {
    if (loginBound) return;
    loginBound = true;
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
        state.token = response.token;
        await loadAdmin();
      } catch (error) {
        U.toast(error.message, 'error');
      } finally {
        U.setLoading(button, false);
      }
    });
  }

  async function loadAdmin() {
    loginGate.classList.add('hide');
    adminApp.classList.remove('hide');
    try {
      const response = await window.AppApi.get('adminListStudents', { token: state.token });
      state.students = response.students || [];
      renderStudentButtons('');
      if (state.students[0]) await loadStudent(state.students[0].student_id);
    } catch (error) {
      U.toast(error.message, 'error');
      U.clearSession();
      loginGate.classList.remove('hide');
      adminApp.classList.add('hide');
    }
  }

  function renderStudentButtons(filterText) {
    const list = state.students.filter((item) => {
      const hay = `${item.full_name} ${item.school_year} ${item.guardian_name}`.toLowerCase();
      return !filterText || hay.includes(filterText);
    });
    nodes.studentList.innerHTML = list.map((item) => `
      <button type="button" class="student-mini-button ${item.student_id === state.currentStudentId ? 'is-active' : ''}" data-student-id="${U.escapeHtml(item.student_id)}">
        <strong>${U.escapeHtml(item.full_name)}</strong>
        <div class="muted">${U.escapeHtml(item.school_year || '')} • ${U.escapeHtml(item.guardian_name || 'Sem responsável')}</div>
      </button>
    `).join('');
    U.qsa('.student-mini-button', nodes.studentList).forEach((button) => {
      button.addEventListener('click', () => loadStudent(button.dataset.studentId));
    });
  }

  async function loadStudent(studentId) {
    state.currentStudentId = studentId;
    renderStudentButtons(nodes.studentSearch.value.trim().toLowerCase());
    try {
      const response = await window.AppApi.get('adminGetStudent', { token: state.token, student_id: studentId });
      fillStudentForm(response.student, response.guardian);
      renderMiniLists(response);
    } catch (error) {
      U.toast(error.message, 'error');
    }
  }

  function fillStudentForm(student, guardian) {
    const form = nodes.studentForm;
    form.student_id.value = student.student_id || '';
    form.full_name.value = student.full_name || '';
    form.age.value = student.age || '';
    form.school_year.value = student.school_year || '';
    form.year_of_enrollment.value = student.year_of_enrollment || '2026';
    form.photo_url.value = student.photo_url || '';
    form.email.value = student.email || '';
    form.phone.value = student.phone || '';
    form.self_guardian.checked = Boolean(student.self_guardian);
    form.pedagogical_title.value = student.pedagogical_title || 'Perfil pedagógico';
    form.pedagogical_summary.value = student.pedagogical_summary || '';
    form.pedagogical_profile_md.value = student.pedagogical_profile_md || '';
    form.print_highlights_md.value = student.print_highlights_md || '';
    form.stage_label.value = student.stage_label || '';
    form.recommended_exam.value = student.recommended_exam || '';

    form.guardian_id.value = guardian && guardian.guardian_id ? guardian.guardian_id : '';
    form.guardian_full_name.value = guardian && guardian.full_name ? guardian.full_name : '';
    form.guardian_email.value = guardian && guardian.email ? guardian.email : '';
    form.guardian_phone.value = guardian && guardian.phone ? guardian.phone : '';
    form.guardian_relationship.value = guardian && guardian.relationship ? guardian.relationship : '';
    nodes.guardianFields.classList.toggle('hide', form.self_guardian.checked);
    nodes.credentialsBox.classList.add('hide');
  }

  function renderMiniLists(response) {
    const perf = response.performance || [];
    nodes.performanceList.innerHTML = perf.length ? perf.slice().reverse().map((item) => `
      <div class="mini-item">
        <strong>${U.escapeHtml(item.label || 'Registro')}</strong>
        <div class="muted">${U.escapeHtml(U.formatDateBR(item.assessment_date))} • score ${U.escapeHtml(String(item.score || ''))}</div>
        <div class="muted">${U.escapeHtml(item.stage_label || '')} • ${U.escapeHtml(item.recommended_exam || '')}</div>
      </div>
    `).join('') : '<p class="muted">Sem registros de desempenho.</p>';

    const acts = response.activities || [];
    nodes.activitiesList.innerHTML = acts.length ? acts.slice().reverse().map((item) => `
      <div class="mini-item">
        <strong>${U.escapeHtml(item.title || '')}</strong>
        <div class="muted">${U.escapeHtml(item.week_label || '')} • ${U.escapeHtml(U.formatDateBR(item.due_date))}</div>
      </div>
    `).join('') : '<p class="muted">Sem atividades.</p>';

    const dwls = response.downloads || [];
    nodes.downloadsList.innerHTML = dwls.length ? dwls.slice().reverse().map((item) => `
      <div class="mini-item">
        <strong>${U.escapeHtml(item.title || '')}</strong>
        <div class="muted">${U.escapeHtml(item.file_name || '')}</div>
      </div>
    `).join('') : '<p class="muted">Sem downloads.</p>';
  }

  async function saveStudent(event) {
    event.preventDefault();
    const form = nodes.studentForm;
    const button = form.querySelector('button[type="submit"]');
    const student = {
      student_id: form.student_id.value.trim(),
      full_name: form.full_name.value.trim(),
      age: form.age.value.trim(),
      school_year: form.school_year.value.trim(),
      year_of_enrollment: form.year_of_enrollment.value.trim(),
      photo_url: form.photo_url.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      self_guardian: form.self_guardian.checked,
      guardian_id: form.guardian_id.value.trim(),
      pedagogical_title: form.pedagogical_title.value.trim(),
      pedagogical_summary: form.pedagogical_summary.value.trim(),
      pedagogical_profile_md: form.pedagogical_profile_md.value.trim(),
      print_highlights_md: form.print_highlights_md.value.trim(),
      stage_label: form.stage_label.value.trim(),
      recommended_exam: form.recommended_exam.value.trim()
    };
    const guardian = {
      guardian_id: form.guardian_id.value.trim(),
      full_name: form.guardian_full_name.value.trim(),
      email: form.guardian_email.value.trim(),
      phone: form.guardian_phone.value.trim(),
      relationship: form.guardian_relationship.value.trim()
    };

    try {
      U.setLoading(button, true);
      const response = await window.AppApi.post('adminSaveStudent', { token: state.token, student, guardian });
      nodes.studentForm.student_id.value = response.student_id;
      nodes.studentForm.guardian_id.value = response.guardian_id || '';
      if (response.credentials) {
        nodes.credentialsBox.classList.remove('hide');
        nodes.credentialsText.textContent = `Usuário: ${response.credentials.username} | Senha: ${response.credentials.password}`;
      } else {
        nodes.credentialsBox.classList.add('hide');
      }
      U.toast('Cadastro salvo.', 'success');
      await loadAdmin();
      await loadStudent(response.student_id);
    } catch (error) {
      U.toast(error.message, 'error');
    } finally {
      U.setLoading(button, false);
    }
  }

  async function savePerformance(event) {
    event.preventDefault();
    const form = nodes.performanceForm;
    const button = form.querySelector('button[type="submit"]');
    try {
      U.setLoading(button, true);
      await window.AppApi.post('adminAddPerformance', {
        token: state.token,
        entry: {
          student_id: nodes.studentForm.student_id.value.trim(),
          assessment_date: form.assessment_date.value,
          score: form.score.value.trim(),
          label: form.label.value.trim(),
          stage_label: form.stage_label_perf.value.trim(),
          recommended_exam: form.recommended_exam_perf.value.trim(),
          note: form.note.value.trim()
        }
      });
      form.reset();
      U.toast('Desempenho salvo.', 'success');
      await loadStudent(nodes.studentForm.student_id.value.trim());
    } catch (error) {
      U.toast(error.message, 'error');
    } finally {
      U.setLoading(button, false);
    }
  }

  async function saveActivity(event) {
    event.preventDefault();
    const form = nodes.activityForm;
    const button = form.querySelector('button[type="submit"]');
    try {
      U.setLoading(button, true);
      await window.AppApi.post('adminSaveActivity', {
        token: state.token,
        activity: {
          student_id: nodes.studentForm.student_id.value.trim(),
          week_label: form.week_label.value.trim(),
          due_date: form.due_date.value,
          title: form.title.value.trim(),
          description: form.description.value.trim(),
          status: form.status.value.trim(),
          link_url: form.link_url.value.trim()
        }
      });
      form.reset();
      U.toast('Atividade salva.', 'success');
      await loadStudent(nodes.studentForm.student_id.value.trim());
    } catch (error) {
      U.toast(error.message, 'error');
    } finally {
      U.setLoading(button, false);
    }
  }

  async function saveDownload(event) {
    event.preventDefault();
    const form = nodes.downloadForm;
    const button = form.querySelector('button[type="submit"]');
    try {
      U.setLoading(button, true);
      await window.AppApi.post('adminSaveDownload', {
        token: state.token,
        download: {
          student_id: nodes.studentForm.student_id.value.trim(),
          title: form.title.value.trim(),
          description: form.description.value.trim(),
          file_name: form.file_name.value.trim(),
          file_url: form.file_url.value.trim(),
          pack_name: form.pack_name.value.trim(),
          pack_zip_url: form.pack_zip_url.value.trim()
        }
      });
      form.reset();
      U.toast('Download salvo.', 'success');
      await loadStudent(nodes.studentForm.student_id.value.trim());
    } catch (error) {
      U.toast(error.message, 'error');
    } finally {
      U.setLoading(button, false);
    }
  }

  bootstrap();
})();

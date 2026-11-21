(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const permissions = [['students', 'Alunos'], ['lessons', 'Lições'], ['reports', 'Relatórios']];
  let currentUser = null;
  let users = [];
  let lessons = [];
  let feedback = [];
  let tab = 'overview';
  let selectedStudent = '';
  let selectedProgress = [];
  let portal;
  const isAdmin = () => currentUser?.role === 'admin';
  const can = (permission) => isAdmin() || currentUser?.permissions?.includes(permission);

  async function loadData() {
    const [userData, lessonData] = await Promise.all([
      schoolApi('/api/users'), schoolApi('/api/lessons')
    ]);
    users = userData.users || [];
    lessons = lessonData.lessons || [];
    if (isAdmin()) {
      const feedbackData = await schoolApi('/api/feedback');
      feedback = feedbackData.feedback || [];
    }
  }

  function showTeacherPortal(user) {
    currentUser = user;
    portal = $('#teacher-portal') || document.createElement('main');
    portal.id = 'teacher-portal';
    portal.className = 'teacher-portal';
    if (!portal.isConnected) document.body.appendChild(portal);
    $('.login-page').hidden = true;
    $('#student-dashboard').hidden = true;
    portal.hidden = false;
    document.body.dataset.view = 'teacher';
    document.body.dataset.role = 'professor';
    document.title = 'Gestão escolar | English School';
    portal.innerHTML = '<p class="teacher-empty">Carregando dados do servidor…</p>';
    loadData().then(render).catch((error) => {
      portal.innerHTML = `<div class="teacher-empty">Não foi possível carregar os dados: ${esc(error.message)} <button class="teacher-button" data-action="retry">Tentar novamente</button></div>`;
      $('[data-action="retry"]', portal)?.addEventListener('click', showTeacherPortal.bind(null, user));
    });
  }
  window.showSchoolTeacherPortal = showTeacherPortal;

  function render() {
    const students = users.filter((user) => user.role === 'student');
    const teachers = users.filter((user) => user.role === 'teacher');
    const tabs = [['overview', 'Visão geral', true], ['students', 'Alunos', can('students') || can('lessons') || can('reports')], ['lessons', 'Lições', can('lessons')], ['reports', 'Resultados', can('reports')], ['feedback', `Feedbacks${feedback.length ? ` (${feedback.length})` : ''}`, isAdmin()], ['team', 'Professores', isAdmin()], ['profile', 'Meu perfil', true]].filter((item) => item[2]);
    if (!tabs.some((item) => item[0] === tab)) tab = 'overview';
    portal.innerHTML = `<div class="teacher-shell"><header class="teacher-header"><div class="teacher-brand"><span class="teacher-brand-mark">E</span><span>English School <small>· Gestão escolar</small></span></div><div class="teacher-header-actions"><span class="teacher-user-chip">${esc(currentUser.name)}</span><button class="teacher-button secondary" data-action="logout">Sair</button></div></header>
      <nav class="teacher-tabs" aria-label="Seções do painel">${tabs.map(([key, label]) => `<button class="teacher-tab ${tab === key ? 'active' : ''}" data-tab="${key}">${label}</button>`).join('')}</nav><section class="teacher-view" id="teacher-view">${view(students, teachers)}</section><p class="teacher-storage-note">Os dados são salvos no banco de dados do servidor.</p></div>`;
    portal.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => { tab = button.dataset.tab; render(); }));
    $('[data-action="logout"]', portal)?.addEventListener('click', logout);
    $('[data-action="refresh"]', portal)?.addEventListener('click', () => showTeacherPortal(currentUser));
    $('[data-action="create-student"]', portal)?.addEventListener('submit', createStudent);
    $('[data-action="create-teacher"]', portal)?.addEventListener('submit', createTeacher);
    portal.querySelectorAll('[data-action="assign-lesson"]').forEach((form) => form.addEventListener('submit', assignLesson));
    portal.querySelectorAll('[data-action="delete-user"]').forEach((button) => button.addEventListener('click', () => deleteUser(button.dataset.id)));
    portal.querySelectorAll('[data-action="edit-password"]').forEach((button) => button.addEventListener('click', () => editPassword(button.dataset.id)));
    portal.querySelectorAll('[data-action="toggle-lesson"]').forEach((input) => input.addEventListener('change', () => toggleLesson(input.dataset.id, input.checked)));
    portal.querySelectorAll('[data-action="delete-lesson"]').forEach((button) => button.addEventListener('click', () => deleteLesson(button.dataset.id, button.dataset.title)));
    portal.querySelectorAll('[data-action="lesson-history"]').forEach((button) => button.addEventListener('click', () => {
      const details = button.closest('.teacher-lesson')?.querySelector('.teacher-lesson-history');
      if (details) details.hidden = !details.hidden;
    }));
    $('[data-action="open-student"]', portal)?.addEventListener('change', async (event) => { selectedStudent = event.target.value; selectedProgress = selectedStudent ? ((await schoolApi(`/api/progress?userId=${encodeURIComponent(selectedStudent)}`)).progress || []) : []; render(); });
    portal.querySelectorAll('[data-action="permissions"]').forEach((form) => form.addEventListener('submit', savePermissions));
    $('[data-action="save-profile"]', portal)?.addEventListener('submit', saveProfile);

  }

  function view(students, teachers) {
    const completed = lessons.filter((lesson) => lesson.completed).length;
    if (tab === 'overview') return `<div class="teacher-page-intro"><div><p class="teacher-kicker">PAINEL DE GESTÃO</p><h1 class="teacher-heading">Olá, ${esc(currentUser.name)}</h1><p class="teacher-muted">Acompanhe alunos, lições e resultados.</p></div></div><div class="teacher-grid teacher-stats-grid"><article class="teacher-card teacher-stat-card"><p class="teacher-muted">Alunos cadastrados</p><strong class="teacher-stat">${students.length}</strong></article><article class="teacher-card teacher-stat-card"><p class="teacher-muted">Lições cadastradas</p><strong class="teacher-stat">${lessons.length}</strong></article><article class="teacher-card teacher-stat-card"><p class="teacher-muted">Lições concluídas</p><strong class="teacher-stat">${completed}</strong></article></div><article class="teacher-card"><h2>Dados atualizados</h2><p class="teacher-muted">As alterações feitas aqui são compartilhadas pelo servidor.</p><button class="teacher-button" data-action="refresh">Atualizar dados</button></article>`;
    if (tab === 'students') return `<div class="teacher-page-intro"><div><p class="teacher-kicker">CADASTROS E ACOMPANHAMENTO</p><h1 class="teacher-heading">Alunos</h1></div></div>${can('students') ? `<article class="teacher-card"><h2>Criar perfil de aluno</h2><form class="teacher-form" data-action="create-student"><label class="teacher-field">Nome completo<input name="name" required maxlength="100"></label><label class="teacher-field">CPF<input name="cpf" inputmode="numeric" maxlength="14"></label><label class="teacher-field">Usuário<input name="username" required minlength="3" maxlength="40"></label><label class="teacher-field">Senha inicial<input name="password" type="password" required minlength="8" maxlength="80"></label><label class="teacher-field">Nível<select name="level"><option>Iniciante</option><option>Básico</option><option>Intermediário</option><option>Avançado</option></select></label><button class="teacher-button" type="submit">Criar aluno</button></form></article>` : ''}<article class="teacher-card"><h2>Alunos cadastrados (${students.length})</h2>${students.length ? `<div class="teacher-table-wrap"><table class="teacher-table"><thead><tr><th>Aluno</th><th>Usuário</th><th>Nível</th><th>Ações</th></tr></thead><tbody>${students.map((student) => `<tr><td>${esc(student.name)}</td><td>${esc(student.username)}</td><td>${esc(student.level || '—')}</td><td><button class="teacher-button secondary" data-action="edit-password" data-id="${esc(student.id)}">Alterar senha</button> ${can('students') ? `<button class="teacher-button danger" data-action="delete-user" data-id="${esc(student.id)}">Excluir</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="teacher-empty">Nenhum aluno cadastrado.</p>'}</article>`;
    if (tab === 'lessons') return `<div class="teacher-page-intro"><div><p class="teacher-kicker">CONTEÚDO E DISTRIBUIÇÃO</p><h1 class="teacher-heading">Lições</h1></div></div>${can('lessons') ? `<article class="teacher-card"><h2>Atribuir lição</h2><form class="teacher-form" data-action="assign-lesson"><label class="teacher-field teacher-field-full">Alunos<select name="studentIds" multiple required size="5">${students.map((student) => `<option value="${esc(student.id)}">${esc(student.name)} · ${esc(student.username)}</option>`).join('')}</select><small>Use Ctrl (Windows) ou Command (Mac) para selecionar mais de um.</small></label><label class="teacher-field">Título<input name="title" required maxlength="120"></label><label class="teacher-field teacher-field-full">Conteúdo da lição<textarea name="description" rows="5" maxlength="12000" placeholder="Cole explicações, exemplos, vocabulário e frases em inglês. Esse conteúdo será usado para criar exercícios personalizados para cada aluno."></textarea><small class="teacher-field-full">Quanto mais conteúdo em inglês for incluído, mais exercícios poderão ser criados.</small></label><label class="teacher-field">Nível<select name="level"><option>Iniciante</option><option>Básico</option><option>Intermediário</option><option>Avançado</option></select></label><label class="teacher-field">Dia de desbloqueio<select name="releaseDay">${['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'].map((day, index) => `<option value="${index}">${day}</option>`).join('')}</select></label><label class="teacher-field teacher-field-full">Arquivos<input name="attachments" type="file" multiple></label><button class="teacher-button" type="submit">Atribuir lição</button></form></article>` : ''}<article class="teacher-card"><h2>Lições (${lessons.length})</h2>${lessons.map((lesson) => `<div class="teacher-lesson"><strong>${esc(lesson.title)}</strong> · ${esc(lesson.student_name || '')} <div class="teacher-lesson-files">${(lesson.attachments || []).map((file) => '<a href="/api/files/' + encodeURIComponent(file.id) + '/content" target="_blank" rel="noopener">' + esc(file.name) + '</a>').join(' · ') || 'Sem arquivo anexado'}</div> ${can('lessons') ? `<label><input type="checkbox" data-action="toggle-lesson" data-id="${esc(lesson.id)}" ${lesson.completed ? 'checked' : ''}> Concluída</label> <button type="button" class="teacher-button danger" data-action="delete-lesson" data-id="${esc(lesson.id)}" data-title="${esc(lesson.title)}">Apagar lição</button> <button type="button" class="teacher-button secondary teacher-more-button" title="Ver histórico" aria-label="Ver histórico" data-action="lesson-history">⋯</button>` : ''}<div class="teacher-lesson-history" hidden><strong>Histórico da lição</strong>${(lesson.history || []).map((entry) => '<p>' + (entry.action === 'created' ? 'Lição atribuída' : 'Lição apagada') + ' por <b>' + esc(entry.actor_name) + '</b> em ' + esc(new Date(entry.created_at).toLocaleString('pt-BR')) + '</p>').join('') || '<p>Sem registros de histórico.</p>'}</div></div>`).join('') || '<p class="teacher-empty">Nenhuma lição cadastrada.</p>'}</article>`;
    if (tab === 'reports') {
      const studentLessons = lessons.filter((lesson) => lesson.student_id === selectedStudent);
      const completed = studentLessons.filter((lesson) => lesson.completed).length;
      const total = studentLessons.length;
      const completion = total ? Math.round((completed / total) * 100) : 0;
      const progressValues = selectedProgress.filter((item) => Number.isFinite(Number(item.value))).map((item) => Number(item.value));
      const avg = progressValues.length ? Math.round(progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length) : 0;
      const skillNames = ['reading', 'listening', 'speaking', 'writing', 'grammar', 'vocabulary'];
      const skillLabels = { reading: 'Reading', listening: 'Listening', speaking: 'Speaking', writing: 'Writing', grammar: 'Grammar', vocabulary: 'Vocabulary' };
      const skillBars = skillNames.map((skill) => {
        const values = selectedProgress.filter((item) => item.event.toLowerCase().includes(skill)).map((item) => Number(item.value)).filter(Number.isFinite);
        const score = values.length ? Math.max(0, Math.min(100, Math.round(values.reduce((sum, value) => sum + value, 0) / values.length))) : 0;
        return `<div class="teacher-progress-row"><div><span>${skillLabels[skill]}</span><strong>${score}%</strong></div><div class="teacher-progress-track"><span style="width:${score}%"></span></div></div>`;
      }).join('');

      const dated = selectedProgress.filter((item) => Number.isFinite(Number(item.value))).slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      const monthly = {};
      dated.forEach((item) => {
        const date = new Date(item.created_at);
        if (Number.isNaN(date.getTime())) return;
        const key = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        if (!monthly[key]) monthly[key] = [];
        monthly[key].push(Number(item.value));
      });
      const trend = Object.entries(monthly).slice(-6).map(([label, values]) => {
        const value = Math.round(values.reduce((sum, n) => sum + n, 0) / values.length);
        return `<div class="teacher-chart-col"><div class="teacher-chart-value">${value}%</div><div class="teacher-chart-bar" style="height:${Math.max(8, value)}%"></div><small>${esc(label)}</small></div>`;
      }).join('') || '<p class="teacher-empty">Ainda não há histórico suficiente para a evolução.</p>';

      const level = students.find((student) => student.id === selectedStudent)?.level || '—';
      const difficultSkills = skillNames.map((skill) => {
        const values = selectedProgress.filter((item) => item.event.toLowerCase().includes(skill)).map((item) => Number(item.value)).filter(Number.isFinite);
        return { skill, score: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null };
      }).filter((item) => item.score !== null).sort((a, b) => a.score - b.score);
      const weak = difficultSkills[0];
      const strong = difficultSkills[difficultSkills.length - 1];
      const recommendation = weak && weak.score < 70
        ? `Reforçar ${skillLabels[weak.skill]} antes de avançar. ${skillLabels[weak.skill]} está em ${weak.score}%.`
        : strong ? `Desempenho equilibrado. ${skillLabels[strong.skill]} é o principal ponto forte, com ${strong.score}%.` : 'Registre atividades de progresso para gerar recomendações.';

      return `<div class="teacher-page-intro"><div><p class="teacher-kicker">ACOMPANHAMENTO PEDAGÓGICO</p><h1 class="teacher-heading">Resultados dos alunos</h1><p class="teacher-muted">Visão consolidada de evolução, habilidades e conclusão das atividades.</p></div></div>
      <article class="teacher-card"><label class="teacher-field">Aluno<select data-action="open-student"><option value="">Selecione um aluno</option>${students.map((s) => `<option value="${esc(s.id)}" ${selectedStudent === s.id ? 'selected' : ''}>${esc(s.name)} · ${esc(s.level || '—')}</option>`).join('')}</select></label></article>
      ${selectedStudent ? `
      <div class="teacher-grid teacher-stats-grid">
        <article class="teacher-card teacher-stat-card"><p class="teacher-muted">Nível</p><strong class="teacher-stat teacher-stat-small">${esc(level)}</strong></article>
        <article class="teacher-card teacher-stat-card"><p class="teacher-muted">Lições</p><strong class="teacher-stat">${total}</strong></article>
        <article class="teacher-card teacher-stat-card"><p class="teacher-muted">Concluídas</p><strong class="teacher-stat">${completed}</strong></article>
        <article class="teacher-card teacher-stat-card"><p class="teacher-muted">Conclusão</p><strong class="teacher-stat">${completion}%</strong></article>
        <article class="teacher-card teacher-stat-card"><p class="teacher-muted">Média</p><strong class="teacher-stat">${avg}%</strong></article>
      </div>
      <article class="teacher-card"><h2>Evolução do desempenho</h2><div class="teacher-chart" aria-label="Evolução mensal">${trend}</div></article>
      <article class="teacher-card"><h2>Domínio por habilidade</h2>${skillBars}</article>
      <article class="teacher-card"><h2>Recomendação pedagógica</h2><p class="teacher-recommendation">${esc(recommendation)}</p></article>
      <article class="teacher-card"><h2>Histórico de lições</h2>${studentLessons.map((lesson) => `<div class="teacher-lesson">${esc(lesson.title)} — ${lesson.completed ? 'Concluída' : 'Pendente'}</div>`).join('') || '<p class="teacher-empty">Nenhuma lição atribuída.</p>'}</article>` : '<article class="teacher-card"><p>Escolha um aluno para consultar o progresso.</p></article>'}`;
    }
    if (tab === 'feedback') return `<div class="teacher-page-intro"><div><h1 class="teacher-heading">Feedbacks</h1></div><button class="teacher-button secondary" data-action="refresh">Atualizar</button></div>${feedback.map((item) => `<article class="teacher-card"><strong>${esc(item.name || item.username)}</strong><p>${esc(item.message)}</p><small>${esc(item.created_at)}</small></article>`).join('') || '<p class="teacher-empty">Ainda não há feedbacks.</p>'}`;
    if (tab === 'team') return `<div class="teacher-page-intro"><div><h1 class="teacher-heading">Professores</h1></div></div>${isAdmin() ? `<article class="teacher-card"><h2>Criar perfil de professor</h2><form class="teacher-form" data-action="create-teacher"><label class="teacher-field">Nome<input name="name" required></label><label class="teacher-field">Usuário<input name="username" required minlength="3"></label><label class="teacher-field">Senha<input name="password" type="password" required minlength="8"></label>${permissions.map(([key, label]) => `<label><input type="checkbox" name="permissions" value="${key}"> ${label}</label>`).join('')}<button class="teacher-button" type="submit">Criar professor</button></form></article>` : ''}${teachers.map((teacher) => `<article class="teacher-card"><strong>${esc(teacher.name)} · ${esc(teacher.username)}</strong><form class="teacher-form" data-action="permissions" data-id="${esc(teacher.id)}">${permissions.map(([key, label]) => `<label><input type="checkbox" name="permissions" value="${key}" ${(teacher.permissions || []).includes(key) ? 'checked' : ''}> ${label}</label>`).join('')}<button class="teacher-button" type="submit">Salvar permissões</button><button class="teacher-button secondary" type="button" data-action="edit-password" data-id="${esc(teacher.id)}">Alterar senha</button><button class="teacher-button danger" type="button" data-action="delete-user" data-id="${esc(teacher.id)}">Excluir</button></form></article>`).join('')}`;
    return `<div class="teacher-page-intro"><div><h1 class="teacher-heading">Meu perfil</h1><p class="teacher-muted">Atualize seu nome de usuário ou sua senha.</p></div></div><article class="teacher-card"><form class="teacher-form" data-action="save-profile"><label class="teacher-field">Usuário<input name="username" value="${esc(currentUser.username)}" required></label><label class="teacher-field">Senha atual<input name="currentPassword" type="password" required></label><label class="teacher-field">Nova senha (opcional)<input name="newPassword" type="password" minlength="8"></label><button class="teacher-button" type="submit">Salvar alterações</button></form></article>`;
  }

  async function refresh() { await loadData(); render(); }
  async function createStudent(event) {
    event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget));
    data.role = 'student'; data.cpf = String(data.cpf || '').replace(/\D/g, '');
    try { await schoolApi('/api/users', { method: 'POST', body: data }); await refresh(); alert('Perfil de aluno criado.'); }
    catch (error) { alert(error.message); }
  }
  async function createTeacher(event) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
    const data = { name: values.get('name'), username: values.get('username'), password: values.get('password'), role: 'teacher', permissions: values.getAll('permissions') };
    try { await schoolApi('/api/users', { method: 'POST', body: data }); await refresh(); alert('Perfil de professor criado.'); }
    catch (error) { alert(error.message); }
  }
  async function assignLesson(event) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    const studentIds = [...form.elements.studentIds.selectedOptions].map((option) => option.value);
    try {
      const created = await schoolApi('/api/lessons', { method: 'POST', body: { studentIds, title: data.get('title'), description: data.get('description'), level: data.get('level'), releaseDay: Number(data.get('releaseDay')) } });
      const files = [...form.elements.attachments.files];
      for (const lessonId of created.lessonIds || []) for (const file of files) {
        await schoolApi(`/api/lessons/${encodeURIComponent(lessonId)}/files?name=${encodeURIComponent(file.name)}`, { method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
      }
      await refresh(); alert('Lição atribuída com sucesso.');
    } catch (error) { alert(error.message); }
  }
  async function deleteUser(id) {
    if (!confirm('Excluir este perfil e seus dados?')) return;
    try { await schoolApi(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' }); await refresh(); }
    catch (error) { alert(error.message); }
  }
  async function editPassword(id) {
    const password = prompt('Nova senha (mínimo de 8 caracteres):'); if (password === null) return;
    try { await schoolApi(`/api/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: { password } }); alert('Senha atualizada.'); }
    catch (error) { alert(error.message); }
  }
  async function toggleLesson(id, completed) {
    try { await schoolApi(`/api/lessons/${encodeURIComponent(id)}`, { method: 'PATCH', body: { completed } }); await refresh(); }
    catch (error) { alert(error.message); }
  }
  async function deleteLesson(id, title) {
    if (!confirm(`Apagar a lição "${title}"? Esta ação também remove os arquivos e anotações vinculados a ela.`)) return;
    try { await schoolApi(`/api/lessons/${encodeURIComponent(id)}`, { method: 'DELETE' }); await refresh(); alert('Lição apagada com sucesso.'); }
    catch (error) { alert(error.message); }
  }
  async function savePermissions(event) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
    try { await schoolApi(`/api/users/${encodeURIComponent(form.dataset.id)}`, { method: 'PATCH', body: { permissions: values.getAll('permissions') } }); await refresh(); }
    catch (error) { alert(error.message); }
  }
  async function saveProfile(event) {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await schoolApi('/api/account', { method: 'PATCH', body: { username: values.username, currentPassword: values.currentPassword, password: values.newPassword || '' } });
      currentUser.username = values.username; alert('Perfil atualizado.');
    } catch (error) { alert(error.message); }
  }
  async function logout() {
    try { await schoolApi('/api/auth/logout', { method: 'POST', body: {} }); } catch { /* Clear the visible session even if the network is unavailable. */ }
    portal.hidden = true; $('.login-page').hidden = false; document.body.dataset.view = 'login'; document.body.dataset.role = 'aluno';
    $('#login-form').reset(); $('#form-message').textContent = ''; tab = 'overview';
  }
})();

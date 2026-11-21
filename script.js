const roleButtons = document.querySelectorAll('.role-button');
const roleDescription = document.getElementById('role-description');
const loginForm = document.getElementById('login-form');
const loginInput = document.getElementById('login');
const passwordInput = document.getElementById('password');
const formMessage = document.getElementById('form-message');
const helpNote = document.getElementById('help-note');
const loginPage = document.querySelector('.login-page');
const studentDashboard = document.getElementById('student-dashboard');
const logoutButtons = document.querySelectorAll('.logout-button');
const profileDialog = document.getElementById('profile-dialog');
const avatarDialog = document.getElementById('avatar-dialog');
const avatarStage = document.getElementById('avatar-stage');
const avatarSkinInput = document.getElementById('avatar-skin');
const avatarHairInput = document.getElementById('avatar-hair');
const avatarClothesSelect = document.getElementById('avatar-clothes');
const avatarClothingColorInput = document.getElementById('avatar-clothing-color');
const languageSelect = document.getElementById('language-select');
const accentColorInput = document.getElementById('accent-color');
const backgroundSelect = document.getElementById('background-style');
const photoUpload = document.getElementById('photo-upload');
const avatarUpload = document.getElementById('avatar-upload');
const avatarElements = [document.getElementById('sidebar-avatar'), document.getElementById('welcome-avatar')];
const feedbackDialog = document.getElementById('feedback-dialog');
const feedbackForm = document.getElementById('feedback-form');
const feedbackMessage = document.getElementById('feedback-message');
const feedbackStatus = document.getElementById('feedback-status');

let selectedRole = 'aluno';
let currentStudentUsername = '';
let currentStudentName = 'Rudson';
let currentLanguage = 'pt';
let savedAvatar = '';
let pendingAvatar = '';
let savedBackgroundPhoto = '';
let pendingBackgroundPhoto = '';
const settingsKey = 'english-school-student-settings';

function updateStudentGameProgressWidget() {
  const xpEl = document.getElementById('sidebar-xp-value');
  const levelEl = document.getElementById('sidebar-xp-level');
  const rankEl = document.getElementById('sidebar-xp-rank');
  const fillEl = document.getElementById('sidebar-xp-fill');
  const card = document.getElementById('sidebar-xp-card');
  if (!xpEl || !levelEl || !rankEl || !fillEl || !card) return;
  const render = (stats = {}) => {
    const xp = Number(stats.xp) || 0;
    const answers = Number(stats.correct_answers) || 0;
    const level = Math.floor(answers / 100) + 1;
    const stage = (answers % 100) + 1;
    const ranks = ['Iniciante', 'Explorador', 'Comunicador', 'Fluente'];
    xpEl.textContent = xp;
    levelEl.textContent = level;
    rankEl.textContent = ranks[(level - 1) % ranks.length];
    fillEl.style.width = ((stage - 1) / 100 * 100) + '%';
    const track = card.querySelector('.sidebar-xp-track');
    if (track) track.setAttribute('aria-valuenow', String(stage - 1));
  };
  render();
  if (!currentStudentUsername) return;
  const requestedUsername = currentStudentUsername;
  fetch('/api/games/content', { credentials: 'same-origin' })
    .then((response) => response.ok ? response.json() : null)
    .then((data) => { if (data?.stats && currentStudentUsername === requestedUsername) render(data.stats); })
    .catch(() => {});
}

window.addEventListener('storage', updateStudentGameProgressWidget);
document.body.dataset.role = selectedRole;

const translations = {
  pt: {
    menu: 'MENU', overview: 'Visão geral', myLearning: 'Meu aprendizado', myProgress: 'Meu progresso', student: 'Aluno',
    journey: 'SUA JORNADA EM INGLÊS', helloRudson: 'Olá, Rudson', studentPage: 'Página do aluno',
    welcomeMessage: 'Que bom ter você por aqui. Vamos aprender algo novo hoje?', weeklyGoal: 'META DA SEMANA',
    goalTitle: 'Cada aula é um passo à frente.', goalDescription: 'Crie o hábito de estudar um pouco todos os dias e acompanhe sua evolução.',
    startLearning: 'Começar a aprender', yourPace: 'Seu ritmo', lessonsOfFive: '/ 5 aulas', weeklyGoalStart: 'Sua meta semanal começa aqui',
    continueAtPace: 'CONTINUE NO SEU RITMO', yourLearning: 'Seu aprendizado', oneTrack: '1 trilha disponível',
    beginner: 'INICIANTE', firstSteps: 'PRIMEIROS PASSOS', courseTitle: 'Inglês para o dia a dia',
    courseDescription: 'Aprenda expressões úteis para se apresentar e conversar em situações cotidianas.', trackProgress: 'Progresso da trilha',
    nextLesson: 'PRÓXIMA AULA · 15 MIN', lessonTitle: 'Apresentações e cumprimentos',
    lessonDescription: 'Aprenda a dizer olá, apresentar-se e iniciar uma conversa.', viewTrack: 'Ver trilha',
    footerMessage: 'Feito para acompanhar você em cada passo do aprendizado.', personalize: 'PERSONALIZE',
    profileSettings: 'Configurações de perfil', profilePhoto: 'Foto de perfil', backgroundPhoto: 'Imagem de fundo', layoutColor: 'Cor do layout',
    accentHint: 'Escolha a cor de destaque do painel.', backgroundStyle: 'Fundo do painel', backgroundDefault: 'Clássico',
    backgroundGalaxy: 'Galáxia animada', backgroundDoodles: 'Rabiscos ilustrados', backgroundManga: 'Mangá em alto contraste', backgroundPhotoOption: 'Imagem enviada',
    backgroundNote: 'Envie uma imagem para usá-la como fundo animado do painel. Clique no avatar para escolher a foto do perfil.', suggestImprovements: 'Sugerir melhorias',
    resetSettings: 'Restaurar padrão', saveSettings: 'Salvar preferências', closeSettings: 'Fechar configurações',
    logout: 'Sair', dashboardLabel: 'Painel do aluno', sidebarLabel: 'Navegação do aluno',
    feedbackEyebrow: 'SUA OPINIÃO', feedbackTitle: 'Como está sendo sua experiência?', feedbackLabel: 'Conte o que está achando da página',
    feedbackPlaceholder: 'Sua opinião ajuda a melhorar a página.', sendFeedback: 'Enviar feedback', feedbackSent: 'Obrigado! Seu feedback foi enviado.', feedbackError: 'Não foi possível enviar agora. Tente novamente.',
    skipToContent: 'Pular para o conteúdo', goalAria: 'Meta inicial: zero de cinco aulas concluídas',
    weeklyProgress: 'Progresso da meta semanal', courseProgressAria: 'Progresso da trilha de inglês para o dia a dia',
    nextLessonAria: 'Ir para a próxima aula', avatarStudio: 'ESTÚDIO DO AVATAR', customizeAvatar: 'Personalize seu personagem',
    avatarHint: 'Escolha seu visual e toque em uma emoção ou movimento.', skinTone: 'Tom de pele', hairColor: 'Cabelo', outfit: 'Roupa',
    outfitTee: 'Camiseta', outfitHoodie: 'Moletom', outfitJacket: 'Jaqueta', clothingColor: 'Cor da roupa',
    avatarWave: 'Acenar', avatarDance: 'Dançar', avatarCelebrate: 'Comemorar', avatarAngry: 'Bravo', avatarSad: 'Chorando',
    avatarSleepy: 'Com sono', avatarScared: 'Com medo', chooseAvatarPhoto: 'Escolher foto em vez do personagem',
    useCharacter: 'Usar personagem', saveAvatar: 'Salvar avatar'
  },
  en: {
    menu: 'MENU', overview: 'Overview', myLearning: 'My learning', myProgress: 'My progress', student: 'Student',
    journey: 'YOUR ENGLISH JOURNEY', helloRudson: 'Hello, Rudson', studentPage: 'Student home',
    welcomeMessage: 'Great to have you here. Ready to learn something new today?', weeklyGoal: 'WEEKLY GOAL',
    goalTitle: 'Every lesson is a step forward.', goalDescription: 'Build a daily study habit and keep track of your progress.',
    startLearning: 'Start learning', yourPace: 'Your pace', lessonsOfFive: '/ 5 lessons', weeklyGoalStart: 'Your weekly goal starts here',
    continueAtPace: 'LEARN AT YOUR OWN PACE', yourLearning: 'Your learning', oneTrack: '1 learning path available',
    beginner: 'BEGINNER', firstSteps: 'FIRST STEPS', courseTitle: 'Everyday English',
    courseDescription: 'Learn useful expressions to introduce yourself and chat in everyday situations.', trackProgress: 'Learning path progress',
    nextLesson: 'NEXT LESSON · 15 MIN', lessonTitle: 'Introductions and greetings',
    lessonDescription: 'Learn how to say hello, introduce yourself, and start a conversation.', viewTrack: 'View path',
    footerMessage: 'Here to support you at every step of your learning journey.', personalize: 'PERSONALIZE',
    profileSettings: 'Profile settings', profilePhoto: 'Profile photo', backgroundPhoto: 'Background image', layoutColor: 'Layout color',
    accentHint: 'Choose the dashboard accent color.', backgroundStyle: 'Dashboard background', backgroundDefault: 'Classic',
    backgroundGalaxy: 'Animated galaxy', backgroundDoodles: 'Illustrated doodles', backgroundManga: 'High-contrast manga', backgroundPhotoOption: 'Uploaded image',
    backgroundNote: 'Upload an image to use as the animated dashboard background. Click the avatar to choose a profile photo.', suggestImprovements: 'Suggest improvements',
    resetSettings: 'Restore defaults', saveSettings: 'Save preferences', closeSettings: 'Close settings',
    logout: 'Log out', dashboardLabel: 'Student dashboard', sidebarLabel: 'Student navigation',
    feedbackEyebrow: 'YOUR FEEDBACK', feedbackTitle: 'How is your experience so far?', feedbackLabel: 'Tell us what you think of the page',
    feedbackPlaceholder: 'Your feedback helps us improve the page.', sendFeedback: 'Send feedback', feedbackSent: 'Thank you! Your feedback has been sent.', feedbackError: 'Could not send your feedback. Please try again.',
    skipToContent: 'Skip to content', goalAria: 'Starting goal: zero of five lessons completed',
    weeklyProgress: 'Weekly goal progress', courseProgressAria: 'Everyday English learning path progress',
    nextLessonAria: 'Go to the next lesson', avatarStudio: 'AVATAR STUDIO', customizeAvatar: 'Customize your character',
    avatarHint: 'Choose a look, then tap an emotion or movement.', skinTone: 'Skin tone', hairColor: 'Hair', outfit: 'Outfit',
    outfitTee: 'T-shirt', outfitHoodie: 'Hoodie', outfitJacket: 'Jacket', clothingColor: 'Clothing color',
    avatarWave: 'Wave', avatarDance: 'Dance', avatarCelebrate: 'Celebrate', avatarAngry: 'Angry', avatarSad: 'Crying',
    avatarSleepy: 'Sleepy', avatarScared: 'Scared', chooseAvatarPhoto: 'Use a photo instead',
    useCharacter: 'Use character', saveAvatar: 'Save avatar'
  }
};

function applyLanguage(language) {
  currentLanguage = language;
  document.documentElement.lang = language === 'en' ? 'en' : 'pt-BR';
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const translated = translations[language][element.dataset.i18n];
    if (translated) element.textContent = translated;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
    const translated = translations[language][element.dataset.i18nPlaceholder];
    if (translated) element.placeholder = translated;
  });
  languageSelect.value = language;
  document.getElementById('dashboard-content').setAttribute('aria-label', translations[language].dashboardLabel);
  document.querySelector('.dashboard-sidebar').setAttribute('aria-label', translations[language].sidebarLabel);
  document.querySelector('.goal-card').setAttribute('aria-label', translations[language].goalAria);
  document.querySelector('.goal-card .progress-track').setAttribute('aria-label', translations[language].weeklyProgress);
  document.querySelector('.course-progress-track').setAttribute('aria-label', translations[language].courseProgressAria);
  document.querySelector('.course-action').setAttribute('aria-label', translations[language].nextLessonAria);
  document.getElementById('dashboard-breadcrumb').textContent = translations[language].overview;
  document.querySelector('.logout-button').setAttribute('aria-label', translations[language].logout);
  document.querySelector('.logout-button').title = translations[language].logout;
  document.querySelector('[data-i18n="helloRudson"]').textContent = `${language === 'en' ? 'Hello' : 'Olá'}, ${currentStudentName}`;
  document.querySelector('.profile-details strong').textContent = currentStudentName.trim().split(/\s+/)[0] || currentStudentName;
  document.querySelector('.profile-settings-button').setAttribute('aria-label', language === 'en' ? 'Open profile settings' : 'Abrir configurações de perfil');
  avatarElements.forEach((avatar) => avatar.setAttribute('aria-label', language === 'en' ? 'Customize avatar' : 'Personalizar avatar'));
  const flag = document.getElementById('language-flag');
  flag.innerHTML = language === 'en'
    ? '<svg viewBox="0 0 24 18" role="img" aria-label="United States"><rect width="24" height="18" fill="#fff"/><path stroke="#b22234" stroke-width="2" d="M0 1h24M0 5h24M0 9h24M0 13h24M0 17h24"/><path fill="#3c3b6e" d="M0 0h11v10H0z"/><g fill="#fff"><circle cx="2" cy="2" r=".55"/><circle cx="5" cy="2" r=".55"/><circle cx="8" cy="2" r=".55"/><circle cx="3.5" cy="4" r=".55"/><circle cx="6.5" cy="4" r=".55"/><circle cx="2" cy="6" r=".55"/><circle cx="5" cy="6" r=".55"/><circle cx="8" cy="6" r=".55"/><circle cx="3.5" cy="8" r=".55"/><circle cx="6.5" cy="8" r=".55"/></g></svg>'
    : '<svg viewBox="0 0 24 18" role="img" aria-label="Brasil"><rect width="24" height="18" rx="2" fill="#009739"/><path fill="#ffdf00" d="M12 2 22 9 12 16 2 9z"/><circle cx="12" cy="9" r="4.2" fill="#002776"/><path d="M8.2 8.4c2.8-.8 5.5-.6 7.8.3" fill="none" stroke="#fff" stroke-width=".65"/></svg>';
  document.querySelectorAll('.dialog-close').forEach((button) => button.setAttribute('aria-label', translations[language].closeSettings));
  document.title = studentDashboard.hidden ? 'Login | English School' : `${translations[language].overview} | English School`;
}

const defaultAvatarStyle = { skin: '#d99b72', hair: '#392638', clothes: '#8e58cc', outfit: 'hoodie' };
let savedAvatarStyle = { ...defaultAvatarStyle };
let previewAvatarState = 'idle';

function avatarSvg(look, state = 'idle') {
  const outfit = look.outfit || 'tee';
  const hood = outfit === 'hoodie' ? `<path d="M49 103q1-24 31-25 30 1 31 25l-9 13H58z" fill="${look.clothes}" stroke="#38283f" stroke-width="3"/>` : '';
  const jacket = outfit === 'jacket' ? `<path d="M54 101l26 9 26-9 13 52H43z" fill="${look.clothes}" stroke="#38283f" stroke-width="3"/><path d="M80 110v42" stroke="#f7d976" stroke-width="3"/>` : `<path d="M56 101q24 13 48 0l10 52H46z" fill="${look.clothes}" stroke="#38283f" stroke-width="3"/>`;
  return `<svg class="funko-avatar state-${state}" viewBox="0 0 160 200" role="img" aria-label="Avatar ilustrado personalizado">
    <ellipse cx="80" cy="190" rx="43" ry="7" fill="#211a2b" opacity=".14"/>
    <g class="avatar-body">
      <path d="M62 145v30h19v-31M83 144v31h18v-31" fill="#393148" stroke="#211a2b" stroke-width="3" stroke-linejoin="round"/>
      <path d="M56 171q-5 0-8 8v5h35v-8q-2-5-8-5zM83 176v8h36v-5q-3-8-9-8h-19z" fill="#f5f1ff" stroke="#30253c" stroke-width="3" stroke-linejoin="round"/>
      <path class="arm-left" d="M54 104q-16 6-18 31l-3 15q-1 8 7 9 7 1 9-7l7-25" fill="${look.skin}" stroke="#38283f" stroke-width="4" stroke-linecap="round"/>
      <path class="arm-right" d="M106 104q16 6 18 31l3 15q1 8-7 9-7 1-9-7l-7-25" fill="${look.skin}" stroke="#38283f" stroke-width="4" stroke-linecap="round"/>
      ${hood}${jacket}
      <path d="M70 94h20v17H70z" fill="${look.skin}" stroke="#38283f" stroke-width="3"/>
      <path d="M35 58q0-43 45-43t45 43v17q-2 35-45 39Q37 108 35 75z" fill="${look.skin}" stroke="#38283f" stroke-width="4"/>
      <path d="M36 61q-4-42 34-47 35-8 52 19 5 9 4 25-14-3-24-15-20 16-65 18z" fill="${look.hair}" stroke="#38283f" stroke-width="4" stroke-linejoin="round"/>
      <g class="face-eyes"><ellipse cx="64" cy="69" rx="4" ry="6" fill="#30253c"/><ellipse cx="96" cy="69" rx="4" ry="6" fill="#30253c"/></g>
      <g class="face-neutral"><path d="M68 87q12 9 24 0" fill="none" stroke="#713d4c" stroke-width="3" stroke-linecap="round"/></g>
      <g class="face-angry"><path d="m57 62 14 5m32-5-14 5" stroke="#392638" stroke-width="4" stroke-linecap="round"/><path d="M69 89q11-8 22 0" fill="none" stroke="#713d4c" stroke-width="3"/></g>
      <g class="face-sad"><path d="M68 91q12-9 24 0" fill="none" stroke="#713d4c" stroke-width="3"/><path class="tear" d="M103 77q-7 10 0 14 7-4 0-14" fill="#67c9f5"/></g>
      <g class="face-sleepy"><path d="M59 70q5 5 10 0m22 0q5 5 10 0" fill="none" stroke="#30253c" stroke-width="4" stroke-linecap="round"/><text x="109" y="44" fill="#8e58cc" font-size="17" font-weight="700">z</text></g>
      <g class="face-scared"><ellipse cx="64" cy="69" rx="5" ry="8" fill="#30253c"/><ellipse cx="96" cy="69" rx="5" ry="8" fill="#30253c"/><ellipse cx="80" cy="89" rx="6" ry="8" fill="#713d4c"/></g>
      <g class="face-happy"><path d="M66 83q14 20 28 0" fill="#fff" stroke="#713d4c" stroke-width="3" stroke-linejoin="round"/></g>
    </g>
  </svg>`;
}

function showAvatar(photo = savedAvatar) {
  avatarElements.forEach((avatar) => {
    avatar.style.backgroundImage = photo ? `url("${photo}")` : '';
    avatar.classList.toggle('has-photo', Boolean(photo));
    avatar.classList.toggle('has-generated-avatar', !photo);
    avatar.innerHTML = photo ? '' : avatarSvg(savedAvatarStyle, 'idle');
  });
  if (avatarStage) avatarStage.innerHTML = avatarSvg(savedAvatarStyle, previewAvatarState);
}

function applyPreferences(preferences) {
  document.body.style.setProperty('--student-accent', preferences.color || '#8e58cc');
  savedBackgroundPhoto = preferences.backgroundPhoto || '';
  if (savedBackgroundPhoto) {
    document.body.style.setProperty('--dashboard-background-image', `url("${savedBackgroundPhoto}")`);
  } else {
    document.body.style.removeProperty('--dashboard-background-image');
  }
  const selectedBackground = preferences.background === 'photo' && !savedBackgroundPhoto
    ? 'default'
    : preferences.background || 'default';
  document.body.dataset.background = selectedBackground;
  savedAvatar = typeof preferences.avatar === 'string' ? preferences.avatar : '';
  savedAvatarStyle = { ...defaultAvatarStyle, ...(preferences.avatarStyle || {}) };
  showAvatar(savedAvatar);
  avatarSkinInput.value = savedAvatarStyle.skin;
  avatarHairInput.value = savedAvatarStyle.hair;
  avatarClothingColorInput.value = savedAvatarStyle.clothes;
  avatarClothesSelect.value = savedAvatarStyle.outfit;
  accentColorInput.value = preferences.color || '#8e58cc';
  backgroundSelect.value = selectedBackground;
}

try {
  const savedSettings = JSON.parse(localStorage.getItem(settingsKey) || '{}');
  applyPreferences(savedSettings);
  const savedLanguage = localStorage.getItem('english-school-language');
  if (savedLanguage === 'en' || savedLanguage === 'pt') currentLanguage = savedLanguage;
} catch {
  applyPreferences({});
}
applyLanguage(currentLanguage);
updateStudentGameProgressWidget();

const assignedLessonsSection = document.getElementById('assigned-lessons-section');
const assignedLessonsList = document.getElementById('assigned-lessons-list');
const studentLessonScreen = document.getElementById('student-lesson-screen');
const studentAttachmentUrls = new Map();
let currentAssignedLessons = [];
let activeStudentLesson = null;
let activeStudentFileIndex = 0;
let studentImageZoom = 1;

function clearStudentAttachmentUrls() {
  studentAttachmentUrls.forEach((url) => URL.revokeObjectURL(url));
  studentAttachmentUrls.clear();
}

function escapeStudentText(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function studentFileKind(file) {
  const type = String(file.type || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();
  if (type.startsWith('image/')) return 'image';
  if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (type.startsWith('audio/')) return 'audio';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('text/') || /\.(txt|csv|md|log)$/.test(name)) return 'text';
  if (/\.(doc|docx|xls|xlsx|ppt|pptx)$/.test(name)) return 'document';
  return 'file';
}

function studentFileIcon(kind) {
  return ({ image: '▧', pdf: 'PDF', audio: '♫', video: '▶', text: 'TXT', document: 'DOC', file: '↧' })[kind] || '↧';
}

function renderAssignedLessonList() {
  if (!currentAssignedLessons.length) return;
  assignedLessonsList.innerHTML = currentAssignedLessons.map((lesson, lessonIndex) => {
    const attachments = Array.isArray(lesson.attachments) ? lesson.attachments : [];
    const files = attachments.map((file, fileIndex) => {
      const id = escapeStudentText(file.id);
      const name = escapeStudentText(file.name || 'Arquivo anexado');
      const kind = studentFileKind(file);
      const preview = kind === 'image'
        ? `<img data-student-attachment="${id}" alt="Prévia de ${name}" loading="lazy">`
        : `<span>${studentFileIcon(kind)}</span>`;
      return `<button class="assigned-lesson-file-card" type="button" data-open-assigned-lesson="${lessonIndex}" data-open-file="${fileIndex}"><span class="assigned-file-preview assigned-file-${kind}">${preview}</span><span class="assigned-file-details"><strong>${name}</strong><small>${studentFileIcon(kind)} · Abrir na lição</small></span><span class="assigned-file-arrow" aria-hidden="true">→</span></button>`;
    }).join('');
    return `<article class="assigned-lesson-card"><div class="assigned-lesson-card-heading"><div><p>${escapeStudentText(lesson.level || '')}</p><h3>${escapeStudentText(lesson.title || 'Lição')}</h3></div><button class="assigned-lesson-open" type="button" data-open-assigned-lesson="${lessonIndex}" data-open-file="0">Abrir lição <span aria-hidden="true">→</span></button></div><div class="assigned-lesson-files-list">${files || '<p>Esta lição não tem arquivos anexados. Abra para responder e fazer anotações.</p>'}</div></article>`;
  }).join('');
}

function renderStudentLessonFile() {
  if (!activeStudentLesson || !studentLessonScreen) return;
  const files = Array.isArray(activeStudentLesson.attachments) ? activeStudentLesson.attachments : [];
  const viewer = document.getElementById('student-lesson-viewer-content');
  const fileNav = document.getElementById('student-lesson-file-nav');
  const file = files[activeStudentFileIndex];
  if (!file) {
    document.getElementById('student-lesson-title').textContent = activeStudentLesson.title || 'Lição';
    viewer.innerHTML = '<div class="student-file-empty">Esta lição não tem arquivos anexados. Use o bloco ao lado para responder ou registrar suas anotações.</div>';
    fileNav.innerHTML = '';
    return;
  }
  const name = escapeStudentText(file.name || 'Arquivo da lição');
  const kind = studentFileKind(file);
  document.getElementById('student-lesson-title').textContent = file.name || activeStudentLesson.title || 'Lição';
  const url = studentAttachmentUrls.get(String(file.id));
  let preview = '';
  if (!url) {
    preview = `<div class="student-file-empty">O arquivo “${name}” não está disponível neste navegador.<br>Peça ao professor para enviá-lo novamente.</div>`;
  } else if (kind === 'image') {
    studentImageZoom = 1;
    preview = `<div class="student-image-preview"><div class="student-image-controls" role="group" aria-label="Controles de zoom da imagem"><button type="button" data-image-zoom="out" aria-label="Diminuir zoom">−</button><span data-image-zoom-level>100%</span><button type="button" data-image-zoom="in" aria-label="Aumentar zoom">+</button><button type="button" data-image-zoom="reset">Ajustar</button></div><div class="student-image-viewport"><img class="student-file-image" src="${url}" alt="${name}" style="width: 100%"></div></div>`;
  } else if (kind === 'pdf') {
    preview = `<iframe class="student-file-pdf" src="${url}#toolbar=1" title="${name}"></iframe>`;
  } else if (kind === 'audio') {
    preview = `<div class="student-file-media"><p>${name}</p><audio controls autoplay src="${url}"></audio></div>`;
  } else if (kind === 'video') {
    preview = `<video class="student-file-video" controls autoplay src="${url}"></video>`;
  } else if (kind === 'text') {
    preview = `<iframe class="student-file-text" src="${url}" title="${name}"></iframe>`;
  } else {
    preview = `<div class="student-file-empty"><span class="student-file-type-icon">${studentFileIcon(kind)}</span><h3>${name}</h3><p>Este formato não pode ser exibido diretamente no navegador. Baixe o arquivo para abrir e responder.</p><a class="student-file-download" href="${url}" download="${name}">Baixar ${name}</a></div>`;
  }
  viewer.innerHTML = `<div class="student-file-name">${name}</div>${preview}`;
  fileNav.innerHTML = files.length > 1
    ? `<button type="button" data-student-file-step="-1" ${activeStudentFileIndex === 0 ? 'disabled' : ''}>← Lição anterior</button><span>Lição ${activeStudentFileIndex + 1} de ${files.length}</span><button type="button" data-student-file-step="1" ${activeStudentFileIndex === files.length - 1 ? 'disabled' : ''}>Próxima lição →</button>`
    : `<span>1 lição</span>`;
}

function sanitizeStudentNoteHtml(html) {
  const parser = document.createElement('template');
  parser.innerHTML = String(html || '');
  const allowedTags = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'P', 'DIV', 'BR', 'UL', 'OL', 'LI', 'SPAN', 'FONT', 'H2', 'H3', 'BLOCKQUOTE']);
  const cleanNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent || '');
    if (node.nodeType !== Node.ELEMENT_NODE) return document.createDocumentFragment();
    const tag = node.tagName;
    const fragment = document.createDocumentFragment();
    if (!allowedTags.has(tag)) {
      [...node.childNodes].forEach((child) => fragment.append(cleanNode(child)));
      return fragment;
    }
    const element = document.createElement(tag === 'FONT' ? 'span' : tag.toLowerCase());
    const styles = ['color', 'backgroundColor', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'textDecoration', 'textAlign'];
    styles.forEach((property) => {
      const value = node.style[property];
      if (!value) return;
      const cssProperty = property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      if (CSS.supports(cssProperty, value)) element.style[property] = value;
    });
    if (tag === 'FONT') {
      const color = node.getAttribute('color');
      if (color && CSS.supports('color', color)) element.style.color = color;
      const fontSizes = { 1: '10px', 2: '13px', 3: '16px', 4: '18px', 5: '24px', 6: '32px', 7: '48px' };
      if (!element.style.fontSize && fontSizes[node.getAttribute('size')]) element.style.fontSize = fontSizes[node.getAttribute('size')];
    }
    [...node.childNodes].forEach((child) => element.append(cleanNode(child)));
    return element;
  };
  const clean = document.createElement('div');
  [...parser.content.childNodes].forEach((node) => clean.append(cleanNode(node)));
  return clean.innerHTML;
}

function studentNoteKey(lesson, lessonIndex, file, fileIndex) {
  const usernameKey = encodeURIComponent(String(currentStudentUsername).trim().toLocaleLowerCase('pt-BR'));
  const lessonKey = encodeURIComponent(String(lesson.id || lessonIndex));
  const fileKey = file ? encodeURIComponent(String(file.id || fileIndex)) : 'sem-arquivo';
  return `english-school-student-note:${usernameKey}:${lessonKey}:${fileKey}`;
}

function loadStudentLessonNotes() {
  if (!activeStudentLesson) return;
  const notes = document.getElementById('student-lesson-notes-input');
  const lessonIndex = currentAssignedLessons.indexOf(activeStudentLesson);
  const files = Array.isArray(activeStudentLesson.attachments) ? activeStudentLesson.attachments : [];
  const file = files[activeStudentFileIndex];
  const noteKey = studentNoteKey(activeStudentLesson, lessonIndex, file, activeStudentFileIndex);
  notes.dataset.noteKey = noteKey;
  notes.innerHTML = '';
  document.getElementById('student-lesson-notes-status').textContent = 'Carregando anotações…';
  schoolApi(`/api/lessons/${encodeURIComponent(activeStudentLesson.id)}/notes?fileId=${encodeURIComponent(file?.id || '')}`)
    .then((result) => { if (notes.dataset.noteKey === noteKey) notes.innerHTML = sanitizeStudentNoteHtml(result.content || ''); })
    .catch(() => { document.getElementById('student-lesson-notes-status').textContent = 'Não foi possível carregar as anotações'; });
}

function openStudentLesson(lessonIndex, fileIndex = 0) {
  const lesson = currentAssignedLessons[lessonIndex];
  if (!lesson || !studentLessonScreen) return;
  activeStudentLesson = lesson;
  activeStudentFileIndex = Math.max(0, Math.min(fileIndex, (lesson.attachments || []).length - 1));
  document.getElementById('student-lesson-title').textContent = lesson.title || 'Lição';
  document.getElementById('student-lesson-level').textContent = lesson.level || 'LIÇÃO ATRIBUÍDA';
  loadStudentLessonNotes();
  assignedLessonsList.hidden = true;
  studentLessonScreen.hidden = false;
  document.getElementById('dashboard-home')?.classList.add('lesson-focused');
  document.getElementById('student-dashboard')?.classList.add('lesson-focused-dashboard');
  renderStudentLessonFile();
  document.getElementById('student-lesson-title').focus();
}

async function showAssignedLessons(username) {
  if (!assignedLessonsSection || !assignedLessonsList) return;
  clearStudentAttachmentUrls();
  currentAssignedLessons = [];
  activeStudentLesson = null;
  assignedLessonsList.innerHTML = '';
  assignedLessonsList.hidden = false;
  if (studentLessonScreen) studentLessonScreen.hidden = true;
  document.getElementById('dashboard-home')?.classList.remove('lesson-focused');
  document.getElementById('student-dashboard')?.classList.remove('lesson-focused-dashboard');
  assignedLessonsSection.hidden = true;
  try {
    const result = await schoolApi('/api/lessons');
    currentAssignedLessons = Array.isArray(result.lessons) ? result.lessons : [];
    if (!currentAssignedLessons.length) return;
    renderAssignedLessonList();
    assignedLessonsSection.hidden = false;
    const fileIds = [...new Set(currentAssignedLessons.flatMap((lesson) => (lesson.attachments || []).map((file) => String(file.id))))];
    await Promise.all(fileIds.map(async (id) => {
      const blob = await schoolApi(`/api/files/${encodeURIComponent(id)}/content`);
      studentAttachmentUrls.set(id, URL.createObjectURL(blob));
    }));
    assignedLessonsList.querySelectorAll('img[data-student-attachment]').forEach((image) => {
      const url = studentAttachmentUrls.get(image.dataset.studentAttachment);
      if (url) image.src = url;
    });
    if (activeStudentLesson) renderStudentLessonFile();
  } catch {
    assignedLessonsList.innerHTML = '<p>Não foi possível carregar as lições ou seus arquivos neste navegador.</p>';
    assignedLessonsSection.hidden = false;
  }
}

document.getElementById('assigned-lessons-list')?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-open-assigned-lesson]');
  if (button) openStudentLesson(Number(button.dataset.openAssignedLesson), Number(button.dataset.openFile || 0));
});
document.getElementById('student-lesson-back')?.addEventListener('click', () => {
  if (studentLessonScreen) studentLessonScreen.hidden = true;
  assignedLessonsList.hidden = false;
  document.getElementById('dashboard-home')?.classList.remove('lesson-focused');
  document.getElementById('student-dashboard')?.classList.remove('lesson-focused-dashboard');
});
document.getElementById('student-lesson-file-nav')?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-student-file-step]');
  if (!button || button.disabled) return;
  saveStudentNotes();
  activeStudentFileIndex += Number(button.dataset.studentFileStep);
  savedStudentNoteRange = null;
  loadStudentLessonNotes();
  renderStudentLessonFile();
});
document.getElementById('student-lesson-viewer-content')?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-image-zoom]');
  if (!button) return;
  const action = button.dataset.imageZoom;
  if (action === 'in') studentImageZoom = Math.min(3, studentImageZoom + 0.25);
  else if (action === 'out') studentImageZoom = Math.max(0.5, studentImageZoom - 0.25);
  else studentImageZoom = 1;
  const image = document.querySelector('.student-image-preview .student-file-image');
  const level = document.querySelector('[data-image-zoom-level]');
  if (image) image.style.width = `${studentImageZoom * 100}%`;
  if (level) level.textContent = `${Math.round(studentImageZoom * 100)}%`;
});
const studentNotesEditor = document.getElementById('student-lesson-notes-input');
let savedStudentNoteRange = null;

let studentNotesSaveTimer;
function saveStudentNotes() {
  if (!studentNotesEditor?.dataset.noteKey || !activeStudentLesson) return;
  const status = document.getElementById('student-lesson-notes-status');
  status.textContent = 'Salvando…';
  window.clearTimeout(studentNotesSaveTimer);
  studentNotesSaveTimer = window.setTimeout(async () => {
    const file = activeStudentLesson.attachments?.[activeStudentFileIndex];
    try {
      await schoolApi(`/api/lessons/${encodeURIComponent(activeStudentLesson.id)}/notes`, { method: 'PUT', body: { fileId: file?.id || '', content: sanitizeStudentNoteHtml(studentNotesEditor.innerHTML) } });
      status.textContent = 'Salvo no servidor';
    } catch { status.textContent = 'Não foi possível salvar as anotações'; }
  }, 350);
}

studentNotesEditor?.addEventListener('input', saveStudentNotes);
studentNotesEditor?.addEventListener('keyup', () => {
  const selection = window.getSelection();
  if (selection?.rangeCount && studentNotesEditor.contains(selection.anchorNode)) {
    savedStudentNoteRange = selection.getRangeAt(0).cloneRange();
  }
});
studentNotesEditor?.addEventListener('mouseup', () => {
  const selection = window.getSelection();
  if (selection?.rangeCount && studentNotesEditor.contains(selection.anchorNode)) {
    savedStudentNoteRange = selection.getRangeAt(0).cloneRange();
  }
});

function restoreStudentNoteSelection() {
  if (!studentNotesEditor) return;
  studentNotesEditor.focus();
  const selection = window.getSelection();
  if (savedStudentNoteRange && selection) {
    selection.removeAllRanges();
    selection.addRange(savedStudentNoteRange);
  }
}

function applyStudentNoteCommand(command, value = null) {
  if (!studentNotesEditor) return;
  restoreStudentNoteSelection();
  document.execCommand('styleWithCSS', false, true);
  document.execCommand(command, false, value);
  saveStudentNotes();
}

document.querySelector('.student-notes-toolbar')?.addEventListener('mousedown', (event) => {
  if (event.target.closest('button')) event.preventDefault();
});
document.querySelector('.student-notes-toolbar')?.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-note-command]');
  if (button) applyStudentNoteCommand(button.dataset.noteCommand);
});
document.querySelector('.student-notes-toolbar')?.addEventListener('change', (event) => {
  const control = event.target.closest('select[data-note-command]');
  if (!control || !control.value) return;
  applyStudentNoteCommand(control.dataset.noteCommand, control.value);
  control.selectedIndex = 0;
});
document.getElementById('student-note-color')?.addEventListener('input', (event) => {
  applyStudentNoteCommand('foreColor', event.target.value);
});
document.getElementById('student-note-highlight')?.addEventListener('input', (event) => {
  applyStudentNoteCommand('hiliteColor', event.target.value);
});

roleButtons.forEach((button) => {
  button.addEventListener('click', () => {
    selectedRole = button.dataset.role;
    loginPage.dataset.role = selectedRole;
    document.body.dataset.role = selectedRole;

    roleButtons.forEach((roleButton) => {
      const isActive = roleButton === button;
      roleButton.classList.toggle('active', isActive);
      roleButton.setAttribute('aria-pressed', String(isActive));
    });

    roleDescription.textContent = selectedRole === 'professor'
      ? 'Entre para acessar sua área de professor.'
      : 'Entre para continuar sua jornada de aprendizado.';
    helpNote.hidden = selectedRole === 'professor';
    formMessage.textContent = '';
  });
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const username = loginInput.value.trim();
  const password = passwordInput.value;
  const loginButton = loginForm.querySelector('[type="submit"]');
  loginButton.disabled = true;
  formMessage.textContent = 'Conectando ao servidor…';
  try {
    const result = await schoolApi('/api/auth/login', { method: 'POST', body: { username, password, role: selectedRole } });
    const user = result.user;
    formMessage.textContent = '';
    if (user.role === 'teacher' || user.role === 'admin') {
      window.showSchoolTeacherPortal(user);
      return;
    }
    currentStudentUsername = user.username;
    currentStudentName = user.name || user.username;
    loginPage.hidden = true;
    studentDashboard.hidden = false;
    document.body.dataset.view = 'dashboard';
    try {
      const resultSettings = await schoolApi('/api/settings');
      applyPreferences(resultSettings.settings || {});
    } catch { applyPreferences({}); }
    await showAssignedLessons(currentStudentUsername);
    applyLanguage(currentLanguage);
    updateStudentGameProgressWidget();
    document.getElementById('dashboard-title').focus();
  } catch (error) {
    formMessage.textContent = error.message || 'Login ou senha incorretos.';
  } finally { loginButton.disabled = false; }
});

function refreshAvatarPreview() {
  const look = {
    skin: avatarSkinInput.value,
    hair: avatarHairInput.value,
    clothes: avatarClothingColorInput.value,
    outfit: avatarClothesSelect.value
  };
  avatarStage.innerHTML = avatarSvg(look, previewAvatarState);
}

function setAvatarState(state) {
  previewAvatarState = state;
  document.querySelectorAll('.avatar-stage .funko-avatar, .profile-avatar .funko-avatar').forEach((avatar) => {
    avatar.className.baseVal = `funko-avatar state-${state}`;
  });
  if (state !== 'idle') {
    window.clearTimeout(setAvatarState.timer);
    setAvatarState.timer = window.setTimeout(() => setAvatarState('idle'), 2600);
  }
}

avatarElements.forEach((avatar) => {
  avatar.addEventListener('click', () => {
    avatarSkinInput.value = savedAvatarStyle.skin;
    avatarHairInput.value = savedAvatarStyle.hair;
    avatarClothingColorInput.value = savedAvatarStyle.clothes;
    avatarClothesSelect.value = savedAvatarStyle.outfit;
    previewAvatarState = 'idle';
    refreshAvatarPreview();
    avatarDialog.showModal();
  });
});

[avatarSkinInput, avatarHairInput, avatarClothingColorInput, avatarClothesSelect].forEach((control) => {
  control.addEventListener('input', refreshAvatarPreview);
  control.addEventListener('change', refreshAvatarPreview);
});

document.querySelectorAll('[data-avatar-state]').forEach((button) => {
  button.addEventListener('click', () => setAvatarState(button.dataset.avatarState));
});

document.getElementById('close-avatar-dialog').addEventListener('click', () => avatarDialog.close());
document.getElementById('choose-avatar-photo').addEventListener('click', () => avatarUpload.click());
document.getElementById('use-avatar-character').addEventListener('click', () => {
  savedAvatar = '';
  showAvatar('');
  refreshAvatarPreview();
});
document.getElementById('save-avatar-settings').addEventListener('click', async () => {
  savedAvatarStyle = {
    skin: avatarSkinInput.value,
    hair: avatarHairInput.value,
    clothes: avatarClothingColorInput.value,
    outfit: avatarClothesSelect.value
  };
  showAvatar(savedAvatar);
  try {
    const current = JSON.parse(localStorage.getItem(settingsKey) || '{}');
    const preferences = { ...current, avatar: savedAvatar, avatarStyle: savedAvatarStyle };
    await schoolApi('/api/settings', { method: 'PUT', body: preferences });
    localStorage.setItem(settingsKey, JSON.stringify(preferences));
  } catch (error) { alert(error.message || 'Não foi possível salvar o avatar.'); }
  avatarDialog.close();
});

avatarDialog.addEventListener('click', (event) => {
  if (event.target === avatarDialog) avatarDialog.close();
});

document.querySelector('.profile-settings-button').addEventListener('click', () => {
  pendingAvatar = savedAvatar;
  pendingBackgroundPhoto = savedBackgroundPhoto;
  photoUpload.value = '';
  backgroundSelect.value = document.body.dataset.background || 'default';
  profileDialog.showModal();
});

document.getElementById('save-profile-settings').addEventListener('click', async () => {
  const preferences = {
    color: accentColorInput.value,
    background: backgroundSelect.value,
    avatar: savedAvatar,
    avatarStyle: savedAvatarStyle,
    backgroundPhoto: pendingBackgroundPhoto
  };
  try {
    await schoolApi('/api/settings', { method: 'PUT', body: preferences });
    localStorage.setItem(settingsKey, JSON.stringify(preferences));
    applyPreferences(preferences);
    profileDialog.close();
  } catch (error) {
    alert(error.message || (currentLanguage === 'en' ? 'Could not save these settings.' : 'Não foi possível salvar as configurações.'));
  }
});

document.getElementById('reset-profile-settings').addEventListener('click', async () => {
  pendingAvatar = '';
  pendingBackgroundPhoto = '';
  try {
    await schoolApi('/api/settings', { method: 'PUT', body: {} });
    localStorage.removeItem(settingsKey);
    applyPreferences({});
    profileDialog.close();
  } catch (error) { alert(error.message); }
});

function readSelectedImage(input, onLoad) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/') || file.size > 3 * 1024 * 1024) {
    alert(currentLanguage === 'en' ? 'Choose an image smaller than 3 MB.' : 'Escolha uma imagem com menos de 3 MB.');
    input.value = '';
    return;
  }
  const reader = new FileReader();
  reader.addEventListener('load', () => onLoad(reader.result));
  reader.readAsDataURL(file);
}

photoUpload.addEventListener('change', () => {
  readSelectedImage(photoUpload, (dataUrl) => {
    pendingBackgroundPhoto = dataUrl;
    backgroundSelect.value = 'photo';
  });
});

avatarUpload.addEventListener('change', () => {
  readSelectedImage(avatarUpload, (dataUrl) => {
    savedAvatar = dataUrl;
    showAvatar(savedAvatar);
    try {
      const preferences = JSON.parse(localStorage.getItem(settingsKey) || '{}');
      preferences.avatar = savedAvatar;
      preferences.avatarStyle = savedAvatarStyle;
      localStorage.setItem(settingsKey, JSON.stringify(preferences));
    } catch {
      alert(currentLanguage === 'en'
        ? 'The photo was applied, but could not be saved in this browser.'
        : 'A foto foi aplicada, mas não pôde ser salva neste navegador.');
    }
    avatarDialog.close();
  });
});

profileDialog.addEventListener('close', () => {
  if (pendingAvatar !== savedAvatar) showAvatar(savedAvatar);
});

document.getElementById('open-feedback-dialog').addEventListener('click', () => {
  feedbackStatus.textContent = '';
  feedbackForm.reset();
  feedbackDialog.showModal();
  feedbackMessage.focus();
});

document.getElementById('close-feedback-dialog').addEventListener('click', () => feedbackDialog.close());

feedbackForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = feedbackMessage.value.trim();
  if (!message || !currentStudentUsername) { feedbackStatus.textContent = translations[currentLanguage].feedbackError; return; }
  try {
    await schoolApi('/api/feedback', { method: 'POST', body: { message } });
    feedbackStatus.textContent = translations[currentLanguage].feedbackSent;
    feedbackForm.reset();
    window.setTimeout(() => feedbackDialog.close(), 1200);
  } catch { feedbackStatus.textContent = translations[currentLanguage].feedbackError; }
});

languageSelect.addEventListener('change', () => {
  currentLanguage = languageSelect.value;
  try { localStorage.setItem('english-school-language', currentLanguage); } catch { /* Language still changes for this session. */ }
  applyLanguage(currentLanguage);
});

logoutButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    try { await schoolApi('/api/auth/logout', { method: 'POST', body: {} }); } catch { /* Reset the page even if the server cannot be reached. */ }
    studentDashboard.hidden = true;
    loginPage.hidden = false;
    currentStudentUsername = '';
    currentStudentName = 'Rudson';
    clearStudentAttachmentUrls();
    if (assignedLessonsSection) assignedLessonsSection.hidden = true;
    if (studentLessonScreen) studentLessonScreen.hidden = true;
    assignedLessonsList.hidden = false;
    currentAssignedLessons = [];
    activeStudentLesson = null;
    document.body.dataset.view = 'login';
    document.body.dataset.role = 'aluno';
    loginPage.dataset.role = 'aluno';
    document.title = 'Login | English School';
    loginForm.reset();
    formMessage.textContent = '';
    selectedRole = 'aluno';

    roleButtons.forEach((roleButton) => {
      const isStudentButton = roleButton.dataset.role === 'aluno';
      roleButton.classList.toggle('active', isStudentButton);
      roleButton.setAttribute('aria-pressed', String(isStudentButton));
    });

    roleDescription.textContent = 'Entre para continuar sua jornada de aprendizado.';
    helpNote.hidden = false;
    updateStudentGameProgressWidget();
    loginInput.focus();
  });
});

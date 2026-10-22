// ============================================================
// STUDY ORDER — APP.JS DEFINITIVO (COMPATÍVEL COM O HTML)
// ============================================================

const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

let currentUser = null;
let currentProfile = null;
let activeAuthMode = 'login'; // 'login' ou 'signup'
let selectedSubjectId = null;

const MOTIVATIONAL_QUOTES = [
  "O sucesso é a soma de pequenos esforços repetidos dia após dia.",
  "Estudar não é acumular memória, é expandir a mente.",
  "A disciplina é a ponte entre seus objetivos e suas realizações.",
  "Acredite no seu processo. Cada hora de estudo conta!"
];

// ------------------------------------------------------------
// 1. INICIALIZAÇÃO E AUTENTICAÇÃO
// ------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  setupAuthTabs();
  setupAuthForm();
  checkUser();
  setupNavigation();
});

// Controlo das abas de Login / Criar Conta baseadas no seu HTML
function setupAuthTabs() {
  const authTabs = document.querySelectorAll('.auth-tab');
  const usernameFieldContainer = document.getElementById('usernameFieldContainer');
  const usernameInput = document.getElementById('usernameInput');
  const authSubmit = document.getElementById('authSubmit');

  if (!authTabs) return;

  authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      authTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      activeAuthMode = tab.dataset.auth; // 'login' ou 'signup'

      if (activeAuthMode === 'signup') {
        if (usernameFieldContainer) usernameFieldContainer.classList.remove('hidden');
        if (usernameInput) usernameInput.required = true;
        if (authSubmit) authSubmit.textContent = 'Criar conta';
      } else {
        if (usernameFieldContainer) usernameFieldContainer.classList.add('hidden');
        if (usernameInput) usernameInput.required = false;
        if (authSubmit) authSubmit.textContent = 'Entrar';
      }
    });
  });
}

// Submissão do Formulário de Autenticação
function setupAuthForm() {
  const authForm = document.getElementById('authForm');
  if (!authForm) return;

  authForm.onsubmit = async (e) => {
    e.preventDefault();

    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const usernameInput = document.getElementById('usernameInput');
    const authMsg = document.getElementById('authMsg');

    const email = emailInput ? emailInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value.trim() : '';
    const username = usernameInput ? usernameInput.value.trim() : '';

    if (!email || !password) {
      if (authMsg) authMsg.textContent = 'Preencha o e-mail e a senha.';
      return;
    }

    if (authMsg) authMsg.textContent = 'A processar...';

    if (activeAuthMode === 'signup') {
      if (!username) {
        if (authMsg) authMsg.textContent = 'Informe o nome de utilizador.';
        return;
      }

      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { username } }
      });

      if (error) {
        if (authMsg) authMsg.textContent = 'Erro ao criar conta: ' + error.message;
        return;
      }

      if (data?.user) {
        await supabaseClient.from('profiles').upsert([
          { id: data.user.id, username, updated_at: new Date() }
        ]);
      }

      if (authMsg) authMsg.textContent = 'Conta criada com sucesso! Faça login.';
      alert('Conta criada com sucesso! Faça login na aba Entrar.');
      location.reload();
    } else {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

      if (error) {
        if (authMsg) authMsg.textContent = 'Erro ao entrar: ' + error.message;
        return;
      }

      checkUser();
    }
  };
}

async function checkUser() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  const authScreen = document.getElementById('authScreen');
  const appScreen = document.getElementById('app');

  if (session) {
    currentUser = session.user;
    await loadProfile();
    if (authScreen) authScreen.classList.add('hidden');
    if (appScreen) appScreen.classList.remove('hidden');
    
    const userEmailEl = document.getElementById('userEmail');
    if (userEmailEl) userEmailEl.textContent = currentUser.email;

    initAppFeatures();
  } else {
    if (authScreen) authScreen.classList.remove('hidden');
    if (appScreen) appScreen.classList.add('hidden');
  }
}

async function loadProfile() {
  if (!currentUser) return;
  const { data } = await supabaseClient.from('profiles').select('*').eq('id', currentUser.id).single();
  if (data) currentProfile = data;
}

// ------------------------------------------------------------
// 2. NAVEGAÇÃO E VIEWS PRINCIPAIS
// ------------------------------------------------------------
function setupNavigation() {
  document.querySelectorAll('.nav-link').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetId = btn.dataset.target;
      document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
      const targetView = document.getElementById(targetId);
      if (targetView) targetView.classList.remove('hidden');

      const breadcrumb = document.getElementById('breadcrumb');
      if (breadcrumb) breadcrumb.textContent = btn.textContent.trim();
    });
  });

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      await supabaseClient.auth.signOut();
      location.reload();
    };
  }
}

function initAppFeatures() {
  loadPosts();
  loadSubjects();
  loadTasks();

  // Criar Post
  const createPostBtn = document.getElementById('createPostBtn');
  if (createPostBtn) {
    createPostBtn.onclick = async () => {
      const content = document.getElementById('postContentInput').value.trim();
      const media_url = document.getElementById('postMediaInput').value.trim();
      if (!content) return;

      const hashtagMatch = content.match(/#[a-zA-Z0-9_]+/);
      const hashtag = hashtagMatch ? hashtagMatch[0].toLowerCase() : null;

      await supabaseClient.from('posts').insert([
        { user_id: currentUser.id, content, media_url: media_url || null, hashtag }
      ]);

      document.getElementById('postContentInput').value = '';
      if (document.getElementById('postMediaInput')) document.getElementById('postMediaInput').value = '';
      loadPosts();
    };
  }

  // Nova Matéria
  const newSubjectBtn = document.getElementById('newSubjectBtn');
  if (newSubjectBtn) {
    newSubjectBtn.onclick = async () => {
      const name = prompt('Nome da Matéria (ex: Matemática, Física):');
      if (!name) return;

      await supabaseClient.from('subjects').insert([{ user_id: currentUser.id, name }]);
      loadSubjects();
    };
  }
}

// ------------------------------------------------------------
// 3. FUNCIONALIDADES DO APP (POSTS, MATÉRIAS, TAREFAS)
// ------------------------------------------------------------
async function loadPosts() {
  const container = document.getElementById('postsList');
  if (!container) return;

  const { data: posts } = await supabaseClient.from('posts').select(`*, profiles:user_id (username)`).order('created_at', { ascending: false });
  container.innerHTML = '';

  if (!posts || posts.length === 0) {
    container.innerHTML = '<p style="color: #737373; padding: 20px;">Nenhuma publicação ainda.</p>';
    return;
  }

  posts.forEach(post => {
    const card = document.createElement('div');
    card.className = 'panel';
    card.style.marginBottom = '14px';

    let mediaRender = '';
    if (post.media_url) {
      mediaRender = `<img src="${post.media_url}" style="width: 100%; max-height: 400px; object-fit: cover; border-radius: 8px; margin-top: 10px;">`;
    }

    card.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 6px; color: var(--accent);">@${post.profiles?.username || 'utilizador'}</div>
      <div style="font-size: 14px; line-height: 1.4;">${escapeHtml(post.content)}</div>
      ${mediaRender}
    `;
    container.appendChild(card);
  });
}

async function loadSubjects() {
  const subjectNav = document.getElementById('subjectNav');
  const subjectCards = document.getElementById('subjectCards');
  if (!subjectNav) return;

  const { data: subjects } = await supabaseClient.from('subjects').select('*').eq('user_id', currentUser.id);
  subjectNav.innerHTML = '';
  if (subjectCards) subjectCards.innerHTML = '';

  if (!subjects || subjects.length === 0) {
    if (subjectNav) subjectNav.innerHTML = '<small style="color: #737373; padding: 6px 12px; display:block;">Nenhuma matéria</small>';
    return;
  }

  subjects.forEach(sub => {
    // Menu lateral
    const navBtn = document.createElement('button');
    navBtn.className = 'side-action';
    navBtn.textContent = `📓 ${sub.name}`;
    navBtn.onclick = () => openSubjectView(sub);
    subjectNav.appendChild(navBtn);

    // Cards do Dashboard
    if (subjectCards) {
      const card = document.createElement('div');
      card.style.cssText = 'background: #121212; border: 1px solid #262626; border-radius: 10px; padding: 14px; cursor: pointer;';
      card.onclick = () => openSubjectView(sub);
      card.innerHTML = `<b style="color: #fff;">${escapeHtml(sub.name)}</b><br><small style="color: #737373;">Ver anotações e tarefas</small>`;
      subjectCards.appendChild(card);
    }
  });
}

function openSubjectView(sub) {
  selectedSubjectId = sub.id;
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  const subjectView = document.getElementById('subjectView');
  if (subjectView) subjectView.classList.remove('hidden');

  const titleEl = document.getElementById('subjectTitle');
  if (titleEl) titleEl.textContent = sub.name;

  loadSubjectDetails(sub.id);
}

async function loadSubjectDetails(subjectId) {
  // Carregar Anotações
  const { data: notesData } = await supabaseClient.from('subjects').select('notes').eq('id', subjectId).single();
  const notesArea = document.getElementById('notes');
  if (notesArea && notesData) notesArea.value = notesData.notes || '';

  const saveNoteBtn = document.getElementById('saveNoteBtn');
  if (saveNoteBtn) {
    saveNoteBtn.onclick = async () => {
      const notes = notesArea.value;
      await supabaseClient.from('subjects').update({ notes }).eq('id', subjectId);
      alert('Anotações salvas com sucesso!');
    };
  }

  // Carregar Tarefas da matéria
  const tasksContainer = document.getElementById('tasks');
  if (tasksContainer) {
    const { data: tasks } = await supabaseClient.from('tasks').select('*').eq('user_id', currentUser.id);
    tasksContainer.innerHTML = '';
    
    if (!tasks || tasks.length === 0) {
      tasksContainer.innerHTML = '<small style="color: #737373;">Nenhuma tarefa pendente.</small>';
      return;
    }

    tasks.forEach(task => {
      const div = document.createElement('div');
      div.style.cssText = 'padding: 8px 0; border-bottom: 1px solid #262626; font-size: 13px; display:flex; justify-content:space-between; align-items:center;';
      div.innerHTML = `<span>${escapeHtml(task.title)}</span> <small style="color:var(--accent);">${task.due_date || ''}</small>`;
      tasksContainer.appendChild(div);
    });
  }
}

async function loadTasks() {
  const upcoming = document.getElementById('upcoming');
  if (!upcoming) return;

  const { data: tasks } = await supabaseClient.from('tasks').select('*').eq('user_id', currentUser.id).limit(5);
  upcoming.innerHTML = '';

  if (!tasks || tasks.length === 0) {
    upcoming.innerHTML = '<p style="color: #737373; font-size: 13px;">Nenhuma tarefa agendada.</p>';
    return;
  }

  tasks.forEach(t => {
    const item = document.createElement('div');
    item.style.cssText = 'padding: 10px 0; border-bottom: 1px solid #262626; font-size: 13px; display:flex; justify-content:space-between;';
    item.innerHTML = `<b>${escapeHtml(t.title)}</b> <span style="color: var(--accent);">${t.due_date || ''}</span>`;
    upcoming.appendChild(item);
  });
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

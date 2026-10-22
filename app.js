// ============================================================
// STUDY ORDER — APP.JS COMPLETO (CORREÇÃO DE MATÉRIAS E COMUNIDADES)
// ============================================================

const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

let currentUser = null;
let currentProfile = null;
let activeAuthMode = 'login';
let selectedSubjectId = null;

const MOTIVATIONAL_QUOTES = [
  "O sucesso é a soma de pequenos esforços repetidos dia após dia.",
  "Estudar não é acumular memória, é expandir a mente.",
  "A disciplina é a ponte entre seus objetivos e suas realizações.",
  "Acredite no seu processo. Cada hora de estudo conta!"
];

// ------------------------------------------------------------
// 1. AUTENTICAÇÃO E SESSÃO
// ------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  setupAuthTabs();
  setupAuthForm();
  checkUser();
  setupNavigation();
});

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
      activeAuthMode = tab.dataset.auth;

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
        if (authMsg) authMsg.textContent = 'Erro: ' + error.message;
        return;
      }

      if (data?.user) {
        await supabaseClient.from('profiles').upsert([
          { id: data.user.id, username, updated_at: new Date() }
        ]);
      }

      alert('Conta criada com sucesso! Faça login.');
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
// 2. NAVEGAÇÃO ENTRE ABAS DO APP
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
  loadGroups();

  // Criar Post no Feed
  const createPostBtn = document.getElementById('createPostBtn');
  if (createPostBtn) {
    createPostBtn.onclick = async () => {
      const content = document.getElementById('postContentInput').value.trim();
      const media_url = document.getElementById('postMediaInput').value.trim();
      if (!content) return;

      await supabaseClient.from('posts').insert([
        { user_id: currentUser.id, content, media_url: media_url || null }
      ]);

      document.getElementById('postContentInput').value = '';
      if (document.getElementById('postMediaInput')) document.getElementById('postMediaInput').value = '';
      loadPosts();
    };
  }

  // Nova Matéria (Botões da barra lateral e do dashboard)
  const handleNewSubject = async () => {
    const name = prompt('Nome da Matéria (ex: Matemática, Física, Biologia):');
    if (!name) return;

    await supabaseClient.from('subjects').insert([{ user_id: currentUser.id, name }]);
    loadSubjects();
  };

  const newSubjectBtn = document.getElementById('newSubjectBtn');
  const addSubject2 = document.getElementById('addSubject2');
  if (newSubjectBtn) newSubjectBtn.onclick = handleNewSubject;
  if (addSubject2) addSubject2.onclick = handleNewSubject;

  // Criar Grupo / Comunidade
  const createGroupBtn = document.getElementById('createGroupBtn');
  if (createGroupBtn) {
    createGroupBtn.onclick = async () => {
      const name = prompt('Nome da Comunidade / Grupo de Estudo:');
      if (!name) return;

      // Cria a tabela de grupos caso não exista ou insere diretamente
      await supabaseClient.from('groups').insert([{ user_id: currentUser.id, name }]);
      loadGroups();
    };
  }
}

// ------------------------------------------------------------
// 3. MATÉRIAS E PASTAS DE ESTUDO (FUNCIONAMENTO COMPLETO)
// ------------------------------------------------------------
async function loadSubjects() {
  const subjectNav = document.getElementById('subjectNav');
  const subjectCards = document.getElementById('subjectCards');
  if (!subjectNav) return;

  const { data: subjects } = await supabaseClient.from('subjects').select('*').eq('user_id', currentUser.id);
  subjectNav.innerHTML = '';
  if (subjectCards) subjectCards.innerHTML = '';

  if (!subjects || subjects.length === 0) {
    subjectNav.innerHTML = '<small style="color: #737373; padding: 6px 12px; display:block;">Nenhuma matéria</small>';
    if (subjectCards) subjectCards.innerHTML = '<p style="color: #737373; font-size: 13px;">Nenhuma matéria cadastrada.</p>';
    return;
  }

  subjects.forEach(sub => {
    // Adiciona na barra lateral esquerda ("MINHAS MATÉRIAS")
    const navBtn = document.createElement('button');
    navBtn.className = 'side-action';
    navBtn.textContent = `📓 ${sub.name}`;
    navBtn.onclick = () => openSubjectView(sub);
    subjectNav.appendChild(navBtn);

    // Adiciona nos cards do Dashboard ("Meus Estudos")
    if (subjectCards) {
      const card = document.createElement('div');
      card.style.cssText = 'background: #121212; border: 1px solid #262626; border-radius: 10px; padding: 14px; cursor: pointer; transition: 0.2s;';
      card.onclick = () => openSubjectView(sub);
      card.innerHTML = `<b style="color: #fff; font-size: 15px;">${escapeHtml(sub.name)}</b><br><small style="color: #38bdf8;">Ver anotações e tarefas</small>`;
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
  // Anotações da Matéria
  const { data: subData } = await supabaseClient.from('subjects').select('notes').eq('id', subjectId).single();
  const notesArea = document.getElementById('notes');
  if (notesArea && subData) notesArea.value = subData.notes || '';

  const saveNoteBtn = document.getElementById('saveNoteBtn');
  if (saveNoteBtn) {
    saveNoteBtn.onclick = async () => {
      const notes = notesArea.value;
      await supabaseClient.from('subjects').update({ notes }).eq('id', subjectId);
      alert('Anotações salvas com sucesso!');
    };
  }

  // Excluir Matéria
  const deleteSubjectBtn = document.getElementById('deleteSubjectBtn');
  if (deleteSubjectBtn) {
    deleteSubjectBtn.onclick = async () => {
      if (confirm('Tem certeza que deseja excluir esta matéria?')) {
        await supabaseClient.from('subjects').delete().eq('id', subjectId);
        document.querySelector('[data-target="dashboard"]').click();
        loadSubjects();
      }
    };
  }
}

// ------------------------------------------------------------
// 4. COMUNIDADES E GRUPOS DE ESTUDO
// ------------------------------------------------------------
async function loadGroups() {
  const groupsList = document.getElementById('groupsList');
  if (!groupsList) return;

  const { data: groups, error } = await supabaseClient.from('groups').select('*').order('created_at', { ascending: false });
  
  if (error) {
    groupsList.innerHTML = '<p style="color: #737373; font-size: 13px;">Para usar os grupos, certifique-se de criar a tabela "groups" no Supabase.</p>';
    return;
  }

  groupsList.innerHTML = '';
  if (!groups || groups.length === 0) {
    groupsList.innerHTML = '<p style="color: #737373; padding: 20px;">Nenhum grupo de estudo ativo no momento. Crie o primeiro acima!</p>';
    return;
  }

  groups.forEach(group => {
    const card = document.createElement('div');
    card.className = 'panel';
    card.style.marginBottom = '12px';
    card.innerHTML = `
      <h3 style="color: var(--accent); margin-bottom: 4px;">👥 ${escapeHtml(group.name)}</h3>
      <p style="font-size: 13px; color: #a8a8a8;">Grupo de estudo ativo para troca de materiais e foco em grupo.</p>
    `;
    groupsList.appendChild(card);
  });
}

// ------------------------------------------------------------
// 5. TAREFAS E FEED
// ------------------------------------------------------------
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

async function loadPosts() {
  const container = document.getElementById('postsList');
  if (!container) return;

  const { data: posts } = await supabaseClient.from('posts').select(`*, profiles:user_id (username)`).order('created_at', { ascending: false });
  container.innerHTML = '';

  if (!posts || posts.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #737373; padding: 40px 0;">Nenhuma publicação ainda.</p>';
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

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}v

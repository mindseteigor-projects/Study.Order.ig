// ============================================================
// STUDY ORDER — LÓGICA PRINCIPAL (SUPABASE + REDE SOCIAL)
// ============================================================

const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentProfile = null;
let authMode = 'login';

// Elementos de Autenticação
const authScreen = document.getElementById('authScreen');
const appScreen = document.getElementById('app');
const authForm = document.getElementById('authForm');
const authTabs = document.querySelectorAll('.auth-tab');
const usernameFieldContainer = document.getElementById('usernameFieldContainer');
const authSubmit = document.getElementById('authSubmit');
const authMsg = document.getElementById('authMsg');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const usernameInput = document.getElementById('usernameInput');

// Alternar entre Login e Cadastro
authTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    authTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    authMode = tab.dataset.auth;
    if (authMode === 'signup') {
      usernameFieldContainer.classList.remove('hidden');
      usernameInput.required = true;
      authSubmit.textContent = 'Criar conta';
    } else {
      usernameFieldContainer.classList.add('hidden');
      usernameInput.required = false;
      authSubmit.textContent = 'Entrar';
    }
  });
});

// Gestão de Sessão ao Iniciar
async function checkUser() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    currentUser = session.user;
    await loadProfile();
    authScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
    initApp();
  } else {
    authScreen.classList.remove('hidden');
    appScreen.classList.add('hidden');
  }
}

async function loadProfile() {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .single();
  
  if (data) {
    currentProfile = data;
    document.getElementById('userEmail').textContent = `@${data.username}`;
    if (data.is_admin) {
      document.getElementById('adminPanelBtn').classList.remove('hidden');
    }
  }
}

// Submeter Formulário de Autenticação
authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authMsg.textContent = 'A processar...';
  
  const email = emailInput.value;
  const password = passwordInput.value;

  if (authMode === 'signup') {
    const username = usernameInput.value.trim();
    
    // Validação atualizada: aceita letras, números, _, -, #, *, @ e .
    const usernameRegex = /^[a-zA-Z0-9_\-#*@\.]+$/;
    if (!usernameRegex.test(username)) {
      authMsg.textContent = 'Nome de utilizador inválido. Use apenas letras, números, _, -, #, *, @ e .';
      return;
    }

    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) {
      authMsg.textContent = error.message;
      return;
    }

    if (data.user) {
      const { error: profileError } = await supabaseClient.from('profiles').insert([
        { id: data.user.id, username: username, full_name: username }
      ]);
      if (profileError) {
        authMsg.textContent = 'Erro ao criar perfil: ' + profileError.message;
        return;
      }
    }
    authMsg.textContent = 'Conta criada com sucesso!';
    checkUser();
  } else {
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      authMsg.textContent = error.message;
      return;
    }
    checkUser();
  }
});

// Navegação do Menu Lateral
document.querySelectorAll('.nav-link').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.content .view').forEach(v => v.classList.add('hidden'));
    
    btn.classList.add('active');
    const targetView = document.getElementById(btn.dataset.target);
    if (targetView) targetView.classList.remove('hidden');
    document.getElementById('breadcrumb').textContent = btn.textContent.trim();
  });
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  location.reload();
});

// --- FUNCIONALIDADES DO FEED & POSTS ---
async function loadPosts() {
  const postsList = document.getElementById('postsList');
  if (!postsList) return;

  const { data: posts, error } = await supabaseClient
    .from('posts')
    .select(`
      *,
      profiles:user_id (username, avatar_url)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao carregar posts:', error);
    return;
  }

  postsList.innerHTML = '';
  if (!posts || posts.length === 0) {
    postsList.innerHTML = '<p class="muted">Ainda não há publicações. Seja o primeiro a partilhar algo!</p>';
    return;
  }

  posts.forEach(post => {
    const profile = post.profiles || { username: 'estudante' };
    const dateFormatted = new Date(post.created_at).toLocaleString('pt-BR');
    
    const card = document.createElement('div');
    card.className = 'panel';
    card.style.marginBottom = '12px';
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <b>@${profile.username}</b>
        <small class="muted">${dateFormatted}</small>
      </div>
      <p style="margin: 0 0 10px 0; font-size: 13px; line-height: 1.5;">${escapeHtml(post.content)}</p>
      ${post.media_url ? `<img src="${post.media_url}" style="max-width:100%; border-radius:8px; margin-top:8px;" alt="Mídia do post">` : ''}
    `;
    postsList.appendChild(card);
  });
}

// Criar Novo Post
document.getElementById('createPostBtn')?.addEventListener('click', async () => {
  const contentInput = document.getElementById('postContentInput');
  const mediaInput = document.getElementById('postMediaInput');
  const content = contentInput.value.trim();
  const media_url = mediaInput.value.trim();

  if (!content) return;

  const { error } = await supabaseClient.from('posts').insert([
    { user_id: currentUser.id, content, media_url: media_url || null }
  ]);

  if (error) {
    alert('Erro ao publicar: ' + error.message);
  } else {
    contentInput.value = '';
    mediaInput.value = '';
    loadPosts();
  }
});

// --- GRUPOS E COMUNIDADES ---
async function loadGroups() {
  const groupsList = document.getElementById('groupsList');
  if (!groupsList) return;

  const { data: groups, error } = await supabaseClient
    .from('study_groups')
    .select(`
      *,
      profiles:created_by (username)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao carregar grupos:', error);
    return;
  }

  groupsList.innerHTML = '';
  if (!groups || groups.length === 0) {
    groupsList.innerHTML = '<p class="muted">Nenhum grupo criado ainda. Crie o primeiro!</p>';
    return;
  }

  groups.forEach(group => {
    const creator = group.profiles ? group.profiles.username : 'admin';
    const card = document.createElement('div');
    card.className = 'panel';
    card.style.marginBottom = '12px';
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h3 style="margin:0; font-size:15px;">${escapeHtml(group.name)}</h3>
        <small class="muted">${group.is_private ? '🔒 Privado (PRO)' : '🌐 Público'}</small>
      </div>
      <p style="color:var(--muted); font-size:12px; margin:6px 0 10px 0;">${escapeHtml(group.description || 'Sem descrição')}</p>
      <small style="color:var(--muted);">Criado por @${creator}</small>
    `;
    groupsList.appendChild(card);
  });
}

// Criar Grupo
document.getElementById('createGroupBtn')?.addEventListener('click', async () => {
  const name = prompt('Nome do Grupo ou Comunidade:');
  if (!name) return;
  const description = prompt('Descrição breve do grupo:') || '';

  const { error } = await supabaseClient.from('study_groups').insert([
    { name, description, created_by: currentUser.id, is_private: false }
  ]);

  if (error) {
    alert('Erro ao criar grupo: ' + error.message);
  } else {
    loadGroups();
  }
});

// Função Utilitária Anti-XSS
function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Inicialização Geral da Aplicação
function initApp() {
  console.log('Study Order pronto!');
  loadPosts();
  loadGroups();
}

// Iniciar verificação de utilizador
checkUser();

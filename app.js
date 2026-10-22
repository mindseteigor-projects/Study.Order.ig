// ============================================================
// STUDY ORDER — APP.JS COMPLETO (CORREÇÃO DE CLIQUE NOS GRUPOS)
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
let activeGroupId = null;

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
// 2. NAVEGAÇÃO ENTRE ABAS
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

      // Se voltar para a aba de grupos, recarrega a lista de grupos
      if (targetId === 'groupsView') {
        loadGroups();
      }
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

  const handleNewSubject = async () => {
    const name = prompt('Nome da Matéria (ex: Matemática, Física):');
    if (!name) return;

    await supabaseClient.from('subjects').insert([{ user_id: currentUser.id, name }]);
    loadSubjects();
  };

  const newSubjectBtn = document.getElementById('newSubjectBtn');
  const addSubject2 = document.getElementById('addSubject2');
  if (newSubjectBtn) newSubjectBtn.onclick = handleNewSubject;
  if (addSubject2) addSubject2.onclick = handleNewSubject;

  const createGroupBtn = document.getElementById('createGroupBtn');
  if (createGroupBtn) {
    createGroupBtn.onclick = async () => {
      const name = prompt('Nome do Grupo de Estudo (ex: Foco em Redação):');
      if (!name) return;

      await supabaseClient.from('groups').insert([{ user_id: currentUser.id, name }]);
      loadGroups();
    };
  }
}

// ------------------------------------------------------------
// 3. MATÉRIAS
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
    const navBtn = document.createElement('button');
    navBtn.className = 'side-action';
    navBtn.textContent = `📓 ${sub.name}`;
    navBtn.onclick = () => openSubjectView(sub);
    subjectNav.appendChild(navBtn);

    if (subjectCards) {
      const card = document.createElement('div');
      card.style.cssText = 'background: #121212; border: 1px solid #262626; border-radius: 10px; padding: 14px; cursor: pointer;';
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
// 4. GRUPOS E COMUNIDADES (CHAT ESTILO WHATSAPP)
// ------------------------------------------------------------
async function loadGroups() {
  const groupsList = document.getElementById('groupsList');
  if (!groupsList) return;

  const { data: groups, error } = await supabaseClient.from('groups').select('*').order('created_at', { ascending: false });
  
  if (error) {
    groupsList.innerHTML = '<p style="color: #737373; font-size: 13px;">Crie a tabela "groups" no SQL Editor do Supabase primeiro.</p>';
    return;
  }

  groupsList.innerHTML = '';
  if (!groups || groups.length === 0) {
    groupsList.innerHTML = '<p style="color: #737373; padding: 20px;">Nenhum grupo criado. Crie o primeiro acima!</p>';
    return;
  }

  groups.forEach(group => {
    const card = document.createElement('div');
    card.className = 'panel';
    card.style.cssText = 'margin-bottom: 12px; cursor: pointer; border: 1px solid #262626; transition: 0.2s;';
    
    // Atribui o evento de clique diretamente ao card do grupo
    card.onclick = () => openGroupChat(group);

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h3 style="color: var(--accent); margin-bottom: 4px;">👥 ${escapeHtml(group.name)}</h3>
          <p style="font-size: 13px; color: #a8a8a8; margin: 0;">Clique para abrir o chat e trocar mensagens no grupo.</p>
        </div>
        <button class="primary" style="padding: 6px 14px; font-size: 12px;" onclick="event.stopPropagation(); openGroupChat({id: '${group.id}', name: '${group.name}'})">Entrar no Grupo</button>
      </div>
    `;
    groupsList.appendChild(card);
  });
}

function openGroupChat(group) {
  activeGroupId = group.id;
  const groupsList = document.getElementById('groupsList');
  if (!groupsList) return;
  
  groupsList.innerHTML = `
    <div class="panel" style="display: flex; flex-direction: column; height: 65vh; padding: 0; overflow: hidden; background: #0b0b0f;">
      <div style="padding: 16px; background: #16161f; border-bottom: 1px solid #262626; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h3 style="margin: 0; color: var(--accent);">👥 ${escapeHtml(group.name)}</h3>
          <small style="color: #22c55e;">● Chat ao vivo (Estilo WhatsApp)</small>
        </div>
        <button onclick="loadGroups()" style="background: #262626; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer;">← Voltar aos Grupos</button>
      </div>

      <div id="chatMessages" style="flex: 1; padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px;">
        <p style="color: #737373; text-align: center;">A carregar mensagens...</p>
      </div>

      <div style="padding: 12px 16px; background: #16161f; border-top: 1px solid #262626; display: flex; gap: 10px;">
        <input type="text" id="chatInput" placeholder="Escreva uma mensagem para o grupo..." style="flex: 1; background: #101017; color: white; border: 1px solid #353542; border-radius: 8px; padding: 10px; outline: none;" onkeydown="if(event.key === 'Enter') sendGroupMessage()">
        <button onclick="sendGroupMessage()" class="primary" style="padding: 0 20px;">Enviar</button>
      </div>
    </div>
  `;

  loadGroupMessages(group.id);
}

async function loadGroupMessages(groupId) {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  const { data: messages } = await supabaseClient
    .from('group_messages')
    .select('*, profiles:user_id (username)')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true });

  container.innerHTML = '';
  if (!messages || messages.length === 0) {
    container.innerHTML = '<p style="color: #737373; text-align: center; margin: auto;">Nenhuma mensagem neste grupo ainda. Seja o primeiro a enviar!</p>';
    return;
  }

  messages.forEach(msg => {
    const isMe = msg.user_id === currentUser.id;
    const msgDiv = document.createElement('div');
    msgDiv.style.cssText = `max-width: 70%; padding: 10px 14px; border-radius: 10px; font-size: 13px; align-self: ${isMe ? 'flex-end' : 'flex-start'}; background: ${isMe ? '#2563eb' : '#1f1f2e'}; color: white; word-break: break-word;`;
    
    msgDiv.innerHTML = `
      <div style="font-size: 11px; font-weight: bold; color: ${isMe ? '#93c5fd' : '#38bdf8'}; margin-bottom: 2px;">@${msg.profiles?.username || 'utilizador'}</div>
      <div>${escapeHtml(msg.content)}</div>
    `;
    container.appendChild(msgDiv);
  });

  container.scrollTop = container.scrollHeight;
}

window.sendGroupMessage = async function() {
  if (!activeGroupId) return;
  const input = document.getElementById('chatInput');
  const content = input ? input.value.trim() : '';
  if (!content) return;

  await supabaseClient.from('group_messages').insert([
    { group_id: activeGroupId, user_id: currentUser.id, content }
  ]);

  input.value = '';
  loadGroupMessages(activeGroupId);
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
}

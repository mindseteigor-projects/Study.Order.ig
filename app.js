// ============================================================
// STUDY ORDER — APP.JS COMPLETO E FUNCIONAL
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
let messageSubscription = null;
let feedSubscription = null;
let tasksSubscription = null;
let subjectContentsSubscription = null;
let selectedPostFileUrl = null;

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

    try {
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

        if (error) throw error;

        if (data?.user) {
          try {
            await supabaseClient.from('profiles').upsert([
              { id: data.user.id, username, updated_at: new Date() }
            ]);
          } catch (pErr) {
            console.warn("Aviso ao criar perfil inicial:", pErr);
          }
        }

        alert('Conta criada com sucesso! Faça login.');
        location.reload();
      } else {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        if (data?.session) {
          currentUser = data.session.user;
          showAppScreen();
          loadProfile();
          initAppFeatures();
        } else {
          await checkUser();
        }
      }
    } catch (err) {
      console.error("Erro na autenticação:", err);
      if (authMsg) authMsg.textContent = 'Erro: ' + (err.message || 'Falha na autenticação.');
    }
  };
}

async function checkUser() {
  try {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error) throw error;

    if (session && session.user) {
      currentUser = session.user;
      showAppScreen();
      loadProfile();
      initAppFeatures();
    } else {
      showAuthScreen();
    }
  } catch (err) {
    console.error("Erro ao verificar sessão:", err);
    showAuthScreen();
  }
}

function showAppScreen() {
  const authScreen = document.getElementById('authScreen');
  const appScreen = document.getElementById('app');
  if (authScreen) authScreen.classList.add('hidden');
  if (appScreen) appScreen.classList.remove('hidden');

  const userEmailEl = document.getElementById('userEmail');
  if (userEmailEl && currentUser) userEmailEl.textContent = currentUser.email;
}

function showAuthScreen() {
  const authScreen = document.getElementById('authScreen');
  const appScreen = document.getElementById('app');
  if (authScreen) authScreen.classList.remove('hidden');
  if (appScreen) appScreen.classList.add('hidden');
}

async function loadProfile() {
  if (!currentUser) return;
  try {
    const { data } = await supabaseClient.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
    if (data) {
      currentProfile = data;
    } else {
      currentProfile = { id: currentUser.id, username: currentUser.email.split('@')[0] };
    }
  } catch (err) {
    console.warn("Erro ao carregar perfil:", err);
    currentProfile = { id: currentUser.id, username: currentUser.email.split('@')[0] };
  }
}

function setupNavigation() {
  document.querySelectorAll('.nav-link').forEach(btn => {
    btn.addEventListener('click', () => {
      if (messageSubscription) {
        supabaseClient.removeChannel(messageSubscription);
        messageSubscription = null;
      }
      activeGroupId = null;

      document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetId = btn.dataset.target;
      document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
      const targetView = document.getElementById(targetId);
      if (targetView) targetView.classList.remove('hidden');

      const breadcrumb = document.getElementById('breadcrumb');
      if (breadcrumb) breadcrumb.textContent = btn.textContent.trim();

      if (targetId === 'groupsView') {
        loadGroups();
      } else if (targetId === 'allTasksView') {
        loadAllTasksView();
      } else if (targetId === 'feedView') {
        loadPosts();
      }
    });
  });

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      if (messageSubscription) supabaseClient.removeChannel(messageSubscription);
      if (feedSubscription) supabaseClient.removeChannel(feedSubscription);
      if (tasksSubscription) supabaseClient.removeChannel(tasksSubscription);
      if (subjectContentsSubscription) supabaseClient.removeChannel(subjectContentsSubscription);
      await supabaseClient.auth.signOut();
      localStorage.clear();
      location.reload();
    };
  }
}

function initAppFeatures() {
  loadPosts();
  setupRealtimeFeed();
  loadSubjects();
  loadTasks();
  loadGroups();
  setupRealtimeGlobalTasks();

  const postFileInput = document.getElementById('postFileInput');
  if (postFileInput) {
    postFileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      alert('A carregar imagem para o post...');
      const fileExt = file.name.split('.').pop();
      const fileName = `feed_${Date.now()}.${fileExt}`;
      const filePath = `posts/${fileName}`;  const { error: uploadError } = await supabaseClient.storage.from('imagens').upload(filePath, file); if (uploadError) { alert('Erro ao enviar imagem: ' + uploadError.message); return; }  const { data: urlData } = supabaseClient.storage.from('imagens').getPublicUrl(filePath); selectedPostFileUrl = urlData.publicUrl; alert('Imagem pronta para publicar!'); }; }  const createPostBtn = document.getElementById('createPostBtn'); if (createPostBtn) { createPostBtn.onclick = async () => { const content = document.getElementById('postContentInput').value.trim(); const mediaInputUrl = document.getElementById('postMediaInput').value.trim(); const finalMediaUrl = selectedPostFileUrl \vert{}\vert{} mediaInputUrl \vert{}\vert{} null;  if (!content && !finalMediaUrl) return;  const { error } = await supabaseClient.from('posts').insert([ { user_id: currentUser.id, content, media_url: finalMediaUrl, media_type: 'image' } ]);  if (error) { alert('Erro ao publicar: ' + error.message); return; }  document.getElementById('postContentInput').value = ''; if (document.getElementById('postMediaInput')) document.getElementById('postMediaInput').value = ''; selectedPostFileUrl = null; loadPosts(); }; }  const handleNewSubject = async () => { const name = prompt('Nome da Matéria (ex: Matemática, Física):'); if (!name) return;  await supabaseClient.from('subjects').insert([{ user_id: currentUser.id, name }]); loadSubjects(); };  const newSubjectBtn = document.getElementById('newSubjectBtn'); const addSubject2 = document.getElementById('addSubject2'); if (newSubjectBtn) newSubjectBtn.onclick = handleNewSubject; if (addSubject2) addSubject2.onclick = handleNewSubject;  const createGroupBtn = document.getElementById('createGroupBtn'); if (createGroupBtn) { createGroupBtn.onclick = async () => { const name = prompt('Nome do Grupo de Estudo:'); if (!name) return;  await supabaseClient.from('groups').insert([{ user_id: currentUser.id, name }]); loadGroups(); }; }  const globalNewTaskBtn = document.getElementById('globalNewTaskBtn'); if (globalNewTaskBtn) { globalNewTaskBtn.onclick = async () => { const title = prompt('Nome da prova, lembrete ou tarefa:'); if (!title) return; const due_date = prompt('Data de entrega (AAAA-MM-DD):', new Date().toISOString().split('T')[0]);  const { error } = await supabaseClient.from('tasks').insert([ { user_id: currentUser.id, title, due_date } ]);  if (error) { alert('Erro ao criar tarefa: ' + error.message); } else { loadTasks(); loadAllTasksView(); } }; } }  // Matérias e Detalhes async function loadSubjects() { const subjectNav = document.getElementById('subjectNav'); const subjectCards = document.getElementById('subjectCards'); if (!subjectNav) return;  const { data: subjects } = await supabaseClient.from('subjects').select('*').eq('user_id', currentUser.id); subjectNav.innerHTML = ''; if (subjectCards) subjectCards.innerHTML = '';  if (!subjects \vert{}\vert{} subjects.length === 0) { subjectNav.innerHTML = '<small style="color: #737373; padding: 6px 12px; display:block;">Nenhuma matéria</small>'; if (subjectCards) subjectCards.innerHTML = '<p style="color: #737373; font-size: 13px;">Nenhuma matéria cadastrada.</p>'; return; }  subjects.forEach(sub => { const navBtn = document.createElement('button'); navBtn.className = 'side-action'; navBtn.textContent = `📓 ${sub.name}`;
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
      if (confirm('Deseja excluir esta matéria?')) {
        await supabaseClient.from('subjects').delete().eq('id', subjectId);
        document.querySelector('[data-target="dashboard"]').click();
        loadSubjects();
      }
    };
  }

  loadSubjectTasks(subjectId);
  loadSubjectLinksAndFiles(subjectId);
}

async function loadSubjectTasks(subjectId) {
  const tasksContainer = document.getElementById('tasks');
  if (!tasksContainer) return;

  const { data: tasks } = await supabaseClient.from('tasks').select('*').eq('subject_id', subjectId);
  tasksContainer.innerHTML = '';
  if (!tasks || tasks.length === 0) {
    tasksContainer.innerHTML = '<small style="color: #737373;">Nenhuma tarefa pendente.</small>';
  } else {
    tasks.forEach(task => {
      const div = document.createElement('div');
      div.style.cssText = 'padding: 8px 0; border-bottom: 1px solid #262626; font-size: 13px; display:flex; justify-content:space-between; align-items:center;';
      div.innerHTML = `
        <span><b>${escapeHtml(task.title)}</b> <small style="color:var(--accent);">(${task.due_date || 'Sem data'})</small></span>
        <button onclick="deleteTask('${task.id}')" style="background:transparent; border:none; color:#ef4444; cursor:pointer; font-size:14px;">✕</button>
      `;
      tasksContainer.appendChild(div);
    });
  }
}

async function loadSubjectLinksAndFiles(subjectId) {
  const linksContainer = document.getElementById('links');
  const filesContainer = document.getElementById('files');

  const { data: contents } = await supabaseClient.from('subject_contents').select('*').eq('subject_id', subjectId);
  
  if (linksContainer) {
    linksContainer.innerHTML = '';
    const links = contents?.filter(c => c.type === 'link' || c.type === 'video') || [];
    if (links.length === 0) {
      linksContainer.innerHTML = '<small style="color: #737373;">Nenhum link adicionado.</small>';
    } else {
      links.forEach(l => {
        const div = document.createElement('div');
        div.style.cssText = 'padding: 8px 0; font-size: 13px; border-bottom: 1px solid #262626; display:flex; justify-content:space-between; align-items:center;';
        div.innerHTML = `<a href="${l.url}" target="_blank" style="color: var(--accent); text-decoration: none; word-break: break-all; flex: 1;">🔗 ${escapeHtml(l.title)}</a>`;
        linksContainer.appendChild(div);
      });
    }
  }

  if (filesContainer) {
    filesContainer.innerHTML = '';
    const files = contents?.filter(c => c.type === 'file' || c.type === 'image') || [];
    if (files.length === 0) {
      filesContainer.innerHTML = '<small style="color: #737373;">Nenhum arquivo enviado.</small>';
    } else {
      files.forEach(f => {
        const div = document.createElement('div');
        div.style.cssText = 'padding: 8px 0; border-bottom: 1px solid #262626;';
        div.innerHTML = `<a href="${f.url}" target="_blank" style="color: #38bdf8; text-decoration: none; word-break: break-all;">📄 ${escapeHtml(f.title)}</a>`;
        filesContainer.appendChild(div);
      });
    }
  }
}

// Tarefas Globais
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
    item.style.cssText = 'padding: 10px 0; border-bottom: 1px solid #262626; font-size: 13px; display:flex; justify-content:space-between; align-items:center; gap: 10px;';
    item.innerHTML = `
      <div style="word-break: break-all; flex: 1;"><b>${escapeHtml(t.title)}</b></div>
      <span style="color: var(--accent); flex-shrink: 0;">${t.due_date || ''}</span>
    `;
    upcoming.appendChild(item);
  });
}

async function loadAllTasksView() {
  const container = document.getElementById('globalTasksList');
  if (!container) return;

  const { data: tasks, error } = await supabaseClient
    .from('tasks')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('due_date', { ascending: true });

  container.innerHTML = '';

  if (error || !tasks || tasks.length === 0) {
    container.innerHTML = '<p style="color: #737373; padding: 20px;">Nenhuma prova ou tarefa registada.</p>';
    return;
  }

  tasks.forEach(task => {
    const card = document.createElement('div');
    card.className = 'panel';
    card.style.cssText = 'margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; gap: 15px; background: #121216; border: 1px solid #262626; border-radius: 8px; padding: 14px;';
    card.innerHTML = `
      <div style="flex: 1; word-break: break-all;">
        <h3 style="color: var(--accent); margin-bottom: 4px; font-size: 15px;">${escapeHtml(task.title)}</h3>
        <p style="font-size: 12px; color: #a8a8a8; margin: 0;">Data de Entrega / Prova: <b>${task.due_date || 'Não definida'}</b></p>
      </div>
      <button onclick="deleteTask('${task.id}')" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; flex-shrink: 0;">Excluir</button>
    `;
    container.appendChild(card);
  });
}

window.deleteTask = async function(taskId) {
  if (confirm('Deseja excluir esta tarefa?')) {
    await supabaseClient.from('tasks').delete().eq('id', taskId);
    loadTasks();
    loadAllTasksView();
  }
};

function setupRealtimeGlobalTasks() {
  if (tasksSubscription) supabaseClient.removeChannel(tasksSubscription);
  tasksSubscription = supabaseClient.channel('public:tasks_realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
    loadTasks();
    loadAllTasksView();
  }).subscribe();
}

// Feed de Posts
async function loadPosts() {
  const container = document.getElementById('postsList');
  if (!container) return;

  const { data: posts } = await supabaseClient.from('posts').select(`*, profiles:user_id (username)`).order('created_at', { ascending: false });
  container.innerHTML = '';

  if (!posts || posts.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #737373; padding: 40px 0;">Nenhuma publicação ainda.</p>';
    return;
  }

  posts.forEach(post => renderPostCard(post));
}

function renderPostCard(post) {
  const container = document.getElementById('postsList');
  if (!container) return;

  const card = document.createElement('div');
  card.className = 'panel';
  card.style.marginBottom = '14px';

  let mediaRender = '';
  if (post.media_url && post.media_url.trim() !== '') {
    mediaRender = `
      <div style="margin-top: 12px; width: 100%; max-height: 450px; overflow: hidden; border-radius: 8
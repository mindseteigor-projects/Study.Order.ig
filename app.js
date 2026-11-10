// ============================================================
// STUDY ORDER — APP.JS (COMPLETO E ATUALIZADO)
// ============================================================

const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;

let supabaseClient = null;
try {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
} catch (err) {
  console.error("Erro ao inicializar Supabase Client:", err);
}

let currentUser = null;
let currentProfile = null;
let activeAuthMode = 'login';
let selectedSubjectId = null;
let activeGroupId = null;
let activeDmUserId = null;
let messageSubscription = null;
let dmSubscription = null;
let requestSubscription = null;
let feedSubscription = null;
let tasksSubscription = null;
let subjectContentsSubscription = null;
let selectedPostFileUrl = null;
let selectedGroupFileUrl = null;
let selectedGroupFileType = null;
let isAdminAuthenticated = false;

document.addEventListener('DOMContentLoaded', () => {
  setupAuthTabs();
  setupAuthForm();
  checkUser();
  setupNavigation();
  setupProfileNavigation();
  setupNotificationsNavigation();
  setupSecretAdminShortcut();
  handleInternalHashNavigation();
});

function handleInternalHashNavigation() {
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash;
    if (hash.startsWith('#post-')) {
      const postId = hash.replace('#post-', '');
      document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
      const feedView = document.getElementById('feedView');
      if (feedView) feedView.classList.remove('hidden');
      
      document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
      const feedNav = document.querySelector('[data-target="feedView"]');
      if (feedNav) feedNav.classList.add('active');

      setTimeout(() => {
        const postCard = document.getElementById(`post-${postId}`);
        if (postCard) {
          postCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          postCard.style.border = '2px solid var(--accent)';
          setTimeout(() => postCard.style.border = '', 3000);
        }
      }, 500);
    }
  });
}

function setupSecretAdminShortcut() {
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      promptAdminAccess();
    }
  });
  window.openAdmin = promptAdminAccess;
}

async function promptAdminAccess() {
  if (isAdminAuthenticated) {
    renderAdminView();
    return;
  }

  const pass = prompt('🔐 [ADMIN MASTER] Insira a palavra-passe de administrador:');
  if (!pass) return;

  if (pass !== 'admin123') {
    alert('❌ Palavra-passe incorreta!');
    return;
  }

  const token = prompt('📱 [VERIFICAÇÃO DE SEGURANÇA] Insira o seu PIN de 6 dígitos de administrador:');
  if (!token || token.trim() !== '123456') {
    alert('❌ Código de verificação incorreto ou inválido.');
    return;
  }

  isAdminAuthenticated = true;
  alert('✅ Acesso concedido ao Painel do Administrador!');
  renderAdminView();
}

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
  const authSubmit = document.getElementById('authSubmit');
  const authMsg = document.getElementById('authMsg');

  if (!authSubmit) return;

  const executeLoginOrSignup = async () => {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const usernameInput = document.getElementById('usernameInput');

    const email = emailInput ? emailInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value.trim() : '';
    const username = usernameInput ? usernameInput.value.trim() : '';

    if (!email || !password) {
      if (authMsg) authMsg.textContent = 'Preencha o e-mail e a senha.';
      return;
    }

    if (!supabaseClient) {
      if (authMsg) authMsg.textContent = 'Erro de inicialização do cliente Supabase.';
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
          await supabaseClient.from('profiles').upsert([
            { id: data.user.id, username, role: 'user', is_pro: false, updated_at: new Date() }
          ]).catch(() => {});
        }

        alert('Conta criada com sucesso! Faça login.');
        location.reload();
      } else {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        if (data?.session || data?.user) {
          currentUser = data.session ? data.session.user : data.user;
          showAppScreen();
          await loadProfile();
          initAppFeatures();
        } else {
          window.location.reload();
        }
      }
    } catch (err) {
      console.error("Erro na autenticação:", err);
      if (authMsg) authMsg.textContent = 'Erro: ' + (err.message || 'Falha na autenticação.');
    }
  };

  authSubmit.onclick = (e) => {
    e.preventDefault();
    executeLoginOrSignup();
  };

  const passwordField = document.getElementById('password');
  if (passwordField) {
    passwordField.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        executeLoginOrSignup();
      }
    };
  }
}

async function checkUser() {
  try {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error) throw error;

    if (session && session.user) {
      currentUser = session.user;
      showAppScreen();
      await loadProfile();
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
      currentProfile = { id: currentUser.id, username: currentUser.email.split('@')[0], role: 'user', is_pro: false };
    }
  } catch (err) {
    console.warn("Erro ao carregar perfil:", err);
    currentProfile = { id: currentUser.id, username: currentUser.email.split('@')[0], role: 'user', is_pro: false };
  }
}

function setupNavigation() {
  document.querySelectorAll('.nav-link').forEach(btn => {
    btn.addEventListener('click', () => {
      if (messageSubscription) { supabaseClient.removeChannel(messageSubscription); messageSubscription = null; }
      if (dmSubscription) { supabaseClient.removeChannel(dmSubscription); dmSubscription = null; }
      if (requestSubscription) { supabaseClient.removeChannel(requestSubscription); requestSubscription = null; }
      activeGroupId = null;
      activeDmUserId = null;

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
      } else if (targetId === 'messagesView') {
        loadDirectMessagesList();
      }
    });
  });

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      if (messageSubscription) supabaseClient.removeChannel(messageSubscription);
      if (dmSubscription) supabaseClient.removeChannel(dmSubscription);
      if (requestSubscription) supabaseClient.removeChannel(requestSubscription);
      if (feedSubscription) supabaseClient.removeChannel(feedSubscription);
      if (tasksSubscription) supabaseClient.removeChannel(tasksSubscription);
      if (subjectContentsSubscription) supabaseClient.removeChannel(subjectContentsSubscription);
      await supabaseClient.auth.signOut();
      localStorage.clear();
      location.reload();
    };
  }
}

function setupProfileNavigation() {
  document.querySelectorAll('.nav-link').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      if (targetId === 'profileView') {
        loadUserProfileView();
      }
    });
  });
}

function setupNotificationsNavigation() {
  document.querySelectorAll('.nav-link').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      if (targetId === 'notificationsView') {
        loadNotificationsView();
      }
    });
  });
}

async function loadUserProfileView() {
  if (!currentUser) return;

  const usernameEl = document.getElementById('profileUsernameDisplay');
  const emailEl = document.getElementById('profileEmailDisplay');
  const followersCountEl = document.getElementById('statFollowersCount');
  const followingCountEl = document.getElementById('statFollowingCount');
  const suggestedContainer = document.getElementById('suggestedUsersList');

  if (usernameEl) usernameEl.textContent = `@${currentProfile?.username || currentUser.email.split('@')[0]}`;
  if (emailEl) emailEl.textContent = currentUser.email;

  const { count: followersCount } = await supabaseClient
    .from('followers')
    .select('*', { count: 'exact', head: true })
    .eq('following_id', currentUser.id);

  const { count: followingCount } = await supabaseClient
    .from('followers')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', currentUser.id);

  if (followersCountEl) followersCountEl.textContent = followersCount ?? 0;
  if (followingCountEl) followingCountEl.textContent = followingCount ?? 0;

  const { data: allProfiles } = await supabaseClient
    .from('profiles')
    .select('*')
    .neq('id', currentUser.id);

  const { data: myFollowing } = await supabaseClient
    .from('followers')
    .select('following_id')
    .eq('follower_id', currentUser.id);

  const followingIds = myFollowing ? myFollowing.map(f => f.following_id) : [];

  if (suggestedContainer) {
    suggestedContainer.innerHTML = '';
    const suggestions = allProfiles ? allProfiles.filter(p => !followingIds.includes(p.id)) : [];

    if (suggestions.length === 0) {
      suggestedContainer.innerHTML = '<p style="color: #737373; font-size: 13px;">Não há novas sugestões no momento. Já segue todos os utilizadores!</p>';
      return;
    }

    suggestions.forEach(user => {
      const row = document.createElement('div');
      row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; background: #101017; padding: 12px 16px; border-radius: 8px; border: 1px solid #1f1f2e;';
      row.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 36px; height: 36px; border-radius: 50%; background: #2563eb; display: flex; align-items: center; justify-content: center; font-weight: bold; color: white;">
            ${user.username ? user.username.charAt(0).toUpperCase() : 'U'}
          </div>
          <div>
            <b style="color: #fff; font-size: 14px; cursor: pointer;" onclick="openUserProfile('${user.id}')">@${escapeHtml(user.username)}</b>
            <p style="font-size: 11px; color: #737373; margin: 0;">Membro da comunidade</p>
          </div>
        </div>
        <button onclick="followUserFromSuggestions('${user.id}')" class="primary" style="padding: 6px 14px; font-size: 12px; border-radius: 6px; cursor: pointer;">Seguir</button>
      `;
      suggestedContainer.appendChild(row);
    });
  }
}

window.followUserFromSuggestions = async function(targetUserId) {
  const { error } = await supabaseClient.from('followers').insert([
    { follower_id: currentUser.id, following_id: targetUserId }
  ]);

  if (error) {
    alert('Erro ao seguir utilizador: ' + error.message);
  } else {
    await supabaseClient.from('notifications').insert([
      { user_id: targetUserId, actor_id: currentUser.id, type: 'follow', content: 'começou a seguir-te.' }
    ]).catch(() => {});

    loadUserProfileView();
  }
};

async function loadNotificationsView() {
  const container = document.getElementById('notificationsList');
  if (!container) return;

  const { data: notifications } = await supabaseClient
    .from('notifications')
    .select('*, profiles:actor_id (username)')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  container.innerHTML = '';

  if (!notifications || notifications.length === 0) {
    container.innerHTML = '<p style="color: #737373; padding: 20px;">Nenhuma notificação por enquanto.</p>';
    return;
  }

  notifications.forEach(notif => {
    const card = document.createElement('div');
    card.style.cssText = 'background: #16161f; border: 1px solid #262626; border-radius: 10px; padding: 14px; display: flex; justify-content: space-between; align-items: center; font-size: 13px;';
    
    const actorName = notif.profiles?.username || 'alguém';
    const dateStr = new Date(notif.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

    card.innerHTML = `
      <div>
        <b style="color: var(--accent); cursor: pointer;" onclick="openUserProfile('${notif.actor_id}')">@${escapeHtml(actorName)}</b> 
        <span style="color: #e5e7eb;">${escapeHtml(notif.content)}</span>
        <div style="font-size: 11px; color: #737373; margin-top: 4px;">📅 ${dateStr}</div>
      </div>
    `;
    container.appendChild(card);
  });
}

function initAppFeatures() {
  loadGlobalBanner();
  loadPosts();
  setupRealtimeFeed();
  loadSubjects();
  loadTasks();
  loadGroups();
  setupRealtimeGlobalTasks();
  setupGlobalRequestRealtime();

  const postFileInput = document.getElementById('postFileInput');
  if (postFileInput) {
    postFileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      alert('A carregar mídia para o post...');
      const fileExt = file.name.split('.').pop();
      const fileName = `feed_${Date.now()}.${fileExt}`;
      const filePath = `posts/${fileName}`;

      const { error: uploadError } = await supabaseClient.storage.from('imagens').upload(filePath, file);
      if (uploadError) {
        alert('Erro ao enviar ficheiro: ' + uploadError.message);
        return;
      }

      const { data: urlData } = supabaseClient.storage.from('imagens').getPublicUrl(filePath);
      selectedPostFileUrl = urlData.publicUrl;
      alert('Mídia pronta para publicar!');
    };
  }

  const createPostBtn = document.getElementById('createPostBtn');
  if (createPostBtn) {
    createPostBtn.onclick = async () => {
      const content = document.getElementById('postContentInput').value.trim();
      const mediaInputUrl = document.getElementById('postMediaInput').value.trim();
      const finalMediaUrl = selectedPostFileUrl || mediaInputUrl || null;

      if (!content && !finalMediaUrl) return;

      const { error } = await supabaseClient.from('posts').insert([
        { user_id: currentUser.id, content, media_url: finalMediaUrl, media_type: 'image' }
      ]);

      if (error) {
        alert('Erro ao publicar: ' + error.message);
        return;
      }

      document.getElementById('postContentInput').value = '';
      if (document.getElementById('postMediaInput')) document.getElementById('postMediaInput').value = '';
      selectedPostFileUrl = null;
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
      const name = prompt('Nome do Grupo de Estudo:');
      if (!name) return;

      await supabaseClient.from('groups').insert([{ user_id: currentUser.id, name }]);
      loadGroups();
    };
  }

  const globalNewTaskBtn = document.getElementById('globalNewTaskBtn');
  if (globalNewTaskBtn) {
    globalNewTaskBtn.onclick = async () => {
      const title = prompt('Nome do lembrete, prova ou tarefa:');
      if (!title) return;
      const due_date = prompt('Data de entrega (AAAA-MM-DD):', new Date().toISOString().split('T')[0]);

      const { error } = await supabaseClient.from('tasks').insert([
        { user_id: currentUser.id, title, due_date, subject_id: null }
      ]);

      if (error) {
        alert('Erro ao criar tarefa: ' + error.message);
      } else {
        loadTasks();
        loadAllTasksView();
      }
    };
  }
}

async function loadGlobalBanner() {
  const { data: banner } = await supabaseClient
    .from('global_announcements')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let bannerContainer = document.getElementById('systemGlobalBanner');
  if (!bannerContainer) {
    bannerContainer = document.createElement('div');
    bannerContainer.id = 'systemGlobalBanner';
    const mainContent = document.querySelector('.content') || document.body;
    mainContent.insertBefore(bannerContainer, mainContent.firstChild);
  }

  if (banner && banner.message) {
    const isWarning = banner.type === 'warning';
    const isSuccess = banner.type === 'success';
    
    const bgColor = isWarning ? 'linear-gradient(135deg, #422006, #1e1b18)' : (isSuccess ? 'linear-gradient(135deg, #064e3b, #111827)' : 'linear-gradient(135deg, #1e3a8a, #111827)');
    const borderColor = isWarning ? '#ca8a04' : (isSuccess ? '#16a34a' : '#3b82f6');
    const badgeText = isWarning ? '⚠️ AVISO IMPORTANTE' : (isSuccess ? '🎉 NOVIDADE' : '📢 COMUNICADO OFICIAL');

    bannerContainer.innerHTML = `
      <div style="background: ${bgColor}; border: 1px solid ${borderColor}; color: white; padding: 20px 24px; border-radius: 12px; margin-bottom: 24px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); position: relative;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 11px; font-weight: 700; letter-spacing: 1px; color: ${borderColor}; text-transform: uppercase;">${badgeText}</span>
          <button onclick="document.getElementById('systemGlobalBanner').innerHTML='';" style="background: rgba(255,255,255,0.1); border: none; color: white; width: 28px; height: 28px; border-radius: 6px; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s;" title="Fechar aviso">✕</button>
        </div>
        <div style="font-size: 15px; font-weight: 500; line-height: 1.5; color: #f3f4f6; word-break: break-word;">
          ${linkifyText(banner.message)}
        </div>
      </div>
    `;
  } else {
    bannerContainer.innerHTML = '';
  }
}

async function renderAdminView() {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));

  let adminView = document.getElementById('adminView');
  if (!adminView) {
    adminView = document.createElement('div');
    adminView.id = 'adminView';
    adminView.className = 'view';
    document.querySelector('.content').appendChild(adminView);
  }
  adminView.classList.remove('hidden');

  const breadcrumb = document.getElementById('breadcrumb');
  if (breadcrumb) breadcrumb.textContent = 'Painel Admin Restrito';

  adminView.innerHTML = `
    <div class="page-title" style="display:flex; justify-content:space-between; align-items:center;">
      <div><span class="eyebrow" style="color: #ef4444;">ÁREA RESTRITA (ADMIN VERIFICADO)</span><h1>Painel de Administração</h1></div>
      <button onclick="lockAdminSession()" style="background: #ef4444; color: white; border: none; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-size: 12px;">🔒 Bloquear Painel</button>
    </div>

    <div class="panel" style="margin-bottom: 20px; border: 1px solid #3b82f6;">
      <div class="panel-head"><h2>📢 Transmitir Comunicado Global (Banner)</h2></div>
      <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px;">
        <input type="text" id="adminBannerMsg" placeholder="Escreva um comunicado para todos os utilizadores..." style="flex: 1; min-width: 250px; background: #101017; color: white; border: 1px solid #262626; border-radius: 6px; padding: 10px;">
        <select id="adminBannerType" style="background: #101017; color: white; border: 1px solid #262626; border-radius: 6px; padding: 10px;">
          <option value="info">Informação (Azul)</option>
          <option value="warning">Alerta (Amarelo)</option>
          <option value="success">Sucesso (Verde)</option>
        </select>
        <button onclick="adminPublishBanner()" class="primary" style="padding: 10px 16px;">Publicar Banner</button>
        <button onclick="adminClearBanner()" style="background: #ef4444; color: white; border: none; border-radius: 6px; padding: 10px 16px; cursor: pointer;">Desativar Banners</button>
      </div>
    </div>

    <div class="stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 20px;">
      <div class="panel" style="text-align: center;"><h3 style="color:var(--accent); font-size:24px;" id="statUsers">...</h3><p style="color:#a8a8a8; font-size:13px; margin:0;">Utilizadores Totais</p></div>
      <div class="panel" style="text-align: center;"><h3 style="color:#22c55e; font-size:24px;" id="statPro">...</h3><p style="color:#a8a8a8; font-size:13px; margin:0;">Membros PRO</p></div>
      <div class="panel" style="text-align: center;"><h3 style="color:var(--accent); font-size:24px;" id="statPosts">...</h3><p style="color:#a8a8a8; font-size:13px; margin:0;">Posts Públicos</p></div>
    </div>

    <div class="panel" style="margin-bottom: 20px;">
      <div class="panel-head"><h2>Gestão de Permissões e Planos PRO</h2></div>
      <div id="adminUsersList" style="max-height: 300px; overflow-y: auto; margin-top: 10px;"><p style="color: #737373;">A carregar lista...</p></div>
    </div>

    <div class="panel">
      <div class="panel-head"><h2>Moderação de Publicações do Feed</h2></div>
      <div id="adminPostsList" style="max-height: 300px; overflow-y: auto; margin-top: 10px;"><p style="color: #737373;">A carregar posts...</p></div>
    </div>
  `;

  loadAdminStats();
  loadAdminUsers();
  loadAdminPosts();
}

window.lockAdminSession = function() {
  isAdminAuthenticated = false;
  document.querySelector('[data-target="dashboard"]').click();
  alert('Sessão administrativa bloqueada com segurança.');
};

async function loadAdminStats() {
  const { count: usersCount } = await supabaseClient.from('profiles').select('*', { count: 'exact', head: true });
  const { count: proCount } = await supabaseClient.from('profiles').select('*', { count: 'exact', head: true }).eq('is_pro', true);
  const { count: postsCount } = await supabaseClient.from('posts').select('*', { count: 'exact', head: true });

  if (document.getElementById('statUsers')) document.getElementById('statUsers').textContent = usersCount ?? 0;
  if (document.getElementById('statPro')) document.getElementById('statPro').textContent = proCount ?? 0;
  if (document.getElementById('statPosts')) document.getElementById('statPosts').textContent = postsCount ?? 0;
}

async function loadAdminUsers() {
  const container = document.getElementById('adminUsersList');
  if (!container) return;

  const { data: profiles } = await supabaseClient.from('profiles').select('*').order('created_at', { ascending: false });
  if (!profiles || profiles.length === 0) {
    container.innerHTML = '<p style="color: #737373; font-size: 13px;">Nenhum utilizador registado.</p>';
    return;
  }

  container.innerHTML = '';
  profiles.forEach(p => {
    const isPro = p.is_pro === true;
    const role = p.role || 'user';

    const div = document.createElement('div');
    div.style.cssText = 'padding: 10px 0; border-bottom: 1px solid #262626; font-size: 13px; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;';
    div.innerHTML = `
      <div>
        <b style="color: #fff;">@${escapeHtml(p.username)}</b> 
        <span style="font-size: 11px; padding: 2px 6px; border-radius: 4px; background: ${role === 'admin' ? '#ef4444' : '#262626'}; color: white; margin-left: 6px;">${role.toUpperCase()}</span>
        <span style="font-size: 11px; padding: 2px 6px; border-radius: 4px; background: ${isPro ? '#22c55e' : '#334155'}; color: white; margin-left: 4px;">${isPro ? 'PRO' : 'GRÁTIS'}</span>
      </div>

      <div style="display: flex; gap: 6px;">
        <button onclick="adminTogglePro('${p.id}', ${!isPro})" style="background: ${isPro ? '#ca8a04' : '#16a34a'}; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 11px;">
          ${isPro ? 'Remover PRO' : 'Tornar PRO'}
        </button>
        <button onclick="adminToggleRole('${p.id}', '${role === 'admin' ? 'user' : 'admin'}')" style="background: #3b82f6; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 11px;">
          ${role === 'admin' ? 'Tornar Utilizador' : 'Tornar Admin'}
        </button>
      </div>
    `;
    container.appendChild(div);
  });
}

window.adminTogglePro = async function(userId, newProStatus) {
  await supabaseClient.from('profiles').update({ is_pro: newProStatus }).eq('id', userId);
  loadAdminUsers();
  loadAdminStats();
};

window.adminToggleRole = async function(userId, newRole) {
  if (confirm(`Deseja alterar o cargo deste utilizador para ${newRole}?`)) {
    await supabaseClient.from('profiles').update({ role: newRole }).eq('id', userId);
    loadAdminUsers();
  }
};

window.adminPublishBanner = async function() {
  const msgInput = document.getElementById('adminBannerMsg');
  const typeInput = document.getElementById('adminBannerType');
  const message = msgInput ? msgInput.value.trim() : '';
  const type = typeInput ? typeInput.value : 'info';

  if (!message) {
    alert('Escreva a mensagem do comunicado.');
    return;
  }

  try {
    await supabaseClient.from('global_announcements').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');
    const { error } = await supabaseClient.from('global_announcements').insert([{ message, type, is_active: true }]);
    
    if (error) throw error;

    if (msgInput) msgInput.value = '';
    alert('✅ Banner publicado com sucesso!');
    loadGlobalBanner();
  } catch (err) {
    console.error("Erro ao publicar banner:", err);
    alert('❌ Erro ao publicar banner: ' + (err.message || 'Verifique se a tabela global_announcements existe no Supabase.'));
  }
};

window.adminClearBanner = async function() {
  try {
    await supabaseClient.from('global_announcements').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');
    alert('✅ Todos os banners foram desativados.');
    loadGlobalBanner();
  } catch (err) {
    console.error("Erro ao limpar banners:", err);
    alert('❌ Erro ao desativar banners.');
  }
};

async function loadAdminPosts() {
  const container = document.getElementById('adminPostsList');
  if (!container) return;

  const { data: posts } = await supabaseClient.from('posts').select(`*, profiles:user_id (username)`).order('created_at', { ascending: false });
  if (!posts || posts.length === 0) {
    container.innerHTML = '<p style="color: #737373; font-size: 13px;">Nenhuma publicação para moderar.</p>';
    return;
  }

  container.innerHTML = '';
  posts.forEach(post => {
    const div = document.createElement('div');
    div.style.cssText = 'padding: 10px 0; border-bottom: 1px solid #262626; display: flex; justify-content: space-between; align-items: center; gap: 10px;';
    div.innerHTML = `
      <div style="flex: 1; min-width: 0;">
        <b style="color: var(--accent);">@${escapeHtml(post.profiles?.username || 'utilizador')}</b>:
        <span style="color: #fff; font-size: 13px;">${escapeHtml(post.content || '[Apenas Mídia]')}</span>
      </div>
      <button onclick="adminDeletePost('${post.id}')" style="background: #ef4444; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 11px; flex-shrink: 0;">Apagar</button>
    `;
    container.appendChild(div);
  });
}

window.adminDeletePost = async function(postId) {
  if (confirm('Deseja apagar esta publicação?')) {
    await supabaseClient.from('posts').delete().eq('id', postId);
    loadAdminPosts();
    loadAdminStats();
    loadPosts();
  }
};

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
  setupRealtimeSubjectDetails(sub.id);
}

function setupRealtimeSubjectDetails(subjectId) {
  if (subjectContentsSubscription) {
    supabaseClient.removeChannel(subjectContentsSubscription);
  }

  subjectContentsSubscription = supabaseClient
    .channel(`public:subject_contents:subject_id=eq.${subjectId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'subject_contents', filter: `subject_id=eq.${subjectId}` }, () => {
      loadSubjectLinksAndFiles(subjectId);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `subject_id=eq.${subjectId}` }, () => {
      loadSubjectTasks(subjectId);
      loadTasks();
      loadAllTasksView();
    })
    .subscribe();
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

  const handleNewTask = async () => {
    const title = prompt('Nome da prova, lembrete ou tarefa:');
    if (!title) return;
    const due_date = prompt('Data de entrega (AAAA-MM-DD):', new Date().toISOString().split('T')[0]);

    const { error } = await supabaseClient.from('tasks').insert([
      { user_id: currentUser.id, subject_id: subjectId, title, due_date }
    ]);

    if (error) {
      alert('Erro ao criar tarefa: ' + error.message);
    } else {
      loadSubjectTasks(subjectId);
      loadTasks();
      loadAllTasksView();
    }
  };

  const newTaskBtn = document.getElementById('newTaskBtn');
  const newTaskBtn2 = document.getElementById('newTaskBtn2');
  if (newTaskBtn) newTaskBtn.onclick = handleNewTask;
  if (newTaskBtn2) newTaskBtn2.onclick = handleNewTask;

  loadSubjectTasks(subjectId);

  const newLinkBtn = document.getElementById('newLinkBtn');
  if (newLinkBtn) {
    newLinkBtn.onclick = async () => {
      const title = prompt('Título do link ou vídeo:');
      const url = prompt('URL (link do site ou vídeo):');
      if (!title || !url) return;

      await supabaseClient.from('subject_contents').insert([
        { subject_id: subjectId, user_id: currentUser.id, title, type: url.includes('youtube') ? 'video' : 'link', url, content: title }
      ]);
    };
  }

  const fileInput = document.getElementById('fileInput');
  if (fileInput) {
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      alert('A carregar arquivo para o storage...');
      const fileExt = file.name.split('.').pop();
      const fileName = `sub_${Date.now()}.${fileExt}`;
      const filePath = `subjects/${fileName}`;

      const { error: uploadError } = await supabaseClient.storage.from('imagens').upload(filePath, file);
      if (uploadError) {
        alert('Erro ao enviar arquivo: ' + uploadError.message);
        return;
      }

      const { data: urlData } = supabaseClient.storage.from('imagens').getPublicUrl(filePath);
      const url = urlData.publicUrl;
      const fileType = file.type.startsWith('image/') ? 'image' : 'file';

      await supabaseClient.from('subject_contents').insert([
        { subject_id: subjectId, user_id: currentUser.id, title: file.name, type: fileType, url, content: file.name }
      ]);

      alert('Arquivo enviado com sucesso!');
    };
  }

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
        div.style.cssText = 'padding: 8px 0; font-size: 13px; border-bottom: 1px solid #262626; display:flex; justify-content:space-between; align-items:center; gap: 10px;';
        div.innerHTML = `
          <a href="${l.url}" target="_blank" style="color: var(--accent); text-decoration: none; word-break: break-all; flex: 1;">🔗 ${escapeHtml(l.title)}</a>
          <button onclick="deleteContent('${l.id}')" style="background:transparent; border:none; color:#ef4444; cursor:pointer; flex-shrink:0;">✕</button>
        `;
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
        div.style.cssText = 'padding: 12px 0; border-bottom: 1px solid #262626;';
        
        let previewHtml = '';
        if (f.type === 'image' || (f.url && f.url.match(/\.(jpeg|jpg|png|gif|webp)$/i))) {
          previewHtml = `
            <div style="margin-bottom: 8px; font-weight: 500; font-size: 13px; display: flex; justify-content: space-between; align-items: center;">
              <span style="color: #fff; word-break: break-all;">🖼️ ${escapeHtml(f.title)}</span>
              <a href="${f.url}" target="_blank" style="color: #38bdf8; text-decoration: none; font-size: 12px; flex-shrink: 0;">🔍 Abrir original</a>
            </div>
            <div style="width: 100%; max-height: 280px; overflow: hidden; border-radius: 8px; background: #000; display: flex; justify-content: center; align-items: center;">
              <a href="${f.url}" target="_blank" style="width: 100%; display: flex; justify-content: center;">
                <img src="${f.url}" style="width: 100%; height: auto; max-height: 280px; object-fit: contain; display: block; cursor: pointer;" onerror="this.outerHTML='<p style=\'color: #ef4444; font-size: 12px; padding: 10px; margin:0;\'>⚠️ Erro ao carregar miniatura.</p>';">
              </a>
            </div>
          `;
        } else {
          previewHtml = `<a href="${f.url}" target="_blank" style="color: #38bdf8; text-decoration: none; word-break: break-all;">📄 ${escapeHtml(f.title)} (Baixar/Ver)</a>`;
        }

        div.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap: 10px;">
            <div style="flex:1; min-width: 0;">${previewHtml}</div>
            <button onclick="deleteContent('${f.id}')" style="background:transparent; border:none; color:#ef4444; cursor:pointer; flex-shrink: 0;" title="Excluir">✕</button>
          </div>
        `;
        filesContainer.appendChild(div);
      });
    }
  }
}

window.deleteContent = async function(contentId) {
  if (confirm('Deseja excluir este item?')) {
    await supabaseClient.from('subject_contents').delete().eq('id', contentId);
  }
};

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

function setupGlobalRequestRealtime() {
  if (requestSubscription) supabaseClient.removeChannel(requestSubscription);
  requestSubscription = supabaseClient.channel('public:contact_requests_global')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_requests' }, () => {
      const msgView = document.getElementById('messagesView');
      if (msgView && !msgView.classList.contains('hidden')) {
        loadDirectMessagesList();
      }
    })
    .subscribe();
}

// ============================================================
// FEED E RENDERIZAÇÃO DE POSTS
// ============================================================

async function loadPosts() {
  const container = document.getElementById('postsList');
  if (!container) return;

  const { data: posts } = await supabaseClient
    .from('posts')
    .select(`*, profiles:user_id (id, username)`)
    .order('created_at', { ascending: false });

  container.innerHTML = '';

  if (!posts || posts.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #737373; padding: 40px 0;">Nenhuma publicação ainda.</p>';
    return;
  }

  const { data: followingList } = await supabaseClient
    .from('followers')
    .select('following_id')
    .eq('follower_id', currentUser.id);
  
  const followingIds = followingList ? followingList.map(f => f.following_id) : [];

  for (const post of posts) {
    await renderPostCard(post, followingIds);
  }
}

async function renderPostCard(post, followingIds = []) {
  const container = document.getElementById('postsList');
  if (!container) return;

  const card = document.createElement('div');
  card.className = 'panel';
  card.style.marginBottom = '16px';
  card.id = `post-${post.id}`;

  const dateObj = new Date(post.created_at);
  const formattedDate = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  let mediaRender = '';
  if (post.media_url && post.media_url.trim() !== '') {
    mediaRender = `
      <div style="margin-top: 12px; width: 100%; max-height: 450px; overflow: hidden; border-radius: 8px;">
        <a href="${post.media_url}" target="_blank"><img src="${post.media_url}" style="width: 100%; height: auto; max-height: 450px; object-fit: cover; display: block;"></a>
      </div>`;
  }

  const { count: commentCount } = await supabaseClient
    .from('post_comments')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', post.id);

  const isMyPost = post.user_id === currentUser.id;
  const isFollowing = followingIds.includes(post.user_id);
  const authorName = post.profiles?.username || 'utilizador';

  let followBtnHtml = '';
  if (!isMyPost) {
    followBtnHtml = `<button onclick="toggleFollowUser('${post.user_id}')" style="background: ${isFollowing ? '#262626' : '#3b82f6'}; color: white; border: none; padding: 2px 8px; border-radius: 4px; font-size: 11px; cursor: pointer; margin-left: 8px;">${isFollowing ? 'A seguir' : 'Seguir'}</button>`;
  }

  card.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
      <div style="display: flex; align-items: center;">
        <span style="font-weight: 600; color: var(--accent); font-size: 14px; cursor: pointer;" onclick="openUserProfile('${post.user_id}')">@${authorName}</span>
        ${followBtnHtml}
      </div>
      <span style="font-size: 11px; color: #737373;">📅 ${formattedDate}</span>
    </div>

    <div style="font-size: 14px; line-height: 1.5; word-break: break-word; color: #f3f4f6;">${linkifyText(post.content)}</div>
    ${mediaRender}

    <div style="display: flex; gap: 12px; margin-top: 14px; padding-top: 12px; border-top: 1px solid #262626; align-items: center;">
      <button onclick="toggleComments('${post.id}')" style="background: transparent; border: none; color: #a8a8a8; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 5px;">
        💬 <b>${commentCount || 0}</b> Comentários
      </button>

      <button id="share-btn-${post.id}" style="background: transparent; border: none; color: #a8a8a8; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 5px;">
        🔗 Compartilhar
      </button>
    </div>

    <div id="comments-section-${post.id}" class="hidden" style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed #262626;">
      <div id="comments-list-${post.id}" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; max-height: 200px; overflow-y: auto;">
        <small style="color: #737373;">A carregar comentários...</small>
      </div>

      <div style="display: flex; gap: 8px;">
        <input type="text" id="comment-input-${post.id}" placeholder="Escreva um comentário..." style="flex: 1; background: #101017; color: white; border: 1px solid #353542; border-radius: 6px; padding: 8px 12px; font-size: 13px; outline: none;" onkeydown="if(event.key === 'Enter') submitComment('${post.id}')">
        <button onclick="submitComment('${post.id}')" class="primary" style="padding: 6px 14px; font-size: 12px;">Comentar</button>
      </div>
    </div>
  `;

  container.appendChild(card);

  const shareBtn = document.getElementById(`share-btn-${post.id}`);
  if (shareBtn) {
    shareBtn.onclick = () => openShareOptions(post.id, post.content || '', post.media_url || '');
  }
}

// ============================================================
// SEGUIR, DEIXAR DE SEGUIR E NOTIFICAÇÕES
// ============================================================

window.toggleFollowUser = async function(targetUserId) {
  const { data: existing } = await supabaseClient
    .from('followers')
    .select('id')
    .eq('follower_id', currentUser.id)
    .eq('following_id', targetUserId)
    .maybeSingle();

  if (existing) {
    await supabaseClient.from('followers').delete().eq('id', existing.id);
    alert('Deixou de seguir este utilizador.');
  } else {
    await supabaseClient.from('followers').insert([{ follower_id: currentUser.id, following_id: targetUserId }]);
    
    await supabaseClient.from('notifications').insert([
      { user_id: targetUserId, actor_id: currentUser.id, type: 'follow', content: 'começou a seguir-te.' }
    ]).catch(() => {});

    alert('Agora está a seguir este utilizador!');
  }

  loadPosts();
  if (document.getElementById('profileView') && !document.getElementById('profileView').classList.contains('hidden')) {
    loadUserProfileView();
  }
};

window.openUserProfile = async function(userId) {
  const { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', userId).single();
  if (!profile) return;

  const { count: followersCount } = await supabaseClient.from('followers').select('*', { count: 'exact', head: true }).eq('following_id', userId);
  const { count: followingCount } = await supabaseClient.from('followers').select('*', { count: 'exact', head: true }).eq('follower_id', userId);

  const { data: reqData } = await supabaseClient
    .from('contact_requests')
    .select('*')
    .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUser.id})`)
    .maybeSingle();

  let contactActionHtml = '';
  if (userId !== currentUser.id) {
    if (!reqData) {
      contactActionHtml = `<button onclick="sendContactRequest('${userId}', '${escapeHtml(profile.username)}')" class="primary" style="padding: 10px; border-radius: 8px; cursor: pointer; font-size: 13px;">📩 Enviar Convite de Contato</button>`;
    } else if (reqData.status === 'pending') {
      contactActionHtml = `<button disabled style="background: #334155; color: #94a3b8; border: none; padding: 10px; border-radius: 8px; font-size: 13px;">⏳ Convite Pendente</button>`;
    } else if (reqData.status === 'accepted') {
      contactActionHtml = `<button onclick="openDirectMessage('${userId}', '${escapeHtml(profile.username)}')" class="primary" style="padding: 10px; border-radius: 8px; cursor: pointer; font-size: 13px;">💬 Abrir Chat Privado</button>`;
    } else {
      contactActionHtml = `<button onclick="sendContactRequest('${userId}', '${escapeHtml(profile.username)}')" class="primary" style="padding: 10px; border-radius: 8px; cursor: pointer; font-size: 13px;">📩 Enviar Novo Convite</button>`;
    }
  }

  let modal = document.getElementById('userProfileModal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'userProfileModal';
  modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 9999; backdrop-filter: blur(4px);';
  
  modal.innerHTML = `
    <div style="background: #16161f; border: 1px solid #262626; border-radius: 14px; width: 90%; max-width: 380px; padding: 20px; color: #fff; text-align: center; display: flex; flex-direction: column; gap: 12px;">
      <div style="display: flex; justify-content: flex-end;">
        <button onclick="document.getElementById('userProfileModal').remove()" style="background: transparent; border: none; color: #fff; font-size: 16px; cursor: pointer;">✕</button>
      </div>
      <h2 style="margin: 0; color: var(--accent);">@${escapeHtml(profile.username)}</h2>
      <p style="font-size: 12px; color: #a8a8a8; margin: 0;">Cargo: <b>${(profile.role || 'user').toUpperCase()}</b> | Plano: <b>${profile.is_pro ? 'PRO' : 'Grátis'}</b></p>
      
      <div style="display: flex; justify-content: space-around; background: #101017; padding: 12px; border-radius: 8px; margin: 10px 0;">
        <div><b>${followersCount || 0}</b><br><small style="color: #737373;">Seguidores</small></div>
        <div><b>${followingCount || 0}</b><br><small style="color: #737373;">A seguir</small></div>
      </div>

      ${contactActionHtml}
    </div>
  `;
  document.body.appendChild(modal);
};

window.sendContactRequest = async function(targetUserId, targetUsername) {
  const { error } = await supabaseClient.from('contact_requests').insert([
    { sender_id: currentUser.id, receiver_id: targetUserId, status: 'pending' }
  ]);

  if (error) {
    alert('Erro ao enviar convite: ' + error.message);
  } else {
    await supabaseClient.from('notifications').insert([
      { user_id: targetUserId, actor_id: currentUser.id, type: 'request', content: 'enviou-te um convite de contacto.' }
    ]).catch(() => {});

    alert(`✅ Convite de contacto enviado para @${targetUsername}!`);
    const modal = document.getElementById('userProfileModal');
    if (modal) modal.remove();
  }
};

// ============================================================
// MENSAGENS PRIVADAS & GESTÃO DE CONVITES EM TEMPO REAL
// ============================================================

window.loadDirectMessagesList = async function() {
  const container = document.getElementById('messagesView');
  if (!container) return;

  const { data: acceptedRequests } = await supabaseClient
    .from('contact_requests')
    .select('*')
    .eq('status', 'accepted')
    .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`);

  const friendIds = [];
  if (acceptedRequests) {
    acceptedRequests.forEach(req => {
      const friendId = req.sender_id === currentUser.id ? req.receiver_id : req.sender_id;
      friendIds.push(friendId);
    });
  }

  const { data: pendingRequests } = await supabaseClient
    .from('contact_requests')
    .select('*, profiles:sender_id (username)')
    .eq('receiver_id', currentUser.id)
    .eq('status', 'pending');

  let friends = [];
  if (friendIds.length > 0) {
    const { data: profilesData } = await supabaseClient
      .from('profiles')
      .select('*')
      .in('id', friendIds);
    friends = profilesData || [];
  }

  container.innerHTML = `
    <div class="page-title">
      <span class="eyebrow">PRIVACIDADE E MENSAGENS</span>
      <h1>Chat Privado & Convites</h1>
    </div>
    <div style="display: grid; grid-template-columns: 320px 1fr; gap: 16px; height: 68vh; background: #121216; border: 1px solid #262626; border-radius: 12px; overflow: hidden;">
      
      <div style="background: #16161f; border-right: 1px solid #262626; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 16px;">
        
        <div>
          <h4 style="font-size: 11px; color: var(--accent); letter-spacing: 0.5px; margin-bottom: 8px; text-transform: uppercase;">🔍 Pesquisar Pessoas</h4>
          <input type="text" id="userSearchInput" placeholder="Digitar @username..." onkeyup="searchUsersList()" style="width: 100%; background: #101017; color: white; border: 1px solid #353542; border-radius: 8px; padding: 8px 10px; font-size: 13px; outline: none; box-sizing: border-box;">
          <div id="searchResultsContainer" style="display: flex; flex-direction: column; gap: 6px; margin-top: 8px; max-height: 140px; overflow-y: auto;"></div>
        </div>

        <hr style="border: none; border-top: 1px solid #262626; margin: 0;">

        <div>
          <h4 style="font-size: 11px; color: #38bdf8; letter-spacing: 0.5px; margin-bottom: 8px; text-transform: uppercase;">📩 Convites Recebidos</h4>
          <div id="pendingRequestsContainer" style="display: flex; flex-direction: column; gap: 6px;">
            ${pendingRequests && pendingRequests.length > 0 ? pendingRequests.map(req => `
              <div style="background: #101017; border: 1px solid #222; padding: 10px; border-radius: 8px; font-size: 12px;">
                <b style="color: #fff;">@${escapeHtml(req.profiles?.username || 'utilizador')}</b> quer conversar.
                <div style="display: flex; gap: 6px; margin-top: 8px;">
                  <button onclick="respondContactRequest('${req.id}', 'accepted')" class="primary" style="flex:1; padding: 4px; font-size: 11px;">Aceitar</button>
                  <button onclick="respondContactRequest('${req.id}', 'rejected')" style="flex:1; background:#ef4444; color:white; border:none; padding: 4px; border-radius: 4px; cursor:pointer; font-size: 11px;">Recusar</button>
                </div>
              </div>
            `).join('') : '<small style="color: #737373;">Nenhum convite pendente.</small>'}
          </div>
        </div>

        <hr style="border: none; border-top: 1px solid #262626; margin: 0;">

        <div>
          <h4 style="font-size: 11px; color: #22c55e; letter-spacing: 0.5px; margin-bottom: 8px; text-transform: uppercase;">👥 Meus Contactos (Liberados)</h4>
          <div id="friendsListContainer" style="display: flex; flex-direction: column; gap: 6px;">
            ${friends.length > 0 ? friends.map(f => `
              <div onclick="openDirectMessage('${f.id}', '${escapeHtml(f.username)}')" style="padding: 10px; background: #101017; border-radius: 8px; cursor: pointer; border: 1px solid #1f1f2e; transition: 0.2s;">
                <b style="color: #fff; font-size: 13px;">@${escapeHtml(f.username)}</b>
              </div>
            `).join('') : '<small style="color: #737373;">Sem contactos aceites. Pesquise alguém acima para enviar convite!</small>'}
          </div>
        </div>

      </div>

      <div id="dmChatArea" style="display: flex; flex-direction: column; background: #0b0b0f; padding: 16px; justify-content: center; align-items: center; color: #737373;">
        <p>Selecione um contacto à esquerda para iniciar a conversa.</p>
      </div>

    </div>
  `;
};

window.searchUsersList = async function() {
  const query = document.getElementById('userSearchInput').value.trim().toLowerCase();
  const container = document.getElementById('searchResultsContainer');
  if (!container) return;

  if (!query) {
    container.innerHTML = '';
    return;
  }

  const { data: profiles } = await supabaseClient
    .from('profiles')
    .select('*')
    .neq('id', currentUser.id)
    .ilike('username', `%${query}%`)
    .limit(5);

  container.innerHTML = '';
  if (!profiles || profiles.length === 0) {
    container.innerHTML = '<small style="color: #737373;">Nenhum utilizador encontrado.</small>';
    return;
  }

  profiles.forEach(p => {
    const item = document.createElement('div');
    item.style.cssText = 'padding: 8px 10px; background: #101017; border-radius: 6px; cursor: pointer; border: 1px solid #1f1f2e; display: flex; justify-content: space-between; align-items: center; font-size: 12px;';
    item.onclick = () => openUserProfile(p.id);
    item.innerHTML = `
      <b style="color: #fff;">@${escapeHtml(p.username)}</b>
      <span style="color: var(--accent); font-size: 11px;">Ver Perfil</span>
    `;
    container.appendChild(item);
  });
};

window.respondContactRequest = async function(requestId, newStatus) {
  const { error } = await supabaseClient
    .from('contact_requests')
    .update({ status: newStatus })
    .eq('id', requestId);

  if (error) {
    alert('Erro ao responder convite: ' + error.message);
  } else {
    loadDirectMessagesList();
  }
};

window.openDirectMessage = function(targetUserId, targetUsername) {
  activeDmUserId = targetUserId;
  const chatArea = document.getElementById('dmChatArea');
  if (!chatArea) return;

  chatArea.innerHTML = `
    <div style="padding: 12px; background: #16161f; border-bottom: 1px solid #262626; width: 100%; box-sizing: border-box; display: flex; align-items: center;">
      <h3 style="margin: 0; color: var(--accent); font-size: 15px;">💬 Conversa com @${escapeHtml(targetUsername)}</h3>
    </div>
    <div id="dmMessagesList" style="flex: 1; width: 100%; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px;">
      <p style="color: #737373; text-align: center;">A carregar mensagens...</p>
    </div>
    <div style="width: 100%; padding-top: 10px; display: flex; gap: 8px; box-sizing: border-box;">
      <input type="text" id="dmInput" placeholder="Escreva uma mensagem privada..." style="flex: 1; background: #101017; color: white; border: 1px solid #353542; border-radius: 8px; padding: 10px; outline: none;" onkeydown="if(event.key === 'Enter') sendDirectMessage()">
      <button onclick="sendDirectMessage()" class="primary" style="padding: 0 20px;">Enviar</button>
    </div>
  `;

  loadDirectMessagesHistory(targetUserId);
  setupRealtimeDm(targetUserId);
};

async function loadDirectMessagesHistory(targetUserId) {
  const container = document.getElementById('dmMessagesList');
  if (!container) return;

  const { data: messages } = await supabaseClient
    .from('direct_messages')
    .select('*')
    .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${currentUser.id})`)
    .order('created_at', { ascending: true });

  container.innerHTML = '';
  if (!messages || messages.length === 0) {
    container.innerHTML = '<p style="color: #737373; text-align: center; margin: auto;">Nenhuma mensagem privada ainda. Comece a conversar!</p>';
    return;
  }

  messages.forEach(msg => appendDmMessageToChat(msg));
  container.scrollTop = container.scrollHeight;
}

function appendDmMessageToChat(msg) {
  const container = document.getElementById('dmMessagesList');
  if (!container) return;

  const emptyMsg = container.querySelector('p');
  if (emptyMsg && emptyMsg.textContent.includes('Nenhuma mensagem')) {
    emptyMsg.remove();
  }

  const isMe = msg.sender_id === currentUser.id;
  const msgDiv = document.createElement('div');
  msgDiv.style.cssText = `max-width: 70%; padding: 10px 14px; border-radius: 10px; font-size: 13px; align-self: ${isMe ? 'flex-end' : 'flex-start'}; background: ${isMe ? '#2563eb' : '#1f1f2e'}; color: white; word-break: break-word;`;
  
  msgDiv.innerHTML = `<div>${linkifyText(msg.content)}</div>`;
  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}

window.sendDirectMessage = async function() {
  if (!activeDmUserId) return;
  const input = document.getElementById('dmInput');
  const content = input ? input.value.trim() : '';
  if (!content) return;

  input.value = '';

  await supabaseClient.from('direct_messages').insert([
    { sender_id: currentUser.id, receiver_id: activeDmUserId, content }
  ]);
};

function setupRealtimeDm(targetUserId) {
  if (dmSubscription) supabaseClient.removeChannel(dmSubscription);

  dmSubscription = supabaseClient
    .channel(`public:direct_messages:${currentUser.id}-${targetUserId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'direct_messages'
    }, (payload) => {
      const msg = payload.new;
      if (
        (msg.sender_id === currentUser.id && msg.receiver_id === targetUserId) ||
        (msg.sender_id === targetUserId && msg.receiver_id === currentUser.id)
      ) {
        appendDmMessageToChat(msg);
      }
    })
    .subscribe();
}

// ============================================================
// COMENTÁRIOS E COMPARTILHAMENTO
// ============================================================

window.toggleComments = async function(postId) {
  const section = document.getElementById(`comments-section-${postId}`);
  if (!section) return;

  const isHidden = section.classList.contains('hidden');
  if (isHidden) {
    section.classList.remove('hidden');
    loadComments(postId);
  } else {
    section.classList.add('hidden');
  }
};

async function loadComments(postId) {
  const listContainer = document.getElementById(`comments-list-${postId}`);
  if (!listContainer) return;

  const { data: comments } = await supabaseClient
    .from('post_comments')
    .select(`*, profiles:user_id (username)`)
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  listContainer.innerHTML = '';

  if (!comments || comments.length === 0) {
    listContainer.innerHTML = '<small style="color: #737373;">Nenhum comentário ainda. Seja o primeiro!</small>';
    return;
  }

  comments.forEach(c => {
    const div = document.createElement('div');
    div.style.cssText = 'background: #101017; padding: 8px 10px; border-radius: 6px; font-size: 12px; border: 1px solid #1f1f2e; display: flex; justify-content: space-between; align-items: flex-start;';
    
    const isMe = c.user_id === currentUser.id;
    const deleteBtn = isMe ? `<button onclick="deleteComment('${c.id}', '${postId}')" style="background:transparent; border:none; color:#ef4444; cursor:pointer; font-size:11px;">✕</button>` : '';

    div.innerHTML = `
      <div style="flex: 1; word-break: break-word;">
        <b style="color: var(--accent);">@${c.profiles?.username || 'utilizador'}</b>: 
        <span style="color: #e5e7eb;">${linkifyText(c.content)}</span>
      </div>
      ${deleteBtn}
    `;
    listContainer.appendChild(div);
  });
};

window.submitComment = async function(postId) {
  const input = document.getElementById(`comment-input-${postId}`);
  const content = input ? input.value.trim() : '';

  if (!content) return;

  input.value = '';

  const { data: postData } = await supabaseClient.from('posts').select('user_id').eq('id', postId).single();

  const { error } = await supabaseClient.from('post_comments').insert([
    { post_id: postId, user_id: currentUser.id, content }
  ]);

  if (error) {
    alert('Erro ao enviar comentário: ' + error.message);
  } else {
    if (postData && postData.user_id !== currentUser.id) {
      await supabaseClient.from('notifications').insert([
        { user_id: postData.user_id, actor_id: currentUser.id, type: 'comment', content: 'comentou na tua publicação.' }
      ]).catch(() => {});
    }

    loadComments(postId);
  }
};

window.deleteComment = async function(commentId, postId) {
  if (confirm('Deseja excluir este comentário?')) {
    await supabaseClient.from('post_comments').delete().eq('id', commentId);
    loadComments(postId);
  }
};

window.openShareOptions = async function(postId, contentSnippet, mediaUrl) {
  let modal = document.getElementById('shareModalOverlay');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'shareModalOverlay';
  modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 9999; backdrop-filter: blur(4px);';
  document.body.appendChild(modal);

  const { data: groups } = await supabaseClient.from('groups').select('*').order('name');

  modal.innerHTML = `
    <div style="background: #16161f; border: 1px solid #262626; border-radius: 14px; width: 90%; max-width: 420px; padding: 20px; color: #fff; box-shadow: 0 8px 24px rgba(0,0,0,0.5); display: flex; flex-direction: column; gap: 14px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h3 style="margin: 0; font-size: 16px; color: var(--accent);">📤 Compartilhar Publicação</h3>
        <button onclick="document.getElementById('shareModalOverlay').remove()" style="background: transparent; border: none; color: #fff; font-size: 16px; cursor: pointer;">✕</button>
      </div>

      <div style="font-size: 13px; color: #a8a8a8; background: #101017; padding: 10px; border-radius: 8px; border: 1px solid #222;">
        "${escapeHtml(contentSnippet).substring(0, 80)}..."
      </div>

      <div>
        <label style="font-size: 11px; font-weight: bold; color: #38bdf8; display: block; margin-bottom: 6px; letter-spacing: 0.5px;">ENVIAR PARA GRUPO DE ESTUDOS</label>
        <input type="text" id="groupSearchInput" placeholder="🔍 Pesquisar grupo..." onkeyup="filterShareGroups()" style="width: 100%; background: #101017; color: white; border: 1px solid #353542; border-radius: 8px; padding: 8px 12px; font-size: 13px; outline: none; margin-bottom: 8px; box-sizing: border-box;">
        
        <div id="shareGroupsListContainer" style="max-height: 140px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;">
          ${groups && groups.length > 0 ? groups.map(g => `
            <div class="share-group-item" data-name="${g.name.toLowerCase()}" id="share-g-${g.id}" style="padding: 8px 10px; background: #101017; border-radius: 6px; cursor: pointer; font-size: 13px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #1f1f2e; transition: 0.2s;">
              <span>👥 ${escapeHtml(g.name)}</span>
              <span style="font-size: 11px; color: #38bdf8; background: #1e3a8a; padding: 2px 8px; border-radius: 4px; font-weight: 500;">Enviar</span>
            </div>
          `).join('') : '<p style="color: #737373; font-size: 12px; text-align: center;">Nenhum grupo encontrado.</p>'}
        </div>
      </div>

      <hr style="border: none; border-top: 1px solid #262626; margin: 4px 0;">

      <div style="display: flex; gap: 10px;">
        <button onclick="shareExternalLink('${postId}')" class="primary" style="flex: 1; padding: 10px; font-size: 13px; border-radius: 8px; cursor: pointer;">🔗 Copiar Link Interno / Externo</button>
      </div>
    </div>
  `;

  if (groups) {
    groups.forEach(g => {
      const itemEl = document.getElementById(`share-g-${g.id}`);
      if (itemEl) {
        itemEl.onclick = () => sendPostToGroup(g.id, g.name, contentSnippet, mediaUrl);
      }
    });
  }
};

window.filterShareGroups = function() {
  const query = document.getElementById('groupSearchInput').value.toLowerCase();
  const items = document.querySelectorAll('.share-group-item');
  items.forEach(item => {
    const name = item.getAttribute('data-name');
    if (name.includes(query)) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
};

window.sendPostToGroup = async function(groupId, groupName, contentSnippet, mediaUrl) {
  let formattedMessage = `📢 [POST COMPARTILHADO]\n"${contentSnippet}"`;
  
  const { error } = await supabaseClient.from('group_messages').insert([
    { 
      group_id: groupId, 
      user_id: currentUser.id, 
      content: formattedMessage,
      media_url: mediaUrl || null,
      media_type: mediaUrl ? 'image' : null
    }
  ]);

  if (error) {
    alert('❌ Erro ao enviar post para o grupo: ' + error.message);
    return;
  }

  alert(`✅ Publicação enviada com sucesso para o grupo "${groupName}"!`);
  const modal = document.getElementById('shareModalOverlay');
  if (modal) modal.remove();
};

window.shareExternalLink = function(postId) {
  const postUrl = `${window.location.origin}${window.location.pathname}#post-${postId}`;
  navigator.clipboard.writeText(postUrl).then(() => {
    alert('🔗 Link interno da publicação copiado!');
  });
  const modal = document.getElementById('shareModalOverlay');
  if (modal) modal.remove();
};

function setupRealtimeFeed() {
  if (feedSubscription) supabaseClient.removeChannel(feedSubscription);
  feedSubscription = supabaseClient.channel('public:posts_fast_sync').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, () => {
    loadPosts();
  }).subscribe();
}

// ============================================================
// GRUPOS DE ESTUDO & AULAS ONLINE
// ============================================================

async function loadGroups() {
  if (messageSubscription) {
    supabaseClient.removeChannel(messageSubscription);
    messageSubscription = null;
  }
  activeGroupId = null;

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
    card.onclick = () => openGroupChat(group);

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
        <div style="flex: 1; min-width: 0;">
          <h3 style="color: var(--accent); margin-bottom: 4px; word-break: break-all;">👥 ${escapeHtml(group.name)}</h3>
          <p style="font-size: 13px; color: #a8a8a8; margin: 0;">Clique para abrir a sala de aula / chat do grupo.</p>
        </div>
        <button id="enter-group-${group.id}" class="primary" style="padding: 6px 14px; font-size: 12px; flex-shrink: 0;">Entrar no Grupo</button>
      </div>
    `;
    groupsList.appendChild(card);

    setTimeout(() => {
      const btn = document.getElementById(`enter-group-${group.id}`);
      if (btn) btn.onclick = (e) => { e.stopPropagation(); openGroupChat(group); };
    }, 0);
  });
}

function openGroupChat(group) {
  activeGroupId = group.id;
  selectedGroupFileUrl = null;
  selectedGroupFileType = null;

  const groupsList = document.getElementById('groupsList');
  if (!groupsList) return;
  
  groupsList.innerHTML = `
    <div class="panel" style="display: flex; flex-direction: column; height: 68vh; padding: 0; overflow: hidden; background: #0b0b0f;">
      <div style="padding: 16px; background: #16161f; border-bottom: 1px solid #262626; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h3 style="margin: 0; color: var(--accent);">👥 ${escapeHtml(group.name)}</h3>
          <small style="color: #22c55e;">● Aula Online / Chat ao vivo</small>
        </div>
        <button onclick="loadGroups()" style="background: #262626; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer;">← Voltar aos Grupos</button>
      </div>

      <div id="chatMessages" style="flex: 1; padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px;">
        <p style="color: #737373; text-align: center;">A carregar mensagens...</p>
      </div>

      <div style="padding: 12px 16px; background: #16161f; border-top: 1px solid #262626; display: flex; gap: 8px; align-items: center;">
        <label for="groupFileInput" style="background: #262626; color: white; border: 1px solid #353542; border-radius: 8px; padding: 10px 12px; cursor: pointer; font-size: 13px;" title="Enviar foto ou videoaula">
          📁 Mídia
        </label>
        <input type="file" id="groupFileInput" accept="image/*,video/*" style="display: none;" onchange="handleGroupFileUpload(event)">

        <input type="text" id="chatInput" placeholder="Escreva uma mensagem para a turma..." style="flex: 1; background: #101017; color: white; border: 1px solid #353542; border-radius: 8px; padding: 10px; outline: none;" onkeydown="if(event.key === 'Enter') sendGroupMessage()">
        <button onclick="sendGroupMessage()" class="primary" style="padding: 0 20px;">Enviar</button>
      </div>
    </div>
  `;

  loadGroupMessages(group.id);
  setupRealtimeChat(group.id);
}

window.handleGroupFileUpload = async function(event) {
  const file = event.target.files[0];
  if (!file) return;

  alert('A carregar ficheiro para a aula online...');
  const isVideo = file.type.startsWith('video/');
  const fileExt = file.name.split('.').pop();
  const fileName = `group_${Date.now()}.${fileExt}`;
  const filePath = `groups/${fileName}`;

  const { error: uploadError } = await supabaseClient.storage.from('imagens').upload(filePath, file);
  if (uploadError) {
    alert('Erro ao enviar mídia: ' + uploadError.message);
    return;
  }

  const { data: urlData } = supabaseClient.storage.from('imagens').getPublicUrl(filePath);
  selectedGroupFileUrl = urlData.publicUrl;
  selectedGroupFileType = isVideo ? 'video' : 'image';
  
  alert(isVideo ? '📹 Vídeo pronto para enviar!' : '🖼️ Imagem pronta para enviar!');
};

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
    container.innerHTML = '<p style="color: #737373; text-align: center; margin: auto;">Nenhuma mensagem neste grupo ainda. Seja o primeiro a participar!</p>';
    return;
  }

  messages.forEach(msg => appendMessageToChat(msg));
  container.scrollTop = container.scrollHeight;
}

function appendMessageToChat(msg) {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  const emptyMsg = container.querySelector('p');
  if (emptyMsg && emptyMsg.textContent.includes('Nenhuma mensagem')) {
    emptyMsg.remove();
  }

  const isMe = msg.user_id === currentUser.id;
  const msgDiv = document.createElement('div');
  msgDiv.style.cssText = `max-width: 75%; padding: 10px 14px; border-radius: 10px; font-size: 13px; align-self: ${isMe ? 'flex-end' : 'flex-start'}; background: ${isMe ? '#2563eb' : '#1f1f2e'}; color: white; word-break: break-word; border: 1px solid ${isMe ? '#3b82f6' : '#262626'};`;
  
  const username = msg.profiles?.username || 'utilizador';

  let mediaHtml = '';
  if (msg.media_url) {
    if (msg.media_type === 'video' || msg.media_url.match(/\.(mp4|webm|ogg)$/i)) {
      mediaHtml = `
        <div style="margin-top: 8px; border-radius: 8px; overflow: hidden; background: #000;">
          <video src="${msg.media_url}" controls style="width: 100%; max-height: 250px; display: block;"></video>
        </div>
      `;
    } else {
      mediaHtml = `
        <div style="margin-top: 8px; border-radius: 8px; overflow: hidden;">
          <a href="${msg.media_url}" target="_blank"><img src="${msg.media_url}" style="width: 100%; max-height: 250px; object-fit: cover; display: block;"></a>
        </div>
      `;
    }
  }

  msgDiv.innerHTML = `
    <div style="font-size: 11px; font-weight: bold; color: ${isMe ? '#93c5fd' : '#38bdf8'}; margin-bottom: 4px;">@${username}</div>
    <div>${linkifyText(msg.content)}</div>
    ${mediaHtml}
  `;
  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}

window.sendGroupMessage = async function() {
  if (!activeGroupId) return;
  const input = document.getElementById('chatInput');
  const content = input ? input.value.trim() : '';

  if (!content && !selectedGroupFileUrl) return;

  if (input) input.value = '';

  const mediaUrlToSend = selectedGroupFileUrl;
  const mediaTypeToSend = selectedGroupFileType;

  selectedGroupFileUrl = null;
  selectedGroupFileType = null;

  const { error } = await supabaseClient.from('group_messages').insert([
    { 
      group_id: activeGroupId, 
      user_id: currentUser.id, 
      content,
      media_url: mediaUrlToSend,
      media_type: mediaTypeToSend
    }
  ]);

  if (error) {
    alert('❌ Erro ao enviar mensagem: ' + error.message);
  }
};

function setupRealtimeChat(groupId) {
  if (messageSubscription) {
    supabaseClient.removeChannel(messageSubscription);
  }

  messageSubscription = supabaseClient
    .channel(`public:group_messages:group_id=eq.${groupId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'group_messages',
      filter: `group_id=eq.${groupId}`
    }, async (payload) => {
      const { data: profileData } = await supabaseClient
        .from('profiles')
        .select('username')
        .eq('id', payload.new.user_id)
        .maybeSingle();

      const fullMessage = {
        ...payload.new,
        profiles: profileData || { username: 'utilizador' }
      };

      appendMessageToChat(fullMessage);
    })
    .subscribe();
}

function linkifyText(text) {
  if (!text) return '';
  const escaped = escapeHtml(text);
  const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%?=~_|!:,.;]*)/ig;
  return escaped.replace(urlRegex, function(url) {
    if (url.includes(window.location.host) && url.includes('#post-')) {
      return `<a href="${url}" style="color: #38bdf8; text-decoration: underline;">${url}</a>`;
    }
    return `<a href="${url}" target="_blank" style="color: #38bdf8; text-decoration: underline;">${url}</a>`;
  });
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]);
}

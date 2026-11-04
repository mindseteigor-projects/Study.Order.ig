// ============================================================
// STUDY ORDER — APP.JS (COMPLETO E VERIFICADO)
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
let isAdminAuthenticated = false;

const MASTER_TOTP_SECRET = "JBSWY3DPEHPK3PXP"; 

document.addEventListener('DOMContentLoaded', () => {
  setupAuthTabs();
  setupAuthForm();
  checkUser();
  setupNavigation();
  setupSecretAdminShortcut();
});

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
  if (!currentUser || !currentProfile || currentProfile.role !== 'admin') {
    alert('Acesso negado. Apenas administradores autenticados.');
    return;
  }

  if (isAdminAuthenticated) {
    renderAdminView();
    return;
  }

  const pass = prompt('🔐 [ADMIN MASTER] Insira a sua palavra-passe de administrador:');
  if (!pass) return;

  if (pass !== 'admin123') {
    alert('❌ Palavra-passe incorreta!');
    return;
  }

  const token = prompt('📱 [AUTHY 2FA] Insira o código de 6 dígitos gerado no seu aplicativo Authy / Google Authenticator:');
  if (!token || token.trim().length !== 6) {
    alert('❌ Código de verificação inválido.');
    return;
  }

  try {
    if (typeof window.otplib === 'undefined') {
      alert('Erro: Biblioteca TOTP não carregada. Verifique a tag script no index.html.');
      return;
    }

    window.otplib.authenticator.options = { window: 1 };
    const isValid = window.otplib.authenticator.check(token.trim(), MASTER_TOTP_SECRET);

    if (isValid) {
      isAdminAuthenticated = true;
      alert('✅ Código Authy validado com sucesso!');
      renderAdminView();
    } else {
      alert('❌ Código Authy incorreto ou expirado. Tente novamente.');
    }
  } catch (err) {
    console.error("Erro ao validar token TOTP:", err);
    alert('Erro técnico na validação do 2FA.');
  }
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
  const authForm = document.getElementById('authForm');
  const authSubmit = document.getElementById('authSubmit');
  const authMsg = document.getElementById('authMsg');

  if (!authSubmit) return;

  const executeLoginOrSignup = async (e) => {
    if (e) e.preventDefault();

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

  if (authForm) authForm.onsubmit = executeLoginOrSignup;
  authSubmit.onclick = (e) => { executeLoginOrSignup(e); };
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

    const adminPanelBtn = document.getElementById('adminPanelBtn');
    if (adminPanelBtn) {
      adminPanelBtn.classList.add('hidden');
    }
  } catch (err) {
    console.warn("Erro ao carregar perfil:", err);
    currentProfile = { id: currentUser.id, username: currentUser.email.split('@')[0], role: 'user', is_pro: false };
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
  loadGlobalBanner();
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
      const filePath = `posts/${fileName}`;

      const { error: uploadError } = await supabaseClient.storage.from('imagens').upload(filePath, file);
      if (uploadError) {
        alert('Erro ao enviar imagem: ' + uploadError.message);
        return;
      }

      const { data: urlData } = supabaseClient.storage.from('imagens').getPublicUrl(filePath);
      selectedPostFileUrl = urlData.publicUrl;
      alert('Imagem pronta para publicar!');
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
    const bgColor = banner.type === 'warning' ? '#ca8a04' : (banner.type === 'success' ? '#16a34a' : '#2563eb');
    bannerContainer.innerHTML = `
      <div style="background: ${bgColor}; color: white; padding: 10px 16px; border-radius: 8px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; font-size: 13px; font-weight: 500;">
        <span>📢 ${escapeHtml(banner.message)}</span>
        <button onclick="document.getElementById('systemGlobalBanner').innerHTML='';" style="background:transparent; border:none; color:white; font-size:16px; cursor:pointer;">✕</button>
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
      <div><span class="eyebrow" style="color: #ef4444;">ÁREA RESTRITA (AUTHY 2FA VERIFICADO)</span><h1>Painel de Administração</h1></div>
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

  if (!message) return alert('Escreva a mensagem do comunicado.');

  await supabaseClient.from('global_announcements').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');
  await supabaseClient.from('global_announcements').insert([{ message, type, is_active: true }]);
  
  if (msgInput) msgInput.value = '';
  alert('Banner publicado com sucesso!');
  loadGlobalBanner();
};

window.adminClearBanner = async function() {
  await supabaseClient.from('global_announcements').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');
  alert('Todos os banners foram desativados.');
  loadGlobalBanner();
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

  subjects.

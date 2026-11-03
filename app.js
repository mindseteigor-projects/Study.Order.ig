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
  const authSubmit = document.getElementById('authSubmit');
  
  if (!authForm) return;

  const handleAuth = async (e) => {
    if (e) e.preventDefault();

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
          await supabaseClient.from('profiles').upsert([
            { id: data.user.id, username, updated_at: new Date() }
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
          loadProfile();
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

  authForm.onsubmit = handleAuth;
  if (authSubmit) {
    authSubmit.onclick = (e) => {
      handleAuth(e);
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
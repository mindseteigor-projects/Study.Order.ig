// ============================================================
// STUDY ORDER — LÓGICA DE ENTRADA DEFINITIVA E DIRETA
// ============================================================

const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

let currentUser = null;
let currentProfile = null;
let currentFilterTag = null;

const MOTIVATIONAL_QUOTES = [
  "O sucesso é a soma de pequenos esforços repetidos dia após dia.",
  "Estudar não é acumular memória, é expandir a mente.",
  "A disciplina é a ponte entre seus objetivos e suas realizações.",
  "Acredite no seu processo. Cada hora de estudo conta!"
];

// ------------------------------------------------------------
// FUNÇÃO DE LOGIN / REGISTO FORÇADO VIA JAVASCRIPT
// ------------------------------------------------------------
window.handleDirectLogin = async function(e) {
  if (e) e.preventDefault();
  
  const emailInput = document.getElementById('email') || document.querySelector('input[type="email"]');
  const passwordInput = document.getElementById('password') || document.querySelector('input[type="password"]');
  const authMsg = document.getElementById('authMsg');

  const email = emailInput ? emailInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value.trim() : '';

  if (!email || !password) {
    alert('Por favor, introduza o e-mail e a palavra-passe.');
    return;
  }

  if (authMsg) authMsg.textContent = 'A autenticar no Supabase...';

  // Tentativa direta de Login
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    alert('Erro de autenticação: ' + error.message);
    if (authMsg) authMsg.textContent = 'Erro: ' + error.message;
  } else {
    currentUser = data.user;
    await checkUser();
  }
};

// Mapear botões e formulários assim que a página carrega
document.addEventListener('DOMContentLoaded', () => {
  setupAuthEvents();
});

function setupAuthEvents() {
  const authForm = document.getElementById('authForm') || document.querySelector('form');
  if (authForm) {
    authForm.onsubmit = window.handleDirectLogin;
  }

  // Se existir um botão "Entrar", forçar o evento onclick
  const submitBtn = document.getElementById('authSubmit') || document.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.onclick = window.handleDirectLogin;
  }
}

async function checkUser() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  const appScreen = document.getElementById('app');
  const authScreen = document.getElementById('authScreen');

  if (session) {
    currentUser = session.user;
    await loadProfile();
    if (authScreen) authScreen.classList.add('hidden');
    if (appScreen) appScreen.classList.remove('hidden');
    renderLayout();
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
// INTERFACE PRINCIPAL (INSTAGRAM + STUDYHUB)
// ------------------------------------------------------------
function renderLayout() {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  const todayQuote = MOTIVATIONAL_QUOTES[new Date().getDate() % MOTIVATIONAL_QUOTES.length];

  appContainer.innerHTML = `
    <div style="display: flex; width: 100vw; height: 100vh; background-color: #000; color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; overflow: hidden;">
      
      <!-- BARRA LATERAL FIXA -->
      <nav style="width: 250px; background: #000; border-right: 1px solid #262626; display: flex; flex-direction: column; justify-content: space-between; padding: 20px 12px; box-sizing: border-box; height: 100vh; flex-shrink: 0; z-index: 10;">
        <div>
          <div style="font-size: 22px; font-weight: bold; color: #fff; margin-bottom: 25px; padding-left: 8px;">
            Study Order ⚡
          </div>

          <div style="background: #121212; border: 1px solid #262626; padding: 10px; border-radius: 8px; margin-bottom: 20px; font-size: 11px; color: #38bdf8; line-height: 1.4;">
            <b>💡 Frase do dia:</b><br>"${todayQuote}"
          </div>

          <div style="display: flex; flex-direction: column; gap: 4px;">
            <button class="nav-btn active" data-target="feedView" style="display: flex; align-items: center; gap: 14px; background: transparent; border: none; color: #fff; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 15px; width: 100%; text-align: left;">
              <span>🏠</span> Página inicial
            </button>
            <button class="nav-btn" id="openCreateModalBtn" style="display: flex; align-items: center; gap: 14px; background: transparent; border: none; color: #f5f5f5; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 15px; width: 100%; text-align: left;">
              <span>➕</span> Criar Post
            </button>
            <button class="nav-btn" data-target="tasksView" style="display: flex; align-items: center; gap: 14px; background: transparent; border: none; color: #f5f5f5; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 15px; width: 100%; text-align: left;">
              <span>📓</span> Matérias & Tarefas
            </button>
            <button class="nav-btn" data-target="evolutionView" style="display: flex; align-items: center; gap: 14px; background: transparent; border: none; color: #f5f5f5; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 15px; width: 100%; text-align: left;">
              <span>📊</span> Evolução
            </button>
            <button class="nav-btn" data-target="groupsView" style="display: flex; align-items: center; gap: 14px; background: transparent; border: none; color: #f5f5f5; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 15px; width: 100%; text-align: left;">
              <span>👥</span> Comunidades
            </button>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 4px; border-top: 1px solid #262626; padding-top: 12px;">
          <button class="nav-btn" data-target="aiView" style="display: flex; align-items: center; gap: 14px; background: transparent; border: none; color: #f5f5f5; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 15px; width: 100%; text-align: left;">
            <span>🤖</span> IA Assistente
          </button>
          <button id="logoutBtn" style="display: flex; align-items: center; gap: 14px; background: transparent; border: none; color: #ed4956; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 15px; width: 100%; text-align: left;">
            <span>🚪</span> Sair (@${currentProfile ? currentProfile.username : 'user'})
          </button>
        </div>
      </nav>

      <!-- CONTEÚDO PRINCIPAL -->
      <main style="flex: 1; height: 100vh; overflow-y: auto; background-color: #000; display: flex; justify-content: center; padding: 20px 0;">
        <div style="width: 100%; max-width: 550px;">
          
          <div id="feedView" class="view-section" style="display: block;">
            <div id="postsList"></div>
          </div>

          <div id="tasksView" class="view-section" style="display: none; padding: 0 16px;">
            <h2 style="font-size: 20px; font-weight: bold; margin-bottom: 16px;">Organizador de Tarefas e Eventos</h2>
            <div style="background: #121212; border: 1px solid #262626; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
              <input type="text" id="taskTitle" placeholder="Nome da tarefa/evento..." style="width: 100%; background: #000; border: 1px solid #262626; padding: 10px; color: #fff; border-radius: 6px; margin-bottom: 10px; outline: none;">
              <div style="display: flex; gap: 8px; margin-bottom: 10px;">
                <input type="date" id="taskStartDate" style="flex:1; background: #000; border: 1px solid #262626; padding: 8px; color: #fff; border-radius: 6px;">
                <input type="date" id="taskDueDate" style="flex:1; background: #000; border: 1px solid #262626; padding: 8px; color: #fff; border-radius: 6px;">
              </div>
              <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                <select id="taskPriority" style="flex:1; background: #000; border: 1px solid #262626; padding: 8px; color: #fff; border-radius: 6px;">
                  <option value="1">Prioridade 1 (Mais Alta)</option>
                  <option value="2">Prioridade 2</option>
                  <option value="3">Prioridade 3</option>
                  <option value="4">Prioridade 4</option>
                  <option value="5">Prioridade 5</option>
                  <option value="6">Prioridade 6 (Baixa)</option>
                </select>
                <input type="time" id="taskEndTime" style="flex:1; background: #000; border: 1px solid #262626; padding: 8px; color: #fff; border-radius: 6px;">
              </div>
              <button id="saveTaskBtn" style="width: 100%; background: #0095f6; color: #fff; border: none; padding: 10px; border-radius: 6px; font-weight: bold; cursor: pointer;">Adicionar Tarefa</button>
            </div>
            <div id="tasksList"></div>
          </div>

          <div id="evolutionView" class="view-section" style="display: none; padding: 0 16px;">
            <h2 style="font-size: 20px; font-weight: bold; margin-bottom: 16px;">Evolução do Estudante</h2>
            <div style="background: #121212; border: 1px solid #262626; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 12px;"><span>Tarefas Concluídas:</span> <b id="statCompleted">0</b></div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 12px;"><span>Tarefas Não Executadas:</span> <b id="statFailed">0</b></div>
              <div style="display: flex; justify-content: space-between;"><span>Taxa de Evolução:</span> <b id="statRate" style="color: #22c55e;">0%</b></div>
            </div>
          </div>

          <div id="groupsView" class="view-section" style="display: none; padding: 0 16px;">
            <h2 style="font-size: 20px; font-weight: bold;">Comunidades</h2>
            <div id="groupsList"></div>
          </div>

          <div id="aiView" class="view-section" style="display: none; padding: 0 16px;">
            <h2 style="font-size: 20px; font-weight: bold;">Assistente IA</h2>
            <div style="background: #121212; border: 1px solid #262626; border-radius: 12px; padding: 16px; height: 350px; overflow-y: auto;" id="aiChatBox">
              <div style="color: #0095f6;"><b>IA:</b> Como posso orientar seus estudos agora?</div>
            </div>
          </div>

        </div>
      </main>

      <!-- MODAL DE CREAÇÃO DE POST -->
      <div id="createPostModal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.95); z-index: 1000; flex-direction: column; justify-content: space-between; padding: 20px; box-sizing: border-box;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span id="closePostModalBtn" style="font-size: 28px; cursor: pointer; color: #fff;">✕</span>
          <span style="font-weight: bold; font-size: 16px;">Criar Publicação</span>
          <button id="submitPostBtn" style="background: #0095f6; color: #fff; border: none; padding: 6px 16px; border-radius: 20px; font-weight: bold; cursor: pointer;">Compartilhar</button>
        </div>

        <div style="display: flex; flex: 1; align-items: center; justify-content: center; margin: 20px 0;">
          <div style="width: 100%; max-width: 400px; background: #000; padding: 20px; border-radius: 16px; border: 1px solid #262626;">
            <textarea id="postContentInput" placeholder="Escreva a legenda do post..." style="width: 100%; background: transparent; border: none; color: #fff; font-size: 15px; resize: none; outline: none; height: 100px;"></textarea>
            <input type="file" id="postFileInput" accept="image/*,video/*" style="margin-top: 10px; color: #fff; font-size: 12px; width: 100%;">
          </div>
        </div>
      </div>

    </div>
  `;

  initAppLogic();
}

function initAppLogic() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    if (btn.id === 'openCreateModalBtn') return;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.view-section').forEach(v => v.style.display = 'none');
      const target = document.getElementById(btn.dataset.target);
      if (target) target.style.display = 'block';
    });
  });

  const modal = document.getElementById('createPostModal');
  document.getElementById('openCreateModalBtn')?.addEventListener('click', () => { modal.style.display = 'flex'; });
  document.getElementById('closePostModalBtn')?.addEventListener('click', () => { modal.style.display = 'none'; });

  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    location.reload();
  });

  loadPosts();
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

  for (let post of posts) {
    const card = document.createElement('div');
    card.style.cssText = 'background: #000; border-bottom: 1px solid #262626; margin-bottom: 16px; padding-bottom: 16px;';
    card.innerHTML = `
      <div style="padding: 10px 4px; font-weight: 600;">@${post.profiles?.username || 'utilizador'}</div>
      <div style="padding: 4px;">${escapeHtml(post.content)}</div>
    `;
    container.appendChild(card);
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

// Inicializar verificação
setupAuthEvents();
checkUser();

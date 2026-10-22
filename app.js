// ============================================================
// STUDY ORDER — CÓDIGO COMPLETO DEFINITIVO (CORRIGIDO LOGIN/CADASTRO)
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
// 1. INICIALIZAÇÃO E AUTENTICAÇÃO (CORREÇÃO DE ABAS E SUBMISSÃO)
// ------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  setupAuthListeners();
  checkUser();
});

function setupAuthListeners() {
  const authForm = document.getElementById('authForm') || document.querySelector('form');
  const authTabs = document.querySelectorAll('.auth-tab');
  const usernameFieldContainer = document.getElementById('usernameFieldContainer');
  const authSubmit = document.getElementById('authSubmit');
  const usernameInput = document.getElementById('usernameInput');

  // Garante a interatividade exata das abas de Login e Criar Conta
  if (authTabs && authTabs.length > 0) {
    authTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        authTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Identifica pelo texto ou pelo dataset
        const tabText = tab.textContent.toLowerCase();
        activeAuthMode = (tabText.includes('criar') || tab.dataset.auth === 'signup') ? 'signup' : 'login';

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

  if (authForm) {
    authForm.onsubmit = async (e) => {
      e.preventDefault();
      
      const emailInput = document.getElementById('email') || document.querySelector('input[type="email"]');
      const passwordInput = document.getElementById('password') || document.querySelector('input[type="password"]');
      const authMsg = document.getElementById('authMsg');

      const email = emailInput ? emailInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value.trim() : '';

      if (!email || !password) {
        alert('Por favor, preencha o e-mail e a palavra-passe.');
        return;
      }

      if (authMsg) authMsg.textContent = 'A processar...';

      if (activeAuthMode === 'signup') {
        const username = usernameInput ? usernameInput.value.trim() : 'estudante';
        
        const { data, error } = await supabaseClient.auth.signUp({
          email,
          password,
          options: { data: { username } }
        });

        if (error) {
          alert('Erro ao criar conta: ' + error.message);
          if (authMsg) authMsg.textContent = error.message;
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
          alert('Erro ao entrar: ' + error.message);
          if (authMsg) authMsg.textContent = error.message;
          return;
        }

        checkUser();
      }
    };
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
// 2. LAYOUT PRINCIPAL E NAVEGAÇÃO DA APLICAÇÃO
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
            <button class="nav-btn" data-target="studyOrganizerView" style="display: flex; align-items: center; gap: 14px; background: transparent; border: none; color: #f5f5f5; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 15px; width: 100%; text-align: left;">
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

      <!-- ÁREA DE CONTEÚDO PRINCIPAL -->
      <main style="flex: 1; height: 100vh; overflow-y: auto; background-color: #000; display: flex; justify-content: center; padding: 20px;">
        <div style="width: 100%; max-width: 680px;">
          
          <!-- VIEW 1: FEED -->
          <div id="feedView" class="view-section" style="display: block;">
            <div id="postsList"></div>
          </div>

          <!-- VIEW 2: MATÉRIAS & TAREFAS -->
          <div id="studyOrganizerView" class="view-section" style="display: none;">
            <div style="display: flex; border-bottom: 1px solid #262626; margin-bottom: 20px;">
              <button id="tabSubjectsBtn" onclick="switchOrganizerTab('subjects')" style="flex:1; background:none; border:none; color:#38bdf8; border-bottom:2px solid #38bdf8; padding:12px; font-weight:bold; cursor:pointer;">📁 Pastas de Matérias</button>
              <button id="tabTasksBtn" onclick="switchOrganizerTab('tasks')" style="flex:1; background:none; border:none; color:#737373; padding:12px; font-weight:bold; cursor:pointer;">📋 Tarefas & Lembretes</button>
            </div>

            <div id="subjectsSubView" style="display: block;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h3 style="margin: 0; font-size: 18px;">Suas Pastas de Estudo</h3>
                <button onclick="createNewSubjectFolder()" style="background: #0095f6; color: #fff; border: none; padding: 8px 14px; border-radius: 8px; font-weight: bold; cursor: pointer;">+ Nova Pasta / Matéria</button>
              </div>

              <div id="subjectsGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; margin-bottom: 24px;"></div>

              <div id="subjectDetailArea" style="display: none; background: #121212; border: 1px solid #262626; border-radius: 12px; padding: 16px; margin-top: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid #262626; padding-bottom: 10px;">
                  <h3 id="currentSubjectTitle" style="margin: 0; color: #38bdf8;">Nome da Matéria</h3>
                  <button onclick="closeSubjectDetail()" style="background: none; border: none; color: #737373; cursor: pointer;">✕ Fechar</button>
                </div>

                <div style="background: #000; border: 1px solid #262626; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
                  <h4 style="margin: 0 0 10px 0; font-size: 14px;">Adicionar Material de Estudo</h4>
                  <input type="text" id="materialTitle" placeholder="Título do material (ex: Resumo, Vídeo)..." style="width: 100%; background: #121212; border: 1px solid #262626; padding: 8px; color: #fff; border-radius: 6px; margin-bottom: 8px; outline: none; font-size: 13px;">
                  
                  <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                    <select id="materialType" style="background: #121212; border: 1px solid #262626; padding: 8px; color: #fff; border-radius: 6px; font-size: 13px;">
                      <option value="text">📄 Anotação / Texto</option>
                      <option value="link">🔗 Link / Referência</option>
                      <option value="video">🎥 Vídeo (URL / MP4)</option>
                      <option value="image">🖼️ Imagem (URL)</option>
                    </select>
                    <input type="text" id="materialUrl" placeholder="URL do Vídeo, Imagem ou Link" style="flex: 1; background: #121212; border: 1px solid #262626; padding: 8px; color: #fff; border-radius: 6px; outline: none; font-size: 13px;">
                  </div>

                  <textarea id="materialContent" placeholder="Escreva suas anotações ou detalhes..." style="width: 100%; background: #121212; border: 1px solid #262626; padding: 8px; color: #fff; border-radius: 6px; resize: none; height: 70px; outline: none; font-size: 13px; font-family: inherit;"></textarea>
                  
                  <button onclick="addMaterialToSubject()" style="width: 100%; background: #38bdf8; color: #000; border: none; padding: 8px; border-radius: 6px; font-weight: bold; margin-top: 8px; cursor: pointer;">Salvar Material na Pasta</button>
                </div>

                <div id="subjectMaterialsList"></div>
              </div>
            </div>

            <div id="tasksSubView" style="display: none;">
              <div style="background: #121212; border: 1px solid #262626; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                <h4 style="margin: 0 0 12px 0; font-size: 15px;">Criar Nova Tarefa / Evento</h4>
                
                <input type="text" id="taskTitle" placeholder="Nome da tarefa ou compromisso..." style="width: 100%; background: #000; border: 1px solid #262626; padding: 10px; color: #fff; border-radius: 6px; margin-bottom: 10px; outline: none;">
                
                <div style="display: flex; gap: 8px; margin-bottom: 10px;">
                  <div style="flex:1;">
                    <label style="font-size: 11px; color: #737373;">Início:</label>
                    <input type="date" id="taskStartDate" style="width:100%; background: #000; border: 1px solid #262626; padding: 8px; color: #fff; border-radius: 6px;">
                  </div>
                  <div style="flex:1;">
                    <label style="font-size: 11px; color: #737373;">Término (Prazo):</label>
                    <input type="date" id="taskDueDate" style="width:100%; background: #000; border: 1px solid #262626; padding: 8px; color: #fff; border-radius: 6px;">
                  </div>
                </div>

                <div style="display: flex; gap: 8px; margin-bottom: 10px;">
                  <div style="flex:1;">
                    <label style="font-size: 11px; color: #737373;">Prioridade (1 a 6):</label>
                    <select id="taskPriority" style="width:100%; background: #000; border: 1px solid #262626; padding: 8px; color: #fff; border-radius: 6px;">
                      <option value="1">Prioridade 1 (Urgente)</option>
                      <option value="2">Prioridade 2</option>
                      <option value="3">Prioridade 3</option>
                      <option value="4">Prioridade 4</option>
                      <option value="5">Prioridade 5</option>
                      <option value="6">Prioridade 6 (Normal)</option>
                    </select>
                  </div>
                  <div style="flex:1;">
                    <label style="font-size: 11px; color: #737373;">Hora Término:</label>
                    <input type="time" id="taskEndTime" style="width:100%; background: #000; border: 1px solid #262626; padding: 8px; color: #fff; border-radius: 6px;">
                  </div>
                </div>

                <div style="margin-bottom: 12px;">
                  <label style="font-size: 11px; color: #38bdf8; font-weight: bold;">⏰ Lembrete do Evento:</label>
                  <select id="taskReminder" style="width:100%; background: #000; border: 1px solid #262626; padding: 8px; color: #fff; border-radius: 6px; margin-top: 4px;">
                    <option value="1h">Lembrar 1 hora antes de acabar (Free)</option>
                    <option value="2h">Lembrar 2 horas antes de acabar (PRO)</option>
                    <option value="30m">Lembrar 30 minutos antes de acabar (PRO)</option>
                    <option value="end">Lembrar no exato momento que acabar</option>
                  </select>
                </div>

                <button id="saveTaskBtn" onclick="createTask()" style="width: 100%; background: #0095f6; color: #fff; border: none; padding: 10px; border-radius: 6px; font-weight: bold; cursor: pointer;">Adicionar à Lista de Estudos</button>
              </div>

              <div style="display: flex; gap: 8px; margin-bottom: 16px; overflow-x: auto; padding-bottom: 4px;">
                <button onclick="loadTasks('date')" style="background: #262626; color: #fff; border: none; padding: 6px 12px; border-radius: 16px; font-size: 12px; cursor: pointer;">1. Por Datas</button>
                <button onclick="loadTasks('priority')" style="background: #262626; color: #fff; border: none; padding: 6px 12px; border-radius: 16px; font-size: 12px; cursor: pointer;">2. Por Prioridade</button>
                <button onclick="loadTasks('p_date')" style="background: #262626; color: #fff; border: none; padding: 6px 12px; border-radius: 16px; font-size: 12px; cursor: pointer;">3. Prioridade + Término</button>
                <button onclick="loadTasks('smart')" style="background: #f59e0b; color: #000; border: none; padding: 6px 12px; border-radius: 16px; font-size: 12px; font-weight: bold; cursor: pointer;">4. SmartPlan (IA)</button>
              </div>

              <div id="tasksList"></div>
            </div>
          </div>

          <!-- VIEW 3: EVOLUÇÃO -->
          <div id="evolutionView" class="view-section" style="display: none;">
            <h2 style="font-size: 20px; font-weight: bold; margin-bottom: 16px;">Evolução do Estudante</h2>
            <div style="background: #121212; border: 1px solid #262626; border-radius: 12px; padding: 20px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 12px;"><span>Tarefas Concluídas:</span> <b id="statCompleted">0</b></div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 12px;"><span>Tarefas Não Executadas:</span> <b id="statFailed">0</b></div>
              <div style="display: flex; justify-content: space-between;"><span>Taxa de Evolução:</span> <b id="statRate" style="color: #22c55e;">0%</b></div>
            </div>
          </div>

          <!-- VIEW 4: COMUNIDADES & IA -->
          <div id="groupsView" class="view-section" style="display: none;">
            <h2 style="font-size: 20px; font-weight: bold;">Comunidades</h2>
            <div id="groupsList"></div>
          </div>

          <div id="aiView" class="view-section" style="display: none;">
            <h2 style="font-size: 20px; font-weight: bold;">Assistente IA</h2>
            <div style="background: #121212; border: 1px solid #262626; border-radius: 12px; padding: 16px; height: 350px; overflow-y: auto;" id="aiChatBox">
              <div style="color: #0095f6;"><b>IA:</b> Como posso orientar seus estudos agora?</div>
            </div>
          </div>

        </div>
      </main>

      <!-- MODAL DE PUBLICAÇÃO -->
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

  document.getElementById('submitPostBtn')?.addEventListener('click', async () => {
    const content = document.getElementById('postContentInput').value.trim();
    const fileInput = document.getElementById('postFileInput');
    const file = fileInput ? fileInput.files[0] : null;

    if (!content) return;

    let media_url = null;
    let media_type = null;

    if (file) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `posts/${fileName}`;

      const { error: uploadError } = await supabaseClient.storage.from('media').upload(filePath, file);
      if (!uploadError) {
        const { data: urlData } = supabaseClient.storage.from('media').getPublicUrl(filePath);
        media_url = urlData.publicUrl;
        media_type = file.type.startsWith('video') ? 'video' : 'image';
      }
    }

    const hashtagMatch = content.match(/#[a-zA-Z0-9_]+/);
    const hashtag = hashtagMatch ? hashtagMatch[0].toLowerCase() : null;

    await supabaseClient.from('posts').insert([
      { user_id: currentUser.id, content, media_url, media_type, hashtag }
    ]);

    document.getElementById('postContentInput').value = '';
    if (fileInput) fileInput.value = '';
    modal.style.display = 'none';
    loadPosts();
  });

  loadPosts();
  loadSubjects();
  loadTasks('date');
  loadEvolutionStats();
}

// ------------------------------------------------------------
// 3. MATÉRIAS & MATERIAIS
// ------------------------------------------------------------
window.switchOrganizerTab = function(tab) {
  const subjectsView = document.getElementById('subjectsSubView');
  const tasksView = document.getElementById('tasksSubView');
  const subjectsBtn = document.getElementById('tabSubjectsBtn');
  const tasksBtn = document.getElementById('tabTasksBtn');

  if (tab === 'subjects') {
    subjectsView.style.display = 'block';
    tasksView.style.display = 'none';
    subjectsBtn.style.color = '#38bdf8';
    subjectsBtn.style.borderBottom = '2px solid #38bdf8';
    tasksBtn.style.color = '#737373';
    tasksBtn.style.borderBottom = 'none';
  } else {
    subjectsView.style.display = 'none';
    tasksView.style.display = 'block';
    tasksBtn.style.color = '#38bdf8';
    tasksBtn.style.borderBottom = '2px solid #38bdf8';
    subjectsBtn.style.color = '#737373';
    subjectsBtn.style.borderBottom = 'none';
  }
}

async function loadSubjects() {
  const grid = document.getElementById('subjectsGrid');
  if (!grid) return;

  const { data: subjects } = await supabaseClient.from('subjects').select('*').eq('user_id', currentUser.id);
  grid.innerHTML = '';

  if (!subjects || subjects.length === 0) {
    grid.innerHTML = '<p style="color: #737373; grid-column: 1/-1;">Nenhuma pasta de matéria criada.</p>';
    return;
  }

  subjects.forEach(sub => {
    const card = document.createElement('div');
    card.style.cssText = 'background: #121212; border: 1px solid #262626; border-radius: 10px; padding: 14px; cursor: pointer;';
    card.onclick = () => openSubjectDetail(sub.id, sub.name);
    card.innerHTML = `
      <div style="font-size: 24px; margin-bottom: 8px;">📁</div>
      <div style="font-weight: bold; font-size: 14px; color: #fff;">${escapeHtml(sub.name)}</div>
      <div style="font-size: 11px; color: #737373; margin-top: 4px;">Abrir arquivos</div>
    `;
    grid.appendChild(card);
  });
}

window.createNewSubjectFolder = async function() {
  const name = prompt('Nome da nova matéria (ex: Matemática, Biologia):');
  if (!name) return;

  await supabaseClient.from('subjects').insert([{ user_id: currentUser.id, name }]);
  loadSubjects();
}

async function openSubjectDetail(subjectId, subjectName) {
  selectedSubjectId = subjectId;
  document.getElementById('subjectDetailArea').style.display = 'block';
  document.getElementById('currentSubjectTitle').textContent = `📁 ${subjectName}`;
  loadSubjectMaterials(subjectId);
}

window.closeSubjectDetail = function() {
  document.getElementById('subjectDetailArea').style.display = 'none';
  selectedSubjectId = null;
}

window.addMaterialToSubject = async function() {
  if (!selectedSubjectId) return;

  const title = document.getElementById('materialTitle').value.trim();
  const type = document.getElementById('materialType').value;
  const url = document.getElementById('materialUrl').value.trim();
  const content = document.getElementById('materialContent').value.trim();

  if (!title && !content) {
    alert('Preencha o título ou conteúdo do material.');
    return;
  }

  await supabaseClient.from('subject_contents').insert([
    { subject_id: selectedSubjectId, user_id: currentUser.id, title, type, url: url || null, content }
  ]);

  document.getElementById('materialTitle').value = '';
  document.getElementById('materialUrl').value = '';
  document.getElementById('materialContent').value = '';
  loadSubjectMaterials(selectedSubjectId);
}

async function loadSubjectMaterials(subjectId) {
  const list = document.getElementById('subjectMaterialsList');
  if (!list) return;

  const { data: materials } = await supabaseClient.from('subject_contents').select('*').eq('subject_id', subjectId).order('created_at', { ascending: false });
  list.innerHTML = '';

  if (!materials || materials.length === 0) {
    list.innerHTML = '<p style="color: #737373; font-size: 12px;">Nenhum arquivo ou nota nesta pasta.</p>';
    return;
  }

  materials.forEach(mat => {
    const item = document.createElement('div');
    item.style.cssText = 'background: #000; border: 1px solid #262626; border-radius: 8px; padding: 12px; margin-bottom: 10px;';

    let mediaRender = '';
    if (mat.type === 'image' && mat.url) mediaRender = `<img src="${mat.url}" style="width: 100%; max-height: 250px; object-fit: cover; border-radius: 6px; margin-top: 8px;">`;
    if (mat.type === 'video' && mat.url) mediaRender = `<video src="${mat.url}" controls style="width: 100%; max-height: 250px; margin-top: 8px;"></video>`;
    if (mat.type === 'link' && mat.url) mediaRender = `<a href="${mat.url}" target="_blank" style="color: #38bdf8; font-size: 12px; display: block; margin-top: 6px;">🔗 Abrir link externo</a>`;

    item.innerHTML = `
      <div style="font-weight: bold; font-size: 13px; color: #38bdf8;">${escapeHtml(mat.title || 'Material')}</div>
      <p style="font-size: 13px; color: #e2e8f0; margin: 6px 0; line-height: 1.4;">${escapeHtml(mat.content)}</p>
      ${mediaRender}
    `;
    list.appendChild(item);
  });
}

// ------------------------------------------------------------
// 4. TAREFAS E LEMBRETES
// ------------------------------------------------------------
window.createTask = async function() {
  const title = document.getElementById('taskTitle').value.trim();
  const start_date = document.getElementById('taskStartDate').value;
  const due_date = document.getElementById('taskDueDate').value;
  const priority = document.getElementById('taskPriority').value;
  const end_time = document.getElementById('taskEndTime').value;
  const reminder_time = document.getElementById('taskReminder').value;

  if (!title || !start_date || !due_date || !end_time) {
    alert('Preencha os campos obrigatórios da tarefa.');
    return;
  }

  await supabaseClient.from('tasks').insert([
    { user_id: currentUser.id, title, start_date, due_date, priority, end_time, reminder_time }
  ]);

  document.getElementById('taskTitle').value = '';
  loadTasks('date');
  loadEvolutionStats();
}

window.loadTasks = async function(orderBy) {
  const container = document.getElementById('tasksList');
  if (!container) return;

  let query = supabaseClient.from('tasks').select('*').eq('user_id', currentUser.id);

  if (orderBy === 'date') query = query.order('due_date', { ascending: true });
  if (orderBy === 'priority') query = query.order('priority', { ascending: true });
  if (orderBy === 'p_date') query = query.order('priority', { ascending: true }).order('due_date', { ascending: true });
  if (orderBy === 'smart') query = query.order('priority', { ascending: true }).order('end_time', { ascending: true });

  const { data: tasks } = await query;
  container.innerHTML = '';

  if (!tasks || tasks.length === 0) {
    container.innerHTML = '<p style="color: #737373; text-align: center; padding: 20px;">Nenhuma tarefa cadastrada.</p>';
    return;
  }

  tasks.forEach(task => {
    const item = document.createElement('div');
    item.style.cssText = 'background: #121212; border: 1px solid #262626; border-radius: 8px; padding: 12px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;';
    
    let reminderText = '1 hora antes';
    if (task.reminder_time === '2h') reminderText = '2 horas antes (PRO)';
    if (task.reminder_time === '30m') reminderText = '30 minutos antes (PRO)';
    if (task.reminder_time === 'end') reminderText = 'No término exato';

    item.innerHTML = `
      <div>
        <div style="font-weight: bold; font-size: 14px; ${task.completed ? 'text-decoration: line-through; color: #a8a8a8;' : ''}">${escapeHtml(task.title)}</div>
        <small style="color: #a8a8a8;">Até ${task.due_date} às ${task.end_time} | Prioridade: ${task.priority}</small>
        <div style="font-size: 11px; color: #38bdf8; margin-top: 3px; font-weight: 500;">⏰ Lembrete: ${reminderText}</div>
        ${task.justification ? `<div style="color: #f59e0b; font-size: 11px; margin-top: 4px;">Motivo alteração: ${escapeHtml(task.justification)}</div>` : ''}
      </div>
      <div style="display: flex; gap: 8px;">
        <button onclick="toggleTaskStatus('${task.id}', true, ${task.completed})" style="background: ${task.completed ? '#22c55e' : '#262626'}; border: none; color: #fff; padding: 6px 10px; border-radius: 4px; cursor: pointer;">✓</button>
        <button onclick="toggleTaskStatus('${task.id}', false, ${task.failed})" style="background: ${task.failed ? '#ef4444' : '#262626'}; border: none; color: #fff; padding: 6px 10px; border-radius: 4px; cursor: pointer;">✕</button>
      </div>
    `;
    container.appendChild(item);
  });
}

window.toggleTaskStatus = async function(taskId, isCompleted, currentStatus) {
  let justification = null;
  if (currentStatus) {
    justification = prompt('Justifique o motivo de desmarcar ou alterar a tarefa:');
    if (!justification) return;
  }

  const updatePayload = isCompleted 
    ? { completed: !currentStatus, failed: false, justification } 
    : { failed: !currentStatus, completed: false, justification };

  await supabaseClient.from('tasks').update(updatePayload).eq('id', taskId);
  loadTasks('date');
  loadEvolutionStats();
}

async function loadEvolutionStats() {
  const { data: tasks } = await supabaseClient.from('tasks').select('*').eq('user_id', currentUser.id);
  if (!tasks) return;

  const completed = tasks.filter(t => t.completed).length;
  const failed = tasks.filter(t => t.failed).length;
  const total = tasks.length;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const compEl = document.getElementById('statCompleted');
  const failEl = document.getElementById('statFailed');
  const rateEl = document.getElementById('statRate');

  if (compEl) compEl.textContent = completed;
  if (failEl) failEl.textContent = failed;
  if (rateEl) rateEl.textContent = `${rate}%`;
}

// ------------------------------------------------------------
// 5. FEED E POSTS
// ------------------------------------------------------------
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
    
    let mediaRender = '';
    if (post.media_url) {
      if (post.media_type === 'video') {
        mediaRender = `<video src="${post.media_url}" controls style="width: 100%; max-height: 450px; display: block; margin-top: 8px;"></video>`;
      } else {
        mediaRender = `<img src="${post.media_url}" style="width: 100%; max-height: 450px; object-fit: cover; display: block; margin-top: 8px;">`;
      }
    }

    card.innerHTML = `
      <div style="padding: 10px 4px; font-weight: 600;">@${post.profiles?.username || 'utilizador'}</div>
      <div style="padding: 4px; font-size: 14px;">${escapeHtml(post.content)}</div>
      ${mediaRender}
    `;
    container.appendChild(card);
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

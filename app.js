// ============================================================
// STUDY ORDER — CÓDIGO COMPLETO INTEGRADO (INSTAGRAM + STUDYHUB)
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

async function checkUser() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    currentUser = session.user;
    await loadProfile();
    const appScreen = document.getElementById('app');
    const authScreen = document.getElementById('authScreen');
    if (authScreen) authScreen.classList.add('hidden');
    if (appScreen) appScreen.classList.remove('hidden');
    renderLayout();
    checkAdPopup();
  }
}

async function loadProfile() {
  if (!currentUser) return;
  const { data } = await supabaseClient.from('profiles').select('*').eq('id', currentUser.id).single();
  if (data) currentProfile = data;
}

// Anúncio de 5 Segundos ao Entrar (Gratuito)
function checkAdPopup() {
  if (currentProfile && currentProfile.is_pro) return;
  const adOverlay = document.createElement('div');
  adOverlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.92); z-index:9999; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff;';
  adOverlay.innerHTML = `
    <div style="background:#161920; padding:30px; border-radius:12px; text-align:center; max-width:400px; border:1px solid #2d3139;">
      <h3 style="margin-top:0;">Patrocinador do Dia</h3>
      <p style="color:#a8a8a8; font-size:14px;">Anúncio relevante para a sua região.</p>
      <div style="margin:20px 0; background:#20242d; padding:40px; border-radius:8px;">📢 Anúncio Ativo</div>
      <small id="adTimer" style="color:#38bdf8;">Aguarde 5 segundos...</small>
    </div>
  `;
  document.body.appendChild(adOverlay);

  let timeLeft = 5;
  const interval = setInterval(() => {
    timeLeft--;
    const timerEl = document.getElementById('adTimer');
    if (timerEl) timerEl.textContent = `Aguarde ${timeLeft} segundos...`;
    if (timeLeft <= 0) {
      clearInterval(interval);
      adOverlay.remove();
    }
  }, 1000);
}

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

          <!-- Frase Motivacional Diária -->
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
            ${currentProfile?.is_admin ? `
              <button class="nav-btn" data-target="adminView" style="display: flex; align-items: center; gap: 14px; background: transparent; border: none; color: #f59e0b; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 15px; width: 100%; text-align: left; font-weight: bold;">
                <span>🛠️</span> Painel ADM
              </button>
            ` : ''}
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

      <!-- ÁREA CENTRAL DE CONTEÚDO -->
      <main style="flex: 1; height: 100vh; overflow-y: auto; background-color: #000; display: flex; justify-content: center; padding: 20px 0;">
        <div style="width: 100%; max-width: 550px;">
          
          <!-- VIEW 1: FEED (INSTAGRAM REFINADO) -->
          <div id="feedView" class="view-section" style="display: block;">
            <div id="postsList"></div>
          </div>

          <!-- VIEW 2: ORGANIZADOR DE TAREFAS E MATÉRIAS -->
          <div id="tasksView" class="view-section" style="display: none; padding: 0 16px;">
            <h2 style="font-size: 20px; font-weight: bold; margin-bottom: 16px;">Organizador de Tarefas e Eventos</h2>
            
            <!-- Form de Criação de Tarefa -->
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

            <!-- Filtros de Ordenação de Lista -->
            <div style="display: flex; gap: 8px; margin-bottom: 16px; overflow-x: auto; padding-bottom: 4px;">
              <button onclick="loadTasks('date')" style="background: #262626; color: #fff; border: none; padding: 6px 12px; border-radius: 16px; font-size: 12px; cursor: pointer;">Por Data</button>
              <button onclick="loadTasks('priority')" style="background: #262626; color: #fff; border: none; padding: 6px 12px; border-radius: 16px; font-size: 12px; cursor: pointer;">Por Prioridade</button>
              <button onclick="loadTasks('p_date')" style="background: #262626; color: #fff; border: none; padding: 6px 12px; border-radius: 16px; font-size: 12px; cursor: pointer;">Prioridade + Término</button>
              ${currentProfile?.is_pro ? `<button onclick="loadTasks('smart')" style="background: #f59e0b; color: #000; border: none; padding: 6px 12px; border-radius: 16px; font-size: 12px; font-weight: bold; cursor: pointer;">SmartPlan PRO</button>` : ''}
            </div>

            <!-- Lista de Tarefas -->
            <div id="tasksList"></div>
          </div>

          <!-- VIEW 3: ABA DE EVOLUÇÃO -->
          <div id="evolutionView" class="view-section" style="display: none; padding: 0 16px;">
            <h2 style="font-size: 20px; font-weight: bold; margin-bottom: 16px;">Evolução do Estudante</h2>
            <div style="background: #121212; border: 1px solid #262626; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
              <h3 style="margin-top: 0; font-size: 16px; color: #38bdf8;">Desempenho Geral</h3>
              <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px;">
                <span>Tarefas Concluídas:</span> <b id="statCompleted">0</b>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px;">
                <span>Tarefas Não Executadas:</span> <b id="statFailed">0</b>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 14px;">
                <span>Taxa de Evolução Semanal/Mensal:</span> <b id="statRate" style="color: #22c55e;">0%</b>
              </div>
            </div>
          </div>

          <!-- VIEW 4: PAINEL ADMINISTRATIVO (DESENVOLVEDOR) -->
          <div id="adminView" class="view-section" style="display: none; padding: 0 16px;">
            <h2 style="font-size: 20px; font-weight: bold; margin-bottom: 16px; color: #f59e0b;">Painel do Administrador</h2>
            <div style="background: #121212; border: 1px solid #262626; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
              <h4>Estatísticas da Plataforma</h4>
              <p style="font-size: 13px;">Pessoas Cadastradas: <b id="admTotalUsers">Loading...</b></p>
              <p style="font-size: 13px;">Anúncios em Execução: <b id="admActiveAds">0</b></p>
            </div>
          </div>

          <!-- VIEW 5: IA E GRUPOS -->
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

      <!-- MODAL DE POST COM UPLOAD LOCAL DO DISPOSITIVO -->
      <div id="createPostModal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.95); z-index: 1000; flex-direction: column; justify-content: space-between; padding: 20px; box-sizing: border-box;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span id="closePostModalBtn" style="font-size: 28px; cursor: pointer; color: #fff;">✕</span>
          <span style="font-weight: bold; font-size: 16px;">Criar Publicação</span>
          <button id="submitPostBtn" style="background: #0095f6; color: #fff; border: none; padding: 6px 16px; border-radius: 20px; font-weight: bold; cursor: pointer;">Compartilhar</button>
        </div>

        <div style="display: flex; flex: 1; align-items: center; justify-content: center; margin: 20px 0;">
          <div style="width: 100%; max-width: 400px; background: #000; padding: 20px; border-radius: 16px; border: 1px solid #262626;">
            <textarea id="postContentInput" placeholder="Escreva a legenda do post..." style="width: 100%; background: transparent; border: none; color: #fff; font-size: 15px; resize: none; outline: none; height: 100px;"></textarea>
            
            <label style="display: block; margin-top: 10px; color: #a8a8a8; font-size: 12px;">Selecione uma imagem ou vídeo do dispositivo:</label>
            <input type="file" id="postFileInput" accept="image/*,video/*" style="margin-top: 6px; color: #fff; font-size: 12px; width: 100%;">
          </div>
        </div>

        <div style="text-align: center; color: #fff; font-weight: bold; font-size: 12px; letter-spacing: 1px;">PUBLICAR NO FEED</div>
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
  document.getElementById('openCreateModalBtn').addEventListener('click', () => { modal.style.display = 'flex'; });
  document.getElementById('closePostModalBtn').addEventListener('click', () => { modal.style.display = 'none'; });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    location.reload();
  });

  document.getElementById('saveTaskBtn')?.addEventListener('click', createTask);

  loadPosts();
  loadTasks('date');
  loadEvolutionStats();
  if (currentProfile?.is_admin) loadAdminStats();

  // Enviar Publicação com Arquivo do Dispositivo
  document.getElementById('submitPostBtn').addEventListener('click', async () => {
    const content = document.getElementById('postContentInput').value.trim();
    const fileInput = document.getElementById('postFileInput');
    const file = fileInput.files[0];

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
    fileInput.value = '';
    modal.style.display = 'none';
    loadPosts();
  });
}

// CARREGAR FEED COM COMENTÁRIOS OCULTOS POR PADRÃO
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
    const { count: likesCount } = await supabaseClient.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', post.id);
    const { data: userLike } = await supabaseClient.from('likes').select('*').eq('post_id', post.id).eq('user_id', currentUser.id).single();
    const { data: comments } = await supabaseClient.from('comments').select('*, profiles:user_id (username)').eq('post_id', post.id);

    const card = document.createElement('div');
    card.style.cssText = 'background: #000; border-bottom: 1px solid #262626; margin-bottom: 16px; padding-bottom: 16px;';
    
    card.innerHTML = `
      <div style="display: flex; align-items: center; padding: 10px 4px; gap: 10px;">
        <div style="width: 32px; height: 32px; border-radius: 50%; background: #0095f6; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 13px;">
          ${post.profiles?.username.charAt(0).toUpperCase()}
        </div>
        <span style="font-weight: 600; font-size: 14px;">${post.profiles?.username}</span>
      </div>

      ${post.media_url ? (
        post.media_type === 'video' 
          ? `<video src="${post.media_url}" controls style="width: 100%; max-height: 500px; display: block;"></video>`
          : `<img src="${post.media_url}" style="width: 100%; max-height: 500px; object-fit: cover; display: block;">`
      ) : ''}

      <div style="padding: 10px 4px 0 4px;">
        <div style="display: flex; gap: 16px; font-size: 22px; margin-bottom: 8px;">
          <span onclick="toggleLike('${post.id}')" style="cursor: pointer;">${userLike ? '❤️' : '🤍'}</span>
          <span onclick="toggleCommentsDisplay('${post.id}')" style="cursor: pointer;">💬</span>
        </div>

        <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${likesCount || 0} curtidas</div>
        <div style="font-size: 14px;"><span style="font-weight: 600;">${post.profiles?.username}</span> ${escapeHtml(post.content)}</div>

        <!-- Seção de Comentários (Oculta por padrão) -->
        <div id="commentsContainer-${post.id}" style="display: none; margin-top: 10px; border-top: 1px solid #1f1f1f; padding-top: 8px;">
          <div style="max-height: 120px; overflow-y: auto; font-size: 13px; margin-bottom: 8px;">
            ${comments.map(c => `<div style="margin-bottom:4px;"><b>${c.profiles?.username}</b> ${escapeHtml(c.content)}</div>`).join('')}
          </div>
          <div style="display: flex;">
            <input type="text" id="comment-input-${post.id}" placeholder="Comentar..." style="flex:1; background:transparent; border:none; color:#fff; font-size:12px; outline:none;">
            <button onclick="addComment('${post.id}')" style="background:none; border:none; color:#0095f6; font-weight:bold; cursor:pointer;">Enviar</button>
          </div>
        </div>
      </div>
    `;
    container.appendChild(card);
  }
}

window.toggleCommentsDisplay = function(postId) {
  const container = document.getElementById(`commentsContainer-${postId}`);
  if (container) container.style.display = container.style.display === 'none' ? 'block' : 'none';
}

// LÓGICA DE TAREFAS E JUSTIFICATIVAS
async function createTask() {
  const title = document.getElementById('taskTitle').value.trim();
  const start_date = document.getElementById('taskStartDate').value;
  const due_date = document.getElementById('taskDueDate').value;
  const priority = document.getElementById('taskPriority').value;
  const end_time = document.getElementById('taskEndTime').value;

  if (!title || !start_date || !due_date || !end_time) {
    alert('Preencha todos os campos da tarefa.');
    return;
  }

  await supabaseClient.from('tasks').insert([
    { user_id: currentUser.id, title, start_date, due_date, priority, end_time }
  ]);

  loadTasks('date');
}

async function loadTasks(orderBy) {
  const container = document.getElementById('tasksList');
  if (!container) return;

  let query = supabaseClient.from('tasks').select('*').eq('user_id', currentUser.id);

  if (orderBy === 'date') query = query.order('due_date', { ascending: true });
  if (orderBy === 'priority') query = query.order('priority', { ascending: true });
  if (orderBy === 'p_date') query = query.order('priority', { ascending: true }).order('due_date', { ascending: true });

  const { data: tasks } = await query;
  container.innerHTML = '';

  tasks.forEach(task => {
    const item = document.createElement('div');
    item.style.cssText = 'background: #121212; border: 1px solid #262626; border-radius: 8px; padding: 12px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;';
    
    item.innerHTML = `
      <div>
        <div style="font-weight: bold; font-size: 14px; ${task.completed ? 'text-decoration: line-through; color: #a8a8a8;' : ''}">${task.title}</div>
        <small style="color: #a8a8a8;">Até ${task.due_date} às ${task.end_time} | Prioridade: ${task.priority}</small>
        ${task.justification ? `<div style="color: #f59e0b; font-size: 11px; margin-top: 4px;">Motivo: ${escapeHtml(task.justification)}</div>` : ''}
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
    justification = prompt('Justifique a alteração do status da tarefa:');
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

  document.getElementById('statCompleted').textContent = completed;
  document.getElementById('statFailed').textContent = failed;
  document.getElementById('statRate').textContent = `${rate}%`;
}

async function loadAdminStats() {
  const { count: usersCount } = await supabaseClient.from('profiles').select('*', { count: 'exact', head: true });
  document.getElementById('admTotalUsers').textContent = usersCount || 0;
}

window.toggleLike = async function(postId) {
  const { data: existing } = await supabaseClient.from('likes').select('*').eq('post_id', postId).eq('user_id', currentUser.id).single();
  if (existing) {
    await supabaseClient.from('likes').delete().eq('post_id', postId).eq('user_id', currentUser.id);
  } else {
    await supabaseClient.from('likes').insert([{ post_id: postId, user_id: currentUser.id }]);
  }
  loadPosts();
}

window.addComment = async function(postId) {
  const input = document.getElementById(`comment-input-${postId}`);
  const content = input.value.trim();
  if (!content) return;

  await supabaseClient.from('comments').insert([{ post_id: postId, user_id: currentUser.id, content }]);
  input.value = '';
  loadPosts();
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

checkUser();

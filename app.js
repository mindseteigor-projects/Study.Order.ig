// ============================================================
// STUDY ORDER — REDE SOCIAL ESTILO INSTAGRAM & ESTUDOS
// ============================================================

const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

let currentUser = null;
let currentProfile = null;
let currentFilterTag = null; // Filtro por hashtag

const authScreen = document.getElementById('authScreen');
const appScreen = document.getElementById('app');

// Gestão de Sessão
async function checkUser() {
  const { data: { session } } = await supabaseClient.auth.getSession();
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

// Injetar o Layout Estilo Instagram na Aplicação
function renderLayout() {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  appContainer.innerHTML = `
    <div style="display: flex; height: 100vh; background-color: #000; color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      
      <!-- BARRA LATERAL ESQUERDA (ESTILO INSTAGRAM) -->
      <nav style="width: 244px; border-right: 1px solid #262626; display: flex; flex-direction: column; justify-content: space-between; padding: 20px 12px; background: #000; position: fixed; height: 100vh; box-sizing: border-box; z-index: 100;">
        <div>
          <!-- Logo -->
          <div style="font-size: 22px; font-weight: bold; font-family: cursive; margin-bottom: 30px; padding-left: 12px; color: #fff;">
            Study Order ⚡
          </div>

          <!-- Links de Navegação com Ícones Intuitivos -->
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button class="nav-btn active" data-target="feedView" style="display: flex; align-items: center; gap: 16px; background: none; border: none; color: #fff; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 16px; width: 100%; text-align: left;">
              <span style="font-size: 20px;">🏠</span> Feed & Início
            </button>
            <button class="nav-btn" data-target="subjectsView" style="display: flex; align-items: center; gap: 16px; background: none; border: none; color: #a8a8a8; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 16px; width: 100%; text-align: left;">
              <span style="font-size: 20px;">📔</span> Matérias
            </button>
            <button class="nav-btn" data-target="groupsView" style="display: flex; align-items: center; gap: 16px; background: none; border: none; color: #a8a8a8; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 16px; width: 100%; text-align: left;">
              <span style="font-size: 20px;">👥</span> Comunidades
            </button>
          </div>
        </div>

        <!-- Seção Inferior: IA e Sair -->
        <div style="display: flex; flex-direction: column; gap: 8px; border-top: 1px solid #262626; padding-top: 12px;">
          <button id="aiAssistantBtn" style="display: flex; align-items: center; gap: 16px; background: none; border: none; color: #a8a8a8; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 16px; width: 100%; text-align: left;">
            <span style="font-size: 20px;">🤖</span> Assistente IA
          </button>
          <button id="logoutBtn" style="display: flex; align-items: center; gap: 16px; background: none; border: none; color: #ed4956; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 16px; width: 100%; text-align: left;">
            <span style="font-size: 20px;">🚪</span> Sair (@${currentProfile ? currentProfile.username : 'conta'})
          </button>
        </div>
      </nav>

      <!-- CONTEÚDO PRINCIPAL (CENTRALIZADO ESTILO INSTAGRAM) -->
      <main style="margin-left: 244px; flex: 1; display: flex; justify-content: center; overflow-y: auto; padding: 30px 20px;">
        <div style="width: 100%; max-width: 470px;">
          
          <!-- VIEW 1: FEED -->
          <div id="feedView" class="view-section">
            
            <!-- Caixa de Criação de Post (Texto, Vídeo/Foto e Hashtag) -->
            <div style="background: #121212; border: 1px solid #262626; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
              <textarea id="postContentInput" placeholder="O que você está estudando hoje? Use #hashtags (ex: #matematica)..." style="width: 100%; background: transparent; border: none; color: #fff; resize: none; font-size: 14px; outline: none; height: 70px;"></textarea>
              <input type="text" id="postMediaInput" placeholder="URL opcional de imagem ou vídeo (.mp4)" style="width: 100%; background: #1a1a1a; border: 1px solid #262626; border-radius: 6px; padding: 8px; color: #fff; font-size: 12px; margin-bottom: 10px; outline: none;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span id="activeFilterDisplay" style="font-size: 11px; color: #0095f6;"></span>
                <button id="createPostBtn" style="background: #0095f6; color: #fff; border: none; padding: 6px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 13px;">Publicar</button>
              </div>
            </div>

            <!-- Lista de Publicações -->
            <div id="postsList"></div>
          </div>

          <!-- VIEW 2: MATÉRIAS -->
          <div id="subjectsView" class="view-section" style="display: none;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
              <h2 style="font-size: 20px; font-weight: bold;">Meus Cadernos e Matérias</h2>
              <button id="addSubjectBtn" style="background: #0095f6; color: #fff; border: none; padding: 8px 14px; border-radius: 8px; cursor: pointer; font-weight: bold;">+ Nova Matéria</button>
            </div>
            <div id="subjectsList"></div>
          </div>

          <!-- VIEW 3: GRUPOS -->
          <div id="groupsView" class="view-section" style="display: none;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
              <h2 style="font-size: 20px; font-weight: bold;">Comunidades de Estudo</h2>
              <button id="addGroupBtn" style="background: #0095f6; color: #fff; border: none; padding: 8px 14px; border-radius: 8px; cursor: pointer; font-weight: bold;">+ Criar Grupo</button>
            </div>
            <div id="groupsList"></div>
          </div>

          <!-- VIEW 4: IA ASSISTENTE -->
          <div id="aiView" class="view-section" style="display: none;">
            <h2 style="font-size: 20px; font-weight: bold; margin-bottom: 10px;">Assistente IA Study Order</h2>
            <p style="color: #a8a8a8; font-size: 13px; margin-bottom: 20px;">Tire dúvidas sobre as suas matérias instantaneamente com a nossa Inteligência Artificial.</p>
            <div style="background: #121212; border: 1px solid #262626; border-radius: 12px; padding: 20px; height: 350px; overflow-y: auto; margin-bottom: 12px;" id="aiChatBox">
              <div style="color: #0095f6; margin-bottom: 10px;"><b>IA:</b> Olá! Como posso ajudar nos seus estudos hoje?</div>
            </div>
            <div style="display: flex; gap: 8px;">
              <input type="text" id="aiInput" placeholder="Faça uma pergunta sobre a matéria..." style="flex: 1; background: #1a1a1a; border: 1px solid #262626; border-radius: 8px; padding: 10px; color: #fff; outline: none;">
              <button id="aiSendBtn" style="background: #0095f6; color: #fff; border: none; padding: 0 16px; border-radius: 8px; font-weight: bold; cursor: pointer;">Enviar</button>
            </div>
          </div>

        </div>
      </main>
    </div>
  `;

  initAppLogic();
}

// Lógica de Interações e Navegação
function initAppLogic() {
  // Navegação lateral
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.style.color = '#a8a8a8');
      btn.style.color = '#fff';
      document.querySelectorAll('.view-section').forEach(v => v.style.display = 'none');
      document.getElementById(btn.dataset.target).style.display = 'block';
    });
  });

  document.getElementById('aiAssistantBtn').addEventListener('click', () => {
    document.querySelectorAll('.view-section').forEach(v => v.style.display = 'none');
    document.getElementById('aiView').style.display = 'block';
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    location.reload();
  });

  loadPosts();
  loadSubjects();
  loadGroups();

  // Criar Post (com extração automática de hashtags)
  document.getElementById('createPostBtn').addEventListener('click', async () => {
    const content = document.getElementById('postContentInput').value.trim();
    const media_url = document.getElementById('postMediaInput').value.trim();
    if (!content) return;

    // Extrair primeira hashtag do texto se houver
    const hashtagMatch = content.match(/#[a-zA-Z0-9_]+/);
    const hashtag = hashtagMatch ? hashtagMatch[0].toLowerCase() : null;
    const media_type = media_url.includes('.mp4') || media_url.includes('video') ? 'video' : (media_url ? 'image' : null);

    const { error } = await supabaseClient.from('posts').insert([
      { user_id: currentUser.id, content, media_url: media_url || null, hashtag, media_type }
    ]);

    if (!error) {
      document.getElementById('postContentInput').value = '';
      document.getElementById('postMediaInput').value = '';
      loadPosts();
    }
  });

  // IA Chat Simulado / Integrado
  document.getElementById('aiSendBtn').addEventListener('click', () => {
    const input = document.getElementById('aiInput');
    const box = document.getElementById('aiChatBox');
    if (!input.value.trim()) return;

    box.innerHTML += `<div style="margin-bottom: 10px; text-align: right;"><span style="background: #0095f6; padding: 6px 12px; border-radius: 8px; display: inline-block;">${input.value}</span></div>`;
    const q = input.value;
    input.value = '';

    setTimeout(() => {
      box.innerHTML += `<div style="color: #0095f6; margin-bottom: 10px;"><b>IA:</b> Analisando sua dúvida sobre "${q}"... Com base nos conceitos acadêmicos, recomendo focar nos resumos práticos e flashcards para fixação!</div>`;
      box.scrollTop = box.scrollHeight;
    }, 1000);
  });
}

// Carregar Feed Estilo Instagram (com Curtidas, Comentários e Hashtags)
async function loadPosts() {
  const container = document.getElementById('postsList');
  if (!container) return;

  let query = supabaseClient.from('posts').select(`*, profiles:user_id (username, avatar_url)`).order('created_at', { ascending: false });
  if (currentFilterTag) query = query.eq('hashtag', currentFilterTag);

  const { data: posts } = await query;
  container.innerHTML = '';

  if (!posts || posts.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #a8a8a8; padding: 20px;">Nenhuma publicação encontrada.</p>';
    return;
  }

  for (let post of posts) {
    // Buscar likes do post
    const { count: likesCount } = await supabaseClient.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', post.id);
    const { data: userLike } = await supabaseClient.from('likes').select('*').eq('post_id', post.id).eq('user_id', currentUser.id).single();
    
    // Buscar comentários
    const { data: comments } = await supabaseClient.from('comments').select('*, profiles:user_id (username)').eq('post_id', post.id).order('created_at', { ascending: true });

    const card = document.createElement('div');
    card.style.cssText = 'background: #000; border: 1px solid #262626; border-radius: 8px; margin-bottom: 20px;';
    
    card.innerHTML = `
      <!-- Cabeçalho do Post -->
      <div style="display: flex; align-items: center; padding: 12px; gap: 10px;">
        <div style="width: 32px; height: 32px; border-radius: 50%; background: #db0579; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">
          ${post.profiles?.username.charAt(0).toUpperCase()}
        </div>
        <div>
          <span style="font-weight: bold; font-size: 13px;">@${post.profiles?.username}</span>
          ${post.hashtag ? `<span style="color: #0095f6; font-size: 12px; margin-left: 6px; cursor: pointer;" onclick="filterByTag('${post.hashtag}')">${post.hashtag}</span>` : ''}
        </div>
      </div>

      <!-- Mídia (Imagem ou Vídeo) -->
      ${post.media_url ? (
        post.media_type === 'video' 
          ? `<video src="${post.media_url}" controls style="width: 100%; max-height: 450px; background: #000;"></video>`
          : `<img src="${post.media_url}" style="width: 100%; max-height: 450px; object-fit: cover;">`
      ) : ''}

      <!-- Ações (Curtir / Comentar) -->
      <div style="padding: 12px;">
        <div style="display: flex; gap: 16px; margin-bottom: 8px; font-size: 20px; cursor: pointer;">
          <span id="like-btn-${post.id}" onclick="toggleLike('${post.id}')">${userLike ? '❤️' : '🤍'}</span>
          <span onclick="document.getElementById('comment-input-${post.id}').focus()">💬</span>
        </div>
        <div style="font-weight: bold; font-size: 13px; margin-bottom: 6px;">${likesCount || 0} curtidas</div>
        
        <!-- Conteúdo / Legenda -->
        <div style="font-size: 13px; margin-bottom: 10px; line-height: 1.4;">
          <b>@${post.profiles?.username}</b> ${escapeHtml(post.content)}
        </div>

        <!-- Lista de Comentários -->
        <div id="comments-list-${post.id}" style="font-size: 12px; margin-bottom: 8px; max-height: 100px; overflow-y: auto;">
          ${comments.map(c => `<div style="margin-bottom: 4px;"><b>@${c.profiles?.username}</b> ${escapeHtml(c.content)}</div>`).join('')}
        </div>

        <!-- Adicionar Comentário -->
        <div style="display: flex; border-top: 1px solid #262626; padding-top: 8px;">
          <input type="text" id="comment-input-${post.id}" placeholder="Adicione um comentário..." style="flex: 1; background: transparent; border: none; color: #fff; font-size: 12px; outline: none;">
          <button onclick="addComment('${post.id}')" style="background: none; border: none; color: #0095f6; font-weight: bold; cursor: pointer; font-size: 12px;">Publicar</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  }
}

// Funções Globais de Curtida e Comentário
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

window.filterByTag = function(tag) {
  currentFilterTag = tag;
  document.getElementById('activeFilterDisplay').textContent = `Filtrando por: ${tag} (Clique para limpar)`;
  document.getElementById('activeFilterDisplay').onclick = () => { currentFilterTag = null; document.getElementById('activeFilterDisplay').textContent = ''; loadPosts(); };
  loadPosts();
}

// Matérias e Grupos
async function loadSubjects() {
  const list = document.getElementById('subjectsList');
  if (!list) return;
  const { data } = await supabaseClient.from('subjects').select('*').eq('user_id', currentUser.id);
  list.innerHTML = data && data.length ? data.map(s => `<div style="background: #121212; padding: 12px; border-radius: 8px; margin-bottom: 8px; border: 1px solid #262626;">📖 ${s.name}</div>`).join('') : '<p style="color: #a8a8a8;">Nenhuma matéria cadastrada.</p>';
}

document.getElementById('addSubjectBtn')?.addEventListener('click', async () => {
  const name = prompt('Nome da Matéria (ex: Matemática, Física):');
  if (!name) return;
  await supabaseClient.from('subjects').insert([{ user_id: currentUser.id, name }]);
  loadSubjects();
});

async function loadGroups() {
  const list = document.getElementById('groupsList');
  if (!list) return;
  const { data } = await supabaseClient.from('study_groups').select('*');
  list.innerHTML = data && data.length ? data.map(g => `<div style="background: #121212; padding: 12px; border-radius: 8px; margin-bottom: 8px; border: 1px solid #262626;">👥 <b>${g.name}</b><br><span style="color:#a8a8a8; font-size:12px;">${g.description || ''}</span></div>`).join('') : '<p style="color: #a8a8a8;">Nenhum grupo ativo.</p>';
}

document.getElementById('addGroupBtn')?.addEventListener('click', async () => {
  const name = prompt('Nome do Grupo de Estudo:');
  const description = prompt('Descrição do grupo:');
  if (!name) return;
  await supabaseClient.from('study_groups').insert([{ name, description, created_by: currentUser.id }]);
  loadGroups();
});

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

checkUser();

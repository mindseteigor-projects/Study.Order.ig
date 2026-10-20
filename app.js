// ============================================================
// STUDY ORDER — FRONT-END INSTAGRAM EXACTO (FEED + MODAL DE POST)
// ============================================================

const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

let currentUser = null;
let currentProfile = null;
let currentFilterTag = null;

const authScreen = document.getElementById('authScreen');
const appScreen = document.getElementById('app');

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

function renderLayout() {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  appContainer.innerHTML = `
    <div style="display: flex; width: 100vw; height: 100vh; background-color: #000; color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; overflow: hidden;">
      
      <!-- BARRA LATERAL FIXA -->
      <nav style="width: 245px; background: #000; border-right: 1px solid #262626; display: flex; flex-direction: column; justify-content: space-between; padding: 20px 12px; box-sizing: border-box; height: 100vh; flex-shrink: 0; z-index: 10;">
        <div>
          <!-- Logo estilo Instagram -->
          <div style="font-size: 22px; font-weight: 700; color: #fff; margin-bottom: 30px; padding-left: 12px; font-family: cursive;">
            Study Order
          </div>

          <!-- Links do Menu -->
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <button class="nav-btn active-tab" data-target="feedView" style="display: flex; align-items: center; gap: 16px; background: transparent; border: none; color: #fff; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 16px; width: 100%; text-align: left; font-weight: 600;">
              <span style="font-size: 20px;">🏠</span> Página inicial
            </button>
            <button class="nav-btn" id="openCreateModalBtn" style="display: flex; align-items: center; gap: 16px; background: transparent; border: none; color: #f5f5f5; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 16px; width: 100%; text-align: left; font-weight: 400;">
              <span style="font-size: 20px;">➕</span> Criar
            </button>
            <button class="nav-btn" data-target="subjectsView" style="display: flex; align-items: center; gap: 16px; background: transparent; border: none; color: #f5f5f5; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 16px; width: 100%; text-align: left; font-weight: 400;">
              <span style="font-size: 20px;">📓</span> Matérias
            </button>
            <button class="nav-btn" data-target="groupsView" style="display: flex; align-items: center; gap: 16px; background: transparent; border: none; color: #f5f5f5; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 16px; width: 100%; text-align: left; font-weight: 400;">
              <span style="font-size: 20px;">👥</span> Comunidades
            </button>
          </div>
        </div>

        <!-- Rodapé do Menu -->
        <div style="display: flex; flex-direction: column; gap: 4px; border-top: 1px solid #262626; padding-top: 12px;">
          <button class="nav-btn" data-target="aiView" style="display: flex; align-items: center; gap: 16px; background: transparent; border: none; color: #f5f5f5; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 16px; width: 100%; text-align: left;">
            <span style="font-size: 20px;">🤖</span> IA Assistente
          </button>
          <button id="logoutBtn" style="display: flex; align-items: center; gap: 16px; background: transparent; border: none; color: #ed4956; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 16px; width: 100%; text-align: left;">
            <span style="font-size: 20px;">🚪</span> Sair (@${currentProfile ? currentProfile.username : 'user'})
          </button>
        </div>
      </nav>

      <!-- FEED CENTRALIZADO -->
      <main style="flex: 1; height: 100vh; overflow-y: auto; background-color: #000; display: flex; justify-content: center; padding: 20px 0;">
        <div style="width: 100%; max-width: 470px;">
          
          <!-- VIEW 1: FEED ESTILO INSTAGRAM (FOTO 1) -->
          <div id="feedView" class="view-section" style="display: block;">
            <div id="activeFilterDisplay" style="font-size: 13px; color: #0095f6; margin-bottom: 12px; text-align: center; cursor: pointer;"></div>
            <div id="postsList"></div>
          </div>

          <!-- VIEW 2: MATÉRIAS -->
          <div id="subjectsView" class="view-section" style="display: none; padding: 0 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
              <h2 style="font-size: 20px; font-weight: bold;">Meus Cadernos</h2>
              <button id="addSubjectBtn" style="background: #0095f6; color: #fff; border: none; padding: 8px 14px; border-radius: 8px; font-weight: bold; cursor: pointer;">+ Nova Matéria</button>
            </div>
            <div id="subjectsList"></div>
          </div>

          <!-- VIEW 3: COMUNIDADES -->
          <div id="groupsView" class="view-section" style="display: none; padding: 0 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
              <h2 style="font-size: 20px; font-weight: bold;">Comunidades</h2>
              <button id="addGroupBtn" style="background: #0095f6; color: #fff; border: none; padding: 8px 14px; border-radius: 8px; font-weight: bold; cursor: pointer;">+ Criar Grupo</button>
            </div>
            <div id="groupsList"></div>
          </div>

          <!-- VIEW 4: IA -->
          <div id="aiView" class="view-section" style="display: none; padding: 0 16px;">
            <h2 style="font-size: 20px; font-weight: bold; margin-bottom: 8px;">Assistente IA</h2>
            <div style="background: #121212; border: 1px solid #262626; border-radius: 12px; padding: 16px; height: 380px; overflow-y: auto; margin-bottom: 12px;" id="aiChatBox">
              <div style="color: #0095f6; margin-bottom: 10px;"><b>IA:</b> Olá! Em que posso ajudar nos seus estudos hoje?</div>
            </div>
            <div style="display: flex; gap: 8px;">
              <input type="text" id="aiInput" placeholder="Pergunte algo..." style="flex: 1; background: #121212; border: 1px solid #262626; border-radius: 8px; padding: 10px; color: #fff; outline: none;">
              <button id="aiSendBtn" style="background: #0095f6; color: #fff; border: none; padding: 0 16px; border-radius: 8px; font-weight: bold; cursor: pointer;">Enviar</button>
            </div>
          </div>

        </div>
      </main>

      <!-- MODAL DE PUBLICAÇÃO ESTILO CÂMERA DO INSTAGRAM (FOTO 2) -->
      <div id="createPostModal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.95); z-index: 1000; flex-direction: column; justify-content: space-between; padding: 20px; box-sizing: border-box;">
        
        <!-- Topo do Modal (Fechar) -->
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span id="closePostModalBtn" style="font-size: 28px; cursor: pointer; color: #fff; font-weight: 300;">✕</span>
          <span style="font-weight: bold; font-size: 16px; color: #fff;">Nova publicação</span>
          <button id="submitPostBtn" style="background: #0095f6; color: #fff; border: none; padding: 6px 16px; border-radius: 20px; font-weight: bold; cursor: pointer;">Compartilhar</button>
        </div>

        <!-- Área Central (Estilo Câmera/Formulário) -->
        <div style="display: flex; flex: 1; align-items: center; justify-content: center; position: relative; margin: 20px 0;">
          
          <!-- Ferramentas Laterais da Câmera (Aa, Infinity, etc) -->
          <div style="position: absolute; left: 10px; top: 30%; display: flex; flex-direction: column; gap: 24px; color: #fff; font-size: 20px; align-items: center;">
            <span title="Texto" style="font-weight: bold; font-size: 18px; cursor: pointer;">Aa</span>
            <span title="Loop" style="cursor: pointer;">∞</span>
            <span title="Filtros" style="cursor: pointer;">✨</span>
          </div>

          <!-- Conteúdo Principal do Post -->
          <div style="width: 100%; max-width: 380px; display: flex; flex-direction: column; gap: 12px; background: #000; padding: 20px; border-radius: 16px; border: 1px solid #262626;">
            <textarea id="postContentInput" placeholder="Escreva uma legenda ou estudo... Use #hashtags" style="width: 100%; background: transparent; border: none; color: #fff; font-size: 16px; resize: none; outline: none; height: 120px; font-family: inherit;"></textarea>
            <input type="text" id="postMediaInput" placeholder="URL da foto ou vídeo (.mp4)" style="width: 100%; background: #121212; border: 1px solid #262626; border-radius: 8px; padding: 10px; color: #fff; font-size: 12px; outline: none;">
          </div>
        </div>

        <!-- Barra Inferior de Modo (POST / STORY / REEL) -->
        <div style="display: flex; justify-content: center; align-items: center; gap: 30px; padding-bottom: 10px; color: #737373; font-size: 13px; font-weight: 600; letter-spacing: 1px;">
          <span>POST</span>
          <span style="color: #fff; border-bottom: 2px solid #fff; padding-bottom: 2px;">PUBLICAR</span>
          <span>ESTUDO</span>
        </div>

      </div>

    </div>
  `;

  initAppLogic();
}

function initAppLogic() {
  // Navegação
  document.querySelectorAll('.nav-btn').forEach(btn => {
    if (btn.id === 'openCreateModalBtn') return;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.view-section').forEach(v => v.style.display = 'none');
      const target = document.getElementById(btn.dataset.target);
      if (target) target.style.display = 'block';
    });
  });

  // Modal de Post (Estilo Foto 2)
  const modal = document.getElementById('createPostModal');
  document.getElementById('openCreateModalBtn').addEventListener('click', () => {
    modal.style.display = 'flex';
  });
  document.getElementById('closePostModalBtn').addEventListener('click', () => {
    modal.style.display = 'none';
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    location.reload();
  });

  loadPosts();
  loadSubjects();
  loadGroups();

  // Submeter Post
  document.getElementById('submitPostBtn').addEventListener('click', async () => {
    const content = document.getElementById('postContentInput').value.trim();
    const media_url = document.getElementById('postMediaInput').value.trim();
    if (!content) return;

    const hashtagMatch = content.match(/#[a-zA-Z0-9_]+/);
    const hashtag = hashtagMatch ? hashtagMatch[0].toLowerCase() : null;
    const media_type = media_url.includes('.mp4') || media_url.includes('video') ? 'video' : (media_url ? 'image' : null);

    const { error } = await supabaseClient.from('posts').insert([
      { user_id: currentUser.id, content, media_url: media_url || null, hashtag, media_type }
    ]);

    if (!error) {
      document.getElementById('postContentInput').value = '';
      document.getElementById('postMediaInput').value = '';
      modal.style.display = 'none';
      loadPosts();
    }
  });

  // IA
  document.getElementById('aiSendBtn').addEventListener('click', () => {
    const input = document.getElementById('aiInput');
    const box = document.getElementById('aiChatBox');
    if (!input.value.trim()) return;

    box.innerHTML += `<div style="margin-bottom: 10px; text-align: right;"><span style="background: #0095f6; padding: 6px 12px; border-radius: 8px; display: inline-block;">${input.value}</span></div>`;
    const q = input.value;
    input.value = '';

    setTimeout(() => {
      box.innerHTML += `<div style="color: #0095f6; margin-bottom: 10px;"><b>IA:</b> Sobre "${q}": Revise os tópicos e utilize resumos em tópicos para memorizar!</div>`;
      box.scrollTop = box.scrollHeight;
    }, 1000);
  });
}

// CARREGAR FEED IDÊNTICO À PRIMEIRA IMAGEM
async function loadPosts() {
  const container = document.getElementById('postsList');
  if (!container) return;

  let query = supabaseClient.from('posts').select(`*, profiles:user_id (username, avatar_url)`).order('created_at', { ascending: false });
  if (currentFilterTag) query = query.eq('hashtag', currentFilterTag);

  const { data: posts } = await query;
  container.innerHTML = '';

  if (!posts || posts.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #737373; padding: 40px 0;">Nenhuma publicação no momento.</p>';
    return;
  }

  for (let post of posts) {
    const { count: likesCount } = await supabaseClient.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', post.id);
    const { data: userLike } = await supabaseClient.from('likes').select('*').eq('post_id', post.id).eq('user_id', currentUser.id).single();
    const { data: comments } = await supabaseClient.from('comments').select('*, profiles:user_id (username)').eq('post_id', post.id).order('created_at', { ascending: true });

    const card = document.createElement('div');
    card.style.cssText = 'background: #000; border-bottom: 1px solid #262626; margin-bottom: 16px; padding-bottom: 16px;';
    
    // Formatação de Horas (ex: Há 2 horas)
    const timeAgo = getTimeAgo(new Date(post.created_at));

    card.innerHTML = `
      <!-- Cabeçalho estilo Instagram -->
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 4px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888); display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 13px; color: #fff;">
            ${post.profiles?.username.charAt(0).toUpperCase()}
          </div>
          <span style="font-weight: 600; font-size: 14px;">${post.profiles?.username}</span>
        </div>
        <span style="color: #fff; font-size: 18px; cursor: pointer;">•••</span>
      </div>

      <!-- Mídia (Foto ou Vídeo) -->
      ${post.media_url ? (
        post.media_type === 'video' 
          ? `<video src="${post.media_url}" controls style="width: 100%; max-height: 500px; background: #000; display: block;"></video>`
          : `<img src="${post.media_url}" style="width: 100%; max-height: 500px; object-fit: cover; display: block;">`
      ) : ''}

      <!-- Barra de Ações (Curtir, Comentar, Repost, Compartilhar, Salvar) -->
      <div style="padding: 10px 4px 0 4px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div style="display: flex; gap: 16px; font-size: 22px;">
            <span onclick="toggleLike('${post.id}')" style="cursor: pointer;">${userLike ? '❤️' : '🤍'}</span>
            <span onclick="document.getElementById('comment-input-${post.id}').focus()" style="cursor: pointer;">💬</span>
            <span style="cursor: pointer;">🔁</span>
            <span style="cursor: pointer;">✈️</span>
          </div>
          <span style="font-size: 22px; cursor: pointer;">🔖</span>
        </div>

        <!-- Curtidas -->
        <div style="font-weight: 600; font-size: 14px; margin-bottom: 6px;">${likesCount || 0} curtidas</div>

        <!-- Legenda -->
        <div style="font-size: 14px; line-height: 1.4; margin-bottom: 4px;">
          <span style="font-weight: 600;">${post.profiles?.username}</span> ${escapeHtml(post.content)}
          ${post.hashtag ? `<span style="color: #e0f1ff; cursor: pointer;" onclick="filterByTag('${post.hashtag}')"> ${post.hashtag}</span>` : ''}
        </div>

        <!-- Tempo Decorrido (ex: Há 2 horas) -->
        <div style="color: #737373; font-size: 12px; margin-bottom: 8px;">${timeAgo}</div>

        <!-- Comentários -->
        <div id="comments-list-${post.id}" style="font-size: 13px; margin-bottom: 8px; display: flex; flex-direction: column; gap: 4px;">
          ${comments.map(c => `<div><span style="font-weight: 600;">${c.profiles?.username}</span> ${escapeHtml(c.content)}</div>`).join('')}
        </div>

        <!-- Input de comentário estilo Instagram -->
        <div style="display: flex; align-items: center; border-top: 1px solid #121212; padding-top: 8px;">
          <input type="text" id="comment-input-${post.id}" placeholder="Adicione um comentário..." style="flex: 1; background: transparent; border: none; color: #fff; font-size: 13px; outline: none;">
          <button onclick="addComment('${post.id}')" style="background: none; border: none; color: #0095f6; font-weight: 600; cursor: pointer; font-size: 13px;">Publicar</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  }
}

// Funções Auxiliares
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 3600) return `Há ${Math.floor(seconds / 60) || 1} min`;
  if (seconds < 86400) return `Há ${Math.floor(seconds / 3600)} horas`;
  return `Há ${Math.floor(seconds / 86400)} dias`;
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

window.filterByTag = function(tag) {
  currentFilterTag = tag;
  const filterDisplay = document.getElementById('activeFilterDisplay');
  if (filterDisplay) {
    filterDisplay.textContent = `Filtrando por: ${tag} (Clique aqui para limpar)`;
    filterDisplay.onclick = () => { currentFilterTag = null; filterDisplay.textContent = ''; loadPosts(); };
  }
  loadPosts();
}

async function loadSubjects() {
  const list = document.getElementById('subjectsList');
  if (!list) return;
  const { data } = await supabaseClient.from('subjects').select('*').eq('user_id', currentUser.id);
  list.innerHTML = data && data.length ? data.map(s => `<div style="background: #121212; padding: 12px; border-radius: 8px; margin-bottom: 8px; border: 1px solid #262626;">📓 ${s.name}</div>`).join('') : '<p style="color: #737373;">Nenhuma matéria cadastrada.</p>';
}

document.getElementById('addSubjectBtn')?.addEventListener('click', async () => {
  const name = prompt('Nome da Matéria:');
  if (!name) return;
  await supabaseClient.from('subjects').insert([{ user_id: currentUser.id, name }]);
  loadSubjects();
});

async function loadGroups() {
  const list = document.getElementById('groupsList');
  if (!list) return;
  const { data } = await supabaseClient.from('groups').select('*');
  list.innerHTML = data && data.length ? data.map(g => `<div style="background: #121212; padding: 12px; border-radius: 8px; margin-bottom: 8px; border: 1px solid #262626;">👥 <b>${g.name}</b></div>`).join('') : '<p style="color: #737373;">Nenhum grupo ativo.</p>';
}

document.getElementById('addGroupBtn')?.addEventListener('click', async () => {
  const name = prompt('Nome do Grupo:');
  if (!name) return;
  await supabaseClient.from('groups').insert([{ name, created_by: currentUser.id }]);
  loadGroups();
});

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

checkUser();

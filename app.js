// ============================================================
// STUDY ORDER — VERSÃO DEFINITIVA (ESTILO INSTAGRAM + ESTUDOS)
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

// Renderizar o Layout Completo e Abrangente
function renderLayout() {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  appContainer.innerHTML = `
    <div style="display: flex; width: 100vw; height: 100vh; background-color: #0f1115; color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; overflow: hidden;">
      
      <!-- BARRA LATERAL ESQUERDA -->
      <nav style="width: 260px; background: #161920; border-right: 1px solid #2d3139; display: flex; flex-direction: column; justify-content: space-between; padding: 24px 16px; box-sizing: border-box; height: 100vh; flex-shrink: 0;">
        <div>
          <!-- Logo -->
          <div style="font-size: 20px; font-weight: bold; color: #fff; margin-bottom: 35px; display: flex; align-items: center; gap: 8px;">
            <span>⚡</span> Study Order
          </div>

          <!-- Links de Navegação -->
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <button class="nav-btn active-tab" data-target="feedView" style="display: flex; align-items: center; gap: 14px; background: #20242d; border: none; color: #fff; padding: 12px 14px; border-radius: 10px; cursor: pointer; font-size: 15px; width: 100%; text-align: left; font-weight: 500;">
              <span>🏠</span> Feed & Início
            </button>
            <button class="nav-btn" data-target="subjectsView" style="display: flex; align-items: center; gap: 14px; background: none; border: none; color: #9ba1a6; padding: 12px 14px; border-radius: 10px; cursor: pointer; font-size: 15px; width: 100%; text-align: left; font-weight: 500;">
              <span>📔</span> Matérias e Cadernos
            </button>
            <button class="nav-btn" data-target="groupsView" style="display: flex; align-items: center; gap: 14px; background: none; border: none; color: #9ba1a6; padding: 12px 14px; border-radius: 10px; cursor: pointer; font-size: 15px; width: 100%; text-align: left; font-weight: 500;">
              <span>👥</span> Comunidades
            </button>
          </div>
        </div>

        <!-- Parte Inferior: IA e Sair -->
        <div style="display: flex; flex-direction: column; gap: 6px; border-top: 1px solid #2d3139; padding-top: 16px;">
          <button class="nav-btn" data-target="aiView" style="display: flex; align-items: center; gap: 14px; background: none; border: none; color: #9ba1a6; padding: 12px 14px; border-radius: 10px; cursor: pointer; font-size: 15px; width: 100%; text-align: left; font-weight: 500;">
            <span>🤖</span> Assistente IA
          </button>
          <button id="logoutBtn" style="display: flex; align-items: center; gap: 14px; background: none; border: none; color: #f87171; padding: 12px 14px; border-radius: 10px; cursor: pointer; font-size: 15px; width: 100%; text-align: left; font-weight: 500;">
            <span>🚪</span> Sair (@${currentProfile ? currentProfile.username : 'conta'})
          </button>
        </div>
      </nav>

      <!-- ÁREA DE CONTEÚDO PRINCIPAL QUE ABRANGE TUDO -->
      <main style="flex: 1; height: 100vh; overflow-y: auto; background-color: #0f1115; display: flex; justify-content: center; padding: 30px;">
        <div style="width: 100%; max-width: 650px;">
          
          <!-- VIEW 1: FEED -->
          <div id="feedView" class="view-section" style="display: block;">
            <!-- Criar Post -->
            <div style="background: #161920; border: 1px solid #2d3139; border-radius: 14px; padding: 18px; margin-bottom: 24px;">
              <textarea id="postContentInput" placeholder="O que você está estudando hoje? Use #hashtags (ex: #matematica)..." style="width: 100%; background: transparent; border: none; color: #fff; resize: none; font-size: 14px; outline: none; height: 75px;"></textarea>
              <input type="text" id="postMediaInput" placeholder="URL opcional de imagem ou vídeo (.mp4)" style="width: 100%; background: #0f1115; border: 1px solid #2d3139; border-radius: 8px; padding: 10px; color: #fff; font-size: 12px; margin-bottom: 12px; outline: none;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span id="activeFilterDisplay" style="font-size: 12px; color: #38bdf8; cursor: pointer;"></span>
                <button id="createPostBtn" style="background: #38bdf8; color: #000; border: none; padding: 8px 18px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 13px;">Publicar</button>
              </div>
            </div>
            <!-- Lista de Posts -->
            <div id="postsList"></div>
          </div>

          <!-- VIEW 2: MATÉRIAS -->
          <div id="subjectsView" class="view-section" style="display: none;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
              <h2 style="font-size: 22px; font-weight: bold; color: #fff;">Meus Cadernos e Matérias</h2>
              <button id="addSubjectBtn" style="background: #38bdf8; color: #000; border: none; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer;">+ Nova Matéria</button>
            </div>
            <div id="subjectsList"></div>
          </div>

          <!-- VIEW 3: COMUNIDADES -->
          <div id="groupsView" class="view-section" style="display: none;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
              <h2 style="font-size: 22px; font-weight: bold; color: #fff;">Comunidades de Estudo</h2>
              <button id="addGroupBtn" style="background: #38bdf8; color: #000; border: none; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer;">+ Criar Grupo</button>
            </div>
            <div id="groupsList"></div>
          </div>

          <!-- VIEW 4: IA ASSISTENTE -->
          <div id="aiView" class="view-section" style="display: none;">
            <h2 style="font-size: 22px; font-weight: bold; color: #fff; margin-bottom: 8px;">Assistente IA Study Order</h2>
            <p style="color: #9ba1a6; font-size: 13px; margin-bottom: 20px;">Tire dúvidas sobre as suas matérias instantaneamente com a nossa Inteligência Artificial.</p>
            <div style="background: #161920; border: 1px solid #2d3139; border-radius: 14px; padding: 20px; height: 400px; overflow-y: auto; margin-bottom: 12px;" id="aiChatBox">
              <div style="color: #38bdf8; margin-bottom: 10px;"><b>IA:</b> Olá! Como posso ajudar nos seus estudos hoje?</div>
            </div>
            <div style="display: flex; gap: 8px;">
              <input type="text" id="aiInput" placeholder="Faça uma pergunta sobre a matéria..." style="flex: 1; background: #161920; border: 1px solid #2d3139; border-radius: 8px; padding: 12px; color: #fff; outline: none;">
              <button id="aiSendBtn" style="background: #38bdf8; color: #000; border: none; padding: 0 20px; border-radius: 8px; font-weight: bold; cursor: pointer;">Enviar</button>
            </div>
          </div>

        </div>
      </main>
    </div>
  `;

  initAppLogic();
}

// Configurar Eventos e Comportamentos
function initAppLogic() {
  // Navegação Lateral
  document.querySelectorAll('.nav-btn').forEach(btn => {
    if (btn.id === 'logoutBtn') return;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => {
        if (b.id !== 'logoutBtn') {
          b.style.background = 'none';
          b.style.color = '#9ba1a6';
        }
      });
      btn.style.background = '#20242d';
      btn.style.color = '#fff';

      document.querySelectorAll('.view-section').forEach(v => v.style.display = 'none');
      const target = document.getElementById(btn.dataset.target);
      if (target) target.style.display = 'block';
    });
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    location.reload();
  });

  loadPosts();
  loadSubjects();
  loadGroups();

  // Criar Post
  document.getElementById('createPostBtn').addEventListener('click', async () => {
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
      loadPosts();
    }
  });

  // IA Chat
  document.getElementById('aiSendBtn').addEventListener('click', () => {
    const input = document.getElementById('aiInput');
    const box = document.getElementById('aiChatBox');
    if (!input.value.trim()) return;

    box.innerHTML += `<div style="margin-bottom: 12px; text-align: right;"><span style="background: #38bdf8; color: #000; padding: 8px 14px; border-radius: 10px; display: inline-block;">${input.value}</span></div>`;
    const q = input.value;
    input.value = '';

    setTimeout(() => {
      box.innerHTML += `<div style="color: #38bdf8; margin-bottom: 12px;"><b>IA:</b> Analisando a sua questão sobre "${q}"... Foque nos pontos principais e utilize mapas mentais para fixar a matéria com sucesso!</div>`;
      box.scrollTop = box.scrollHeight;
    }, 1000);
  });
}

// Carregar Posts de forma fluida
async function loadPosts() {
  const container = document.getElementById('postsList');
  if (!container) return;

  let query = supabaseClient.from('posts').select(`*, profiles:user_id (username, avatar_url)`).order('created_at', { ascending: false });
  if (currentFilterTag) query = query.eq('hashtag', currentFilterTag);

  const { data: posts } = await query;
  container.innerHTML = '';

  if (!posts || posts.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #9ba1a6; padding: 20px;">Nenhuma publicação encontrada.</p>';
    return;
  }

  for (let post of posts) {
    const { count: likesCount } = await supabaseClient.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', post.id);
    const { data: userLike } = await supabaseClient.from('likes').select('*').eq('post_id', post.id).eq('user_id', currentUser.id).single();
    const { data: comments } = await supabaseClient.from('comments').select('*, profiles:user_id (username)').eq('post_id', post.id).order('created_at', { ascending: true });

    const card = document.createElement('div');
    card.style.cssText = 'background: #161920; border: 1px solid #2d3139; border-radius: 14px; margin-bottom: 20px; overflow: hidden;';
    
    card.innerHTML = `
      <div style="display: flex; align-items: center; padding: 14px; gap: 12px;">
        <div style="width: 36px; height: 36px; border-radius: 50%; background: #38bdf8; color: #000; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 15px;">
          ${post.profiles?.username.charAt(0).toUpperCase()}
        </div>
        <div>
          <span style="font-weight: bold; font-size: 14px; color: #fff;">@${post.profiles?.username}</span>
          ${post.hashtag ? `<span style="color: #38bdf8; font-size: 12px; margin-left: 8px; cursor: pointer;" onclick="filterByTag('${post.hashtag}')">${post.hashtag}</span>` : ''}
        </div>
      </div>

      ${post.media_url ? (
        post.media_type === 'video' 
          ? `<video src="${post.media_url}" controls style="width: 100%; max-height: 450px; background: #000; display: block;"></video>`
          : `<img src="${post.media_url}" style="width: 100%; max-height: 450px; object-fit: cover; display: block;">`
      ) : ''}

      <div style="padding: 14px;">
        <div style="display: flex; gap: 16px; margin-bottom: 10px; font-size: 20px; cursor: pointer;">
          <span onclick="toggleLike('${post.id}')">${userLike ? '❤️' : '🤍'}</span>
          <span onclick="document.getElementById('comment-input-${post.id}').focus()">💬</span>
        </div>
        <div style="font-weight: bold; font-size: 13px; margin-bottom: 8px; color: #fff;">${likesCount || 0} curtidas</div>
        
        <div style="font-size: 14px; margin-bottom: 12px; line-height: 1.5; color: #e2e8f0;">
          <b>@${post.profiles?.username}</b> ${escapeHtml(post.content)}
        </div>

        <div id="comments-list-${post.id}" style="font-size: 12px; margin-bottom: 10px; max-height: 120px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;">
          ${comments.map(c => `<div><b>@${c.profiles?.username}</b> <span style="color: #cbd5e1;">${escapeHtml(c.content)}</span></div>`).join('')}
        </div>

        <div style="display: flex; border-top: 1px solid #2d3139; padding-top: 10px; gap: 8px;">
          <input type="text" id="comment-input-${post.id}" placeholder="Adicione um comentário..." style="flex: 1; background: transparent; border: none; color: #fff; font-size: 13px; outline: none;">
          <button onclick="addComment('${post.id}')" style="background: none; border: none; color: #38bdf8; font-weight: bold; cursor: pointer; font-size: 13px;">Publicar</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  }
}

// Funções de Interação sem perda de foco/posição
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
    filterDisplay.textContent = `Filtrando por: ${tag} (Clique para limpar)`;
    filterDisplay.onclick = () => { currentFilterTag = null; filterDisplay.textContent = ''; loadPosts(); };
  }
  loadPosts();
}

// Matérias
async function loadSubjects() {
  const list = document.getElementById('subjectsList');
  if (!list) return;
  const { data } = await supabaseClient.from('subjects').select('*').eq('user_id', currentUser.id);
  list.innerHTML = data && data.length ? data.map(s => `<div style="background: #161920; padding: 14px; border-radius: 10px; margin-bottom: 10px; border: 1px solid #2d3139; font-weight: 500;">📖 ${s.name}</div>`).join('') : '<p style="color: #9ba1a6;">Nenhuma matéria cadastrada ainda.</p>';
}

document.getElementById('addSubjectBtn')?.addEventListener('click', async () => {
  const name = prompt('Nome da Matéria (ex: Matemática, Física):');
  if (!name) return;
  await supabaseClient.from('subjects').insert([{ user_id: currentUser.id, name }]);
  loadSubjects();
});

// Grupos
async function loadGroups() {
  const list = document.getElementById('groupsList');
  if (!list) return;
  const { data } = await supabaseClient.from('groups').select('*');
  list.innerHTML = data && data.length ? data.map(g => `<div style="background: #161920; padding: 14px; border-radius: 10px; margin-bottom: 10px; border: 1px solid #2d3139;"><b>👥 ${g.name}</b><br><span style="color:#9ba1a6; font-size:13px;">${g.description || ''}</span></div>`).join('') : '<p style="color: #9ba1a6;">Nenhum grupo ativo no momento.</p>';
}

document.getElementById('addGroupBtn')?.addEventListener('click', async () => {
  const name = prompt('Nome da Comunidade / Grupo:');
  const description = prompt('Descrição breve:');
  if (!name) return;
  await supabaseClient.from('groups').insert([{ name, description, created_by: currentUser.id }]);
  loadGroups();
});

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

checkUser();

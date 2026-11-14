// ============================================================
// STUDY ORDER — APP.JS (COMPLETO E CORRIGIDO)
// Segurança real fica nas policies (RLS) do Supabase: rode o supabase.sql.
// ============================================================
'use strict';
(() => {
  // ---------- Cliente Supabase ----------
  let sb = null;
  try {
    sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  } catch (err) {
    console.error('Erro ao inicializar Supabase Client:', err);
  }

  // ---------- Estado ----------
  const state = {
    user: null, profile: null, authMode: 'login', initialized: false,
    subjects: [], subjectId: null, groups: [], myGroups: new Set(), groupId: null,
    dmUserId: null, following: new Set(), postFileUrl: null, groupFile: null,
    feedPage: 0
  };
  const PAGE_SIZE = 15;
  const MAX_FILE = 20 * 1024 * 1024;
  const IMG_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
  const VID_TYPES = ['video/mp4', 'video/webm'];
  const DOC_TYPES = ['application/pdf', 'text/plain', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  const TITLES = {
    feedView: '💬 Feed & Posts', dashboard: '📚 Meus Estudos', allTasksView: '📅 Provas & Tarefas',
    groupsView: '👥 Grupos & Comunidades', messagesView: '💬 Mensagens (DMs)',
    notificationsView: '🔔 Notificações', profileView: '👤 Meu Perfil', proView: '⭐ Plano PRO',
    adminView: '🛡️ Painel Admin'
  };
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const POST_SELECT = '*, profiles:user_id(id, username), post_comments(count)';
  const postCache = new Map();
  const nameCache = new Map();
  let feedToken = 0;
  let toastTimer = null;
  let searchTimer = null;

  // ---------- Utilitários ----------
  const $ = (id) => document.getElementById(id);
  const me = () => state.user.id;
  const isVisible = (id) => { const el = $(id); return !!el && !el.classList.contains('hidden'); };
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]);
  const safeUrl = (u) => {
    try {
      const x = new URL(String(u || '').trim(), location.href);
      return (x.protocol === 'http:' || x.protocol === 'https:') ? x.href : '';
    } catch { return ''; }
  };
  const localDate = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const isValidDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00'));
  const fmtDate = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const fmtDateTime = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  function toast(msg) {
    const t = $('toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
  }
  function openModal(html) { $('modalBody').innerHTML = html; $('modal').classList.remove('hidden'); }
  function closeModal() { $('modal').classList.add('hidden'); $('modalBody').innerHTML = ''; }

  function linkify(text) {
    if (!text) return '';
    return esc(text).replace(/https?:\/\/[^\s<]+/gi, (raw) => {
      const trailing = (raw.match(/[.,;:!?)]+$/) || [''])[0];
      const shown = trailing ? raw.slice(0, -trailing.length) : raw;
      const href = safeUrl(shown.replace(/&amp;/g, '&'));
      if (!href) return raw;
      const internal = href.startsWith(location.origin) && href.includes('#post-');
      return `<a class="link" href="${esc(href)}"${internal ? '' : ' target="_blank" rel="noopener noreferrer"'}>${shown}</a>${trailing}`;
    });
  }

  async function usernameOf(id) {
    if (nameCache.has(id)) return nameCache.get(id);
    const { data } = await sb.from('profiles').select('username').eq('id', id).maybeSingle();
    const name = data?.username || 'utilizador';
    nameCache.set(id, name);
    return name;
  }

  async function notify(userId, type, content) {
    if (!userId || userId === me()) return;
    const { error } = await sb.from('notifications').insert([{ user_id: userId, actor_id: me(), type, content }]);
    if (error) console.warn('Notificação não enviada:', error.message);
  }

  // ---------- Canais realtime (sempre limpos antes de recriar) ----------
  const chans = {};
  function dropChan(key) { if (chans[key]) { sb.removeChannel(chans[key]); delete chans[key]; } }
  function setChan(key, channel) { dropChan(key); chans[key] = channel; }
  function dropAllChans() { Object.keys(chans).forEach(dropChan); }

  // ---------- Upload ----------
  async function uploadFile(file, folder, allowed) {
    if (!allowed.includes(file.type)) throw new Error('Tipo de ficheiro não permitido.');
    if (file.size > MAX_FILE) throw new Error('Ficheiro acima de 20 MB.');
    const ext = ((file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5)) || 'bin';
    const path = `${me()}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await sb.storage.from('imagens').upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    return sb.storage.from('imagens').getPublicUrl(path).data.publicUrl;
  }

  // ============================================================
  // AUTENTICAÇÃO
  // ============================================================
  function setupAuth() {
    document.querySelectorAll('.auth-tab').forEach((tab) => tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      state.authMode = tab.dataset.auth;
      const signup = state.authMode === 'signup';
      $('usernameFieldContainer').classList.toggle('hidden', !signup);
      $('usernameInput').required = signup;
      $('authSubmit').textContent = signup ? 'Criar conta' : 'Entrar';
      $('password').autocomplete = signup ? 'new-password' : 'current-password';
      $('authMsg').textContent = '';
    }));
    $('authForm').addEventListener('submit', (e) => { e.preventDefault(); submitAuth(); });
  }

  async function submitAuth() {
    const msg = $('authMsg'), btn = $('authSubmit');
    const email = $('email').value.trim();
    const password = $('password').value; // sem trim: espaços podem fazer parte da senha
    const username = $('usernameInput').value.trim().replace(/^@/, '');
    msg.className = 'form-msg';
    if (!email || !password) { msg.textContent = 'Preencha o e-mail e a senha.'; return; }
    if (!sb) { msg.textContent = 'Erro de inicialização do cliente Supabase.'; return; }
    const signup = state.authMode === 'signup';
    if (signup && !/^[a-zA-Z0-9._]{3,30}$/.test(username)) {
      msg.textContent = 'Utilizador: 3 a 30 caracteres (letras, números, ponto ou _).'; return;
    }
    btn.disabled = true; msg.textContent = 'A processar...';
    try {
      if (signup) {
        const { data, error } = await sb.auth.signUp({ email, password, options: { data: { username } } });
        if (error) throw error;
        if (data.session) { await enterApp(data.session.user); }
        else { msg.className = 'form-msg ok'; msg.textContent = 'Conta criada! Confirme o seu e-mail e depois faça login.'; }
      } else {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await enterApp(data.user);
      }
    } catch (err) {
      console.error('Erro na autenticação:', err);
      msg.textContent = 'Erro: ' + (err.message || 'Falha na autenticação.');
    } finally { btn.disabled = false; }
  }

  async function checkUser() {
    try {
      const { data: { session }, error } = await sb.auth.getSession();
      if (error) throw error;
      if (session?.user) await enterApp(session.user); else showAuth();
    } catch (err) {
      console.error('Erro ao verificar sessão:', err);
      showAuth();
    }
  }

  async function enterApp(user) {
    state.user = user;
    $('authScreen').classList.add('hidden');
    $('app').classList.remove('hidden');
    $('userEmail').textContent = user.email || '';
    await loadProfile();
    initApp();
  }
  function showAuth() { $('authScreen').classList.remove('hidden'); $('app').classList.add('hidden'); }

  async function loadProfile() {
    const fallback = { id: me(), username: (state.user.email || 'utilizador').split('@')[0], role: 'user', is_pro: false };
    try {
      const { data } = await sb.from('profiles').select('*').eq('id', me()).maybeSingle();
      state.profile = data || fallback;
    } catch (err) {
      console.warn('Erro ao carregar perfil:', err);
      state.profile = fallback;
    }
    nameCache.set(me(), state.profile.username);
    $('adminNavBtn').classList.toggle('hidden', state.profile.role !== 'admin');
  }

  async function logout() {
    dropAllChans();
    state.user = null;
    await sb.auth.signOut();
    location.reload();
  }

  // ============================================================
  // NAVEGAÇÃO
  // ============================================================
  function setActiveNav(target) {
    document.querySelectorAll('.nav-link').forEach((b) => b.classList.toggle('active', b.dataset.target === target));
  }
  function showView(id) {
    document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
    $(id)?.classList.remove('hidden');
    $('sidebar').classList.remove('open');
  }
  function navigate(target) {
    dropChan('group'); dropChan('dm'); dropChan('subject');
    state.groupId = null; state.dmUserId = null; state.subjectId = null;
    setActiveNav(target); showView(target);
    $('breadcrumb').textContent = TITLES[target] || '';
    const loaders = {
      feedView: () => loadPosts(true), dashboard: loadDashboard, allTasksView: loadAllTasksView,
      groupsView: loadGroups, messagesView: openMessagesView, notificationsView: loadNotifications,
      profileView: loadProfileView, adminView: renderAdmin
    };
    loaders[target]?.();
  }

  function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach((btn) =>
      btn.addEventListener('click', () => navigate(btn.dataset.target)));
    $('logoutBtn').addEventListener('click', logout);
    $('mobileBtn').addEventListener('click', () => $('sidebar').classList.toggle('open'));
    $('closeModal').addEventListener('click', closeModal);
    $('modal').addEventListener('click', (e) => { if (e.target === $('modal')) closeModal(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a' && state.profile?.role === 'admin') {
        e.preventDefault(); navigate('adminView');
      }
    });
    window.addEventListener('hashchange', gotoPostFromHash);
  }

  function setupTheme() {
    try { if (localStorage.getItem('so-theme') === 'light') document.body.classList.add('light'); } catch { /* ignore */ }
    $('themeBtn').addEventListener('click', () => {
      const light = document.body.classList.toggle('light');
      try { localStorage.setItem('so-theme', light ? 'light' : 'dark'); } catch { /* ignore */ }
    });
  }

  async function gotoPostFromHash() {
    const m = location.hash.match(/^#post-(.+)$/);
    if (!m || !UUID_RE.test(m[1]) || !state.user) return;
    const id = m[1];
    dropChan('group'); dropChan('dm'); dropChan('subject');
    setActiveNav('feedView'); showView('feedView'); $('breadcrumb').textContent = TITLES.feedView;
    await loadPosts(true);
    if (!$('post-' + id)) {
      const { data } = await sb.from('posts').select(POST_SELECT).eq('id', id).maybeSingle();
      if (data) $('postsList').prepend(buildPostCard(data));
    }
    const card = $('post-' + id);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.add('highlight');
      setTimeout(() => card.classList.remove('highlight'), 3000);
    } else toast('Publicação não encontrada.');
  }

  // ============================================================
  // BANNER GLOBAL
  // ============================================================
  async function loadGlobalBanner() {
    const box = $('systemGlobalBanner');
    const { data: b } = await sb.from('global_announcements').select('message,type')
      .eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!b?.message) { box.innerHTML = ''; return; }
    const type = ['warning', 'success'].includes(b.type) ? b.type : 'info';
    const badge = { warning: '⚠️ AVISO IMPORTANTE', success: '🎉 NOVIDADE', info: '📢 COMUNICADO OFICIAL' }[type];
    box.innerHTML = `<div class="banner banner-${type}">
      <div class="banner-top"><span class="banner-badge">${badge}</span>
      <button class="banner-close" data-act="close-banner" aria-label="Fechar aviso">✕</button></div>
      <div class="banner-msg">${linkify(b.message)}</div></div>`;
  }

  // ============================================================
  // FEED
  // ============================================================
  function followBtn(userId) {
    const f = state.following.has(userId);
    return `<button class="follow-btn ${f ? 'following' : ''}" data-act="follow-toggle" data-id="${esc(userId)}">${f ? 'A seguir' : 'Seguir'}</button>`;
  }

  function buildPostCard(post) {
    postCache.set(post.id, { content: post.content || '', media_url: post.media_url || '', user_id: post.user_id });
    const card = document.createElement('div');
    card.className = 'panel post'; card.id = 'post-' + post.id;
    const mine = post.user_id === me();
    const count = post.post_comments?.[0]?.count ?? 0;
    const media = safeUrl(post.media_url || '');
    card.innerHTML = `
      <div class="post-head">
        <div style="display:flex;align-items:center;min-width:0">
          <span class="post-author" data-act="open-profile" data-id="${esc(post.user_id)}">@${esc(post.profiles?.username || 'utilizador')}</span>
          ${mine ? '' : followBtn(post.user_id)}
        </div>
        <span class="post-date">📅 ${esc(fmtDate(post.created_at))}</span>
      </div>
      <div class="post-body">${linkify(post.content)}</div>
      ${media ? `<div class="post-media"><a href="${esc(media)}" target="_blank" rel="noopener noreferrer"><img src="${esc(media)}" alt="Imagem da publicação" loading="lazy" decoding="async"></a></div>` : ''}
      <div class="post-actions">
        <button class="ghost-btn" data-act="toggle-comments" data-post="${post.id}">💬 <b id="comment-count-${post.id}">${count}</b> Comentários</button>
        <button class="ghost-btn" data-act="share" data-post="${post.id}">🔗 Compartilhar</button>
      </div>
      <div id="comments-section-${post.id}" class="comments hidden">
        <div id="comments-list-${post.id}" class="comments-list"><small class="muted-s">A carregar comentários...</small></div>
        <div class="comment-form">
          <input type="text" class="field comment-input" id="comment-input-${post.id}" data-post="${post.id}" maxlength="1000" placeholder="Escreva um comentário...">
          <button class="primary" style="padding:6px 14px;font-size:12px" data-act="submit-comment" data-post="${post.id}">Comentar</button>
        </div>
      </div>`;
    return card;
  }

  async function loadPosts(reset = false) {
    const list = $('postsList'); if (!list) return;
    const token = ++feedToken;
    if (reset) { state.feedPage = 0; list.innerHTML = ''; }
    const from = state.feedPage * PAGE_SIZE;
    const { data: posts, error } = await sb.from('posts').select(POST_SELECT)
      .order('created_at', { ascending: false }).range(from, from + PAGE_SIZE - 1);
    if (token !== feedToken) return; // chegou uma chamada mais nova
    if (error) { if (reset) list.innerHTML = '<p class="empty">Erro ao carregar o feed.</p>'; return; }
    if (reset && posts.length === 0) list.innerHTML = '<p class="empty">Nenhuma publicação ainda.</p>';
    posts.forEach((p) => { if (!$('post-' + p.id)) list.appendChild(buildPostCard(p)); });
    state.feedPage++;
    $('loadMorePostsBtn').classList.toggle('hidden', posts.length < PAGE_SIZE);
  }

  async function onNewPost(p) {
    if ($('post-' + p.id)) return;
    const { data } = await sb.from('posts').select(POST_SELECT).eq('id', p.id).maybeSingle();
    if (!data || $('post-' + p.id)) return;
    $('postsList').querySelector('.empty')?.remove();
    $('postsList').prepend(buildPostCard(data));
  }

  async function createPost() {
    const btn = $('createPostBtn');
    const content = $('postContentInput').value.trim();
    const typedUrl = $('postMediaInput').value.trim();
    let mediaUrl = state.postFileUrl || null;
    if (!mediaUrl && typedUrl) {
      mediaUrl = safeUrl(typedUrl);
      if (!mediaUrl) { toast('A URL da imagem deve começar com http:// ou https://'); return; }
    }
    if (!content && !mediaUrl) return;
    btn.disabled = true;
    const { data, error } = await sb.from('posts')
      .insert([{ user_id: me(), content, media_url: mediaUrl, media_type: mediaUrl ? 'image' : null }])
      .select(POST_SELECT).single();
    btn.disabled = false;
    if (error) { toast('Erro ao publicar: ' + error.message); return; }
    $('postContentInput').value = ''; $('postMediaInput').value = '';
    $('postFileInput').value = ''; state.postFileUrl = null;
    if (!$('post-' + data.id)) {
      $('postsList').querySelector('.empty')?.remove();
      $('postsList').prepend(buildPostCard(data));
    }
  }

  async function toggleComments(postId) {
    const sec = $('comments-section-' + postId); if (!sec) return;
    const nowHidden = sec.classList.toggle('hidden');
    if (!nowHidden) loadComments(postId);
  }

  async function loadComments(postId) {
    const box = $('comments-list-' + postId); if (!box) return;
    const { data: comments, error } = await sb.from('post_comments')
      .select('id,user_id,content,profiles:user_id(username)')
      .eq('post_id', postId).order('created_at', { ascending: true }).limit(100);
    if (error) { box.innerHTML = '<small class="muted-s">Erro ao carregar comentários.</small>'; return; }
    if (!comments.length) { box.innerHTML = '<small class="muted-s">Nenhum comentário ainda. Seja o primeiro!</small>'; return; }
    box.innerHTML = comments.map((c) => `
      <div class="comment">
        <div style="flex:1"><b class="accent">@${esc(c.profiles?.username || 'utilizador')}</b>: <span>${linkify(c.content)}</span></div>
        ${c.user_id === me() ? `<button class="x-btn" style="font-size:11px" data-act="delete-comment" data-id="${c.id}" data-post="${postId}" aria-label="Excluir comentário">✕</button>` : ''}
      </div>`).join('');
  }

  async function submitComment(postId) {
    const input = $('comment-input-' + postId);
    const content = input?.value.trim(); if (!content) return;
    input.value = '';
    const { error } = await sb.from('post_comments').insert([{ post_id: postId, user_id: me(), content }]);
    if (error) { toast('Erro ao enviar comentário: ' + error.message); input.value = content; return; }
    const owner = postCache.get(postId)?.user_id;
    if (owner) notify(owner, 'comment', 'comentou na tua publicação.');
    const counter = $('comment-count-' + postId);
    if (counter) counter.textContent = String((parseInt(counter.textContent, 10) || 0) + 1);
    loadComments(postId);
  }

  async function deleteComment(commentId, postId) {
    if (!confirm('Deseja excluir este comentário?')) return;
    const { error } = await sb.from('post_comments').delete().eq('id', commentId).eq('user_id', me());
    if (error) { toast('Erro: ' + error.message); return; }
    const counter = $('comment-count-' + postId);
    if (counter) counter.textContent = String(Math.max(0, (parseInt(counter.textContent, 10) || 1) - 1));
    loadComments(postId);
  }

  // ---------- Seguir ----------
  async function loadFollowing() {
    const { data } = await sb.from('followers').select('following_id').eq('follower_id', me());
    state.following = new Set((data || []).map((f) => f.following_id));
  }

  async function toggleFollow(targetId) {
    if (!UUID_RE.test(targetId) || targetId === me()) return;
    if (state.following.has(targetId)) {
      const { error } = await sb.from('followers').delete().eq('follower_id', me()).eq('following_id', targetId);
      if (error) { toast('Erro: ' + error.message); return; }
      state.following.delete(targetId); toast('Deixou de seguir este utilizador.');
    } else {
      const { error } = await sb.from('followers').insert([{ follower_id: me(), following_id: targetId }]);
      if (error) { toast('Erro ao seguir utilizador: ' + error.message); return; }
      state.following.add(targetId);
      notify(targetId, 'follow', 'começou a seguir-te.');
      toast('Agora está a seguir este utilizador!');
    }
    const f = state.following.has(targetId);
    document.querySelectorAll(`.follow-btn[data-id="${targetId}"]`).forEach((b) => {
      b.textContent = f ? 'A seguir' : 'Seguir'; b.classList.toggle('following', f);
    });
    document.querySelector(`.suggest-row[data-id="${targetId}"]`)?.remove();
    const sugBox = $('suggestedUsersList');
    if (sugBox && !sugBox.querySelector('.suggest-row')) sugBox.innerHTML = '<p class="muted-s">Não há novas sugestões no momento. Já segue todos os utilizadores!</p>';
    if (isVisible('profileView')) loadFollowCounts();
  }

  // ---------- Perfil ----------
  async function followCounts(userId) {
    const [a, b] = await Promise.all([
      sb.from('followers').select('*', { count: 'exact', head: true }).eq('following_id', userId),
      sb.from('followers').select('*', { count: 'exact', head: true }).eq('follower_id', userId)
    ]);
    return { followers: a.count ?? 0, following: b.count ?? 0 };
  }
  async function loadFollowCounts() {
    const c = await followCounts(me());
    $('statFollowersCount').textContent = c.followers;
    $('statFollowingCount').textContent = c.following;
  }

  // ---------- Avatar ----------
  function avatarHtml(p, size = '') {
    const url = safeUrl(p?.avatar_url || '');
    const name = p?.username || 'utilizador';
    return url
      ? `<img class="avatar-img ${size}" src="${esc(url)}" alt="Foto de @${esc(name)}" loading="lazy" decoding="async">`
      : `<div class="avatar ${size}">${esc(name.charAt(0).toUpperCase())}</div>`;
  }

  // ---------- Perfil estilo Instagram ----------
  function renderProfileHeader() {
    const p = state.profile || {};
    $('profileAvatar').innerHTML = avatarHtml(p, 'xl');
    $('profileUsernameDisplay').textContent = '@' + (p.username || '');
    const bio = (p.bio || '').trim();
    $('profileBioDisplay').innerHTML = bio ? linkify(bio) : '<span class="muted-s">Adicione uma biografia em “Editar perfil”.</span>';
    $('profileEmailDisplay').textContent = state.user.email || '';
  }

  function loadProfileView() {
    renderProfileHeader();
    loadFollowCounts();
    loadMyPosts();
    loadSuggestions();
  }

  async function loadMyPosts() {
    const grid = $('profilePostsGrid');
    const { data, error, count } = await sb.from('posts')
      .select('id,content,media_url,created_at', { count: 'exact' })
      .eq('user_id', me()).order('created_at', { ascending: false }).limit(200);
    if (error) { grid.innerHTML = '<p class="empty ig-empty">Erro ao carregar as publicações.</p>'; return; }
    state.myPosts = data || [];
    $('statPostsCount').textContent = count ?? state.myPosts.length;
    renderMyPostsGrid();
  }

  function renderMyPostsGrid() {
    const grid = $('profilePostsGrid');
    const posts = state.myPosts || [];
    if (!posts.length) {
      grid.innerHTML = '<p class="empty ig-empty">Você ainda não publicou nada. Compartilhe sua primeira dica no Feed!</p>';
      return;
    }
    grid.innerHTML = posts.map((p) => {
      const media = safeUrl(p.media_url || '');
      const inner = media
        ? `<img src="${esc(media)}" alt="Publicação" loading="lazy" decoding="async">`
        : `<p>${esc((p.content || '').slice(0, 160))}</p>`;
      return `<div class="ig-tile${media ? '' : ' text'}" data-act="view-my-post" data-id="${p.id}" tabindex="0">${inner}
        <button type="button" class="ig-del" data-act="delete-my-post" data-id="${p.id}" title="Excluir publicação" aria-label="Excluir publicação">🗑</button></div>`;
    }).join('');
  }

  function openMyPost(id) {
    const p = (state.myPosts || []).find((x) => x.id === id); if (!p) return;
    const media = safeUrl(p.media_url || '');
    openModal(`<div class="profile-modal" style="text-align:left">
      ${media ? `<img class="post-modal-img" src="${esc(media)}" alt="Publicação" decoding="async">` : ''}
      ${p.content ? `<div class="post-body">${linkify(p.content)}</div>` : ''}
      <small class="muted-s">📅 ${esc(fmtDate(p.created_at))}</small>
      <button class="btn-sm btn-red big" data-act="delete-my-post" data-id="${p.id}">🗑 Excluir publicação</button></div>`);
  }

  async function deleteMyPost(id) {
    if (!confirm('Excluir esta publicação? Essa ação não pode ser desfeita.')) return;
    const { data, error } = await sb.from('posts').delete().eq('id', id).eq('user_id', me()).select('id');
    if (error || !data?.length) { toast('Erro ao excluir: ' + (error?.message || 'sem permissão.')); return; }
    state.myPosts = (state.myPosts || []).filter((p) => p.id !== id);
    postCache.delete(id);
    $('post-' + id)?.remove();
    $('statPostsCount').textContent = String(Math.max(0, (parseInt($('statPostsCount').textContent, 10) || 1) - 1));
    renderMyPostsGrid();
    closeModal();
    toast('Publicação excluída.');
  }

  async function showFollowList(kind) {
    const followers = kind === 'followers';
    openModal(`<h2 class="modal-title">${followers ? 'Seguidores' : 'A seguir'}</h2>
      <div id="followListBox" class="stack lg scroll-box"><p class="muted-s">A carregar...</p></div>`);
    const col = followers ? 'follower_id' : 'following_id';
    const key = followers ? 'following_id' : 'follower_id';
    const { data: rel, error } = await sb.from('followers').select(col).eq(key, me()).limit(100);
    const box = $('followListBox'); if (!box) return;
    if (error) { box.innerHTML = '<p class="muted-s">Erro ao carregar a lista.</p>'; return; }
    const ids = (rel || []).map((r) => r[col]);
    if (!ids.length) {
      box.innerHTML = `<p class="muted-s">${followers ? 'Ainda ninguém te segue.' : 'Você ainda não segue ninguém.'}</p>`;
      return;
    }
    const { data: people } = await sb.from('profiles').select('id,username,avatar_url').in('id', ids);
    box.innerHTML = (people || []).map((u) => `
      <div class="person-row">
        <div class="person-main">${avatarHtml(u)}<b class="link-like" data-act="open-profile" data-id="${u.id}">@${esc(u.username)}</b></div>
        ${u.id === me() ? '' : followBtn(u.id)}
      </div>`).join('');
  }

  // ---------- Editar perfil ----------
  let pendingAvatar = null;
  let removeAvatar = false;

  function openEditProfile() {
    pendingAvatar = null; removeAvatar = false;
    const p = state.profile || {};
    openModal(`<h2 class="modal-title">Editar perfil</h2>
      <div class="ep-avatar">
        <div id="epAvatarPreview">${avatarHtml(p, 'xl')}</div>
        <div class="ep-actions">
          <label class="upload-chip">📷 Alterar foto<input id="epAvatarInput" class="hidden" type="file" accept="image/*"></label>
          <button type="button" class="btn-secondary" data-act="remove-avatar">Remover foto</button>
        </div>
      </div>
      <label>Nome de utilizador<input id="epUsername" type="text" maxlength="30" value="${esc(p.username || '')}"></label>
      <label>Biografia <small class="muted-s" id="epBioCount"></small>
        <textarea id="epBio" rows="4" maxlength="160" placeholder="Fale um pouco sobre você e seus estudos...">${esc(p.bio || '')}</textarea></label>
      <button class="primary full" id="epSaveBtn" data-act="save-profile">Salvar alterações</button>`);
    $('epAvatarInput').addEventListener('change', (e) => {
      const f = e.target.files[0]; if (!f) return;
      if (!IMG_TYPES.includes(f.type)) { toast('Use uma imagem JPG, PNG, WEBP, GIF ou AVIF.'); e.target.value = ''; return; }
      if (f.size > 5 * 1024 * 1024) { toast('A foto deve ter até 5 MB.'); e.target.value = ''; return; }
      pendingAvatar = f; removeAvatar = false;
      $('epAvatarPreview').innerHTML = `<img class="avatar-img xl" src="${esc(URL.createObjectURL(f))}" alt="Pré-visualização">`;
    });
    const bio = $('epBio'), counter = $('epBioCount');
    const update = () => { counter.textContent = `${bio.value.length}/160`; };
    bio.addEventListener('input', update); update();
  }

  function clearAvatarChoice() {
    pendingAvatar = null; removeAvatar = true;
    $('epAvatarPreview').innerHTML = avatarHtml({ username: $('epUsername')?.value || state.profile?.username }, 'xl');
  }

  async function saveProfile() {
    const btn = $('epSaveBtn');
    const username = $('epUsername').value.trim().replace(/^@/, '');
    const bio = $('epBio').value.trim().slice(0, 160);
    if (!/^[a-zA-Z0-9._]{3,30}$/.test(username)) {
      toast('Utilizador: 3 a 30 caracteres (letras, números, ponto ou _).'); return;
    }
    btn.disabled = true;
    try {
      let avatar_url = state.profile?.avatar_url || null;
      if (pendingAvatar) avatar_url = await uploadFile(pendingAvatar, 'avatars', IMG_TYPES);
      else if (removeAvatar) avatar_url = null;
      const { data, error } = await sb.from('profiles').update({ username, bio, avatar_url })
        .eq('id', me()).select('*').single();
      if (error) throw error;
      state.profile = data;
      nameCache.set(me(), data.username);
      renderProfileHeader();
      closeModal();
      toast('Perfil atualizado!');
    } catch (err) {
      toast(err.code === '23505' ? 'Esse nome de utilizador já está em uso.' : 'Erro ao salvar: ' + (err.message || err));
    } finally {
      const b = $('epSaveBtn'); if (b) b.disabled = false;
    }
  }

  // ---------- Sugestões para seguir ----------
  async function loadSuggestions() {
    const box = $('suggestedUsersList');
    let q = sb.from('profiles').select('id,username,avatar_url,bio').neq('id', me())
      .order('created_at', { ascending: false }).limit(20);
    const ids = [...state.following];
    if (ids.length) q = q.not('id', 'in', `(${ids.join(',')})`);
    const { data, error } = await q;
    if (error) { box.innerHTML = '<p class="muted-s">Erro ao carregar sugestões.</p>'; return; }
    if (!data.length) { box.innerHTML = '<p class="muted-s">Não há novas sugestões no momento. Já segue todos os utilizadores!</p>'; return; }
    box.innerHTML = data.map((u) => `
      <div class="person-row suggest-row" data-id="${u.id}">
        <div class="person-main">${avatarHtml(u)}
          <div><b class="link-like" data-act="open-profile" data-id="${u.id}">@${esc(u.username)}</b>
          <small>${esc((u.bio || '').slice(0, 60) || 'Membro da comunidade')}</small></div></div>
        <button class="primary" style="padding:6px 14px;font-size:12px" data-act="follow-toggle" data-id="${u.id}">Seguir</button>
      </div>`).join('');
  }

  async function openProfile(userId) {
    if (!UUID_RE.test(userId)) return;
    const { data: profile } = await sb.from('profiles').select('id,username,role,is_pro,bio,avatar_url').eq('id', userId).maybeSingle();
    if (!profile) { toast('Perfil não encontrado.'); return; }
    const counts = await followCounts(userId);
    const { count: postsCount } = await sb.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', userId);
    let action = '';
    if (userId !== me()) {
      const { data: req } = await sb.from('contact_requests').select('id,sender_id,status')
        .or(`and(sender_id.eq.${me()},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${me()})`)
        .maybeSingle();
      const name = esc(profile.username);
      if (!req) {
        action = `<button class="primary" data-act="send-contact" data-id="${userId}" data-name="${name}">📩 Enviar Convite de Contato</button>`;
      } else if (req.status === 'pending') {
        action = req.sender_id === me()
          ? '<button class="btn-sm btn-slate big" disabled>⏳ Convite Pendente</button>'
          : `<div style="display:flex;gap:8px"><button class="primary" style="flex:1" data-act="respond-request" data-id="${req.id}" data-status="accepted" data-close="1">Aceitar convite</button>
             <button class="btn-sm btn-red big" style="flex:1" data-act="respond-request" data-id="${req.id}" data-status="rejected" data-close="1">Recusar</button></div>`;
      } else if (req.status === 'accepted') {
        action = `<button class="primary" data-act="open-dm-modal" data-id="${userId}" data-name="${name}">💬 Abrir Chat Privado</button>`;
      } else {
        action = `<button class="primary" data-act="send-contact" data-id="${userId}" data-name="${name}" data-resend="${req.id}">📩 Enviar Novo Convite</button>`;
      }
    }
    openModal(`<div class="profile-modal">
      <div style="display:flex;justify-content:center">${avatarHtml(profile, 'lg')}</div>
      <h2>@${esc(profile.username)}</h2>
      ${profile.bio ? `<p class="ig-bio" style="margin:0">${linkify(profile.bio)}</p>` : ''}
      <p class="muted-s" style="margin:0">Cargo: <b>${esc((profile.role || 'user').toUpperCase())}</b> | Plano: <b>${profile.is_pro ? 'PRO' : 'Grátis'}</b></p>
      <div class="counts"><div><b>${postsCount ?? 0}</b><br><small>Publicações</small></div><div><b>${counts.followers}</b><br><small>Seguidores</small></div><div><b>${counts.following}</b><br><small>A seguir</small></div></div>
      ${action}</div>`);
  }

  async function loadNotifications() {
    const box = $('notificationsList');
    const { data, error } = await sb.from('notifications')
      .select('id,content,created_at,actor_id,profiles:actor_id(username)')
      .eq('user_id', me()).order('created_at', { ascending: false }).limit(50);
    if (error) { box.innerHTML = '<p class="muted-s pad">Erro ao carregar notificações.</p>'; return; }
    if (!data.length) { box.innerHTML = '<p class="muted-s pad">Nenhuma notificação por enquanto.</p>'; return; }
    box.innerHTML = data.map((n) => `
      <div class="notif"><b class="accent link-like" data-act="open-profile" data-id="${n.actor_id}">@${esc(n.profiles?.username || 'alguém')}</b>
      <span>${esc(n.content)}</span><div class="meta">📅 ${esc(fmtDateTime(n.created_at))}</div></div>`).join('');
  }

  // ============================================================
  // MATÉRIAS, TAREFAS, CONTEÚDOS
  // ============================================================
  async function loadSubjects() {
    const nav = $('subjectNav'), cards = $('subjectCards');
    const { data, error } = await sb.from('subjects').select('id,name').eq('user_id', me()).order('created_at');
    state.subjects = error ? [] : (data || []);
    if (!state.subjects.length) {
      nav.innerHTML = '<small class="muted-s" style="padding:6px 12px;display:block">Nenhuma matéria</small>';
      cards.innerHTML = '<p class="muted-s">Nenhuma matéria cadastrada.</p>';
      return;
    }
    nav.innerHTML = state.subjects.map((s) =>
      `<button class="side-action" data-act="open-subject" data-id="${s.id}">📓 ${esc(s.name)}</button>`).join('');
    cards.innerHTML = state.subjects.map((s) =>
      `<div class="subject-card" data-act="open-subject" data-id="${s.id}"><b>${esc(s.name)}</b><small>Ver anotações e tarefas</small></div>`).join('');
  }

  async function createSubject() {
    const name = (prompt('Nome da Matéria (ex: Matemática, Física):') || '').trim().slice(0, 80);
    if (!name) return;
    const { error } = await sb.from('subjects').insert([{ user_id: me(), name }]);
    if (error) { toast('Erro ao criar matéria: ' + error.message); return; }
    await loadSubjects(); loadDashboardStats();
  }

  function openSubject(id) {
    const sub = state.subjects.find((s) => s.id === id); if (!sub) return;
    dropChan('group'); dropChan('dm');
    state.subjectId = id; setActiveNav(null); showView('subjectView');
    $('breadcrumb').textContent = '📓 ' + sub.name;
    $('subjectTitle').textContent = sub.name;
    $('notes').value = '';
    sb.from('subjects').select('notes').eq('id', id).maybeSingle().then(({ data }) => {
      if (state.subjectId === id) $('notes').value = data?.notes || '';
    });
    loadSubjectTasks(id); loadSubjectContents(id);
    setChan('subject', sb.channel('subject-' + id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subject_contents', filter: `subject_id=eq.${id}` },
        () => loadSubjectContents(id))
      .subscribe());
  }

  async function saveNotes() {
    if (!state.subjectId) return;
    const { error } = await sb.from('subjects').update({ notes: $('notes').value }).eq('id', state.subjectId).eq('user_id', me());
    toast(error ? 'Erro ao salvar: ' + error.message : 'Anotações salvas com sucesso!');
  }

  async function deleteSubject() {
    if (!state.subjectId || !confirm('Deseja excluir esta matéria? As tarefas e arquivos dela também serão removidos.')) return;
    const { error } = await sb.from('subjects').delete().eq('id', state.subjectId).eq('user_id', me());
    if (error) { toast('Erro: ' + error.message); return; }
    await loadSubjects(); navigate('dashboard');
  }

  async function createTask(subjectId = null) {
    const title = (prompt('Nome da prova, lembrete ou tarefa:') || '').trim().slice(0, 200);
    if (!title) return;
    const raw = prompt('Data de entrega (AAAA-MM-DD):', localDate());
    if (raw === null) return;
    const due = raw.trim();
    if (due && !isValidDate(due)) { toast('Data inválida. Use AAAA-MM-DD.'); return; }
    const { error } = await sb.from('tasks').insert([{ user_id: me(), subject_id: subjectId, title, due_date: due || null }]);
    if (error) { toast('Erro ao criar tarefa: ' + error.message); return; }
    refreshTasks();
  }

  function refreshTasks() {
    loadTasks();
    if (isVisible('allTasksView')) loadAllTasksView();
    if (isVisible('subjectView') && state.subjectId) loadSubjectTasks(state.subjectId);
    if (isVisible('dashboard')) loadDashboardStats();
  }

  async function toggleTask(id, done) {
    const { error } = await sb.from('tasks').update({ completed: !done }).eq('id', id).eq('user_id', me());
    if (error) toast('Erro: ' + error.message); else refreshTasks();
  }
  async function deleteTask(id) {
    if (!confirm('Deseja excluir esta tarefa?')) return;
    const { error } = await sb.from('tasks').delete().eq('id', id).eq('user_id', me());
    if (error) toast('Erro: ' + error.message); else refreshTasks();
  }

  async function loadSubjectTasks(subjectId) {
    const box = $('tasks');
    const { data: tasks } = await sb.from('tasks').select('*').eq('subject_id', subjectId)
      .eq('user_id', me()).order('due_date', { ascending: true, nullsFirst: false });
    if (state.subjectId !== subjectId) return;
    if (!tasks?.length) { box.innerHTML = '<small class="muted-s">Nenhuma tarefa pendente.</small>'; return; }
    box.innerHTML = tasks.map((t) => `
      <div class="list-row">
        <button class="check ${t.completed ? 'done' : ''}" data-act="toggle-task" data-id="${t.id}" data-done="${t.completed ? 1 : 0}" aria-label="Concluir tarefa"></button>
        <span class="grow wrap"><b class="${t.completed ? 'line-through' : ''}">${esc(t.title)}</b> <small class="accent">(${esc(t.due_date || 'Sem data')})</small></span>
        <button class="x-btn" data-act="delete-task" data-id="${t.id}" aria-label="Excluir tarefa">✕</button>
      </div>`).join('');
  }

  async function loadTasks() {
    const box = $('upcoming');
    const { data: tasks } = await sb.from('tasks').select('id,title,due_date').eq('user_id', me())
      .eq('completed', false).order('due_date', { ascending: true, nullsFirst: false }).limit(5);
    if (!tasks?.length) { box.innerHTML = '<p class="muted-s">Nenhuma tarefa agendada.</p>'; return; }
    box.innerHTML = tasks.map((t) => `
      <div class="list-row"><div class="grow wrap"><b>${esc(t.title)}</b></div><span class="accent shrink">${esc(t.due_date || '')}</span></div>`).join('');
  }

  async function loadAllTasksView() {
    const box = $('globalTasksList');
    const { data: tasks, error } = await sb.from('tasks').select('*').eq('user_id', me())
      .order('due_date', { ascending: true, nullsFirst: false });
    if (error || !tasks?.length) { box.innerHTML = '<p class="muted-s pad">Nenhuma prova ou tarefa registada.</p>'; return; }
    box.innerHTML = tasks.map((t) => `
      <div class="panel task-card">
        <button class="check ${t.completed ? 'done' : ''}" data-act="toggle-task" data-id="${t.id}" data-done="${t.completed ? 1 : 0}" aria-label="Concluir tarefa"></button>
        <div class="grow wrap"><h3 class="${t.completed ? 'line-through' : ''}">${esc(t.title)}</h3>
          <p>Data de Entrega / Prova: <b>${esc(t.due_date || 'Não definida')}</b></p></div>
        <button class="btn-sm btn-red big" data-act="delete-task" data-id="${t.id}">Excluir</button>
      </div>`).join('');
  }

  async function loadDashboardStats() {
    const box = $('stats'); if (!box) return;
    const { data } = await sb.from('tasks').select('completed,due_date').eq('user_id', me());
    const tasks = data || [];
    const today = localDate(), week = localDate(new Date(Date.now() + 7 * 864e5));
    const pending = tasks.filter((t) => !t.completed);
    const soon = pending.filter((t) => t.due_date && t.due_date >= today && t.due_date <= week).length;
    const stat = (n, l) => `<div class="stat"><div class="number">${n}</div><small>${l}</small></div>`;
    box.innerHTML = stat(state.subjects.length, 'Matérias') + stat(pending.length, 'Tarefas pendentes')
      + stat(tasks.length - pending.length, 'Concluídas') + stat(soon, 'Nos próximos 7 dias');
  }

  function loadDashboard() { loadSubjects().then(loadDashboardStats); loadTasks(); }

  function openQuickNote() {
    if (!state.subjects.length) { toast('Crie uma matéria primeiro.'); return; }
    openModal(`<h2 class="modal-title">Nova anotação</h2>
      <label>Matéria<select id="qnSubject">${state.subjects.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label>
      <label>Anotação<textarea id="qnText" rows="6" maxlength="5000"></textarea></label>
      <button class="primary full" data-act="save-quick-note">Salvar anotação</button>`);
  }
  async function saveQuickNote() {
    const id = $('qnSubject').value, text = $('qnText').value.trim();
    if (!text) return;
    const { data } = await sb.from('subjects').select('notes').eq('id', id).eq('user_id', me()).maybeSingle();
    const notes = ((data?.notes || '') + (data?.notes ? '\n\n' : '') + text);
    const { error } = await sb.from('subjects').update({ notes }).eq('id', id).eq('user_id', me());
    if (error) { toast('Erro: ' + error.message); return; }
    closeModal(); toast('Anotação adicionada à matéria!');
    if (state.subjectId === id) $('notes').value = notes;
  }

  async function addLink() {
    if (!state.subjectId) return;
    const title = (prompt('Título do link ou vídeo:') || '').trim().slice(0, 150);
    const url = safeUrl(prompt('URL (link do site ou vídeo):') || '');
    if (!title || !url) { toast('Informe um título e uma URL válida (http/https).'); return; }
    const isVideo = /youtube\.com|youtu\.be|vimeo\.com/i.test(url);
    const { error } = await sb.from('subject_contents').insert([
      { subject_id: state.subjectId, user_id: me(), title, type: isVideo ? 'video' : 'link', url, content: title }]);
    if (error) toast('Erro: ' + error.message); else loadSubjectContents(state.subjectId);
  }

  async function uploadSubjectFile(file) {
    if (!file || !state.subjectId) return;
    try {
      toast('A enviar arquivo...');
      const url = await uploadFile(file, 'subjects', [...IMG_TYPES, ...VID_TYPES, ...DOC_TYPES]);
      const type = file.type.startsWith('image/') ? 'image' : 'file';
      const { error } = await sb.from('subject_contents').insert([
        { subject_id: state.subjectId, user_id: me(), title: file.name.slice(0, 150), type, url, content: file.name }]);
      if (error) throw error;
      toast('Arquivo enviado com sucesso!'); loadSubjectContents(state.subjectId);
    } catch (err) { toast('Erro ao enviar arquivo: ' + err.message); }
  }

  async function loadSubjectContents(subjectId) {
    const { data: contents } = await sb.from('subject_contents').select('*').eq('subject_id', subjectId)
      .eq('user_id', me()).order('created_at', { ascending: true });
    if (state.subjectId !== subjectId) return;
    const links = (contents || []).filter((c) => c.type === 'link' || c.type === 'video');
    const files = (contents || []).filter((c) => c.type === 'file' || c.type === 'image');
    $('links').innerHTML = links.length ? links.map((l) => `
      <div class="list-row"><a class="link grow wrap" style="text-decoration:none" href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener noreferrer">🔗 ${esc(l.title)}</a>
      <button class="x-btn" data-act="delete-content" data-id="${l.id}" aria-label="Excluir">✕</button></div>`).join('')
      : '<small class="muted-s">Nenhum link adicionado.</small>';
    $('files').innerHTML = files.length ? files.map((f) => {
      const url = esc(safeUrl(f.url));
      const preview = f.type === 'image'
        ? `<div class="file-head"><span class="wrap">🖼 ${esc(f.title)}</span><a class="link" style="text-decoration:none;font-size:12px" href="${url}" target="_blank" rel="noopener noreferrer">🔍 Abrir original</a></div>
           <div class="thumb"><a href="${url}" target="_blank" rel="noopener noreferrer"><img src="${url}" alt="${esc(f.title)}" loading="lazy" decoding="async"></a></div>`
        : `<a class="link wrap" style="text-decoration:none" href="${url}" target="_blank" rel="noopener noreferrer">📄 ${esc(f.title)} (Baixar/Ver)</a>`;
      return `<div class="list-row file-preview"><div class="grow">${preview}</div><button class="x-btn" data-act="delete-content" data-id="${f.id}" aria-label="Excluir">✕</button></div>`;
    }).join('') : '<small class="muted-s">Nenhum arquivo enviado.</small>';
  }

  async function deleteContent(id) {
    if (!confirm('Deseja excluir este item?')) return;
    const { error } = await sb.from('subject_contents').delete().eq('id', id).eq('user_id', me());
    if (error) toast('Erro: ' + error.message); else if (state.subjectId) loadSubjectContents(state.subjectId);
  }

  // ============================================================
  // BOLHAS DE CHAT (grupos e DMs)
  // ============================================================
  function createBubble(msg, mine, author) {
    const div = document.createElement('div');
    div.className = 'bubble' + (mine ? ' me' : '');
    div.dataset.id = msg.id;
    const url = safeUrl(msg.media_url || '');
    let media = '';
    if (url) {
      const isVideo = msg.media_type === 'video' || /\.(mp4|webm|ogg)(\?|$)/i.test(url);
      media = isVideo
        ? `<div class="bubble-media"><video src="${esc(url)}" controls preload="metadata"></video></div>`
        : `<div class="bubble-media"><a href="${esc(url)}" target="_blank" rel="noopener noreferrer"><img src="${esc(url)}" alt="Imagem enviada" loading="lazy" decoding="async"></a></div>`;
    }
    div.innerHTML = (author ? `<div class="bubble-author">@${esc(author)}</div>` : '')
      + (msg.content ? `<div>${linkify(msg.content)}</div>` : '') + media;
    return div;
  }
  function appendBubble(container, msg, mine, author) {
    if (!container || container.querySelector(`[data-id="${msg.id}"]`)) return;
    container.querySelector('.empty')?.remove();
    container.appendChild(createBubble(msg, mine, author));
    container.scrollTop = container.scrollHeight;
  }

  // ============================================================
  // GRUPOS
  // ============================================================
  async function loadGroups() {
    dropChan('group'); state.groupId = null;
    $('groupChat').classList.add('hidden'); $('groupsList').classList.remove('hidden');
    const box = $('groupsList');
    const [g, m] = await Promise.all([
      sb.from('groups').select('id,name').order('created_at', { ascending: false }),
      sb.from('group_members').select('group_id').eq('user_id', me())
    ]);
    if (g.error) { box.innerHTML = '<p class="muted-s pad">Erro ao carregar os grupos (rode o supabase.sql).</p>'; return; }
    state.groups = g.data || [];
    state.myGroups = new Set((m.data || []).map((x) => x.group_id));
    if (!state.groups.length) { box.innerHTML = '<p class="muted-s pad">Nenhum grupo criado. Crie o primeiro acima!</p>'; return; }
    box.innerHTML = state.groups.map((gr) => `
      <div class="panel group-card" data-act="enter-group" data-id="${gr.id}">
        <div class="row"><div class="grow"><h3>👥 ${esc(gr.name)}</h3>
          <p>Clique para abrir a sala de aula / chat do grupo.</p></div>
        <button class="primary" style="padding:6px 14px;font-size:12px" data-act="enter-group" data-id="${gr.id}">Entrar no Grupo</button></div>
      </div>`).join('');
  }

  async function createGroup() {
    const name = (prompt('Nome do Grupo de Estudo:') || '').trim().slice(0, 80);
    if (!name) return;
    const { error } = await sb.from('groups').insert([{ user_id: me(), name }]);
    if (error) { toast('Erro ao criar grupo: ' + error.message); return; }
    loadGroups();
  }

  async function enterGroup(id) {
    const group = state.groups.find((g) => g.id === id); if (!group) return;
    if (!state.myGroups.has(id)) {
      const { error } = await sb.from('group_members').insert([{ group_id: id, user_id: me() }]);
      if (error) { toast('Erro ao entrar no grupo: ' + error.message); return; }
      state.myGroups.add(id);
    }
    state.groupId = id; state.groupFile = null;
    $('groupFileReady').classList.add('hidden');
    $('groupsList').classList.add('hidden'); $('groupChat').classList.remove('hidden');
    $('groupChatTitle').textContent = '👥 ' + group.name;
    const box = $('chatMessages');
    box.innerHTML = '<p class="muted-s center">A carregar mensagens...</p>';
    const { data, error } = await sb.from('group_messages').select('*, profiles:user_id(username)')
      .eq('group_id', id).order('created_at', { ascending: false }).limit(200);
    if (state.groupId !== id) return;
    if (error) { box.innerHTML = '<p class="muted-s center">Erro ao carregar mensagens.</p>'; return; }
    box.innerHTML = '';
    if (!data.length) box.innerHTML = '<p class="empty" style="margin:auto">Nenhuma mensagem neste grupo ainda. Seja o primeiro a participar!</p>';
    data.reverse().forEach((m) => appendBubble(box, m, m.user_id === me(), m.profiles?.username || 'utilizador'));
    setChan('group', sb.channel('group-' + id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${id}` },
        async (payload) => {
          const author = await usernameOf(payload.new.user_id);
          appendBubble($('chatMessages'), payload.new, payload.new.user_id === me(), author);
        }).subscribe());
  }

  async function sendGroupMessage() {
    if (!state.groupId) return;
    const input = $('chatInput');
    const content = input.value.trim();
    const file = state.groupFile;
    if (!content && !file) return;
    input.value = ''; state.groupFile = null; $('groupFileReady').classList.add('hidden');
    const { error } = await sb.from('group_messages').insert([{
      group_id: state.groupId, user_id: me(), content,
      media_url: file?.url || null, media_type: file?.type || null
    }]);
    if (error) {
      toast('Erro ao enviar mensagem: ' + error.message);
      input.value = content; state.groupFile = file; if (file) $('groupFileReady').classList.remove('hidden');
    }
  }

  async function handleGroupFile(e) {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    try {
      toast('A carregar ficheiro para a aula online...');
      const url = await uploadFile(file, 'groups', [...IMG_TYPES, ...VID_TYPES]);
      state.groupFile = { url, type: file.type.startsWith('video/') ? 'video' : 'image' };
      $('groupFileReady').classList.remove('hidden');
      toast(state.groupFile.type === 'video' ? '📹 Vídeo pronto para enviar!' : '🖼 Imagem pronta para enviar!');
    } catch (err) { toast('Erro ao enviar mídia: ' + err.message); }
  }

  // ---------- Compartilhar post ----------
  async function openShare(postId) {
    const { data } = await sb.from('group_members').select('groups(id,name)').eq('user_id', me());
    const groups = (data || []).map((x) => x.groups).filter(Boolean);
    const snippet = (postCache.get(postId)?.content || '').slice(0, 80);
    openModal(`<h2 class="modal-title">📤 Compartilhar Publicação</h2>
      <p class="muted-s" style="background:var(--field);padding:10px;border-radius:8px;border:1px solid var(--line)">"${esc(snippet)}${snippet.length >= 80 ? '...' : ''}"</p>
      <label>ENVIAR PARA GRUPO DE ESTUDOS
        <input type="text" id="groupSearchInput" placeholder="🔍 Pesquisar grupo..." autocomplete="off"></label>
      <div class="stack" style="max-height:140px;overflow-y:auto">
        ${groups.length ? groups.map((g) => `<div class="share-item" data-name="${esc(g.name.toLowerCase())}" data-act="share-group" data-group="${g.id}" data-post="${postId}" data-gname="${esc(g.name)}">
          <span>👥 ${esc(g.name)}</span><span class="share-tag">Enviar</span></div>`).join('')
          : '<p class="muted-s center">Você ainda não participa de nenhum grupo.</p>'}
      </div>
      <button class="primary full" style="margin-top:14px" data-act="copy-link" data-post="${postId}">🔗 Copiar Link da Publicação</button>`);
  }

  async function sendPostToGroup(groupId, postId, groupName) {
    const post = postCache.get(postId); if (!post) return;
    const link = `${location.origin}${location.pathname}#post-${postId}`;
    const content = `📢 [POST COMPARTILHADO]\n"${post.content.slice(0, 300)}"\n${link}`;
    const { error } = await sb.from('group_messages').insert([{
      group_id: groupId, user_id: me(), content,
      media_url: post.media_url || null, media_type: post.media_url ? 'image' : null
    }]);
    if (error) { toast('❌ Erro ao enviar post para o grupo: ' + error.message); return; }
    closeModal(); toast(`✅ Publicação enviada para o grupo "${groupName}"!`);
  }

  function copyPostLink(postId) {
    const url = `${location.origin}${location.pathname}#post-${postId}`;
    (navigator.clipboard?.writeText(url) || Promise.reject()).then(
      () => toast('🔗 Link da publicação copiado!'), () => toast('Não foi possível copiar: ' + url));
    closeModal();
  }

  // ============================================================
  // MENSAGENS PRIVADAS E CONVITES
  // ============================================================
  function openMessagesView() {
    state.dmUserId = null;
    $('dmChatBox').classList.add('hidden'); $('dmPlaceholder').classList.remove('hidden');
    refreshDmSidebar();
  }

  async function refreshDmSidebar() {
    const uid = me();
    const [acc, pend] = await Promise.all([
      sb.from('contact_requests').select('sender_id,receiver_id').eq('status', 'accepted')
        .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`),
      sb.from('contact_requests').select('id, profiles:sender_id(username)').eq('receiver_id', uid).eq('status', 'pending')
    ]);
    const friendIds = (acc.data || []).map((r) => (r.sender_id === uid ? r.receiver_id : r.sender_id));
    let friends = [];
    if (friendIds.length) {
      const { data } = await sb.from('profiles').select('id,username').in('id', friendIds);
      friends = data || [];
    }
    const pending = pend.data || [];
    $('pendingRequestsContainer').innerHTML = pending.length ? pending.map((r) => `
      <div class="person-row" style="display:block"><b>@${esc(r.profiles?.username || 'utilizador')}</b> quer conversar.
        <div style="display:flex;gap:6px;margin-top:8px">
          <button class="primary" style="flex:1;padding:4px;font-size:11px" data-act="respond-request" data-id="${r.id}" data-status="accepted">Aceitar</button>
          <button class="btn-sm btn-red" style="flex:1" data-act="respond-request" data-id="${r.id}" data-status="rejected">Recusar</button>
        </div></div>`).join('') : '<small class="muted-s">Nenhum convite pendente.</small>';
    $('friendsListContainer').innerHTML = friends.length ? friends.map((f) => `
      <div class="person-row click" data-act="open-dm" data-id="${f.id}" data-name="${esc(f.username)}"><b>@${esc(f.username)}</b></div>`).join('')
      : '<small class="muted-s">Sem contactos aceites. Pesquise alguém acima para enviar convite!</small>';
  }

  async function searchUsers() {
    const box = $('searchResultsContainer');
    const q = $('userSearchInput').value.trim().replace(/^@/, '').toLowerCase();
    if (!q) { box.innerHTML = ''; return; }
    const safe = q.replace(/[\\%_]/g, (m) => '\\' + m);
    const { data } = await sb.from('profiles').select('id,username').neq('id', me()).ilike('username', `%${safe}%`).limit(5);
    box.innerHTML = data?.length ? data.map((p) => `
      <div class="person-row click" data-act="open-profile" data-id="${p.id}"><b>@${esc(p.username)}</b>
      <span class="accent" style="font-size:11px">Ver Perfil</span></div>`).join('')
      : '<small class="muted-s">Nenhum utilizador encontrado.</small>';
  }

  async function sendContactRequest(targetId, name, resendId) {
    if (!UUID_RE.test(targetId)) return;
    if (resendId && UUID_RE.test(resendId)) await sb.from('contact_requests').delete().eq('id', resendId);
    const { error } = await sb.from('contact_requests').insert([{ sender_id: me(), receiver_id: targetId, status: 'pending' }]);
    if (error) { toast('Erro ao enviar convite: ' + error.message); return; }
    notify(targetId, 'request', 'enviou-te um convite de contacto.');
    toast(`✅ Convite de contacto enviado para @${name}!`); closeModal();
  }

  async function respondRequest(id, status, closeAfter) {
    if (!['accepted', 'rejected'].includes(status)) return;
    const { error } = await sb.from('contact_requests').update({ status }).eq('id', id).eq('receiver_id', me());
    if (error) { toast('Erro ao responder convite: ' + error.message); return; }
    if (closeAfter) closeModal();
    toast(status === 'accepted' ? 'Convite aceito!' : 'Convite recusado.');
    if (isVisible('messagesView')) refreshDmSidebar();
  }

  async function openDm(targetId, name) {
    if (!UUID_RE.test(targetId)) return;
    state.dmUserId = targetId;
    $('dmPlaceholder').classList.add('hidden'); $('dmChatBox').classList.remove('hidden');
    $('dmChatTitle').textContent = '💬 Conversa com @' + name;
    const box = $('dmMessagesList');
    box.innerHTML = '<p class="muted-s center">A carregar mensagens...</p>';
    const uid = me();
    const { data, error } = await sb.from('direct_messages').select('*')
      .or(`and(sender_id.eq.${uid},receiver_id.eq.${targetId}),and(sender_id.eq.${targetId},receiver_id.eq.${uid})`)
      .order('created_at', { ascending: false }).limit(200);
    if (state.dmUserId !== targetId) return;
    if (error) { box.innerHTML = '<p class="muted-s center">Erro ao carregar mensagens.</p>'; return; }
    box.innerHTML = '';
    if (!data.length) box.innerHTML = '<p class="empty" style="margin:auto">Nenhuma mensagem privada ainda. Comece a conversar!</p>';
    data.reverse().forEach((m) => appendBubble(box, m, m.sender_id === uid));
    setChan('dm', sb.channel(`dm-${uid}-${targetId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, (p) => {
        const m = p.new;
        if ((m.sender_id === uid && m.receiver_id === targetId) || (m.sender_id === targetId && m.receiver_id === uid)) {
          appendBubble($('dmMessagesList'), m, m.sender_id === uid);
        }
      }).subscribe());
  }

  async function sendDm() {
    if (!state.dmUserId) return;
    const input = $('dmInput');
    const content = input.value.trim(); if (!content) return;
    input.value = '';
    const { error } = await sb.from('direct_messages').insert([{ sender_id: me(), receiver_id: state.dmUserId, content }]);
    if (error) { toast('Erro ao enviar mensagem: ' + error.message); input.value = content; }
  }

  // ============================================================
  // ADMIN (a segurança real está nas policies do banco)
  // ============================================================
  function renderAdmin() {
    if (state.profile?.role !== 'admin') { toast('Acesso restrito a administradores.'); navigate('feedView'); return; }
    loadAdminStats(); loadAdminUsers(); loadAdminPosts();
  }

  async function loadAdminStats() {
    const count = (q) => q.then((r) => r.count ?? 0);
    const [u, p, po] = await Promise.all([
      count(sb.from('profiles').select('*', { count: 'exact', head: true })),
      count(sb.from('profiles').select('*', { count: 'exact', head: true }).eq('is_pro', true)),
      count(sb.from('posts').select('*', { count: 'exact', head: true }))
    ]);
    $('statUsers').textContent = u; $('statPro').textContent = p; $('statPosts').textContent = po;
  }

  async function loadAdminUsers() {
    const box = $('adminUsersList');
    const { data: profiles } = await sb.from('profiles').select('id,username,role,is_pro')
      .order('created_at', { ascending: false }).limit(100);
    if (!profiles?.length) { box.innerHTML = '<p class="muted-s">Nenhum utilizador registado.</p>'; return; }
    box.innerHTML = profiles.map((p) => {
      const role = p.role || 'user';
      return `<div class="list-row" style="flex-wrap:wrap">
        <div><b>@${esc(p.username)}</b><span class="pill ${role === 'admin' ? 'admin' : ''}">${esc(role.toUpperCase())}</span>
        <span class="pill ${p.is_pro ? 'pro' : 'free'}">${p.is_pro ? 'PRO' : 'GRÁTIS'}</span></div>
        <div style="display:flex;gap:6px">
          <button class="btn-sm ${p.is_pro ? 'btn-amber' : 'btn-green'}" data-act="admin-toggle-pro" data-id="${p.id}" data-pro="${p.is_pro ? 1 : 0}">${p.is_pro ? 'Remover PRO' : 'Tornar PRO'}</button>
          <button class="btn-sm btn-blue" data-act="admin-toggle-role" data-id="${p.id}" data-role="${role === 'admin' ? 'user' : 'admin'}">${role === 'admin' ? 'Tornar Utilizador' : 'Tornar Admin'}</button>
        </div></div>`;
    }).join('');
  }

  async function loadAdminPosts() {
    const box = $('adminPostsList');
    const { data: posts } = await sb.from('posts').select('id,content,profiles:user_id(username)')
      .order('created_at', { ascending: false }).limit(50);
    if (!posts?.length) { box.innerHTML = '<p class="muted-s">Nenhuma publicação para moderar.</p>'; return; }
    box.innerHTML = posts.map((p) => `
      <div class="list-row"><div class="grow wrap"><b class="accent">@${esc(p.profiles?.username || 'utilizador')}</b>:
      <span>${esc(p.content || '[Apenas Mídia]')}</span></div>
      <button class="btn-sm btn-red" data-act="admin-delete-post" data-id="${p.id}">Apagar</button></div>`).join('');
  }

  async function adminTogglePro(id, wasPro) {
    const { error } = await sb.from('profiles').update({ is_pro: !wasPro }).eq('id', id);
    if (error) toast('Erro: ' + error.message); else { loadAdminUsers(); loadAdminStats(); }
  }
  async function adminToggleRole(id, newRole) {
    if (!confirm(`Deseja alterar o cargo deste utilizador para ${newRole}?`)) return;
    const { error } = await sb.from('profiles').update({ role: newRole }).eq('id', id);
    if (error) toast('Erro: ' + error.message); else loadAdminUsers();
  }
  async function adminPublishBanner() {
    const message = $('adminBannerMsg').value.trim();
    const type = $('adminBannerType').value;
    if (!message) { toast('Escreva a mensagem do comunicado.'); return; }
    const off = await sb.from('global_announcements').update({ is_active: false }).eq('is_active', true);
    if (off.error) { toast('❌ Erro: ' + off.error.message); return; }
    const { error } = await sb.from('global_announcements').insert([{ message, type, is_active: true }]);
    if (error) { toast('❌ Erro ao publicar banner: ' + error.message); return; }
    $('adminBannerMsg').value = ''; toast('✅ Banner publicado com sucesso!'); loadGlobalBanner();
  }
  async function adminClearBanner() {
    const { error } = await sb.from('global_announcements').update({ is_active: false }).eq('is_active', true);
    if (error) toast('❌ Erro ao desativar banners: ' + error.message);
    else { toast('✅ Todos os banners foram desativados.'); loadGlobalBanner(); }
  }
  async function adminDeletePost(id) {
    if (!confirm('Deseja apagar esta publicação?')) return;
    const { error } = await sb.from('posts').delete().eq('id', id);
    if (error) { toast('Erro: ' + error.message); return; }
    $('post-' + id)?.remove(); loadAdminPosts(); loadAdminStats();
  }

  // ============================================================
  // REALTIME PERSISTENTE
  // ============================================================
  function setupRealtime() {
    const uid = me();
    setChan('feed', sb.channel('feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, (p) => onNewPost(p.new))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' }, (p) => $('post-' + p.old.id)?.remove())
      .subscribe());
    setChan('tasks', sb.channel('tasks-' + uid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${uid}` }, refreshTasks)
      .subscribe());
    const onReq = () => { if (isVisible('messagesView')) refreshDmSidebar(); };
    setChan('requests', sb.channel('requests-' + uid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_requests', filter: `receiver_id=eq.${uid}` }, onReq)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_requests', filter: `sender_id=eq.${uid}` }, onReq)
      .subscribe());
    setChan('notifs', sb.channel('notifs-' + uid)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, () => {
        toast('🔔 Nova notificação'); if (isVisible('notificationsView')) loadNotifications();
      }).subscribe());
    setChan('banner', sb.channel('banner')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'global_announcements' }, loadGlobalBanner)
      .subscribe());
  }

  // ============================================================
  // AÇÕES (delegação de eventos: nada de onclick inline)
  // ============================================================
  const actions = {
    'open-profile': (el) => openProfile(el.dataset.id),
    'follow-toggle': (el) => toggleFollow(el.dataset.id),
    'edit-profile': () => openEditProfile(),
    'save-profile': () => saveProfile(),
    'remove-avatar': () => clearAvatarChoice(),
    'show-followers': () => showFollowList('followers'),
    'show-following': () => showFollowList('following'),
    'scroll-posts': () => $('profilePostsGrid').scrollIntoView({ behavior: 'smooth', block: 'start' }),
    'view-my-post': (el) => openMyPost(el.dataset.id),
    'delete-my-post': (el) => deleteMyPost(el.dataset.id),
    'toggle-comments': (el) => toggleComments(el.dataset.post),
    'submit-comment': (el) => submitComment(el.dataset.post),
    'delete-comment': (el) => deleteComment(el.dataset.id, el.dataset.post),
    'share': (el) => openShare(el.dataset.post),
    'share-group': (el) => sendPostToGroup(el.dataset.group, el.dataset.post, el.dataset.gname),
    'copy-link': (el) => copyPostLink(el.dataset.post),
    'send-contact': (el) => sendContactRequest(el.dataset.id, el.dataset.name, el.dataset.resend),
    'respond-request': (el) => respondRequest(el.dataset.id, el.dataset.status, !!el.dataset.close),
    'open-dm': (el) => openDm(el.dataset.id, el.dataset.name),
    'open-dm-modal': (el) => { closeModal(); navigate('messagesView'); openDm(el.dataset.id, el.dataset.name); },
    'toggle-task': (el) => toggleTask(el.dataset.id, el.dataset.done === '1'),
    'delete-task': (el) => deleteTask(el.dataset.id),
    'delete-content': (el) => deleteContent(el.dataset.id),
    'open-subject': (el) => openSubject(el.dataset.id),
    'enter-group': (el) => enterGroup(el.dataset.id),
    'back-groups': () => loadGroups(),
    'close-banner': () => { $('systemGlobalBanner').innerHTML = ''; },
    'load-more': () => loadPosts(false),
    'save-quick-note': () => saveQuickNote(),
    'admin-toggle-pro': (el) => adminTogglePro(el.dataset.id, el.dataset.pro === '1'),
    'admin-toggle-role': (el) => adminToggleRole(el.dataset.id, el.dataset.role),
    'admin-publish-banner': () => adminPublishBanner(),
    'admin-clear-banner': () => adminClearBanner(),
    'admin-delete-post': (el) => adminDeletePost(el.dataset.id)
  };

  function setupDelegation() {
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      // botão interno de um card clicável não deve disparar o card também
      const fn = actions[el.dataset.act];
      if (fn) fn(el, e);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.classList?.contains('comment-input')) {
        e.preventDefault(); submitComment(e.target.dataset.post);
      }
      if (e.key === 'Enter' && e.target.classList?.contains('ig-tile')) {
        e.preventDefault(); openMyPost(e.target.dataset.id);
      }
    });
    document.addEventListener('input', (e) => {
      if (e.target.id === 'groupSearchInput') {
        const q = e.target.value.toLowerCase();
        document.querySelectorAll('.share-item').forEach((i) => { i.style.display = i.dataset.name.includes(q) ? 'flex' : 'none'; });
      }
    });
  }

  function bindControls() {
    $('postFileInput').addEventListener('change', async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try {
        toast('A carregar mídia para o post...');
        state.postFileUrl = await uploadFile(file, 'posts', IMG_TYPES);
        toast('Mídia pronta para publicar!');
      } catch (err) { toast('Erro ao enviar ficheiro: ' + err.message); state.postFileUrl = null; e.target.value = ''; }
    });
    $('createPostBtn').addEventListener('click', createPost);
    $('newSubjectBtn').addEventListener('click', createSubject);
    $('addSubject2').addEventListener('click', createSubject);
    $('createGroupBtn').addEventListener('click', createGroup);
    $('globalNewTaskBtn').addEventListener('click', () => createTask(null));
    $('newTaskBtn').addEventListener('click', () => createTask(state.subjectId));
    $('newTaskBtn2').addEventListener('click', () => createTask(state.subjectId));
    $('saveNoteBtn').addEventListener('click', saveNotes);
    $('deleteSubjectBtn').addEventListener('click', deleteSubject);
    $('newLinkBtn').addEventListener('click', addLink);
    $('fileInput').addEventListener('change', (e) => { uploadSubjectFile(e.target.files[0]); e.target.value = ''; });
    $('quickNoteBtn').addEventListener('click', openQuickNote);
    $('groupFileInput').addEventListener('change', handleGroupFile);
    $('chatSendBtn').addEventListener('click', sendGroupMessage);
    $('chatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); sendGroupMessage(); } });
    $('dmSendBtn').addEventListener('click', sendDm);
    $('dmInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); sendDm(); } });
    $('userSearchInput').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(searchUsers, 300); });
    $('subscribeProBtn').addEventListener('click', () =>
      toast(state.profile?.is_pro ? 'Você já é PRO. Obrigado! ⭐' : 'Os pagamentos do plano PRO chegam em breve.'));
  }

  function initApp() {
    if (state.initialized) return;
    state.initialized = true;
    bindControls();
    loadGlobalBanner();
    loadFollowing().then(() => { loadPosts(true).then(gotoPostFromHash); });
    loadSubjects(); loadTasks();
    setupRealtime();
  }

  // ---------- Arranque ----------
  document.addEventListener('DOMContentLoaded', () => {
    setupTheme(); setupAuth(); setupNavigation(); setupDelegation();
    if (!sb) { showAuth(); $('authMsg').textContent = 'Erro ao carregar o Supabase. Verifique config.js e a conexão.'; return; }
    sb.auth.onAuthStateChange((evt) => { if (evt === 'SIGNED_OUT' && state.user) location.reload(); });
    checkUser();
  });
})();

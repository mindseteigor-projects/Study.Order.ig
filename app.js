function renderPostCard(post) {
  const container = document.getElementById('postsList');
  if (!container) return;

  const existingCard = document.getElementById(`post-${post.id}`);
  if (existingCard) existingCard.remove();

  const emptyMsg = container.querySelector('p');
  if (emptyMsg && emptyMsg.textContent.includes('Nenhuma publicação')) {
    emptyMsg.remove();
  }

  const card = document.createElement('div');
  card.className = 'panel';
  card.id = `post-${post.id}`;
  card.style.marginBottom = '14px';

  let mediaRender = '';
  if (post.media_url && post.media_url.trim() !== '') {
    // Exibe a imagem de forma robusta e adiciona o link direto caso queira inspecionar
    mediaRender = `
      <div style="margin-top: 10px;">
        <img src="${post.media_url}" style="width: 100%; max-height: 450px; object-fit: cover; border-radius: 8px; display: block;" 
             onerror="this.outerHTML='<p style=\'color: #ef4444; font-size: 12px; margin-top: 5px;\'>⚠️ Erro ao carregar a imagem. URL: ${post.media_url}</p>';">
      </div>`;
  }

  const isMyPost = currentUser && post.user_id === currentUser.id;
  let deleteBtnHtml = '';
  if (isMyPost) {
    deleteBtnHtml = `<button onclick="deletePost('${post.id}')" style="background: transparent; border: none; color: #ef4444; cursor: pointer; font-size: 12px; font-weight: bold;">Excluir</button>`;
  }

  card.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
      <span style="font-weight: 600; color: var(--accent);">@${post.profiles?.username || 'utilizador'}</span>
      ${deleteBtnHtml}
    </div>
    <div style="font-size: 14px; line-height: 1.4; word-break: break-word;">${escapeHtml(post.content)}</div>
    ${mediaRender}
  `;

  container.prepend(card);
}

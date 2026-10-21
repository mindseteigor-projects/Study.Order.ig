async function loadTasks(orderBy) {
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
    
    // Tratamento amigável para exibir o lembrete escolhido
    let reminderText = '1h antes';
    if (task.reminder_time === '2h') reminderText = '2 horas antes (PRO)';
    if (task.reminder_time === '30m') reminderText = '30 minutos antes (PRO)';
    if (task.reminder_time === 'end') reminderText = 'No término exato';

    item.innerHTML = `
      <div>
        <div style="font-weight: bold; font-size: 14px; ${task.completed ? 'text-decoration: line-through; color: #a8a8a8;' : ''}">${escapeHtml(task.title)}</div>
        <small style="color: #a8a8a8;">Até ${task.due_date} às ${task.end_time} | Prioridade: ${task.priority}</small>
        <div style="font-size: 11px; color: #38bdf8; margin-top: 3px; font-weight: 500;">⏰ Lembrete ativo: Avisar ${reminderText}</div>
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

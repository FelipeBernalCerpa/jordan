const log = document.getElementById('log');
const form = document.getElementById('form');
const input = document.getElementById('input');
const sendBtn = document.getElementById('send');

let conversationId = localStorage.getItem('jordan_conversation_id') || null;

function addBubble(text, cls) {
  const el = document.createElement('div');
  el.className = `bubble ${cls}`;
  el.textContent = text;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
  return el;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const message = input.value.trim();
  if (!message) return;

  addBubble(message, 'user');
  input.value = '';
  sendBtn.disabled = true;
  const pending = addBubble('Jordan está pensando…', 'pending');

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, conversationId }),
    });
    const data = await res.json();
    pending.remove();

    if (!res.ok) {
      addBubble(`Error: ${data.error || 'algo falló'}`, 'pending');
      return;
    }

    conversationId = data.conversationId;
    localStorage.setItem('jordan_conversation_id', conversationId);

    for (const d of data.delegaciones || []) {
      addBubble(`→ ${d.empleado} resolvió: ${d.tarea}`, 'pending');
    }
    addBubble(data.reply, 'jordan');
  } catch (err) {
    pending.remove();
    addBubble(`Error de conexión: ${err.message}`, 'pending');
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
});

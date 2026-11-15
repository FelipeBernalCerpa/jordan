const form = document.getElementById('form');
const titleInput = document.getElementById('title');
const contentInput = document.getElementById('content');
const list = document.getElementById('list');
const empty = document.getElementById('empty');

function render(items) {
  list.innerHTML = '';
  empty.style.display = items.length ? 'none' : 'block';
  for (const item of items) {
    const el = document.createElement('div');
    el.className = 'item';
    el.innerHTML = `
      <div>
        <div class="title">${escapeHtml(item.title)}</div>
        <div class="content">${escapeHtml(item.content)}</div>
        <div class="meta mono">${new Date(item.created_at).toLocaleString('es-CO')}</div>
      </div>
      <button data-id="${item.id}">eliminar</button>
    `;
    list.appendChild(el);
  }
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

async function load() {
  const res = await fetch('/api/knowledge');
  const data = await res.json();
  render(data.items || []);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = titleInput.value.trim();
  const content = contentInput.value.trim();
  if (!title || !content) return;

  await fetch('/api/knowledge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content }),
  });

  titleInput.value = '';
  contentInput.value = '';
  load();
});

list.addEventListener('click', async (e) => {
  const id = e.target?.dataset?.id;
  if (!id) return;
  await fetch('/api/knowledge', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  load();
});

load();

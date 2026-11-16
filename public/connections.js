const cuentasEl = document.getElementById('cuentas');
const empty = document.getElementById('empty');
const form = document.getElementById('form');
const labelInput = document.getElementById('label');

async function load() {
  const res = await fetch('/api/auth/google-status');
  const data = await res.json();
  const cuentas = data.cuentas || [];
  cuentasEl.innerHTML = '';
  empty.style.display = cuentas.length ? 'none' : 'block';
  for (const c of cuentas) {
    const el = document.createElement('div');
    el.className = 'cuenta';
    el.innerHTML = `
      <div>
        <div class="email">${escapeHtml(c.account_email || '(sin email)')}</div>
        <div class="label">apodo: ${escapeHtml(c.label || '—')}</div>
      </div>
      <span class="green mono">● conectada</span>
    `;
    cuentasEl.appendChild(el);
  }
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const label = labelInput.value.trim();
  window.location.href = `/api/auth/google${label ? `?label=${encodeURIComponent(label)}` : ''}`;
});

load();

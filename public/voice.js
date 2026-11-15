const mic = document.getElementById('mic');
const state = document.getElementById('state');
const transcript = document.getElementById('transcript');
const core = document.getElementById('core');
const ring1 = document.getElementById('ring1');
const ring2 = document.getElementById('ring2');
const unsupported = document.getElementById('unsupported');

let conversationId = localStorage.getItem('jordan_conversation_id') || null;

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SpeechRecognition) {
  unsupported.style.display = 'block';
  mic.disabled = true;
}

let recognizing = false;
let recognition = null;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = 'es-CO';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    recognizing = true;
    mic.classList.add('listening');
    core.classList.add('active');
    ring1.classList.add('active');
    ring2.classList.add('active');
    state.textContent = 'Escuchando…';
  };

  recognition.onend = () => {
    recognizing = false;
    mic.classList.remove('listening');
    ring1.classList.remove('active');
    ring2.classList.remove('active');
  };

  recognition.onerror = (e) => {
    state.textContent = `Error de voz: ${e.error}`;
  };

  recognition.onresult = async (e) => {
    const texto = e.results[0][0].transcript;
    addBubble(texto, 'user');
    state.textContent = 'Pensando…';
    await enviarAJordan(texto);
  };
}

mic.addEventListener('click', () => {
  if (!recognition) return;
  if (recognizing) {
    recognition.stop();
    return;
  }
  recognition.start();
});

function addBubble(text, cls) {
  const el = document.createElement('div');
  el.className = `bubble ${cls}`;
  el.textContent = text;
  transcript.appendChild(el);
  transcript.scrollTop = transcript.scrollHeight;
}

function hablar(texto) {
  if (!('speechSynthesis' in window)) return;
  const utter = new SpeechSynthesisUtterance(texto);
  utter.lang = 'es-CO';
  const voces = speechSynthesis.getVoices().filter((v) => v.lang.startsWith('es'));
  if (voces.length) utter.voice = voces[0];
  core.classList.add('active');
  utter.onend = () => { core.classList.remove('active'); state.textContent = 'Toca el micrófono para hablar'; };
  speechSynthesis.speak(utter);
}

async function enviarAJordan(mensaje) {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: mensaje, conversationId }),
    });
    const data = await res.json();
    if (!res.ok) {
      state.textContent = `Error: ${data.error || 'algo falló'}`;
      return;
    }
    conversationId = data.conversationId;
    localStorage.setItem('jordan_conversation_id', conversationId);

    for (const d of data.delegaciones || []) {
      addBubble(`→ ${d.empleado} resolvió: ${d.tarea}`, 'jordan');
    }
    addBubble(data.reply, 'jordan');
    state.textContent = 'Hablando…';
    hablar(data.reply);
  } catch (err) {
    state.textContent = `Error de conexión: ${err.message}`;
  }
}

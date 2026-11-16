// Synaris (la interfaz multi-cliente) ya trae una API pública pensada
// para que un agente externo le reporte datos — de hecho su AGENTS.md
// dice literalmente: "No seed or demo data: screens show the empty
// state until the agent reports data via /api/public/ingest". Ese
// agente es Jordan. No hace falta tocar la base de datos de Synaris
// directamente: se usa su propia API con la llave de ingesta del
// cliente (negocio) correspondiente.
const BASE_URL = process.env.SYNARIS_API_URL;
const INGEST_KEY = process.env.SYNARIS_INGEST_KEY;

function requireConfig() {
  if (!BASE_URL || !INGEST_KEY) {
    throw new Error('Synaris no está conectado (faltan SYNARIS_API_URL / SYNARIS_INGEST_KEY).');
  }
}

async function ingest(body) {
  requireConfig();
  const res = await fetch(`${BASE_URL}/api/public/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-synaris-key': INGEST_KEY },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Synaris respondió ${res.status}`);
  return data;
}

async function reportarPedido({ telefono, items, total, estado, external_id }) {
  return ingest({
    type: 'order',
    data: { phone: telefono, items, total, status: estado, external_id },
  });
}

async function reportarCita({ external_id, telefono, paciente, servicio, profesional, inicia_en, estado }) {
  return ingest({
    type: 'appointment',
    data: {
      external_id,
      phone: telefono,
      patient_name: paciente,
      service: servicio,
      professional: profesional,
      starts_at: inicia_en,
      status: estado,
    },
  });
}

async function reportarMensaje({ telefono, nombre_contacto, direccion, texto }) {
  return ingest({
    type: 'message',
    data: { phone: telefono, contact_name: nombre_contacto, direction: direccion, text: texto },
  });
}

async function leerConocimiento() {
  requireConfig();
  const res = await fetch(`${BASE_URL}/api/public/knowledge`, {
    headers: { 'x-synaris-key': INGEST_KEY },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Synaris respondió ${res.status}`);
  return data.entries;
}

module.exports = { reportarPedido, reportarCita, reportarMensaje, leerConocimiento };

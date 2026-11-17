// Acceso a Ascend, tu app de salud y hábitos, vía su propio endpoint público
// construido exactamente para esto: /api/public/jordan. Jordan NUNCA tiene
// la llave maestra (service role) de la base de datos de Ascend — solo una
// clave compartida (ASCEND_API_KEY) que autentica contra ese endpoint,
// el mismo patrón que ya usamos con Midas y Synaris.
//
// Ascend guarda TODO en una sola tabla genérica `docs` (user_id, path, data
// jsonb) — no hay tablas separadas por "comidas" o "hábitos", todo vive
// como documentos JSON bajo distintos `path`. Por eso estas funciones son
// genéricas: primero se listan los paths disponibles para saber qué hay, y
// después se lee el que haga falta.
const BASE_URL = process.env.ASCEND_API_URL;
const API_KEY = process.env.ASCEND_API_KEY;

function requireConfig() {
  if (!BASE_URL || !API_KEY) {
    throw new Error('Ascend no está conectado (faltan ASCEND_API_URL / ASCEND_API_KEY).');
  }
}

async function llamar(body) {
  requireConfig();
  const res = await fetch(`${BASE_URL}/api/public/jordan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-jordan-key': API_KEY },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Ascend respondió ${res.status}`);
  return data.data;
}

async function listarDocumentos() {
  return llamar({ action: 'listar_documentos' });
}

async function leerDocumento({ path }) {
  return llamar({ action: 'leer_documento', path });
}

module.exports = { listarDocumentos, leerDocumento };

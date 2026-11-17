// Acceso a Midas (tu app de finanzas), vía su propio endpoint público
// construido exactamente para esto: /api/public/jordan. Jordan NUNCA
// tiene la llave maestra (service role) de la base de datos de Midas —
// solo una clave compartida (JORDAN_API_KEY) que autentica contra ese
// endpoint, el mismo patrón que ya usamos con Synaris.
//
// Ese endpoint, del lado de Midas, nunca inserta transacciones
// directamente: cuando un deal se gana o una factura se paga, Midas
// las crea con un trigger de base de datos. Jordan solo lee, y crea
// deals o tareas (que si disparan los triggers correctos de Midas).
const BASE_URL = process.env.MIDAS_API_URL;
const API_KEY = process.env.MIDAS_API_KEY;

function requireConfig() {
  if (!BASE_URL || !API_KEY) {
    throw new Error('Midas no está conectado (faltan MIDAS_API_URL / MIDAS_API_KEY).');
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
  if (!res.ok) throw new Error(data.error || `Midas respondió ${res.status}`);
  return data.data;
}

async function resumenFinanciero() {
  return llamar({ action: 'resumen_financiero' });
}

async function crearDeal({ titulo, valor, stage, contact_id, currency }) {
  return llamar({ action: 'crear_deal', titulo, valor, stage, contact_id: contact_id || null, currency });
}

async function crearTarea({ titulo, descripcion, vence_en, deal_id }) {
  return llamar({
    action: 'crear_tarea',
    titulo,
    descripcion: descripcion || null,
    vence_en: vence_en || null,
    deal_id: deal_id || null,
  });
}

module.exports = { resumenFinanciero, crearDeal, crearTarea };

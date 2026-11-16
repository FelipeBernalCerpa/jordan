// Acceso de solo-lectura (y escritura segura) a Midas, tu app de finanzas.
// Columnas reales verificadas en src/integrations/supabase/types.ts de Midas.
//
// IMPORTANTE (de AGENTS.md de Midas): cuando un deal se gana o una
// factura se paga, Midas inserta la transacción de ingreso con un
// trigger de base de datos. Por eso Jordan NUNCA inserta transacciones
// directamente — solo lee, y solo crea/actualiza deals, tareas o
// facturas (que sí disparan los triggers correctos de Midas).
const { createClient } = require('@supabase/supabase-js');

function getMidasClient() {
  const url = process.env.MIDAS_SUPABASE_URL;
  const key = process.env.MIDAS_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Midas no está conectado (faltan MIDAS_SUPABASE_URL / MIDAS_SUPABASE_SERVICE_ROLE_KEY).');
  }
  return createClient(url, key);
}

function userId() {
  const id = process.env.MIDAS_USER_ID;
  if (!id) throw new Error('Falta MIDAS_USER_ID (el user_id de Felipe dentro de Midas).');
  return id;
}

async function resumenFinanciero() {
  const db = getMidasClient();
  const uid = userId();

  const [cuentas, transacciones, dealsAbiertos, facturasPendientes] = await Promise.all([
    db.from('accounts').select('nombre, tipo, moneda:currency, saldo_inicial, activa').eq('user_id', uid).eq('activa', true),
    db.from('transactions').select('nota, amount, tipo, fecha').eq('user_id', uid).order('fecha', { ascending: false }).limit(10),
    db.from('deals').select('titulo, valor, stage, proxima_accion').eq('user_id', uid).not('stage', 'in', '(ganado,perdido)'),
    db.from('invoices').select('numero, amount, vence_el, status').eq('user_id', uid).neq('status', 'pagada'),
  ]);

  return {
    cuentas: cuentas.data || [],
    ultimas_transacciones: transacciones.data || [],
    deals_abiertos: dealsAbiertos.data || [],
    facturas_pendientes: facturasPendientes.data || [],
  };
}

async function crearDeal({ titulo, valor, stage, contact_id }) {
  const db = getMidasClient();
  const uid = userId();
  const { data, error } = await db
    .from('deals')
    .insert({ user_id: uid, titulo, valor, stage: stage || 'nuevo', contact_id: contact_id || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function crearTarea({ titulo, descripcion, vence_en, deal_id }) {
  const db = getMidasClient();
  const uid = userId();
  const { data, error } = await db
    .from('tasks')
    .insert({ user_id: uid, titulo, descripcion: descripcion || null, vence_en: vence_en || null, deal_id: deal_id || null, status: 'pendiente' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

module.exports = { resumenFinanciero, crearDeal, crearTarea };

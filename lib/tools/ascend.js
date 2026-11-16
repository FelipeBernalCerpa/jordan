// Acceso a Ascend, tu app de salud y hábitos. Ascend guarda TODO en una
// sola tabla genérica `docs` (user_id, path, data jsonb) — no hay tablas
// separadas por "comidas" o "hábitos", todo vive como documentos JSON
// bajo distintos `path`. Por eso estas funciones son genéricas: primero
// se listan los paths disponibles para saber qué hay, y después se lee
// el que haga falta. No adiviné la forma de cada documento porque el
// código de Ascend está minificado y no la expone con claridad — es más
// seguro que Jordan la descubra listando y leyendo en vivo.
const { createClient } = require('@supabase/supabase-js');

function getAscendClient() {
  const url = process.env.ASCEND_SUPABASE_URL;
  const key = process.env.ASCEND_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Ascend no está conectado (faltan ASCEND_SUPABASE_URL / ASCEND_SUPABASE_SERVICE_ROLE_KEY).');
  }
  return createClient(url, key);
}

function userId() {
  const id = process.env.ASCEND_USER_ID;
  if (!id) throw new Error('Falta ASCEND_USER_ID (el user_id de Felipe dentro de Ascend).');
  return id;
}

async function listarDocumentos() {
  const db = getAscendClient();
  const { data, error } = await db.from('docs').select('path, updated_at').eq('user_id', userId()).order('path');
  if (error) throw error;
  return data;
}

async function leerDocumento({ path }) {
  const db = getAscendClient();
  const { data, error } = await db.from('docs').select('data, updated_at').eq('user_id', userId()).eq('path', path).maybeSingle();
  if (error) throw error;
  if (!data) return { error: `No existe el documento "${path}". Usa listar_documentos para ver cuáles hay.` };
  return data;
}

module.exports = { listarDocumentos, leerDocumento };

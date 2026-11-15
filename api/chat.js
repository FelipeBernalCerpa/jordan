const { getSupabase } = require('../lib/supabase');
const { orquestar } = require('../lib/orchestrator');

// Búsqueda simple por palabra clave en la base de conocimiento.
// TODO (fase 2): reemplazar por búsqueda semántica con embeddings (columna `embedding` ya existe en el esquema).
async function buscarEnBaseDeConocimiento(supabase, pregunta) {
  const palabras = pregunta
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 5);
  if (palabras.length === 0) return [];

  const orFilter = palabras.map((w) => `content.ilike.%${w}%,title.ilike.%${w}%`).join(',');
  const { data, error } = await supabase
    .from('knowledge_base')
    .select('title, content')
    .or(orFilter)
    .limit(3);

  if (error) {
    console.error('Error buscando en knowledge_base:', error.message);
    return [];
  }
  return data || [];
}

async function buscarErroresPasados(supabase, pregunta) {
  const { data, error } = await supabase
    .from('error_log')
    .select('context, what_failed, lesson')
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) return [];
  return data || [];
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Usa POST' });
  }

  const { message, conversationId, userId } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Falta "message" en el body' });
  }

  try {
    const supabase = getSupabase();

    // 1. Conversación: crear si no existe
    let convoId = conversationId;
    if (!convoId) {
      const { data, error } = await supabase
        .from('conversations')
        .insert({ user_id: userId || '00000000-0000-0000-0000-000000000000', channel: 'chat' })
        .select('id')
        .single();
      if (error) throw error;
      convoId = data.id;
    }

    // 2. Guardar el mensaje del usuario
    await supabase.from('messages').insert({ conversation_id: convoId, role: 'user', content: message });

    // 3. Contexto: base de conocimiento + errores pasados relevantes
    const [conocimiento, errores] = await Promise.all([
      buscarEnBaseDeConocimiento(supabase, message),
      buscarErroresPasados(supabase, message),
    ]);

    let contexto = '';
    if (conocimiento.length) {
      contexto += '\n\nBASE DE CONOCIMIENTO RELEVANTE:\n' +
        conocimiento.map((k) => `- ${k.title}: ${k.content}`).join('\n');
    }
    if (errores.length) {
      contexto += '\n\nERRORES PASADOS A NO REPETIR:\n' +
        errores.map((e) => `- En "${e.context}" falló: ${e.what_failed}. Lección: ${e.lesson || 'sin lección registrada'}`).join('\n');
    }

    // 4. Orquestar: Jordan decide si delega a un empleado, busca en internet,
    //    o usa Calendar/Gmail de verdad — y lo ejecuta él mismo, en código.
    const efectivoUserId = userId || '00000000-0000-0000-0000-000000000000';
    const { texto, delegaciones } = await orquestar(message, contexto, efectivoUserId);

    // 5. Guardar cada delegación como su propio mensaje, y luego la respuesta final de Jordan
    for (const d of delegaciones) {
      await supabase.from('messages').insert({
        conversation_id: convoId,
        role: 'employee',
        content: `[${d.empleado}] tarea: ${d.tarea}\n\n${d.resultado}`,
      });
    }
    await supabase.from('messages').insert({ conversation_id: convoId, role: 'jordan', content: texto });

    return res.status(200).json({ conversationId: convoId, reply: texto, delegaciones });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
};

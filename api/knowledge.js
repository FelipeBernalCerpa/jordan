const { getSupabase } = require('../lib/supabase');

// CRUD mínimo de la base de conocimiento: esto es lo que hace real la
// frase "Felipe agrega cosas y Jordan las usa" — sin esto, era solo una
// tabla vacía en el esquema.
module.exports = async function handler(req, res) {
  const supabase = getSupabase();

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('knowledge_base')
      .select('id, title, content, source, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ items: data });
  }

  if (req.method === 'POST') {
    const { title, content, source } = req.body || {};
    if (!title || !content) {
      return res.status(400).json({ error: 'Faltan "title" y/o "content"' });
    }
    const { data, error } = await supabase
      .from('knowledge_base')
      .insert({ title, content, source: source || 'manual' })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ item: data });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'Falta "id"' });
    const { error } = await supabase.from('knowledge_base').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Método no soportado' });
};

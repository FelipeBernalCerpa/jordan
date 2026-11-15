const { getSupabase } = require('../lib/supabase');
const { EMPLOYEES } = require('../lib/employees');

// Estado real de los empleados: catálogo fijo en código + su última
// actividad real sacada de los mensajes que el orquestador ya guarda
// cuando delega. Esto es lo que alimentaría la Oficina Virtual (el
// diseño del canvas) con datos reales en vez de inventados.
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no soportado' });

  try {
    const supabase = getSupabase();
    const { data: ultimos, error } = await supabase
      .from('messages')
      .select('content, created_at')
      .eq('role', 'employee')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    const estado = Object.values(EMPLOYEES).map((emp) => {
      const ultimo = (ultimos || []).find((m) => m.content.startsWith(`[${emp.slug}]`));
      return {
        slug: emp.slug,
        nombre: emp.name,
        activo: !!ultimo,
        ultima_actividad: ultimo ? ultimo.created_at : null,
        ultimo_resumen: ultimo ? ultimo.content.split('\n\n')[1]?.slice(0, 160) : null,
      };
    });

    return res.status(200).json({ empleados: estado });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
};

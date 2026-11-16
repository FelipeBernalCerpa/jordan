// Jordan como orquestador real: decide si una tarea es de un empleado
// y lo invoca él mismo (otra llamada a Claude con la personalidad de ese
// empleado), en código — no hay ningún repo ni servicio externo por
// empleado. Esto es tool-use nativo de Claude: Jordan "llama" a la
// herramienta `delegar_tarea`, el código ejecuta al empleado, y el
// resultado vuelve a Jordan para que dé la respuesta final.

const Anthropic = require('@anthropic-ai/sdk');
const { JORDAN_SYSTEM_PROMPT } = require('./jordan-persona');
const { EMPLOYEES, getEmployee } = require('./employees');
const calendarTools = require('./tools/calendar');
const gmailTools = require('./tools/gmail');
const driveTools = require('./tools/drive');
const youtubeTools = require('./tools/youtube');
const midasTools = require('./tools/midas');
const ascendTools = require('./tools/ascend');
const synarisTools = require('./tools/synaris');

// Se agrega a cada herramienta de Google que lo necesite, para cuando
// Felipe tenga más de una cuenta conectada (ej. Gmail personal y de negocio).
const campoCuenta = {
  cuenta: {
    type: 'string',
    description:
      'Opcional. El email o apodo de la cuenta de Google a usar, solo si Felipe tiene más de una conectada.',
  },
};

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-5';

// Búsqueda web real: este tipo de herramienta la ejecuta Anthropic del
// lado del servidor — Jordan de verdad busca en internet cuando lo
// necesita, sin que este código tenga que hacer ninguna llamada aparte.
const webSearchTool = {
  type: 'web_search_20250305',
  name: 'web_search',
  max_uses: 3,
};

const delegarTool = {
  name: 'delegar_tarea',
  description:
    'Delega una tarea a uno de los empleados especializados cuando la tarea es claramente de su área. ' +
    'No la uses para preguntas generales o de conversación — solo cuando el empleado realmente agregue valor.',
  input_schema: {
    type: 'object',
    properties: {
      empleado: {
        type: 'string',
        enum: Object.keys(EMPLOYEES),
        description: 'Slug del empleado al que se delega la tarea.',
      },
      tarea: {
        type: 'string',
        description: 'La tarea específica que debe resolver el empleado, en sus propias palabras.',
      },
    },
    required: ['empleado', 'tarea'],
  },
};

// Acceso real a Google Calendar y Gmail de Felipe. Estas herramientas
// solo funcionan una vez Felipe conecta su cuenta en /api/auth/google —
// si no, devuelven un mensaje claro en vez de reventar.
const googleTools = [
  {
    name: 'calendar_listar_eventos',
    description: 'Lista los próximos eventos del calendario de Google de Felipe.',
    input_schema: {
      type: 'object',
      properties: {
        desde: { type: 'string', description: 'ISO date desde cuándo buscar (opcional, default ahora)' },
        hasta: { type: 'string', description: 'ISO date hasta cuándo buscar (opcional)' },
      },
    },
  },
  {
    name: 'calendar_crear_evento',
    description: 'Crea un evento en el calendario de Google de Felipe.',
    input_schema: {
      type: 'object',
      properties: {
        titulo: { type: 'string' },
        inicio: { type: 'string', description: 'ISO datetime de inicio' },
        fin: { type: 'string', description: 'ISO datetime de fin' },
        descripcion: { type: 'string' },
      },
      required: ['titulo', 'inicio', 'fin'],
    },
  },
  {
    name: 'gmail_buscar',
    description: 'Busca correos en el Gmail de Felipe (sintaxis de búsqueda de Gmail, ej. "from:cliente@x.com").',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        max: { type: 'number', description: 'máximo de resultados, default 10' },
      },
      required: ['query'],
    },
  },
  {
    name: 'gmail_enviar',
    description: 'Envía un correo desde el Gmail de Felipe.',
    input_schema: {
      type: 'object',
      properties: {
        para: { type: 'string' },
        asunto: { type: 'string' },
        cuerpo: { type: 'string' },
        ...campoCuenta,
      },
      required: ['para', 'asunto', 'cuerpo'],
    },
  },
  {
    name: 'drive_buscar_archivos',
    description: 'Busca archivos en el Google Drive de Felipe por nombre.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Texto a buscar en el nombre del archivo' },
        max: { type: 'number' },
        ...campoCuenta,
      },
    },
  },
  {
    name: 'youtube_mis_videos',
    description: 'Lista los videos más recientes del canal de YouTube de Felipe, con suscriptores y vistas totales.',
    input_schema: {
      type: 'object',
      properties: { max: { type: 'number' }, ...campoCuenta },
    },
  },
  {
    name: 'youtube_estadisticas_video',
    description: 'Da las estadísticas (vistas, likes, comentarios) de un video específico de YouTube.',
    input_schema: {
      type: 'object',
      properties: { videoId: { type: 'string' }, ...campoCuenta },
      required: ['videoId'],
    },
  },
];

// Herramientas de Midas (la app de finanzas de Felipe). Acceso real a
// Supabase de Midas vía service-role key — nunca se inserta directo en
// `transactions`, eso lo controlan los triggers propios de Midas.
const midasToolDefs = [
  {
    name: 'midas_resumen_financiero',
    description: 'Da un resumen financiero real de Midas: cuentas, saldos, deals abiertos y facturas pendientes.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'midas_crear_deal',
    description: 'Crea un nuevo deal (negocio/oportunidad) en Midas.',
    input_schema: {
      type: 'object',
      properties: {
        titulo: { type: 'string' },
        valor: { type: 'number' },
        stage: { type: 'string', description: 'Etapa del deal, ej. "prospecto", "negociacion", "ganado"' },
        contact_id: { type: 'string', description: 'Opcional, id del contacto asociado' },
      },
      required: ['titulo', 'valor', 'stage'],
    },
  },
  {
    name: 'midas_crear_tarea',
    description: 'Crea una tarea en Midas, opcionalmente asociada a un deal.',
    input_schema: {
      type: 'object',
      properties: {
        titulo: { type: 'string' },
        descripcion: { type: 'string' },
        vence_en: { type: 'string', description: 'ISO date de vencimiento' },
        deal_id: { type: 'string', description: 'Opcional' },
      },
      required: ['titulo'],
    },
  },
];

// Herramientas de Ascend (la app de hábitos/salud de Felipe). Lectura
// genérica sobre la tabla `docs` — todavía no se escribe ahí hasta
// confirmar con más certeza el formato de cada path.
const ascendToolDefs = [
  {
    name: 'ascend_listar_documentos',
    description: 'Lista los documentos/paths disponibles de Felipe en Ascend (hábitos, salud, etc.), con su última actualización.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'ascend_leer_documento',
    description: 'Lee el contenido de un documento/path específico de Ascend, ej. "habits/sleep" o el que se vea en ascend_listar_documentos.',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path'],
    },
  },
];

// Herramientas de Synaris (la interfaz multi-cliente de Felipe). Usa la
// API pública de Synaris diseñada para que un agente externo reporte
// datos — nunca se toca su base de datos directamente.
const synarisToolDefs = [
  {
    name: 'synaris_reportar_pedido',
    description: 'Reporta un pedido/orden a Synaris para un cliente de Felipe.',
    input_schema: {
      type: 'object',
      properties: {
        telefono: { type: 'string' },
        items: { type: 'array', items: { type: 'object' } },
        total: { type: 'number' },
        estado: { type: 'string' },
        external_id: { type: 'string' },
      },
      required: ['telefono', 'items', 'total', 'estado'],
    },
  },
  {
    name: 'synaris_reportar_cita',
    description: 'Reporta una cita/appointment a Synaris.',
    input_schema: {
      type: 'object',
      properties: {
        external_id: { type: 'string' },
        telefono: { type: 'string' },
        paciente: { type: 'string' },
        servicio: { type: 'string' },
        profesional: { type: 'string' },
        inicia_en: { type: 'string', description: 'ISO datetime' },
        estado: { type: 'string' },
      },
      required: ['external_id', 'telefono', 'inicia_en', 'estado'],
    },
  },
  {
    name: 'synaris_reportar_mensaje',
    description: 'Reporta un mensaje entrante/saliente de un cliente a Synaris.',
    input_schema: {
      type: 'object',
      properties: {
        telefono: { type: 'string' },
        nombre_contacto: { type: 'string' },
        direccion: { type: 'string', description: '"in" o "out"' },
        texto: { type: 'string' },
      },
      required: ['telefono', 'direccion', 'texto'],
    },
  },
  {
    name: 'synaris_leer_conocimiento',
    description: 'Lee la base de conocimiento configurada en Synaris.',
    input_schema: { type: 'object', properties: {} },
  },
];

async function ejecutarHerramientaMidas(nombre, input) {
  try {
    switch (nombre) {
      case 'midas_resumen_financiero':
        return JSON.stringify(await midasTools.resumenFinanciero());
      case 'midas_crear_deal':
        return JSON.stringify(await midasTools.crearDeal(input));
      case 'midas_crear_tarea':
        return JSON.stringify(await midasTools.crearTarea(input));
      default:
        return `Herramienta desconocida: ${nombre}`;
    }
  } catch (err) {
    return `No se pudo ejecutar ${nombre} en Midas: ${err.message}`;
  }
}

async function ejecutarHerramientaAscend(nombre, input) {
  try {
    switch (nombre) {
      case 'ascend_listar_documentos':
        return JSON.stringify(await ascendTools.listarDocumentos());
      case 'ascend_leer_documento':
        return JSON.stringify(await ascendTools.leerDocumento(input));
      default:
        return `Herramienta desconocida: ${nombre}`;
    }
  } catch (err) {
    return `No se pudo ejecutar ${nombre} en Ascend: ${err.message}`;
  }
}

async function ejecutarHerramientaSynaris(nombre, input) {
  try {
    switch (nombre) {
      case 'synaris_reportar_pedido':
        return JSON.stringify(await synarisTools.reportarPedido(input));
      case 'synaris_reportar_cita':
        return JSON.stringify(await synarisTools.reportarCita(input));
      case 'synaris_reportar_mensaje':
        return JSON.stringify(await synarisTools.reportarMensaje(input));
      case 'synaris_leer_conocimiento':
        return JSON.stringify(await synarisTools.leerConocimiento());
      default:
        return `Herramienta desconocida: ${nombre}`;
    }
  } catch (err) {
    return `No se pudo ejecutar ${nombre} en Synaris: ${err.message}`;
  }
}

async function ejecutarHerramientaGoogle(userId, nombre, input) {
  const { cuenta, ...resto } = input || {};
  try {
    switch (nombre) {
      case 'calendar_listar_eventos':
        return JSON.stringify(await calendarTools.listarEventos(userId, resto, cuenta));
      case 'calendar_crear_evento':
        return JSON.stringify(await calendarTools.crearEvento(userId, resto, cuenta));
      case 'gmail_buscar':
        return JSON.stringify(await gmailTools.buscarCorreos(userId, resto, cuenta));
      case 'gmail_enviar':
        return JSON.stringify(await gmailTools.enviarCorreo(userId, resto, cuenta));
      case 'drive_buscar_archivos':
        return JSON.stringify(await driveTools.buscarArchivos(userId, resto, cuenta));
      case 'youtube_mis_videos':
        return JSON.stringify(await youtubeTools.misVideos(userId, resto, cuenta));
      case 'youtube_estadisticas_video':
        return JSON.stringify(await youtubeTools.estadisticasVideo(userId, resto, cuenta));
      default:
        return `Herramienta desconocida: ${nombre}`;
    }
  } catch (err) {
    return `No se pudo ejecutar ${nombre}: ${err.message}`;
  }
}

// Ejecuta a un empleado: es, en sí mismo, otra llamada a Claude con su
// propia personalidad. Esto es "crear el agente" en tiempo de ejecución.
async function ejecutarEmpleado(slug, tarea) {
  const empleado = getEmployee(slug);
  if (!empleado) {
    return { ok: false, texto: `No existe un empleado "${slug}".` };
  }
  const respuesta = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 700,
    system: empleado.systemPrompt,
    messages: [{ role: 'user', content: tarea }],
  });
  const texto = respuesta.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
  return { ok: true, texto, empleado };
}

// Orquesta una pregunta/tarea del usuario:
// 1. Jordan ve el mensaje con la herramienta `delegar_tarea` disponible.
// 2. Si decide delegar, el código ejecuta al empleado y le devuelve el resultado a Jordan.
// 3. Jordan da la respuesta final (ya sabiendo qué hizo el empleado).
// Devuelve { texto, delegaciones: [{empleado, tarea, resultado}] } para persistir todo.
async function orquestar(mensajeUsuario, contextoExtra, userId) {
  const system = JORDAN_SYSTEM_PROMPT + (contextoExtra || '');
  const mensajes = [{ role: 'user', content: mensajeUsuario }];
  const delegaciones = [];
  const tools = [
    delegarTool,
    webSearchTool,
    ...googleTools,
    ...midasToolDefs,
    ...ascendToolDefs,
    ...synarisToolDefs,
  ];

  let respuesta = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system,
    tools,
    messages: mensajes,
  });

  // Mientras Jordan siga pidiendo delegar o usar una herramienta, lo seguimos resolviendo.
  let vueltas = 0;
  while (respuesta.stop_reason === 'tool_use' && vueltas < 4) {
    vueltas += 1;
    mensajes.push({ role: 'assistant', content: respuesta.content });

    const toolUses = respuesta.content.filter((b) => b.type === 'tool_use');
    const toolResults = [];

    for (const toolUse of toolUses) {
      if (toolUse.name === 'delegar_tarea') {
        const { empleado: slug, tarea } = toolUse.input;
        const resultado = await ejecutarEmpleado(slug, tarea);
        delegaciones.push({ empleado: slug, tarea, resultado: resultado.texto });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: resultado.ok
            ? `Resultado de ${resultado.empleado.name}: ${resultado.texto}`
            : resultado.texto,
        });
      } else if (googleTools.some((t) => t.name === toolUse.name)) {
        const resultado = await ejecutarHerramientaGoogle(userId, toolUse.name, toolUse.input);
        toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: resultado });
      } else if (midasToolDefs.some((t) => t.name === toolUse.name)) {
        const resultado = await ejecutarHerramientaMidas(toolUse.name, toolUse.input);
        toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: resultado });
      } else if (ascendToolDefs.some((t) => t.name === toolUse.name)) {
        const resultado = await ejecutarHerramientaAscend(toolUse.name, toolUse.input);
        toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: resultado });
      } else if (synarisToolDefs.some((t) => t.name === toolUse.name)) {
        const resultado = await ejecutarHerramientaSynaris(toolUse.name, toolUse.input);
        toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: resultado });
      }
    }

    mensajes.push({ role: 'user', content: toolResults });

    respuesta = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system,
      tools,
      messages: mensajes,
    });
  }

  const texto = respuesta.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  return { texto, delegaciones };
}

module.exports = { orquestar };

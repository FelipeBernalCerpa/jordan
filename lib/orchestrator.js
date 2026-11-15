// Jordan como orquestador real: decide si una tarea es de un empleado
// y lo invoca él mismo (otra llamada a Claude con la personalidad de ese
// empleado), en código — no hay ningún repo ni servicio externo por
// empleado. Esto es tool-use nativo de Claude: Jordan "llama" a la
// herramienta `delegar_tarea`, el código ejecuta al empleado, y el
// resultado vuelve a Jordan para que dé la respuesta final.

const Anthropic = require('@anthropic-ai/sdk');
const { JORDAN_SYSTEM_PROMPT } = require('./jordan-persona');
const { EMPLOYEES, getEmployee } = require('./employees');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-5';

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
async function orquestar(mensajeUsuario, contextoExtra) {
  const system = JORDAN_SYSTEM_PROMPT + (contextoExtra || '');
  const mensajes = [{ role: 'user', content: mensajeUsuario }];
  const delegaciones = [];

  let respuesta = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system,
    tools: [delegarTool],
    messages: mensajes,
  });

  // Mientras Jordan siga pidiendo delegar, lo seguimos resolviendo.
  let vueltas = 0;
  while (respuesta.stop_reason === 'tool_use' && vueltas < 3) {
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
      }
    }

    mensajes.push({ role: 'user', content: toolResults });

    respuesta = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system,
      tools: [delegarTool],
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

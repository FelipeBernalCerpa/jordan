# Jordan

Orquestador de IA tipo Jarvis para el ecosistema Synaris/Ascend de Felipe. Fase 1: chat básico con la personalidad de Jordan, conectado a una base de datos real (Supabase), con una base de conocimiento consultable y un registro de errores pasados.

## Qué incluye esta primera versión

- `lib/jordan-persona.js` — el system prompt con la personalidad de Jordan (socio de negocios implacable, directo, informa en vez de pedir permiso de más).
- `lib/employees.js` — el catálogo de empleados especializados (Código, Comercial, Financiero, Contenido, Voz), cada uno con su propia personalidad.
- `lib/orchestrator.js` — **Jordan crea y coordina a los empleados en código, en tiempo real**: usa tool-use nativo de Claude para decidir si una tarea es de un empleado, lo invoca (otra llamada a Claude con la personalidad de ese empleado) y vuelve con la respuesta final ya conociendo el resultado. No hay repos ni servicios separados por empleado — todo vive en este mismo proyecto.
- `supabase/schema.sql` — esquema de base de datos: `conversations`, `messages`, `knowledge_base`, `error_log`, `employees`.
- `api/chat.js` — endpoint serverless (Vercel) que recibe un mensaje, consulta la base de conocimiento y los errores pasados, orquesta la respuesta (Jordan + empleados si corresponde), y guarda todo en Supabase.
- `public/` — pantalla de chat mínima, mismo lenguaje visual oscuro/premium que el resto del diseño. Si Jordan delegó algo, se ve como un paso intermedio antes de su respuesta final.

- `api/knowledge.js` + `public/knowledge.html` — pantalla para agregar, ver y borrar entradas de la base de conocimiento de verdad (antes la tabla existía pero no había forma de alimentarla).
- `public/voice.html` — modo de voz real: usa el reconocimiento y la síntesis de voz nativos del navegador (Web Speech API, sin necesitar ninguna llave de terceros), conectado al mismo `/api/chat`. Funciona en Chrome de escritorio/Android; en navegadores sin soporte muestra un aviso y redirige al chat de texto.
- **Acceso real a Google Calendar y Gmail**: `lib/google-auth.js` maneja el OAuth, `lib/tools/calendar.js` y `lib/tools/gmail.js` son las funciones reales (crear/listar eventos, buscar/enviar correos), y `lib/orchestrator.js` se las da a Jordan como herramientas que puede ejecutar de verdad — no solo mencionar. `/api/auth/google` inicia la conexión (botón "conectar Google" en la pantalla principal).

Lo que **no** está en esta versión (próximos pasos): búsqueda semántica real en la base de conocimiento (hoy es un match por palabra clave) y el despliegue en Vercel (bloqueado por permisos de la cuenta — ver conversación).

## Cómo levantarlo

1. **Crea un proyecto en Supabase** (supabase.com) y corre el contenido de `supabase/schema.sql` en el SQL editor.
2. **Copia `.env.example` a `.env.local`** y rellena:
   - `ANTHROPIC_API_KEY` — tu llave de la API de Claude.
   - `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` — del panel de tu proyecto en Supabase (Settings → API).
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` — solo si quieres que Jordan use Calendar/Gmail de verdad. Se crean en [console.cloud.google.com](https://console.cloud.google.com) → "APIs & Services" → "Credentials" → "Create Credentials" → "OAuth client ID" → tipo "Web application". Habilita también la Calendar API y la Gmail API en "APIs & Services" → "Library". El redirect URI debe coincidir exactamente con `GOOGLE_REDIRECT_URI`.
3. **Instala dependencias**: `npm install`
4. **Corre localmente**: `npx vercel dev` (necesita la CLI de Vercel; si no la tienes, `npm i -g vercel` primero).
5. Abre `http://localhost:3000` y escríbele a Jordan. Para conectar Google, entra a `/api/auth/google`.

## Desplegar

```
vercel
```

Y agrega las mismas variables de entorno en el panel de Vercel → Settings → Environment Variables (y actualiza `GOOGLE_REDIRECT_URI` a la URL real de producción, ej. `https://jordan-tuusuario.vercel.app/api/auth/google-callback`, y regístrala también en Google Cloud Console).

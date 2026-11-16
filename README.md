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
- **Acceso real a Google Calendar, Gmail, Drive y YouTube — con soporte para más de una cuenta de Google**: `lib/google-auth.js` maneja el OAuth (Calendar, Gmail, Drive, YouTube) y permite conectar varias cuentas (ej. Gmail personal y de negocio, cada una con un apodo). `lib/tools/calendar.js`, `lib/tools/gmail.js`, `lib/tools/drive.js` y `lib/tools/youtube.js` son las funciones reales, y `lib/orchestrator.js` se las da a Jordan como herramientas que puede ejecutar de verdad. `/connections.html` muestra qué cuentas están conectadas y deja agregar otra; `/api/auth/google-status` lo sirve en JSON.

- **Conectado a las otras apps de Felipe (Midas, Ascend, Synaris)**: `lib/tools/midas.js`, `lib/tools/ascend.js` y `lib/tools/synaris.js` son las integraciones reales, dadas a Jordan como herramientas en `lib/orchestrator.js`. Cada una usa la puerta que su propia app ya tiene pensada:
  - **Midas** (finanzas): acceso directo a su Supabase con una service-role key propia — resumen financiero real (cuentas, deals, facturas), y puede crear deals y tareas. Nunca inserta directo en `transactions`: esas las crean los triggers propios de Midas al ganar un deal o pagar una factura.
  - **Ascend** (hábitos/salud): acceso directo a su Supabase (tabla genérica `docs`) — por ahora solo lectura (listar y leer documentos por `path`). No escribe todavía: el formato exacto de cada path no se puede inferir con certeza del bundle minificado de la app, así que se deja para una siguiente iteración antes de arriesgar los datos reales de salud de Felipe.
  - **Synaris** (interfaz de clientes): no toca su base de datos — usa la API pública que Synaris ya expone para esto (`/api/public/ingest` y `/api/public/knowledge`, autenticada con una `x-synaris-key`). Puede reportar pedidos, citas y mensajes, y leer su base de conocimiento.
  Cada una requiere sus propias credenciales (ver `.env.example`); si faltan, Jordan lo dice directo en vez de fingir que la herramienta funcionó.

Lo que **no** está en esta versión (próximos pasos): búsqueda semántica real en la base de conocimiento (hoy es un match por palabra clave); escritura en Ascend; y que Midas/Ascend/Synaris muestren en SUS PROPIAS pantallas el estado de lo que Jordan hizo (eso requiere editar esos tres repos por separado, no solo este).

## Cómo levantarlo

1. **Crea un proyecto en Supabase** (supabase.com) y corre el contenido de `supabase/schema.sql` en el SQL editor.
2. **Copia `.env.example` a `.env.local`** y rellena:
   - `ANTHROPIC_API_KEY` — tu llave de la API de Claude.
   - `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` — del panel de tu proyecto en Supabase (Settings → API).
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` — solo si quieres que Jordan use Calendar/Gmail de verdad. Se crean en [console.cloud.google.com](https://console.cloud.google.com) → "APIs & Services" → "Credentials" → "Create Credentials" → "OAuth client ID" → tipo "Web application". Habilita también la Calendar API y la Gmail API en "APIs & Services" → "Library". El redirect URI debe coincidir exactamente con `GOOGLE_REDIRECT_URI`.
   - `MIDAS_SUPABASE_URL` / `MIDAS_SUPABASE_SERVICE_ROLE_KEY` / `MIDAS_USER_ID` — solo si quieres que Jordan vea y modifique datos reales de Midas. La URL y la key salen del panel del proyecto Supabase DE MIDAS (Settings → API → service_role, no la de Jordan). El `MIDAS_USER_ID` es tu propio id de usuario dentro de la base de datos de Midas.
   - `ASCEND_SUPABASE_URL` / `ASCEND_SUPABASE_SERVICE_ROLE_KEY` / `ASCEND_USER_ID` — igual que Midas pero con el proyecto Supabase DE ASCEND.
   - `SYNARIS_API_URL` / `SYNARIS_INGEST_KEY` — la URL pública donde corre Synaris en producción, y la ingest key de tu cliente/negocio ahí (se genera dentro del propio panel de Synaris).
3. **Instala dependencias**: `npm install`
4. **Corre localmente**: `npx vercel dev` (necesita la CLI de Vercel; si no la tienes, `npm i -g vercel` primero).
5. Abre `http://localhost:3000` y escríbele a Jordan. Para conectar Google, entra a `/api/auth/google`.

## Desplegar

```
vercel
```

Y agrega las mismas variables de entorno en el panel de Vercel → Settings → Environment Variables (y actualiza `GOOGLE_REDIRECT_URI` a la URL real de producción, ej. `https://jordan-tuusuario.vercel.app/api/auth/google-callback`, y regístrala también en Google Cloud Console).

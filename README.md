# Jordan

Orquestador de IA tipo Jarvis para el ecosistema Synaris/Ascend de Felipe. Fase 1: chat básico con la personalidad de Jordan, conectado a una base de datos real (Supabase), con una base de conocimiento consultable y un registro de errores pasados.

## Qué incluye esta primera versión

- `lib/jordan-persona.js` — el system prompt con la personalidad de Jordan (socio de negocios implacable, directo, informa en vez de pedir permiso de más).
- `supabase/schema.sql` — esquema de base de datos: `conversations`, `messages`, `knowledge_base`, `error_log`, `employees`.
- `api/chat.js` — endpoint serverless (Vercel) que recibe un mensaje, consulta la base de conocimiento y los errores pasados, llama a Claude con la personalidad de Jordan, y guarda todo en Supabase.
- `public/` — pantalla de chat mínima, mismo lenguaje visual oscuro/premium que el resto del diseño (fondo oscuro, acento azul, tipografía Space Grotesk/Inter/JetBrains Mono).

Lo que **no** está en esta versión (próximos pasos): búsqueda semántica real en la base de conocimiento (hoy es un match por palabra clave), el modo de voz, y que Jordan efectivamente delegue tareas a los empleados especializados.

## Cómo levantarlo

1. **Crea un proyecto en Supabase** (supabase.com) y corre el contenido de `supabase/schema.sql` en el SQL editor.
2. **Copia `.env.example` a `.env.local`** y rellena:
   - `ANTHROPIC_API_KEY` — tu llave de la API de Claude.
   - `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` — del panel de tu proyecto en Supabase (Settings → API).
3. **Instala dependencias**: `npm install`
4. **Corre localmente**: `npx vercel dev` (necesita la CLI de Vercel; si no la tienes, `npm i -g vercel` primero).
5. Abre `http://localhost:3000` y escríbele a Jordan.

## Desplegar

```
vercel
```

Y agrega las mismas variables de entorno (`ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) en el panel de Vercel → Settings → Environment Variables.

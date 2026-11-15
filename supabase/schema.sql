-- Esquema inicial de Jordan
-- Ejecutar en el SQL editor de Supabase (o vía `supabase db push`)

create extension if not exists "pgcrypto";
create extension if not exists "vector"; -- para búsqueda semántica en la base de conocimiento

-- Empleados (Código, Comercial, Financiero, Contenido, Voz, ...)
create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,          -- 'codigo', 'comercial', 'financiero', 'contenido', 'voz'
  name text not null,
  status text not null default 'activo' check (status in ('activo','en_espera','pausado')),
  created_at timestamptz not null default now()
);

-- Conversaciones (una por hilo de chat o sesión de voz)
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,              -- referencia al usuario (Felipe) en tu sistema de auth
  channel text not null default 'chat' check (channel in ('chat','voz')),
  title text,
  created_at timestamptz not null default now()
);

-- Mensajes dentro de una conversación
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user','jordan','employee')),
  employee_id uuid references employees(id),
  content text not null,
  created_at timestamptz not null default now()
);

-- Base de conocimiento: lo que Felipe va agregando para que Jordan lo use como referencia
create table if not exists knowledge_base (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  source text,                         -- de dónde vino (manual, documento, decisión, etc.)
  embedding vector(1536),              -- para búsqueda semántica (ajustar dimensión según el modelo de embeddings)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Registro de errores pasados, para que Jordan aprenda y no los repita
create table if not exists error_log (
  id uuid primary key default gen_random_uuid(),
  context text not null,               -- qué se intentaba hacer
  what_failed text not null,           -- qué salió mal
  lesson text,                         -- qué se debe hacer distinto la próxima vez
  conversation_id uuid references conversations(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_conversation on messages(conversation_id, created_at);
create index if not exists idx_knowledge_base_updated on knowledge_base(updated_at desc);

-- Conexiones reales a apps externas (Google Calendar, Gmail, ...).
-- Un registro por proveedor por usuario. Los tokens quedan acá para que
-- las funciones de los empleados puedan actuar de verdad en esas apps.
create table if not exists integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  provider text not null check (provider in ('google')),
  access_token text not null,
  refresh_token text,
  scope text,
  expiry_date bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

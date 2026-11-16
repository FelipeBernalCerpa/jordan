// OAuth con Google — con soporte para MÁS DE UNA cuenta de Google por
// usuario (ej: Gmail personal y Gmail de negocio) y para los scopes de
// Calendar, Gmail, Drive y YouTube.
const { google } = require('googleapis');
const { getSupabase } = require('./supabase');

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.force-ssl',
  'https://www.googleapis.com/auth/userinfo.email',
];

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// `label` es el apodo que tú le pones a esta cuenta (ej. "personal", "negocio").
// Viaja en el `state` del OAuth para que el callback sepa cómo guardarla.
function getAuthUrl(userId, label) {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state: JSON.stringify({ userId, label: label || null }),
  });
}

async function obtenerEmailDeLaCuenta(client) {
  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const { data } = await oauth2.userinfo.get();
  return data.email;
}

async function guardarTokens(userId, label, tokens) {
  const client = getOAuthClient();
  client.setCredentials(tokens);
  const email = await obtenerEmailDeLaCuenta(client);

  const supabase = getSupabase();
  await supabase.from('integrations').upsert(
    {
      user_id: userId,
      provider: 'google',
      account_email: email,
      label: label || email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token, // ojo: solo viene la primera vez (prompt=consent)
      scope: tokens.scope,
      expiry_date: tokens.expiry_date,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,provider,account_email' }
  );
  return email;
}

async function listarCuentasConectadas(userId) {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('integrations')
    .select('account_email, label, updated_at')
    .eq('user_id', userId)
    .eq('provider', 'google');
  return data || [];
}

// Devuelve un cliente de Google autenticado para una cuenta específica
// (por email o label). Si no se especifica y solo hay una conectada, usa esa.
async function getAuthorizedClient(userId, cuenta) {
  const supabase = getSupabase();
  let query = supabase.from('integrations').select('*').eq('user_id', userId).eq('provider', 'google');

  if (cuenta) {
    query = query.or(`account_email.eq.${cuenta},label.eq.${cuenta}`);
  }

  const { data, error } = await query;
  if (error || !data || data.length === 0) {
    throw new Error(
      'Google no está conectado todavía (o no con esa cuenta). Conéctalo en /api/auth/google.'
    );
  }
  if (data.length > 1 && !cuenta) {
    throw new Error(
      `Hay ${data.length} cuentas de Google conectadas (${data.map((d) => d.label).join(', ')}). Especifica cuál usar.`
    );
  }

  const row = data[0];
  const client = getOAuthClient();
  client.setCredentials({
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    scope: row.scope,
    expiry_date: row.expiry_date,
  });

  client.on('tokens', async (tokens) => {
    await guardarTokens(userId, row.label, { ...row, ...tokens });
  });

  return client;
}

module.exports = { getAuthUrl, guardarTokens, getAuthorizedClient, listarCuentasConectadas };

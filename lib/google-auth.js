// OAuth con Google: esto es lo que hace posible que Jordan y los
// empleados actúen de verdad en el Calendar y el Gmail de Felipe, en
// vez de solo hablar de ellos.
const { google } = require('googleapis');
const { getSupabase } = require('./supabase');

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/gmail.modify',
];

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function getAuthUrl(userId) {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state: userId,
  });
}

async function guardarTokens(userId, tokens) {
  const supabase = getSupabase();
  await supabase.from('integrations').upsert(
    {
      user_id: userId,
      provider: 'google',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token, // ojo: solo viene la primera vez (prompt=consent)
      scope: tokens.scope,
      expiry_date: tokens.expiry_date,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,provider' }
  );
}

// Devuelve un cliente de Google ya autenticado para ese usuario, listo
// para usarse con calendar/gmail. Refresca el token solo si hace falta.
async function getAuthorizedClient(userId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .single();

  if (error || !data) {
    throw new Error('Google no está conectado todavía. Conéctalo en /conectar-google.');
  }

  const client = getOAuthClient();
  client.setCredentials({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    scope: data.scope,
    expiry_date: data.expiry_date,
  });

  client.on('tokens', async (tokens) => {
    await guardarTokens(userId, { ...data, ...tokens });
  });

  return client;
}

module.exports = { getAuthUrl, guardarTokens, getAuthorizedClient };

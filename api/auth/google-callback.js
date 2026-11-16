const { google } = require('googleapis');
const { guardarTokens } = require('../../lib/google-auth');

module.exports = async function handler(req, res) {
  const { code, state } = req.query;
  if (!code) return res.status(400).send('Falta el código de autorización.');

  let userId = '00000000-0000-0000-0000-000000000000';
  let label = null;
  try {
    const parsed = JSON.parse(state || '{}');
    userId = parsed.userId || userId;
    label = parsed.label || null;
  } catch {
    // state viejo (solo userId como string) — se ignora y se usa el default
  }

  try {
    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    const { tokens } = await client.getToken(code);
    const email = await guardarTokens(userId, label, tokens);

    res.writeHead(302, { Location: `/?google=conectado&cuenta=${encodeURIComponent(email)}` });
    res.end();
  } catch (err) {
    res.status(500).send(`Error conectando Google: ${err.message}`);
  }
};

const { google } = require('googleapis');
const { getAuthorizedClient } = require('../google-auth');

function construirCorreo({ para, asunto, cuerpo }) {
  const mensaje = [`To: ${para}`, `Subject: ${asunto}`, 'Content-Type: text/plain; charset=utf-8', '', cuerpo].join('\n');
  return Buffer.from(mensaje).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function enviarCorreo(userId, { para, asunto, cuerpo }, cuenta) {
  const auth = await getAuthorizedClient(userId, cuenta);
  const gmail = google.gmail({ version: 'v1', auth });
  const raw = construirCorreo({ para, asunto, cuerpo });
  const { data } = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
  return { id: data.id };
}

async function buscarCorreos(userId, { query, max = 10 }, cuenta) {
  const auth = await getAuthorizedClient(userId, cuenta);
  const gmail = google.gmail({ version: 'v1', auth });
  const { data } = await gmail.users.messages.list({ userId: 'me', q: query, maxResults: max });
  const mensajes = data.messages || [];

  const detalles = await Promise.all(
    mensajes.map(async (m) => {
      const { data: msg } = await gmail.users.messages.get({
        userId: 'me',
        id: m.id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'],
      });
      const headers = Object.fromEntries((msg.payload.headers || []).map((h) => [h.name, h.value]));
      return { id: m.id, de: headers.From, asunto: headers.Subject, fecha: headers.Date, snippet: msg.snippet };
    })
  );
  return detalles;
}

module.exports = { enviarCorreo, buscarCorreos };

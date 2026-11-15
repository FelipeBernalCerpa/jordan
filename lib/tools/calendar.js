const { google } = require('googleapis');
const { getAuthorizedClient } = require('../google-auth');

async function listarEventos(userId, { desde, hasta } = {}) {
  const auth = await getAuthorizedClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });
  const { data } = await calendar.events.list({
    calendarId: 'primary',
    timeMin: desde || new Date().toISOString(),
    timeMax: hasta,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 15,
  });
  return (data.items || []).map((e) => ({
    titulo: e.summary,
    inicio: e.start?.dateTime || e.start?.date,
    fin: e.end?.dateTime || e.end?.date,
    id: e.id,
  }));
}

async function crearEvento(userId, { titulo, inicio, fin, descripcion }) {
  const auth = await getAuthorizedClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });
  const { data } = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: titulo,
      description: descripcion,
      start: { dateTime: inicio },
      end: { dateTime: fin },
    },
  });
  return { id: data.id, link: data.htmlLink };
}

module.exports = { listarEventos, crearEvento };

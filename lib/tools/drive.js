const { google } = require('googleapis');
const { getAuthorizedClient } = require('../google-auth');

async function buscarArchivos(userId, { query, max = 10 }, cuenta) {
  const auth = await getAuthorizedClient(userId, cuenta);
  const drive = google.drive({ version: 'v3', auth });
  const { data } = await drive.files.list({
    q: query ? `name contains '${query.replace(/'/g, "\\'")}'` : undefined,
    pageSize: max,
    orderBy: 'modifiedTime desc',
    fields: 'files(id, name, mimeType, webViewLink, modifiedTime)',
  });
  return data.files || [];
}

async function leerArchivoTexto(userId, { fileId }, cuenta) {
  const auth = await getAuthorizedClient(userId, cuenta);
  const drive = google.drive({ version: 'v3', auth });
  const { data } = await drive.files.export({ fileId, mimeType: 'text/plain' }, { responseType: 'text' });
  return data;
}

module.exports = { buscarArchivos, leerArchivoTexto };

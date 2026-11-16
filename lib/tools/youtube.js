const { google } = require('googleapis');
const { getAuthorizedClient } = require('../google-auth');

async function misVideos(userId, { max = 10 } = {}, cuenta) {
  const auth = await getAuthorizedClient(userId, cuenta);
  const youtube = google.youtube({ version: 'v3', auth });

  const canal = await youtube.channels.list({ part: 'contentDetails,statistics', mine: true });
  const canalData = canal.data.items?.[0];
  if (!canalData) return { error: 'No se encontró un canal de YouTube para esta cuenta.' };

  const uploadsPlaylistId = canalData.contentDetails.relatedPlaylists.uploads;
  const { data } = await youtube.playlistItems.list({
    part: 'snippet',
    playlistId: uploadsPlaylistId,
    maxResults: max,
  });

  return {
    suscriptores: canalData.statistics.subscriberCount,
    vistas_totales: canalData.statistics.viewCount,
    videos: (data.items || []).map((v) => ({
      titulo: v.snippet.title,
      publicado: v.snippet.publishedAt,
      videoId: v.snippet.resourceId.videoId,
    })),
  };
}

async function estadisticasVideo(userId, { videoId }, cuenta) {
  const auth = await getAuthorizedClient(userId, cuenta);
  const youtube = google.youtube({ version: 'v3', auth });
  const { data } = await youtube.videos.list({ part: 'statistics,snippet', id: videoId });
  const v = data.items?.[0];
  if (!v) return { error: 'Video no encontrado.' };
  return { titulo: v.snippet.title, vistas: v.statistics.viewCount, likes: v.statistics.likeCount, comentarios: v.statistics.commentCount };
}

module.exports = { misVideos, estadisticasVideo };

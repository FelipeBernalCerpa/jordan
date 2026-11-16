const { getAuthUrl } = require('../../lib/google-auth');

// Ejemplo para conectar una segunda cuenta con apodo:
// /api/auth/google?label=negocio
module.exports = async function handler(req, res) {
  const userId = req.query.userId || '00000000-0000-0000-0000-000000000000';
  const label = req.query.label;
  const url = getAuthUrl(userId, label);
  res.writeHead(302, { Location: url });
  res.end();
};

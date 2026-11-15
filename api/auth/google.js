const { getAuthUrl } = require('../../lib/google-auth');

module.exports = async function handler(req, res) {
  const userId = req.query.userId || '00000000-0000-0000-0000-000000000000';
  const url = getAuthUrl(userId);
  res.writeHead(302, { Location: url });
  res.end();
};

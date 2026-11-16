const { listarCuentasConectadas } = require('../../lib/google-auth');

module.exports = async function handler(req, res) {
  const userId = req.query.userId || '00000000-0000-0000-0000-000000000000';
  const cuentas = await listarCuentasConectadas(userId);
  return res.status(200).json({ cuentas });
};

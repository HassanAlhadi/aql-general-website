'use strict';
const { clearSession, noStore } = require('./_lib.js');

module.exports = async (req, res) => {
  noStore(res);
  clearSession(res);
  return res.status(200).json({ ok: true });
};

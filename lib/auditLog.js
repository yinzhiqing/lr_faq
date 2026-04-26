const db = require('../db/database');

const insert = db.prepare(`
  INSERT INTO audit_logs (action, entity_type, entity_id, user_id, username, ip, detail)
  VALUES (@action, @entity_type, @entity_id, @user_id, @username, @ip, @detail)
`);

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0].trim();
  return req.ip || (req.socket && req.socket.remoteAddress) || '';
}

/**
 * @param {import('express').Request} req
 * @param {{ action: string, entityType?: string|null, entityId?: number|null, username?: string|null, detail?: unknown }} opts
 */
function logAudit(req, opts) {
  const user = req.session && req.session.user;
  let detail = null;
  if (opts.detail != null) {
    detail = typeof opts.detail === 'string' ? opts.detail : JSON.stringify(opts.detail);
  }
  insert.run({
    action: opts.action,
    entity_type: opts.entityType != null ? opts.entityType : null,
    entity_id: opts.entityId != null ? Number(opts.entityId) : null,
    user_id: user ? user.id : null,
    username: user ? user.username : opts.username != null ? opts.username : null,
    ip: clientIp(req),
    detail,
  });
}

module.exports = { logAudit, clientIp };

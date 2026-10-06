import { query } from '../db.js';

export const clientIp = (req) => (req.ip || req.socket?.remoteAddress || '').replace('::ffff:', '').slice(0, 64);

/** Write one audit-trail row. Never throws — logging must not break the request. */
export async function audit(req, action, { actorType, actorId, entity, entityId, detail } = {}) {
  try {
    const type = actorType || (req.patient ? 'patient' : req.user?.role) || 'anonymous';
    const id = actorId ?? req.patient?.id ?? req.user?.id ?? null;
    await query(
      'INSERT INTO audit_logs (actor_type, actor_id, action, entity, entity_id, ip, detail) VALUES (?,?,?,?,?,?,?)',
      [type, id, action, entity || null, entityId != null ? String(entityId) : null, clientIp(req), detail ? String(detail).slice(0, 255) : null]);
  } catch (e) {
    console.error('audit log failed:', e.message);
  }
}

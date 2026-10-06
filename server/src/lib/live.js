// Tiny in-memory pub/sub that pushes queue changes to connected screens
// via Server-Sent Events. For multi-server deployments swap with Redis pub/sub.
const channels = new Map(); // clinicId -> Set<res>

export function subscribe(clinicId, res) {
  const key = String(clinicId);
  if (!channels.has(key)) channels.set(key, new Set());
  channels.get(key).add(res);
  return () => channels.get(key)?.delete(res);
}

export function publish(clinicId, event, data = {}) {
  const set = channels.get(String(clinicId));
  if (!set) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify({ ...data, at: Date.now() })}\n\n`;
  for (const res of set) res.write(payload);
}

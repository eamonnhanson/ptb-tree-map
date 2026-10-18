import { createHmac, timingSafeEqual } from 'node:crypto';

export function createStaffLoginHandler(env = process.env) {
  return (req, res) => {
    res.set('Cache-Control', 'no-store');
    const key = env.STAFF_UPLOAD_KEY;
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!key) return res.status(500).json({ ok: false, error: 'Staff access is not configured' });
    const supplied = Buffer.from(password);
    const expected = Buffer.from(key);
    if (!password || password.length > 128 || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      return res.status(401).json({ ok: false, error: 'Wrong password' });
    }
    return res.json({ ok: true, token: issueStaffToken(key) });
  };
}

export function issueStaffToken(key, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ role: 'staff', expires: now + 8 * 3600000 })).toString('base64url');
  return `${payload}.${createHmac('sha256', key).update(payload).digest('base64url')}`;
}

export function requireStaff(req, res, env = process.env) {
  const key = env.STAFF_UPLOAD_KEY;
  const token = String(req.headers?.authorization || '').replace(/^Bearer /, '');
  const [payload, signature, extra] = token.split('.');
  try {
    if (!key || !payload || !signature || extra) throw new Error();
    const expected = createHmac('sha256', key).update(payload).digest();
    const supplied = Buffer.from(signature, 'base64url');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new Error();
    const claims = JSON.parse(Buffer.from(payload, 'base64url'));
    if (claims.role !== 'staff' || !(claims.expires > Date.now())) throw new Error();
    res.set?.('Cache-Control', 'no-store');
    return true;
  } catch {
    res.status(401).json({ ok: false, error: 'Staff login required' });
    return false;
  }
}

import {
  clearSessionCookie,
  createSessionCookie,
  isAuthenticated,
  isSameOrigin,
  passwordMatches,
} from '../lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'GET') return res.status(200).json({ authenticated: isAuthenticated(req) });

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', clearSessionCookie());
    return res.status(200).json({ authenticated: false });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isSameOrigin(req)) return res.status(403).json({ error: 'Invalid request origin' });
  if (!passwordMatches(req.body?.password)) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return res.status(401).json({ error: 'Incorrect password' });
  }

  res.setHeader('Set-Cookie', createSessionCookie());
  return res.status(200).json({ authenticated: true });
}

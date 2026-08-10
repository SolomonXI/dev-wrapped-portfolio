import fs from 'fs';
import path from 'path';

// Vercel-compatible serverless endpoint supporting GET/POST/PUT/DELETE
// Usage:
// GET  /api/content?collection=projects          -> list items
// POST /api/content (body: { collection, item }) -> create item (requires ADMIN_TOKEN for writes)
// PUT  /api/content (body: { collection, id, item }) -> update item (requires ADMIN_TOKEN)
// DELETE /api/content (body: { collection, id }) -> delete item (requires ADMIN_TOKEN)

const DATA_DIR = path.join(process.cwd(), 'site', 'data');

function requireAuth(req) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return { ok: false, msg: 'Writes are disabled: ADMIN_TOKEN not set' };
  const h = (req.headers.authorization || '').trim();
  if (!h.startsWith('Bearer ')) return { ok: false, msg: 'Missing Authorization header' };
  const v = h.slice(7);
  return { ok: v === token, msg: v === token ? 'ok' : 'Invalid token' };
}

async function readFileCollection(collection) {
  const p = path.join(DATA_DIR, `${collection}.json`);
  if (!fs.existsSync(p)) return [];
  try {
    const s = await fs.promises.readFile(p, 'utf8');
    return JSON.parse(s || '[]');
  } catch (e) {
    console.error('read error', e);
    return [];
  }
}

async function writeFileCollection(collection, arr) {
  const p = path.join(DATA_DIR, `${collection}.json`);
  await fs.promises.mkdir(path.dirname(p), { recursive: true });
  await fs.promises.writeFile(p, JSON.stringify(arr, null, 2), 'utf8');
}

export default async function handler(req, res) {
  try {
    const method = req.method;
    const collection = (req.query.collection || req.body && req.body.collection || '').toString();
    if (!collection) return res.status(400).json({ error: 'collection required' });

    // Prefer DATABASE_URL (Postgres) if present
    if (process.env.DATABASE_URL) {
      // Lazy-load pg to avoid import error on platforms without the package
      let { Client } = await import('pg').catch(() => ({}));
      if (!Client) {
        return res.status(500).json({ error: 'Postgres client not available on runtime; please add pg to package.json' });
      }
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();

      // Ensure table exists (simple schema)
      await client.query(`CREATE TABLE IF NOT EXISTS content (
        id TEXT PRIMARY KEY,
        collection TEXT NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )`);

      if (method === 'GET') {
        const r = await client.query('SELECT id, data FROM content WHERE collection = $1 ORDER BY created_at DESC', [collection]);
        await client.end();
        return res.json(r.rows.map(r=>({ id: r.id, ...r.data })));
      }

      // Writes require auth
      const auth = requireAuth(req);
      if (!auth.ok) { await client.end(); return res.status(401).json({ error: auth.msg }); }

      if (method === 'POST') {
        const item = req.body.item || {};
        const id = (req.body.id) || (typeof globalThis !== 'undefined' && globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
        await client.query('INSERT INTO content (id, collection, data) VALUES ($1,$2,$3)', [id, collection, item]);
        await client.end();
        return res.status(201).json({ id });
      }

      if (method === 'PUT') {
        const id = req.body.id;
        const item = req.body.item || {};
        if (!id) { await client.end(); return res.status(400).json({ error: 'id required' }); }
        await client.query('UPDATE content SET data=$1, updated_at=now() WHERE id=$2 AND collection=$3', [item, id, collection]);
        await client.end();
        return res.json({ ok: true });
      }

      if (method === 'DELETE') {
        const id = req.body.id;
        if (!id) { await client.end(); return res.status(400).json({ error: 'id required' }); }
        await client.query('DELETE FROM content WHERE id=$1 AND collection=$2', [id, collection]);
        await client.end();
        return res.json({ ok: true });
      }

      await client.end();
      return res.status(405).json({ error: 'method not allowed' });
    }

    // File-based fallback (for local testing)
    if (method === 'GET') {
      const arr = await readFileCollection(collection);
      return res.json(arr);
    }

    // Writes require ADMIN_TOKEN
    const auth = requireAuth(req);
    if (!auth.ok) return res.status(401).json({ error: auth.msg });

    if (method === 'POST') {
      const item = req.body.item || {};
      const id = req.body.id || (typeof globalThis !== 'undefined' && globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
      const arr = await readFileCollection(collection);
      arr.unshift({ id, ...item });
      await writeFileCollection(collection, arr);
      return res.status(201).json({ id });
    }

    if (method === 'PUT') {
      const id = req.body.id; const item = req.body.item || {};
      if (!id) return res.status(400).json({ error: 'id required' });
      const arr = await readFileCollection(collection);
      const idx = arr.findIndex(x=>x.id==id);
      if (idx===-1) return res.status(404).json({ error: 'not found' });
      arr[idx] = { id, ...item };
      await writeFileCollection(collection, arr);
      return res.json({ ok: true });
    }

    if (method === 'DELETE') {
      const id = req.body.id;
      if (!id) return res.status(400).json({ error: 'id required' });
      let arr = await readFileCollection(collection);
      arr = arr.filter(x=>x.id!=id);
      await writeFileCollection(collection, arr);
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
}

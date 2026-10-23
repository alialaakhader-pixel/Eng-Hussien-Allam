// Cloudflare Worker: file storage (R2) for videos and attachments.
// - Only the teacher can upload (the Supabase session token is verified on every call).
// - Anyone with the file link can watch/download it (links are random and unguessable).
// - Large files are uploaded in 16 MB chunks (R2 multipart), so there is no practical size limit.

const SUPABASE_URL = 'https://vmwfwyyrqbtwthakwqft.supabase.co';
const SUPABASE_KEY = 'sb_publishable__2XQ2mNTv9UbIX8on0OpvA_zYn_ygtw'; // public (anon) key
const KEY_RE = /^(videos|attachments)\/[0-9]{10,}-[a-f0-9]{8}\.[a-z0-9]{1,8}$/;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, PUT, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Range',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, ETag',
  'Access-Control-Max-Age': '86400'
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function isTeacher(request) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ha_is_teacher`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: auth, 'Content-Type': 'application/json' },
      body: '{}'
    });
    return r.ok && (await r.json()) === true;
  } catch {
    return false;
  }
}

async function serve(request, env, key) {
  const head = request.method === 'HEAD';
  const object = head
    ? await env.FILES.head(key)
    : await env.FILES.get(key, { range: request.headers, onlyIf: request.headers });
  if (!object) return new Response('Not found', { status: 404, headers: CORS });

  const headers = new Headers(CORS);
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('X-Content-Type-Options', 'nosniff');

  if (head) {
    headers.set('Content-Length', String(object.size));
    return new Response(null, { status: 200, headers });
  }

  const hasBody = 'body' in object && object.body;
  if (!hasBody) return new Response(null, { status: 304, headers });

  let status = 200;
  let length = object.size;
  if (object.range) {
    const r = object.range;
    let start;
    let end;
    if ('suffix' in r) {
      start = Math.max(0, object.size - r.suffix);
      end = object.size - 1;
    } else {
      start = r.offset ?? 0;
      end = r.length !== undefined ? start + r.length - 1 : object.size - 1;
    }
    headers.set('Content-Range', `bytes ${start}-${end}/${object.size}`);
    length = end - start + 1;
    status = 206;
  }
  headers.set('Content-Length', String(length));
  return new Response(object.body, { status, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    // ---- public: stream / download a file ----
    if ((request.method === 'GET' || request.method === 'HEAD') && path.startsWith('/f/')) {
      const key = decodeURIComponent(path.slice(3));
      if (!KEY_RE.test(key)) return new Response('Not found', { status: 404, headers: CORS });
      return serve(request, env, key);
    }

    if (path === '/' || path === '/health') return json({ ok: true, service: 'platform-files' });

    // ---- teacher only: multipart upload ----
    if (path.startsWith('/upload/')) {
      if (!(await isTeacher(request))) return json({ ok: false, error: 'FORBIDDEN' }, 403);

      if (path === '/upload/create' && request.method === 'POST') {
        const folder = url.searchParams.get('folder') === 'attachments' ? 'attachments' : 'videos';
        const ext = (url.searchParams.get('ext') || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
        const type = (url.searchParams.get('type') || 'application/octet-stream').slice(0, 100);
        const key = `${folder}/${Date.now()}-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}.${ext}`;
        const mp = await env.FILES.createMultipartUpload(key, { httpMetadata: { contentType: type } });
        return json({ ok: true, key, uploadId: mp.uploadId, url: `${url.origin}/f/${key}` });
      }

      const key = url.searchParams.get('key') || '';
      const uploadId = url.searchParams.get('uploadId') || '';
      if (!KEY_RE.test(key) || !uploadId) return json({ ok: false, error: 'BAD_REQUEST' }, 400);
      const mp = env.FILES.resumeMultipartUpload(key, uploadId);

      if (path === '/upload/part' && request.method === 'PUT') {
        const n = Number(url.searchParams.get('n'));
        if (!Number.isInteger(n) || n < 1 || n > 10000) return json({ ok: false, error: 'BAD_PART' }, 400);
        const part = await mp.uploadPart(n, await request.arrayBuffer());
        return json({ partNumber: part.partNumber, etag: part.etag });
      }

      if (path === '/upload/complete' && request.method === 'POST') {
        const body = await request.json();
        await mp.complete(body.parts || []);
        return json({ ok: true, url: `${url.origin}/f/${key}` });
      }

      if (path === '/upload/abort' && request.method === 'POST') {
        await mp.abort();
        return json({ ok: true });
      }
    }

    return json({ ok: false, error: 'NOT_FOUND' }, 404);
  }
};

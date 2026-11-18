/**
 * wyy 档案 · 评论接口
 *
 * 站点其余部分是纯静态资源（dist/），这个 Worker 只负责 /api/* 这一小撮请求，
 * 其余全部原样交给静态资源处理，所以文章页、404 页的行为完全不变。
 *
 * 接口：
 *   GET  /api/comments?post=<slug>     取某篇文章的公开评论
 *   POST /api/comments                 发表评论（匿名昵称，带蜜罐与频率限制）
 *   GET  /api/admin/comments?token=    列出全部评论（含已隐藏），需管理口令
 *   POST /api/admin/hide               隐藏/恢复一条评论，需管理口令
 */

const MAX_NAME = 20;
const MAX_BODY = 1000;
const MAX_POST = 80;
const RATE_WINDOW_SEC = 600;
const RATE_MAX = 3;
const LIST_LIMIT = 300;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });

/* 表结构在首次请求时自建，省掉手工执行 SQL 的步骤。
   每个 isolate 只跑一次，失败则重置以便下次重试。 */
let schemaPromise = null;
function ensureSchema(env) {
  if (!schemaPromise) {
    schemaPromise = env.DB.batch([
      env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS comments (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           post TEXT NOT NULL,
           name TEXT NOT NULL,
           body TEXT NOT NULL,
           created_at INTEGER NOT NULL,
           hidden INTEGER NOT NULL DEFAULT 0,
           ip_hash TEXT
         )`
      ),
      env.DB.prepare(
        `CREATE INDEX IF NOT EXISTS idx_comments_post ON comments (post, hidden, id)`
      ),
    ]).catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}

/* 去掉控制字符；正文保留换行，昵称压成单行。 */
function tidy(value, max, { multiline = false } = {}) {
  let s = String(value == null ? '' : value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
  s = multiline ? s.replace(/\r\n?/g, '\n') : s.replace(/\s+/g, ' ');
  return s.trim().slice(0, max);
}

async function hashIp(request, salt) {
  const ip =
    request.headers.get('cf-connecting-ip') ||
    (request.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  if (!ip) return '';
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function tokenState(request, env, url) {
  const expected = env.ADMIN_TOKEN;
  // 未配置口令：管理接口整体不可用，给出可区分的错误码，便于排查
  if (!expected) return 'missing';
  const given =
    request.headers.get('x-admin-token') || url.searchParams.get('token') || '';
  if (!given) return 'none';
  if (given.length !== expected.length) return 'wrong';
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0 ? 'ok' : 'wrong';
}

const AUTH_ERRORS = {
  missing: [{ error: '服务端未配置管理口令（ADMIN_TOKEN）' }, 503],
  none: [{ error: '缺少口令' }, 401],
  wrong: [{ error: '口令不对' }, 403],
};

const publicRow = (r) => ({
  id: r.id,
  name: r.name,
  body: r.body,
  createdAt: r.created_at,
});

async function handleGet(request, env, url) {
  const post = tidy(url.searchParams.get('post'), MAX_POST);
  if (!post) return json({ error: '缺少 post 参数' }, 400);

  const { results } = await env.DB.prepare(
    `SELECT id, name, body, created_at FROM comments
      WHERE post = ? AND hidden = 0
      ORDER BY id ASC LIMIT ?`
  )
    .bind(post, LIST_LIMIT)
    .all();

  return json({ comments: (results || []).map(publicRow) });
}

async function handlePost(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: '请求格式不正确' }, 400);
  }

  // 蜜罐：真人看不见这个字段，填了就当作成功但什么都不存
  if (tidy(payload.hp, 100)) return json({ ok: true, comment: null });

  const post = tidy(payload.post, MAX_POST);
  const name = tidy(payload.name, MAX_NAME);
  const body = tidy(payload.body, MAX_BODY, { multiline: true });

  if (!/^[a-z0-9][a-z0-9-]*$/.test(post)) return json({ error: '文章标识不合法' }, 400);
  if (name.length < 1) return json({ error: '昵称不能为空' }, 400);
  if (body.length < 1) return json({ error: '内容不能为空' }, 400);

  const ipHash = await hashIp(request, env.IP_SALT || 'wyy-archive');

  if (ipHash) {
    const since = Math.floor(Date.now() / 1000) - RATE_WINDOW_SEC;
    const row = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM comments WHERE ip_hash = ? AND created_at > ?`
    )
      .bind(ipHash, since)
      .first();
    if (row && row.n >= RATE_MAX) {
      return json({ error: '发得太快了，过一会儿再来' }, 429);
    }
  }

  const createdAt = Math.floor(Date.now() / 1000);
  const ins = await env.DB.prepare(
    `INSERT INTO comments (post, name, body, created_at, hidden, ip_hash)
     VALUES (?, ?, ?, ?, 0, ?) RETURNING id`
  )
    .bind(post, name, body, createdAt, ipHash)
    .first();

  return json({ ok: true, comment: { id: ins.id, name, body, createdAt } }, 201);
}

async function handleAdminList(request, env, url) {
  const st = tokenState(request, env, url);
  if (st !== 'ok') return json(...AUTH_ERRORS[st]);
  const { results } = await env.DB.prepare(
    `SELECT id, post, name, body, created_at, hidden FROM comments
      ORDER BY id DESC LIMIT 500`
  ).all();
  return json({
    comments: (results || []).map((r) => ({
      ...publicRow(r),
      post: r.post,
      hidden: !!r.hidden,
    })),
  });
}

async function handleAdminHide(request, env, url) {
  const st = tokenState(request, env, url);
  if (st !== 'ok') return json(...AUTH_ERRORS[st]);
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: '请求格式不正确' }, 400);
  }
  const id = Number(payload.id);
  if (!Number.isInteger(id) || id <= 0) return json({ error: 'id 不合法' }, 400);
  const hidden = payload.hidden ? 1 : 0;
  await env.DB.prepare(`UPDATE comments SET hidden = ? WHERE id = ?`)
    .bind(hidden, id)
    .run();
  return json({ ok: true, id, hidden: !!hidden });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    try {
      await ensureSchema(env);

      if (url.pathname === '/api/comments' && request.method === 'GET') {
        return await handleGet(request, env, url);
      }
      if (url.pathname === '/api/comments' && request.method === 'POST') {
        return await handlePost(request, env);
      }
      if (url.pathname === '/api/admin/comments' && request.method === 'GET') {
        return await handleAdminList(request, env, url);
      }
      if (url.pathname === '/api/admin/hide' && request.method === 'POST') {
        return await handleAdminHide(request, env, url);
      }
      return json({ error: '没有这个接口' }, 404);
    } catch (err) {
      return json({ error: '服务器出错', detail: String(err && err.message) }, 500);
    }
  },
};

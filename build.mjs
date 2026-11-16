/* =========================================================
   静态站点构建脚本
   输入：content/ 下的 markdown 与 site.json
   输出：dist/ 下的完整静态站点
   运行：npm run build
   ========================================================= */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { marked } from 'marked';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIR = {
  content: path.join(ROOT, 'content'),
  posts: path.join(ROOT, 'content', 'posts'),
  pages: path.join(ROOT, 'src', 'pages'),
  postTpl: path.join(ROOT, 'src', 'post.html'),
  public: path.join(ROOT, 'public'),
  dist: path.join(ROOT, 'dist'),
};

const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/* ---------- 清空 dist ---------- */
fs.rmSync(DIR.dist, { recursive: true, force: true });
fs.mkdirSync(path.join(DIR.dist, 'assets'), { recursive: true });

/* ---------- 站点配置 ---------- */
const site = readJSON(path.join(DIR.content, 'site.json'));

/* ---------- 读取文章 ---------- */
const posts = [];
for (const file of fs.readdirSync(DIR.posts)) {
  if (!file.endsWith('.md')) continue;
  const raw = fs.readFileSync(path.join(DIR.posts, file), 'utf8');
  const { data, content } = matter(raw);
  if (data.draft === true) continue;

  const slug = file.replace(/\.md$/, '');
  const date = data.date instanceof Date
    ? data.date.toISOString().slice(0, 10)
    : String(data.date || '').slice(0, 10);

  let html = marked.parse(content, { gfm: true, breaks: false });

  /* 给 h2/h3 加锚点，同时收集目录 */
  const toc = [];
  html = html.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_m, d, inner) => {
    const id = 's' + (toc.length + 1);
    toc.push({ id, text: inner.replace(/<[^>]+>/g, '').trim(), depth: Number(d) });
    return `<h${d} id="${id}">${inner}</h${d}>`;
  });

  const words = countWords(content);

  posts.push({
    slug,
    date,
    title: data.title || slug,
    section: data.section || 'notes',
    summary: data.summary || '',
    tags: Array.isArray(data.tags) ? data.tags : [],
    minutes: Number(data.minutes) || Math.max(1, Math.round(words / 400)),
    html,
    toc,
    words,
  });
}

function countWords(md) {
  const text = md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!?\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[#>*_\-|]/g, ' ');
  const cn = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const en = (text.match(/[A-Za-z0-9]+/g) || []).length;
  return cn + en;
}

posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

const sectionOf = (id) => site.sections.find((s) => s.id === id) || null;

/* ---------- 生成 assets/data.js ---------- */
const entries = posts.map((p) => ({
  section: p.section,
  title: p.title,
  date: p.date,
  minutes: p.minutes,
  summary: p.summary,
  tags: p.tags,
  url: `${p.slug}.html?s=${p.section}`,
}));

const dataJS =
  '/* 由 build.mjs 自动生成，不要手改。改内容请改 content/ 下的文件。 */\n' +
  'window.SITE = ' +
  JSON.stringify({ ...site, entries }, null, 2) +
  ';\n';

fs.writeFileSync(path.join(DIR.dist, 'assets', 'data.js'), dataJS, 'utf8');

/* ---------- 拷贝静态资源 ---------- */
fs.cpSync(DIR.public, DIR.dist, { recursive: true });

/* ---------- 普通页面：注入 data.js ---------- */
const DATA_TAG = '<script src="assets/data.js"></script>\n<script src="assets/site.js"></script>';
for (const file of fs.readdirSync(DIR.pages)) {
  if (!file.endsWith('.html')) continue;
  let html = fs.readFileSync(path.join(DIR.pages, file), 'utf8');
  if (html.includes('<script src="assets/site.js"></script>')) {
    html = html.replace('<script src="assets/site.js"></script>', DATA_TAG);
  } else {
    html = html.replace('</body>', DATA_TAG + '\n</body>');
  }
  fs.writeFileSync(path.join(DIR.dist, file), html, 'utf8');
}

/* ---------- 逐篇渲染文章页 ---------- */
const tpl = fs.readFileSync(DIR.postTpl, 'utf8');

const badgeMap = {
  note: 'b-note', think: 'b-think', proj: 'b-proj',
  diary: 'b-diary', file: 'b-file', cert: 'b-cert',
};

posts.forEach((p, i) => {
  const sec = sectionOf(p.section) || { id: p.section, name: '未分类', kind: 'file' };

  const crumb = [
    '<a href="index.html">首页</a><span class="sep">/</span>',
    `<a href="list.html?s=${esc(sec.id)}">${esc(sec.name)}</a><span class="sep">/</span>`,
    `<span>${esc(p.title)}</span>`,
  ].join('');

  const meta = [
    `<span class="badge ${badgeMap[sec.kind] || 'b-file'}" style="width:44px">${esc(sec.name)}</span>`,
    `<span>${esc(p.date)}</span>`,
    p.minutes ? `<span class="dot"></span><span>${p.minutes} 分钟读完</span>` : '',
    `<span class="dot"></span><span>${p.words.toLocaleString('en-US')} 字</span>`,
    p.tags.length
      ? `<span class="dot"></span><span>${p.tags.map(esc).join(' / ')}</span>`
      : '',
  ].join('');

  const tocHTML = p.toc
    .map(
      (t) =>
        `        <li${t.depth === 3 ? ' class="lv3"' : ''}><a href="#${t.id}">${esc(t.text)}</a></li>`
    )
    .join('\n');

  const newer = posts[i - 1];
  const older = posts[i + 1];
  const navItems = [];
  if (newer) {
    navItems.push(
      `<a href="${newer.slug}.html?s=${newer.section}">\n      <span class="k">← 上一篇</span>\n      <span class="t">${esc(newer.title)}</span>\n    </a>`
    );
  }
  if (older) {
    navItems.push(
      `<a href="${older.slug}.html?s=${older.section}" class="next">\n      <span class="k">下一篇 →</span>\n      <span class="t">${esc(older.title)}</span>\n    </a>`
    );
  }

  const out = tpl
    .replaceAll('{{TITLE}}', esc(p.title))
    .replaceAll('{{BRAND}}', esc(site.brand))
    .replaceAll('{{BRAND_NOTE}}', esc(site.brandNote || ''))
    .replaceAll('{{SUMMARY}}', esc(p.summary))
    .replaceAll('{{CRUMB}}', crumb)
    .replaceAll('{{META}}', meta)
    .replaceAll('{{BODY}}', p.html)
    .replaceAll('{{TOC}}', tocHTML)
    .replaceAll('{{POST_NAV}}', navItems.join('\n    '));

  fs.writeFileSync(path.join(DIR.dist, `${p.slug}.html`), out, 'utf8');
});

/* ---------- 汇总 ---------- */
const files = fs.readdirSync(DIR.dist, { recursive: true }).filter((f) => !fs.statSync(path.join(DIR.dist, f)).isDirectory());
console.log(`构建完成：${posts.length} 篇文章，${files.length} 个文件 -> dist/`);
for (const p of posts) console.log(`  ${p.date}  ${p.slug}.html  ${p.title}`);

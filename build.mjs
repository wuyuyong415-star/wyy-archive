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
import { pinyin } from 'pinyin-pro';

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

const isoDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/* ---------- 文件名 -> 网址 slug ----------
   后台用标题当文件名时会生成中文文件名（如「为什么索引必须有序.md」），
   这里统一转成拼音，保证网址始终是 ASCII：
     为什么索引必须有序.md  ->  wei-shen-me-suo-yin-bi-xu-you-xu.html
   也可以在文章开头写 slug: my-url 强制指定。                          */
function toSlug(source, fallbackDate) {
  const raw = String(source || '').trim();
  if (!raw) return `post-${fallbackDate || 'untitled'}`;

  const text = /[\u4e00-\u9fa5]/.test(raw)
    ? pinyin(raw, { toneType: 'none', type: 'array', nonZh: 'consecutive' }).join(' ')
    : raw;

  const s = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');

  return s || `post-${fallbackDate || 'untitled'}`;
}

/* ---------- 代码块着色 ----------
   不引第三方高亮库：只做注释 / 字符串 / 数字 / 关键字四类，
   颜色类名与 style.css 里的 .cm .kw .st .nu 对应。
   输入是 marked 已经转义过的文本，所以要先保护 &lt; 这类实体，
   否则单词边界正则会把实体里的字母切开、产出坏 HTML。          */
const LANG_NAME = {
  sql: 'SQL', js: 'JavaScript', javascript: 'JavaScript', ts: 'TypeScript',
  typescript: 'TypeScript', json: 'JSON', py: 'Python', python: 'Python',
  bash: 'Bash', sh: 'Shell', shell: 'Shell', zsh: 'Shell', c: 'C', cpp: 'C++',
  go: 'Go', rust: 'Rust', java: 'Java', html: 'HTML', css: 'CSS',
  yaml: 'YAML', yml: 'YAML', md: 'Markdown', text: '文本', txt: '文本',
};

const HL = {
  sql: {
    kw: 'select from where and or not in is like between order group by limit offset insert into values update set delete join left right inner outer on as explain create table index primary key foreign references distinct having asc desc union all case when then else end count sum avg min max exists',
    dash: true,
  },
  js: {
    kw: 'const let var function return if else for while do new class extends super import export default from await async try catch finally throw typeof instanceof of in null undefined true false this void delete switch case break continue yield static get set',
    slash: true, block: true,
  },
  ts: {
    kw: 'const let var function return if else for while do new class extends implements interface type enum import export default from await async try catch finally throw typeof instanceof of in null undefined true false this void delete switch case break continue yield static public private readonly as',
    slash: true, block: true,
  },
  json: { kw: 'true false null', slash: true },
  py: {
    kw: 'def class return if elif else for while import from as with try except finally raise lambda None True False and or not in is pass yield global nonlocal assert del break continue async await print self',
    hash: true,
  },
  bash: {
    kw: 'if then else elif fi for do done while case esac function return export local echo cd npm npx node git source set unset read exit sudo',
    hash: true,
  },
  sh: { kw: 'if then else fi for do done while case esac function return export local echo cd exit', hash: true },
  c: {
    kw: 'int char float double void return if else for while do struct union enum typedef const static sizeof switch case break continue unsigned signed long short goto extern inline',
    slash: true, block: true,
  },
  cpp: {
    kw: 'int char float double void bool return if else for while do class struct union enum typedef const static sizeof switch case break continue unsigned signed long short namespace using template public private protected new delete nullptr true false auto',
    slash: true, block: true,
  },
  go: {
    kw: 'package import func var const type struct interface map chan go defer select case switch if else for range return nil true false make new len cap append panic',
    slash: true, block: true,
  },
  rust: {
    kw: 'fn let mut const struct enum impl trait pub use mod match if else for while loop return self Self Some None Ok Err where as move ref',
    slash: true, block: true,
  },
  java: {
    kw: 'public private protected class interface extends implements static final void int long double float boolean char String new return if else for while switch case break continue try catch finally throw throws import package this null true false',
    slash: true, block: true,
  },
  css: { block: true, kw: '' },
};

function highlight(code, lang) {
  const spec = HL[lang] || null;
  const kws = spec && spec.kw ? new Set(spec.kw.split(/\s+/)) : null;

  const alts = ['(&quot;[\\s\\S]*?&quot;|&#39;[^&]*?&#39;|`[^`]*`)', '(&[a-zA-Z]+;|&#\\d+;)'];
  const cls = ['st', ''];
  if (spec && spec.block) { alts.push('(\\/\\*[\\s\\S]*?\\*\\/)'); cls.push('cm'); }
  if (spec && spec.slash) { alts.push('(\\/\\/[^\\n]*)'); cls.push('cm'); }
  if (spec && spec.dash) { alts.push('(--[^\\n]*)'); cls.push('cm'); }
  if (spec && spec.hash) { alts.push('(#[^\\n]*)'); cls.push('cm'); }
  alts.push('(\\b\\d+(?:\\.\\d+)?\\b)'); cls.push('nu');
  alts.push('(\\b[A-Za-z_][A-Za-z0-9_]*\\b)'); cls.push('id');

  const re = new RegExp(alts.join('|'), 'g');
  let out = '';
  let last = 0;
  let m;
  while ((m = re.exec(code))) {
    out += code.slice(last, m.index);
    const idx = m.slice(1).findIndex((v) => v !== undefined);
    let kind = cls[idx] || '';
    const text = m[0];
    if (kind === 'id') kind = kws && kws.has(text.toLowerCase()) ? 'kw' : '';
    out += kind ? `<span class="${kind}">${text}</span>` : text;
    last = m.index + text.length;
    if (text.length === 0) re.lastIndex += 1;
  }
  return out + code.slice(last);
}

/* ---------- 清空 dist ---------- */
fs.rmSync(DIR.dist, { recursive: true, force: true });
fs.mkdirSync(path.join(DIR.dist, 'assets'), { recursive: true });

/* ---------- 站点配置 ---------- */
const site = readJSON(path.join(DIR.content, 'site.json'));
const SITE_URL = String(site.url || '').replace(/\/+$/, '');
const abs = (p) => (SITE_URL ? `${SITE_URL}/${p}` : p);
const today = new Date();
const TODAY = isoDate(today);

/* ---------- 读取文章 ---------- */
const posts = [];
const skipped = [];
const usedSlugs = new Set();
for (const file of fs.readdirSync(DIR.posts)) {
  if (!file.endsWith('.md')) continue;
  const raw = fs.readFileSync(path.join(DIR.posts, file), 'utf8');
  const { data, content } = matter(raw);
  if (data.draft === true) continue;

  const date = data.date instanceof Date
    ? isoDate(data.date)
    : String(data.date || '').slice(0, 10);

  /* 日期在未来的文章先压着，到日子再发（构建当天生效） */
  if (date && date > TODAY) {
    skipped.push(`${file}（${date}）`);
    continue;
  }

  const dateKey = date.replace(/-/g, '') || 'untitled';

  /* slug 优先取 frontmatter.slug，其次文件名；重复时自动加序号 */
  const baseSlug = toSlug(data.slug || file.replace(/\.md$/, ''), dateKey);
  let slug = baseSlug;
  for (let n = 2; usedSlugs.has(slug); n += 1) slug = `${baseSlug}-${n}`;
  usedSlugs.add(slug);

  let html = marked.parse(content, { gfm: true, breaks: false });

  /* 兜底：后台插图可能写成 public/assets/xxx，public 是仓库目录不进站点根，
     这里统一改写成站点根路径，避免图片 404 */
  html = html.replace(/(src|href)="\.?\/?public\//g, '$1="/');

  /* 代码块：加语言标签 + 复制按钮 + 着色 */
  html = html.replace(
    /<pre><code(?: class="language-([A-Za-z0-9_+#.-]+)")?>([\s\S]*?)<\/code><\/pre>/g,
    (_m, lang, code) => {
      const l = String(lang || '').toLowerCase();
      const name = LANG_NAME[l] || (l ? l.toUpperCase() : 'CODE');
      const body = code.replace(/\n$/, '');
      return (
        `<div class="code-cap"><span class="lb">${esc(name)}</span>` +
        `<button class="copy" type="button" data-copy>复制</button></div>` +
        `<pre><code class="language-${esc(l || 'text')}">${highlight(body, l)}</code></pre>`
      );
    }
  );

  /* 表格：套一层横向滚动容器，窄屏才不会被撑破 */
  if (html.includes('<table>')) {
    html = html
      .replace(/<table>/g, '<div class="table-wrap"><table>')
      .replace(/<\/table>/g, '</table></div>');
  }

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

/* ---------- 最近 14 周更新热力（首页用真实数据） ---------- */
const activity = [];
for (let i = 97; i >= 0; i--) {
  const d = new Date(today);
  d.setDate(d.getDate() - i);
  const key = isoDate(d);
  activity.push(posts.filter((p) => p.date === key).length);
}

/* ---------- 生成 assets/data.js ---------- */
const entries = posts.map((p) => ({
  section: p.section,
  title: p.title,
  date: p.date,
  minutes: p.minutes,
  words: p.words,
  summary: p.summary,
  tags: p.tags,
  url: `${p.slug}.html?s=${p.section}`,
}));

const dataJS =
  '/* 由 build.mjs 自动生成，不要手改。改内容请改 content/ 下的文件。 */\n' +
  'window.SITE = ' +
  JSON.stringify({ ...site, entries, activity, builtAt: TODAY }, null, 2) +
  ';\n';

fs.writeFileSync(path.join(DIR.dist, 'assets', 'data.js'), dataJS, 'utf8');

/* ---------- 拷贝静态资源 ---------- */
fs.cpSync(DIR.public, DIR.dist, { recursive: true });

/* ---------- 注入 head 元信息 ---------- */
function injectMeta(html, { url, title, desc, type, noindex }) {
  const block = [
    '<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">',
    '<meta name="theme-color" content="#0b0c10">',
    noindex
      ? '<meta name="robots" content="noindex">'
      : `<link rel="canonical" href="${esc(abs(url))}">`,
    `<meta property="og:type" content="${type || 'website'}">`,
    `<meta property="og:site_name" content="${esc(`${site.brand} ${site.brandNote || ''}`.trim())}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    desc ? `<meta property="og:description" content="${esc(desc)}">` : '',
    noindex ? '' : `<meta property="og:url" content="${esc(abs(url))}">`,
    '<meta name="twitter:card" content="summary">',
  ]
    .filter(Boolean)
    .join('\n');

  return html.replace('</head>', `${block}\n</head>`);
}

/* ---------- 普通页面：注入 data.js + head 元信息 ---------- */
const DATA_TAG = '<script src="assets/data.js"></script>\n<script src="assets/site.js"></script>';
for (const file of fs.readdirSync(DIR.pages)) {
  if (!file.endsWith('.html')) continue;
  let html = fs.readFileSync(path.join(DIR.pages, file), 'utf8');
  if (html.includes('<script src="assets/site.js"></script>')) {
    html = html.replace('<script src="assets/site.js"></script>', DATA_TAG);
  } else {
    html = html.replace('</body>', DATA_TAG + '\n</body>');
  }

  const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [, site.brand])[1].trim();
  const desc = (html.match(/<meta name="description" content="([\s\S]*?)"/) || [, ''])[1];
  html = injectMeta(html, {
    url: file,
    title,
    desc,
    noindex: file === '404.html',
  });

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

  let out = tpl
    .replaceAll('{{TITLE}}', esc(p.title))
    .replaceAll('{{BRAND}}', esc(site.brand))
    .replaceAll('{{BRAND_NOTE}}', esc(site.brandNote || ''))
    .replaceAll('{{SUMMARY}}', esc(p.summary))
    .replaceAll('{{SECTION}}', esc(sec.id))
    .replaceAll('{{CRUMB}}', crumb)
    .replaceAll('{{META}}', meta)
    .replaceAll('{{BODY}}', p.html)
    .replaceAll('{{TOC}}', tocHTML)
    .replaceAll('{{POST_NAV}}', navItems.join('\n    '));

  out = injectMeta(out, {
    url: `${p.slug}.html`,
    title: `${p.title} · ${site.brand} ${site.brandNote || ''}`.trim(),
    desc: p.summary,
    type: 'article',
  });

  fs.writeFileSync(path.join(DIR.dist, `${p.slug}.html`), out, 'utf8');
});

/* ---------- sitemap.xml / feed.xml / robots.txt ---------- */
const pageMeta = [
  { url: 'index.html', pri: '1.0' },
  { url: 'list.html', pri: '0.8' },
  { url: 'certs.html', pri: '0.6' },
];

const sitemap =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  pageMeta
    .map(
      (p) =>
        `  <url><loc>${esc(abs(p.url))}</loc><lastmod>${TODAY}</lastmod><priority>${p.pri}</priority></url>`
    )
    .join('\n') +
  '\n' +
  posts
    .map(
      (p) =>
        `  <url><loc>${esc(abs(p.slug + '.html'))}</loc><lastmod>${esc(p.date || TODAY)}</lastmod><priority>0.7</priority></url>`
    )
    .join('\n') +
  '\n</urlset>\n';

const rfc822 = (d) => {
  const dt = new Date(`${d}T08:00:00+08:00`);
  return isNaN(dt) ? new Date().toUTCString() : dt.toUTCString();
};

const feed =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n' +
  '<channel>\n' +
  `  <title>${esc(`${site.brand} · 个人档案`)}</title>\n` +
  `  <link>${esc(abs('index.html'))}</link>\n` +
  `  <description>${esc('证书、项目、笔记、日记，还有一些没想清楚就写下来的念头。')}</description>\n` +
  '  <language>zh-CN</language>\n' +
  `  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n` +
  `  <atom:link href="${esc(abs('feed.xml'))}" rel="self" type="application/rss+xml"/>\n` +
  posts
    .map((p) => {
      const link = abs(`${p.slug}.html`);
      return (
        '  <item>\n' +
        `    <title>${esc(p.title)}</title>\n` +
        `    <link>${esc(link)}</link>\n` +
        `    <guid isPermaLink="true">${esc(link)}</guid>\n` +
        `    <pubDate>${rfc822(p.date)}</pubDate>\n` +
        `    <category>${esc(sectionOf(p.section)?.name || '未分类')}</category>\n` +
        `    <description>${esc(p.summary || '')}</description>\n` +
        '  </item>\n'
      );
    })
    .join('') +
  '</channel>\n</rss>\n';

const robots =
  'User-agent: *\n' +
  'Allow: /\n' +
  (SITE_URL ? `\nSitemap: ${abs('sitemap.xml')}\n` : '');

fs.writeFileSync(path.join(DIR.dist, 'sitemap.xml'), sitemap, 'utf8');
fs.writeFileSync(path.join(DIR.dist, 'feed.xml'), feed, 'utf8');
fs.writeFileSync(path.join(DIR.dist, 'robots.txt'), robots, 'utf8');

/* ---------- 汇总 ---------- */
const files = fs
  .readdirSync(DIR.dist, { recursive: true })
  .filter((f) => !fs.statSync(path.join(DIR.dist, f)).isDirectory());

console.log(`构建完成：${posts.length} 篇文章，${files.length} 个文件 -> dist/`);
for (const p of posts) console.log(`  ${p.date}  ${p.slug}.html  ${p.title}`);
if (skipped.length) console.log(`未到期、本次跳过：\n  ${skipped.join('\n  ')}`);

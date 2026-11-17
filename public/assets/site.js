/* =========================================================
   以下为渲染逻辑，正常不需要改
   ========================================================= */
(function () {
  'use strict';

  var S = window.SITE;

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function byId(id) {
    for (var i = 0; i < S.sections.length; i++) if (S.sections[i].id === id) return S.sections[i];
    return null;
  }
  function badgeClass(kind) {
    return { note: 'b-note', think: 'b-think', proj: 'b-proj', diary: 'b-diary', file: 'b-file', cert: 'b-cert' }[kind] || 'b-file';
  }
  /* 展示数量：有 countFrom 的取对应数据源（如证书、项目），否则数条目 */
  function countOf(id) {
    var sec = byId(id);
    if (sec && sec.countFrom && S[sec.countFrom]) return S[sec.countFrom].length;
    return entryCount(id);
  }
  /* 条目数量：只管 SITE.entries */
  function entryCount(id) {
    return S.entries.filter(function (e) { return e.section === id; }).length;
  }
  function sorted() {
    return S.entries.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  }
  function shortDate(d) { return d ? d.slice(5) : ''; }
  function yearOf(d) { return d ? d.slice(0, 4) : ''; }
  function listHref(s) { return s.page || ('list.html?s=' + s.id); }
  function param(k) {
    var m = new RegExp('[?&]' + k + '=([^&]*)').exec(location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
  }
  function daysAgo(dateStr) {
    if (!dateStr) return null;
    var d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    var now = new Date();
    var a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((a - d) / 86400000);
  }
  function fmtDate(d) {
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function unique(arr) {
    var out = [];
    arr.forEach(function (v) { if (out.indexOf(v) < 0) out.push(v); });
    return out;
  }

  /* ---------- 导航 ---------- */
  function renderNav(activeId) {
    var nav = document.querySelector('.nav');
    if (!nav) return;
    var html = '<a href="index.html"' + (activeId === 'home' ? ' class="on"' : '') + '>首页</a>';
    S.sections.forEach(function (s) {
      html += '<a href="' + listHref(s) + '"' + (s.id === activeId ? ' class="on"' : '') + '>' + esc(s.name) + '</a>';
    });
    nav.innerHTML = html;
  }

  function initNavToggle() {
    var btn = document.getElementById('navToggle');
    var nav = document.querySelector('.nav');
    if (!btn || !nav) return;
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---------- 页脚 ---------- */
  function renderFooter() {
    var box = document.getElementById('footLinks');
    if (!box) return;
    var social = S.social || {};
    var html = '<a href="feed.xml">RSS</a>';
    if (social.github) html += '<a href="' + esc(social.github) + '" target="_blank" rel="noopener">GitHub</a>';
    if (social.email) html += '<a href="mailto:' + esc(social.email) + '">邮箱</a>';
    html += '<a href="#top">回到顶部 ↑</a>';
    box.innerHTML = html;
  }

  /* ---------- 首页：六个模块 ---------- */
  function renderModules() {
    var box = document.getElementById('modules');
    if (!box) return;
    box.innerHTML = S.sections.map(function (s) {
      var cnt = countOf(s.id);
      return '<a class="mod m-' + s.color + ' reveal" href="' + listHref(s) + '">' +
        '<div class="mod-top"><span class="ic">' + s.icon + '</span><span class="cnt">' + cnt + ' ' + (s.unit || '') + '</span></div>' +
        '<h3>' + esc(s.name) + (s.isNew ? ' <span class="new">NEW</span>' : '') + '</h3>' +
        '<p>' + esc(s.desc || '') + '</p>' +
        '<div class="mod-foot"><span>' + esc(s.meta || '') + '</span><span class="arrow">→</span></div>' +
        '</a>';
    }).join('');
  }

  /* ---------- 首页：最近更新 ---------- */
  function renderFeed() {
    var box = document.getElementById('feed');
    if (!box) return;
    var list = sorted().slice(0, S.feedLimit || 6);
    var html = list.map(function (e) {
      var s = byId(e.section) || { name: '未分类', kind: 'file' };
      var text = [e.title, e.summary, (e.tags || []).join(' '), s.name].join(' ');
      return '<a class="item" href="' + (e.url || '#') + '" data-text="' + esc(text) + '">' +
        '<span class="badge ' + badgeClass(s.kind) + '">' + esc(s.name) + '</span>' +
        '<div><h4>' + esc(e.title) + '</h4><p>' + esc(e.summary || '') + '</p></div>' +
        '<span class="date">' + shortDate(e.date) + '</span>' +
        '</a>';
    }).join('');
    box.innerHTML = html + '<div class="empty" id="empty" hidden>没有匹配的结果，按回车去全部归档里搜。</div>';
  }

  /* ---------- 首页：项目 ---------- */
  function renderProjects() {
    var box = document.getElementById('projects');
    if (!box) return;
    box.innerHTML = S.projects.map(function (p) {
      var links = (p.links || []).map(function (l) {
        if (!l.url || l.url === '#') {
          return '<span class="off" title="链接还没填">' + esc(l.text) + '</span>';
        }
        return '<a href="' + esc(l.url) + '">' + esc(l.text) + '</a>';
      }).join('');
      return '<article class="project reveal">' +
        '<div class="ph-top"><span class="st ' + esc(p.status) + '"><i></i>' + esc(p.statusText) + '</span>' +
        '<span class="yr">' + esc(p.year) + '</span></div>' +
        '<h3>' + esc(p.name) + '</h3><p>' + esc(p.desc) + '</p>' +
        '<div class="stack">' + (p.stack || []).map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>' +
        '<div class="links">' + links + '</div>' +
        '</article>';
    }).join('');
  }

  /* ---------- 证书行（首页摘要 + 证书页共用） ---------- */
  function certRow(c) {
    var verify;
    if (c.url && c.url !== '#') {
      verify = '<a class="vf" href="' + esc(c.url) + '">验证 ↗</a>';
    } else if (c.note) {
      verify = '<span class="vf none">' + esc(c.note) + '</span>';
    } else {
      verify = '<span class="vf none" title="在后台补上验证链接即可显示">待补充</span>';
    }
    return '<div class="cert-row" data-type="' + esc(c.cat) + '" data-text="' + esc(c.name + ' ' + c.org) + '">' +
      '<div class="nm"><span class="seal">◉</span><span><b>' + esc(c.name) + '</b><small>' + esc(c.code) + '</small></span></div>' +
      '<div class="org">' + esc(c.org) + '</div>' +
      '<div class="dt">' + esc(c.date) + '</div>' +
      '<div class="no">' + esc(c.no) + '</div>' +
      verify + '</div>';
  }
  function renderCerts(limit) {
    var box = document.getElementById('certs');
    if (!box) return;
    var list = limit ? S.certs.slice(0, limit) : S.certs;
    box.innerHTML = list.map(certRow).join('') +
      '<div class="empty" id="empty" hidden>没有符合条件的证书。</div>';
  }

  /* ---------- 首页：数字 ---------- */
  function renderStats() {
    var box = document.getElementById('hstats');
    if (!box) return;
    box.innerHTML = (S.heroStats || []).map(function (id) {
      var s = byId(id);
      if (!s) return '';
      return '<div class="it"><div class="n" data-count="' + countOf(id) + '">' + countOf(id) +
        '<em>' + esc(s.unit || '') + '</em></div><div class="t">' + esc(s.name) + '</div></div>';
    }).join('');
  }

  /* ---------- 首页：状态面板（真实数据，不再写死） ---------- */
  function renderPanel() {
    var box = document.getElementById('panelRows');
    if (!box) return;

    var entries = S.entries;
    var week = entries.filter(function (e) {
      var d = daysAgo(e.date);
      return d !== null && d >= 0 && d < 7;
    }).length;

    var dates = entries.map(function (e) { return e.date; }).filter(Boolean).sort();
    var last = dates.length ? dates[dates.length - 1] : '';
    var ago = daysAgo(last);

    var words = entries.reduce(function (sum, e) { return sum + (e.words || 0); }, 0);

    var tags = unique([].concat.apply([], entries.map(function (e) { return e.tags || []; })));

    var rows = [
      { c: 'var(--mint)', l: '本周新增', r: week + ' 篇' },
      { c: 'var(--amber)', l: '最近更新', r: ago === null ? '还没有内容' : (ago <= 0 ? '今天' : ago + ' 天前') },
      { c: 'var(--blue)', l: '全站字数', r: words.toLocaleString('en-US') + ' 字' },
      { c: 'var(--violet)', l: '标签', r: tags.length + ' 个' }
    ];

    box.innerHTML = rows.map(function (r) {
      return '<div class="p-row"><span class="l"><i class="d" style="background:' + r.c + '"></i>' + r.l + '</span>' +
        '<span class="r">' + esc(r.r) + '</span></div>';
    }).join('');
  }

  /* ---------- 首页：热力图（按真实发文日期） ---------- */
  function renderHeat() {
    var heat = document.getElementById('heat');
    if (!heat) return;
    var data = S.activity || [];
    var end = new Date();
    end.setHours(0, 0, 0, 0);
    var frag = document.createDocumentFragment();

    data.forEach(function (v, i) {
      var d = new Date(end);
      d.setDate(d.getDate() - (data.length - 1 - i));
      var cell = document.createElement('i');
      var lv = v >= 4 ? 'l4' : v >= 3 ? 'l3' : v >= 2 ? 'l2' : v >= 1 ? 'l1' : '';
      if (lv) cell.className = lv;
      cell.title = shortDate(fmtDate(d)) + ' · ' + (v ? v + ' 篇' : '没有更新');
      frag.appendChild(cell);
    });
    heat.innerHTML = '';
    heat.appendChild(frag);
  }

  /* ---------- 首页：主题标签（按真实标签聚合） ---------- */
  function renderTopics() {
    var box = document.getElementById('topics');
    if (!box) return;
    var counts = {};
    S.entries.forEach(function (e) {
      (e.tags || []).forEach(function (t) { counts[t] = (counts[t] || 0) + 1; });
    });
    var keys = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 8);
    if (!keys.length) {
      box.parentNode.style.display = 'none';
      return;
    }
    box.innerHTML = keys.map(function (k) {
      return '<a href="list.html?tag=' + encodeURIComponent(k) + '">' + esc(k) + '</a>';
    }).join('') + '<a href="list.html">全部 →</a>';
  }

  /* ---------- 首页：搜索框过滤「最近更新」，回车去全站搜 ---------- */
  function bindFeedSearch() {
    var q = document.getElementById('q');
    if (!q) return;
    var rows = Array.prototype.slice.call(document.querySelectorAll('#feed .item'));
    var empty = document.querySelector('#feed .empty');

    function apply() {
      var key = (q.value || '').trim().toLowerCase();
      var shown = 0;
      rows.forEach(function (r) {
        var text = ((r.getAttribute('data-text') || '') + ' ' + r.textContent).toLowerCase();
        var hit = !key || text.indexOf(key) > -1;
        r.style.display = hit ? '' : 'none';
        if (hit) shown++;
      });
      if (empty) empty.hidden = shown > 0;
    }

    q.addEventListener('input', apply);
    q.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var v = (q.value || '').trim();
      if (v) location.href = 'list.html?q=' + encodeURIComponent(v);
    });
  }

  /* ---------- 列表页（数据驱动：类型 / 标签 / 年份 / 关键词 / 分页） ---------- */
  var PAGE_SIZE = 10;

  function initList() {
    var sId = param('s');
    var sec = sId ? byId(sId) : null;
    var gone = !!sId && !sec;                       // 带了参数但分区已被删掉

    var state = {
      type: sec ? sec.id : (sId || 'all'),
      tag: param('tag'),
      year: param('year'),
      q: param('q'),
      page: parseInt(param('page'), 10) || 1
    };

    var box = document.getElementById('entries');
    var pager = document.getElementById('pager');
    var chips = document.getElementById('typeChips');
    var meta = document.getElementById('listMeta');
    var sub = document.getElementById('listSub');
    var qInput = document.getElementById('q');
    var tagBox = document.getElementById('tagCloud');
    var yearBox = document.getElementById('yearCloud');
    var crumb = document.getElementById('crumbNow');
    var h1 = document.getElementById('listTitle');

    if (qInput) qInput.value = state.q;

    function headText() {
      if (gone) return '分区不存在';
      if (state.type === 'all') return '全部归档';
      var t = byId(state.type);
      return t ? t.name : '全部归档';
    }

    /* skipTag=true 时忽略标签条件，让侧栏标签云始终能切换 */
    function filtered(skipTag) {
      return sorted().filter(function (e) {
        if (state.type !== 'all' && e.section !== state.type) return false;
        if (!skipTag && state.tag && (e.tags || []).indexOf(state.tag) < 0) return false;
        if (state.year && yearOf(e.date) !== state.year) return false;
        if (state.q) {
          var key = state.q.toLowerCase();
          var text = [e.title, e.summary, (e.tags || []).join(' ')].join(' ').toLowerCase();
          if (text.indexOf(key) < 0) return false;
        }
        return true;
      });
    }

    function renderChips() {
      if (!chips) return;
      var total = S.entries.length;
      var html = '<button class="chip' + (state.type === 'all' ? ' on' : '') + '" data-type="all">全部 <span class="c">' + total + '</span></button>';
      S.sections.forEach(function (s) {
        var n = entryCount(s.id);
        if (!n) return;
        html += '<button class="chip' + (state.type === s.id ? ' on' : '') + '" data-type="' + s.id + '">' +
          esc(s.name) + ' <span class="c">' + n + '</span></button>';
      });
      chips.innerHTML = html;
    }

    function renderSide(rows) {
      if (tagBox) {
        var counts = {};
        rows.forEach(function (e) { (e.tags || []).forEach(function (t) { counts[t] = (counts[t] || 0) + 1; }); });
        var keys = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
        tagBox.innerHTML = keys.map(function (k) {
          return '<a href="#" data-tag="' + esc(k) + '"' + (state.tag === k ? ' class="on"' : '') + '>' +
            esc(k) + ' <i>' + counts[k] + '</i></a>';
        }).join('') || '<span style="font-size:12px;color:var(--dim-2)">暂无标签</span>';
      }
      if (yearBox) {
        var yc = {};
        rows.forEach(function (e) { var y = yearOf(e.date); if (y) yc[y] = (yc[y] || 0) + 1; });
        var ys = Object.keys(yc).sort().reverse();
        yearBox.innerHTML = ys.map(function (y) {
          return '<a href="#" data-year="' + esc(y) + '"' + (state.year === y ? ' class="on"' : '') + '>' +
            y + ' <i>' + yc[y] + '</i></a>';
        }).join('') || '<span style="font-size:12px;color:var(--dim-2)">暂无</span>';
      }
    }

    function renderPager(total) {
      if (!pager) return;
      var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      if (state.page > pages) state.page = pages;
      if (state.page < 1) state.page = 1;
      if (pages <= 1) { pager.innerHTML = ''; pager.hidden = true; return; }

      var html = '<span class="pg' + (state.page === 1 ? ' dis' : '') + '" data-page="' + (state.page - 1) + '">← 上一页</span>';
      html += '<div class="pages">';
      for (var i = 1; i <= pages; i++) {
        if (pages > 7 && i > 2 && i < pages - 1 && Math.abs(i - state.page) > 1) {
          if (i === 3) html += '<span class="pg dis">…</span>';
          continue;
        }
        html += '<span class="pg' + (i === state.page ? ' on' : '') + '" data-page="' + i + '">' + i + '</span>';
      }
      html += '</div>';
      html += '<span class="pg' + (state.page === pages ? ' dis' : '') + '" data-page="' + (state.page + 1) + '">下一页 →</span>';
      pager.innerHTML = html;
      pager.hidden = false;
    }

    function render() {
      var rows = filtered(false);
      var sideRows = filtered(true);
      var start = (state.page - 1) * PAGE_SIZE;
      var pageRows = rows.slice(start, start + PAGE_SIZE);

      if (h1) h1.textContent = headText();
      if (crumb) crumb.textContent = headText();
      if (sub) {
        var extra = [];
        if (state.tag) extra.push('标签「' + state.tag + '」');
        if (state.year) extra.push(state.year + ' 年');
        if (state.q) extra.push('关键词「' + state.q + '」');
        var active = state.type === 'all' ? null : byId(state.type);
        sub.textContent = extra.length
          ? '筛选中：' + extra.join(' · ') + '，共 ' + rows.length + ' 条。'
          : (gone ? '这个分区可能已经被删掉了，回首页看看现在有哪些分区。'
            : (active ? (active.desc || '') : '所有分区的条目按时间倒序排列。'));
      }

      if (meta) {
        var years = rows.map(function (r) { return yearOf(r.date); }).filter(Boolean).sort();
        var pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
        meta.innerHTML = '<span>' + rows.length + ' 条</span>' +
          (rows.length ? '<span class="dot"></span><span>最近更新 ' + rows[0].date + '</span>' : '') +
          (years.length && !state.year ? '<span class="dot"></span><span>' + years[0] + ' — ' + years[years.length - 1] + '</span>' : '') +
          (pages > 1 ? '<span class="dot"></span><span>第 ' + state.page + ' / ' + pages + ' 页</span>' : '');
      }

      if (box) {
        if (!rows.length) {
          box.innerHTML = '<div class="empty">' + (gone ? '这个分区不存在。' : '没有符合条件的条目，换个关键词或类型试试。') + '</div>';
        } else {
          box.innerHTML = pageRows.map(function (e) {
            var s = byId(e.section) || { name: '未分类', kind: 'file' };
            return '<a class="entry" href="' + (e.url || '#') + '" data-text="' +
              esc([e.title, e.summary, (e.tags || []).join(' ')].join(' ')) + '">' +
              '<div class="when"><span class="d">' + shortDate(e.date) + '</span><span class="y">' + yearOf(e.date) + '</span></div>' +
              '<div><h2><span class="badge ' + badgeClass(s.kind) + '">' + esc(s.name) + '</span> ' + esc(e.title) + '</h2>' +
              '<p>' + esc(e.summary || '') + '</p>' +
              '<div class="foot">' + (e.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') +
              (e.minutes ? '<span class="read">' + e.minutes + ' min</span>' : '') + '</div></div></a>';
          }).join('');
        }
      }

      renderChips();
      renderSide(sideRows);
      renderPager(rows.length);
      syncURL();

      /* 新渲染出来的元素需要重新挂揭示动画 */
      if (window.__revealRefresh) window.__revealRefresh();
    }

    function syncURL() {
      var parts = [];
      if (state.type !== 'all') parts.push('s=' + state.type);
      if (state.tag) parts.push('tag=' + encodeURIComponent(state.tag));
      if (state.year) parts.push('year=' + encodeURIComponent(state.year));
      if (state.q) parts.push('q=' + encodeURIComponent(state.q));
      if (state.page > 1) parts.push('page=' + state.page);
      try {
        history.replaceState(null, '', 'list.html' + (parts.length ? '?' + parts.join('&') : ''));
      } catch (err) { /* file:// 下会被拦，忽略 */ }
    }

    /* 事件绑定 */
    if (chips) {
      chips.addEventListener('click', function (e) {
        var btn = e.target.closest('.chip');
        if (!btn) return;
        state.type = btn.getAttribute('data-type');
        state.tag = '';
        state.page = 1;
        if (h1) document.title = headText() + ' · ' + S.brand;
        render();
      });
    }
    if (pager) {
      pager.addEventListener('click', function (e) {
        var btn = e.target.closest('.pg');
        if (!btn || btn.classList.contains('dis')) return;
        var n = parseInt(btn.getAttribute('data-page'), 10);
        if (!n || n === state.page) return;
        state.page = n;
        render();
        var top = document.querySelector('.toolbar');
        if (top) window.scrollTo({ top: top.offsetTop - 90, behavior: 'smooth' });
      });
    }
    if (tagBox) {
      tagBox.addEventListener('click', function (e) {
        var a = e.target.closest('a[data-tag]');
        if (!a) return;
        e.preventDefault();
        var t = a.getAttribute('data-tag');
        state.tag = state.tag === t ? '' : t;
        state.page = 1;
        render();
      });
    }
    if (yearBox) {
      yearBox.addEventListener('click', function (e) {
        var a = e.target.closest('a[data-year]');
        if (!a) return;
        e.preventDefault();
        var y = a.getAttribute('data-year');
        state.year = state.year === y ? '' : y;
        state.page = 1;
        render();
      });
    }
    if (qInput) {
      qInput.addEventListener('input', function () {
        state.q = (qInput.value || '').trim();
        state.page = 1;
        render();
      });
    }

    document.title = headText() + ' · ' + S.brand;
    render();
  }

  /* ---------- 证书页 ---------- */
  function initCerts() {
    document.title = '证书 · ' + S.brand;
    var meta = document.getElementById('listMeta');
    if (meta) {
      var dates = S.certs.map(function (c) { return c.date; }).sort();
      meta.innerHTML = '<span>' + S.certs.length + ' 张</span><span class="dot"></span>' +
        '<span>最早 ' + (dates[0] || '—') + '</span><span class="dot"></span>' +
        '<span>最近 ' + (dates[dates.length - 1] || '—') + '</span>';
    }
    renderCerts(0);

    var chips = document.getElementById('typeChips');
    if (chips) {
      var cats = [];
      S.certs.forEach(function (c) { if (cats.indexOf(c.cat) < 0) cats.push(c.cat); });
      var names = {};
      S.certs.forEach(function (c) { names[c.cat] = c.catName; });
      chips.innerHTML = '<button class="chip on" data-type="all">全部 <span class="c">' + S.certs.length + '</span></button>' +
        cats.map(function (k) {
          var n = S.certs.filter(function (c) { return c.cat === k; }).length;
          return '<button class="chip" data-type="' + k + '">' + esc(names[k]) + ' <span class="c">' + n + '</span></button>';
        }).join('');
    }
    bindFilter('#typeChips', '#certs', '.cert-row', 'all');

    var q = document.getElementById('q');
    if (q && param('q')) {
      q.value = param('q');
      q.dispatchEvent(new Event('input'));
    }
  }

  /* ---------- 筛选 + 搜索（证书页） ---------- */
  function bindFilter(chipSel, listSel, rowSel, defaultType) {
    var chips = Array.prototype.slice.call(document.querySelectorAll(chipSel + ' .chip'));
    var rows = Array.prototype.slice.call(document.querySelectorAll(listSel + ' ' + rowSel));
    var empty = document.querySelector(listSel + ' .empty');
    var q = document.getElementById('q');
    var cur = defaultType || 'all';

    function apply() {
      var key = q ? (q.value || '').trim().toLowerCase() : '';
      var shown = 0;
      rows.forEach(function (r) {
        var okType = cur === 'all' || r.getAttribute('data-type') === cur;
        var text = ((r.getAttribute('data-text') || '') + ' ' + r.textContent).toLowerCase();
        var okKey = !key || text.indexOf(key) > -1;
        var hit = okType && okKey;
        r.style.display = hit ? '' : 'none';
        if (hit) shown++;
      });
      if (empty) empty.hidden = shown > 0;
    }

    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        chips.forEach(function (x) { x.classList.remove('on'); });
        c.classList.add('on');
        cur = c.getAttribute('data-type');
        apply();
      });
    });
    if (q) q.addEventListener('input', apply);
  }

  /* ---------- 代码复制 ---------- */
  function copyText(text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
      return;
    }
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    document.body.removeChild(ta);
    done(ok);
  }

  function initCodeCopy() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-copy]') : null;
      if (!btn) return;
      var pre = btn.parentNode ? btn.parentNode.nextElementSibling : null;
      if (!pre || pre.tagName !== 'PRE') return;
      var code = pre.innerText || pre.textContent || '';
      copyText(code, function (ok) {
        btn.textContent = ok ? '已复制' : '复制失败';
        btn.classList.add('done');
        setTimeout(function () {
          btn.textContent = '复制';
          btn.classList.remove('done');
        }, 1600);
      });
    });
  }

  /* ---------- 滚动揭示（不依赖 IntersectionObserver，保证内容一定出现） ---------- */
  var revealBound = false;

  function revealInView() {
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var els = document.querySelectorAll('.reveal');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.classList.contains('in')) continue;
      var r = el.getBoundingClientRect();
      if (r.top < vh - 36) {
        el.style.transitionDelay = Math.min(i * 45, 280) + 'ms';
        el.classList.add('in');
      }
    }
  }

  function initReveal() {
    if (!revealBound) {
      var ticking = false;
      window.addEventListener('scroll', function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () { revealInView(); ticking = false; });
      }, { passive: true });
      window.addEventListener('resize', revealInView);
      window.addEventListener('load', revealInView);
      revealBound = true;
    }
    revealInView();
  }

  /* ---------- 数字滚动（带兜底：动画没跑完也必须显示真实值） ---------- */
  function initCounters() {
    var nums = document.querySelectorAll('.hstats .n[data-count]');

    function animate(el) {
      var target = parseInt(el.getAttribute('data-count'), 10) || 0;
      var unit = el.querySelector('em');
      var unitHTML = unit ? unit.outerHTML : '';
      var t0 = null;
      var done = false;

      function finish() {
        if (done) return;
        done = true;
        el.innerHTML = target + unitHTML;
      }
      function step(ts) {
        if (done) return;
        if (!t0) t0 = ts;
        var p = Math.min((ts - t0) / 900, 1);
        el.innerHTML = Math.round(target * (1 - Math.pow(1 - p, 3))) + unitHTML;
        if (p < 1) requestAnimationFrame(step);
        else finish();
      }

      requestAnimationFrame(step);
      setTimeout(finish, 1500);   /* 后台标签页 rAF 会被挂起，这里强制落到终值 */
    }

    Array.prototype.forEach.call(nums, animate);
  }

  /* ---------- 搜索快捷键 ---------- */
  function initSearchKey() {
    var q = document.getElementById('q');
    var btn = document.getElementById('focusSearch');
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (q) { q.focus(); q.select(); }
      }
      if (e.key === 'Escape' && q && document.activeElement === q) q.blur();
    });
    if (btn && q) {
      btn.addEventListener('click', function () {
        q.focus();
        q.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }

  /* ---------- 启动 ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    var page = document.body.getAttribute('data-page');
    var bodySection = document.body.getAttribute('data-section');

    if (page === 'index') {
      renderNav('home');
      renderStats();
      renderModules();
      renderFeed();
      renderProjects();
      renderCerts(4);
      renderPanel();
      renderHeat();
      renderTopics();
      bindFeedSearch();
    } else if (page === 'list') {
      renderNav(param('s'));
      initList();
    } else if (page === 'certs') {
      renderNav('certs');
      initCerts();
    } else if (page === 'post') {
      renderNav(bodySection || param('s'));
    } else if (page === '404') {
      renderNav('');
    }

    renderFooter();
    initNavToggle();
    initCodeCopy();
    initSearchKey();

    window.__revealRefresh = initReveal;
    initReveal();
    initCounters();
  });
})();

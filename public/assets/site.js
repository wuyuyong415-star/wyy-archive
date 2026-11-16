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
    return m ? decodeURIComponent(m[1]) : '';
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
    box.innerHTML = html + '<div class="empty" id="empty" hidden>没有匹配的结果，换个关键词试试。</div>';
  }

  /* ---------- 首页：项目 ---------- */
  function renderProjects() {
    var box = document.getElementById('projects');
    if (!box) return;
    box.innerHTML = S.projects.map(function (p) {
      return '<article class="project reveal">' +
        '<div class="ph-top"><span class="st ' + p.status + '"><i></i>' + esc(p.statusText) + '</span>' +
        '<span class="yr">' + esc(p.year) + '</span></div>' +
        '<h3>' + esc(p.name) + '</h3><p>' + esc(p.desc) + '</p>' +
        '<div class="stack">' + (p.stack || []).map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>' +
        '<div class="links">' + (p.links || []).map(function (l) { return '<a href="' + l.url + '">' + esc(l.text) + '</a>'; }).join('') + '</div>' +
        '</article>';
    }).join('');
  }

  /* ---------- 证书行（首页摘要 + 证书页共用） ---------- */
  function certRow(c) {
    var verify = c.url
      ? '<a class="vf" href="' + c.url + '">验证 ↗</a>'
      : '<span class="vf none">' + esc(c.note || '无公开链接') + '</span>';
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

  /* ---------- 首页：搜索框过滤「最近更新」 ---------- */
  function bindFeedSearch() {
    var q = document.getElementById('q');
    if (!q) return;
    var rows = Array.prototype.slice.call(document.querySelectorAll('#feed .item'));
    var empty = document.querySelector('#feed .empty');
    q.addEventListener('input', function () {
      var key = (q.value || '').trim().toLowerCase();
      var shown = 0;
      rows.forEach(function (r) {
        var text = ((r.getAttribute('data-text') || '') + ' ' + r.textContent).toLowerCase();
        var hit = !key || text.indexOf(key) > -1;
        r.style.display = hit ? '' : 'none';
        if (hit) shown++;
      });
      if (empty) empty.hidden = shown > 0;
    });
  }

  /* ---------- 列表页 ---------- */
  function initList() {
    var id = param('s');
    var sec = id ? byId(id) : null;
    var isAll = !id;            // 只有不带参数才是「全部归档」
    var gone = !!id && !sec;    // 带了参数但分区已被删掉
    var pageName = sec ? sec.name : (gone ? '分区不存在' : '全部归档');

    document.title = pageName + ' · ' + S.brand;

    var crumb = document.getElementById('crumbNow');
    if (crumb) crumb.textContent = pageName;

    var h1 = document.getElementById('listTitle');
    if (h1) h1.textContent = pageName;

    var sub = document.getElementById('listSub');
    if (sub) sub.textContent = sec ? (sec.desc || '')
      : (gone ? '这个分区可能已经被删掉了，回首页看看现在有哪些分区。' : '所有分区的条目按时间倒序排列。');

    var rows = sorted().filter(function (e) {
      return isAll || (sec && e.section === sec.id);
    });

    var meta = document.getElementById('listMeta');
    if (meta) {
      var years = rows.map(function (r) { return yearOf(r.date); }).filter(Boolean).sort();
      meta.innerHTML = '<span>' + rows.length + ' 条</span><span class="dot"></span>' +
        '<span>' + (rows.length ? '最近更新 ' + rows[0].date : '还没有内容') + '</span>' +
        (years.length ? '<span class="dot"></span><span>' + years[0] + ' — ' + years[years.length - 1] + '</span>' : '');
    }

    /* 类型 chips：分区删了，chip 自动消失 */
    var chips = document.getElementById('typeChips');
    if (chips) {
      var html = '<button class="chip' + (isAll ? ' on' : '') + '" data-type="all">全部 <span class="c">' + S.entries.length + '</span></button>';
      S.sections.forEach(function (s) {
        var n = entryCount(s.id);
        if (!n && !(sec && sec.id === s.id)) return;
        html += '<button class="chip' + (sec && sec.id === s.id ? ' on' : '') + '" data-type="' + s.id + '">' +
          esc(s.name) + ' <span class="c">' + n + '</span></button>';
      });
      chips.innerHTML = html;
    }

    var box = document.getElementById('entries');
    if (box) {
      if (!rows.length) {
        box.innerHTML = '<div class="empty">' + (gone ? '这个分区不存在。' : '这个分区还没有条目。') + '</div>';
      } else {
        box.innerHTML = rows.map(function (e) {
          var s = byId(e.section) || { name: '未分类', kind: 'file' };
          return '<a class="entry" href="' + (e.url || '#') + '" data-type="' + e.section + '" data-text="' +
            esc([e.title, e.summary, (e.tags || []).join(' ')].join(' ')) + '">' +
            '<div class="when"><span class="d">' + shortDate(e.date) + '</span><span class="y">' + yearOf(e.date) + '</span></div>' +
            '<div><h2><span class="badge ' + badgeClass(s.kind) + '">' + esc(s.name) + '</span> ' + esc(e.title) + '</h2>' +
            '<p>' + esc(e.summary || '') + '</p>' +
            '<div class="foot">' + (e.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') +
            (e.minutes ? '<span class="read">' + e.minutes + ' min</span>' : '') + '</div></div></a>';
        }).join('') + '<div class="empty" hidden>没有匹配的条目，换个关键词或类型。</div>';
      }
    }

    /* 侧栏：主题聚合 */
    var tagBox = document.getElementById('tagCloud');
    if (tagBox) {
      var counts = {};
      rows.forEach(function (e) { (e.tags || []).forEach(function (t) { counts[t] = (counts[t] || 0) + 1; }); });
      var keys = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
      tagBox.innerHTML = keys.map(function (k) {
        return '<a href="list.html?s=' + (sec ? sec.id : '') + '&tag=' + encodeURIComponent(k) + '">' + esc(k) + ' <i>' + counts[k] + '</i></a>';
      }).join('') || '<span style="font-size:12px;color:var(--dim-2)">暂无标签</span>';
    }

    /* 侧栏：年份聚合 */
    var yearBox = document.getElementById('yearCloud');
    if (yearBox) {
      var yc = {};
      rows.forEach(function (e) { var y = yearOf(e.date); if (y) yc[y] = (yc[y] || 0) + 1; });
      yearBox.innerHTML = Object.keys(yc).sort().reverse().map(function (y) {
        return '<a href="#">' + y + ' <i>' + yc[y] + '</i></a>';
      }).join('') || '<span style="font-size:12px;color:var(--dim-2)">暂无</span>';
    }

    bindFilter('#typeChips', '#entries', '.entry', sec ? sec.id : 'all');
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
  }

  /* ---------- 筛选 + 搜索 ---------- */
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

  /* ---------- 滚动揭示（渲染完再挂） ---------- */
  function initReveal() {
    var els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(els, function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.06 });
    Array.prototype.forEach.call(els, function (el, i) {
      el.style.transitionDelay = Math.min(i * 45, 280) + 'ms';
      io.observe(el);
    });
  }

  /* ---------- 数字滚动 ---------- */
  function initCounters() {
    var nums = document.querySelectorAll('.hstats .n[data-count]');
    if (!nums.length || !('IntersectionObserver' in window)) return;
    var nio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target; nio.unobserve(el);
        var target = parseInt(el.getAttribute('data-count'), 10) || 0;
        var unit = el.querySelector('em');
        var unitHTML = unit ? unit.outerHTML : '';
        var t0 = null;
        function step(ts) {
          if (!t0) t0 = ts;
          var p = Math.min((ts - t0) / 900, 1);
          el.innerHTML = Math.round(target * (1 - Math.pow(1 - p, 3))) + unitHTML;
          if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      });
    }, { threshold: 0.4 });
    Array.prototype.forEach.call(nums, function (n) { nio.observe(n); });
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
        q.focus(); q.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }

  /* ---------- 启动 ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    var page = document.body.getAttribute('data-page');

    if (page === 'index') {
      renderNav('home'); renderStats(); renderModules(); renderFeed(); renderProjects(); renderCerts(4);
      bindFeedSearch();
    } else if (page === 'list') {
      var id = param('s');
      renderNav(id); initList();
    } else if (page === 'certs') {
      renderNav('certs'); initCerts();
    } else if (page === 'post') {
      renderNav(param('s') || 'notes');
    }

    initReveal(); initCounters(); initSearchKey();
  });
})();

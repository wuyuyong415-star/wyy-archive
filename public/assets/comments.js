/* 评论：匿名昵称，纯文本。数据存在 Cloudflare D1，接口在 src/worker.js。 */
(function () {
  'use strict';

  var box = document.getElementById('comments');
  if (!box) return;

  var post = (document.body.getAttribute('data-post') || '').trim();
  if (!post) return;

  var listEl = document.getElementById('cList');
  var emptyEl = document.getElementById('cEmpty');
  var countEl = document.getElementById('cCount');
  var form = document.getElementById('cForm');
  var nameEl = document.getElementById('cName');
  var bodyEl = document.getElementById('cBody');
  var hpEl = document.getElementById('cHp');
  var msgEl = document.getElementById('cMsg');
  var sendEl = document.getElementById('cSend');

  var NAME_KEY = 'wyy.comment.name';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function ago(ts) {
    var diff = Date.now() / 1000 - ts;
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
    if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
    if (diff < 86400 * 7) return Math.floor(diff / 86400) + ' 天前';
    var d = new Date(ts * 1000);
    var p = function (n) { return n < 10 ? '0' + n : String(n); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function setMsg(text, tone) {
    msgEl.textContent = text || '';
    msgEl.className = 'c-msg' + (tone ? ' ' + tone : '');
  }

  function row(c) {
    return (
      '<div class="c-item">' +
      '<div class="c-meta"><b>' + esc(c.name) + '</b><time>' + esc(ago(c.createdAt)) + '</time></div>' +
      '<div class="c-text">' + esc(c.body) + '</div>' +
      '</div>'
    );
  }

  function paint(comments) {
    listEl.innerHTML = comments.map(row).join('');
    emptyEl.hidden = comments.length > 0;
    countEl.textContent = comments.length ? ' · ' + comments.length : '';
  }

  function load() {
    fetch('/api/comments?post=' + encodeURIComponent(post), { headers: { accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        box.hidden = false;
        paint((data && data.comments) || []);
      })
      .catch(function () {
        /* 接口没接通（比如数据库还没建）时不显示空评论区，避免让人以为发了没反应 */
        box.hidden = true;
      });
  }

  function submit(e) {
    e.preventDefault();
    var name = nameEl.value.trim();
    var text = bodyEl.value.trim();
    if (!name) { setMsg('先填个昵称', 'bad'); nameEl.focus(); return; }
    if (!text) { setMsg('内容还是空的', 'bad'); bodyEl.focus(); return; }

    sendEl.disabled = true;
    setMsg('发送中…');

    fetch('/api/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ post: post, name: name, body: text, hp: hpEl.value })
    })
      .then(function (r) {
        return r.json().then(function (d) { return { ok: r.ok, status: r.status, data: d }; });
      })
      .then(function (res) {
        if (!res.ok) {
          setMsg((res.data && res.data.error) || '发送失败，过会儿再试', 'bad');
          return;
        }
        if (res.data && res.data.comment) {
          var items = listEl.querySelectorAll('.c-item');
          listEl.insertAdjacentHTML('beforeend', row(res.data.comment));
          emptyEl.hidden = true;
          countEl.textContent = ' · ' + (items.length + 1);
          bodyEl.value = '';
          try { localStorage.setItem(NAME_KEY, name); } catch (err) {}
          setMsg('发出去了', 'good');
          listEl.lastElementChild.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
          bodyEl.value = '';
          setMsg('发出去了', 'good');
        }
      })
      .catch(function () {
        setMsg('网络不通，没发出去', 'bad');
      })
      .then(function () {
        sendEl.disabled = false;
      });
  }

  try {
    var saved = localStorage.getItem(NAME_KEY);
    if (saved) nameEl.value = saved;
  } catch (err) {}

  form.addEventListener('submit', submit);
  load();
})();

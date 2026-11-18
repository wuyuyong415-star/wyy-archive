/* =========================================================
   夜空背景 — 星野 + 银河带 + 偶发流星
   纯 Canvas 本地绘制，无外部图片、无第三方库、无网络请求
   设计要点：
     · 确定性伪随机 → 每次打开是同一片星空（可预测、不闪变）
     · 深空蓝紫渐变 + 斜向银河带 + 淡星云
     · 星分三档：微尘 / 普通 / 亮星（带光晕）
     · 流星 8~18 秒一次，带分叉尾迹；约每 4 颗有一次大的
     · 尊重 prefers-reduced-motion：只画静态星空，不闪烁不划流星
     · 标签页隐藏时暂停；帧率上限 30fps
   ========================================================= */
(function () {
  'use strict';

  var canvas = document.getElementById('sky');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var W = 0, H = 0, DPR = 1;
  var stars = [];
  var meteors = [];
  var meteorCount = 0;
  var nextMeteorAt = 0;
  var rafId = null;
  var lastFrame = 0;
  var clock = 0;

  /* 确定性伪随机：同一次会话内稳定，不多次跳变 */
  var seed = 20261119;
  function rnd() {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  }
  function between(a, b) { return a + rnd() * (b - a); }

  /* 银河带的方向：从右上斜向左下（弧度） */
  var BAND_ANGLE = -0.38;

  function bandPoint(t) {
    // 沿银河带中心线取点，t ∈ [0,1]
    var cx = W / 2, cy = H * 0.52;
    var len = Math.sqrt(W * W + H * H) * 0.62;
    var ux = Math.cos(BAND_ANGLE), uy = Math.sin(BAND_ANGLE);
    return [cx + ux * (t - 0.5) * len, cy + uy * (t - 0.5) * len];
  }

  function buildStars() {
    stars = [];
    var area = W * H;
    var total = Math.round(area / 2600);
    total = Math.max(260, Math.min(total, 900));

    for (var i = 0; i < total; i++) {
      var x, y;

      // 约四成的星集中在银河带附近，其余撒满全屏
      if (rnd() < 0.55) {
        var p = bandPoint(rnd());
        var spread = Math.abs(between(-1, 1)) * between(6, H * 0.17);
        // 银河带法线方向偏移
        x = p[0] - Math.sin(BAND_ANGLE) * spread;
        y = p[1] + Math.cos(BAND_ANGLE) * spread;
      } else {
        x = rnd() * W;
        y = rnd() * H;
      }
      if (x < -40 || x > W + 40 || y < -40 || y > H + 40) continue;

      var roll = rnd();
      var tier = roll > 0.955 ? 2 : roll > 0.79 ? 1 : 0;
      var r = tier === 2 ? between(1.1, 1.7) : tier === 1 ? between(0.7, 1.05) : between(0.35, 0.62);
      var base = tier === 2 ? between(0.85, 1) : tier === 1 ? between(0.58, 0.86) : between(0.3, 0.56);

      // 星色：冷白为主，少量暖白与淡蓝
      var hueRoll = rnd();
      var tint = hueRoll > 0.9 ? [255, 226, 196] : hueRoll > 0.62 ? [206, 224, 255] : [236, 241, 255];

      stars.push({
        x: x, y: y, r: r, base: base, tint: tint, tier: tier,
        phase: rnd() * Math.PI * 2,
        speed: between(0.25, 1.05)
      });
    }
  }

  function drawSkyBase() {
    // 深空渐变：顶部近黑偏蓝，中部靛蓝，底部略带青
    var g = ctx.createLinearGradient(0, 0, W * 0.25, H);
    g.addColorStop(0, '#03050b');
    g.addColorStop(0.34, '#060a14');
    g.addColorStop(0.66, '#080d1c');
    g.addColorStop(0.88, '#0a1122');
    g.addColorStop(1, '#070c18');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 淡星云：紫（右上）与青（左下）
    var neb1 = ctx.createRadialGradient(W * 0.86, H * 0.16, 0, W * 0.86, H * 0.16, Math.max(W, H) * 0.5);
    neb1.addColorStop(0, 'rgba(126,104,196,.10)');
    neb1.addColorStop(0.45, 'rgba(96,84,168,.045)');
    neb1.addColorStop(1, 'rgba(96,84,168,0)');
    ctx.fillStyle = neb1;
    ctx.fillRect(0, 0, W, H);

    var neb2 = ctx.createRadialGradient(W * 0.12, H * 0.82, 0, W * 0.12, H * 0.82, Math.max(W, H) * 0.46);
    neb2.addColorStop(0, 'rgba(72,158,178,.075)');
    neb2.addColorStop(0.5, 'rgba(58,124,150,.032)');
    neb2.addColorStop(1, 'rgba(58,124,150,0)');
    ctx.fillStyle = neb2;
    ctx.fillRect(0, 0, W, H);

    // 银河带：横向渐变 + 轻微加亮
    ctx.save();
    ctx.translate(W / 2, H * 0.52);
    ctx.rotate(BAND_ANGLE);
    var bandW = Math.sqrt(W * W + H * H);
    var bandH = Math.min(H * 0.34, 320);
    var bg = ctx.createLinearGradient(0, -bandH / 2, 0, bandH / 2);
    bg.addColorStop(0, 'rgba(150,168,255,0)');
    bg.addColorStop(0.38, 'rgba(150,168,255,.032)');
    bg.addColorStop(0.5, 'rgba(196,206,255,.062)');
    bg.addColorStop(0.62, 'rgba(150,168,255,.032)');
    bg.addColorStop(1, 'rgba(150,168,255,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(-bandW / 2, -bandH / 2, bandW, bandH);
    ctx.restore();
  }

  function drawStars(t) {
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var a = reduceMotion
        ? s.base
        : s.base * (0.62 + 0.38 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase)));
      if (s.tier === 2) {
        // 亮星：外圈柔光
        var halo = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 6);
        halo.addColorStop(0, 'rgba(255,255,255,' + (a * 0.5).toFixed(3) + ')');
        halo.addColorStop(0.4, 'rgba(190,210,255,' + (a * 0.14).toFixed(3) + ')');
        halo.addColorStop(1, 'rgba(190,210,255,0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(' + s.tint[0] + ',' + s.tint[1] + ',' + s.tint[2] + ',' + a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function spawnMeteor(big) {
    // 从右上方向左下方划过
    var angle = between(2.62, 2.78);            // 150°~159°，向左侧下方
    var dx = Math.cos(angle), dy = Math.sin(angle);
    var startX = W * between(0.62, 1.12);
    var startY = H * between(-0.12, 0.26);
    var len = big ? between(520, 720) : between(260, 400);
    var speed = big ? between(620, 820) : between(380, 540);

    meteors.push({
      x: startX, y: startY, dx: dx, dy: dy,
      len: len,
      speed: speed,
      width: big ? between(2.2, 3.0) : between(1.3, 1.9),
      dist: 0,
      big: big,
      split: rnd() > 0.25,
      life: 0
    });
  }

  function drawMeteors(dt) {
    if (reduceMotion) { meteors.length = 0; return; }

    for (var i = meteors.length - 1; i >= 0; i--) {
      var m = meteors[i];
      m.dist += m.speed * dt;
      m.life += dt;

      var hx = m.x + m.dx * m.dist;
      var hy = m.y + m.dy * m.dist;

      if (hx < -m.len - 140 || hy > H + m.len) { meteors.splice(i, 1); continue; }

      var fade = m.dist < 90 ? m.dist / 90 : 1;           // 出场淡入
      var grow = Math.min(1, m.dist / 170);                // 尾迹由短长到全长
      var len = m.len * grow;
      var nx = -m.dy, ny = m.dx;
      var w = m.width * (0.55 + 0.45 * grow);
      var tx = hx - m.dx * len;
      var ty = hy - m.dy * len;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      /* 主体：锥形尾，头部宽、尾端收成一点 */
      var g = ctx.createLinearGradient(tx, ty, hx, hy);
      g.addColorStop(0, 'rgba(150,185,255,0)');
      g.addColorStop(0.35, 'rgba(168,198,255,' + (0.10 * fade).toFixed(3) + ')');
      g.addColorStop(0.75, 'rgba(214,230,255,' + (0.34 * fade).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(255,255,255,' + (0.72 * fade).toFixed(3) + ')');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(hx + nx * w, hy + ny * w);
      ctx.lineTo(tx, ty);
      ctx.lineTo(hx - nx * w, hy - ny * w);
      ctx.closePath();
      ctx.fill();

      /* 亮芯：一条更细更实的线，让尾迹有骨 */
      var gc = ctx.createLinearGradient(tx, ty, hx, hy);
      gc.addColorStop(0, 'rgba(200,220,255,0)');
      gc.addColorStop(0.6, 'rgba(225,238,255,' + (0.32 * fade).toFixed(3) + ')');
      gc.addColorStop(1, 'rgba(255,255,255,' + (0.95 * fade).toFixed(3) + ')');
      ctx.strokeStyle = gc;
      ctx.lineWidth = Math.max(0.8, w * 0.42);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(hx, hy);
      ctx.stroke();

      /* 分叉尾：偏移一条更短更淡的尾迹，模拟彗尾分离 */
      if (m.split) {
        var off = w * 3.4;
        var sl = len * 0.55;
        var sx = hx + nx * off, sy = hy + ny * off;
        var stx = sx - m.dx * sl, sty = sy - m.dy * sl;
        var g2 = ctx.createLinearGradient(stx, sty, sx, sy);
        g2.addColorStop(0, 'rgba(160,190,255,0)');
        g2.addColorStop(1, 'rgba(220,235,255,' + (0.5 * fade).toFixed(3) + ')');
        ctx.strokeStyle = g2;
        ctx.lineWidth = Math.max(0.7, w * 0.3);
        ctx.beginPath();
        ctx.moveTo(stx, sty);
        ctx.lineTo(sx, sy);
        ctx.stroke();
      }

      /* 头部光晕 */
      var head = ctx.createRadialGradient(hx, hy, 0, hx, hy, w * 11);
      head.addColorStop(0, 'rgba(255,255,255,' + fade.toFixed(3) + ')');
      head.addColorStop(0.18, 'rgba(232,242,255,' + (0.6 * fade).toFixed(3) + ')');
      head.addColorStop(0.45, 'rgba(180,205,255,' + (0.16 * fade).toFixed(3) + ')');
      head.addColorStop(1, 'rgba(160,190,255,0)');
      ctx.fillStyle = head;
      ctx.beginPath();
      ctx.arc(hx, hy, w * 11, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    drawSkyBase();
    drawStars(t);
    drawMeteors((t - (draw._prev || t)) || 0);
    draw._prev = t;
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 1.75);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildStars();
    draw._prev = 0;
    draw(0);
  }

  function loop(now) {
    rafId = requestAnimationFrame(loop);
    clock = now / 1000;

    // 帧率上限：约 30fps，省电
    if (now - lastFrame < 33) return;
    var dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;

    if (now > nextMeteorAt) {
      meteorCount++;
      spawnMeteor(meteorCount % 4 === 0);
      nextMeteorAt = now + between(8000, 18000);
    }

    draw(clock);
  }

  function start() {
    if (reduceMotion) { draw(0); return; }
    lastFrame = 0;
    nextMeteorAt = performance.now() + between(2600, 5200);
    if (rafId === null) rafId = requestAnimationFrame(loop);
  }

  function stop() {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  }

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 180);
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop();
    else start();
  });

  resize();
  start();
})();

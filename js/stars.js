/**
 * ============================================================
 *  点亮足迹 · 星空背景（StarField）
 * ============================================================
 *  全屏 canvas 绘制三层星星：远景（小/暗/慢闪）→ 中景 → 近景（亮星带光晕）
 *  每颗星独立相位做正弦呼吸，个别亮星加十字光芒，强化"星空"质感
 *
 *  性能：DPR 上限 2 · 星星数量随面积自适应（上限 ~170 颗）· 空帧暂停
 *  无障碍：尊重 prefers-reduced-motion，仅静态渲染一帧
 * ============================================================
 */
(function () {
  'use strict';

  var canvas = document.getElementById('stars-canvas');
  if (!canvas) return;

  var ctx = canvas.getContext('2d');
  var stars = [];
  var rafId = null;
  var running = true;
  var reduced = false;

  try {
    reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) { /* 旧浏览器忽略 */ }

  var TAU = Math.PI * 2;

  // 星星颜色池：白 / 淡金 / 淡蓝，混合出真实的夜空
  var COLOR_POOL = [
    'rgba(255,255,255,',
    'rgba(255,244,214,',
    'rgba(214,226,255,',
    'rgba(255,236,180,',
    'rgba(196,212,255,',
  ];

  function makeStar(w, h) {
    var depth = Math.random(); // 0 远景 → 1 近景
    var size = 0.5 + depth * 1.6; // 0.5 ~ 2.1 px
    var baseAlpha = 0.25 + depth * 0.55; // 远景暗，近景亮
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      size: size,
      baseAlpha: baseAlpha,
      // 闪烁：近景亮星闪得慢而明显，远景微闪
      speed: (0.3 + Math.random() * 1.2) * (0.5 + depth * 0.8),
      phase: Math.random() * TAU,
      amp: 0.18 + depth * 0.45,        // 亮度振幅
      color: COLOR_POOL[(Math.random() * COLOR_POOL.length) | 0],
      // 近景大星才配光晕 + 十字光芒
      glow: depth > 0.72,
      cross: depth > 0.85,
      crossLen: 3 + depth * 5,
    };
  }

  function build() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = window.innerWidth;
    var h = window.innerHeight;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 星星密度：约每 14,000 px² 一颗，上限 170
    var count = Math.min(170, Math.round((w * h) / 14000));
    stars = [];
    for (var i = 0; i < count; i++) stars.push(makeStar(w, h));
  }

  function drawStar(s, t, w, h) {
    // 正弦呼吸：alpha 在 [baseAlpha-amp, baseAlpha+amp] 间平滑变化
    var a = s.baseAlpha + Math.sin(t * s.speed + s.phase) * s.amp;
    a = Math.max(0.05, Math.min(1, a));

    if (s.glow) {
      var g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size * 6);
      g.addColorStop(0, s.color + a * 0.45 + ')');
      g.addColorStop(1, s.color + '0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * 6, 0, TAU);
      ctx.fill();
    }

    ctx.fillStyle = s.color + a + ')';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, TAU);
    ctx.fill();

    // 亮星十字光芒（近景大星）
    if (s.cross) {
      var cl = s.crossLen;
      ctx.strokeStyle = s.color + a * 0.7 + ')';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(s.x - cl, s.y); ctx.lineTo(s.x + cl, s.y);
      ctx.moveTo(s.x, s.y - cl); ctx.lineTo(s.x, s.y + cl);
      ctx.stroke();
    }
  }

  function frame(t) {
    if (!running) return;
    var w = canvas.width / (Math.min(window.devicePixelRatio || 1, 2));
    var h = canvas.height / (Math.min(window.devicePixelRatio || 1, 2));
    ctx.clearRect(0, 0, w, h);
    var sec = t / 1000;
    for (var i = 0; i < stars.length; i++) drawStar(stars[i], sec, w, h);
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    build();
    if (reduced) {
      // 静态一帧：所有星星取中位亮度
      running = false;
      var sec = 1.5; // 固定相位，避免全部同亮
      for (var i = 0; i < stars.length; i++) drawStar(stars[i], sec, window.innerWidth, window.innerHeight);
      return;
    }
    running = true;
    rafId = requestAnimationFrame(frame);
  }

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(start, 200);
  });
  // 页面可见性：切走标签页时暂停动画省电
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
    } else if (!reduced) {
      running = true;
      rafId = requestAnimationFrame(frame);
    }
  });

  start();
})();

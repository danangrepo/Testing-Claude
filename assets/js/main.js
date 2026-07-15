(function () {
  'use strict';

  var root = document.documentElement;
  var THEME_KEY = 'untai-theme';

  function applyTheme(theme) {
    if (theme === 'dark' || theme === 'light') {
      root.setAttribute('data-theme', theme);
    } else {
      root.removeAttribute('data-theme');
    }
  }

  var stored = null;
  try { stored = localStorage.getItem(THEME_KEY); } catch (e) {}
  if (stored) applyTheme(stored);

  var themeToggle = document.querySelector('.theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var current = root.getAttribute('data-theme');
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      var effectiveCurrent = current || (prefersDark ? 'dark' : 'light');
      var next = effectiveCurrent === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    });
  }

  var navToggle = document.querySelector('.nav-toggle');
  var mobileNav = document.querySelector('.mobile-nav');
  if (navToggle && mobileNav) {
    navToggle.addEventListener('click', function () {
      var isOpen = mobileNav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });
    mobileNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        mobileNav.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  document.querySelectorAll('.faq-question').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('.faq-item');
      var isOpen = item.getAttribute('data-open') === 'true';
      document.querySelectorAll('.faq-item').forEach(function (other) {
        other.setAttribute('data-open', 'false');
        other.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        item.setAttribute('data-open', 'true');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* ---------- Hero node diagram ---------- */
  var canvas = document.getElementById('node-diagram');
  if (canvas && canvas.getContext) {
    var ctx = canvas.getContext('2d');
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var labels = ['MOBILE', 'AI/AUTO', 'WEB', 'DESKTOP', 'SAAS'];
    var nodes = [];
    var hub = { x: 0, y: 0 };
    var t = 0;
    var rafId = null;
    var focal = 0;

    // 3D orbit: nodes spin around the ring's own plane first, then the whole
    // ring is tilted toward the viewer around a fixed X axis. Spinning before
    // tilting (rather than after) is what makes each node's screen height
    // change with the spin angle, so they visibly rise/fall as they orbit
    // instead of only sliding sideways.
    var TILT_X = (32 * Math.PI) / 180;
    var SIN_TILT = Math.sin(TILT_X);
    var COS_TILT = Math.cos(TILT_X);
    var SPIN_SPEED = 0.15; // ~40-60s per full rotation, independent of sweep/pulse rates
    var FROZEN_SPIN = 0.6; // radians; a non-round angle avoids an edge-on node when frozen

    function getColor(varName) {
      return getComputedStyle(root).getPropertyValue(varName).trim();
    }

    // Projects a point on the node ring (base angle + current spin) from 3D
    // into 2D screen space, returning position plus depth-derived cues.
    function project(baseAngle, radius, spinAngle) {
      var a = baseAngle + spinAngle;
      var x1 = Math.cos(a) * radius;
      var z1 = Math.sin(a) * radius;
      var y2 = -z1 * SIN_TILT;
      var z2 = z1 * COS_TILT;
      var scale = focal / (focal + z2);
      return {
        x: hub.x + x1 * scale,
        y: hub.y + y2 * scale,
        scale: scale,
        z: z2,
        depth: (1 - z2 / radius) / 2 // normalized 0 (far) .. 1 (near); z2 negative = nearer camera
      };
    }

    function resize() {
      var rect = canvas.parentElement.getBoundingClientRect();
      var size = Math.min(rect.width, rect.height);
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = size + 'px';
      canvas.style.height = size + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      hub.x = size / 2;
      hub.y = size / 2;
      var radius = size * 0.3;
      focal = size * 1.6;
      nodes = labels.map(function (label, i) {
        var angle = (Math.PI * 2 * i) / labels.length - Math.PI / 2;
        return { label: label, baseAngle: angle, radius: radius };
      });
      draw(size);
    }

    function draw(size) {
      ctx.clearRect(0, 0, size, size);
      var tealColor = getColor('--teal') || '#3e6e63';
      var tealStrong = getColor('--teal-strong') || '#0c4a3a';
      var amberColor = getColor('--amber') || '#e1a13b';
      var inkColor = getColor('--ink') || '#12211c';
      var hubRadius = size * 0.3;
      var spinAngle = reduceMotion ? FROZEN_SPIN : t * SPIN_SPEED;

      // slow radar sweep, very faint — stays flat (hub-centered), reads as a
      // sensor-scan overlay rather than part of the physical 3D diagram
      var sweepAngle = reduceMotion ? -Math.PI / 4 : t * 0.35;
      var sweepGrad = ctx.createConicGradient
        ? ctx.createConicGradient(sweepAngle, hub.x, hub.y)
        : null;
      ctx.save();
      ctx.beginPath();
      ctx.arc(hub.x, hub.y, hubRadius * 1.14, 0, Math.PI * 2);
      ctx.clip();
      if (sweepGrad) {
        sweepGrad.addColorStop(0, color_mix(tealColor, 0.16));
        sweepGrad.addColorStop(0.12, color_mix(tealColor, 0));
        sweepGrad.addColorStop(1, color_mix(tealColor, 0));
        ctx.fillStyle = sweepGrad;
        ctx.fillRect(0, 0, size, size);
      }
      ctx.restore();

      // measurement rings: tilted ellipses in the same 3D plane as the nodes
      ctx.strokeStyle = tealColor;
      ctx.globalAlpha = 0.16;
      ctx.lineWidth = 1;
      [0.62, 1].forEach(function (f) {
        var steps = 40;
        ctx.beginPath();
        for (var s = 0; s <= steps; s++) {
          var p = project((Math.PI * 2 * s) / steps, hubRadius * f, spinAngle);
          if (s === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      });
      ctx.globalAlpha = 1;

      // project all nodes, then draw farthest-to-nearest so occlusion reads correctly
      var projected = nodes.map(function (n) {
        var p = project(n.baseAngle, n.radius, spinAngle);
        return {
          label: n.label,
          x: p.x,
          y: p.y,
          scale: p.scale,
          depth: p.depth
        };
      });
      // ascending depth = farthest first, nearest last (drawn on top)
      projected.sort(function (a, b) { return a.depth - b.depth; });

      // spokes with depth-modulated gradient + midpoint tick
      projected.forEach(function (n) {
        var grad = ctx.createLinearGradient(hub.x, hub.y, n.x, n.y);
        grad.addColorStop(0, color_mix(tealColor, 0.75));
        grad.addColorStop(1, color_mix(tealColor, 0.08 + n.depth * 0.2));
        ctx.strokeStyle = grad;
        ctx.lineWidth = 0.75 + n.depth * 0.5;
        ctx.beginPath();
        ctx.moveTo(hub.x, hub.y);
        ctx.lineTo(n.x, n.y);
        ctx.stroke();

        var mx = hub.x + (n.x - hub.x) * 0.62;
        var my = hub.y + (n.y - hub.y) * 0.62;
        var lineAngle = Math.atan2(n.y - hub.y, n.x - hub.x);
        var perp = lineAngle + Math.PI / 2;
        var tickLen = 3.5;
        ctx.strokeStyle = color_mix(tealColor, 0.4);
        ctx.beginPath();
        ctx.moveTo(mx - Math.cos(perp) * tickLen, my - Math.sin(perp) * tickLen);
        ctx.lineTo(mx + Math.cos(perp) * tickLen, my + Math.sin(perp) * tickLen);
        ctx.stroke();
      });

      // node reticles: outer ring + inner pulsing dot, sized/faded by depth
      projected.forEach(function (n, i) {
        var phase = reduceMotion ? 0.7 : Math.sin(t * 1.4 + i * 1.3) * 0.5 + 0.5;

        ctx.beginPath();
        ctx.arc(n.x, n.y, 6 * n.scale, 0, Math.PI * 2);
        ctx.strokeStyle = color_mix(tealColor, 0.35 + n.depth * 0.35);
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(n.x, n.y, 2.5 * n.scale, 0, Math.PI * 2);
        ctx.fillStyle = amberColor;
        ctx.globalAlpha = 0.6 + phase * 0.4;
        ctx.fill();
        ctx.globalAlpha = 1;

        var dirAngle = Math.atan2(n.y - hub.y, n.x - hub.x);
        ctx.font = '600 9px "JetBrains Mono", monospace';
        ctx.fillStyle = inkColor;
        ctx.globalAlpha = 0.55 + n.depth * 0.3;
        var offsetX = Math.cos(dirAngle) * (15 / n.scale);
        var offsetY = Math.sin(dirAngle) * (15 / n.scale);
        ctx.textAlign = Math.cos(dirAngle) > 0.3 ? 'left' : Math.cos(dirAngle) < -0.3 ? 'right' : 'center';
        ctx.fillText(n.label, n.x + offsetX, n.y + offsetY);
        ctx.globalAlpha = 1;
      });

      // hub: soft glow + concentric rings + core — fixed focal point, drawn on top
      var pulse = reduceMotion ? 0 : Math.sin(t) * 0.5 + 0.5;
      var glow = ctx.createRadialGradient(hub.x, hub.y, 0, hub.x, hub.y, 26);
      glow.addColorStop(0, color_mix(amberColor, 0.28));
      glow.addColorStop(1, color_mix(amberColor, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(hub.x, hub.y, 26, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(hub.x, hub.y, 10 + pulse * 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = tealStrong;
      ctx.lineWidth = 1.25;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(hub.x, hub.y, 6.5, 0, Math.PI * 2);
      ctx.strokeStyle = color_mix(tealColor, 0.5);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(hub.x, hub.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = amberColor;
      ctx.fill();
    }

    function color_mix(hex, alpha) {
      var m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
      if (!m) return hex;
      var r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
      return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    }

    function loop() {
      t += 0.012;
      draw(canvas.width / dpr);
      rafId = requestAnimationFrame(loop);
    }

    resize();
    window.addEventListener('resize', resize);
    if (!reduceMotion) {
      rafId = requestAnimationFrame(loop);
    }

    var mql = window.matchMedia('(prefers-color-scheme: dark)');
    var themeObserver = new MutationObserver(function () { draw(canvas.width / dpr); });
    themeObserver.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    mql.addEventListener('change', function () { draw(canvas.width / dpr); });
  }

  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var id = link.getAttribute('href').slice(1);
      var target = document.getElementById(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
})();

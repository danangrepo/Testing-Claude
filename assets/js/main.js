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

    function getColor(varName) {
      return getComputedStyle(root).getPropertyValue(varName).trim();
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
      var radius = size * 0.34;
      nodes = labels.map(function (label, i) {
        var angle = (Math.PI * 2 * i) / labels.length - Math.PI / 2;
        return {
          label: label,
          angle: angle,
          radius: radius,
          x: hub.x + Math.cos(angle) * radius,
          y: hub.y + Math.sin(angle) * radius
        };
      });
      draw(size);
    }

    function draw(size) {
      ctx.clearRect(0, 0, size, size);
      var lineColor = getColor('--line') || 'rgba(0,0,0,0.14)';
      var tealColor = getColor('--teal') || '#3e6e63';
      var amberColor = getColor('--amber') || '#e1a13b';
      var inkColor = getColor('--ink') || '#12211c';

      ctx.lineWidth = 1;
      ctx.strokeStyle = tealColor;
      ctx.globalAlpha = 0.55;
      nodes.forEach(function (n) {
        ctx.beginPath();
        ctx.moveTo(hub.x, hub.y);
        ctx.lineTo(n.x, n.y);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;

      var pulse = reduceMotion ? 0 : Math.sin(t) * 0.5 + 0.5;
      nodes.forEach(function (n, i) {
        var phase = Math.sin(t + i * 1.3) * 0.5 + 0.5;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = amberColor;
        ctx.globalAlpha = 0.55 + phase * 0.45;
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.font = '600 9px "JetBrains Mono", monospace';
        ctx.fillStyle = inkColor;
        ctx.globalAlpha = 0.75;
        var offsetX = Math.cos(n.angle) * 16;
        var offsetY = Math.sin(n.angle) * 16;
        ctx.textAlign = Math.cos(n.angle) > 0.3 ? 'left' : Math.cos(n.angle) < -0.3 ? 'right' : 'center';
        ctx.fillText(n.label, n.x + offsetX, n.y + offsetY);
        ctx.globalAlpha = 1;
      });

      ctx.beginPath();
      ctx.arc(hub.x, hub.y, 8 + pulse * 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = tealColor;
      ctx.lineWidth = 1.25;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(hub.x, hub.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = amberColor;
      ctx.fill();
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

// =============================================
//  AscentisTech Phase 2 — Main Script
// =============================================

// ── 套用 images.js 的圖片設定 ───────────────
if (typeof SITE_IMAGES !== 'undefined') {
  document.querySelectorAll('[data-img]').forEach(img => {
    const key = img.getAttribute('data-img');
    if (SITE_IMAGES[key]) img.src = SITE_IMAGES[key];
  });
}

// ── Intro overlay — 等待使用者選擇語言 ──────
(function () {
  const intro = document.getElementById('page-intro');
  if (!intro) return;

  const bg = intro.querySelector('.intro-bg');
  bg.style.backgroundImage = "url('../images/home-backup/IMG_5408.png')";

  const vignette = intro.querySelector('.intro-vignette');
  const content  = intro.querySelector('.intro-content');

  function crossfade(lang) {
    // 套用語言
    if (typeof applyTranslations === 'function') applyTranslations(lang);
    document.documentElement.setAttribute('data-lang', lang);

    // 更新 navbar 語言按鈕狀態
    const toggle = document.getElementById('langToggle');
    if (toggle) {
      toggle.querySelector('.lang-zh')?.classList.toggle('active', lang === 'zh');
      toggle.querySelector('.lang-en')?.classList.toggle('active', lang === 'en');
    }

    // 文字先淡出，再淡出背景
    content.classList.add('fade-out');
    setTimeout(() => {
      bg.classList.add('fade-out');
      if (vignette) vignette.classList.add('fade-out');
      setTimeout(() => intro.remove(), 1900);
    }, 300);
  }

  // 語言按鈕點擊才觸發 crossfade
  intro.querySelectorAll('.intro-lang-btn').forEach(btn => {
    btn.addEventListener('click', () => crossfade(btn.getAttribute('data-lang')));
  });
})();

// ── Language toggle (navbar) ─────────────────
const langToggle = document.getElementById('langToggle');
let currentLang = 'zh';

if (langToggle) {
  langToggle.addEventListener('click', () => {
    currentLang = currentLang === 'zh' ? 'en' : 'zh';
    document.documentElement.setAttribute('data-lang', currentLang);
    if (typeof applyTranslations === 'function') applyTranslations(currentLang);
    langToggle.querySelector('.lang-zh')?.classList.toggle('active', currentLang === 'zh');
    langToggle.querySelector('.lang-en')?.classList.toggle('active', currentLang === 'en');
  });
}

// ── Navbar scroll behavior ───────────────────
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });

// ── Mobile menu ──────────────────────────────
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');

hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  mobileMenu.classList.toggle('open');
  document.body.classList.toggle('menu-open');
});

mobileMenu.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    hamburger.classList.remove('open');
    mobileMenu.classList.remove('open');
    document.body.classList.remove('menu-open');
  });
});

// ── Smooth scroll ────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      window.scrollTo({ top: target.offsetTop - 80, behavior: 'smooth' });
    }
  });
});

// ── Intersection Observer for fade animations ─
const fadeObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      fadeObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.fade-up, .fade-in, .fade-left, .fade-right').forEach(el => {
  fadeObserver.observe(el);
});

// ── Counter animation ────────────────────────
function animateCounter(el) {
  if (el.dataset.animated) return;
  el.dataset.animated = '1';
  const target = parseInt(el.getAttribute('data-count'));
  const duration = 1800;
  const start = performance.now();
  const update = (now) => {
    const t = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(ease * target) + (t < 1 ? '' : '+');
    if (t < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) animateCounter(entry.target);
  });
}, { threshold: 0.5 });

document.querySelectorAll('[data-count]').forEach(el => counterObserver.observe(el));

// ── Active nav link on scroll ─────────────────
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-links a, .mobile-menu a');

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const id = entry.target.getAttribute('id');
      navLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === '#' + id);
      });
    }
  });
}, { rootMargin: '-40% 0px -55% 0px' });

sections.forEach(s => sectionObserver.observe(s));

// ── About carousel ────────────────────────────
(function () {
  const frame = document.getElementById('aboutCarousel');
  if (!frame) return;

  const slides = frame.querySelectorAll('.carousel-slide');
  const dotsEl = frame.querySelector('.carousel-dots');
  const total = slides.length;
  let current = 0;

  slides.forEach((_, i) => {
    const btn = document.createElement('button');
    btn.className = 'dot' + (i === 0 ? ' active' : '');
    btn.setAttribute('aria-label', 'Photo ' + (i + 1));
    btn.addEventListener('click', () => goTo(i));
    dotsEl.appendChild(btn);
  });

  const counter = document.createElement('div');
  counter.className = 'carousel-counter';
  counter.textContent = '1 / ' + total;
  frame.appendChild(counter);

  const progressWrap = document.createElement('div');
  progressWrap.className = 'carousel-progress';
  const progressBar = document.createElement('div');
  progressBar.className = 'carousel-progress-bar';
  progressWrap.appendChild(progressBar);
  frame.appendChild(progressWrap);

  function restartProgress() {
    progressBar.style.animation = 'none';
    progressBar.offsetWidth;
    progressBar.style.animation = 'carousel-fill 5s linear forwards';
  }

  const dots = dotsEl.querySelectorAll('.dot');

  function goTo(index) {
    slides[current].classList.remove('active');
    dots[current].classList.remove('active');
    current = (index + total) % total;
    slides[current].classList.add('active');
    dots[current].classList.add('active');
    counter.textContent = (current + 1) + ' / ' + total;
    restartProgress();
  }

  const INTERVAL = 5000;
  let timer = setInterval(() => goTo(current + 1), INTERVAL);
  restartProgress();

  function resetTimer() {
    clearInterval(timer);
    timer = setInterval(() => goTo(current + 1), INTERVAL);
    restartProgress();
  }

  frame.querySelector('.carousel-prev').addEventListener('click', () => { goTo(current - 1); resetTimer(); });
  frame.querySelector('.carousel-next').addEventListener('click', () => { goTo(current + 1); resetTimer(); });

  frame.addEventListener('mouseenter', () => {
    clearInterval(timer);
    progressBar.style.animationPlayState = 'paused';
  });
  frame.addEventListener('mouseleave', () => {
    progressBar.style.animationPlayState = 'running';
    timer = setInterval(() => goTo(current + 1), INTERVAL);
  });

  frame.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft')  { goTo(current - 1); resetTimer(); }
    if (e.key === 'ArrowRight') { goTo(current + 1); resetTimer(); }
  });
  frame.setAttribute('tabindex', '0');
})();

// ── Team voices carousel ─────────────────────
(function () {
  const track = document.getElementById('voicesTrack');
  if (!track) return;

  const overflow = track.parentElement;
  const cards = Array.from(track.querySelectorAll('.voice-card'));
  const total = cards.length;
  let pos = 0;

  const prevBtn = document.querySelector('.voice-nav-btn--prev');
  const nextBtn = document.querySelector('.voice-nav-btn--next');

  function getVisible() {
    return window.innerWidth < 768 ? 1 : 2;
  }

  function getMaxPos() {
    return Math.max(0, total - getVisible());
  }

  function setCardWidths() {
    const visible = getVisible();
    const gap = 20;
    const cardW = (overflow.offsetWidth - gap * (visible - 1)) / visible;
    cards.forEach(c => { c.style.width = cardW + 'px'; c.style.flexShrink = '0'; });
    return cardW;
  }

  function update() {
    const cardW = setCardWidths();
    const gap = 20;
    const max = getMaxPos();
    if (pos > max) pos = max;
    track.style.transform = `translateX(-${pos * (cardW + gap)}px)`;
    if (prevBtn) prevBtn.disabled = pos <= 0;
    if (nextBtn) nextBtn.disabled = pos >= max;
  }

  if (prevBtn) prevBtn.addEventListener('click', () => { if (pos > 0) { pos--; update(); } });
  if (nextBtn) nextBtn.addEventListener('click', () => { if (pos < getMaxPos()) { pos++; update(); } });
  window.addEventListener('resize', update);
  update();
})();

// ── Scroll to top button ─────────────────────
const scrollTop = document.getElementById('scrollTop');
if (scrollTop) {
  window.addEventListener('scroll', () => {
    scrollTop.classList.toggle('visible', window.scrollY > 400);
  }, { passive: true });
  scrollTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

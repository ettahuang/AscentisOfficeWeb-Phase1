// =============================================
//  AscentisTech — Main Script
// =============================================

// ── 套用 images.js 的圖片設定 ───────────────
if (typeof SITE_IMAGES !== 'undefined') {
  document.querySelectorAll('[data-img]').forEach(img => {
    const key = img.getAttribute('data-img');
    if (SITE_IMAGES[key]) img.src = SITE_IMAGES[key];
  });
}

let currentLang = localStorage.getItem('lang') || 'en';

// ── Apply translations ──────────────────────
function applyTranslations(lang) {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (i18nData[lang] && i18nData[lang][key]) {
      el.textContent = i18nData[lang][key];
    }
  });

  const toggle = document.getElementById('langToggle');
  if (toggle) {
    toggle.querySelector('.lang-en').classList.toggle('active', lang === 'en');
    toggle.querySelector('.lang-zh').classList.toggle('active', lang === 'zh');
  }

  document.documentElement.lang = lang === 'zh' ? 'zh-Hant-TW' : 'en';
  document.title = lang === 'zh'
    ? 'AscentisTech 昇新科技 | 引領創新的軟體開發夥伴'
    : 'AscentisTech | Leading Innovation in Software Development';
}

// ── Language toggle ─────────────────────────
document.getElementById('langToggle').addEventListener('click', () => {
  currentLang = currentLang === 'en' ? 'zh' : 'en';
  localStorage.setItem('lang', currentLang);
  applyTranslations(currentLang);
});

// Init
applyTranslations(currentLang);

// ── Navbar scroll behavior ──────────────────
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });

// ── Mobile menu ─────────────────────────────
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

// ── Smooth scroll for anchor links ──────────
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      const offset = 80;
      window.scrollTo({ top: target.offsetTop - offset, behavior: 'smooth' });
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
}, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

document.querySelectorAll('.fade-up, .fade-in, .fade-left, .fade-right').forEach(el => {
  fadeObserver.observe(el);
});

// ── Counter animation ─────────────────────────
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
    if (entry.isIntersecting) {
      animateCounter(entry.target);
    }
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

// ── About carousel ───────────────────────────
(function () {
  const frame = document.getElementById('aboutCarousel');
  if (!frame) return;

  const slides = frame.querySelectorAll('.carousel-slide');
  const dotsEl = frame.querySelector('.carousel-dots');
  const total = slides.length;
  let current = 0;

  // Build dot indicators
  slides.forEach((_, i) => {
    const btn = document.createElement('button');
    btn.className = 'dot' + (i === 0 ? ' active' : '');
    btn.setAttribute('aria-label', 'Photo ' + (i + 1));
    btn.addEventListener('click', () => goTo(i));
    dotsEl.appendChild(btn);
  });

  // Build counter (e.g. "1 / 10")
  const counter = document.createElement('div');
  counter.className = 'carousel-counter';
  counter.textContent = '1 / ' + total;
  frame.appendChild(counter);

  // Build progress bar
  const progressWrap = document.createElement('div');
  progressWrap.className = 'carousel-progress';
  const progressBar = document.createElement('div');
  progressBar.className = 'carousel-progress-bar';
  progressWrap.appendChild(progressBar);
  frame.appendChild(progressWrap);

  function restartProgress() {
    progressBar.style.animation = 'none';
    progressBar.offsetWidth; // force reflow
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

  // Auto-play every 5 seconds
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

  // Pause on hover (also freeze progress bar)
  frame.addEventListener('mouseenter', () => {
    clearInterval(timer);
    progressBar.style.animationPlayState = 'paused';
  });
  frame.addEventListener('mouseleave', () => {
    progressBar.style.animationPlayState = 'running';
    timer = setInterval(() => goTo(current + 1), INTERVAL);
  });

  // Keyboard support when hovering
  frame.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft')  { goTo(current - 1); resetTimer(); }
    if (e.key === 'ArrowRight') { goTo(current + 1); resetTimer(); }
  });
  frame.setAttribute('tabindex', '0');
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

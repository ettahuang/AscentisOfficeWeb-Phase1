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

// ── Intro overlay — 停留 5 秒後自動進入，預設中文 ──────
(function () {
  const intro = document.getElementById('page-intro');
  if (!intro) return;

  // 鎖住捲動
  document.body.style.overflow = 'hidden';

  const bg = intro.querySelector('.intro-bg');
  const imgSrc = '../images/home-backup/IMG_5408.png';

  let dismissed = false;
  function dismissIntro() {
    if (dismissed) return;
    dismissed = true;
    // 套用預設語言（中文）
    if (typeof applyTranslations === 'function') applyTranslations('zh');
    document.documentElement.setAttribute('data-lang', 'zh');

    const toggle = document.getElementById('langToggle');
    if (toggle) {
      toggle.querySelector('.lang-zh')?.classList.add('active');
      toggle.querySelector('.lang-en')?.classList.remove('active');
    }

    // 解鎖捲動，整個 intro 一起 fade
    document.body.style.overflow = '';
    intro.classList.add('fade-out');
    setTimeout(() => intro.remove(), 1900);
  }

  // 圖片載入完成後啟動 Ken Burns 動畫，3 秒後自動進入
  const preload = new Image();
  preload.onload = () => {
    bg.style.backgroundImage = `url('${imgSrc}')`;
    setTimeout(dismissIntro, 3000);
  };
  preload.onerror = () => {
    setTimeout(dismissIntro, 1000);
  };
  preload.src = imgSrc;
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

// ── About carousel (右滑切換效果) ────────────
(function () {
  const frame = document.getElementById('aboutCarousel');
  if (!frame) return;

  const slides = frame.querySelectorAll('.carousel-slide');
  const dotsEl = frame.querySelector('.carousel-dots');
  const total = slides.length;
  let current = 0;
  let animating = false;

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

  const dots = Array.from(dotsEl.querySelectorAll('.dot'));

  const TRANS = 'transform 1s cubic-bezier(0.25, 1, 0.5, 1)';

  function goTo(newIndex) {
    if (animating) return;
    const newIdx = (newIndex + total) % total;
    if (newIdx === current) return;
    animating = true;

    // 判斷方向：最短路徑
    const rawDiff = ((newIdx - current) + total) % total;
    const dir = rawDiff <= total / 2 ? 1 : -1; // 1=前進(右進左出), -1=後退

    const outSlide = slides[current];
    const inSlide  = slides[newIdx];

    // 新 slide 先定位到畫面外（無動畫）
    inSlide.style.transition = 'none';
    inSlide.style.transform  = `translateX(${dir * 100}%)`;
    inSlide.style.opacity    = '1';
    inSlide.classList.add('active');
    inSlide.offsetWidth; // force reflow

    // 開始滑動
    inSlide.style.transition  = TRANS;
    inSlide.style.transform   = 'translateX(0)';

    outSlide.style.transition = `${TRANS}, opacity 0.6s ease 0.1s`;
    outSlide.style.transform  = `translateX(${-dir * 100}%)`;
    outSlide.style.opacity    = '0';

    // 清除舊 slide
    setTimeout(() => {
      outSlide.classList.remove('active');
      outSlide.style.transform  = '';
      outSlide.style.transition = '';
      outSlide.style.opacity    = '';
      inSlide.style.transition  = '';
      animating = false;
    }, 1100);

    // 更新 dots / counter
    dots[current].classList.remove('active');
    current = newIdx;
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
    return window.innerWidth < 768 ? 1 : 3;
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
    if (pos > max) pos = 0;
    if (pos < 0) pos = max;
    track.style.transform = `translateX(-${pos * (cardW + gap)}px)`;
  }

  if (prevBtn) prevBtn.addEventListener('click', () => { pos--; update(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { pos++; update(); });
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

// ── News Modal ────────────────────────────────
(function () {
  const modal    = document.getElementById('newsModal');
  if (!modal) return;

  const backdrop = modal.querySelector('.news-modal-backdrop');
  const closeBtn = modal.querySelector('.news-modal-close');
  const imgEl    = document.getElementById('newsModalImg');
  const tagEl    = document.getElementById('newsModalTag');
  const dateEl   = document.getElementById('newsModalDate');
  const titleEl  = document.getElementById('newsModalTitle');
  const bodyEl   = document.getElementById('newsModalBody');

  // 新聞資料（圖片路徑 + meta）
  const newsData = {
    1: { img: '../images/news/01.jpg', tag: 'award', date: '2025.03' },
    2: { img: '../images/news/02.jpg', tag: 'award', date: '2025.03' },
    3: { img: '../images/news/03.jpg', tag: 'news',  date: '2025.02' },
    4: { img: '../images/news/04.jpg', tag: 'award', date: '2025.03' },
  };

  function openModal(id) {
    const data = newsData[id];
    if (!data) return;

    const lang = document.documentElement.getAttribute('data-lang') || 'zh';
    const t = (typeof i18nData !== 'undefined' && i18nData[lang]) ? i18nData[lang] : {};

    // 先隱藏圖片避免閃到舊圖，載入完再顯示
    imgEl.style.opacity = '0';
    imgEl.src = '';
    const newImg = new Image();
    newImg.onload = () => {
      imgEl.src = data.img;
      imgEl.style.transition = 'opacity 0.3s ease';
      imgEl.style.opacity = '1';
    };
    newImg.src = data.img;

    dateEl.textContent = data.date;

    // tag badge
    if (data.tag === 'award') {
      tagEl.className = 'news-tag news-tag--award';
      tagEl.innerHTML = '<i class="fa-solid fa-trophy"></i> ' + (lang === 'zh' ? '得獎' : 'Award');
    } else {
      tagEl.className = 'news-tag news-tag--news';
      tagEl.innerHTML = '<i class="fa-solid fa-newspaper"></i> ' + (lang === 'zh' ? '產業動態' : 'Industry');
    }

    titleEl.textContent = t[`news.item${id}.title`] || '';
    bodyEl.textContent  = t[`news.item${id}.body`]  || t[`news.item${id}.desc`] || '';

    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // 點擊 news-item 開啟
  document.querySelectorAll('[data-news-id]').forEach(item => {
    item.addEventListener('click', () => openModal(item.getAttribute('data-news-id')));
    item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openModal(item.getAttribute('data-news-id')); });
  });

  backdrop.addEventListener('click', closeModal);
  closeBtn.addEventListener('click', closeModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
})();

// ── Benefit Item Hover Preview ────────────────
(function () {
  document.querySelectorAll('.benefit-item[data-benefit-img]').forEach(item => {
    const card    = item.closest('.benefit-card');
    const preview = card ? card.querySelector('.benefit-preview') : null;
    if (!preview) return;
    const previewImg = preview.querySelector('img');

    item.addEventListener('mouseenter', () => {
      const src = item.getAttribute('data-benefit-img');
      previewImg.style.opacity = '0';
      previewImg.src = src;
      preview.classList.add('visible');
      previewImg.onload = () => { previewImg.style.opacity = '1'; };
      // 已快取的圖片不會觸發 onload，直接顯示
      if (previewImg.complete) previewImg.style.opacity = '1';
    });

    item.addEventListener('mouseleave', () => {
      preview.classList.remove('visible');
    });
  });
})();

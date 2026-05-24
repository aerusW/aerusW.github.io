/* ================================================
   aerusW Portfolio — Francesco Serangeli
   ================================================ */

'use strict';

// ── State ──────────────────────────────────────────
let current   = 0;
let animating = false;
let loaded    = false;
let ghFetched = false;
const TOTAL   = 6;

// ── DOM ────────────────────────────────────────────
const sections   = [...document.querySelectorAll('.s')];
const dots       = [...document.querySelectorAll('.dot')];
const navLinks   = [...document.querySelectorAll('.nav-link')];
const counter    = document.getElementById('counter-current');

const loader     = document.getElementById('fs-loader');
const loaderBar  = loader.querySelector('.loader-bar');
const loaderProg = loader.querySelector('.loader-progress-wrap');
const letterF    = document.getElementById('letter-f');
const letterS    = document.getElementById('letter-s');

const ptEl      = document.getElementById('page-transition');
const ptCurtain = ptEl.querySelector('.pt-curtain');
const ptMono    = ptEl.querySelector('.pt-monogram');

const cursorEl  = document.getElementById('cursor');
const cDot      = cursorEl.querySelector('.cursor-dot');
const cRing     = cursorEl.querySelector('.cursor-ring');

const heroName  = document.querySelector('.hero-name');
const glitchLn  = document.getElementById('glitch-line');

// ── Cursor ─────────────────────────────────────────
let mx = 0, my = 0, rx = 0, ry = 0;

document.addEventListener('mousemove', e => {
  mx = e.clientX; my = e.clientY;
  cDot.style.left = mx + 'px';
  cDot.style.top  = my + 'px';
});

(function trackRing() {
  rx += (mx - rx) * 0.11;
  ry += (my - ry) * 0.11;
  cRing.style.left = rx + 'px';
  cRing.style.top  = ry + 'px';
  requestAnimationFrame(trackRing);
})();

const HOVER_SEL = 'a, button, .dot, .project-row';
document.addEventListener('mouseover', e => {
  if (e.target.closest(HOVER_SEL)) document.body.classList.add('is-hovering');
});
document.addEventListener('mouseout', e => {
  if (e.target.closest(HOVER_SEL)) document.body.classList.remove('is-hovering');
});

// ── FS Loader ──────────────────────────────────────
function runLoader() {
  const tl = gsap.timeline({ onComplete: onLoaderDone });

  tl.to(loaderProg, { opacity: 1, duration: 0.3, delay: 0.2 });
  tl.to(loaderBar,  { width: '100%', duration: 1.1, ease: 'power2.inOut' }, '-=0.1');
  tl.to([letterF, letterS], { y: '0%', duration: 0.85, ease: 'expo.out', stagger: 0.07 }, '-=0.55');
  tl.to({}, { duration: 0.55 });
  tl.to([letterF, letterS], { y: '-120%', duration: 0.6, ease: 'expo.in', stagger: 0.04 });
  tl.to(loaderProg, { opacity: 0, duration: 0.2 }, '-=0.4');
  tl.to('.loader-panel-top',    { yPercent: -100, duration: 0.75, ease: 'expo.inOut' }, '-=0.15');
  tl.to('.loader-panel-bottom', { yPercent:  100, duration: 0.75, ease: 'expo.inOut' }, '<');
}

function onLoaderDone() {
  loader.style.display = 'none';
  loaded = true;
  activateSection(0, false);
  scheduleGlitch();
}

// ── Section activation ─────────────────────────────
function activateSection(idx, withTransition) {
  if (withTransition) {
    if (animating || idx === current) return;
    animating = true;
    const from = current;
    current = idx;

    // Kick off GitHub fetch when projects section is first opened
    if (idx === 2 && !ghFetched) fetchGithub();

    ptIn(() => {
      sections[from].classList.remove('active');
      sections[idx].classList.add('active');
      updateNav(idx);
      animateIn(sections[idx]);
      if (idx === 4) onGalleryActivate();
      ptOut(() => { animating = false; });
    });
  } else {
    sections.forEach(s => s.classList.remove('active'));
    sections[idx].classList.add('active');
    current = idx;
    updateNav(idx);
    animateIn(sections[idx]);
    if (idx === 4) onGalleryActivate();
  }
}

// ── Page transition ────────────────────────────────
function ptIn(done) {
  const tl = gsap.timeline({ onComplete: done });
  tl.set(ptCurtain, { scaleY: 0, transformOrigin: 'bottom' });
  tl.set(ptMono,    { opacity: 0, y: 28 });
  tl.to(ptCurtain,  { scaleY: 1, duration: 0.5, ease: 'expo.inOut' });
  tl.to(ptMono,     { opacity: 1, y: 0, duration: 0.3, ease: 'expo.out' }, '-=0.1');
}

function ptOut(done) {
  const tl = gsap.timeline({ onComplete: done });
  tl.to(ptMono,    { opacity: 0, y: -24, duration: 0.28, ease: 'expo.in' });
  tl.to(ptCurtain, { scaleY: 0, transformOrigin: 'top', duration: 0.52, ease: 'expo.inOut' }, '-=0.08');
}

// ── Section enter animations ───────────────────────
const DELAY_MAP = { d1: 0.12, d2: 0.24, d3: 0.36, d4: 0.48, d5: 0.6 };

function animateIn(section) {
  const ups     = section.querySelectorAll('.up');
  const eyebrow = section.querySelector('.eyebrow');

  gsap.set(ups, { y: '115%' });

  if (eyebrow) {
    gsap.set(eyebrow, { opacity: 0, y: 12 });
    gsap.to(eyebrow, { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out', delay: 0.25 });
  }

  ups.forEach(el => {
    const extra = [...el.classList].reduce((acc, c) => DELAY_MAP[c] ?? acc, 0);
    gsap.to(el, { y: '0%', duration: 0.95, ease: 'expo.out', delay: 0.28 + extra });
  });

  // Stagger project rows
  const rows = section.querySelectorAll('.project-row');
  if (rows.length) {
    gsap.set(rows, { opacity: 0, x: -14 });
    gsap.to(rows, { opacity: 1, x: 0, duration: 0.5, ease: 'expo.out', stagger: 0.06, delay: 0.35 });
  }

  // Stagger elsewhere blocks
  const elBlocks = section.querySelectorAll('.el-block');
  if (elBlocks.length) {
    gsap.set(elBlocks, { opacity: 0, y: 20 });
    gsap.to(elBlocks, { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out', stagger: 0.12, delay: 0.45 });
  }
}

function updateNav(idx) {
  dots.forEach((d, i)     => d.classList.toggle('active', i === idx));
  navLinks.forEach((l, i) => l.classList.toggle('active', i === idx));
  counter.textContent = String(idx + 1).padStart(2, '0');
}

// ── GitHub API ─────────────────────────────────────
// Language → colour (subset of GitHub's palette)
const LANG_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5',
  HTML:       '#e34c26', CSS:        '#563d7c', Vue:    '#41b883',
  Shell:      '#89e051', Rust:       '#dea584', Go:     '#00add8',
  Java:       '#b07219', Ruby:       '#701516', 'C++':  '#f34b7d',
  C:          '#555555', Kotlin:     '#a97bff', Swift:  '#ffac45',
};

function fetchGithub() {
  ghFetched = true;

  fetch('https://api.github.com/users/aerusW/repos?sort=updated&per_page=10&type=public')
    .then(r => {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })
    .then(repos => renderRepos(repos))
    .catch(() => showGhError());
}

function renderRepos(repos) {
  const list    = document.getElementById('project-list');
  const loading = document.getElementById('gh-loading');

  // Filter out forks with no description, sort by stars then update date
  const filtered = repos
    .filter(r => !r.fork || r.description)
    .sort((a, b) => (b.stargazers_count - a.stargazers_count) || 0)
    .slice(0, 6);

  if (!filtered.length) {
    showGhError();
    return;
  }

  // Remove loading indicator
  loading.remove();

  filtered.forEach((repo, i) => {
    const color = repo.language ? (LANG_COLORS[repo.language] || '#888') : '#888';
    const desc  = repo.description || 'No description';
    const row   = document.createElement('a');

    row.className  = 'project-row';
    row.href       = repo.html_url;
    row.target     = '_blank';
    row.rel        = 'noopener';
    row.tabIndex   = 0;
    row.innerHTML  = `
      <span class="pr-num">${String(i + 1).padStart(2, '0')}</span>
      <span class="pr-info">
        <span class="pr-name">${escHtml(repo.name)}</span>
        <span class="pr-desc">${escHtml(desc)}</span>
      </span>
      ${repo.language ? `<span class="pr-lang" style="--lang-color:${color}">${escHtml(repo.language)}</span>` : '<span></span>'}
      <span class="pr-arrow" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none"><path d="M7 17L17 7M17 7H7M17 7V17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>
    `;

    list.appendChild(row);

    // Re-bind tilt on new rows
    row.addEventListener('mousemove', e => {
      const r = row.getBoundingClientRect();
      gsap.to(row, { rotateX: ((e.clientY - r.top) / r.height - 0.5) * 4, duration: 0.35, ease: 'power2.out', transformPerspective: 1000 });
    });
    row.addEventListener('mouseleave', () => {
      gsap.to(row, { rotateX: 0, duration: 0.5, ease: 'expo.out' });
    });
  });

  // If projects section is currently active, animate the new rows in
  if (current === 2) {
    const rows = list.querySelectorAll('.project-row');
    gsap.set(rows, { opacity: 0, x: -14 });
    gsap.to(rows, { opacity: 1, x: 0, duration: 0.5, ease: 'expo.out', stagger: 0.06, delay: 0.1 });
  }
}

function showGhError() {
  document.getElementById('gh-loading').style.display = 'none';
  document.getElementById('gh-error').style.display   = 'flex';
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Navigation ─────────────────────────────────────
let wheelLock = false;
let wheelAcc  = 0;
const WHEEL_T = 60;

window.addEventListener('wheel', e => {
  if (!loaded) return;
  e.preventDefault();
  if (wheelLock || animating) return;

  wheelAcc += e.deltaY;
  if (Math.abs(wheelAcc) < WHEEL_T) return;

  const dir = wheelAcc > 0 ? 1 : -1;
  wheelAcc  = 0;
  wheelLock = true;

  const next = current + dir;
  if (next >= 0 && next < TOTAL) activateSection(next, true);

  setTimeout(() => { wheelLock = false; }, 1100);
}, { passive: false });

window.addEventListener('keydown', e => {
  if (!loaded || animating) return;
  const map = { ArrowDown: 1, ArrowUp: -1, PageDown: 1, PageUp: -1 };
  const dir = map[e.key];
  if (!dir) return;
  const next = current + dir;
  if (next >= 0 && next < TOTAL) activateSection(next, true);
});

let touchY0 = 0;
window.addEventListener('touchstart', e => { touchY0 = e.touches[0].clientY; }, { passive: true });
window.addEventListener('touchend', e => {
  if (!loaded || animating) return;
  const dy = touchY0 - e.changedTouches[0].clientY;
  if (Math.abs(dy) < 50) return;
  const next = current + (dy > 0 ? 1 : -1);
  if (next >= 0 && next < TOTAL) activateSection(next, true);
});

dots.forEach(dot => {
  dot.addEventListener('click', () => activateSection(+dot.dataset.idx, true));
});

document.querySelectorAll('[data-to]').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    activateSection(+el.dataset.to, true);
  });
});

// ── Justified gallery layout ───────────────────────
let galGrid, galItems, galImgs;
let galImgsReady    = false;
let galSectionShown = false;

function initGallery() {
  galGrid  = document.querySelector('.gallery-grid');
  if (!galGrid) return;
  galItems = [...galGrid.querySelectorAll('.gal-item')];
  galImgs  = galItems.map(i => i.querySelector('img'));

  Promise.all(galImgs.map(img => {
    if (!img) return Promise.resolve();
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise(r => { img.onload = r; img.onerror = r; });
  })).then(() => {
    galImgsReady = true;
    // If user already navigated to gallery while images were loading, apply now
    if (galSectionShown) requestAnimationFrame(applyJustified);
  });

  window.addEventListener('resize', () => {
    if (galImgsReady && galSectionShown) applyJustified();
  }, { passive: true });
}

function applyJustified() {
  const GAP = 4;
  const W   = galGrid.clientWidth;
  const H   = galGrid.clientHeight;
  if (!W || !H) return;

  const n      = galItems.length;
  const ratios = galImgs.map(img =>
    img && img.naturalWidth ? img.naturalWidth / img.naturalHeight : 1
  );

  // Find the row split that gives the most equal row heights
  let bestSplit = Math.ceil(n / 2), bestDiff = Infinity;
  for (let k = 1; k < n; k++) {
    const h1 = (W - GAP * (k - 1))     / ratios.slice(0, k).reduce((s, r) => s + r, 0);
    const h2 = (W - GAP * (n - k - 1)) / ratios.slice(k).reduce((s, r) => s + r, 0);
    const diff = Math.abs(h1 - h2);
    if (diff < bestDiff) { bestDiff = diff; bestSplit = k; }
  }

  const rowH = (H - GAP) / 2;
  [[galItems.slice(0, bestSplit), ratios.slice(0, bestSplit)],
   [galItems.slice(bestSplit),    ratios.slice(bestSplit)]
  ].forEach(([rowItems, rowRatios]) => {
    const sumR  = rowRatios.reduce((s, r) => s + r, 0);
    const avail = W - GAP * (rowItems.length - 1);
    rowItems.forEach((item, i) => {
      // flex-grow proportional to ratio → browser fills row exactly, no rounding gaps
      item.style.flex   = `${rowRatios[i]} 1 ${(rowRatios[i] / sumR * avail).toFixed(2)}px`;
      item.style.height = `${rowH}px`;
    });
  });
}

// Called from activateSection when gallery (idx 4) becomes visible
function onGalleryActivate() {
  galSectionShown = true;
  if (galImgsReady) requestAnimationFrame(applyJustified);
}

// ── Glitch ─────────────────────────────────────────
function triggerGlitch() {
  if (!heroName) { scheduleGlitch(); return; }
  heroName.classList.add('is-glitching');
  glitchLn.classList.add('active');
  setTimeout(() => {
    heroName.classList.remove('is-glitching');
    glitchLn.classList.remove('active');
    scheduleGlitch();
  }, 620);
}

function scheduleGlitch() {
  setTimeout(triggerGlitch, 5000 + Math.random() * 7000);
}

// ── Init ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  runLoader();
  initGallery();
});

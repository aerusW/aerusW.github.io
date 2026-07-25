/* ================================================
   aerusW Portfolio — Francesco Serangeli
   ================================================ */

'use strict';

// ── GSAP failure fallback ──────────────────────────
// If the CDN is blocked or slow, fall back to CSS-only final state
// (see .no-gsap rules in style.css) instead of a blank page.
if (!window.gsap) document.documentElement.classList.add('no-gsap');

// ── State ──────────────────────────────────────────
let current   = 0;
let loaded    = false;
let ghFetched = false;
const TOTAL   = 6;

// ── DOM ────────────────────────────────────────────
const sections   = [...document.querySelectorAll('.s')];
const sectionIds = sections.map(s => s.id);
const dots       = [...document.querySelectorAll('.dot')];
const navLinks   = [...document.querySelectorAll('.nav-link')];
const counter    = document.getElementById('counter-current');

const loader     = document.getElementById('fs-loader');
const loaderName = loader.querySelector('.loader-name');

const ptEl      = document.getElementById('page-transition');
const ptCurtain = ptEl.querySelector('.pt-curtain');
const ptMono    = ptEl.querySelector('.pt-monogram');

const cursorEl  = document.getElementById('cursor');
const cDot      = cursorEl.querySelector('.cursor-dot');
const cRing     = cursorEl.querySelector('.cursor-ring');

const glitchLn  = document.getElementById('glitch-line');

// ── Cursor ─────────────────────────────────────────
// Both dot and ring are written from a single rAF loop via transform:
// translate3d() (compositor-only, no layout) instead of left/top on every
// mousemove, which forced layout twice per frame. Mouse position is
// cached on mousemove; the frame just reads the cache and writes once.
let mx = 0, my = 0, rx = 0, ry = 0;
let magnetTarget = null; // {cx, cy} of the nearest snap target, or null

const MAGNET_SEL   = 'a, button, .dot';
const MAGNET_RADIUS = 60;
let magnetEls = [];

function refreshMagnetEls() {
  magnetEls = [...document.querySelectorAll(MAGNET_SEL)];
}
refreshMagnetEls();

function findMagnetTarget(x, y) {
  let best = null, bestDist = MAGNET_RADIUS;
  for (const el of magnetEls) {
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    const dx = Math.max(r.left - x, 0, x - r.right);
    const dy = Math.max(r.top - y, 0, y - r.bottom);
    const dist = Math.hypot(dx, dy);
    if (dist < bestDist) {
      bestDist = dist;
      best = { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    }
  }
  return best;
}

document.addEventListener('mousemove', e => {
  mx = e.clientX; my = e.clientY;
  magnetTarget = findMagnetTarget(mx, my);
});

(function trackCursor() {
  cDot.style.transform = `translate3d(${mx}px, ${my}px, 0) translate(-50%, -50%)`;

  // The ring snaps toward a nearby interactive element's centre instead of
  // the raw mouse position; the dot always stays exact on the cursor.
  const tx = magnetTarget ? magnetTarget.cx : mx;
  const ty = magnetTarget ? magnetTarget.cy : my;
  const strength = magnetTarget ? 0.25 : 0.11;
  rx += (tx - rx) * strength;
  ry += (ty - ry) * strength;
  cRing.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`;

  requestAnimationFrame(trackCursor);
})();

// pointerover/out (not mouseover/mouseout) so this also works on browsers
// that only fire pointer events, and e.relatedTarget is checked against
// the same hoverable host so moving between a row and its own children
// doesn't spuriously toggle the hover state on and off.
const HOVER_SEL = 'a, button, .dot, .project-row';
document.addEventListener('pointerover', e => {
  const host = e.target.closest(HOVER_SEL);
  if (!host || host.contains(e.relatedTarget)) return;
  document.body.classList.add('is-hovering');
});
document.addEventListener('pointerout', e => {
  const host = e.target.closest(HOVER_SEL);
  if (!host || host.contains(e.relatedTarget)) return;
  document.body.classList.remove('is-hovering');
});

// ── FS Loader ──────────────────────────────────────
// A genuine preloader: it waits on real asset resolution (fonts, gallery
// image decode, a GitHub prefetch) capped by a 4000ms ceiling, with an
// 1100ms floor so it never flashes.
//
// Deliberately has zero GSAP involvement — every visual here is a plain
// CSS keyframe/transition. GSAP chains kept breaking cross-browser and
// leaving fragments stuck on screen; a CSS animation can't hang like that,
// and "did it finish" just becomes a real DOM event (animationend/
// transitionend) with a setTimeout as backup, not a timeline that has to
// complete every step in order. The mark: F and S snap in hard from
// opposite sides and glitch-flash on landing.
const LOADER_FLOOR = 1100;
const LOADER_CEILING = 4000;

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildLoaderAssets(projectsPromise) {
  const assets = [document.fonts.ready];
  document.querySelectorAll('.gal-item img').forEach(img => {
    assets.push(img.decode ? img.decode().catch(() => {}) : Promise.resolve());
  });
  assets.push(projectsPromise);
  return assets;
}

// Plays the F/S snap-in once. Resolves as soon as it's visually settled
// (CSS animation duration ~550ms + a brief glitch flash), never later than
// the hard cap below regardless of what the browser does with the CSS.
// Deliberately always plays, even under prefers-reduced-motion — this one
// mark is the site's identity moment, not decorative chrome, and Francesco
// wants it to run every time regardless of that setting.
function playLogoReveal() {
  return new Promise(resolve => {
    loaderName.classList.add('play');
    setTimeout(() => {
      loaderName.classList.add('flash');
      setTimeout(() => { loaderName.classList.remove('flash'); resolve(); }, 110);
    }, 620);
  });
}

// Single opacity fade on the whole (flat, one-layer) loader, via CSS
// transition rather than a JS-driven tween.
function fadeOutLoader() {
  return new Promise(resolve => {
    loader.addEventListener('transitionend', resolve, { once: true });
    loader.classList.add('exit');
    setTimeout(resolve, 1100); // hard cap
  });
}

async function runLoader(projectsPromise) {
  const start = performance.now();
  try {
    await Promise.all([
      playLogoReveal(),
      Promise.race([
        Promise.allSettled(buildLoaderAssets(projectsPromise)),
        wait(LOADER_CEILING),
      ]),
    ]);
    const remain = Math.max(0, LOADER_FLOOR - (performance.now() - start));
    if (remain) await wait(remain);
  } catch (e) {
    // Whatever broke, the loader still fades out below.
  } finally {
    await fadeOutLoader();
    onLoaderDone();
  }
}

function onLoaderDone() {
  if (loaded) return;
  loaded = true;
  loader.style.display = 'none';
  // Only start watching sections once the loader is out of the way, so the
  // entrance animation for whichever section is in view plays as a reveal
  // rather than finishing silently behind the opaque loader.
  sections.forEach(s => sectionObserver.observe(s));
  // First burst no earlier than 2.5s after the loader clears (see
  // syncGlitchScheduling's glitchStarted branch).
  syncGlitchScheduling();
}

// ── Section tracking (native scroll) ───────────────
// Single observer drives three things as sections cross the viewport:
// the current index (for nav/dots/counter + hash sync), the one-time
// entrance animation, and lazy triggers (GitHub fetch, gallery layout).
function onSectionIntersect(entries) {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const idx = sections.indexOf(entry.target);
    current = idx;
    updateNav(idx);
    history.replaceState(null, '', '#' + entry.target.id);

    if (idx === 4) onGalleryActivate();

    if (!entry.target.dataset.animated) {
      entry.target.dataset.animated = '1';
      animateIn(entry.target);
    }
  });
}
const sectionObserver = new IntersectionObserver(onSectionIntersect, { threshold: 0.55 });

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Explicit navigation (nav links, dots, arrow keys, boundary loop).
// Adjacent moves get a plain smooth scroll; jumps of 2+ sections get the
// curtain, since instant-scrolling several screens is disorienting but a
// one-step move isn't.
function jumpTo(idx, { push = false } = {}) {
  if (idx < 0 || idx >= TOTAL || idx === current) return;
  const target  = sections[idx];
  const dist    = Math.abs(idx - current);
  const reduced = prefersReducedMotion();

  if (push) history.pushState(null, '', '#' + target.id);

  if (!reduced && dist >= 2 && window.gsap) {
    ptIn(() => {
      target.scrollIntoView({ behavior: 'instant', block: 'start' });
      ptOut(() => {});
    });
  } else {
    target.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' });
  }
}

// Scroll to the initial hash (if any) while the loader still covers the
// screen, so there's no visible jump once it clears.
function initialHashJump() {
  const idx = sectionIds.indexOf(location.hash.slice(1));
  if (idx > 0) sections[idx].scrollIntoView({ behavior: 'instant', block: 'start' });
}

// Back/forward and manual hash edits.
window.addEventListener('hashchange', () => {
  const idx = sectionIds.indexOf(location.hash.slice(1));
  if (idx !== -1) jumpTo(idx, { push: false });
});

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
  if (!window.gsap) return;       // CSS .no-gsap rules already show the final state
  if (prefersReducedMotion()) return; // CSS reduced-motion rules already show the final state

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

// ── Projects ───────────────────────────────────────
// projects.json is an explicit allowlist: {repo, title, blurb, tags, url}.
// Nothing appears here unless it's in that file — the old version pulled
// whatever the unauthenticated GitHub API happened to return, which meant
// any repo pushed to next would silently appear on the front page. The
// manifest renders immediately (it's a local file, not a network
// dependency); GitHub is only used afterward to enrich each row with a
// language dot and a last-push date, cached in sessionStorage for 60
// minutes. If GitHub is unreachable or rate-limited, the manifest still
// renders exactly as written — no error state, because a 403 from GitHub
// isn't something this portfolio owes an apology for.
const LANG_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5',
  HTML:       '#e34c26', CSS:        '#563d7c', Vue:    '#41b883',
  Shell:      '#89e051', Rust:       '#dea584', Go:     '#00add8',
  Java:       '#b07219', Ruby:       '#701516', 'C++':  '#f34b7d',
  C:          '#555555', Kotlin:     '#a97bff', Swift:  '#ffac45',
};
const PROJECTS_CACHE_KEY = 'fs-projects-cache';
const PROJECTS_CACHE_TTL = 60 * 60 * 1000; // 60 minutes

function loadProjects() {
  if (ghFetched) return Promise.resolve();
  ghFetched = true;

  return fetch('projects.json')
    .then(r => r.json())
    .then(list => {
      renderProjects(list);
      return enrichProjects(list);
    })
    .catch(() => {}); // the manifest itself is the only thing that actually matters here
}

function renderProjects(list) {
  const container = document.getElementById('project-list');

  list.forEach((proj, i) => {
    const row = document.createElement('a');
    row.className = 'project-row';
    row.href       = proj.url;
    row.target     = '_blank';
    row.rel        = 'noopener';
    row.tabIndex   = 0;
    row.dataset.repo = proj.repo;

    const num = document.createElement('span');
    num.className = 'pr-num';
    num.textContent = String(i + 1).padStart(2, '0');

    const info = document.createElement('span');
    info.className = 'pr-info';
    const name = document.createElement('span');
    name.className = 'pr-name';
    name.textContent = proj.title;
    const desc = document.createElement('span');
    desc.className = 'pr-desc';
    desc.textContent = proj.blurb;
    info.append(name, desc);

    const tags = document.createElement('span');
    tags.className = 'pr-tags';
    (proj.tags || []).forEach(t => {
      const tagEl = document.createElement('span');
      tagEl.textContent = t;
      tags.appendChild(tagEl);
    });

    const langSlot = document.createElement('span');
    langSlot.className = 'pr-lang-slot';

    const arrow = document.createElement('span');
    arrow.className = 'pr-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M7 17L17 7M17 7H7M17 7V17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    row.append(num, info, tags, langSlot, arrow);
    container.appendChild(row);

    row.addEventListener('mousemove', e => {
      if (!window.gsap) return;
      const r = row.getBoundingClientRect();
      gsap.to(row, { rotateX: ((e.clientY - r.top) / r.height - 0.5) * 4, duration: 0.35, ease: 'power2.out', transformPerspective: 1000 });
    });
    row.addEventListener('mouseleave', () => {
      if (!window.gsap) return;
      gsap.to(row, { rotateX: 0, duration: 0.5, ease: 'expo.out' });
    });
  });

  refreshMagnetEls(); // rows are <a> tags, so they're cursor magnet targets too
}

function readProjectsCache() {
  try {
    const raw = sessionStorage.getItem(PROJECTS_CACHE_KEY);
    if (!raw) return {};
    const { ts, data } = JSON.parse(raw);
    return (Date.now() - ts < PROJECTS_CACHE_TTL) ? data : {};
  } catch (e) {
    return {};
  }
}

function writeProjectsCache(data) {
  try {
    sessionStorage.setItem(PROJECTS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch (e) {
    // sessionStorage unavailable (private mode, quota) — enrichment just
    // won't be cached this session, nothing else depends on it.
  }
}

function enrichProjects(list) {
  const cache   = readProjectsCache();
  const toFetch = list.filter(p => !cache[p.repo]);

  list.forEach(p => { if (cache[p.repo]) applyEnrichment(p.repo, cache[p.repo]); });
  if (!toFetch.length) return Promise.resolve();

  return Promise.allSettled(toFetch.map(proj =>
    fetch(`https://api.github.com/repos/aerusW/${proj.repo}`)
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(data => {
        const enrichment = { language: data.language, pushedAt: data.pushed_at };
        cache[proj.repo] = enrichment;
        applyEnrichment(proj.repo, enrichment);
      })
      .catch(() => {}) // per-repo enrichment failure is silent, same reasoning as above
  )).then(() => writeProjectsCache(cache));
}

function applyEnrichment(repo, { language, pushedAt }) {
  const row = document.querySelector(`.project-row[data-repo="${CSS.escape(repo)}"]`);
  if (!row) return;
  if (pushedAt) row.title = 'Last pushed ' + new Date(pushedAt).toLocaleDateString();
  if (!language) return;
  const slot = row.querySelector('.pr-lang-slot');
  const span = document.createElement('span');
  span.className = 'pr-lang';
  span.style.setProperty('--lang-color', LANG_COLORS[language] || '#888');
  span.textContent = language;
  slot.replaceChildren(span);
}

// ── Navigation ─────────────────────────────────────
// Scrolling itself is native (scroll-snap-type on <html>) — nothing here
// intercepts a normal wheel/touch scroll.

// Arrow keys are kept only as an explicit jump convenience; Space, PageUp/
// PageDown and Home/End are left untouched so the scroll container handles
// them natively.
window.addEventListener('keydown', e => {
  if (!loaded) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    jumpTo(current + 1, { push: true });
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    jumpTo(current - 1, { push: true });
  }
});

dots.forEach(dot => {
  dot.addEventListener('click', () => jumpTo(+dot.dataset.idx, { push: true }));
});

document.querySelectorAll('[data-to]').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    jumpTo(+el.dataset.to, { push: true });
  });
});

// ── Justified gallery layout ───────────────────────
// Below 900px the gallery is a plain CSS grid (see style.css) — this
// fixed two-row justified math assumes a desktop-width single row pair
// and is skipped entirely there rather than fighting the grid.
let galGrid, galItems, galImgs;
let galImgsReady    = false;
let galSectionShown = false;

function isNarrowViewport() {
  return window.innerWidth <= 900;
}

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
  if (isNarrowViewport()) return;
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

// Called from onSectionIntersect when gallery (idx 4) becomes visible
function onGalleryActivate() {
  galSectionShown = true;
  if (galImgsReady) requestAnimationFrame(applyJustified);
}

// ── Glitch ─────────────────────────────────────────
// Seeded per-burst randomisation (via CSS custom properties, see
// style.css) so no two bursts are byte-identical, gated on the hero
// actually being on screen and the tab actually being visible — an
// ambient effect nobody's looking at is just wasted paint.
const glitchLines = [...document.querySelectorAll('.hero-name em[data-text]')];
let heroVisible     = false;
let glitchTimer     = null;
let glitchStarted   = false;

function glitchRand(min, max) { return min + Math.random() * (max - min); }

function glitchActive() {
  return loaded && heroVisible && document.visibilityState === 'visible' && !prefersReducedMotion();
}

// Below 768px the glitch runs at half frequency and skips the scan line
// entirely — a smaller motion budget for the device most likely to be on
// a battery and a slower GPU.
function isMobileMotionBudget() {
  return window.innerWidth <= 768;
}

function syncGlitchScheduling() {
  if (glitchActive()) {
    if (!glitchTimer) {
      let delay = glitchStarted ? glitchRand(6000, 13000) : glitchRand(2500, 3000);
      if (isMobileMotionBudget()) delay *= 2;
      glitchStarted = true;
      glitchTimer = setTimeout(fireGlitch, delay);
    }
  } else if (glitchTimer) {
    clearTimeout(glitchTimer);
    glitchTimer = null;
  }
}

function fireGlitch() {
  glitchTimer = null;
  runGlitchBurst();
  if (!isMobileMotionBudget()) runScanLine();
  syncGlitchScheduling();
}

// A burst is 3-6 frames, each held 40-90ms, each with its own randomised
// slice band / offset / skew, snapped (no transition) rather than tweened
// to keep the harsh, stepped character. Some frames are left "clean" (no
// offset) so the burst reads as a flicker rather than one continuous shake.
function runGlitchBurst() {
  if (!glitchLines.length) return;
  const frameCount = 3 + Math.floor(Math.random() * 4);
  let i = 0;

  (function frame() {
    if (i >= frameCount) {
      clearGlitchVars();
      return;
    }
    const hit = Math.random() < 0.7;
    setGlitchVars(hit);
    i++;
    setTimeout(frame, glitchRand(40, 90));
  })();
}

function setGlitchVars(hit) {
  glitchLines.forEach(el => {
    el.classList.add('is-glitching');
    if (!hit) { el.style.setProperty('--glitch-op', '0'); return; }
    el.style.setProperty('--glitch-op', String(glitchRand(0.6, 0.95).toFixed(2)));
    el.style.setProperty('--gx', glitchRand(-10, 10).toFixed(1) + 'px');
    el.style.setProperty('--gy', glitchRand(-2, 2).toFixed(1) + 'px');
    el.style.setProperty('--skew', glitchRand(-2.5, 2.5).toFixed(2) + 'deg');
    const top = glitchRand(5, 75);
    el.style.setProperty('--slice-top', top.toFixed(1) + '%');
    el.style.setProperty('--slice-bot', (100 - top - glitchRand(8, 22)).toFixed(1) + '%');
    const top2 = glitchRand(5, 75);
    el.style.setProperty('--slice-top2', top2.toFixed(1) + '%');
    el.style.setProperty('--slice-bot2', (100 - top2 - glitchRand(8, 22)).toFixed(1) + '%');
  });
}

function clearGlitchVars() {
  const props = ['--glitch-op', '--gx', '--gy', '--skew', '--slice-top', '--slice-bot', '--slice-top2', '--slice-bot2'];
  glitchLines.forEach(el => {
    el.classList.remove('is-glitching');
    props.forEach(p => el.style.removeProperty(p));
  });
}

function runScanLine() {
  if (!glitchLn) return;
  glitchLn.classList.remove('active');
  void glitchLn.offsetWidth; // restart the animation
  glitchLn.classList.add('active');
}

const heroObserver = new IntersectionObserver(entries => {
  heroVisible = entries[0].isIntersecting;
  syncGlitchScheduling();
}, { threshold: 0.2 });
const homeSection = document.getElementById('home');
if (homeSection) heroObserver.observe(homeSection);

document.addEventListener('visibilitychange', syncGlitchScheduling);

// Hovering the nav logo fires one burst on demand, turning an ambient
// effect into something the visitor discovers.
const navLogo = document.querySelector('.nav-logo');
if (navLogo) {
  navLogo.addEventListener('pointerenter', () => {
    if (prefersReducedMotion()) return;
    runGlitchBurst();
    runScanLine();
  });
}

// ── Mobile scroll progress ─────────────────────────
// Replaces #side-dots below 900px: a 2px accent rule pinned to the top
// edge, width tracking how far down the document the visitor has scrolled.
const scrollProgressEl = document.getElementById('scroll-progress');
function updateScrollProgress() {
  if (!scrollProgressEl) return;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  scrollProgressEl.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
}

// ── Mobile auto-hiding header ──────────────────────
// The FS logo + hamburger hide on scroll-down and reappear on scroll-up,
// so the header doesn't permanently eat into a phone's limited vertical
// space. Only active below 900px (where the hamburger itself shows) and
// never while the mobile menu is open.
const NAV_HIDE_MIN_Y = 80; // don't hide near the very top of the page
let lastScrollY = window.scrollY;
function updateNavVisibility() {
  if (window.innerWidth > 900) {
    document.body.classList.remove('nav-hidden');
    lastScrollY = window.scrollY;
    return;
  }
  if (menuOpen) return;
  const y = window.scrollY;
  if (y > lastScrollY && y > NAV_HIDE_MIN_Y) {
    document.body.classList.add('nav-hidden');
  } else if (y < lastScrollY) {
    document.body.classList.remove('nav-hidden');
  }
  lastScrollY = y;
}

// Both handlers above are read+write DOM work triggered by 'scroll', which
// on mobile can fire far more often than once per frame — doing that work
// unthrottled is exactly the kind of thing that makes touch-scrolling feel
// laggy. Coalesce to at most once per animation frame.
let scrollTicking = false;
function onScroll() {
  if (scrollTicking) return;
  scrollTicking = true;
  requestAnimationFrame(() => {
    updateScrollProgress();
    updateNavVisibility();
    scrollTicking = false;
  });
}
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', updateScrollProgress, { passive: true });

// ── Mobile menu ─────────────────────────────────────
// Panels wipe in and links stagger up via plain CSS transitions (see
// style.css) rather than a GSAP timeline — after the loader's GSAP chains
// repeatedly got stuck mid-sequence, anything that can leave the site in
// a broken state (a menu stuck half-open, blocking the page) goes to CSS
// class toggles instead, which can't get stuck partway.
const menuToggle = document.getElementById('menu-toggle');
const mobileMenu = document.getElementById('mobile-menu');
const fpMain     = document.getElementById('fp');
const mmLinks    = [...document.querySelectorAll('.mm-link')];
let menuOpen = false;

function openMobileMenu() {
  if (menuOpen) return;
  menuOpen = true;
  menuToggle.setAttribute('aria-expanded', 'true');
  mobileMenu.setAttribute('aria-hidden', 'false');
  mobileMenu.classList.add('open');
  fpMain.setAttribute('inert', '');
  document.body.style.overflow = 'hidden';
  mmLinks[0]?.focus();
}

function closeMobileMenu() {
  if (!menuOpen) return;
  menuOpen = false;
  menuToggle.setAttribute('aria-expanded', 'false');
  mobileMenu.setAttribute('aria-hidden', 'true');
  mobileMenu.classList.remove('open');
  fpMain.removeAttribute('inert');
  document.body.style.overflow = '';
  menuToggle.focus();
}

if (menuToggle && mobileMenu) {
  menuToggle.addEventListener('click', () => {
    if (menuOpen) closeMobileMenu(); else openMobileMenu();
  });

  // Close on link select (navigation itself is already handled by the
  // site-wide [data-to] click handler further down).
  mmLinks.forEach(link => link.addEventListener('click', closeMobileMenu));

  // Close on backdrop tap — the two panels tile the full screen when
  // open, so "backdrop" here just means anywhere that isn't a link.
  mobileMenu.addEventListener('click', e => {
    if (!e.target.closest('.mm-link')) closeMobileMenu();
  });

  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && menuOpen) closeMobileMenu();
  });

  // Focus trap: only the links themselves are focusable inside the menu.
  mobileMenu.addEventListener('keydown', e => {
    if (e.key !== 'Tab' || !mmLinks.length) return;
    const first = mmLinks[0], last = mmLinks[mmLinks.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  });
}

// ── Init ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initialHashJump();
  initGallery();
  updateScrollProgress();
  // Render + enrich once regardless of loader path so the Projects
  // section never has to wait for it later.
  const projectsPromise = loadProjects();
  // The loader itself has no GSAP dependency, so it runs the same way
  // whether or not the CDN loaded — only the rest of the site's entrance
  // animations are gated on window.gsap (see animateIn/.no-gsap).
  runLoader(projectsPromise);
  // Safety net: if the loader's async sequence somehow never settles,
  // force it out of the way instead of leaving the site stuck behind it.
  setTimeout(() => { if (!loaded) onLoaderDone(); }, LOADER_CEILING + 5000);
});

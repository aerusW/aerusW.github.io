# Brief: aerusW.github.io — interaction rebuild, motion system, mobile, copy

Repo: `aerusW/aerusW.github.io` (GitHub Pages, custom domain `www.francescoserangeli.eu`).
Stack: three flat files — `index.html`, `style.css`, `main.js` — plus GSAP 3.12 from CDN and `Img/`.

**Read `git log` and the 4 open issues before touching anything.** Work in a branch per part; do not merge parts together into one commit.

---

## 0. Hard constraints

Do not change:

- The design tokens in `:root`. Accent stays `#c8102e`. Background stays `#080808`. Text stays `#f0ede8`.
- Space Grotesk / Space Mono pairing.
- No build step, no bundler, no framework, no npm. This deploys as static files from `master`. Vanilla JS + GSAP only.
- The three-file structure. New JS may go in additional plain `.js` files loaded with `<script>`, but no modules that require a server-side build.
- The custom cursor's *appearance* (5px dot + 28px ring, ring grows to 54px and turns accent-red on hover). It is correct. Only its implementation changes.
- The red/cyan glitch palette (`#c8102e` / `rgba(0,210,255,…)`) and its harsh, stepped, non-eased character.

Add, globally, and treat as acceptance criteria for every part:

- `prefers-reduced-motion: reduce` honoured everywhere. Every animation in this brief needs a reduced-motion path that is *instant state change*, not a slower animation.
- Visible keyboard focus. Right now `body { cursor: none }` plus no `:focus-visible` styling means keyboard navigation is invisible. Add a 1px accent outline with 3px offset on `:focus-visible` for every interactive element.
- GSAP failure fallback. Every `.up` element is set to `translateY(115%)` in CSS and only ever moved by GSAP. If the CDN is blocked or slow, the entire site is blank text. Add at the top of `main.js`: if `window.gsap` is undefined, put `.no-gsap` on `<html>` and add a CSS rule under `.no-gsap` that resets all `.up`, `.eyebrow`, `.el-block`, `.project-row` to their final visible state. Test it by blocking the CDN in devtools.

---

## 1. Navigation model — this is the main problem

The current model is a hand-rolled fullpage state machine and it is the reason the site feels bad to use. Specifically:

1. `wheel` is `preventDefault`ed on `window` with a non-passive listener, accumulated against a 60px threshold, then locked out for 1100ms. On a trackpad, inertial deltas blow past the threshold instantly and then you stare at a locked page for a second. There is no decay on `wheelAcc`, so slow opposite-direction scrolling accumulates incorrectly.
2. Every single section change — including a one-step scroll — plays a full-screen black curtain with an "FS" monogram: ~0.5s in, 0.3s monogram, 0.28s out, 0.52s uncover. That is roughly 1.6 seconds of *hidden content* per step, six sections deep. It reads as a loading screen for something that isn't loading.
3. `data-to` handlers call `preventDefault()` and never touch the URL, so there is no deep linking, no back button, no shareable section link, and a refresh always dumps you at Home.

**Replace it with native scroll.** Make `#fp` a real scroll container: `overflow-y: auto`, `scroll-snap-type: y mandatory`, each `.s` gets `scroll-snap-align: start` and `min-height: 100svh`. This gives correct trackpad momentum, correct touch behaviour, correct keyboard (space / PageDown / Home / End), correct screen-reader flow, and a real scrollbar position — all for free, and it deletes the wheel handler, the touch handler, `wheelLock`, `wheelAcc`, and `animating` entirely.

Then:

- Drive entrance animations from a single `IntersectionObserver` at `threshold: 0.55` instead of `activateSection()`. Sections animate in once and stay in; do not re-trigger on every pass, that is what makes a snap site feel twitchy. Keep an `data-animated` flag.
- **Keep the curtain, but only for jumps.** Clicking "Contact" from Home is a jump of 5 — that deserves the curtain, because instant-scrolling five screens is disorienting. Adjacent movement gets no curtain. Rule: `Math.abs(target - current) >= 2` → curtain + `scrollTo({behavior:'instant'})` behind it; otherwise `scrollTo({behavior:'smooth'})` with no curtain. This preserves the moment you liked and stops it being tax on every scroll.
- Add hash routing: update `location.hash` via `history.replaceState` as sections enter, and handle `hashchange` + initial hash on load so `/#projects` works and the back button works.
- Keyboard: keep the arrow-key handler only as a convenience that calls the same jump function; drop the custom PageUp/PageDown handling and let the scroll container do it.

If mandatory snapping ever traps content taller than the viewport (it will on short laptop screens in the About and Elsewhere sections), fall back to `scroll-snap-type: y proximity` under `@media (max-height: 700px)`.

---

## 2. Loader — make it real, and make it earn its runtime

Current loader is a fixed ~3.5s GSAP timeline with no relationship to anything actually loading. Meanwhile five gallery JPEGs load unthrottled in the background and the GitHub fetch doesn't start until the Projects section opens.

Rebuild it as a genuine preloader:

- Track real progress: `document.fonts.ready`, decode of all `Img/` gallery images via `img.decode()`, and a prefetch of the GitHub data. Progress bar width = resolved / total, eased.
- Floor of 1100ms so it never flashes; ceiling of 4000ms so a slow image can't hold the site hostage — past the ceiling, dismiss and let the gallery fill in late.
- Second visit in the same session (`sessionStorage`): run a 600ms short version. Do not punish someone who hits back.

For the "more complex" loading sequence he asked for, build this one — it stays inside the existing typographic vocabulary rather than adding new visual language:

1. **Manifest readout.** A left-aligned Space Mono column, 0.65rem, `--muted`, printing asset lines as they actually resolve — `fonts/space-grotesk … ok`, `img/risotto.jpg … ok`, `api/github … ok`. Real state, not fake text. This is the signature: it says "a person who builds things made this" without a single decorative element.
2. **Scramble resolve.** `FRANCESCO SERANGELI` resolves character-by-character out of a random glyph set (use `ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/\<>*#` — no emoji, no box-drawing), left to right, ~28ms per character step, each character locking after 3–5 scrambles. Runs against real progress: characters lock as assets resolve, so a fast connection genuinely resolves faster.
3. **Monogram collapse.** Resolved name collapses to `FS` — the two letters slide to centre while the rest clip out.
4. **Split wipe.** Existing two-panel wipe, kept as-is, but with a 1px `--accent` hairline that lags 60ms behind each panel edge.

Reduced motion: skip 1–3, show the monogram static for 400ms, wipe once.

---

## 3. Glitch engine — rewrite, same aesthetic

You like the effect; the implementation is the weak part. Current problems: one hardcoded `@keyframes` block so every burst is byte-identical and the eye learns it in three repeats; it fires on a blind `setTimeout` regardless of whether the hero is even on screen; the scan line sweeps the entire viewport while you're reading the Contact section; `filter: drop-shadow` on a `clamp(4rem, 9.5vw, 9.5rem)` heading is an expensive full-layer repaint every frame.

Rewrite as:

- **Layered RGB split, not drop-shadow.** Give `.hero-name` a `data-text` attribute; render two absolutely-positioned `::before`/`::after` copies, one offset red, one offset cyan, each with `clip-path: inset()` slicing a horizontal band. JS sets per-burst randomised values through CSS custom properties (`--gx`, `--gy`, `--slice-top`, `--slice-h`, `--skew`) so no two bursts are alike. Compositor-only properties: `transform` and `clip-path`, no `filter`.
- **Seeded burst generator.** A burst = 3–6 frames, each frame 40–90ms, each with its own slice band and offsets in the range currently used (±10px x, ±2px y, ±2.5deg skew). Keep the `steps()` feel by snapping frames rather than tweening between them.
- **Gate it on visibility.** Only run when the hero is intersecting *and* `document.visibilityState === 'visible'`. Kill the timer otherwise. Same for the scan line — it should be scoped to the hero section, not `position: fixed` across the whole page.
- **Give it a trigger.** Hovering the `FS` nav logo fires one burst on demand. Small thing, but it turns an ambient effect into something the visitor discovers.
- Reduced motion: no bursts at all.

Interval: 6–13s randomised, first burst no earlier than 2.5s after the loader clears.

---

## 4. Cursor — keep the look, fix the mechanism

- Currently writing `style.left` / `style.top` on every `mousemove`, which forces layout twice per frame. Switch to `transform: translate3d()` and batch both dot and ring into the single existing rAF loop. Cache the mouse position on `mousemove`, write in the frame.
- Add magnetic snap: within 60px of an `a`, `button`, or `.dot`, the ring lerps toward the element's centre at 0.25 strength instead of toward the mouse. Dot stays exact.
- Hide the whole thing and restore native cursors under `@media (hover: none), (pointer: coarse)` — `body { cursor: auto }`, `#cursor { display: none }`. Right now a touch device with a hardware pointer gets an invisible cursor.
- `HOVER_SEL` uses `mouseover`/`mouseout` on `document`, which fires spuriously on child elements. Use `pointerenter`/`pointerleave` with delegation, or check `e.relatedTarget`.

---

## 5. Mobile — currently there is effectively none

Below 600px `.nav-links` is `display: none` with no replacement, and below 900px `#side-dots` is hidden too. On a phone there is no way to navigate except blind swiping. Also: `height: 100vh` breaks under mobile browser chrome; the `@media (max-width: 900px)` gallery rules set `grid-template-*` on a `display: flex` container, so they do nothing; and the JS justified-gallery algorithm assumes exactly two rows.

Build a real mobile layer:

- **Units:** `100svh` for section min-height, `100dvh` for the loader and curtain overlays.
- **Scroll:** drop snapping below 768px. Sections become `min-height: 100svh; height: auto` in normal document flow with generous vertical padding. Full-screen snap on a phone is the single most common way a portfolio becomes unusable — content that overflows becomes unreachable.
- **Menu:** hamburger at top-right, 44×44px tap target, opening a full-screen overlay that reuses the curtain treatment — panels wipe in, links stagger up from `translateY(115%)` with the same `expo.out`, section numbers `01`–`06` in Space Mono on the left. Close on select, on Escape, on backdrop tap. Trap focus while open, `aria-expanded` on the button, `inert` on `#fp` behind it.
- **Progress:** replace side dots with a 2px `--accent` rule pinned to the top edge, width tracking scroll progress.
- **Gallery:** delete the dead grid rules. Single column below 600px, two columns 600–900px, images `aspect-ratio: 4/3` with `object-fit: cover`. Captions always visible below the image — there is no hover on a phone, so the current hover-only captions are simply invisible content. Skip the JS justified layout below 900px entirely and let CSS handle it.
- **Images:** add `loading="lazy"` + explicit `width`/`height` on all gallery images, and serve them at a sane size. `Img/1761656689369.jpg` and friends are almost certainly full-resolution camera output being downloaded over 4G. Resize to max 1600px on the long edge and re-encode; if you add `.webp` alongside, use `<picture>` with the JPEG as fallback.
- **Motion budget:** below 768px, run the glitch at half frequency and skip the scan line.
- Test at 360×640, 390×844, 430×932, and 768×1024 landscape.

---

## 6. Projects section — curate it, don't let the API decide

`fetchGithub()` pulls `users/aerusW/repos?sort=updated&per_page=10`, filters, sorts by stars, and renders whatever comes back. Three problems: unauthenticated GitHub is rate-limited to 60/hr per IP and *will* fail (it failed while writing this brief); there is no cache and no fallback, so a rate-limited visitor sees an error state; and most importantly, **whatever repo he happens to push to next appears on his front page automatically.** That is a privacy hole, not a feature.

Replace with:

- A committed `projects.json` manifest: an explicit allowlist of `{repo, title, blurb, tags, url}`. Nothing appears on the site unless it is in this file.
- GitHub API used only to *enrich* those entries with language and last-push date. `sessionStorage` cache with a 60-minute TTL.
- On API failure, render the manifest as-is with no error state. The section should never show "Couldn't reach GitHub" — that is his portfolio apologising for GitHub.
- Keep `escHtml`, but also escape `'` — and prefer `textContent` over `innerHTML` for the name and description fields.

Also: the LinkedIn link in the contact section is `href="#"`. Either point it somewhere or remove it.

---

## 7. Copy — replace verbatim

Use exactly what follows. Do not paraphrase, do not add. Anything marked `[CONFIRM]` must be raised with Francesco before it ships — do not guess a value.

### Head

```html
<title>Francesco Serangeli — developer, organiser, cook</title>
<meta name="description" content="Francesco Serangeli. Italian-Czech, based in Brussels. Software, politics, and cooking.">
```

### 01 · Home

- Eyebrow: `Developer · Organiser · Cook`
- Name: `FRANCESCO` / `SERANGELI` (unchanged)
- Sub: `Italian-Czech, based in Brussels. I write software, work in politics, and cook like it matters.`
- Primary button: `What I do`
- Ghost button: `Say hello` (unchanged — it's good)

### 02 · About

Heading stays `More than` / `one thing` / `at a time.` — it's the strongest line on the site.

Body:

> I'm Francesco. Born in Tuscany, half Czech, currently in Brussels reading Social Sciences at the VUB, with political science ahead in the final year. I sit on a student board, work on youth policy back in Italy, and build small tools whenever a problem annoys me enough. I trained in a professional kitchen before any of that, and it's still the part I'm least willing to give up.

Stats row — replace the current three with four:

| Label | Value |
|---|---|
| `Based in` | `Brussels, BE` |
| `From` | `Pontedera, Tuscany` |
| `Studying` | `Social Sciences — VUB` |
| `Online` | `aerusW ↗` (unchanged link) |

Drop the `Interests: Code · Politics · Food` stat — the eyebrow already says it and the About text says it better.

### 03 · Projects

Heading stays `Open` / `source work.`

Add a single intro line under the heading:

> A few things I've built and kept. Everything here is public — the rest isn't finished.

### 04 · Elsewhere

Heading stays `Beyond the screen.`

**Politics** (relabel from "Activism"):

> I don't follow politics from the sofa. Student representation in secondary school turned into a board seat in Brussels and youth policy work in Tuscany. Most of it is unglamorous — minutes, budgets, getting the right people into one room — and that's precisely the part that decides things.

**Kitchen** (unchanged label):

> I trained in a professional kitchen and never really left. Tuscan technique, mostly: few ingredients, no shortcuts, salt earlier than you think. It's the only thing that reliably makes me slow down.

**Workshop** (new third block — the grid becomes three columns on desktop, stacks on mobile):

> Self-hosted Linux, small hardware, and the specific satisfaction of a network that behaves. I break things deliberately so I understand them when they break by accident.

### 05 · Gallery

Heading stays `In pictures.`

Captions:

| File | Caption |
|---|---|
| `square clock.JPG` | `Clock tower — Brussels` |
| `Risotto.jpg` | `Red risotto — Pontedera` |
| `GiovaniSI.jpg` | `Giovanisì — Montecatini` |
| `vsco.png` | `Giovanisì, unimpressed — Montecatini` |
| `1761656689369.jpg` | `Next Generation Fest — 2025` |

Also fix the `alt` attributes to match — they currently differ from the captions, which is worse than either alone for a screen reader. Rename `1761656689369.jpg` to something readable while you're in there.

### 06 · Contact

Heading, sub, and email all stay as they are — `Talk to me / about anything.` and `Code, campaigns, or what to eat tonight.` are the best copy on the site. Don't touch them.

Footer, right side: change `Made in Italy` → `Pontedera → Brussels`.

---

## 8. What must not appear anywhere on this site

Non-negotiable. If any of this is currently in the repo — including in comments, commit messages, image EXIF, or `projects.json` — remove it.

- Any infrastructure detail: server locations, hostnames, VM identifiers, VPN or mesh-network setup, home network topology, router or hub models, ISP, anything that maps his physical setup.
- Any political party affiliation or membership.
- Any candidacy, application, or selection process that is not yet public.
- Any client, family, or third-party business work — company names, financial figures, strategy documents.
- Any private repository, or any public repository not explicitly listed in `projects.json`.
- Health, fitness, diet, or body metrics.
- Home or term-time address, or anything that narrows it below city level.
- Named third parties — partner, friends, family — in copy, captions, or alt text.
- Strip EXIF from every image in `Img/` before commit. Phone photos carry GPS. Run `exiftool -all= Img/*` or equivalent and verify with `exiftool Img/*.jpg | grep -i gps` returning nothing.

---

## 9. Acceptance checklist

Run through this before opening the PR:

- [ ] Trackpad scroll feels like scrolling. No lockout, no accumulator, no `preventDefault` on wheel.
- [ ] Adjacent section change plays no curtain; a nav jump of 2+ sections does.
- [ ] `/#projects` deep-links correctly; the browser back button moves between sections.
- [ ] Loader progress reflects actual asset resolution — verify by throttling to Slow 3G and watching the manifest lines resolve in real time.
- [ ] Loader is ≥1100ms and ≤4000ms; second visit in-session runs the 600ms version.
- [ ] No two glitch bursts are identical. Glitch stops entirely when the hero is scrolled away or the tab is backgrounded.
- [ ] Blocking the GSAP CDN still yields a fully readable site.
- [ ] `prefers-reduced-motion: reduce` produces a static, instantly-usable site with no animation anywhere.
- [ ] Tab through the entire page with focus visible at every stop; mobile menu traps focus and closes on Escape.
- [ ] GitHub API returning 403 shows the curated projects with no error state.
- [ ] 360px wide: every section reachable, every caption readable, menu works, nothing horizontally scrolls.
- [ ] Lighthouse mobile performance ≥90 and accessibility ≥95.
- [ ] `exiftool Img/*` shows no GPS, no serial numbers, no owner name.

/* ==========================================================================
   Everlight Memorials — main.js
   ========================================================================== */

/* --------------------------------------------------------------------------
   Helpers
   -------------------------------------------------------------------------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const esc = s => String(s).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const fmtDate = iso => new Date(iso).toLocaleDateString('en-KE', {
  day: 'numeric', month: 'long', year: 'numeric'
});

const initials = n => n
  .split(' ').filter(Boolean).slice(0, 2)
  .map(w => w[0]).join('').toUpperCase();

const store = {
  get(k, f) { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ==========================================================================
   Heritage Motion System
   --------------------------------------------------------------------------
   A bespoke animation layer for Everlight Memorials.

   Principles:
     • No blur, no glow pulses. Motion is structural, not decorative.
     • Cards unfold from the top — like opening a keepsake letter.
     • Headings are engraved in with a left-to-right clip-path wipe.
     • Services & tributes imprint from alternating sides (a press, a seal).
     • The memorial avatar gains a drawn crown ring.
     • Lighting a candle releases drifting embers.

   Public API:
     HeritageMotion.apply(scope) → activate on a container (or whole doc)
   ========================================================================== */
const HeritageMotion = (() => {
  const reduced = prefersReducedMotion();
  const hasIO   = 'IntersectionObserver' in window;

  /* -------- 1. Unfold — cards open from the top like a letter -------- */
  function unfold(scope) {
    const sel = '.card, .panel, .quote, .fact';
    const nodes = [...scope.querySelectorAll(sel)].filter(n => !n.classList.contains('unfold'));
    if (!nodes.length) return;

    nodes.forEach(n => n.classList.add('unfold'));

    if (reduced || !hasIO) {
      nodes.forEach(n => n.classList.add('unfolded'));
      return;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const el = e.target;
        const sibs = [...el.parentElement.children].filter(c => c.classList.contains('unfold'));
        const idx = sibs.indexOf(el);
        el.style.setProperty('--fold-delay', `${Math.min(idx * 90, 540)}ms`);
        el.classList.add('unfolded');
        io.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -50px 0px' });

    nodes.forEach(n => io.observe(n));
  }

  /* -------- 2. Engrave — headings wiped in left-to-right -------- */
  function engrave(scope) {
    const heads = [...scope.querySelectorAll(
      '.section h1:not(.engrave), .section h2:not(.engrave), .memorial-hero h1:not(.engrave)'
    )];
    if (!heads.length) return;

    heads.forEach(h => h.classList.add('engrave'));

    if (reduced || !hasIO) {
      heads.forEach(h => h.classList.add('engraved'));
      return;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add('engraved');
        io.unobserve(e.target);
      });
    }, { threshold: 0.4 });

    heads.forEach(h => io.observe(h));
  }

  /* -------- 3. Imprint — services & tributes press in from the sides -------- */
  function imprint(scope) {
    const nodes = [...scope.querySelectorAll('.tribute:not(.imprint)')];
    if (!nodes.length) return;

    nodes.forEach(n => n.classList.add('imprint'));

    if (reduced || !hasIO) {
      nodes.forEach(n => n.classList.add('imprinted'));
      return;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add('imprinted');
        io.unobserve(e.target);
      });
    }, { threshold: 0.15 });

    nodes.forEach(n => io.observe(n));
  }

  /* -------- 4. Crown — a ring draws itself around the memorial avatar -------- */
  function crown(scope) {
    if (reduced) return;
    const avatar = scope.querySelector('.memorial-hero .avatar:not([data-crown])');
    if (!avatar) return;
    avatar.dataset.crown = '1';

    const ring = document.createElement('span');
    ring.className = 'crown-ring';
    ring.setAttribute('aria-hidden', 'true');
    avatar.appendChild(ring);
  }

  /* -------- 5. Embers — little sparks drift upward from the candle -------- */
  function embers(scope) {
    const btn = scope.querySelector('#candle:not([data-embers-bound])');
    if (!btn || reduced) return;
    btn.dataset.embersBound = '1';

    btn.addEventListener('click', () => {
      const flame = document.createElement('span');
      flame.className = 'flame';
      flame.setAttribute('aria-hidden', 'true');
      btn.appendChild(flame);
      setTimeout(() => flame.remove(), 1600);

      for (let i = 0; i < 6; i++) {
        const ember = document.createElement('span');
        ember.className = 'ember';
        ember.setAttribute('aria-hidden', 'true');
        ember.style.setProperty('--ember-x', `${(Math.random() - 0.5) * 46}px`);
        ember.style.setProperty('--ember-delay', `${i * 70}ms`);
        ember.style.setProperty('--ember-size', `${2 + Math.random() * 2}px`);
        btn.appendChild(ember);
        setTimeout(() => ember.remove(), 2200 + i * 70);
      }
    });
  }

  /* -------- Public API -------- */
  return {
    apply(scope = document) {
      unfold(scope);
      engrave(scope);
      imprint(scope);
      crown(scope);
      embers(scope);
    }
  };
})();

/* ==========================================================================
   Hero slideshow
   --------------------------------------------------------------------------
   Crossfades between .hero-slide elements. Auto-advances, pauses on hover,
   and responds to dot clicks. Respects prefers-reduced-motion.
   ========================================================================== */
function initHeroSlideshow() {
  const slides = $$('.hero-slide');
  const dots   = $$('.hero-dot');
  if (slides.length < 2) return;                    // nothing to rotate

  const reduced = prefersReducedMotion();
  const INTERVAL = 6000;                            // 6 s per slide

  // Faster / no crossfade if user prefers reduced motion
  if (reduced) {
    slides.forEach(s => s.style.transition = 'none');
  }

  let index = 0;
  let timer = null;

  const show = (i) => {
    index = (i + slides.length) % slides.length;
    slides.forEach((s, n) => s.classList.toggle('is-active', n === index));
    dots.forEach((d, n) => d.classList.toggle('is-active', n === index));
  };

  const start = () => {
    if (timer || reduced) return;
    timer = setInterval(() => show(index + 1), INTERVAL);
  };

  const stop = () => {
    clearInterval(timer);
    timer = null;
  };

  // Dot clicks
  dots.forEach(dot => {
    dot.addEventListener('click', () => {
      show(Number(dot.dataset.slide));
      stop();
      start();
    });
  });

  // Pause on hover — keeps the current photo viewable
  const hero = document.querySelector('.hero');
  if (hero && !reduced) {
    hero.addEventListener('mouseenter', stop);
    hero.addEventListener('mouseleave', start);
  }

  // Pause when the tab is not visible (battery-friendly)
  document.addEventListener('visibilitychange', () => {
    document.hidden ? stop() : start();
  });

  // Kick off
  start();
}

/* --------------------------------------------------------------------------
   Shared header / footer
   -------------------------------------------------------------------------- */
function renderChrome() {
  const page = document.body.dataset.page;
  const link = (href, label, key) =>
    `<li><a href="${href}" class="${page === key ? 'active' : ''}">${label}</a></li>`;

  $('#site-header').outerHTML = `
    <header class="site-header">
      <div class="container nav">
        <a class="logo" href="index.html">🕯️ Ever<span>light</span></a>
        <button class="menu-toggle" aria-label="Toggle menu" aria-expanded="false">☰</button>
        <ul class="nav-links">
          ${link('index.html', 'Home', 'home')}
          ${link('obituaries.html', 'Obituaries', 'obituaries')}
          ${link('index.html#services', 'Services', 'services')}
          <li><a class="btn gold" href="submit.html">Post an obituary</a></li>
        </ul>
      </div>
    </header>`;

  $('#site-footer').outerHTML = `
    <footer class="site-footer">
      <div class="container">
        <div class="footer-grid">
          <div>
            <h3>🕯️ Everlight Memorials</h3>
            <p>A peaceful place to honour loved ones, share tributes and find comfort, wherever you are in the world.</p>
          </div>
          <div>
            <h3>Explore</h3>
            <ul>
              <li><a href="obituaries.html">Obituaries</a></li>
              <li><a href="submit.html">Post an obituary</a></li>
              <li><a href="index.html#services">Services</a></li>
            </ul>
          </div>
          <div>
            <h3>Contact</h3>
            <ul>
              <li>📞 +254 7XX XXX XXX</li>
              <li>✉️ hello@everlight.example</li>
              <li>📍 Nairobi, Kenya</li>
            </ul>
          </div>
        </div>
        <div class="copy">© ${new Date().getFullYear()} Everlight Memorials. All rights reserved.</div>
      </div>
    </footer>`;

  const toggle = $('.menu-toggle');
  const nav = $('.nav-links');
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  });
}

/* --------------------------------------------------------------------------
   Obituary cards
   -------------------------------------------------------------------------- */
const cardHTML = o => `
  <a class="card" href="obituary.html?id=${encodeURIComponent(o.id)}">
    <div class="portrait" style="--c1:${o.c1};--c2:${o.c2}" aria-hidden="true">${initials(o.name)}</div>
    <div class="card-body">
      <h3>🕊️ ${esc(o.name)}</h3>
      <div class="dates">${esc(o.born)} – ${new Date(o.died).getFullYear()} · Age ${o.age}</div>
      <p>${esc(o.summary)}</p>
      <div class="meta">${esc(o.county)} County</div>
    </div>
  </a>`;

function allObituaries() {
  return [...store.get('everlight_submissions', []), ...OBITUARIES];
}

/* --------------------------------------------------------------------------
   Home page
   -------------------------------------------------------------------------- */
function initHome() {
  const el = $('#recent');
  if (!el) return;

  el.innerHTML = allObituaries().slice(0, 4).map(cardHTML).join('');

  // Unfold the freshly rendered cards + engrave the section headings
  HeritageMotion.apply(el.closest('main'));

  // Stagger the Services and Testimonials grids
  revealGrid('.services-grid');
  revealGrid('.quotes-grid');
}

/* --------------------------------------------------------------------------
   Obituaries list page
   -------------------------------------------------------------------------- */
function initList() {
  const grid = $('#list');
  if (!grid) return;

  const q = $('#q');
  const county = $('#county');
  const data = allObituaries();

  [...new Set(data.map(o => o.county))].sort()
    .forEach(c => county.add(new Option(c, c)));

  const render = () => {
    const term = q.value.trim().toLowerCase();
    const res = data.filter(o =>
      (!county.value || o.county === county.value) &&
      (!term || o.name.toLowerCase().includes(term))
    );

    grid.innerHTML = res.length
      ? res.map(cardHTML).join('')
      : '<p class="empty">No obituaries found. Try a different name or county.</p>';

    $('#count').textContent = `${res.length} obituar${res.length === 1 ? 'y' : 'ies'}`;

    // Unfold the new result set
    HeritageMotion.apply(grid);
  };

  q.addEventListener('input', render);
  county.addEventListener('change', render);
  render();

  // Engrave the search chrome on first load
  HeritageMotion.apply(document.querySelector('main'));
}

/* --------------------------------------------------------------------------
   Single obituary page
   -------------------------------------------------------------------------- */
function initObituary() {
  const root = $('#obituary');
  if (!root) return;

  const id = new URLSearchParams(location.search).get('id');
  const o = allObituaries().find(x => x.id === id);

  if (!o) {
    root.innerHTML = `
      <div class="container section center">
        <h1>Obituary not found</h1>
        <p><a href="obituaries.html">Back to all obituaries</a></p>
      </div>`;
    return;
  }

  document.title = `${o.name} | Everlight Memorials`;

  const candleKey = `candles_${o.id}`;
  const tribKey = `tributes_${o.id}`;

  root.innerHTML = `
    <section class="memorial-hero">
      <div class="container">
        <div class="avatar" aria-hidden="true">${initials(o.name)}</div>
        <h1>${esc(o.name)}</h1>
        <p>${esc(o.born)} – ${new Date(o.died).getFullYear()} · Age ${o.age}</p>
      </div>
    </section>

    <section class="section">
      <div class="container" style="max-width:820px">
        <a class="back" href="obituaries.html">← All obituaries</a>
        <h2>Life story</h2>
        <p>${esc(o.story)}</p>

        <div class="facts">
          <div class="fact"><b>Passed on</b>${fmtDate(o.died)}</div>
          <div class="fact"><b>Home county</b>${esc(o.county)}</div>
          ${o.service ? `<div class="fact"><b>Service</b>${esc(o.service)}</div>` : ''}
          ${o.burial ? `<div class="fact"><b>Burial</b>${esc(o.burial)}</div>` : ''}
        </div>

        <div class="candle-row">
          <button class="btn gold" id="candle">🕯️ Light a candle</button>
          <span id="candle-count"></span>
          <button class="btn ghost" id="share">Share</button>
        </div>

        <h2 style="margin-top:48px">Tributes and condolences</h2>
        <div id="tributes"></div>

        <div class="panel">
          <h3>Leave a message</h3>
          <form id="tribute-form" novalidate>
            <div>
              <label for="t-name">Your name</label>
              <input id="t-name" maxlength="60" required>
              <div class="error"></div>
            </div>
            <div>
              <label for="t-msg">Your message</label>
              <textarea id="t-msg" maxlength="600" required></textarea>
              <div class="error"></div>
            </div>
            <button class="btn" type="submit">Post tribute</button>
          </form>
        </div>
      </div>
    </section>`;

  // ---- Candle counter ----
  const count = () => {
    const n = store.get(candleKey, 0);
    $('#candle-count').textContent = n
      ? `${n} candle${n > 1 ? 's' : ''} lit in memory`
      : 'Be the first to light a candle';
  };
  $('#candle').onclick = () => {
    store.set(candleKey, store.get(candleKey, 0) + 1);
    count();
  };
  count();

  // ---- Share ----
  $('#share').onclick = async () => {
    const data = { title: o.name, text: `In loving memory of ${o.name}`, url: location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(location.href);
        $('#share').textContent = 'Link copied ✓';
      }
    } catch {}
  };

  // ---- Tributes ----
  const list = () => {
    const t = store.get(tribKey, []);
    $('#tributes').innerHTML = t.length
      ? t.map(x => `
          <div class="tribute">
            <p>${esc(x.msg)}</p>
            <small>– ${esc(x.name)}, ${esc(x.date)}</small>
          </div>`).join('')
      : '<p class="lead">No messages yet. Share a memory or word of comfort.</p>';

    HeritageMotion.apply($('#tributes'));
  };
  list();

  $('#tribute-form').addEventListener('submit', e => {
    e.preventDefault();
    const n = $('#t-name');
    const m = $('#t-msg');
    if (!validate([n, m])) return;

    const t = store.get(tribKey, []);
    t.unshift({
      name: n.value.trim(),
      msg: m.value.trim(),
      date: new Date().toLocaleDateString('en-KE')
    });
    store.set(tribKey, t);
    n.value = '';
    m.value = '';
    list();
  });

  // Animate the whole memorial
  HeritageMotion.apply(root);
}

/* --------------------------------------------------------------------------
   Form validation
   -------------------------------------------------------------------------- */
function validate(fields) {
  let ok = true;

  fields.forEach(f => {
    const err = f.parentElement.querySelector('.error');
    let msg = '';

    if (f.required && !f.value.trim()) {
      msg = 'This field is required.';
    } else if (f.type === 'email' && f.value && !/^\S+@\S+\.\S+$/.test(f.value)) {
      msg = 'Enter a valid email address.';
    } else if (f.type === 'tel' && f.value && !/^[+\d\s-]{9,15}$/.test(f.value)) {
      msg = 'Enter a valid phone number.';
    }

    if (err) err.textContent = msg;
    f.classList.toggle('invalid', !!msg);
    if (msg) ok = false;
  });

  const bad = fields.find(f => f.classList.contains('invalid'));
  if (bad) bad.focus();
  return ok;
}

/* --------------------------------------------------------------------------
   Submit obituary page
   -------------------------------------------------------------------------- */
function initSubmit() {
  const form = $('#submit-form');
  if (!form) return;

  const f = {
    name: $('#name'), born: $('#born'), died: $('#died'),
    county: $('#s-county'), story: $('#story'),
    service: $('#service'), burial: $('#burial'),
    contact: $('#contact'), email: $('#email'), phone: $('#phone')
  };

  const preview = () => {
    const n = f.name.value.trim() || 'Full name';
    $('#pv-name').textContent = n;
    $('#pv-init').textContent = initials(n) || '—';

    const by = f.born.value ? new Date(f.born.value).getFullYear() : '????';
    const dy = f.died.value ? new Date(f.died.value).getFullYear() : '????';
    $('#pv-dates').textContent = `${by} – ${dy}`;

    $('#pv-county').textContent = (f.county.value || 'County') + ' County';
    $('#pv-story').textContent =
      f.story.value.slice(0, 140) || 'A short life story will appear here.';
  };

  form.addEventListener('input', preview);
  preview();

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!validate([f.name, f.born, f.died, f.county, f.story, f.contact, f.email])) return;
    if (f.phone.value && !validate([f.phone])) return;

    const by = new Date(f.born.value).getFullYear();
    const dy = new Date(f.died.value).getFullYear();
    const hue = Math.floor(Math.random() * 360);

    const entry = {
      id: `${f.name.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
      name: f.name.value.trim(),
      born: String(by),
      died: f.died.value,
      age: dy - by,
      county: f.county.value,
      summary: f.story.value.trim().slice(0, 110) + (f.story.value.length > 110 ? '…' : ''),
      story: f.story.value.trim(),
      service: f.service.value.trim(),
      burial: f.burial.value.trim(),
      c1: `hsl(${hue} 35% 35%)`,
      c2: `hsl(${hue} 40% 18%)`
    };

    const all = store.get('everlight_submissions', []);
    all.unshift(entry);
    store.set('everlight_submissions', all);

    form.reset();
    preview();

    const n = $('#notice');
    n.innerHTML = `✓ Thank you. The obituary has been saved. <a href="obituary.html?id=${encodeURIComponent(entry.id)}">View it here</a>.`;
    n.classList.add('show');
    n.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // Animate the form panel and the preview card
  HeritageMotion.apply(document.querySelector('main'));
}

/* --------------------------------------------------------------------------
   Services & Testimonials — stagger reveal
   -------------------------------------------------------------------------- */
function revealGrid(gridSelector) {
  const grid = document.querySelector(gridSelector);
  if (!grid) return;

  const items = [...grid.children];
  const reduced = prefersReducedMotion();

  if (reduced || !('IntersectionObserver' in window)) {
    items.forEach(el => el.classList.add('in'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const sibs = [...el.parentElement.children];
      const idx = sibs.indexOf(el);
      el.style.transitionDelay = `${Math.min(idx * 70, 420)}ms`;
      el.classList.add('in');
      io.unobserve(el);
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  items.forEach(el => io.observe(el));
}

/* --------------------------------------------------------------------------
   Boot
   -------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  renderChrome();
  initHome();
  initList();
  initObituary();
  initSubmit();
  initHeroSlideshow();   // ← the missing line
});
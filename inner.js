/* ═══════════════════════════════════════════════════════════════════════════
   SRCA — inner pages runtime
   Everything the non-homepage pages need: navbar, scroll reveals, count-up,
   gallery lightbox, shop cart (localStorage), stress-test scoring, auth steps.
   The homepage keeps its own main.js (3D board + carousels). Nav/reveal logic
   here mirrors main.js so both feel identical.
   ═══════════════════════════════════════════════════════════════════════════ */

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ─── Navbar ──────────────────────────────────────────────────────────────── */
const initNav = () => {
  const navbar = document.getElementById('navbar');
  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');
  if (!navbar) return;

  // Pill → full-width bar once the page scrolls
  const onScroll = () => navbar.classList.toggle('expanded', window.scrollY > 50);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Mark the current page in the menu
  const here = location.pathname.replace(/\/index\.html$/, '/');
  navbar.querySelectorAll('.nav-links a[href]').forEach((a) => {
    const href = a.getAttribute('href');
    if (!href || href.startsWith('http') || href === '/') return;
    if (here === href || here.startsWith(href.replace(/\.html$/, ''))) {
      a.classList.add('is-current');
      a.setAttribute('aria-current', 'page');
      const dd = a.closest('.dropdown');
      if (dd) dd.querySelector('.dropdown-trigger')?.classList.add('is-current');
    }
  });

  if (!toggle || !links) return;
  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    links.classList.toggle('is-open', open);
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  links.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  document.addEventListener('click', (e) => { if (!e.target.closest('#navbar')) setOpen(false); });
  links.querySelectorAll('.dropdown-trigger').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.setAttribute('aria-expanded', String(btn.getAttribute('aria-expanded') !== 'true'));
    });
  });
};

/* ─── Count-up ────────────────────────────────────────────────────────────── */
const runCountUp = (el) => {
  const target = parseFloat(el.dataset.countTo);
  if (Number.isNaN(target)) return;
  const decimals = parseInt(el.dataset.countDecimals || '0', 10);
  if (REDUCED) { el.textContent = target.toFixed(decimals); return; }
  const duration = 1600;
  let start = null;
  const step = (now) => {
    if (start === null) start = now;
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = (target * eased).toFixed(decimals);
    if (t < 1) window.requestAnimationFrame(step);
  };
  window.requestAnimationFrame(step);
};

/* ─── Scroll reveal ───────────────────────────────────────────────────────── */
const initReveal = () => {
  const targets = document.querySelectorAll('[data-reveal]');
  if (REDUCED || !('IntersectionObserver' in window)) {
    targets.forEach((el) => {
      el.classList.add('is-revealed');
      el.querySelectorAll('[data-count-to]').forEach(runCountUp);
    });
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target;
      const group = el.closest('[data-reveal-group]');
      let delay = 0;
      if (group) {
        const sibs = Array.from(group.querySelectorAll('[data-reveal]'));
        delay = Math.min(sibs.indexOf(el) * 90, 540);
      }
      el.style.setProperty('--reveal-delay', delay + 'ms');
      el.classList.add('is-revealed');
      el.querySelectorAll('[data-count-to]').forEach(runCountUp);
      io.unobserve(el);
    }
  }, { threshold: 0, rootMargin: '0px 0px -12% 0px' });
  targets.forEach((el) => io.observe(el));
};

/* ─── Toast ───────────────────────────────────────────────────────────────── */
let toastTimer;
const toast = (msg) => {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2600);
};

/* ─── Gallery lightbox ────────────────────────────────────────────────────── */
// <a href="full.jpg" data-lightbox="gallery" data-caption="…"><img …></a>
const initLightbox = () => {
  const links = Array.from(document.querySelectorAll('[data-lightbox]'));
  if (!links.length) return;

  const dlg = document.createElement('dialog');
  dlg.className = 'lightbox';
  dlg.innerHTML = `
    <button type="button" class="lb-close" aria-label="Close"><i class="fas fa-times" aria-hidden="true"></i></button>
    <button type="button" class="lb-nav lb-prev" aria-label="Previous"><i class="fas fa-chevron-left" aria-hidden="true"></i></button>
    <figure class="lb-figure">
      <img class="lb-img" alt="">
      <figcaption class="lb-caption"></figcaption>
    </figure>
    <button type="button" class="lb-nav lb-next" aria-label="Next"><i class="fas fa-chevron-right" aria-hidden="true"></i></button>
    <span class="lb-count" aria-live="polite"></span>`;
  document.body.appendChild(dlg);

  const img = dlg.querySelector('.lb-img');
  const cap = dlg.querySelector('.lb-caption');
  const count = dlg.querySelector('.lb-count');
  let group = links;
  let index = 0;

  const show = (i) => {
    index = (i + group.length) % group.length;
    const a = group[index];
    img.src = a.getAttribute('href');
    img.alt = a.dataset.caption || a.querySelector('img')?.alt || '';
    cap.textContent = a.dataset.caption || '';
    cap.hidden = !cap.textContent;
    count.textContent = group.length > 1 ? `${index + 1} / ${group.length}` : '';
  };
  const open = (a) => {
    const name = a.dataset.lightbox;
    group = links.filter((l) => l.dataset.lightbox === name);
    show(group.indexOf(a));
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    document.body.classList.add('lb-open');
  };
  const close = () => { dlg.close(); document.body.classList.remove('lb-open'); };

  links.forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); open(a); }));
  dlg.querySelector('.lb-close').addEventListener('click', close);
  dlg.querySelector('.lb-prev').addEventListener('click', () => show(index - 1));
  dlg.querySelector('.lb-next').addEventListener('click', () => show(index + 1));
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  dlg.addEventListener('close', () => document.body.classList.remove('lb-open'));
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(index - 1);
    if (e.key === 'ArrowRight') show(index + 1);
  });
};

/* ─── Shop cart (localStorage) ────────────────────────────────────────────── */
// Buttons: <button data-add-to-cart data-id data-name data-price data-image>
// Cart page: <tbody data-cart-rows>, [data-cart-subtotal], [data-cart-empty]
const CART_KEY = 'srca-cart';
const readCart = () => { try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; } };
const writeCart = (items) => { localStorage.setItem(CART_KEY, JSON.stringify(items)); syncCartCount(); };
const money = (n) => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const syncCartCount = () => {
  const n = readCart().reduce((s, i) => s + i.qty, 0);
  document.querySelectorAll('[data-cart-count]').forEach((el) => {
    el.textContent = n;
    el.classList.toggle('is-empty', n === 0);
  });
};

const initCart = () => {
  syncCartCount();

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-add-to-cart]');
    if (!btn) return;
    e.preventDefault();
    const items = readCart();
    const id = btn.dataset.id;
    const found = items.find((i) => i.id === id);
    if (found) found.qty += 1;
    else items.push({ id, name: btn.dataset.name, price: Number(btn.dataset.price), image: btn.dataset.image, qty: 1 });
    writeCart(items);
    toast(`Added “${btn.dataset.name}” to your cart`);
    btn.classList.add('is-added');
    setTimeout(() => btn.classList.remove('is-added'), 900);
  });

  const rows = document.querySelector('[data-cart-rows]');
  if (!rows) return;
  const subtotalEl = document.querySelector('[data-cart-subtotal]');
  const emptyEl = document.querySelector('[data-cart-empty]');
  const tableWrap = document.querySelector('[data-cart-table]');
  const summary = document.querySelector('[data-cart-summary]');

  const render = () => {
    const items = readCart();
    rows.innerHTML = '';
    let subtotal = 0;
    items.forEach((it) => {
      const line = it.price * it.qty;
      subtotal += line;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="cart-remove"><button type="button" class="cart-x" data-remove="${it.id}" aria-label="Remove ${it.name}"><i class="fas fa-times" aria-hidden="true"></i></button></td>
        <td class="cart-thumb"><img src="${it.image}" alt="" loading="lazy"></td>
        <td class="cart-name" data-title="Product">${it.name}</td>
        <td class="cart-price" data-title="Price">${money(it.price)}</td>
        <td class="cart-qty" data-title="Quantity">
          <div class="qty">
            <button type="button" data-qty="${it.id}" data-delta="-1" aria-label="Decrease">−</button>
            <span>${it.qty}</span>
            <button type="button" data-qty="${it.id}" data-delta="1" aria-label="Increase">+</button>
          </div>
        </td>
        <td class="cart-total" data-title="Total">${money(line)}</td>`;
      rows.appendChild(tr);
    });
    if (subtotalEl) subtotalEl.textContent = money(subtotal);
    const empty = items.length === 0;
    if (emptyEl) emptyEl.hidden = !empty;
    if (tableWrap) tableWrap.hidden = empty;
    if (summary) summary.hidden = empty;
  };

  rows.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-remove]');
    const q = e.target.closest('[data-qty]');
    if (rm) { writeCart(readCart().filter((i) => i.id !== rm.dataset.remove)); render(); }
    if (q) {
      const items = readCart();
      const it = items.find((i) => i.id === q.dataset.qty);
      if (it) {
        it.qty = Math.max(1, it.qty + Number(q.dataset.delta));
        writeCart(items); render();
      }
    }
  });
  render();
};

/* ─── Stress test (PSS-style, 10 questions scored 0–4) ─────────────────────── */
// <form data-stress-test> radios q1..q10, [data-stress-result], [data-stress-meter] (svg circle), [data-stress-percent]
const initStressTest = () => {
  const form = document.querySelector('[data-stress-test]');
  if (!form) return;
  const result = document.querySelector('[data-stress-result]');
  const fill = document.querySelector('[data-stress-meter]');
  const pct = document.querySelector('[data-stress-percent]');
  const panel = document.querySelector('[data-stress-panel]');
  const rows = Array.from(document.querySelectorAll('[data-stress-band]'));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const answers = Array.from(new FormData(form).values()).map(Number);
    const total = form.querySelectorAll('.quiz-q').length;
    if (answers.length < total) {
      const firstMissing = Array.from(form.querySelectorAll('.quiz-q')).find((q) => !q.querySelector('input:checked'));
      firstMissing?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstMissing?.classList.add('is-missing');
      setTimeout(() => firstMissing?.classList.remove('is-missing'), 1600);
      toast('Please answer every question first.');
      return;
    }
    const score = answers.reduce((a, b) => a + b, 0);
    let level, percent, band;
    if (score <= 10) { level = 'Low Stress'; percent = 20; band = 'low'; }
    else if (score <= 20) { level = 'Moderate Stress'; percent = 60; band = 'moderate'; }
    else { level = 'High Stress'; percent = 100; band = 'high'; }

    if (result) {
      result.innerHTML = `Your total score is <strong>${score}</strong>. Stress level: <strong>${level}</strong>`;
      result.dataset.band = band;
    }
    if (fill) {
      const r = Number(fill.getAttribute('r')) || 90;
      const c = 2 * Math.PI * r;
      fill.style.strokeDasharray = c;
      fill.style.strokeDashoffset = c - (percent / 100) * c;
      fill.dataset.band = band;
    }
    if (pct) pct.textContent = percent + '%';
    rows.forEach((row) => row.classList.toggle('is-active', row.dataset.stressBand === band));
    if (panel) { panel.hidden = false; panel.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  });
};

/* ─── Auth: mobile → OTP two-step UI ──────────────────────────────────────── */
const initAuthSteps = () => {
  const login = document.querySelector('[data-auth-login]');
  const otp = document.querySelector('[data-auth-otp]');
  if (!login || !otp) return;
  login.addEventListener('submit', (e) => {
    e.preventDefault();
    const mobile = login.querySelector('input[name="mobile"]');
    if (!mobile || !/^\+?\d{10,13}$/.test(mobile.value.replace(/\s/g, ''))) {
      mobile?.focus();
      login.querySelector('[data-error]').textContent = 'Please enter a valid contact number.';
      return;
    }
    login.querySelector('[data-error]').textContent = '';
    otp.querySelector('input[name="mobile"]').value = mobile.value;
    otp.querySelector('[data-otp-target]')?.replaceChildren(document.createTextNode(mobile.value));
    login.hidden = true;
    otp.hidden = false;
    otp.querySelector('input[name="otp"]')?.focus();
  });
  otp.querySelector('[data-auth-back]')?.addEventListener('click', () => {
    otp.hidden = true;
    login.hidden = false;
  });
};

/* ─── Contact/Career forms → friendly response ────────────────────────────── */
const initForms = () => {
  document.querySelectorAll('form[data-form]').forEach((form) => {
    form.addEventListener('submit', () => {
      const btn = form.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = 'Sending…'; }
    });
  });
};

/* ─── Simple category filter (shop) ───────────────────────────────────────── */
// <button class="filter-btn" data-filter="all|cat"> … <article data-category="cat">
const initFilters = () => {
  const bar = document.querySelector('[data-filter-bar]');
  if (!bar) return;
  const items = Array.from(document.querySelectorAll('[data-category]'));
  const count = document.querySelector('[data-filter-count]');
  bar.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    bar.querySelectorAll('[data-filter]').forEach((b) => b.classList.toggle('is-active', b === btn));
    const f = btn.dataset.filter;
    let shown = 0;
    items.forEach((it) => {
      const show = f === 'all' || it.dataset.category === f;
      it.classList.toggle('is-hidden', !show);
      if (show) shown++;
    });
    if (count) count.textContent = `${shown} product${shown === 1 ? '' : 's'}`;
  });
};

/* ─── Boot ────────────────────────────────────────────────────────────────── */
const boot = () => {
  initNav();
  initReveal();
  initLightbox();
  initCart();
  initStressTest();
  initAuthSteps();
  initForms();
  initFilters();
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

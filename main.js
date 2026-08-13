import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

// ─── Grid Trail Background ───────────────────────────────────────────────────
const gridContainer = document.getElementById('grid-trail-container');
if (gridContainer) {
  const createGrid = () => {
    gridContainer.innerHTML = '';
    const tileSize = Math.max(window.innerWidth / 25, 40); // Balanced size: small enough for aesthetics, large enough for performance
    const cols = Math.ceil(window.innerWidth / tileSize);
    const rows = Math.ceil(window.innerHeight / tileSize);
    gridContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    gridContainer.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

    for (let i = 0; i < cols * rows; i++) {
      const tile = document.createElement('div');
      tile.classList.add('grid-tile');
      const col = i % cols;
      const row = Math.floor(i / cols);
      // White and Yellow checkerboard pattern
      if ((col + row) % 2 === 0) {
        tile.style.backgroundColor = 'rgba(255, 255, 255, 0.5)'; // White tile
      } else {
        tile.style.backgroundColor = 'rgba(252, 215, 57, 0.34)'; // Brand yellow tile
      }
      gridContainer.appendChild(tile);
    }
  };
  createGrid();
  window.addEventListener('resize', () => {
    clearTimeout(gridContainer.resizeTimer);
    gridContainer.resizeTimer = setTimeout(createGrid, 200);
  });
}

// ─── Page UI: nav, reveals, count-up, chapter rail ───────────────────────────
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── Mobile navigation ──
const initNav = () => {
  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');
  if (!toggle || !links) return;

  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    links.classList.toggle('is-open', open);
  };

  toggle.addEventListener('click', () => {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });

  // Close after navigating, and on Escape
  links.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#navbar')) setOpen(false);
  });

  // Dropdown triggers are real buttons — make them work on tap too
  links.querySelectorAll('.dropdown-trigger').forEach((btn) => {
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
    });
  });
};

// ── Count-up, used by the Impact band ──
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

// ── One IntersectionObserver drives every reveal on the page ──
let revealStarted = false;
function initReveal() {
  if (revealStarted) return;
  revealStarted = true;

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
      io.unobserve(el);   // one-shot: keeps the main thread clear for the GL loop
    }
  }, { threshold: 0, rootMargin: '0px 0px -15% 0px' });

  targets.forEach((el) => io.observe(el));
  initChapterRail();
}

// ── Chapter rail: pawn promotes to king as you descend ──
const initChapterRail = () => {
  const rail = document.getElementById('chapter-rail');
  if (!rail || !('IntersectionObserver' in window)) return;

  const dots = Array.from(rail.querySelectorAll('.chapter-dot'));
  const sections = dots
    .map((dot) => document.getElementById(dot.dataset.chapter))
    .filter(Boolean);
  if (!sections.length) return;

  const railObserver = new IntersectionObserver((entries) => {
    // The rail only exists once the 3D sequence is done, so it never collides
    // with the King resting at screen-left.
    let anyVisible = false;
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      anyVisible = true;
      dots.forEach((d) => d.classList.toggle('is-current', d.dataset.chapter === entry.target.id));
    });
    if (anyVisible) rail.classList.add('is-active');
  }, { threshold: 0.25, rootMargin: '-40% 0px -40% 0px' });

  sections.forEach((s) => railObserver.observe(s));

  // Hide the rail again once we're back above the first chapter
  const first = sections[0];
  new IntersectionObserver(([entry]) => {
    if (entry.boundingClientRect.top > 0 && !entry.isIntersecting) {
      rail.classList.remove('is-active');
    }
  }, { threshold: 0 }).observe(first);
};

initNav();

// ─── Scene ───────────────────────────────────────────────────────────────────
const canvasBoard = document.querySelector('#webgl-board');
const canvasPieces = document.querySelector('#webgl-pieces');
const sceneBoard = new THREE.Scene();
const scenePieces = new THREE.Scene();

// ─── Camera ──────────────────────────────────────────────────────────────────
const sizes = { width: window.innerWidth, height: window.innerHeight };

const camera = new THREE.PerspectiveCamera(45, sizes.width / sizes.height, 0.1, 200);
camera.position.set(0, 6, 22);
camera.lookAt(0, 0, 0);
sceneBoard.add(camera);
scenePieces.add(camera);

// ─── Renderer ────────────────────────────────────────────────────────────────
const rendererBoard = new THREE.WebGLRenderer({ canvas: canvasBoard, alpha: true, antialias: true });
rendererBoard.setSize(sizes.width, sizes.height);
rendererBoard.setPixelRatio(Math.min(window.devicePixelRatio, 2));
rendererBoard.outputColorSpace = THREE.SRGBColorSpace;

const rendererPieces = new THREE.WebGLRenderer({ canvas: canvasPieces, alpha: true, antialias: true });
rendererPieces.setSize(sizes.width, sizes.height);
rendererPieces.setPixelRatio(Math.min(window.devicePixelRatio, 2));
rendererPieces.outputColorSpace = THREE.SRGBColorSpace;

// ─── Lighting ────────────────────────────────────────────────────────────────
const setupLighting = (s) => {
  s.add(new THREE.AmbientLight(0xffffff, 0.9));
  const keyLight = new THREE.DirectionalLight(0xfff5e0, 2.5);
  keyLight.position.set(5, 15, 10);
  s.add(keyLight);
  const rimLight = new THREE.PointLight(0xfcd739, 80);
  rimLight.position.set(-8, 8, -12);
  s.add(rimLight);
  const fillLight = new THREE.PointLight(0xffffff, 40);
  fillLight.position.set(0, -10, 5);
  s.add(fillLight);
};
setupLighting(sceneBoard);
setupLighting(scenePieces);

// ─── Helpers ─────────────────────────────────────────────────────────────────
const manager = new THREE.LoadingManager();
manager.onProgress = (url, itemsLoaded, itemsTotal) => {
  const progressBar = document.getElementById('loading-progress');
  if (progressBar) {
    progressBar.style.width = (itemsLoaded / itemsTotal * 100) + '%';
  }
};
const dismissLoader = () => {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen && !loadingScreen.classList.contains('hidden')) {
    loadingScreen.classList.add('hidden');
    setTimeout(() => { loadingScreen.style.display = 'none'; }, 800);
  }
};

manager.onLoad = () => {
  dismissLoader();
  // Reveals start only once the overlay is clearing — otherwise the first
  // screen's animations play out of sight behind it.
  setTimeout(initReveal, 400);
};

// The models are ~22MB of .obj. If one 404s, stalls, or WebGL is unavailable,
// manager.onLoad never fires — and the page would sit behind a full-screen
// overlay forever with every [data-reveal] element still hidden. Neither the
// loader nor the content may be hostage to that.
setTimeout(() => { dismissLoader(); initReveal(); }, 8000);

const textureLoader = new THREE.TextureLoader(manager);
const objLoader = new OBJLoader(manager);
const gltfLoader = new GLTFLoader(manager);

function loadOBJ(objUrl, texUrl, targetHeightUnits, startX, callback) {
  const tex = textureLoader.load(texUrl);
  tex.colorSpace = THREE.SRGBColorSpace;

  objLoader.load(objUrl, (obj) => {
    obj.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({
          map: tex, roughness: 0.4, metalness: 0.1,
        });
      }
    });
    obj.rotation.x = -Math.PI / 2; // Blender Z-up fix

    // Auto-scale to desired height
    obj.scale.set(1, 1, 1);
    const box = new THREE.Box3().setFromObject(obj);
    const modelH = box.getSize(new THREE.Vector3()).z;
    const s = targetHeightUnits / (modelH || 1);
    obj.scale.set(s, s, s);

    // Re-center on X/Z
    const center = box.getCenter(new THREE.Vector3());
    obj.position.x -= center.x * s;
    obj.position.z -= center.z * s;

    const pivot = new THREE.Group();
    pivot.add(obj);
    pivot.position.set(startX, -2, 0);
    pivot.visible = false;
    scenePieces.add(pivot);
    callback(pivot);
  }, undefined, (err) => console.error('OBJ error:', err));
}

// ─── Phase 1: Chess Board (GLB) ──────────────────────────────────────────────
let board = null;
let playablePieces = [];
let boardMeshes = []; // Cached array of meshes for performance
// Variables removed
// Grid of valid board squares — built from initial world positions of pieces
let validSquares = [];

gltfLoader.load('/ChessScene.glb', (gltf) => {
  const obj = gltf.scene;
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = 13 / (Math.max(size.x, size.y, size.z) || 1);
  obj.scale.setScalar(scale);
  obj.position.sub(center.multiplyScalar(scale));
  obj.traverse((child) => {
    if (child.isMesh) {
      child.geometry.computeBoundingBox();
      const childBox = child.geometry.boundingBox;
      const childSize = childBox.getSize(new THREE.Vector3());
      const maxDim = Math.max(childSize.x, childSize.y, childSize.z);
      if (maxDim < size.x * 0.5) {
        playablePieces.push(child);
      }
      
      // Cache mesh for performance in render loop
      if (child.material) {
        boardMeshes.push(child);
        if (child.material.emissive) {
          child.userData.origEmissive = child.material.emissive.clone();
        } else {
          child.userData.origEmissive = new THREE.Color(0x000000);
        }
      }
    }
  });

  // Unify coordinate system: attach all pieces directly to obj
  // This solves ALL coordinate nesting bugs and makes local math perfect.
  playablePieces.forEach(p => obj.attach(p));

  // Build mathematical 8x8 grid
  if (playablePieces.length > 0) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of playablePieces) {
      if (p.position.x < minX) minX = p.position.x;
      if (p.position.x > maxX) maxX = p.position.x;
      if (p.position.z < minZ) minZ = p.position.z;
      if (p.position.z > maxZ) maxZ = p.position.z;
    }
    const stepX = (maxX - minX) / 7;
    const stepZ = (maxZ - minZ) / 7;

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        validSquares.push({
          x: minX + col * stepX,
          z: minZ + row * stepZ,
          occupant: null
        });
      }
    }

    // Snap pieces to grid
    for (const p of playablePieces) {
      let col = Math.round((p.position.x - minX) / stepX);
      let row = Math.round((p.position.z - minZ) / stepZ);
      // Clamp just in case math floats slightly off
      col = Math.max(0, Math.min(7, col));
      row = Math.max(0, Math.min(7, row));
      const idx = row * 8 + col;

      // Snap exact position
      p.position.x = validSquares[idx].x;
      p.position.z = validSquares[idx].z;
      p.userData.initialPos = p.position.clone();
      p.userData.initialRot = p.rotation.clone();

      // Spread them much wider for a bigger explosion effect
      const radius = 30 + Math.random() * 60;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI;

      p.userData.scatterPos = new THREE.Vector3(
        p.position.x + radius * Math.cos(phi) * Math.cos(theta),
        p.position.y + (Math.random() - 0.2) * 50, // More vertical spread
        p.position.z + radius * Math.cos(phi) * Math.sin(theta)
      );

      p.userData.scatterRot = new THREE.Euler(
        Math.random() * Math.PI * 4,
        Math.random() * Math.PI * 4,
        Math.random() * Math.PI * 4
      );

      p.userData.squareIdx = idx;

      validSquares[idx].occupant = p;
    }
  }

  // Add Reset Button — styling lives in .board-reset, not inline
  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'board-reset';
  resetBtn.textContent = 'Reset Board View';

  const heroWrapper = document.querySelector('.hero-content-wrapper');
  if (heroWrapper) {
    heroWrapper.appendChild(resetBtn);
  } else {
    document.body.appendChild(resetBtn);
  }

  resetBtn.addEventListener('click', () => {
    manualRotY = 0;
    manualRotX = 0;
    // Reset all pieces to their starting positions
    for (const sq of validSquares) sq.occupant = null;
    for (const piece of playablePieces) {
      piece.position.copy(piece.userData.initialPos);
      piece.rotation.copy(piece.userData.initialRot);
      validSquares[piece.userData.squareIdx].occupant = piece;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Also scroll to top since scroll drives animation
  });

  // Adjust board baseline vertically
  obj.position.y -= 1.0;
  board = obj;
  sceneBoard.add(obj);
}, undefined, (err) => console.error('Board GLB error:', err));

// ─── Scripted sequence removed for scatter animation ──────────────────────

// ─── Phase 2: King (OBJ) — enters from LEFT, rests LEFT ──────────────────────
let king = null;
loadOBJ(
  '/12926_Wooden_Chess_King_Side_A_v1_l3.obj',
  '/12926_WoodenChessKingSideA_Diffuse.jpg',
  3.2,   // height in Three.js units (increased size)
  -35,   // start off-screen left
  (pivot) => { king = pivot; }
);

// ─── Phase 3: Queen (OBJ) — enters from RIGHT, rests RIGHT ───────────────────
let queen = null;
loadOBJ(
  '/12927_Wooden_Chess_Queen_side_A_v1_l3.obj',
  '/12927_WoodenChessQueenSideA_diffuse.jpg',
  3.2,   // height in Three.js units (increased size)
  35,    // start off-screen right
  (pivot) => { queen = pivot; }
);

// ─── Testimonials Carousel ────────────────────────────────────────────────────
// Autoplaying card deck: the active testimonial sits in front, its two
// neighbours peek out behind it and can be clicked to come forward. Swipe/drag,
// arrow keys, avatar thumbnails and a progress line. Pauses on hover, focus,
// tab-hide and when scrolled off-screen.
const initTestimonialCarousel = () => {
  const root = document.querySelector('.testimonial-carousel');
  if (!root) return;

  const track    = root.querySelector('.tc-track');
  const slides   = Array.from(root.querySelectorAll('.tc-slide'));
  const thumbs   = Array.from(root.querySelectorAll('.tc-thumb'));
  const bar      = root.querySelector('.tc-progress span');
  const viewport = root.querySelector('.tc-viewport');
  if (!track || slides.length === 0) return;

  const reduced  = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = Number(root.dataset.autoplay) || 7000;
  root.style.setProperty('--tc-duration', `${duration}ms`);

  let index = 0;
  let elapsed = 0;
  let lastTime = 0;
  let hovered = false;
  let focused = false;
  let onScreen = true;
  let dragDelta = 0;

  const isPaused = () => hovered || focused || !onScreen || document.hidden || reduced;

  // The deck itself never travels — only the drag nudges it sideways.
  const render = (offsetPx = 0) => {
    track.style.transform = offsetPx ? `translateX(${offsetPx}px)` : '';
  };

  const goTo = (next) => {
    const total = slides.length;
    index = (next + total) % total;
    render();
    slides.forEach((slide, i) => {
      // 0 = front card, 1 = the one peeking out on the right, total-1 = on the left
      const rel = (i - index + total) % total;
      slide.classList.toggle('is-active', rel === 0);
      slide.classList.toggle('is-next', rel === 1 && total > 1);
      slide.classList.toggle('is-prev', rel === total - 1 && total > 2);
      slide.setAttribute('aria-hidden', rel === 0 ? 'false' : 'true');
    });
    thumbs.forEach((thumb, i) => {
      thumb.classList.toggle('is-active', i === index);
      thumb.setAttribute('aria-selected', i === index ? 'true' : 'false');
      thumb.tabIndex = i === index ? 0 : -1;
    });
    // Restart the progress line from zero (reflow forces the animation to replay)
    if (bar) {
      bar.classList.remove('is-running');
      void bar.offsetWidth;
      bar.classList.add('is-running');
    }
    elapsed = 0;
  };

  // ── Controls ──
  const prev = root.querySelector('.tc-prev');
  const next = root.querySelector('.tc-next');
  if (prev) prev.addEventListener('click', () => goTo(index - 1));
  if (next) next.addEventListener('click', () => goTo(index + 1));
  thumbs.forEach((thumb, i) => thumb.addEventListener('click', () => goTo(i)));

  // Clicking a card peeking out from behind brings it to the front
  slides.forEach((slide, i) => slide.addEventListener('click', () => {
    if (i === index || Math.abs(dragDelta) > 6) return;
    goTo(i);
  }));

  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft')  { e.preventDefault(); goTo(index - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(index + 1); }
  });

  // ── Pause conditions ──
  const setPausedClass = () => root.classList.toggle('tc-carousel-paused', isPaused());
  root.addEventListener('mouseenter', () => { hovered = true;  setPausedClass(); });
  root.addEventListener('mouseleave', () => { hovered = false; setPausedClass(); });
  root.addEventListener('focusin',    () => { focused = true;  setPausedClass(); });
  root.addEventListener('focusout', (e) => {
    // Ignore focus moving between the carousel's own controls
    if (root.contains(e.relatedTarget)) return;
    focused = false;
    setPausedClass();
  });
  document.addEventListener('visibilitychange', setPausedClass);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      onScreen = entries[0].isIntersecting;
      setPausedClass();
    }, { threshold: 0.25 }).observe(root);
  }

  // ── Drag / swipe ──
  if (viewport) {
    let startX = 0;
    let dragging = false;

    viewport.addEventListener('pointerdown', (e) => {
      dragging = true;
      startX = e.clientX;
      dragDelta = 0;
      track.classList.add('no-anim');
      viewport.classList.add('is-dragging');
      viewport.setPointerCapture(e.pointerId);
    });

    viewport.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      dragDelta = e.clientX - startX;
      render(dragDelta * 0.5);   // the whole deck follows the finger, softened
    });

    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      track.classList.remove('no-anim');
      viewport.classList.remove('is-dragging');
      const threshold = Math.min(120, viewport.clientWidth * 0.15);
      if (dragDelta > threshold) goTo(index - 1);
      else if (dragDelta < -threshold) goTo(index + 1);
      else render();
    };
    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);
    viewport.addEventListener('pointerleave', endDrag);
  }

  window.addEventListener('resize', () => render());

  // ── Autoplay (rAF so it stays in sync with the paused progress line) ──
  const step = (time) => {
    const dt = lastTime ? time - lastTime : 0;
    lastTime = time;
    if (!isPaused()) {
      elapsed += dt;
      if (elapsed >= duration) goTo(index + 1);
    }
    window.requestAnimationFrame(step);
  };

  goTo(0);
  if (!reduced) window.requestAnimationFrame(step);
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTestimonialCarousel);
} else {
  initTestimonialCarousel();
}

// ─── Phase measurement ────────────────────────────────────────────────────────
// The King/Queen choreography used to be pinned to hardcoded multiples of
// window.innerHeight. That desynced as soon as a section's real height differed
// from the assumption — on a 1366x768 laptop the Strategy card overflows 100vh,
// which pushed the Queen's card past her exit trigger entirely. Measuring the
// sections instead makes the animation independent of layout.
const phases = {
  boardEnd: 0,   // scroll distance over which the board scatters
  kingIn: 0, kingHold: 0, kingOut: 0,
  queenIn: 0, queenHold: 0, queenOut: 0,
  boardHide: 0,
};

const measurePhases = () => {
  const vh = window.innerHeight;
  const docTop = (el) => (el ? el.getBoundingClientRect().top + window.scrollY : 0);

  const spacer   = document.querySelector('.section-board-animation');
  const strategy = document.getElementById('strategy');
  const queen    = document.getElementById('queen');

  // Board scatters across the dedicated spacer section.
  const spacerTop = docTop(spacer);
  const spacerH = spacer ? spacer.offsetHeight : vh * 1.5;
  phases.boardEnd = Math.max(spacerTop + spacerH - vh * 0.5, vh);

  // Each piece slides in as its card approaches the middle of the viewport and
  // leaves as the card exits, using the card's own measured position.
  const sTop = docTop(strategy);
  const sH   = strategy ? strategy.offsetHeight : vh;
  phases.kingIn   = sTop - vh * 0.9;
  phases.kingHold = sTop - vh * 0.15;
  phases.kingOut  = sTop + sH - vh * 0.5;

  const qTop = docTop(queen);
  const qH   = queen ? queen.offsetHeight : vh;
  phases.queenIn   = qTop - vh * 0.9;
  phases.queenHold = qTop - vh * 0.15;
  phases.queenOut  = qTop + qH - vh * 0.5;

  phases.boardHide = phases.kingHold;
};

// 0 → 1 ramp between two scroll positions
const ramp = (y, from, to) => {
  if (to <= from) return y >= to ? 1 : 0;
  return Math.max(0, Math.min((y - from) / (to - from), 1));
};

// ─── Scroll (rAF-throttled: the raw handler ran layout reads every event) ─────
let scrollProgress = 0;
let scrollY = 0;
let scrollQueued = false;

const onScroll = () => {
  scrollY = window.scrollY;
  scrollProgress = phases.boardEnd ? Math.min(scrollY / phases.boardEnd, 1) : 0;

  // Navbar pill → full-width bar
  const navbar = document.getElementById('navbar');
  if (navbar) navbar.classList.toggle('expanded', scrollY > 50);

  // Fade out the gold grid floor once the hero is behind us
  const gridElement = document.querySelector('#grid-trail-container');
  if (gridElement) {
    const vh = window.innerHeight;
    if (scrollY > vh * 0.5) {
      const overflow = scrollY - vh * 0.5;
      gridElement.style.opacity = Math.max(0, 1 - overflow / (vh * 0.3));
    } else {
      gridElement.style.opacity = 1;
    }
  }

  // Floating stats around the board
  document.querySelectorAll('.floating-stat').forEach((stat, idx) => {
    stat.classList.toggle('visible', scrollProgress > 0.4 + idx * 0.15);
  });

  scrollQueued = false;
};

window.addEventListener('scroll', () => {
  if (scrollQueued) return;
  scrollQueued = true;
  window.requestAnimationFrame(onScroll);
}, { passive: true });

// ─── Resize ───────────────────────────────────────────────────────────────────
let resizeTimer;
window.addEventListener('resize', () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();
  rendererBoard.setSize(sizes.width, sizes.height);
  rendererPieces.setSize(sizes.width, sizes.height);

  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { measurePhases(); onScroll(); }, 150);
});

measurePhases();
onScroll();
window.addEventListener('load', () => { measurePhases(); onScroll(); });

// ─── Raycaster & Interaction ──────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(-100, -100);

let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let manualRotY = 0;
let manualRotX = 0;

// Drag rotates the board, but only from empty space in the hero. Previously any
// mousedown anywhere — a nav link, a button, a form field — started a rotation.
// The canvas stays pointer-events:none so it never swallows clicks; instead we
// ignore mousedowns that landed on real UI.
const NON_DRAG_TARGET = 'a, button, input, select, textarea, label, .glass-panel, .glass-card, .navbar, .social-sidebar, .chapter-rail';
window.addEventListener('mousedown', (event) => {
  if (event.target.closest && event.target.closest(NON_DRAG_TARGET)) return;
  isDragging = true;
});
window.addEventListener('mouseup', () => { isDragging = false; });
window.addEventListener('mousemove', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Only allow dragging if we are in the hero section
  if (isDragging && window.scrollY < window.innerHeight) {
    const deltaMove = {
      x: event.clientX - previousMousePosition.x,
      y: event.clientY - previousMousePosition.y
    };
    manualRotY += deltaMove.x * 0.01;
    manualRotX += deltaMove.y * 0.01;
  }
  previousMousePosition = { x: event.clientX, y: event.clientY };
});

// ─── Animation State ──────────────────────────────────────────────────────────
// Scroll phases (page is 600vh):
//   Phase 1 (board): scroll  0 → 0.35
//   Phase 2 (king):  scroll  0.3 → 0.65
//   Phase 3 (queen): scroll  0.6 → 1.0

let currentRotY = 0;
let currentBoardX = 8;
let currentCamZ = 22;
let currentCamY = 6;
let currentKingX = -35;
let currentQueenX = 35;

const KING_REST_X = -11; // Pushed further left to balance wider cards
const QUEEN_REST_X = 9; // Pushed further right to balance wider cards

// ─── Tick ─────────────────────────────────────────────────────────────────────
const clock = new THREE.Clock();
let lastElapsed = 0;
let autoSpinY = 0;

const tick = () => {
  const elapsed = clock.getElapsedTime();
  const delta = elapsed - lastElapsed;
  lastElapsed = elapsed;

  // ── Phase 1: Board ────────────────────────────────────────────────────────
  if (board) {
    autoSpinY += delta * 0.15; // Slow circular motion

    const targetRotY = manualRotY + autoSpinY + (scrollProgress * Math.PI * 0.5); // Spin slightly
    const targetBoardX = 0; // Keep centered
    // Start camera further away (smaller scene) and move in closer (larger) as we scroll
    const targetCamZ = 35 - (scrollProgress * 13); // 35 down to 22
    const targetCamY = 6;

    currentRotY += (targetRotY - currentRotY) * 0.06;
    currentBoardX += (targetBoardX - currentBoardX) * 0.06;
    currentCamZ += (targetCamZ - currentCamZ) * 0.06;
    currentCamY += (targetCamY - currentCamY) * 0.06;

    board.rotation.y = currentRotY;

    // Update Board transforms
    // Smoothly apply scroll rotation
    let targetBoardRotX = Math.PI / 12 + scrollProgress * (Math.PI / 8);
    // Combine scroll rotation with manual drag rotation
    const totalRotX = targetBoardRotX + manualRotX;
    
    board.rotation.x += (totalRotX - board.rotation.x) * 0.06;
    board.position.x = currentBoardX;
    
    // Sink the board out of view as we reach the spacer's end
    let targetBoardY = Math.sin(elapsed * 1.2) * 0.12;
    if (scrollY > phases.boardEnd * 0.8) {
       targetBoardY -= ((scrollY - phases.boardEnd * 0.8) / window.innerHeight) * 60;
    }
    board.position.y += (targetBoardY - board.position.y) * 0.1;

    // Hover effect for individual parts
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(board, true);

    let hoveredMesh = null;
    if (intersects.length > 0) {
      hoveredMesh = intersects[0].object;
      canvasBoard.style.cursor = isDragging ? 'grabbing' : 'grab';
    } else {
      canvasBoard.style.cursor = 'default';
    }

    // Scatter logic based on scrollProgress
    const scatterEased = Math.pow(scrollProgress, 0.8);

    // Use cached array instead of traversing tree for performance
    for (const child of boardMeshes) {
      if (child.material && child.material.emissive) {
        child.material.emissive.lerp(child.userData.origEmissive, 0.1);
      }
    }

    for (const p of playablePieces) {
      if (!p.userData.initialPos) continue;
      
      // Interpolate position
      p.position.lerpVectors(p.userData.initialPos, p.userData.scatterPos, scatterEased);
      
      // Interpolate rotation
      const qStart = new THREE.Quaternion().setFromEuler(p.userData.initialRot);
      const qEnd = new THREE.Quaternion().setFromEuler(p.userData.scatterRot);
      qStart.slerp(qEnd, scatterEased);
      p.setRotationFromQuaternion(qStart);
    }

    if (hoveredMesh && hoveredMesh.material && hoveredMesh.material.emissive) {
      hoveredMesh.material.emissive.setHex(0x444444);
    }

    camera.position.z = currentCamZ;
    camera.position.y = currentCamY;
    camera.lookAt(0, 0, 0);

    // Hide board once the King has taken over so it doesn't overflow
    board.visible = scrollY < phases.boardHide;
  }

  // ── Phase 2: King — measured against the Strategy card's real position ────
  const p2Enter = ramp(scrollY, phases.kingIn, phases.kingHold);
  const p2Exit  = ramp(scrollY, phases.kingOut, phases.kingOut + window.innerHeight * 0.6);

  if (king) {
    king.visible = true;
    // Base target position with mouse parallax offset
    const targetKingX = -35 + (p2Enter - p2Exit) * (35 + KING_REST_X) + (mouse.x * 1.5);
    currentKingX += (targetKingX - currentKingX) * 0.06;
    king.position.x = currentKingX;
    king.position.y = (Math.sin(elapsed * 1.5) * 0.08 - 2) + (mouse.y * 0.5);

    // Interactive rotation (look at mouse)
    king.rotation.y += (mouse.x * 1.2 - king.rotation.y) * 0.1;
    king.rotation.x += (-mouse.y * 0.5 - king.rotation.x) * 0.1;

    // Camera reset toward neutral as pieces enter
    if (p2Enter > 0) {
      currentCamZ += (22 - currentCamZ) * 0.03;
      currentCamY += (6 - currentCamY) * 0.03;
      camera.position.z = currentCamZ;
      camera.position.y = currentCamY;
      camera.lookAt(0, 0, 0);
    }
  }

  // ── Phase 3: Queen — measured against the Queen card's real position ─────
  const p3Enter = ramp(scrollY, phases.queenIn, phases.queenHold);
  const p3Exit  = ramp(scrollY, phases.queenOut, phases.queenOut + window.innerHeight * 0.6);

  if (queen) {
    queen.visible = true;
    // Base target position with mouse parallax offset
    const targetQueenX = 35 - (p3Enter - p3Exit) * (35 - QUEEN_REST_X) + (mouse.x * 1.5);
    currentQueenX += (targetQueenX - currentQueenX) * 0.06;
    queen.position.x = currentQueenX;
    queen.position.y = (Math.sin(elapsed * 1.5 + Math.PI) * 0.08 - 2) + (mouse.y * 0.5);

    // Interactive rotation (look at mouse)
    queen.rotation.y += (mouse.x * 1.2 - queen.rotation.y) * 0.1;
    queen.rotation.x += (-mouse.y * 0.5 - queen.rotation.x) * 0.1;
  }

  rendererBoard.render(sceneBoard, camera);
  rendererPieces.render(scenePieces, camera);
  window.requestAnimationFrame(tick);
};

tick();

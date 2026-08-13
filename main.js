import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

// ─── Grid Trail Background ───────────────────────────────────────────────────
const gridContainer = document.getElementById('grid-trail-container');
if (gridContainer) {
  const createGrid = () => {
    gridContainer.innerHTML = '';
    const tileSize = Math.max(window.innerWidth / 50, 15); // approx 36 columns, min 45px
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
        tile.style.backgroundColor = 'rgba(212, 175, 55, 0.4)'; // Yellow/Gold tile
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

// ─── Scene ───────────────────────────────────────────────────────────────────
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
const textureLoader = new THREE.TextureLoader();
const objLoader = new OBJLoader();
const gltfLoader = new GLTFLoader();

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

  // Add Reset Button
  const resetBtn = document.createElement('button');
  resetBtn.innerText = "Reset Board View";
  resetBtn.style.position = 'absolute';
  resetBtn.style.bottom = '40px'; // Sit just above the curve
  resetBtn.style.left = '50%';
  resetBtn.style.transform = 'translateX(-50%)';
  resetBtn.style.zIndex = '10'; // Above the grid
  resetBtn.style.padding = '12px 24px';
  resetBtn.style.backgroundColor = 'var(--gold, #fcd739)'; // Match the new theme
  resetBtn.style.color = '#111';
  resetBtn.style.border = 'none';
  resetBtn.style.borderRadius = '30px';
  resetBtn.style.cursor = 'pointer';
  resetBtn.style.pointerEvents = 'auto'; // Ensure it can be clicked despite parent pointer-events: none
  resetBtn.style.fontWeight = '700';
  resetBtn.style.boxShadow = '0 4px 14px rgba(212, 175, 55, 0.3)';

  // Hover effect for the button
  resetBtn.addEventListener('mouseenter', () => {
    resetBtn.style.transform = 'translateX(-50%) translateY(-2px)';
    resetBtn.style.boxShadow = '0 6px 18px rgba(212, 175, 55, 0.5)';
  });
  resetBtn.addEventListener('mouseleave', () => {
    resetBtn.style.transform = 'translateX(-50%)';
    resetBtn.style.boxShadow = '0 4px 14px rgba(212, 175, 55, 0.3)';
  });

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

// ─── Scroll ───────────────────────────────────────────────────────────────────
let scrollProgress = 0;
window.addEventListener('scroll', () => {
  // Calculate hero scroll progress (0 to 1) for board animation over 150vh
  scrollProgress = Math.min(window.scrollY / (window.innerHeight * 1.5), 1);

  // Navbar Pill logic
  const navbar = document.getElementById('navbar');
  if (navbar) {
    if (window.scrollY > 50) {
      navbar.classList.add('expanded');
    } else {
      navbar.classList.remove('expanded');
    }
  }

  // Fade out the grid background when scrolling past hero
  const gridElement = document.querySelector('#grid-trail-container');
  if (window.scrollY > window.innerHeight * 0.5) {
    const overflow = window.scrollY - (window.innerHeight * 0.5);
    const fadeOut = Math.max(0, 1 - (overflow / (window.innerHeight * 0.3)));
    if (gridElement) gridElement.style.opacity = fadeOut;
  } else {
    if (gridElement) gridElement.style.opacity = 1;
  }
});

// ─── Resize ───────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();
  rendererBoard.setSize(sizes.width, sizes.height);
  rendererPieces.setSize(sizes.width, sizes.height);
});

// ─── Raycaster & Interaction ──────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(-100, -100);

let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let manualRotY = 0;
let manualRotX = 0;

window.addEventListener('mousedown', () => { isDragging = true; });
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
    if (window.scrollY > window.innerHeight * 1.2) {
       targetBoardY -= ((window.scrollY - window.innerHeight * 1.2) / window.innerHeight) * 60;
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

    board.traverse((child) => {
      if (child.isMesh && child.material) {
        if (!child.userData.origEmissive) {
          child.userData.origEmissive = child.material.emissive ? child.material.emissive.clone() : new THREE.Color(0x000000);
        }
        if (child.material.emissive) {
          child.material.emissive.lerp(child.userData.origEmissive, 0.1);
        }
      }
    });

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

    // Hide board when scrolling past the spacer so it doesn't overflow!
    if (window.scrollY > window.innerHeight * 2.5) {
      board.visible = false;
    } else {
      board.visible = true;
    }
  }

  // ── Phase 2: King ─────────────────────────────────────────────────────────
  // Enters as user scrolls past spacer into the Strategy section (1.3 to 1.9 of innerHeight)
  const p2Enter = Math.max(Math.min((window.scrollY - window.innerHeight * 1.3) / (window.innerHeight * 0.6), 1), 0);
  // Exits as user scrolls past the Strategy section (2.4 to 3.0 of innerHeight)
  const p2Exit = Math.max(Math.min((window.scrollY - window.innerHeight * 2.4) / (window.innerHeight * 0.6), 1), 0);

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

  // ── Phase 3: Queen ────────────────────────────────────────────────────────
  // Enters as user scrolls into the Command section (2.4 to 3.0 of innerHeight)
  const p3Enter = Math.max(Math.min((window.scrollY - window.innerHeight * 2.4) / (window.innerHeight * 0.6), 1), 0);
  // Exits as user scrolls past the Command section (3.4 to 4.0 of innerHeight)
  const p3Exit = Math.max(Math.min((window.scrollY - window.innerHeight * 3.4) / (window.innerHeight * 0.6), 1), 0);

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

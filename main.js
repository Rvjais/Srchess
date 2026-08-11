import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader }  from 'three/examples/jsm/loaders/OBJLoader.js';

// ─── Grid Trail Background ───────────────────────────────────────────────────
const gridContainer = document.getElementById('grid-trail-container');
if (gridContainer) {
  const createGrid = () => {
    gridContainer.innerHTML = '';
    const tileSize = Math.max(window.innerWidth / 24, 60); // approx 24 columns, min 60px
    const cols = Math.ceil(window.innerWidth / tileSize);
    const rows = Math.ceil(window.innerHeight / tileSize);
    gridContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    gridContainer.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    
    for (let i = 0; i < cols * rows; i++) {
      const tile = document.createElement('div');
      tile.classList.add('grid-tile');
      const col = i % cols;
      const row = Math.floor(i / cols);
      // Subtle checkerboard pattern
      if ((col + row) % 2 === 0) {
        tile.style.backgroundColor = 'rgba(255,255,255,0.015)';
      } else {
        tile.style.backgroundColor = 'rgba(0,0,0,0.1)';
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
const canvas = document.querySelector('#webgl');
const scene  = new THREE.Scene();

// ─── Camera ──────────────────────────────────────────────────────────────────
const sizes = { width: window.innerWidth, height: window.innerHeight };

const camera = new THREE.PerspectiveCamera(45, sizes.width / sizes.height, 0.1, 200);
camera.position.set(0, 6, 22);
camera.lookAt(0, 0, 0);
scene.add(camera);

// ─── Renderer ────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

// ─── Lighting ────────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 0.9));

const keyLight = new THREE.DirectionalLight(0xfff5e0, 2.5);
keyLight.position.set(5, 15, 10);
scene.add(keyLight);

const rimLight = new THREE.PointLight(0x7c3aed, 80);
rimLight.position.set(-8, 8, -12);
scene.add(rimLight);

const fillLight = new THREE.PointLight(0xffffff, 40);
fillLight.position.set(0, -10, 5);
scene.add(fillLight);

// ─── Helpers ─────────────────────────────────────────────────────────────────
const textureLoader = new THREE.TextureLoader();
const objLoader     = new OBJLoader();
const gltfLoader    = new GLTFLoader();

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
    const box    = new THREE.Box3().setFromObject(obj);
    const modelH = box.getSize(new THREE.Vector3()).z;
    const s      = targetHeightUnits / (modelH || 1);
    obj.scale.set(s, s, s);

    // Re-center on X/Z
    const center = box.getCenter(new THREE.Vector3());
    obj.position.x -= center.x * s;
    obj.position.z -= center.z * s;

    const pivot = new THREE.Group();
    pivot.add(obj);
    pivot.position.set(startX, -2, 0);
    pivot.visible = false;
    scene.add(pivot);
    callback(pivot);
  }, undefined, (err) => console.error('OBJ error:', err));
}

// ─── Phase 1: Chess Board (GLB) ──────────────────────────────────────────────
let board = null;
let playablePieces = [];
let movingPiece = null;
let moveTimer = 2.0;
// Grid of valid board squares — built from initial world positions of pieces
let validSquares = [];

gltfLoader.load('/ChessScene.glb', (gltf) => {
  const obj    = gltf.scene;
  const box    = new THREE.Box3().setFromObject(obj);
  const size   = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale  = 13 / (Math.max(size.x, size.y, size.z) || 1);
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
      p.userData.squareIdx = idx;
      
      validSquares[idx].occupant = p;
    }
  }

  // Add Reset Button
  const resetBtn = document.createElement('button');
  resetBtn.innerText = "Reset Board View";
  resetBtn.style.position = 'fixed';
  resetBtn.style.bottom = '30px';
  resetBtn.style.left = '50%';
  resetBtn.style.transform = 'translateX(-50%)';
  resetBtn.style.zIndex = '1000';
  resetBtn.style.padding = '12px 24px';
  resetBtn.style.backgroundColor = '#4D6787';
  resetBtn.style.color = '#fff';
  resetBtn.style.border = 'none';
  resetBtn.style.borderRadius = '30px';
  resetBtn.style.cursor = 'pointer';
  resetBtn.style.fontWeight = 'bold';
  resetBtn.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
  document.body.appendChild(resetBtn);

  resetBtn.addEventListener('click', () => {
    manualRotY = 0;
    manualRotX = 0;
    // Reset all pieces to their starting positions
    for (const sq of validSquares) sq.occupant = null;
    for (const piece of playablePieces) {
      piece.position.copy(piece.userData.initialPos);
      validSquares[piece.userData.squareIdx].occupant = piece;
    }
    movingPiece = null;
    currentMoveIndex = 0;
    moveTimer = 1.0;
  });

  board = new THREE.Group();
  board.add(obj);
  scene.add(board);
}, undefined, (err) => console.error('Board GLB error:', err));

// ─── Scripted Italian Game Sequence ──────────────────────────────────────────
// Coordinates are [X (rank), Z (file)] because the 3D model is rotated.
// White is X=0..1, Black is X=6..7
const chessSequence = [
  { from: [1, 3], to: [3, 3] }, // e4 (White Pawn)
  { from: [6, 3], to: [4, 3] }, // e5 (Black Pawn)
  { from: [0, 1], to: [2, 2] }, // Nf3 (White Knight)
  { from: [7, 6], to: [5, 5] }, // Nc6 (Black Knight)
  { from: [0, 2], to: [3, 5] }, // Bc4 (White Bishop)
  { from: [7, 2], to: [4, 5] }  // Bc5 (Black Bishop)
];
let currentMoveIndex = 0;

// ─── Phase 2: King (OBJ) — enters from LEFT, rests LEFT ──────────────────────
let king = null;
loadOBJ(
  '/12926_Wooden_Chess_King_Side_A_v1_l3.obj',
  '/12926_WoodenChessKingSideA_Diffuse.jpg',
  2.0,   // height in Three.js units
  -35,   // start off-screen left
  (pivot) => { king = pivot; }
);

// ─── Phase 3: Queen (OBJ) — enters from RIGHT, rests RIGHT ───────────────────
let queen = null;
loadOBJ(
  '/12927_Wooden_Chess_Queen_side_A_v1_l3.obj',
  '/12927_WoodenChessQueenSideA_diffuse.jpg',
  2.0,   // height in Three.js units
  35,    // start off-screen right
  (pivot) => { queen = pivot; }
);

// ─── Scroll ───────────────────────────────────────────────────────────────────
let scrollProgress = 0;
window.addEventListener('scroll', () => {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  scrollProgress  = Math.min(window.scrollY / maxScroll, 1);
});

// ─── Resize ───────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  sizes.width  = window.innerWidth;
  sizes.height = window.innerHeight;
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

  if (isDragging && scrollProgress < 0.15) {
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

let currentRotY   = 0;
let currentBoardX = 8;
let currentCamZ   = 22;
let currentCamY   = 6;
let currentKingX  = -35;
let currentQueenX = 35;

const KING_REST_X  = -6; // Pulled back slightly from center
const QUEEN_REST_X =  6;

// ─── Tick ─────────────────────────────────────────────────────────────────────
const clock = new THREE.Clock();
let lastElapsed = 0;
let autoSpinY = 0;

const tick = () => {
  const elapsed = clock.getElapsedTime();
  const delta = elapsed - lastElapsed;
  lastElapsed = elapsed;

  // ── Phase 1: Board ────────────────────────────────────────────────────────
  const p1 = Math.min(scrollProgress / 0.3, 1);

  if (board) {
    if (scrollProgress < 0.15) {
      autoSpinY += delta * 0.15; // Slow circular motion
    }
    
    const targetRotY   = p1 * Math.PI * 2 + manualRotY + autoSpinY;
    const targetBoardX = 8 - p1 * 53;
    const targetCamZ   = 22 - p1 * 16;
    const targetCamY   =  6 - p1 *  3;

    currentRotY   += (targetRotY   - currentRotY)   * 0.06;
    currentBoardX += (targetBoardX - currentBoardX) * 0.06;
    currentCamZ   += (targetCamZ   - currentCamZ)   * 0.06;
    currentCamY   += (targetCamY   - currentCamY)   * 0.06;

    board.rotation.y = currentRotY;
    board.rotation.x += (manualRotX - board.rotation.x) * 0.06;
    board.position.x = currentBoardX;
    board.position.y = Math.sin(elapsed * 1.2) * 0.12;

    // Hover effect for individual parts
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(board, true);
    
    let hoveredMesh = null;
    if (intersects.length > 0 && scrollProgress < 0.15) {
      hoveredMesh = intersects[0].object;
      canvas.style.cursor = isDragging ? 'grabbing' : 'grab';
    } else {
      canvas.style.cursor = 'default';
    }
    
    board.traverse((child) => {
      if (child.isMesh && child.material) {
        if (!child.userData.origEmissive) {
          child.userData.origEmissive = child.material.emissive ? child.material.emissive.clone() : new THREE.Color(0x000000);
          child.userData.origPosY = child.position.y;
        }
        
        // Reset all EXCEPT moving piece
        if (child !== movingPiece) {
          child.position.y += (child.userData.origPosY - child.position.y) * 0.1;
        }
        
        if (child.material.emissive) {
          child.material.emissive.lerp(child.userData.origEmissive, 0.1);
        }
      }
    });

    if (hoveredMesh && hoveredMesh.material && hoveredMesh.material.emissive) {
      // Float the specific piece up slightly and make it glow
      if (hoveredMesh !== movingPiece) {
        hoveredMesh.position.y += ((hoveredMesh.userData.origPosY + 0.3) - hoveredMesh.position.y) * 0.2;
      }
      hoveredMesh.material.emissive.setHex(0x444444);
    }
    
    // ── Automated Playing (Scripted Match) ─────────────────────────────────
    if (validSquares.length > 0) {
      if (!movingPiece) {
        moveTimer -= delta;
        if (moveTimer <= 0) {
          if (currentMoveIndex >= chessSequence.length) {
            // Match over! Reset pieces
            for (const sq of validSquares) sq.occupant = null;
            for (const piece of playablePieces) {
              piece.position.copy(piece.userData.initialPos);
              validSquares[piece.userData.squareIdx].occupant = piece;
            }
            currentMoveIndex = 0;
            moveTimer = 2.0; // Wait before starting next game
          } else {
            // Play next move in script
            const move = chessSequence[currentMoveIndex];
            // Depending on camera angle, pieces might be mirrored, but it's consistent.
            const fromIdx = move.from[1] * 8 + move.from[0];
            const toIdx   = move.to[1]   * 8 + move.to[0];
            
            const piece = validSquares[fromIdx].occupant;
            if (piece) {
              movingPiece = piece;
              movingPiece.userData.origPos = piece.position.clone();
              movingPiece.userData.targetPos = new THREE.Vector3(validSquares[toIdx].x, piece.position.y, validSquares[toIdx].z);
              movingPiece.userData.moveProgress = 0;
              movingPiece.userData.origPosY = piece.position.y;
              
              // Update grid state instantly so logic is sound
              validSquares[toIdx].occupant = piece;
              validSquares[fromIdx].occupant = null;
              
              currentMoveIndex++;
              moveTimer = 0.5 + Math.random() * 0.5; // Pause between moves
            } else {
              // Failsafe: if piece not found, skip move
              currentMoveIndex++;
              moveTimer = 0.1;
            }
          }
        }
      } else {
        // Animate the piece moving
        movingPiece.userData.moveProgress += delta * 3.0; // Speed of movement
        const p = Math.min(movingPiece.userData.moveProgress, 1);
        
        movingPiece.position.x = THREE.MathUtils.lerp(movingPiece.userData.origPos.x, movingPiece.userData.targetPos.x, p);
        movingPiece.position.z = THREE.MathUtils.lerp(movingPiece.userData.origPos.z, movingPiece.userData.targetPos.z, p);
        
        // Parabolic jump arc
        const jumpHeight = 1.5;
        movingPiece.position.y = movingPiece.userData.origPosY + Math.sin(p * Math.PI) * jumpHeight;
        
        if (p >= 1) {
          movingPiece.position.y = movingPiece.userData.origPosY;
          movingPiece = null;
        }
      }
    }

    camera.position.z = currentCamZ;
    camera.position.y = currentCamY;
    camera.lookAt(0, 0, 0);
  }

  // ── Phase 2: King ─────────────────────────────────────────────────────────
  // Enters much earlier: 0.15 -> 0.35, Exits 0.75 -> 0.9
  const p2Enter = Math.max(Math.min((scrollProgress - 0.15) / 0.20, 1), 0);
  const p2Exit  = Math.max(Math.min((scrollProgress - 0.75) / 0.15, 1), 0);

  if (king) {
    king.visible = true;
    const targetKingX = -35 + (p2Enter - p2Exit) * (35 + KING_REST_X);
    currentKingX += (targetKingX - currentKingX) * 0.06;
    king.position.x = currentKingX;
    king.position.y = Math.sin(elapsed * 1.5) * 0.08 - 2;

    // Camera reset toward neutral in phase 2
    if (p2Enter > 0) {
      currentCamZ += (22 - currentCamZ) * 0.03;
      currentCamY += ( 6 - currentCamY) * 0.03;
      camera.position.z = currentCamZ;
      camera.position.y = currentCamY;
      camera.lookAt(0, 0, 0);
    }
  }

  // ── Phase 3: Queen ────────────────────────────────────────────────────────
  // Enters 0.75 -> 0.9
  const p3 = Math.max(Math.min((scrollProgress - 0.75) / 0.15, 1), 0);

  if (queen) {
    queen.visible = true;
    const targetQueenX = 35 - p3 * (35 - QUEEN_REST_X);
    currentQueenX += (targetQueenX - currentQueenX) * 0.06;
    queen.position.x = currentQueenX;
    queen.position.y = Math.sin(elapsed * 1.5 + Math.PI) * 0.08 - 2;
  }

  renderer.render(scene, camera);
  window.requestAnimationFrame(tick);
};

tick();

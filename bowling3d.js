import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  isSoftwareGl,
  getShadowTexture,
  disposeObjectTree,
  createRendererAndEnv,
  disposeRenderer,
  setupLoop,
} from '/avatar3d.js';
import { spatialAudio } from '/audio3d.js';

const BALL_STYLES = {
  verde: { color: 0x22c55e, emissive: 0x15803d, emissiveInt: 0.25, rough: 0.16, metal: 0.15 },
  vermelha: { color: 0xef4444, emissive: 0x991b1b, emissiveInt: 0.25, rough: 0.16, metal: 0.15 },
  eletrica: { color: 0x22d3ee, emissive: 0x06b6d4, emissiveInt: 0.7, rough: 0.12, metal: 0.35 },
  prata: { color: 0xe2e8f0, emissive: 0x334155, emissiveInt: 0.1, rough: 0.12, metal: 0.92 },
  preto: { color: 0x0f172a, emissive: 0x1e293b, emissiveInt: 0.15, rough: 0.08, metal: 0.45 },
  gold: { color: 0xfbbf24, emissive: 0xb45309, emissiveInt: 0.35, rough: 0.14, metal: 0.94 },
  fire: { color: 0xf97316, emissive: 0xea580c, emissiveInt: 0.85, rough: 0.18, metal: 0.25 },
};

// Exact 10-pin coordinates matching [0], [1,2], [3,4,5], [6,7,8,9]
const PIN_POS = [
  [0, -3.15],
  [-0.24, -3.55], [0.24, -3.55],
  [-0.48, -3.95], [0, -3.95], [0.48, -3.95],
  [-0.72, -4.35], [-0.24, -4.35], [0.24, -4.35], [0.72, -4.35],
];

function makeLaneTexture(maxAniso) {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 512;
  const ctx = cv.getContext('2d');

  // Maple wood planks
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#c88d4b' : '#b87d3e';
    ctx.fillRect(i * 16, 0, 16, 512);
    ctx.strokeStyle = 'rgba(70, 35, 10, 0.22)';
    ctx.lineWidth = 1;
    ctx.strokeRect(i * 16, 0, 16, 512);
  }

  // Foul line near player
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(0, 446, 256, 6);

  // Aiming chevrons
  ctx.fillStyle = 'rgba(40, 20, 5, 0.5)';
  for (let i = -3; i <= 3; i++) {
    const x = 128 + i * 26;
    const y = 340 - Math.abs(i) * 10;
    ctx.beginPath();
    ctx.moveTo(x, y - 10);
    ctx.lineTo(x + 6, y + 6);
    ctx.lineTo(x - 6, y + 6);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAniso || 1);
  return tex;
}

function makePinGeometry() {
  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.068, 0.0),
    new THREE.Vector2(0.105, 0.14),
    new THREE.Vector2(0.108, 0.24),
    new THREE.Vector2(0.056, 0.38),
    new THREE.Vector2(0.048, 0.45),
    new THREE.Vector2(0.068, 0.53),
    new THREE.Vector2(0.055, 0.59),
    new THREE.Vector2(0.0, 0.61),
  ];
  return new THREE.LatheGeometry(pts, 18);
}

function buildPinMesh(pinGeo, whiteMat, redMat) {
  const root = new THREE.Group();

  const sh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.32, 0.32),
    new THREE.MeshBasicMaterial({ map: getShadowTexture(), transparent: true, depthWrite: false, opacity: 0.44 }),
  );
  sh.rotation.x = -Math.PI / 2;
  sh.position.y = 0.006;
  root.add(sh);

  const bodyWrap = new THREE.Group();
  root.add(bodyWrap);

  const pin = new THREE.Mesh(pinGeo, whiteMat);
  pin.castShadow = true;
  pin.receiveShadow = true;
  bodyWrap.add(pin);

  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.053, 0.055, 0.045, 16), redMat);
  stripe.position.y = 0.415;
  bodyWrap.add(stripe);

  root.userData.wrap = bodyWrap;
  root.userData.sh = sh;
  return root;
}

function buildBallMesh(ballType) {
  const st = BALL_STYLES[ballType] || BALL_STYLES.verde;
  const g = new THREE.Group();

  const ballMat = new THREE.MeshStandardMaterial({
    color: st.color,
    emissive: st.emissive,
    emissiveIntensity: st.emissiveInt,
    roughness: st.rough,
    metalness: st.metal,
  });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 20), ballMat);
  sphere.castShadow = true;
  g.add(sphere);

  // 3 finger holes accent for clear spin read
  const holeMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.85 });
  for (const [hx, hy, hz] of [[0, 0.21, 0.03], [-0.045, 0.20, -0.035], [0.045, 0.20, -0.035]]) {
    const hole = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), holeMat);
    hole.position.set(hx, hy, hz);
    g.add(hole);
  }

  return g;
}

export function mountBowling3D(container, { pins, ball, onThrow }) {
  const width = container.clientWidth || 480;
  const height = container.clientHeight || 275;
  const { renderer, envTex } = createRendererAndEnv(width, height);

  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  const hint = document.createElement('div');
  hint.className = 'stage-hint';
  hint.textContent = '🎳 Toque na pista para arremessar • Arraste para girar';
  container.appendChild(hint);

  const scene = new THREE.Scene();
  scene.environment = envTex;
  scene.background = new THREE.Color(0x130b1c);
  scene.fog = new THREE.FogExp2(0x130b1c, 0.048);

  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 60);
  camera.position.set(0, 2.35, 5.15);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !isSoftwareGl;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 3.2;
  controls.maxDistance = 9.5;
  controls.minPolarAngle = 0.28;
  controls.maxPolarAngle = Math.PI / 2 - 0.1;
  controls.target.set(0, 0.35, -1.6);
  controls.update();

  spatialAudio.attachToCamera(camera);
  const ambience = spatialAudio.createStageAmbience(scene, 'bowling');

  scene.add(new THREE.HemisphereLight(0xfde68a, 0x1e1b4b, 0.78));
  const key = new THREE.DirectionalLight(0xfff1dc, 2.1);
  key.position.set(3.5, 7, 5);
  key.castShadow = !isSoftwareGl;
  key.shadow.mapSize.set(512, 512);
  key.shadow.camera.left = -3.5;
  key.shadow.camera.right = 3.5;
  key.shadow.camera.top = 6;
  key.shadow.camera.bottom = -6;
  key.shadow.bias = -0.0005;
  scene.add(key);

  const neonRim = new THREE.DirectionalLight(0xf97316, 1.3);
  neonRim.position.set(-4, 3.5, -5.5);
  scene.add(neonRim);

  // Alley deck + gutters + neon bumpers + rear pinsetter hood
  const alleyGroup = new THREE.Group();
  const laneTex = makeLaneTexture(renderer.capabilities.getMaxAnisotropy());
  const lane = new THREE.Mesh(
    new THREE.BoxGeometry(2.05, 0.24, 9.6),
    new THREE.MeshStandardMaterial({ map: laneTex, roughness: 0.24, metalness: 0.08 }),
  );
  lane.position.set(0, -0.12, -0.4);
  lane.receiveShadow = true;
  alleyGroup.add(lane);

  const gutterMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.78, metalness: 0.2 });
  const railMat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    emissive: 0x06b6d4,
    emissiveIntensity: 0.75,
    roughness: 0.2,
  });
  for (const sx of [-1, 1]) {
    const gut = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 9.6), gutterMat);
    gut.position.set(sx * 1.18, -0.15, -0.4);
    gut.receiveShadow = true;
    alleyGroup.add(gut);

    const bumper = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.24, 9.6), gutterMat);
    bumper.position.set(sx * 1.40, 0.02, -0.4);
    alleyGroup.add(bumper);

    const neon = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 9.5), railMat);
    neon.position.set(sx * 1.40, 0.16, -0.4);
    alleyGroup.add(neon);
  }

  // Rear pinsetter arch
  const archMat = new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.45, metalness: 0.55 });
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.5, 0.45), archMat);
  backWall.position.set(0, 0.75, -5.25);
  alleyGroup.add(backWall);

  const archGlow = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 0.1, 0.1),
    new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xea580c, emissiveIntensity: 1.1, roughness: 0.2 }),
  );
  archGlow.position.set(0, 1.25, -4.98);
  alleyGroup.add(archGlow);
  scene.add(alleyGroup);

  // Build 10 pins
  const pinGeo = makePinGeometry();
  const pinWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.18, metalness: 0.05 });
  const pinRedMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35, metalness: 0.05 });
  const pinEntries = PIN_POS.map(([px, pz], idx) => {
    const mesh = buildPinMesh(pinGeo, pinWhiteMat, pinRedMat);
    mesh.position.set(px, 0, pz);
    scene.add(mesh);
    return {
      idx,
      mesh,
      baseX: px,
      baseZ: pz,
      up: true,
      falling: false,
      vx: 0,
      vy: 0,
      vz: 0,
      rx: 0,
      rz: 0,
    };
  });

  // Bowling ball
  let curBallType = ball || 'verde';
  let ballMesh = buildBallMesh(curBallType);
  ballMesh.position.set(0, 0.22, 3.15);
  scene.add(ballMesh);

  let ballShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.56, 0.56),
    new THREE.MeshBasicMaterial({ map: getShadowTexture(), transparent: true, depthWrite: false, opacity: 0.5 }),
  );
  ballShadow.rotation.x = -Math.PI / 2;
  ballShadow.position.set(0, 0.008, 3.15);
  scene.add(ballShadow);

  // Strike burst ring
  const strikeRingMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0, side: THREE.DoubleSide });
  const strikeRing = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.65, 32), strikeRingMat);
  strikeRing.rotation.x = -Math.PI / 2;
  strikeRing.position.set(0, 0.03, -3.8);
  strikeRing.visible = false;
  scene.add(strikeRing);

  let throwAnim = null;

  function applyPins(nextPins) {
    const arr = Array.isArray(nextPins) ? nextPins : Array(10).fill(1);
    pinEntries.forEach((p, i) => {
      p.up = !!arr[i];
      p.falling = false;
      p.mesh.visible = p.up;
      p.mesh.position.set(p.baseX, 0, p.baseZ);
      p.mesh.userData.wrap.rotation.set(0, 0, 0);
      p.mesh.userData.sh.visible = p.up;
    });
  }

  function setBall(nextBall) {
    if (!nextBall || nextBall === curBallType) return;
    curBallType = nextBall;
    const pos = ballMesh.position.clone();
    scene.remove(ballMesh);
    disposeObjectTree(ballMesh);
    ballMesh = buildBallMesh(curBallType);
    ballMesh.position.copy(pos);
    scene.add(ballMesh);
  }

  function playThrow(downIndices, nextPins, isStrike) {
    return new Promise((resolve) => {
      const downSet = new Set(downIndices || []);
      ballMesh.position.set(0, 0.22, 3.15);
      ballMesh.rotation.set(0, 0, 0);
      ballShadow.position.set(0, 0.008, 3.15);
      throwAnim = {
        t: 0,
        hitDone: false,
        downSet,
        isStrike: !!isStrike,
        nextPins,
        resolve,
      };
    });
  }

  applyPins(pins);

  // Click lane/pins to throw
  let downX = 0;
  let downY = 0;
  const onDown = (e) => { downX = e.clientX; downY = e.clientY; };
  const onUp = (e) => {
    const dx = e.clientX - downX;
    const dy = e.clientY - downY;
    if (dx * dx + dy * dy <= 36 && !throwAnim) onThrow?.();
  };
  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointerup', onUp);

  const ro = new ResizeObserver(() => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  });
  ro.observe(container);

  if (!isSoftwareGl) renderer.compile(scene, camera);

  const stopLoop = setupLoop(renderer, (dt, elapsed) => {
    controls.update();
    ambience.update(elapsed);

    if (throwAnim) {
      throwAnim.t += dt;
      const rollDur = 0.56;
      const totalDur = 1.15;

      if (throwAnim.t <= rollDur) {
        const u = throwAnim.t / rollDur;
        const z = THREE.MathUtils.lerp(3.15, -3.75, u);
        const x = Math.sin(u * Math.PI) * 0.14;
        ballMesh.position.set(x, 0.22, z);
        ballMesh.rotation.x -= dt * 22;
        ballShadow.position.set(x, 0.008, z);
      } else {
        const z = THREE.MathUtils.lerp(-3.75, -4.95, Math.min(1, (throwAnim.t - rollDur) / 0.3));
        ballMesh.position.set(0.1, 0.22, z);
        ballMesh.rotation.x -= dt * 16;
        ballShadow.position.set(0.1, 0.008, z);

        if (!throwAnim.hitDone) {
          throwAnim.hitDone = true;
          for (const p of pinEntries) {
            if (p.up && throwAnim.downSet.has(p.idx)) {
              p.falling = true;
              p.mesh.userData.sh.visible = false;
              p.vx = (p.baseX === 0 ? (Math.random() - 0.5) : Math.sign(p.baseX)) * (1.2 + Math.random() * 1.4);
              p.vy = 1.6 + Math.random() * 1.4;
              p.vz = -(1.4 + Math.random() * 1.8);
              p.rx = (Math.random() > 0.5 ? 1 : -1) * (6 + Math.random() * 5);
              p.rz = (Math.random() > 0.5 ? 1 : -1) * (5 + Math.random() * 5);
            }
          }
          if (throwAnim.isStrike) {
            strikeRing.visible = true;
            strikeRing.scale.setScalar(1);
            strikeRingMat.opacity = 0.95;
          }
        }
      }

      for (const p of pinEntries) {
        if (p.falling) {
          p.vy -= 9.5 * dt;
          p.mesh.position.x += p.vx * dt;
          p.mesh.position.y = Math.max(0.08, p.mesh.position.y + p.vy * dt);
          p.mesh.position.z += p.vz * dt;
          p.mesh.userData.wrap.rotation.x += p.rx * dt;
          p.mesh.userData.wrap.rotation.z += p.rz * dt;
        }
      }

      if (strikeRing.visible) {
        strikeRing.scale.addScalar(dt * 4.5);
        strikeRingMat.opacity = Math.max(0, strikeRingMat.opacity - dt * 1.6);
        if (strikeRingMat.opacity <= 0) strikeRing.visible = false;
      }

      if (throwAnim.t >= totalDur) {
        const done = throwAnim;
        throwAnim = null;
        ballMesh.position.set(0, 0.22, 3.15);
        ballShadow.position.set(0, 0.008, 3.15);
        strikeRing.visible = false;
        applyPins(done.nextPins);
        done.resolve();
      }
    } else {
      // Gentle idle hover-spin preview on ball
      ballMesh.rotation.y = Math.sin(elapsed * 0.9) * 0.35;
    }

    renderer.render(scene, camera);
  });

  return {
    updatePins: applyPins,
    setBall,
    playThrow,
    dispose() {
      if (throwAnim) {
        throwAnim.resolve();
        throwAnim = null;
      }
      stopLoop();
      ambience.dispose();
      spatialAudio.detachFromCamera(camera);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      controls.dispose();
      for (const p of pinEntries) disposeObjectTree(p.mesh);
      pinGeo.dispose();
      pinWhiteMat.dispose();
      pinRedMat.dispose();
      disposeObjectTree(ballMesh);
      ballShadow.geometry.dispose();
      ballShadow.material.dispose();
      strikeRing.geometry.dispose();
      strikeRingMat.dispose();
      disposeObjectTree(alleyGroup);
      disposeRenderer(renderer, envTex);
      container.innerHTML = '';
    },
  };
}

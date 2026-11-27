import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  isSoftwareGl,
  disposeObjectTree,
  createRendererAndEnv,
  disposeRenderer,
  setupLoop,
} from '/avatar3d.js';
import { spatialAudio } from '/audio3d.js';

const ROD_STYLES = {
  vara_bambu: { shaft: 0xd97706, grip: 0x78350f, reel: 0xb45309, tip: 0xfde68a, emissive: 0x000000, emissiveInt: 0 },
  vara_titanio: { shaft: 0xcbd5e1, grip: 0x1e293b, reel: 0x06b6d4, tip: 0x22d3ee, emissive: 0x0891b2, emissiveInt: 0.35 },
  vara_estelar: { shaft: 0x7c3aed, grip: 0x312e81, reel: 0xfbbf24, tip: 0xfef08a, emissive: 0xa855f7, emissiveInt: 0.75 },
};

function makeWaterTexture(maxAniso) {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 256;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 16, 128, 128, 128);
  g.addColorStop(0, '#0ea5e9');
  g.addColorStop(0.55, '#0369a1');
  g.addColorStop(1, '#082f49');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = 'rgba(186, 230, 253, 0.22)';
  ctx.lineWidth = 2;
  for (const r of [28, 56, 86, 114]) {
    ctx.beginPath();
    ctx.arc(128, 128, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAniso || 1);
  return tex;
}

function buildRodMesh(varaId) {
  const st = ROD_STYLES[varaId] || ROD_STYLES.vara_bambu;
  const pivot = new THREE.Group();

  const gripMat = new THREE.MeshStandardMaterial({ color: st.grip, roughness: 0.78, metalness: 0.1 });
  const shaftMat = new THREE.MeshStandardMaterial({
    color: st.shaft,
    emissive: st.emissive,
    emissiveIntensity: st.emissiveInt * 0.45,
    roughness: 0.35,
    metalness: varaId === 'vara_bambu' ? 0.08 : 0.65,
  });
  const reelMat = new THREE.MeshStandardMaterial({ color: st.reel, roughness: 0.28, metalness: 0.75 });
  const tipMat = new THREE.MeshStandardMaterial({
    color: st.tip,
    emissive: st.tip,
    emissiveIntensity: varaId === 'vara_estelar' ? 1.1 : 0.4,
    roughness: 0.2,
  });

  const rodBody = new THREE.Group();
  // Tilt forward over the pond
  rodBody.rotation.x = -0.78;
  pivot.add(rodBody);

  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.052, 0.55, 12), gripMat);
  grip.position.y = 0.25;
  grip.castShadow = true;
  rodBody.add(grip);

  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.09, 14), reelMat);
  reel.rotation.z = Math.PI / 2;
  reel.position.set(0.06, 0.48, 0.02);
  rodBody.add(reel);

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.036, 2.35, 12), shaftMat);
  shaft.position.y = 1.66;
  shaft.castShadow = true;
  rodBody.add(shaft);

  for (const ry of [1.1, 1.8, 2.4]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.006, 6, 12), reelMat);
    ring.position.set(0, ry, 0.025);
    rodBody.add(ring);
  }

  const tipOrb = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), tipMat);
  tipOrb.position.set(0, 2.84, 0);
  rodBody.add(tipOrb);

  pivot.userData.tipObj = tipOrb;
  return pivot;
}

function buildBobberMesh() {
  const g = new THREE.Group();
  const top = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52),
    new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 0.35, roughness: 0.25 }),
  );
  g.add(top);

  const bottom = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 14, 10, 0, Math.PI * 2, Math.PI * 0.48, Math.PI * 0.52),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 }),
  );
  g.add(bottom);

  const pin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.14, 8),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xf59e0b, emissiveIntensity: 0.6 }),
  );
  pin.position.y = 0.12;
  g.add(pin);
  return g;
}

function buildSwimFish(colorHex, scale = 1) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    emissive: colorHex,
    emissiveIntensity: 0.32,
    roughness: 0.35,
    metalness: 0.2,
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), mat);
  body.scale.set(0.65, 0.8, 1.55);
  g.add(body);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.14, 6), mat);
  tail.rotation.x = Math.PI / 2;
  tail.position.z = -0.20;
  g.add(tail);

  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 0.09), mat);
  fin.position.set(0, 0.08, 0.01);
  g.add(fin);

  g.scale.setScalar(scale);
  return g;
}

export function mountFishing3D(container, { vara, stage, onAction }) {
  const width = container.clientWidth || 480;
  const height = container.clientHeight || 290;
  const { renderer, envTex } = createRendererAndEnv(width, height);

  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  const hint = document.createElement('div');
  hint.className = 'stage-hint';
  hint.textContent = '🎣 Toque no lago para lançar/puxar • Arraste para girar';
  container.appendChild(hint);

  const scene = new THREE.Scene();
  scene.environment = envTex;
  scene.background = new THREE.Color(0x061529);
  scene.fog = new THREE.FogExp2(0x061529, 0.042);

  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 70);
  camera.position.set(2.4, 2.85, 4.65);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !isSoftwareGl;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 3.2;
  controls.maxDistance = 9.0;
  controls.minPolarAngle = 0.3;
  controls.maxPolarAngle = Math.PI / 2 - 0.08;
  controls.target.set(0, 0.35, -0.75);
  controls.update();

  spatialAudio.attachToCamera(camera);
  const ambience = spatialAudio.createStageAmbience(scene, 'fishing');

  scene.add(new THREE.HemisphereLight(0x7dd3fc, 0x0f172a, 0.85));
  const key = new THREE.DirectionalLight(0xfff1dc, 2.0);
  key.position.set(4, 7, 5);
  key.castShadow = !isSoftwareGl;
  key.shadow.mapSize.set(512, 512);
  key.shadow.camera.left = -5;
  key.shadow.camera.right = 5;
  key.shadow.camera.top = 5;
  key.shadow.camera.bottom = -5;
  key.shadow.bias = -0.0005;
  scene.add(key);

  const pondGlow = new THREE.DirectionalLight(0x22d3ee, 1.15);
  pondGlow.position.set(-4, 3.5, -4);
  scene.add(pondGlow);

  // Environment group: pond water, cosmic rocks, lily pads, wooden pier + warm lantern
  const envGroup = new THREE.Group();
  const waterTex = makeWaterTexture(renderer.capabilities.getMaxAnisotropy());
  const waterMat = new THREE.MeshStandardMaterial({
    map: waterTex,
    roughness: 0.14,
    metalness: 0.25,
    transparent: true,
    opacity: 0.9,
  });
  const water = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.4, 0.16, 48), waterMat);
  water.position.set(0, -0.08, -0.8);
  water.receiveShadow = true;
  envGroup.add(water);

  const rimMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });
  const shoreRing = new THREE.Mesh(new THREE.TorusGeometry(4.45, 0.22, 10, 48), rimMat);
  shoreRing.rotation.x = Math.PI / 2;
  shoreRing.position.set(0, 0.02, -0.8);
  envGroup.add(shoreRing);

  const lilyMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.65 });
  for (const [lx, lz, ls] of [[-2.5, -1.9, 1.0], [-2.1, -2.5, 0.72], [2.4, -2.2, 0.92], [2.8, -1.5, 0.7]]) {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * ls, 0.28 * ls, 0.03, 14), lilyMat);
    pad.position.set(lx, 0.015, lz);
    envGroup.add(pad);
  }

  // Wooden pier jutting from front edge (z ~ 3.2 -> z ~ 1.1)
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });
  const plankMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.82 });
  for (let i = 0; i < 6; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.08, 0.34), plankMat);
    plank.position.set(0, 0.28, 3.05 - i * 0.39);
    plank.castShadow = true;
    plank.receiveShadow = true;
    envGroup.add(plank);
  }
  for (const sx of [-0.66, 0.66]) {
    for (const pz of [2.95, 1.25]) {
      const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.75, 10), woodMat);
      pile.position.set(sx, 0.14, pz);
      pile.castShadow = true;
      envGroup.add(pile);
    }
  }
  // Glowing lantern post on pier right corner
  const lPost = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.95, 8), woodMat);
  lPost.position.set(0.68, 0.76, 1.25);
  envGroup.add(lPost);
  const lGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.10, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xf59e0b, emissiveIntensity: 1.4, roughness: 0.2 }),
  );
  lGlow.position.set(0.68, 1.26, 1.25);
  envGroup.add(lGlow);
  scene.add(envGroup);

  // Swimming underwater cosmic fishes
  const swimmers = [
    { mesh: buildSwimFish(0x38bdf8, 0.95), r: 1.45, spd: 0.55, phase: 0.2, y: -0.05 },
    { mesh: buildSwimFish(0xf472b6, 0.82), r: 2.05, spd: -0.42, phase: 2.1, y: -0.07 },
    { mesh: buildSwimFish(0xfacc15, 1.12), r: 1.05, spd: 0.68, phase: 4.0, y: -0.06 },
  ];
  for (const sw of swimmers) scene.add(sw.mesh);

  // Rod & bobber & fishing line
  let curVara = vara || 'vara_bambu';
  let curStage = stage || 'idle';
  let rodPivot = buildRodMesh(curVara);
  rodPivot.position.set(0, 0.42, 1.55);
  scene.add(rodPivot);

  const bobber = buildBobberMesh();
  bobber.position.set(0, 0.04, -1.25);
  scene.add(bobber);

  // Animated splash ripple ring around bobber
  const rippleMat = new THREE.MeshBasicMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
  const rippleRing = new THREE.Mesh(new THREE.RingGeometry(0.14, 0.22, 24), rippleMat);
  rippleRing.rotation.x = -Math.PI / 2;
  rippleRing.position.set(0, 0.02, -1.25);
  scene.add(rippleRing);

  // Fishing line connecting rod tip -> bobber top
  const lineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 2.3, -0.4),
    new THREE.Vector3(0, 0.14, -1.25),
  ]);
  const lineMat = new THREE.LineBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.85 });
  const lineMesh = new THREE.Line(lineGeo, lineMat);
  scene.add(lineMesh);

  // Caught showcase fish arc mesh
  let showcase = null; // { mesh, t, dur, resolve }
  let castAnim = null;  // { t, dur, resolve }

  const _tipWorld = new THREE.Vector3();

  function setVara(nextVara) {
    if (!nextVara || nextVara === curVara) return;
    curVara = nextVara;
    scene.remove(rodPivot);
    disposeObjectTree(rodPivot);
    rodPivot = buildRodMesh(curVara);
    rodPivot.position.set(0, 0.42, 1.55);
    scene.add(rodPivot);
  }

  function setState(next = {}) {
    if (next.vara) setVara(next.vara);
    if (next.stage) curStage = next.stage;
  }

  function playCast() {
    curStage = 'waiting';
    return new Promise((resolve) => {
      if (castAnim) castAnim.resolve();
      castAnim = { t: 0, dur: 0.45, resolve };
    });
  }

  function playCatch(fish) {
    curStage = 'reeling';
    return new Promise((resolve) => {
      if (showcase) {
        scene.remove(showcase.mesh);
        disposeObjectTree(showcase.mesh);
        showcase.resolve();
      }
      const col = fish?.color ? parseInt(String(fish.color).replace('#', ''), 16) : 0x38bdf8;
      const mesh = buildSwimFish(Number.isFinite(col) ? col : 0x38bdf8, 1.75);
      mesh.position.set(0, -0.1, -1.25);
      scene.add(mesh);
      showcase = { mesh, t: 0, dur: 1.05, resolve };
    });
  }

  // Click pond/pier to cast or reel
  let downX = 0;
  let downY = 0;
  const onDown = (e) => { downX = e.clientX; downY = e.clientY; };
  const onUp = (e) => {
    const dx = e.clientX - downX;
    const dy = e.clientY - downY;
    if (dx * dx + dy * dy <= 36 && !showcase && !castAnim) onAction?.();
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

    // Update swimmers beneath surface (dart toward bobber when biting!)
    for (const sw of swimmers) {
      const targetR = curStage === 'bite' ? 0.42 : sw.r;
      const a = elapsed * sw.spd + sw.phase;
      const cx = Math.cos(a) * targetR;
      const cz = -1.25 + Math.sin(a) * (targetR * 0.72);
      sw.mesh.position.set(cx, sw.y, cz);
      sw.mesh.rotation.y = Math.atan2(-Math.sin(a) * sw.spd, Math.cos(a) * sw.spd);
    }

    // Rod pitch & bobber position by stage
    let targetRodRotX = 0;
    let bobberX = 0;
    let bobberY = 0.04;
    let bobberZ = -1.25;

    if (castAnim) {
      castAnim.t += dt;
      const u = Math.min(1, castAnim.t / castAnim.dur);
      targetRodRotX = u < 0.4 ? 0.55 * (u / 0.4) : THREE.MathUtils.lerp(0.55, -0.1, (u - 0.4) / 0.6);
      bobberY = 0.04 + Math.sin(u * Math.PI) * 1.15;
      bobberZ = THREE.MathUtils.lerp(0.55, -1.25, u);
      if (castAnim.t >= castAnim.dur) {
        const done = castAnim;
        castAnim = null;
        done.resolve();
      }
    } else if (showcase) {
      showcase.t += dt;
      const u = Math.min(1, showcase.t / showcase.dur);
      targetRodRotX = 0.48 * Math.sin(u * Math.PI);
      showcase.mesh.position.set(0, Math.sin(u * Math.PI) * 1.75, THREE.MathUtils.lerp(-1.25, 0.85, u));
      showcase.mesh.rotation.y += dt * 7;
      showcase.mesh.rotation.x = Math.sin(u * Math.PI * 2) * 0.35;
      bobberZ = THREE.MathUtils.lerp(-1.25, 0.65, u);
      bobberY = 0.04 + Math.sin(u * Math.PI) * 0.85;
      if (showcase.t >= showcase.dur) {
        const done = showcase;
        showcase = null;
        scene.remove(done.mesh);
        disposeObjectTree(done.mesh);
        curStage = 'idle';
        done.resolve();
      }
    } else if (curStage === 'bite') {
      targetRodRotX = -0.34 + Math.sin(elapsed * 28) * 0.09;
      bobberX = Math.sin(elapsed * 22) * 0.08;
      bobberY = -0.05 + Math.sin(elapsed * 32) * 0.06;
    } else if (curStage === 'waiting') {
      targetRodRotX = -0.08 + Math.sin(elapsed * 2.2) * 0.03;
      bobberY = 0.03 + Math.sin(elapsed * 3.5) * 0.025;
    } else {
      targetRodRotX = 0.08 + Math.sin(elapsed * 1.4) * 0.02;
      bobberX = 0.05;
      bobberY = 0.25;
      bobberZ = 0.42;
    }

    rodPivot.rotation.x = THREE.MathUtils.damp(rodPivot.rotation.x, targetRodRotX, 14, dt);
    bobber.position.set(bobberX, bobberY, bobberZ);

    // Update splash ripple
    if (curStage === 'bite') {
      const rs = 1 + ((elapsed * 3.5) % 1) * 2.2;
      rippleRing.visible = true;
      rippleRing.position.set(bobberX, 0.02, bobberZ);
      rippleRing.scale.setScalar(rs);
      rippleMat.opacity = Math.max(0, 0.85 - ((elapsed * 3.5) % 1) * 0.85);
    } else if (curStage === 'waiting') {
      const rs = 1 + ((elapsed * 1.1) % 1) * 1.4;
      rippleRing.visible = true;
      rippleRing.position.set(bobberX, 0.02, bobberZ);
      rippleRing.scale.setScalar(rs);
      rippleMat.opacity = Math.max(0, 0.42 - ((elapsed * 1.1) % 1) * 0.42);
    } else {
      rippleRing.visible = false;
    }

    // Update fishing line vertex positions from rod tip world coords to bobber
    rodPivot.updateMatrixWorld(true);
    rodPivot.userData.tipObj.getWorldPosition(_tipWorld);
    const posAttr = lineGeo.getAttribute('position');
    posAttr.setXYZ(0, _tipWorld.x, _tipWorld.y, _tipWorld.z);
    posAttr.setXYZ(1, bobber.position.x, bobber.position.y + 0.16, bobber.position.z);
    posAttr.needsUpdate = true;

    renderer.render(scene, camera);
  });

  return {
    setState,
    setVara,
    playCast,
    playCatch,
    dispose() {
      if (castAnim) { castAnim.resolve(); castAnim = null; }
      if (showcase) {
        scene.remove(showcase.mesh);
        disposeObjectTree(showcase.mesh);
        showcase.resolve();
        showcase = null;
      }
      stopLoop();
      ambience.dispose();
      spatialAudio.detachFromCamera(camera);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      controls.dispose();
      for (const sw of swimmers) disposeObjectTree(sw.mesh);
      disposeObjectTree(rodPivot);
      disposeObjectTree(bobber);
      rippleRing.geometry.dispose();
      rippleMat.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      disposeObjectTree(envGroup);
      disposeRenderer(renderer, envTex);
      container.innerHTML = '';
    },
  };
}

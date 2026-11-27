import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  buildCharacterMesh,
  isSoftwareGl,
  getShadowTexture,
  disposeObjectTree,
  createRendererAndEnv,
  disposeRenderer,
  setupLoop,
} from '/avatar3d.js';
import { spatialAudio } from '/audio3d.js';

const LANE_STEP = 1.12;
const FORT_Z = 3.55;
const DIST_STEP = 0.92;
const DEFENDER_Z = 4.35;

const laneX = (lane) => (lane - 2) * LANE_STEP;
const distZ = (dist) => FORT_Z - dist * DIST_STEP;

// Pre-allocated scratch helpers (zero GC inside frame loop)
const _v3 = new THREE.Vector3();
const _v3b = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _ptr = new THREE.Vector2();
const _up = new THREE.Vector3(0, 1, 0);

function makeArenaTexture(maxAniso) {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 512;
  const ctx = cv.getContext('2d');

  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#0c1610');
  g.addColorStop(0.65, '#17281b');
  g.addColorStop(1, '#1f2937');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle 5 lane tracks
  for (let i = 0; i < 5; i++) {
    const x = 64 + i * 96;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.14)';
    ctx.fillRect(x - 42, 0, 84, 512);
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.12)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 42, 0, 84, 512);
  }

  // Distance tile lines
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1.5;
  for (let y = 32; y < 512; y += 48) {
    ctx.beginPath();
    ctx.moveTo(22, y);
    ctx.lineTo(490, y);
    ctx.stroke();
  }

  // Noise speckles
  for (let i = 0; i < 650; i++) {
    ctx.fillStyle = i % 2 ? 'rgba(0,0,0,0.16)' : 'rgba(134,239,172,0.05)';
    ctx.fillRect((i * 73) % 512, (i * 137) % 512, 2, 2);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAniso || 1);
  return tex;
}

function buildWeaponMesh(arma) {
  const g = new THREE.Group();
  const gunMetal = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.28, metalness: 0.85 });
  const darkGrip = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.78, metalness: 0.1 });
  const accent = new THREE.MeshStandardMaterial({
    color: arma === 'metralhadora' ? 0x22d3ee : arma === 'espingarda' ? 0xf97316 : 0xfacc15,
    emissive: arma === 'metralhadora' ? 0x06b6d4 : arma === 'espingarda' ? 0xea580c : 0xca8a04,
    emissiveIntensity: 0.55,
    roughness: 0.25,
    metalness: 0.5,
  });

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.13, 0.075), darkGrip);
  grip.position.set(0, -0.05, 0);
  g.add(grip);

  let barrelLen = 0.26;
  if (arma === 'espingarda') {
    barrelLen = 0.46;
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.22), new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.8 }));
    stock.position.set(0, 0.01, -0.10);
    g.add(stock);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.042, barrelLen, 10), gunMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.03, 0.20);
    g.add(barrel);
    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.07, 0.18), accent);
    pump.position.set(0, 0.0, 0.22);
    g.add(pump);
  } else if (arma === 'metralhadora') {
    barrelLen = 0.54;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.34), gunMetal);
    body.position.set(0, 0.02, 0.10);
    g.add(body);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, barrelLen, 10), gunMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.03, 0.30);
    g.add(barrel);
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.05, 0.18), accent);
    core.position.set(0, 0.04, 0.16);
    g.add(core);
  } else {
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.075, barrelLen), gunMetal);
    slide.position.set(0, 0.025, 0.09);
    g.add(slide);
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.022, 0.04), accent);
    sight.position.set(0, 0.07, 0.18);
    g.add(sight);
  }

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.03, arma === 'metralhadora' ? 0.58 : arma === 'espingarda' ? 0.45 : 0.24);
  g.add(muzzle);
  g.userData.muzzle = muzzle;
  return g;
}

function buildArenaEnvironment(scene, maxAniso) {
  const g = new THREE.Group();

  // Main battlefield deck
  const tex = makeArenaTexture(maxAniso);
  const deckTop = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.06 });
  const deckSide = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55, metalness: 0.45 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.36, 11.4), [deckSide, deckSide, deckTop, deckSide, deckSide, deckSide]);
  deck.position.set(0, -0.18, -0.5);
  deck.receiveShadow = true;
  g.add(deck);

  // Graveyard border rails
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.88, metalness: 0.08 });
  const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9, metalness: 0.02 });
  const lanternMat = new THREE.MeshStandardMaterial({
    color: 0x4ade80,
    emissive: 0x22c55e,
    emissiveIntensity: 0.9,
    roughness: 0.2,
  });

  // Tombstones & eerie lanterns along left/right flanks
  for (let i = 0; i < 4; i++) {
    const pz = -4.2 + i * 2.3;
    for (const sx of [-1, 1]) {
      const tx = sx * 3.1;
      const tomb = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.68, 0.16), stoneMat);
      tomb.position.set(tx, 0.34, pz);
      tomb.rotation.y = sx * -0.18;
      tomb.rotation.z = ((i + (sx > 0 ? 1 : 0)) % 2 ? 1 : -1) * 0.08;
      tomb.castShadow = true;
      g.add(tomb);

      if (i % 2 === 1) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 1.1, 8), darkWoodMat);
        post.position.set(sx * 2.88, 0.55, pz + 0.75);
        post.castShadow = true;
        g.add(post);

        const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), lanternMat);
        lamp.position.set(sx * 2.88, 1.15, pz + 0.75);
        g.add(lamp);
      }
    }
  }

  // Danger line right before the fort
  const dangerLine = new THREE.Mesh(
    new THREE.BoxGeometry(5.8, 0.016, 0.07),
    new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xea580c, emissiveIntensity: 0.65, roughness: 0.3 }),
  );
  dangerLine.position.set(0, 0.01, FORT_Z - 0.38);
  g.add(dangerLine);

  // Fort barricade wall (🏠)
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.86, metalness: 0.04 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.35, metalness: 0.8 });

  for (const sx of [-2.45, -1.22, 1.22, 2.45]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.92, 10), wallMat);
    post.position.set(sx, 0.46, FORT_Z);
    post.castShadow = true;
    post.receiveShadow = true;
    g.add(post);
  }
  const barrier = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.44, 0.24), wallMat);
  barrier.position.set(0, 0.22, FORT_Z);
  barrier.castShadow = true;
  barrier.receiveShadow = true;
  g.add(barrier);

  const shieldMat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    emissive: 0x06b6d4,
    emissiveIntensity: 0.7,
    roughness: 0.18,
    metalness: 0.4,
    transparent: true,
    opacity: 0.72,
  });
  const shieldRail = new THREE.Mesh(new THREE.BoxGeometry(5.55, 0.08, 0.08), shieldMat);
  shieldRail.position.set(0, 0.56, FORT_Z);
  g.add(shieldRail);

  for (const sx of [-2.85, 2.85]) {
    const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 1.35, 12), ironMat);
    turret.position.set(sx, 0.675, FORT_Z + 0.15);
    turret.castShadow = true;
    g.add(turret);
  }

  scene.add(g);
  return { group: g, shieldMat, dangerLine };
}

function buildZombie3D(z) {
  const isBoss = z.e === '👹';
  const isStrong = !isBoss && z.max > 1;
  const sc = isBoss ? 1.48 : isStrong ? 1.14 : 1.0;

  const root = new THREE.Group();
  root.userData.zombieId = z.id;

  // Ground contact shadow
  const sh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95 * sc, 0.95 * sc),
    new THREE.MeshBasicMaterial({ map: getShadowTexture(), transparent: true, depthWrite: false, opacity: 0.52 }),
  );
  sh.rotation.x = -Math.PI / 2;
  sh.position.y = 0.008;
  root.add(sh);

  // Hover target ring (hidden unless hovered)
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.36 * sc, 0.46 * sc, 24), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.015;
  ring.visible = false;
  root.add(ring);

  // Boss ominous aura ring
  if (isBoss) {
    const aura = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.72, 24),
      new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    );
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = 0.013;
    root.add(aura);
  }

  const rig = new THREE.Group();
  rig.scale.setScalar(sc);
  root.add(rig);

  const skinColor = isBoss ? 0x991b1b : isStrong ? 0x4d7c0f : 0x65a30d;
  const clothColor = isBoss ? 0x1c1917 : isStrong ? 0x1e293b : 0x3f3f46;
  const eyeColor = isBoss ? 0xfef08a : isStrong ? 0xef4444 : 0xd9f99d;

  const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.72, metalness: 0.04 });
  const clothMat = new THREE.MeshStandardMaterial({ color: clothColor, roughness: 0.88, metalness: 0.05 });
  const armorMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.3, metalness: 0.85 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: eyeColor, emissive: eyeColor, emissiveIntensity: 1.1, roughness: 0.15 });

  // Legs
  const legs = [];
  for (const sx of [-1, 1]) {
    const legPivot = new THREE.Group();
    legPivot.position.set(sx * 0.12, 0.42, 0);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.36, 10), clothMat);
    leg.position.y = -0.18;
    leg.castShadow = true;
    legPivot.add(leg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.2), armorMat);
    foot.position.set(0, -0.375, 0.04);
    legPivot.add(foot);
    rig.add(legPivot);
    legs.push(legPivot);
  }

  // Torso
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.19, 0.48, 12), isStrong ? armorMat : clothMat);
  torso.position.y = 0.68;
  torso.rotation.x = 0.14; // slightly hunched forward
  torso.castShadow = true;
  rig.add(torso);

  if (isStrong || isBoss) {
    for (const sx of [-1, 1]) {
      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.105, 10, 8), armorMat);
      pad.position.set(sx * 0.27, 0.88, 0.04);
      pad.castShadow = true;
      rig.add(pad);
    }
  }

  // Outstretched zombie arms
  const arms = [];
  for (const sx of [-1, 1]) {
    const armPivot = new THREE.Group();
    armPivot.position.set(sx * 0.27, 0.86, 0.04);
    armPivot.rotation.x = -Math.PI * 0.42; // reaching forward toward +Z
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.24, 5, 8), clothMat);
    arm.position.y = -0.15;
    arm.castShadow = true;
    armPivot.add(arm);
    const claw = new THREE.Mesh(new THREE.SphereGeometry(0.058, 8, 8), skinMat);
    claw.position.y = -0.29;
    armPivot.add(claw);
    rig.add(armPivot);
    arms.push(armPivot);
  }

  // Head
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.98, 0.08);
  rig.add(headGroup);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.34), skinMat);
  head.position.y = 0.20;
  head.castShadow = true;
  headGroup.add(head);

  // Glowing zombie eyes + brow
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.045, 0.04), eyeMat);
    eye.position.set(sx * 0.08, 0.22, 0.165);
    headGroup.add(eye);
  }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.055, 0.04), new THREE.MeshBasicMaterial({ color: 0x0f172a }));
  mouth.position.set(0, 0.10, 0.165);
  headGroup.add(mouth);

  if (isStrong) {
    const helm = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.14, 0.38), armorMat);
    helm.position.set(0, 0.36, 0);
    headGroup.add(helm);
  }

  if (isBoss) {
    const hornMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.85, roughness: 0.22 });
    for (const sx of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.26, 8), hornMat);
      horn.position.set(sx * 0.17, 0.45, 0.02);
      horn.rotation.z = sx * -0.45;
      horn.rotation.x = 0.2;
      headGroup.add(horn);
    }
  }

  // Generous invisible raycast hit-box so tapping fast on mobile never misses
  const hitBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 1.75, 0.95),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
  );
  hitBox.position.y = 0.88;
  rig.add(hitBox);

  root.userData.rig = rig;
  root.userData.legs = legs;
  root.userData.arms = arms;
  root.userData.headGroup = headGroup;
  root.userData.ring = ring;
  root.userData.skinMat = skinMat;
  root.userData.sc = sc;
  root.userData.phase = (z.id * 1.7) % 6.28;
  return root;
}

export function mountZombie3D(container, { state, me, arma, onShoot }) {
  const width = container.clientWidth || 480;
  const height = container.clientHeight || 300;
  const { renderer, envTex } = createRendererAndEnv(width, height);

  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  const overlay = document.createElement('div');
  overlay.className = 'zombie3d-ov';
  container.appendChild(overlay);

  const hint = document.createElement('div');
  hint.className = 'stage-hint';
  hint.textContent = '🎯 Toque no zumbi para atirar • Arraste para girar';
  container.appendChild(hint);

  const scene = new THREE.Scene();
  scene.environment = envTex;
  scene.background = new THREE.Color(0x09130c);
  scene.fog = new THREE.FogExp2(0x09130c, 0.068);

  const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 70);
  camera.position.set(0, 4.6, 7.35);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !isSoftwareGl;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 4.2;
  controls.maxDistance = 11.0;
  controls.minPolarAngle = 0.32;
  controls.maxPolarAngle = Math.PI / 2 - 0.12;
  controls.target.set(0, 0.6, 0.45);
  controls.update();

  spatialAudio.attachToCamera(camera);
  const ambience = spatialAudio.createStageAmbience(scene, 'zombie');

  // Lighting
  scene.add(new THREE.HemisphereLight(0x86efac, 0x0f172a, 0.72));
  const key = new THREE.DirectionalLight(0xfff1dc, 1.9);
  key.position.set(4, 8, 6);
  key.castShadow = !isSoftwareGl;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -5.5;
  key.shadow.camera.right = 5.5;
  key.shadow.camera.top = 6;
  key.shadow.camera.bottom = -6;
  key.shadow.bias = -0.0005;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x4ade80, 1.15);
  rim.position.set(-4, 4, -6);
  scene.add(rim);

  const arena = buildArenaEnvironment(scene, renderer.capabilities.getMaxAnisotropy());

  // Player defender + mounted 3D weapon
  let curMe = me || { name: 'Você', g: 'm', cargo: 0, vip: false };
  let curArma = arma || 'pistola';
  let defender = null;
  let weaponMesh = null;
  let aimTargetAngle = Math.PI;
  let recoil = 0;
  let fortHurtTimer = 0;

  function mountDefender() {
    if (defender) {
      scene.remove(defender);
      disposeObjectTree(defender);
    }
    defender = buildCharacterMesh(curMe, true);
    defender.position.set(0, 0, DEFENDER_Z);
    defender.rotation.y = aimTargetAngle;
    // Raise right arm into shooting pose
    const rightArm = defender.userData.anim.arms[1];
    rightArm.rotation.x = -Math.PI / 2;
    rightArm.rotation.z = 0;
    weaponMesh = buildWeaponMesh(curArma);
    weaponMesh.position.set(0, -0.25, 0.04);
    weaponMesh.rotation.x = Math.PI / 2;
    rightArm.add(weaponMesh);
    scene.add(defender);
  }
  mountDefender();

  // Pre-allocated shot effects (laser tracer + muzzle flash + 8 burst sparks)
  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.9 });
  const tracer = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 1, 8), tracerMat);
  tracer.visible = false;
  scene.add(tracer);

  const flashMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.95 });
  const muzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), flashMat);
  muzzleFlash.visible = false;
  scene.add(muzzleFlash);

  const sparks = [];
  const sparkGeo = new THREE.SphereGeometry(0.055, 6, 6);
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0x84cc16, transparent: true, opacity: 1 });
  for (let i = 0; i < 10; i++) {
    const sp = new THREE.Mesh(sparkGeo, sparkMat);
    sp.visible = false;
    scene.add(sp);
    sparks.push({ mesh: sp, vx: 0, vy: 0, vz: 0, life: 0 });
  }
  let shotTimer = 0;

  const zombies = new Map(); // id -> { data, mesh, targetX, targetZ, labelEl, fillEl, hitFlash }
  const fallenZombies = []; // short, non-graphic knockdown animations
  let hoveredId = null;

  function makeZombieLabel(z) {
    const el = document.createElement('div');
    el.className = 'z3d-lbl';
    el.innerHTML = `<span class="z3d-tag">${z.e === '👹' ? '👹 CHEFE' : z.max > 1 ? '🛡️' : ''}</span><span class="z3d-hp"><i style="width:${Math.max(0, (z.hp / z.max) * 100)}%"></i></span>`;
    overlay.appendChild(el);
    return {
      el,
      tagEl: el.querySelector('.z3d-tag'),
      fillEl: el.querySelector('.z3d-hp i'),
    };
  }

  function spawnPopup(x, y, z, text, color) {
    const p = document.createElement('div');
    p.className = 'z3d-pop';
    p.textContent = text;
    if (color) p.style.color = color;
    overlay.appendChild(p);

    const w = container.clientWidth || width;
    const h = container.clientHeight || height;
    _v3.set(x, y, z);
    _v3.project(camera);
    const sx = ((_v3.x + 1) * 0.5) * w;
    const sy = ((-_v3.y + 1) * 0.5) * h;
    p.style.left = `${sx.toFixed(1)}px`;
    p.style.top = `${sy.toFixed(1)}px`;
    setTimeout(() => p.remove(), 750);
  }

  function triggerShotVisual(tx, ty, tz, dmgText, killed) {
    const dx = tx - defender.position.x;
    const dz = tz - defender.position.z;
    aimTargetAngle = Math.atan2(dx, dz);
    defender.rotation.y = aimTargetAngle;
    defender.updateMatrixWorld(true);
    recoil = 1.0;
    shotTimer = 0.22;

    if (weaponMesh?.userData?.muzzle) {
      weaponMesh.userData.muzzle.getWorldPosition(_v3);
    } else {
      _v3.set(0, 0.9, DEFENDER_Z - 0.5);
    }
    _v3b.set(tx, ty, tz);

    muzzleFlash.position.copy(_v3);
    muzzleFlash.visible = true;

    const dist = _v3.distanceTo(_v3b);
    tracerMat.color.setHex(curArma === 'metralhadora' ? 0x22d3ee : curArma === 'espingarda' ? 0xf97316 : 0xfef08a);
    tracer.position.copy(_v3).lerp(_v3b, 0.5);
    tracer.scale.set(1, dist, 1);
    tracer.quaternion.setFromUnitVectors(_up, _v3b.clone().sub(_v3).normalize());
    tracer.visible = true;

    sparkMat.color.setHex(killed ? 0x4ade80 : 0xfbbf24);
    for (let i = 0; i < sparks.length; i++) {
      const s = sparks[i];
      s.mesh.position.set(tx, ty, tz);
      s.mesh.visible = true;
      const a = (i / sparks.length) * Math.PI * 2 + Math.random() * 0.4;
      const spd = 1.5 + Math.random() * 2.4;
      s.vx = Math.cos(a) * spd;
      s.vy = 1.2 + Math.random() * 2.2;
      s.vz = Math.sin(a) * spd;
      s.life = 0.42;
    }

    if (dmgText) spawnPopup(tx, ty + 0.5, tz, dmgText, killed ? '#4ade80' : '#fde047');
  }

  function update(nextState, shotMeta) {
    const list = nextState?.zs || [];
    const keep = new Set();
    const defeatedIds = new Set();

    // If a target was shot, snapshot its position before removing/updating
    if (shotMeta?.id) {
      const prev = zombies.get(shotMeta.id);
      if (prev) {
        const still = list.find((x) => x.id === shotMeta.id);
        const dmg = shotMeta.dmg || 1;
        if (!still) defeatedIds.add(shotMeta.id);
        triggerShotVisual(
          prev.mesh.position.x,
          0.75 * prev.mesh.userData.sc,
          prev.mesh.position.z,
          still ? `-${dmg}` : `💥 -${dmg}`,
          !still,
        );
        if (still) prev.hitFlash = 0.25;
        else spawnPopup(prev.mesh.position.x, 1.2 * prev.mesh.userData.sc, prev.mesh.position.z, '✨ DERRUBADO', '#86efac');
      }
    }
    if (shotMeta?.lost > 0) {
      fortHurtTimer = 0.45;
      spawnPopup(0, 0.85, FORT_Z, `-${shotMeta.lost} ❤️`, '#ef4444');
    }

    // Update fort shield hue based on remaining lives
    const lives = nextState?.lives ?? 3;
    if (lives <= 1) {
      arena.shieldMat.color.setHex(0xef4444);
      arena.shieldMat.emissive.setHex(0xb91c1c);
    } else if (lives === 2) {
      arena.shieldMat.color.setHex(0xf59e0b);
      arena.shieldMat.emissive.setHex(0xd97706);
    } else {
      arena.shieldMat.color.setHex(0x22d3ee);
      arena.shieldMat.emissive.setHex(0x06b6d4);
    }

    for (const z of list) {
      keep.add(z.id);
      const tx = laneX(z.lane);
      const tz = distZ(z.dist);
      const ex = zombies.get(z.id);
      if (ex) {
        ex.data = z;
        ex.targetX = tx;
        ex.targetZ = tz;
        ex.fillEl.style.width = `${Math.max(0, (z.hp / z.max) * 100)}%`;
        ex.fillEl.style.background = z.dist <= 1 ? '#f97316' : '#ef4444';
        continue;
      }
      const mesh = buildZombie3D(z);
      mesh.position.set(tx, 0, Math.min(tz - 0.9, -4.8));
      scene.add(mesh);
      const { el, tagEl, fillEl } = makeZombieLabel(z);
      zombies.set(z.id, {
        data: z,
        mesh,
        targetX: tx,
        targetZ: tz,
        labelEl: el,
        tagEl,
        fillEl,
        hitFlash: 0,
      });
    }

    for (const [id, ent] of zombies) {
      if (!keep.has(id)) {
        ent.labelEl.remove();
        zombies.delete(id);
        if (hoveredId === id) hoveredId = null;
        if (defeatedIds.has(id)) {
          // Brief stylized knockdown: tip sideways, settle, and fade—no graphic detail.
          ent.mesh.userData.ring.visible = false;
          const fadeMats = [];
          ent.mesh.traverse((obj) => {
            if (!obj.isMesh) return;
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            obj.material = mats.map((mat) => {
              const copy = mat.clone();
              copy.transparent = true;
              copy.depthWrite = false;
              fadeMats.push(copy);
              return copy;
            });
          });
          fallenZombies.push({ mesh: ent.mesh, mats: fadeMats, life: 0.82, duration: 0.82, side: ent.mesh.position.x < 0 ? -1 : 1 });
        } else {
          scene.remove(ent.mesh);
          disposeObjectTree(ent.mesh);
        }
      }
    }
  }

  function setArma(nextArma) {
    if (!nextArma || nextArma === curArma) return;
    curArma = nextArma;
    mountDefender();
  }

  function setMe(nextMe) {
    if (!nextMe) return;
    const prevSig = `${curMe.g}|${curMe.char || ''}|${curMe.outfit || ''}|${curMe.traje || ''}|${curMe.acc || ''}|${curMe.vip ? 1 : 0}|${curMe.cargo}|${curMe.pet || ''}`;
    const nextSig = `${nextMe.g}|${nextMe.char || ''}|${nextMe.outfit || ''}|${nextMe.traje || ''}|${nextMe.acc || ''}|${nextMe.vip ? 1 : 0}|${nextMe.cargo}|${nextMe.pet || ''}`;
    curMe = nextMe;
    if (prevSig !== nextSig) mountDefender();
  }

  update(state);

  // Pointer hover + click-to-shoot (ignores OrbitControls drags > 6px)
  let downX = 0;
  let downY = 0;
  const pickZombie = (clientX, clientY) => {
    const rect = renderer.domElement.getBoundingClientRect();
    _ptr.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    _ptr.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    _raycaster.setFromCamera(_ptr, camera);
    const meshes = [...zombies.values()].map((z) => z.mesh);
    const hits = _raycaster.intersectObjects(meshes, true);
    if (!hits.length) return null;
    let cur = hits[0].object;
    while (cur && cur.userData?.zombieId === undefined) cur = cur.parent;
    return cur?.userData?.zombieId ?? null;
  };

  const onDown = (e) => { downX = e.clientX; downY = e.clientY; };
  const onMove = (e) => {
    const id = pickZombie(e.clientX, e.clientY);
    hoveredId = id;
    renderer.domElement.style.cursor = id !== null ? 'crosshair' : 'grab';
    if (id !== null) {
      const z = zombies.get(id);
      if (z) aimTargetAngle = Math.atan2(z.mesh.position.x - defender.position.x, z.mesh.position.z - defender.position.z);
    }
  };
  const onUp = (e) => {
    const dx = e.clientX - downX;
    const dy = e.clientY - downY;
    if (dx * dx + dy * dy > 36) return;
    const id = pickZombie(e.clientX, e.clientY);
    if (id !== null) { spatialAudio.playUi('close'); onShoot?.(id); }
  };

  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointermove', onMove);
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

    const w = container.clientWidth || width;
    const h = container.clientHeight || height;

    // Defender aim & recoil recovery
    if (defender) {
      const diff = Math.atan2(Math.sin(aimTargetAngle - defender.rotation.y), Math.cos(aimTargetAngle - defender.rotation.y));
      defender.rotation.y += diff * Math.min(1, dt * 14);
      const anim = defender.userData.anim;
      anim.rig.position.y = Math.sin(elapsed * 2.8) * 0.015;
      if (recoil > 0.001) {
        recoil = Math.max(0, recoil - dt * 5.5);
        anim.arms[1].rotation.x = -Math.PI / 2 - recoil * 0.35;
      } else {
        anim.arms[1].rotation.x = -Math.PI / 2;
      }
    }

    // Shot tracer / flash decay
    if (shotTimer > 0) {
      shotTimer = Math.max(0, shotTimer - dt);
      if (shotTimer <= 0.12) muzzleFlash.visible = false;
      if (shotTimer <= 0) tracer.visible = false;
    }
    for (const f of fallenZombies) {
      f.life = Math.max(0, f.life - dt);
      const t = 1 - f.life / f.duration;
      f.mesh.rotation.z = f.side * (1.18 * t);
      f.mesh.rotation.x = -0.18 * t;
      f.mesh.position.y = Math.max(0.02, 0.12 * (1 - t));
      f.mesh.scale.setScalar(1 - 0.08 * t);
      for (const mat of f.mats) mat.opacity = Math.max(0, 1 - t);
      if (f.life <= 0) {
        scene.remove(f.mesh);
        disposeObjectTree(f.mesh);
      }
    }
    for (let i = fallenZombies.length - 1; i >= 0; i--) {
      if (fallenZombies[i].life <= 0) fallenZombies.splice(i, 1);
    }
    for (const s of sparks) {
      if (s.life > 0) {
        s.life -= dt;
        s.vy -= 9.5 * dt;
        s.mesh.position.x += s.vx * dt;
        s.mesh.position.y = Math.max(0.03, s.mesh.position.y + s.vy * dt);
        s.mesh.position.z += s.vz * dt;
        s.mesh.scale.setScalar(Math.max(0.1, s.life / 0.42));
        if (s.life <= 0) s.mesh.visible = false;
      }
    }

    // Fort hurt feedback
    if (fortHurtTimer > 0) {
      fortHurtTimer = Math.max(0, fortHurtTimer - dt);
      arena.shieldMat.emissive.setHex(0xef4444);
      arena.shieldMat.emissiveIntensity = 1.6;
    } else {
      arena.shieldMat.emissiveIntensity = 0.6 + Math.sin(elapsed * 3.5) * 0.15;
    }

    // Zombies shamble + smooth advance
    for (const [id, ent] of zombies) {
      const { mesh, targetX, targetZ, labelEl } = ent;
      const ud = mesh.userData;
      mesh.position.x = THREE.MathUtils.damp(mesh.position.x, targetX, 8, dt);
      mesh.position.z = THREE.MathUtils.damp(mesh.position.z, targetZ, 7, dt);

      const walkT = elapsed * 4.5 + ud.phase;
      ud.rig.position.y = Math.abs(Math.sin(walkT)) * 0.045;
      ud.rig.rotation.z = Math.sin(walkT * 0.5) * 0.05;
      ud.legs[0].rotation.x = Math.sin(walkT) * 0.35;
      ud.legs[1].rotation.x = -Math.sin(walkT) * 0.35;
      ud.arms[0].rotation.x = -Math.PI * 0.42 + Math.sin(walkT * 0.7) * 0.1;
      ud.arms[1].rotation.x = -Math.PI * 0.42 - Math.sin(walkT * 0.7) * 0.1;
      ud.ring.visible = hoveredId === id;

      if (ent.hitFlash > 0) {
        ent.hitFlash = Math.max(0, ent.hitFlash - dt);
        ud.skinMat.emissive.setHex(0xef4444);
        ud.skinMat.emissiveIntensity = ent.hitFlash * 3.2;
      } else {
        ud.skinMat.emissiveIntensity = 0;
      }

      // Project HP bar above zombie
      _v3.set(mesh.position.x, 1.56 * ud.sc, mesh.position.z);
      _v3.project(camera);
      if (_v3.z > 1 || _v3.z < -1) {
        labelEl.style.display = 'none';
      } else {
        labelEl.style.display = '';
        const sx = ((_v3.x + 1) * 0.5) * w;
        const sy = ((-_v3.y + 1) * 0.5) * h;
        labelEl.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
      }
    }

    renderer.render(scene, camera);
  });

  return {
    update,
    setArma,
    setMe,
    dispose() {
      stopLoop();
      ambience.dispose();
      spatialAudio.detachFromCamera(camera);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerup', onUp);
      controls.dispose();
      for (const ent of zombies.values()) {
        disposeObjectTree(ent.mesh);
        ent.labelEl.remove();
      }
      zombies.clear();
      for (const f of fallenZombies) disposeObjectTree(f.mesh);
      fallenZombies.length = 0;
      if (defender) disposeObjectTree(defender);
      disposeObjectTree(arena.group);
      tracer.geometry.dispose();
      tracerMat.dispose();
      muzzleFlash.geometry.dispose();
      flashMat.dispose();
      sparkGeo.dispose();
      sparkMat.dispose();
      disposeRenderer(renderer, envTex);
      container.innerHTML = '';
    },
  };
}

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

const RANGE_SCALE = 0.092;
const ORIGIN_X = -5.6;
const worldX = (m) => ORIGIN_X + m * RANGE_SCALE;

// Pre-allocated scratch object for InstancedMesh trajectory dots
const _dummy = new THREE.Object3D();

function makeRangeTexture(maxAniso) {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 256;
  const ctx = cv.getContext('2d');

  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#1e3a24');
  g.addColorStop(0.5, '#2d5a34');
  g.addColorStop(1, '#1e3a24');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);

  // Dirt firing strip
  ctx.fillStyle = 'rgba(120, 72, 34, 0.36)';
  ctx.fillRect(0, 96, 512, 64);

  // Subtle range grid stripes
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 2;
  for (let x = 32; x < 512; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 86);
    ctx.lineTo(x, 170);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAniso || 1);
  return tex;
}

function buildCannonMesh() {
  const root = new THREE.Group();

  const sh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 1.0),
    new THREE.MeshBasicMaterial({ map: getShadowTexture(), transparent: true, depthWrite: false, opacity: 0.48 }),
  );
  sh.rotation.x = -Math.PI / 2;
  sh.position.y = 0.008;
  root.add(sh);

  const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85, metalness: 0.04 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.32, metalness: 0.85 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.22, metalness: 0.9 });

  // Carriage base
  const carriage = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.24, 0.48), woodMat);
  carriage.position.set(-0.08, 0.22, 0);
  carriage.castShadow = true;
  root.add(carriage);

  // Wheels on left/right sides
  for (const sz of [-1, 1]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.08, 16), woodMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(0.05, 0.24, sz * 0.28);
    wheel.castShadow = true;
    root.add(wheel);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.025, 8, 20), ironMat);
    rim.position.set(0.05, 0.24, sz * 0.28);
    root.add(rim);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.11, 10), brassMat);
    hub.rotation.x = Math.PI / 2;
    hub.position.set(0.05, 0.24, sz * 0.28);
    root.add(hub);
  }

  // Barrel pivot (rotates Z from 5° to 85°)
  const barrelPivot = new THREE.Group();
  barrelPivot.position.set(0.02, 0.42, 0);
  root.add(barrelPivot);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.95, 16), ironMat);
  barrel.rotation.z = -Math.PI / 2;
  barrel.position.set(0.32, 0, 0);
  barrel.castShadow = true;
  barrelPivot.add(barrel);

  const muzzleRing = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.032, 8, 18), brassMat);
  muzzleRing.rotation.y = Math.PI / 2;
  muzzleRing.position.set(0.79, 0, 0);
  barrelPivot.add(muzzleRing);

  const breech = new THREE.Mesh(new THREE.SphereGeometry(0.155, 14, 12), ironMat);
  breech.position.set(-0.15, 0, 0);
  barrelPivot.add(breech);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0.84, 0, 0);
  barrelPivot.add(muzzle);

  root.userData.barrelPivot = barrelPivot;
  root.userData.muzzle = muzzle;
  return root;
}

function buildTargetMesh(kind) {
  const root = new THREE.Group();

  const sh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 1.0),
    new THREE.MeshBasicMaterial({ map: getShadowTexture(), transparent: true, depthWrite: false, opacity: 0.48 }),
  );
  sh.rotation.x = -Math.PI / 2;
  sh.position.y = 0.008;
  root.add(sh);

  const body = new THREE.Group();
  root.add(body);

  if (kind === 'barril') {
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.82, metalness: 0.05 });
    const hoopMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.3, metalness: 0.85 });
    const warnMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xb91c1c, emissiveIntensity: 0.45, roughness: 0.35 });

    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.25, 0.72, 16), woodMat);
    cyl.position.y = 0.36;
    cyl.castShadow = true;
    body.add(cyl);

    for (const hy of [0.16, 0.56]) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.275, 0.025, 8, 20), hoopMat);
      hoop.rotation.x = Math.PI / 2;
      hoop.position.y = hy;
      body.add(hoop);
    }

    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.285, 0.285, 0.14, 16), warnMat);
    band.position.y = 0.36;
    body.add(band);
  } else {
    // Wild boar / bicho target facing left toward cannon
    const furMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.86, metalness: 0.04 });
    const snoutMat = new THREE.MeshStandardMaterial({ color: 0xf4a29e, roughness: 0.65 });
    const tuskMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.3, metalness: 0.1 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

    for (const [lx, lz] of [[-0.18, -0.14], [-0.18, 0.14], [0.18, -0.14], [0.18, 0.14]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.22, 8), furMat);
      leg.position.set(lx, 0.11, lz);
      leg.castShadow = true;
      body.add(leg);
    }
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), furMat);
    torso.scale.set(1.3, 0.95, 0.92);
    torso.position.set(0.04, 0.36, 0);
    torso.castShadow = true;
    body.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.20, 14, 12), furMat);
    head.position.set(-0.30, 0.39, 0);
    head.castShadow = true;
    body.add(head);

    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 0.14, 10), snoutMat);
    snout.rotation.z = Math.PI / 2;
    snout.position.set(-0.48, 0.35, 0);
    body.add(snout);

    for (const sz of [-1, 1]) {
      const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.12, 8), tuskMat);
      tusk.position.set(-0.46, 0.39, sz * 0.09);
      tusk.rotation.z = 0.5;
      body.add(tusk);

      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), eyeMat);
      eye.position.set(-0.42, 0.45, sz * 0.11);
      body.add(eye);
    }
  }

  root.userData.body = body;
  root.userData.kind = kind;
  return root;
}

export function mountCannon3D(container, { target, kind, angle, power, ammo, traj }) {
  const width = container.clientWidth || 480;
  const height = container.clientHeight || 255;
  const { renderer, envTex } = createRendererAndEnv(width, height);

  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  const hint = document.createElement('div');
  hint.className = 'stage-hint';
  hint.textContent = '💥 Ajuste ângulo e força • Arraste para girar';
  container.appendChild(hint);

  const scene = new THREE.Scene();
  scene.environment = envTex;
  scene.background = new THREE.Color(0x0b1a2e);
  scene.fog = new THREE.FogExp2(0x0b1a2e, 0.032);

  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 80);
  camera.position.set(0.2, 4.6, 11.4);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !isSoftwareGl;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 6.0;
  controls.maxDistance = 18.0;
  controls.minPolarAngle = 0.3;
  controls.maxPolarAngle = Math.PI / 2 - 0.08;
  controls.target.set(0.0, 1.3, 0);
  controls.update();

  spatialAudio.attachToCamera(camera);
  const ambience = spatialAudio.createStageAmbience(scene, 'cannon');

  scene.add(new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.85));
  const key = new THREE.DirectionalLight(0xfff1dc, 2.1);
  key.position.set(5, 10, 7);
  key.castShadow = !isSoftwareGl;
  key.shadow.mapSize.set(512, 512);
  key.shadow.camera.left = -9;
  key.shadow.camera.right = 9;
  key.shadow.camera.top = 7;
  key.shadow.camera.bottom = -7;
  key.shadow.bias = -0.0005;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x38bdf8, 1.0);
  rim.position.set(-6, 5, -6);
  scene.add(rim);

  // Extended range terrain + distance marker posts
  const rangeGroup = new THREE.Group();
  const rangeTex = makeRangeTexture(renderer.capabilities.getMaxAnisotropy());
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(36, 20),
    new THREE.MeshStandardMaterial({ map: rangeTex, roughness: 0.88, metalness: 0.04 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  rangeGroup.add(ground);

  const postMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.45, metalness: 0.65 });
  for (let m = 20; m <= 120; m += 20) {
    const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.45, 8), postMat);
    marker.position.set(worldX(m), 0.225, -0.95);
    rangeGroup.add(marker);
  }
  scene.add(rangeGroup);

  // Cannon
  const cannon = buildCannonMesh();
  cannon.position.set(worldX(0), 0, 0);
  scene.add(cannon);

  // Target
  let curTarget = target || 60;
  let curKind = kind || 'barril';
  let targetMesh = buildTargetMesh(curKind);
  targetMesh.position.set(worldX(curTarget), 0, 0);
  scene.add(targetMesh);

  // Trajectory preview dots (InstancedMesh)
  const TRAJ_COUNT = 26;
  const trajInst = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.065, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.78 }),
    TRAJ_COUNT,
  );
  scene.add(trajInst);

  // Projectile + Explosion sparks (pre-allocated)
  const projMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xea580c,
    emissiveIntensity: 1.0,
    roughness: 0.25,
    metalness: 0.6,
  });
  const projectile = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12), projMat);
  projectile.visible = false;
  scene.add(projectile);

  const sparks = [];
  const sparkGeo = new THREE.SphereGeometry(0.08, 6, 6);
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
  for (let i = 0; i < 14; i++) {
    const sp = new THREE.Mesh(sparkGeo, sparkMat);
    sp.visible = false;
    scene.add(sp);
    sparks.push({ mesh: sp, vx: 0, vy: 0, vz: 0, life: 0 });
  }

  let curAngle = angle || 45;
  let curPower = power || 25;
  let curTraj = traj !== false;
  let shotAnim = null;
  let recoil = 0;
  let targetFall = 0;

  function updateAim(nextAngle, nextPower, nextTraj) {
    if (typeof nextAngle === 'number') curAngle = nextAngle;
    if (typeof nextPower === 'number') curPower = nextPower;
    if (typeof nextTraj === 'boolean') curTraj = nextTraj;

    const rad = (curAngle * Math.PI) / 180;
    cannon.userData.barrelPivot.rotation.z = rad;

    trajInst.visible = curTraj && !shotAnim;
    if (curTraj) {
      const T = (2 * curPower * Math.sin(rad)) / 9.8;
      const vx = curPower * Math.cos(rad);
      const vy = curPower * Math.sin(rad);
      for (let i = 0; i < TRAJ_COUNT; i++) {
        const t = ((i + 1) / TRAJ_COUNT) * T;
        const m = vx * t;
        const h = Math.max(0.05, vy * t - 4.9 * t * t);
        _dummy.position.set(worldX(m), 0.42 + h * RANGE_SCALE, 0);
        _dummy.scale.setScalar(1 - (i / TRAJ_COUNT) * 0.35);
        _dummy.updateMatrix();
        trajInst.setMatrixAt(i, _dummy.matrix);
      }
      trajInst.instanceMatrix.needsUpdate = true;
      trajInst.computeBoundingSphere();
    }
  }

  function setTarget(nextTarget, nextKind) {
    curTarget = nextTarget;
    if (nextKind && nextKind !== curKind) {
      curKind = nextKind;
      scene.remove(targetMesh);
      disposeObjectTree(targetMesh);
      targetMesh = buildTargetMesh(curKind);
      scene.add(targetMesh);
    }
    targetFall = 0;
    targetMesh.position.set(worldX(curTarget), 0, 0);
    targetMesh.userData.body.rotation.set(0, 0, 0);
    targetMesh.userData.body.position.set(0, 0, 0);
  }

  function playShot({ angle: a, power: p, exp, hit, range }) {
    return new Promise((resolve) => {
      const rad = (a * Math.PI) / 180;
      const T = (2 * p * Math.sin(rad)) / 9.8;
      projMat.color.setHex(exp ? 0x1e293b : 0xf97316);
      projMat.emissive.setHex(exp ? 0xef4444 : 0xea580c);
      projectile.scale.setScalar(exp ? 1.35 : 1.0);
      projectile.visible = true;
      recoil = 1.0;
      trajInst.visible = false;
      shotAnim = {
        t: 0,
        dur: Math.max(0.75, Math.min(1.5, T * 0.28)),
        T,
        vx: p * Math.cos(rad),
        vy: p * Math.sin(rad),
        exp: !!exp,
        hit: !!hit,
        range,
        landed: false,
        resolve,
      };
    });
  }

  updateAim(curAngle, curPower, curTraj);

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

    if (recoil > 0.001) {
      recoil = Math.max(0, recoil - dt * 4.2);
      cannon.position.x = worldX(0) - recoil * 0.22;
    } else {
      cannon.position.x = worldX(0);
    }

    if (shotAnim) {
      shotAnim.t += dt;
      if (!shotAnim.landed) {
        const u = Math.min(1, shotAnim.t / shotAnim.dur);
        const simT = u * shotAnim.T;
        const m = shotAnim.vx * simT;
        const h = Math.max(0, shotAnim.vy * simT - 4.9 * simT * simT);
        projectile.position.set(worldX(m), 0.42 + h * RANGE_SCALE, 0);
        projectile.rotation.z -= dt * 10;

        if (u >= 1) {
          shotAnim.landed = true;
          projectile.visible = false;
          const ix = worldX(shotAnim.range);
          sparkMat.color.setHex(shotAnim.hit ? 0xfbbf24 : shotAnim.exp ? 0xf97316 : 0x94a3b8);
          for (let i = 0; i < sparks.length; i++) {
            const s = sparks[i];
            s.mesh.position.set(ix, 0.2, 0);
            s.mesh.visible = true;
            const ang = (i / sparks.length) * Math.PI * 2 + Math.random() * 0.5;
            const spd = (shotAnim.exp ? 2.6 : 1.6) + Math.random() * 2.2;
            s.vx = Math.cos(ang) * spd;
            s.vy = 2.0 + Math.random() * 2.8;
            s.vz = Math.sin(ang) * spd;
            s.life = 0.55;
          }
          if (shotAnim.hit) targetFall = 0.55;
        }
      } else if (shotAnim.t >= shotAnim.dur + 0.55) {
        const done = shotAnim;
        shotAnim = null;
        trajInst.visible = curTraj;
        done.resolve();
      }
    }

    if (targetFall > 0) {
      targetFall = Math.max(0, targetFall - dt);
      targetMesh.userData.body.rotation.z -= dt * 5.2;
      targetMesh.userData.body.position.x += dt * 1.4;
      targetMesh.userData.body.position.y = Math.sin((targetFall / 0.55) * Math.PI) * 0.45;
    } else if (curKind === 'bicho') {
      targetMesh.userData.body.position.y = Math.abs(Math.sin(elapsed * 2.8)) * 0.04;
    }

    for (const s of sparks) {
      if (s.life > 0) {
        s.life -= dt;
        s.vy -= 11 * dt;
        s.mesh.position.x += s.vx * dt;
        s.mesh.position.y = Math.max(0.04, s.mesh.position.y + s.vy * dt);
        s.mesh.position.z += s.vz * dt;
        s.mesh.scale.setScalar(Math.max(0.1, s.life / 0.55));
        if (s.life <= 0) s.mesh.visible = false;
      }
    }

    renderer.render(scene, camera);
  });

  return {
    updateAim,
    setTarget,
    playShot,
    dispose() {
      if (shotAnim) {
        shotAnim.resolve();
        shotAnim = null;
      }
      stopLoop();
      ambience.dispose();
      spatialAudio.detachFromCamera(camera);
      ro.disconnect();
      controls.dispose();
      disposeObjectTree(cannon);
      disposeObjectTree(targetMesh);
      disposeObjectTree(rangeGroup);
      trajInst.geometry.dispose();
      trajInst.material.dispose();
      projectile.geometry.dispose();
      projMat.dispose();
      sparkGeo.dispose();
      sparkMat.dispose();
      disposeRenderer(renderer, envTex);
      container.innerHTML = '';
    },
  };
}

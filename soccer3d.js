// Futebol 3D — disputa de pênaltis. Toque no gol para mirar, ajuste a força e chute.
// O resultado (gol, defesa, trave, fora) vem do servidor; aqui só animamos.
import * as THREE from 'three';
import {
  isSoftwareGl,
  disposeObjectTree,
  createRendererAndEnv,
  disposeRenderer,
  setupLoop,
} from '/avatar3d.js';

const GOAL_Z = -9;
const GOAL_HALF_W = 3.0;   // x = ±1 na mira
const GOAL_H = 2.6;        // y = 1 na mira
const SPOT = new THREE.Vector3(0, 0.22, 2.4);

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.02, ...o });

function makeGrassTexture(aniso) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 512;
  const ctx = cv.getContext('2d');
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? '#2f9e44' : '#37b24d';
    ctx.fillRect(0, i * 64, 512, 64);
  }
  for (let i = 0; i < 1800; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.07})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 5);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 2);
  t.anisotropy = Math.min(4, aniso || 1);
  return t;
}
function makeNetTexture() {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 128; i += 16) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 128); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(128, i); ctx.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function makeCrowdTexture() {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#1e1b3a'; ctx.fillRect(0, 0, 512, 128);
  const cols = ['#f87171', '#fbbf24', '#60a5fa', '#34d399', '#f472b6', '#e2e8f0', '#a78bfa'];
  for (let i = 0; i < 700; i++) {
    ctx.fillStyle = cols[i % cols.length];
    ctx.beginPath();
    ctx.arc(Math.random() * 512, Math.random() * 128, 2.5 + Math.random() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function makeBallTexture() {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = '#111827';
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 6; x++) {
      const cx = x * 44 + (y % 2 ? 22 : 0) + 8, cy = 18 + y * 44;
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
        const px = cx + Math.cos(a) * 11, py = cy + Math.sin(a) * 11;
        if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.closePath(); ctx.fill();
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildKeeper() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const jersey = mat(0xfacc15, { roughness: 0.6 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.55, 4, 10), jersey);
  torso.position.y = 1.05;
  body.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), mat(0xe8b896));
  head.position.y = 1.78;
  body.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.255, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(0x1f2937));
  hair.position.y = 1.81;
  body.add(hair);
  const arms = [];
  for (const sx of [-1, 1]) {
    const piv = new THREE.Group();
    piv.position.set(sx * 0.38, 1.45, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.62, 0.14), jersey);
    arm.position.y = -0.28;
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat(0xef4444, { roughness: 0.5 }));
    glove.position.y = -0.62;
    piv.add(arm, glove);
    piv.rotation.z = sx * 0.55;
    body.add(piv);
    arms.push(piv);
  }
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.75, 0.22), mat(0x111827));
    leg.position.set(sx * 0.14, 0.38, 0);
    body.add(leg);
  }
  return { g, body, arms };
}

function buildStadium(aniso) {
  const g = new THREE.Group();
  const grassTex = makeGrassTexture(aniso);
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(40, 50), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
  pitch.rotation.x = -Math.PI / 2;
  pitch.position.set(0, 0, -6);
  pitch.receiveShadow = true;
  g.add(pitch);

  // linhas brancas: linha de fundo, área pequena e marca do pênalti
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const line = (w, d, x, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), white);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.012, z);
    g.add(m);
  };
  line(30, 0.14, 0, GOAL_Z);
  line(11, 0.14, 0, GOAL_Z + 3.4);
  line(0.14, 3.4, -5.5, GOAL_Z + 1.7);
  line(0.14, 3.4, 5.5, GOAL_Z + 1.7);
  const spot = new THREE.Mesh(new THREE.CircleGeometry(0.14, 16), white);
  spot.rotation.x = -Math.PI / 2;
  spot.position.set(0, 0.014, SPOT.z);
  g.add(spot);

  // gol
  const postMat = mat(0xf8fafc, { roughness: 0.35, metalness: 0.3 });
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, GOAL_H, 12), postMat);
    post.position.set(sx * (GOAL_HALF_W + 0.07), GOAL_H / 2, GOAL_Z);
    post.castShadow = !isSoftwareGl;
    g.add(post);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, GOAL_HALF_W * 2 + 0.28, 12), postMat);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, GOAL_H, GOAL_Z);
  g.add(bar);

  const netTex = makeNetTexture();
  const netMat = new THREE.MeshBasicMaterial({ map: netTex, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
  const depth = 1.7;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(GOAL_HALF_W * 2, GOAL_H), netMat);
  back.position.set(0, GOAL_H / 2, GOAL_Z - depth);
  netTex.repeat.set(12, 5);
  g.add(back);
  const topNet = new THREE.Mesh(new THREE.PlaneGeometry(GOAL_HALF_W * 2, depth), netMat);
  topNet.rotation.x = Math.PI / 2;
  topNet.position.set(0, GOAL_H, GOAL_Z - depth / 2);
  g.add(topNet);
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(depth, GOAL_H), netMat);
    side.rotation.y = Math.PI / 2;
    side.position.set(sx * GOAL_HALF_W, GOAL_H / 2, GOAL_Z - depth / 2);
    g.add(side);
  }

  // arquibancada com torcida
  const crowdTex = makeCrowdTexture();
  const stand = new THREE.Mesh(new THREE.PlaneGeometry(40, 8), new THREE.MeshBasicMaterial({ map: crowdTex }));
  stand.position.set(0, 4.2, GOAL_Z - 8);
  stand.rotation.x = -0.25;
  g.add(stand);
  const wallAd = new THREE.Mesh(new THREE.BoxGeometry(40, 0.9, 0.2), mat(0x1d4ed8, { emissive: 0x1d4ed8, emissiveIntensity: 0.4 }));
  wallAd.position.set(0, 0.45, GOAL_Z - 4.2);
  g.add(wallAd);
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(30, 6), new THREE.MeshBasicMaterial({ map: crowdTex }));
    side.position.set(sx * 14, 3.4, -4);
    side.rotation.y = -sx * Math.PI / 2.6;
    g.add(side);
  }
  // refletores
  for (const sx of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 9, 8), mat(0x475569));
    pole.position.set(sx * 11, 4.5, GOAL_Z - 3);
    g.add(pole);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 0.3), new THREE.MeshBasicMaterial({ color: 0xfffbe6 }));
    lamp.position.set(sx * 11, 9.1, GOAL_Z - 3);
    lamp.lookAt(0, 4, 2);
    g.add(lamp);
  }
  return { group: g, textures: [grassTex, netTex, crowdTex], netMat };
}

export function mountSoccer3D(container, opts = {}) {
  const width = container.clientWidth || 480;
  const height = container.clientHeight || 290;
  const { renderer, envTex } = createRendererAndEnv(width, height);
  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  const hint = document.createElement('div');
  hint.className = 'stage-hint';
  hint.textContent = '⚽ Toque no gol para mirar';
  container.appendChild(hint);
  const msg = document.createElement('div');
  msg.style.cssText = 'position:absolute;left:0;right:0;top:18%;text-align:center;font:900 34px system-ui,sans-serif;color:#fff;text-shadow:0 3px 12px rgba(0,0,0,.7);pointer-events:none;opacity:0;transition:opacity .25s';
  container.appendChild(msg);

  const scene = new THREE.Scene();
  const SKY = 0x0b1d45;
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 24, 60);
  if (envTex) { scene.environment = envTex; scene.environmentIntensity = 0.5; }
  scene.add(new THREE.HemisphereLight(0xdbeafe, 0x2f6b3a, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(4, 12, 8);
  sun.castShadow = !isSoftwareGl;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 12, bottom: -14 });
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 100);
  camera.position.set(0, 1.7, 6.4);
  camera.lookAt(0, 1.15, GOAL_Z);

  const stadium = buildStadium(renderer.capabilities.getMaxAnisotropy());
  scene.add(stadium.group);

  const keeper = buildKeeper();
  keeper.g.position.set(0, 0, GOAL_Z + 0.35);
  scene.add(keeper.g);

  const ballTex = makeBallTexture();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 18), new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.55 }));
  ball.position.copy(SPOT);
  ball.castShadow = !isSoftwareGl;
  scene.add(ball);

  // marcador de mira (anel no plano do gol)
  const aimMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthTest: false });
  const aimMark = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.26, 24), aimMat);
  aimMark.renderOrder = 10;
  scene.add(aimMark);
  const aim = { x: 0, y: 0.35 };
  const placeAim = () => aimMark.position.set(aim.x * GOAL_HALF_W, aim.y * GOAL_H, GOAL_Z + 0.05);
  placeAim();

  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -GOAL_Z - 0.05);
  const hit = new THREE.Vector3();
  const ndc = new THREE.Vector2();
  let downX = 0, downY = 0, busy = false;
  const onDown = (e) => { downX = e.clientX; downY = e.clientY; };
  const onUp = (e) => {
    if (busy) return;
    if ((e.clientX - downX) ** 2 + (e.clientY - downY) ** 2 > 100) return;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(plane, hit)) {
      aim.x = clamp(hit.x / GOAL_HALF_W, -1.3, 1.3);
      aim.y = clamp(hit.y / GOAL_H, 0.02, 1.3);
      placeAim();
      opts.onAim?.({ ...aim });
    }
  };
  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointerup', onUp);

  const ro = new ResizeObserver(() => {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  });
  ro.observe(container);

  // animação de chute
  let shot = null;     // { t, dur, from, to, arch, outcome, keeperX, resolve, phase, t2, end }
  let keeperAnim = { x: 0, tilt: 0, lift: 0 };
  let msgTimer = null;
  const showMsg = (text, color) => {
    msg.textContent = text; msg.style.color = color || '#fff'; msg.style.opacity = '1';
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => { msg.style.opacity = '0'; }, 1500);
  };

  function playKick({ x, y, power, outcome, keeper: kcol }) {
    return new Promise((resolve) => {
      if (shot) shot.resolve();
      busy = true;
      const to = new THREE.Vector3(x * GOAL_HALF_W, Math.max(0.15, y * GOAL_H), GOAL_Z + 0.1);
      const dur = 1.25 - clamp(power, 0, 1) * 0.7;
      shot = {
        t: 0, dur, from: ball.position.clone(), to, arch: 0.35 + y * 0.7,
        outcome, kx: (kcol || 0) * 2.1, kcol: kcol || 0, resolve, phase: 0, t2: 0, end: new THREE.Vector3(), delay: 0.12,
        sameCol: (x < -0.33 ? -1 : x > 0.33 ? 1 : 0) === (kcol || 0),
      };
    });
  }

  function finishShot() {
    const s = shot; shot = null;
    setTimeout(() => {
      ball.position.copy(SPOT); ball.rotation.set(0, 0, 0);
      keeperAnim = { x: 0, tilt: 0, lift: 0 };
      aim.x = 0; aim.y = 0.35; placeAim();
      busy = false;
      s.resolve();
    }, 650);
  }

  const stopLoop = setupLoop(renderer, (dt, t) => {
    // goleiro
    let kxT = 0, tiltT = 0, liftT = 0;
    if (shot) {
      const k = clamp((shot.t - shot.delay) / (shot.dur * 0.8), 0, 1);
      const reach = shot.outcome === 'goal' && shot.sameCol ? 0.7 : 1;
      kxT = shot.kx * reach * Math.min(1, k * 1.3);
      tiltT = -shot.kcol * 1.25 * Math.min(1, k * 1.3) * reach;
      liftT = shot.kcol === 0 ? 0.25 * k : Math.sin(k * Math.PI) * 0.55;
    } else {
      kxT = Math.sin(t * 1.3) * 0.25;
    }
    keeperAnim.x = THREE.MathUtils.damp(keeperAnim.x, kxT, 14, dt);
    keeperAnim.tilt = THREE.MathUtils.damp(keeperAnim.tilt, tiltT, 14, dt);
    keeperAnim.lift = THREE.MathUtils.damp(keeperAnim.lift, liftT, 14, dt);
    keeper.g.position.x = keeperAnim.x;
    keeper.body.rotation.z = keeperAnim.tilt;
    keeper.body.position.y = keeperAnim.lift;
    const idleArms = shot ? 1.9 : 0.55 + Math.sin(t * 2) * 0.05;
    keeper.arms[0].rotation.z = -idleArms; keeper.arms[1].rotation.z = idleArms;

    if (shot) {
      shot.t += dt;
      if (shot.phase === 0) {
        const u = Math.min(1, shot.t / shot.dur);
        ball.position.lerpVectors(shot.from, shot.to, u);
        ball.position.y += Math.sin(u * Math.PI) * shot.arch;
        ball.rotation.x -= dt * 14; ball.rotation.z += dt * 5;
        if (u >= 1) {
          shot.phase = 1; shot.t2 = 0;
          const o = shot.outcome;
          shot.p0 = ball.position.clone();
          if (o === 'goal') { showMsg('GOOOOL! ⚽', '#fde047'); shot.end.set(shot.to.x * 0.8, 0.3, GOAL_Z - 1.4); }
          else if (o === 'saved') { showMsg('DEFENDEU! 🧤', '#93c5fd'); shot.end.set(shot.p0.x + (shot.p0.x >= 0 ? 1 : -1) * 1.6, 0.25, GOAL_Z + 2.8); }
          else if (o === 'post') { showMsg('NA TRAVE! 💥', '#fdba74'); shot.end.set(shot.p0.x + (shot.p0.x >= 0 ? 1 : -1) * 1.2, 0.25, GOAL_Z + 3.4); }
          else { showMsg('PRA FORA! 😬', '#fca5a5'); shot.end.set(shot.p0.x * 1.5, shot.p0.y + 1.4, GOAL_Z - 4.5); }
        }
      } else if (shot.phase === 1) {
        shot.t2 += dt;
        const u = Math.min(1, shot.t2 / 0.55);
        ball.position.lerpVectors(shot.p0, shot.end, u);
        ball.position.y += Math.sin(u * Math.PI) * (shot.outcome === 'goal' ? 0.15 : 0.7);
        ball.rotation.x -= dt * 9;
        if (shot.outcome === 'goal') stadium.netMat.opacity = 0.55 + Math.sin(u * Math.PI) * 0.35;
        if (u >= 1) { stadium.netMat.opacity = 0.55; shot.phase = 2; finishShot(); }
      }
    }
    aimMark.visible = !busy;
    aimMark.scale.setScalar(1 + Math.sin(t * 5) * 0.08);
    renderer.render(scene, camera);
  });

  return {
    getAim: () => ({ ...aim }),
    playKick,
    dispose() {
      stopLoop();
      clearTimeout(msgTimer);
      if (shot) { const s = shot; shot = null; s.resolve(); }
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      disposeObjectTree(stadium.group);
      disposeObjectTree(keeper.g);
      disposeObjectTree(ball);
      aimMark.geometry.dispose();
      aimMat.dispose();
      for (const tx of stadium.textures) tx.dispose();
      ballTex.dispose();
      disposeRenderer(renderer, envTex);
      container.innerHTML = '';
    },
  };
}

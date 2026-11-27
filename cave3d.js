// Caverna do Guardião 3D — cena completa: herói com lanterna, Guardião de pedra que se aproxima
// conforme a "ameaça" sobe, portão que abre, saída luminosa. Tudo reage ao estado do servidor.
import * as THREE from 'three';
import {
  isSoftwareGl,
  disposeObjectTree,
  createRendererAndEnv,
  disposeRenderer,
  setupLoop,
} from '/avatar3d.js';

const BG = 0x241a3a; // roxo escuro (nunca preto puro)
const GATE_Z = -9.5;
const EXIT_Z = -13.2;

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function makeRockTexture(base, speck, seed, anisotropy) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 256;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 256);
  const r = rng(seed);
  for (let i = 0; i < 900; i++) {
    const a = 0.05 + r() * 0.16;
    ctx.fillStyle = (r() > 0.5 ? 'rgba(255,255,255,' : 'rgba(0,0,0,') + a + ')';
    const s = 2 + r() * 9;
    ctx.fillRect(r() * 256, r() * 256, s, s * (0.5 + r()));
  }
  ctx.fillStyle = speck;
  for (let i = 0; i < 70; i++) ctx.fillRect(r() * 256, r() * 256, 2, 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = Math.min(4, anisotropy || 1);
  return tex;
}

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.05, ...o });
const glow = (color, k = 1.4) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: k, roughness: 0.4 });

function buildEnvironment(renderer) {
  const g = new THREE.Group();
  const r = rng(7);
  const aniso = renderer.capabilities.getMaxAnisotropy();

  const floorTex = makeRockTexture('#6b5f78', '#c4b5fd', 11, aniso);
  floorTex.repeat.set(4, 9);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, 32), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 0.5);
  floor.receiveShadow = true;
  g.add(floor);

  const wallTex = makeRockTexture('#554a66', '#a78bfa', 23, aniso);
  wallTex.repeat.set(6, 2);
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 1 });
  for (const sx of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6, 34), wallMat);
    w.position.set(sx * 4.4, 3, 0);
    g.add(w);
  }
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.6, 34), wallMat);
  ceil.position.set(0, 5.9, 0);
  g.add(ceil);
  const back = new THREE.Mesh(new THREE.BoxGeometry(9.5, 6.5, 0.6), wallMat);
  back.position.set(0, 3, 16.8);
  g.add(back);

  // rochas irregulares nas laterais
  const rockGeo = new THREE.IcosahedronGeometry(1, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x6d6280, roughness: 1, flatShading: true });
  for (let i = 0; i < 46; i++) {
    const sx = i % 2 ? 1 : -1;
    const m = new THREE.Mesh(rockGeo, rockMat);
    const s = 0.55 + r() * 1.25;
    m.scale.set(s, s * (0.7 + r() * 0.9), s);
    m.position.set(sx * (3.5 + r() * 0.7), s * 0.45, 15 - (i / 46) * 30 + r());
    m.rotation.set(r() * 3, r() * 3, r() * 3);
    m.castShadow = !isSoftwareGl;
    g.add(m);
  }
  // estalactites e estalagmites
  const coneGeo = new THREE.ConeGeometry(0.28, 1, 7);
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8b7fa3, roughness: 0.85, flatShading: true });
  for (let i = 0; i < 28; i++) {
    const m = new THREE.Mesh(coneGeo, stoneMat);
    const h = 0.9 + r() * 1.8;
    m.scale.set(0.7 + r() * 0.9, h, 0.7 + r() * 0.9);
    m.rotation.x = Math.PI;
    m.position.set((r() - 0.5) * 7.6, 5.6 - h / 2, 15 - (i / 28) * 29 + r());
    g.add(m);
  }
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(coneGeo, stoneMat);
    const h = 0.5 + r() * 1.1;
    m.scale.set(0.8 + r() * 0.6, h, 0.8 + r() * 0.6);
    const sx = r() > 0.5 ? 1 : -1;
    m.position.set(sx * (2.6 + r() * 0.8), h / 2, 14 - (i / 14) * 26 + r());
    g.add(m);
  }
  // cristais brilhantes (só emissivos, sem luzes extras)
  const crystalGeo = new THREE.OctahedronGeometry(0.28, 0);
  const cols = [0x22d3ee, 0xa78bfa, 0xf472b6];
  const crystals = [];
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(crystalGeo, glow(cols[i % 3], 1.6));
    m.scale.set(0.6, 1.3 + r(), 0.6);
    const sx = i % 2 ? 1 : -1;
    m.position.set(sx * (3.1 + r() * 0.5), 0.45, 13 - i * 2.3);
    m.rotation.y = r() * 3;
    g.add(m);
    crystals.push(m);
  }

  // tochas (4 luzes de verdade + chamas visuais)
  const torches = [];
  const woodMat = mat(0x5b3a1e);
  const torchSpots = [[-4.0, 6], [4.0, 0], [-4.0, -5], [4.0, -8.6]];
  for (const [tx, tz] of torchSpots) {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.9, 8), woodMat);
    stick.position.set(tx * 0.97, 2.1, tz);
    stick.rotation.z = tx > 0 ? 0.25 : -0.25;
    g.add(stick);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.42, 8), glow(0xffa21f, 2.2));
    flame.position.set(tx * 0.9, 2.65, tz);
    g.add(flame);
    const light = new THREE.PointLight(0xffa24a, isSoftwareGl ? 14 : 26, 11, 2);
    light.position.set(tx * 0.85, 2.7, tz);
    g.add(light);
    torches.push({ flame, light, base: light.intensity, ph: tz });
  }

  // portão de ferro com duas folhas
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x3f3f55, roughness: 0.45, metalness: 0.8 });
  const frame = new THREE.Group();
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5.4, 0.7), ironMat);
    post.position.set(sx * 2.55, 2.7, GATE_Z);
    frame.add(post);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.6, 0.7), ironMat);
  lintel.position.set(0, 5.2, GATE_Z);
  frame.add(lintel);
  g.add(frame);

  const makeDoor = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 2.3, 0, GATE_Z);
    const w = 2.3;
    for (let i = 0; i <= 6; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 4.8, 0.1), ironMat);
      bar.position.set(-side * (0.08 + (i / 6) * (w - 0.16)), 2.4, 0);
      pivot.add(bar);
    }
    for (const y of [0.8, 2.4, 4.0]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 0.12), ironMat);
      rail.position.set(-side * w / 2, y, 0);
      pivot.add(rail);
    }
    g.add(pivot);
    return pivot;
  };
  const doorL = makeDoor(-1), doorR = makeDoor(1);

  // saída luminosa
  const exitMat = new THREE.MeshBasicMaterial({ color: 0xfff7d6, fog: false });
  const exitPlane = new THREE.Mesh(new THREE.PlaneGeometry(7, 6), exitMat);
  exitPlane.position.set(0, 3, EXIT_Z);
  g.add(exitPlane);
  const exitLight = new THREE.PointLight(0xfff0c4, 0, 16, 2);
  exitLight.position.set(0, 2.6, EXIT_Z + 2);
  g.add(exitLight);
  // paredes da saída (fecham o corredor atrás do portão)
  for (const sx of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(1.6, 6, 0.6), wallMat);
    w.position.set(sx * 3.6, 3, EXIT_Z + 0.2);
    g.add(w);
  }

  return { group: g, torches, doorL, doorR, exitPlane, exitMat, exitLight, crystals, textures: [floorTex, wallTex] };
}

function buildHero() {
  const hero = new THREE.Group();
  const body = new THREE.Group();
  hero.add(body);
  const suit = mat(0x3b82f6, { roughness: 0.7 });
  const skin = mat(0xf1c29b, { roughness: 0.7 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.5, 4, 10), suit);
  torso.position.y = 0.95; torso.castShadow = !isSoftwareGl;
  body.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), skin);
  head.position.y = 1.55;
  body.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.255, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(0x2c1e16));
  hair.position.y = 1.58;
  body.add(hair);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.22), mat(0x92400e));
  pack.position.set(0, 1.0, 0.27);
  body.add(pack);

  const legs = [];
  for (const sx of [-1, 1]) {
    const piv = new THREE.Group();
    piv.position.set(sx * 0.13, 0.62, 0);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.62, 0.2), mat(0x1e293b));
    leg.position.y = -0.31;
    piv.add(leg);
    body.add(piv);
    legs.push(piv);
  }
  const arms = [];
  for (const sx of [-1, 1]) {
    const piv = new THREE.Group();
    piv.position.set(sx * 0.36, 1.25, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.5, 0.14), suit);
    arm.position.y = -0.22;
    piv.add(arm);
    body.add(piv);
    arms.push(piv);
  }
  // lanterna na mão direita
  const lantern = new THREE.Group();
  lantern.position.set(0, -0.5, -0.05);
  lantern.add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.14), glow(0xfde68a, 2.4)));
  const lamp = new THREE.PointLight(0xffe2a3, isSoftwareGl ? 12 : 22, 9, 2);
  lamp.position.set(0, 0.05, -0.1);
  lantern.add(lamp);
  arms[1].add(lantern);
  arms[1].rotation.x = -0.9;

  // itens flutuantes
  const keyItem = new THREE.Group();
  const kRing = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 8, 14), glow(0xfbbf24, 1.2));
  const kStem = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.3, 0.045), glow(0xfbbf24, 1.2));
  kStem.position.y = -0.22;
  const kTooth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.04), glow(0xfbbf24, 1.2));
  kTooth.position.set(0.06, -0.3, 0);
  keyItem.add(kRing, kStem, kTooth);
  keyItem.position.set(-0.55, 1.9, 0);
  keyItem.visible = false;
  hero.add(keyItem);

  const relicItem = new THREE.Mesh(new THREE.OctahedronGeometry(0.17, 0), glow(0x22d3ee, 2.2));
  relicItem.scale.y = 1.5;
  relicItem.position.set(0.55, 1.9, 0);
  relicItem.visible = false;
  hero.add(relicItem);

  return { hero, body, legs, arms, keyItem, relicItem, lamp };
}

function buildGuardian() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const stone = new THREE.MeshStandardMaterial({ color: 0x5b6475, roughness: 0.95, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3b4252, roughness: 1, flatShading: true });
  const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95, 0), stone);
  torso.scale.set(1.15, 1.3, 0.95);
  torso.position.y = 2.0;
  torso.castShadow = !isSoftwareGl;
  body.add(torso);
  const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.52, 0), dark);
  head.position.set(0, 3.35, -0.1);
  body.add(head);
  const runeMat = glow(0xff6a1f, 1.8);
  const eyes = [];
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), runeMat);
    e.position.set(sx * 0.2, 3.4, -0.55);
    body.add(e);
    eyes.push(e);
  }
  const core = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.06, 8, 18), runeMat);
  core.position.set(0, 2.25, -0.95);
  body.add(core);

  const arms = [];
  for (const sx of [-1, 1]) {
    const piv = new THREE.Group();
    piv.position.set(sx * 1.35, 2.85, 0);
    const up = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.5), stone);
    up.position.y = -0.75;
    const fist = new THREE.Mesh(new THREE.DodecahedronGeometry(0.46, 0), dark);
    fist.position.y = -1.65;
    piv.add(up, fist);
    body.add(piv);
    arms.push(piv);
  }
  const legs = [];
  for (const sx of [-1, 1]) {
    const piv = new THREE.Group();
    piv.position.set(sx * 0.5, 1.1, 0);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, 0.6), dark);
    leg.position.y = -0.55;
    piv.add(leg);
    body.add(piv);
    legs.push(piv);
  }
  const eyeLight = new THREE.PointLight(0xff6a1f, isSoftwareGl ? 8 : 16, 9, 2);
  eyeLight.position.set(0, 3.3, -1.0);
  body.add(eyeLight);
  g.scale.setScalar(1.15);
  g.rotation.y = 0; // olha para -z (em direção ao herói)
  return { g, body, arms, legs, eyes, runeMat, eyeLight, core };
}

function norm(G = {}) {
  return {
    stage: G.stage || 'intro',
    chase: Math.max(0, Math.min(5, +G.chase || 0)),
    turns: Math.max(0, +G.turns || 0),
    key: !!G.key,
    relic: !!G.relic,
    gate: !!G.gate,
    escapeSteps: Math.max(0, +G.escapeSteps || 0),
  };
}

function playerTargetZ(s) {
  if (s.stage === 'won') return EXIT_Z - 2.5;
  if (s.stage === 'escape' || (s.stage === 'lost' && s.gate)) return -4.5 - s.escapeSteps * 2.6;
  if (s.stage === 'intro') return 5;
  return 4 - Math.min(s.turns, 8) * 0.45;
}
function guardianDist(s) {
  if (s.stage === 'won') return 13;
  if (s.stage === 'lost') return 1.7;
  if (s.stage === 'intro') return 11.5;
  return 2.4 + (5 - s.chase) * 1.7;
}

export function mountCave3D(container, initial) {
  const width = container.clientWidth || 480;
  const height = container.clientHeight || 290;
  const { renderer, envTex } = createRendererAndEnv(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSoftwareGl ? 1 : 1.25));
  renderer.shadowMap.enabled = false;
  container.innerHTML = '';
  renderer.setClearColor(BG, 1);
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;background:#241a3a;';
  container.appendChild(renderer.domElement);

  const hint = document.createElement('div');
  hint.className = 'stage-hint';
  hint.textContent = '🕯️ Arraste para olhar ao redor';
  container.appendChild(hint);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 12, 38);
  if (envTex) { scene.environment = envTex; scene.environmentIntensity = 0.45; }

  // luz de base generosa: a caverna é escura, mas NUNCA preta
  scene.add(new THREE.HemisphereLight(0xb9a8ff, 0x3a2a55, 1.5));
  scene.add(new THREE.AmbientLight(0x8b7bd1, 0.9));
  const fill = new THREE.DirectionalLight(0xc4b5fd, 0.9);
  fill.position.set(2, 8, 6);
  scene.add(fill);

  const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 80);
  camera.position.set(3, 2.7, 9.4);

  const env = buildEnvironment(renderer);
  scene.add(env.group);

  const H = buildHero();
  scene.add(H.hero);
  const Gd = buildGuardian();
  scene.add(Gd.g);

  // poeira flutuante leve para manter FPS alto
  const dustN = isSoftwareGl ? 24 : 45;
  const dustPos = new Float32Array(dustN * 3);
  const dr = rng(99);
  for (let i = 0; i < dustN; i++) {
    dustPos[i * 3] = (dr() - 0.5) * 7;
    dustPos[i * 3 + 1] = 0.3 + dr() * 4.5;
    dustPos[i * 3 + 2] = 14 - dr() * 28;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({ color: 0xfff1c9, size: 0.06, transparent: true, opacity: 0.55, depthWrite: false });
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);

  let st = norm(initial);
  let heroZ = playerTargetZ(st);
  let guardZ = Math.min(15, heroZ + guardianDist(st));
  let gateOpen = st.gate ? 1 : 0;
  let fall = st.stage === 'lost' ? 1 : 0;
  let yaw = 0, targetYaw = 0, dragging = false, lastX = 0;
  let shake = 0;
  let heroMoving = false, guardMoving = false;

  const onDown = (e) => { dragging = true; lastX = e.clientX; };
  const onMove = (e) => {
    if (!dragging) return;
    targetYaw = Math.max(-0.9, Math.min(0.9, targetYaw - (e.clientX - lastX) * 0.006));
    lastX = e.clientX;
  };
  const onUp = () => { dragging = false; };
  const el = renderer.domElement;
  el.addEventListener('pointerdown', onDown);
  addEventListener('pointermove', onMove);
  addEventListener('pointerup', onUp);
  addEventListener('pointercancel', onUp);

  const ro = new ResizeObserver(() => {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSoftwareGl ? 1 : 1.25));
    renderer.setSize(w, h, false);
  });
  ro.observe(container);

  const damp = THREE.MathUtils.damp;
  const camTarget = new THREE.Vector3();
  const camPos = new THREE.Vector3(3, 2.7, heroZ + 4.4);

  let graphicsFailed = false;
  const showGraphicsFallback = (reason) => {
    if (graphicsFailed) return;
    graphicsFailed = true;
    console.warn('Caverna 3D indisponível; exibindo cenário compatível:', reason || 'WebGL');
    const fallback = document.createElement('div');
    fallback.className = 'cave-graphics-fallback';
    fallback.innerHTML = '<div class="cg-stars">✦　·　✧　　·　✦</div><div class="cg-title">CAVERNA DO GUARDIÃO</div><div class="cg-torch cg-torch-a">🔥</div><div class="cg-torch cg-torch-b">🔥</div><div class="cg-crystal">💎</div><div class="cg-gate">⛓️</div><div class="cg-hero">🧙</div><div class="cg-guardian">🗿</div><div class="cg-exit">✨ SAÍDA ✨</div><div class="cg-note">Modo gráfico compatível ativo — continue usando os controles abaixo</div>';
    container.innerHTML = '';
    container.appendChild(fallback);
  };
  const onContextLost = (event) => { if (event && event.preventDefault) event.preventDefault(); showGraphicsFallback('contexto WebGL perdido'); };
  renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);

  const stopLoop = setupLoop(renderer, (rawDt, t) => {
    if (graphicsFailed) return;
    const dt = Math.min(0.05, Math.max(0.001, rawDt || 0.016));
    const tz = playerTargetZ(st);
    heroZ = damp(heroZ, tz, 2.6, dt);
    const gz = Math.min(15.5, tz + guardianDist(st));
    guardZ = damp(guardZ, gz, st.stage === 'lost' ? 4 : 2.0, dt);
    heroMoving = Math.abs(tz - heroZ) > 0.08 && st.stage !== 'lost';
    guardMoving = Math.abs(gz - guardZ) > 0.08 || st.stage === 'escape' || st.stage === 'search' && st.chase >= 3;

    // herói
    H.hero.position.set(0, 0, heroZ);
    fall = damp(fall, st.stage === 'lost' ? 1 : 0, 5, dt);
    H.body.rotation.x = -fall * 1.45;
    H.body.position.y = fall * 0.3;
    const sw = heroMoving ? Math.sin(t * 9) * 0.65 : Math.sin(t * 1.6) * 0.03;
    H.legs[0].rotation.x = sw; H.legs[1].rotation.x = -sw;
    H.arms[0].rotation.x = -sw * 0.8;
    H.arms[1].rotation.x = -0.9 + (heroMoving ? sw * 0.25 : 0);
    H.body.position.y += heroMoving ? Math.abs(Math.sin(t * 9)) * 0.06 : 0;
    H.keyItem.visible = st.key;
    H.relicItem.visible = st.relic;
    H.keyItem.position.y = 1.9 + Math.sin(t * 2.2) * 0.06;
    H.keyItem.rotation.y = t * 1.6;
    H.relicItem.position.y = 1.9 + Math.sin(t * 2.6 + 1) * 0.06;
    H.relicItem.rotation.y = -t * 1.9;
    H.lamp.intensity = (isSoftwareGl ? 12 : 22) * (0.92 + Math.sin(t * 11) * 0.05 + Math.sin(t * 17) * 0.03);

    // Guardião
    Gd.g.position.set(0, 0, guardZ);
    const gs = guardMoving ? Math.sin(t * 4.2) : Math.sin(t * 1.1) * 0.15;
    Gd.legs[0].rotation.x = gs * 0.5; Gd.legs[1].rotation.x = -gs * 0.5;
    Gd.body.position.y = guardMoving ? Math.abs(Math.sin(t * 4.2)) * 0.1 : Math.sin(t * 1.1) * 0.03;
    const raise = st.stage === 'lost' ? -2.3 + Math.sin(t * 6) * 0.15 : 0;
    Gd.arms[0].rotation.x = st.stage === 'lost' ? raise : -gs * 0.35;
    Gd.arms[1].rotation.x = st.stage === 'lost' ? raise : gs * 0.35;
    const threat = st.stage === 'intro' ? 0.25 : st.stage === 'won' ? 0.2 : 0.7 + st.chase * 0.3;
    Gd.runeMat.emissiveIntensity = (1.1 + threat) * (0.9 + Math.sin(t * 5) * 0.12);
    Gd.eyeLight.intensity = (isSoftwareGl ? 6 : 12) * (0.4 + threat * 0.6);
    Gd.core.rotation.z = t * 1.4;

    // portão e saída
    gateOpen = damp(gateOpen, st.gate ? 1 : 0, 2.5, dt);
    env.doorL.rotation.y = -gateOpen * 1.45;
    env.doorR.rotation.y = gateOpen * 1.45;
    const exitK = st.gate ? gateOpen : 0.15;
    env.exitMat.color.setRGB(0.25 + 0.75 * exitK, 0.23 + 0.72 * exitK, 0.2 + 0.55 * exitK);
    env.exitLight.intensity = (isSoftwareGl ? 20 : 45) * exitK * (st.stage === 'won' ? 1.5 : 1);

    // tochas e cristais
    for (const tc of env.torches) {
      const f = 0.85 + Math.sin(t * 9 + tc.ph) * 0.1 + Math.sin(t * 23 + tc.ph * 2) * 0.06;
      tc.light.intensity = tc.base * f;
      tc.flame.scale.set(1, 0.85 + f * 0.3, 1);
    }
    env.crystals.forEach((c, i) => { c.rotation.y += dt * 0.6; c.material.emissiveIntensity = 1.3 + Math.sin(t * 2 + i) * 0.4; });

    // poeira
    const pa = dustGeo.getAttribute('position');
    for (let i = 0; i < dustN; i++) {
      let y = pa.getY(i) - dt * 0.05 * (1 + (i % 3));
      if (y < 0.2) y = 4.8;
      pa.setY(i, y);
      pa.setX(i, pa.getX(i) + Math.sin(t * 0.4 + i) * dt * 0.05);
    }
    pa.needsUpdate = true;

    // câmera: atrás do herói, com leve tremor quando o Guardião está perto
    targetYaw = dragging ? targetYaw : damp(targetYaw, 0, 1.2, dt);
    yaw = damp(yaw, targetYaw, 8, dt);
    // câmera lateral 3/4: enquadra o herói e o Guardião ao mesmo tempo (ele nunca tampa a vista)
    const gap = Math.min(6, Math.max(0, guardZ - heroZ));
    const midZ = heroZ + gap * 0.45;
    const ox = 3.0 + (st.stage === 'lost' ? 0.4 : 0), oz = 4.4 + gap * 0.18;
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    camPos.set(Math.max(-3.8, Math.min(3.8, ox * cs + oz * sn)), 2.7 + (st.stage === 'lost' ? 0.6 : 0), midZ + (-ox * sn + oz * cs));
    shake = damp(shake, st.stage === 'lost' || (st.stage !== 'intro' && st.chase >= 4) ? 0.07 : 0, 4, dt);
    camera.position.lerp(camPos, 1 - Math.exp(-6 * dt));
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
    camTarget.set(0, 1.5, midZ);
    camera.lookAt(camTarget);

    try { renderer.render(scene, camera); }
    catch (err) { showGraphicsFallback(err && err.message); }
  });

  function setState(next) { st = norm(next); }

  return {
    setState,
    dispose() {
      stopLoop();
      ro.disconnect();
      el.removeEventListener('webglcontextlost', onContextLost, false);
      el.removeEventListener('pointerdown', onDown);
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerup', onUp);
      removeEventListener('pointercancel', onUp);
      scene.remove(env.group, H.hero, Gd.g, dust);
      disposeObjectTree(env.group);
      disposeObjectTree(H.hero);
      disposeObjectTree(Gd.g);
      dustGeo.dispose();
      dustMat.dispose();
      for (const tx of env.textures) tx.dispose();
      disposeRenderer(renderer, envTex);
      container.innerHTML = '';
    },
  };
}

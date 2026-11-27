import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { spatialAudio } from '/audio3d.js';

export const isSoftwareGl = (() => {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return true;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (!dbg) return false;
    const ren = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '');
    return /swiftshader|llvmpipe|software|mesa/i.test(ren);
  } catch {
    return true;
  }
})();

let _shadowTex = null;
export function getShadowTexture() {
  if (_shadowTex) return _shadowTex;
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 64;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  g.addColorStop(0, 'rgba(0,0,0,0.85)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.35)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  _shadowTex = new THREE.CanvasTexture(cv);
  return _shadowTex;
}

export function disposeObjectTree(obj) {
  if (!obj) return;
  obj.traverse((ch) => {
    if (ch.geometry) ch.geometry.dispose();
    if (ch.material) {
      const mats = Array.isArray(ch.material) ? ch.material : [ch.material];
      for (const m of mats) {
        if (!m) continue;
        for (const k of Object.keys(m)) {
          const v = m[k];
          if (v && v.isTexture && v !== _shadowTex) v.dispose();
        }
        m.dispose();
      }
    }
  });
}

export function createRendererAndEnv(width, height) {
  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    powerPreference: 'high-performance',
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSoftwareGl ? 1 : 2));
  renderer.setSize(Math.max(1, width), Math.max(1, height), false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  let envTex = null;
  if (!isSoftwareGl) {
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envScene = new RoomEnvironment();
      envTex = pmrem.fromScene(envScene, 0.04).texture;
      envScene.dispose();
      pmrem.dispose();
    } catch {
      envTex = null;
    }
  }
  return { renderer, envTex };
}

export function disposeRenderer(renderer, envTex) {
  if (envTex) envTex.dispose();
  if (renderer) renderer.dispose();
}

export function setupLoop(renderer, tick) {
  let raf = 0;
  let running = true;
  let prev = performance.now();
  const start = prev;
  const frame = (now) => {
    if (!running) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - prev) / 1000));
    prev = now;
    const elapsed = (now - start) / 1000;
    try {
      tick(dt, elapsed);
    } catch (e) {
      console.error('3D loop error:', e);
    }
    if (running) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    running = false;
    cancelAnimationFrame(raf);
  };
}

const OUTFIT_COLORS = {
  roupa_azul: 0x3b82f6,
  roupa_preta: 0x1e293b,
  roupa_terno: 0xd4af37,
  roupa_rosa: 0xec4899,
  roupa_roxa: 0x8b5cf6,
  roupa_vestido_ouro: 0xeab308,
  roupa_galactica: 0x0891b2,
  roupa_carmesim: 0xbe123c,
  roupa_neon: 0x06b6d4,
  roupa_imperial: 0x7c3aed,
};

const CHAR_THEMES = {
  // Masculino
  piloto: { g: 'm', skin: 0xf1c29b, hair: 0x2c1e16, baseSuit: 0x3b82f6, eyes: 0x1e293b, accent: 0xfbbf24 },
  explorador_m: { g: 'm', skin: 0xe8b896, hair: 0x1e293b, baseSuit: 0x10b981, eyes: 0x0f172a, accent: 0x34d399 },
  cyber: { g: 'm', skin: 0xe5d5c8, hair: 0xe2e8f0, baseSuit: 0x0ea5e9, eyes: 0x22d3ee, accent: 0x38bdf8 },
  principe: { g: 'm', skin: 0xf5cba7, hair: 0xfbbf24, baseSuit: 0x6366f1, eyes: 0x3b82f6, accent: 0xfef08a },
  eclipse_m: { g: 'm', skin: 0xdcb495, hair: 0x1e1b4b, baseSuit: 0x7c3aed, eyes: 0xa855f7, accent: 0xc084fc },
  samurai_m: { g: 'm', skin: 0xeac09c, hair: 0x18181b, baseSuit: 0xb91c1c, eyes: 0x1e293b, accent: 0xf59e0b },
  lobo_m: { g: 'm', skin: 0xd8b298, hair: 0xcbd5e1, baseSuit: 0x334155, eyes: 0xf59e0b, accent: 0x94a3b8 },
  // Feminino
  estrela: { g: 'f', skin: 0xf5cba7, hair: 0x5b341e, baseSuit: 0xec4899, eyes: 0x312e81, accent: 0xfbbf24 },
  luna_f: { g: 'f', skin: 0xf7d5c0, hair: 0xf472b6, baseSuit: 0x06b6d4, eyes: 0x4f46e5, accent: 0xfde047 },
  valquiria: { g: 'f', skin: 0xf7d7c4, hair: 0xc084fc, baseSuit: 0x9333ea, eyes: 0x06b6d4, accent: 0xe9d5ff },
  aurora: { g: 'f', skin: 0xf0c9b1, hair: 0x2dd4bf, baseSuit: 0x0284c7, eyes: 0x0f766e, accent: 0x67e8f9 },
  dama_eclipse: { g: 'f', skin: 0xe6bfa5, hair: 0x18181b, baseSuit: 0xbe123c, eyes: 0xf43f5e, accent: 0xfda4af },
  kitsune_f: { g: 'f', skin: 0xfbe5d6, hair: 0xf8fafc, baseSuit: 0xe11d48, eyes: 0xf43f5e, accent: 0xfbcfe8 },
  imperatriz_f: { g: 'f', skin: 0xf3cbb0, hair: 0x4c1d95, baseSuit: 0x9333ea, eyes: 0xfbbf24, accent: 0xfde047 },
};

const CARGO_COLORS = ['#94a3b8', '#22c55e', '#06b6d4', '#a855f7', '#f59e0b', '#ec4899', '#ef4444'];
const CARGO_NAMES = ['Viajante', 'Sentinela', 'Comandante', 'Arconte', 'Celestial', 'Arquiteto', 'Dono'];

function resolveSuitColor(m, theme) {
  if (m.outfit) {
    if (OUTFIT_COLORS[m.outfit]) return OUTFIT_COLORS[m.outfit];
    if (typeof m.outfit === 'string' && m.outfit.startsWith('#')) {
      return parseInt(m.outfit.slice(1), 16) || theme.baseSuit;
    }
  }
  return theme.baseSuit;
}

const AURA_SPECS = {
  aura_fogo: { primary: 0xf97316, secondary: 0xfef08a, count: 8, shape: 'ember', speed: 2.2 },
  aura_raio: { primary: 0x38bdf8, secondary: 0xe0f2fe, count: 7, shape: 'bolt', speed: 3.1 },
  aura_sombria: { primary: 0xa855f7, secondary: 0x1e1b4b, count: 7, shape: 'orb', speed: 1.7 },
  aura_sakura: { primary: 0xf472b6, secondary: 0xfbcfe8, count: 10, shape: 'petal', speed: 1.3 },
  aura_arcana: { primary: 0x22d3ee, secondary: 0x818cf8, count: 6, shape: 'rune', speed: 1.5 },
  aura_celestial: { primary: 0xfbbf24, secondary: 0xfef9c3, count: 8, shape: 'star', speed: 1.9 },
};

function buildAuraGroup(auraId) {
  const spec = AURA_SPECS[auraId];
  if (!spec) return null;
  const group = new THREE.Group();
  const rings = [];
  const motes = [];
  // Soft animated aura halo around the avatar
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.58, 16, 12), new THREE.MeshBasicMaterial({ color: spec.primary, transparent: true, opacity: 0.10, wireframe: false, depthWrite: false }));
  halo.scale.set(1, 1.65, 1); halo.position.y = 0.78; group.add(halo);

  const ringMat1 = new THREE.MeshBasicMaterial({
    color: spec.primary, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false,
  });
  const ring1 = new THREE.Mesh(
    new THREE.RingGeometry(auraId === 'aura_arcana' ? 0.56 : 0.48, auraId === 'aura_arcana' ? 0.65 : 0.55, auraId === 'aura_arcana' ? 6 : 32),
    ringMat1,
  );
  ring1.rotation.x = -Math.PI / 2;
  ring1.position.y = 0.025;
  group.add(ring1);
  rings.push({ mesh: ring1, axis: 'z', spd: spec.speed * 0.65 });

  const ringMat2 = new THREE.MeshBasicMaterial({
    color: spec.secondary, transparent: true, opacity: 0.48, side: THREE.DoubleSide, depthWrite: false,
  });
  const ring2 = new THREE.Mesh(
    new THREE.TorusGeometry(0.46, 0.014, 8, auraId === 'aura_arcana' ? 8 : 28),
    ringMat2,
  );
  ring2.rotation.x = Math.PI / 2.35;
  ring2.position.y = 0.72;
  group.add(ring2);
  rings.push({ mesh: ring2, axis: 'y', spd: -spec.speed * 0.85 });

  if (auraId === 'aura_raio' || auraId === 'aura_celestial' || auraId === 'aura_sombria') {
    const ring3 = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.011, 6, 24),
      new THREE.MeshBasicMaterial({ color: spec.primary, transparent: true, opacity: 0.42, depthWrite: false }),
    );
    ring3.rotation.x = -Math.PI / 2.6;
    ring3.rotation.z = 0.45;
    ring3.position.y = 0.82;
    group.add(ring3);
    rings.push({ mesh: ring3, axis: 'y', spd: spec.speed * 1.1 });
  }

  const moteMat1 = new THREE.MeshStandardMaterial({
    color: spec.primary, emissive: spec.primary, emissiveIntensity: 1.15, roughness: 0.2, transparent: true, opacity: 0.9, depthWrite: false,
  });
  const moteMat2 = new THREE.MeshStandardMaterial({
    color: spec.secondary, emissive: spec.secondary, emissiveIntensity: 1.1, roughness: 0.25, transparent: true, opacity: 0.85, depthWrite: false,
  });

  for (let i = 0; i < spec.count; i++) {
    const geom = spec.shape === 'petal'
      ? new THREE.PlaneGeometry(0.08, 0.055)
      : spec.shape === 'bolt'
        ? new THREE.ConeGeometry(0.032, 0.14, 4)
        : new THREE.OctahedronGeometry(spec.shape === 'orb' ? 0.045 : 0.038, 0);
    const mat = i % 2 === 0 ? moteMat1 : moteMat2;
    if (spec.shape === 'petal') mat.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(geom, mat);
    const phase = (i / spec.count) * Math.PI * 2;
    const rad = 0.42 + (i % 3) * 0.075;
    const baseY = 0.25 + (i / spec.count) * 1.05;
    mesh.position.set(Math.cos(phase) * rad, baseY, Math.sin(phase) * rad);
    group.add(mesh);
    motes.push({ mesh, phase, rad, baseY, speed: spec.speed * (0.85 + (i % 3) * 0.18) });
  }

  return { group, rings, motes, halo };
}

const AUTH_THEMES = [
  { color: 0x94a3b8, glow: 0xcbd5e1, blades: 0, rings: 1 }, // 0 Viajante (com estrelas)
  { color: 0x22c55e, glow: 0x86efac, blades: 2, rings: 1 }, // 1 Sentinela
  { color: 0x06b6d4, glow: 0x67e8f9, blades: 4, rings: 2 }, // 2 Comandante
  { color: 0xa855f7, glow: 0xd8b4fe, blades: 4, rings: 2 }, // 3 Arconte
  { color: 0xf59e0b, glow: 0xfde047, blades: 6, rings: 2 }, // 4 Celestial
  { color: 0xec4899, glow: 0x38bdf8, blades: 6, rings: 3 }, // 5 Arquiteto
  { color: 0xef4444, glow: 0xfbbf24, blades: 8, rings: 3 }, // 6 Dono
];

function buildAuthorityBackGroup(m) {
  if (m.showAuth === false) return null;
  const cargo = Math.min(6, Math.max(0, Number(m.cargo) || 0));
  const stars = Math.max(0, Number(m.stars) || 0);
  if (cargo === 0 && stars <= 0) return null;

  const th = AUTH_THEMES[cargo] || AUTH_THEMES[0];
  const group = new THREE.Group();
  group.position.set(0, 0.92, -0.28);

  const rings = [];
  const orbiters = [];

  const mainMat = new THREE.MeshStandardMaterial({
    color: th.color, emissive: th.color, emissiveIntensity: 0.75 + cargo * 0.1, roughness: 0.25, metalness: 0.8, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: th.glow, emissive: th.glow, emissiveIntensity: 0.95, roughness: 0.2, metalness: 0.85, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false,
  });

  // Outer rotating authority halo behind character's back
  const haloRadius = 0.26 + cargo * 0.05;
  const segs = cargo >= 5 ? 8 : cargo >= 3 ? 6 : 24;
  const ring1 = new THREE.Mesh(new THREE.RingGeometry(haloRadius - 0.032, haloRadius, segs), mainMat);
  group.add(ring1);
  rings.push({ mesh: ring1, spd: 0.65 + cargo * 0.14 });

  if (th.rings >= 2) {
    const ring2 = new THREE.Mesh(
      new THREE.RingGeometry(haloRadius * 0.64, haloRadius * 0.72, cargo === 6 ? 6 : 16),
      glowMat,
    );
    ring2.position.z = -0.02;
    group.add(ring2);
    rings.push({ mesh: ring2, spd: -(0.9 + cargo * 0.15) });
  }

  if (th.rings >= 3) {
    const ring3 = new THREE.Mesh(new THREE.TorusGeometry(haloRadius * 1.14, 0.014, 6, 30), glowMat);
    ring3.position.z = -0.03;
    group.add(ring3);
    rings.push({ mesh: ring3, spd: 1.15 });
  }

  // Radiant authority blades / wings fanned behind the character
  if (th.blades > 0) {
    const bladeWrap = new THREE.Group();
    bladeWrap.position.z = -0.02;
    const count = th.blades;
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const tier = Math.floor(i / 2);
      const angle = side * (0.48 + tier * 0.34);
      const bladeLen = 0.26 + cargo * 0.035 - tier * 0.03;
      const blade = new THREE.Mesh(
        new THREE.ConeGeometry(0.036 + cargo * 0.004, bladeLen, 4),
        tier % 2 === 0 ? glowMat : mainMat,
      );
      blade.position.set(
        Math.sin(angle) * (haloRadius + bladeLen * 0.32),
        Math.cos(angle) * (haloRadius * 0.42) + (cargo >= 4 ? 0.06 : 0),
        -0.02 - tier * 0.015,
      );
      blade.rotation.z = -angle;
      bladeWrap.add(blade);
    }
    group.add(bladeWrap);
  }

  // Royal central crest core for Arconte+
  if (cargo >= 3) {
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.065 + cargo * 0.01, 0), glowMat);
    core.position.z = -0.01;
    group.add(core);
    rings.push({ mesh: core, spd: 1.8 });
  }

  // Authority Stars orbiting behind the crest (based on cargo + user's stars)
  const starPips = Math.min(6, Math.max(cargo > 0 ? 1 : 0, Math.floor(stars / 3) + (stars > 0 ? 1 : 0)));
  for (let i = 0; i < starPips; i++) {
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.036, 0), glowMat);
    const phase = (i / Math.max(1, starPips)) * Math.PI * 2;
    const rad = haloRadius + 0.09;
    gem.position.set(Math.cos(phase) * rad, Math.sin(phase) * rad, -0.04);
    group.add(gem);
    orbiters.push({ mesh: gem, phase, rad, spd: 1.25 + cargo * 0.15 });
  }

  return { group, rings, orbiters };
}

function damp(cur, target, lambda, dt) {
  return cur + (target - cur) * (1 - Math.exp(-lambda * dt));
}

function dampAngle(cur, target, lambda, dt) {
  const diff = ((target - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return cur + diff * (1 - Math.exp(-lambda * dt));
}

function animateCharacter(anim, dt, elapsed, moving = false, phaseOffset = 0, emoteMode = 'idle') {
  if (!anim) return;
  const st = anim.state || (anim.state = { walkBlend: 0, walkPhase: 0, emoteBlend: 0, lastEmote: 'idle' });
  const activeEmote = moving ? 'idle' : (emoteMode || 'idle');
  st.walkBlend = damp(st.walkBlend, moving ? 1 : 0, 12, dt);
  st.emoteBlend = damp(st.emoteBlend, activeEmote !== 'idle' ? 1 : 0, 10, dt);
  if (st.walkBlend > 0.005) st.walkPhase += dt * (4.5 + 6.5 * st.walkBlend);

  const wb = st.walkBlend;
  const eb = st.emoteBlend;
  const wp = st.walkPhase;
  const ib = Math.max(0, 1 - wb) * Math.max(0, 1 - eb);

  // Stride swing
  const stride = Math.sin(wp) * 0.62 * wb;
  const bounceWalk = Math.abs(Math.sin(wp)) * 0.042 * wb;

  // Idle subtle breathing & sway
  const breath = Math.sin(elapsed * 2.3 + phaseOffset);
  const sway = Math.sin(elapsed * 1.15 + phaseOffset);

  // Rig bounce / jump / dance vertical motion (keeps floor shadow & ground aura ring planted)
  let rigY = bounceWalk + breath * 0.008 * ib;
  let rigRotX = 0;
  let rigRotY = 0;
  let rigRotZ = sway * 0.022 * ib;
  let upperRotX = 0.09 * wb + breath * 0.025 * ib;
  let upperRotY = Math.cos(wp) * 0.085 * wb + sway * 0.03 * ib;
  let upperRotZ = -sway * 0.02 * ib;
  let headRotX = -0.04 * wb + Math.sin(elapsed * 1.4 + phaseOffset) * 0.055 * ib;
  let headRotY = Math.sin(elapsed * 0.85 + phaseOffset) * 0.16 * ib;
  let headRotZ = Math.cos(elapsed * 1.1 + phaseOffset) * 0.035 * ib;

  // Default arm & leg angles
  let lLegX = stride;
  let rLegX = -stride;
  let lLegZ = 0;
  let rLegZ = 0;
  let lKneeX = Math.max(0, -Math.sin(wp)) * 0.62 * wb;
  let rKneeX = Math.max(0, Math.sin(wp)) * 0.62 * wb;
  let lArmX = -stride * 0.88 + breath * 0.04 * ib;
  let rArmX = stride * 0.88 - breath * 0.04 * ib;
  let lArmZ = -0.07 - 0.03 * wb - breath * 0.025 * ib;
  let rArmZ = 0.07 + 0.03 * wb + breath * 0.025 * ib;
  let lElbowX = -0.18 - Math.max(0, Math.sin(wp)) * 0.34 * wb;
  let rElbowX = -0.18 - Math.max(0, -Math.sin(wp)) * 0.34 * wb;
  let lElbowZ = 0;
  let rElbowZ = 0;
  let forceClosedEyes = false;

  if (eb > 0.01 && activeEmote === 'wave') {
    const wv = Math.sin(elapsed * 9.5);
    rArmX = THREE.MathUtils.lerp(rArmX, -0.35, eb);
    rArmZ = THREE.MathUtils.lerp(rArmZ, 2.35 + wv * 0.25, eb);
    rElbowX = THREE.MathUtils.lerp(rElbowX, -0.2, eb);
    rElbowZ = THREE.MathUtils.lerp(0, -0.45 + wv * 0.35, eb);
    lArmZ = THREE.MathUtils.lerp(lArmZ, -0.18, eb);
    headRotZ = THREE.MathUtils.lerp(headRotZ, 0.11, eb);
    headRotY = THREE.MathUtils.lerp(headRotY, 0.12, eb);
    upperRotZ = THREE.MathUtils.lerp(upperRotZ, -0.05, eb);
  } else if (eb > 0.01 && activeEmote === 'clap') {
    const cl = Math.abs(Math.sin(elapsed * 9));
    lArmX = THREE.MathUtils.lerp(lArmX, -1.05, eb);
    rArmX = THREE.MathUtils.lerp(rArmX, -1.05, eb);
    lArmZ = THREE.MathUtils.lerp(lArmZ, 0.28 + cl * 0.26, eb);
    rArmZ = THREE.MathUtils.lerp(rArmZ, -0.28 - cl * 0.26, eb);
    lElbowX = THREE.MathUtils.lerp(lElbowX, -0.75, eb);
    rElbowX = THREE.MathUtils.lerp(rElbowX, -0.75, eb);
    headRotX = THREE.MathUtils.lerp(headRotX, Math.sin(elapsed * 4.5) * 0.06, eb);
  } else if (eb > 0.01 && activeEmote === 'dance') {
    const bt = elapsed * 7.2;
    const step = Math.sin(bt);
    const groove = Math.cos(bt * 0.5);
    rigY += Math.abs(step) * 0.075 * eb;
    rigRotZ += groove * 0.09 * eb;
    upperRotY += groove * 0.28 * eb;
    upperRotX += Math.sin(bt * 2) * 0.07 * eb;
    lLegX = THREE.MathUtils.lerp(lLegX, Math.max(0, step) * 0.32, eb);
    rLegX = THREE.MathUtils.lerp(rLegX, Math.max(0, -step) * 0.32, eb);
    lKneeX = THREE.MathUtils.lerp(lKneeX, Math.abs(step) * 0.42, eb);
    rKneeX = THREE.MathUtils.lerp(rKneeX, Math.abs(step) * 0.42, eb);
    lArmX = THREE.MathUtils.lerp(lArmX, -0.8 + step * 0.65, eb);
    rArmX = THREE.MathUtils.lerp(rArmX, -0.8 - step * 0.65, eb);
    lArmZ = THREE.MathUtils.lerp(lArmZ, -0.45 - groove * 0.22, eb);
    rArmZ = THREE.MathUtils.lerp(rArmZ, 0.45 - groove * 0.22, eb);
    lElbowX = THREE.MathUtils.lerp(lElbowX, -0.85, eb);
    rElbowX = THREE.MathUtils.lerp(rElbowX, -0.85, eb);
    headRotZ += groove * 0.12 * eb;
  } else if (eb > 0.01 && (activeEmote === 'jump' || activeEmote === 'cheer')) {
    const jt = Math.abs(Math.sin(elapsed * 5.4));
    rigY += jt * 0.26 * eb;
    upperRotX = THREE.MathUtils.lerp(upperRotX, -0.08 * jt, eb);
    lLegX = THREE.MathUtils.lerp(lLegX, -0.25 * jt, eb);
    rLegX = THREE.MathUtils.lerp(rLegX, -0.25 * jt, eb);
    lKneeX = THREE.MathUtils.lerp(lKneeX, 0.55 * jt, eb);
    rKneeX = THREE.MathUtils.lerp(rKneeX, 0.55 * jt, eb);
    lArmZ = THREE.MathUtils.lerp(lArmZ, -2.55 + jt * 0.24, eb);
    rArmZ = THREE.MathUtils.lerp(rArmZ, 2.55 - jt * 0.24, eb);
    lArmX = THREE.MathUtils.lerp(lArmX, -0.15, eb);
    rArmX = THREE.MathUtils.lerp(rArmX, -0.15, eb);
    headRotX = THREE.MathUtils.lerp(headRotX, -0.14 * jt, eb);
  } else if (eb > 0.01 && activeEmote === 'bow') {
    const bAmt = 0.62 * eb;
    upperRotX = THREE.MathUtils.lerp(upperRotX, bAmt, eb);
    headRotX = THREE.MathUtils.lerp(headRotX, 0.22, eb);
    rArmX = THREE.MathUtils.lerp(rArmX, -0.7, eb);
    rArmZ = THREE.MathUtils.lerp(rArmZ, -0.28, eb);
    rElbowX = THREE.MathUtils.lerp(rElbowX, -1.15, eb);
    lArmX = THREE.MathUtils.lerp(lArmX, 0.28, eb);
  } else if (eb > 0.01 && activeEmote === 'laugh') {
    const ha = Math.sin(elapsed * 14);
    rigY += Math.abs(ha) * 0.03 * eb;
    upperRotX = THREE.MathUtils.lerp(upperRotX, -0.22 + ha * 0.09, eb);
    headRotX = THREE.MathUtils.lerp(headRotX, -0.2 + ha * 0.11, eb);
    lArmX = THREE.MathUtils.lerp(lArmX, -0.55 + ha * 0.12, eb);
    rArmX = THREE.MathUtils.lerp(rArmX, -0.55 - ha * 0.12, eb);
    lElbowX = THREE.MathUtils.lerp(lElbowX, -1.1, eb);
    rElbowX = THREE.MathUtils.lerp(rElbowX, -1.1, eb);
  } else if (eb > 0.01 && activeEmote === 'spin') {
    rigY += (0.14 + Math.abs(Math.sin(elapsed * 4)) * 0.08) * eb;
    rigRotY = (elapsed * 7.2) % (Math.PI * 2);
    lArmZ = THREE.MathUtils.lerp(lArmZ, -1.35, eb);
    rArmZ = THREE.MathUtils.lerp(rArmZ, 1.35, eb);
    lLegZ = THREE.MathUtils.lerp(0, -0.12, eb);
    rLegZ = THREE.MathUtils.lerp(0, 0.12, eb);
  } else if (eb > 0.01 && activeEmote === 'sit') {
    rigY = THREE.MathUtils.lerp(rigY, -0.22, eb);
    upperRotX = THREE.MathUtils.lerp(upperRotX, -0.05 + breath * 0.02, eb);
    lLegX = THREE.MathUtils.lerp(lLegX, -1.42, eb);
    rLegX = THREE.MathUtils.lerp(rLegX, -1.42, eb);
    lLegZ = THREE.MathUtils.lerp(0, -0.14, eb);
    rLegZ = THREE.MathUtils.lerp(0, 0.14, eb);
    lKneeX = THREE.MathUtils.lerp(lKneeX, 1.48, eb);
    rKneeX = THREE.MathUtils.lerp(rKneeX, 1.48, eb);
    lArmX = THREE.MathUtils.lerp(lArmX, -0.45, eb);
    rArmX = THREE.MathUtils.lerp(rArmX, -0.45, eb);
    lArmZ = THREE.MathUtils.lerp(lArmZ, -0.16, eb);
    rArmZ = THREE.MathUtils.lerp(rArmZ, 0.16, eb);
    lElbowX = THREE.MathUtils.lerp(lElbowX, -0.58, eb);
    rElbowX = THREE.MathUtils.lerp(rElbowX, -0.58, eb);
    headRotY = THREE.MathUtils.lerp(headRotY, Math.sin(elapsed * 0.9) * 0.18, eb);
  } else if (eb > 0.01 && activeEmote === 'sleep') {
    rigRotX = THREE.MathUtils.lerp(0, -Math.PI / 2, eb);
    rigY = THREE.MathUtils.lerp(rigY, 0.2 + breath * 0.01, eb);
    lArmZ = THREE.MathUtils.lerp(lArmZ, -0.22, eb);
    rArmZ = THREE.MathUtils.lerp(rArmZ, 0.22, eb);
    headRotZ = THREE.MathUtils.lerp(headRotZ, 0.2, eb);
    forceClosedEyes = eb > 0.5;
  } else if (eb > 0.01 && activeEmote === 'float') {
    rigY = THREE.MathUtils.lerp(rigY, 0.28 + Math.sin(elapsed * 2.2) * 0.065, eb);
    upperRotX = THREE.MathUtils.lerp(upperRotX, 0.04, eb);
    lLegX = THREE.MathUtils.lerp(lLegX, -1.18, eb);
    rLegX = THREE.MathUtils.lerp(rLegX, -1.18, eb);
    lLegZ = THREE.MathUtils.lerp(0, -0.38, eb);
    rLegZ = THREE.MathUtils.lerp(0, 0.38, eb);
    lKneeX = THREE.MathUtils.lerp(lKneeX, 1.65, eb);
    rKneeX = THREE.MathUtils.lerp(rKneeX, 1.65, eb);
    lArmX = THREE.MathUtils.lerp(lArmX, -0.45, eb);
    rArmX = THREE.MathUtils.lerp(rArmX, -0.45, eb);
    lArmZ = THREE.MathUtils.lerp(lArmZ, -0.35, eb);
    rArmZ = THREE.MathUtils.lerp(rArmZ, 0.35, eb);
    lElbowX = THREE.MathUtils.lerp(lElbowX, -1.05, eb);
    rElbowX = THREE.MathUtils.lerp(rElbowX, -1.05, eb);
    headRotX = THREE.MathUtils.lerp(headRotX, 0.09, eb);
    forceClosedEyes = eb > 0.5;
  }

  if (anim.rig) {
    anim.rig.position.y = rigY;
    anim.rig.rotation.x = rigRotX;
    anim.rig.rotation.y = activeEmote === 'spin' ? rigRotY : dampAngle(anim.rig.rotation.y, 0, 12, dt);
    anim.rig.rotation.z = rigRotZ;
  }
  if (anim.upperBody) {
    anim.upperBody.rotation.x = upperRotX;
    anim.upperBody.rotation.y = upperRotY;
    anim.upperBody.rotation.z = upperRotZ;
  }
  if (anim.head) {
    anim.head.rotation.x = headRotX;
    anim.head.rotation.y = headRotY;
    anim.head.rotation.z = headRotZ;
  }
  if (anim.legs?.length >= 2) {
    anim.legs[0].rotation.x = lLegX;
    anim.legs[1].rotation.x = rLegX;
    anim.legs[0].rotation.z = lLegZ;
    anim.legs[1].rotation.z = rLegZ;
  }
  if (anim.knees?.length >= 2) {
    anim.knees[0].rotation.x = lKneeX;
    anim.knees[1].rotation.x = rKneeX;
  }
  if (anim.arms?.length >= 2) {
    anim.arms[0].rotation.x = lArmX;
    anim.arms[0].rotation.z = lArmZ;
    anim.arms[1].rotation.x = rArmX;
    anim.arms[1].rotation.z = rArmZ;
  }
  if (anim.elbows?.length >= 2) {
    anim.elbows[0].rotation.x = lElbowX;
    anim.elbows[0].rotation.z = lElbowZ;
    anim.elbows[1].rotation.x = rElbowX;
    anim.elbows[1].rotation.z = rElbowZ;
  }

  // Natural eye blink cycle (or closed for sleep/meditate)
  if (anim.eyes?.length) {
    const blinkCycle = (elapsed * 0.9 + phaseOffset * 1.7) % 3.8;
    const blink = forceClosedEyes ? 0.14 : (blinkCycle > 3.64 ? Math.max(0.12, Math.abs(Math.cos(((blinkCycle - 3.64) / 0.16) * Math.PI))) : 1);
    for (const ey of anim.eyes) ey.scale.y = 1.25 * blink;
  }

  // Secondary cloth / tail / hair sway
  if (anim.swayParts?.length) {
    for (const sp of anim.swayParts) {
      sp.mesh.rotation.x = sp.baseX + wb * 0.24 + Math.sin(elapsed * 2.8 + sp.phase) * (0.04 + wb * 0.08);
      if (sp.swayY) sp.mesh.rotation.y = Math.sin(elapsed * 3.4 + sp.phase) * (0.12 + wb * 0.14);
    }
  }

  if (anim.butterflies?.length) {
    for (const bf of anim.butterflies) {
      const a = bf.phase + elapsed * 1.8;
      bf.mesh.position.set(Math.cos(a) * 0.44, bf.baseY + Math.sin(elapsed * 4 + bf.phase) * 0.08, Math.sin(a) * 0.44);
      bf.mesh.rotation.y = -a;
    }
  }
  if (anim.aura) {
    const pulse = 1 + Math.sin(elapsed * 3.1) * 0.09;
    if (anim.aura.halo) {
      anim.aura.halo.scale.set(0.58 * pulse, 1.65 * pulse, 0.58 * pulse);
      anim.aura.halo.material.opacity = 0.075 + (Math.sin(elapsed * 3.1) + 1) * 0.025;
    }
    for (const r of anim.aura.rings) { r.mesh.rotation[r.axis] += dt * r.spd; r.mesh.scale.setScalar(pulse); }
    for (const m of anim.aura.motes) {
      const t = elapsed * m.speed + m.phase;
      m.mesh.position.set(
        Math.cos(t) * m.rad,
        0.18 + ((m.baseY + elapsed * 0.35) % 1.15),
        Math.sin(t) * m.rad,
      );
      m.mesh.rotation.y = t * 1.4;
      m.mesh.rotation.x = Math.sin(t) * 0.5;
    }
  }
  if (anim.authority) {
    anim.authority.group.position.y = 0.48 + Math.sin(elapsed * 2.2 + phaseOffset) * 0.028;
    for (const r of anim.authority.rings) r.mesh.rotation.z = elapsed * r.spd;
    for (const o of anim.authority.orbiters) {
      const a = o.phase + elapsed * o.spd;
      o.mesh.position.set(Math.cos(a) * o.rad, Math.sin(a) * o.rad, -0.04);
      o.mesh.rotation.y = elapsed * 2.5;
    }
  }
}

export function buildCharacterMesh(member = {}, forGame = false) {
  const m = member || {};
  const fallbackFem = m.g === 'f';
  const charId = m.char || (fallbackFem ? 'estrela' : 'piloto');
  const theme = CHAR_THEMES[charId] || (fallbackFem ? CHAR_THEMES.estrela : CHAR_THEMES.piloto);
  const isFem = (theme.g || m.g) === 'f';
  const suitHex = resolveSuitColor(m, theme);
  const traje = m.traje || null;

  const root = new THREE.Group();

  if (!forGame) {
    const sh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.9),
      new THREE.MeshBasicMaterial({ map: getShadowTexture(), transparent: true, depthWrite: false, opacity: 0.45 }),
    );
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.008;
    root.add(sh);
  }

  // Rig group sits on root (bounce/jump moves rig without lifting floor shadow or ground aura)
  const rig = new THREE.Group();
  root.add(rig);

  // Upper body pivoted at hip height (y = 0.44)
  const upperBody = new THREE.Group();
  upperBody.position.set(0, 0.44, 0);
  rig.add(upperBody);

  let primaryColor = suitHex;
  let secondaryColor = 0x1e293b;
  if (traje === 'coelho_estelar') { primaryColor = 0xf8fafc; secondaryColor = 0x18181b; }
  else if (traje === 'astronauta') { primaryColor = 0xe2e8f0; secondaryColor = 0x38bdf8; }
  else if (traje === 'cyber_ninja') { primaryColor = 0x0f172a; secondaryColor = 0x22d3ee; }
  else if (traje === 'dragao_rubi') { primaryColor = 0xbe123c; secondaryColor = 0xfbbf24; }
  else if (traje === 'guardiao_celestial') { primaryColor = 0xf8fafc; secondaryColor = 0xf59e0b; }
  else if (traje === 'fantasma_cosmico') { primaryColor = 0x312e81; secondaryColor = 0x38bdf8; }

  const skinMat = new THREE.MeshStandardMaterial({ color: theme.skin, roughness: 0.68, metalness: 0.04 });
  const suitMat = new THREE.MeshStandardMaterial({
    color: primaryColor,
    roughness: traje === 'guardiao_celestial' ? 0.25 : 0.52,
    metalness: (traje === 'astronauta' || traje === 'dragao_rubi' || traje === 'guardiao_celestial') ? 0.45 : 0.14,
  });
  const secMat = new THREE.MeshStandardMaterial({ color: secondaryColor, roughness: 0.48, metalness: 0.28 });
  const hairMat = new THREE.MeshStandardMaterial({ color: theme.hair, roughness: 0.72, metalness: 0.08 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: theme.eyes, emissive: theme.eyes, emissiveIntensity: 0.4, roughness: 0.2 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xb45309, emissiveIntensity: 0.3, roughness: 0.25, metalness: 0.85 });
  const accentMat = new THREE.MeshStandardMaterial({ color: theme.accent || 0x38bdf8, emissive: theme.accent || 0x38bdf8, emissiveIntensity: 0.45, roughness: 0.3, metalness: 0.4 });
  const swayParts = [];

  // Articulated 2-segment Legs (Hip -> Thigh -> Knee -> Shin + Shoe)
  const legs = [];
  const knees = [];
  const legSpread = isFem ? 0.095 : 0.11;
  for (let i = 0; i < 2; i++) {
    const sx = i === 0 ? -1 : 1;
    const hipPivot = new THREE.Group();
    hipPivot.position.set(sx * legSpread, 0.44, 0);

    const thigh = new THREE.Mesh(
      new THREE.CylinderGeometry(isFem ? 0.066 : 0.074, isFem ? 0.056 : 0.064, 0.2, 10),
      secMat,
    );
    thigh.position.y = -0.1;
    thigh.castShadow = true;
    hipPivot.add(thigh);

    const kneePivot = new THREE.Group();
    kneePivot.position.set(0, -0.2, 0);
    hipPivot.add(kneePivot);

    const shin = new THREE.Mesh(
      new THREE.CylinderGeometry(isFem ? 0.055 : 0.063, isFem ? 0.048 : 0.056, 0.19, 10),
      secMat,
    );
    shin.position.y = -0.095;
    shin.castShadow = true;
    kneePivot.add(shin);

    const shoe = new THREE.Mesh(
      new THREE.BoxGeometry(isFem ? 0.11 : 0.125, 0.085, 0.185),
      traje === 'coelho_estelar' ? suitMat : secMat,
    );
    shoe.position.set(0, -0.195, 0.032);
    shoe.castShadow = true;
    kneePivot.add(shoe);

    if (traje === 'coelho_estelar') {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 8), new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.7 }));
      puff.position.set(0, -0.165, 0.115);
      kneePivot.add(puff);
    }

    rig.add(hipPivot);
    legs.push(hipPivot);
    knees.push(kneePivot);
  }

  // Sculpted Torso (distinct Male athletic vs Female silhouette) attached inside upperBody
  if (isFem) {
    const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.135, 0.25, 12), suitMat);
    chest.position.y = 0.34;
    chest.castShadow = true;
    const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.195, 0.22, 12), suitMat);
    hips.position.y = 0.12;
    hips.castShadow = true;
    upperBody.add(chest, hips);
  } else {
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.165, 0.46, 12), suitMat);
    torso.position.y = 0.24;
    torso.castShadow = true;
    upperBody.add(torso);
  }

  // Belt & Clothing Silhouettes (when not wearing full traje override)
  if (!traje && m.outfit) {
    const trimMat = (m.outfit === 'roupa_terno' || m.outfit === 'roupa_vestido_ouro' || m.outfit === 'roupa_imperial')
      ? goldMat
      : (m.outfit === 'roupa_neon' || m.outfit === 'roupa_galactica')
        ? new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x06b6d4, emissiveIntensity: 0.85, roughness: 0.2 })
        : secMat;

    const belt = new THREE.Mesh(new THREE.CylinderGeometry(isFem ? 0.165 : 0.185, isFem ? 0.175 : 0.185, 0.055, 14), trimMat);
    belt.position.y = 0.07;
    upperBody.add(belt);

    if (m.outfit === 'roupa_rosa' || m.outfit === 'roupa_vestido_ouro') {
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.3, 0.26, 16), suitMat);
      skirt.position.y = -0.05;
      skirt.castShadow = true;
      upperBody.add(skirt);
    } else if (m.outfit === 'roupa_terno' || m.outfit === 'roupa_imperial') {
      const tie = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.22, 0.04), trimMat);
      tie.position.set(0, 0.27, 0.19);
      upperBody.add(tie);
      if (m.outfit === 'roupa_imperial') {
        const sash = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.36, 0.03), new THREE.MeshStandardMaterial({ color: 0x4c1d95, roughness: 0.65, side: THREE.DoubleSide }));
        sash.position.set(0, 0.18, -0.19);
        sash.rotation.x = 0.14;
        upperBody.add(sash);
        swayParts.push({ mesh: sash, baseX: 0.14, phase: 0.4 });
      }
    } else if (m.outfit === 'roupa_neon' || m.outfit === 'roupa_galactica' || m.outfit === 'roupa_carmesim') {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.04), trimMat);
      stripe.position.set(0, 0.32, 0.18);
      upperBody.add(stripe);
    }
  }

  // Character-specific body accents (when not overridden by full traje)
  if (!traje) {
    if (charId === 'cyber') {
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 0), accentMat);
      core.position.set(0, 0.31, 0.19);
      upperBody.add(core);
    } else if (charId === 'principe') {
      const capelet = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.34, 0.025), new THREE.MeshStandardMaterial({ color: 0x4338ca, roughness: 0.55, side: THREE.DoubleSide }));
      capelet.position.set(0, 0.23, -0.19);
      capelet.rotation.x = 0.16;
      upperBody.add(capelet);
      swayParts.push({ mesh: capelet, baseX: 0.16, phase: 0.2 });
    } else if (charId === 'eclipse_m') {
      const scarf = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.09, 12), new THREE.MeshStandardMaterial({ color: 0x4c1d95, roughness: 0.7 }));
      scarf.position.y = 0.45;
      upperBody.add(scarf);
    } else if (charId === 'samurai_m') {
      for (const sx of [-1, 1]) {
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.16), goldMat);
        plate.position.set(sx * 0.25, 0.44, 0);
        plate.rotation.z = sx * -0.24;
        upperBody.add(plate);
      }
    } else if (charId === 'lobo_m') {
      const furCollar = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.048, 8, 16), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.9 }));
      furCollar.rotation.x = Math.PI / 2;
      furCollar.position.y = 0.46;
      upperBody.add(furCollar);
    } else if (charId === 'luna_f') {
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.26, 0.18, 14), accentMat);
      skirt.position.y = -0.02;
      upperBody.add(skirt);
    } else if (charId === 'kitsune_f') {
      const tailPivot = new THREE.Group();
      tailPivot.position.set(0, 0.06, -0.16);
      const tailMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, emissive: 0xf472b6, emissiveIntensity: 0.22, roughness: 0.7 });
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.36, 10), tailMat);
      tail.position.set(0, -0.06, -0.12);
      tail.rotation.x = -1.05;
      tailPivot.add(tail);
      upperBody.add(tailPivot);
      swayParts.push({ mesh: tailPivot, baseX: 0, phase: 0.6, swayY: true });
    } else if (charId === 'imperatriz_f') {
      const mantle = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.14, 12, 1, true), goldMat);
      mantle.position.y = 0.44;
      upperBody.add(mantle);
    }
  }

  // Traje body details (all inside upperBody)
  if (traje === 'coelho_estelar') {
    const half = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.18, 0.462, 12, 1, false, 0, Math.PI), secMat);
    half.position.y = 0.24;
    upperBody.add(half);
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.065, 0), goldMat);
    star.position.set(0, 0.27, 0.195);
    upperBody.add(star);
  } else if (traje === 'astronauta') {
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 0.12), suitMat);
    pack.position.set(0, 0.28, -0.2);
    const gauge = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.04), new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.9 }));
    gauge.position.set(0, 0.3, 0.19);
    upperBody.add(pack, gauge);
  } else if (traje === 'cyber_ninja') {
    for (const sx of [-1, 1]) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.5, 0.02), new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x06b6d4, emissiveIntensity: 0.95 }));
      blade.position.set(sx * 0.06, 0.32, -0.2);
      blade.rotation.z = sx * 0.42;
      upperBody.add(blade);
    }
  } else if (traje === 'dragao_rubi') {
    for (const sx of [-1, 1]) {
      const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), goldMat);
      pauldron.position.set(sx * 0.25, 0.46, 0);
      upperBody.add(pauldron);
    }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.34, 6), suitMat);
    tail.position.set(0, -0.02, -0.24);
    tail.rotation.x = -1.1;
    upperBody.add(tail);
    swayParts.push({ mesh: tail, baseX: -1.1, phase: 0.8, swayY: true });
  } else if (traje === 'guardiao_celestial') {
    for (const sx of [-1, 1]) {
      const pauldron = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.1, 8), goldMat);
      pauldron.position.set(sx * 0.25, 0.47, 0);
      pauldron.rotation.z = sx * 0.35;
      upperBody.add(pauldron);
    }
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.065, 0), new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x06b6d4, emissiveIntensity: 1.1 }));
    core.position.set(0, 0.3, 0.195);
    const cape = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.56, 0.025), new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.5 }));
    cape.position.set(0, 0.18, -0.2);
    cape.rotation.x = 0.14;
    upperBody.add(core, cape);
    swayParts.push({ mesh: cape, baseX: 0.14, phase: 0 });
  } else if (traje === 'fantasma_cosmico') {
    const cloak = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.62, 14, 1, true), new THREE.MeshStandardMaterial({
      color: 0x4c1d95, emissive: 0x312e81, emissiveIntensity: 0.55, transparent: true, opacity: 0.85, side: THREE.DoubleSide,
    }));
    cloak.position.y = 0.14;
    upperBody.add(cloak);
  } else if (m.cargo >= 6) {
    const badge = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), goldMat);
    badge.position.set(0, 0.28, 0.19);
    upperBody.add(badge);
  }

  // Articulated 2-segment Arms (Shoulder -> UpperArm -> Elbow -> Forearm + Hand)
  const arms = [];
  const elbows = [];
  const armOffset = isFem ? 0.22 : 0.255;
  const armRadius = isFem ? 0.046 : 0.055;
  for (let i = 0; i < 2; i++) {
    const sx = i === 0 ? -1 : 1;
    const armPivot = new THREE.Group();
    armPivot.position.set(sx * armOffset, 0.43, 0);

    const armMat = traje === 'coelho_estelar' && i === 0 ? secMat : suitMat;
    const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(armRadius, 0.11, 6, 8), armMat);
    upperArm.position.y = -0.075;
    upperArm.castShadow = true;
    armPivot.add(upperArm);

    const elbowPivot = new THREE.Group();
    elbowPivot.position.set(0, -0.15, 0);
    armPivot.add(elbowPivot);

    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(armRadius * 0.9, 0.1, 6, 8), armMat);
    forearm.position.y = -0.065;
    forearm.castShadow = true;
    elbowPivot.add(forearm);

    const hand = new THREE.Mesh(
      new THREE.SphereGeometry(armRadius * 1.02, 8, 8),
      traje === 'coelho_estelar' ? new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.7 }) : skinMat,
    );
    hand.position.y = -0.14;
    elbowPivot.add(hand);

    upperBody.add(armPivot);
    arms.push(armPivot);
    elbows.push(elbowPivot);
  }

  // Shoulder bunny for coelho_estelar
  if (traje === 'coelho_estelar') {
    const bunny = new THREE.Group();
    bunny.position.set(-0.24, 0.52, 0.04);
    const bBody = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), suitMat);
    const bHead = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 8), suitMat);
    bHead.position.set(0, 0.1, 0.02);
    bunny.add(bBody, bHead);
    for (const ex of [-0.028, 0.028]) {
      const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.07, 4, 6), suitMat);
      ear.position.set(ex, 0.18, 0.01);
      bunny.add(ear);
    }
    upperBody.add(bunny);
  }

  // Head inside upperBody
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.51, 0);
  upperBody.add(headGroup);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 14), skinMat);
  head.position.y = 0.22;
  head.castShadow = true;
  headGroup.add(head);

  // Eyes (+ Feminine lashes)
  const eyes = [];
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), eyeMat);
    eye.position.set(sx * 0.075, 0.23, 0.185);
    eye.scale.set(1, 1.25, 0.6);
    headGroup.add(eye);
    eyes.push(eye);
    if (isFem) {
      const lash = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.014, 0.02), new THREE.MeshBasicMaterial({ color: 0x18181b }));
      lash.position.set(sx * 0.08, 0.268, 0.195);
      lash.rotation.z = sx * -0.18;
      headGroup.add(lash);
    }
  }

  // Hair / Helmets (distinct per traje & character!)
  if (traje === 'astronauta') {
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.255, 16, 14),
      new THREE.MeshStandardMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.45, roughness: 0.08, metalness: 0.8 }),
    );
    helmet.position.y = 0.22;
    headGroup.add(helmet);
  } else if (traje === 'coelho_estelar') {
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.225, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.65), suitMat);
    hood.position.y = 0.23;
    headGroup.add(hood);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.19, 6, 8), sx < 0 ? secMat : suitMat);
      ear.position.set(sx * 0.11, 0.5, -0.02);
      ear.rotation.z = sx * -0.18;
      headGroup.add(ear);
    }
    const mask = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.07, 0.06), secMat);
    mask.position.set(0, 0.23, 0.19);
    headGroup.add(mask);
  } else if (traje === 'cyber_ninja') {
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.224, 14, 12), secMat);
    hood.position.y = 0.22;
    headGroup.add(hood);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 0.07), new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x06b6d4, emissiveIntensity: 1.2 }));
    visor.position.set(0, 0.23, 0.19);
    headGroup.add(visor);
  } else if (traje === 'dragao_rubi') {
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.228, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.68), suitMat);
    helm.position.y = 0.23;
    headGroup.add(helm);
    for (const sx of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.2, 8), goldMat);
      horn.position.set(sx * 0.13, 0.45, -0.02);
      horn.rotation.z = sx * -0.38;
      headGroup.add(horn);
    }
  } else if (traje === 'guardiao_celestial') {
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.228, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.66), goldMat);
    helm.position.y = 0.23;
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.24), new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.9 }));
    crest.position.set(0, 0.46, -0.02);
    headGroup.add(helm, crest);
  } else if (traje === 'fantasma_noel') {
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.238, 14, 12), suitMat); hood.position.y = 0.22; headGroup.add(hood);
    const brim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.052, 8, 20), secMat); brim.position.y = 0.28; brim.rotation.x = Math.PI / 2; headGroup.add(brim);
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.31, 12), suitMat); hat.position.set(0.06, 0.48, -0.03); hat.rotation.z = -0.32; headGroup.add(hat);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), secMat); pom.position.set(0.18, 0.35, -0.02); headGroup.add(pom);
    const mask = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.19, 0.055), new THREE.MeshStandardMaterial({ color: 0xf4f2e9 })); mask.position.set(0, 0.22, 0.19); headGroup.add(mask);
    for (const sx of [-1,1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 8), new THREE.MeshBasicMaterial({ color: 0x080808 })); eye.position.set(sx*0.075,0.24,0.225); eye.scale.y=1.5; headGroup.add(eye); }
  } else if (traje === 'fantasma_cosmico') {
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.232, 14, 12), new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.7 }));
    hood.position.y = 0.22;
    headGroup.add(hood);
    for (const sx of [-1, 1]) {
      const gEye = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 8), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
      gEye.position.set(sx * 0.075, 0.23, 0.205);
      headGroup.add(gEye);
    }
  } else {
    // Character-specific 3D hairstyles & signature head traits!
    const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.222, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58), hairMat);
    hairTop.position.y = 0.24;
    hairTop.rotation.x = -0.15;
    headGroup.add(hairTop);

    if (charId === 'piloto') {
      const goggleBand = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.05, 14), secMat);
      goggleBand.position.y = 0.35;
      headGroup.add(goggleBand);
      for (const sx of [-0.07, 0.07]) {
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 10), accentMat);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(sx, 0.36, 0.2);
        headGroup.add(lens);
      }
    } else if (charId === 'explorador_m') {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.228, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), accentMat);
      cap.position.y = 0.25;
      const brimBack = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.03, 12, 1, false, Math.PI * 0.65, Math.PI * 0.7), secMat);
      brimBack.position.set(0, 0.32, -0.16);
      headGroup.add(cap, brimBack);
    } else if (charId === 'cyber') {
      for (let i = -2; i <= 2; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.16, 6), hairMat);
        spike.position.set(i * 0.055, 0.44 - Math.abs(i) * 0.02, 0.03);
        spike.rotation.z = -i * 0.22;
        spike.rotation.x = 0.2;
        headGroup.add(spike);
      }
      const monocle = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.055, 0.04), accentMat);
      monocle.position.set(0.075, 0.23, 0.21);
      headGroup.add(monocle);
    } else if (charId === 'principe') {
      const circlet = new THREE.Mesh(new THREE.TorusGeometry(0.218, 0.018, 8, 20), goldMat);
      circlet.rotation.x = Math.PI / 2;
      circlet.position.y = 0.36;
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.038, 0), new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.9 }));
      gem.position.set(0, 0.37, 0.22);
      headGroup.add(circlet, gem);
    } else if (charId === 'eclipse_m') {
      for (let i = 0; i < 5; i++) {
        const a = (i - 2) * 0.35;
        const lock = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.17, 6), i % 2 === 0 ? hairMat : accentMat);
        lock.position.set(Math.sin(a) * 0.13, 0.43, -0.02);
        lock.rotation.z = -a * 0.7;
        headGroup.add(lock);
      }
    } else if (charId === 'samurai_m') {
      const bun = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.14, 10), hairMat);
      bun.position.set(0, 0.46, -0.07);
      bun.rotation.x = -0.35;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.224, 0.224, 0.045, 16), new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5 }));
      band.position.y = 0.34;
      headGroup.add(bun, band);
    } else if (charId === 'lobo_m') {
      for (const sx of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.15, 5), hairMat);
        ear.position.set(sx * 0.13, 0.44, 0.01);
        ear.rotation.z = sx * -0.26;
        headGroup.add(ear);
      }
    } else if (charId === 'estrela') {
      const hairBack = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.34, 10), hairMat);
      hairBack.position.set(0, 0.11, -0.08);
      const tiara = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.016, 6, 18, Math.PI), goldMat);
      tiara.position.set(0, 0.37, 0.04);
      const starGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.04, 0), goldMat);
      starGem.position.set(0, 0.46, 0.12);
      headGroup.add(hairBack, tiara, starGem);
      swayParts.push({ mesh: hairBack, baseX: 0, phase: 0.3 });
    } else if (charId === 'luna_f') {
      for (const sx of [-1, 1]) {
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.34, 8), hairMat);
        tail.position.set(sx * 0.23, 0.18, -0.05);
        tail.rotation.z = sx * 0.32;
        const bow = new THREE.Mesh(new THREE.OctahedronGeometry(0.04, 0), accentMat);
        bow.position.set(sx * 0.2, 0.34, -0.02);
        headGroup.add(tail, bow);
      }
    } else if (charId === 'valquiria') {
      for (const sx of [-1, 1]) {
        const bun = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), hairMat);
        bun.position.set(sx * 0.17, 0.43, -0.02);
        const wingPin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.045, 0.02), accentMat);
        wingPin.position.set(sx * 0.22, 0.39, 0.05);
        wingPin.rotation.z = sx * 0.45;
        headGroup.add(bun, wingPin);
      }
    } else if (charId === 'aurora') {
      const longHair = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.25, 0.46, 12), hairMat);
      longHair.position.set(0, 0.06, -0.09);
      const pin = new THREE.Mesh(new THREE.OctahedronGeometry(0.04, 0), accentMat);
      pin.position.set(-0.14, 0.35, 0.13);
      headGroup.add(longHair, pin);
      swayParts.push({ mesh: longHair, baseX: 0, phase: 0.5 });
    } else if (charId === 'dama_eclipse') {
      const bob = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.225, 0.24, 12), hairMat);
      bob.position.set(0, 0.16, -0.05);
      const streak = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.04), accentMat);
      streak.position.set(0.17, 0.18, 0.12);
      headGroup.add(bob, streak);
    } else if (charId === 'kitsune_f') {
      const hairBack = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.23, 0.38, 10), hairMat);
      hairBack.position.set(0, 0.09, -0.09);
      headGroup.add(hairBack);
      for (const sx of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.062, 0.16, 6), hairMat);
        ear.position.set(sx * 0.13, 0.45, 0.01);
        ear.rotation.z = sx * -0.24;
        const inner = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.11, 5), accentMat);
        inner.position.set(sx * 0.13, 0.44, 0.035);
        inner.rotation.z = sx * -0.24;
        headGroup.add(ear, inner);
      }
      swayParts.push({ mesh: hairBack, baseX: 0, phase: 0.4 });
    } else if (charId === 'imperatriz_f') {
      const pony = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.4, 10), hairMat);
      pony.position.set(0, 0.26, -0.22);
      pony.rotation.x = 0.42;
      const diadem = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.15, 0.06, 8), goldMat);
      diadem.position.set(0, 0.43, 0.04);
      headGroup.add(pony, diadem);
      swayParts.push({ mesh: pony, baseX: 0.42, phase: 0.25 });
    } else if (isFem) {
      const hairBack = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.34, 10), hairMat);
      hairBack.position.set(0, 0.11, -0.08);
      headGroup.add(hairBack);
    }
  }

  // Accessories (head accessories in headGroup, torso/back accessories in upperBody!)
  const acc = m.acc || null;
  const butterflies = [];
  if (acc === 'oculos_cyber') {
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.065, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x06b6d4, emissiveIntensity: 0.9, roughness: 0.15 }),
    );
    visor.position.set(0, 0.23, 0.2);
    headGroup.add(visor);
  } else if (acc === 'fones_pulsar') {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.022, 8, 18, Math.PI), secMat);
    band.position.y = 0.24;
    headGroup.add(band);
    for (const sx of [-1, 1]) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.05, 10), new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x06b6d4, emissiveIntensity: 0.8 }));
      cup.rotation.z = Math.PI / 2;
      cup.position.set(sx * 0.23, 0.22, 0);
      headGroup.add(cup);
    }
  } else if (acc === 'cartola_estelar') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.03, 16), secMat);
    brim.position.y = 0.42;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.22, 16), secMat);
    top.position.y = 0.54;
    const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(0.168, 0.168, 0.045, 16), goldMat);
    ribbon.position.y = 0.46;
    headGroup.add(brim, top, ribbon);
  } else if (acc === 'orelhas_gatinho') {
    const catMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0xdb2777, emissiveIntensity: 0.5 });
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.13, 6), catMat);
      ear.position.set(sx * 0.12, 0.45, 0.02);
      ear.rotation.z = sx * -0.22;
      headGroup.add(ear);
    }
  } else if (acc === 'coroa_real') {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.075, 12), goldMat);
    base.position.y = 0.45;
    headGroup.add(base);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.08, 4), goldMat);
      tip.position.set(Math.cos(a) * 0.145, 0.51, Math.sin(a) * 0.145);
      headGroup.add(tip);
    }
  } else if (acc === 'mascara_oni') {
    const oniMat = new THREE.MeshStandardMaterial({ color: 0xbe123c, emissive: 0x9f1239, emissiveIntensity: 0.5, roughness: 0.35 });
    const mask = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.11, 0.06), oniMat);
    mask.position.set(0, 0.17, 0.2);
    headGroup.add(mask);
    for (const sx of [-1, 1]) {
      const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.07, 6), goldMat);
      tusk.position.set(sx * 0.085, 0.19, 0.23);
      headGroup.add(tusk);
    }
  } else if (acc === 'capa_heroi') {
    const capeMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.6, side: THREE.DoubleSide });
    const cape = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.64, 0.025), capeMat);
    cape.position.set(0, 0.16, -0.2);
    cape.rotation.x = 0.16;
    upperBody.add(cape);
    swayParts.push({ mesh: cape, baseX: 0.16, phase: 0.1 });
  } else if (acc === 'mochila_foguete') {
    for (const sx of [-0.09, 0.09]) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.34, 10), secMat);
      tank.position.set(sx, 0.28, -0.21);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.15, 8), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
      flame.rotation.x = Math.PI;
      flame.position.set(sx, 0.05, -0.21);
      upperBody.add(tank, flame);
    }
  } else if (acc === 'asas_luz') {
    const wingMat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, emissive: 0x38bdf8, emissiveIntensity: 0.65, transparent: true, opacity: 0.78, side: THREE.DoubleSide });
    for (const sx of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.32, 0.02), wingMat);
      wing.position.set(sx * 0.34, 0.36, -0.18);
      wing.rotation.y = sx * -0.38;
      wing.rotation.z = sx * 0.25;
      upperBody.add(wing);
    }
  } else if (acc === 'aura_borboletas') {
    const bMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI * 2) / 4;
      const bf = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.07), bMat);
      const baseY = 0.82 + (i % 3) * 0.16;
      bf.position.set(Math.cos(a) * 0.44, baseY, Math.sin(a) * 0.44);
      root.add(bf);
      butterflies.push({ mesh: bf, phase: a, baseY });
    }
  }

  // VIP Crown
  if (m.vip && acc !== 'coroa_real') {
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.12, 5), goldMat);
    crown.position.set(0, 0.49, 0);
    headGroup.add(crown);
  }

  // Aura Skin (stays grounded on root)
  const aura = m.aura ? buildAuraGroup(m.aura) : null;
  if (aura) root.add(aura.group);

  // Authority System Behind the Character (follows upperBody lean & height smoothly)
  const authority = !forGame ? buildAuthorityBackGroup(m) : null;
  if (authority) {
    authority.group.position.set(0, 0.48, -0.28);
    upperBody.add(authority.group);
  }

  // Pet companion: render a small floating emoji companion beside the avatar.
  if (m.pet) {
    try {
      const petCanvas = document.createElement('canvas'); petCanvas.width = 128; petCanvas.height = 128;
      const ctx = petCanvas.getContext('2d');
      ctx.font = '100px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(m.pet).slice(0, 2), 64, 68);
      const petTex = new THREE.CanvasTexture(petCanvas);
      const petSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: petTex, transparent: true, depthWrite: false }));
      petSprite.scale.set(0.52, 0.52, 1); petSprite.position.set(0.55, 0.72, 0.15);
      root.add(petSprite); root.userData.petSprite = petSprite;
    } catch (e) { console.debug('Pet visual fallback', e); }
  }

  root.userData.anim = {
    arms,
    elbows,
    legs,
    knees,
    head: headGroup,
    eyes,
    upperBody,
    rig,
    root,
    swayParts,
    butterflies,
    aura,
    authority,
    state: { walkBlend: 0, walkPhase: 0, emoteBlend: 0 },
  };
  return root;
}

const PLANET_THEMES = {
  chat: { bg: 0x090b24, floor: 0x1e293b, rim: 0x3b82f6, glow: 0x60a5fa },
  prison: { bg: 0x0f111a, floor: 0x27272a, rim: 0x64748b, glow: 0x94a3b8 },
  vip: { bg: 0x1a0e24, floor: 0x311042, rim: 0xfbbf24, glow: 0xfde047 },
  bowling: { bg: 0x1a1008, floor: 0x3b1f0e, rim: 0xf97316, glow: 0xfb923c },
  cannon: { bg: 0x1b0b0b, floor: 0x3f1d1d, rim: 0xef4444, glow: 0xf87171 },
  zombie: { bg: 0x08170e, floor: 0x143320, rim: 0x22c55e, glow: 0x4ade80 },
  fishing: { bg: 0x061529, floor: 0x0c3454, rim: 0x0ea5e9, glow: 0x38bdf8 },
};

export function mountPreview(container, initialMember) {
  const width = container.clientWidth || 320;
  const height = container.clientHeight || 185;
  const { renderer, envTex } = createRendererAndEnv(width, height);

  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.environment = envTex;
  scene.background = new THREE.Color(0x0b0b24);

  const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 40);
  camera.position.set(0, 1.38, 2.95);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !isSoftwareGl;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.target.set(0, 0.82, 0);
  controls.update();

  scene.add(new THREE.HemisphereLight(0xc4b5fd, 0x0f172a, 0.95));
  const key = new THREE.DirectionalLight(0xffffff, 1.9);
  key.position.set(2.5, 4, 3);
  scene.add(key);

  const ped = new THREE.Mesh(
    new THREE.CylinderGeometry(0.68, 0.78, 0.12, 28),
    new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.35, metalness: 0.55 }),
  );
  ped.position.y = -0.06;
  scene.add(ped);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.65, 0.7, 32),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.005;
  scene.add(ring);

  let animMode = 'idle';
  const animBar = document.createElement('div');
  animBar.className = 'pv-animbar';
  const poses = [
    ['idle', '😌', 'Normal'],
    ['walk', '🚶', 'Andar'],
    ['wave', '👋', 'Acenar'],
    ['clap', '👏', 'Aplaudir'],
    ['dance', '💃', 'Dançar'],
    ['sit', '🪑', 'Sentar'],
    ['float', '🧘', 'Meditar'],
    ['sleep', '😴', 'Deitar'],
    ['bow', '🙇', 'Reverência'],
    ['spin', '🌀', 'Girar'],
    ['cheer', '🎉', 'Comemorar'],
  ];
  animBar.innerHTML = poses.map(([id, ic, lbl]) => `<button type="button" class="pv-pose${id === 'idle' ? ' on' : ''}" data-pose="${id}" title="${lbl}">${ic}</button>`).join('');
  const stopEvt = (ev) => ev.stopPropagation();
  animBar.addEventListener('pointerdown', stopEvt);
  animBar.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const btn = ev.target.closest('[data-pose]');
    if (!btn) return;
    animMode = btn.dataset.pose || 'idle';
    animBar.querySelectorAll('.pv-pose').forEach((b) => b.classList.toggle('on', b === btn));
  });
  container.appendChild(animBar);

  let mesh = null;
  function applyMember(member) {
    if (mesh) {
      scene.remove(mesh);
      disposeObjectTree(mesh);
    }
    mesh = buildCharacterMesh(member, false);
    scene.add(mesh);
  }
  applyMember(initialMember || { name: 'Você', g: 'm', cargo: 0 });

  const ro = new ResizeObserver(() => {
    const w = container.clientWidth || 320;
    const h = container.clientHeight || 185;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  });
  ro.observe(container);

  const stopLoop = setupLoop(renderer, (dt, elapsed) => {
    controls.update();
    if (mesh) {
      mesh.rotation.y += dt * 0.55;
      animateCharacter(mesh.userData.anim, dt, elapsed, animMode === 'walk', 0, animMode === 'walk' ? 'idle' : animMode);
    }
    renderer.render(scene, camera);
  });

  return {
    update(member) {
      applyMember(member);
    },
    setAnim(mode) {
      animMode = mode || 'idle';
      animBar.querySelectorAll('.pv-pose').forEach((b) => b.classList.toggle('on', b.dataset.pose === animMode));
    },
    dispose() {
      stopLoop();
      ro.disconnect();
      controls.dispose();
      if (mesh) disposeObjectTree(mesh);
      disposeObjectTree(ped);
      ring.geometry.dispose();
      ring.material.dispose();
      disposeRenderer(renderer, envTex);
      container.innerHTML = '';
    },
  };
}

export function mountStage(container, { planetType = 'chat', members = [], myName = '', myCargo = 0, onSelectMember, onMove }) {
  const width = container.clientWidth || 480;
  const height = container.clientHeight || 235;
  const { renderer, envTex } = createRendererAndEnv(width, height);

  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  const ov = document.createElement('div');
  ov.className = 'stage3d-ov';
  container.appendChild(ov);

  const hint = document.createElement('div');
  hint.className = 'stage-hint';
  hint.textContent = '🕹️ Mova • Toque no avatar';
  container.appendChild(hint);

  // Virtual joystick
  const joy = document.createElement('div');
  joy.className = 'stage-joy';
  const knob = document.createElement('div');
  knob.className = 'stage-joy-knob';
  joy.appendChild(knob);
  container.appendChild(joy);

  const scene = new THREE.Scene();
  scene.environment = envTex;

  const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 80);
  camera.position.set(0, 4.4, 6.2);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !isSoftwareGl;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 3.2;
  controls.maxDistance = 10.5;
  controls.minPolarAngle = 0.28;
  controls.maxPolarAngle = Math.PI / 2 - 0.12;
  controls.target.set(0, 0.7, 0);
  controls.update();

  spatialAudio.attachToCamera(camera);
  const ambience = spatialAudio.createStageAmbience(scene, planetType);

  scene.add(new THREE.HemisphereLight(0xe0e7ff, 0x0f172a, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.85);
  key.position.set(4, 8, 5);
  key.castShadow = !isSoftwareGl;
  scene.add(key);

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.75, metalness: 0.18 });
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 4.2, 0.24, 36), floorMat);
  floor.position.y = -0.12;
  floor.receiveShadow = true;
  scene.add(floor);

  const rimMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, side: THREE.DoubleSide });
  const rim = new THREE.Mesh(new THREE.RingGeometry(3.85, 4.02, 40), rimMat);
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.01;
  scene.add(rim);

  function applyPlanetTheme(t) {
    const th = PLANET_THEMES[t] || PLANET_THEMES.chat;
    scene.background = new THREE.Color(th.bg);
    floorMat.color.setHex(th.floor);
    rimMat.color.setHex(th.rim);
  }
  applyPlanetTheme(planetType);

  let curMyName = myName;
  let curMyCargo = myCargo;
  let typingSet = new Set();
  const chatBubbles = new Map(); // name -> { text, until }
  const avatars = new Map(); // name -> { member, mesh, x, z, ry, tx, tz, try, sig, lbl, bubEl, typEl }

  function memberSig(m) {
    return [m.g, m.char, m.cargo, m.stars, m.showAuth !== false, m.vip, m.outfit, m.traje, m.acc, m.aura, m.pet].join('|');
  }

  function defaultSlot(index, total) {
    const ang = (index / Math.max(1, total)) * Math.PI * 2;
    const rad = total <= 1 ? 0 : 1.75;
    return { x: Math.cos(ang) * rad, z: Math.sin(ang) * rad, ry: -ang + Math.PI / 2 };
  }

  function updateLabelContent(ent) {
    const m = ent.member;
    const canAct = (curMyCargo >= 2 && (m.cargo || 0) < curMyCargo) || m.name !== curMyName;
    ent.lbl.className = 'av3d-lbl' + (canAct ? ' can' : '') + ((m.cargo || 0) >= 6 ? ' owner' : '');
    const rankColor = CARGO_COLORS[m.cargo || 0] || '#94a3b8';
    const rankName = CARGO_NAMES[m.cargo || 0] || 'Viajante';
    const nmColor = m.nameColor || rankColor;
    const bub = chatBubbles.get(m.name);
    const showBub = bub && bub.until > Date.now();
    const isTyp = typingSet.has(m.name);

    ent.lbl.innerHTML =
      (showBub ? `<div class="av3d-bub"></div>` : isTyp ? `<div class="av3d-typ"><i></i><i></i><i></i></div>` : '') +
      `<span class="av3d-rank" style="color:${rankColor}">${rankName}</span>` +
      `<span class="av3d-nm" style="color:${nmColor}">${m.vip ? '👑' : ''}${m.jail ? '🔒' : ''}${m.name}</span>`;
    if (showBub) {
      const bEl = ent.lbl.querySelector('.av3d-bub');
      if (bEl) bEl.textContent = bub.text;
    }
  }

  function syncMembers(list, selfName, selfCargo) {
    if (selfName !== undefined) curMyName = selfName;
    if (selfCargo !== undefined) curMyCargo = selfCargo;
    const seen = new Set();
    const arr = Array.isArray(list) ? list : [];

    arr.forEach((m, idx) => {
      if (!m?.name) return;
      seen.add(m.name);
      const sig = memberSig(m);
      let ent = avatars.get(m.name);
      const slot = m.pos || defaultSlot(idx, arr.length);

      if (!ent) {
        const mesh = buildCharacterMesh(m, false);
        mesh.position.set(slot.x || 0, 0, slot.z || 0);
        mesh.rotation.y = slot.ry || 0;
        mesh.userData.memberName = m.name;
        scene.add(mesh);

        const lbl = document.createElement('div');
        lbl.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (onSelectMember) onSelectMember(ent.member);
        });
        ov.appendChild(lbl);

        ent = {
          member: m,
          mesh,
          x: slot.x || 0,
          z: slot.z || 0,
          ry: slot.ry || 0,
          tx: slot.x || 0,
          tz: slot.z || 0,
          try: slot.ry || 0,
          emote: m.action?.emote || 'idle',
          emotePersistent: !!m.action?.persistent,
          emoteUntil: m.action?.until || 0,
          sig,
          lbl,
        };
        avatars.set(m.name, ent);
      } else {
        ent.member = m;
        if (m.action?.emote && m.name !== curMyName) {
          ent.emote = m.action.emote;
          ent.emotePersistent = !!m.action.persistent;
          ent.emoteUntil = m.action.until || 0;
        }
        if (ent.sig !== sig) {
          scene.remove(ent.mesh);
          disposeObjectTree(ent.mesh);
          ent.mesh = buildCharacterMesh(m, false);
          ent.mesh.position.set(ent.x, 0, ent.z);
          ent.mesh.rotation.y = ent.ry;
          ent.mesh.userData.memberName = m.name;
          scene.add(ent.mesh);
          ent.sig = sig;
        }
        if (m.pos && m.name !== curMyName) {
          ent.tx = m.pos.x;
          ent.tz = m.pos.z;
          ent.try = m.pos.ry || 0;
        }
      }
      updateLabelContent(ent);
    });

    for (const [name, ent] of avatars) {
      if (!seen.has(name)) {
        scene.remove(ent.mesh);
        disposeObjectTree(ent.mesh);
        ent.lbl.remove();
        avatars.delete(name);
      }
    }
  }
  syncMembers(members, myName, myCargo);

  // Joystick + keyboard movement for self
  let joyX = 0;
  let joyY = 0;
  let joyPid = null;
  const keys = new Set();
  let lastMoveSent = 0;

  function updateJoyFromPointer(ev) {
    const rect = joy.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = ev.clientX - cx;
    const dy = ev.clientY - cy;
    const maxR = rect.width * 0.36;
    const dist = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(maxR, dist);
    const nx = (dx / dist) * (clamped / maxR);
    const ny = (dy / dist) * (clamped / maxR);
    joyX = nx;
    joyY = ny;
    knob.style.transform = `translate(${nx * maxR}px, ${ny * maxR}px)`;
  }

  const onJoyDown = (ev) => {
    ev.stopPropagation();
    joyPid = ev.pointerId;
    joy.classList.add('on');
    joy.setPointerCapture?.(ev.pointerId);
    updateJoyFromPointer(ev);
  };
  const onJoyMove = (ev) => {
    if (joyPid !== ev.pointerId) return;
    updateJoyFromPointer(ev);
  };
  const onJoyUp = (ev) => {
    if (joyPid !== ev.pointerId) return;
    joyPid = null;
    joyX = 0;
    joyY = 0;
    joy.classList.remove('on');
    knob.style.transform = '';
  };
  joy.addEventListener('pointerdown', onJoyDown);
  joy.addEventListener('pointermove', onJoyMove);
  joy.addEventListener('pointerup', onJoyUp);
  joy.addEventListener('pointercancel', onJoyUp);

  const onKeyDown = (e) => {
    if (document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      keys.add(e.code);
    }
  };
  const onKeyUp = (e) => keys.delete(e.code);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  // Tap on 3D canvas to select member or walk to floor point
  const raycaster = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  let downPos = null;
  const onCanvasDown = (ev) => {
    downPos = { x: ev.clientX, y: ev.clientY };
  };
  const onCanvasUp = (ev) => {
    if (!downPos) return;
    const moved = Math.hypot(ev.clientX - downPos.x, ev.clientY - downPos.y);
    downPos = null;
    if (moved > 8) return;

    const rect = renderer.domElement.getBoundingClientRect();
    ptr.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    ptr.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ptr, camera);

    const meshes = [...avatars.values()].map((a) => a.mesh);
    const hits = raycaster.intersectObjects(meshes, true);
    if (hits.length) {
      let obj = hits[0].object;
      while (obj && !obj.userData.memberName) obj = obj.parent;
      const ent = obj ? avatars.get(obj.userData.memberName) : null;
      if (ent && onSelectMember) {
        onSelectMember(ent.member);
        return;
      }
    }

    const floorHit = raycaster.intersectObject(floor, false);
    if (floorHit.length) {
      const pt = floorHit[0].point;
      const r = Math.hypot(pt.x, pt.z);
      const tx = r > 3.45 ? (pt.x / r) * 3.45 : pt.x;
      const tz = r > 3.45 ? (pt.z / r) * 3.45 : pt.z;
      const meEnt = avatars.get(curMyName);
      if (meEnt) {
        meEnt.tx = tx;
        meEnt.tz = tz;
        meEnt.try = Math.atan2(tx - meEnt.x, tz - meEnt.z);
        if (onMove) onMove(tx, tz, meEnt.try);
      }
    }
  };
  renderer.domElement.addEventListener('pointerdown', onCanvasDown);
  renderer.domElement.addEventListener('pointerup', onCanvasUp);

  const ro = new ResizeObserver(() => {
    const w = container.clientWidth || 480;
    const h = container.clientHeight || 235;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  });
  ro.observe(container);

  const proj = new THREE.Vector3();
  const stopLoop = setupLoop(renderer, (dt, elapsed) => {
    controls.update();
    ambience.update(elapsed);

    // Expire chat bubbles
    const now = Date.now();
    for (const [name, b] of chatBubbles) {
      if (b.until <= now) {
        chatBubbles.delete(name);
        const ent = avatars.get(name);
        if (ent) updateLabelContent(ent);
      }
    }

    // Joystick & keyboard drive self avatar
    let ix = joyX;
    let iz = joyY;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) iz -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) iz += 1;
    if (Math.hypot(ix, iz) > 0.12) {
      const meEnt = avatars.get(curMyName);
      if (meEnt) {
        const len = Math.hypot(ix, iz);
        const speed = 2.6;
        let nx = meEnt.x + (ix / len) * speed * dt;
        let nz = meEnt.z + (iz / len) * speed * dt;
        const r = Math.hypot(nx, nz);
        if (r > 3.45) { nx = (nx / r) * 3.45; nz = (nz / r) * 3.45; }
        const nry = Math.atan2(ix, iz);
        meEnt.tx = nx;
        meEnt.tz = nz;
        meEnt.try = nry;
        if (onMove && now - lastMoveSent > 90) {
          lastMoveSent = now;
          onMove(nx, nz, nry);
        }
      }
    }

    const w = container.clientWidth || 480;
    const h = container.clientHeight || 235;

    for (const ent of avatars.values()) {
      const dx = ent.tx - ent.x;
      const dz = ent.tz - ent.z;
      const dist = Math.hypot(dx, dz);
      const moving = dist > 0.035;
      if (moving) {
        const step = Math.min(dist, 3.2 * dt);
        ent.x += (dx / dist) * step;
        ent.z += (dz / dist) * step;
        if (ent.emotePersistent) {
          ent.emotePersistent = false;
          ent.emote = 'idle';
          ent.emoteUntil = 0;
        }
      }
      ent.ry = dampAngle(ent.ry, ent.try, 13, dt);
      ent.mesh.position.set(ent.x, 0, ent.z);
      ent.mesh.rotation.y = ent.ry;

      const activeEmote = (!moving && (ent.emotePersistent || ent.emoteUntil > now)) ? ent.emote : 'idle';
      const anim = ent.mesh.userData.anim;
      if (anim) animateCharacter(anim, dt, elapsed, moving, ent.x * 1.3 + ent.z * 0.7, activeEmote);

      // Project label
      proj.set(ent.x, 1.56, ent.z).project(camera);
      if (proj.z > 1) {
        ent.lbl.style.display = 'none';
      } else {
        ent.lbl.style.display = 'flex';
        const sx = (proj.x * 0.5 + 0.5) * w;
        const sy = (-proj.y * 0.5 + 0.5) * h;
        ent.lbl.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -100%)`;
      }
    }

    renderer.render(scene, camera);
  });

  return {
    setPlanet(t) {
      applyPlanetTheme(t);
      ambience.setPlanet(t);
    },
    setMembers(list, selfName, selfCargo) {
      syncMembers(list, selfName, selfCargo);
    },
    setMemberPos(name, x, z, ry) {
      const ent = avatars.get(name);
      if (!ent || name === curMyName) return;
      ent.tx = x;
      ent.tz = z;
      if (Number.isFinite(ry)) ent.try = ry;
    },
    setTyping(names) {
      typingSet = new Set(Array.isArray(names) ? names : []);
      for (const ent of avatars.values()) updateLabelContent(ent);
    },
    triggerChat(name, text) {
      if (!name || !text) return;
      chatBubbles.set(name, { text: String(text).slice(0, 48), until: Date.now() + 4500 });
      const ent = avatars.get(name);
      if (ent) {
        updateLabelContent(ent);
        if (!ent.emotePersistent && (!ent.emoteUntil || ent.emoteUntil < Date.now())) {
          ent.emote = 'wave';
          ent.emoteUntil = Date.now() + 1400;
        }
      }
    },
    triggerEmote(name, emote = 'wave', persistent = false) {
      const ent = avatars.get(name);
      if (!ent) return;
      if (!emote || emote === 'idle') {
        ent.emote = 'idle';
        ent.emotePersistent = false;
        ent.emoteUntil = 0;
        return;
      }
      ent.emote = emote;
      ent.emotePersistent = !!persistent;
      ent.emoteUntil = persistent ? 0 : (Date.now() + 2800);
    },
    dispose() {
      stopLoop();
      ambience.dispose();
      spatialAudio.detachFromCamera(camera);
      ro.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      joy.removeEventListener('pointerdown', onJoyDown);
      joy.removeEventListener('pointermove', onJoyMove);
      joy.removeEventListener('pointerup', onJoyUp);
      joy.removeEventListener('pointercancel', onJoyUp);
      renderer.domElement.removeEventListener('pointerdown', onCanvasDown);
      renderer.domElement.removeEventListener('pointerup', onCanvasUp);
      controls.dispose();
      for (const ent of avatars.values()) {
        disposeObjectTree(ent.mesh);
        ent.lbl.remove();
      }
      avatars.clear();
      disposeObjectTree(floor);
      rim.geometry.dispose();
      rimMat.dispose();
      disposeRenderer(renderer, envTex);
      container.innerHTML = '';
    },
  };
}

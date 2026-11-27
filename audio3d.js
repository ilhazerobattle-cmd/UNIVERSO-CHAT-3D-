import * as THREE from 'three';

const STORAGE_KEY = 'uc_muted';

const PLANET_PROFILES = {
  chat:    { freqs: [130.81, 196.0, 293.66], modHz: 0.25, noise: 0.035, shimmer: 587.33, vol: 0.26 },
  vip:     { freqs: [155.56, 233.08, 349.23, 392.0], modHz: 0.5, noise: 0.025, shimmer: 783.99, vol: 0.24 },
  prison:  { freqs: [65.41, 98.0, 116.54], modHz: 0.25, noise: 0.06, shimmer: 233.08, vol: 0.28 },
  bowling: { freqs: [174.61, 261.63, 329.63], modHz: 0.75, noise: 0.02, shimmer: 659.25, vol: 0.22 },
  cannon:  { freqs: [110.0, 164.81, 220.0], modHz: 0.5, noise: 0.085, shimmer: 440.0, vol: 0.25 },
  zombie:  { freqs: [73.42, 110.0, 116.54], modHz: 0.5, noise: 0.05, shimmer: 293.66, vol: 0.25 },
  fishing: { freqs: [164.81, 246.94, 329.63], modHz: 0.25, noise: 0.11, shimmer: 659.25, vol: 0.26 },
};

const NAV_RATES = [1.0, 1.122, 1.26, 1.335, 1.498, 1.682];

class SpatialAudioEngine {
  constructor() {
    this.listener = null;
    this.muted = false;
    try {
      this.muted = localStorage.getItem(STORAGE_KEY) === '1';
    } catch {}
    this._planetBuffers = new Map();
    this._shimmerBuffers = new Map();
    this._uiBuffers = new Map();
    this._activeAmbiences = new Set();
    this._muteListeners = new Set();
    this._gestureHooked = false;
    this._hookUnlockGesture();
  }

  _hookUnlockGesture() {
    if (this._gestureHooked || typeof window === 'undefined') return;
    this._gestureHooked = true;
    const unlock = () => {
      const l = this._ensureListener();
      if (!l) return;
      if (l.context && l.context.state === 'suspended') {
        l.context.resume().then(() => this._resumeAmbiences()).catch(() => {});
      } else {
        this._resumeAmbiences();
      }
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
  }

  _ensureListener() {
    if (this.listener) return this.listener;
    try {
      this.listener = new THREE.AudioListener();
      this.listener.setMasterVolume(this.muted ? 0 : 1);
      return this.listener;
    } catch (e) {
      console.warn('SpatialAudio unavailable:', e);
      return null;
    }
  }

  _resumeAmbiences() {
    for (const amb of this._activeAmbiences) {
      amb._ensurePlaying();
    }
  }

  isMuted() {
    return this.muted;
  }

  setMuted(next) {
    this.muted = !!next;
    try {
      localStorage.setItem(STORAGE_KEY, this.muted ? '1' : '0');
    } catch {}
    if (this.listener) {
      this.listener.setMasterVolume(this.muted ? 0 : 1);
    }
    for (const cb of this._muteListeners) {
      try { cb(this.muted); } catch {}
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    if (!this.muted) this.playUi('click');
    return this.muted;
  }

  onMuteChange(cb) {
    this._muteListeners.add(cb);
    return () => this._muteListeners.delete(cb);
  }

  attachToCamera(camera) {
    const l = this._ensureListener();
    if (l && camera && l.parent !== camera) {
      camera.add(l);
    }
    return l;
  }

  detachFromCamera(camera) {
    if (this.listener && camera && this.listener.parent === camera) {
      camera.remove(this.listener);
    }
  }

  _getPlanetBuffers(type) {
    const key = PLANET_PROFILES[type] ? type : 'chat';
    if (this._planetBuffers.has(key)) {
      return { core: this._planetBuffers.get(key), shimmer: this._shimmerBuffers.get(key) };
    }
    const l = this._ensureListener();
    if (!l || !l.context) return null;

    const ctx = l.context;
    const sr = ctx.sampleRate || 44100;
    const dur = 4.0;
    const len = Math.floor(sr * dur);
    const prof = PLANET_PROFILES[key];

    // Core harmonic ambient loop (integer cycles over `dur` for seamless wrap)
    const coreBuf = ctx.createBuffer(1, len, sr);
    const coreData = coreBuf.getChannelData(0);
    const quantFreqs = prof.freqs.map((f) => Math.max(1, Math.round(f * dur)) / dur);

    // Pre-generate smooth loopable filtered noise via crossfade
    const rawNoise = new Float32Array(len);
    let lp = 0;
    const alpha = key === 'fishing' ? 0.035 : key === 'cannon' ? 0.05 : 0.025;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      lp += alpha * (white - lp);
      rawNoise[i] = lp;
    }
    const xfade = Math.floor(sr * 0.4);
    for (let i = 0; i < xfade; i++) {
      const w = 0.5 - 0.5 * Math.cos((Math.PI * i) / xfade);
      const tailIdx = len - xfade + i;
      rawNoise[i] = rawNoise[tailIdx] * (1 - w) + rawNoise[i] * w;
    }

    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const lfo = 0.72 + 0.28 * Math.sin(2 * Math.PI * prof.modHz * t);
      const surfLfo = key === 'fishing' ? (0.55 + 0.45 * Math.sin(2 * Math.PI * 0.25 * t)) : 1.0;
      let s = 0;
      for (let j = 0; j < quantFreqs.length; j++) {
        const harmonic = Math.sin(2 * Math.PI * quantFreqs[j] * t + j * 0.8);
        s += harmonic * (0.36 / quantFreqs.length);
      }
      s = s * lfo + rawNoise[i] * prof.noise * 2.4 * surfLfo;
      coreData[i] = Math.max(-0.85, Math.min(0.85, s));
    }

    // Orbiting spatial shimmer layer
    const shimBuf = ctx.createBuffer(1, len, sr);
    const shimData = shimBuf.getChannelData(0);
    const shimHz = Math.max(1, Math.round(prof.shimmer * dur)) / dur;
    const shimHz2 = Math.max(1, Math.round(prof.shimmer * 1.5 * dur)) / dur;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.5 * t);
      const pulse = Math.pow(Math.max(0, Math.sin(2 * Math.PI * 0.25 * t)), 2);
      const val = (Math.sin(2 * Math.PI * shimHz * t) * 0.6 + Math.sin(2 * Math.PI * shimHz2 * t) * 0.4) * (0.15 + 0.25 * env) * (0.4 + 0.6 * pulse);
      shimData[i] = val * 0.45;
    }

    this._planetBuffers.set(key, coreBuf);
    this._shimmerBuffers.set(key, shimBuf);
    return { core: coreBuf, shimmer: shimBuf };
  }

  _getUiBuffer(kind) {
    if (this._uiBuffers.has(kind)) return this._uiBuffers.get(kind);
    const l = this._ensureListener();
    if (!l || !l.context) return null;
    const ctx = l.context;
    const sr = ctx.sampleRate || 44100;

    let dur = 0.065;
    if (kind === 'planet') dur = 0.18;
    else if (kind === 'nav') dur = 0.075;
    else if (kind === 'close') dur = 0.055;

    const len = Math.floor(sr * dur);
    const buf = ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);

    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const u = t / dur;
      const env = Math.sin(Math.min(1, u * 10) * (Math.PI / 2)) * Math.exp(-u * (kind === 'planet' ? 4.5 : 6.2));
      let sample = 0;
      if (kind === 'nav') {
        const f = 520 + 80 * Math.exp(-u * 8);
        sample = (Math.sin(2 * Math.PI * f * t) * 0.72 + Math.sin(2 * Math.PI * f * 2 * t) * 0.28) * 0.45;
      } else if (kind === 'planet') {
        const f1 = 523.25;
        const f2 = 783.99;
        sample = (Math.sin(2 * Math.PI * f1 * t) * 0.55 + Math.sin(2 * Math.PI * f2 * t) * 0.45 * Math.min(1, u * 2.5)) * 0.42;
      } else if (kind === 'close') {
        const f = 380 - 160 * u;
        sample = Math.sin(2 * Math.PI * f * t) * 0.38;
      } else {
        const f = 640 - 190 * u;
        sample = (Math.sin(2 * Math.PI * f * t) * 0.75 + Math.sin(2 * Math.PI * f * 1.5 * t) * 0.25) * 0.35;
      }
      data[i] = sample * env;
    }

    this._uiBuffers.set(kind, buf);
    return buf;
  }

  playUi(kind = 'click', tabIndex = 0) {
    if (this.muted) return;
    const l = this._ensureListener();
    if (!l || !l.context) return;
    if (l.context.state === 'suspended') {
      l.context.resume().catch(() => {});
    }
    if (l.context.state !== 'running') return;

    const buf = this._getUiBuffer(kind);
    if (!buf) return;

    try {
      const sound = new THREE.Audio(l);
      sound.setBuffer(buf);
      sound.setVolume(kind === 'planet' ? 0.34 : kind === 'nav' ? 0.28 : 0.22);
      if (kind === 'nav') {
        sound.setPlaybackRate(NAV_RATES[Math.abs(tabIndex) % NAV_RATES.length] || 1.0);
      } else if (kind === 'click') {
        sound.setPlaybackRate(0.96 + Math.random() * 0.08);
      }
      sound.onEnded = () => {
        try { sound.disconnect(); } catch {}
      };
      sound.play();
    } catch {}
  }

  createStageAmbience(scene, initialType = 'chat') {
    const l = this._ensureListener();
    if (!l || !scene) {
      return { setPlanet() {}, update() {}, dispose() {} };
    }

    const coreNode = new THREE.Object3D();
    coreNode.position.set(0, 0.9, -2.2);
    scene.add(coreNode);

    const orbitNode = new THREE.Object3D();
    orbitNode.position.set(3.35, 1.35, 0);
    scene.add(orbitNode);

    const coreAudio = new THREE.PositionalAudio(l);
    coreAudio.setRefDistance(3.4);
    coreAudio.setRolloffFactor(1.1);
    coreAudio.setMaxDistance(26);
    coreAudio.setDistanceModel('inverse');
    coreAudio.setLoop(true);
    coreNode.add(coreAudio);

    const orbitAudio = new THREE.PositionalAudio(l);
    orbitAudio.setRefDistance(2.5);
    orbitAudio.setRolloffFactor(1.25);
    orbitAudio.setMaxDistance(22);
    orbitAudio.setDistanceModel('inverse');
    orbitAudio.setLoop(true);
    orbitNode.add(orbitAudio);

    let currentType = initialType || 'chat';
    let disposed = false;

    const applyBuffers = (type) => {
      if (disposed) return;
      currentType = PLANET_PROFILES[type] ? type : 'chat';
      const bufs = this._getPlanetBuffers(currentType);
      if (!bufs) return;
      const prof = PLANET_PROFILES[currentType];

      if (coreAudio.isPlaying) coreAudio.stop();
      if (orbitAudio.isPlaying) orbitAudio.stop();

      coreAudio.setBuffer(bufs.core);
      coreAudio.setVolume(prof.vol);
      orbitAudio.setBuffer(bufs.shimmer);
      orbitAudio.setVolume(prof.vol * 0.55);

      if (l.context && l.context.state === 'running') {
        try { coreAudio.play(); } catch {}
        try { orbitAudio.play(); } catch {}
      }
    };

    const handle = {
      _ensurePlaying() {
        if (disposed || !l.context || l.context.state !== 'running') return;
        if (!coreAudio.buffer) applyBuffers(currentType);
        if (coreAudio.buffer && !coreAudio.isPlaying) {
          try { coreAudio.play(); } catch {}
        }
        if (orbitAudio.buffer && !orbitAudio.isPlaying) {
          try { orbitAudio.play(); } catch {}
        }
      },
      setPlanet(type) {
        const next = PLANET_PROFILES[type] ? type : 'chat';
        if (next === currentType && coreAudio.buffer) return;
        applyBuffers(next);
      },
      update(elapsed) {
        if (disposed) return;
        const a = elapsed * 0.35;
        orbitNode.position.set(Math.cos(a) * 3.35, 1.3 + Math.sin(elapsed * 0.6) * 0.25, Math.sin(a) * 3.35);
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        self._activeAmbiences.delete(handle);
        try { if (coreAudio.isPlaying) coreAudio.stop(); coreAudio.disconnect(); } catch {}
        try { if (orbitAudio.isPlaying) orbitAudio.stop(); orbitAudio.disconnect(); } catch {}
        scene.remove(coreNode);
        scene.remove(orbitNode);
      },
    };

    const self = this;
    this._activeAmbiences.add(handle);
    applyBuffers(currentType);
    return handle;
  }
}

export const spatialAudio = new SpatialAudioEngine();

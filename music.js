// Motor Musical e Sintetizador Web Audio do UNIVERSO CHAT
// Reproduz e exporta (.wav) músicas originais do jogo e composições geradas por IA.

const mtof = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

// 4 faixas originais compostas especialmente para o UNIVERSO CHAT
export const BUILTIN_SONGS = [
  {
    id: 'preset:orbita',
    title: 'Órbita Estelar (Tema do Jogo)',
    style: 'Synthwave Cósmico',
    bpm: 118,
    leadWave: 'triangle',
    bassWave: 'sawtooth',
    lyrics:
      '[Verso]\nEntre estrelas e nebulosas vou navegar\nCada planeta tem histórias pra contar\nNo Universo Chat o céu nunca tem fim\nAcende os propulsores, vem brilhar aqui\n\n[Refrão]\nÓrbita estelar, som no espaço sideral\nAmigos em rede num brilho espacial!',
    chords: [
      [50, 53, 57, 60], // Dm7
      [46, 50, 53, 57], // Bbmaj7
      [48, 52, 55, 60], // C
      [45, 48, 52, 55], // Am7
    ],
    melody: [
      { step: 0, midi: 74, dur: 3 }, { step: 3, midi: 77, dur: 3 }, { step: 6, midi: 76, dur: 2 },
      { step: 8, midi: 74, dur: 3 }, { step: 12, midi: 72, dur: 2 }, { step: 14, midi: 74, dur: 2 },
      { step: 16, midi: 77, dur: 4 }, { step: 20, midi: 76, dur: 2 }, { step: 22, midi: 74, dur: 2 },
      { step: 24, midi: 72, dur: 4 }, { step: 28, midi: 69, dur: 4 },
      { step: 32, midi: 72, dur: 3 }, { step: 35, midi: 76, dur: 3 }, { step: 38, midi: 79, dur: 2 },
      { step: 40, midi: 77, dur: 3 }, { step: 44, midi: 76, dur: 2 }, { step: 46, midi: 72, dur: 2 },
      { step: 48, midi: 76, dur: 4 }, { step: 52, midi: 74, dur: 2 }, { step: 54, midi: 72, dur: 2 },
      { step: 56, midi: 69, dur: 6 },
    ],
    bass: [
      { step: 0, midi: 38, dur: 3 }, { step: 4, midi: 38, dur: 2 }, { step: 8, midi: 38, dur: 3 }, { step: 12, midi: 41, dur: 2 },
      { step: 16, midi: 34, dur: 3 }, { step: 20, midi: 34, dur: 2 }, { step: 24, midi: 34, dur: 3 }, { step: 28, midi: 38, dur: 2 },
      { step: 32, midi: 36, dur: 3 }, { step: 36, midi: 36, dur: 2 }, { step: 40, midi: 36, dur: 3 }, { step: 44, midi: 40, dur: 2 },
      { step: 48, midi: 33, dur: 3 }, { step: 52, midi: 33, dur: 2 }, { step: 56, midi: 33, dur: 3 }, { step: 60, midi: 36, dur: 2 },
    ],
    drums: {
      kick: [0, 8, 16, 24, 32, 40, 48, 56, 60],
      snare: [4, 12, 20, 28, 36, 44, 52, 60],
      hat: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 62],
    },
  },
  {
    id: 'preset:lofi',
    title: 'Nebulosa Lo-Fi',
    style: 'Lo-Fi Galáctico Relax',
    bpm: 84,
    leadWave: 'sine',
    bassWave: 'triangle',
    lyrics:
      '[Instrumental & Verso Suave]\nLuz violeta na janela da estação\nFlutuando em paz na constelação\nUm café quente olhando o anel lunar\nConversando até o amanhecer chegar.',
    chords: [
      [48, 52, 55, 59], // Cmaj7
      [45, 48, 52, 55], // Am7
      [41, 45, 48, 52], // Fmaj7
      [43, 47, 50, 55], // G6
    ],
    melody: [
      { step: 0, midi: 76, dur: 4 }, { step: 6, midi: 79, dur: 4 }, { step: 11, midi: 76, dur: 3 },
      { step: 16, midi: 72, dur: 5 }, { step: 22, midi: 74, dur: 4 }, { step: 28, midi: 76, dur: 3 },
      { step: 32, midi: 77, dur: 4 }, { step: 38, midi: 76, dur: 3 }, { step: 42, midi: 72, dur: 4 },
      { step: 48, midi: 74, dur: 6 }, { step: 56, midi: 72, dur: 6 },
    ],
    bass: [
      { step: 0, midi: 36, dur: 6 }, { step: 10, midi: 36, dur: 4 },
      { step: 16, midi: 33, dur: 6 }, { step: 26, midi: 33, dur: 4 },
      { step: 32, midi: 29, dur: 6 }, { step: 42, midi: 31, dur: 4 },
      { step: 48, midi: 31, dur: 6 }, { step: 58, midi: 36, dur: 4 },
    ],
    drums: {
      kick: [0, 10, 16, 26, 32, 42, 48, 58],
      snare: [8, 24, 40, 56],
      hat: [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60],
    },
  },
  {
    id: 'preset:batalha',
    title: 'Batalha na Galáxia',
    style: 'Electro Arcade',
    bpm: 132,
    leadWave: 'square',
    bassWave: 'sawtooth',
    lyrics:
      '[Refrão Arcade]\nMira no alvo, dispara o canhão!\nHorda de zumbis não passa não!\nStrike perfeito, pesca estelar\nMais uma onda vamos conquistar!',
    chords: [
      [45, 48, 52], // Am
      [41, 45, 48], // F
      [43, 47, 50], // G
      [40, 44, 47], // E
    ],
    melody: [
      { step: 0, midi: 69, dur: 2 }, { step: 2, midi: 72, dur: 2 }, { step: 4, midi: 76, dur: 2 }, { step: 6, midi: 81, dur: 2 },
      { step: 8, midi: 79, dur: 2 }, { step: 10, midi: 76, dur: 2 }, { step: 12, midi: 74, dur: 2 }, { step: 14, midi: 72, dur: 2 },
      { step: 16, midi: 77, dur: 3 }, { step: 20, midi: 76, dur: 2 }, { step: 22, midi: 74, dur: 2 }, { step: 24, midi: 72, dur: 4 },
      { step: 32, midi: 74, dur: 2 }, { step: 34, midi: 76, dur: 2 }, { step: 36, midi: 79, dur: 3 }, { step: 40, midi: 77, dur: 2 },
      { step: 42, midi: 76, dur: 2 }, { step: 44, midi: 74, dur: 2 },
      { step: 48, midi: 76, dur: 4 }, { step: 52, midi: 79, dur: 2 }, { step: 54, midi: 80, dur: 2 }, { step: 56, midi: 81, dur: 6 },
    ],
    bass: [
      { step: 0, midi: 33, dur: 2 }, { step: 4, midi: 33, dur: 2 }, { step: 8, midi: 33, dur: 2 }, { step: 12, midi: 36, dur: 2 },
      { step: 16, midi: 29, dur: 2 }, { step: 20, midi: 29, dur: 2 }, { step: 24, midi: 29, dur: 2 }, { step: 28, midi: 31, dur: 2 },
      { step: 32, midi: 31, dur: 2 }, { step: 36, midi: 31, dur: 2 }, { step: 40, midi: 31, dur: 2 }, { step: 44, midi: 33, dur: 2 },
      { step: 48, midi: 28, dur: 2 }, { step: 52, midi: 28, dur: 2 }, { step: 56, midi: 35, dur: 2 }, { step: 60, midi: 40, dur: 2 },
    ],
    drums: {
      kick: [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60],
      snare: [4, 12, 20, 28, 36, 44, 52, 58, 60, 62],
      hat: [2, 6, 10, 14, 18, 22, 26, 30, 34, 38, 42, 46, 50, 54, 58, 62],
    },
  },
  {
    id: 'preset:vip',
    title: 'Salão VIP Dourado',
    style: 'Future Funk Cósmico',
    bpm: 112,
    leadWave: 'triangle',
    bassWave: 'triangle',
    lyrics:
      '[Refrão VIP]\nTapete dourado, brilho de néon\nCada batida acende o salão\nCometa passando, festa sem parar\nTodo o universo veio comemorar!',
    chords: [
      [54, 57, 61, 64], // F#m7
      [47, 50, 54, 57], // Bm7
      [52, 56, 59, 62], // E7
      [49, 53, 56, 61], // C#m7/A
    ],
    melody: [
      { step: 0, midi: 78, dur: 2 }, { step: 3, midi: 81, dur: 2 }, { step: 6, midi: 80, dur: 3 },
      { step: 10, midi: 76, dur: 2 }, { step: 12, midi: 78, dur: 3 },
      { step: 16, midi: 74, dur: 3 }, { step: 20, midi: 76, dur: 2 }, { step: 22, midi: 78, dur: 3 },
      { step: 26, midi: 74, dur: 4 },
      { step: 32, midi: 76, dur: 2 }, { step: 35, midi: 80, dur: 3 }, { step: 39, midi: 83, dur: 3 },
      { step: 44, midi: 80, dur: 3 },
      { step: 48, midi: 81, dur: 4 }, { step: 54, midi: 78, dur: 3 }, { step: 58, midi: 76, dur: 4 },
    ],
    bass: [
      { step: 0, midi: 30, dur: 2 }, { step: 3, midi: 30, dur: 1 }, { step: 6, midi: 37, dur: 2 }, { step: 10, midi: 30, dur: 2 }, { step: 14, midi: 33, dur: 1 },
      { step: 16, midi: 35, dur: 2 }, { step: 19, midi: 35, dur: 1 }, { step: 22, midi: 38, dur: 2 }, { step: 26, midi: 35, dur: 2 }, { step: 30, midi: 37, dur: 1 },
      { step: 32, midi: 40, dur: 2 }, { step: 35, midi: 40, dur: 1 }, { step: 38, midi: 44, dur: 2 }, { step: 42, midi: 40, dur: 2 },
      { step: 48, midi: 37, dur: 3 }, { step: 54, midi: 37, dur: 2 }, { step: 58, midi: 42, dur: 3 },
    ],
    drums: {
      kick: [0, 6, 8, 16, 22, 24, 32, 38, 40, 48, 54, 56],
      snare: [4, 12, 20, 28, 36, 44, 52, 60],
      hat: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 62],
    },
  },
];

function clampNum(n, min, max, fallback) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
}

export function normalizeSong(raw) {
  const s = raw || {};
  const bpm = Math.round(clampNum(s.bpm, 64, 168, 115));
  const waves = ['sine', 'triangle', 'sawtooth', 'square'];
  const leadWave = waves.includes(s.leadWave) ? s.leadWave : 'triangle';
  const bassWave = waves.includes(s.bassWave) ? s.bassWave : 'sawtooth';
  const defaultChords = [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]];
  const chords = Array.isArray(s.chords) && s.chords.length >= 4
    ? s.chords.slice(0, 4).map((ch, idx) =>
        Array.isArray(ch) && ch.length
          ? ch.slice(0, 4).map((m) => Math.round(clampNum(m, 36, 84, 54)))
          : defaultChords[idx]
      )
    : defaultChords;

  const cleanNotes = (arr, minM, maxM) =>
    Array.isArray(arr)
      ? arr
          .map((n) => ({
            step: Math.round(clampNum(n?.step, 0, 63, 0)),
            midi: Math.round(clampNum(n?.midi, minM, maxM, 60)),
            dur: Math.round(clampNum(n?.dur, 1, 8, 2)),
          }))
          .slice(0, 64)
      : [];

  let melody = cleanNotes(s.melody, 52, 92);
  if (!melody.length) {
    melody = chords.flatMap((ch, ci) => [
      { step: ci * 16, midi: ch[0] + 24, dur: 4 },
      { step: ci * 16 + 6, midi: (ch[1] || ch[0]) + 24, dur: 4 },
      { step: ci * 16 + 12, midi: (ch[2] || ch[0]) + 24, dur: 3 },
    ]);
  }
  let bass = cleanNotes(s.bass, 26, 56);
  if (!bass.length) {
    bass = chords.flatMap((ch, ci) => [
      { step: ci * 16, midi: ch[0] - 12, dur: 4 },
      { step: ci * 16 + 8, midi: ch[0] - 12, dur: 4 },
    ]);
  }
  const cleanSteps = (arr, fallback) =>
    Array.isArray(arr) && arr.length
      ? [...new Set(arr.map((v) => Math.round(clampNum(v, 0, 63, 0))))]
      : fallback;

  const drums = {
    kick: cleanSteps(s.drums?.kick, [0, 8, 16, 24, 32, 40, 48, 56]),
    snare: cleanSteps(s.drums?.snare, [4, 12, 20, 28, 36, 44, 52, 60]),
    hat: cleanSteps(s.drums?.hat, [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 62]),
  };

  return {
    id: String(s.id || 'ai:' + Math.random().toString(36).slice(2, 10)),
    title: String(s.title || 'Música Galáctica').slice(0, 60),
    style: String(s.style || 'Eletrônica Espacial').slice(0, 48),
    author: s.author ? String(s.author).slice(0, 24) : '',
    bpm,
    leadWave,
    bassWave,
    lyrics: String(s.lyrics || '').slice(0, 1200),
    chords,
    melody,
    bass,
    drums,
    ai: !!s.ai,
  };
}

function makeNoiseBuffer(ctx, duration = 0.25) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function makeReverbImpulse(ctx, seconds = 1.6, decay = 2.8) {
  const rate = ctx.sampleRate;
  const len = Math.max(1, Math.floor(rate * seconds));
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

function scheduleTrack(ctx, dest, song, cycles = 2, startOffset = 0.04) {
  const stepSec = 60 / song.bpm / 4; // 16th note
  const cycleSteps = 64;
  const noiseBuf = makeNoiseBuffer(ctx, 0.22);

  // Mestre com reverb espacial + compressor suave
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 18;
  comp.ratio.value = 3.2;
  comp.attack.value = 0.01;
  comp.release.value = 0.18;
  comp.connect(dest);

  const dry = ctx.createGain();
  dry.gain.value = 0.88;
  dry.connect(comp);

  const convolver = ctx.createConvolver();
  convolver.buffer = makeReverbImpulse(ctx, 1.5, 3.0);
  const wet = ctx.createGain();
  wet.gain.value = 0.24;
  convolver.connect(wet);
  wet.connect(comp);

  for (let cy = 0; cy < cycles; cy++) {
    const cyTime = startOffset + cy * cycleSteps * stepSec;

    // 1. Pads de acordes (4 compassos de 16 steps cada)
    song.chords.forEach((chord, barIdx) => {
      const t0 = cyTime + barIdx * 16 * stepSec;
      const barDur = 16 * stepSec;
      chord.forEach((midi, ni) => {
        const osc = ctx.createOscillator();
        const flt = ctx.createBiquadFilter();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = mtof(midi);
        osc.detune.value = (ni % 2 === 0 ? -6 : 6);
        flt.type = 'lowpass';
        flt.frequency.setValueAtTime(620, t0);
        flt.frequency.linearRampToValueAtTime(1180, t0 + barDur * 0.5);
        flt.frequency.linearRampToValueAtTime(520, t0 + barDur);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(0.055 / chord.length, t0 + Math.min(0.28, barDur * 0.25));
        g.gain.setValueAtTime(0.05 / chord.length, t0 + barDur * 0.78);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + barDur);
        osc.connect(flt);
        flt.connect(g);
        g.connect(dry);
        g.connect(convolver);
        osc.start(t0);
        osc.stop(t0 + barDur + 0.03);
      });

      // Arpejo suave no segundo ciclo em diante (ou sempre suave)
      for (let s = 0; s < 16; s += 2) {
        const arpTime = t0 + s * stepSec;
        const note = chord[(s / 2) % chord.length] + 12;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = mtof(note);
        const dur = stepSec * 1.6;
        g.gain.setValueAtTime(0.0001, arpTime);
        g.gain.linearRampToValueAtTime(cy === 0 ? 0.032 : 0.052, arpTime + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, arpTime + dur);
        osc.connect(g);
        g.connect(dry);
        g.connect(convolver);
        osc.start(arpTime);
        osc.stop(arpTime + dur + 0.02);
      }
    });

    // 2. Melodia principal
    for (const n of song.melody) {
      const t0 = cyTime + n.step * stepSec;
      const dur = Math.max(0.08, n.dur * stepSec * 0.94);
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const flt = ctx.createBiquadFilter();
      const g = ctx.createGain();

      osc.type = song.leadWave;
      osc.frequency.value = mtof(n.midi);
      osc2.type = 'sine';
      osc2.frequency.value = mtof(n.midi);
      osc2.detune.value = 7;

      flt.type = 'lowpass';
      flt.frequency.setValueAtTime(2800, t0);
      flt.frequency.exponentialRampToValueAtTime(1400, t0 + dur);

      const peak = song.leadWave === 'square' ? 0.095 : song.leadWave === 'sawtooth' ? 0.105 : 0.14;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(peak, t0 + 0.018);
      g.gain.setValueAtTime(peak * 0.78, t0 + dur * 0.68);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      osc.connect(flt);
      osc2.connect(flt);
      flt.connect(g);
      g.connect(dry);
      g.connect(convolver);
      osc.start(t0);
      osc2.start(t0);
      osc.stop(t0 + dur + 0.03);
      osc2.stop(t0 + dur + 0.03);
    }

    // 3. Linha de baixo
    for (const b of song.bass) {
      const t0 = cyTime + b.step * stepSec;
      const dur = Math.max(0.08, b.dur * stepSec * 0.92);
      const osc = ctx.createOscillator();
      const flt = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = song.bassWave;
      osc.frequency.value = mtof(b.midi);
      flt.type = 'lowpass';
      flt.frequency.setValueAtTime(420, t0);
      flt.frequency.exponentialRampToValueAtTime(170, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.22, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(flt);
      flt.connect(g);
      g.connect(dry);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    }

    // 4. Bateria eletrônica (Kick, Snare, Hi-hat)
    for (const step of song.drums.kick) {
      const t0 = cyTime + step * stepSec;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(135, t0);
      osc.frequency.exponentialRampToValueAtTime(42, t0 + 0.13);
      g.gain.setValueAtTime(0.32, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.17);
      osc.connect(g);
      g.connect(dry);
      osc.start(t0);
      osc.stop(t0 + 0.19);
    }
    for (const step of song.drums.snare) {
      const t0 = cyTime + step * stepSec;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.value = 1850;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.14, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
      src.connect(hp);
      hp.connect(g);
      g.connect(dry);
      g.connect(convolver);
      src.start(t0);
      src.stop(t0 + 0.15);
    }
    for (const step of song.drums.hat) {
      const t0 = cyTime + step * stepSec;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 6800;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.045, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.045);
      src.connect(hp);
      hp.connect(g);
      g.connect(dry);
      src.start(t0);
      src.stop(t0 + 0.055);
    }
  }

  return startOffset + cycles * cycleSteps * stepSec + 0.6;
}

function audioBufferToWavBlob(buffer) {
  const numCh = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const dataSize = numFrames * numCh * 2;
  const ab = new ArrayBuffer(44 + dataSize);
  const v = new DataView(ab);
  const writeStr = (off, str) => { for (let i = 0; i < str.length; i++) v.setUint8(off + i, str.charCodeAt(i)); };

  writeStr(0, 'RIFF');
  v.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, numCh, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * numCh * 2, true);
  v.setUint16(32, numCh * 2, true);
  v.setUint16(34, 16, true);
  writeStr(36, 'data');
  v.setUint32(40, dataSize, true);

  const channels = [];
  for (let ch = 0; ch < numCh; ch++) channels.push(buffer.getChannelData(ch));
  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      v.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([ab], { type: 'audio/wav' });
}

const wavCache = new Map();

export async function renderSongToWav(rawSong) {
  const song = normalizeSong(rawSong);
  if (wavCache.has(song.id)) return wavCache.get(song.id);

  const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OfflineCtx) throw new Error('Navegador sem suporte a renderização de áudio.');

  const stepSec = 60 / song.bpm / 4;
  const cycles = song.bpm >= 115 ? 2 : 2;
  const durationSec = Math.min(36, cycles * 64 * stepSec + 0.8);
  const sampleRate = 24000;
  const ctx = new OfflineCtx(2, Math.ceil(sampleRate * durationSec), sampleRate);

  scheduleTrack(ctx, ctx.destination, song, cycles, 0.04);
  const rendered = await ctx.startRendering();
  const blob = audioBufferToWavBlob(rendered);
  const url = URL.createObjectURL(blob);
  const res = { song, url, durationSec: Math.round(durationSec) };
  if (wavCache.size > 16) {
    const oldest = wavCache.keys().next().value;
    const old = wavCache.get(oldest);
    if (old?.url) URL.revokeObjectURL(old.url);
    wavCache.delete(oldest);
  }
  wavCache.set(song.id, res);
  return res;
}

class GameMusicPlayer {
  constructor() {
    this.audio = null;
    this.currentSong = normalizeSong(BUILTIN_SONGS[0]);
    this.playing = false;
    this.volume = 0.65;
    this.listeners = new Set();
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit() {
    for (const fn of this.listeners) {
      try { fn(this.state()); } catch {}
    }
  }

  state() {
    return {
      song: this.currentSong,
      playing: this.playing,
      volume: this.volume,
    };
  }

  async play(rawSong, loop = true) {
    const song = normalizeSong(rawSong || this.currentSong);
    const { url } = await renderSongToWav(song);
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.preload = 'auto';
      this.audio.addEventListener('ended', () => {
        if (!this.audio?.loop) {
          this.playing = false;
          this._emit();
        }
      });
      this.audio.addEventListener('pause', () => {
        if (this.playing) {
          this.playing = false;
          this._emit();
        }
      });
      this.audio.addEventListener('play', () => {
        if (!this.playing) {
          this.playing = true;
          this._emit();
        }
      });
    }
    this.currentSong = song;
    if (this.audio.src !== url) this.audio.src = url;
    this.audio.loop = loop;
    this.audio.volume = this.volume;
    await this.audio.play();
    this.playing = true;
    this._emit();
    return { song, url };
  }

  pause() {
    if (this.audio) this.audio.pause();
    this.playing = false;
    this._emit();
  }

  async toggle(rawSong) {
    const song = rawSong ? normalizeSong(rawSong) : this.currentSong;
    if (this.playing && song.id === this.currentSong.id) {
      this.pause();
      return false;
    }
    await this.play(song, true);
    return true;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, Number(v) || 0));
    if (this.audio) this.audio.volume = this.volume;
    this._emit();
  }
}

export const musicPlayer = new GameMusicPlayer();

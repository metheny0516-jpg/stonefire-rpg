const BGM_VOLUME = 0.24;
const SE_VOLUME = 0.78;
const STEP_SECONDS = 60 / 150 / 4;
const BATTLE_STEPS = 32 * 16;

const CHORDS = Object.freeze([
  [45, 52, 57], [43, 50, 55], [41, 48, 53], [43, 50, 55],
  [45, 52, 57], [48, 55, 60], [41, 48, 53], [43, 50, 55],
  [50, 57, 62], [48, 55, 60], [45, 52, 57], [43, 50, 55],
  [41, 48, 53], [43, 50, 55], [45, 52, 57], [45, 52, 57],
  [41, 48, 53], [45, 52, 57], [48, 55, 60], [50, 57, 62],
  [46, 53, 58], [48, 55, 60], [43, 50, 55], [45, 52, 57],
  [45, 52, 57], [43, 50, 55], [41, 48, 53], [48, 55, 60],
  [50, 57, 62], [43, 50, 55], [41, 48, 53], [45, 52, 57],
]);

const MELODIES = Object.freeze({
  A: [69, 72, 74, 76, 77, 76, 74, 72, 69, 72, 76, 79, 77, 76, 74, 72],
  AP: [69, 72, 74, 76, 81, 79, 77, 76, 74, 76, 77, 81, 79, 77, 76, 74],
  B: [77, 79, 81, 84, 81, 79, 77, 76, 74, 77, 81, 79, 77, 74, 72, 74],
  BUILD: [72, 74, 76, 77, 79, 81, 83, 84, 81, 79, 77, 76, 74, 76, 77, 79],
});

const SECTIONS = Object.freeze(["A", "A", "AP", "AP", "B", "B", "BUILD", "A"]);

function midi(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function impulseResponse(ctx, seconds = 0.55, decay = 3.2) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
  }
  return buffer;
}

export function createGameAudio({ getState, enabled = true } = {}) {
  let ctx = null;
  let master = null;
  let bgmBus = null;
  let sfxBus = null;
  let reverb = null;
  let reverbSend = null;
  let scheduler = 0;
  let nextStepAt = 0;
  let battleStep = -16;
  let fieldStep = 0;
  let lastMode = "field";
  let audioEnabled = enabled;
  let bgmVolume = BGM_VOLUME;
  let seVolume = SE_VOLUME;

  function ensure() {
    if (!audioEnabled) return null;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    if (!ctx) {
      ctx = new AudioCtor();
      master = ctx.createGain();
      bgmBus = ctx.createGain();
      sfxBus = ctx.createGain();
      reverb = ctx.createConvolver();
      reverbSend = ctx.createGain();
      reverb.buffer = impulseResponse(ctx);
      master.gain.value = 0.88;
      bgmBus.gain.value = bgmVolume;
      sfxBus.gain.value = seVolume;
      reverbSend.gain.value = 0.2;
      bgmBus.connect(master);
      sfxBus.connect(master);
      sfxBus.connect(reverbSend).connect(reverb).connect(master);
      master.connect(ctx.destination);
      nextStepAt = ctx.currentTime + 0.05;
      scheduler = window.setInterval(pumpMusic, 25);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function setEnabled(value) {
    audioEnabled = !!value;
    if (audioEnabled) ensure();
    else if (ctx) ctx.suspend();
  }

  function setVolumes({ bgm = bgmVolume, se = seVolume } = {}) {
    bgmVolume = Math.max(0, Math.min(1, bgm));
    seVolume = Math.max(0, Math.min(1, se));
    if (!ctx) return;
    bgmBus.gain.setTargetAtTime(bgmVolume, ctx.currentTime, 0.02);
    sfxBus.gain.setTargetAtTime(seVolume, ctx.currentTime, 0.02);
  }

  function oscillator({ frequency, endFrequency = frequency, duration = 0.12, type = "sine", gain = 0.08, attack = 0.004, when = 0, bus = sfxBus, detune = 0 }) {
    if (!ensure()) return;
    const start = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const envelope = ctx.createGain();
    osc.type = type;
    osc.detune.value = detune;
    osc.frequency.setValueAtTime(Math.max(25, frequency), start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(25, endFrequency), start + duration);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(envelope).connect(bus || sfxBus);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }

  function noiseBurst({ duration = 0.12, gain = 0.12, frequency = 1200, type = "bandpass", q = 0.8, when = 0, attack = 0.002, bus = sfxBus }) {
    if (!ensure()) return;
    const start = ctx.currentTime + when;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 1.7);
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const envelope = ctx.createGain();
    source.buffer = buffer;
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, start);
    filter.Q.value = q;
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(envelope).connect(bus || sfxBus);
    source.start(start);
    source.stop(start + duration + 0.03);
  }

  function duck(ms = 520, ratio = 0.22) {
    if (!ensure()) return;
    const now = ctx.currentTime;
    bgmBus.gain.cancelScheduledValues(now);
    bgmBus.gain.setTargetAtTime(bgmVolume * ratio, now, 0.012);
    bgmBus.gain.setTargetAtTime(bgmVolume, now + ms / 1000, 0.08);
  }

  function kick(when, gain = 0.1) {
    oscillator({ frequency: 120, endFrequency: 46, duration: 0.16, type: "sine", gain, when, bus: bgmBus });
    noiseBurst({ duration: 0.035, gain: gain * 0.35, frequency: 900, type: "lowpass", when, bus: bgmBus });
  }

  function snare(when, gain = 0.065) {
    noiseBurst({ duration: 0.11, gain, frequency: 1750, type: "bandpass", q: 0.65, when, bus: bgmBus });
    oscillator({ frequency: 190, endFrequency: 130, duration: 0.09, type: "triangle", gain: gain * 0.45, when, bus: bgmBus });
  }

  function hat(when, open = false) {
    noiseBurst({ duration: open ? 0.095 : 0.035, gain: open ? 0.027 : 0.018, frequency: 6200, type: "highpass", q: 0.5, when, bus: bgmBus });
  }

  function scheduleBattleStep(step, when) {
    if (step < 0) {
      const intro = step + 16;
      if (intro === 0) {
        kick(when, 0.16);
        noiseBurst({ duration: 0.3, gain: 0.09, frequency: 850, type: "bandpass", when, bus: bgmBus });
        oscillator({ frequency: midi(38), endFrequency: midi(45), duration: 0.45, type: "sawtooth", gain: 0.055, when, bus: bgmBus });
      }
      if ([4, 7, 10, 13].includes(intro)) {
        const note = [57, 62, 65, 69][[4, 7, 10, 13].indexOf(intro)];
        oscillator({ frequency: midi(note), endFrequency: midi(note + 2), duration: 0.18, type: "triangle", gain: 0.075, when, bus: bgmBus });
        hat(when, intro === 13);
      }
      return;
    }
    const loopStep = step % BATTLE_STEPS;
    const bar = Math.floor(loopStep / 16);
    const beat = loopStep % 16;
    const chord = CHORDS[bar];
    const section = SECTIONS[Math.floor(bar / 4)];
    const melody = MELODIES[section];

    if (beat === 0 || beat === 8) kick(when, bar >= 24 ? 0.11 : 0.095);
    if (beat === 4 || beat === 12) snare(when, bar >= 16 ? 0.072 : 0.06);
    if (beat % 2 === 0) hat(when, beat === 14 && bar % 4 === 3);
    if (bar >= 24 && beat % 4 === 2) hat(when);

    if (beat % 2 === 0) {
      const bassPattern = [0, 0, 7, 0, 12, 7, 0, 7];
      const note = chord[0] - 12 + bassPattern[beat / 2];
      oscillator({ frequency: midi(note), endFrequency: midi(note - 1), duration: 0.17, type: "triangle", gain: 0.052, when, bus: bgmBus });
      oscillator({ frequency: midi(note - 12), duration: 0.12, type: "sine", gain: 0.027, when, bus: bgmBus });
    }

    if (beat % 4 === 0) {
      chord.forEach((note, index) => oscillator({ frequency: midi(note), endFrequency: midi(note - 0.4), duration: 0.26, type: index === 0 ? "triangle" : "sawtooth", gain: index === 0 ? 0.018 : 0.011, attack: 0.018, when, bus: bgmBus, detune: index * 3 - 3 }));
    }

    const arpNote = chord[(beat + bar) % chord.length] + 12 + (beat % 4 === 3 ? 12 : 0);
    oscillator({ frequency: midi(arpNote), duration: 0.075, type: "triangle", gain: 0.018, when, bus: bgmBus });

    if (beat % 2 === 0) {
      let melodyNote = melody[(beat / 2 + (bar % 4) * 4) % melody.length];
      if (bar >= 16 && bar < 24) melodyNote += bar % 2 ? 0 : 5;
      oscillator({ frequency: midi(melodyNote), endFrequency: midi(melodyNote - 0.35), duration: 0.18, type: "sawtooth", gain: 0.028, attack: 0.012, when, bus: bgmBus });
      oscillator({ frequency: midi(melodyNote + 12), duration: 0.11, type: "triangle", gain: 0.012, when: when + 0.006, bus: bgmBus });
    }
  }

  function scheduleFieldStep(step, when) {
    const notes = [62, 65, 69, 67, 65, 62, 60, 64, 62, 57, 60, 64, 65, 62, 60, 57];
    if (step % 2 === 0) oscillator({ frequency: midi(notes[step % notes.length]), duration: 0.22, type: "triangle", gain: 0.025, attack: 0.025, when, bus: bgmBus });
    if (step % 8 === 0) oscillator({ frequency: midi(38 + (step % 16 ? 5 : 0)), duration: 0.35, type: "sine", gain: 0.025, when, bus: bgmBus });
  }

  function pumpMusic() {
    if (!ctx || ctx.state !== "running" || document.hidden) return;
    const state = getState?.();
    const mode = state?.mode === "battle" ? "battle" : "field";
    if (mode !== lastMode) {
      lastMode = mode;
      nextStepAt = ctx.currentTime + 0.04;
      if (mode === "battle") battleStep = -16;
    }
    while (nextStepAt < ctx.currentTime + 0.12) {
      const when = Math.max(0, nextStepAt - ctx.currentTime);
      if (mode === "battle") scheduleBattleStep(battleStep++, when);
      else scheduleFieldStep(fieldStep++, when);
      nextStepAt += mode === "battle" ? STEP_SECONDS : 0.18;
    }
  }

  function startBattle() {
    if (!ensure()) return;
    lastMode = "battle";
    battleStep = -16;
    nextStepAt = ctx.currentTime + 0.035;
    sfx("battleStart");
  }

  function sfx(kind) {
    if (!ensure()) return;
    if (["starImpact", "starBurst", "moonBurst", "critical"].includes(kind)) duck(650, 0.18);
    if (kind === "silence") { duck(520, 0.06); return; }

    if (kind === "blade" || kind === "slash") {
      noiseBurst({ duration: 0.15, gain: 0.14, frequency: 3500, type: "highpass" });
      oscillator({ frequency: 1320, endFrequency: 510, duration: 0.13, type: "triangle", gain: 0.07 });
      oscillator({ frequency: 2260, endFrequency: 980, duration: 0.09, type: "sine", gain: 0.035, when: 0.012 });
    } else if (kind === "normalImpact" || kind === "hit") {
      noiseBurst({ duration: 0.13, gain: 0.15, frequency: 1050, type: "bandpass" });
      oscillator({ frequency: 245, endFrequency: 92, duration: 0.17, type: "triangle", gain: 0.12 });
      oscillator({ frequency: 620, endFrequency: 330, duration: 0.08, type: "sine", gain: 0.055, when: 0.008 });
    } else if (kind === "staffSwing") {
      noiseBurst({ duration: 0.11, gain: 0.095, frequency: 2100, type: "highpass" });
      oscillator({ frequency: 520, endFrequency: 250, duration: 0.1, type: "triangle", gain: 0.045 });
    } else if (kind === "staffImpact") {
      noiseBurst({ duration: 0.115, gain: 0.14, frequency: 720, type: "bandpass", q: 0.55 });
      oscillator({ frequency: 310, endFrequency: 105, duration: 0.16, type: "triangle", gain: 0.13 });
      oscillator({ frequency: 880, endFrequency: 540, duration: 0.055, type: "sine", gain: 0.04, when: 0.006 });
    } else if (kind === "dash" || kind === "returnDash") {
      noiseBurst({ duration: 0.2, gain: 0.09, frequency: 2600, type: "highpass" });
      oscillator({ frequency: 720, endFrequency: 1280, duration: 0.13, type: "triangle", gain: 0.035 });
    } else if (kind === "enemy") {
      noiseBurst({ duration: 0.18, gain: 0.13, frequency: 620, type: "lowpass" });
      oscillator({ frequency: 210, endFrequency: 78, duration: 0.25, type: "sawtooth", gain: 0.085 });
    } else if (kind === "heal") {
      [72, 76, 79, 84].forEach((note, i) => oscillator({ frequency: midi(note), endFrequency: midi(note + 1), duration: 0.3, type: "sine", gain: 0.055, attack: 0.015, when: i * 0.075 }));
      noiseBurst({ duration: 0.34, gain: 0.025, frequency: 5200, type: "highpass", when: 0.08 });
    } else if (kind === "starCharge" || kind === "fire") {
      noiseBurst({ duration: 0.42, gain: 0.11, frequency: 880, type: "bandpass" });
      oscillator({ frequency: 105, endFrequency: 530, duration: 0.43, type: "sawtooth", gain: 0.075 });
      oscillator({ frequency: 280, endFrequency: 940, duration: 0.34, type: "triangle", gain: 0.05, when: 0.07 });
    } else if (kind === "starDash") {
      noiseBurst({ duration: 0.28, gain: 0.18, frequency: 3200, type: "highpass" });
      oscillator({ frequency: 1480, endFrequency: 390, duration: 0.2, type: "triangle", gain: 0.095 });
      oscillator({ frequency: 185, endFrequency: 420, duration: 0.24, type: "sawtooth", gain: 0.065, when: 0.018 });
    } else if (kind === "starImpact" || kind === "critical") {
      noiseBurst({ duration: 0.38, gain: 0.24, frequency: 1150, type: "bandpass" });
      noiseBurst({ duration: 0.13, gain: 0.13, frequency: 4200, type: "highpass", when: 0.015 });
      oscillator({ frequency: 145, endFrequency: 48, duration: 0.42, type: "sine", gain: 0.19 });
      [910, 1320, 1870].forEach((frequency, i) => oscillator({ frequency, endFrequency: frequency * 0.55, duration: 0.22, type: "triangle", gain: 0.055, when: i * 0.018 }));
    } else if (kind === "starBurst" || kind === "burst") {
      noiseBurst({ duration: 0.48, gain: 0.25, frequency: 520, type: "lowpass" });
      noiseBurst({ duration: 0.3, gain: 0.13, frequency: 1900, type: "bandpass", when: 0.025 });
      oscillator({ frequency: 115, endFrequency: 38, duration: 0.46, type: "sine", gain: 0.18 });
    } else if (kind === "moonCast") {
      [76, 81, 88].forEach((note, i) => oscillator({ frequency: midi(note), endFrequency: midi(note + 2), duration: 0.4, type: "sine", gain: 0.052, when: i * 0.07 }));
      noiseBurst({ duration: 0.4, gain: 0.035, frequency: 4700, type: "highpass" });
    } else if (kind === "moonOrb") {
      oscillator({ frequency: 620, endFrequency: 1510, duration: 0.38, type: "sine", gain: 0.075 });
      oscillator({ frequency: 940, endFrequency: 1880, duration: 0.32, type: "triangle", gain: 0.038, when: 0.04 });
      noiseBurst({ duration: 0.26, gain: 0.028, frequency: 5600, type: "highpass", when: 0.05 });
    } else if (kind === "moonShot") {
      noiseBurst({ duration: 0.2, gain: 0.085, frequency: 3300, type: "highpass" });
      oscillator({ frequency: 1650, endFrequency: 620, duration: 0.28, type: "sine", gain: 0.09 });
      oscillator({ frequency: 410, endFrequency: 760, duration: 0.22, type: "triangle", gain: 0.04 });
    } else if (kind === "moonHit") {
      noiseBurst({ duration: 0.15, gain: 0.11, frequency: 3600, type: "highpass" });
      [84, 91, 96].forEach((note, i) => oscillator({ frequency: midi(note), endFrequency: midi(note - 2), duration: 0.2, type: "sine", gain: 0.05, when: i * 0.025 }));
      oscillator({ frequency: 175, endFrequency: 72, duration: 0.22, type: "triangle", gain: 0.1 });
    } else if (kind === "moonBurst") {
      noiseBurst({ duration: 0.42, gain: 0.16, frequency: 720, type: "lowpass" });
      oscillator({ frequency: 138, endFrequency: 52, duration: 0.4, type: "sine", gain: 0.15 });
      [940, 1410, 1880].forEach((frequency, i) => oscillator({ frequency, endFrequency: frequency * 0.64, duration: 0.34, type: "sine", gain: 0.036, when: 0.05 + i * 0.035 }));
    } else if (kind === "battleStart") {
      noiseBurst({ duration: 0.24, gain: 0.16, frequency: 980, type: "bandpass" });
      oscillator({ frequency: 92, endFrequency: 46, duration: 0.32, type: "sine", gain: 0.14 });
      oscillator({ frequency: midi(57), endFrequency: midi(69), duration: 0.48, type: "triangle", gain: 0.07, when: 0.05 });
    } else if (kind === "win") {
      [62, 65, 69, 74].forEach((note, i) => oscillator({ frequency: midi(note), duration: 0.28, type: "triangle", gain: 0.065, when: i * 0.1 }));
    } else if (kind === "level") {
      [67, 71, 74, 79].forEach((note, i) => oscillator({ frequency: midi(note), endFrequency: midi(note + 1), duration: 0.3, type: "triangle", gain: 0.07, when: i * 0.11 }));
    } else if (kind === "miss") {
      noiseBurst({ duration: 0.12, gain: 0.045, frequency: 2400, type: "highpass" });
      oscillator({ frequency: 310, endFrequency: 155, duration: 0.17, type: "triangle", gain: 0.04 });
    }
  }

  function destroy() {
    if (scheduler) window.clearInterval(scheduler);
    scheduler = 0;
    if (ctx) ctx.close();
    ctx = null;
  }

  return { ensure, setEnabled, setVolumes, startBattle, duck, sfx, destroy, get volumes() { return { bgm: bgmVolume, se: seVolume }; } };
}

export const AUDIO_DESIGN = Object.freeze({
  bpm: 150,
  battleBars: 32,
  battleDurationSeconds: BATTLE_STEPS * STEP_SECONDS,
  bgmVolume: BGM_VOLUME,
  seVolume: SE_VOLUME,
});

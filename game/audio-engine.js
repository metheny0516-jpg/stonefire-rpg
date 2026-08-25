const BGM_VOLUME = 0.9;
const SE_VOLUME = 0.58;
const STEP_SECONDS = 60 / 162 / 4;
const BOSS_STEP_SECONDS = 60 / 172 / 4;
const BATTLE_STEPS = 16 * 16;
const CROSSFADE = 0.6;

// ==================== 通常戦闘 (162BPM / 16小節) ====================
// 16小節を2小節ずつ8スロットに分け、章ごとに和音と旋律を丸ごと差し替える。
const BATTLE_SECTIONS = Object.freeze(["A", "A", "B", "A", "A", "B", "B", "C"]);
const BATTLE_BASS = Object.freeze([0, 0, 7, 0, 12, 0, 7, 5]);
const BATTLE_KICKS = Object.freeze([0, 6, 8, 14]);

const BATTLE_SETS = Object.freeze({
  // 第1章「石牢」: Eマイナー、硬く角ばった矩形波
  1: Object.freeze({
    chords: [[40, 47, 52], [40, 47, 52], [36, 43, 48], [38, 45, 50], [40, 47, 52], [45, 52, 57], [47, 54, 59], [40, 47, 52]],
    A: [76, 76, 79, 83, 79, 76, 74, 71, 72, 74, 76, 79, 76, 74, 71, 67],
    B: [83, 86, 88, 86, 83, 79, 83, 86, 84, 83, 79, 76, 79, 76, 74, 71],
    lead: "square", counter: "triangle", stab: "sawtooth", drive: 1,
  }),
  // 第2章「月影の森」: Dドリアン、三角波のやわらかい疾走
  2: Object.freeze({
    chords: [[38, 45, 50], [38, 45, 50], [41, 48, 53], [43, 50, 55], [36, 43, 48], [41, 48, 53], [43, 50, 55], [38, 45, 50]],
    A: [74, 77, 81, 77, 74, 72, 69, 72, 74, 77, 81, 84, 81, 77, 74, 72],
    B: [81, 84, 86, 84, 81, 77, 74, 77, 79, 81, 84, 81, 77, 74, 72, 69],
    lead: "triangle", counter: "sine", stab: "triangle", drive: 0.88,
  }),
  // 第3章「星骸の塔」: Aマイナー、高音域の鋸波で切迫感を出す
  3: Object.freeze({
    chords: [[45, 52, 57], [45, 52, 57], [43, 50, 55], [41, 48, 53], [38, 45, 50], [43, 50, 55], [40, 47, 52], [45, 52, 57]],
    A: [81, 84, 88, 84, 81, 79, 76, 79, 81, 84, 88, 91, 88, 84, 81, 79],
    B: [88, 91, 93, 91, 88, 84, 81, 84, 86, 88, 91, 88, 84, 81, 79, 76],
    lead: "sawtooth", counter: "triangle", stab: "sawtooth", drive: 1.12,
  }),
});

// --- 第1章「石牢」: 低く沈んだ短調、水滴の反響 ---
const F1_CHORDS = Object.freeze([[45, 48, 52], [41, 45, 48], [36, 40, 43], [43, 47, 50]]);
const F1_MELODY = Object.freeze([
  69, 72, 74, 76, 74, 72, 69, 67, 69, 72, 76, 79, 77, 76, 74, 72,
  67, 69, 72, 74, 72, 69, 67, 65, 64, 67, 69, 72, 71, 69, 67, 64,
]);

// --- 第2章「月影の森」: ドリアン旋法のやわらかい歩調 ---
const F2_CHORDS = Object.freeze([[38, 41, 45], [43, 47, 50], [45, 48, 52], [41, 45, 48]]);
const F2_MELODY = Object.freeze([
  69, 71, 72, 74, 76, 74, 72, 71, 69, 67, 69, 71, 72, 71, 69, 67,
  65, 67, 69, 71, 72, 74, 76, 77, 76, 74, 72, 71, 69, 67, 65, 64,
]);

// --- 第3章「星骸の塔」: リディアン、鐘と空気感 ---
const F3_CHORDS = Object.freeze([[36, 43, 52], [38, 45, 54], [41, 48, 55], [43, 50, 57]]);
const F3_MELODY = Object.freeze([
  76, 78, 79, 83, 81, 79, 78, 76, 74, 76, 78, 81, 83, 81, 79, 78,
  79, 83, 86, 88, 86, 83, 81, 79, 78, 76, 74, 78, 79, 78, 76, 74,
]);

// --- ボス戦: 172BPM、Dマイナーの追い立てるリフ ---
const BOSS_CHORDS = Object.freeze([
  [38, 41, 45], [38, 41, 45], [34, 38, 41], [34, 38, 41],
  [36, 40, 43], [36, 40, 43], [33, 37, 40], [33, 37, 40],
]);
const BOSS_MELODY = Object.freeze([
  74, 74, 77, 74, 81, 79, 77, 74, 72, 74, 77, 79, 77, 74, 72, 70,
  74, 74, 77, 74, 82, 81, 79, 77, 76, 77, 79, 81, 79, 77, 76, 74,
  77, 79, 81, 84, 82, 81, 79, 77, 75, 77, 79, 82, 81, 79, 77, 75,
  74, 77, 81, 86, 84, 82, 81, 79, 77, 79, 81, 77, 74, 72, 74, 74,
]);
const BOSS_BASS = Object.freeze([0, 0, 12, 0, 7, 0, 12, 5, 0, 0, 12, 7, 5, 7, 3, 0]);
// ボス曲は章ごとに移調と音色を変えて、同じ曲に聞こえないようにする。
const BOSS_VARIANTS = Object.freeze({
  1: Object.freeze({ shift: 0, lead: "sawtooth", bass: "square" }),
  2: Object.freeze({ shift: -3, lead: "square", bass: "sawtooth" }),
  3: Object.freeze({ shift: 4, lead: "sawtooth", bass: "square" }),
});

// --- 勝利/章クリア: 明るいハ長調のループ ---
const CLEAR_CHORDS = Object.freeze([[48, 55, 64], [53, 60, 69], [50, 57, 65], [55, 62, 71]]);
const CLEAR_MELODY = Object.freeze([
  72, 72, 72, 76, 79, 79, 79, 84, 83, 81, 79, 81, 79, 0, 0, 0,
  77, 77, 79, 81, 79, 77, 76, 74, 72, 74, 76, 79, 77, 0, 0, 0,
]);

// --- ゲームオーバー: 沈む挽歌 ---
const OVER_CHORDS = Object.freeze([[38, 45, 50], [36, 43, 48], [34, 41, 46], [33, 40, 45]]);
const OVER_MELODY = Object.freeze([74, 72, 70, 69, 67, 65, 62, 0, 65, 64, 62, 60, 62, 0, 0, 0]);

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

export function trackForState(state) {
  if (!state) return "field1";
  if (state.mode === "over") return "over";
  if (state.mode === "clear") return "clear";
  const chapter = Math.max(1, Math.min(3, state.chapter || 1));
  if (state.mode === "battle") {
    const boss = (state.enemies || []).some((e) => e && e.boss) || !!(state.enemy && state.enemy.boss);
    return (boss ? "boss" : "battle") + chapter;
  }
  return "field" + chapter;
}

export function createGameAudio({ getState, enabled = true } = {}) {
  let ctx = null;
  let master = null;
  let limiter = null;
  let bgmMaster = null;
  let bgmBuses = [];
  let activeBus = 0;
  let sfxBus = null;
  let reverb = null;
  let reverbSend = null;
  let bgmVerbSend = null;
  let scheduler = 0;
  let nextStepAt = 0;
  let trackStep = 0;
  let currentTrack = "field1";
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
      bgmMaster = ctx.createGain();
      sfxBus = ctx.createGain();
      reverb = ctx.createConvolver();
      reverbSend = ctx.createGain();
      bgmVerbSend = ctx.createGain();
      reverb.buffer = impulseResponse(ctx);
      master.gain.value = 0.88;
      bgmMaster.gain.value = bgmVolume;
      sfxBus.gain.value = seVolume;
      reverbSend.gain.value = 0.2;
      bgmVerbSend.gain.value = 0.16;
      bgmBuses = [ctx.createGain(), ctx.createGain()];
      bgmBuses[0].gain.value = 1;
      bgmBuses[1].gain.value = 0;
      bgmBuses.forEach((b) => b.connect(bgmMaster));
      bgmMaster.connect(master);
      bgmMaster.connect(bgmVerbSend).connect(reverb);
      sfxBus.connect(master);
      sfxBus.connect(reverbSend).connect(reverb);
      reverb.connect(master);
      // BGM を上げたぶん、まとめてリミッターに通して歪みを防ぐ。
      // 効果音のピークで BGM がわずかに沈むので、打撃の抜けも良くなる。
      limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -10;
      limiter.knee.value = 6;
      limiter.ratio.value = 8;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.18;
      master.connect(limiter).connect(ctx.destination);
      currentTrack = trackForState(getState && getState());
      trackStep = 0;
      nextStepAt = ctx.currentTime + 0.05;
      scheduler = window.setInterval(pumpMusic, 25);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function bus() {
    return bgmBuses[activeBus];
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
    bgmMaster.gain.setTargetAtTime(bgmVolume, ctx.currentTime, 0.02);
    sfxBus.gain.setTargetAtTime(seVolume, ctx.currentTime, 0.02);
  }

  function oscillator({ frequency, endFrequency = frequency, duration = 0.12, type = "sine", gain = 0.08, attack = 0.004, when = 0, bus: target = null, detune = 0 }) {
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
    osc.connect(envelope).connect(target || sfxBus);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }

  function noiseBurst({ duration = 0.12, gain = 0.12, frequency = 1200, type = "bandpass", q = 0.8, when = 0, attack = 0.002, bus: target = null, curve = 1.7 }) {
    if (!ensure()) return;
    const start = ctx.currentTime + when;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, curve);
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
    source.connect(filter).connect(envelope).connect(target || sfxBus);
    source.start(start);
    source.stop(start + duration + 0.03);
  }

  // 鐘・チャイム系: 基音 + 非整数倍音でガラス質の響きを作る
  function bell(note, { duration = 1.1, gain = 0.03, when = 0, bus: target = null, bright = 1 } = {}) {
    const base = midi(note);
    oscillator({ frequency: base, duration, type: "sine", gain, attack: 0.006, when, bus: target });
    oscillator({ frequency: base * 2.76, duration: duration * 0.55, type: "sine", gain: gain * 0.32 * bright, attack: 0.004, when, bus: target });
    oscillator({ frequency: base * 5.4, duration: duration * 0.28, type: "sine", gain: gain * 0.14 * bright, attack: 0.003, when, bus: target });
  }

  function pad(notes, { duration = 2.2, gain = 0.012, when = 0, bus: target = null, type = "triangle" } = {}) {
    notes.forEach((note, index) => {
      oscillator({ frequency: midi(note), endFrequency: midi(note - 0.25), duration, type, gain, attack: 0.35, when, bus: target, detune: index * 4 - 4 });
    });
  }

  function duck(ms = 520, ratio = 0.22) {
    if (!ensure()) return;
    const now = ctx.currentTime;
    bgmMaster.gain.cancelScheduledValues(now);
    bgmMaster.gain.setTargetAtTime(bgmVolume * ratio, now, 0.012);
    bgmMaster.gain.setTargetAtTime(bgmVolume, now + ms / 1000, 0.08);
  }

  function kick(when, gain = 0.1) {
    oscillator({ frequency: 120, endFrequency: 46, duration: 0.16, type: "sine", gain, when, bus: bus() });
    noiseBurst({ duration: 0.035, gain: gain * 0.35, frequency: 900, type: "lowpass", when, bus: bus() });
  }

  function snare(when, gain = 0.065) {
    noiseBurst({ duration: 0.11, gain, frequency: 1750, type: "bandpass", q: 0.65, when, bus: bus() });
    oscillator({ frequency: 190, endFrequency: 130, duration: 0.09, type: "triangle", gain: gain * 0.45, when, bus: bus() });
  }

  function hat(when, open = false, gain = 1) {
    noiseBurst({ duration: open ? 0.095 : 0.035, gain: (open ? 0.027 : 0.018) * gain, frequency: 6200, type: "highpass", q: 0.5, when, bus: bus() });
  }

  function shaker(when, gain = 0.012) {
    noiseBurst({ duration: 0.06, gain, frequency: 8200, type: "highpass", q: 0.4, when, bus: bus(), curve: 2.6 });
  }

  // ==================== BGM トラック ====================

  function scheduleBattleStep(step, when, set) {
    if (step < 0) {
      // 2小節のカウントイン: 下から駆け上がって戦闘へ突入する
      const intro = step + 16;
      const root = set.chords[0][0];
      if (intro === 0) {
        kick(when, 0.17);
        noiseBurst({ duration: 0.34, gain: 0.1, frequency: 900, type: "bandpass", when, bus: bus() });
        oscillator({ frequency: midi(root - 12), endFrequency: midi(root), duration: 0.5, type: "sawtooth", gain: 0.06, when, bus: bus() });
      }
      if (intro === 8) { kick(when, 0.13); snare(when, 0.07); }
      if ([10, 12, 14, 15].includes(intro)) {
        const climb = [0, 3, 7, 10][[10, 12, 14, 15].indexOf(intro)];
        oscillator({ frequency: midi(root + 24 + climb), duration: 0.11, type: set.lead, gain: 0.055, when, bus: bus() });
        hat(when, intro === 15);
      }
      return;
    }

    const loop = step % BATTLE_STEPS;
    const bar = Math.floor(loop / 16);      // 0..15
    const slot = Math.floor(bar / 2);       // 0..7 (2小節ごと)
    const beat = loop % 16;
    const chord = set.chords[slot];
    const section = BATTLE_SECTIONS[slot];
    const melody = section === "A" ? set.A : set.B;
    const lift = section === "C" ? 12 : 0;  // 最後の2小節は1オクターブ上げて煽る
    const dense = section === "C" || slot >= 5;
    const drive = set.drive;

    // --- ドラム ---
    if (BATTLE_KICKS.includes(beat)) kick(when, (beat === 0 ? 0.115 : 0.092) * drive);
    if (beat === 4 || beat === 12) snare(when, (dense ? 0.075 : 0.062) * drive);
    if (beat % 2 === 0) hat(when, beat === 14 && slot % 2 === 1);
    if (dense && beat % 4 === 3) hat(when, false, 0.6);
    // 16小節目の締めのフィル
    if (section === "C" && bar % 2 === 1 && beat >= 8 && beat % 2 === 0) {
      snare(when, (0.05 + (beat - 8) * 0.008) * drive);
    }

    // --- ベース (8分の刻み + サブ) ---
    if (beat % 2 === 0) {
      const note = chord[0] - 12 + BATTLE_BASS[beat / 2];
      oscillator({ frequency: midi(note), endFrequency: midi(note - 0.6), duration: 0.13, type: "triangle", gain: 0.05 * drive, when, bus: bus() });
    }
    if (beat === 0 || beat === 8) oscillator({ frequency: midi(chord[0] - 24), duration: 0.24, type: "sine", gain: 0.03, when, bus: bus() });

    // --- キック位置に合わせたコードの刻み ---
    if (BATTLE_KICKS.includes(beat)) {
      [chord[0], chord[1]].forEach((note, i) => oscillator({
        frequency: midi(note + 12), duration: 0.11, type: set.stab,
        gain: (0.016 - i * 0.005) * drive, attack: 0.006, when, bus: bus(), detune: i * 7 - 3,
      }));
    }

    // --- 裏拍の対旋律 ---
    if (beat % 4 === 2) {
      const counterNote = chord[(beat / 2 + slot) % chord.length] + 12;
      oscillator({ frequency: midi(counterNote), duration: 0.09, type: set.counter, gain: 0.016, when, bus: bus() });
    }

    // --- 主旋律 (8分音符) ---
    if (beat % 2 === 0) {
      const note = melody[((bar % 2) * 8 + beat / 2) % melody.length] + lift;
      oscillator({ frequency: midi(note), endFrequency: midi(note - 0.3), duration: 0.155, type: set.lead, gain: 0.03 * drive, attack: 0.01, when, bus: bus() });
      oscillator({ frequency: midi(note), duration: 0.13, type: "triangle", gain: 0.009, when, bus: bus(), detune: 9 });
      if (dense) oscillator({ frequency: midi(note + 12), duration: 0.085, type: "triangle", gain: 0.011, when: when + 0.007, bus: bus() });
    }
  }

  function scheduleBossStep(step, when, variant) {
    if (step < 0) {
      const intro = step + 12;
      if (intro === 0) {
        kick(when, 0.2);
        noiseBurst({ duration: 0.55, gain: 0.11, frequency: 620, type: "bandpass", when, bus: bus() });
        oscillator({ frequency: midi(26 + variant.shift), endFrequency: midi(38 + variant.shift), duration: 0.75, type: "sawtooth", gain: 0.08, when, bus: bus() });
      }
      if (intro === 6 || intro === 9) {
        snare(when, 0.09);
        oscillator({ frequency: midi(50 + variant.shift + (intro - 6) * 2), duration: 0.16, type: "square", gain: 0.05, when, bus: bus() });
      }
      if (intro === 11) {
        noiseBurst({ duration: 0.22, gain: 0.13, frequency: 4200, type: "highpass", when, bus: bus() });
      }
      return;
    }
    const loop = step % 128;
    const bar = Math.floor(loop / 16);
    const beat = loop % 16;
    const chord = BOSS_CHORDS[bar].map((n) => n + variant.shift);
    const half = bar >= 4;

    // ドラム: 前へ前へと押すパターン
    if ([0, 3, 6, 8, 11, 14].includes(beat)) kick(when, beat === 0 ? 0.13 : 0.1);
    if (beat === 4 || beat === 12) snare(when, 0.085);
    if (half && (beat === 7 || beat === 15)) snare(when, 0.05);
    hat(when, beat === 14, 0.85);

    // 16分の刻みベース
    const bassNote = chord[0] - 12 + BOSS_BASS[beat];
    oscillator({ frequency: midi(bassNote), duration: 0.075, type: variant.bass, gain: 0.045, when, bus: bus() });
    if (beat % 4 === 0) oscillator({ frequency: midi(chord[0] - 24), duration: 0.28, type: "sine", gain: 0.05, when, bus: bus() });

    // 刻むパワーコード
    if (beat % 2 === 0) {
      [chord[0], chord[0] + 7].forEach((note, i) => oscillator({ frequency: midi(note), duration: 0.1, type: variant.lead, gain: 0.017 - i * 0.004, attack: 0.006, when, bus: bus(), detune: i * 6 - 3 }));
    }

    // ブラス風の主旋律
    const melodyNote = BOSS_MELODY[(bar * 8 + Math.floor(beat / 2)) % BOSS_MELODY.length] + variant.shift;
    if (beat % 2 === 0) {
      oscillator({ frequency: midi(melodyNote), endFrequency: midi(melodyNote - 0.3), duration: 0.16, type: variant.lead, gain: 0.032, attack: 0.014, when, bus: bus() });
      oscillator({ frequency: midi(melodyNote), duration: 0.14, type: "square", gain: 0.012, when, bus: bus(), detune: 8 });
      if (half) oscillator({ frequency: midi(melodyNote + 12), duration: 0.1, type: "triangle", gain: 0.014, when: when + 0.008, bus: bus() });
    }

    // 8小節目の切り返しフィル
    if (bar === 7 && beat >= 12) {
      snare(when, 0.07 + (beat - 12) * 0.012);
      noiseBurst({ duration: 0.05, gain: 0.03, frequency: 5200, type: "highpass", when, bus: bus() });
    }
  }

  function scheduleFieldStep(step, when, cfg) {
    const loop = step % 128;
    const phrase = Math.floor(loop / 32);
    const beat = loop % 32;
    const chord = cfg.chords[phrase];

    if (cfg.name === "field1") {
      // 石牢: 低いドローンと、遠くで落ちる水滴
      if (beat === 0) {
        oscillator({ frequency: midi(chord[0] - 12), endFrequency: midi(chord[0] - 12.2), duration: 5.2, type: "sine", gain: 0.032, attack: 0.6, when, bus: bus() });
        pad(chord, { duration: 4.4, gain: 0.009, when, bus: bus() });
      }
      if (beat % 4 === 0) {
        const note = cfg.melody[(loop / 4) % cfg.melody.length];
        bell(note, { duration: 1.25, gain: 0.024, when, bus: bus(), bright: 0.7 });
      }
      if (beat === 18 && phrase % 2 === 1) {
        oscillator({ frequency: 2100, endFrequency: 1450, duration: 0.16, type: "sine", gain: 0.018, when, bus: bus() });
        noiseBurst({ duration: 0.1, gain: 0.006, frequency: 5200, type: "highpass", when: when + 0.02, bus: bus() });
      }
      if (beat === 8 || beat === 24) oscillator({ frequency: midi(chord[0] - 24), duration: 1.1, type: "sine", gain: 0.022, attack: 0.08, when, bus: bus() });
      return;
    }

    if (cfg.name === "field2") {
      // 月影の森: やわらかいアルペジオと木漏れ日のようなシェイカー
      if (beat % 8 === 0) {
        oscillator({ frequency: midi(chord[0] - 12), duration: 1.5, type: "triangle", gain: 0.03, attack: 0.06, when, bus: bus() });
        pad(chord, { duration: 2.4, gain: 0.008, when, bus: bus() });
      }
      if (beat % 2 === 0) {
        const arp = chord[(beat / 2) % chord.length] + (beat % 8 >= 4 ? 12 : 0);
        oscillator({ frequency: midi(arp), duration: 0.3, type: "triangle", gain: 0.015, attack: 0.02, when, bus: bus() });
      }
      if (beat % 4 === 2) shaker(when);
      if (beat % 4 === 0) {
        const note = cfg.melody[(loop / 4) % cfg.melody.length];
        oscillator({ frequency: midi(note), endFrequency: midi(note - 0.2), duration: 0.62, type: "sine", gain: 0.027, attack: 0.05, when, bus: bus() });
        oscillator({ frequency: midi(note + 12), duration: 0.3, type: "triangle", gain: 0.007, attack: 0.04, when, bus: bus() });
      }
      return;
    }

    // field3 — 星骸の塔: 開けた響き、鐘、きらめき
    if (beat % 8 === 0) {
      pad(chord, { duration: 3.4, gain: 0.011, when, bus: bus(), type: "sawtooth" });
      oscillator({ frequency: midi(chord[0] - 12), duration: 2.6, type: "sine", gain: 0.026, attack: 0.25, when, bus: bus() });
    }
    if (beat % 4 === 0) {
      const note = cfg.melody[(loop / 4) % cfg.melody.length];
      bell(note, { duration: 1.6, gain: 0.023, when, bus: bus(), bright: 1.25 });
    }
    if (beat % 8 === 5) {
      const shimmer = cfg.melody[(Math.floor(loop / 4) + 3) % cfg.melody.length] + 12;
      oscillator({ frequency: midi(shimmer), duration: 0.42, type: "sine", gain: 0.009, attack: 0.05, when, bus: bus() });
    }
    if (beat % 16 === 12) noiseBurst({ duration: 0.5, gain: 0.005, frequency: 7400, type: "highpass", when, bus: bus(), curve: 1.1 });
  }

  function scheduleClearStep(step, when) {
    const loop = step % 128;
    const bar = Math.floor(loop / 32);
    const beat = loop % 32;
    const chord = CLEAR_CHORDS[bar];

    if (beat === 0) {
      kick(when, 0.09);
      pad(chord, { duration: 2.6, gain: 0.013, when, bus: bus() });
      oscillator({ frequency: midi(chord[0] - 12), duration: 1.4, type: "triangle", gain: 0.034, attack: 0.02, when, bus: bus() });
    }
    if (beat === 16) {
      kick(when, 0.07);
      oscillator({ frequency: midi(chord[0] - 5), duration: 0.9, type: "triangle", gain: 0.028, attack: 0.02, when, bus: bus() });
    }
    if (beat % 8 === 4) snare(when, 0.035);
    if (beat % 4 === 0) shaker(when, 0.009);

    if (beat % 4 === 0) {
      const note = CLEAR_MELODY[(loop / 4) % CLEAR_MELODY.length];
      if (note) {
        oscillator({ frequency: midi(note), duration: 0.58, type: "triangle", gain: 0.036, attack: 0.012, when, bus: bus() });
        oscillator({ frequency: midi(note + 7), duration: 0.5, type: "sine", gain: 0.013, attack: 0.014, when, bus: bus() });
        bell(note + 12, { duration: 0.8, gain: 0.008, when, bus: bus() });
      }
    }
  }

  function scheduleOverStep(step, when) {
    const loop = step % 64;
    const bar = Math.floor(loop / 16);
    const beat = loop % 16;
    const chord = OVER_CHORDS[bar];

    if (beat === 0) {
      pad(chord, { duration: 5.4, gain: 0.016, when, bus: bus() });
      oscillator({ frequency: midi(chord[0] - 12), endFrequency: midi(chord[0] - 12.4), duration: 5.6, type: "sine", gain: 0.038, attack: 0.5, when, bus: bus() });
    }
    if (beat % 4 === 0) {
      const note = OVER_MELODY[(loop / 4) % OVER_MELODY.length];
      if (note) {
        oscillator({ frequency: midi(note), endFrequency: midi(note - 0.3), duration: 1.5, type: "triangle", gain: 0.03, attack: 0.09, when, bus: bus() });
        bell(note - 12, { duration: 1.8, gain: 0.01, when, bus: bus(), bright: 0.5 });
      }
    }
  }

  const TRACKS = {
    field1: { step: 0.21, verb: 0.34, intro: 0, schedule: (s, w) => scheduleFieldStep(s, w, { name: "field1", chords: F1_CHORDS, melody: F1_MELODY }) },
    field2: { step: 0.19, verb: 0.2, intro: 0, schedule: (s, w) => scheduleFieldStep(s, w, { name: "field2", chords: F2_CHORDS, melody: F2_MELODY }) },
    field3: { step: 0.22, verb: 0.3, intro: 0, schedule: (s, w) => scheduleFieldStep(s, w, { name: "field3", chords: F3_CHORDS, melody: F3_MELODY }) },
    clear: { step: 0.15, verb: 0.22, intro: 0, schedule: scheduleClearStep },
    over: { step: 0.34, verb: 0.42, intro: 0, schedule: scheduleOverStep },
  };
  // 章ごとの通常戦闘曲とボス曲を組み立てる
  [1, 2, 3].forEach((chapter) => {
    const set = BATTLE_SETS[chapter];
    const variant = BOSS_VARIANTS[chapter];
    TRACKS["battle" + chapter] = { step: STEP_SECONDS, verb: 0.12, intro: -16, schedule: (s, w) => scheduleBattleStep(s, w, set) };
    TRACKS["boss" + chapter] = { step: BOSS_STEP_SECONDS, verb: 0.1, intro: -12, schedule: (s, w) => scheduleBossStep(s, w, variant) };
  });

  function switchTrack(name, { restart = false } = {}) {
    if (!ensure()) return;
    if (name === currentTrack && !restart) return;
    const track = TRACKS[name] || TRACKS.field1;
    const now = ctx.currentTime;
    const outgoing = bgmBuses[activeBus];
    outgoing.gain.cancelScheduledValues(now);
    outgoing.gain.setValueAtTime(outgoing.gain.value, now);
    outgoing.gain.linearRampToValueAtTime(0, now + CROSSFADE);
    activeBus = 1 - activeBus;
    const incoming = bgmBuses[activeBus];
    incoming.gain.cancelScheduledValues(now);
    incoming.gain.setValueAtTime(0, now);
    incoming.gain.linearRampToValueAtTime(1, now + CROSSFADE * 0.75);
    bgmVerbSend.gain.setTargetAtTime(track.verb, now, 0.25);
    currentTrack = name;
    trackStep = track.intro;
    nextStepAt = now + 0.04;
  }

  function pumpMusic() {
    if (!ctx || ctx.state !== "running" || document.hidden) return;
    const desired = trackForState(getState && getState());
    if (desired !== currentTrack) switchTrack(desired);
    const track = TRACKS[currentTrack] || TRACKS.field1;
    while (nextStepAt < ctx.currentTime + 0.12) {
      const when = Math.max(0, nextStepAt - ctx.currentTime);
      track.schedule(trackStep++, when);
      nextStepAt += track.step;
    }
  }

  function startBattle() {
    if (!ensure()) return;
    const desired = trackForState(getState && getState());
    switchTrack(desired, { restart: true });
    sfx(desired.startsWith("boss") ? "bossAppear" : "battleStart");
  }

  // ==================== 効果音 ====================

  function sfx(kind) {
    if (!ensure()) return;
    if (["starImpact", "starBurst", "moonBurst", "critical", "bossDefeat", "bossAppear", "spark", "chapterStart"].includes(kind)) duck(650, 0.18);
    else if (["hit", "normalImpact", "slash", "blade", "staffImpact", "enemy"].includes(kind)) duck(200, 0.55);
    else if (kind === "win") duck(1900, 0.3);
    if (kind === "silence") { duck(520, 0.06); return; }

    if (kind === "blade" || kind === "slash") {
      noiseBurst({ duration: 0.022, gain: 0.24, frequency: 7200, type: "highpass", attack: 0.0006 });
      noiseBurst({ duration: 0.2, gain: 0.2, frequency: 3200, type: "highpass" });
      oscillator({ frequency: 1820, endFrequency: 360, duration: 0.16, type: "sawtooth", gain: 0.09 });
      oscillator({ frequency: 2600, endFrequency: 900, duration: 0.1, type: "sine", gain: 0.05, when: 0.01 });
      oscillator({ frequency: 250, endFrequency: 88, duration: 0.21, type: "triangle", gain: 0.11, when: 0.012 });
    } else if (kind === "normalImpact" || kind === "hit") {
      noiseBurst({ duration: 0.028, gain: 0.3, frequency: 5200, type: "highpass", attack: 0.0006 });
      noiseBurst({ duration: 0.17, gain: 0.22, frequency: 950, type: "bandpass", q: 0.7 });
      oscillator({ frequency: 330, endFrequency: 70, duration: 0.23, type: "triangle", gain: 0.21 });
      oscillator({ frequency: 128, endFrequency: 42, duration: 0.32, type: "sine", gain: 0.18 });
      oscillator({ frequency: 800, endFrequency: 300, duration: 0.09, type: "square", gain: 0.055, when: 0.006 });
    } else if (kind === "staffSwing") {
      noiseBurst({ duration: 0.11, gain: 0.095, frequency: 2100, type: "highpass" });
      oscillator({ frequency: 520, endFrequency: 250, duration: 0.1, type: "triangle", gain: 0.045 });
    } else if (kind === "staffImpact") {
      noiseBurst({ duration: 0.025, gain: 0.2, frequency: 4200, type: "highpass", attack: 0.0006 });
      noiseBurst({ duration: 0.14, gain: 0.19, frequency: 700, type: "bandpass", q: 0.55 });
      oscillator({ frequency: 300, endFrequency: 88, duration: 0.2, type: "triangle", gain: 0.19 });
      oscillator({ frequency: 120, endFrequency: 46, duration: 0.26, type: "sine", gain: 0.13 });
      oscillator({ frequency: 880, endFrequency: 520, duration: 0.06, type: "sine", gain: 0.05, when: 0.006 });
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
      // 駆け上がり → 長三和音で着地、ティンパニ風の連打つき
      [72, 76, 79, 84].forEach((note, i) => {
        const t = i * 0.105;
        oscillator({ frequency: midi(note), duration: 0.14, type: "sawtooth", gain: 0.075, attack: 0.008, when: t });
        oscillator({ frequency: midi(note), duration: 0.13, type: "square", gain: 0.03, when: t, detune: 7 });
        oscillator({ frequency: midi(note - 12), duration: 0.13, type: "triangle", gain: 0.05, when: t });
      });
      const land = 0.46;
      [72, 76, 79, 84, 88].forEach((note, i) => {
        oscillator({ frequency: midi(note), endFrequency: midi(note - 0.15), duration: 1.6, type: "sawtooth", gain: 0.052 - i * 0.006, attack: 0.02, when: land, detune: i * 5 - 10 });
        bell(note + 12, { duration: 1.4, gain: 0.015, when: land });
      });
      oscillator({ frequency: midi(36), endFrequency: midi(35.6), duration: 1.7, type: "sine", gain: 0.13, when: land });
      oscillator({ frequency: midi(48), duration: 1.5, type: "triangle", gain: 0.055, when: land });
      [0, 0.08, 0.16].forEach((t, i) => {
        oscillator({ frequency: 112 - i * 9, endFrequency: 54, duration: 0.24, type: "sine", gain: 0.12, when: land + t });
        noiseBurst({ duration: 0.1, gain: 0.035, frequency: 430, type: "lowpass", when: land + t });
      });
      noiseBurst({ duration: 1.0, gain: 0.028, frequency: 7000, type: "highpass", when: land, curve: 0.9 });
    } else if (kind === "level") {
      // レベルアップ: 駆け上がってから和音で着地
      [67, 71, 74, 79, 83, 86].forEach((note, i) => {
        oscillator({ frequency: midi(note), duration: 0.16, type: "triangle", gain: 0.055, when: i * 0.062 });
        oscillator({ frequency: midi(note + 12), duration: 0.1, type: "sine", gain: 0.016, when: i * 0.062 });
      });
      [79, 83, 86, 91].forEach((note) => oscillator({ frequency: midi(note), duration: 0.85, type: "triangle", gain: 0.038, attack: 0.02, when: 0.4 }));
      noiseBurst({ duration: 0.6, gain: 0.02, frequency: 6800, type: "highpass", when: 0.4 });
    } else if (kind === "miss") {
      noiseBurst({ duration: 0.12, gain: 0.045, frequency: 2400, type: "highpass" });
      oscillator({ frequency: 310, endFrequency: 155, duration: 0.17, type: "triangle", gain: 0.04 });

    // ---------- ここから追加の効果音 ----------
    } else if (kind === "step" || kind === "step1" || kind === "step2" || kind === "step3") {
      // 足音: 章ごとに床の質感を変える(石/土/石畳)
      const variant = kind === "step2" ? 2 : kind === "step3" ? 3 : 1;
      const jitter = 0.9 + Math.random() * 0.2;
      if (variant === 2) {
        noiseBurst({ duration: 0.07, gain: 0.026, frequency: 780 * jitter, type: "lowpass", q: 0.7, curve: 2.4 });
        oscillator({ frequency: 138 * jitter, endFrequency: 82, duration: 0.06, type: "sine", gain: 0.022 });
      } else if (variant === 3) {
        noiseBurst({ duration: 0.055, gain: 0.03, frequency: 2400 * jitter, type: "bandpass", q: 1.4 });
        oscillator({ frequency: 320 * jitter, endFrequency: 170, duration: 0.05, type: "triangle", gain: 0.02 });
      } else {
        noiseBurst({ duration: 0.06, gain: 0.032, frequency: 1500 * jitter, type: "bandpass", q: 1.1 });
        oscillator({ frequency: 190 * jitter, endFrequency: 105, duration: 0.055, type: "triangle", gain: 0.026 });
      }
    } else if (kind === "bump") {
      // 壁にぶつかる
      noiseBurst({ duration: 0.09, gain: 0.07, frequency: 420, type: "lowpass", q: 0.8 });
      oscillator({ frequency: 150, endFrequency: 68, duration: 0.11, type: "triangle", gain: 0.055 });
    } else if (kind === "menuOpen") {
      [72, 79].forEach((note, i) => oscillator({ frequency: midi(note), duration: 0.09, type: "square", gain: 0.032, when: i * 0.045 }));
      noiseBurst({ duration: 0.08, gain: 0.012, frequency: 5600, type: "highpass" });
    } else if (kind === "menuClose") {
      [79, 72].forEach((note, i) => oscillator({ frequency: midi(note), duration: 0.08, type: "square", gain: 0.028, when: i * 0.04 }));
    } else if (kind === "cursor") {
      oscillator({ frequency: midi(84), duration: 0.045, type: "square", gain: 0.028 });
    } else if (kind === "confirm") {
      [76, 83].forEach((note, i) => oscillator({ frequency: midi(note), duration: 0.1, type: "triangle", gain: 0.045, when: i * 0.05 }));
    } else if (kind === "cancel") {
      oscillator({ frequency: midi(67), endFrequency: midi(60), duration: 0.13, type: "square", gain: 0.035 });
    } else if (kind === "potion") {
      // 小瓶のコルクと、こくりと飲む音
      oscillator({ frequency: 900, endFrequency: 1700, duration: 0.05, type: "sine", gain: 0.05 });
      [0, 1, 2].forEach((i) => oscillator({ frequency: 320 - i * 45, endFrequency: 230 - i * 40, duration: 0.075, type: "sine", gain: 0.045, when: 0.1 + i * 0.085 }));
      [76, 81, 84].forEach((note, i) => oscillator({ frequency: midi(note), duration: 0.3, type: "sine", gain: 0.03, attack: 0.02, when: 0.32 + i * 0.05 }));
    } else if (kind === "itemGet") {
      // 戦利品の入手ジングル
      [72, 76, 79, 84].forEach((note, i) => {
        oscillator({ frequency: midi(note), duration: 0.13, type: "triangle", gain: 0.05, when: i * 0.058 });
        bell(note + 12, { duration: 0.45, gain: 0.012, when: i * 0.058 });
      });
      noiseBurst({ duration: 0.35, gain: 0.018, frequency: 7200, type: "highpass", when: 0.12 });
    } else if (kind === "shrine") {
      // 祭壇・泉・星詠みの環: 荘厳な全回復
      [60, 67, 72, 76, 79, 84].forEach((note, i) => {
        oscillator({ frequency: midi(note), duration: 1.5 - i * 0.09, type: "sine", gain: 0.045, attack: 0.05, when: i * 0.09 });
        bell(note + 12, { duration: 1.3, gain: 0.014, when: i * 0.09 });
      });
      noiseBurst({ duration: 1.2, gain: 0.02, frequency: 6200, type: "highpass", when: 0.15, curve: 0.9 });
      oscillator({ frequency: midi(36), duration: 1.8, type: "sine", gain: 0.05, attack: 0.25, when: 0.05 });
    } else if (kind === "guard") {
      // 構えの金属音
      noiseBurst({ duration: 0.13, gain: 0.075, frequency: 1900, type: "bandpass", q: 2.2 });
      oscillator({ frequency: 480, endFrequency: 330, duration: 0.22, type: "triangle", gain: 0.05, attack: 0.008 });
      oscillator({ frequency: 1440, endFrequency: 1180, duration: 0.3, type: "sine", gain: 0.022, when: 0.015 });
    } else if (kind === "charge") {
      // ためる: 気を練り上げる
      oscillator({ frequency: 140, endFrequency: 620, duration: 0.62, type: "sawtooth", gain: 0.05, attack: 0.12 });
      oscillator({ frequency: midi(64), endFrequency: midi(76), duration: 0.58, type: "triangle", gain: 0.035, attack: 0.1 });
      noiseBurst({ duration: 0.55, gain: 0.022, frequency: 3200, type: "highpass", attack: 0.2 });
    } else if (kind === "spark") {
      // ワザ閃き
      noiseBurst({ duration: 0.22, gain: 0.06, frequency: 7000, type: "highpass" });
      [84, 88, 91, 96].forEach((note, i) => oscillator({ frequency: midi(note), duration: 0.3, type: "sine", gain: 0.05, when: i * 0.045 }));
      [72, 79, 84].forEach((note) => oscillator({ frequency: midi(note), duration: 1.0, type: "triangle", gain: 0.03, attack: 0.02, when: 0.22 }));
      oscillator({ frequency: midi(48), duration: 0.7, type: "sine", gain: 0.05, when: 0.22 });
    } else if (kind === "flee") {
      // 逃走成功
      noiseBurst({ duration: 0.3, gain: 0.06, frequency: 2800, type: "highpass" });
      [72, 74, 76, 79, 81].forEach((note, i) => oscillator({ frequency: midi(note), duration: 0.09, type: "square", gain: 0.032, when: i * 0.05 }));
    } else if (kind === "fleeFail") {
      noiseBurst({ duration: 0.16, gain: 0.055, frequency: 700, type: "lowpass" });
      oscillator({ frequency: midi(55), endFrequency: midi(48), duration: 0.3, type: "square", gain: 0.04 });
    } else if (kind === "defeat") {
      // 雑魚撃破
      noiseBurst({ duration: 0.34, gain: 0.11, frequency: 900, type: "lowpass", curve: 1.3 });
      oscillator({ frequency: 300, endFrequency: 60, duration: 0.4, type: "sawtooth", gain: 0.08 });
      [84, 79, 72].forEach((note, i) => oscillator({ frequency: midi(note), duration: 0.14, type: "sine", gain: 0.03, when: 0.06 + i * 0.05 }));
    } else if (kind === "bossDefeat") {
      // ボス撃破: 崩れ落ちる質量感
      noiseBurst({ duration: 1.1, gain: 0.19, frequency: 480, type: "lowpass", curve: 1.05 });
      noiseBurst({ duration: 0.5, gain: 0.09, frequency: 2200, type: "bandpass", when: 0.04 });
      oscillator({ frequency: 160, endFrequency: 32, duration: 1.2, type: "sine", gain: 0.2 });
      oscillator({ frequency: 90, endFrequency: 28, duration: 1.35, type: "triangle", gain: 0.1, when: 0.08 });
      [96, 91, 84, 79, 72].forEach((note, i) => oscillator({ frequency: midi(note), duration: 0.5, type: "sine", gain: 0.03, when: 0.2 + i * 0.075 }));
    } else if (kind === "bossAppear") {
      // ボス出現
      oscillator({ frequency: 60, endFrequency: 28, duration: 1.3, type: "sine", gain: 0.2 });
      noiseBurst({ duration: 0.8, gain: 0.13, frequency: 380, type: "lowpass", curve: 1.1 });
      [39, 40, 45].forEach((note, i) => oscillator({ frequency: midi(note), endFrequency: midi(note - 0.5), duration: 1.1, type: "sawtooth", gain: 0.055, attack: 0.06, when: i * 0.02 }));
      noiseBurst({ duration: 0.35, gain: 0.07, frequency: 3400, type: "highpass", when: 0.5 });
    } else if (kind === "gameOver") {
      noiseBurst({ duration: 0.7, gain: 0.09, frequency: 520, type: "lowpass", curve: 1.2 });
      oscillator({ frequency: 180, endFrequency: 40, duration: 1.1, type: "triangle", gain: 0.12 });
      [65, 62, 58, 53].forEach((note, i) => oscillator({ frequency: midi(note), endFrequency: midi(note - 0.4), duration: 0.9, type: "triangle", gain: 0.045, attack: 0.03, when: 0.25 + i * 0.22 }));
    } else if (kind === "lowHp") {
      // HP危険域の警告
      [0, 0.17].forEach((offset) => {
        oscillator({ frequency: midi(89), duration: 0.1, type: "square", gain: 0.038, when: offset });
        oscillator({ frequency: midi(77), duration: 0.1, type: "square", gain: 0.02, when: offset });
      });
    } else if (kind === "chapterStart") {
      // 章の始まり: 静かな上昇
      [48, 55, 60, 64, 67, 72].forEach((note, i) => {
        oscillator({ frequency: midi(note), duration: 1.4 - i * 0.1, type: "triangle", gain: 0.04, attack: 0.12, when: i * 0.13 });
        bell(note + 12, { duration: 1.1, gain: 0.01, when: i * 0.13 });
      });
      noiseBurst({ duration: 1.4, gain: 0.016, frequency: 5000, type: "highpass", attack: 0.5, curve: 0.8 });
    }
  }

  function destroy() {
    if (scheduler) window.clearInterval(scheduler);
    scheduler = 0;
    if (ctx) ctx.close();
    ctx = null;
  }

  return {
    ensure,
    setEnabled,
    setVolumes,
    startBattle,
    duck,
    sfx,
    destroy,
    get track() { return currentTrack; },
    get volumes() { return { bgm: bgmVolume, se: seVolume }; },
  };
}

export const AUDIO_DESIGN = Object.freeze({
  bpm: 162,
  bossBpm: 172,
  battleBars: 16,
  battleDurationSeconds: BATTLE_STEPS * STEP_SECONDS,
  bgmVolume: BGM_VOLUME,
  seVolume: SE_VOLUME,
  tracks: ["field1", "field2", "field3", "battle1", "battle2", "battle3", "boss1", "boss2", "boss3", "clear", "over"],
});

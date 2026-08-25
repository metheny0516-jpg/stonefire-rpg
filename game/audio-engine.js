const BGM_VOLUME = 0.9;
const SE_VOLUME = 0.58;
const STEP_SECONDS = 60 / 162 / 4;
const BOSS_STEP_SECONDS = 60 / 172 / 4;
const BATTLE_STEPS = 16 * 16;
const CROSSFADE = 0.6;

// ==================== 通常戦闘 (162BPM / 16小節) ====================
// 16小節を2小節ずつ8スロットに分け、章ごとに和音と旋律を丸ごと差し替える。
const BATTLE_SECTIONS = Object.freeze(['A', 'A', 'B', 'A', 'A', 'B', 'B', 'C']);
const BATTLE_BASS = Object.freeze([0, 0, 7, 0, 12, 0, 7, 5]);
const BATTLE_KICKS = Object.freeze([0, 6, 8, 14]);

const BATTLE_SETS = Object.freeze({
  // 第1章「石牢」: Dハーモニックマイナー。短い動機の反復で押す
  1: Object.freeze({
    chords: [
      [38, 45, 50],
      [38, 45, 50],
      [34, 41, 46],
      [36, 43, 48],
      [38, 45, 50],
      [31, 38, 43],
      [33, 40, 45],
      [38, 45, 50],
    ],
    A: [74, 74, 77, 81, 79, 77, 74, 72, 74, 77, 81, 84, 82, 81, 79, 77],
    B: [86, 84, 82, 81, 79, 81, 82, 84, 81, 79, 77, 74, 77, 74, 73, 74],
    lead: 'sawtooth',
    counter: 'square',
    stab: 'sawtooth',
    drive: 1,
  }),
  // 第2章「月影の森」: Aマイナー。滑らかに駆ける旋律
  2: Object.freeze({
    chords: [
      [33, 40, 45],
      [33, 40, 45],
      [36, 43, 48],
      [38, 45, 50],
      [29, 36, 41],
      [36, 43, 48],
      [40, 44, 47],
      [33, 40, 45],
    ],
    A: [69, 72, 76, 72, 74, 76, 79, 76, 72, 69, 71, 72, 74, 72, 71, 69],
    B: [81, 79, 76, 79, 81, 84, 81, 79, 77, 76, 74, 72, 74, 76, 74, 71],
    lead: 'sawtooth',
    counter: 'triangle',
    stab: 'sawtooth',
    drive: 0.94,
  }),
  // 第3章「星骸の塔」: Eマイナー。高音域で切り込む
  3: Object.freeze({
    chords: [
      [40, 47, 52],
      [40, 47, 52],
      [36, 43, 48],
      [38, 45, 50],
      [33, 40, 45],
      [43, 47, 50],
      [35, 42, 47],
      [40, 47, 52],
    ],
    A: [88, 88, 83, 88, 91, 88, 83, 79, 81, 83, 86, 88, 86, 83, 81, 79],
    B: [95, 93, 91, 88, 91, 88, 86, 83, 84, 86, 88, 91, 88, 86, 83, 81],
    lead: 'sawtooth',
    counter: 'square',
    stab: 'sawtooth',
    drive: 1.1,
  }),
  // 第4章「黄昏の塔」: Cマイナー。重く沈む刻み
  4: Object.freeze({
    chords: [
      [36, 43, 48],
      [36, 43, 48],
      [41, 48, 53],
      [39, 46, 51],
      [34, 41, 46],
      [39, 46, 51],
      [43, 47, 50],
      [36, 43, 48],
    ],
    A: [72, 72, 75, 79, 78, 75, 72, 68, 70, 72, 75, 80, 79, 75, 72, 67],
    B: [84, 83, 80, 79, 75, 79, 80, 83, 82, 80, 75, 72, 75, 72, 71, 72],
    lead: 'sawtooth',
    counter: 'square',
    stab: 'sawtooth',
    drive: 1.05,
  }),
});

// --- 第1章「石牢」: 低く沈んだ短調、水滴の反響 ---
const F1_CHORDS = Object.freeze([
  [45, 48, 52],
  [41, 45, 48],
  [36, 40, 43],
  [43, 47, 50],
]);
const F1_MELODY = Object.freeze([
  69, 72, 74, 76, 74, 72, 69, 67, 69, 72, 76, 79, 77, 76, 74, 72, 67, 69, 72, 74, 72, 69, 67, 65, 64, 67, 69,
  72, 71, 69, 67, 64,
]);

// --- 第2章「月影の森」: ドリアン旋法のやわらかい歩調 ---
const F2_CHORDS = Object.freeze([
  [38, 41, 45],
  [43, 47, 50],
  [45, 48, 52],
  [41, 45, 48],
]);
const F2_MELODY = Object.freeze([
  69, 71, 72, 74, 76, 74, 72, 71, 69, 67, 69, 71, 72, 71, 69, 67, 65, 67, 69, 71, 72, 74, 76, 77, 76, 74, 72,
  71, 69, 67, 65, 64,
]);

// --- 第3章「星骸の塔」: リディアン、鐘と空気感 ---
const F3_CHORDS = Object.freeze([
  [36, 43, 52],
  [38, 45, 54],
  [41, 48, 55],
  [43, 50, 57],
]);
const F3_MELODY = Object.freeze([
  76, 78, 79, 83, 81, 79, 78, 76, 74, 76, 78, 81, 83, 81, 79, 78, 79, 83, 86, 88, 86, 83, 81, 79, 78, 76, 74,
  78, 79, 78, 76, 74,
]);

// --- 第4章「黄昏の塔」: ハーモニックマイナー、鐘と低い唸り ---
const F4_CHORDS = Object.freeze([
  [33, 40, 45],
  [38, 45, 50],
  [36, 43, 48],
  [40, 44, 47],
]);
const F4_MELODY = Object.freeze([
  69, 68, 69, 72, 74, 72, 69, 68, 65, 68, 69, 72, 71, 69, 68, 65, 64, 65, 68, 69, 72, 71, 69, 68, 69, 72, 76,
  72, 71, 68, 69, 69,
]);

// --- ボス戦: 172BPM、Dマイナーの追い立てるリフ ---
const BOSS_CHORDS = Object.freeze([
  [38, 41, 45],
  [38, 41, 45],
  [34, 38, 41],
  [34, 38, 41],
  [36, 40, 43],
  [36, 40, 43],
  [33, 37, 40],
  [33, 37, 40],
]);
const BOSS_MELODY = Object.freeze([
  74, 74, 81, 74, 80, 79, 77, 74, 73, 74, 77, 81, 79, 77, 74, 72, 74, 74, 81, 74, 82, 81, 79, 77, 76, 77, 81,
  84, 82, 81, 79, 77, 81, 84, 86, 84, 82, 81, 79, 77, 76, 79, 82, 86, 84, 82, 79, 76, 74, 81, 86, 89, 88, 86,
  84, 81, 79, 81, 84, 81, 77, 74, 73, 74,
]);
const BOSS_BASS = Object.freeze([0, 0, 12, 0, 7, 0, 12, 5, 0, 0, 12, 7, 5, 7, 3, 0]);
// ボス曲は章ごとに移調と音色を変えて、同じ曲に聞こえないようにする。
const BOSS_VARIANTS = Object.freeze({
  1: Object.freeze({ shift: 0, lead: 'sawtooth', bass: 'square' }),
  2: Object.freeze({ shift: -3, lead: 'square', bass: 'sawtooth' }),
  3: Object.freeze({ shift: 4, lead: 'sawtooth', bass: 'square' }),
  4: Object.freeze({ shift: -5, lead: 'square', bass: 'sawtooth' }),
});

// --- 勝利/章クリア: 明るいハ長調のループ ---
const CLEAR_CHORDS = Object.freeze([
  [48, 55, 64],
  [53, 60, 69],
  [50, 57, 65],
  [55, 62, 71],
]);
const CLEAR_MELODY = Object.freeze([
  72, 72, 72, 76, 79, 79, 79, 84, 83, 81, 79, 81, 79, 0, 0, 0, 77, 77, 79, 81, 79, 77, 76, 74, 72, 74, 76, 79,
  77, 0, 0, 0,
]);

// --- ゲームオーバー: 沈む挽歌 ---
const OVER_CHORDS = Object.freeze([
  [38, 45, 50],
  [36, 43, 48],
  [34, 41, 46],
  [33, 40, 45],
]);
const OVER_MELODY = Object.freeze([74, 72, 70, 69, 67, 65, 62, 0, 65, 64, 62, 60, 62, 0, 0, 0]);

function midi(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function impulseResponse(ctx, seconds = 1.5, decay = 2.6) {
  // 単なるノイズの減衰ではなく、初期反射を数発置いてから尾を伸ばす。
  // 左右で反射位置と乱数列を変えて、広がりのある残響にする。
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * seconds);
  const buffer = ctx.createBuffer(2, length, rate);
  const taps = [
    [0.011, 0.5],
    [0.019, 0.42],
    [0.031, 0.34],
    [0.047, 0.26],
    [0.068, 0.2],
  ];
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    const skew = channel === 0 ? 1 : 1.13;
    for (let i = 0; i < length; i += 1) {
      const t = i / length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * 0.6;
    }
    taps.forEach(([time, amp], k) => {
      const at = Math.floor(rate * time * skew);
      if (at < length) data[at] += (k % 2 ? -amp : amp) * (channel ? 0.9 : 1);
    });
  }
  return buffer;
}

// 打撃用の短い部屋鳴り。長い尾を持たせない。
// ホール残響(1.5秒)に打撃を送ると、余韻が伸びて「ポーン」と鳴ってしまう。
function roomResponse(ctx, seconds = 0.22) {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * seconds);
  const buffer = ctx.createBuffer(2, length, rate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    const skew = channel === 0 ? 1 : 1.17;
    for (let i = 0; i < length; i += 1) {
      const t = i / length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 7) * 0.5;
    }
    [
      [0.004, 0.7],
      [0.009, 0.5],
      [0.016, 0.34],
      [0.026, 0.2],
    ].forEach(([time, amp], k) => {
      const at = Math.floor(rate * time * skew);
      if (at < length) data[at] += k % 2 ? -amp : amp;
    });
  }
  return buffer;
}

// 潰れるまで叩き込むためのハードクリップ。tanh より角が立つ。
function clipCurve(drive = 4, ceiling = 0.9) {
  const n = 2048;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const x = (i / (n - 1)) * 2 - 1;
    const y = Math.max(-1, Math.min(1, x * drive));
    curve[i] = Math.sign(y) * Math.pow(Math.abs(y), 0.8) * ceiling;
  }
  return curve;
}

// tanh 風の飽和カーブ。倍音が増えて、同じ音量でも前に出る。
function saturationCurve(amount = 3) {
  const n = 2048;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
  }
  return curve;
}

// 録音された効果音。合成では出せない質感はこちらを使う。
// すべて CC0 (Kenney / Still North Media)。出典は audio/CREDITS.md。
const SAMPLES = Object.freeze({
  punch: ['punch_000', 'punch_001', 'punch_002', 'punch_003'],
  metal: ['metal_000', 'metal_001', 'metal_002'],
  plate: ['plate_000', 'plate_001', 'plate_002'],
  mining: ['mining_000', 'mining_001', 'mining_002'],
  slice: ['knifeslice', 'knifeslice2'],
  chop: ['chop'],
  swordClash: ['sword_clash'],
  drawKnife: ['drawknife1'],
  metalClick: ['metalclick'],
  coins: ['handlecoins'],
  doorOpen: ['dooropen_1'],
  doorClose: ['doorclose_1'],
  stepStone: ['step_concrete_000', 'step_concrete_001', 'step_concrete_002'],
  stepGrass: ['step_grass_000', 'step_grass_001', 'step_grass_002'],
  stepWood: ['step_wood_000', 'step_wood_001', 'step_wood_002'],
});
const SAMPLE_BASE = './audio/';

export function trackForState(state) {
  if (!state) return 'field1';
  if (state.mode === 'over') return 'over';
  if (state.mode === 'clear') return 'clear';
  const chapter = Math.max(1, Math.min(4, state.chapter || 1));
  if (state.mode === 'battle') {
    const boss = (state.enemies || []).some(e => e && e.boss) || !!(state.enemy && state.enemy.boss);
    return (boss ? 'boss' : 'battle') + chapter;
  }
  return 'field' + chapter;
}

export function createGameAudio({ getState, enabled = true } = {}) {
  let ctx = null;
  let master = null;
  let limiter = null;
  let sfxSat = null;
  let punchBus = null;
  let punchClip = null;
  let roomVerb = null;
  let roomSend = null;
  let leadSat = null;
  let leadBus = null;
  let musicEcho = null;
  const sampleBuffers = {};
  const sampleFailed = {};
  let samplesRequested = false;
  let sampleCount = 0;
  let echoL = null,
    echoR = null,
    echoFb = null,
    echoTone = null,
    echoSend = null;
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
  let currentTrack = 'field1';
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
      reverbSend.gain.value = 0.07;
      bgmVerbSend.gain.value = 0.16;
      bgmBuses = [ctx.createGain(), ctx.createGain()];
      bgmBuses[0].gain.value = 1;
      bgmBuses[1].gain.value = 0;
      bgmBuses.forEach(b => b.connect(bgmMaster));
      bgmMaster.connect(master);
      bgmMaster.connect(bgmVerbSend).connect(reverb);
      // 効果音は飽和させてから出す。倍音が増えて打撃が前に出る。
      sfxSat = ctx.createWaveShaper();
      sfxSat.curve = saturationCurve(2.2);
      sfxSat.oversample = '4x';
      sfxBus.connect(sfxSat);
      sfxSat.connect(master);
      sfxSat.connect(reverbSend).connect(reverb);
      reverb.connect(master);

      // 打撃専用バス。ハードクリップで角を立ててから効果音バスへ。
      punchClip = ctx.createWaveShaper();
      punchClip.curve = clipCurve(3.4, 0.9);
      punchClip.oversample = '2x';
      punchBus = ctx.createGain();
      punchBus.gain.value = 0.62;
      punchBus.connect(punchClip);
      punchClip.connect(sfxBus);

      // 打撃だけに使う短い部屋鳴り。ホール残響とは別系統。
      roomVerb = ctx.createConvolver();
      roomVerb.buffer = roomResponse(ctx);
      roomSend = ctx.createGain();
      roomSend.gain.value = 0.9;
      roomSend.connect(roomVerb);
      roomVerb.connect(master);

      // 主旋律用の飽和バス。鋸波をここに通すと芯が出る。
      leadSat = ctx.createWaveShaper();
      leadSat.curve = saturationCurve(1.6);
      leadSat.oversample = '2x';
      leadBus = ctx.createGain();
      leadBus.gain.value = 1;
      leadBus.connect(leadSat);
      leadSat.connect(bgmMaster);

      // 左右で時間差をつけた反響。主旋律と打撃を空間に置く。
      echoL = ctx.createDelay(1.2);
      echoR = ctx.createDelay(1.2);
      echoL.delayTime.value = 0.26;
      echoR.delayTime.value = 0.39;
      echoFb = ctx.createGain();
      echoFb.gain.value = 0.32;
      echoTone = ctx.createBiquadFilter();
      echoTone.type = 'lowpass';
      echoTone.frequency.value = 2600;
      echoSend = ctx.createGain();
      echoSend.gain.value = 1;
      // 送りは音量調整より前に分岐するので、そのままだと BGM を絞っても
      // 反響だけ残ってしまう。音楽用の送りは BGM 音量に追従させる。
      musicEcho = ctx.createGain();
      musicEcho.gain.value = bgmVolume;
      musicEcho.connect(echoSend);
      const panL = ctx.createStereoPanner();
      const panR = ctx.createStereoPanner();
      panL.pan.value = -0.72;
      panR.pan.value = 0.72;
      echoSend.connect(echoL);
      echoSend.connect(echoR);
      echoL.connect(panL).connect(master);
      echoR.connect(panR).connect(master);
      echoL.connect(echoTone);
      echoR.connect(echoTone);
      echoTone.connect(echoFb);
      echoFb.connect(echoL);
      echoFb.connect(echoR);
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
      loadSamples();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function bus() {
    return bgmBuses[activeBus];
  }

  // ---- 録音素材の読み込みと再生 ----
  // 読み込みは最初の操作のあとに始まる。届くまでは合成側だけが鳴るので、
  // 読み込み中でも無音にはならない。
  function loadSamples() {
    if (!ctx || samplesRequested) return;
    samplesRequested = true;
    const names = [];
    Object.values(SAMPLES).forEach(list => list.forEach(n => names.push(n)));
    [...new Set(names)].forEach(name => {
      fetch(SAMPLE_BASE + name + '.ogg')
        .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then(buf => ctx.decodeAudioData(buf))
        .then(decoded => {
          sampleBuffers[name] = decoded;
          sampleCount += 1;
        })
        .catch(() => {
          sampleFailed[name] = true;
        });
    });
  }

  function haveSample(key) {
    const list = SAMPLES[key];
    if (!list) return false;
    return list.some(n => sampleBuffers[n]);
  }

  // 録音素材を鳴らす。鳴らせたら true を返す。
  function playSample(
    key,
    { gain = 0.5, when = 0, rate = 1, pan = 0, verb = 0, fade = 0, bus: target = null } = {},
  ) {
    if (!ensure()) return false;
    const list = SAMPLES[key];
    if (!list) return false;
    const ready = list.filter(n => sampleBuffers[n]);
    if (!ready.length) return false;
    const buffer = sampleBuffers[ready[(Math.random() * ready.length) | 0]];
    const start = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    const out = ctx.createGain();
    src.buffer = buffer;
    src.playbackRate.value = Math.max(0.25, rate);
    out.gain.value = Math.max(0, gain);
    // 実録素材は余韻が長いものがある。連打で滲むので fade で尾を刈る。
    if (fade > 0) {
      out.gain.setValueAtTime(Math.max(0.0002, gain), start);
      out.gain.exponentialRampToValueAtTime(0.0001, start + fade);
    }
    let tail = out;
    if (pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      out.connect(p);
      tail = p;
    }
    src.connect(out);
    tail.connect(target || punchBus || sfxBus);
    if (verb > 0 && roomSend) {
      const v = ctx.createGain();
      v.gain.value = verb;
      tail.connect(v).connect(roomSend);
    }
    src.start(start);
    if (fade > 0) src.stop(start + fade + 0.02);
    return true;
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
    if (musicEcho) musicEcho.gain.setTargetAtTime(bgmVolume, ctx.currentTime, 0.02);
    sfxBus.gain.setTargetAtTime(seVolume, ctx.currentTime, 0.02);
  }

  function oscillator({
    frequency,
    endFrequency = frequency,
    duration = 0.12,
    type = 'sine',
    gain = 0.08,
    attack = 0.004,
    when = 0,
    bus: target = null,
    detune = 0,
    pan = 0,
  }) {
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
    if (pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      osc
        .connect(envelope)
        .connect(p)
        .connect(target || sfxBus);
    } else {
      osc.connect(envelope).connect(target || sfxBus);
    }
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }

  function noiseBurst({
    duration = 0.12,
    gain = 0.12,
    frequency = 1200,
    type = 'bandpass',
    q = 0.8,
    when = 0,
    attack = 0.002,
    bus: target = null,
    curve = 1.7,
    pan = 0,
    frequencyEnd = null,
  }) {
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
    if (frequencyEnd != null) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, frequencyEnd), start + duration);
    }
    filter.Q.value = q;
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    if (pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      source
        .connect(filter)
        .connect(envelope)
        .connect(p)
        .connect(target || sfxBus);
    } else {
      source
        .connect(filter)
        .connect(envelope)
        .connect(target || sfxBus);
    }
    source.start(start);
    source.stop(start + duration + 0.03);
  }

  // ---- レゾナンス付きフィルターを通す音源 ----
  // SNES期のリード/ベースの要は「フィルターが時間で閉じていくこと」。
  // 素の波形を鳴らすだけだと、どれだけ音量を上げても薄いままになる。
  function voice({
    frequency,
    endFrequency = frequency,
    duration = 0.2,
    type = 'sawtooth',
    gain = 0.05,
    attack = 0.006,
    decay = null,
    sustain = 0.6,
    when = 0,
    bus: target = null,
    // フィルター
    cutoff = 3200,
    cutoffEnd = null,
    resonance = 6,
    // 厚み
    unison = 1,
    spread = 8,
    pan = 0,
    // 揺らぎ
    vibrato = 0,
    vibratoRate = 5.5,
    // 送り
    echo = 0,
    verb = 0,
  }) {
    if (!ensure()) return;
    const start = ctx.currentTime + when;
    const end = start + duration;
    const out = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const panner = ctx.createStereoPanner();
    filter.type = 'lowpass';
    filter.Q.value = resonance;
    const c0 = Math.max(80, cutoff);
    const c1 = Math.max(80, cutoffEnd == null ? cutoff * 0.35 : cutoffEnd);
    filter.frequency.setValueAtTime(c0, start);
    filter.frequency.exponentialRampToValueAtTime(c1, end);
    panner.pan.value = Math.max(-1, Math.min(1, pan));

    const peak = Math.max(0.0002, gain);
    const dcy = decay == null ? Math.min(0.12, duration * 0.35) : decay;
    out.gain.setValueAtTime(0.0001, start);
    out.gain.exponentialRampToValueAtTime(peak, start + attack);
    out.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * sustain), start + attack + dcy);
    out.gain.exponentialRampToValueAtTime(0.0001, end);

    let lfo = null;
    let lfoGain = null;
    if (vibrato > 0) {
      lfo = ctx.createOscillator();
      lfoGain = ctx.createGain();
      lfo.frequency.value = vibratoRate;
      lfoGain.gain.setValueAtTime(0, start);
      lfoGain.gain.linearRampToValueAtTime(vibrato, start + Math.min(0.18, duration * 0.5));
      lfo.connect(lfoGain);
      lfo.start(start);
      lfo.stop(end + 0.05);
    }

    const n = Math.max(1, Math.min(3, unison));
    for (let i = 0; i < n; i += 1) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.detune.value = n === 1 ? 0 : (i - (n - 1) / 2) * spread * 2;
      osc.frequency.setValueAtTime(Math.max(20, frequency), start);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), end);
      if (lfoGain) lfoGain.connect(osc.detune);
      osc.connect(filter);
      osc.start(start);
      osc.stop(end + 0.04);
    }
    filter.connect(out).connect(panner);
    panner.connect(target || bgmMaster);
    if (echo > 0 && echoSend) {
      const dest = target === sfxBus || target === punchBus ? echoSend : musicEcho || echoSend;
      const e = ctx.createGain();
      e.gain.value = echo;
      panner.connect(e).connect(dest);
    }
    if (verb > 0 && reverb) {
      const v = ctx.createGain();
      v.gain.value = verb;
      panner.connect(v).connect(reverb);
    }
  }

  // ---- 録音素材 + 合成サブ の複合打撃 ----
  // 録音は質感と立ち上がりを担当し、低域が足りないぶんを合成のサブで足す。
  // 素材が未読込のときは合成側(impact)だけで鳴らすので無音にはならない。
  function sampledHit({
    keys = ['punch'],
    when = 0,
    power = 1,
    rate = 1,
    pan = 0,
    verb = 0.3,
    fade = 0,
    sub = 58,
    subLen = 0.12,
    subGain = 0.5,
    fallback = null,
  }) {
    if (!ensure()) return false;
    let played = false;
    for (const key of keys) {
      if (playSample(key, { gain: 0.95 * power, when, rate, pan, verb, fade })) {
        played = true;
        break;
      }
    }
    if (!played && typeof fallback === 'function') fallback();
    if (sub > 0) {
      oscillator({
        frequency: sub * 1.5,
        endFrequency: sub * 0.8,
        duration: subLen,
        type: 'sine',
        gain: subGain * power,
        attack: 0.001,
        when,
        bus: punchBus || sfxBus,
      });
    }
    return played;
  }

  // ---- 打撃の芯 ----
  // ほぼ全部を短いノイズで組む。音程のある音を長く伸ばすと
  // 途端に「ポーン」と柔らかく鳴ってしまうため。
  function impact({
    when = 0,
    power = 1,
    tone = 1,
    body = 220,
    sub = 58,
    click = 6000,
    noiseLen = 0.1,
    verb = 0.25,
    weight = 1,
  }) {
    if (!ensure()) return;
    const out = punchBus || sfxBus;
    // 「ポーン」と鳴るのは、長く伸びる音程のある音が入っているから。
    // 重い打撃はほぼ全部が短いノイズで、音程を感じさせない。
    // 1) アタック: 5ms で終わる広帯域の一撃
    noiseBurst({
      duration: 0.008,
      gain: 0.55 * power,
      frequency: 110,
      type: 'highpass',
      attack: 0.0004,
      when,
      bus: out,
      curve: 1.0,
    });
    noiseBurst({
      duration: 0.016,
      gain: 0.45 * power,
      frequency: click * tone,
      type: 'highpass',
      attack: 0.0004,
      when,
      bus: out,
      curve: 3.5,
    });
    // 2) 潰れる質感: 帯域の違う短いノイズを僅かにずらして重ねる
    [
      [body * 1.0, 0.05, 0.36],
      [body * 3.2, 0.034, 0.28],
      [body * 8.0, 0.022, 0.18],
    ].forEach(([f, dur, g], k) => {
      noiseBurst({
        duration: dur + noiseLen * 0.25,
        gain: g * power,
        frequency: f * tone,
        frequencyEnd: f * tone * 0.42,
        type: 'bandpass',
        q: 1.1,
        attack: 0.0006,
        when: when + k * 0.004,
        bus: out,
        curve: 2.4,
      });
    });
    // 3) 胴体: ローパスした短い塊。これが「ドッ」の重さ
    noiseBurst({
      duration: 0.07 + noiseLen * 0.35,
      gain: 0.44 * power * weight,
      frequency: body * 1.7 * tone,
      frequencyEnd: 85,
      type: 'lowpass',
      q: 0.7,
      attack: 0.0008,
      when,
      bus: out,
      curve: 2.0,
    });
    // 4) サブ: 短く、掃引も浅く。ここを長く下げると途端に「ポーン」になる
    oscillator({
      frequency: sub * 1.4,
      endFrequency: sub * 0.86,
      duration: 0.065 + noiseLen * 0.3,
      type: 'sine',
      gain: 0.46 * power * weight,
      attack: 0.001,
      when,
      bus: out,
    });
    // 5) 部屋鳴り: 短い残響だけ。ホールへは送らない
    if (verb > 0 && roomSend) {
      noiseBurst({
        duration: 0.028,
        gain: 0.3 * power * verb,
        frequency: body * 2.2,
        type: 'bandpass',
        when,
        bus: roomSend,
      });
    }
  }

  // 鐘・チャイム系: 基音 + 非整数倍音でガラス質の響きを作る
  function bell(
    note,
    { duration = 1.1, gain = 0.03, when = 0, bus: target = null, bright = 1, echo = 0, pan = 0 } = {},
  ) {
    const base = midi(note);
    oscillator({ frequency: base, duration, type: 'sine', gain, attack: 0.006, when, bus: target, pan });
    oscillator({
      frequency: base * 2.76,
      duration: duration * 0.55,
      type: 'sine',
      gain: gain * 0.32 * bright,
      attack: 0.004,
      when,
      bus: target,
    });
    oscillator({
      frequency: base * 5.4,
      duration: duration * 0.28,
      type: 'sine',
      gain: gain * 0.14 * bright,
      attack: 0.003,
      when,
      bus: target,
    });
    if (echo > 0 && echoSend) {
      oscillator({
        frequency: base,
        duration: duration * 0.5,
        type: 'sine',
        gain: gain * echo,
        attack: 0.01,
        when,
        bus: musicEcho || echoSend,
      });
    }
  }

  function pad(
    notes,
    { duration = 2.2, gain = 0.012, when = 0, bus: target = null, type = 'triangle' } = {},
  ) {
    notes.forEach((note, index) => {
      oscillator({
        frequency: midi(note),
        endFrequency: midi(note - 0.25),
        duration,
        type,
        gain,
        attack: 0.35,
        when,
        bus: target,
        detune: index * 4 - 4,
      });
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
    // 芯のあるキック: クリック + ピッチを落とす胴 + サブ
    noiseBurst({
      duration: 0.012,
      gain: gain * 1.6,
      frequency: 3800,
      type: 'highpass',
      attack: 0.0005,
      when,
      bus: bus(),
      curve: 3,
    });
    oscillator({
      frequency: 190,
      endFrequency: 44,
      duration: 0.14,
      type: 'triangle',
      gain: gain * 1.5,
      attack: 0.0008,
      when,
      bus: bus(),
    });
    oscillator({
      frequency: 82,
      endFrequency: 36,
      duration: 0.26,
      type: 'sine',
      gain: gain * 1.9,
      attack: 0.001,
      when,
      bus: bus(),
    });
  }

  function snare(when, gain = 0.065) {
    // 胴の鳴り + ざらついた高域 + 短い残響で奥行きを出す
    oscillator({
      frequency: 240,
      endFrequency: 155,
      duration: 0.09,
      type: 'triangle',
      gain: gain * 1.5,
      attack: 0.0008,
      when,
      bus: bus(),
    });
    noiseBurst({
      duration: 0.14,
      gain: gain * 2.3,
      frequency: 2200,
      frequencyEnd: 1100,
      type: 'bandpass',
      q: 0.6,
      attack: 0.0006,
      when,
      bus: bus(),
      curve: 1.4,
    });
    noiseBurst({
      duration: 0.05,
      gain: gain * 1.2,
      frequency: 7000,
      type: 'highpass',
      attack: 0.0005,
      when,
      bus: bus(),
      curve: 2.6,
    });
    if (reverb) {
      noiseBurst({
        duration: 0.06,
        gain: gain * 0.9,
        frequency: 2400,
        type: 'bandpass',
        when,
        bus: reverbSend,
      });
    }
  }

  function hat(when, open = false, gain = 1) {
    // 左右に軽く振って、刻みに横幅を出す
    noiseBurst({
      duration: open ? 0.12 : 0.03,
      gain: (open ? 0.03 : 0.022) * gain,
      frequency: 8200,
      frequencyEnd: open ? 5000 : 9000,
      type: 'highpass',
      q: 0.6,
      attack: 0.0005,
      when,
      bus: bus(),
      curve: open ? 1.6 : 3,
      pan: open ? 0.3 : -0.22,
    });
  }

  function shaker(when, gain = 0.012) {
    noiseBurst({
      duration: 0.06,
      gain,
      frequency: 8200,
      type: 'highpass',
      q: 0.4,
      when,
      bus: bus(),
      curve: 2.6,
    });
  }

  // ==================== BGM トラック ====================

  function scheduleBattleStep(step, when, set) {
    if (step < 0) {
      // 2小節のカウントイン: 下から駆け上がって戦闘へ突入する
      const intro = step + 16;
      const root = set.chords[0][0];
      if (intro === 0) {
        kick(when, 0.2);
        snare(when, 0.09);
        noiseBurst({
          duration: 0.5,
          gain: 0.13,
          frequency: 300,
          frequencyEnd: 4800,
          type: 'bandpass',
          attack: 0.4,
          when,
          bus: bus(),
        });
        voice({
          frequency: midi(root - 12),
          endFrequency: midi(root + 12),
          duration: 0.55,
          type: 'sawtooth',
          gain: 0.075,
          attack: 0.01,
          sustain: 0.8,
          cutoff: 900,
          cutoffEnd: 7000,
          resonance: 10,
          when,
          bus: bus(),
          unison: 2,
        });
      }
      if (intro === 8) {
        kick(when, 0.15);
        snare(when, 0.085);
      }
      if ([10, 12, 14, 15].includes(intro)) {
        const climb = [0, 3, 7, 10][[10, 12, 14, 15].indexOf(intro)];
        voice({
          frequency: midi(root + 24 + climb),
          duration: 0.11,
          type: set.lead,
          gain: 0.07,
          attack: 0.002,
          sustain: 0.4,
          cutoff: 6000,
          cutoffEnd: 2200,
          resonance: 9,
          when,
          bus: leadBus || bus(),
          echo: 0.2,
        });
        snare(when, 0.05 + climb * 0.004);
        hat(when, intro === 15);
      }
      return;
    }

    const loop = step % BATTLE_STEPS;
    const bar = Math.floor(loop / 16); // 0..15
    const slot = Math.floor(bar / 2); // 0..7 (2小節ごと)
    const beat = loop % 16;
    const chord = set.chords[slot];
    const section = BATTLE_SECTIONS[slot];
    const melody = section === 'A' ? set.A : set.B;
    const lift = section === 'C' ? 12 : 0; // 最後の2小節は1オクターブ上げて煽る
    const dense = section === 'C' || slot >= 5;
    const drive = set.drive;
    const lead = leadBus || bus();

    // --- ドラム ---
    if (BATTLE_KICKS.includes(beat)) kick(when, (beat === 0 ? 0.115 : 0.088) * drive);
    if (beat === 4 || beat === 12) snare(when, (dense ? 0.072 : 0.058) * drive);
    if (beat % 2 === 0) hat(when, beat === 14 && slot % 2 === 1);
    if (dense && beat % 4 === 3) hat(when, false, 0.55);
    if (section === 'C' && bar % 2 === 1 && beat >= 8 && beat % 2 === 0) {
      snare(when, (0.05 + (beat - 8) * 0.008) * drive);
    }

    // --- ベース: フィルターを閉じた鋸波。芯があって前に出る ---
    if (beat % 2 === 0) {
      const note = chord[0] - 12 + BATTLE_BASS[beat / 2];
      voice({
        frequency: midi(note),
        duration: 0.135,
        type: 'sawtooth',
        gain: 0.062 * drive,
        attack: 0.002,
        sustain: 0.45,
        cutoff: 900,
        cutoffEnd: 320,
        resonance: 7,
        when,
        bus: bus(),
      });
      if (beat === 0 || beat === 8) {
        oscillator({
          frequency: midi(chord[0] - 24),
          duration: 0.22,
          type: 'sine',
          gain: 0.035,
          when,
          bus: bus(),
        });
      }
    }

    // --- 刻みのコード。左右に開いて厚みを出す ---
    if (BATTLE_KICKS.includes(beat)) {
      [chord[0], chord[1], chord[2]].forEach((note, i) => {
        voice({
          frequency: midi(note + 12),
          duration: 0.1,
          type: set.stab,
          gain: (0.019 - i * 0.004) * drive,
          attack: 0.004,
          sustain: 0.4,
          cutoff: 2600,
          cutoffEnd: 1100,
          resonance: 4,
          when,
          bus: bus(),
          unison: 2,
          spread: 10,
          pan: i === 0 ? 0 : i === 1 ? -0.45 : 0.45,
        });
      });
    }

    // --- 裏拍の対旋律 ---
    if (beat % 4 === 2) {
      const counterNote = chord[(beat / 2 + slot) % chord.length] + 12;
      voice({
        frequency: midi(counterNote),
        duration: 0.09,
        type: set.counter,
        gain: 0.016,
        attack: 0.003,
        sustain: 0.35,
        cutoff: 3400,
        cutoffEnd: 1500,
        resonance: 5,
        when,
        bus: bus(),
        pan: 0.35,
      });
    }

    // --- 主旋律: 掛かったフィルター + ビブラート + 左右の反響 ---
    if (beat % 2 === 0) {
      const note = melody[((bar % 2) * 8 + beat / 2) % melody.length] + lift;
      const accent = beat % 8 === 0 ? 1.25 : beat % 4 === 0 ? 1.08 : 1;
      voice({
        frequency: midi(note),
        duration: 0.17,
        type: set.lead,
        gain: 0.042 * drive * accent,
        attack: 0.005,
        sustain: 0.62,
        cutoff: 4200 + accent * 1200,
        cutoffEnd: 1500,
        resonance: 8,
        when,
        bus: lead,
        unison: 2,
        spread: 7,
        vibrato: 6,
        vibratoRate: 6.2,
        echo: 0.18,
        verb: 0.1,
      });
      // オクターブ上を薄く重ねて煌めきを足す
      if (dense) {
        voice({
          frequency: midi(note + 12),
          duration: 0.1,
          type: 'triangle',
          gain: 0.013,
          attack: 0.004,
          sustain: 0.4,
          cutoff: 7000,
          cutoffEnd: 3000,
          resonance: 3,
          when: when + 0.008,
          bus: bus(),
          pan: -0.3,
        });
      }
    }
  }

  function scheduleBossStep(step, when, variant) {
    const lead = leadBus || bus();
    if (step < 0) {
      const intro = step + 12;
      if (intro === 0) {
        kick(when, 0.24);
        noiseBurst({
          duration: 0.7,
          gain: 0.14,
          frequency: 260,
          frequencyEnd: 1800,
          type: 'bandpass',
          attack: 0.5,
          when,
          bus: bus(),
        });
        voice({
          frequency: midi(26 + variant.shift),
          endFrequency: midi(38 + variant.shift),
          duration: 0.8,
          type: 'sawtooth',
          gain: 0.1,
          attack: 0.02,
          sustain: 0.9,
          cutoff: 500,
          cutoffEnd: 3200,
          resonance: 9,
          when,
          bus: bus(),
          unison: 3,
          spread: 12,
        });
      }
      if (intro === 6 || intro === 9) {
        snare(when, 0.1);
        kick(when, 0.16);
        voice({
          frequency: midi(50 + variant.shift + (intro - 6) * 2),
          duration: 0.16,
          type: 'square',
          gain: 0.055,
          attack: 0.002,
          sustain: 0.4,
          cutoff: 4000,
          cutoffEnd: 1400,
          resonance: 8,
          when,
          bus: lead,
          echo: 0.2,
        });
      }
      if (intro === 11) {
        noiseBurst({
          duration: 0.3,
          gain: 0.16,
          frequency: 6000,
          frequencyEnd: 1200,
          type: 'highpass',
          attack: 0.001,
          when,
          bus: bus(),
        });
      }
      return;
    }
    const loop = step % 128;
    const bar = Math.floor(loop / 16);
    const beat = loop % 16;
    const chord = BOSS_CHORDS[bar].map(n => n + variant.shift);
    const half = bar >= 4;

    // ドラム: 前へ前へと押すパターン
    if ([0, 3, 6, 8, 11, 14].includes(beat)) kick(when, beat === 0 ? 0.14 : 0.1);
    if (beat === 4 || beat === 12) snare(when, 0.088);
    if (half && (beat === 7 || beat === 15)) snare(when, 0.05);
    hat(when, beat === 14, 0.8);

    // 16分の刻みベース。フィルターを閉じて輪郭を出す
    const bassNote = chord[0] - 12 + BOSS_BASS[beat];
    voice({
      frequency: midi(bassNote),
      duration: 0.08,
      type: variant.bass,
      gain: 0.055,
      attack: 0.0015,
      sustain: 0.35,
      cutoff: 1100,
      cutoffEnd: 380,
      resonance: 8,
      when,
      bus: bus(),
    });
    if (beat % 4 === 0) {
      oscillator({
        frequency: midi(chord[0] - 24),
        duration: 0.26,
        type: 'sine',
        gain: 0.05,
        when,
        bus: bus(),
      });
    }

    // 刻むパワーコード。左右に開く
    if (beat % 2 === 0) {
      [chord[0], chord[0] + 7].forEach((note, i) => {
        voice({
          frequency: midi(note),
          duration: 0.1,
          type: variant.lead,
          gain: 0.02 - i * 0.005,
          attack: 0.004,
          sustain: 0.4,
          cutoff: 2400,
          cutoffEnd: 900,
          resonance: 5,
          when,
          bus: bus(),
          unison: 2,
          spread: 11,
          pan: i ? 0.4 : -0.4,
        });
      });
    }

    // ブラス風の主旋律
    const melodyNote = BOSS_MELODY[(bar * 8 + Math.floor(beat / 2)) % BOSS_MELODY.length] + variant.shift;
    if (beat % 2 === 0) {
      const accent = beat % 8 === 0 ? 1.3 : 1;
      voice({
        frequency: midi(melodyNote),
        duration: 0.16,
        type: variant.lead,
        gain: 0.05 * accent,
        attack: 0.006,
        sustain: 0.68,
        cutoff: 3600 + accent * 1400,
        cutoffEnd: 1300,
        resonance: 9,
        when,
        bus: lead,
        unison: 3,
        spread: 9,
        vibrato: 7,
        vibratoRate: 5.8,
        echo: 0.2,
        verb: 0.12,
      });
      if (half) {
        voice({
          frequency: midi(melodyNote + 12),
          duration: 0.1,
          type: 'triangle',
          gain: 0.014,
          attack: 0.004,
          sustain: 0.4,
          cutoff: 7000,
          cutoffEnd: 3200,
          resonance: 3,
          when: when + 0.008,
          bus: bus(),
          pan: 0.32,
        });
      }
    }

    // 8小節目の切り返しフィル
    if (bar === 7 && beat >= 12) {
      snare(when, 0.07 + (beat - 12) * 0.014);
      noiseBurst({
        duration: 0.05,
        gain: 0.035,
        frequency: 5200,
        type: 'highpass',
        when,
        bus: bus(),
      });
    }
  }

  function scheduleFieldStep(step, when, cfg) {
    const loop = step % 128;
    const phrase = Math.floor(loop / 32);
    const beat = loop % 32;
    const chord = cfg.chords[phrase];

    if (cfg.name === 'field1') {
      // 石牢: 低いドローンと、遠くで落ちる水滴
      if (beat === 0) {
        oscillator({
          frequency: midi(chord[0] - 12),
          endFrequency: midi(chord[0] - 12.2),
          duration: 5.2,
          type: 'sine',
          gain: 0.032,
          attack: 0.6,
          when,
          bus: bus(),
        });
        pad(chord, { duration: 4.4, gain: 0.009, when, bus: bus() });
      }
      if (beat % 4 === 0) {
        const note = cfg.melody[(loop / 4) % cfg.melody.length];
        bell(note, {
          duration: 1.25,
          gain: 0.026,
          when,
          bus: bus(),
          bright: 0.7,
          echo: 0.5,
          pan: (loop / 4) % 2 ? 0.28 : -0.28,
        });
      }
      if (beat === 18 && phrase % 2 === 1) {
        oscillator({
          frequency: 2100,
          endFrequency: 1450,
          duration: 0.16,
          type: 'sine',
          gain: 0.018,
          when,
          bus: bus(),
        });
        noiseBurst({
          duration: 0.1,
          gain: 0.006,
          frequency: 5200,
          type: 'highpass',
          when: when + 0.02,
          bus: bus(),
        });
      }
      if (beat === 8 || beat === 24)
        oscillator({
          frequency: midi(chord[0] - 24),
          duration: 1.1,
          type: 'sine',
          gain: 0.022,
          attack: 0.08,
          when,
          bus: bus(),
        });
      return;
    }

    if (cfg.name === 'field2') {
      // 月影の森: やわらかいアルペジオと木漏れ日のようなシェイカー
      if (beat % 8 === 0) {
        oscillator({
          frequency: midi(chord[0] - 12),
          duration: 1.5,
          type: 'triangle',
          gain: 0.03,
          attack: 0.06,
          when,
          bus: bus(),
        });
        pad(chord, { duration: 2.4, gain: 0.008, when, bus: bus() });
      }
      if (beat % 2 === 0) {
        const arp = chord[(beat / 2) % chord.length] + (beat % 8 >= 4 ? 12 : 0);
        oscillator({
          frequency: midi(arp),
          duration: 0.3,
          type: 'triangle',
          gain: 0.015,
          attack: 0.02,
          when,
          bus: bus(),
        });
      }
      if (beat % 4 === 2) shaker(when);
      if (beat % 4 === 0) {
        const note = cfg.melody[(loop / 4) % cfg.melody.length];
        voice({
          frequency: midi(note),
          endFrequency: midi(note - 0.2),
          duration: 0.66,
          type: 'triangle',
          gain: 0.032,
          attack: 0.05,
          sustain: 0.7,
          cutoff: 2600,
          cutoffEnd: 1100,
          resonance: 3,
          when,
          bus: bus(),
          vibrato: 4,
          vibratoRate: 4.6,
          echo: 0.35,
          pan: (loop / 4) % 2 ? 0.22 : -0.22,
        });
        oscillator({
          frequency: midi(note + 12),
          duration: 0.3,
          type: 'triangle',
          gain: 0.007,
          attack: 0.04,
          when,
          bus: bus(),
        });
      }
      return;
    }

    if (cfg.name === 'field4') {
      // 黄昏の塔: 低い唸りの上に、遠い鐘がゆっくり落ちてくる
      if (beat === 0) {
        oscillator({
          frequency: midi(chord[0] - 12),
          endFrequency: midi(chord[0] - 12.3),
          duration: 5.0,
          type: 'sawtooth',
          gain: 0.02,
          attack: 0.8,
          when,
          bus: bus(),
        });
        pad(chord, { duration: 4.2, gain: 0.011, when, bus: bus() });
      }
      if (beat % 8 === 0)
        oscillator({
          frequency: midi(chord[0] - 24),
          duration: 1.6,
          type: 'sine',
          gain: 0.03,
          attack: 0.12,
          when,
          bus: bus(),
        });
      if (beat % 4 === 0) {
        const note = cfg.melody[(loop / 4) % cfg.melody.length];
        bell(note, {
          duration: 1.9,
          gain: 0.028,
          when,
          bus: bus(),
          bright: 0.85,
          echo: 0.55,
          pan: (loop / 4) % 2 ? 0.25 : -0.25,
        });
      }
      if (beat % 16 === 10) {
        const echo = cfg.melody[(Math.floor(loop / 4) + 2) % cfg.melody.length] - 12;
        oscillator({
          frequency: midi(echo),
          duration: 0.9,
          type: 'triangle',
          gain: 0.012,
          attack: 0.1,
          when,
          bus: bus(),
        });
      }
      if (beat % 8 === 6)
        noiseBurst({
          duration: 0.7,
          gain: 0.005,
          frequency: 2600,
          type: 'bandpass',
          q: 0.4,
          when,
          bus: bus(),
          curve: 1.4,
        });
      return;
    }

    // field3 — 星骸の塔: 開けた響き、鐘、きらめき
    if (beat % 8 === 0) {
      pad(chord, { duration: 3.4, gain: 0.011, when, bus: bus(), type: 'sawtooth' });
      oscillator({
        frequency: midi(chord[0] - 12),
        duration: 2.6,
        type: 'sine',
        gain: 0.026,
        attack: 0.25,
        when,
        bus: bus(),
      });
    }
    if (beat % 4 === 0) {
      const note = cfg.melody[(loop / 4) % cfg.melody.length];
      bell(note, {
        duration: 1.6,
        gain: 0.025,
        when,
        bus: bus(),
        bright: 1.25,
        echo: 0.6,
        pan: (loop / 4) % 2 ? -0.32 : 0.32,
      });
    }
    if (beat % 8 === 5) {
      const shimmer = cfg.melody[(Math.floor(loop / 4) + 3) % cfg.melody.length] + 12;
      oscillator({
        frequency: midi(shimmer),
        duration: 0.42,
        type: 'sine',
        gain: 0.009,
        attack: 0.05,
        when,
        bus: bus(),
      });
    }
    if (beat % 16 === 12)
      noiseBurst({
        duration: 0.5,
        gain: 0.005,
        frequency: 7400,
        type: 'highpass',
        when,
        bus: bus(),
        curve: 1.1,
      });
  }

  function scheduleClearStep(step, when) {
    const loop = step % 128;
    const bar = Math.floor(loop / 32);
    const beat = loop % 32;
    const chord = CLEAR_CHORDS[bar];

    if (beat === 0) {
      kick(when, 0.09);
      pad(chord, { duration: 2.6, gain: 0.013, when, bus: bus() });
      oscillator({
        frequency: midi(chord[0] - 12),
        duration: 1.4,
        type: 'triangle',
        gain: 0.034,
        attack: 0.02,
        when,
        bus: bus(),
      });
    }
    if (beat === 16) {
      kick(when, 0.07);
      oscillator({
        frequency: midi(chord[0] - 5),
        duration: 0.9,
        type: 'triangle',
        gain: 0.028,
        attack: 0.02,
        when,
        bus: bus(),
      });
    }
    if (beat % 8 === 4) snare(when, 0.035);
    if (beat % 4 === 0) shaker(when, 0.009);

    if (beat % 4 === 0) {
      const note = CLEAR_MELODY[(loop / 4) % CLEAR_MELODY.length];
      if (note) {
        oscillator({
          frequency: midi(note),
          duration: 0.58,
          type: 'triangle',
          gain: 0.036,
          attack: 0.012,
          when,
          bus: bus(),
        });
        oscillator({
          frequency: midi(note + 7),
          duration: 0.5,
          type: 'sine',
          gain: 0.013,
          attack: 0.014,
          when,
          bus: bus(),
        });
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
      oscillator({
        frequency: midi(chord[0] - 12),
        endFrequency: midi(chord[0] - 12.4),
        duration: 5.6,
        type: 'sine',
        gain: 0.038,
        attack: 0.5,
        when,
        bus: bus(),
      });
    }
    if (beat % 4 === 0) {
      const note = OVER_MELODY[(loop / 4) % OVER_MELODY.length];
      if (note) {
        oscillator({
          frequency: midi(note),
          endFrequency: midi(note - 0.3),
          duration: 1.5,
          type: 'triangle',
          gain: 0.03,
          attack: 0.09,
          when,
          bus: bus(),
        });
        bell(note - 12, { duration: 1.8, gain: 0.01, when, bus: bus(), bright: 0.5 });
      }
    }
  }

  const TRACKS = {
    field1: {
      step: 0.21,
      verb: 0.34,
      intro: 0,
      schedule: (s, w) => scheduleFieldStep(s, w, { name: 'field1', chords: F1_CHORDS, melody: F1_MELODY }),
    },
    field2: {
      step: 0.19,
      verb: 0.2,
      intro: 0,
      schedule: (s, w) => scheduleFieldStep(s, w, { name: 'field2', chords: F2_CHORDS, melody: F2_MELODY }),
    },
    field3: {
      step: 0.22,
      verb: 0.3,
      intro: 0,
      schedule: (s, w) => scheduleFieldStep(s, w, { name: 'field3', chords: F3_CHORDS, melody: F3_MELODY }),
    },
    field4: {
      step: 0.2,
      verb: 0.38,
      intro: 0,
      schedule: (s, w) => scheduleFieldStep(s, w, { name: 'field4', chords: F4_CHORDS, melody: F4_MELODY }),
    },
    clear: { step: 0.15, verb: 0.22, intro: 0, schedule: scheduleClearStep },
    over: { step: 0.34, verb: 0.42, intro: 0, schedule: scheduleOverStep },
  };
  // 章ごとの通常戦闘曲とボス曲を組み立てる
  [1, 2, 3, 4].forEach(chapter => {
    const set = BATTLE_SETS[chapter];
    const variant = BOSS_VARIANTS[chapter];
    TRACKS['battle' + chapter] = {
      step: STEP_SECONDS,
      verb: 0.12,
      intro: -16,
      schedule: (s, w) => scheduleBattleStep(s, w, set),
    };
    TRACKS['boss' + chapter] = {
      step: BOSS_STEP_SECONDS,
      verb: 0.1,
      intro: -12,
      schedule: (s, w) => scheduleBossStep(s, w, variant),
    };
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
    if (!ctx || ctx.state !== 'running' || document.hidden) return;
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
    sfx(desired.startsWith('boss') ? 'bossAppear' : 'battleStart');
  }

  // ==================== 効果音 ====================

  function sfx(kind) {
    if (!ensure()) return;
    if (
      [
        'starImpact',
        'starBurst',
        'moonBurst',
        'critical',
        'bossDefeat',
        'bossAppear',
        'spark',
        'chapterStart',
      ].includes(kind)
    )
      duck(650, 0.18);
    else if (['hit', 'normalImpact', 'slash', 'blade', 'staffImpact', 'enemy'].includes(kind))
      duck(200, 0.55);
    else if (kind === 'win') duck(1900, 0.3);
    if (kind === 'silence') {
      duck(520, 0.06);
      return;
    }

    if (kind === 'blade' || kind === 'slash') {
      // 振り抜く風切り
      noiseBurst({
        duration: 0.12,
        gain: 0.17,
        frequency: 9000,
        frequencyEnd: 1900,
        type: 'highpass',
        attack: 0.004,
        when: 0,
        pan: -0.25,
      });
      // 刃が当たる瞬間: 実録の刃鳴りを主役に
      sampledHit({
        keys: ['swordClash', 'slice', 'metal'],
        when: 0.05,
        power: 1.0,
        fade: 0.3,
        rate: 1.05 + Math.random() * 0.12,
        pan: 0.12,
        verb: 0.3,
        sub: 62,
        subLen: 0.075,
        subGain: 0.26,
        fallback: () =>
          impact({
            when: 0.05,
            power: 1.05,
            tone: 1.6,
            body: 320,
            sub: 0,
            click: 8600,
            noiseLen: 0.11,
            weight: 0.62,
          }),
      });
    } else if (kind === 'normalImpact' || kind === 'hit') {
      sampledHit({
        keys: ['punch', 'plate'],
        power: 1.05,
        fade: 0.26,
        rate: 0.9 + Math.random() * 0.12,
        verb: 0.3,
        sub: 56,
        subLen: 0.15,
        subGain: 0.62,
        fallback: () =>
          impact({ power: 1.2, tone: 0.95, body: 235, sub: 0, click: 6000, noiseLen: 0.2, weight: 1.25 }),
      });
      // 追い打ちの短い胴鳴りで厚みを出す
      playSample('plate', { gain: 0.4, when: 0.012, rate: 0.82, pan: 0.2, verb: 0.2, fade: 0.22 });
    } else if (kind === 'staffSwing') {
      noiseBurst({ duration: 0.11, gain: 0.095, frequency: 2100, type: 'highpass' });
      oscillator({ frequency: 520, endFrequency: 250, duration: 0.1, type: 'triangle', gain: 0.045 });
    } else if (kind === 'staffImpact') {
      sampledHit({
        keys: ['chop', 'plate'],
        power: 0.95,
        fade: 0.24,
        rate: 0.85 + Math.random() * 0.1,
        verb: 0.28,
        sub: 52,
        subLen: 0.14,
        subGain: 0.5,
        fallback: () =>
          impact({ power: 1.05, tone: 0.78, body: 195, sub: 0, click: 4400, noiseLen: 0.18, weight: 1.15 }),
      });
    } else if (kind === 'dash' || kind === 'returnDash') {
      noiseBurst({ duration: 0.2, gain: 0.09, frequency: 2600, type: 'highpass' });
      oscillator({ frequency: 720, endFrequency: 1280, duration: 0.13, type: 'triangle', gain: 0.035 });
    } else if (kind === 'enemy') {
      // 被弾は一番重く、少し暗く
      sampledHit({
        keys: ['punch', 'plate'],
        power: 1.15,
        fade: 0.32,
        rate: 0.74 + Math.random() * 0.08,
        verb: 0.28,
        sub: 44,
        subLen: 0.19,
        subGain: 0.72,
        fallback: () =>
          impact({ power: 1.1, tone: 0.58, body: 150, sub: 0, click: 3000, noiseLen: 0.22, weight: 1.35 }),
      });
      playSample('mining', { gain: 0.34, when: 0.015, rate: 0.7, pan: -0.18, verb: 0.22, fade: 0.3 });
    } else if (kind === 'heal') {
      [72, 76, 79, 84].forEach((note, i) =>
        oscillator({
          frequency: midi(note),
          endFrequency: midi(note + 1),
          duration: 0.3,
          type: 'sine',
          gain: 0.055,
          attack: 0.015,
          when: i * 0.075,
        }),
      );
      noiseBurst({ duration: 0.34, gain: 0.025, frequency: 5200, type: 'highpass', when: 0.08 });
    } else if (kind === 'starCharge' || kind === 'fire') {
      noiseBurst({ duration: 0.42, gain: 0.11, frequency: 880, type: 'bandpass' });
      oscillator({ frequency: 105, endFrequency: 530, duration: 0.43, type: 'sawtooth', gain: 0.075 });
      oscillator({
        frequency: 280,
        endFrequency: 940,
        duration: 0.34,
        type: 'triangle',
        gain: 0.05,
        when: 0.07,
      });
    } else if (kind === 'starDash') {
      noiseBurst({ duration: 0.28, gain: 0.18, frequency: 3200, type: 'highpass' });
      oscillator({ frequency: 1480, endFrequency: 390, duration: 0.2, type: 'triangle', gain: 0.095 });
      oscillator({
        frequency: 185,
        endFrequency: 420,
        duration: 0.24,
        type: 'sawtooth',
        gain: 0.065,
        when: 0.018,
      });
    } else if (kind === 'starImpact' || kind === 'critical') {
      // ためてから叩き込む。0.06秒の吸い込みが「バシッ」を作る
      noiseBurst({
        duration: 0.06,
        gain: 0.1,
        frequency: 700,
        frequencyEnd: 5200,
        type: 'bandpass',
        attack: 0.05,
        when: 0,
      });
      // 実録を重ねて「ドガッ」の質量を出す
      sampledHit({
        keys: ['mining', 'punch'],
        when: 0.06,
        power: 1.4,
        rate: 0.72,
        verb: 0.5,
        fade: 0.45,
        sub: 40,
        subLen: 0.3,
        subGain: 0.95,
        fallback: () =>
          impact({
            when: 0.06,
            power: 1.9,
            tone: 1.25,
            body: 300,
            sub: 0,
            click: 9000,
            noiseLen: 0.3,
            weight: 1.4,
          }),
      });
      playSample('metal', { gain: 0.6, when: 0.072, rate: 0.85, pan: -0.35, verb: 0.4, fade: 0.35 });
      playSample('swordClash', { gain: 0.5, when: 0.062, rate: 0.9, pan: 0.35, verb: 0.4, fade: 0.4 });
      // 三層の金属の悲鳴を左右に振る
      [
        [1180, -0.4],
        [1760, 0.4],
        [2640, 0],
      ].forEach(([f, pan], i) => {
        voice({
          frequency: f,
          endFrequency: f * 0.3,
          duration: 0.36 - i * 0.05,
          type: 'sawtooth',
          gain: 0.075 - i * 0.014,
          attack: 0.001,
          sustain: 0.3,
          cutoff: 11000,
          cutoffEnd: 900,
          resonance: 11,
          when: 0.06 + i * 0.012,
          bus: sfxBus,
          pan,
          echo: 0.22,
          verb: 0.4,
        });
      });
      // 崩れ落ちる低域
      voice({
        frequency: 150,
        endFrequency: 34,
        duration: 0.6,
        type: 'square',
        gain: 0.16,
        attack: 0.001,
        sustain: 0.35,
        cutoff: 900,
        cutoffEnd: 120,
        resonance: 5,
        when: 0.06,
        bus: sfxBus,
      });
    } else if (kind === 'starBurst' || kind === 'burst') {
      noiseBurst({ duration: 0.48, gain: 0.25, frequency: 520, type: 'lowpass' });
      noiseBurst({ duration: 0.3, gain: 0.13, frequency: 1900, type: 'bandpass', when: 0.025 });
      oscillator({ frequency: 115, endFrequency: 38, duration: 0.46, type: 'sine', gain: 0.18 });
    } else if (kind === 'moonCast') {
      [76, 81, 88].forEach((note, i) =>
        oscillator({
          frequency: midi(note),
          endFrequency: midi(note + 2),
          duration: 0.4,
          type: 'sine',
          gain: 0.052,
          when: i * 0.07,
        }),
      );
      noiseBurst({ duration: 0.4, gain: 0.035, frequency: 4700, type: 'highpass' });
    } else if (kind === 'moonOrb') {
      oscillator({ frequency: 620, endFrequency: 1510, duration: 0.38, type: 'sine', gain: 0.075 });
      oscillator({
        frequency: 940,
        endFrequency: 1880,
        duration: 0.32,
        type: 'triangle',
        gain: 0.038,
        when: 0.04,
      });
      noiseBurst({ duration: 0.26, gain: 0.028, frequency: 5600, type: 'highpass', when: 0.05 });
    } else if (kind === 'moonShot') {
      noiseBurst({ duration: 0.2, gain: 0.085, frequency: 3300, type: 'highpass' });
      oscillator({ frequency: 1650, endFrequency: 620, duration: 0.28, type: 'sine', gain: 0.09 });
      oscillator({ frequency: 410, endFrequency: 760, duration: 0.22, type: 'triangle', gain: 0.04 });
    } else if (kind === 'moonHit') {
      noiseBurst({ duration: 0.15, gain: 0.11, frequency: 3600, type: 'highpass' });
      [84, 91, 96].forEach((note, i) =>
        oscillator({
          frequency: midi(note),
          endFrequency: midi(note - 2),
          duration: 0.2,
          type: 'sine',
          gain: 0.05,
          when: i * 0.025,
        }),
      );
      oscillator({ frequency: 175, endFrequency: 72, duration: 0.22, type: 'triangle', gain: 0.1 });
    } else if (kind === 'moonBurst') {
      noiseBurst({ duration: 0.42, gain: 0.16, frequency: 720, type: 'lowpass' });
      oscillator({ frequency: 138, endFrequency: 52, duration: 0.4, type: 'sine', gain: 0.15 });
      [940, 1410, 1880].forEach((frequency, i) =>
        oscillator({
          frequency,
          endFrequency: frequency * 0.64,
          duration: 0.34,
          type: 'sine',
          gain: 0.036,
          when: 0.05 + i * 0.035,
        }),
      );
    } else if (kind === 'battleStart') {
      noiseBurst({ duration: 0.24, gain: 0.16, frequency: 980, type: 'bandpass' });
      oscillator({ frequency: 92, endFrequency: 46, duration: 0.32, type: 'sine', gain: 0.14 });
      oscillator({
        frequency: midi(57),
        endFrequency: midi(69),
        duration: 0.48,
        type: 'triangle',
        gain: 0.07,
        when: 0.05,
      });
    } else if (kind === 'win') {
      // 駆け上がり → 長三和音で着地、ティンパニ風の連打つき
      [72, 76, 79, 84].forEach((note, i) => {
        const t = i * 0.105;
        oscillator({
          frequency: midi(note),
          duration: 0.14,
          type: 'sawtooth',
          gain: 0.075,
          attack: 0.008,
          when: t,
        });
        oscillator({ frequency: midi(note), duration: 0.13, type: 'square', gain: 0.03, when: t, detune: 7 });
        oscillator({ frequency: midi(note - 12), duration: 0.13, type: 'triangle', gain: 0.05, when: t });
      });
      const land = 0.46;
      [72, 76, 79, 84, 88].forEach((note, i) => {
        oscillator({
          frequency: midi(note),
          endFrequency: midi(note - 0.15),
          duration: 1.6,
          type: 'sawtooth',
          gain: 0.052 - i * 0.006,
          attack: 0.02,
          when: land,
          detune: i * 5 - 10,
        });
        bell(note + 12, { duration: 1.4, gain: 0.015, when: land });
      });
      oscillator({
        frequency: midi(36),
        endFrequency: midi(35.6),
        duration: 1.7,
        type: 'sine',
        gain: 0.13,
        when: land,
      });
      oscillator({ frequency: midi(48), duration: 1.5, type: 'triangle', gain: 0.055, when: land });
      [0, 0.08, 0.16].forEach((t, i) => {
        oscillator({
          frequency: 112 - i * 9,
          endFrequency: 54,
          duration: 0.24,
          type: 'sine',
          gain: 0.12,
          when: land + t,
        });
        noiseBurst({ duration: 0.1, gain: 0.035, frequency: 430, type: 'lowpass', when: land + t });
      });
      noiseBurst({ duration: 1.0, gain: 0.028, frequency: 7000, type: 'highpass', when: land, curve: 0.9 });
    } else if (kind === 'level') {
      // レベルアップ: 駆け上がってから和音で着地
      [67, 71, 74, 79, 83, 86].forEach((note, i) => {
        oscillator({ frequency: midi(note), duration: 0.16, type: 'triangle', gain: 0.055, when: i * 0.062 });
        oscillator({ frequency: midi(note + 12), duration: 0.1, type: 'sine', gain: 0.016, when: i * 0.062 });
      });
      [79, 83, 86, 91].forEach(note =>
        oscillator({
          frequency: midi(note),
          duration: 0.85,
          type: 'triangle',
          gain: 0.038,
          attack: 0.02,
          when: 0.4,
        }),
      );
      noiseBurst({ duration: 0.6, gain: 0.02, frequency: 6800, type: 'highpass', when: 0.4 });
    } else if (kind === 'miss') {
      noiseBurst({ duration: 0.12, gain: 0.045, frequency: 2400, type: 'highpass' });
      oscillator({ frequency: 310, endFrequency: 155, duration: 0.17, type: 'triangle', gain: 0.04 });

      // ---------- ここから追加の効果音 ----------
    } else if (
      kind === 'step' ||
      kind === 'step1' ||
      kind === 'step2' ||
      kind === 'step3' ||
      kind === 'step4'
    ) {
      // 章ごとに床の質感を変える。実録素材があればそちらを優先する。
      const ground = kind === 'step2' ? 'stepGrass' : kind === 'step4' ? 'stepWood' : 'stepStone';
      const jitter = 0.9 + Math.random() * 0.2;
      if (playSample(ground, { gain: 0.42, rate: jitter, pan: (Math.random() - 0.5) * 0.3, verb: 0.12 })) {
        return;
      }
      const variant = kind === 'step2' ? 2 : kind === 'step3' ? 3 : kind === 'step4' ? 4 : 1;
      if (variant === 2) {
        noiseBurst({
          duration: 0.07,
          gain: 0.026,
          frequency: 780 * jitter,
          type: 'lowpass',
          q: 0.7,
          curve: 2.4,
        });
        oscillator({ frequency: 138 * jitter, endFrequency: 82, duration: 0.06, type: 'sine', gain: 0.022 });
      } else if (variant === 4) {
        noiseBurst({ duration: 0.05, gain: 0.03, frequency: 1900 * jitter, type: 'bandpass', q: 1.7 });
        oscillator({
          frequency: 240 * jitter,
          endFrequency: 120,
          duration: 0.06,
          type: 'triangle',
          gain: 0.024,
        });
      } else {
        noiseBurst({ duration: 0.06, gain: 0.032, frequency: 1500 * jitter, type: 'bandpass', q: 1.1 });
        oscillator({
          frequency: 190 * jitter,
          endFrequency: 105,
          duration: 0.055,
          type: 'triangle',
          gain: 0.026,
        });
      }
    } else if (kind === 'bump') {
      // 壁にぶつかる
      noiseBurst({ duration: 0.09, gain: 0.07, frequency: 420, type: 'lowpass', q: 0.8 });
      oscillator({ frequency: 150, endFrequency: 68, duration: 0.11, type: 'triangle', gain: 0.055 });
    } else if (kind === 'menuOpen') {
      [72, 79].forEach((note, i) =>
        oscillator({ frequency: midi(note), duration: 0.09, type: 'square', gain: 0.032, when: i * 0.045 }),
      );
      noiseBurst({ duration: 0.08, gain: 0.012, frequency: 5600, type: 'highpass' });
    } else if (kind === 'menuClose') {
      [79, 72].forEach((note, i) =>
        oscillator({ frequency: midi(note), duration: 0.08, type: 'square', gain: 0.028, when: i * 0.04 }),
      );
    } else if (kind === 'cursor') {
      oscillator({ frequency: midi(84), duration: 0.045, type: 'square', gain: 0.028 });
    } else if (kind === 'confirm') {
      [76, 83].forEach((note, i) =>
        oscillator({ frequency: midi(note), duration: 0.1, type: 'triangle', gain: 0.045, when: i * 0.05 }),
      );
    } else if (kind === 'cancel') {
      oscillator({
        frequency: midi(67),
        endFrequency: midi(60),
        duration: 0.13,
        type: 'square',
        gain: 0.035,
      });
    } else if (kind === 'potion') {
      // 小瓶のコルクと、こくりと飲む音
      oscillator({ frequency: 900, endFrequency: 1700, duration: 0.05, type: 'sine', gain: 0.05 });
      [0, 1, 2].forEach(i =>
        oscillator({
          frequency: 320 - i * 45,
          endFrequency: 230 - i * 40,
          duration: 0.075,
          type: 'sine',
          gain: 0.045,
          when: 0.1 + i * 0.085,
        }),
      );
      [76, 81, 84].forEach((note, i) =>
        oscillator({
          frequency: midi(note),
          duration: 0.3,
          type: 'sine',
          gain: 0.03,
          attack: 0.02,
          when: 0.32 + i * 0.05,
        }),
      );
    } else if (kind === 'itemGet') {
      playSample('coins', { gain: 0.55, rate: 1.0, verb: 0.2 });
      // 戦利品の入手ジングル
      [72, 76, 79, 84].forEach((note, i) => {
        oscillator({ frequency: midi(note), duration: 0.13, type: 'triangle', gain: 0.05, when: i * 0.058 });
        bell(note + 12, { duration: 0.45, gain: 0.012, when: i * 0.058 });
      });
      noiseBurst({ duration: 0.35, gain: 0.018, frequency: 7200, type: 'highpass', when: 0.12 });
    } else if (kind === 'shrine') {
      // 祭壇・泉・星詠みの環: 荘厳な全回復
      [60, 67, 72, 76, 79, 84].forEach((note, i) => {
        oscillator({
          frequency: midi(note),
          duration: 1.5 - i * 0.09,
          type: 'sine',
          gain: 0.045,
          attack: 0.05,
          when: i * 0.09,
        });
        bell(note + 12, { duration: 1.3, gain: 0.014, when: i * 0.09 });
      });
      noiseBurst({ duration: 1.2, gain: 0.02, frequency: 6200, type: 'highpass', when: 0.15, curve: 0.9 });
      oscillator({ frequency: midi(36), duration: 1.8, type: 'sine', gain: 0.05, attack: 0.25, when: 0.05 });
    } else if (kind === 'guard') {
      // 構えの金属音
      noiseBurst({ duration: 0.13, gain: 0.075, frequency: 1900, type: 'bandpass', q: 2.2 });
      oscillator({
        frequency: 480,
        endFrequency: 330,
        duration: 0.22,
        type: 'triangle',
        gain: 0.05,
        attack: 0.008,
      });
      oscillator({
        frequency: 1440,
        endFrequency: 1180,
        duration: 0.3,
        type: 'sine',
        gain: 0.022,
        when: 0.015,
      });
    } else if (kind === 'charge') {
      // ためる: 気を練り上げる
      oscillator({
        frequency: 140,
        endFrequency: 620,
        duration: 0.62,
        type: 'sawtooth',
        gain: 0.05,
        attack: 0.12,
      });
      oscillator({
        frequency: midi(64),
        endFrequency: midi(76),
        duration: 0.58,
        type: 'triangle',
        gain: 0.035,
        attack: 0.1,
      });
      noiseBurst({ duration: 0.55, gain: 0.022, frequency: 3200, type: 'highpass', attack: 0.2 });
    } else if (kind === 'spark') {
      // ワザ閃き
      noiseBurst({ duration: 0.22, gain: 0.06, frequency: 7000, type: 'highpass' });
      [84, 88, 91, 96].forEach((note, i) =>
        oscillator({ frequency: midi(note), duration: 0.3, type: 'sine', gain: 0.05, when: i * 0.045 }),
      );
      [72, 79, 84].forEach(note =>
        oscillator({
          frequency: midi(note),
          duration: 1.0,
          type: 'triangle',
          gain: 0.03,
          attack: 0.02,
          when: 0.22,
        }),
      );
      oscillator({ frequency: midi(48), duration: 0.7, type: 'sine', gain: 0.05, when: 0.22 });
    } else if (kind === 'flee') {
      // 逃走成功
      noiseBurst({ duration: 0.3, gain: 0.06, frequency: 2800, type: 'highpass' });
      [72, 74, 76, 79, 81].forEach((note, i) =>
        oscillator({ frequency: midi(note), duration: 0.09, type: 'square', gain: 0.032, when: i * 0.05 }),
      );
    } else if (kind === 'fleeFail') {
      noiseBurst({ duration: 0.16, gain: 0.055, frequency: 700, type: 'lowpass' });
      oscillator({ frequency: midi(55), endFrequency: midi(48), duration: 0.3, type: 'square', gain: 0.04 });
    } else if (kind === 'defeat') {
      // 雑魚撃破
      noiseBurst({ duration: 0.34, gain: 0.11, frequency: 900, type: 'lowpass', curve: 1.3 });
      oscillator({ frequency: 300, endFrequency: 60, duration: 0.4, type: 'sawtooth', gain: 0.08 });
      [84, 79, 72].forEach((note, i) =>
        oscillator({
          frequency: midi(note),
          duration: 0.14,
          type: 'sine',
          gain: 0.03,
          when: 0.06 + i * 0.05,
        }),
      );
    } else if (kind === 'bossDefeat') {
      // ボス撃破: 崩れ落ちる質量感
      noiseBurst({ duration: 1.1, gain: 0.19, frequency: 480, type: 'lowpass', curve: 1.05 });
      noiseBurst({ duration: 0.5, gain: 0.09, frequency: 2200, type: 'bandpass', when: 0.04 });
      oscillator({ frequency: 160, endFrequency: 32, duration: 1.2, type: 'sine', gain: 0.2 });
      oscillator({
        frequency: 90,
        endFrequency: 28,
        duration: 1.35,
        type: 'triangle',
        gain: 0.1,
        when: 0.08,
      });
      [96, 91, 84, 79, 72].forEach((note, i) =>
        oscillator({ frequency: midi(note), duration: 0.5, type: 'sine', gain: 0.03, when: 0.2 + i * 0.075 }),
      );
    } else if (kind === 'bossAppear') {
      // ボス出現
      oscillator({ frequency: 60, endFrequency: 28, duration: 1.3, type: 'sine', gain: 0.2 });
      noiseBurst({ duration: 0.8, gain: 0.13, frequency: 380, type: 'lowpass', curve: 1.1 });
      [39, 40, 45].forEach((note, i) =>
        oscillator({
          frequency: midi(note),
          endFrequency: midi(note - 0.5),
          duration: 1.1,
          type: 'sawtooth',
          gain: 0.055,
          attack: 0.06,
          when: i * 0.02,
        }),
      );
      noiseBurst({ duration: 0.35, gain: 0.07, frequency: 3400, type: 'highpass', when: 0.5 });
    } else if (kind === 'gameOver') {
      noiseBurst({ duration: 0.7, gain: 0.09, frequency: 520, type: 'lowpass', curve: 1.2 });
      oscillator({ frequency: 180, endFrequency: 40, duration: 1.1, type: 'triangle', gain: 0.12 });
      [65, 62, 58, 53].forEach((note, i) =>
        oscillator({
          frequency: midi(note),
          endFrequency: midi(note - 0.4),
          duration: 0.9,
          type: 'triangle',
          gain: 0.045,
          attack: 0.03,
          when: 0.25 + i * 0.22,
        }),
      );
    } else if (kind === 'lowHp') {
      // HP危険域の警告
      [0, 0.17].forEach(offset => {
        oscillator({ frequency: midi(89), duration: 0.1, type: 'square', gain: 0.038, when: offset });
        oscillator({ frequency: midi(77), duration: 0.1, type: 'square', gain: 0.02, when: offset });
      });
    } else if (kind === 'chapterStart') {
      // 章の始まり: 静かな上昇
      [48, 55, 60, 64, 67, 72].forEach((note, i) => {
        oscillator({
          frequency: midi(note),
          duration: 1.4 - i * 0.1,
          type: 'triangle',
          gain: 0.04,
          attack: 0.12,
          when: i * 0.13,
        });
        bell(note + 12, { duration: 1.1, gain: 0.01, when: i * 0.13 });
      });
      noiseBurst({ duration: 1.4, gain: 0.016, frequency: 5000, type: 'highpass', attack: 0.5, curve: 0.8 });
    }
  }

  function destroy() {
    if (scheduler) window.clearInterval(scheduler);
    scheduler = 0;
    if (ctx) ctx.close();
    ctx = null;
  }

  return {
    // 計測用: OfflineAudioContext では時間が自動で進まないため、
    // スケジューラを外から回せるようにしておく
    pump: pumpMusic,
    get samplesLoaded() {
      return sampleCount;
    },
    hasSample: haveSample,
    ensure,
    setEnabled,
    setVolumes,
    startBattle,
    duck,
    sfx,
    destroy,
    get track() {
      return currentTrack;
    },
    get volumes() {
      return { bgm: bgmVolume, se: seVolume };
    },
  };
}

export const AUDIO_DESIGN = Object.freeze({
  bpm: 162,
  bossBpm: 172,
  battleBars: 16,
  battleDurationSeconds: BATTLE_STEPS * STEP_SECONDS,
  bgmVolume: BGM_VOLUME,
  seVolume: SE_VOLUME,
  tracks: [
    'field1',
    'field2',
    'field3',
    'field4',
    'battle1',
    'battle2',
    'battle3',
    'battle4',
    'boss1',
    'boss2',
    'boss3',
    'boss4',
    'clear',
    'over',
  ],
});

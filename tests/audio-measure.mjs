// 効果音の実測: OfflineAudioContext でレンダリングして波形を数値化する。
// 使い方: node tests/audio-measure.mjs slash hit critical
import { chromium } from 'playwright';
import fs from 'node:fs';

const KINDS = process.argv.slice(2);
if (!KINDS.length) KINDS.push('slash');
const BROWSER = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const browser = await chromium.launch({
  executablePath: BROWSER,
  args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox'],
});
const page = await browser.newPage();
page.on('console', m => {
  if (m.type() === 'error') console.error('[page]', m.text());
});
await page.goto('http://127.0.0.1:8798/index.html');

const out = await page.evaluate(async kinds => {
  const SR = 48000;
  const DUR = 2.0;
  const mod = await import('./game/audio-engine.js?measure=1');
  const results = {};
  for (const kind of kinds) {
    class MeasureCtx extends OfflineAudioContext {
      constructor() {
        super(2, SR * DUR, SR);
      }
      resume() {
        return Promise.resolve();
      }
      close() {
        return Promise.resolve();
      }
    }
    const realCtor = window.AudioContext;
    window.AudioContext = MeasureCtx;
    const audio = mod.createGameAudio({ getState: () => ({ mode: 'battle', chapter: 1 }) });
    const ctx = audio.ensure();
    audio.setVolumes({ bgm: 0, se: 1 });
    // 素材の読み込みを待つ (31点)
    const started = Date.now();
    while (audio.samplesLoaded < 31 && Date.now() - started < 15000) {
      await new Promise(r => setTimeout(r, 100));
    }
    const loaded = audio.samplesLoaded;
    audio.sfx(kind);
    const buf = await ctx.startRendering();
    window.AudioContext = realCtor;
    audio.destroy();

    const L = buf.getChannelData(0);
    const R = buf.getChannelData(1);
    const n = L.length;
    const mono = new Float32Array(n);
    for (let i = 0; i < n; i += 1) mono[i] = (L[i] + R[i]) / 2;

    let peak = 0;
    let peakAt = 0;
    for (let i = 0; i < n; i += 1) {
      const a = Math.abs(mono[i]);
      if (a > peak) {
        peak = a;
        peakAt = i;
      }
    }
    // 10ms 窓の RMS 包絡
    const win = Math.round(SR * 0.01);
    const env = [];
    for (let i = 0; i + win <= n; i += win) {
      let s = 0;
      for (let k = i; k < i + win; k += 1) s += mono[k] * mono[k];
      env.push(Math.sqrt(s / win));
    }
    const envPeak = Math.max(...env);
    const envPeakAt = env.indexOf(envPeak);
    // 減衰: 包絡ピークから -20dB を割るまで
    let decayMs = null;
    for (let i = envPeakAt; i < env.length; i += 1) {
      if (env[i] < envPeak * 0.1) {
        decayMs = (i - envPeakAt) * 10;
        break;
      }
    }
    // 立ち上がり: 包絡が 10% から 90% に達するまで
    let riseMs = null;
    let lo = null;
    for (let i = 0; i <= envPeakAt; i += 1) {
      if (lo === null && env[i] >= envPeak * 0.1) lo = i;
      if (lo !== null && env[i] >= envPeak * 0.9) {
        riseMs = (i - lo) * 10;
        break;
      }
    }
    // 帯域エネルギー比 (1次差分で高域、累積で低域を近似するのではなく DFT で)
    const N = 4096;
    const seg = mono.subarray(0, Math.min(N, n));
    const bands = { low: 0, mid: 0, high: 0, total: 0 };
    for (let k = 1; k < N / 2; k += 1) {
      const f = (k * SR) / N;
      if (f > 12000) break;
      let re = 0;
      let im = 0;
      for (let t = 0; t < seg.length; t += 1) {
        const w = (2 * Math.PI * k * t) / N;
        re += seg[t] * Math.cos(w);
        im -= seg[t] * Math.sin(w);
      }
      const p = re * re + im * im;
      bands.total += p;
      if (f < 200) bands.low += p;
      else if (f < 2000) bands.mid += p;
      else bands.high += p;
    }
    results[kind] = {
      loaded,
      peak: +peak.toFixed(3),
      peakAtMs: +((peakAt / SR) * 1000).toFixed(1),
      riseMs,
      decayMs,
      rms: +Math.sqrt(mono.reduce((s, v) => s + v * v, 0) / n).toFixed(4),
      lowRatio: +(bands.low / bands.total).toFixed(3),
      midRatio: +(bands.mid / bands.total).toFixed(3),
      highRatio: +(bands.high / bands.total).toFixed(3),
      envelope: env.slice(0, 60).map(v => +v.toFixed(3)),
      nonFinite: mono.some(v => !Number.isFinite(v)),
      wav: (() => {
        // 16bit PCM ステレオの WAV を base64 で返す (耳で確かめる用)
        const bytes = new DataView(new ArrayBuffer(44 + n * 4));
        const ascii = (o, t) => {
          for (let i = 0; i < t.length; i += 1) bytes.setUint8(o + i, t.charCodeAt(i));
        };
        ascii(0, 'RIFF');
        bytes.setUint32(4, 36 + n * 4, true);
        ascii(8, 'WAVEfmt ');
        bytes.setUint32(16, 16, true);
        bytes.setUint16(20, 1, true);
        bytes.setUint16(22, 2, true);
        bytes.setUint32(24, SR, true);
        bytes.setUint32(28, SR * 4, true);
        bytes.setUint16(32, 4, true);
        bytes.setUint16(34, 16, true);
        ascii(36, 'data');
        bytes.setUint32(40, n * 4, true);
        for (let i = 0; i < n; i += 1) {
          const a = Math.max(-1, Math.min(1, L[i])) * 32767;
          const b = Math.max(-1, Math.min(1, R[i])) * 32767;
          bytes.setInt16(44 + i * 4, a, true);
          bytes.setInt16(46 + i * 4, b, true);
        }
        let bin = '';
        const u8 = new Uint8Array(bytes.buffer);
        for (let i = 0; i < u8.length; i += 1) bin += String.fromCharCode(u8[i]);
        return btoa(bin);
      })(),
    };
  }
  return results;
}, KINDS);

for (const [kind, v] of Object.entries(out)) {
  if (v.wav && process.env.WAV_DIR) {
    fs.writeFileSync(`${process.env.WAV_DIR}/${kind}.wav`, Buffer.from(v.wav, 'base64'));
  }
  delete v.wav;
}
console.log(JSON.stringify(out, null, 2));
await browser.close();

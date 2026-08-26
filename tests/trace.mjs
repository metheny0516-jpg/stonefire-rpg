// 決定論的なプレイ記録を取るハーネス。
// Math.random を固定シードに差し替え、決められた手順で遊んで
// 各時点の状態を JSON で吐く。整形の前後でこれが完全一致すれば、
// 挙動が変わっていないと言える。
import { chromium } from 'playwright';
import fs from 'fs';

const SRC = process.argv[2] || 'game/main.js';
const URL = process.argv[3] || 'http://127.0.0.1:8798/';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errors.push('CONSOLE: ' + m.text()); });

// 乱数を固定
await page.addInitScript(() => {
  let s = 0x9e3779b9;
  Math.random = () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
});

// 状態を覗くフックを注入 (整形の前後どちらでも当たるよう正規表現で探す)
await page.route('**/main.js*', async route => {
  let body = fs.readFileSync(SRC, 'utf8');
  const re = /gameAudio\s*=\s*createGameAudio\([\s\S]*?\);/;
  if (!re.test(body)) throw new Error('instrumentation anchor not found in ' + SRC);
  body = body.replace(re, m =>
    m + 'window.__s=()=>state;window.__audio=gameAudio;window.__act=act;window.__start=startBattle;' +
    'window.__ch=(n)=>{if(n===2)startChapter2();if(n===3)startChapter3();if(n===4)startChapter4()};' +
    'window.__town=enterTown;window.__shop=openShop;window.__move=move;');
  await route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body });
});

const trace = [];
const snap = async (label) => {
  const s = await page.evaluate(() => {
    const st = window.__s ? window.__s() : null;
    if (!st) return null;
    const m = (p) => p ? { lv: p.lv, hp: p.hp, maxHp: p.maxHp, atk: p.atk, def: p.def, spd: p.spd,
      exp: p.exp, next: p.next, guarding: !!p.guarding, charged: !!p.charged,
      skills: (p.learnedSkills || []).join('|'), equip: JSON.stringify(p.equip || {}) } : null;
    return {
      mode: st.mode, chapter: st.chapter, floor: st.floor, x: st.x, y: st.y, dir: st.dir, steps: st.steps,
      gold: st.gold, busy: st.busy,
      hero: m(st.hero), mina: st.companion && st.companion.active ? m(st.companion) : null,
      teo: st.alchemist && st.alchemist.active ? m(st.alchemist) : null,
      inv: JSON.stringify(st.inventory), gear: JSON.stringify(st.gear),
      flags: JSON.stringify(st.storyFlags),
      enemies: (st.enemies || []).map(e => e.name + ':' + e.hp + '/' + e.maxHp).join(','),
      order: (st.order || []).map(u => u.k + (u.i !== undefined ? u.i : '')).join('>'),
      bossAlive: st.bossAlive, cleared: !!st.cleared,
      msg: (document.querySelector('#msg') || {}).textContent || '',
      overlay: (document.querySelector('#overlayCard h1') || {}).textContent || '',
      shown: document.querySelector('#overlay').className,
      title: (document.querySelector('.title') || {}).textContent || '',
      track: window.__audio ? window.__audio.track : '',
    };
  });
  trace.push({ label, s });
};

const wait = (ms) => page.waitForTimeout(ms);
const click = async (sel) => { await page.click(sel).catch(() => {}); await wait(320); };
const step = async (d) => {
  await page.evaluate(v => window.__move(v[0], v[1]),
    { up: [0,-1], down: [0,1], left: [-1,0], right: [1,0] }[d]);
  await wait(230);
};
// 戦闘を最後まで進める。行動は決め打ちの順番で回す。
const fightOut = async (plan, max = 40) => {
  let i = 0;
  for (let n = 0; n < max; n++) {
    const st = await page.evaluate(() => { const s = window.__s();
      return { mode: s.mode, busy: s.busy, tm: !!s.targetMenu, sm: !!s.skillMenu, im: !!s.itemMenu }; });
    if (st.mode !== 'battle') break;
    if (st.busy) { await wait(300); continue; }
    if (st.tm) { await page.locator('[data-target]:not([data-target="back"])').first().click().catch(()=>{}); }
    else if (st.sm) { await page.locator('[data-skill]:not([data-skill="back"])').first().click().catch(()=>{}); }
    else if (st.im) { await page.locator('[data-item]:not([data-item="back"])').first().click().catch(()=>{}); }
    else { await page.evaluate(a => window.__act(a), plan[i++ % plan.length]); }
    await wait(420);
  }
};

await page.goto(URL, { waitUntil: 'load' });
await page.evaluate(() => { localStorage.clear();
  // 音声エンジンはノイズ生成で Math.random を大量に消費するため、
  // 記録の再現性を保つには切っておく必要がある。
  localStorage.setItem('stonefire-audio-v1','off'); });
await page.reload({ waitUntil: 'load' });
await page.mouse.click(195, 300); await wait(300);
await page.locator('#overlayCard button', { hasText: 'この枠ではじめる' }).first().click().catch(()=>{});
await wait(600);
await snap('起動直後');

// --- 第1章: 歩く / 壁 / 祭壇 ---
for (const d of ['up','right','right','right','up','left','left']) await step(d);
await snap('1章を歩いた');
await step('up'); await snap('壁にぶつかる');

// --- 戦闘 (通常) ---
await page.evaluate(() => window.__start(['moss','bat']));
await wait(900); await snap('戦闘開始');
await fightOut(['attack','guard','wait','attack','attack','attack']);
await snap('戦闘終了');

// --- かばん / そうび / 旅 ---
await click('#bagBtn'); await snap('かばん');
await click('#openEquipBtn'); await snap('そうび');
await click('#equipBack'); await click('#closeBag');

// --- 町 / 店 / 合成 ---
await page.evaluate(() => window.__town()); await wait(500); await snap('町');
await page.evaluate(() => { const s = window.__s(); s.gold = 5000;
  Object.assign(s.inventory, { nightFeather: 6, shadowFang: 6, skyCrystal: 3, windSilk: 3 }); });
await page.evaluate(() => window.__shop('item')); await wait(400); await snap('道具屋');
await click('[data-shopmode="craft"]'); await snap('合成タブ');
await click('[data-craft="potion"]'); await snap('合成した');
await click('[data-shopmode="buy"]'); await click('[data-buy="potion"]'); await snap('買った');
await click('[data-shopmode="sell"]'); await click('[data-sell="nightFeather"]'); await snap('売った');
await click('#shopLeave');

// --- 章移動 ---
await page.evaluate(() => window.__ch(2)); await wait(700); await snap('2章開始');
await page.evaluate(() => window.__ch(3)); await wait(700); await snap('3章開始');
await page.evaluate(() => window.__ch(4)); await wait(700); await snap('4章開始');

// --- 塔: 宝箱 / 階段 / 落とし穴 ---
const put = (f,x,y) => page.evaluate(a => { const s = window.__s();
  s.floor=a.f; s.x=a.x; s.y=a.y; s.fx=a.x; s.fy=a.y; s.busy=false; }, {f,x,y});
await put(1,6,3); await step('right'); await snap('宝箱を開けた');
await put(1,6,3); await step('right'); await snap('宝箱ふたたび');
await put(1,10,1); await step('right'); await wait(400); await snap('2階へ');
await put(2,6,8); await step('up'); await wait(600); await snap('落とし穴');
await put(3,1,9); await step('down'); await wait(400); await snap('3階から下りる');

// --- ボス戦 ---
await page.evaluate(() => { const s = window.__s();
  s.hero.lv=30; s.hero.maxHp=900; s.hero.hp=900; s.hero.atk=300; s.hero.def=200;
  s.companion.active=true; s.companion.lv=30; s.companion.maxHp=900; s.companion.hp=900;
  s.companion.atk=300; s.companion.def=200; });
await put(3,7,2);
await page.evaluate(() => { window.__s().bossAlive = true; });
await step('up'); await wait(1200); await snap('ボス出現');
await fightOut(['attack'], 60);
await snap('ボス撃破');

await browser.close();
console.log(JSON.stringify({ trace, errors }, null, 1));

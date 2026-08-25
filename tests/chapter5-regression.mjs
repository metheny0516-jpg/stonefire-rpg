// 第5章「深淵の洞」: 2階層・迷路・宝箱・落とし穴・光苔・暗闇・ボスまでを通しで確認する。
import { chromium } from 'playwright';
import fs from 'fs';
const SRC = process.argv[2] || 'game/main.js';
const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox'],
});
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
p.setDefaultTimeout(6000);
const errs = [];
p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errs.push(m.text()); });
await p.route('**/main.js*', async r => {
  let body = fs.readFileSync(SRC, 'utf8').replace(
    /gameAudio\s*=\s*createGameAudio\([\s\S]*?\);/,
    m => m + 'window.__s=()=>state;window.__ch5=startChapter5;window.__move=move;window.__sync=sync;' +
      'window.__tile=tile;window.__floor=currentFloor;window.__label=floorLabel;window.__start=startBattle;'
  );
  await r.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body });
});
await p.goto('http://127.0.0.1:8798/', { waitUntil: 'load' });
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('stonefire-audio-v1', 'off'); });
await p.reload({ waitUntil: 'load' });
await p.mouse.click(195, 300); await p.waitForTimeout(300);
await p.locator('#overlayCard button', { hasText: 'この枠ではじめる' }).first().click().catch(() => {});
await p.waitForTimeout(600);

let pass = true;
const check = (name, cond, info = '') => { if (!cond) pass = false; console.log((cond ? 'OK  ' : 'NG  ') + name.padEnd(26) + info); };
const st = () => p.evaluate(() => {
  const s = window.__s();
  return { ch: s.chapter, floor: window.__floor(), label: window.__label(), x: s.x, y: s.y, mode: s.mode,
    moss: s.moss || 0, hp: s.hero.hp, gold: s.gold, msg: document.querySelector('#msg').textContent.slice(0, 44) };
});
// 指定のタイルまで、壁を避けて最短で歩く
const walkTo = async (tx, ty) => p.evaluate(async ([tx, ty]) => {
  const s = window.__s(), W = 16, H = 12;
  const key = (x, y) => x + ',' + y;
  let prev = {}, q = [[s.x, s.y]], seen = { [key(s.x, s.y)]: 1 };
  while (q.length) {
    const [x, y] = q.shift();
    if (x === tx && y === ty) break;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[key(nx, ny)]) continue;
      if (window.__tile(nx, ny) === '1') continue;
      seen[key(nx, ny)] = 1; prev[key(nx, ny)] = [x, y, dx, dy]; q.push([nx, ny]);
    }
  }
  if (!prev[key(tx, ty)] && !(s.x === tx && s.y === ty)) return 'unreachable';
  let path = [], cur = [tx, ty];
  while (prev[key(cur[0], cur[1])]) { const [px, py, dx, dy] = prev[key(cur[0], cur[1])]; path.unshift([dx, dy]); cur = [px, py]; }
  for (const [dx, dy] of path) { await window.__move(dx, dy); if (window.__s().mode !== 'field') return 'interrupted'; }
  return 'ok';
}, [tx, ty]);
// 道中の戦闘は逃げずに握りつぶす（ここで見たいのは地形のほう）
const godMode = () => p.evaluate(() => {
  const s = window.__s();
  s.hero.lv = 40; s.hero.maxHp = 4000; s.hero.hp = 4000; s.hero.atk = 900; s.hero.def = 400; s.hero.spd = 40;
  s.companion.active = true; s.companion.lv = 40; s.companion.maxHp = 3000; s.companion.hp = 3000;
  s.companion.atk = 900; s.companion.def = 300; s.companion.spd = 38;
  s.noEncounter = true;
});
// エンカウントを止める（steps を毎歩リセットするだけでは足りないので確率側を潰す）
await p.evaluate(() => { const r = Math.random; Math.random = () => 0.99; window.__realRandom = r; });

await p.evaluate(() => window.__ch5());
await godMode();
let a = await st();
check('第5章に入れる', a.ch === 5 && a.mode === 'field', 'ch' + a.ch + ' ' + a.label + ' (' + a.x + ',' + a.y + ')');
check('地下1階の表記', a.label === 'B1F', a.label);

// 宝箱
let g0 = (await st()).gold;
check('B1へ歩ける', (await walkTo(3, 1)) === 'ok');
let a2 = await st();
check('宝箱が開く', a2.gold > g0, g0 + 'G -> ' + a2.gold + 'G | ' + a2.msg);

// 落とし穴 (B1 -> B2 へ落ちる)
check('落とし穴まで歩ける', (await walkTo(10, 5)) === 'ok');
let a3 = await st();
check('落ちて地下2階へ', a3.floor === 2 && a3.label === 'B2F', a3.label + ' | ' + a3.msg);

// 光苔
check('光苔まで歩ける', (await walkTo(7, 7)) === 'ok');
let a4 = await st();
check('光苔で洞が照る', a4.moss > 0, '残' + a4.moss + '歩 | ' + a4.msg);

// 階段で B1 へ戻り、また潜れる
check('下り階段まで歩ける', (await walkTo(5, 9)) === 'ok');
let a5 = await st();
check('階段でB1へ戻る', a5.floor === 1, a5.label + ' | ' + a5.msg);
// 階段の上に立った状態で戻ってくるので、一歩どいてから踏み直す
await walkTo(13, 2);
check('もう一度もぐれる', (await walkTo(13, 1)) === 'ok');
let a6 = await st();
check('階段でB2へ', a6.floor === 2, a6.label + ' | ' + a6.msg);

// ボス
check('ボスまで歩ける', ['ok', 'interrupted'].includes(await walkTo(7, 1)));
await p.waitForTimeout(1500);
let a7 = await st();
const foe = await p.evaluate(() => (window.__s().enemy || {}).name);
check('最奥でボス戦', a7.mode === 'battle' && foe === '深淵のアズヴァル', foe + ' | ' + a7.msg);

await b.close();
console.log(pass && !errs.length ? '\nPASS' : '\n*** FAIL ***');
errs.slice(0, 5).forEach(e => console.log('  err', e));
process.exit(pass && !errs.length ? 0 : 1);

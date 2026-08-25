// 「旅に出る」で前の章に戻ったあと、また先の章へ行けるかを確かめる。
// 以前は現在の章を基準に解錠していたため、1章に戻ると2章以降が
// 施錠され、しかも1章のボスは討伐済みなので永久に戻れなくなっていた。
import { chromium } from 'playwright';
import fs from 'fs';
const SRC = process.argv[2] || 'game/main.js';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.route('**/main.js*', async r => {
  let body = fs.readFileSync(SRC, 'utf8').replace(/gameAudio\s*=\s*createGameAudio\([\s\S]*?\);/,
    m => m + 'window.__s=()=>state;window.__town=enterTown;');
  await r.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body });
});
await p.goto('http://127.0.0.1:8798/', { waitUntil: 'load' });
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('stonefire-audio-v1','off'); });
await p.reload({ waitUntil: 'load' });
await p.mouse.click(195, 300); await p.waitForTimeout(300);
await p.locator('#overlayCard button', { hasText: 'この枠ではじめる' }).first().click().catch(()=>{});
await p.waitForTimeout(600);

const listTravel = async () => {
  await p.evaluate(() => window.__town()); await p.waitForTimeout(400);
  await p.click('#bagBtn').catch(()=>{}); await p.waitForTimeout(300);
  await p.click('#openTravelBtn').catch(()=>{}); await p.waitForTimeout(350);
  const l = await p.evaluate(() => [...document.querySelectorAll('[data-travel]')].map(x => Number(x.dataset.travel)));
  await p.click('#travelBack').catch(()=>{}); await p.waitForTimeout(250);
  return l;
};
const travel = async (c) => {
  await p.evaluate(() => window.__town()); await p.waitForTimeout(400);
  await p.click('#bagBtn').catch(()=>{}); await p.waitForTimeout(300);
  await p.click('#openTravelBtn').catch(()=>{}); await p.waitForTimeout(350);
  await p.click(`[data-travel="${c}"]`).catch(()=>{}); await p.waitForTimeout(600);
};

// storyFlags を持たない「以前のセーブ」を再現する: 第4章にいるが記録は空
await p.evaluate(() => { const s = window.__s(); s.chapter = 4; s.floor = 1; s.storyFlags = {}; });
const before = await listTravel();
console.log('第4章にいるとき の旅先:', JSON.stringify(before));

await travel(1);
const afterCh = await p.evaluate(() => window.__s().chapter);
const after = await listTravel();
console.log('第1章へ戻ったあとの旅先:', JSON.stringify(after), '(現在章=' + afterCh + ')');

// 行って戻れるか
await travel(4);
const back = await p.evaluate(() => ({ ch: window.__s().chapter, floor: window.__s().floor }));
console.log('第4章へ戻れたか        :', JSON.stringify(back));

// セーブして読み直しても解錠が残るか (実際に遭遇する経路)
await p.evaluate(() => window.__town()); await p.waitForTimeout(500);
await p.reload({ waitUntil: 'load' });
await p.mouse.click(195, 300); await p.waitForTimeout(400);
const slot = await p.evaluate(() => Number(localStorage.getItem('stonefire-active-slot-v1')));
await p.evaluate(sl => { const cards=[...document.querySelectorAll('#overlayCard .slot-card')];
  const card=cards[sl-1]||cards[0];
  [...card.querySelectorAll('button')].find(x=>x.textContent.includes('つづきから'))?.click(); }, slot);
await p.waitForTimeout(800);
const reloaded = await listTravel();
const savedFlags = await p.evaluate(() => JSON.stringify(window.__s().storyFlags));
console.log('再読み込み後の旅先      :', JSON.stringify(reloaded));
console.log('  storyFlags:', savedFlags);

await b.close();
const ok = reloaded.length === 4 && after.includes(2) && after.includes(3) && after.includes(4) && back.ch === 4 && errs.length === 0;
console.log(ok ? '\nPASS: 一度行った章へは戻れる' : '\n*** FAIL: 戻れなくなっている ***');
errs.forEach(e => console.log('  err', e));
process.exit(ok ? 0 : 1);

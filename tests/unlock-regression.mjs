// 「3章までクリアしたのに2章までしかワープできない」の再現と検証。
// 3章クリア後に前の章へ戻って保存すると、到達記録が現在の章までしか
// 残らず、先の章が施錠されてしまっていた。討伐の証から復元できるはず。
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

const cases = [
  { name: '3章クリア後に2章へ戻った状態', chapter: 2,
    inv: { flameHorn: 1, eclipseWing: 1, astralCore: 1 }, want: [1,2,3,4] },
  { name: '2章クリア後に1章へ戻った状態', chapter: 1,
    inv: { flameHorn: 1, eclipseWing: 1 }, want: [1,2,3] },
  { name: '1章クリアのみ', chapter: 1,
    inv: { flameHorn: 1 }, want: [1,2] },
  { name: 'まだ何も倒していない', chapter: 1, inv: {}, want: [1] },
  { name: '討伐の証を売ってしまった (記録が頼り)', chapter: 3, inv: {}, want: [1,2,3] },
];
let ok = true;
for (const c of cases) {
  await p.evaluate(a => { const s = window.__s();
    s.chapter = a.chapter; s.floor = 1; s.storyFlags = {};
    for (const k of Object.keys(s.inventory)) s.inventory[k] = 0;
    Object.assign(s.inventory, a.inv);
  }, c);
  const got = await listTravel();
  const pass = JSON.stringify(got) === JSON.stringify(c.want);
  if (!pass) ok = false;
  console.log((pass ? 'OK  ' : 'NG  ') + c.name.padEnd(30) + ' 期待' + JSON.stringify(c.want) + ' 実際' + JSON.stringify(got));
}
await b.close();
console.log(ok && !errs.length ? '\nPASS' : '\n*** FAIL ***');
errs.forEach(e => console.log('  err', e));
process.exit(ok && !errs.length ? 0 : 1);

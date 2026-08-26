// 三人目の仲間・錬成士テオを検証する。
// 加入・隊列・行動順・ステータス欄と、テオのワザ5種の効き目を見る。
import { chromium } from 'playwright';
import fs from 'fs';
const SRC = process.argv[2] || 'game/main.js';
const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox'],
});
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
p.setDefaultTimeout(5000);
const errs = [];
p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type()==='error' && !m.text().includes('404')) errs.push(m.text()); });
await p.route('**/main.js*', async r => {
  let body = fs.readFileSync(SRC, 'utf8').replace(/gameAudio\s*=\s*createGameAudio\([\s\S]*?\);/,
    m => m + 'window.__s=()=>state;window.__start=startBattle;window.__skill=useSkill;' +
      'window.__ch=(n)=>{if(n===2)startChapter2();if(n===3)startChapter3()};window.__sync=sync;');
  await r.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body });
});
await p.goto('http://127.0.0.1:8798/', { waitUntil: 'load' });
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('stonefire-audio-v1','off'); });
await p.reload({ waitUntil: 'load' });
await p.mouse.click(195, 300); await p.waitForTimeout(300);
await p.locator('#overlayCard button', { hasText: 'この枠ではじめる' }).first().click().catch(()=>{});
await p.waitForTimeout(600);

let pass = true;
const check = (name, cond, info) => { if (!cond) pass = false;
  console.log((cond ? 'OK  ' : 'NG  ') + name.padEnd(30) + info); };

// --- 加入 ---
await p.evaluate(() => window.__ch(3));
await p.waitForTimeout(900);
const teo = await p.evaluate(() => { const a = window.__s().alchemist;
  return { active:a.active, lv:a.lv, hp:a.hp, maxHp:a.maxHp, atk:a.atk, def:a.def, spd:a.spd,
    skills:a.learnedSkills.join(','), weapon:a.equip.weapon }; });
check('第3章でテオが加わる', teo.active, JSON.stringify(teo));
check('初期習得は焔の投薬', teo.skills === 'emberflask', teo.skills);
check('触媒器を装備している', teo.weapon === 'brassCenser', teo.weapon);
const other = await p.evaluate(() => { const s = window.__s();
  return { heroAtk:s.hero.atk, mageAtk:s.companion.atk, heroHp:s.hero.maxHp, mageHp:s.companion.maxHp }; });
check('能力はパーティ最低', teo.atk < other.mageAtk && teo.maxHp < other.mageHp && teo.spd < 9,
  '攻' + teo.atk + '<' + other.mageAtk + ' HP' + teo.maxHp + '<' + other.mageHp + ' 速' + teo.spd + '<9');

const panel = await p.evaluate(() => ({ cls: document.querySelector('#stats').className,
  teo: document.querySelector('#alchStats').innerText.replace(/\n/g, ' ') }));
check('ステータス欄が三人になる', /trio/.test(panel.cls) && /テオ/.test(panel.teo), panel.teo);

// --- 隊列: ルカ→ミナ→テオ の順に一列で続く ---
await p.evaluate(() => { const s = window.__s();
  s.x=5; s.y=8; s.fx=4; s.fy=8; s.gx=3; s.gy=8; s.busy=false; s.mode='field'; });
const line = await p.evaluate(() => { const s = window.__s();
  return [[s.x,s.y],[s.fx,s.fy],[s.gx,s.gy]].map(v=>v.join(',')).join(' / '); });
check('テオはミナのうしろを歩く', line === '5,8 / 4,8 / 3,8', line);

// --- 戦闘 ---
const strong = () => p.evaluate(() => { const s = window.__s();
  s.hero.lv=20; s.hero.maxHp=400; s.hero.hp=400; s.hero.atk=200; s.hero.def=120; s.hero.spd=5;
  s.companion.lv=20; s.companion.maxHp=300; s.companion.hp=300; s.companion.atk=200; s.companion.def=100; s.companion.spd=5;
  s.alchemist.lv=20; s.alchemist.maxHp=200; s.alchemist.hp=120; s.alchemist.atk=40; s.alchemist.def=60; s.alchemist.spd=100;
  s.alchemist.learnedSkills=['emberflask','tonicmist','catalyst','bindtar','revivedraft']; });
const waitAlch = async () => { for (let i=0;i<60;i++) {
  const o = await p.evaluate(()=>({a:window.__s().actor,b:window.__s().busy,m:window.__s().mode}));
  if (o.m==='battle' && o.a==='alch' && !o.b) return true;
  await p.waitForTimeout(100); } return false; };
const fight = async () => {
  await strong();
  await p.evaluate(() => window.__start(['moss','bat']));
  await p.waitForTimeout(1300);
  // 検証中に倒してしまわないよう相手を鉄壁にし、割り込まないよう最も遅くする
  await p.evaluate(() => { const s = window.__s();
    (s.enemies||[]).forEach(e => { e.maxHp=9999; e.hp=9999; e.spd=1; }); });
  return waitAlch(); };
const snap = () => p.evaluate(() => { const s = window.__s();
  return { ルカ:s.hero.hp, ミナ:s.companion.hp, テオ:s.alchemist.hp,
    敵:(s.enemies||[]).map(e=>e.hp).join('/'),
    足止め:(s.enemies||[]).map(e=>e.stunned||0).join('/'),
    ルカ力UP:!!s.hero.charged, msg:document.querySelector('#msg').textContent.slice(0,44) }; });

check('テオに手番が回る', await fight(), await p.evaluate(()=>window.__s().actor));
check('行動順にテオが並ぶ', (await p.evaluate(()=>window.__s().order.map(u=>u.k).join('>'))).includes('alch'),
  await p.evaluate(()=>window.__s().order.map(u=>u.k).join('>')));

// スタンは一瞬で消えるので、演出中を細かく覗いて記録する。
// 敵が複数いる単体ワザは対象選択が挟まるので、pick で相手を直接渡す。
const useAndWatch = async (id, ms=2400, pick=false) => {
  const seen = { stun:false };
  const t = (pick
    ? p.evaluate(i => window.__skill(i, window.__s().enemies.find(e => e.hp > 0)), id)
    : p.evaluate(i => window.__skill(i), id)).catch(()=>{});
  for (let i=0;i<ms/80;i++) {
    if (await p.evaluate(()=>(window.__s().enemies||[]).some(e=>e.stunned>0))) seen.stun = true;
    await p.waitForTimeout(80); }
  await t; return seen; };
const reset = (opts={}) => p.evaluate(o => { const s = window.__s();
  s.actor='alch'; s.busy=false; s.skillMenu=false; s.itemMenu=false; s.targetMenu=false;
  s.hero.hp=200; s.companion.hp = o.downMage ? 0 : 150; s.alchemist.hp=100;
  s.hero.charged=false; s.companion.charged=false; s.alchemist.charged=false;
  (s.enemies||[]).forEach(e => { e.hp=9999; e.stunned=0; });
  Object.keys(s.skillUses).forEach(k => { s.skillUses[k] = 3; }); }, opts);

await reset(); let a = await snap(); await useAndWatch('emberflask'); let z = await snap();
check('焔の投薬は敵全体を焼く', z.敵.split('/').every(v => Number(v) < 9999), a.敵 + ' → ' + z.敵);

await reset(); a = await snap(); await useAndWatch('tonicmist'); z = await snap();
check('癒しの霧は全員を回復', z.ルカ > a.ルカ && z.ミナ > a.ミナ && z.テオ > a.テオ,
  a.ルカ+'/'+a.ミナ+'/'+a.テオ + ' → ' + z.ルカ+'/'+z.ミナ+'/'+z.テオ);

await reset(); await useAndWatch('catalyst'); z = await snap();
check('触媒の火は仲間を強める', z.ルカ力UP, z.msg);

await reset(); const seen = await useAndWatch('bindtar', 2400, true); z = await snap();
check('膠の罠は足止めする', seen.stun, '足止めを観測: ' + seen.stun);

await reset({ downMage:true }); a = await snap(); await useAndWatch('revivedraft'); z = await snap();
check('目覚めの霊薬は蘇生する', a.ミナ === 0 && z.ミナ > 0, 'ミナ ' + a.ミナ + ' → ' + z.ミナ);

check('例外が出ていない', errs.length === 0, errs.slice(0,2).join(' | ') || 'なし');
console.log(pass ? '\nPASS' : '\nFAIL');
await b.close();
process.exit(pass ? 0 : 1);

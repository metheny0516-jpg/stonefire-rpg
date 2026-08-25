// 新しいワザ (スタン/吸収/弾き/75%回復+蘇生) と、
// 戦闘不能からの復帰・フィールドでの回復ワザを検証する。
import { chromium } from 'playwright';
import fs from 'fs';
const SRC = process.argv[2] || 'game/main.js';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
p.setDefaultTimeout(5000);
const errs = []; p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type()==='error' && !m.text().includes('404')) errs.push(m.text()); });
await p.route('**/main.js*', async r => {
  let body = fs.readFileSync(SRC, 'utf8').replace(/gameAudio\s*=\s*createGameAudio\([\s\S]*?\);/,
    m => m + 'window.__s=()=>state;window.__start=startBattle;window.__act=act;window.__skill=useSkill;window.__town=enterTown;window.__sync=sync;');
  await r.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body });
});
await p.goto('http://127.0.0.1:8798/', { waitUntil: 'load' });
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('stonefire-audio-v1','off'); });
await p.reload({ waitUntil: 'load' });
await p.mouse.click(195, 300); await p.waitForTimeout(300);
await p.locator('#overlayCard button', { hasText: 'この枠ではじめる' }).first().click().catch(()=>{});
await p.waitForTimeout(600);

const strong = () => p.evaluate(() => { const s = window.__s();
  s.hero.lv=20; s.hero.maxHp=400; s.hero.hp=400; s.hero.atk=200; s.hero.def=120; s.hero.spd=30;
  s.companion.active=true; s.companion.lv=20; s.companion.maxHp=300; s.companion.hp=300;
  s.companion.atk=200; s.companion.def=100; s.companion.spd=28;
  s.hero.learnedSkills=['bulwark','sunder','bloodedge','healing'];
  s.companion.learnedSkills=['lunarbind','dawnbloom','moonmirror','moonheal'];
});
const st = () => p.evaluate(() => { const s=window.__s();
  return { hero:s.hero.hp, mina:s.companion.hp, heroDef:s.hero.deflect||0, minaDef:s.companion.deflect||0,
    foes:(s.enemies||[]).map(e=>e.name+':'+e.hp+(e.stunned?' STUN'+e.stunned:'')).join(','),
    msg:document.querySelector('#msg').textContent.slice(0,50), mode:s.mode, busy:s.busy }; });
const useSkill = async (id) => { await p.evaluate(i=>window.__skill(i), id); await p.waitForTimeout(1600); };
// スタンや「動けない！」は一瞬で消えるので、演出中を細かく覗いて記録する
const watch = async (id, ms=2600) => { let seen={stun:false,skip:false};
  const t = p.evaluate(i=>window.__skill(i), id);
  for (let i=0;i<ms/80;i++) { const o = await p.evaluate(()=>({
      f:(window.__s().enemies||[]).some(e=>e.stunned>0),
      m:document.querySelector('#msg').textContent }));
    if (o.f) seen.stun=true; if (/動けない/.test(o.m)) seen.skip=true;
    await p.waitForTimeout(80); }
  await t.catch(()=>{}); return seen; };
// 演出やクリア画面を全部畳んで、素のフィールドに戻す
const toField = () => p.evaluate(() => { const s=window.__s();
  s.mode='field'; s.enemies=[]; s.enemy=null; s.busy=false; s.order=null; s.orderIndex=0;
  document.querySelector('#overlay').classList.remove('show');
  window.__sync&&window.__sync(); }).then(()=>p.waitForTimeout(500)).then(()=>p.evaluate(()=>{
  const s=window.__s(); s.mode='field'; s.busy=false;
  document.querySelector('#overlay').classList.remove('show');
  document.querySelector('#overlayCard').innerHTML='';
  window.__sync&&window.__sync(); }));
// 検証中に倒してしまわないよう、相手を鉄壁にしてから始める
const fight = async (list, opt={}) => {
  // 行動順には揺らぎがあるので、狙った側が必ず先手になる速さにしてから始める
  await p.evaluate(a=>{ const s=window.__s();
    s.hero.spd = a==='mage' ? 20 : 100; s.companion.spd = a==='mage' ? 100 : 20; }, opt.actor||'hero');
  await p.evaluate(l=>window.__start(l), list);
  await p.waitForTimeout(1300);
  await p.evaluate(() => { const s=window.__s();
    (s.enemies||[]).forEach(e => { e.maxHp=9999; e.hp=9999; e.spd=1; }); });
  if (opt.solo) await p.evaluate(()=>{ window.__s().companion.active=false; });
  if (!(await waitActor(opt.actor || 'hero')))
    console.log('  (手番待ちタイムアウト: ' + (await p.evaluate(()=>window.__s().actor)) + ')'); };
// 演出が終わって狙った側の手番になるまで待つ
const waitActor = async (who) => { for (let i=0;i<60;i++) {
    const o = await p.evaluate(()=>({a:window.__s().actor, b:window.__s().busy, m:window.__s().mode}));
    if (o.m==='battle' && o.a===who && !o.b) return true;
    await p.waitForTimeout(100); } return false; };

let pass = true;
const check = (name, cond, info) => { if(!cond) pass=false; console.log((cond?'OK  ':'NG  ')+name.padEnd(28)+info); };

// --- スタン ---
await strong();
// ミナを外して「ルカ→敵」の順にし、敵の番が回るところまで見る
await fight(['moss'], { solo: true });
let w1 = await watch('sunder');
let a1 = await st();
check('兜割りでスタン', w1.stun, 'stun='+w1.stun+' skip='+w1.skip+' | '+a1.foes);
check('スタン中は行動できない', w1.skip, '「動けない！」='+w1.skip);

// --- 吸収 ---
await toField();
await strong();
await p.evaluate(()=>{window.__s().hero.hp=100});
await fight(['golum']);
await useSkill('bloodedge');
let a2 = await st();
check('血吸いの刃で吸収', a2.hero > 100, 'ルカHP 100 -> '+a2.hero+' | '+a2.msg);

// --- 弾き ---
await toField();
await strong();
await fight(['moss']);
await useSkill('bulwark');
let a3 = await st();
check('不動の構えで弾き付与', a3.heroDef>0, '弾き残'+a3.heroDef+' | '+a3.msg);

// --- 75%回復 + 蘇生 ---
await toField();
await strong();
await p.evaluate(()=>{window.__s().hero.hp=0});
await fight(['moss'], { actor: 'mage' });
await useSkill('dawnbloom');
let a4 = await st();
check('暁光の癒しで蘇生', a4.hero > 0, 'ルカHP 0 -> '+a4.hero+'/400 | '+a4.msg);

// --- 道具で蘇生 (フィールド) ---
await toField();
await strong();
await p.evaluate(()=>{const s=window.__s(); s.companion.hp=0; s.inventory.potion=3;});
await p.click('#bagBtn'); await p.waitForTimeout(400);
await p.locator('[data-field-item="potion"]').click().catch(e=>console.log('  potion click:', e.message.split('\n')[0]));
await p.waitForTimeout(700);
await p.locator('#closeBag').click().catch(()=>{}); await p.waitForTimeout(200);
let a5 = await st();
check('くすりで蘇生', a5.mina > 0, 'ミナHP 0 -> '+a5.mina+' | '+a5.msg);

// --- フィールドで回復ワザ ---
await p.evaluate(()=>{const s=window.__s(); s.hero.hp=50; s.companion.hp=40;
  s.skillUses={healing:1,moonheal:2,dawnbloom:1,moonveil:1};});
await p.evaluate(()=>document.querySelector('#overlay').classList.remove('show'));
await p.click('#bagBtn'); await p.waitForTimeout(400);
const listed = await p.evaluate(()=>[...document.querySelectorAll('[data-field-skill]')].map(x=>x.dataset.fieldSkill));
check('かばんに回復ワザが並ぶ', listed.length>0, JSON.stringify(listed));
if (listed.length) {
  await p.locator('[data-field-skill="'+listed[0]+'"]').click().catch(e=>console.log('  skill click:', e.message.split('\n')[0]));
  await p.waitForTimeout(700);
  let a6 = await st();
  check('フィールドで回復ワザ', a6.hero>50 || a6.mina>40, 'ルカ'+a6.hero+' ミナ'+a6.mina+' | '+a6.msg);
}
await b.close();
console.log(pass && !errs.length ? '\nPASS' : '\n*** FAIL ***');
errs.slice(0,5).forEach(e=>console.log('  err',e));
process.exit(pass && !errs.length ? 0 : 1);

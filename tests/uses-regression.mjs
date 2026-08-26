// ワザの使用回数が戦闘をまたいで残ること、休息で戻ること、
// 多段斬りの防御が段ごとに引かれること、格上ほど閃きやすいことを検証する。
import { chromium } from 'playwright';
import fs from 'fs';
import { sparkChanceForAction, sparkThreat } from '../game/battle-rules.js';
import { ENCOUNTERS, ENEMIES, BOSSES } from '../game/content.js';

let pass = true;
const check = (name, cond, info) => {
  if (!cond) pass = false;
  console.log((cond ? 'OK  ' : 'NG  ') + name.padEnd(30) + info);
};

// --- 閃き: 純関数だけで確かめられる ---
for (const ch of [1, 3, 5]) {
  const pool = ENCOUNTERS[ch].map(id => ENEMIES[id]);
  const base = pool.reduce((s, e) => s + e.exp, 0) / pool.length;
  const boss = ENEMIES[BOSSES[ch]];
  const mob = sparkChanceForAction('attack', false, sparkThreat(pool[0], base));
  const big = sparkChanceForAction('attack', false, sparkThreat(boss, base));
  check(
    `${ch}章 格上ほど閃く`,
    big > mob * 1.8,
    `雑魚 ${(mob * 100).toFixed(1)}% < ボス ${(big * 100).toFixed(1)}%`,
  );
  check(`${ch}章 雑魚は据え置き`, mob > 0.03 && mob < 0.05, `${(mob * 100).toFixed(1)}%`);
}

const SRC = process.argv[2] || 'game/main.js';
const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox'],
});
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
p.setDefaultTimeout(5000);
const errs = [];
p.on('pageerror', e => errs.push(e.message));
p.on('console', m => {
  if (m.type() === 'error' && !m.text().includes('404')) errs.push(m.text());
});
await p.route('**/main.js*', async r => {
  let body = fs
    .readFileSync(SRC, 'utf8')
    .replace(
      /gameAudio\s*=\s*createGameAudio\([\s\S]*?\);/,
      m =>
        m +
        'window.__s=()=>state;window.__start=startBattle;window.__skill=useSkill;' +
        'window.__save=saveGame;window.__rest=restoreSkillUses;window.__sync=sync;',
    );
  await r.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body });
});
await p.goto('http://127.0.0.1:8798/', { waitUntil: 'load' });
await p.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('stonefire-audio-v1', 'off');
});
await p.reload({ waitUntil: 'load' });
await p.mouse.click(195, 300);
await p.waitForTimeout(300);
await p
  .locator('#overlayCard button', { hasText: 'この枠ではじめる' })
  .first()
  .click()
  .catch(() => {});
await p.waitForTimeout(600);

const strong = () =>
  p.evaluate(() => {
    const s = window.__s();
    s.hero.lv = 20;
    s.hero.maxHp = 400;
    s.hero.hp = 400;
    s.hero.atk = 200;
    s.hero.def = 120;
    s.hero.spd = 100;
    s.hero.learnedSkills = ['crescent', 'tenfang', 'armorbreak'];
    s.companion.active = false;
  });
const fight = async (list, tune = {}) => {
  await p.evaluate(l => window.__start(l), list);
  await p.waitForTimeout(1300);
  await p.evaluate(t => {
    const s = window.__s();
    (s.enemies || []).forEach(e => {
      e.maxHp = 99999;
      e.hp = 99999;
      e.spd = 1;
      if (t.def !== undefined) e.def = t.def;
    });
  }, tune);
  for (let i = 0; i < 60; i++) {
    const o = await p.evaluate(() => ({ a: window.__s().actor, b: window.__s().busy, m: window.__s().mode }));
    if (o.m === 'battle' && o.a === 'hero' && !o.b) return true;
    await p.waitForTimeout(100);
  }
  return false;
};
const uses = id => p.evaluate(i => window.__s().skillUses[i], id);
const useSkill = async id => {
  await p.evaluate(i => window.__skill(i), id);
  await p.waitForTimeout(1700);
};
const toField = () =>
  p.evaluate(() => {
    const s = window.__s();
    s.mode = 'field';
    s.enemies = [];
    s.enemy = null;
    s.busy = false;
    document.querySelector('#overlay').classList.remove('show');
    window.__sync && window.__sync();
  });

// --- 1. 戦闘をまたいで減ったまま残る ---
await strong();
const full = await uses('crescent');
await fight(['moss']);
await useSkill('crescent');
const afterOne = await uses('crescent');
check('使うと減る', afterOne === full - 1, `${full} -> ${afterOne}`);
await toField();
await p.waitForTimeout(400);
await fight(['moss']);
const nextBattle = await uses('crescent');
check('次の戦闘に持ち越す', nextBattle === afterOne, `${afterOne} -> ${nextBattle}（戻っていない）`);

// --- 2. セーブに残る ---
await p.evaluate(() => window.__save());
const saved = await p.evaluate(() => {
  // 枠は選ばれたものを使う。1番とはかぎらない
  const slot = Number(localStorage.getItem('stonefire-active-slot-v1')) || 1;
  const raw = localStorage.getItem('stonefire-slot-v1-' + slot);
  return raw ? JSON.parse(raw).skillUses : null;
});
check('セーブに書かれる', saved && saved.crescent === nextBattle, JSON.stringify(saved?.crescent));

// --- 3. 休息で戻る ---
await p.evaluate(() => window.__rest());
const rested = await uses('crescent');
check('休息で満タンに戻る', rested === full, `${nextBattle} -> ${rested}`);

// --- 4. 多段斬りは防御を段ごとに引かれる ---
const hitFor = async (id, def) => {
  await toField();
  await p.waitForTimeout(300);
  await fight(['moss'], { def });
  await p.evaluate(() => window.__rest());
  const before = await p.evaluate(() => window.__s().enemies[0].hp);
  await useSkill(id);
  const after = await p.evaluate(() => window.__s().enemies[0].hp);
  return before - after;
};
const soft2 = await hitFor('crescent', 0);
const hard2 = await hitFor('crescent', 60);
const soft3 = await hitFor('tenfang', 0);
const hard3 = await hitFor('tenfang', 60);
check('二段斬りは硬い敵に弱い', hard2 < soft2 * 0.95, `def0 ${soft2} -> def60 ${hard2}`);
check('三段斬りはもっと弱い', soft3 - hard3 > soft2 - hard2, `減少 ${soft3 - hard3} > ${soft2 - hard2}`);
const softAB = await hitFor('armorbreak', 0);
const hardAB = await hitFor('armorbreak', 60);
check('鎧断ちは防御を無視する', Math.abs(softAB - hardAB) < softAB * 0.2, `def0 ${softAB} / def60 ${hardAB}`);

await b.close();
console.log(pass && !errs.length ? '\nPASS' : '\n*** FAIL ***');
errs.slice(0, 5).forEach(e => console.log('  err', e));
process.exit(pass && !errs.length ? 0 : 1);

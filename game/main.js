import {
  TOWER_MAPS,
  TOWER_ENCOUNTERS,
  TOWER_CHESTS,
  TOWER_LANDING,
  TOWER_FLOORS,
  CHAPTERS,
  MAX_CHAPTER,
  ITEM_RECIPES,
  ASSETS,
  BOSSES,
  ENCOUNTERS,
  ENEMIES,
  EQUIPMENT,
  ITEMS,
  MAPS,
  SKILLS,
  STARTING_GEAR,
  TILE_SIZE,
  TOWNS,
} from './content.js';
import {
  criticalRateForLevel,
  effectiveDefense,
  resolveHeroAttack,
  rollDrops,
  rollEncounterGroup,
  selectEnemyAction,
  sparkChanceForAction,
} from './battle-rules.js';
import {
  clearSlot,
  isSlot,
  migrateLegacySave,
  readActiveSlot,
  readSlot,
  SAVE_VERSION,
  slotSummaries,
  writeActiveSlot,
  writeSlot,
} from './save-store.js';
import { createGameAudio } from './audio-engine.js?v=51-unlock-fix';
(() => {
  'use strict';
  const C = document.querySelector('#game'),
    X = C.getContext('2d'),
    W = C.width,
    H = C.height,
    $ = s => document.querySelector(s),
    wrap = $('#screenWrap'),
    battleHeroImg = new Image(),
    battleHeroCut = document.createElement('canvas'),
    mageBattleImg = new Image(),
    mageBattleCut = document.createElement('canvas'),
    battleHeroFrames = [],
    mageBattleFrames = [],
    enemyCuts = {},
    enemyReady = {},
    fieldSprites = {},
    fieldReady = {},
    AUDIO_KEY = 'stonefire-audio-v1',
    T = TILE_SIZE,
    enemies = ENEMIES;
  let battleHeroReady = false,
    mageBattleReady = false,
    audioOn = true,
    gameAudio = null;
  try {
    audioOn = localStorage.getItem(AUDIO_KEY) !== 'off';
  } catch (_) {}
  X.imageSmoothingEnabled = false;
  let state;
  const BATTLE_EFFECTS = Object.freeze({
    normal: Object.freeze({
      effectType: 'slash',
      effectLevel: 1,
      duration: 720,
      darken: 0,
      hitStop: 60,
      shake: 1.5,
      afterimage: 1,
      impactEffect: 'shortSlash',
    }),
    starfire: Object.freeze({
      effectType: 'fire',
      effectLevel: 3,
      duration: 2000,
      darken: 0.27,
      hitStop: 105,
      shake: 5.5,
      afterimage: 4,
      projectile: false,
      impactEffect: 'firePillar',
    }),
    moon: Object.freeze({
      effectType: 'moon',
      effectLevel: 2,
      duration: 1580,
      darken: 0.13,
      hitStop: 65,
      shake: 2.7,
      afterimage: 0,
      projectile: true,
      impactEffect: 'crescentBurst',
    }),
    heal: Object.freeze({
      effectType: 'heal',
      effectLevel: 2,
      duration: 1480,
      darken: 0.06,
      hitStop: 0,
      shake: 0,
      afterimage: 0,
      projectile: false,
      impactEffect: 'lightPillar',
    }),
  });
  let flashToken = 0;
  function flashScreen(power = 1, duration = 300) {
    let id = ++flashToken,
      started = performance.now();
    function frame(now) {
      if (id !== flashToken) return;
      let p = Math.min(1, (now - started) / duration);
      state.battleFlash = power * (1 - p);
      if (state.mode === 'battle') draw();
      if (p < 1) requestAnimationFrame(frame);
      else if (id === flashToken) state.battleFlash = 0;
    }
    requestAnimationFrame(frame);
  }
  let fxSeed = 1;
  function fxRand() {
    fxSeed = (Math.imul(fxSeed, 1664525) + 1013904223) >>> 0;
    return fxSeed / 4294967296;
  }
  function cameraShake(power, duration) {
    state.cameraShake = { power, until: performance.now() + duration };
  }
  function mageForLevel(lv = 1) {
    let m = {
      active: false,
      lv: 1,
      hp: 26,
      maxHp: 26,
      atk: 7,
      def: 2,
      spd: 9,
      exp: 0,
      next: 20,
      learnedSkills: ['moonheal'],
      equip: { ...STARTING_GEAR.mage },
    };
    while (m.lv < Math.max(1, lv)) {
      m.lv++;
      m.next = Math.floor(m.next * 1.55);
      m.maxHp += 6;
      m.atk += 3;
      m.def += 1;
      if (m.lv % 2 === 0) m.spd = (m.spd || 9) + 1;
    }
    m.hp = m.maxHp;
    return m;
  }
  function normalizeMember(raw, base) {
    let m = { ...base, ...raw },
      hp = Number(m.hp);
    m.lv = Math.max(1, Math.min(99, Number(m.lv) || base.lv));
    m.maxHp = Math.max(1, Number(m.maxHp) || base.maxHp);
    m.hp = Number.isFinite(hp) ? Math.max(0, Math.min(m.maxHp, hp)) : m.maxHp;
    m.atk = Math.max(1, Number(m.atk) || base.atk);
    m.def = Math.max(0, Number(m.def) || base.def);
    m.exp = Math.max(0, Number(m.exp) || 0);
    m.next = Math.max(1, Number(m.next) || 20);
    return m;
  }
  function prepareSkills(member, owner) {
    let learned = Array.isArray(member.learnedSkills)
      ? member.learnedSkills.filter(id => SKILLS.some(s => s.id === id && s.owner === owner))
      : [];
    if (owner === 'mage' && !learned.includes('moonheal')) learned.push('moonheal');
    member.learnedSkills = learned;
    member.guarding = false;
    member.charged = false;
    member.expBoost = 1;
    return member;
  }
  function normalizeInventory(raw, legacy = 0) {
    let inv = {};
    Object.keys(ITEMS).forEach(id => (inv[id] = Math.max(0, Math.floor(Number(raw?.[id]) || 0))));
    if (!raw) inv.potion = Math.max(0, legacy);
    return inv;
  }
  function healPower(src, target) {
    let flat = Number(src?.healAll || src?.heal) || 0,
      rate = Number(src?.rate) || 0;
    return Math.max(flat, Math.round((Number(target?.maxHp) || 0) * rate));
  }
  function itemCount(id) {
    return Math.max(0, state?.inventory?.[id] || 0);
  }
  function addItem(id, amount = 1) {
    if (!ITEMS[id]) return;
    state.inventory[id] = itemCount(id) + Math.max(1, Math.floor(amount));
    if (id === 'potion') state.hero.potions = state.inventory.potion;
  }
  function consumeItem(id) {
    if (itemCount(id) <= 0) return false;
    state.inventory[id]--;
    if (id === 'potion') state.hero.potions = state.inventory.potion;
    return true;
  }
  function initialState() {
    let hero = prepareSkills(
        {
          lv: 1,
          hp: 32,
          maxHp: 32,
          atk: 8,
          def: 3,
          spd: 10,
          exp: 0,
          next: 20,
          potions: 3,
          equip: { ...STARTING_GEAR.hero },
        },
        'hero',
      ),
      companion = prepareSkills(mageForLevel(1), 'mage');
    companion.equip = { ...STARTING_GEAR.mage };
    return {
      chapter: 1,
      floor: 1,
      gold: 30,
      gear: { rustSword: 1, oakStaff: 1, clothArmor: 2 },
      mode: 'field',
      x: 1,
      y: 10,
      fx: 1,
      fy: 10,
      dir: 'down',
      walk: 0,
      steps: 0,
      hero,
      companion,
      inventory: normalizeInventory({ potion: 3 }),
      enemy: null,
      enemies: [],
      actor: 'hero',
      bossAlive: true,
      busy: false,
      skillMenu: false,
      itemMenu: false,
      skillUses: {},
      mageUses: {},
      skillFx: null,
      storyFlags: {},
      cleared: false,
      slot: 1,
      playMs: 0,
      targetMenu: false,
    };
  }
  let playAnchor = performance.now(),
    saveWarned = false;
  function accruePlay() {
    if (!state) return;
    let now = performance.now();
    state.playMs = (state.playMs || 0) + Math.max(0, now - playAnchor);
    playAnchor = now;
  }
  function currentSlot() {
    return isSlot(state?.slot) ? state.slot : readActiveSlot();
  }
  function readSave(slot = currentSlot()) {
    return readSlot(slot);
  }
  function warnSaveFailed() {
    if (saveWarned) return;
    saveWarned = true;
    setMsg('⚠ セーブできなかった。ブラウザの保存容量やプライベートモードを確認してほしい。');
  }
  function chapterName(chapter) {
    return chapter === 3 ? '星骸の塔' : chapter === 2 ? '月影の森' : '石牢';
  }
  function formatPlay(ms) {
    let total = Math.floor(Math.max(0, Number(ms) || 0) / 1000),
      h = Math.floor(total / 3600),
      m = Math.floor((total % 3600) / 60);
    return h ? h + '時間' + m + '分' : m + '分';
  }
  function formatWhen(ts) {
    if (!ts) return '--';
    let d = new Date(ts);
    return (
      d.getMonth() +
      1 +
      '/' +
      d.getDate() +
      ' ' +
      String(d.getHours()).padStart(2, '0') +
      ':' +
      String(d.getMinutes()).padStart(2, '0')
    );
  }
  const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  let heldDir = null,
    walkPumping = false;
  // 押しっぱなしの間は、1歩終わった直後に次の1歩を出す。
  // setInterval で叩くと歩行アニメとズレて毎タイル止まって見えるため、
  // 前の歩行の完了を待ってから次を出す方式にしている。
  async function pumpWalk() {
    if (walkPumping) return;
    walkPumping = true;
    try {
      while (
        heldDir &&
        (state.mode === 'field' || state.mode === 'town') &&
        !$('#overlay').classList.contains('show')
      ) {
        let v = DIRV[heldDir];
        if (!v) break;
        let moved = await move(v[0], v[1]);
        if (moved === false) break;
      }
    } finally {
      walkPumping = false;
      if (state && (state.mode === 'field' || state.mode === 'town')) flushSave();
    }
  }
  function setHeldDir(dir) {
    heldDir = dir;
    if (dir) pumpWalk();
  }
  function releaseDir(dir) {
    if (!dir || heldDir === dir) heldDir = null;
  }
  let saveTimer = 0;
  function saveSoon() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = 0;
      saveGame();
    }, 700);
  }
  function flushSave() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = 0;
    }
    saveGame();
  }
  function saveGame() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = 0;
    }
    if (!state || state.mode === 'over') return false;
    accruePlay();
    state.hero.potions = itemCount('potion');
    let ok = writeSlot(currentSlot(), {
      version: SAVE_VERSION,
      slot: currentSlot(),
      playMs: Math.round(state.playMs || 0),
      chapter: state.chapter,
      floor: currentFloor(),
      mode: state.mode === 'town' ? 'town' : 'field',
      gold: gold(),
      gear: { ...(state.gear || {}) },
      x: state.x,
      y: state.y,
      fx: state.fx,
      fy: state.fy,
      dir: state.dir,
      steps: state.steps,
      hero: state.hero,
      companion: state.companion,
      inventory: state.inventory,
      bossAlive: state.bossAlive,
      storyFlags: state.storyFlags,
      cleared: !!state.cleared,
      checkpoint: 'chapter_' + state.chapter + (state.cleared ? '_clear' : ''),
      savedAt: Date.now(),
    });
    if (!ok) warnSaveFailed();
    return ok;
  }
  function normalizeGear(raw) {
    let out = {};
    Object.keys(EQUIPMENT).forEach(id => {
      let n = Math.max(0, Math.floor(Number(raw?.[id]) || 0));
      if (n > 0) out[id] = n;
    });
    return out;
  }
  function normalizeEquip(member, owner, gearBag) {
    let raw = member.equip && typeof member.equip === 'object' ? member.equip : {};
    let out = { weapon: null, armor: null };
    ['weapon', 'armor'].forEach(slot => {
      let id = raw[slot],
        g = EQUIPMENT[id];
      if (g && g.slot === slot && (g.owner === 'both' || g.owner === owner)) out[slot] = id;
    });
    let starting = STARTING_GEAR[owner] || {};
    ['weapon', 'armor'].forEach(slot => {
      if (!out[slot] && starting[slot]) {
        out[slot] = starting[slot];
        gearBag[starting[slot]] = Math.max(1, Number(gearBag[starting[slot]]) || 0);
      }
    });
    ['weapon', 'armor'].forEach(slot => {
      let id = out[slot];
      if (id) gearBag[id] = Math.max(1, Number(gearBag[id]) || 0);
    });
    member.equip = out;
    return member;
  }
  function restoreSave(d, slot = currentSlot()) {
    let b = initialState(),
      chapter = CHAPTERS[Number(d.chapter)] ? Number(d.chapter) : 1,
      h = normalizeMember(d.hero, b.hero);
    h.potions = Math.max(0, Number(d.hero?.potions) || 0);
    while (h.lv < 99 && h.exp >= h.next) {
      h.exp -= h.next;
      h.lv++;
      h.next = Math.floor(h.next * 1.55);
      h.maxHp += 8;
      h.atk += 3;
      h.def += 2;
      h.hp = h.maxHp;
    }
    prepareSkills(h, 'hero');
    let generated = mageForLevel(Math.max(1, h.lv)),
      m = normalizeMember(d.companion, generated);
    m.active = chapter >= 2 || !!d.companion?.active;
    while (m.lv < 99 && m.exp >= m.next) {
      m.exp -= m.next;
      m.lv++;
      m.next = Math.floor(m.next * 1.55);
      m.maxHp += 6;
      m.atk += 3;
      m.def += 1;
      m.hp = m.maxHp;
    }
    prepareSkills(m, 'mage');
    let x = Number.isInteger(d.x) ? d.x : 1,
      y = Number.isInteger(d.y) ? d.y : 10,
      inventory = normalizeInventory(d.inventory, h.potions);
    h.potions = inventory.potion;
    let gearBag = normalizeGear(d.gear);
    normalizeEquip(h, 'hero', gearBag);
    normalizeEquip(m, 'mage', gearBag);
    state = {
      ...b,
      chapter,
      mode: d.cleared ? 'clear' : d.mode === 'town' ? 'town' : 'field',
      gold: Math.max(0, Math.floor(Number(d.gold) || 0)),
      gear: gearBag,
      x,
      y,
      fx: Number.isInteger(d.fx) ? d.fx : x,
      fy: Number.isInteger(d.fy) ? d.fy : y,
      dir: ['up', 'down', 'left', 'right'].includes(d.dir) ? d.dir : 'down',
      steps: Number(d.steps) || 0,
      floor: Math.min(TOWER_FLOORS, Math.max(1, Number(d.floor) || 1)),
      hero: h,
      companion: m,
      inventory,
      bossAlive: d.bossAlive !== false,
      storyFlags: d.storyFlags || {},
      cleared: !!d.cleared,
      slot: isSlot(slot) ? Number(slot) : 1,
      playMs: Math.max(0, Number(d.playMs) || 0),
    };
    playAnchor = performance.now();
    noteChapterReached(state.chapter);
    writeActiveSlot(state.slot);
  }
  function reset() {
    let slot = currentSlot();
    clearSlot(slot);
    state = initialState();
    state.slot = slot;
    playAnchor = performance.now();
    writeActiveSlot(slot);
    hideOverlay();
    setMsg('女剣士ルカを導き、最上階のボスを目指せ！');
    sync();
    draw();
    saveGame();
  }
  function boot() {
    migrateLegacySave();
    let list = slotSummaries(),
      filled = list.filter(v => !v.empty),
      active = readActiveSlot();
    if (!filled.length) {
      startNewGame(isSlot(active) ? active : 1);
      return;
    }
    let pick = filled.find(v => v.slot === active) || filled.slice().sort((a, b) => b.savedAt - a.savedAt)[0],
      d = readSave(pick.slot);
    state = initialState();
    if (d) restoreSave(d, pick.slot);
    else state.slot = pick.slot;
    sync();
    draw();
    showSlotScreen(true);
  }
  function startNewGame(slot) {
    let target = isSlot(slot) ? Number(slot) : 1;
    writeActiveSlot(target);
    state = initialState();
    state.slot = target;
    state.playMs = 0;
    playAnchor = performance.now();
    hideOverlay();
    setMsg('女剣士ルカを導き、最上階のボスを目指せ！');
    sync();
    draw();
    saveGame();
  }
  function loadSlot(slot) {
    let d = readSave(slot);
    if (!d) return false;
    restoreSave(d, slot);
    hideOverlay();
    if (state.cleared) {
      sync();
      draw();
      showOverlay('clear');
      return true;
    }
    setMsg(state.companion.active ? 'ルカとミナ、二人の冒険を再開した。' : '冒険を再開した。');
    sync();
    draw();
    return true;
  }
  function slotCardHtml(s, atBoot) {
    let inUse = !atBoot && state && state.slot === s.slot,
      head =
        '<div class="slot-head"><b>セーブ枠 ' +
        s.slot +
        '</b><span>' +
        (s.empty ? '空き' : s.cleared ? 'クリア済み' : '第' + s.chapter + '章　' + chapterName(s.chapter)) +
        '</span></div>';
    if (s.empty)
      return (
        '<div class="slot-card' +
        (inUse ? ' current' : '') +
        '">' +
        head +
        '<div class="slot-body">データなし</div><div class="slot-btns"><button data-new="' +
        s.slot +
        '">この枠ではじめる</button></div></div>'
      );
    return (
      '<div class="slot-card' +
      (inUse ? ' current' : '') +
      '">' +
      head +
      '<div class="slot-body">ルカ LV ' +
      s.hero.lv +
      '　HP ' +
      s.hero.hp +
      ' / ' +
      s.hero.maxHp +
      (s.companion
        ? '<br>ミナ LV ' + s.companion.lv + '　HP ' + s.companion.hp + ' / ' + s.companion.maxHp
        : '') +
      '<small>プレイ ' +
      formatPlay(s.playMs) +
      '　最終セーブ ' +
      formatWhen(s.savedAt) +
      '</small></div><div class="slot-btns"><button data-load="' +
      s.slot +
      '"' +
      (inUse ? ' disabled' : '') +
      '>' +
      (inUse ? '使用中' : 'つづきから') +
      '</button><button class="danger" data-del="' +
      s.slot +
      '"' +
      (inUse ? ' disabled' : '') +
      '>消す</button></div></div>'
    );
  }
  function showSlotScreen(atBoot = false) {
    $('#overlay').classList.remove('clear-screen', 'town-screen');
    $('#overlay').classList.add('slot-screen');
    $('#overlayCard').innerHTML =
      '<h1>石牢の灯火</h1><p class="slot-note">' +
      (atBoot
        ? 'セーブ枠をえらんでください。3つの冒険を別々に残せます。'
        : 'いまの冒険は<b>セーブ枠 ' + state.slot + '</b>に自動で記録されています。') +
      '</p><div class="slot-list">' +
      slotSummaries()
        .map(v => slotCardHtml(v, atBoot))
        .join('') +
      '</div>' +
      (atBoot ? '' : '<button id="closeSlots">とじる</button>');
    $('#overlay').classList.add('show');
    if (!atBoot)
      $('#closeSlots').onclick = () => {
        sfx('menuClose');
        hideOverlay();
      };
    $('#overlayCard')
      .querySelectorAll('[data-new]')
      .forEach(
        b =>
          (b.onclick = () => {
            sfx('confirm');
            if (!atBoot) saveGame();
            startNewGame(Number(b.dataset.new));
          }),
      );
    $('#overlayCard')
      .querySelectorAll('[data-load]')
      .forEach(
        b =>
          (b.onclick = () => {
            sfx('confirm');
            if (!atBoot) saveGame();
            if (!loadSlot(Number(b.dataset.load))) showSlotScreen(atBoot);
          }),
      );
    $('#overlayCard')
      .querySelectorAll('[data-del]')
      .forEach(b => {
        let armed = false;
        b.onclick = () => {
          if (!armed) {
            armed = true;
            sfx('cancel');
            b.textContent = '本当に消す？';
            return;
          }
          clearSlot(Number(b.dataset.del));
          sfx('menuClose');
          showSlotScreen(atBoot);
        };
      });
  }
  function showTitleOverlay() {
    showSlotScreen(true);
  }
  function setMsg(t) {
    if (t.includes('次の攻撃1.5倍。')) t += ' 閃き率+3%・獲得EXPも上昇！';
    $('#msg').textContent = t;
  }
  function currentActor() {
    return state.actor === 'mage' ? state.companion : state.hero;
  }
  function actorName(member = currentActor()) {
    return member === state.hero ? 'ルカ' : 'ミナ';
  }
  function sync() {
    let h = state.hero,
      m = state.companion,
      sub = state.skillMenu || state.itemMenu || state.targetMenu,
      battle = state.mode === 'battle';
    $('.title').textContent = CHAPTERS[state.chapter]?.full || '石牢の灯火';
    $('#lv').textContent = 'LV ' + h.lv;
    $('#hp').innerHTML =
      'HP<br><b class="' + (h.hp ? '' : 'ko') + '">' + (h.hp ? h.hp + ' / ' + h.maxHp : '戦闘不能') + '</b>';
    $('#exp').innerHTML =
      'EXP<br><b>' +
      h.exp +
      ' / ' +
      h.next +
      '</b>' +
      (battle
        ? '<small>会心 ' + criticalRateForLevel(h.lv) + '%' + (h.charged ? '　力UP' : '') + '</small>'
        : '');
    $('#hpfill').style.width = (100 * h.hp) / h.maxHp + '%';
    $('#stats').classList.toggle('party', !!m.active);
    if (m.active) {
      $('#mlv').textContent = 'LV ' + m.lv;
      $('#mhp').innerHTML =
        'HP<br><b class="' +
        (m.hp ? '' : 'ko') +
        '">' +
        (m.hp ? m.hp + ' / ' + m.maxHp : '戦闘不能') +
        '</b>';
      $('#mexp').innerHTML =
        'EXP<br><b>' + m.exp + ' / ' + m.next + '</b>' + (battle && m.charged ? '<small>魔力UP</small>' : '');
      $('#mhpfill').style.width = (100 * m.hp) / m.maxHp + '%';
    }
    $('#heroStats').classList.toggle('active-turn', battle && state.actor === 'hero' && !state.busy);
    $('#companionStats').classList.toggle('active-turn', battle && state.actor === 'mage' && !state.busy);
    $('#heroStats').classList.toggle('guarding', battle && !!h.guarding);
    $('#companionStats').classList.toggle('guarding', battle && !!m.guarding);
    $('#heroStats').classList.toggle('charged', battle && !!h.charged);
    $('#companionStats').classList.toggle('charged', battle && !!m.charged);
    $('#potions').textContent = '×' + itemCount('potion');
    if ($('#gold')) $('#gold').textContent = gold() + 'G';
    $('#dpad').classList.toggle('hide', state.mode !== 'field' && state.mode !== 'town');
    $('#menu').classList.toggle('show', battle && !sub);
    $('#skillMenu').classList.toggle('show', battle && sub);
    if ($('#bagBtn')) $('#bagBtn').disabled = state.mode !== 'field' && state.mode !== 'town';
  }
  function isTower(chapter = state?.chapter) {
    return !!CHAPTERS[chapter]?.tower;
  }
  function currentFloor() {
    return Math.min(TOWER_FLOORS, Math.max(1, Number(state?.floor) || 1));
  }
  async function changeFloor(to) {
    let floor = Math.min(TOWER_FLOORS, Math.max(1, to));
    if (floor === currentFloor()) return;
    let up = floor > currentFloor();
    state.floor = floor;
    // 移動先の階の、対になる階段の上に出る
    let want = up ? 'd' : 'u',
      spot = findTile(want) || { x: 1, y: 9 };
    state.x = spot.x;
    state.y = spot.y;
    state.fx = spot.x;
    state.fy = spot.y;
    state.steps = 0;
    state.walk = 0;
    sfx(up ? 'chapterStart' : 'menuOpen');
    setMsg(up ? floor + '階へ上がった。空気が冷たくなった……' : floor + '階へ下りた。');
    sync();
    draw();
    saveGame();
  }
  function findTile(ch) {
    let g = TOWER_MAPS[currentFloor()];
    if (!g) return null;
    for (let y = 0; y < g.length; y++) {
      let x = g[y].indexOf(ch);
      if (x >= 0) return { x, y };
    }
    return null;
  }
  function openChest(x, y) {
    let key = chestKey(x, y),
      bag = openedChests();
    if (bag[key]) {
      setMsg('からっぽの宝箱だ。');
      sfx('cancel');
      sync();
      draw();
      return;
    }
    let loot = TOWER_CHESTS[currentFloor() + ':' + x + ',' + y] || { gold: 80 };
    bag[key] = true;
    let parts = [];
    if (loot.gold) {
      addGold(loot.gold);
      parts.push(loot.gold + 'G');
    }
    if (loot.item) {
      addItem(loot.item, loot.amount || 1);
      parts.push(ITEMS[loot.item].name + ' ×' + (loot.amount || 1));
    }
    sfx('itemGet');
    setMsg('宝箱を開けた！ ' + parts.join('と') + 'を手に入れた！');
    sync();
    draw();
    saveGame();
  }
  async function fallThroughPit() {
    let from = currentFloor(),
      to = Math.max(1, from - 1),
      spot = TOWER_LANDING[to] || { x: 1, y: 9 };
    sfx('bump');
    setMsg('足もとが抜けた！');
    draw();
    await delay(320);
    state.floor = to;
    state.x = spot.x;
    state.y = spot.y;
    state.fx = spot.x;
    state.fy = spot.y;
    state.steps = 0;
    state.walk = 0;
    let hurt = [state.hero, ...(state.companion.active ? [state.companion] : [])].filter(v => v.hp > 0);
    let dmg = 0;
    hurt.forEach(mem => {
      let d = Math.max(1, Math.round(mem.maxHp * 0.14));
      mem.hp = Math.max(1, mem.hp - d);
      dmg = Math.max(dmg, d);
    });
    sfx('enemy');
    cameraShake(5, 300);
    setMsg(from + '階の床が抜け、' + to + '階まで落ちた！ ' + dmg + ' ダメージ！');
    sync();
    draw();
    saveGame();
  }
  function chestKey(x, y) {
    return state.chapter + ':' + currentFloor() + ':' + x + ',' + y;
  }
  function openedChests() {
    if (!state.storyFlags || typeof state.storyFlags !== 'object') state.storyFlags = {};
    if (!state.storyFlags.chests) state.storyFlags.chests = {};
    return state.storyFlags.chests;
  }
  function clearedChapters() {
    if (!state.storyFlags || typeof state.storyFlags !== 'object') state.storyFlags = {};
    if (!state.storyFlags.clearedChapters) state.storyFlags.clearedChapters = {};
    return state.storyFlags.clearedChapters;
  }
  // 到達したことのある一番奥の章。旅の解錠はこれを基準にする。
  // 現在の章を基準にすると、前の章へ戻った瞬間に先の章が施錠され、
  // しかも討伐済みのボスは倒し直せないので永久に戻れなくなる。
  function maxChapterReached() {
    if (!state.storyFlags || typeof state.storyFlags !== 'object') state.storyFlags = {};
    let recorded = Number(state.storyFlags.maxChapter) || 0;
    return Math.max(1, Math.min(MAX_CHAPTER, recorded));
  }
  // ボスの討伐品は、その章を攻略した動かぬ証拠になる。
  const BOSS_TROPHY = Object.freeze({ flameHorn: 1, eclipseWing: 2, astralCore: 3, duskBell: 4 });

  // 手元の証拠を全部集めて、到達済みの章を組み立て直す。
  // 現在の章だけを基準にすると、前の章へ戻って保存したセーブで先の章の
  // 記録が失われ、二度と開かなくなる。
  function inferProgress() {
    if (!state.storyFlags || typeof state.storyFlags !== 'object') state.storyFlags = {};
    let cleared = clearedChapters();
    // 討伐品を持っていれば、その章は攻略済み
    Object.keys(BOSS_TROPHY).forEach(id => {
      if (itemCount(id) > 0) cleared[BOSS_TROPHY[id]] = true;
    });
    // クリア画面を出している最中の章も攻略済み
    if (state.cleared && CHAPTERS[state.chapter]) cleared[state.chapter] = true;
    let deepest = Math.max(1, Number(state.storyFlags.maxChapter) || 0, Number(state.chapter) || 1);
    for (let c = 1; c <= MAX_CHAPTER; c++) {
      if (!cleared[c]) continue;
      // 第N章を攻略済みなら、それより前の章も当然攻略済み
      for (let i = 1; i < c; i++) cleared[i] = true;
      // そして次の章までは到達できている
      deepest = Math.max(deepest, Math.min(MAX_CHAPTER, c + 1));
    }
    state.storyFlags.maxChapter = Math.min(MAX_CHAPTER, deepest);
  }

  // 章に到達したことを記録する。第N章にいるということは第N-1章までは
  // 攻略済みなので、記録が無い古いセーブのぶんもここで補完する。
  function noteChapterReached(chapter) {
    let c = Number(chapter) || 1;
    if (!CHAPTERS[c]) return;
    if (!state.storyFlags || typeof state.storyFlags !== 'object') state.storyFlags = {};
    let now = Number(state.storyFlags.maxChapter) || 0;
    if (c > now) state.storyFlags.maxChapter = c;
    let cleared = clearedChapters();
    for (let i = 1; i < c; i++) if (!cleared[i]) cleared[i] = true;
    inferProgress();
  }
  function chapterUnlocked(c) {
    return c === 1 || c <= maxChapterReached();
  }
  function unlockedChapters() {
    // いま実際にいる章は、どんな経路で来ていても到達済みとして数える
    noteChapterReached(state.chapter);
    let out = [];
    for (let c = 1; c <= MAX_CHAPTER; c++) if (CHAPTERS[c] && chapterUnlocked(c)) out.push(c);
    return out;
  }
  function travelTo(c) {
    let meta = CHAPTERS[c];
    if (!meta || !chapterUnlocked(c)) return;
    noteChapterReached(state.chapter);
    state.chapter = c;
    state.mode = 'field';
    state.floor = 1;
    state.x = meta.start.x;
    state.y = meta.start.y;
    state.fx = meta.start.x;
    state.fy = meta.start.y;
    state.dir = 'up';
    state.walk = 0;
    state.steps = 0;
    state.enemy = null;
    state.enemies = [];
    state.busy = false;
    state.cleared = false;
    state.skillMenu = false;
    state.itemMenu = false;
    state.targetMenu = false;
    state.bossAlive = !clearedChapters()[c];
    hideOverlay();
    sfx('chapterStart');
    setMsg(meta.name + 'へ向かった。' + (state.bossAlive ? '' : '（この地の主はもういない）'));
    sync();
    draw();
    saveGame();
  }
  function openTravel() {
    let list = unlockedChapters();
    openTownCard(
      '<h1>旅に出る</h1><p class="shop-note">これまでに訪れた土地へ戻れる。</p><div class="shop-list">' +
        list
          .map(c => {
            let m = CHAPTERS[c],
              done = !!clearedChapters()[c],
              here = c === state.chapter;
            return (
              '<div class="shop-row' +
              (here ? ' current' : '') +
              '"><div><b>' +
              c +
              '章　' +
              m.name +
              '</b><small>' +
              m.where +
              (done ? '　／ 攻略済み' : '　／ 主が残っている') +
              (here ? '　（いまここ）' : '') +
              '</small></div>' +
              '<button data-travel="' +
              c +
              '"' +
              (here ? ' disabled' : '') +
              '>' +
              (here ? '滞在中' : '行く') +
              '</button></div>'
            );
          })
          .join('') +
        '</div><button id="travelBack">やめる</button>',
    );
    $('#travelBack').onclick = () => {
      sfx('menuClose');
      closeTownCard();
    };
    $('#overlayCard')
      .querySelectorAll('[data-travel]')
      .forEach(
        b =>
          (b.onclick = () => {
            sfx('confirm');
            travelTo(Number(b.dataset.travel));
          }),
      );
  }
  function town() {
    return TOWNS[state?.chapter || 1] || TOWNS[1];
  }
  function tile(x, y) {
    let g =
      state?.mode === 'town'
        ? town().map
        : isTower()
          ? TOWER_MAPS[currentFloor()]
          : MAPS[state?.chapter || 1];
    return g?.[y]?.[x] || '1';
  }
  function gearOf(member, slot) {
    return EQUIPMENT[member?.equip?.[slot]] || null;
  }
  function gearBonus(member, kind) {
    return ['weapon', 'armor'].reduce((sum, slot) => sum + (gearOf(member, slot)?.[kind] || 0), 0);
  }
  function atkOf(member) {
    return Math.max(1, (Number(member?.atk) || 0) + gearBonus(member, 'atk'));
  }
  function spdOf(member) {
    return Math.max(
      1,
      (Number(member?.spd) || (member === state?.companion ? 9 : 10)) + gearBonus(member, 'spd'),
    );
  }
  function defOf(member) {
    return Math.max(0, (Number(member?.def) || 0) + gearBonus(member, 'def'));
  }
  function ownerOf(member) {
    return member === state.companion ? 'mage' : 'hero';
  }
  function gearCount(id) {
    return Math.max(0, Number(state.gear?.[id]) || 0);
  }
  function addGear(id, amount = 1) {
    state.gear = state.gear || {};
    state.gear[id] = gearCount(id) + amount;
    if (state.gear[id] <= 0) delete state.gear[id];
  }
  function equippedCount(id) {
    return [state.hero, state.companion].filter(m => m && (m.equip?.weapon === id || m.equip?.armor === id))
      .length;
  }
  function spareGear(id) {
    return gearCount(id) - equippedCount(id);
  }
  function canEquip(member, id) {
    let g = EQUIPMENT[id];
    return !!g && (g.owner === 'both' || g.owner === ownerOf(member));
  }
  function gold() {
    return Math.max(0, Number(state.gold) || 0);
  }
  function addGold(amount) {
    state.gold = Math.max(0, gold() + Math.round(amount));
  }
  function priceOf(id) {
    return Math.max(1, Number(EQUIPMENT[id]?.price || ITEMS[id]?.price) || 1);
  }
  function sellPriceOf(id) {
    let item = ITEMS[id];
    if (item) return Math.max(1, Number(item.sell) || Math.floor((Number(item.price) || 2) / 2));
    return Math.max(1, Math.floor(priceOf(id) / 2));
  }
  function delay(ms) {
    let paced = state?.mode === 'battle' ? Math.max(60, Math.round(ms * 1.5)) : ms;
    return new Promise(r => setTimeout(r, paced));
  }
  function rand(a, b) {
    return Math.floor(Math.random() * (b - a + 1)) + a;
  }
  function updateSoundButton() {
    let b = $('#soundBtn');
    b.textContent = audioOn ? '🔊' : '🔇';
    b.classList.toggle('off', !audioOn);
    b.setAttribute('aria-label', audioOn ? '音を切る' : '音を出す');
  }
  function ensureAudio() {
    if (audioOn) gameAudio?.ensure();
  }
  function stopBgm() {
    gameAudio?.setEnabled(false);
  }
  function toggleSound(e) {
    e?.stopPropagation();
    audioOn = !audioOn;
    try {
      localStorage.setItem(AUDIO_KEY, audioOn ? 'on' : 'off');
    } catch (_) {}
    gameAudio?.setEnabled(audioOn);
    updateSoundButton();
  }
  function sfx(kind) {
    if (audioOn) gameAudio?.sfx(kind);
  }
  function vibrate(pattern) {
    if (audioOn && navigator.vibrate)
      try {
        navigator.vibrate(pattern);
      } catch (_) {}
  }
  function loadBattleHero() {
    battleHeroImg.onload = () => {
      battleHeroCut.width = 256;
      battleHeroCut.height = 384;
      let q = battleHeroCut.getContext('2d', { willReadFrequently: true });
      q.imageSmoothingEnabled = true;
      q.drawImage(battleHeroImg, 0, 0, 256, 384);
      let im = q.getImageData(0, 0, 256, 384),
        d = im.data;
      for (let i = 0; i < d.length; i += 4) {
        let r = d[i],
          g = d[i + 1],
          b = d[i + 2],
          green = g - Math.max(r, b);
        if (g > 120 && green > 22) {
          let a = Math.max(0, Math.min(255, 255 - (green - 22) * 2.45));
          d[i + 3] = a;
          if (a < 245) d[i + 1] = Math.min(g, Math.max(r, b) + 18);
        }
      }
      q.putImageData(im, 0, 0);
      battleHeroReady = true;
      draw();
    };
    battleHeroImg.src = ASSETS.heroBattle;
  }
  // ===== 装備をスプライトに反映する =====
  // 元絵から「刃(またはミナの杖の魔力光)」と「衣」の領域を自動で見つけ、
  // 装備の色で塗り替えた版をキャッシュして描画に差し替える。
  const SKIN_MASKS = new WeakMap(),
    SKIN_CACHE = new WeakMap();
  function hexRGB(hex) {
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  }
  function spriteMasks(cv, kind) {
    let w = cv.width,
      h = cv.height,
      n = w * h,
      q = cv.getContext('2d', { willReadFrequently: true }),
      d;
    try {
      d = q.getImageData(0, 0, w, h).data;
    } catch (_) {
      return { blade: new Uint8Array(n), cloth: new Uint8Array(n) };
    }
    let blade = new Uint8Array(n),
      cloth = new Uint8Array(n),
      cand = new Uint8Array(n),
      bright = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      let o = i * 4,
        r = d[o],
        g = d[o + 1],
        b = d[o + 2];
      if (d[o + 3] < 60) continue;
      let mx = Math.max(r, g, b),
        mn = Math.min(r, g, b),
        df = mx - mn,
        sat = mx ? df / mx : 0,
        hue = 0;
      if (df > 0) {
        if (mx === r) hue = (60 * ((g - b) / df) + 360) % 360;
        else if (mx === g) hue = 60 * ((b - r) / df) + 120;
        else hue = 60 * ((r - g) / df) + 240;
      }
      if (mx > 140 && sat < 0.35) bright[i] = 1;
      if (kind === 'mage') {
        if (hue >= 166 && hue <= 214 && sat > 0.28 && mx > 110) blade[i] = 1;
        if (hue >= 218 && hue <= 286 && sat > 0.46 && mx > 28 && mx < 198) cloth[i] = 1;
      } else {
        if (mx > 170 && sat < 0.22) cand[i] = 1;
        if ((hue < 20 || hue > 334) && sat > 0.42 && mx > 40) cloth[i] = 1;
      }
    }
    if (kind !== 'mage') {
      let span = Math.max(w, h),
        thick = Math.max(5, Math.round(span * 0.085)),
        thin = new Uint8Array(n);
      // 縦横どちらから見ても細い画素だけを刃候補に絞る(盾や白い装飾は太いので落ちる)
      for (let y = 0; y < h; y++) {
        let x = 0;
        while (x < w) {
          if (!cand[y * w + x]) {
            x++;
            continue;
          }
          let s0 = x;
          while (x < w && cand[y * w + x]) x++;
          if (x - s0 <= thick) for (let k = s0; k < x; k++) thin[y * w + k] |= 1;
        }
      }
      for (let x = 0; x < w; x++) {
        let y = 0;
        while (y < h) {
          if (!cand[y * w + x]) {
            y++;
            continue;
          }
          let s0 = y;
          while (y < h && cand[y * w + x]) y++;
          if (y - s0 <= thick) for (let k = s0; k < y; k++) thin[k * w + x] |= 2;
        }
      }
      for (let i = 0; i < n; i++) cand[i] = thin[i] === 3 ? 1 : 0;
      // 残った中から、細長い連結成分だけを刃とみなす
      let lab = new Int32Array(n),
        stack = new Int32Array(n);
      for (let i = 0; i < n; i++) {
        if (!cand[i] || lab[i]) continue;
        let id = i + 1,
          top = 0,
          count = 0,
          minX = w,
          maxX = 0,
          minY = h,
          maxY = 0,
          members = [];
        stack[top++] = i;
        lab[i] = id;
        while (top) {
          let p = stack[--top],
            x = p % w,
            y = (p - x) / w;
          members.push(p);
          count++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              let nx = x + dx,
                ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
              let t = ny * w + nx;
              if (cand[t] && !lab[t]) {
                lab[t] = id;
                stack[top++] = t;
              }
            }
        }
        let bw = maxX - minX + 1,
          bh = maxY - minY + 1,
          fill = count / (bw * bh),
          diag = Math.hypot(bw, bh);
        if (count >= Math.max(24, span * 0.1) && fill < 0.32 && diag > span * 0.28)
          for (let p of members) blade[p] = 1;
      }
    }
    // 縁のアンチエイリアスを1px拾って境目のギザつきを抑える
    let grown = blade.slice();
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let i = y * w + x;
        if (blade[i]) continue;
        if (!bright[i]) continue;
        if (
          (x > 0 && blade[i - 1]) ||
          (x < w - 1 && blade[i + 1]) ||
          (y > 0 && blade[i - w]) ||
          (y < h - 1 && blade[i + w])
        )
          grown[i] = 1;
      }
    // 元の陰影を保ちつつ、装備の色そのものの明るさに寄せるための基準値
    let bl = 0,
      bn = 0,
      cl = 0,
      cn = 0;
    for (let i = 0; i < n; i++) {
      let o = i * 4;
      if (d[o + 3] < 60) continue;
      let lum = (d[o] * 0.32 + d[o + 1] * 0.5 + d[o + 2] * 0.18) / 255;
      if (grown[i]) {
        bl += lum;
        bn++;
      } else if (cloth[i]) {
        cl += lum;
        cn++;
      }
    }
    return { blade: grown, cloth, bladeMean: bn ? bl / bn : 0.5, clothMean: cn ? cl / cn : 0.5 };
  }
  function tintSprite(cv, masks, bladeHex, clothHex) {
    let w = cv.width,
      h = cv.height,
      out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    let q = out.getContext('2d', { willReadFrequently: true });
    q.drawImage(cv, 0, 0);
    let im,
      bc = bladeHex && hexRGB(bladeHex),
      cc = clothHex && hexRGB(clothHex);
    try {
      im = q.getImageData(0, 0, w, h);
    } catch (_) {
      return cv;
    }
    let d = im.data;
    for (let i = 0, n = w * h; i < n; i++) {
      let onBlade = bc && masks.blade[i],
        target = onBlade ? bc : cc && masks.cloth[i] ? cc : null;
      if (!target) continue;
      let o = i * 4;
      if (d[o + 3] < 20) continue;
      let lum = (d[o] * 0.32 + d[o + 1] * 0.5 + d[o + 2] * 0.18) / 255,
        mean = Math.max(0.08, onBlade ? masks.bladeMean : masks.clothMean),
        k = Math.max(0.18, Math.min(1.38, 0.34 + (lum / mean) * 0.72)),
        hi = Math.max(0, lum - 0.86) * 3;
      d[o] = Math.min(255, target[0] * k + 255 * hi);
      d[o + 1] = Math.min(255, target[1] * k + 255 * hi);
      d[o + 2] = Math.min(255, target[2] * k + 255 * hi);
    }
    q.putImageData(im, 0, 0);
    return out;
  }
  function skin(cv, member) {
    if (!cv || !member) return cv;
    let bladeHex = EQUIPMENT[member.equip?.weapon]?.tint || null,
      clothHex = EQUIPMENT[member.equip?.armor]?.tint || null;
    if (!bladeHex && !clothHex) return cv;
    let masks = SKIN_MASKS.get(cv);
    if (!masks) {
      masks = spriteMasks(cv, member === state.companion ? 'mage' : 'hero');
      SKIN_MASKS.set(cv, masks);
    }
    let key = (bladeHex || '-') + '|' + (clothHex || '-'),
      cache = SKIN_CACHE.get(cv);
    if (!cache) {
      cache = new Map();
      SKIN_CACHE.set(cv, cache);
    }
    let hit = cache.get(key);
    if (!hit) {
      if (cache.size >= 4) cache.delete(cache.keys().next().value);
      hit = tintSprite(cv, masks, bladeHex, clothHex);
      cache.set(key, hit);
    }
    return hit;
  }
  function chromaCanvas(img, w, h) {
    let c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    let q = c.getContext('2d', { willReadFrequently: true });
    q.imageSmoothingEnabled = true;
    q.drawImage(img, 0, 0, w, h);
    let im = q.getImageData(0, 0, w, h),
      d = im.data;
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i],
        g = d[i + 1],
        b = d[i + 2],
        green = g - Math.max(r, b);
      if (g > 110 && green > 18) {
        let a = Math.max(0, Math.min(255, 255 - (green - 18) * 2.7));
        d[i + 3] = a;
        if (a < 245) d[i + 1] = Math.min(g, Math.max(r, b) + 15);
      }
    }
    q.putImageData(im, 0, 0);
    return c;
  }
  function cropCell(base, sx, sy, sw, sh) {
    let q = base.getContext('2d', { willReadFrequently: true }),
      im = q.getImageData(sx, sy, sw, sh),
      d = im.data,
      minX = sw,
      minY = sh,
      maxX = 0,
      maxY = 0;
    for (let y = 0; y < sh; y++)
      for (let x = 0; x < sw; x++)
        if (d[(y * sw + x) * 4 + 3] > 35) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
    if (minX > maxX) return base;
    let pad = 4,
      w = maxX - minX + 1,
      h = maxY - minY + 1,
      c = document.createElement('canvas');
    c.width = w + pad * 2;
    c.height = h + pad * 2;
    c.getContext('2d').drawImage(base, sx + minX, sy + minY, w, h, pad, pad, w, h);
    return c;
  }
  function loadBattleSheet(src, frames, onReady) {
    let img = new Image();
    img.onload = () => {
      let base = chromaCanvas(img, 768, 512),
        cw = 256,
        ch = 256;
      frames.length = 0;
      for (let i = 0; i < 6; i++) frames.push(cropCell(base, (i % 3) * cw, Math.floor(i / 3) * ch, cw, ch));
      onReady();
      draw();
    };
    img.onerror = onReady;
    img.src = src;
  }
  function loadFieldSheet(key, src) {
    let img = new Image();
    img.onload = () => {
      let base = chromaCanvas(img, 512, 512),
        dirs = ['down', 'up', 'left', 'right'],
        cuts = {};
      dirs.forEach(
        (dir, i) => (cuts[dir] = cropCell(base, (i % 2) * 256, Math.floor(i / 2) * 256, 256, 256)),
      );
      fieldSprites[key] = cuts;
      fieldReady[key] = true;
      draw();
    };
    img.src = src;
  }
  function loadMageBattle(src) {
    mageBattleImg.onload = () => {
      let base = chromaCanvas(
          mageBattleImg,
          320,
          Math.round((mageBattleImg.height / mageBattleImg.width) * 320),
        ),
        cut = cropCell(base, 0, 0, base.width, base.height);
      mageBattleCut.width = cut.width;
      mageBattleCut.height = cut.height;
      mageBattleCut.getContext('2d').drawImage(cut, 0, 0);
      mageBattleReady = true;
      draw();
    };
    mageBattleImg.src = src;
  }
  function loadEnemyArt(key, src) {
    let img = new Image();
    img.onload = () => {
      let base = document.createElement('canvas'),
        bw = 320,
        bh = Math.round((img.height / img.width) * bw);
      base.width = bw;
      base.height = bh;
      let q = base.getContext('2d', { willReadFrequently: true });
      q.imageSmoothingEnabled = true;
      q.drawImage(img, 0, 0, bw, bh);
      let im = q.getImageData(0, 0, bw, bh),
        d = im.data,
        minX = bw,
        minY = bh,
        maxX = 0,
        maxY = 0;
      for (let y = 0; y < bh; y++)
        for (let x = 0; x < bw; x++) {
          let i = (y * bw + x) * 4,
            r = d[i],
            g = d[i + 1],
            b = d[i + 2],
            green = g - Math.max(r, b);
          if (g > 115 && green > 20) {
            let a = Math.max(0, Math.min(255, 255 - (green - 20) * 2.5));
            d[i + 3] = a;
            if (a < 245) d[i + 1] = Math.min(g, Math.max(r, b) + 18);
          }
          if (d[i + 3] > 35) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      q.putImageData(im, 0, 0);
      let pad = 3,
        w = Math.max(1, maxX - minX + 1),
        h = Math.max(1, maxY - minY + 1),
        cut = document.createElement('canvas');
      cut.width = w + pad * 2;
      cut.height = h + pad * 2;
      cut.getContext('2d').drawImage(base, minX, minY, w, h, pad, pad, w, h);
      enemyCuts[key] = cut;
      enemyReady[key] = true;
      draw();
    };
    img.src = src;
  }
  function enterTown() {
    let t = town();
    state.mode = 'town';
    state.x = t.spawn.x;
    state.y = t.spawn.y;
    state.fx = Math.max(1, t.spawn.x - 1);
    state.fy = t.spawn.y;
    state.dir = 'left';
    state.walk = 0;
    state.steps = 0;
    state.busy = false;
    sfx('shrine');
    setMsg(t.name + 'に着いた。' + t.subtitle + '。');
    sync();
    draw();
    saveGame();
  }
  function exitTown() {
    state.mode = 'field';
    state.x = 1;
    state.y = 10;
    state.fx = 1;
    state.fy = 10;
    state.dir = 'up';
    state.walk = 0;
    state.steps = 0;
    state.busy = false;
    sfx('step' + state.chapter);
    setMsg(
      state.chapter === 3
        ? '二人は雲海に浮かぶ星骸の塔へ踏み込んだ。'
        : state.chapter === 2
          ? 'ルカとミナは月影の森へ足を踏み入れた。'
          : 'ここがダンジョンの入口だ。',
    );
    sync();
    draw();
    saveGame();
  }
  async function move(dx, dy) {
    if (
      (state.mode !== 'field' && state.mode !== 'town') ||
      state.busy ||
      $('#overlay').classList.contains('show')
    )
      return false;
    let inTown = state.mode === 'town';
    state.dir = dx < 0 ? 'left' : dx > 0 ? 'right' : dy < 0 ? 'up' : 'down';
    let ox = state.x,
      oy = state.y,
      nx = ox + dx,
      ny = oy + dy,
      next = tile(nx, ny);
    if (next === '1' || next === '9') {
      state.walk = 0;
      sfx('bump');
      setMsg(
        next === '9'
          ? '澄んだ水が湧く泉。旅人が水をくんでいる。'
          : inTown
            ? '町の家並みが道をふさいでいる。'
            : state.chapter === 4
              ? '黄昏に染まった塔の石壁が行く手をふさいでいる。'
              : state.chapter === 3
                ? '崩れた浮遊壁が行く手をふさいでいる。'
                : state.chapter === 2
                  ? '絡み合う根と茂みが道をふさいでいる。'
                  : '冷たい石壁が行く手をふさいでいる。',
      );
      draw();
      return false;
    }
    state.busy = true;
    sfx(inTown ? 'step1' : 'step' + state.chapter);
    await animateStep(ox, oy, nx, ny, !!heldDir);
    if (state.companion.active) {
      state.fx = ox;
      state.fy = oy;
    }
    state.x = nx;
    state.y = ny;
    state.walk = 0;
    state.busy = false;
    if (inTown) {
      sync();
      draw();
      if (next === '2') {
        exitTown();
        return true;
      }
      if (next === '5') {
        saveGame();
        openInn();
        return true;
      }
      if (next === '6') {
        saveGame();
        openShop('weapon');
        return true;
      }
      if (next === '7') {
        saveGame();
        openShop('armor');
        return true;
      }
      if (next === '8') {
        saveGame();
        openShop('item');
        return true;
      }
      setMsg(town().name + 'の通りを歩いている……');
      sync();
      draw();
      saveSoon();
      return true;
    }
    state.steps++;
    if (isTower()) {
      if (next === 'u') {
        await changeFloor(currentFloor() + 1);
        return true;
      }
      if (next === 'd') {
        await changeFloor(currentFloor() - 1);
        return true;
      }
      if (next === 'c') {
        openChest(nx, ny);
        return true;
      }
      if (next === 'p') {
        await fallThroughPit();
        return true;
      }
    }
    if (next === '3' && state.bossAlive) {
      state.x = ox;
      state.y = oy;
      if (state.companion.active) {
        state.fx = ox;
        state.fy = oy;
      }
      saveGame();
      startBattle(BOSSES[state.chapter]);
      return true;
    }
    if (next === '4') {
      state.hero.hp = state.hero.maxHp;
      if (state.companion.active) state.companion.hp = state.companion.maxHp;
      state.steps = 0;
      state.skillUses = Object.fromEntries(SKILLS.map(s => [s.id, s.uses]));
      state.mageUses = { heal: 2 };
      setMsg(
        state.chapter === 4
          ? '宵の残り火が二人を包んだ。戦闘不能も癒え、全員HP全回復！'
          : state.chapter === 3
            ? '星詠みの環が輝いた。戦闘不能も癒え、全員HP全回復！'
            : state.chapter === 2
              ? '月の泉の光が二人を包んだ。戦闘不能も癒え、全員HP全回復！'
              : '灯火の祭壇が輝いた。戦闘不能も癒え、HP全回復！',
      );
      sfx('shrine');
      sync();
      draw();
      saveGame();
      return true;
    }
    if (next === '2') {
      enterTown();
      return true;
    }
    if (state.steps > 3 && Math.random() < 0.135) {
      state.steps = 0;
      saveGame();
      startBattle(
        rollEncounterGroup(
          isTower() ? TOWER_ENCOUNTERS[currentFloor()] || ENCOUNTERS[4] : ENCOUNTERS[state.chapter],
          state.chapter,
        ),
      );
      return true;
    }
    setMsg(
      state.chapter === 4
        ? '二人の足音が、塔の螺旋にこだまする……'
        : state.chapter === 3
          ? '風と歯車の音が、天空の回廊に響く……'
          : state.chapter === 2
            ? '月明かりの下、二人の足音が重なる……'
            : '足音が石牢に響く……',
    );
    sync();
    draw();
    saveSoon();
    return true;
  }
  function animateStep(ox, oy, nx, ny, continuous) {
    return new Promise(done => {
      let started = performance.now(),
        duration = continuous ? 128 : 150,
        fox = state.fx,
        foy = state.fy;
      function frame(now) {
        let p = Math.min(1, (now - started) / duration),
          ease = continuous ? p : p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2,
          walkFrame = Math.min(3, Math.floor(p * 4));
        drawMap();
        if (state.companion.active)
          drawFieldCompanion(
            (fox + (ox - fox) * ease) * T + 10,
            (foy + (oy - foy) * ease) * T + 10,
            state.dir,
            walkFrame,
          );
        drawFieldHero(
          (ox + (nx - ox) * ease) * T + 10,
          (oy + (ny - oy) * ease) * T + 10,
          state.dir,
          walkFrame,
        );
        if (p < 1) requestAnimationFrame(frame);
        else done();
      }
      requestAnimationFrame(frame);
    });
  }
  function resetBattleMotion() {
    state.battlePose = 0;
    state.heroLunge = 0;
    state.heroLift = 0;
    state.heroStretch = 1;
    state.heroAfterimage = 0;
    state.heroHit = 0;
    state.mageCast = 0;
    state.mageFrame = 0;
    state.mageSpin = 0;
    state.mageHit = 0;
    state.mageLunge = 0;
    state.mageLift = 0;
    state.mageStaffStrike = 0;
    state.staffFx = null;
    state.attackFx = 0;
    state.criticalFx = null;
    state.enemyShift = 0;
    state.enemyMotion = 0;
    state.enemyScale = 1;
    state.enemyAttackFx = null;
    state.enemyHitFx = null;
    state.sparkFx = null;
    state.battleFlash = 0;
    state.battleDim = 0;
    state.cameraShake = null;
  }
  function drawStaffImpact() {
    let fx = state.staffFx;
    if (!fx) return;
    let p = Math.max(0, Math.min(1, fx.p || 0)),
      r = 5 + p * 16,
      x = 218,
      y = 120;
    X.save();
    X.globalAlpha = 1 - p;
    X.strokeStyle = '#fff1bf';
    X.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      let a = (i * Math.PI) / 3 + 0.2;
      X.beginPath();
      X.moveTo(x + Math.cos(a) * 4, y + Math.sin(a) * 4);
      X.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      X.stroke();
    }
    X.fillStyle = '#a97b49';
    for (let i = 0; i < 5; i++) {
      let a = i * 1.31,
        r2 = 7 + p * (10 + i * 2);
      X.fillRect(x + Math.cos(a) * r2, y + Math.sin(a) * r2, 3, 3);
    }
    X.restore();
  }
  function enemyAttackAnimation(type = 'attack') {
    return new Promise(done => {
      let started = performance.now(),
        duration = type === 'savage' ? 760 : type === 'all' ? 460 : type === 'charge' ? 520 : 340;
      if (type === 'savage') {
        sfx('starCharge');
        cameraShake(6, 420);
      }
      function frame(now) {
        let p = Math.min(1, (now - started) / duration),
          rush = Math.max(0, Math.min(1, (p - 0.18) / 0.42));
        if (type === 'charge') {
          state.enemyMotion = -7 * Math.sin(Math.PI * p);
          state.enemyScale = 1 + 0.12 * Math.sin(Math.PI * p);
        } else if (p < 0.2) {
          state.enemyMotion = 8 * (p / 0.2);
          state.enemyScale = 1 - 0.08 * (p / 0.2);
        } else if (p < 0.62) {
          state.enemyMotion = 8 - 58 * Math.sin((rush * Math.PI) / 2);
          state.enemyScale = 1.08;
        } else {
          let q = (p - 0.62) / 0.38;
          state.enemyMotion = -50 * (1 - q);
          state.enemyScale = 1 + 0.08 * (1 - q);
        }
        state.enemyAttackFx = { type, p };
        draw();
        if (p < 1) requestAnimationFrame(frame);
        else {
          state.enemyMotion = 0;
          state.enemyScale = 1;
          state.enemyAttackFx = null;
          draw();
          done();
        }
      }
      requestAnimationFrame(frame);
    });
  }
  function sparkAnimation(name, member) {
    return new Promise(done => {
      let started = performance.now(),
        duration = 880;
      sfx('spark');
      function frame(now) {
        let p = Math.min(1, (now - started) / duration);
        state.sparkFx = { p, name, actor: member === state.hero ? 'hero' : 'mage' };
        if (p > 0.42 && p < 0.58) {
          state.heroLift = member === state.hero ? -5 : 0;
          state.mageCast = member === state.companion ? 1 : 0;
        }
        draw();
        if (p < 1) requestAnimationFrame(frame);
        else {
          state.sparkFx = null;
          state.heroLift = 0;
          state.mageCast = 0;
          draw();
          done();
        }
      }
      requestAnimationFrame(frame);
    });
  }
  function livingEnemies() {
    return (state.enemies || []).filter(e => e.hp > 0);
  }
  function visibleFoes() {
    return (state.enemies?.length ? state.enemies : [state.enemy]).filter(v => v && !v.defeated);
  }
  function foeSlots() {
    let vis = visibleFoes();
    if (!vis.length) return [];
    let others = vis.filter(v => v !== state.enemy);
    return [{ foe: state.enemy, x: 235, y: 112 }].concat(
      others.map((f, i) => ({ foe: f, x: i ? 188 : 285, y: 112 })),
    );
  }
  function foeAtPoint(px, py) {
    return (
      foeSlots().find(s => s.foe && s.foe.hp > 0 && Math.abs(px - s.x) < 42 && py > s.y - 58 && py < s.y + 56)
        ?.foe || null
    );
  }
  let targetPick = null;
  function openTargetMenu(title, onPick) {
    sfx('menuOpen');
    let foes = livingEnemies();
    $('#skillMenu').innerHTML =
      foes
        .map(
          (f, i) =>
            '<button data-target="' +
            i +
            '">' +
            (f === state.enemy ? '▶ ' : '') +
            f.name +
            ' <small>HP ' +
            Math.max(1, Math.round((100 * f.hp) / f.maxHp)) +
            '%' +
            (f.charging ? '　力をためている' : '') +
            '</small></button>',
        )
        .join('') + '<button class="back" data-target="back">もどる</button>';
    targetPick = onPick;
    state.skillMenu = false;
    state.itemMenu = false;
    state.targetMenu = true;
    setMsg(title + '　だれを狙う？');
    sync();
  }
  function chooseTarget(value) {
    if (value === 'back') {
      targetPick = null;
      closeSubMenu();
      return;
    }
    let foe = livingEnemies()[Number(value)],
      pick = targetPick;
    targetPick = null;
    state.targetMenu = false;
    if (!foe || !pick) {
      closeSubMenu();
      return;
    }
    state.enemy = foe;
    sync();
    pick(foe);
  }
  function chooseEnemyTarget() {
    for (let e of state.enemies || []) if (e.hp <= 0) e.defeated = true;
    state.enemy = livingEnemies()[0] || null;
    return state.enemy;
  }
  function startBattle(keys) {
    keys = Array.isArray(keys) ? keys : [keys];
    let counts = {},
      seen = {},
      factor = keys.length === 1 ? 1 : keys.length === 2 ? 0.82 : 0.66;
    keys.forEach(key => (counts[key] = (counts[key] || 0) + 1));
    state.enemies = keys.map(key => {
      let base = enemies[key],
        index = seen[key] || 0;
      seen[key] = index + 1;
      let maxHp = Math.max(1, Math.round(base.maxHp * factor)),
        attackFactor = keys.length === 1 ? 1 : keys.length === 2 ? 0.82 : 0.7;
      return {
        ...base,
        name: counts[key] > 1 ? base.name + ' ' + String.fromCharCode(65 + index) : base.name,
        maxHp,
        hp: maxHp,
        atk: Math.max(1, Math.round(base.atk * attackFactor)),
        exp: Math.max(1, Math.round(base.exp * factor)),
        key,
        turn: 0,
        charging: false,
        defeated: false,
      };
    });
    state.enemy = state.enemies[0];
    let e = state.enemy;
    for (let member of [state.hero, state.companion]) {
      member.guarding = false;
      member.charged = false;
      member.expBoost = 1;
    }
    state.actor = state.hero.hp > 0 ? 'hero' : 'mage';
    state.mode = 'battle';
    resetBattleMotion();
    state.skillFx = null;
    state.battleReadyAt = performance.now() + 700;
    state.busy = true;
    state.skillMenu = false;
    state.itemMenu = false;
    state.targetMenu = false;
    targetPick = null;
    state.skillUses = Object.fromEntries(SKILLS.map(s => [s.id, s.uses]));
    state.mageUses = { heal: 2 };
    setMsg(
      e.boss
        ? e.name + 'が行く手を遮った！'
        : state.enemies.length > 1
          ? state.enemies.length + '体の魔物が現れた！'
          : e.name + 'が現れた！',
    );
    gameAudio?.startBattle();
    if (e.boss) sfx('enemy');
    sync();
    draw();
    buildTurnOrder();
    (async () => {
      await delay(760);
      if (state.mode === 'battle') await nextTurn();
    })();
  }
  function damage(atk, def) {
    return Math.max(1, atk - Math.floor(def / 2) + rand(-2, 2));
  }
  function openSkillMenu() {
    if (state.mode !== 'battle' || state.busy) return;
    let member = currentActor(),
      learned = SKILLS.filter(s => s.owner === state.actor && member.learnedSkills.includes(s.id));
    if (!learned.length) {
      setMsg(actorName(member) + 'はまだワザを閃いていない。');
      return;
    }
    sfx('menuOpen');
    $('#skillMenu').innerHTML =
      learned
        .map(
          s =>
            '<button data-skill="' +
            s.id +
            '" ' +
            ((state.skillUses[s.id] || 0) <= 0 ? 'disabled' : '') +
            '>✦ ' +
            s.name +
            ' <small>' +
            s.desc +
            '　残' +
            (state.skillUses[s.id] || 0) +
            '回</small></button>',
        )
        .join('') + '<button class="back" data-skill="back">もどる</button>';
    state.itemMenu = false;
    state.skillMenu = true;
    sync();
  }
  function closeSubMenu() {
    sfx('menuClose');
    targetPick = null;
    state.skillMenu = false;
    state.itemMenu = false;
    state.targetMenu = false;
    setMsg(actorName() + 'の行動を選んでください。');
    sync();
  }
  function openItemMenu() {
    if (state.mode !== 'battle' || state.busy) return;
    sfx('menuOpen');
    let usable = Object.entries(ITEMS).filter(([id, item]) => item.usable && itemCount(id) > 0);
    $('#skillMenu').innerHTML =
      (usable.length
        ? usable
            .map(
              ([id, item]) =>
                '<button data-item="' +
                id +
                '">' +
                item.icon +
                ' ' +
                item.name +
                ' <small>' +
                item.desc +
                '　×' +
                itemCount(id) +
                '</small></button>',
            )
            .join('')
        : '<button disabled>使えるどうぐがない</button>') +
      '<button class="back" data-item="back">もどる</button>';
    state.skillMenu = false;
    state.itemMenu = true;
    sync();
  }
  function mostInjuredMember() {
    let living = [state.hero, ...(state.companion.active ? [state.companion] : [])].filter(
      v => v.hp > 0 && v.hp < v.maxHp,
    );
    return living.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] || null;
  }
  async function maybeSpark(member, action) {
    let candidates = SKILLS.filter(
      s => s.owner === state.actor && member.lv >= s.lv && !member.learnedSkills.includes(s.id),
    );
    if (!candidates.length) {
      member.chargeUsed = false;
      return false;
    }
    let chance = sparkChanceForAction(action, !!member.chargeUsed),
      preferred = candidates.filter(s => s.spark?.includes(action));
    member.chargeUsed = false;
    if (Math.random() >= chance) return false;
    let pool = preferred.length ? preferred : candidates,
      skill = pool[Math.floor(Math.random() * pool.length)];
    member.learnedSkills.push(skill.id);
    sfx('level');
    setMsg('💡 ' + actorName(member) + 'は「' + skill.name + '」を閃いた！');
    sync();
    await sparkAnimation(skill.name, member);
    return true;
  }
  async function finishActorTurn(action) {
    let member = currentActor();
    await maybeSpark(member, action);
    if (!livingEnemies().length) {
      await win();
      return true;
    }
    chooseEnemyTarget();
    await nextTurn();
    return true;
  }
  async function useBattleItem(id) {
    if (state.mode !== 'battle' || state.busy) return;
    if (id === 'back') {
      closeSubMenu();
      return;
    }
    let item = ITEMS[id];
    if (!item?.usable || itemCount(id) <= 0) return;
    let targets = item.healAll
      ? [state.hero, ...(state.companion.active ? [state.companion] : [])].filter(
          v => v.hp > 0 && v.hp < v.maxHp,
        )
      : [mostInjuredMember()].filter(Boolean);
    if (!targets.length) {
      setMsg('回復が必要な仲間はいない。');
      return;
    }
    state.busy = true;
    state.itemMenu = false;
    consumeItem(id);
    sfx('potion');
    let total = 0;
    targets.forEach(target => {
      let heal = Math.min(healPower(item, target), target.maxHp - target.hp);
      target.hp += heal;
      total += heal;
      floatText('+' + heal, target === state.hero ? 53 : 112, 175, '#6eff90');
    });
    setMsg(actorName() + 'は ' + item.name + 'を使った！ HPが合計 ' + total + ' 回復！');
    sync();
    await delay(650);
    await finishActorTurn('item');
  }
  function enemyAnchorX(foe) {
    let visible = (state.enemies?.length ? state.enemies : [state.enemy]).filter(v => v && !v.defeated);
    if (foe === state.enemy) return 230;
    let others = visible.filter(v => v !== state.enemy),
      i = others.indexOf(foe);
    return i <= 0 ? 283 : 186;
  }
  function healTargets() {
    return [state.hero, ...(state.companion.active ? [state.companion] : [])].filter(
      v => v.hp > 0 && v.hp < v.maxHp,
    );
  }
  function skillMotion(s) {
    if (state.actor === 'hero') {
      if (s.motion === 'starfire') return starfireAnimation(s.name);
      if (s.motion === 'crescent') return comboSlashAnimation(s.name, Math.max(2, s.hits || 2));
      if (s.motion === 'whirl') return whirlAnimation(s.name);
      if (s.motion === 'pierce') return pierceAnimation(s.name);
      if (s.motion === 'heal') return healingAnimation(s.name);
      return heroAttackAnimation();
    }
    if (s.motion === 'moonheal') return moonMagicAnimation('heal', s.name);
    if (s.motion === 'moonveil') return moonMagicAnimation('veil', s.name);
    if (s.motion === 'starshower') return starShowerAnimation(s.name, false);
    if (s.motion === 'starfall') return starShowerAnimation(s.name, true);
    return moonMagicAnimation('attack', s.name);
  }
  async function useSkill(id, forcedTarget) {
    if (state.mode !== 'battle' || state.busy) return;
    if (id === 'back') {
      closeSubMenu();
      return;
    }
    let member = currentActor(),
      s = SKILLS.find(v => v.id === id && v.owner === state.actor);
    if (!s || member.hp <= 0 || !member.learnedSkills.includes(id)) return;
    if ((state.skillUses[id] || 0) <= 0) {
      setMsg(s.name + 'はこの戦闘ではもう使えない。');
      closeSubMenu();
      return;
    }
    if (!s.heal && !s.healAll && s.target !== 'all' && !forcedTarget && livingEnemies().length > 1) {
      openTargetMenu(s.name, foe => useSkill(id, foe));
      return;
    }
    if (forcedTarget) state.enemy = forcedTarget;
    if (!s.heal && !s.healAll && (!state.enemy || state.enemy.hp <= 0) && !chooseEnemyTarget()) return;
    state.targetMenu = false;
    let group = s.healAll ? healTargets() : null,
      target = s.heal ? mostInjuredMember() : null;
    if ((s.heal && !target) || (s.healAll && !group.length)) {
      setMsg('HPは全員満タンだ。');
      state.skillMenu = false;
      sync();
      return;
    }
    state.busy = true;
    state.skillMenu = false;
    state.skillUses[id]--;
    setMsg(actorName(member) + 'の「' + s.name + '」！');
    let charged = !!member.charged;
    member.charged = false;
    member.chargeUsed = charged;
    if (s.heal || s.healAll) {
      await skillMotion(s);
      let list = s.healAll ? group : [target],
        total = 0;
      list.forEach(t => {
        let heal = Math.min(healPower(s, t), t.maxHp - t.hp);
        t.hp += heal;
        total += heal;
        floatText('+' + heal, t === state.hero ? 53 : 112, 175, '#9ffff0');
      });
      sfx('heal');
      setMsg(
        s.healAll
          ? '仲間全員のHPが 合計' + total + ' 回復！'
          : actorName(target) + 'のHPが ' + total + ' 回復！',
      );
      sync();
    } else {
      let boost = charged ? 1.5 : 1,
        foes = s.target === 'all' ? livingEnemies() : [state.enemy],
        hits = Math.max(1, s.hits || 1),
        sum = 0,
        lines = [];
      await skillMotion(s);
      foes.forEach((foe, i) => {
        let base = s.ignoreDef
            ? Math.max(1, atkOf(member) + 2 + rand(-2, 2))
            : damage(atkOf(member) + 2, foe.def),
          total = 0;
        for (let h = 0; h < hits; h++) {
          let d = Math.max(2, Math.round(base * (s.power / hits) * boost));
          foe.hp = Math.max(0, foe.hp - d);
          total += d;
        }
        sum += total;
        lines.push(foe.name + 'に ' + total + ' ダメージ！');
        floatText(
          String(total),
          enemyAnchorX(foe),
          foe === state.enemy ? 85 : 96,
          state.actor === 'hero' ? '#ffcf55' : '#b9f6ff',
        );
      });
      sfx('hit');
      vibrate(28);
      flashEnemy();
      setMsg(foes.length > 1 ? '魔物' + foes.length + '体に 合計' + sum + ' ダメージ！' : lines[0]);
      draw();
    }
    await delay(600);
    await finishActorTurn('skill');
  }
  async function act(kind, forcedTarget) {
    if (state.mode !== 'battle' || state.busy || performance.now() < (state.battleReadyAt || 0)) return;
    let member = currentActor();
    if (!member || member.hp <= 0) return;
    if (kind === 'skills') {
      openSkillMenu();
      return;
    }
    if (kind === 'potion') {
      openItemMenu();
      return;
    }
    if (kind === 'attack' && !forcedTarget && livingEnemies().length > 1) {
      openTargetMenu('たたかう', foe => act('attack', foe));
      return;
    }
    if (forcedTarget) state.enemy = forcedTarget;
    let e = state.enemy;
    if (!e || e.hp <= 0) e = chooseEnemyTarget();
    if (!e) return;
    state.targetMenu = false;
    state.busy = true;
    if (kind === 'guard') {
      member.guarding = true;
      setMsg(actorName(member) + 'は身を固めた！ このターンは防御力2倍。');
      sfx('guard');
      sync();
      draw();
      await delay(620);
      await finishActorTurn('guard');
      return;
    }
    if (kind === 'wait') {
      member.charged = true;
      member.expBoost = Math.min(1.5, (member.expBoost || 1) + 0.15);
      setMsg(actorName(member) + 'は集中して力をためた！ 次の攻撃1.5倍。');
      sfx('charge');
      sync();
      draw();
      await delay(720);
      await finishActorTurn('wait');
      return;
    }
    if (kind === 'run') {
      if (e.boss) {
        setMsg('ボスからは逃げられない！');
        sfx('fleeFail');
        await delay(650);
        await finishActorTurn('run');
      } else if (Math.random() < 0.72) {
        setMsg('二人はうまく逃げ切った！');
        sfx('flee');
        await delay(500);
        state.mode = 'field';
        state.enemy = null;
        state.enemies = [];
        state.busy = false;
        sync();
        draw();
        saveGame();
      } else {
        setMsg('回り込まれてしまった！');
        sfx('fleeFail');
        await delay(550);
        await finishActorTurn('run');
      }
      return;
    }
    let charged = !!member.charged;
    member.charged = false;
    member.chargeUsed = charged;
    let boost = charged ? 1.5 : 1;
    if (state.actor === 'hero') {
      let result = resolveHeroAttack({ ...member, atk: atkOf(member) }, e);
      result.damage = Math.round(result.damage * boost);
      setMsg(result.kind === 'critical' ? 'ルカは剣に力を集めた……' : 'ルカの攻撃！');
      await heroAttackAnimation(result.kind);
      if (result.kind === 'miss') {
        sfx('miss');
        setMsg(e.name + 'は身をかわした！');
        floatText('MISS', 230, 84, '#9aa9d8');
      } else {
        e.hp = Math.max(0, e.hp - result.damage);
        if (result.kind === 'critical') {
          vibrate([35, 25, 90]);
          flashEnemy();
          floatText(String(result.damage) + '!', 230, 88, '#fff3a0');
          setMsg('会心の一撃！ ' + e.name + 'に ' + result.damage + ' ダメージ！');
        } else {
          sfx('hit');
          vibrate(20);
          flashEnemy();
          floatText(String(result.damage), 230, 85, '#fff176');
          setMsg(e.name + 'に ' + result.damage + ' ダメージ！');
        }
      }
      draw();
      await delay(result.kind === 'critical' ? 820 : 560);
    } else {
      let d = Math.max(1, Math.round(damage(Math.round(atkOf(member) * 0.5) + 1, e.def) * boost));
      setMsg('ミナは杖を構えた！');
      await mageStaffAnimation();
      e.hp = Math.max(0, e.hp - d);
      flashEnemy();
      vibrate(16);
      floatText(String(d), 230, 86, '#fff2b3');
      setMsg('ミナの杖！ ' + e.name + 'に ' + d + ' ダメージ！');
      draw();
      await delay(420);
    }
    await finishActorTurn('attack');
  }
  function heroAttackAnimation(kind = 'normal') {
    return new Promise(done => {
      let started = performance.now(),
        duration = kind === 'critical' ? 920 : BATTLE_EFFECTS.normal.duration,
        slashSound = false,
        impactSound = false;
      function frame(now) {
        let p = Math.min(1, (now - started) / duration);
        state.heroStretch = 1;
        state.heroLift = 0;
        state.enemyShift = 0;
        state.battleFlash = 0;
        if (kind === 'critical') {
          if (p < 0.16) {
            let q = p / 0.16;
            state.battlePose = 1;
            state.heroLunge = -11 * q;
            state.heroLift = 4 * q;
            state.heroStretch = 1 - 0.1 * q;
            state.criticalFx = { phase: 'charge', p: q };
          } else if (p < 0.28) {
            let q = (p - 0.16) / 0.12;
            state.battlePose = 2;
            state.heroLunge = -11;
            state.heroLift = 4 - 15 * q;
            state.heroStretch = 0.9 + q * 0.2;
            state.criticalFx = { phase: 'charge', p: 1 };
          } else if (p < 0.48) {
            let q = (p - 0.28) / 0.2;
            state.battlePose = 3;
            state.heroLunge = -11 + 108 * Math.pow(q, 0.55);
            state.heroLift = -11 - 24 * Math.sin(q * Math.PI);
            state.heroStretch = 1.16;
            state.heroAfterimage = 1;
            state.attackFx = q;
            if (!slashSound) {
              slashSound = true;
              sfx('slash');
            }
          } else if (p < 0.65) {
            let q = (p - 0.48) / 0.17;
            state.battlePose = 4;
            state.heroLunge = 97;
            state.heroLift = -8;
            state.heroStretch = 0.94;
            state.heroAfterimage = 1 - q;
            state.attackFx = 1;
            state.battleFlash = 1 - q;
            state.criticalFx = { phase: 'impact', p: q };
            if (!impactSound) {
              impactSound = true;
              sfx('critical');
              wrap.classList.remove('shake');
              void wrap.offsetWidth;
              wrap.classList.add('shake');
            }
          } else {
            let q = (p - 0.65) / 0.35;
            state.battlePose = q < 0.78 ? 5 : 0;
            state.heroLunge = 97 * (1 - q);
            state.heroLift = -8 * (1 - q);
            state.heroAfterimage = 0;
            state.attackFx = 1 - q;
            state.criticalFx = { phase: 'fade', p: q };
          }
        } else {
          if (p < 0.14) {
            let q = p / 0.14;
            state.battlePose = 1;
            state.heroLunge = -10 * q;
            state.heroLift = 3 * q;
            state.heroStretch = 1 - 0.1 * q;
          } else if (p < 0.25) {
            let q = (p - 0.14) / 0.11;
            state.battlePose = 2;
            state.heroLunge = -10;
            state.heroLift = 3 - 12 * q;
            state.heroStretch = 0.9 + q * 0.16;
          } else if (p < 0.48) {
            let q = (p - 0.25) / 0.23;
            state.battlePose = 3;
            state.heroLunge = -10 + 86 * Math.pow(q, 0.5);
            state.heroLift = -9 - 18 * Math.sin(q * Math.PI);
            state.heroStretch = 1.14;
            state.heroAfterimage = 1;
            state.attackFx = q;
            if (!slashSound) {
              slashSound = true;
              sfx('slash');
            }
          } else if (p < 0.63) {
            let q = (p - 0.48) / 0.15;
            state.battlePose = 4;
            state.heroLunge = 76;
            state.heroLift = -5;
            state.heroStretch = 0.95;
            state.heroAfterimage = 1 - q;
            state.attackFx = 1;
            state.battleFlash = (1 - q) * 0.55;
            if (kind === 'miss') state.enemyShift = 18 * Math.sin(q * Math.PI);
          } else {
            let q = (p - 0.63) / 0.37;
            state.battlePose = q < 0.78 ? 5 : 0;
            state.heroLunge = 76 * (1 - q);
            state.heroLift = -5 * (1 - q);
            state.heroAfterimage = 0;
            state.attackFx = 1 - q;
          }
        }
        draw();
        if (p < 1) requestAnimationFrame(frame);
        else {
          resetBattleMotion();
          state.battleFlash = 0;
          draw();
          done();
        }
      }
      requestAnimationFrame(frame);
    });
  }
  // 三日月返し/牙断ち乱れ: 踏み込み→斬り抜け→反転して斬り上げ、を段数ぶん繋ぐ連続斬り
  function comboSlashAnimation(label, hits = 2) {
    return new Promise(done => {
      let started = performance.now(),
        duration = 760 + hits * 430,
        head = 0.1,
        tail = 0.16,
        span = (1 - head - tail) / hits,
        fired = {};
      function once(k, fn) {
        if (!fired[k]) {
          fired[k] = 1;
          fn();
        }
      }
      function frame(now) {
        let p = Math.min(1, (now - started) / duration);
        state.heroStretch = 1;
        state.heroLift = 0;
        state.enemyShift = 0;
        state.battleFlash = 0;
        state.battleDim = 0.1 * Math.sin(Math.PI * Math.min(1, p * 1.25));
        if (p < head) {
          let q = p / head;
          state.battlePose = 1;
          state.heroLunge = -13 * q;
          state.heroLift = 4 * q;
          state.heroStretch = 1 - 0.09 * q;
          state.skillFx = { type: 'slashCombo', phase: 'ready', p, hit: -1, local: q, hits, label };
        } else if (p < 1 - tail) {
          let raw = (p - head) / span,
            i = Math.min(hits - 1, Math.floor(raw)),
            q = raw - i,
            near = 84 + i * 7,
            from = i === 0 ? -13 : near - 30,
            up = i % 2 ? -26 : 6;
          if (q < 0.4) {
            let e = Math.pow(q / 0.4, 0.5);
            state.battlePose = 3;
            state.heroLunge = from + (near - from) * e;
            state.heroLift = up * e - 14 * Math.sin(e * Math.PI);
            state.heroStretch = 1.15;
            state.heroAfterimage = 1;
            state.attackFx = q / 0.4;
            once('s' + i, () => sfx('slash'));
            state.skillFx = { type: 'slashCombo', phase: 'dash', p, hit: i, local: q / 0.4, hits, label };
          } else if (q < 0.62) {
            let e = (q - 0.4) / 0.22;
            state.battlePose = 4;
            state.heroLunge = near;
            state.heroLift = up;
            state.heroStretch = 0.95;
            state.heroAfterimage = 1 - e;
            state.attackFx = 1;
            state.battleFlash = (1 - e) * 0.5;
            state.enemyShift = 9 * Math.sin(e * Math.PI);
            once('h' + i, () => {
              sfx('hit');
              cameraShake(2.4, 90);
              vibrate(16);
            });
            state.skillFx = { type: 'slashCombo', phase: 'impact', p, hit: i, local: 1, hits, label };
          } else {
            let e = (q - 0.62) / 0.38;
            state.battlePose = 5;
            state.heroLunge = near - 30 * e;
            state.heroLift = up * (1 - e);
            state.heroAfterimage = 0;
            state.attackFx = 1 - e;
            state.skillFx = { type: 'slashCombo', phase: 'recoil', p, hit: i, local: 1, hits, label };
          }
        } else {
          let q = (p - (1 - tail)) / tail;
          state.battlePose = q < 0.7 ? 5 : 0;
          state.heroLunge = (84 + (hits - 1) * 7 - 30) * (1 - q);
          state.heroLift = 0;
          state.attackFx = 0;
          state.skillFx = { type: 'slashCombo', phase: 'return', p, hit: hits - 1, local: 1, hits, label };
        }
        draw();
        if (p < 1) requestAnimationFrame(frame);
        else {
          state.skillFx = null;
          resetBattleMotion();
          draw();
          done();
        }
      }
      requestAnimationFrame(frame);
    });
  }
  // 断空円舞: 跳び上がって回転しながら敵全体を薙ぐ
  function whirlAnimation(label) {
    return new Promise(done => {
      let started = performance.now(),
        duration = 1720,
        fired = {};
      sfx('starCharge');
      function once(k, fn) {
        if (!fired[k]) {
          fired[k] = 1;
          fn();
        }
      }
      function frame(now) {
        let p = Math.min(1, (now - started) / duration),
          phase = 'ready';
        state.heroStretch = 1;
        state.enemyShift = 0;
        state.battleFlash = 0;
        state.battleDim = 0.2 * Math.sin(Math.PI * Math.min(1, p * 1.2));
        if (p < 0.15) {
          let q = p / 0.15;
          state.battlePose = 2;
          state.heroLunge = -14 * q;
          state.heroLift = 6 * q;
          state.heroStretch = 1 - 0.1 * q;
        } else if (p < 0.28) {
          let q = (p - 0.15) / 0.13;
          state.battlePose = 3;
          state.heroLunge = -14 + 132 * Math.pow(q, 0.6);
          state.heroLift = 6 - 52 * q;
          state.heroStretch = 1.12;
          state.heroAfterimage = 1;
          phase = 'leap';
          once('leap', () => sfx('dash'));
        } else if (p < 0.66) {
          let q = (p - 0.28) / 0.38;
          state.battlePose = [3, 4, 5][Math.floor(q * 9) % 3];
          state.heroLunge = 118 + 8 * Math.sin(q * Math.PI * 6);
          state.heroLift = -46 + 30 * q;
          state.heroStretch = 1 + 0.1 * Math.sin(q * Math.PI * 6);
          state.heroAfterimage = 1;
          phase = 'spin';
          [0, 0.34, 0.68].forEach((k, i) => {
            if (q > k)
              once('sp' + i, () => {
                sfx('slash');
                cameraShake(2, 70);
              });
          });
        } else if (p < 0.76) {
          let q = (p - 0.66) / 0.1;
          state.battlePose = 4;
          state.heroLunge = 118;
          state.heroLift = -16 + 16 * q;
          state.heroAfterimage = 1 - q;
          state.battleFlash = 1 - q;
          phase = 'burst';
          once('burst', () => {
            sfx('starBurst');
            cameraShake(5.5, 170);
            vibrate(48);
          });
        } else {
          let q = (p - 0.76) / 0.24;
          state.battlePose = q < 0.72 ? 5 : 0;
          state.heroLunge = 118 * (1 - q);
          state.heroLift = 0;
          state.heroAfterimage = 0;
          phase = 'return';
        }
        state.skillFx = { type: 'whirl', phase, p, label };
        draw();
        if (p < 1) requestAnimationFrame(frame);
        else {
          state.skillFx = null;
          resetBattleMotion();
          draw();
          done();
        }
      }
      requestAnimationFrame(frame);
    });
  }
  // 鎧断ち: 大きく振りかぶって装甲ごと断ち割る一撃
  function pierceAnimation(label) {
    return new Promise(done => {
      let started = performance.now(),
        duration = 1560,
        fired = {};
      sfx('starCharge');
      function once(k, fn) {
        if (!fired[k]) {
          fired[k] = 1;
          fn();
        }
      }
      function frame(now) {
        let p = Math.min(1, (now - started) / duration),
          phase = 'charge';
        state.heroStretch = 1;
        state.enemyShift = 0;
        state.battleFlash = 0;
        state.battleDim = p < 0.72 ? 0.22 : 0.22 * Math.max(0, (0.92 - p) / 0.2);
        if (p < 0.3) {
          let q = p / 0.3;
          state.battlePose = 2;
          state.heroLunge = -13 * q;
          state.heroLift = -15 * q;
          state.heroStretch = 1 + 0.08 * q;
        } else if (p < 0.38) {
          state.battlePose = 2;
          state.heroLunge = -13;
          state.heroLift = -15;
          phase = 'silence';
          once('quiet', () => sfx('silence'));
        } else if (p < 0.52) {
          let q = (p - 0.38) / 0.14;
          state.battlePose = 3;
          state.heroLunge = -13 + 113 * Math.pow(q, 0.45);
          state.heroLift = -15 + 13 * q;
          state.heroStretch = 1.18;
          state.heroAfterimage = 1;
          state.attackFx = q;
          phase = 'thrust';
          once('slash', () => sfx('slash'));
        } else if (p < 0.66) {
          let q = (p - 0.52) / 0.14;
          state.battlePose = 4;
          state.heroLunge = 100;
          state.heroLift = -2;
          state.heroAfterimage = 1 - q;
          state.attackFx = 1;
          state.battleFlash = 1 - q;
          state.enemyShift = 15 * Math.sin(q * Math.PI);
          phase = 'break';
          once('impact', () => {
            sfx('starImpact');
            cameraShake(5, 180);
            vibrate(60);
          });
        } else {
          let q = (p - 0.66) / 0.34;
          state.battlePose = q < 0.7 ? 5 : 0;
          state.heroLunge = 100 * (1 - q);
          state.heroLift = 0;
          state.attackFx = 1 - q;
          phase = 'linger';
        }
        state.skillFx = { type: 'pierce', phase, p, label };
        draw();
        if (p < 1) requestAnimationFrame(frame);
        else {
          state.skillFx = null;
          resetBattleMotion();
          draw();
          done();
        }
      }
      requestAnimationFrame(frame);
    });
  }
  // 星屑の雨 / 星降り: 杖を掲げ、敵全体へ星光を降らせる
  function starShowerAnimation(label, big = false) {
    return new Promise(done => {
      let started = performance.now(),
        duration = big ? 2000 : 1660,
        fired = {};
      sfx('moonCast');
      function once(k, fn) {
        if (!fired[k]) {
          fired[k] = 1;
          fn();
        }
      }
      function frame(now) {
        let p = Math.min(1, (now - started) / duration),
          phase = 'cast';
        state.battleDim = (big ? 0.3 : 0.2) * Math.sin(Math.PI * Math.min(1, p * 1.15));
        state.mageCast = Math.sin(Math.PI * Math.min(1, p * 1.1));
        state.mageSpin = p * 1.6;
        state.mageFrame = p < 0.14 ? 1 : p < 0.26 ? 2 : p < 0.72 ? 3 : p < 0.9 ? 4 : 0;
        state.mageLift = -4 * Math.sin(Math.PI * Math.min(1, p * 1.3));
        if (p < 0.26) {
          phase = 'cast';
          once('orb', () => {
            if (p > 0.18) sfx('moonOrb');
          });
        } else if (p < 0.74) {
          phase = 'rain';
          once('shot', () => sfx('moonShot'));
          [0.34, 0.46, 0.58, 0.68].forEach((k, i) => {
            if (p > k)
              once('r' + i, () => {
                sfx('moonHit');
                cameraShake(big ? 2.6 : 1.8, 80);
                state.enemyShift = 6;
              });
          });
          state.enemyShift = 5 * Math.sin(((p - 0.26) / 0.48) * Math.PI * 4);
        } else if (big && p < 0.84) {
          phase = 'burst';
          state.battleFlash = 1 - (p - 0.74) / 0.1;
          once('burst', () => {
            sfx('moonBurst');
            cameraShake(6, 200);
            vibrate(52);
          });
        } else {
          phase = 'fade';
          state.enemyShift = 0;
        }
        state.skillFx = { type: 'starshower', phase, p, big, label };
        draw();
        if (p < 1) requestAnimationFrame(frame);
        else {
          state.skillFx = null;
          state.mageCast = 0;
          state.mageFrame = 0;
          state.mageSpin = 0;
          resetBattleMotion();
          draw();
          done();
        }
      }
      requestAnimationFrame(frame);
    });
  }
  function starfireAnimation(label = '星 火 斬 り') {
    return new Promise(done => {
      let started = performance.now(),
        duration = BATTLE_EFFECTS.starfire.duration,
        sounds = {};
      sfx('starCharge');
      function once(k, fn) {
        if (!sounds[k]) {
          sounds[k] = 1;
          fn();
        }
      }
      function frame(now) {
        let p = Math.min(1, (now - started) / duration),
          phase = 'charge';
        state.heroStretch = 1;
        state.battleDim =
          p < 0.7
            ? BATTLE_EFFECTS.starfire.darken
            : BATTLE_EFFECTS.starfire.darken * Math.max(0, (0.875 - p) / 0.175);
        state.enemyShift = 0;
        if (p < 0.175) {
          let q = p / 0.175;
          state.battlePose = 2;
          state.heroLunge = -12 * q;
          state.heroLift = 3 * q;
          state.heroStretch = 1 + 0.06 * q;
          phase = 'charge';
        } else if (p < 0.25) {
          state.battlePose = 2;
          state.heroLunge = -12;
          state.heroLift = 3;
          phase = 'silence';
          once('quiet', () => sfx('silence'));
        } else if (p < 0.325) {
          let q = (p - 0.25) / 0.075;
          state.battlePose = 3;
          state.heroLunge = -12 + 224 * Math.pow(q, 0.42);
          state.heroLift = -4;
          state.heroAfterimage = 1;
          phase = 'dash';
          once('dash', () => sfx('starDash'));
        } else if (p < 0.45) {
          state.battlePose = 5;
          state.heroLunge = 212;
          state.heroLift = -2;
          state.heroAfterimage = Math.max(0, 1 - (p - 0.325) / 0.05);
          phase = 'pass';
        } else if (p < 0.505) {
          state.battlePose = 4;
          state.heroLunge = 212;
          state.heroLift = -2;
          phase = 'impact';
          state.battleFlash = 1 - Math.abs(p - 0.475) / 0.03;
          once('impact', () => {
            sfx('starImpact');
            cameraShake(BATTLE_EFFECTS.starfire.shake, 155);
            vibrate(55);
          });
        } else if (p < 0.6) {
          let q = (p - 0.505) / 0.095;
          state.battlePose = 5;
          state.heroLunge = 212;
          state.enemyShift = 16 * Math.sin((Math.min(1, q) * Math.PI) / 2);
          phase = 'pillar';
          once('burst', () => sfx('starBurst'));
        } else if (p < 0.875) {
          state.battlePose = 5;
          state.heroLunge = 212;
          state.enemyShift = 16 * (1 - (p - 0.6) / 0.275);
          phase = 'linger';
        } else {
          let q = (p - 0.875) / 0.125;
          state.battlePose = q < 0.75 ? 3 : 0;
          state.heroLunge = 212 * (1 - q);
          phase = 'return';
        }
        state.skillFx = { type: 'fire', phase, p, label };
        draw();
        if (p < 1) requestAnimationFrame(frame);
        else {
          state.skillFx = null;
          resetBattleMotion();
          draw();
          done();
        }
      }
      requestAnimationFrame(frame);
    });
  }
  function healingAnimation(label = '光 の 癒 し') {
    return new Promise(done => {
      let started = performance.now(),
        duration = BATTLE_EFFECTS.heal.duration;
      sfx('heal');
      function frame(now) {
        let p = Math.min(1, (now - started) / duration);
        state.skillFx = { type: 'heal', phase: p < 0.28 ? 'circle' : p < 0.68 ? 'pillar' : 'fade', p, label };
        state.battleDim = BATTLE_EFFECTS.heal.darken * Math.sin(Math.PI * p);
        state.battlePose = p < 0.72 ? 2 : 0;
        state.heroLift = -5 * Math.sin(Math.PI * p);
        state.heroStretch = 1 + 0.035 * Math.sin(Math.PI * p);
        draw();
        if (p < 1) requestAnimationFrame(frame);
        else {
          state.skillFx = null;
          resetBattleMotion();
          draw();
          done();
        }
      }
      requestAnimationFrame(frame);
    });
  }
  function mageStaffAnimation() {
    return new Promise(done => {
      let started = performance.now(),
        swung = false,
        hit = false,
        duration = 690,
        distance = 78;
      function ease(t) {
        return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
      }
      function frame(now) {
        let p = Math.min(1, (now - started) / duration);
        state.mageCast = 0;
        state.skillFx = null;
        if (p < 0.14) {
          state.mageFrame = 0;
          state.mageLunge = -3 * ease(p / 0.14);
          state.mageStaffStrike = 0;
        } else if (p < 0.43) {
          state.mageFrame = 1;
          state.mageLunge = -3 + (distance + 3) * ease((p - 0.14) / 0.29);
          state.mageLift = -3 * Math.sin((Math.PI * (p - 0.14)) / 0.29);
          state.mageStaffStrike = -0.4;
        } else if (p < 0.61) {
          let q = (p - 0.43) / 0.18;
          state.mageFrame = q < 0.5 ? 3 : 4;
          state.mageLunge = distance;
          state.mageStaffStrike = -0.7 + 1.7 * ease(q);
          if (!swung) {
            swung = true;
            sfx('staffSwing');
          }
          if (!hit && p >= 0.52) {
            hit = true;
            sfx('staffImpact');
            state.enemyShift = 7;
            state.staffFx = { p: 0 };
          }
          if (state.staffFx) state.staffFx.p = Math.min(1, Math.max(0, (p - 0.52) / 0.2));
        } else if (p < 0.74) {
          state.mageFrame = 5;
          state.mageLunge = distance;
          state.mageStaffStrike = 0.8 * (1 - (p - 0.61) / 0.13);
          state.enemyShift = Math.max(0, 7 * (1 - (p - 0.61) / 0.13));
        } else {
          let q = ease((p - 0.74) / 0.26);
          state.mageFrame = 0;
          state.mageLunge = distance * (1 - q);
          state.mageStaffStrike = 0;
          state.enemyShift = 0;
          state.staffFx = null;
        }
        draw();
        if (p < 1) requestAnimationFrame(frame);
        else {
          resetBattleMotion();
          draw();
          done();
        }
      }
      requestAnimationFrame(frame);
    });
  }
  function moonMagicAnimation(kind = 'attack', label) {
    return new Promise(done => {
      let started = performance.now(),
        healKind = kind === 'heal' || kind === 'veil',
        cfg = healKind ? BATTLE_EFFECTS.heal : BATTLE_EFFECTS.moon,
        duration = cfg.duration * (kind === 'veil' ? 1.15 : 1),
        sounds = {};
      sfx(healKind ? 'heal' : 'moonCast');
      function once(k, fn) {
        if (!sounds[k]) {
          sounds[k] = 1;
          fn();
        }
      }
      function frame(now) {
        let p = Math.min(1, (now - started) / duration),
          phase;
        if (healKind) phase = p < 0.3 ? 'circle' : p < 0.7 ? 'pillar' : 'fade';
        else if (p < 0.25) phase = 'cast';
        else if (p < 0.41) phase = 'orb';
        else if (p < 0.54) phase = 'projectile';
        else if (p < 0.59) phase = 'impact';
        else if (p < 0.72) phase = 'crescent';
        else phase = 'fade';
        state.battleDim = cfg.darken * Math.sin(Math.PI * Math.min(1, p * 1.2));
        state.mageCast = Math.sin(Math.PI * Math.min(1, p * 1.15));
        state.mageFrame = p < 0.18 ? 1 : p < 0.36 ? 2 : p < 0.58 ? 3 : p < 0.78 ? 4 : p < 0.94 ? 5 : 0;
        state.mageSpin = p * 1.8;
        state.skillFx = {
          type: kind === 'heal' ? 'moonheal' : kind === 'veil' ? 'veil' : 'moon',
          phase,
          p,
          label,
        };
        if (!healKind) {
          if (p > 0.25) once('orb', () => sfx('moonOrb'));
          if (p > 0.41) once('shot', () => sfx('moonShot'));
          if (p > 0.54)
            once('hit', () => {
              sfx('moonHit');
              cameraShake(cfg.shake, 115);
              vibrate(24);
            });
          if (p > 0.62) once('burst', () => sfx('moonBurst'));
          state.enemyShift = p > 0.54 && p < 0.72 ? 5 * Math.sin(((p - 0.54) / 0.18) * Math.PI) : 0;
        }
        draw();
        if (p < 1) requestAnimationFrame(frame);
        else {
          state.mageCast = 0;
          state.mageFrame = 0;
          state.mageSpin = 0;
          state.skillFx = null;
          resetBattleMotion();
          draw();
          done();
        }
      }
      requestAnimationFrame(frame);
    });
  }
  function livingMembers() {
    return [state.hero, ...(state.companion.active ? [state.companion] : [])].filter(v => v.hp > 0);
  }
  function pickEnemyTarget() {
    let living = livingMembers();
    return living.length === 1 ? living[0] : Math.random() < 0.58 ? state.hero : state.companion;
  }
  async function enemyHit(target, multiplier, label, savage = false) {
    if (!target || target.hp <= 0) return 0;
    let isHero = target === state.hero,
      name = isHero ? 'ルカ' : 'ミナ',
      d = Math.max(
        1,
        Math.round(
          damage(state.enemy.atk, effectiveDefense({ def: defOf(target), guarding: target.guarding })) *
            multiplier,
        ),
      );
    sfx(savage ? 'critical' : 'enemy');
    if (savage) {
      cameraShake(8, 320);
      flashScreen(1, 300);
    }
    target.hp = Math.max(0, target.hp - d);
    if (target.hp > 0 && target.hp <= target.maxHp * 0.25) sfx('lowHp');
    if (isHero) state.heroHit = 1;
    else state.mageHit = 1;
    wrap.classList.remove('shake');
    void wrap.offsetWidth;
    wrap.classList.add('shake');
    setTimeout(() => {
      sfx('hit');
      vibrate(savage ? [70, 35, 120, 35, 70] : [45, 25, 55]);
      if (isHero) state.heroHit = 0;
      else state.mageHit = 0;
      if (state.mode === 'battle') draw();
    }, 150);
    floatText(
      String(d) + (savage ? '!!' : ''),
      isHero ? 53 : 112,
      185,
      savage ? '#ff3b2e' : target.guarding ? '#7be8ff' : '#ff746c',
      savage ? 1.45 : 1,
    );
    setMsg(label + '！ ' + name + 'は ' + d + ' ダメージ！' + (target.guarding ? '（防御）' : ''));
    sync();
    await delay(savage ? 860 : 560);
    if (target.hp <= 0) {
      setMsg(name + 'は戦闘不能になった！');
      await delay(430);
    }
    return d;
  }
  async function enemyAct(e) {
    state.enemy = e;
    e.turn = (e.turn || 0) + 1;
    let action = selectEnemyAction(e);
    if (action.type === 'charge') {
      e.charging = true;
      setMsg(e.name + 'は力をためている……');
      sfx('enemy');
      await enemyAttackAnimation('charge');
    } else if (action.type === 'all') {
      setMsg(e.name + 'の ' + action.label + '！');
      sfx('burst');
      await enemyAttackAnimation('all');
      for (let target of [...livingMembers()]) await enemyHit(target, action.multiplier, action.label);
    } else {
      if (action.clearsCharge) e.charging = false;
      let absorbed = 0,
        hits = action.hits || 1;
      for (let i = 0; i < hits; i++) {
        let target = pickEnemyTarget();
        if (!target) break;
        await enemyAttackAnimation(action.savage ? 'savage' : action.drain ? 'drain' : 'attack');
        absorbed += await enemyHit(
          target,
          action.multiplier,
          action.savage ? action.label : e.name + 'の ' + action.label,
          action.savage,
        );
        if (!livingMembers().length) break;
      }
      if (action.drain && absorbed > 0) {
        let heal = Math.min(Math.max(1, Math.round(absorbed * action.drain)), e.maxHp - e.hp);
        if (heal > 0) {
          e.hp += heal;
          floatText('+' + heal, 230, 92, '#8dff9b');
          setMsg(e.name + 'は生命力を ' + heal + ' 奪った！');
          draw();
          await delay(360);
        }
      }
    }
    if (!livingMembers().length) {
      gameOver();
      return;
    }
  }
  // --- 行動順: 素早さ順に並べたキューを1ラウンドぶん作る ---
  function buildTurnOrder() {
    let units = [];
    if (state.hero.hp > 0) units.push({ k: 'hero', spd: spdOf(state.hero) });
    if (state.companion.active && state.companion.hp > 0)
      units.push({ k: 'mage', spd: spdOf(state.companion) });
    (state.enemies || []).forEach((e, i) => {
      if (e.hp > 0) units.push({ k: 'enemy', i, spd: Math.max(1, Number(e.spd) || 8) });
    });
    // 素早さが効きつつ、毎回まったく同じ順にはならない程度の揺らぎ
    units.forEach(u => (u.roll = u.spd * (0.85 + Math.random() * 0.3)));
    units.sort((a, b) => b.roll - a.roll);
    state.order = units;
    state.orderIndex = 0;
  }
  async function nextTurn() {
    for (let guard = 0; guard < 64; guard++) {
      if (!livingEnemies().length) {
        await win();
        return;
      }
      if (!livingMembers().length) {
        gameOver();
        return;
      }
      if (!state.order || state.orderIndex >= state.order.length) buildTurnOrder();
      if (!state.order.length) return;
      let u = state.order[state.orderIndex++];
      if (u.k === 'enemy') {
        let e = (state.enemies || [])[u.i];
        if (!e || e.hp <= 0) continue;
        state.enemy = e;
        await enemyAct(e);
        if (state.mode !== 'battle') return;
        continue;
      }
      let member = u.k === 'hero' ? state.hero : state.companion;
      if (!member || member.hp <= 0 || (u.k === 'mage' && !member.active)) continue;
      // 防御は「次に自分の番が回ってくるまで」持続する
      member.guarding = false;
      chooseEnemyTarget();
      state.actor = u.k;
      state.busy = false;
      setMsg(actorName() + 'の行動を選んでください。');
      sync();
      draw();
      return;
    }
  }
  async function applyLevelUps() {
    let h = state.hero,
      m = state.companion;
    while (h.exp >= h.next) {
      h.exp -= h.next;
      h.lv++;
      h.next = Math.floor(h.next * 1.55);
      h.maxHp += 8;
      h.atk += 3;
      h.def += 2;
      if (h.lv % 2 === 0) h.spd = (h.spd || 10) + 1;
      h.hp = h.maxHp;
      sync();
      sfx('level');
      setMsg('ルカが LV ' + h.lv + 'になった！ 能力上昇・HP全回復！');
      await delay(950);
    }
    if (m.active)
      while (m.exp >= m.next) {
        m.exp -= m.next;
        m.lv++;
        m.next = Math.floor(m.next * 1.55);
        m.maxHp += 6;
        m.atk += 3;
        m.def += 1;
        if (m.lv % 2 === 0) m.spd = (m.spd || 9) + 1;
        m.hp = m.maxHp;
        sync();
        sfx('level');
        setMsg('ミナが LV ' + m.lv + 'になった！ 魔力上昇・HP全回復！');
        await delay(1000);
      }
  }
  function grantDrops(enemy) {
    let found = rollDrops(enemy);
    found.forEach(drop => addItem(drop.id, drop.amount));
    return found.map(drop => ITEMS[drop.id].name + ' ×' + drop.amount);
  }
  async function win() {
    let foes = state.enemies?.length ? state.enemies : [state.enemy],
      boss = foes.find(e => e.boss),
      baseExp = foes.reduce((sum, e) => sum + e.exp, 0),
      earned = foes.reduce((sum, e) => sum + (Number(e.gold) || 0), 0),
      h = state.hero,
      m = state.companion,
      heroExp = Math.round(baseExp * (h.expBoost || 1)),
      mageExp = Math.round(baseExp * (m.expBoost || 1));
    setMsg(
      (foes.length > 1 ? '魔物たち' : foes[0].name) +
        'を倒した！ EXP ' +
        heroExp +
        'と ' +
        earned +
        'G を獲得！',
    );
    sfx('win');
    h.exp += heroExp;
    if (m.active) m.exp += mageExp;
    addGold(earned);
    await defeatEffect(!!boss);
    await applyLevelUps();
    let drops = foes.flatMap(grantDrops);
    if (drops.length) {
      setMsg('戦利品：' + drops.join('、') + 'を手に入れた！');
      sfx('itemGet');
      sync();
      await delay(850);
    }
    for (let member of [h, m]) {
      member.guarding = false;
      member.charged = false;
      member.expBoost = 1;
    }
    if (boss) {
      state.bossAlive = false;
      state.cleared = true;
      clearedChapters()[state.chapter] = true;
      state.mode = 'clear';
      state.targetMenu = false;
      state.enemy = null;
      state.enemies = [];
      state.busy = false;
      state.itemMenu = false;
      saveGame();
      sync();
      draw();
      showOverlay('clear');
      return;
    }
    state.mode = 'field';
    state.enemy = null;
    state.enemies = [];
    state.busy = false;
    state.skillMenu = false;
    state.itemMenu = false;
    state.targetMenu = false;
    sync();
    draw();
    saveGame();
  }
  function gameOver() {
    state.mode = 'over';
    state.busy = false;
    sfx('gameOver');
    showOverlay('over');
  }
  function startChapter2() {
    state.chapter = 2;
    noteChapterReached(2);
    state.mode = 'field';
    state.x = 1;
    state.y = 10;
    state.fx = 1;
    state.fy = 10;
    state.dir = 'up';
    state.walk = 0;
    state.steps = 0;
    state.enemy = null;
    state.bossAlive = true;
    state.cleared = false;
    state.busy = false;
    state.skillMenu = false;
    state.itemMenu = false;
    state.hero.hp = state.hero.maxHp;
    state.inventory.potion = Math.max(4, itemCount('potion'));
    state.hero.potions = state.inventory.potion;
    if (!state.companion.active) state.companion = mageForLevel(state.hero.lv);
    state.companion.active = true;
    state.companion.hp = state.companion.maxHp;
    hideOverlay();
    setMsg('月魔法使いミナが仲間になった！ 二人で月影の森へ！');
    sfx('chapterStart');
    sync();
    draw();
    saveGame();
  }
  function startChapter4() {
    state.chapter = 4;
    noteChapterReached(4);
    state.floor = 1;
    state.mode = 'field';
    let st = CHAPTERS[4].start;
    state.x = st.x;
    state.y = st.y;
    state.fx = st.x;
    state.fy = st.y;
    state.dir = 'up';
    state.walk = 0;
    state.steps = 0;
    state.enemy = null;
    state.enemies = [];
    state.bossAlive = true;
    state.cleared = false;
    state.busy = false;
    state.skillMenu = false;
    state.itemMenu = false;
    state.targetMenu = false;
    state.hero.hp = state.hero.maxHp;
    state.companion.active = true;
    state.companion.hp = state.companion.maxHp;
    state.inventory.potion = Math.max(6, itemCount('potion'));
    state.hero.potions = state.inventory.potion;
    hideOverlay();
    setMsg('黄昏の鐘が鳴った。二人は黄昏の塔へ踏み出す。');
    sfx('chapterStart');
    sync();
    draw();
    saveGame();
  }
  function startChapter3() {
    state.chapter = 3;
    noteChapterReached(3);
    state.mode = 'field';
    state.x = 1;
    state.y = 10;
    state.fx = 1;
    state.fy = 10;
    state.dir = 'up';
    state.walk = 0;
    state.steps = 0;
    state.enemy = null;
    state.enemies = [];
    state.bossAlive = true;
    state.cleared = false;
    state.busy = false;
    state.skillMenu = false;
    state.itemMenu = false;
    state.hero.hp = state.hero.maxHp;
    state.companion.active = true;
    state.companion.hp = state.companion.maxHp;
    state.inventory.potion = Math.max(5, itemCount('potion'));
    state.hero.potions = state.inventory.potion;
    hideOverlay();
    setMsg('月蝕の羽が空を指した。ルカとミナは星骸の塔へ！');
    sfx('chapterStart');
    sync();
    draw();
    saveGame();
  }
  function inventoryEntries() {
    return Object.entries(ITEMS).filter(([id]) => itemCount(id) > 0);
  }
  function partyMembers() {
    return [state.hero, ...(state.companion.active ? [state.companion] : [])];
  }
  function memberName(member) {
    return member === state.companion ? 'ミナ' : 'ルカ';
  }
  function openTownCard(html) {
    $('#overlay').classList.remove('clear-screen', 'slot-screen');
    $('#overlayCard').innerHTML = html;
    $('#overlay').classList.add('town-screen', 'show');
  }
  function closeTownCard() {
    sfx('menuClose');
    hideOverlay();
    setMsg(state.mode === 'town' ? town().name + 'の通りに戻った。' : '装備を確かめて、二人は先へ進む。');
    sync();
    draw();
  }
  // --- 宿屋 ---
  function openInn() {
    let t = town(),
      cost = t.inn,
      members = partyMembers(),
      hurt = members.some(m => m.hp < m.maxHp),
      poor = gold() < cost;
    sfx('menuOpen');
    openTownCard(
      '<h1>' +
        t.name +
        'の宿</h1><p class="shop-note">ひと晩休めば HPは全快し、戦闘不能も癒える。ワザの使用回数も戻る。</p>' +
        '<div class="shop-list">' +
        members
          .map(
            m =>
              '<div class="shop-row"><div><b>' +
              memberName(m) +
              ' LV ' +
              m.lv +
              '</b><small>' +
              (m.hp > 0 ? 'HP ' + m.hp + ' / ' + m.maxHp : '戦闘不能') +
              '</small></div></div>',
          )
          .join('') +
        '</div>' +
        '<p class="shop-gold">宿代 ' +
        cost +
        'G ／ 所持 ' +
        gold() +
        'G</p>' +
        '<button id="innStay"' +
        (poor ? ' disabled' : '') +
        '>' +
        (poor ? 'お金が足りない' : '泊まる（' + cost + 'G）') +
        '</button><button id="innLeave">やめる</button>',
    );
    $('#innLeave').onclick = closeTownCard;
    if (!poor)
      $('#innStay').onclick = () => {
        addGold(-cost);
        members.forEach(m => {
          m.hp = m.maxHp;
        });
        state.companion.hp = state.companion.maxHp;
        state.skillUses = Object.fromEntries(SKILLS.map(v => [v.id, v.uses]));
        state.mageUses = { heal: 2 };
        sfx('heal');
        hideOverlay();
        setMsg(
          hurt ? 'ひと晩ぐっすり眠った。全員のHPが全快した！' : 'ひと晩ぐっすり眠った。気力が満ちている。',
        );
        sync();
        draw();
        saveGame();
      };
  }
  // --- 店 ---
  let shopKind = 'weapon',
    shopMode = 'buy';
  function shopTitle(kind) {
    return { weapon: '武器屋', armor: '防具屋', item: '道具屋' }[kind] || '店';
  }
  function canCraft(r) {
    return Object.entries(r.needs).every(([mat, n]) => itemCount(mat) >= n);
  }
  function craftNote(r) {
    return (
      Object.entries(r.needs)
        .map(([mat, n]) => ITEMS[mat].name + ' ×' + n + '（所持' + itemCount(mat) + '）')
        .join('　') +
      '　→ ' +
      ITEMS[r.id].name +
      ' ×' +
      r.amount
    );
  }
  function doCraft(r) {
    if (!canCraft(r)) return false;
    Object.entries(r.needs).forEach(([mat, n]) => {
      for (let i = 0; i < n; i++) consumeItem(mat);
    });
    addItem(r.id, r.amount);
    return true;
  }
  function shopStock(kind) {
    if (kind === 'item') return Object.keys(ITEMS).filter(id => ITEMS[id].price);
    return Object.keys(EQUIPMENT).filter(
      id => EQUIPMENT[id].slot === kind && EQUIPMENT[id].chapter <= state.chapter,
    );
  }
  function gearNote(id) {
    let g = EQUIPMENT[id],
      who = g.owner === 'both' ? 'ルカ・ミナ' : g.owner === 'mage' ? 'ミナ専用' : 'ルカ専用';
    return (
      (g.atk ? '攻 +' + g.atk : '守 +' + g.def) + '　' + who + (gearCount(id) ? '　所持' + gearCount(id) : '')
    );
  }
  function shopRow(id, action, price, label, note) {
    return (
      '<div class="shop-row"><div><b>' +
      (EQUIPMENT[id]?.icon || ITEMS[id]?.icon || '・') +
      ' ' +
      (EQUIPMENT[id]?.name || ITEMS[id]?.name) +
      '</b><small>' +
      note +
      '</small></div>' +
      '<button data-' +
      action +
      '="' +
      id +
      '"' +
      (label ? '' : ' disabled') +
      '>' +
      (label || '—') +
      '</button></div>'
    );
  }
  function openShop(kind) {
    shopKind = kind;
    shopMode = 'buy';
    sfx('menuOpen');
    renderShop();
  }
  function renderShop() {
    let kind = shopKind,
      rows;
    if (shopMode === 'craft' && kind === 'item') {
      rows = ITEM_RECIPES.map(r =>
        shopRow(r.id, 'craft', 0, canCraft(r) ? '作る' : '素材不足', craftNote(r)),
      ).join('');
    } else if (shopMode === 'buy') {
      let stock = shopStock(kind);
      rows = stock
        .map(id => {
          let price = priceOf(id),
            note = EQUIPMENT[id] ? gearNote(id) : ITEMS[id].desc + '　所持' + itemCount(id);
          return shopRow(id, 'buy', price, gold() >= price ? price + 'G' : '不足', note);
        })
        .join('');
    } else {
      let sellable =
        kind === 'item'
          ? Object.keys(ITEMS).filter(id => itemCount(id) > 0 && (ITEMS[id].sell || ITEMS[id].price))
          : Object.keys(EQUIPMENT).filter(id => EQUIPMENT[id].slot === kind && spareGear(id) > 0);
      rows = sellable.length
        ? sellable
            .map(id => {
              let price = sellPriceOf(id),
                count = EQUIPMENT[id] ? spareGear(id) : itemCount(id),
                note =
                  (EQUIPMENT[id] ? gearNote(id) : ITEMS[id].desc) +
                  '　売れる数 ' +
                  count +
                  (ITEMS[id]?.precious ? '　※二度と手に入らない' : '');
              return shopRow(id, 'sell', price, price + 'G', note);
            })
            .join('')
        : '<p class="shop-note">売れるものを持っていない。</p>';
    }
    openTownCard(
      '<h1>' +
        shopTitle(kind) +
        '</h1>' +
        '<div class="shop-tabs"><button class="' +
        (shopMode === 'buy' ? 'on' : '') +
        '" data-shopmode="buy">買う</button><button class="' +
        (shopMode === 'sell' ? 'on' : '') +
        '" data-shopmode="sell">売る</button>' +
        (kind === 'item'
          ? '<button class="' + (shopMode === 'craft' ? 'on' : '') + '" data-shopmode="craft">合成</button>'
          : '') +
        '</div>' +
        '<p class="shop-gold">所持 ' +
        gold() +
        'G</p><div class="shop-list">' +
        rows +
        '</div>' +
        '<button id="shopEquip">そうび</button><button id="shopLeave">店を出る</button>',
    );
    $('#shopLeave').onclick = closeTownCard;
    $('#shopEquip').onclick = () => {
      sfx('menuOpen');
      openEquip(() => renderShop());
    };
    $('#overlayCard')
      .querySelectorAll('[data-shopmode]')
      .forEach(
        b =>
          (b.onclick = () => {
            sfx('cursor');
            shopMode = b.dataset.shopmode;
            renderShop();
          }),
      );
    $('#overlayCard')
      .querySelectorAll('[data-buy]')
      .forEach(
        b =>
          (b.onclick = () => {
            let id = b.dataset.buy,
              price = priceOf(id);
            if (gold() < price) {
              sfx('cancel');
              return;
            }
            addGold(-price);
            if (EQUIPMENT[id]) addGear(id, 1);
            else addItem(id, 1);
            sfx('itemGet');
            renderShop();
            saveGame();
          }),
      );
    $('#overlayCard')
      .querySelectorAll('[data-craft]')
      .forEach(
        b =>
          (b.onclick = () => {
            let r = ITEM_RECIPES.find(x => x.id === b.dataset.craft);
            if (!r || !doCraft(r)) {
              sfx('cancel');
              return;
            }
            sfx('itemGet');
            renderShop();
            sync();
            saveGame();
          }),
      );
    $('#overlayCard')
      .querySelectorAll('[data-sell]')
      .forEach(b => {
        let armed = false;
        b.onclick = () => {
          let id = b.dataset.sell,
            price = sellPriceOf(id);
          if (ITEMS[id]?.precious && !armed) {
            armed = true;
            sfx('cancel');
            b.textContent = '本当に売る？';
            return;
          }
          if (EQUIPMENT[id]) {
            if (spareGear(id) <= 0) {
              sfx('cancel');
              return;
            }
            addGear(id, -1);
          } else {
            if (itemCount(id) <= 0) {
              sfx('cancel');
              return;
            }
            consumeItem(id);
          }
          addGold(price);
          sfx('confirm');
          renderShop();
          saveGame();
        };
      });
  }
  // --- そうび ---
  function openEquip(back) {
    sfx('menuOpen');
    let members = partyMembers();
    openTownCard(
      '<h1>そうび</h1>' +
        members
          .map((m, idx) => {
            let w = gearOf(m, 'weapon'),
              a = gearOf(m, 'armor');
            return (
              '<div class="equip-card"><div class="equip-head"><b>' +
              memberName(m) +
              ' LV ' +
              m.lv +
              '</b><span>攻 ' +
              atkOf(m) +
              '　守 ' +
              defOf(m) +
              '</span></div>' +
              '<div class="shop-row"><div><b>武器</b><small>' +
              (w ? w.name + '（攻 +' + (w.atk || 0) + '）' : 'なし') +
              '</small></div><button data-slot="weapon" data-who="' +
              idx +
              '">かえる</button></div>' +
              '<div class="shop-row"><div><b>体防具</b><small>' +
              (a ? a.name + '（守 +' + (a.def || 0) + '）' : 'なし') +
              '</small></div><button data-slot="armor" data-who="' +
              idx +
              '">かえる</button></div></div>'
            );
          })
          .join('') +
        '<button id="equipBack">' +
        (back ? '店にもどる' : 'とじる') +
        '</button>',
    );
    $('#equipBack').onclick = () => {
      sfx('menuClose');
      if (back) back();
      else closeTownCard();
    };
    $('#overlayCard')
      .querySelectorAll('[data-slot]')
      .forEach(
        b =>
          (b.onclick = () => {
            sfx('cursor');
            openEquipPick(Number(b.dataset.who), b.dataset.slot, back);
          }),
      );
  }
  function openEquipPick(who, slot, back) {
    let member = partyMembers()[who] || state.hero,
      current = member.equip?.[slot] || null;
    let choices = Object.keys(EQUIPMENT).filter(
      id => EQUIPMENT[id].slot === slot && canEquip(member, id) && (id === current || spareGear(id) > 0),
    );
    openTownCard(
      '<h1>' +
        memberName(member) +
        'の' +
        (slot === 'weapon' ? '武器' : '体防具') +
        '</h1>' +
        '<div class="shop-list">' +
        (choices.length
          ? choices
              .map(id => {
                let g = EQUIPMENT[id],
                  delta =
                    (g.atk || 0) -
                    (EQUIPMENT[current]?.['atk'] || 0) +
                    ((g.def || 0) - (EQUIPMENT[current]?.def || 0));
                return (
                  '<div class="shop-row' +
                  (id === current ? ' current' : '') +
                  '"><div><b>' +
                  g.icon +
                  ' ' +
                  g.name +
                  '</b><small>' +
                  (g.atk ? '攻 +' + g.atk : '守 +' + g.def) +
                  '　' +
                  g.desc +
                  (id === current
                    ? '　（装備中）'
                    : delta
                      ? '　' + (delta > 0 ? '▲+' + delta : '▼' + delta)
                      : '') +
                  '</small></div>' +
                  '<button data-equip="' +
                  id +
                  '"' +
                  (id === current ? ' disabled' : '') +
                  '>' +
                  (id === current ? '装備中' : 'そうび') +
                  '</button></div>'
                );
              })
              .join('')
          : '<p class="shop-note">つけられる装備がない。</p>') +
        '</div>' +
        (current ? '<button id="equipOff">はずす</button>' : '') +
        '<button id="pickBack">もどる</button>',
    );
    $('#pickBack').onclick = () => {
      sfx('menuClose');
      openEquip(back);
    };
    if (current)
      $('#equipOff').onclick = () => {
        member.equip = { ...member.equip, [slot]: null };
        sfx('cancel');
        sync();
        saveGame();
        openEquip(back);
      };
    $('#overlayCard')
      .querySelectorAll('[data-equip]')
      .forEach(
        b =>
          (b.onclick = () => {
            member.equip = { ...member.equip, [slot]: b.dataset.equip };
            sfx('itemGet');
            sync();
            saveGame();
            openEquip(back);
          }),
      );
  }
  function showInventory() {
    if (
      (state.mode !== 'field' && state.mode !== 'town') ||
      state.busy ||
      $('#overlay').classList.contains('show')
    )
      return;
    sfx('menuOpen');
    let entries = inventoryEntries(),
      canHeal = !!mostInjuredMember();
    $('#overlay').classList.remove('clear-screen', 'slot-screen');
    $('#overlay').classList.add('town-screen');
    $('#overlayCard').innerHTML =
      '<h1>かばん</h1><div class="bag-list">' +
      (entries.length
        ? entries
            .map(
              ([id, item]) =>
                '<div class="bag-row"><div><b>' +
                item.icon +
                ' ' +
                item.name +
                ' ×' +
                itemCount(id) +
                '</b><small>' +
                item.desc +
                (sellPriceOf(id) ? '　／ 道具屋で ' + sellPriceOf(id) + 'G' : '') +
                '</small></div>' +
                (item.usable
                  ? '<button data-field-item="' + id + '" ' + (canHeal ? '' : 'disabled') + '>使う</button>'
                  : '') +
                '</div>',
            )
            .join('')
        : '<p>かばんは空っぽだ。</p>') +
      '</div><p class="bag-slot">所持 ' +
      gold() +
      'G　／　セーブ枠 ' +
      currentSlot() +
      ' に自動セーブ中</p><button id="openEquipBtn">そうび</button><button id="openTravelBtn"' +
      (state.mode === 'town' ? '' : ' disabled') +
      '>旅に出る</button><button id="openSlots">セーブ枠</button><button id="closeBag">とじる</button>' +
      (state.mode === 'town' ? '' : '<p class="bag-slot">旅立ちは町からだけ。</p>') +
      '';
    $('#overlay').classList.add('show');
    $('#openEquipBtn').onclick = () => openEquip();
    $('#openTravelBtn').onclick = () => {
      if (state.mode !== 'town') return;
      sfx('menuOpen');
      openTravel();
    };
    $('#openSlots').onclick = () => {
      sfx('menuOpen');
      saveGame();
      showSlotScreen(false);
    };
    $('#closeBag').onclick = () => {
      sfx('menuClose');
      hideOverlay();
    };
    $('#overlayCard')
      .querySelectorAll('[data-field-item]')
      .forEach(button => (button.onclick = () => consumeFieldItem(button.dataset.fieldItem)));
  }
  function consumeFieldItem(id) {
    let item = ITEMS[id];
    if (!item?.usable || itemCount(id) <= 0) return;
    let targets = item.healAll
      ? [state.hero, ...(state.companion.active ? [state.companion] : [])].filter(
          v => v.hp > 0 && v.hp < v.maxHp,
        )
      : [mostInjuredMember()].filter(Boolean);
    if (!targets.length) return;
    consumeItem(id);
    let total = 0;
    targets.forEach(target => {
      let heal = Math.min(healPower(item, target), target.maxHp - target.hp);
      target.hp += heal;
      total += heal;
    });
    sfx('potion');
    setMsg(item.name + 'を使い、HPが合計 ' + total + ' 回復した！');
    sync();
    draw();
    saveGame();
    hideOverlay();
  }
  function showOverlay(type) {
    let clear = type === 'clear',
      h = state.hero,
      m = state.companion,
      ch2 = state.chapter === 2,
      ch3 = state.chapter === 3,
      ch4 = state.chapter === 4,
      party = m.active
        ? '<br>ミナ LV ' + m.lv + '　HP ' + m.hp + ' / ' + m.maxHp + '　EXP ' + m.exp + ' / ' + m.next
        : '';
    $('#overlay').classList.toggle('clear-screen', clear);
    if (clear) {
      if (ch4) {
        $('#overlayCard').innerHTML =
          '<h1>第4章 制覇！</h1><p>黄昏の鐘が鳴りやみ、塔にようやく夜が訪れた。</p><p><b>✓ 第4章クリアデータ保存済み</b><br>ルカ LV ' +
          h.lv +
          '　HP ' +
          h.hp +
          ' / ' +
          h.maxHp +
          '　EXP ' +
          h.exp +
          ' / ' +
          h.next +
          party +
          '</p><button id="exploreClear">塔の頂で夜明けを待つ</button><button id="again">LV1からやり直す</button><p style="color:#ffb0a8">※やり直すとこのセーブ枠のデータは消えます</p>';
      } else if (ch3) {
        $('#overlayCard').innerHTML =
          '<h1>第3章 制覇！</h1><p>天穿の守護者は静まり、止まっていた星骸の塔が再び空を巡り始めた。</p><p><b>✓ 第3章クリアデータ保存済み</b><br>ルカ LV ' +
          h.lv +
          '　HP ' +
          h.hp +
          ' / ' +
          h.maxHp +
          '　EXP ' +
          h.exp +
          ' / ' +
          h.next +
          party +
          '</p><button id="nextChapter4">第4章「黄昏の塔」へ</button><button id="exploreClear">二人で天空回廊を探索する</button><button id="again">LV1からやり直す</button><p style="color:#ffb0a8">※やり直すとこのセーブ枠のデータは消えます</p>';
      } else if (ch2) {
        $('#overlayCard').innerHTML =
          '<h1>第2章 制覇！</h1><p>森に戻った月明かりが、雲海に浮かぶ古塔への道を照らした。</p><p><b>✓ 第2章クリアデータ保存済み</b><br>ルカ LV ' +
          h.lv +
          '　HP ' +
          h.hp +
          ' / ' +
          h.maxHp +
          '　EXP ' +
          h.exp +
          ' / ' +
          h.next +
          party +
          '</p><button id="nextChapter3">第3章「星骸の塔」へ</button><button id="again">LV1からやり直す</button><p style="color:#ffb0a8">※やり直すとこのセーブ枠のデータは消えます</p>';
      } else {
        $('#overlayCard').innerHTML =
          '<h1>第1章 制覇！</h1><p>焔角の魔物は消え、石牢に朝の光が差し込んだ。</p><p><b>✓ クリアデータ保存済み</b><br>ルカ LV ' +
          h.lv +
          '　HP ' +
          h.hp +
          ' / ' +
          h.maxHp +
          '<br>EXP ' +
          h.exp +
          ' / ' +
          h.next +
          '</p><button id="nextChapter">ミナと第2章「月影の森」へ</button><button id="again">LV1からやり直す</button><p style="color:#ffb0a8">※やり直すとこのセーブ枠のデータは消えます</p>';
      }
    } else {
      $('#overlayCard').innerHTML =
        '<h1>GAME OVER</h1><p>二人とも力尽きた……<br>最後のセーブ地点から再開できる。</p><button id="retrySave">セーブ地点から</button><button id="again">はじめから</button>';
    }
    $('#overlay').classList.add('show');
    if (clear) {
      if (ch4) {
        $('#exploreClear').onclick = () => {
          state.mode = 'field';
          state.enemy = null;
          state.busy = false;
          hideOverlay();
          setMsg('塔の頂に、静かな夜風が吹いている。');
          sync();
          draw();
          saveGame();
        };
      } else if (ch3) {
        $('#nextChapter4').onclick = startChapter4;
        $('#exploreClear').onclick = () => {
          state.mode = 'field';
          state.enemy = null;
          state.busy = false;
          hideOverlay();
          setMsg('ルカとミナは、星の風が巡る天空回廊を歩き出した。');
          sync();
          draw();
          saveGame();
        };
      } else if (ch2) {
        $('#nextChapter3').onclick = startChapter3;
      } else {
        $('#nextChapter').onclick = startChapter2;
      }
      let armed = false;
      $('#again').onclick = () => {
        if (!armed) {
          armed = true;
          $('#again').textContent = '本当にLV1からやり直す？';
          return;
        }
        reset();
      };
    } else {
      $('#retrySave').onclick = () => {
        let d = readSave();
        if (d) {
          restoreSave(d);
          hideOverlay();
          setMsg(state.companion.active ? '二人でセーブ地点から再開した。' : 'セーブ地点から再開した。');
          sync();
          draw();
        } else reset();
      };
      $('#again').onclick = reset;
    }
  }
  function hideOverlay() {
    $('#overlay').classList.remove('show', 'clear-screen', 'slot-screen', 'town-screen');
  }
  function draw() {
    X.setTransform(1, 0, 0, 1, 0, 0);
    X.clearRect(0, 0, W, H);
    X.save();
    if (state.cameraShake && performance.now() < state.cameraShake.until) {
      let a = state.cameraShake.power;
      X.translate((fxRand() - 0.5) * a * 2, (fxRand() - 0.5) * a * 2);
    }
    if (state.mode === 'field' || state.mode === 'town' || !state.enemy) {
      drawMap();
      if (state.companion.active)
        drawFieldCompanion(state.fx * T + 10, state.fy * T + 10, state.dir, state.walk);
      drawFieldHero(state.x * T + 10, state.y * T + 10, state.dir, state.walk);
    } else drawBattle();
    X.restore();
  }
  const TOWN_PALETTE = Object.freeze({
    stone: {
      sky: '#141b28',
      far: '#1e2738',
      ground: '#3d3627',
      ground2: '#463e2d',
      path: '#575039',
      wall: '#6f5c45',
      wall2: '#7d6a50',
      roof: '#8f4b39',
      roof2: '#a55a44',
      trim: '#d3a95f',
      glow: '#ffd88a',
    },
    forest: {
      sky: '#101a22',
      far: '#17262c',
      ground: '#2c3a2c',
      ground2: '#344433',
      path: '#43543f',
      wall: '#5b5140',
      wall2: '#6a5f4b',
      roof: '#3f6a55',
      roof2: '#4d8065',
      trim: '#bcd7a8',
      glow: '#b6ffd8',
    },
    sky: {
      sky: '#0b1526',
      far: '#132339',
      ground: '#2b3b56',
      ground2: '#334562',
      path: '#3f5680',
      wall: '#5a6b8c',
      wall2: '#6a7c9f',
      roof: '#3f6f92',
      roof2: '#4f87ad',
      trim: '#9fd8f0',
      glow: '#c4f0ff',
    },
  });
  function townPalette() {
    return TOWN_PALETTE[town().palette] || TOWN_PALETTE.stone;
  }
  const SHOP_TILE = Object.freeze({
    '5': { label: '宿', color: '#ffd07a' },
    '6': { label: '剣', color: '#ff9d7a' },
    '7': { label: '盾', color: '#9fd0ff' },
    '8': { label: '薬', color: '#a8ffbe' },
  });
  function drawTownDoor(px, py, kind, pal) {
    let info = SHOP_TILE[kind];
    X.fillStyle = pal.wall2;
    X.fillRect(px, py, T, T);
    X.fillStyle = '#1a1410';
    X.fillRect(px + 5, py + 7, 10, 13);
    X.fillStyle = pal.trim;
    X.fillRect(px + 4, py + 6, 12, 2);
    X.fillStyle = info.color;
    X.fillRect(px + 3, py + 1, 14, 5);
    X.fillStyle = '#12161f';
    X.font = 'bold 5px monospace';
    X.textAlign = 'center';
    X.fillText(info.label, px + 10, py + 5.5);
    X.textAlign = 'left';
    X.fillStyle = 'rgba(255,225,160,.45)';
    X.fillRect(px + 6, py + 8, 8, 3);
  }
  function drawTownFountain(px, py, x, y, g) {
    let t = performance.now() / 420,
      openTop = g[y - 1]?.[x] !== '9',
      openBottom = g[y + 1]?.[x] !== '9',
      openLeft = g[y]?.[x - 1] !== '9',
      openRight = g[y]?.[x + 1] !== '9';
    X.fillStyle = '#2a6a8c';
    X.fillRect(px, py, T, T);
    X.fillStyle = '#3f96bd';
    X.fillRect(px, py + 2 + Math.round(Math.sin(t + x) * 1), T, 3);
    X.fillStyle = 'rgba(190,240,255,.22)';
    X.fillRect(px + 2, py + 8, 16, 4);
    if (openTop) {
      X.fillStyle = '#6d7f96';
      X.fillRect(px, py, T, 4);
      X.fillStyle = '#93a6bd';
      X.fillRect(px, py, T, 2);
      for (let i = 0; i < 3; i++) {
        let h = 5 + Math.sin(t * 2.2 + i + x) * 3;
        X.fillStyle = '#c9efff';
        X.fillRect(px + 4 + i * 5, py - h, 2, h);
      }
    }
    if (openBottom) {
      X.fillStyle = '#6d7f96';
      X.fillRect(px, py + T - 4, T, 4);
      X.fillStyle = '#465468';
      X.fillRect(px, py + T - 1, T, 1);
    }
    if (openLeft) {
      X.fillStyle = '#6d7f96';
      X.fillRect(px, py, 3, T);
    }
    if (openRight) {
      X.fillStyle = '#6d7f96';
      X.fillRect(px + T - 3, py, 3, T);
    }
  }
  function drawTownMap() {
    let t = town(),
      pal = townPalette(),
      g = t.map,
      time = performance.now() / 900;
    X.fillStyle = pal.sky;
    X.fillRect(0, 0, W, H);
    X.fillStyle = pal.far;
    X.fillRect(0, 0, W, 40);
    for (let i = 0; i < 8; i++) {
      let w = 22 + ((i * 13) % 20),
        x = i * 42 - 6,
        h = 14 + ((i * 7) % 16);
      X.fillStyle = i % 2 ? pal.sky : pal.far;
      X.fillRect(x, 40 - h, w, h);
      X.fillStyle = pal.roof2;
      X.fillRect(x, 40 - h, w, 2);
      X.fillStyle = pal.glow;
      X.globalAlpha = 0.3 + 0.15 * Math.sin(time + i);
      X.fillRect(x + 4, 40 - h + 6, 3, 3);
      X.fillRect(x + w - 8, 40 - h + 6, 3, 3);
      X.globalAlpha = 1;
    }
    for (let i = 0; i < 26; i++) {
      let sx = (i * 67) % W,
        sy = (i * 29) % 34;
      X.fillStyle = 'rgba(255,255,255,' + (0.12 + 0.1 * Math.sin(time * 1.6 + i)) + ')';
      X.fillRect(sx, sy, 1, 1);
    }
    for (let y = 0; y < g.length; y++)
      for (let x = 0; x < 16; x++) {
        let v = g[y][x],
          px = x * T,
          py = y * T,
          seed = (x * 19 + y * 13) % 6;
        if (v === '1') {
          if (y < 2) continue; // 上端2行は遠景の空として抜く
          X.fillStyle = seed < 2 ? pal.wall : pal.wall2;
          X.fillRect(px, py, T, T);
          X.fillStyle = 'rgba(0,0,0,.16)';
          X.fillRect(px + T - 3, py, 3, T);
          if (seed === 0 || seed === 3) {
            X.fillStyle = '#1b212c';
            X.fillRect(px + 5, py + 6, 10, 7);
            X.fillStyle = pal.glow;
            X.globalAlpha = 0.5 + 0.2 * Math.sin(time * 1.3 + x);
            X.fillRect(px + 6, py + 7, 8, 5);
            X.globalAlpha = 1;
            X.fillStyle = pal.trim;
            X.fillRect(px + 4, py + 13, 12, 1);
          }
          if (g[y - 1]?.[x] !== '1') {
            X.fillStyle = pal.roof;
            X.fillRect(px, py, T, 7);
            X.fillStyle = pal.roof2;
            X.fillRect(px, py, T, 4);
            X.fillStyle = pal.trim;
            X.fillRect(px, py + 7, T, 1);
            if (x % 2 === 0) {
              X.fillStyle = 'rgba(0,0,0,.22)';
              X.fillRect(px + 9, py, 2, 7);
            }
          }
          if (g[y + 1] && g[y + 1][x] !== '1') {
            X.fillStyle = pal.roof;
            X.fillRect(px, py + 14, T, 4);
            X.fillStyle = pal.trim;
            X.fillRect(px, py + 18, T, 2);
            X.fillStyle = 'rgba(0,0,0,.3)';
            X.fillRect(px, py + T - 1, T, 1);
          }
          continue;
        }
        X.fillStyle = seed < 2 ? pal.ground : pal.ground2;
        X.fillRect(px, py, T, T);
        if (seed === 4 || seed === 5) {
          X.fillStyle = pal.path;
          X.fillRect(px + 1, py + 1, 18, 18);
          X.fillStyle = 'rgba(0,0,0,.14)';
          X.fillRect(px + 1, py + 18, 18, 1);
        }
        if (seed === 1) {
          X.fillStyle = 'rgba(255,255,255,.05)';
          X.fillRect(px + 4, py + 12, 5, 2);
          X.fillRect(px + 12, py + 6, 3, 2);
        }
        if (v === '9') {
          drawTownFountain(px, py, x, y, g);
          continue;
        }
        if (v === '2') {
          drawEntrance(px, py);
          continue;
        }
        if (SHOP_TILE[v]) {
          drawTownDoor(px, py, v, pal);
          continue;
        }
        // 街灯
        if (g[y - 1]?.[x] === '1' && seed === 2) {
          X.fillStyle = '#4a4436';
          X.fillRect(px + 9, py + 6, 2, 12);
          X.fillStyle = pal.glow;
          X.globalAlpha = 0.75;
          X.fillRect(px + 7, py + 2, 6, 5);
          X.globalAlpha = 0.18;
          X.fillRect(px + 3, py - 1, 14, 13);
          X.globalAlpha = 1;
        }
      }
    X.fillStyle = '#080d16d9';
    X.fillRect(0, 0, W, 13);
    X.fillStyle = pal.trim;
    X.font = 'bold 10px monospace';
    X.textAlign = 'left';
    X.fillText(t.name + '　所持 ' + gold() + 'G', 5, 9);
  }
  function drawMap() {
    if (state.mode === 'town') {
      drawTownMap();
      return;
    }
    if (isTower()) {
      drawDuskTowerMap();
      return;
    }
    if (state.chapter === 3) {
      drawSkyTowerMap();
      return;
    }
    if (state.chapter === 2) {
      drawForestMap();
      return;
    }
    drawStoneMap();
  }
  function drawDuskTowerMap() {
    let g = TOWER_MAPS[currentFloor()] || TOWER_MAPS[1];
    X.fillStyle = '#0d0a14';
    X.fillRect(0, 0, W, H);
    for (let y = 0; y < g.length; y++)
      for (let x = 0; x < 16; x++) {
        let v = tile(x, y),
          px = x * T,
          py = y * T,
          seed = (x * 17 + y * 31) % 7;
        if (v === '1') {
          X.fillStyle = seed < 2 ? '#3a2f4a' : '#40354f';
          X.fillRect(px, py, T, T);
          X.fillStyle = '#54476a';
          X.fillRect(px + 1, py + 1, 18, 2);
          X.fillStyle = '#2a2236';
          X.fillRect(px, py + 17, 20, 3);
          X.fillStyle = '#251e30';
          X.fillRect(px + 9 + (y % 2 ? 1 : 0), py + 3, 2, 14);
          X.fillStyle = '#6d5f88';
          X.fillRect(px + 2, py + 4, 6, 1);
          X.fillRect(px + 12, py + 11, 6, 1);
          if (tile(x, y + 1) !== '1') {
            X.fillStyle = '#8d7daa';
            X.fillRect(px, py + 15, 20, 2);
            X.fillStyle = '#1a1522';
            X.fillRect(px, py + 17, 20, 3);
          }
          if (tile(x, y - 1) !== '1') {
            X.fillStyle = '#1c1626';
            X.fillRect(px, py, 20, 3);
          }
          if (tile(x - 1, y) !== '1') {
            X.fillStyle = '#8578a0';
            X.fillRect(px, py, 2, 17);
          }
          if (tile(x + 1, y) !== '1') {
            X.fillStyle = '#201a2b';
            X.fillRect(px + 18, py, 2, 18);
          }
        } else {
          X.fillStyle = seed < 3 ? '#1d1a2a' : '#221e31';
          X.fillRect(px, py, T, T);
          X.fillStyle = '#2f2a42';
          X.fillRect(px, py, 20, 1);
          X.fillRect(px, py, 1, 20);
          X.fillStyle = '#141220';
          X.fillRect(px, py + 19, 20, 1);
          X.fillRect(px + 19, py, 1, 20);
          if (seed === 1 || seed === 5) {
            X.fillStyle = '#3a3352';
            X.fillRect(px + 4, py + 5, 5, 1);
            X.fillRect(px + 9, py + 8, 4, 1);
          }
        }
        if (v === '2') drawEntrance(px, py);
        if (v === '3' && state.bossAlive) drawBossMarker(px, py);
        if (v === '4') drawStoneRestoration(px, py);
        if (v === 'u') drawStairs(px, py, true);
        if (v === 'd') drawStairs(px, py, false);
        if (v === 'c') drawChest(px, py, !!openedChests()[chestKey(x, y)]);
        if (v === 'p') drawPit(px, py);
      }
    [
      [0, 9],
      [15, 9],
      [0, 5],
      [15, 5],
      [0, 1],
      [15, 1],
    ].forEach((p, i) => drawTorch(p[0] * T, p[1] * T, i));
    // 何階にいるかを常に出しておく
    X.fillStyle = '#0c0916cc';
    X.fillRect(W - 52, 3, 49, 14);
    X.strokeStyle = '#8f7bd6';
    X.lineWidth = 1;
    X.strokeRect(W - 51.5, 3.5, 48, 13);
    X.fillStyle = '#e6d9ff';
    X.font = 'bold 10px monospace';
    X.textAlign = 'center';
    X.fillText(currentFloor() + ' / ' + TOWER_FLOORS + ' F', W - 27, 13);
    X.textAlign = 'left';
    X.fillStyle = '#0003';
    X.fillRect(0, 0, W, 5);
    X.fillRect(0, H - 4, W, 4);
  }
  function drawStairs(px, py, up) {
    X.fillStyle = '#15111f';
    X.fillRect(px + 2, py + 2, 16, 16);
    for (let i = 0; i < 4; i++) {
      let w = 14 - i * 3,
        sx = px + 3 + (up ? 0 : i * 1.5),
        sy = up ? py + 15 - i * 4 : py + 3 + i * 4;
      X.fillStyle = up ? '#c9b6f0' : '#6f6390';
      X.fillRect(sx, sy, w, 3);
      X.fillStyle = '#241d33';
      X.fillRect(sx, sy + 3, w, 1);
    }
    X.fillStyle = up ? '#ffe9a8' : '#9d8fc0';
    X.font = 'bold 8px monospace';
    X.textAlign = 'center';
    X.fillText(up ? '▲' : '▼', px + 10, py + 18);
    X.textAlign = 'left';
  }
  function drawChest(px, py, opened) {
    if (opened) {
      X.fillStyle = '#3a3040';
      X.fillRect(px + 4, py + 11, 12, 6);
      X.fillStyle = '#241d2c';
      X.fillRect(px + 4, py + 8, 12, 3);
      return;
    }
    X.fillStyle = '#7a4d1f';
    X.fillRect(px + 3, py + 8, 14, 9);
    X.fillStyle = '#a86c2c';
    X.fillRect(px + 3, py + 6, 14, 4);
    X.fillStyle = '#ffd866';
    X.fillRect(px + 9, py + 9, 2, 4);
    X.fillStyle = '#4a2d10';
    X.fillRect(px + 3, py + 16, 14, 1);
    X.fillStyle = '#ffeaa8';
    X.fillRect(px + 4, py + 7, 3, 1);
  }
  function drawPit(px, py) {
    X.fillStyle = '#07050c';
    X.fillRect(px + 1, py + 1, 18, 18);
    X.fillStyle = '#020106';
    X.beginPath();
    X.ellipse(px + 10, py + 11, 7.5, 6, 0, 0, Math.PI * 2);
    X.fill();
    X.strokeStyle = '#453a5c';
    X.lineWidth = 1;
    X.beginPath();
    X.ellipse(px + 10, py + 10, 8, 6.5, 0, 0, Math.PI * 2);
    X.stroke();
    X.fillStyle = '#5d4f7a';
    X.fillRect(px + 3, py + 3, 2, 1);
    X.fillRect(px + 15, py + 16, 2, 1);
  }
  function drawStoneMap() {
    X.fillStyle = '#080b10';
    X.fillRect(0, 0, W, H);
    for (let y = 0; y < MAPS[1].length; y++)
      for (let x = 0; x < 16; x++) {
        let v = tile(x, y),
          px = x * T,
          py = y * T,
          seed = (x * 17 + y * 31) % 7;
        if (v === '1') {
          X.fillStyle = seed < 2 ? '#303747' : '#343b4b';
          X.fillRect(px, py, T, T);
          X.fillStyle = '#444d60';
          X.fillRect(px + 1, py + 1, 18, 2);
          X.fillStyle = '#252b38';
          X.fillRect(px, py + 17, 20, 3);
          X.fillStyle = '#202631';
          X.fillRect(px + 9 + (y % 2 ? 1 : 0), py + 3, 2, 14);
          X.fillStyle = '#566176';
          X.fillRect(px + 2, py + 4, 6, 1);
          X.fillRect(px + 12, py + 11, 6, 1);
          if (tile(x, y + 1) !== '1') {
            X.fillStyle = '#78849a';
            X.fillRect(px, py + 15, 20, 2);
            X.fillStyle = '#151a23';
            X.fillRect(px, py + 17, 20, 3);
          }
          if (tile(x, y - 1) !== '1') {
            X.fillStyle = '#171c27';
            X.fillRect(px, py, 20, 3);
          }
          if (tile(x - 1, y) !== '1') {
            X.fillStyle = '#707b90';
            X.fillRect(px, py, 2, 17);
          }
          if (tile(x + 1, y) !== '1') {
            X.fillStyle = '#1c222d';
            X.fillRect(px + 18, py, 2, 18);
          }
          if (seed === 0) {
            X.fillStyle = '#202733';
            X.fillRect(px + 4, py + 8, 5, 1);
            X.fillRect(px + 4, py + 8, 1, 4);
          }
        } else {
          X.fillStyle = seed < 3 ? '#181f2a' : '#1c2430';
          X.fillRect(px, py, T, T);
          X.fillStyle = '#2a3442';
          X.fillRect(px, py, 20, 1);
          X.fillRect(px, py, 1, 20);
          X.fillStyle = '#111720';
          X.fillRect(px, py + 19, 20, 1);
          X.fillRect(px + 19, py, 1, 20);
          if (seed === 1 || seed === 5) {
            X.fillStyle = '#303b49';
            X.fillRect(px + 4, py + 5, 5, 1);
            X.fillRect(px + 8, py + 6, 1, 3);
            X.fillRect(px + 9, py + 8, 4, 1);
          }
          if (seed === 3) {
            X.fillStyle = '#121923';
            X.fillRect(px + 13, py + 12, 2, 2);
          }
        }
        if (v === '2') drawEntrance(px, py);
        if (v === '3' && state.bossAlive) drawBossMarker(px, py);
        if (v === '4') drawStoneRestoration(px, py);
      }
    [
      [0, 9],
      [15, 9],
      [0, 5],
      [15, 5],
      [0, 1],
      [15, 1],
    ].forEach((p, i) => drawTorch(p[0] * T, p[1] * T, i));
    X.fillStyle = '#0003';
    X.fillRect(0, 0, W, 5);
    X.fillRect(0, H - 4, W, 4);
  }
  function drawForestMap() {
    let pulse = (state.steps % 4) / 4;
    X.fillStyle = '#050b14';
    X.fillRect(0, 0, W, H);
    for (let y = 0; y < MAPS[2].length; y++)
      for (let x = 0; x < 16; x++) {
        let v = tile(x, y),
          px = x * T,
          py = y * T,
          seed = (x * 23 + y * 37) % 9;
        if (v === '1') {
          X.fillStyle = seed < 3 ? '#102b2c' : '#143233';
          X.fillRect(px, py, T, T);
          X.fillStyle = '#0a1c23';
          X.fillRect(px + 1, py + 15, 18, 5);
          X.fillStyle = '#352b3d';
          X.fillRect(px + 7 + (seed % 3), py + 5, 6, 15);
          X.fillStyle = '#57405a';
          X.fillRect(px + 9 + (seed % 3), py + 6, 2, 11);
          X.fillStyle = seed % 2 ? '#245044' : '#1d493f';
          X.fillRect(px + 1, py + 2, 18, 8);
          X.fillRect(px + 3, py, 13, 5);
          X.fillStyle = '#3d6a57';
          X.fillRect(px + 3 + (seed % 4), py + 3, 7, 2);
          if (tile(x, y + 1) !== '1') {
            X.fillStyle = '#7b6790';
            X.fillRect(px, py + 17, 20, 2);
            X.fillStyle = '#081017';
            X.fillRect(px, py + 19, 20, 1);
          }
          if (seed === 0 || seed === 5) {
            X.fillStyle = '#6f78bd';
            X.fillRect(px + 2, py + 11, 2, 2);
            X.fillStyle = '#c4c9ff';
            X.fillRect(px + 3, py + 10, 1, 1);
          }
        } else {
          X.fillStyle = seed < 4 ? '#172833' : '#1b2d38';
          X.fillRect(px, py, T, T);
          X.fillStyle = '#263b45';
          X.fillRect(px, py, 20, 1);
          X.fillRect(px, py, 1, 20);
          X.fillStyle = '#0c171f';
          X.fillRect(px, py + 19, 20, 1);
          X.fillRect(px + 19, py, 1, 20);
          if (seed === 1 || seed === 6) {
            X.fillStyle = '#31504d';
            X.fillRect(px + 3, py + 5, 3, 2);
            X.fillRect(px + 5, py + 7, 5, 1);
            X.fillRect(px + 13, py + 13, 2, 3);
          }
          if (seed === 3) {
            X.fillStyle = '#8a8ed1';
            X.fillRect(px + 12, py + 4, 2, 2);
            X.fillStyle = '#dce5ff';
            X.fillRect(px + 13, py + 3, 1, 1);
          }
          if (seed === 8) {
            X.fillStyle = '#263b5c';
            X.fillRect(px + 4, py + 11, 8, 2);
            X.fillRect(px + 7, py + 8, 2, 7);
          }
        }
        if (v === '2') drawForestGate(px, py);
        if (v === '3' && state.bossAlive) drawMoonBossMarker(px, py);
        if (v === '4') drawMoonSpring(px, py);
      }
    X.fillStyle = 'rgba(178,190,255,' + (0.08 + pulse * 0.04) + ')';
    X.beginPath();
    X.arc(283, 28, 42, 0, Math.PI * 2);
    X.fill();
    [
      [34, 32],
      [178, 72],
      [286, 151],
      [117, 188],
      [247, 218],
    ].forEach((p, i) => {
      let f = (state.steps + i) % 3;
      X.fillStyle = f === 0 ? '#fff6b0' : '#9feaff';
      X.fillRect(p[0] + f, p[1] - (f === 1 ? 1 : 0), 2, 2);
    });
    X.fillStyle = '#0004';
    X.fillRect(0, 0, W, 4);
    X.fillRect(0, H - 4, W, 4);
  }
  function drawSkyTowerMap() {
    let pulse = (performance.now() / 320) % 2;
    X.fillStyle = '#081329';
    X.fillRect(0, 0, W, H);
    for (let y = 0; y < MAPS[3].length; y++)
      for (let x = 0; x < 16; x++) {
        let v = tile(x, y),
          px = x * T,
          py = y * T,
          seed = (x * 29 + y * 41) % 8;
        if (v === '1') {
          X.fillStyle = seed < 3 ? '#273958' : '#304464';
          X.fillRect(px, py, T, T);
          X.fillStyle = '#496482';
          X.fillRect(px + 1, py + 1, 18, 3);
          X.fillStyle = '#17243d';
          X.fillRect(px, py + 17, 20, 3);
          X.fillStyle = '#182942';
          X.fillRect(px + 9 + (y % 2), py + 4, 2, 13);
          if (tile(x, y + 1) !== '1') {
            X.fillStyle = '#7ecce2';
            X.fillRect(px, py + 16, 20, 2);
            X.fillStyle = '#16324d';
            X.fillRect(px, py + 18, 20, 2);
          }
          if (seed === 1) {
            X.fillStyle = '#d4ad55';
            X.fillRect(px + 4, py + 7, 11, 2);
            X.fillRect(px + 9, py + 4, 2, 8);
          }
        } else {
          X.fillStyle = seed < 4 ? '#304662' : '#354d69';
          X.fillRect(px, py, T, T);
          X.fillStyle = '#5e7892';
          X.fillRect(px, py, 20, 2);
          X.fillRect(px, py, 2, 20);
          X.fillStyle = '#182a43';
          X.fillRect(px, py + 18, 20, 2);
          X.fillRect(px + 18, py, 2, 20);
          if (seed === 2 || seed === 6) {
            X.fillStyle = '#55d9e9';
            X.fillRect(px + 5, py + 9, 10, 2);
            X.fillStyle = '#d9ffff';
            X.fillRect(px + 9, py + 8, 2, 4);
          }
          if (seed === 4) {
            X.fillStyle = '#b38b43';
            X.fillRect(px + 6, py + 5, 8, 1);
            X.fillRect(px + 9, py + 3, 2, 6);
          }
        }
        if (v === '2') drawSkyGate(px, py);
        if (v === '3' && state.bossAlive) drawSkyBossMarker(px, py);
        if (v === '4') drawStarRing(px, py);
      }
    X.fillStyle = 'rgba(95,218,255,' + (0.08 + 0.04 * Math.sin(pulse * Math.PI)) + ')';
    X.fillRect(0, 0, W, 3);
    for (let i = 0; i < 12; i++) {
      let sx = (i * 71 + state.steps * 3) % 318,
        sy = (i * 37) % 218;
      X.fillStyle = i % 3 ? '#b8f7ff' : '#ffe9a1';
      X.fillRect(sx, sy, 1 + (i % 2), 1 + (i % 2));
    }
    X.fillStyle = '#0005';
    X.fillRect(0, H - 4, W, 4);
  }
  function drawSkyGate(px, py) {
    X.fillStyle = '#172945';
    X.fillRect(px + 2, py + 2, 16, 18);
    X.fillStyle = '#a7833f';
    X.fillRect(px + 2, py + 2, 3, 18);
    X.fillRect(px + 15, py + 2, 3, 18);
    X.fillRect(px + 5, py + 1, 10, 3);
    X.fillStyle = '#5de4f3';
    X.fillRect(px + 7, py + 6, 6, 10);
    X.fillStyle = '#e9ffff';
    X.fillRect(px + 9, py + 7, 2, 7);
  }
  function drawStarRing(px, py) {
    let f = state.steps % 2;
    X.fillStyle = '#203652';
    X.fillRect(px + 1, py + 1, 18, 18);
    X.strokeStyle = '#e6bd62';
    X.lineWidth = 2;
    X.beginPath();
    X.arc(px + 10, py + 11, 7, 0, Math.PI * 2);
    X.stroke();
    X.fillStyle = '#69edff';
    X.fillRect(px + 9, py + 4 - f, 3, 13);
    X.fillRect(px + 4 - f, py + 9, 13, 3);
    X.fillStyle = '#fff';
    X.fillRect(px + 9, py + 9, 3, 3);
  }
  function drawSkyBossMarker(px, py) {
    X.fillStyle = '#101a35';
    X.fillRect(px + 1, py + 1, 18, 18);
    X.fillStyle = '#284f78';
    X.fillRect(px + 3, py + 3, 14, 14);
    X.fillStyle = '#69e7ff';
    X.fillRect(px + 8, py + 5, 5, 10);
    X.fillRect(px + 5, py + 8, 11, 4);
    X.fillStyle = '#ffe38a';
    X.fillRect(px + 9, py + 8, 3, 3);
    X.strokeStyle = '#d7b65b';
    X.strokeRect(px + 1.5, py + 1.5, 17, 17);
  }
  function drawForestGate(px, py) {
    X.fillStyle = '#0b1820';
    X.fillRect(px + 2, py + 3, 16, 17);
    X.fillStyle = '#65506e';
    X.fillRect(px + 2, py + 3, 3, 17);
    X.fillRect(px + 15, py + 3, 3, 17);
    X.fillRect(px + 5, py + 2, 10, 3);
    X.fillStyle = '#9d8bb2';
    X.fillRect(px + 6, py + 4, 8, 1);
    X.fillStyle = '#a9dcff';
    X.fillRect(px + 8, py + 8, 4, 5);
    X.fillStyle = '#eef8ff';
    X.fillRect(px + 9, py + 8, 2, 2);
  }
  function drawMoonSpring(px, py) {
    let f = state.steps % 2;
    X.fillStyle = '#152d40';
    X.fillRect(px + 1, py + 1, 18, 18);
    X.fillStyle = '#65558b';
    X.fillRect(px + 2, py + 12, 16, 6);
    X.fillStyle = '#a38ec5';
    X.fillRect(px + 3, py + 11, 14, 3);
    X.fillStyle = '#3dc9db';
    X.fillRect(px + 4, py + 8, 12, 6);
    X.fillStyle = '#a9f6ff';
    X.fillRect(px + 5 + f, py + 9, 7, 2);
    X.fillStyle = '#efffff';
    X.fillRect(px + 9, py + 4 - f, 2, 3);
    X.fillRect(px + 5, py + 6 + f, 2, 2);
    X.fillRect(px + 14, py + 5, 1, 2);
    X.strokeStyle = '#c9b8ff';
    X.strokeRect(px + 1.5, py + 1.5, 17, 17);
  }
  function drawMoonBossMarker(px, py) {
    X.fillStyle = '#180d2b';
    X.fillRect(px + 1, py + 1, 18, 18);
    X.fillStyle = '#49256d';
    X.fillRect(px + 3, py + 3, 14, 14);
    X.fillStyle = '#8c4eb4';
    X.fillRect(px + 5, py + 5, 10, 10);
    X.fillStyle = '#e0d9ff';
    X.fillRect(px + 8, py + 4, 5, 2);
    X.fillRect(px + 7, py + 6, 2, 6);
    X.fillRect(px + 12, py + 6, 2, 6);
    X.fillStyle = '#ff5e70';
    X.fillRect(px + 8, py + 9, 2, 2);
    X.fillRect(px + 12, py + 9, 2, 2);
    X.strokeStyle = '#c58cff';
    X.strokeRect(px + 1.5, py + 1.5, 17, 17);
  }
  function drawTorch(px, py, n) {
    let flick = (state.steps + n) % 2;
    X.fillStyle = '#151922';
    X.fillRect(px + 7, py + 11, 7, 8);
    X.fillStyle = '#84613a';
    X.fillRect(px + 9, py + 10, 3, 9);
    X.fillStyle = '#e64a25';
    X.fillRect(px + 7 + flick, py + 3, 7, 8);
    X.fillStyle = '#ff9d32';
    X.fillRect(px + 9, py + 2 + flick, 4, 8);
    X.fillStyle = '#fff09a';
    X.fillRect(px + 10, py + 5, 2, 4);
  }
  function drawEntrance(px, py) {
    X.fillStyle = '#0a1019';
    X.fillRect(px + 2, py + 2, 16, 18);
    X.fillStyle = '#65758c';
    X.fillRect(px + 2, py + 2, 3, 18);
    X.fillRect(px + 15, py + 2, 3, 18);
    X.fillRect(px + 5, py + 1, 10, 3);
    X.fillStyle = '#8aa8bf';
    X.fillRect(px + 5, py + 4, 10, 1);
    X.fillStyle = '#57c7ff';
    X.fillRect(px + 7, py + 7, 6, 2);
    X.fillStyle = '#dff8ff';
    X.fillRect(px + 9, py + 7, 2, 2);
  }
  function drawStoneRestoration(px, py) {
    let f = state.steps % 2;
    X.fillStyle = '#111827';
    X.fillRect(px + 1, py + 1, 18, 18);
    X.fillStyle = '#59657a';
    X.fillRect(px + 3, py + 13, 14, 5);
    X.fillStyle = '#8895aa';
    X.fillRect(px + 5, py + 10, 10, 4);
    X.fillStyle = '#ffb43e';
    X.fillRect(px + 7 + f, py + 4, 7, 7);
    X.fillStyle = '#ffe184';
    X.fillRect(px + 9, py + 2 + f, 4, 8);
    X.fillStyle = '#fff8c7';
    X.fillRect(px + 10, py + 6, 2, 4);
    X.strokeStyle = '#e8bd62';
    X.strokeRect(px + 1.5, py + 1.5, 17, 17);
  }
  function drawBossMarker(px, py) {
    X.fillStyle = '#360d16';
    X.fillRect(px + 1, py + 1, 18, 18);
    X.fillStyle = '#7c1e23';
    X.fillRect(px + 3, py + 3, 14, 14);
    X.fillStyle = '#dd4933';
    X.fillRect(px + 5, py + 5, 10, 10);
    X.fillStyle = '#ffb33d';
    X.fillRect(px + 7, py + 3, 2, 5);
    X.fillRect(px + 12, py + 3, 2, 5);
    X.fillStyle = '#fff0a6';
    X.fillRect(px + 8, py + 8, 2, 2);
    X.fillRect(px + 12, py + 8, 2, 2);
    X.fillStyle = '#401019';
    X.fillRect(px + 8, py + 13, 6, 2);
    X.strokeStyle = '#ff6a38';
    X.lineWidth = 1;
    X.strokeRect(px + 1.5, py + 1.5, 17, 17);
  }
  function drawFieldSprite(key, px, py, dir = 'down', frame = 0, alive = true) {
    let sprite = fieldSprites[key]?.[dir] || fieldSprites[key]?.down;
    if (!sprite) return false;
    sprite = skin(sprite, key === 'mina' ? state.companion : state.hero);
    let bob = frame === 1 || frame === 3 ? -2 : 0,
      tilt = frame === 1 ? -0.035 : frame === 3 ? 0.035 : 0,
      h = key === 'luka' ? 39 : 36,
      w = (h * sprite.width) / sprite.height;
    if (w > 34) {
      h *= 34 / w;
      w = 34;
    }
    X.save();
    X.globalAlpha = alive ? 1 : 0.42;
    X.translate(Math.round(px), Math.round(py + 12 + bob));
    X.rotate(tilt);
    X.fillStyle = '#02050a88';
    X.beginPath();
    X.ellipse(0, 1, Math.min(12, w * 0.36), 3, 0, 0, Math.PI * 2);
    X.fill();
    X.imageSmoothingEnabled = true;
    X.drawImage(sprite, -w / 2, -h + 2, w, h);
    X.imageSmoothingEnabled = false;
    X.restore();
    return true;
  }
  function drawFieldCompanion(px, py, dir = 'down', frame = 0) {
    if (drawFieldSprite('mina', px, py, dir, frame, state.companion.hp > 0)) return;
    X.save();
    X.translate(Math.round(px), Math.round(py));
    let bob = frame === 1 || frame === 3 ? -1 : 0;
    X.fillStyle = '#05081799';
    X.fillRect(-8, 9, 16, 3);
    X.fillStyle = '#6e70d9';
    X.fillRect(-7, -8 + bob, 14, 18);
    X.fillStyle = '#252b72';
    X.fillRect(-9, 0 + bob, 18, 12);
    X.fillStyle = '#e6d6bd';
    X.fillRect(-5, -3 + bob, 10, 10);
    X.fillStyle = '#9b91ff';
    X.fillRect(-7, -15 + bob, 14, 10);
    X.fillStyle = '#43d8e8';
    X.fillRect(-3, -11 + bob, 2, 2);
    X.fillRect(2, -11 + bob, 2, 2);
    X.fillStyle = '#d9b14c';
    X.fillRect(8, -13 + bob, 2, 24);
    X.fillRect(6, -14 + bob, 6, 2);
    X.restore();
  }
  function drawFieldHero(px, py, dir = 'down', frame = 0) {
    if (drawFieldSprite('luka', px, py, dir, frame, state.hero.hp > 0)) return;
    X.save();
    X.translate(Math.round(px), Math.round(py));
    let moving = frame > 0,
      bob = moving && (frame === 1 || frame === 3) ? -1 : 0,
      step = [0, -3, 0, 3][frame] || 0,
      arm = -step;
    const sword = (x, y, a) => {
      X.save();
      X.translate(x, y);
      X.rotate(a);
      X.fillStyle = '#c89031';
      X.fillRect(-3, -2, 7, 3);
      X.fillStyle = '#5a3525';
      X.fillRect(0, 0, 2, 7);
      X.fillStyle = '#eef5ff';
      X.fillRect(0, -15, 3, 15);
      X.fillStyle = '#9aa9bc';
      X.fillRect(3, -14, 1, 14);
      X.fillStyle = '#fff';
      X.fillRect(1, -14, 1, 11);
      X.restore();
    };
    const shield = (x, y) => {
      X.fillStyle = '#6d4b21';
      X.fillRect(x - 5, y - 7, 10, 15);
      X.fillStyle = '#d7a83e';
      X.fillRect(x - 4, y - 8, 8, 17);
      X.fillStyle = '#dfe7ef';
      X.fillRect(x - 3, y - 7, 6, 15);
      X.fillStyle = '#8d99a8';
      X.fillRect(x + 1, y - 5, 2, 11);
      X.fillStyle = '#a72732';
      X.fillRect(x - 2, y - 1, 4, 4);
      X.fillStyle = '#f2ca58';
      X.fillRect(x - 1, y, 2, 2);
    };
    X.fillStyle = '#02050aa8';
    X.fillRect(-10, 11, 20, 3);
    X.fillStyle = '#0a0d13';
    X.fillRect(-6, 14, 12, 1);
    if (dir === 'left' || dir === 'right') {
      X.scale(dir === 'left' ? -1 : 1, 1);
      // Twin-tail, ribbon and shield sit behind the body.
      X.fillStyle = '#b77a2f';
      X.fillRect(-10, -10 + bob, 5, 3);
      X.fillRect(-12, -8 + bob, 7, 3);
      X.fillRect(-13, -5 + bob, 6, 3);
      X.fillStyle = '#f2bc62';
      X.fillRect(-11, -9 + bob, 5, 3);
      X.fillRect(-13, -6 + bob, 6, 3);
      X.fillStyle = '#161823';
      X.fillRect(-8, -12 + bob, 4, 3);
      X.fillStyle = '#a82435';
      X.fillRect(-9, -11 + bob, 3, 3);
      shield(-7, 1 + bob);
      // Black boots move in a readable four-frame stride.
      X.fillStyle = '#151722';
      X.fillRect(-5, 6 + bob, 5, 7 + Math.max(0, -step));
      X.fillRect(1, 6 + bob, 5, 7 + Math.max(0, step));
      X.fillStyle = '#d39f35';
      X.fillRect(-6 + Math.min(0, step), 12 + bob, 7, 2);
      X.fillRect(1 + Math.max(0, step), 12 + bob, 7, 2);
      // Red coat tails, fitted armour and gold belt match the battle portrait.
      X.fillStyle = '#671826';
      X.fillRect(-7, 4 + bob, 5, 7);
      X.fillRect(3, 4 + bob, 5, 7);
      X.fillStyle = '#a92739';
      X.fillRect(-6, -3 + bob, 13, 11);
      X.fillStyle = '#dc4850';
      X.fillRect(0, -2 + bob, 6, 8);
      X.fillStyle = '#f3e8da';
      X.fillRect(2, -1 + bob, 3, 6);
      X.fillStyle = '#26212a';
      X.fillRect(-5, 6 + bob, 11, 3);
      X.fillStyle = '#d6a13a';
      X.fillRect(-6, 5 + bob, 13, 2);
      X.fillRect(1, -2 + bob, 2, 7);
      // Blonde face, side fringe and visible amber eye.
      X.fillStyle = '#efbb92';
      X.fillRect(-4, -12 + bob, 10, 8);
      X.fillRect(5, -9 + bob, 3, 3);
      X.fillStyle = '#ffd78d';
      X.fillRect(-5, -15 + bob, 11, 5);
      X.fillRect(-5, -11 + bob, 3, 6);
      X.fillStyle = '#efb85e';
      X.fillRect(1, -14 + bob, 6, 3);
      X.fillRect(3, -11 + bob, 3, 3);
      X.fillStyle = '#fff3dd';
      X.fillRect(4, -10 + bob, 2, 2);
      X.fillStyle = '#9d351e';
      X.fillRect(5, -9 + bob, 1, 1);
      // Front arm, black gauntlet and sword swing opposite the legs.
      X.fillStyle = '#bd3342';
      X.fillRect(4, -1 + bob + arm / 4, 5, 7);
      X.fillStyle = '#dfe7ef';
      X.fillRect(5, -1 + bob + arm / 4, 4, 3);
      X.fillStyle = '#171821';
      X.fillRect(5, 4 + bob + arm / 3, 5, 5);
      X.fillStyle = '#efbb92';
      X.fillRect(8, 7 + bob + arm / 3, 3, 3);
      sword(11, 7 + bob + arm / 3, 0.28);
    } else {
      let back = dir === 'up';
      // Wide twin-tails and black-red bows create the same silhouette as battle.
      X.fillStyle = '#bf8439';
      X.fillRect(-12, -11 + bob, 5, 9);
      X.fillRect(7, -11 + bob, 5, 9);
      X.fillStyle = '#f2bd63';
      X.fillRect(-13, -10 + bob, 5, 7);
      X.fillRect(8, -10 + bob, 5, 7);
      X.fillStyle = '#171821';
      X.fillRect(-9, -14 + bob, 4, 4);
      X.fillRect(5, -14 + bob, 4, 4);
      X.fillStyle = '#aa2737';
      X.fillRect(-8, -13 + bob, 3, 3);
      X.fillRect(6, -13 + bob, 3, 3);
      X.fillStyle = '#6b1827';
      X.fillRect(-8, 3 + bob, 5, 8);
      X.fillRect(3, 3 + bob, 5, 8);
      X.fillStyle = '#151722';
      X.fillRect(-6, 6 + bob, 5, 7 + Math.max(0, -step));
      X.fillRect(1, 6 + bob, 5, 7 + Math.max(0, step));
      X.fillStyle = '#d39f35';
      X.fillRect(-7 + Math.min(0, step), 12 + bob, 7, 2);
      X.fillRect(1 + Math.max(0, step), 12 + bob, 7, 2);
      // Shield and sword remain recognizable from both front and back.
      shield(-9, 0 + bob + arm / 4);
      sword(10, 6 + bob - arm / 3, back ? -0.18 : 0.18);
      X.fillStyle = '#ad293a';
      X.fillRect(-7, -4 + bob, 14, 12);
      X.fillStyle = '#df4850';
      X.fillRect(-5, -3 + bob, 6, 9);
      X.fillStyle = '#f4e9dc';
      X.fillRect(-2, -2 + bob, 5, 7);
      X.fillStyle = '#24202a';
      X.fillRect(-6, 6 + bob, 12, 3);
      X.fillStyle = '#d7a23b';
      X.fillRect(-7, 5 + bob, 14, 2);
      X.fillRect(-1, -3 + bob, 2, 8);
      X.fillStyle = '#b93242';
      X.fillRect(-10, -2 + bob + arm / 3, 4, 8);
      X.fillRect(6, -2 + bob - arm / 3, 4, 8);
      X.fillStyle = '#171821';
      X.fillRect(-10, 4 + bob + arm / 3, 4, 5);
      X.fillRect(6, 4 + bob - arm / 3, 4, 5);
      if (back) {
        X.fillStyle = '#d99b47';
        X.fillRect(-6, -14 + bob, 12, 10);
        X.fillStyle = '#ffd58a';
        X.fillRect(-5, -14 + bob, 9, 5);
        X.fillStyle = '#efb55b';
        X.fillRect(-6, -9 + bob, 4, 5);
      } else {
        X.fillStyle = '#efbb92';
        X.fillRect(-5, -12 + bob, 10, 8);
        X.fillStyle = '#ffd68b';
        X.fillRect(-6, -15 + bob, 12, 5);
        X.fillRect(-6, -11 + bob, 3, 6);
        X.fillStyle = '#efb65d';
        X.fillRect(2, -13 + bob, 4, 5);
        X.fillStyle = '#fff3df';
        X.fillRect(-3, -10 + bob, 2, 2);
        X.fillRect(2, -10 + bob, 2, 2);
        X.fillStyle = '#9d351e';
        X.fillRect(-2, -9 + bob, 1, 1);
        X.fillRect(3, -9 + bob, 1, 1);
      }
    }
    X.fillStyle = '#ffe46b';
    X.fillRect(-2, -20 + bob, 4, 2);
    X.fillRect(-1, -18 + bob, 2, 2);
    X.restore();
  }
  function drawHero(px, py, marker = false, battle = false, pose = 0) {
    X.save();
    X.translate(Math.round(px), Math.round(py));
    if (battle) X.scale(1.55, 1.55);
    let crouch = pose === 1 ? 3 : pose === 3 ? 1 : 0,
      lean = pose === 3 ? 4 : pose === 4 ? 2 : 0;
    X.fillStyle = '#02040a99';
    X.fillRect(-15, 18, 34, 5);
    // Back leg, cape and shield establish a strong silhouette.
    X.fillStyle = '#19243a';
    X.fillRect(-8, 8 + crouch, 8, 13);
    X.fillStyle = '#4c3220';
    X.fillRect(-10, 18 + crouch, 12, 5);
    X.fillStyle = '#10274f';
    X.beginPath();
    X.moveTo(-10, -11 + crouch);
    X.lineTo(-18, 13 + crouch);
    X.lineTo(-6, 10 + crouch);
    X.lineTo(1, -7 + crouch);
    X.closePath();
    X.fill();
    X.fillStyle = '#8999ac';
    X.fillRect(-17, -3 + crouch, 10, 17);
    X.fillStyle = '#c5d2de';
    X.fillRect(-15, -1 + crouch, 6, 12);
    X.fillStyle = '#4e6178';
    X.fillRect(-13, 2 + crouch, 2, 7);
    // Front leg is separated and advances during the strike.
    X.fillStyle = '#223558';
    X.fillRect(2 + lean / 2, 8 + crouch, 8, 13);
    X.fillStyle = '#5c3b21';
    X.fillRect(1 + lean, 18 + crouch, 13, 5);
    // Torso armour with readable highlights.
    X.fillStyle = '#15396f';
    X.fillRect(-9 + lean, -9 + crouch, 20, 20);
    X.fillStyle = '#2878bd';
    X.fillRect(-6 + lean, -8 + crouch, 10, 17);
    X.fillStyle = '#69b9ec';
    X.fillRect(-4 + lean, -6 + crouch, 3, 11);
    X.fillStyle = '#d7e3ee';
    X.fillRect(-10 + lean, -8 + crouch, 21, 3);
    X.fillStyle = '#7d91a8';
    X.fillRect(-6 + lean, 8 + crouch, 17, 3);
    // Large side-facing head, hair and eye.
    X.fillStyle = '#eab27b';
    X.fillRect(-3 + lean, -22 + crouch, 15, 13);
    X.fillRect(10 + lean, -18 + crouch, 5, 6);
    X.fillStyle = '#ffd19a';
    X.fillRect(3 + lean, -19 + crouch, 9, 7);
    X.fillStyle = '#3b2418';
    X.fillRect(-5 + lean, -26 + crouch, 16, 6);
    X.fillRect(-5 + lean, -21 + crouch, 5, 9);
    X.fillStyle = '#aa6734';
    X.fillRect(-2 + lean, -25 + crouch, 11, 3);
    X.fillStyle = '#fff';
    X.fillRect(8 + lean, -18 + crouch, 3, 3);
    X.fillStyle = '#17243a';
    X.fillRect(10 + lean, -17 + crouch, 1, 2);
    // Sword arm rotates through wind-up, overhead, strike and follow-through.
    let angle = [-0.45, -2.15, -1.45, 0.48, 0.88][pose] ?? -0.45;
    X.save();
    X.translate(7 + lean, -6 + crouch);
    X.rotate(angle);
    X.fillStyle = '#2265a6';
    X.fillRect(-1, -4, 13, 8);
    X.fillStyle = '#d2deea';
    X.fillRect(8, -4, 7, 8);
    X.fillStyle = '#efbd83';
    X.fillRect(13, -3, 6, 6);
    X.fillStyle = '#c58a38';
    X.fillRect(16, -7, 4, 14);
    X.fillStyle = '#f4f8ff';
    X.fillRect(19, -3, 31, 7);
    X.fillStyle = '#aebdce';
    X.fillRect(22, 2, 28, 2);
    X.fillStyle = '#ffffff';
    X.fillRect(22, -2, 25, 2);
    X.fillStyle = '#71849b';
    X.fillRect(49, -2, 3, 5);
    X.restore();
    X.restore();
  }
  function paintBattleHero(cut, x, y, w, h, alpha, angle, scaleX = 1, scaleY = 1) {
    X.save();
    X.globalAlpha = alpha;
    X.translate(x, y);
    X.rotate(angle);
    X.scale(scaleX, scaleY);
    X.imageSmoothingEnabled = true;
    X.drawImage(cut, -w / 2, -h, w, h);
    X.imageSmoothingEnabled = false;
    X.restore();
  }
  function drawHeroAura(x, y, h) {
    let fx = state.criticalFx;
    if (!fx || fx.phase === 'fade') return;
    let pulse = fx.phase === 'charge' ? fx.p : 1,
      t = performance.now() / 180;
    X.save();
    X.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      X.strokeStyle = 'rgba(255,' + (180 + i * 25) + ',' + (55 + i * 45) + ',' + (0.25 + pulse * 0.2) + ')';
      X.lineWidth = 4 - i;
      X.beginPath();
      X.ellipse(x, y - h * 0.46, 24 + pulse * 20 + i * 7, 46 + pulse * 24 + i * 8, t + i, 0, Math.PI * 2);
      X.stroke();
    }
    for (let i = 0; i < 9; i++) {
      let a = t + i * 2.399,
        rr = 25 + pulse * 35 + (i % 3) * 8;
      X.fillStyle = i % 2 ? '#fff6b0' : '#ff9d31';
      X.fillRect(x + Math.cos(a) * rr, y - h * 0.48 + Math.sin(a) * rr, 2 + (i % 3), 2 + (i % 3));
    }
    X.restore();
  }
  function drawBattleHero() {
    let party = state.companion.active,
      baseX = party ? 49 : 69,
      h = party ? 145 : 166,
      idle = state.busy ? 0 : Math.sin(performance.now() / 310),
      x = baseX + (state.heroLunge || 0) + (state.heroHit ? -5 + idle * 2 : 0),
      y = 193 + (state.heroLift || 0) + idle * 1.5;
    if (!battleHeroReady) {
      drawHero(x, y - 33, false, true, state.battlePose || 0);
      return;
    }
    let pose = state.battlePose || 0,
      cut = skin(battleHeroFrames[pose] || battleHeroFrames[0] || battleHeroCut, state.hero),
      w = (h * cut.width) / cut.height;
    if (w > 158) {
      h *= 158 / w;
      w = 158;
    }
    let angle = ([0, -0.025, -0.045, 0.07, 0.035, -0.02][pose] || 0) + (state.heroHit ? -0.08 : idle * 0.006),
      stretch = state.heroStretch || 1,
      scaleX = (pose === 3 ? 1.04 : 1) * stretch,
      scaleY = (2 - stretch) * (1 + idle * 0.006),
      alpha = state.hero.hp > 0 ? 1 : 0.35;
    drawHeroAura(x, y, h);
    let trail = state.heroAfterimage || 0;
    if (trail > 0)
      for (let i = 4; i >= 1; i--) {
        let age = i / 4;
        paintBattleHero(
          cut,
          x - (12 + i * 13) * trail,
          y + i * 0.8,
          w,
          h,
          trail * (0.34 - age * 0.055),
          angle,
          scaleX * (1 - age * 0.025),
          scaleY * (1 - age * 0.025),
        );
      }
    paintBattleHero(cut, x, y, w, h, alpha, angle, scaleX, scaleY);
  }
  function drawBattleMage() {
    if (!state.companion.active) return;
    let cast = state.mageCast || 0,
      idle = state.busy ? 0 : Math.sin(performance.now() / 360 + 1.7),
      x = 111 + (state.mageLunge || 0) + cast * 12 + (state.mageHit ? -5 : 0),
      bottom = 190 + (state.mageLift || 0) - cast * 9 + idle * 1.6,
      h = 132 + cast * 8;
    if (!mageBattleReady) {
      drawFieldCompanion(x, bottom - 18, 'right', cast > 0.4 ? 1 : 0);
      return;
    }
    let frame = state.mageFrame || 0,
      cut = skin(mageBattleFrames[frame] || mageBattleFrames[0] || mageBattleCut, state.companion),
      w = (h * cut.width) / cut.height;
    if (w > 128) {
      h *= 128 / w;
      w = 128;
    }
    X.save();
    X.globalAlpha = state.companion.hp > 0 ? 1 : 0.35;
    X.translate(x, bottom);
    X.rotate(-cast * 0.045 + idle * 0.006 - (state.mageHit ? 0.07 : 0) + (state.mageStaffStrike || 0) * 0.16);
    X.fillStyle = '#0008';
    X.beginPath();
    X.ellipse(0, 3, w * 0.32, 7, 0, 0, Math.PI * 2);
    X.fill();
    if (cast > 0.05) {
      X.globalCompositeOperation = 'lighter';
      X.strokeStyle = 'rgba(146,225,255,' + (0.3 + cast * 0.5) + ')';
      X.lineWidth = 2;
      X.beginPath();
      X.ellipse(0, -h * 0.55, 18 + cast * 25, 7 + cast * 8, (state.mageSpin || 0) * 5, 0, Math.PI * 2);
      X.stroke();
      X.globalCompositeOperation = 'source-over';
    }
    X.imageSmoothingEnabled = true;
    X.drawImage(cut, -w / 2, -h, w, h);
    X.imageSmoothingEnabled = false;
    X.restore();
    drawStaffImpact();
  }
  function drawBattleAuras() {
    let t = performance.now() / 150,
      members = [
        { m: state.hero, x: state.companion.active ? 49 : 69, y: 157 },
        { m: state.companion, x: 111, y: 153 },
      ];
    X.save();
    X.globalCompositeOperation = 'lighter';
    for (let { m, x, y } of members) {
      if (!m || (!m.active && m === state.companion) || m.hp <= 0) continue;
      if (m.guarding) {
        for (let i = 0; i < 3; i++) {
          X.strokeStyle = 'rgba(90,220,255,' + (0.42 - i * 0.1) + ')';
          X.lineWidth = 4 - i;
          X.beginPath();
          X.ellipse(x, y, 30 + i * 6 + Math.sin(t + i) * 3, 57 + i * 4, 0, 0, Math.PI * 2);
          X.stroke();
        }
        X.fillStyle = '#d9fbff';
        for (let i = 0; i < 4; i++) X.fillRect(x - 22 + i * 15, y - 46 + (i % 2) * 12, 3, 14);
      }
      if (m.charged) {
        for (let i = 0; i < 12; i++) {
          let a = i * 2.399 + t,
            rr = 18 + (i % 4) * 8,
            yy = y + 40 - ((t * 9 + i * 17) % 105);
          X.fillStyle = i % 2 ? '#fff0a3' : '#ff65e6';
          X.fillRect(x + Math.cos(a) * rr, yy, 2 + (i % 3), 5 + (i % 4));
        }
        X.strokeStyle = 'rgba(255,111,236,.55)';
        X.lineWidth = 4;
        X.beginPath();
        X.ellipse(x, y + 35, 28 + Math.sin(t) * 5, 8, 0, 0, Math.PI * 2);
        X.stroke();
      }
    }
    X.restore();
  }
  function drawBattleMotionFx() {
    let fx = state.enemyAttackFx,
      hit = state.enemyHitFx;
    if (fx) {
      let p = fx.p,
        alpha = Math.sin(Math.PI * p);
      X.save();
      X.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 11; i++) {
        let y = 55 + i * 13 + (i % 2) * 5,
          len = 35 + (i % 4) * 12;
        X.strokeStyle =
          fx.type === 'drain'
            ? 'rgba(186,90,255,' + alpha + ')'
            : fx.type === 'savage'
              ? 'rgba(255,44,28,' + alpha + ')'
              : 'rgba(255,119,72,' + alpha + ')';
        X.lineWidth = 1 + (i % 3);
        X.beginPath();
        X.moveTo(316 - p * 120, y);
        X.lineTo(316 - p * 120 - len, y + 8);
        X.stroke();
      }
      if (fx.type === 'all') {
        X.fillStyle = 'rgba(180,75,255,' + alpha * 0.18 + ')';
        X.fillRect(0, 0, W, H);
      }
      if (fx.type === 'savage') {
        X.fillStyle = 'rgba(255,30,20,' + alpha * 0.3 + ')';
        X.fillRect(0, 0, W, H);
        X.globalCompositeOperation = 'source-over';
        X.globalAlpha = Math.min(1, p * 6) * Math.min(1, (1 - p) * 4);
        X.fillStyle = '#1a0407ee';
        X.fillRect(74, 52, 172, 30);
        X.strokeStyle = '#ff5a4a';
        X.lineWidth = 3;
        X.strokeRect(75.5, 53.5, 169, 27);
        X.textAlign = 'center';
        X.fillStyle = '#ffd7cf';
        X.font = 'bold 17px monospace';
        X.fillText('痛 恨 の 一 撃', 160, 73);
        X.globalAlpha = 1;
        X.globalCompositeOperation = 'lighter';
      }
      X.restore();
    }
    if (hit) {
      let p = hit.p,
        fade = 1 - p;
      X.save();
      X.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 14; i++) {
        let a = (i * Math.PI) / 7 + p,
          rr = 10 + p * (45 + (i % 3) * 8);
        X.strokeStyle = i % 2 ? 'rgba(255,255,220,' + fade + ')' : 'rgba(255,91,45,' + fade + ')';
        X.lineWidth = i % 3 === 0 ? 5 : 2;
        X.beginPath();
        X.moveTo(235 + Math.cos(a) * 10, 111 + Math.sin(a) * 10);
        X.lineTo(235 + Math.cos(a) * rr, 111 + Math.sin(a) * rr);
        X.stroke();
      }
      X.restore();
    }
    if (state.sparkFx) {
      let p = state.sparkFx.p,
        flash = Math.max(0, 1 - Math.abs(p - 0.32) / 0.24),
        fade = Math.min(1, p * 5) * Math.min(1, (1 - p) * 5),
        cx = state.sparkFx.actor === 'hero' ? (state.companion.active ? 49 : 69) : 111;
      X.save();
      X.globalCompositeOperation = 'lighter';
      X.fillStyle = 'rgba(255,255,225,' + flash * 0.72 + ')';
      X.fillRect(0, 0, W, H);
      for (let i = 0; i < 20; i++) {
        let a = (i * Math.PI) / 10 + p * 2,
          r = 18 + p * (95 + (i % 4) * 8);
        X.strokeStyle = i % 2 ? 'rgba(255,244,91,' + fade + ')' : 'rgba(120,238,255,' + fade + ')';
        X.lineWidth = i % 3 === 0 ? 5 : 2;
        X.beginPath();
        X.moveTo(cx + Math.cos(a) * 12, 102 + Math.sin(a) * 12);
        X.lineTo(cx + Math.cos(a) * r, 102 + Math.sin(a) * r);
        X.stroke();
      }
      X.globalCompositeOperation = 'source-over';
      X.globalAlpha = fade;
      X.fillStyle = '#120b28ed';
      X.fillRect(62, 54, 196, 53);
      X.strokeStyle = '#fff27a';
      X.lineWidth = 3;
      X.strokeRect(63.5, 55.5, 193, 50);
      X.textAlign = 'center';
      X.fillStyle = '#fff9b0';
      X.font = 'bold 22px monospace';
      X.fillText('閃 き！', 160, 79);
      X.fillStyle = '#c9f7ff';
      X.font = 'bold 14px monospace';
      X.fillText(state.sparkFx.name, 160, 99);
      X.restore();
    }
    if (state.battleFlash) {
      X.fillStyle = 'rgba(255,255,240,' + Math.min(0.7, state.battleFlash * 0.7) + ')';
      X.fillRect(0, 0, W, H);
    }
  }
  function drawBattle() {
    let e = state.enemy,
      visible = (state.enemies?.length ? state.enemies : [e]).filter(v => !v.defeated),
      others = visible.filter(v => v !== e),
      group = visible.length > 1,
      hit = state.enemyHitFx?.p || 0,
      targetScale = (group ? 0.7 : 1) * (state.enemyScale || 1) * (1 + Math.sin(Math.PI * hit) * 0.1),
      targetX = 235 + (state.enemyShift || 0) + (state.enemyMotion || 0) + Math.sin(Math.PI * hit) * 24;
    if (state.chapter === 3) drawSkyTowerBattleBackdrop();
    else if (state.chapter === 2) drawForestBattleBackdrop();
    else drawStoneBattleBackdrop();
    if (state.battleDim) {
      X.fillStyle = 'rgba(1,3,9,' + state.battleDim + ')';
      X.fillRect(0, 0, W, H);
    }
    drawBattleAuras();
    drawBattleHero();
    drawBattleMage();
    others.forEach((foe, i) => drawEnemy(foe, i ? 188 : 285, 112, visible.length > 2 ? 0.5 : 0.6));
    drawEnemy(e, targetX, 112, targetScale);
    if (group) {
      let bob = Math.sin(performance.now() / 220) * 3,
        ty = 46 + bob;
      X.save();
      X.fillStyle = '#ffe68a';
      X.strokeStyle = '#7a5410';
      X.lineWidth = 2;
      X.beginPath();
      X.moveTo(targetX - 9, ty);
      X.lineTo(targetX + 9, ty);
      X.lineTo(targetX, ty + 12);
      X.closePath();
      X.fill();
      X.stroke();
      X.strokeStyle = 'rgba(255,230,138,.75)';
      X.lineWidth = 2;
      X.beginPath();
      X.ellipse(targetX, 168, 26, 7, 0, 0, Math.PI * 2);
      X.stroke();
      X.restore();
    }
    if (state.attackFx > 0) drawSwordArc(state.attackFx);
    if (state.criticalFx) drawCriticalFx(state.criticalFx);
    if (state.skillFx) drawBattleEffectV2(state.skillFx);
    drawBattleMotionFx();
    X.fillStyle = '#080b13ee';
    X.fillRect(153, 10, 157, 31);
    X.strokeStyle = state.chapter === 3 ? '#66dff2' : state.chapter === 2 ? '#9f8ac9' : '#aab3c4';
    X.strokeRect(153, 10, 157, 31);
    X.fillStyle = '#fff';
    X.font = e.name.length > 7 ? '10px monospace' : '12px monospace';
    X.fillText(e.name + (group ? '　残' + visible.length : ''), 162, 28);
    X.fillStyle = '#371719';
    X.fillRect(162, 34, 138, 4);
    X.fillStyle = e.boss
      ? state.chapter === 3
        ? '#55e8ff'
        : state.chapter === 2
          ? '#bd5cff'
          : '#f65045'
      : '#69df79';
    X.fillRect(162, 34, (138 * e.hp) / e.maxHp, 4);
  }
  function drawStoneBattleBackdrop() {
    let g = X.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a0d19');
    g.addColorStop(0.65, '#24191d');
    g.addColorStop(1, '#05070b');
    X.fillStyle = g;
    X.fillRect(0, 0, W, H);
    X.fillStyle = '#232a38';
    for (let y = 48; y < 185; y += 26)
      for (let x = ((y / 26) % 2) * 16 - 16; x < W; x += 32) {
        X.fillRect(x, y, 30, 23);
        X.fillStyle = '#343b49';
        X.fillRect(x, y, 30, 2);
        X.fillStyle = '#232a38';
      }
    X.fillStyle = '#ffad32';
    X.fillRect(18, 75, 5, 22);
    X.fillRect(297, 75, 5, 22);
    X.fillStyle = '#ffe36a';
    X.fillRect(16, 68, 9, 12);
    X.fillRect(295, 68, 9, 12);
    X.fillStyle = '#e54827';
    X.fillRect(18, 65, 5, 8);
    X.fillRect(297, 65, 5, 8);
    X.fillStyle = '#080a0f';
    X.fillRect(0, 190, W, 50);
    X.fillStyle = '#343b4a';
    for (let x = 0; x < W; x += 32) X.fillRect(x, 185 + (x % 64 ? 3 : 0), 28, 7);
  }
  function drawForestBattleBackdrop() {
    let g = X.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#11102d');
    g.addColorStop(0.56, '#102b31');
    g.addColorStop(1, '#050912');
    X.fillStyle = g;
    X.fillRect(0, 0, W, H);
    X.fillStyle = '#d7dcff';
    X.beginPath();
    X.arc(265, 45, 29, 0, Math.PI * 2);
    X.fill();
    X.fillStyle = '#aaa8de';
    X.beginPath();
    X.arc(255, 39, 5, 0, Math.PI * 2);
    X.fill();
    X.beginPath();
    X.arc(273, 53, 7, 0, Math.PI * 2);
    X.fill();
    X.fillStyle = '#0a171f';
    for (let x = -12; x < 340; x += 38) {
      let h = 65 + (x % 76 ? 18 : 0);
      X.fillRect(x + 13, 122 - h, 12, h + 72);
      X.beginPath();
      X.moveTo(x - 16, 135 - h);
      X.lineTo(x + 19, 75 - h);
      X.lineTo(x + 48, 135 - h);
      X.fill();
    }
    X.fillStyle = '#14252c';
    X.fillRect(0, 165, W, 75);
    X.fillStyle = '#263b3d';
    for (let x = 0; x < W; x += 24) {
      X.fillRect(x, 180 + (x % 48 ? 4 : 0), 20, 5);
      X.fillStyle = '#314b47';
      X.fillRect(x + 3, 172 + (x % 72 ? 3 : 0), 3, 12);
      X.fillStyle = '#263b3d';
    }
    X.fillStyle = '#746eae';
    X.fillRect(0, 189, W, 3);
    for (let i = 0; i < 8; i++) {
      X.fillStyle = i % 2 ? '#a7edff' : '#fff1a6';
      X.fillRect(18 + i * 41, 72 + (i % 3) * 31, 2, 2);
    }
  }
  function drawSkyTowerBattleBackdrop() {
    let g = X.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#071631');
    g.addColorStop(0.5, '#235b82');
    g.addColorStop(1, '#0a1527');
    X.fillStyle = g;
    X.fillRect(0, 0, W, H);
    X.fillStyle = '#d7f7ff';
    for (let i = 0; i < 7; i++) {
      let x = (i * 57 + 18) % 340,
        y = 27 + (i % 3) * 28;
      X.fillRect(x, y, 18 + (i % 2) * 15, 4);
      X.fillRect(x + 6, y - 4, 22, 5);
    }
    X.fillStyle = '#172a48';
    for (let x = -20; x < 340; x += 52) {
      X.beginPath();
      X.moveTo(x, 169);
      X.lineTo(x + 24, 111 + (x % 104 ? 13 : 0));
      X.lineTo(x + 48, 169);
      X.fill();
      X.fillStyle = '#36536e';
      X.fillRect(x + 19, 102 + (x % 104 ? 13 : 0), 10, 70);
      X.fillStyle = '#172a48';
    }
    X.fillStyle = '#2b405b';
    X.fillRect(0, 169, W, 71);
    X.fillStyle = '#54718a';
    for (let x = 0; x < W; x += 30) {
      X.fillRect(x, 178 + (x % 60 ? 3 : 0), 27, 7);
      X.fillStyle = '#a98542';
      X.fillRect(x + 11, 186, 4, 23);
      X.fillStyle = '#54718a';
    }
    X.fillStyle = '#63e8f5';
    X.fillRect(0, 169, W, 3);
    for (let i = 0; i < 10; i++) {
      X.fillStyle = i % 2 ? '#d9ffff' : '#ffe8a1';
      X.fillRect(9 + i * 34, 52 + (i % 4) * 19, 2, 2);
    }
  }
  function drawSwordArc(p) {
    let power = state.criticalFx ? 1.35 : 1,
      alpha = Math.max(0, 1 - Math.abs(p - 0.72));
    X.save();
    X.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      X.globalAlpha = alpha * (0.82 - i * 0.2);
      X.strokeStyle = i === 0 ? '#ffffff' : i === 1 ? '#fff3a0' : '#ff8a32';
      X.lineWidth = (10 - i * 3) * power;
      X.beginPath();
      X.arc(184 - i * 3, 101 + i * 2, 56 + i * 9, -1.48 - i * 0.04, -0.02 + i * 0.05);
      X.stroke();
    }
    X.globalAlpha = alpha;
    for (let i = 0; i < 7; i++) {
      let a = -1.25 + i * 0.22,
        r = 72 + (i % 2) * 8;
      X.fillStyle = i % 2 ? '#fff' : '#ffc04c';
      X.fillRect(184 + Math.cos(a) * r, 101 + Math.sin(a) * r, 3 + (i % 3), 2);
    }
    X.restore();
  }
  function drawCriticalFx(fx) {
    let p = Math.max(0, Math.min(1, fx.p)),
      cx = 235,
      cy = 110;
    X.save();
    X.globalCompositeOperation = 'lighter';
    if (fx.phase === 'charge') {
      let pulse = 0.35 + p * 0.65,
        t = performance.now() / 130;
      X.fillStyle = 'rgba(255,176,45,' + p * 0.08 + ')';
      X.fillRect(0, 0, W, H);
      for (let i = 0; i < 12; i++) {
        let a = i * 2.399 + t,
          rr = 20 + (1 - p) * 70 + (i % 3) * 9,
          x = 67 + Math.cos(a) * rr,
          y = 122 + Math.sin(a) * rr * 0.72;
        X.fillStyle = i % 2 ? '#fff8b8' : '#ff9f32';
        X.fillRect(x, y, 2 + (i % 3), 2 + (i % 3));
      }
      X.strokeStyle = 'rgba(255,235,125,' + pulse + ')';
      X.lineWidth = 3;
      X.beginPath();
      X.arc(67, 122, 20 + p * 28, 0, Math.PI * 2);
      X.stroke();
    } else {
      let fade = fx.phase === 'impact' ? 1 - p * 0.25 : 1 - p,
        burst = fx.phase === 'impact' ? p : 1;
      X.fillStyle = 'rgba(255,245,196,' + (fx.phase === 'impact' ? (1 - p) * 0.55 : 0) + ')';
      X.fillRect(0, 0, W, H);
      for (let i = 0; i < 14; i++) {
        let a = (i * Math.PI) / 7 - 0.35,
          inner = 12 + burst * 10,
          outer = 35 + burst * (65 + (i % 3) * 13);
        X.strokeStyle = i % 2 ? 'rgba(255,255,235,' + fade + ')' : 'rgba(255,166,45,' + fade * 0.9 + ')';
        X.lineWidth = i % 3 === 0 ? 5 : 2;
        X.beginPath();
        X.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
        X.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
        X.stroke();
      }
      X.strokeStyle = 'rgba(255,255,255,' + fade + ')';
      X.lineWidth = 11;
      X.beginPath();
      X.moveTo(cx - 51, cy - 55);
      X.lineTo(cx + 38, cy + 48);
      X.moveTo(cx + 40, cy - 50);
      X.lineTo(cx - 41, cy + 52);
      X.stroke();
      X.strokeStyle = 'rgba(255,182,43,' + fade * 0.9 + ')';
      X.lineWidth = 4;
      X.stroke();
      X.globalCompositeOperation = 'source-over';
      X.globalAlpha = fade;
      X.fillStyle = '#260d04e8';
      X.fillRect(179, 49, 112, 31);
      X.strokeStyle = '#ffe38a';
      X.strokeRect(179.5, 49.5, 111, 30);
      X.fillStyle = '#fff6c9';
      X.font = 'bold 19px monospace';
      X.textAlign = 'center';
      X.fillText('会 心！', 235, 71);
    }
    X.restore();
  }
  function drawTechniqueAccent(fx) {
    let p = fx.p;
    X.save();
    X.globalCompositeOperation = 'lighter';
    if (fx.type === 'fire') {
      let rush = Math.max(0, Math.min(1, (p - 0.25) / 0.35)),
        fade = Math.max(0, Math.min(1, (0.88 - p) / 0.18));
      X.globalAlpha = rush * fade;
      for (let i = 0; i < 9; i++) {
        let y = 58 + i * 15 + (i % 2) * 6;
        X.strokeStyle = i % 2 ? '#fff0a0' : '#ff6329';
        X.lineWidth = 2 + (i % 3);
        X.beginPath();
        X.moveTo(28 - rush * 18, y + 34);
        X.lineTo(128 + rush * 156, y - 24);
        X.stroke();
      }
      if (p > 0.5) {
        let q = Math.min(1, (p - 0.5) / 0.25);
        for (let i = 0; i < 10; i++) {
          let a = i * 0.628 + p * 3,
            r = 20 + q * (32 + (i % 3) * 9);
          X.fillStyle = i % 2 ? '#fff7b8' : '#ff6b28';
          X.fillRect(232 + Math.cos(a) * r, 116 + Math.sin(a) * r, 3, 3);
        }
      }
    } else {
      let glow = Math.sin(Math.PI * p);
      X.globalAlpha = glow * 0.75;
      for (let i = 0; i < 6; i++) {
        let x = 38 + i * 13,
          y = 186 - ((p * 110 + i * 23) % 125);
        X.fillStyle = i % 2 ? '#dcffff' : '#8effcf';
        X.fillRect(x, y, 2, 16);
        X.fillRect(x - 5, y + 7, 12, 2);
      }
    }
    X.restore();
  }
  function drawMoonFx(fx) {
    let p = fx.p,
      healing = fx.type === 'moonheal',
      glow = Math.sin(Math.PI * p),
      q = Math.max(0, Math.min(1, (p - 0.2) / 0.5)),
      cx = healing ? 72 : 111;
    X.save();
    X.globalCompositeOperation = 'lighter';
    X.fillStyle = 'rgba(95,140,255,' + glow * 0.12 + ')';
    X.fillRect(0, 0, W, H);
    for (let i = 0; i < 12; i++) {
      let a = i * 0.82 + p * 5,
        rr = 12 + (i % 4) * 8 + p * 28,
        x = cx + Math.cos(a) * rr,
        y = 112 + Math.sin(a) * rr * 0.55,
        sz = 2 + (i % 3);
      X.fillStyle = i % 2 ? '#baf7ff' : '#d5b8ff';
      X.fillRect(x, y, sz, sz);
    }
    if (q > 0 && !healing) {
      X.globalAlpha = Math.min(1, q * 2) * Math.min(1, (1 - p) * 4);
      X.strokeStyle = '#d9fbff';
      X.lineWidth = 9;
      X.beginPath();
      X.moveTo(126, 115);
      X.quadraticCurveTo(173, 55, 233, 91);
      X.stroke();
      X.strokeStyle = '#8c7cff';
      X.lineWidth = 18;
      X.globalAlpha *= 0.45;
      X.beginPath();
      X.moveTo(124, 122);
      X.quadraticCurveTo(179, 54, 240, 91);
      X.stroke();
      X.globalAlpha = 1;
      let r = 12 + q * 45;
      X.strokeStyle = 'rgba(190,245,255,' + (1 - q * 0.65) + ')';
      X.lineWidth = 5;
      X.beginPath();
      X.arc(235, 108, r, -1.2, 4.6);
      X.stroke();
    }
    if (healing) {
      for (let i = 0; i < 3; i++) {
        X.strokeStyle = 'rgba(155,250,255,' + glow * (0.8 - i * 0.2) + ')';
        X.lineWidth = 4 - i;
        X.beginPath();
        X.ellipse(72, 163, 20 + p * 28 + i * 8, 7 + p * 5, 0, 0, Math.PI * 2);
        X.stroke();
      }
    }
    X.globalCompositeOperation = 'source-over';
    X.globalAlpha = Math.min(1, p * 7) * Math.min(1, (1 - p) * 5);
    X.fillStyle = '#09142add';
    X.fillRect(healing ? 82 : 91, 47, healing ? 156 : 138, 28);
    X.strokeStyle = '#9fe8ff';
    X.strokeRect(healing ? 82.5 : 91.5, 47.5, healing ? 155 : 137, 27);
    X.fillStyle = '#eafcff';
    X.font = 'bold 16px monospace';
    X.textAlign = 'center';
    X.fillText(healing ? '月 雫 の 癒 し' : '月 光 弾', 160, 67);
    X.textAlign = 'left';
    X.restore();
  }
  function drawSkillFx(fx) {
    let p = fx.p;
    X.save();
    X.globalCompositeOperation = 'lighter';
    if (fx.type === 'fire') {
      let charge = Math.min(1, p / 0.32),
        impact = Math.max(0, Math.min(1, (p - 0.36) / 0.64)),
        flash = Math.max(0, 1 - Math.abs(p - 0.56) / 0.13);
      X.fillStyle = 'rgba(255,55,8,' + flash * 0.25 + ')';
      X.fillRect(0, 0, W, H);
      if (p < 0.48) {
        for (let i = 0; i < 3; i++) {
          X.strokeStyle = 'rgba(255,' + (120 + i * 45) + ',30,' + (1 - p * 1.6) + ')';
          X.lineWidth = 5 - i;
          X.beginPath();
          X.arc(70, 145, 18 + charge * 35 + i * 7, -1.5, 4.5);
          X.stroke();
        }
      }
      let q = Math.max(0, Math.min(1, (p - 0.22) / 0.46));
      if (q > 0 && p < 0.82) {
        X.globalAlpha = Math.min(1, q * 2) * (1 - Math.max(0, (p - 0.62) / 0.2));
        X.strokeStyle = '#fff7a0';
        X.lineWidth = 14 - 7 * q;
        X.beginPath();
        X.moveTo(105, 172);
        X.quadraticCurveTo(176, 92, 278, 58);
        X.stroke();
        X.strokeStyle = '#ff4d12';
        X.lineWidth = 26 - 13 * q;
        X.globalAlpha *= 0.58;
        X.beginPath();
        X.moveTo(96, 180);
        X.quadraticCurveTo(174, 96, 283, 52);
        X.stroke();
        X.globalAlpha = 1;
      }
      if (impact > 0) {
        let r = 18 + impact * 72;
        X.fillStyle = 'rgba(255,85,10,' + (1 - impact) * 0.62 + ')';
        X.beginPath();
        X.arc(232, 120, r, 0, Math.PI * 2);
        X.fill();
        X.strokeStyle = 'rgba(255,235,100,' + (1 - impact) + ')';
        X.lineWidth = 7;
        X.beginPath();
        X.arc(232, 120, r * 0.72, 0, Math.PI * 2);
        X.stroke();
        for (let i = 0; i < 16; i++) {
          let a = (i * Math.PI) / 8 + p * 2.7,
            rr = 18 + impact * (32 + (i % 4) * 13),
            sz = 2 + (i % 3);
          X.fillStyle = i % 2 ? '#ffcb42' : '#ff4b16';
          X.fillRect(232 + Math.cos(a) * rr - sz / 2, 120 + Math.sin(a) * rr - sz / 2, sz, sz);
        }
      }
      X.globalCompositeOperation = 'source-over';
      X.globalAlpha = Math.min(1, p * 7) * Math.min(1, (1 - p) * 5);
      X.fillStyle = '#160903dd';
      X.fillRect(82, 47, 156, 28);
      X.strokeStyle = '#ff7c28';
      X.strokeRect(82.5, 47.5, 155, 27);
      X.fillStyle = '#fff0a6';
      X.font = 'bold 17px monospace';
      X.textAlign = 'center';
      X.fillText('星 火 斬 り', 160, 67);
    } else {
      let glow = Math.sin(Math.PI * p);
      X.fillStyle = 'rgba(80,255,220,' + glow * 0.12 + ')';
      X.fillRect(0, 0, W, H);
      for (let i = 0; i < 3; i++) {
        let rr = 20 + p * 45 + i * 9;
        X.strokeStyle = 'rgba(' + (120 + i * 30) + ',255,225,' + glow * (0.8 - i * 0.18) + ')';
        X.lineWidth = 4 - i;
        X.beginPath();
        X.ellipse(69, 167, rr, rr * 0.3, 0, 0, Math.PI * 2);
        X.stroke();
      }
      for (let i = 0; i < 14; i++) {
        let a = i * 2.399,
          rr = 14 + (i % 5) * 7,
          x = 69 + Math.cos(a) * rr,
          y = 174 - ((p * (70 + i * 3) + i * 11) % 105),
          sz = 2 + (i % 3);
        X.fillStyle = i % 2 ? '#baffff' : '#fff6a5';
        X.fillRect(x - sz / 2, y - sz / 2, sz, sz);
        if (i % 3 === 0) {
          X.fillRect(x - 4, y, 9, 1);
          X.fillRect(x, y - 4, 1, 9);
        }
      }
      X.globalCompositeOperation = 'source-over';
      X.globalAlpha = Math.min(1, p * 6) * Math.min(1, (1 - p) * 5);
      X.fillStyle = '#061a1bdd';
      X.fillRect(88, 47, 144, 28);
      X.strokeStyle = '#8fffe7';
      X.strokeRect(88.5, 47.5, 143, 27);
      X.fillStyle = '#eaffff';
      X.font = 'bold 16px monospace';
      X.textAlign = 'center';
      X.fillText('光 の 癒 し', 160, 67);
    }
    X.textAlign = 'left';
    X.globalAlpha = 1;
    X.restore();
  }
  function drawEnemy(e, x, y, scale = 1) {
    if (enemyReady[e.key]) {
      let cut = enemyCuts[e.key],
        art = Number(e.art) || 1,
        h = (e.boss ? 174 : e.key === 'bat' ? 124 : 128) * scale * art,
        w = (h * cut.width) / cut.height,
        maxW = (e.boss ? 145 : 150) * scale * art;
      if (w > maxW) {
        h *= maxW / w;
        w = maxW;
      }
      let bottom = e.boss ? 192 : e.key === 'bat' ? 181 : 188;
      X.save();
      X.fillStyle = '#0009';
      X.beginPath();
      X.ellipse(x, bottom + 1, w * 0.4, 8 * scale, 0, 0, Math.PI * 2);
      X.fill();
      X.imageSmoothingEnabled = true;
      X.drawImage(cut, x - w / 2, bottom - h, w, h);
      X.imageSmoothingEnabled = false;
      X.restore();
      return;
    }
    X.save();
    X.translate(x, y);
    X.scale(scale, scale);
    X.fillStyle = '#0008';
    X.beginPath();
    X.ellipse(0, 48, e.boss ? 52 : 42, 10, 0, 0, Math.PI * 2);
    X.fill();
    X.fillStyle = e.key === 'bat' ? '#7753a8' : e.key === 'moss' ? '#74ce68' : '#e25238';
    X.beginPath();
    X.arc(0, 0, e.boss ? 48 : 35, 0, Math.PI * 2);
    X.fill();
    X.fillStyle = '#fff0a8';
    X.fillRect(-17, -10, 11, 8);
    X.fillRect(7, -10, 11, 8);
    X.restore();
  }
  function foeAnchors() {
    let slots = foeSlots();
    return slots.length ? slots.map(s => [s.x, s.y]) : [[235, 112]];
  }
  function drawSkillLabel(fx) {
    let name = fx.label || 'ワ ザ',
      w = Math.max(120, name.length * 17 + 34);
    X.save();
    X.globalAlpha = Math.min(1, fx.p * 8) * Math.min(1, (1 - fx.p) * 7);
    X.fillStyle = '#07101fe8';
    X.fillRect(160 - w / 2, 47, w, 28);
    X.strokeStyle =
      fx.type === 'pierce'
        ? '#ffd27a'
        : fx.type === 'whirl'
          ? '#b8f7ff'
          : fx.type === 'starshower'
            ? '#c6b8ff'
            : '#ffe9a8';
    X.strokeRect(160 - w / 2 + 0.5, 47.5, w - 1, 27);
    X.fillStyle = '#fff';
    X.font = 'bold 16px monospace';
    X.textAlign = 'center';
    X.fillText(name, 160, 67);
    X.restore();
  }
  function drawComboFx(fx) {
    let p = fx.p,
      t = performance.now() / 1000;
    if (fx.phase === 'dash') {
      for (let i = 0; i < 7; i++) {
        X.strokeStyle = i % 2 ? 'rgba(200,240,255,.55)' : 'rgba(255,255,225,.4)';
        X.lineWidth = 1 + (i % 3);
        X.beginPath();
        X.moveTo(40 + i * 14, 66 + i * 13);
        X.lineTo(228 - i * 4, 60 + i * 12);
        X.stroke();
      }
    }
    for (let i = 0; i <= fx.hit; i++) {
      let age = fx.hit - i + (fx.phase === 'dash' ? fx.local * 0.6 : 1),
        life = i === fx.hit && fx.phase === 'dash' ? Math.min(1, fx.local * 2.2) : Math.max(0, 1 - age / 2.1);
      if (life <= 0) continue;
      let ang = -1 + (i % 2 ? 2.05 : 0) + i * 0.16;
      X.save();
      X.translate(235, 110);
      X.rotate(ang);
      X.strokeStyle = 'rgba(255,255,238,' + life + ')';
      X.lineWidth = 9 - Math.min(4, i * 2);
      X.beginPath();
      X.arc(0, 0, 44 + i * 6, -1.12, 1.12);
      X.stroke();
      X.strokeStyle = 'rgba(126,226,255,' + life * 0.45 + ')';
      X.lineWidth = 20;
      X.beginPath();
      X.arc(0, 0, 53 + i * 6, -1, 1);
      X.stroke();
      X.restore();
    }
    if (fx.phase === 'impact' || fx.phase === 'recoil') {
      let life = fx.phase === 'impact' ? 1 : 0.4;
      for (let i = 0; i < 14; i++) {
        let a = i * 2.399 + t * 3,
          r = 14 + (i % 5) * 10;
        X.fillStyle = i % 2 ? '#fff6bd' : '#a9e8ff';
        X.globalAlpha = life;
        X.fillRect(235 + Math.cos(a) * r, 110 + Math.sin(a) * r, 2 + (i % 3), 2 + (i % 3));
      }
      X.globalAlpha = 1;
    }
  }
  function drawWhirlFx(fx) {
    let p = fx.p,
      t = performance.now() / 1000,
      spin = fx.phase === 'spin' || fx.phase === 'burst';
    if (fx.phase === 'leap' || spin) {
      for (let i = 0; i < 9; i++) {
        X.strokeStyle = i % 2 ? 'rgba(180,247,255,.5)' : 'rgba(255,255,230,.35)';
        X.lineWidth = 1 + (i % 3);
        X.beginPath();
        X.moveTo(120, 52 + i * 13);
        X.lineTo(316, 46 + i * 13);
        X.stroke();
      }
    }
    if (spin) {
      let q = fx.phase === 'burst' ? 1 : (p - 0.28) / 0.38;
      for (let k = 0; k < 3; k++) {
        let r = 18 + ((q * 1.35 + k * 0.33) % 1) * 118,
          life = Math.max(0, 1 - ((q * 1.35 + k * 0.33) % 1));
        X.strokeStyle = k % 2 ? 'rgba(255,255,235,' + life + ')' : 'rgba(126,226,255,' + life * 0.8 + ')';
        X.lineWidth = k % 2 ? 6 : 11;
        X.beginPath();
        X.ellipse(228, 112, r, r * 0.46, 0, 0, Math.PI * 2);
        X.stroke();
      }
      for (let i = 0; i < 5; i++) {
        let a = t * 11 + i * 1.26,
          life = 0.55;
        X.strokeStyle = 'rgba(255,255,240,' + life + ')';
        X.lineWidth = 4;
        X.beginPath();
        X.moveTo(228 + Math.cos(a) * 24, 112 + Math.sin(a) * 11);
        X.lineTo(228 + Math.cos(a) * 104, 112 + Math.sin(a) * 46);
        X.stroke();
      }
      foeAnchors().forEach(([x, y], i) => {
        let a = t * 8 + i * 2.1;
        X.strokeStyle = 'rgba(210,250,255,.8)';
        X.lineWidth = 5;
        X.beginPath();
        X.arc(x, y, 30, a, a + 2.4);
        X.stroke();
      });
    }
    if (fx.phase === 'burst') {
      let life = 1 - (p - 0.66) / 0.1;
      for (let i = 0; i < 26; i++) {
        let a = i * 2.399,
          r = 26 + (i % 7) * 13;
        X.fillStyle = i % 2 ? '#fff3ac' : '#b6f2ff';
        X.globalAlpha = Math.max(0, life);
        X.fillRect(228 + Math.cos(a) * r, 112 + Math.sin(a) * r * 0.6, 2 + (i % 3), 2 + (i % 3));
      }
      X.globalAlpha = 1;
    }
  }
  function drawPierceFx(fx) {
    let p = fx.p,
      t = performance.now() / 1000;
    if (fx.phase === 'charge' || fx.phase === 'silence') {
      let hx = 65 + (state.heroLunge || 0),
        hy = 112 + (state.heroLift || 0);
      for (let i = 0; i < 18; i++) {
        let a = i * 2.399 + t * 2.4,
          r = (fx.phase === 'charge' ? 46 * (1 - p / 0.3) : 9) + (i % 5) * 4;
        X.fillStyle = i % 3 ? '#ffd479' : '#fff6cd';
        X.fillRect(hx + Math.cos(a) * r, hy + Math.sin(a) * r * 0.8, 2 + (i % 3), 2 + (i % 3));
      }
    }
    if (fx.phase === 'thrust') {
      X.strokeStyle = 'rgba(255,236,168,.85)';
      X.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        X.beginPath();
        X.moveTo(60 + i * 12, 74 + i * 14);
        X.lineTo(232, 96 + i * 6);
        X.stroke();
      }
    }
    if (fx.phase === 'break' || fx.phase === 'linger') {
      let life = fx.phase === 'break' ? 1 : Math.max(0, 1 - (p - 0.66) / 0.3);
      X.strokeStyle = 'rgba(255,255,236,' + life + ')';
      X.lineWidth = fx.phase === 'break' ? 14 : 5;
      X.beginPath();
      X.moveTo(238, 42);
      X.lineTo(230, 182);
      X.stroke();
      for (let i = 0; i < 9; i++) {
        let a = -1.3 + i * 0.33,
          len = 26 + (i % 4) * 16;
        X.strokeStyle = i % 2 ? 'rgba(255,206,96,' + life + ')' : 'rgba(255,255,230,' + life * 0.8 + ')';
        X.lineWidth = i % 3 === 0 ? 4 : 2;
        X.beginPath();
        X.moveTo(235, 110);
        X.lineTo(235 + Math.cos(a) * len, 110 + Math.sin(a) * len);
        X.stroke();
      }
      for (let i = 0; i < 20; i++) {
        let a = i * 2.399,
          r = 18 + (i % 6) * 11 + (fx.phase === 'linger' ? (p - 0.66) * 90 : 0);
        X.fillStyle = i % 2 ? '#ffd166' : '#fff3c4';
        X.globalAlpha = life;
        X.fillRect(235 + Math.cos(a) * r, 110 + Math.sin(a) * r, 2 + (i % 4), 2 + (i % 4));
      }
      X.globalAlpha = 1;
    }
  }
  function drawShowerFx(fx) {
    let p = fx.p,
      t = performance.now() / 1000,
      anchors = foeAnchors();
    X.fillStyle = 'rgba(96,120,255,' + Math.sin(Math.PI * p) * (fx.big ? 0.16 : 0.1) + ')';
    X.fillRect(0, 0, W, H);
    for (let i = 0; i < 12; i++) {
      let a = i * 0.82 + p * 4,
        rr = 12 + (i % 4) * 8 + p * 24;
      X.fillStyle = i % 2 ? '#cdf3ff' : '#cbb6ff';
      X.fillRect(111 + Math.cos(a) * rr, 110 + Math.sin(a) * rr * 0.55, 2 + (i % 3), 2 + (i % 3));
    }
    if (fx.phase === 'rain' || fx.phase === 'burst' || (fx.phase === 'fade' && p < 0.9)) {
      let count = fx.big ? 26 : 18;
      for (let i = 0; i < count; i++) {
        let seed = ((i * 97) % 37) / 37,
          col = anchors[i % anchors.length],
          cyc = ((p - 0.26) * (fx.big ? 2.6 : 2.2) + seed) % 1,
          x = col[0] + (((i * 53) % 61) / 61 - 0.5) * (fx.big ? 86 : 66),
          y = -24 + cyc * 205;
        X.strokeStyle = i % 2 ? 'rgba(214,246,255,.95)' : 'rgba(178,150,255,.9)';
        X.lineWidth = i % 3 === 0 ? 3 : 2;
        X.beginPath();
        X.moveTo(x, y);
        X.lineTo(x - 7, y - 22 - (i % 4) * 7);
        X.stroke();
        if (cyc > 0.72) {
          let bl = (1 - cyc) / 0.28;
          X.fillStyle = 'rgba(255,255,240,' + bl + ')';
          X.fillRect(x - 3, col[1] + 14, 6, 3);
        }
      }
    }
    anchors.forEach(([x, y], i) => {
      let pulse = Math.abs(Math.sin(t * 7 + i));
      X.strokeStyle = 'rgba(190,236,255,' + Math.sin(Math.PI * p) * 0.7 + ')';
      X.lineWidth = 3;
      X.beginPath();
      X.ellipse(x, y + 62, 26 + pulse * 6, 8, 0, 0, Math.PI * 2);
      X.stroke();
    });
    if (fx.phase === 'burst') {
      let life = 1 - (p - 0.74) / 0.1;
      for (let i = 0; i < 28; i++) {
        let a = i * 2.399,
          r = 22 + (i % 7) * 14;
        X.fillStyle = i % 2 ? '#e6f8ff' : '#b39cff';
        X.globalAlpha = Math.max(0, life);
        X.fillRect(235 + Math.cos(a) * r, 112 + Math.sin(a) * r, 2 + (i % 3), 3 + (i % 3));
      }
      X.globalAlpha = 1;
    }
  }
  const EXTRA_FX = {
    slashCombo: drawComboFx,
    whirl: drawWhirlFx,
    pierce: drawPierceFx,
    starshower: drawShowerFx,
  };
  function drawBattleEffectV2(fx) {
    if (EXTRA_FX[fx.type]) {
      X.save();
      X.globalCompositeOperation = 'lighter';
      EXTRA_FX[fx.type](fx);
      X.restore();
      drawSkillLabel(fx);
      return;
    }
    let p = fx.p,
      phase = fx.phase,
      t = performance.now() / 1000,
      heal = fx.type === 'heal' || fx.type === 'moonheal' || fx.type === 'veil';
    X.save();
    X.globalCompositeOperation = 'lighter';
    if (fx.type === 'fire') {
      let hx = 65 + (state.heroLunge || 0),
        hy = 118 + (state.heroLift || 0);
      if (phase === 'charge' || phase === 'silence')
        for (let i = 0; i < 22; i++) {
          let a = i * 2.399 + t * 2,
            r = (phase === 'charge' ? 55 * (1 - p / 0.175) : 8) + (i % 5) * 5,
            x = hx + Math.cos(a) * r,
            y = hy + Math.sin(a) * r * 0.7;
          X.fillStyle = i % 3 ? '#ff7a25' : '#ffe689';
          X.fillRect(x, y, 2 + (i % 3), 2 + (i % 3));
        }
      if (phase === 'dash') {
        for (let i = 0; i < 8; i++) {
          X.strokeStyle = i % 2 ? 'rgba(255,198,66,.8)' : 'rgba(255,70,18,.65)';
          X.lineWidth = 2 + (i % 3);
          X.beginPath();
          X.moveTo(10 + i * 7, 70 + i * 14);
          X.lineTo(250 - i * 5, 55 + i * 10);
          X.stroke();
        }
      }
      if (phase === 'pass') {
        X.strokeStyle = 'rgba(255,245,210,.8)';
        X.lineWidth = 2;
        X.beginPath();
        X.moveTo(188, 63);
        X.lineTo(282, 153);
        X.stroke();
      }
      if (phase === 'impact' || phase === 'pillar' || phase === 'linger') {
        let life = phase === 'linger' ? Math.max(0, 1 - (p - 0.6) / 0.275) : 1;
        X.strokeStyle = 'rgba(255,255,240,' + life + ')';
        X.lineWidth = phase === 'impact' ? 13 : 5;
        X.beginPath();
        X.moveTo(190, 55);
        X.lineTo(282, 166);
        X.stroke();
        if (phase !== 'impact') {
          for (let i = 0; i < 9; i++) {
            let w = 9 + (i % 3) * 7,
              top = 38 + (i % 4) * 11 + Math.sin(t * 12 + i) * 8;
            X.fillStyle =
              i % 3 === 0
                ? 'rgba(255,246,118,' + life + ')'
                : i % 3 === 1
                  ? 'rgba(255,115,22,' + life + ')'
                  : 'rgba(215,38,9,' + life * 0.8 + ')';
            X.beginPath();
            X.moveTo(235 - w, 182);
            X.quadraticCurveTo(225 + i * 3, 105, 235 + (i - 4) * 5, top);
            X.quadraticCurveTo(250 + i * 2, 115, 235 + w, 182);
            X.fill();
          }
        }
        for (let i = 0; i < 24; i++) {
          let a = i * 2.399 + t,
            r = 20 + (i % 7) * 9 + (phase === 'linger' ? (p - 0.6) * 120 : 0);
          X.fillStyle = i % 2 ? '#ffbd35' : '#fff09a';
          X.globalAlpha = life;
          X.fillRect(235 + Math.cos(a) * r, 120 + Math.sin(a) * r, 2 + (i % 3), 2 + (i % 3));
        }
      }
    } else if (heal) {
      let life = Math.sin(Math.PI * p),
        centers = fx.type === 'veil' ? [69, 111] : [fx.type === 'moonheal' ? 111 : 69];
      centers.forEach(cx => {
        for (let i = 0; i < 3; i++) {
          X.strokeStyle = i % 2 ? 'rgba(128,255,193,' + life + ')' : 'rgba(255,228,118,' + life + ')';
          X.lineWidth = 4 - i;
          X.beginPath();
          X.ellipse(cx, 181, 22 + i * 8, 7 + i * 2, 0, 0, Math.PI * 2);
          X.stroke();
        }
        if (phase === 'pillar') {
          let g = X.createLinearGradient(cx - 25, 55, cx + 25, 185);
          g.addColorStop(0, 'rgba(255,250,180,0)');
          g.addColorStop(0.5, 'rgba(125,255,189,.42)');
          g.addColorStop(1, 'rgba(255,235,130,0)');
          X.fillStyle = g;
          X.fillRect(cx - 28, 52, 56, 133);
        }
        for (let i = 0; i < 18; i++) {
          let y = 183 - ((p * 120 + i * 17) % 135),
            x = cx + Math.sin(i * 2.1) * 28;
          X.fillStyle = i % 2 ? '#a6ffd4' : '#ffe98a';
          X.fillRect(x, y, 2 + (i % 3), 4 + (i % 4));
        }
      });
    } else {
      let cx = 111,
        cy = 92,
        life = Math.sin(Math.PI * p);
      X.strokeStyle = 'rgba(158,220,255,' + life + ')';
      X.lineWidth = 3;
      X.beginPath();
      X.ellipse(cx, 184, 28, 8, t, 0, Math.PI * 2);
      X.stroke();
      for (let i = 0; i < 14; i++) {
        let a = i * 2.399 + t * 2,
          r = 14 + (i % 4) * 9;
        X.fillStyle = i % 2 ? '#c8fbff' : '#b8a5ff';
        X.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2 + (i % 3), 2 + (i % 3));
      }
      if (phase === 'orb') {
        let pulse = 13 + Math.sin(t * 18) * 4;
        X.fillStyle = 'rgba(210,252,255,.85)';
        X.beginPath();
        X.arc(cx + 25, 95, pulse, 0, Math.PI * 2);
        X.fill();
      }
      if (phase === 'projectile') {
        let q = (p - 0.41) / 0.13,
          x = 136 + q * 99;
        for (let i = 4; i >= 0; i--) {
          X.fillStyle = 'rgba(168,225,255,' + (0.2 + i * 0.13) + ')';
          X.beginPath();
          X.arc(x - i * 11, 102, 4 + i, 0, Math.PI * 2);
          X.fill();
        }
      }
      if (phase === 'impact' || phase === 'crescent' || phase === 'fade') {
        let fade = phase === 'fade' ? Math.max(0, 1 - (p - 0.72) / 0.28) : 1;
        X.strokeStyle = 'rgba(225,255,255,' + fade + ')';
        X.lineWidth = 11;
        X.beginPath();
        X.arc(235, 110, 52, -1.2, 1.65);
        X.stroke();
        X.strokeStyle = 'rgba(121,133,255,' + fade * 0.65 + ')';
        X.lineWidth = 21;
        X.beginPath();
        X.arc(235, 110, 61, -1.15, 1.6);
        X.stroke();
        for (let i = 0; i < 18; i++) {
          let a = i * 2.399,
            r = 22 + (i % 6) * 10;
          X.fillStyle = i % 2 ? '#d9ffff' : '#ac9cff';
          X.fillRect(235 + Math.cos(a) * r, 110 + Math.sin(a) * r, 2 + (i % 3), 2 + (i % 3));
        }
      }
    }
    X.globalCompositeOperation = 'source-over';
    X.globalAlpha = Math.min(1, p * 8) * Math.min(1, (1 - p) * 7);
    let name =
        fx.label ||
        (fx.type === 'fire'
          ? '星 火 斬 り'
          : fx.type === 'heal'
            ? '光 の 癒 し'
            : fx.type === 'moonheal'
              ? '月 雫 の 癒 し'
              : '月 光 弾'),
      bw = Math.max(120, name.length * 17 + 34);
    X.fillStyle = '#07101fe8';
    X.fillRect(160 - bw / 2, 47, bw, 28);
    X.strokeStyle = fx.type === 'fire' ? '#ff8d35' : heal ? '#9dffc8' : '#a6eaff';
    X.strokeRect(160 - bw / 2 + 0.5, 47.5, bw - 1, 27);
    X.fillStyle = '#fff';
    X.font = 'bold 16px monospace';
    X.textAlign = 'center';
    X.fillText(name, 160, 67);
    X.restore();
  }
  function slash() {
    let n = 0,
      iv = setInterval(() => {
        draw();
        X.strokeStyle = '#fff5a8';
        X.lineWidth = 5;
        X.beginPath();
        X.moveTo(175 + n * 8, 55 + n * 8);
        X.lineTo(225 + n * 5, 105 + n * 5);
        X.stroke();
        if (++n > 3) clearInterval(iv);
      }, 35);
  }
  function flashEnemy() {
    wrap.classList.remove('flash');
    void wrap.offsetWidth;
    wrap.classList.add('flash');
    let started = performance.now();
    function frame(now) {
      let p = Math.min(1, (now - started) / 260);
      state.enemyHitFx = { p };
      draw();
      if (p < 1) requestAnimationFrame(frame);
      else {
        state.enemyHitFx = null;
        draw();
      }
    }
    requestAnimationFrame(frame);
  }
  function floatText(t, x, y, c, size = 1) {
    let start = performance.now();
    function f(now) {
      let p = Math.min(1, (now - start) / 560),
        pop = p < 0.16 ? 0.6 + (p / 0.16) * 0.8 : p < 0.34 ? 1.4 - ((p - 0.16) / 0.18) * 0.4 : 1;
      draw();
      X.save();
      X.translate(x, y - p * 24);
      X.scale(pop * size, pop * size);
      X.font = 'bold 20px monospace';
      X.fillStyle = c;
      X.strokeStyle = '#080914';
      X.lineWidth = 4;
      X.textAlign = 'center';
      X.strokeText(t, 0, 0);
      X.fillText(t, 0, 0);
      X.restore();
      if (p < 1) requestAnimationFrame(f);
    }
    requestAnimationFrame(f);
  }
  function defeatEffect(boss) {
    return new Promise(done => {
      let started = performance.now(),
        duration = boss ? 1050 : 620;
      sfx(boss ? 'bossDefeat' : 'defeat');
      function frame(now) {
        let p = Math.min(1, (now - started) / duration),
          fade = 1 - p;
        draw();
        X.save();
        X.globalCompositeOperation = 'lighter';
        X.fillStyle = 'rgba(255,255,225,' + Math.max(0, 1 - p * 4) * 0.8 + ')';
        X.fillRect(0, 0, W, H);
        for (let i = 0; i < (boss ? 32 : 18); i++) {
          let a = i * 2.399,
            rr = 10 + p * (55 + (i % 7) * 8),
            x = 235 + Math.cos(a) * rr,
            y = 112 + Math.sin(a) * rr,
            sz = 2 + (i % 4);
          X.fillStyle = i % 3 === 0 ? '#fff6a0' : i % 3 === 1 ? '#ff693b' : '#b7f4ff';
          X.globalAlpha = fade;
          X.fillRect(x - sz / 2, y - sz / 2, sz, sz * 2);
        }
        X.strokeStyle = 'rgba(255,243,130,' + fade + ')';
        X.lineWidth = 6;
        X.beginPath();
        X.arc(235, 112, 18 + p * 92, 0, Math.PI * 2);
        X.stroke();
        X.restore();
        if (p < 1) requestAnimationFrame(frame);
        else {
          draw();
          done();
        }
      }
      requestAnimationFrame(frame);
    });
  }
  let lastIdleDraw = 0;
  requestAnimationFrame(battleIdleLoop);
  function battleIdleLoop(now) {
    if (state?.mode === 'battle' && !state.busy && now - lastIdleDraw > 55) {
      lastIdleDraw = now;
      draw();
    }
    requestAnimationFrame(battleIdleLoop);
  }
  document.addEventListener('pointerdown', ensureAudio, { passive: true });
  C.addEventListener('click', e => {
    if (state?.mode !== 'battle' || state.busy) return;
    let r = C.getBoundingClientRect();
    if (!r.width || !r.height) return;
    let foe = foeAtPoint(((e.clientX - r.left) * W) / r.width, ((e.clientY - r.top) * H) / r.height);
    if (!foe || foe === state.enemy) return;
    state.enemy = foe;
    sfx('cursor');
    if (state.targetMenu && targetPick) {
      let pick = targetPick;
      targetPick = null;
      state.targetMenu = false;
      sync();
      pick(foe);
      return;
    }
    setMsg(foe.name + 'に狙いを定めた。');
    sync();
    draw();
  });
  $('#soundBtn').addEventListener('click', toggleSound);
  $('#bagBtn').addEventListener('click', showInventory);
  document.querySelectorAll('[data-dir]').forEach(b => {
    const start = e => {
        e.preventDefault();
        ensureAudio();
        setHeldDir(b.dataset.dir);
      },
      stop = () => releaseDir(b.dataset.dir);
    b.addEventListener('pointerdown', start);
    b.addEventListener('pointerup', stop);
    b.addEventListener('pointercancel', stop);
    b.addEventListener('pointerleave', stop);
    b.addEventListener('lostpointercapture', stop);
  });
  addEventListener('pointerup', () => {
    heldDir = null;
  });
  addEventListener('blur', () => {
    heldDir = null;
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) heldDir = null;
  });
  document.querySelectorAll('[data-act]').forEach(b =>
    b.addEventListener('click', () => {
      sfx('cursor');
      act(b.dataset.act);
    }),
  );
  $('#skillMenu').addEventListener('click', e => {
    let skill = e.target.closest('[data-skill]'),
      item = e.target.closest('[data-item]'),
      target = e.target.closest('[data-target]');
    if (skill || item || target)
      sfx(
        (skill && skill.dataset.skill === 'back') ||
          (item && item.dataset.item === 'back') ||
          (target && target.dataset.target === 'back')
          ? 'cancel'
          : 'confirm',
      );
    if (skill) useSkill(skill.dataset.skill);
    if (item) useBattleItem(item.dataset.item);
    if (target) chooseTarget(target.dataset.target);
  });
  const KEYDIR = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  addEventListener('keyup', e => {
    let d = KEYDIR[e.key];
    if (d) releaseDir(d);
  });
  addEventListener('keydown', e => {
    ensureAudio();
    let d = KEYDIR[e.key];
    if (d) {
      e.preventDefault();
      if (!e.repeat) setHeldDir(d);
    }
    if (state.mode === 'battle' && !state.skillMenu && !state.itemMenu) {
      if (e.key === '1' || e.key === 'Enter') act('attack');
      if (e.key === '2') act('skills');
      if (e.key === '3') act('potion');
      if (e.key === '4' || e.key === 'Escape') act('run');
    }
  });
  function autoSaveOnLeave() {
    if (state?.mode === 'field' && !$('#overlay').classList.contains('show')) saveGame();
  }
  addEventListener('pagehide', autoSaveOnLeave);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) autoSaveOnLeave();
  });
  gameAudio = createGameAudio({ getState: () => state, enabled: audioOn });
  updateSoundButton();
  boot();
  loadBattleHero();
  loadMageBattle(ASSETS.mageBattle);
  loadBattleSheet(ASSETS.heroBattleSheet, battleHeroFrames, () => {
    battleHeroReady = true;
  });
  loadBattleSheet(ASSETS.mageBattleSheet, mageBattleFrames, () => {
    mageBattleReady = true;
  });
  loadFieldSheet('luka', ASSETS.heroField);
  loadFieldSheet('mina', ASSETS.mageField);
  Object.entries(ASSETS.enemies).forEach(([key, src]) => loadEnemyArt(key, src));
})();

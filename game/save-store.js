// セーブ形式は必ずバージョン管理し、旧版を読み込めるようにする。
export const LEGACY_SAVE_KEY = 'stonefire-save-v2'; // 単一セーブだった頃のキー
export const SAVE_KEY = LEGACY_SAVE_KEY; // 後方互換のため名前を残す
export const SLOT_PREFIX = 'stonefire-slot-v1-';
export const BACKUP_SUFFIX = ':bak';
export const ACTIVE_SLOT_KEY = 'stonefire-active-slot-v1';
export const MIGRATED_KEY = 'stonefire-slot-migrated-v1';
export const SLOT_COUNT = 3;
export const SLOTS = Object.freeze([1, 2, 3]);
export const SAVE_VERSION = 6;
const SUPPORTED_VERSIONS = new Set([2, 3, 4, 5, SAVE_VERSION]);

function defaultStorage() {
  try {
    return globalThis.localStorage;
  } catch (_) {
    return null;
  }
}

export function isSlot(slot) {
  return SLOTS.includes(Number(slot));
}

export function slotKey(slot) {
  return SLOT_PREFIX + Number(slot);
}

export function migrateSave(raw) {
  if (!raw || typeof raw !== 'object' || !raw.hero) return null;
  if (!SUPPORTED_VERSIONS.has(Number(raw.version))) return null;

  // 旧版のくすり数を、新しい所持品データへ引き継ぐ。
  // 章は足され続けるので、ここに上限を書かない。書くと、章を追加したときに
  // 追加ぶんのセーブが黙って第1章へ倒される。読めない値だけ第1章にする。
  const chapter = Math.max(1, Math.floor(Number(raw.chapter)) || 1);
  const legacyPotions = Math.max(0, Number(raw.hero?.potions) || 0);
  const hadInventory = raw.inventory && typeof raw.inventory === 'object';
  const inventory = hadInventory ? { ...raw.inventory } : { potion: legacyPotions };
  // 所持品データを持たない過去版のセーブにだけ、討伐済みボスの証を補う。
  // 所持品を持つセーブでは補わない。補うと、売った討伐品が読み込みのたびに
  // 復活してしまい、無限にゴールドを稼げてしまうため。
  if (!hadInventory) {
    if (chapter >= 2 || raw.cleared) inventory.flameHorn = 1;
    if (chapter === 3 || (chapter === 2 && raw.cleared)) inventory.eclipseWing = 1;
    if (chapter === 3 && raw.cleared) inventory.astralCore = 1;
  }
  const hero = { ...raw.hero };
  const companion = { ...(raw.companion || {}) };
  // v4以前でレベル習得済みだったワザを、v5の閃き式へ失わず移行する。
  if (Number(raw.version) < 5) {
    const heroSkills = Array.isArray(hero.learnedSkills) ? [...hero.learnedSkills] : [];
    if ((Number(hero.lv) || 1) >= 2 && !heroSkills.includes('starfire')) heroSkills.push('starfire');
    if ((Number(hero.lv) || 1) >= 3 && !heroSkills.includes('healing')) heroSkills.push('healing');
    hero.learnedSkills = heroSkills;
    companion.learnedSkills = Array.isArray(companion.learnedSkills) ? companion.learnedSkills : ['moonheal'];
  }
  return {
    ...raw,
    version: SAVE_VERSION,
    chapter,
    hero,
    companion,
    inventory,
    playMs: Math.max(0, Number(raw.playMs) || 0),
    storyFlags: raw.storyFlags && typeof raw.storyFlags === 'object' ? raw.storyFlags : {},
  };
}

function readKey(storage, key) {
  try {
    return migrateSave(JSON.parse(storage.getItem(key)));
  } catch (_) {
    return null;
  }
}

// 本体が壊れていても、直前の状態を退避したバックアップから拾い直す。
export function readSlot(slot, storage = defaultStorage()) {
  if (!storage || !isSlot(slot)) return null;
  migrateLegacySave(storage);
  return readKey(storage, slotKey(slot)) || readKey(storage, slotKey(slot) + BACKUP_SUFFIX);
}

export function writeSlot(slot, data, storage = defaultStorage()) {
  if (!storage || !isSlot(slot)) return false;
  const key = slotKey(slot);
  const payload = JSON.stringify({
    ...data,
    version: SAVE_VERSION,
    slot: Number(slot),
    savedAt: Number(data?.savedAt) || Date.now(),
  });
  try {
    const previous = storage.getItem(key);
    // 新しい書き込みが途中で失敗しても、ひとつ前には必ず戻せるようにする。
    if (previous) storage.setItem(key + BACKUP_SUFFIX, previous);
    storage.setItem(key, payload);
    return storage.getItem(key) === payload; // 書けたことを読み返して確かめる
  } catch (_) {
    return false;
  }
}

export function clearSlot(slot, storage = defaultStorage()) {
  if (!storage || !isSlot(slot)) return false;
  try {
    storage.removeItem(slotKey(slot));
    storage.removeItem(slotKey(slot) + BACKUP_SUFFIX);
    return true;
  } catch (_) {
    return false;
  }
}

export function slotSummary(slot, storage = defaultStorage()) {
  const data = readSlot(slot, storage);
  if (!data) return { slot: Number(slot), empty: true };
  return {
    slot: Number(slot),
    empty: false,
    chapter: data.chapter,
    cleared: !!data.cleared,
    savedAt: Number(data.savedAt) || 0,
    playMs: Math.max(0, Number(data.playMs) || 0),
    hero: {
      lv: Number(data.hero?.lv) || 1,
      hp: Number(data.hero?.hp) || 0,
      maxHp: Number(data.hero?.maxHp) || 0,
    },
    companion:
      data.companion?.active || data.chapter >= 2
        ? {
            lv: Number(data.companion?.lv) || 1,
            hp: Number(data.companion?.hp) || 0,
            maxHp: Number(data.companion?.maxHp) || 0,
          }
        : null,
  };
}

export function slotSummaries(storage = defaultStorage()) {
  return SLOTS.map(slot => slotSummary(slot, storage));
}

export function readActiveSlot(storage = defaultStorage()) {
  if (!storage) return 1;
  try {
    const value = Number(storage.getItem(ACTIVE_SLOT_KEY));
    return isSlot(value) ? value : 1;
  } catch (_) {
    return 1;
  }
}

export function writeActiveSlot(slot, storage = defaultStorage()) {
  if (!storage || !isSlot(slot)) return false;
  try {
    storage.setItem(ACTIVE_SLOT_KEY, String(Number(slot)));
    return true;
  } catch (_) {
    return false;
  }
}

// 単一セーブ時代のデータを枠1へ引き継ぐ。旧キーは消さずに残しておく。
export function migrateLegacySave(storage = defaultStorage()) {
  if (!storage) return false;
  try {
    if (storage.getItem(MIGRATED_KEY)) return false;
    storage.setItem(MIGRATED_KEY, '1');
    if (SLOTS.some(slot => storage.getItem(slotKey(slot)))) return false;
    const legacy = readKey(storage, LEGACY_SAVE_KEY);
    if (!legacy) return false;
    storage.setItem(slotKey(1), JSON.stringify({ ...legacy, slot: 1 }));
    return true;
  } catch (_) {
    return false;
  }
}

// --- 旧API(単一セーブ)。読み込みは枠1へ、書き込みは現在の枠へ寄せる。 ---
export function readStoredSave(storage = defaultStorage()) {
  return readSlot(readActiveSlot(storage), storage);
}

export function writeStoredSave(data, storage = defaultStorage()) {
  return writeSlot(readActiveSlot(storage), data, storage);
}

export function clearStoredSave(storage = defaultStorage()) {
  return clearSlot(readActiveSlot(storage), storage);
}

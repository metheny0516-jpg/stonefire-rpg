// セーブ形式は必ずバージョン管理し、旧版を読み込めるようにする。
export const SAVE_KEY = "stonefire-save-v2";
export const SAVE_VERSION = 6;
const SUPPORTED_VERSIONS = new Set([2, 3, 4, 5, SAVE_VERSION]);

function defaultStorage() {
  try {
    return globalThis.localStorage;
  } catch (_) {
    return null;
  }
}

export function migrateSave(raw) {
  if (!raw || typeof raw !== "object" || !raw.hero) return null;
  if (!SUPPORTED_VERSIONS.has(Number(raw.version))) return null;

  // 旧版のくすり数を、新しい所持品データへ引き継ぐ。
  const chapter = raw.chapter === 3 ? 3 : raw.chapter === 2 ? 2 : 1;
  const legacyPotions = Math.max(0, Number(raw.hero?.potions) || 0);
  const inventory = raw.inventory && typeof raw.inventory === "object"
    ? { ...raw.inventory }
    : { potion: legacyPotions };
  // 過去版ですでに倒したボスの討伐品も失わせない。
  if ((chapter >= 2 || raw.cleared) && !inventory.flameHorn) inventory.flameHorn = 1;
  if ((chapter === 3 || (chapter === 2 && raw.cleared)) && !inventory.eclipseWing) inventory.eclipseWing = 1;
  if (chapter === 3 && raw.cleared && !inventory.astralCore) inventory.astralCore = 1;
  const hero = { ...raw.hero };
  const companion = { ...(raw.companion || {}) };
  // v4以前でレベル習得済みだったワザを、v5の閃き式へ失わず移行する。
  if (Number(raw.version) < 5) {
    const heroSkills = Array.isArray(hero.learnedSkills) ? [...hero.learnedSkills] : [];
    if ((Number(hero.lv) || 1) >= 2 && !heroSkills.includes("starfire")) heroSkills.push("starfire");
    if ((Number(hero.lv) || 1) >= 3 && !heroSkills.includes("healing")) heroSkills.push("healing");
    hero.learnedSkills = heroSkills;
    companion.learnedSkills = Array.isArray(companion.learnedSkills) ? companion.learnedSkills : ["moonheal"];
  }
  return {
    ...raw,
    version: SAVE_VERSION,
    chapter,
    hero,
    companion,
    inventory,
    storyFlags: raw.storyFlags && typeof raw.storyFlags === "object" ? raw.storyFlags : {},
  };
}

export function readStoredSave(storage = defaultStorage()) {
  if (!storage) return null;
  try {
    return migrateSave(JSON.parse(storage.getItem(SAVE_KEY)));
  } catch (_) {
    return null;
  }
}

export function writeStoredSave(data, storage = defaultStorage()) {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify({ ...data, version: SAVE_VERSION }));
    return true;
  } catch (_) {
    return false;
  }
}

export function clearStoredSave(storage = defaultStorage()) {
  if (!storage) return false;
  try {
    storage.removeItem(SAVE_KEY);
    return true;
  } catch (_) {
    return false;
  }
}

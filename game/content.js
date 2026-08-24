// 石牢の灯火: 章・マップ・敵・ワザの定義
// 新しい内容はゲーム本体を触らず、このファイルへ追加する。

export const TILE_SIZE = 20;

// タイル: 0=床 1=壁 2=入口 3=ボス 4=回復ゾーン
export const MAPS = Object.freeze({
  1: Object.freeze([
    "1111111111111111",
    "1000000000000031",
    "1011111111111111",
    "1000000000000001",
    "1111111111111101",
    "1000000040000001",
    "1011111111111111",
    "1000000000000001",
    "1111111111111101",
    "1000000000000001",
    "1211111111111111",
    "1111111111111111",
  ]),
  2: Object.freeze([
    "1111111111111111",
    "1000000000000031",
    "1111111111111101",
    "1000000000000001",
    "1011111111111111",
    "1000000040000001",
    "1111111111111101",
    "1000000000000001",
    "1011111111111111",
    "1000000000000001",
    "1200000000000001",
    "1111111111111111",
  ]),
  3: Object.freeze([
    "1111111111111111",
    "1111111111111131",
    "1000000000000001",
    "1011111111111111",
    "1000000000000001",
    "1111111111111101",
    "1000000040000001",
    "1011111111111111",
    "1000000000000001",
    "1111111111111101",
    "1200000000000001",
    "1111111111111111",
  ]),
});

export const ENEMIES = Object.freeze({
  moss: Object.freeze({ name: "コケマル", maxHp: 14, atk: 5, def: 1, exp: 8, color: "#65d26e", behavior: "spore", drops: [{ id: "potion", chance: 0.34 }] }),
  bat: Object.freeze({ name: "ヨルハネ", maxHp: 21, atk: 7, def: 2, exp: 12, color: "#a881e6", behavior: "swift", drops: [{ id: "nightFeather", chance: 0.38 }] }),
  boss: Object.freeze({ name: "焔角のガルド", maxHp: 72, atk: 12, def: 4, exp: 50, color: "#e4563b", boss: true, behavior: "fireBoss", drops: [{ id: "flameHorn", chance: 1 }] }),
  wisp: Object.freeze({ name: "月燐", maxHp: 42, atk: 11, def: 4, exp: 20, color: "#9fe8ff", behavior: "drain", drops: [{ id: "moonDrop", chance: 0.32 }] }),
  wolf: Object.freeze({ name: "影牙", maxHp: 58, atk: 13, def: 6, exp: 27, color: "#a885e8", behavior: "charge", drops: [{ id: "shadowFang", chance: 0.36 }] }),
  boss2: Object.freeze({ name: "月蝕のヴァルグ", maxHp: 180, atk: 18, def: 9, exp: 105, color: "#bd5cff", boss: true, behavior: "eclipseBoss", drops: [{ id: "eclipseWing", chance: 1 }] }),
  golum: Object.freeze({ name: "晶殻のゴルム", maxHp: 82, atk: 17, def: 10, exp: 40, color: "#6ee7ff", behavior: "crystal", drops: [{ id: "skyCrystal", chance: 0.35 }] }),
  zepha: Object.freeze({ name: "風喰いゼファ", maxHp: 70, atk: 19, def: 7, exp: 43, color: "#55e0c6", behavior: "gale", drops: [{ id: "windSilk", chance: 0.35 }] }),
  boss3: Object.freeze({ name: "天穿のオルディア", maxHp: 260, atk: 23, def: 12, exp: 175, color: "#64dcff", boss: true, behavior: "astralBoss", drops: [{ id: "astralCore", chance: 1 }] }),
});

export const ENCOUNTERS = Object.freeze({
  1: Object.freeze(["moss", "bat"]),
  2: Object.freeze(["wisp", "wolf"]),
  3: Object.freeze(["golum", "zepha"]),
});

export const BOSSES = Object.freeze({ 1: "boss", 2: "boss2", 3: "boss3" });

export const SKILLS = Object.freeze([
  // ルカ: たたかう(=1.0倍)を基準に、段数・全体化・防御無視で役割を分ける
  Object.freeze({ id: "crescent", owner: "hero", name: "三日月返し", lv: 2, uses: 3, power: 1.3, hits: 2, kind: "slash", motion: "crescent", desc: "二段斬り 威力1.3倍", spark: ["attack", "guard"] }),
  Object.freeze({ id: "starfire", owner: "hero", name: "星火斬り", lv: 3, uses: 2, power: 1.6, kind: "fire", motion: "starfire", desc: "炎の斬撃 威力1.6倍", spark: ["attack", "wait"] }),
  Object.freeze({ id: "healing", owner: "hero", name: "光の癒し", lv: 3, uses: 1, heal: 18, kind: "heal", motion: "heal", desc: "仲間1人のHPを18回復", spark: ["guard", "wait"] }),
  Object.freeze({ id: "whirlblade", owner: "hero", name: "断空円舞", lv: 4, uses: 2, power: 0.95, target: "all", kind: "slash", motion: "whirl", desc: "敵全体 威力0.95倍", spark: ["attack", "guard"] }),
  Object.freeze({ id: "armorbreak", owner: "hero", name: "鎧断ち", lv: 5, uses: 2, power: 1.45, ignoreDef: true, kind: "slash", motion: "pierce", desc: "防御無視 威力1.45倍", spark: ["attack", "wait"] }),
  Object.freeze({ id: "dawnblade", owner: "hero", name: "暁天一閃", lv: 6, uses: 1, power: 2.2, kind: "fire", motion: "starfire", desc: "渾身の一閃 威力2.2倍", spark: ["wait"] }),
  Object.freeze({ id: "tenfang", owner: "hero", name: "牙断ち乱れ", lv: 7, uses: 1, power: 1.95, hits: 3, kind: "slash", motion: "crescent", desc: "三段斬り 威力1.95倍", spark: ["attack"] }),
  // ミナ
  Object.freeze({ id: "moonheal", owner: "mage", name: "月雫の癒し", lv: 1, uses: 2, heal: 18, kind: "moonheal", motion: "moonheal", desc: "仲間1人のHPを18回復", spark: ["guard", "wait"] }),
  Object.freeze({ id: "frostmoon", owner: "mage", name: "氷月弾", lv: 3, uses: 3, power: 1.4, kind: "moon", motion: "moon", desc: "冷気の魔弾 威力1.4倍", spark: ["attack", "guard"] }),
  Object.freeze({ id: "starshower", owner: "mage", name: "星屑の雨", lv: 4, uses: 2, power: 0.9, target: "all", kind: "moon", motion: "starshower", desc: "敵全体 威力0.9倍", spark: ["attack", "wait"] }),
  Object.freeze({ id: "moonveil", owner: "mage", name: "月光の護り", lv: 5, uses: 1, healAll: 14, kind: "moonheal", motion: "moonveil", desc: "仲間全員のHPを14回復", spark: ["guard", "wait"] }),
  Object.freeze({ id: "starfall", owner: "mage", name: "星降り", lv: 6, uses: 1, power: 2.1, kind: "moon", motion: "starfall", desc: "星光の大魔法 威力2.1倍", spark: ["wait"] }),
]);

export const ITEMS = Object.freeze({
  potion: Object.freeze({ name: "くすり", icon: "◆", desc: "仲間1人のHPを18回復", usable: true, heal: 18 }),
  moonDrop: Object.freeze({ name: "月のしずく", icon: "☾", desc: "仲間全員のHPを12回復", usable: true, healAll: 12 }),
  nightFeather: Object.freeze({ name: "夜羽", icon: "♢", desc: "ヨルハネが落とす黒紫の羽" }),
  flameHorn: Object.freeze({ name: "焔角の欠片", icon: "▲", desc: "焔角のガルドを倒した証" }),
  shadowFang: Object.freeze({ name: "影牙のかけら", icon: "†", desc: "冷たい魔力を帯びた牙" }),
  eclipseWing: Object.freeze({ name: "月蝕の羽", icon: "✦", desc: "月蝕のヴァルグを倒した証" }),
  skyCrystal: Object.freeze({ name: "蒼天晶", icon: "◇", desc: "星骸の塔で採れる淡青色の結晶" }),
  windSilk: Object.freeze({ name: "風紋の糸", icon: "≈", desc: "触れると微風を生む不思議な糸" }),
  astralCore: Object.freeze({ name: "天穿の核", icon: "✺", desc: "天穿のオルディアを倒した証" }),
});

export const ASSETS = Object.freeze({
  heroBattle: "./hero-battle-source.png",
  heroBattleSheet: "./luka-battle-sheet-v2.png",
  mageBattle: "./mina-battle.png",
  mageBattleSheet: "./mina-battle-sheet-v2.png",
  heroField: "./hero-field-v2.png",
  mageField: "./mina-field.png",
  enemies: Object.freeze({
    moss: "./enemy-moss.png",
    bat: "./enemy-bat.png",
    boss: "./enemy-boss.png",
    wisp: "./enemy-moon-wisp.png",
    wolf: "./enemy-shadow-wolf.png",
    boss2: "./enemy-moon-boss.png",
    golum: "./enemy-crystal-golum.png",
    zepha: "./enemy-wind-zepha.png",
    boss3: "./enemy-sky-boss-ordia.png",
  }),
});

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

// 街のマップ。0=地面 1=建物/壁 2=ダンジョンへ 5=宿屋 6=武器屋 7=防具屋 8=道具屋 9=噴水
export const TOWNS = Object.freeze({
  1: Object.freeze({
    name: "灯火の里",
    subtitle: "石牢のふもとに寄り添う小さな里",
    palette: "stone",
    inn: 20,
    spawn: Object.freeze({ x: 13, y: 10 }),
    map: Object.freeze([
      "1111111111111111",
      "1111111111111111",
      "1111111111111111",
      "1151116111171181",
      "1000000000000001",
      "1000000000000001",
      "1000990000000001",
      "1000990000000001",
      "1000000000000001",
      "1000000000000001",
      "1000000000000021",
      "1111111111111111",
    ]),
  }),
  2: Object.freeze({
    name: "銀鈴の宿場",
    subtitle: "月影の森の入口に立つ宿場町",
    palette: "forest",
    inn: 45,
    spawn: Object.freeze({ x: 13, y: 10 }),
    map: Object.freeze([
      "1111111111111111",
      "1111111111111111",
      "1116111117111811",
      "1000000000000001",
      "1000000000000001",
      "1011100000011101",
      "1000009900000001",
      "1000009900000001",
      "1011100000011101",
      "1000000000000001",
      "1500000000000021",
      "1111111111111111",
    ]),
  }),
  3: Object.freeze({
    name: "星見の湊",
    subtitle: "雲海に浮かぶ空の港町",
    palette: "sky",
    inn: 90,
    spawn: Object.freeze({ x: 13, y: 10 }),
    map: Object.freeze([
      "1111111111111111",
      "1111111111111111",
      "1161111711118111",
      "1000000000000001",
      "1000000000000001",
      "1000000000000001",
      "1001199009911001",
      "1000000000000001",
      "1000000000000001",
      "1511111111100001",
      "1000000000000021",
      "1111111111111111",
    ]),
  }),
});

// 装備。slot: weapon(武器) / armor(体防具)。owner: hero=ルカ mage=ミナ both=共用
export const EQUIPMENT = Object.freeze({
  rustSword: Object.freeze({ name: "欠けた剣", slot: "weapon", owner: "hero", atk: 1, price: 30, chapter: 1, icon: "†", desc: "刃こぼれした旅立ちの剣" }),
  ironSword: Object.freeze({ name: "鉄の剣", slot: "weapon", owner: "hero", atk: 4, price: 120, chapter: 1, icon: "†", desc: "里の鍛冶が打った実直な剣" , tint: "#d3dcea"}),
  flameEdge: Object.freeze({ name: "焔紋の剣", slot: "weapon", owner: "hero", atk: 8, price: 320, chapter: 2, icon: "†", desc: "刃に焔角の紋が走る" , tint: "#ff9752"}),
  moonEdge: Object.freeze({ name: "月光の刃", slot: "weapon", owner: "hero", atk: 13, price: 620, chapter: 2, icon: "†", desc: "月の光を溜めて斬る" , tint: "#bfe6ff"}),
  astralEdge: Object.freeze({ name: "天穿の剣", slot: "weapon", owner: "hero", atk: 19, price: 1100, chapter: 3, icon: "†", desc: "星をも裂くと謳われた剣" , tint: "#8ef2e4"}),
  oakStaff: Object.freeze({ name: "樫の杖", slot: "weapon", owner: "mage", atk: 1, price: 30, chapter: 1, icon: "⚚", desc: "使い込まれた見習いの杖" }),
  moonStaff: Object.freeze({ name: "月銀の杖", slot: "weapon", owner: "mage", atk: 4, price: 130, chapter: 1, icon: "⚚", desc: "月銀を巻いた素直な杖" , tint: "#d6e8ff"}),
  frostStaff: Object.freeze({ name: "氷紋の杖", slot: "weapon", owner: "mage", atk: 8, price: 330, chapter: 2, icon: "⚚", desc: "触れると指先が白く曇る" , tint: "#7fe9ff"}),
  starStaff: Object.freeze({ name: "星詠みの杖", slot: "weapon", owner: "mage", atk: 13, price: 640, chapter: 2, icon: "⚚", desc: "星の巡りを読む古い杖" , tint: "#ffe08a"}),
  voidStaff: Object.freeze({ name: "天穿の杖", slot: "weapon", owner: "mage", atk: 18, price: 1120, chapter: 3, icon: "⚚", desc: "空の芯に届く力を宿す" , tint: "#d3a2ff"}),
  clothArmor: Object.freeze({ name: "旅装", slot: "armor", owner: "both", def: 1, price: 30, chapter: 1, icon: "▤", desc: "着慣れた旅の装い" }),
  leatherArmor: Object.freeze({ name: "革の胸当て", slot: "armor", owner: "both", def: 3, price: 110, chapter: 1, icon: "▤", desc: "軽くて動きを妨げない" , tint: "#a8733f"}),
  chainArmor: Object.freeze({ name: "鎖帷子", slot: "armor", owner: "both", def: 6, price: 300, chapter: 2, icon: "▤", desc: "細かな鎖を編んだ胴着" , tint: "#8d96a8"}),
  moonMail: Object.freeze({ name: "月銀の鎧", slot: "armor", owner: "both", def: 10, price: 600, chapter: 2, icon: "▥", desc: "月光を弾く銀の鎧" , tint: "#cddaec"}),
  astralMail: Object.freeze({ name: "天穿の鎧", slot: "armor", owner: "both", def: 15, price: 1050, chapter: 3, icon: "▥", desc: "星屑を鍛え込んだ鎧" , tint: "#79d6e8"}),
});

export const STARTING_GEAR = Object.freeze({
  hero: Object.freeze({ weapon: "rustSword", armor: "clothArmor" }),
  mage: Object.freeze({ weapon: "oakStaff", armor: "clothArmor" }),
});

export const ENEMIES = Object.freeze({
  moss: Object.freeze({ name: "コケマル", maxHp: 18, atk: 6, def: 1, exp: 10, gold: 6, color: "#65d26e", behavior: "spore", drops: [{ id: "potion", chance: 0.34 }] }),
  bat: Object.freeze({ name: "ヨルハネ", maxHp: 26, atk: 9, def: 2, exp: 14, gold: 9, color: "#a881e6", behavior: "swift", drops: [{ id: "nightFeather", chance: 0.38 }] }),
  boss: Object.freeze({ name: "焔角のガルド", maxHp: 92, atk: 15, def: 5, exp: 60, gold: 60, color: "#e4563b", boss: true, behavior: "fireBoss", drops: [{ id: "flameHorn", chance: 1 }] }),
  wisp: Object.freeze({ name: "月燐", maxHp: 54, atk: 14, def: 5, exp: 26, gold: 16, color: "#9fe8ff", behavior: "drain", drops: [{ id: "moonDrop", chance: 0.32 }] }),
  wolf: Object.freeze({ name: "影牙", maxHp: 72, atk: 17, def: 7, exp: 34, gold: 22, color: "#a885e8", behavior: "charge", drops: [{ id: "shadowFang", chance: 0.36 }] }),
  boss2: Object.freeze({ name: "月蝕のヴァルグ", maxHp: 225, atk: 23, def: 11, exp: 125, gold: 150, color: "#bd5cff", boss: true, behavior: "eclipseBoss", drops: [{ id: "eclipseWing", chance: 1 }] }),
  golum: Object.freeze({ name: "晶殻のゴルム", maxHp: 105, atk: 22, def: 12, exp: 50, gold: 30, color: "#6ee7ff", behavior: "crystal", drops: [{ id: "skyCrystal", chance: 0.35 }] }),
  zepha: Object.freeze({ name: "風喰いゼファ", maxHp: 88, atk: 24, def: 8, exp: 54, gold: 32, color: "#55e0c6", behavior: "gale", drops: [{ id: "windSilk", chance: 0.35 }] }),
  boss3: Object.freeze({ name: "天穿のオルディア", maxHp: 330, atk: 30, def: 15, exp: 210, gold: 300, color: "#64dcff", boss: true, behavior: "astralBoss", drops: [{ id: "astralCore", chance: 1 }] }),
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
  potion: Object.freeze({ name: "くすり", icon: "◆", desc: "仲間1人のHPを18回復", usable: true, heal: 18, price: 20, sell: 8 }),
  moonDrop: Object.freeze({ name: "月のしずく", icon: "☾", desc: "仲間全員のHPを12回復", usable: true, healAll: 12, price: 60, sell: 24 }),
  nightFeather: Object.freeze({ name: "夜羽", icon: "♢", desc: "ヨルハネが落とす黒紫の羽", sell: 12 }),
  flameHorn: Object.freeze({ name: "焔角の欠片", icon: "▲", desc: "焔角のガルドを倒した証", sell: 180, precious: true }),
  shadowFang: Object.freeze({ name: "影牙のかけら", icon: "†", desc: "冷たい魔力を帯びた牙", sell: 24 }),
  eclipseWing: Object.freeze({ name: "月蝕の羽", icon: "✦", desc: "月蝕のヴァルグを倒した証", sell: 420, precious: true }),
  skyCrystal: Object.freeze({ name: "蒼天晶", icon: "◇", desc: "星骸の塔で採れる淡青色の結晶", sell: 38 }),
  windSilk: Object.freeze({ name: "風紋の糸", icon: "≈", desc: "触れると微風を生む不思議な糸", sell: 36 }),
  astralCore: Object.freeze({ name: "天穿の核", icon: "✺", desc: "天穿のオルディアを倒した証", sell: 900, precious: true }),
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

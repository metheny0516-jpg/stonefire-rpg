// 敵の行動選択を描画から分離した純粋なルール。
// random はテスト時に固定値を渡せる。
export function selectEnemyAction(enemy, random = Math.random) {
  const turn = Number(enemy.turn) || 0;
  const hpRate = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 0;

  // 予告なしの痛恨の一撃。低確率だが、油断していると一撃で持っていかれる。
  if (random() < (enemy.boss ? 0.07 : 0.045)) {
    return {
      type: "single",
      label: `${enemy.name}の痛恨の一撃！！`,
      multiplier: enemy.boss ? 3.4 : 2.9,
      savage: true,
      clearsCharge: true,
    };
  }

  if (enemy.behavior === "charge") {
    if (enemy.charging) return { type: "single", label: "影牙の飛びかかり", multiplier: 1.95, clearsCharge: true };
    if (random() < 0.32) return { type: "charge", label: "影牙は低く身構えた……" };
  }
  if (enemy.behavior === "swift" && random() < 0.34) {
    return { type: "single", label: "ヨルハネの連続かみつき", multiplier: 0.78, hits: 2 };
  }
  if (enemy.behavior === "spore" && random() < 0.3) {
    return { type: "single", label: "コケマルの生命吸収", multiplier: 0.88, drain: 0.6 };
  }
  if (enemy.behavior === "drain" && random() < 0.34) {
    return { type: "single", label: "月燐の魂すすり", multiplier: 1.0, drain: 0.5 };
  }
  if (enemy.behavior === "fireBoss" && hpRate <= 0.55 && random() < 0.42) {
    return { type: "all", label: "焔角のガルドの灼熱息", multiplier: 0.95 };
  }
  if (enemy.behavior === "eclipseBoss" && turn > 0 && turn % 3 === 0) {
    return { type: "all", label: "月蝕のヴァルグの月蝕波", multiplier: 1.1 };
  }
  if (enemy.behavior === "crystal") {
    if (enemy.charging) return { type: "single", label: "砕城突進", multiplier: 2.05, clearsCharge: true };
    if (random() < 0.28) return { type: "charge", label: "晶殻が蒼く鳴り始めた……" };
  }
  if (enemy.behavior === "gale" && random() < 0.38) {
    return { type: "single", label: "裂空連舞", multiplier: 0.82, hits: 2 };
  }
  if (enemy.behavior === "astralBoss") {
    if (turn > 0 && turn % 4 === 0) return { type: "all", label: "星界崩し", multiplier: 1.25 };
    if (hpRate <= 0.45 && random() < 0.32) return { type: "single", label: "六翼の断空", multiplier: 0.78, hits: 3 };
  }
  return { type: "single", label: `${enemy.name}の攻撃`, multiplier: 1, hits: 1 };
}

export function rollDrops(enemy, random = Math.random) {
  return (enemy.drops || [])
    .filter((drop) => random() < drop.chance)
    .map((drop) => ({ id: drop.id, amount: drop.amount || 1 }));
}

export function criticalRateForLevel(level) {
  return Math.min(18, 5 + Math.floor(Math.max(1, Number(level) || 1) / 2));
}

// 添付試作のd100方式を本編用に調整。
// ミス・通常・会心は1回の判定で排他的に決まり、会心は防御を無視する。
export function resolveHeroAttack(attacker, defender, random = Math.random) {
  const missRate = 3;
  const critRate = criticalRateForLevel(attacker.lv);
  const roll = Math.floor(random() * 100) + 1;
  if (roll <= missRate) return { roll, kind: "miss", damage: 0, critRate };
  if (roll > 100 - critRate) {
    return {
      roll,
      kind: "critical",
      damage: Math.max(1, Math.round(attacker.atk * 2.15)),
      critRate,
    };
  }
  const variance = 0.9 + random() * 0.2;
  const base = attacker.atk - Math.floor(defender.def / 2);
  return {
    roll,
    kind: "normal",
    damage: Math.max(1, Math.round(base * variance)),
    critRate,
  };
}

export function rollEncounterGroup(pool, chapter = 1, random = Math.random) {
  if (!Array.isArray(pool) || pool.length === 0) return [];
  const sizeRoll = random();
  const count = chapter >= 2
    ? (sizeRoll < 0.15 ? 3 : sizeRoll < 0.65 ? 2 : 1)
    : (sizeRoll < 0.45 ? 2 : 1);
  return Array.from({ length: count }, () => pool[Math.floor(random() * pool.length)]);
}

export function effectiveDefense(member) {
  const defense = Math.max(0, Number(member?.def) || 0);
  return member?.guarding ? defense * 2 : defense;
}

export function waitBonuses(currentExpBoost = 1) {
  return { charged: true, expBoost: Math.min(1.5, Math.max(1, currentExpBoost) + 0.15) };
}

export function sparkChanceForAction(action, charged = false) {
  // ときどき閃く程度に抑える。ためた直後だけ +3%。
  const base = { attack: 0.04, guard: 0.04, wait: 0.05, skill: 0.03, item: 0.01 }[action];
  return (base === undefined ? 0.02 : base) + (charged ? 0.03 : 0);
}

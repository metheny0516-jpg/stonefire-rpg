// 「第5章で保存したのに、読み込むと第1章から始まる」の再現と検証。
// migrateSave が章を 1〜3 に丸めていたため、第4・5章を足したあとの
// セーブは読み込むたびに第1章へ倒されていた。
// 旅の記録は storyFlags 側に残るので「戻れはする」ぶん、
// 章の解放テストをすり抜けていた。
import { migrateSave, SAVE_VERSION } from '../game/save-store.js';

const save = (chapter, extra = {}) => ({
  version: SAVE_VERSION,
  chapter,
  hero: { lv: 9, hp: 60, maxHp: 60 },
  inventory: { potion: 3 },
  ...extra,
});

let failed = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(
    (ok ? 'OK  ' : 'NG  ') +
      label.padEnd(34) +
      '期待' +
      JSON.stringify(expected) +
      ' 実際' +
      JSON.stringify(actual),
  );
};

for (const ch of [1, 2, 3, 4, 5]) {
  check('第' + ch + '章のセーブを読む', migrateSave(save(ch)).chapter, ch);
}

// 壊れた値だけは第1章へ倒す。
check('章が無い', migrateSave({ ...save(1), chapter: undefined }).chapter, 1);
check('章が文字列', migrateSave({ ...save(1), chapter: 'abc' }).chapter, 1);
check('章が0以下', migrateSave({ ...save(1), chapter: -3 }).chapter, 1);

// 所持品データを持たない旧版だけ、討伐の証を補う挙動は変えない。
const legacy = migrateSave({ version: 3, chapter: 3, cleared: true, hero: { lv: 9 } });
check('旧版(章3クリア)の証', Object.keys(legacy.inventory).sort(), [
  'astralCore',
  'eclipseWing',
  'flameHorn',
  'potion',
]);
check('所持品つきセーブには足さない', Object.keys(migrateSave(save(3)).inventory).sort(), ['potion']);

console.log(failed ? '\nFAIL' : '\nPASS');
process.exit(failed ? 1 : 0);

import * as acorn from 'acorn';
import { execSync } from 'child_process';
import fs from 'fs';

const STRIP = new Set(['start','end','loc','range','raw']);
function norm(n){
  if (Array.isArray(n)) return n.map(norm);
  if (n && typeof n === 'object') {
    const o = {};
    for (const k of Object.keys(n).sort()) {
      if (STRIP.has(k)) continue;
      o[k] = norm(n[k]);
    }
    return o;
  }
  return n;
}
const parse = (src) => norm(acorn.parse(src, { ecmaVersion:'latest', sourceType:'module' }));

let allSame = true;
for (const f of ['game/main.js','game/content.js','game/battle-rules.js','game/save-store.js','game/audio-engine.js']) {
  const before = execSync(`git show HEAD:${f}`, { encoding:'utf8', maxBuffer: 64*1024*1024 });
  const after  = fs.readFileSync(f, 'utf8');
  const a = JSON.stringify(parse(before));
  const b = JSON.stringify(parse(after));
  const same = a === b;
  if (!same) allSame = false;
  console.log(`  ${f.padEnd(24)} AST ${same ? '完全一致' : '*** 差あり ***'}   (${before.length}B -> ${after.length}B)`);
  if (!same) {
    // 最初に食い違う位置を出す
    let i = 0; while (i < a.length && a[i] === b[i]) i++;
    console.log('    分岐点:', JSON.stringify(a.slice(Math.max(0,i-160), i+160)));
    console.log('    後 :', JSON.stringify(b.slice(Math.max(0,i-160), i+160)));
  }
}
console.log(allSame ? '\n=> 全ファイルで構文木が同一。意味は変わっていない。' : '\n=> 差あり');
process.exit(allSame ? 0 : 1);

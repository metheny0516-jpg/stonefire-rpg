# テスト

挙動を変えないはずの変更（整形・リファクタ）を安全に行うための道具。

## 準備

```
npm i -D playwright acorn prettier
python3 -m http.server 8798 --bind 127.0.0.1 --directory .
```

ブラウザは `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` を直接指定している。

## 1. 挙動の記録と比較 — `trace.mjs`

`Math.random` を固定シードに差し替え、決められた手順で実際に遊んで、
23地点の状態を JSON に記録する。歩行・壁・戦闘（攻撃／防御／ためる／ワザ／
どうぐ）・かばん・そうび・町・道具屋の売買と合成・章移動・塔の宝箱／階段／
落とし穴・ボス戦とクリア画面までを通る。

```
node tests/trace.mjs game/main.js > /tmp/after.json
diff <(jq -S .trace tests/golden.json) <(jq -S .trace /tmp/after.json)
```

差分が出なければ挙動は変わっていない。**意図して挙動を変えたときは
`tests/golden.json` を更新すること**（更新前に差分の中身を必ず確認する）。

### 決定論を保つための注意

- **記録中は音声を切っている。** 音声エンジンはノイズ生成で効果音1回あたり
  数千回 `Math.random` を呼ぶため、切らないと乱数列が実時間依存になる
- **見た目だけの乱数は `fxRand()` を使うこと。** 画面揺れのジッターが
  `Math.random` を消費していたせいで、揺れたフレーム数によって戦闘の
  出目まで変わっていた。演出で乱数が要るときは `Math.random` ではなく
  `fxRand()` を使う

## 2. 構文木の比較 — `ast-compare.mjs`

git HEAD と作業ツリーを構文木の段階で比較する。位置情報を落として比べるので、
**改行や空白だけの変更なら完全一致する**。整形の検証はこれが一番強い。

```
node tests/ast-compare.mjs
```

一致しなければ、最初に食い違った位置を表示する。

## 3. 章ごとの回帰テスト

いずれも `python3 -m http.server 8798` を起動した状態で実行する。

| ファイル | 見ているもの |
| --- | --- |
| `travel-regression.mjs` | 一度行った章へ「旅立ち」で戻れること |
| `unlock-regression.mjs` | 討伐の証を売っても解錠状態が失われないこと |
| `skills-regression.mjs` | スタン／吸収／ディフレクト／蘇生／フィールド回復 |
| `chapter5-regression.mjs` | 第5章の2階層・宝箱・落とし穴・光苔・階段・ボス |

```
for f in travel unlock skills chapter5; do node tests/$f-regression.mjs; done
```

## 4. 効果音の実測 — `audio-measure.mjs`

`OfflineAudioContext` に差し替えて効果音をレンダリングし、ピーク・立ち上がり・
減衰(-20dB まで)・帯域比・10ms 窓の RMS 包絡を出す。耳で確かめられない環境で
「軽い/重い」を数字にするための道具。

```
node tests/audio-measure.mjs slash hit critical
WAV_DIR=/tmp node tests/audio-measure.mjs slash   # 波形も書き出す
```

BGM は 0 に絞って効果音だけを測る。素材31点の読み込みを待ってから鳴らすので、
実録素材込みの音が測れる。

### 戦闘を絡めたテストを書くときの注意

- **行動順には ±15% の揺らぎがある**（`buildTurnOrder`）。狙った側に手番を
  回したいときは、素早さを大きく離してから `startBattle` を呼ぶこと。
  「速いはずだから先手」では落ちる
- **スタンや「動けない！」は一瞬で消える。** 演出が終わってから状態を
  見に行っても遅い。`skills-regression.mjs` の `watch()` のように、
  演出中を細かく覗いて記録する
- **前の戦闘を畳んでから次を始める。** `state.mode` を書き換えるだけでは
  クリア画面が残ってクリックを吸うので、`#overlay` の `show` も外す

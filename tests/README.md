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

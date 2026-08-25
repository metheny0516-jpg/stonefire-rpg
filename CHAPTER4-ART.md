# 第4章「黄昏の塔」の敵グラフィック

雑魚6種は**いただいた画像を組み込み済み**です。残っているのはボスの絵だけです。

## 組み込み済み

| ファイル | 敵の名前 | 出る場所 | 備考 |
|---|---|---|---|
| `enemy-rust-rat.png` | 錆喰いネズミ | 1階 | 素早いが脆い |
| `enemy-soul-lantern.png` | 灯の残響 | 1階 | HPを吸う |
| `enemy-rusted-knight.png` | 朽ちた衛士 | 2階 | 硬い。ためてから突進 |
| `enemy-cinder-pede.png` | 熾火ムカデ | 2階 | 最速。2回攻撃 |
| `enemy-rune-golem.png` | 紅印のゴーレム | 3階 | 雑魚最強。HP470・守25 |
| `enemy-void-maw.png` | 虚無喰らいのイド | 3階 | 高火力＋吸収 |

取り込み時にやったこと:

- 画像上部に入っていた細い黒線（4枚）を除去
- ランタンの画像の左端に紛れ込んでいた別画像の欠片を除去
- 微小なゴミ（数px）を除去し、中身に合わせてトリミング
- 背景はもともと透過だったのでそのまま使用（クロマキー処理は不要でした）
- 敵ごとに表示倍率 `art` を設定。ゴーレムを 1.3 倍、ランタンとネズミを
  0.78〜0.85 倍にして、見た目で強さの序列が分かるようにした

## まだ必要な画像 — ボス1枚

| ファイル名 | 敵の名前 |
|---|---|
| `enemy-dusk-boss-vesper.png` | 黄昏のヴェスペル |

いまは色付きの図形で代用して描画されるので、**無くても最後まで遊べます**。

**方向性** — 塔の主。鐘を思わせる意匠をまとった威圧感のある存在。紫と金を基調に、
背後に黄昏の光。他のボス（`enemy-sky-boss-ordia.png` など）と同格の描き込み量で。

**形式** — もらった6枚と同じでかまいません。透過PNG（背景を塗るなら純粋な緑
`#00FF00`）、512×512以上、地面の影は描かない、キャラ1体のみ、枠線や文字なし。

生成プロンプトの雛形:

> anime JRPG boss illustration, towering bell-clad guardian of a dusk tower,
> purple and gold, glowing twilight behind, full body, single creature, centered,
> dramatic lighting, highly detailed, transparent background,
> no ground shadow, no text, no frame, 1024x1024

## 画像を置いたあとにやること

`index.html` の `?v=` を上げてください（2箇所）。上げないと既に遊んだ人の
ブラウザに古いファイルが残ります。詳しくは `game/AUDIO.md` を参照。

もしボスの絵の大きさが合わなければ、`game/content.js` の `boss4` に
`art: 1.2` のように書けば表示倍率を調整できます。

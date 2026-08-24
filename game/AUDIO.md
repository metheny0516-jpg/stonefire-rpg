# サウンド設計メモ

`game/audio-engine.js` の設計と、触るときの注意点。

## 方針: 音声ファイルを持たない

BGM も効果音も **すべて Web Audio API による手続き生成**で、`.mp3` / `.wav` を一切
持たない。理由:

- リポジトリは既に PNG で約 12MB あり、これ以上重くしたくない
- GitHub Pages 配信なので、ロード待ちゼロで鳴り始めるのが望ましい
- 素材を拾ってくるとライセンス表記の管理が必要になる

**この方針を変えない限り、音声ファイルを追加してはいけない。** サンプリング音源を
混ぜると合成音と音の質感がちぐはぐになる。

## 構成

```
createGameAudio({ getState })   … main.js から1つだけ生成
  ├── master
  │    ├── bgmMaster (音量) ─┬─ bgmBuses[0] ┐
  │    │                     └─ bgmBuses[1] ┘ 2系統でクロスフェード
  │    ├── sfxBus (音量)
  │    └── reverb (convolver, IRは起動時に乱数生成)
  └── scheduler: setInterval 25ms、120ms 先まで先読みして音符を予約
```

音符は毎回 `OscillatorNode` / `BufferSource` を使い捨てで生成する。`start()` /
`stop()` 済みのノードは GC されるので解放処理は不要。

## BGM トラック

`trackForState(state)` がゲーム状態から**トラック名を決めるだけ**の純関数。
`pumpMusic()` が 25ms ごとにこれを呼び、名前が変われば `switchTrack()` で
0.6秒クロスフェードする。**状態を見て自動で決まるので、曲を切り替えるために
main.js から何かを呼ぶ必要はない。**

| トラック | 条件 | 中身 |
|---|---|---|
| `field1` | 1章 フィールド | 石牢。低いドローンと水滴 |
| `field2` | 2章 フィールド | 月影の森。ドリアン旋法のアルペジオ |
| `field3` | 3章 フィールド | 星骸の塔。リディアンの鐘 |
| `battle1..3` | 通常戦闘 (章別) | 162BPM / 16小節。章ごとに和音・旋律・音色を丸ごと差し替え |
| `boss1..3` | ボス戦 (章別) | 172BPM。旋律は共通で、章ごとに移調(±0 / −3 / +4)と音色を変更 |
| `clear` | 章クリア画面 | ハ長調の明るいループ |
| `over` | ゲームオーバー | 沈む挽歌 |

`state.mode` が `'battle'` で `enemies` に `boss:true` が含まれれば boss、
それ以外の戦闘は battle。章は `state.chapter` (1..3 にクランプ)。

### 通常戦闘曲の構造

16小節を **2小節 × 8スロット**に分け、`BATTLE_SECTIONS` が各スロットの
セクション (`A` / `B` / `C`) を決める。`C` は最後の2小節で、旋律を1オクターブ
上げてフィルを入れる。章ごとの素材は `BATTLE_SETS[1..3]` にまとまっている
(`chords` 8個、旋律 `A` / `B` 各16音、`lead` / `counter` / `stab` の波形、`drive`)。

**曲を差し替えたいときは `BATTLE_SETS` のデータだけ書き換えればよい。**
スケジューラ (`scheduleBattleStep`) は触らなくてよい。

## 効果音

`sfx(name)` を呼ぶだけ。main.js 側は `audioOn` を見るラッパー経由。

- **戦闘**: `slash` `hit` `staffSwing` `staffImpact` `enemy` `miss` `critical`
  `guard` `charge` `flee` `fleeFail` `defeat` `bossDefeat` `bossAppear`
  `battleStart` `lowHp`
- **必殺技**: `starCharge` `starDash` `starImpact` `starBurst` `burst`
  `moonCast` `moonOrb` `moonShot` `moonHit` `moonBurst` `heal` `silence`
- **フィールド**: `step1` / `step2` / `step3` (章ごとに床の質感が違う)、`bump`、`shrine`
- **UI**: `menuOpen` `menuClose` `cursor` `confirm` `cancel` `potion` `itemGet`
- **進行**: `level` `win` `spark` `chapterStart` `gameOver`

`blade` `normalImpact` `dash` `returnDash` `fire` は別名として実装は残っているが、
現在どこからも呼ばれていない。

`starImpact` `starBurst` `moonBurst` `critical` `bossDefeat` `bossAppear` `spark`
`chapterStart` は再生時に BGM を自動でダッキングする。

## 触るときの注意

### 1. 旋律配列の添字は必ず整数にする

過去に `beat % 8 === 5` の分岐で `loop / 4` を添字に使い、`melody[4.25]` が
`undefined` → `midi(undefined)` が `NaN` → `AudioParam` が例外、という事故を起こした。
**4の倍数でない拍から旋律を引くときは `Math.floor()` を挟む。**

### 2. `AudioParam` に `NaN` を渡すと例外で音が止まる

`setValueAtTime` に非有限値を渡すと throw する。スケジューラは `setInterval` の
中で回っているので、例外が出ると**その回の音符が丸ごと落ちる**。添字ミスや
未定義の音名は静かに壊れず、はっきり壊れる。

### 3. main.js は strict mode の即時関数

未宣言の変数に代入すると `ReferenceError` で**その関数が途中で止まる**。
実際に `bgmStep = 0` の消し忘れで「次の章へ」ボタンが無反応になるバグが出た。
古い音楽実装を消すときは、残骸の代入が無いか確認すること。

### 4. キャッシュバスター

音を変えたら `index.html` の `main.js?v=` と `main.js` 内の
`audio-engine.js?v=` の両方を上げる。上げ忘れると GitHub Pages で古い音が残る。

## 動作確認のしかた

耳で確かめられない環境では、Playwright + Chromium で以下を確認するとよい
(`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`、`--autoplay-policy=no-user-gesture-required`)。

1. **全トラックの走査** — `AudioContext.currentTime` を 20倍速で進める
   サブクラスに差し替えると、数秒で全曲を1ループ分再生できる
2. **`NaN` 検出** — `AudioParam.prototype.setValueAtTime` 等をラップして
   非有限値をログに出す (上記の事故はこれで見つけた)
3. **トラック選択の確認** — `page.route()` で `main.js` を書き換えて
   `window.__audio = gameAudio` を注入すると、実プレイ中に `audio.track` を読める
4. **曲が本当に変わったかの確認** — 生成された周波数を全部記録し、
   中央音高・音の密度・pitch class の集合を比べる

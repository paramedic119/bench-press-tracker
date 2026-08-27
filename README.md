# BENCH 120

12週間のベンチプレス強化プログラムを、そのまま持ち歩けるようにしたトレーニング記録アプリです。
元になっている Excel（`(URPEST2.0)6weeks_BP-Program.xlsx`）の数式チェーンをそのまま再現しているので、
シートで計算していた重量とアプリの表示は一致します。

- **オフラインで動く PWA** — ホーム画面に追加すればアプリとして起動します
- **外部への通信がゼロ** — フォントも含めてすべて同梱。データは端末内の localStorage のみで、
  サーバーにもクラウドにも送信しません
- 配布物は `dist/index.html` の**1ファイル**（`file://` で開いても動きます）

## 主な機能

| | |
|---|---|
| **12週プログラム** | 57セッションの重量を、MAX入力から数式チェーンで自動計算 |
| **プレート計算** | バーと手持ちのプレートから、片側の組み方を枚数最小で厳密に算出 |
| **ウォームアップ** | メインセットの重量からアップの段階（バー → 45/62/78/90%）を提案 |
| **インターバルタイマー** | セット完了で自動スタート。音・バイブ通知、バックグラウンド復帰でもズレない |
| **セット毎の記録** | 重量・回数・RPE を残すと e1RM を算出し、次セットの推奨重量を提示 |
| **実績反映モード** | 記録したベスト e1RM を以降のセッション重量へ伝播 |
| **進捗** | e1RM の推移、3RM/5RM/8RM の推移、週間ボリューム、サイクルごとの MAX 推移 |
| **履歴** | 連続トレ週・トレーニングカレンダー・セッション一覧・過去サイクル |
| **サイクル管理** | 12週終了時に記録をアーカイブし、ベスト e1RM を新 MAX にして再開 |
| **書き出し／読み込み** | JSON バックアップ、CSV（Excel / Numbers で開ける記録一覧） |
| **その他** | ダーク／ライト、取り消し（元に戻す）、体重とメモ、初期設定ウィザード |

## 計算式

推定1RM（e1RM）は Excel と同じ式です。

```
e1RM = 重量 × (回数 + 10 − RPE) / 33 + 重量
※ RPE10 のシングル（1回）は e1RM = 重量
```

各セッションの重量は「参照するセッションの e1RM × 係数」で決まり、Week 1 から Week 12 まで
1本の鎖としてつながっています。丸めは**表示とプレート計算にだけ**かかり、
e1RM の連鎖計算は生値のまま（Excel 互換）です。

### レップマックス（3RM / 5RM / 8RM）

記録したセットの e1RM から、`X回 @ RPE10` の重量を逆算したものを X-rep max としています。

```
XRM = e1RM × 33 / (33 + X)     → 3RM ≈ 92% / 5RM ≈ 87% / 8RM ≈ 80%（1RM比）
```

推定に使うのは**目標の回数から ±3 レップ以内**のセットだけです
（3RM は 1〜6回、5RM は 2〜8回、8RM は 5〜11回のセットから）。
式は目標から離れるほど当てにならないので、8回のセットから 3RM を出すようなことはしません。
この絞り込みがあるおかげで3本の線は平行にならず、
「高回数は伸びているが最大重量は頭打ち」といった差が読み取れます。

グラフは日付軸で、**過去サイクルの記録も含めて**1本の時系列として並べます（点線はサイクルの区切り）。

### 丸めとプレート

丸めの刻みは、実際にバーへ載せられる値だけを並べています
（1.25kg 刻みは片側 0.625kg のプレートが必要になるため選択肢にありません）。
細かい刻みを選ぶと、最小プレートの設定も自動で追従します。

プレートの組み方は貪欲法ではなく**枚数最小の厳密解**（動的計画）で求めます。
0.5kg までしか持っていない状態で片側 1.5kg を作るような場面で、
1.25kg を先に取って 0.25kg が余る、という誤りを避けるためです。

## 開発

```bash
npm ci
npm run build     # src/ → dist/index.html（単一ファイル）＋ sw.js ＋ icons
npm run watch     # src/ を監視して自動ビルド
npm run serve     # http://127.0.0.1:8080 で dist/ を配信（Service Worker の確認用）

npm run check     # 型チェック（JSDoc + tsc --checkJs、アプリと Service Worker）
npm test          # ユニットテスト（依存なし・node のみ）
npm run e2e       # ブラウザテスト（要: npx playwright install chromium）
npm run verify    # check → test → build

npm run icons     # アイコンを再生成（tools/make-icons.mjs、依存ゼロのPNGエンコーダ）
npm run build:gas # Google Apps Script 用のパッケージ（gas_dist/）
```

### 構成

```
src/
  core/          DOM に触れないロジック。そのままユニットテストできる
    program.js     12週57セッションの定義（動かない事実）
    math.js        e1RM とチェーン計算
    repmax.js      3RM / 5RM / 8RM の推定
    plates.js      プレート計算と丸め刻み
    steps.js       入力ステッパーの刻みと範囲
    timer.js       インターバルタイマーの状態機械（now を引数で受ける）
    state.js       保存データのスキーマ・検証・移行
    progress.js    進捗の集計とトレーニング日
    csv.js / util.js / version.js
  ui/            画面。ページ同士は events.js（DOMイベント）経由で疎結合
    dom.js         型を確定させる DOM ヘルパー
    store.js       localStorage と状態の保持
    pages/         workout / progress / repmax / history / settings
  styles/        CSS（tokens → base → layout → 各画面）
  index.html     テンプレート（<!--STYLES--> と <!--SCRIPT--> に差し込む）
  sw.js          Service Worker のテンプレート
  manifest.webmanifest
  assets/fonts/  Bebas Neue（ビルド時に data URI として埋め込む）
tools/
  build.mjs      esbuild + lightningcss で dist/ を作る
  make-icons.mjs 依存ゼロの PNG 生成
  serve.mjs      開発用の静的サーバー
test/
  *.test.mjs     ユニットテスト（core を直接 import）
  e2e.mjs        ブラウザテスト（記録・タイマー・オフライン・a11y・レイアウト）
```

**`dist/` はコミットしていません。** `npm run build` で生成し、CI が公開します。

### なぜ「分割して書き、1ファイルに戻す」のか

配布物を単一ファイルに保つと、`file://` で開ける・GitHub Pages / Firebase / GAS のどれも
「1ファイル置くだけ」で済む、という性質が維持できます。
一方でソースを1ファイルにしておくと、型チェックも lint も CSS ツールも効きません。
ビルドを1枚挟むことで、両方を取っています。

### 型チェック

TypeScript の構文は使わず、JSDoc + `tsc --checkJs` で検査しています
（ソースは素の JavaScript のままなので、コンパイルしなくても読めます）。
アプリの型は `types/app.d.ts` にまとめてあり、JSDoc から名前だけで参照できます。

### Service Worker

`src/sw.js` はテンプレートで、ビルドが以下を差し込みます。

- **プリキャッシュ一覧** — `dist/` の実ファイルから生成。手で書かないので、
  ファイルを足してオフラインが静かに壊れることがありません
- **キャッシュ名** — 全アセットの内容ハッシュ。中身が変われば必ず更新が走ります

### フォント

日本語はシステムフォント（Hiragino / Noto Sans CJK / Yu Gothic UI）に任せ、
見出しと数字の Bebas Neue だけを woff2（5.6KB）で同梱し、ビルド時に data URI として埋め込みます。
Google Fonts の CSS は 345KB・374個の `@font-face` があり、初回オフラインでは当たりません。
外部依存を無くしたうえで、実際に読み込むフォントデータは 5.6KB だけになります。

## デプロイ

- **GitHub Pages** — `master` への push で `.github/workflows/ci.yml` が
  型チェック・ユニットテスト・ビルド・ブラウザテストを通し、`dist/` を公開します
- **Firebase Hosting** — `npm run build && firebase deploy`

どちらもサブディレクトリ配信に対応できるよう、参照はすべて相対パスです。

## データの互換性

保存キーは初版から同じ `bench120.v1` です。読み込み時に `migrate()` が
スキーマの検証と移行（v1 のセッション単位ログ → セット配列など）を行い、
壊れた値や範囲外の値は既定値に落とします。読み込む JSON も同じ経路を通ります。

## ライセンス

ISC。同梱している Bebas Neue は SIL Open Font License 1.1 です。

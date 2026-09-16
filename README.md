# Handoff: EV メーカー別普及インフォグラフィック

静的サイト1枚（HTML/CSS/JS）＋データJSON。ビルド不要・依存パッケージなしで、そのままGitHubリポジトリ化してデプロイできます。

## 中身

```
site/
  index.html          … ページ本体（マークアップ＋インラインスタイル）
  app.js              … 表示ロジック（データ反映・年切替・スクロールアニメーション）
  data/ev-sales.json  … ★データの唯一の情報源。更新はここだけ
reference/
  EV Makers Infographic.dc.html … 元のデザインプロトタイプ（参照用・デプロイ対象外）
  support.js                    … 上記プロトタイプの実行に必要なランタイム
.github/workflows/deploy.yml    … GitHub Pages へ自動デプロイ
```

`site/` の3ファイルが本番成果物です。`reference/` はデザインの原本で、デプロイには不要です。

## ローカル確認

`app.js` が `fetch` でJSONを読むため、`file://` の直接オープンでは動きません（CORSで弾かれ、初期値のまま表示されます）。簡易サーバーを使ってください。

```bash
cd site
npx serve .        # または: python3 -m http.server 8000
```

## リポジトリ化

リポジトリ名 `who_is_EV_Top` / 非公開（Private）で作成します。

```bash
cd design_handoff_ev_infographic
git init -b main
git add .
git commit -m "feat: EV maker adoption infographic"
gh repo create who_is_EV_Top --private --source=. --push
# gh が無い場合: GitHub で空のプライベートリポジトリを作成し
# git remote add origin git@github.com:h-ogawa0214/who_is_EV_Top.git
# git push -u origin main
```

## デプロイ

**推奨: Vercel**（プライベートリポジトリのまま無料で公開できる）

```bash
npx vercel --cwd site
# 2回目以降の本番反映: npx vercel --cwd site --prod
```
ダッシュボードからGitHub連携する場合は Root Directory に `site`、Framework Preset は **Other**、ビルドコマンドは空。`main` へのpushで自動更新されます。

**Netlify も同様**: Publish directory `site` / Build command 空。

**GitHub Pages**（`.github/workflows/deploy.yml` を同梱済み）
Settings → Pages → Source を **GitHub Actions** に変更するだけで `main` のpushごとに `site/` が公開されます。ただし**プライベートリポジトリからのPages公開は GitHub Pro / Team 以上が必要**です。無料プランのままなら Vercel を使うか、リポジトリをPublicにしてください。

いずれも静的ホスティングなのでビルド設定は不要です。

## データの更新フロー

`site/data/ev-sales.json` を編集してcommit/push → 数十秒で反映。コードは触りません。

| キー | 内容 |
| --- | --- |
| `meta.latestYear` | 初期表示する年 |
| `meta.trendMax` | 推移グラフのY軸上限（万台） |
| `meta.note` | フッターの注記 |
| `makers` | メーカーID → `name` / `origin` / `color` |
| `years` | `"2025": { "byd": 226.0, ... }` 年×メーカーの販売台数（万台）。年を足せば切替ボタンの年・グラフの目盛りも自動追従 |
| `kpis` | 冒頭4枚のカウントアップ数値（`value` / `decimals`） |
| `share` | ワッフルチャート（100マス）と凡例。`pct` の合計を100にする |
| `regions` | 地域別の棒グラフ（4項目） |
| `models` | 車種別トップ5（`name` / `value`） |

注意点：
- `years` のメーカーIDは `makers` のキーと一致させる。ランキングの8行は `index.html` の `data-bar` 属性に対応しており、**メーカーを増減する場合はHTML側の行も増減が必要**（色のグラデーションが各行にインラインで入っているため）。
- `share` は100マスを塗り分けるので `pct` は整数・合計100。
- `regions` `models` は表示行数が `index.html` 側の要素数（4件・5件）に固定。件数を変えるならHTMLも合わせる。

### 自動取得について
世界のBEV販売台数は SNE Research / Counterpoint / Rho Motion などの有償調査が主で、無料の公開APIがありません。完全自動化は現実的ではないため、次のいずれかを推奨します。

1. 四半期ごとに手動でJSONを更新（もっとも確実）
2. テスラ・BYDなど主要各社のIR発表のみスクリプトで取得し、残りは手入力。GitHub Actionsの定期実行でPRを自動作成する形にすると差分レビューができる

## デザイン仕様

**忠実度**: ハイファイ（本番想定の色・字送り・アニメーションを含む）。

**タイポグラフィ**
- 和文・本文: Noto Sans JP（400/500/700/900）
- 数値・欧文ラベル: Space Grotesk（400/500/700）
- 見出しは `font-weight: 900` / `letter-spacing: -.02em`〜`-.03em`、`clamp()` で流動
- 小見出しラベル（`01 — RANKING` 等）は11px / `letter-spacing: .26em`

**カラー**
| 用途 | 値 |
| --- | --- |
| 背景 | `#07090d`（セクション交互に `#090c11`） |
| パネル | `#0b0f15` / `#0e1218` |
| 罫線 | `#1a212b` |
| 本文 | `#eef2f7` / 副 `#a9b5c5` / 補助 `#8b97a8` / 最小 `#6f7c8d` |
| アクセント | `#c6f24e` |
| メーカー色 | BYD `#3ddc97` / テスラ `#e8503a` / 吉利 `#5aa9ff` / VW `#a78bfa` / 上汽 `#ffcf5c` / 長安 `#ff9ecb` / 現代起亜 `#58e0e8` / BMW `#b9c4d4` / その他 `#232c39` |

**セクション構成**
1. ヒーロー（大見出し＋リード＋KPIカード4枚のカウントアップ、背景の発光円が7〜9秒で明滅）
2. 流れるティッカー（34秒ループ、両端をmaskでフェード）
3. `01 RANKING` — メーカー別横棒8本。年ボタンで値・順位・国ラベルが更新され、行が `translateY` で並び替わる（0.7s `cubic-bezier(.22,1,.36,1)`）
4. `02 TREND` — 推移の折れ線4本。`stroke-dashoffset` で1.7秒かけて描画、終点の丸と数値が遅れて出る
5. `03 SHARE` — 100マスのワッフルチャート（1マス=1%）＋凡例
6. `04 REGION` / `05 MODELS` — 地域別縦棒とランキングリスト
7. フッター（注記・出典）

**アニメーション**
- スクロールで `IntersectionObserver`（threshold 0.12 / 下端 -8%）が発火し、`data-anim` の種別ごとにキーフレームを付与。同種要素は45msずつ遅延（上限0.9s）
- 種別: `up`（フェードアップ 0.85s）/ `pop`（0.55s バウンス）/ `barx` `bary`（棒の伸長 ~1s）/ `draw`（線描画 1.7s）/ `fade`
- `prefers-reduced-motion: reduce` で全て即時表示に切り替わる
- IOが動かない環境向けに1.6秒後の強制表示フォールバックあり

**レスポンシブ**
すべて `clamp()` とauto-fitグリッドで可変。固定幅なし。折れ線グラフのみ `viewBox="0 0 1000 400"` のSVGで等比縮小。

## 他フレームワークへ移植する場合
`site/` はプレーンなHTML/JSなので、React等へ移す場合は `index.html` の各セクションをコンポーネントに分割し、`app.js` のデータ反映処理（`apply` / `renderTrend` 等）をpropsからの描画に置き換えてください。DOM直接操作は「ストリーミング表示を止めないため」の設計で、移植先では不要です。折れ線のパス計算式（`x = 80 + 880/(n-1)*i`、`y = 340 - v/trendMax*280`）はそのまま使えます。

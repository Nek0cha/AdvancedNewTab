# AdvancedNewTab 紹介サイト（静的サイト）

拡張機能本体とは独立した、ビルド不要のプレーンなHTML/CSSサイトです。GitHub Pagesなどにそのまま置けます。

## デザイン

見た目は [`design.md`](design.md) にロックされたデザインシステム（Hallmark · genre: playful · theme: Hum）
に従っている。ページを足す/直すときは必ず `design.md` を先に読み、そこにあるトークン・声色を使うこと。

## 中身

- `index.html` — ランディングページ（Workbenchマクロ構造。機能紹介・インストール手順）
- `terms.html` — 利用規約（Long Documentマクロ構造。**プレースホルダー**）
- `privacy.html` — プライバシーポリシー（Long Documentマクロ構造。**プレースホルダー**。データの取り扱いに関する記述はソースコードの実際の挙動に基づいて書いていますが、公開前に見直してください）
- `design.md` — ロックされたデザインシステム（トークン値・マクロ構造・声色の一次情報源）
- `assets/tokens.css` — `design.md` の値を反映したCSSカスタムプロパティ
- `assets/style.css` — 共通スタイル
- `assets/icon/` — 拡張機能本体のアイコン（`public/icon/`からのコピー）をブランドマークとして使用
- `app/` — **ビルド生成物**（下記「ブラウザ版（`app/`）」参照）。手で編集しない

## ブラウザ版（`app/`）

拡張機能をインストールせず、ブラウザだけでダッシュボードを試せるWeb版。壁紙・スタートページ代わりの用途を想定している。
リポジトリ直下で以下を実行すると、`entrypoints/newtab` と全く同じアプリ（`lib/`・`components/`・`widgets/`を共有）が
`vite.web.config.ts` によって `site/app/` にビルドされる。

```bash
npm run build:web
```

- データは訪れたブラウザの `localStorage` に保存される。拡張機能版の `chrome.storage.local` とは別管理で、
  相互に同期しない（端末間の移行は拡張機能版と同じくoptionsページのJSONエクスポート/インポートを使う）
- `よく使うサイト` / `ブックマーク` / `YouTubeミニプレーヤー` / `RSSフィード` は、ブラウザ拡張機能APIに
  依存するためWeb版では追加ダイアログに出ない（`widgets/registry.ts` が `import.meta.env.VITE_TARGET`
  でビルド時に除外している）
- アセット参照はすべて相対パス（`base: './'`）でビルドしている。`site/` をドメイン直下に置こうが、
  GitHub Pagesのプロジェクトページ（`https://<user>.github.io/<repo>/` のようにリポジトリ名が
  前段に付くURL）やさらに別のサブパスに置こうが、置いた場所を基準にそのまま動く
- `npm run build:web` は毎回 `site/app/` の中身をまるごと置き換える。実際のビルドは一時ディレクトリに
  対して行い、成功したら `site/app/` へアトミックに差し替える（`scripts/build-web.mjs`）。ビルド後の
  `site/app/` が中途半端な状態になることはない

## 公開前にやること

1. `index.html` / `terms.html` / `privacy.html` 内の `https://github.com/Nek0cha/AdvancedNewTab` を実際のリポジトリURLに置き換える
2. `terms.html` / `privacy.html` の内容を、専門家のレビューも含めて見直す
3. リポジトリ直下の `LICENSE`（MIT）が実在することを確認する

## GitHub Pagesで公開する場合

1. このリポジトリの Settings → Pages で、公開元をこの `site/` ディレクトリ（または `gh-pages` ブランチにコピーしたもの）に設定する
2. もしくは、このディレクトリの中身だけを別リポジトリ（例: `Nek0cha.github.io`）にコピーして公開する

いずれの場合も、`AdvancedNewTab/`（拡張機能本体）とは無関係にデプロイできます。

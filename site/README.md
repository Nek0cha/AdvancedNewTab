# AdvancedNewTab 紹介サイト（静的サイト）

拡張機能本体とは独立した、ビルド不要のプレーンなHTML/CSSサイトです。GitHub Pagesなどにそのまま置けます。

## 中身

- `index.html` — ランディングページ（機能紹介・インストール手順）
- `terms.html` — 利用規約（**プレースホルダー**）
- `privacy.html` — プライバシーポリシー（**プレースホルダー**。データの取り扱いに関する記述はソースコードの実際の挙動に基づいて書いていますが、公開前に見直してください）
- `assets/style.css` — 共通スタイル

## 公開前にやること

1. `index.html` / `terms.html` / `privacy.html` 内の `https://github.com/Nek0cha/AdvancedNewTab` を実際のリポジトリURLに置き換える
2. `index.html` の「スクリーンショット（プレースホルダー）」を実際のキャプチャ画像に差し替える
3. `terms.html` / `privacy.html` の内容を、専門家のレビューも含めて見直す
4. リポジトリ直下の `LICENSE`（MIT）が実在することを確認する

## GitHub Pagesで公開する場合

1. このリポジトリの Settings → Pages で、公開元をこの `site/` ディレクトリ（または `gh-pages` ブランチにコピーしたもの）に設定する
2. もしくは、このディレクトリの中身だけを別リポジトリ（例: `Nek0cha.github.io`）にコピーして公開する

いずれの場合も、`AdvancedNewTab/`（拡張機能本体）とは無関係にデプロイできます。

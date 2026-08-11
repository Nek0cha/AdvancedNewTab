/**
 * 壁紙・スタートページ用途の静的サイト版（`npm run build:web`）専用のビルド設定。
 *
 * WXTの拡張機能ビルド（wxt.config.ts）とは完全に独立した、素のVite設定。
 * entrypoints/newtab のReactアプリ（App・widgets・lib・components）をそのまま再利用しつつ、
 * chrome拡張機能API（manifest・permissions・chrome.storage 等）には一切依存しないビルドを
 * `site/app/` に出力する。GitHub Pages想定の `site/`（site/README.md 参照）にそのまま
 * 同梱され、ブラウザだけでアクセスできる。
 *
 * `import.meta.env.VITE_TARGET = 'web'` を widgets/registry.ts が参照し、ブラウザAPI
 * 依存のウィジェット（よく使うサイト・ブックマーク・YouTubeミニプレーヤー・RSS）を
 * 登録から除外する。
 *
 * build.outDir はここでは既定値のまま持たせず、実際の値は scripts/build-web.mjs が
 * 呼び出し時に上書きする（一時ディレクトリへビルドしてから site/app/ へアトミックに
 * 差し替える方式。理由はそちらのコメント参照）。
 */
import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // wxt.config.ts / tsconfig.json と同じ '@' → プロジェクトルート。
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  // root を webapp/ 自体にすることで、ビルド後の index.html が site/app/index.html
  // （webapp/ 配下にネストされない）直下に出力される。
  root: fileURLToPath(new URL('./webapp', import.meta.url)),
  // publicDir の既定値は root（= webapp/）基準になってしまうため、拡張機能版と共有する
  // プロジェクト直下の public/（boot.js・フォント）を明示的に指定する。
  publicDir: fileURLToPath(new URL('./public', import.meta.url)),
  // 相対パスにしておく。ドメイン直下の site/ を「/app/」という決め打ちのサブパスで
  // 公開する前提を置くと、GitHub Pagesのプロジェクトページ（リポジトリ名が前段に付く
  // URL）やローカルでファイルを直接開いた場合にアセット参照が解決できず、真っ白な
  // 画面になる（アセット取得が軒並み404になりReactが何も描画できない）。相対パスなら
  // site/ 直下だろうが site/app/ のさらに下位だろうが、置いた場所を基準に解決される。
  base: './',
  define: {
    'import.meta.env.VITE_TARGET': JSON.stringify('web'),
  },
});

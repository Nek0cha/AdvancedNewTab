/**
 * 実行環境がChrome拡張機能（MV3のnewtab/optionsページ等）かどうかを判定する。
 *
 * このプロジェクトのソースは、拡張機能ビルド（wxt build）だけでなく、壁紙・スタート
 * ページ用途の静的サイトビルド（`npm run build:web`、entrypoints/webapp）でも
 * そのまま使い回している（README参照）。`chrome.storage`/`chrome.permissions` 等の
 * 拡張機能専用APIは後者の文脈には存在しないため、lib/storage.ts・lib/favicon.ts・
 * lib/permissions.ts はここを分岐点にして、素のブラウザでも壊れずに動く代替実装へ切り替える。
 *
 * `chrome`（および WXT が提供する `browser`）はアンビエント宣言された拡張機能専用の
 * グローバルで、拡張機能ページ以外（一般のWebページ、あるいはWXTを介さない
 * vite.web.config.ts のビルド）には存在しない。裸の識別子として参照すると
 * 存在しない環境で ReferenceError になりうるため、`globalThis` 経由のプロパティ
 * アクセスで安全に存在確認する。
 */
export function isExtensionContext(): boolean {
  const g = globalThis as unknown as { chrome?: { runtime?: { id?: string } } };
  return typeof g.chrome?.runtime?.id === 'string';
}

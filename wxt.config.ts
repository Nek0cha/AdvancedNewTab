import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  // newtab/options 間で共有される非同期チャンク（例: lucide-react の Download アイコン）に対し、
  // Viteが既定で <link rel="modulepreload" crossorigin> を各HTMLへ自動挿入する。
  // 拡張機能ページ（chrome-extension://）ではこのcrossorigin付きmodulepreloadが
  // Chromeの「cross-world extension resource mismatch」判定に引っかかり、
  // 実害はないものの「プリロードされたが使われなかった」という警告がコンソールに出続ける。
  // モジュール自体は import 時に通常どおり取得されるため、プリロードヒント自体を止めて
  // 警告の発生源を断つ（パフォーマンス上のデメリットはこの規模のアプリでは無視できる）。
  vite: () => ({
    build: { modulePreload: false },
  }),
  manifest: {
    name: 'AdvancedNewTab',
    description: 'ウィジェットを自由に配置できる、カスタマイズ可能な新規タブページ',

    // 必須権限は「インストール時に警告が出ないもの」だけに絞っている。
    // ユーザーデータへのアクセスを伴う権限はすべて optional_permissions 側に置き、
    // 該当ウィジェットを配置した瞬間に chrome.permissions.request() で要求する。
    // （lib/permissions.ts 参照）
    permissions: [
      'storage',
      'unlimitedStorage', // 背景画像を dataURL で保持する場合に 10MB 制限を超えるため
      'favicon', // リンクウィジェットのアイコン取得（MV3の _favicon API）
      'alarms', // 外部データの定期取得
      // 'scripting' はAPIの存在自体を許可するだけで、対象サイトへのアクセス権が
      // 無ければ何もできないため、インストール時の警告対象にはならない。
      // YouTube/YouTube Musicミニプレーヤーが optional_host_permissions 許可後に
      // content script を実行時登録するために使う（entrypoints/background.ts 参照）。
      'scripting',
    ],
    optional_permissions: ['topSites', 'bookmarks', 'history', 'sessions'],
    optional_host_permissions: ['https://*/*'],
    // options_ui はここでは指定しない： WXTは options エントリーポイントを検出すると
    // manifest.options_ui を自前で（丸ごと）生成し直すため、ここに書いても黙って上書きされる。
    // 「独立したタブで開く」（open_in_tab）は entrypoints/options/index.html の
    // <meta name="manifest.open_in_tab" content="true"> 側で指定すること。

    // default_popup を設定しないことで action.onClicked を発火させ、
    // ツールバーアイコンのワンクリックで設定画面を開けるようにする（background.ts 参照）
    action: {
      default_title: 'AdvancedNewTab - 設定を開く',
    },
  },
});

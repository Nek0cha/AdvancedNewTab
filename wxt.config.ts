import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
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
    // エクスポート/インポートなど内容量のあるページのため、埋め込みポップアップではなく
    // 独立したタブで開く
    options_ui: { page: 'options.html', open_in_tab: true },

    // default_popup を設定しないことで action.onClicked を発火させ、
    // ツールバーアイコンのワンクリックで設定画面を開けるようにする（background.ts 参照）
    action: {
      default_title: 'AdvancedNewTab - 設定を開く',
    },
  },
});

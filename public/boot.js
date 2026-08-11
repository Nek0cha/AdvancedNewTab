/**
 * FOUC（新規タブを開いた瞬間の白い一瞬）対策。
 *
 * chrome.storage.local は非同期APIのため、読み込みが終わるまで背景が白のままになる。
 * ダークテーマだと新規タブを開くたびに画面が白く光り、体感品質を大きく損なう。
 *
 * そこで直近のテーマ値を localStorage（同期API）にミラーしておき、
 * このスクリプトが HTML のパースをブロックしたまま同期的に背景を塗る。
 *
 * 【このファイルが public/ にある理由】
 * Manifest V3 の拡張機能ページは CSP が script-src 'self' 固定でインラインスクリプトを
 * 実行できない。一方 Vite が扱う <script type="module"> は defer 相当で描画前実行を保証できない。
 * public/ に置いた素のJSを type="module" なしで読み込むことで、
 * 「CSP準拠」かつ「同期実行」の両方を満たしている。バンドル対象外なので TypeScript ではない。
 *
 * キー名と値の形は lib/types.ts の BOOT_THEME_KEY / BootTheme と対応している。
 */
(function () {
  'use strict';

  var KEY = 'ant:boot-theme';

  try {
    var raw = window.localStorage.getItem(KEY);
    if (!raw) return;

    var theme = JSON.parse(raw);
    var root = document.documentElement;

    if (typeof theme.background === 'string') {
      // background ショートハンドは background-size 等をリセットするため、必ず先に当てる
      root.style.background = theme.background;
      root.style.backgroundAttachment = 'fixed';
      root.style.backgroundSize = 'cover';
      root.style.backgroundPosition = 'center';
    }
    if (typeof theme.color === 'string') {
      root.style.color = theme.color;
    }
  } catch (error) {
    // ミラーが壊れていても通常の非同期読み込みで復帰できるため、握りつぶしてよい
  }
})();

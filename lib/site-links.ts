/**
 * 紹介サイト（site/）を newtab.ny4n.net として公開する前提で組み立てた外部リンク集。
 *
 * 拡張機能側（見た目タブ）から利用規約・プライバシーポリシー・ホームページへ
 * リンクしておく必要があるため、URLをここにまとめている。ドメインが変わる場合は
 * ここ1箇所を直せばよい。
 *
 * site/terms.html・site/privacy.html は `/terms`・`/privacy`（拡張子なし）で
 * アクセスできるよう、それぞれ site/terms/index.html・site/privacy/index.html
 * に配置している（site/app/ と同じ、静的ホスティングのディレクトリ index 規約）。
 */
const SITE_ORIGIN = 'https://newtab.ny4n.net';

// Chrome Web Storeの共有リンクに付く `?utm_source=item-share-cb` はストア側の
// 共有ボタン由来のトラッキングパラメータで、ストアIDの特定には不要なため
// 含めていない（正規のリスティングURLはIDだけで一意に決まる）。
export const CHROME_WEB_STORE_URL =
  'https://chromewebstore.google.com/detail/hhjgbgbnehbodbilpibfaiccpniimjaa';

export const SITE_LINKS = {
  home: SITE_ORIGIN,
  terms: `${SITE_ORIGIN}/terms`,
  privacy: `${SITE_ORIGIN}/privacy`,
} as const;

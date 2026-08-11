/**
 * 紹介サイト（site/）を newtab.ny4n.net として公開する前提で組み立てた外部リンク集。
 *
 * まだ実際にドメインの用意やChrome Web Storeへの公開を決めたわけではないが、
 * 拡張機能側（見た目タブ）から利用規約・プライバシーポリシー・ホームページへ
 * リンクしておく必要があるため、URLだけ先に定義しておく。ドメインが変わる場合は
 * ここ1箇所を直せばよい。
 *
 * site/terms.html・site/privacy.html は `/terms`・`/privacy`（拡張子なし）で
 * アクセスできるよう、それぞれ site/terms/index.html・site/privacy/index.html
 * に配置している（site/app/ と同じ、静的ホスティングのディレクトリ index 規約）。
 */
const SITE_ORIGIN = 'https://newtab.ny4n.net';

export const SITE_LINKS = {
  home: SITE_ORIGIN,
  terms: `${SITE_ORIGIN}/terms`,
  privacy: `${SITE_ORIGIN}/privacy`,
} as const;

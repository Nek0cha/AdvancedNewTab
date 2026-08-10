/**
 * ThemeConfig を実際のCSSへ落とし込む層。
 *
 * テーマ値はすべて CSS カスタムプロパティ経由で配布し、各コンポーネントは
 * var(--ant-*) だけを参照する。これによりテーマ変更が「変数の差し替え1本」で済む。
 */

import { hexToRgbString } from '@/lib/color';
import { getFontStack } from '@/lib/fonts';
import {
  BOOT_THEME_KEY,
  type BackgroundConfig,
  type BootTheme,
  type ThemeConfig,
} from '@/lib/types';

/**
 * localStorage にミラーする dataURL の上限。
 * localStorage は概ね5MB程度で、超過すると QuotaExceededError で書き込み全体が失敗する。
 * 大きな画像はミラーせず fallbackColor だけを先に描かせる方針とする。
 */
const MAX_MIRRORED_IMAGE_LENGTH = 100_000;

/** 現在アクティブな方式の設定値だけを取り出す。 */
function activeBackground(bg: BackgroundConfig): { css: string; overlay: { blur: number; dim: number } | null } {
  switch (bg.active) {
    case 'solid':
      return { css: bg.solid.color, overlay: null };
    case 'gradient':
      return {
        css: `linear-gradient(${bg.gradient.angle}deg, ${bg.gradient.from}, ${bg.gradient.to})`,
        overlay: null,
      };
    case 'image':
      return { css: bg.image.fallbackColor, overlay: { blur: bg.image.blur, dim: bg.image.dim } };
  }
}

/** 背景設定を html 要素の background ショートハンド値へ変換する。 */
export function backgroundToCss(bg: BackgroundConfig): string {
  return activeBackground(bg).css;
}

/**
 * 初回ペイント用にミラーする値を組み立てる。
 *
 * 画像背景の場合、src が十分に短いときだけ画像込みでミラーする。
 * 長い dataURL は下地の色のみとし、画像は React マウント後に載せる
 * （白い一瞬は防げるので、体感上の目的は達成できる）。
 */
export function toBootTheme(theme: ThemeConfig): BootTheme {
  const bg = theme.background;
  let background = backgroundToCss(bg);

  if (bg.active === 'image' && bg.image.src && bg.image.src.length <= MAX_MIRRORED_IMAGE_LENGTH) {
    background = `${bg.image.fallbackColor} url("${bg.image.src}") center / cover no-repeat fixed`;
  }

  return { mode: theme.mode, background, color: theme.textColor };
}

/** boot.js が次回起動時に読むミラーを更新する。 */
export function writeBootThemeMirror(theme: ThemeConfig): void {
  try {
    localStorage.setItem(BOOT_THEME_KEY, JSON.stringify(toBootTheme(theme)));
  } catch {
    // 容量超過などで書けなくても初回ペイントが少し鈍るだけなので、通常動作は継続する
  }
}

const CUSTOM_FONT_STYLE_ID = 'ant-custom-font-style';

/** カスタムフォントの @font-face を <style> として注入/更新する。 */
function applyCustomFontFace(theme: ThemeConfig): void {
  let styleEl = document.getElementById(CUSTOM_FONT_STYLE_ID) as HTMLStyleElement | null;

  if (theme.canvasFontId !== 'custom' || !theme.customFont) {
    styleEl?.remove();
    return;
  }

  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = CUSTOM_FONT_STYLE_ID;
    document.head.appendChild(styleEl);
  }

  const { familyName, dataUrl, format } = theme.customFont;
  styleEl.textContent = `@font-face { font-family: '${familyName}'; src: url('${dataUrl}') format('${format}'); font-display: swap; }`;
}

/** 現在のテーマが指す実際の font-family 値（キャンバス用）を返す。 */
export function resolveCanvasFontStack(theme: ThemeConfig): string {
  if (theme.canvasFontId === 'custom' && theme.customFont) {
    return `'${theme.customFont.familyName}', ${getFontStack('system')}`;
  }
  return getFontStack(theme.canvasFontId);
}

/** テーマを実DOMへ適用する。boot.js が先に当てた暫定値をここで正データに上書きする。 */
export function applyTheme(theme: ThemeConfig): void {
  const root = document.documentElement;
  const boot = toBootTheme(theme);

  root.setAttribute('data-theme', theme.mode);
  root.style.background = boot.background;
  root.style.backgroundAttachment = 'fixed';
  root.style.backgroundSize = 'cover';
  root.style.backgroundPosition = 'center';
  root.style.color = boot.color;

  applyCustomFontFace(theme);

  const s = root.style;
  s.setProperty('--ant-text', theme.textColor);
  s.setProperty('--ant-accent', theme.accentColor);
  s.setProperty('--ant-accent-ring', `color-mix(in oklab, ${theme.accentColor} 38%, transparent)`);
  s.setProperty('--ant-canvas-font', resolveCanvasFontStack(theme));
  s.setProperty('--ant-card-opacity', String(theme.cardOpacity));
  s.setProperty('--ant-card-blur', `${theme.cardBlur}px`);
  s.setProperty('--ant-card-radius', `${theme.cardRadius}px`);
  s.setProperty('--ant-card-border-width', `${theme.cardBorderWidth}px`);

  // カード面・フォーム部品の色はテーマモードから導出する（アプリのUIクロム全般が
  // この --ant-card-base に乗っかっているため、ここはユーザーの cardColor では
  // 変えない。ボタン・ドロップダウン・メニュー・スクロールバーまで巻き込んで
  // 全部の色が変わってしまう）。
  const cardBase = theme.mode === 'dark' ? '255, 255, 255' : '18, 16, 14';
  s.setProperty('--ant-card-base', cardBase);
  s.setProperty('--ant-card-bg', `rgba(${cardBase}, ${theme.cardOpacity * (theme.mode === 'dark' ? 0.14 : 0.08)})`);
  s.setProperty('--ant-card-border', `rgba(${cardBase}, ${theme.mode === 'dark' ? 0.16 : 0.14})`);

  // ウィジェットカード自体の背景色だけは theme.cardColor でユーザーが変えられる
  // （見た目タブ「ウィジェットカードの背景色」）。components/WidgetFrame の .card が
  // --ant-card-bg/--ant-card-border ではなくこちらを参照する。
  const widgetCardBase = hexToRgbString(theme.cardColor);
  s.setProperty(
    '--ant-widget-card-bg',
    `rgba(${widgetCardBase}, ${theme.cardOpacity * (theme.mode === 'dark' ? 0.14 : 0.08)})`,
  );
  s.setProperty('--ant-widget-card-border', `rgba(${widgetCardBase}, ${theme.mode === 'dark' ? 0.16 : 0.14})`);
  s.setProperty('--ant-muted', theme.mode === 'dark' ? 'rgba(241, 236, 236, 0.6)' : 'rgba(38, 32, 28, 0.62)');

  // フォーム部品（Dropdown/ColorPicker等）用トークン。カードよりわずかに濃く、判読性を優先する。
  s.setProperty('--ant-field-bg', `rgba(${cardBase}, ${theme.mode === 'dark' ? 0.1 : 0.06})`);
  s.setProperty('--ant-field-bg-hover', `rgba(${cardBase}, ${theme.mode === 'dark' ? 0.16 : 0.1})`);
  s.setProperty('--ant-field-border', `rgba(${cardBase}, ${theme.mode === 'dark' ? 0.22 : 0.18})`);
  s.setProperty('--ant-field-border-hover', theme.accentColor);
  s.setProperty('--ant-field-radius', '10px');
  // ポップオーバー（ドロップダウン/カラーピッカー）は判読性優先でカード面より不透明度を上げる
  s.setProperty('--ant-menu-bg', theme.mode === 'dark' ? 'rgba(24, 21, 19, 0.92)' : 'rgba(252, 249, 244, 0.94)');

  document.title = theme.tabTitle || '新しいタブ';

  writeBootThemeMirror(theme);
}

/**
 * 画像背景のオーバーレイ（ぼかし・暗転）に使う値。
 * 背景画像そのものは html に敷き、その上に固定オーバーレイを重ねて調整する。
 */
export function imageOverlayStyle(bg: BackgroundConfig): {
  backdropFilter: string;
  background: string;
} | null {
  const { overlay } = activeBackground(bg);
  if (!overlay) return null;
  return {
    backdropFilter: overlay.blur > 0 ? `blur(${overlay.blur}px)` : 'none',
    background: `rgba(0, 0, 0, ${overlay.dim})`,
  };
}

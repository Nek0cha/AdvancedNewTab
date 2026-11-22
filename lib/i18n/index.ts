import { create } from 'zustand';

import de from './messages/de';
import en from './messages/en';
import es from './messages/es';
import fr from './messages/fr';
import ko from './messages/ko';
import ptBR from './messages/pt-BR';
import zhCN from './messages/zh-CN';
import zhTW from './messages/zh-TW';
import { LOCALES, type Locale, type LocaleSetting } from './locales';

export { LOCALES, type Locale, type LocaleSetting } from './locales';

/**
 * 翻訳は「日本語の原文そのものをキーにする」方式にしている。
 * ウィジェットの settingsSchema やテーマのスキーマはモジュール読み込み時に確定する静的な
 * 宣言なので、そこへ翻訳関数の呼び出しを埋め込むと言語切り替えに追従できない。
 * 定義側は日本語のまま残し、描画する側（Field.tsx など）で t() を通すことで、
 * 静的な宣言を一切書き換えずに多言語化できる。未訳の文字列は日本語のまま表示される。
 */
const DICTIONARIES: Record<Exclude<Locale, 'ja'>, Record<string, string>> = {
  en,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  ko,
  es,
  fr,
  de,
  'pt-BR': ptBR,
};

/** ブラウザの言語タグ（例: 'en-US', 'zh-Hant-TW'）を対応言語へ寄せる。対応外は英語。 */
export function detectLocale(tags: ReadonlyArray<string> = navigator.languages ?? [navigator.language]): Locale {
  for (const raw of tags) {
    const tag = raw.toLowerCase();
    if (tag.startsWith('zh')) {
      return /(-tw|-hk|-mo|-hant)/.test(tag) ? 'zh-TW' : 'zh-CN';
    }
    if (tag.startsWith('pt')) return 'pt-BR';
    const base = tag.split('-')[0];
    const hit = LOCALES.find((l) => l.id === base);
    if (hit) return hit.id;
  }
  return 'en';
}

export function resolveLocale(setting: LocaleSetting | undefined): Locale {
  return !setting || setting === 'auto' ? detectLocale() : setting;
}

/**
 * 現在の表示言語。アプリ本体の Zustand ストアとは別に持っている。
 * lib/theme.ts の applyTheme() から更新するため、i18n が lib/store.ts を import すると
 * store → theme → i18n → store の循環になってしまう。
 */
const useLocaleStore = create<{ locale: Locale }>(() => ({ locale: detectLocale() }));

export function setActiveLocale(setting: LocaleSetting | undefined): void {
  const locale = resolveLocale(setting);
  if (useLocaleStore.getState().locale === locale) return;
  useLocaleStore.setState({ locale });
  document.documentElement.lang = locale;
}

export function getActiveLocale(): Locale {
  return useLocaleStore.getState().locale;
}

export type TranslateVars = Record<string, string | number>;

function format(text: string, vars?: TranslateVars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}

/**
 * React の外（イベントハンドラ、confirm() の文言など）で使う翻訳関数。
 * 差し込みは `{name}` 形式（例: translate('{count}件', { count: 3 })）。
 */
export function translate(text: string, vars?: TranslateVars, locale: Locale = getActiveLocale()): string {
  if (locale === 'ja') return format(text, vars);
  return format(DICTIONARIES[locale][text] ?? text, vars);
}

/** コンポーネント内で使う翻訳関数。言語が切り替わると再描画される。 */
export function useT(): (text: string, vars?: TranslateVars) => string {
  const locale = useLocaleStore((s) => s.locale);
  return (text, vars) => translate(text, vars, locale);
}

/** 日付・数値の Intl 系 API に渡すロケール文字列 */
export function useIntlLocale(): Locale {
  return useLocaleStore((s) => s.locale);
}

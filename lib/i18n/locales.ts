/**
 * 対応言語の一覧。ja が原文（翻訳キーそのもの）で、それ以外は lib/i18n/messages/ に辞書を持つ。
 * label は「その言語自身での名前」にしてある。現在の表示言語が読めない利用者でも
 * 自分の言語を見つけられるよう、言語選択の選択肢だけは翻訳しない。
 */
export const LOCALES = [
  { id: 'ja', label: '日本語' },
  { id: 'en', label: 'English' },
  { id: 'zh-CN', label: '简体中文' },
  { id: 'zh-TW', label: '繁體中文' },
  { id: 'ko', label: '한국어' },
  { id: 'es', label: 'Español' },
  { id: 'fr', label: 'Français' },
  { id: 'de', label: 'Deutsch' },
  { id: 'pt-BR', label: 'Português (Brasil)' },
] as const;

export type Locale = (typeof LOCALES)[number]['id'];
/** 'auto' はブラウザの表示言語に従う */
export type LocaleSetting = 'auto' | Locale;

/**
 * ウィジェットの「個別スタイル」（背景・文字色・アクセントカラー・サブアクセントカラー・太さ）
 * だけを短いコード文字列として書き出し／読み込みするための変換。
 *
 * ウィジェット固有の設定（タイトル・URL等）は含めない。既知キーの許可リストで絞り込む
 * ことで、書式が壊れたコードや意図しないキーが紛れ込んでも安全に無視できる
 * （options ページの JSON インポート/lib/storage.ts の normalize と同じ「壊れていても
 * 画面を壊さない」方針）。
 */
import { WIDGET_BACKGROUND_DEFAULTS } from '@/lib/widget-background';
import { WIDGET_TEXT_DEFAULTS } from '@/lib/widget-style';

/** コピー対象になるキー一覧（背景の個別スタイル＋文字色/アクセント/サブアクセント/太さの個別スタイル）。 */
const STYLE_KEYS = [...Object.keys(WIDGET_BACKGROUND_DEFAULTS), ...Object.keys(WIDGET_TEXT_DEFAULTS)];

/**
 * このアプリが作ったスタイルコードであることの目印。無関係な文字列を誤って貼り付けたときに
 * 「たまたまBase64として解釈できてしまい、たまたま既知キーが1つ混ざっていたので通ってしまう」
 * という事故を防ぐ（貼り付けミスの検出精度を上げるための簡易な仕組みで、暗号的な検証ではない）。
 */
const CODE_PREFIX = 'ANT-STYLE-1:';

/** モード系フィールドは常に全キー入っているはずなので、これが揃っていることも検証に使う。 */
const REQUIRED_KEYS = ['backgroundMode', 'textMode', 'accentMode', 'subAccentMode', 'weightPreset'] as const;

/** settings から STYLE_KEYS だけを抜き出す。 */
function extractStyleSettings(settings: Record<string, unknown>): Record<string, unknown> {
  const subset: Record<string, unknown> = {};
  for (const key of STYLE_KEYS) subset[key] = settings[key];
  return subset;
}

/** UTF-8文字列をBase64へ（絵文字等が万一混ざっても壊れないように経由する）。 */
function utf8ToBase64(input: string): string {
  return btoa(encodeURIComponent(input).replace(/%([0-9A-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))));
}

/** utf8ToBase64 の逆変換。 */
function base64ToUtf8(input: string): string {
  const binary = atob(input);
  return decodeURIComponent(Array.from(binary, (c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''));
}

/**
 * ウィジェットの個別スタイルを、コピー&貼り付けできる短い文字列に変換する。
 */
export function encodeStyleCode(settings: Record<string, unknown>): string {
  return CODE_PREFIX + utf8ToBase64(JSON.stringify(extractStyleSettings(settings)));
}

/**
 * encodeStyleCode() で作られたコードを読み戻す。プレフィックスが無い・壊れている・
 * モード系キーが揃っていない場合は null を返す（呼び出し側は「読み取れませんでした」と表示する）。
 */
export function decodeStyleCode(code: string): Record<string, unknown> | null {
  const trimmed = code.trim();
  if (!trimmed.startsWith(CODE_PREFIX)) return null;

  try {
    const parsed: unknown = JSON.parse(base64ToUtf8(trimmed.slice(CODE_PREFIX.length)));
    if (!parsed || typeof parsed !== 'object') return null;
    if (!REQUIRED_KEYS.every((key) => key in (parsed as Record<string, unknown>))) return null;

    const allowed = new Set(STYLE_KEYS);
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (allowed.has(key)) result[key] = value;
    }
    return result;
  } catch {
    return null;
  }
}

/**
 * このウィジェットが背景・文字色・アクセントカラー・サブアクセントカラー・太さの
 * いずれかを「個別に指定」しているか。components/WidgetFrame/WidgetFrame.tsx が、
 * 設定ボタンに気づきやすいバッジを出すかどうかの判定に使う
 * （見た目だけでは個別スタイルが効いているか分からない、というフィードバックへの対応）。
 */
export function isWidgetStyleCustomized(settings: Record<string, unknown>): boolean {
  return (
    settings.backgroundMode === 'custom' ||
    settings.textMode === 'custom' ||
    settings.accentMode === 'custom' ||
    settings.subAccentMode === 'custom' ||
    (typeof settings.weightPreset === 'string' && settings.weightPreset !== 'default')
  );
}

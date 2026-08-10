/** ColorPicker が使う最小限の HSV ⇔ HEX 変換。 */

export interface HSV {
  h: number; // 0-360
  s: number; // 0-1
  v: number; // 0-1
}

export function hexToHsv(hex: string): HSV {
  const parsed = normalizeHex(hex);
  const r = parseInt(parsed.slice(1, 3), 16) / 255;
  const g = parseInt(parsed.slice(3, 5), 16) / 255;
  const b = parseInt(parsed.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
  }
  if (h < 0) h += 360;

  const s = max === 0 ? 0 : delta / max;
  const v = max;

  return { h, s, v };
}

export function hsvToHex({ h, s, v }: HSV): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const toByte = (n: number): string =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, '0');

  return `#${toByte(r)}${toByte(g)}${toByte(b)}`;
}

/** #abc 等の3桁省略形や不正値を #rrggbb 形式へ寄せる。パース失敗時は黒を返す。 */
export function normalizeHex(hex: string): string {
  let value = hex.trim();
  if (!value.startsWith('#')) value = `#${value}`;
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    value = `#${[...value.slice(1)].map((c) => c + c).join('')}`;
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(value)) return '#000000';
  return value.toLowerCase();
}

/**
 * #rrggbb を "r, g, b" のカンマ区切り文字列にする。
 * `rgba(var(--ant-card-base), <opacity>)` のように、CSS変数をrgba()のRGB成分として
 * 埋め込む箇所（lib/theme.ts の --ant-card-base 等）で使う。
 */
export function hexToRgbString(hex: string): string {
  const normalized = normalizeHex(hex);
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

export function isValidHex(hex: string): boolean {
  const value = hex.trim();
  return /^#?[0-9a-fA-F]{3}$/.test(value) || /^#?[0-9a-fA-F]{6}$/.test(value);
}

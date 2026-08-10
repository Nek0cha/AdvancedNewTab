/**
 * 日本の祝日の近似計算。
 *
 * 春分の日・秋分の日は国立天文台の発表を待たないと確定しない値のため、
 * 広く使われている近似式（1980〜2099年で成立するとされる式）で計算している。
 * 振替休日（祝日が日曜と重なったとき、その後の最初の平日を休みにする）にも対応。
 *
 * 対応していないもの:
 * - 2020年（東京五輪特例で海の日/山の日/スポーツの日が移動）・2021年（同）の
 *   祝日移動は反映していない。カレンダーウィジェットの色分けという用途では
 *   実害が小さいため、実装を簡潔に保つことを優先した。
 * - 国民の休日（祝日と祝日に挟まれた平日を休日にする規定）は未対応。
 */

/** 指定月の第n月曜日の「日」を返す（month は 0始まり）。 */
function nthMondayOfMonth(year: number, month: number, nth: number): number {
  const first = new Date(year, month, 1);
  const offsetToMonday = (8 - first.getDay()) % 7;
  return 1 + offsetToMonday + (nth - 1) * 7;
}

/** 春分の日（近似式）。1980〜2099年の範囲で成立するとされる。 */
function vernalEquinoxDay(year: number): number {
  return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

/** 秋分の日（近似式）。1980〜2099年の範囲で成立するとされる。 */
function autumnalEquinoxDay(year: number): number {
  return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function toKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** 年ごとに祝日の一覧を組み立てる（呼び出し側でキャッシュする想定）。 */
function buildYearHolidays(year: number): Map<string, string> {
  const map = new Map<string, string>();
  const add = (month0: number, day: number, name: string): void => {
    map.set(toKey(new Date(year, month0, day)), name);
  };

  add(0, 1, '元日');
  add(0, nthMondayOfMonth(year, 0, 2), '成人の日');
  add(1, 11, '建国記念の日');
  if (year >= 2020) add(1, 23, '天皇誕生日');
  add(2, vernalEquinoxDay(year), '春分の日');
  add(3, 29, '昭和の日');
  add(4, 3, '憲法記念日');
  add(4, 4, 'みどりの日');
  add(4, 5, 'こどもの日');
  add(6, nthMondayOfMonth(year, 6, 3), '海の日');
  add(7, 11, '山の日');
  add(8, nthMondayOfMonth(year, 8, 3), '敬老の日');
  add(8, autumnalEquinoxDay(year), '秋分の日');
  add(9, nthMondayOfMonth(year, 9, 2), 'スポーツの日');
  add(10, 3, '文化の日');
  add(10, 23, '勤労感謝の日');

  // 振替休日: 日曜に重なった祝日の直後の平日（まだ祝日でない日）を休みにする。
  // 元の祝日一覧を確定させてから走査する（振替休日自体が別の振替休日の対象にはならない）。
  for (const [key, name] of [...map.entries()]) {
    void name;
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(y!, m! - 1, d);
    if (date.getDay() !== 0) continue;
    const substitute = new Date(date);
    do {
      substitute.setDate(substitute.getDate() + 1);
    } while (map.has(toKey(substitute)));
    map.set(toKey(substitute), '振替休日');
  }

  return map;
}

const yearCache = new Map<number, Map<string, string>>();

/** 指定日が日本の祝日なら名称を、そうでなければ null を返す。 */
export function getJapaneseHolidayName(date: Date): string | null {
  const year = date.getFullYear();
  let holidays = yearCache.get(year);
  if (!holidays) {
    holidays = buildYearHolidays(year);
    yearCache.set(year, holidays);
  }
  return holidays.get(toKey(date)) ?? null;
}

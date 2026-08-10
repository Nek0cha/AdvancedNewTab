/** クラス名を連結する小さなヘルパー。falsy な値は捨てる。 */
export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

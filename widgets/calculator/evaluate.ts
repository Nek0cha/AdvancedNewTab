/**
 * 「1*2+3=」のような四則演算の文字列を安全に評価する。
 *
 * `eval` / `new Function` は使わない。ユーザー自身が入力した式だけとはいえ、
 * 任意のJSコードを実行できる経路をこのプロジェクトに持ち込みたくないため
 * （lib/icon-value.ts が SVG を dangerouslySetInnerHTML で描画しないのと同じ理由）、
 * 自前の再帰下降パーサで +, -, *, /, %, 括弧, 小数, 単項マイナスだけを解釈する。
 */

// 数値部分はカンマ（桁区切り）を許容する。計算結果を toLocaleString で
// 「1,200」のように桁区切り表示したものが、そのまま次の式の続き（例:
// 「1,200*2」）として再入力・再評価される作りになっているため、ここで
// カンマを弾くと結果に3桁以上の数値が出るたびに続けて計算できなくなる。
const TOKEN_RE = /[\d,]+\.?\d*|\.\d+|[+\-*/%^()]/g;

class ExpressionError extends Error {}

function tokenize(expr: string): string[] {
  const cleaned = expr.replace(/\s+/g, '');
  if (!cleaned) throw new ExpressionError('式が空です');
  const tokens = cleaned.match(TOKEN_RE);
  // マッチした長さの合計が元の文字列長と一致しなければ、未知の文字が混ざっている
  if (!tokens || tokens.join('').length !== cleaned.length) {
    throw new ExpressionError('使用できない文字が含まれています');
  }
  return tokens;
}

/** 再帰下降パーサ。expr → term (('+'|'-') term)* */
function evaluateExpression(expr: string): number {
  const tokens = tokenize(expr);
  let pos = 0;

  const peek = (): string | undefined => tokens[pos];
  const consume = (): string => {
    const token = tokens[pos];
    if (token === undefined) throw new ExpressionError('式が不完全です');
    pos += 1;
    return token;
  };

  function parseExpr(): number {
    let value = parseTerm();
    for (;;) {
      const op = peek();
      if (op !== '+' && op !== '-') break;
      consume();
      const rhs = parseTerm();
      value = op === '+' ? value + rhs : value - rhs;
    }
    return value;
  }

  function parseTerm(): number {
    let value = parseUnary();
    for (;;) {
      const op = peek();
      if (op !== '*' && op !== '/' && op !== '%') break;
      consume();
      const rhs = parseUnary();
      if ((op === '/' || op === '%') && rhs === 0) throw new ExpressionError('0で割ることはできません');
      value = op === '*' ? value * rhs : op === '/' ? value / rhs : value % rhs;
    }
    return value;
  }

  // 単項の +/- は累乗より弱く結びつく（-2^2 は -(2^2) = -4 になる、一般的な数学の慣習）。
  // ^ の右側（指数）では再び符号を許すため parseUnary を再帰させる（2^-1 = 0.5 が書けるように）。
  function parseUnary(): number {
    const token = peek();
    if (token === '-') {
      consume();
      return -parseUnary();
    }
    if (token === '+') {
      consume();
      return parseUnary();
    }
    return parsePower();
  }

  // ^ は右結合: 2^3^2 は 2^(3^2) = 512 であって (2^3)^2 = 64 ではない。
  function parsePower(): number {
    const base = parseFactor();
    if (peek() === '^') {
      consume();
      const exponent = parseUnary();
      return base ** exponent;
    }
    return base;
  }

  function parseFactor(): number {
    if (peek() === '(') {
      consume();
      const value = parseExpr();
      if (consume() !== ')') throw new ExpressionError('括弧が閉じていません');
      return value;
    }
    const numToken = consume();
    // 桁区切りのカンマは数値としての意味を持たないので、Number() に渡す前に取り除く。
    const value = Number(numToken.replace(/,/g, ''));
    if (Number.isNaN(value)) throw new ExpressionError(`不正な数値です: ${numToken}`);
    return value;
  }

  const result = parseExpr();
  if (pos !== tokens.length) throw new ExpressionError('式の末尾に余分な文字があります');
  if (!Number.isFinite(result)) throw new ExpressionError('計算結果が不正です');
  return result;
}

export { ExpressionError, evaluateExpression };

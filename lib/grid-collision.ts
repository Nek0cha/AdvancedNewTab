/**
 * ドロップ確定後のレイアウトから重なりを解消する自前ロジック。
 *
 * react-grid-layout 自体の compactor（verticalCompactor 等）は「配列順に
 * 上から詰め直す」全体コンパクションで、直接ドラッグ操作と無関係なウィジェットまで
 * 動いてしまい、かつ配置順によっては想定より大きくジャンプすることがあった。
 * ここでは「今動かした/リサイズしたウィジェットだけを起点に、実際に重なっている
 * 相手だけを最小移動で押し出す」方式にして、その問題を避けている。
 */

import type { Layout, LayoutItem } from 'react-grid-layout';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * 重なりを解消する。
 *
 * 手順:
 * 1. 今回動かした/リサイズしたウィジェット（movedId）以外は、いったん
 *    「操作を始める前の位置」（before）へ全員戻す。これにより、操作の結果
 *    たまたま重ならなかったウィジェットは自動的に元の位置へ「復帰」する。
 * 2. movedId を起点に、実際に重なっている相手だけを movedId のすぐ下へ
 *    最小移動量で押し出す。押し出された結果さらに別の相手と重なったら、
 *    連鎖的に同じ処理を繰り返す（y は増える一方なので必ず収束する）。
 * 3. `maxRows` を渡した場合は、収束後の最終位置に対して1回だけ「ページ1枚分を
 *    はみ出す分だけ引き戻す」後処理をかける（押し出しの連鎖の途中でこれをやると
 *    「下方向にしか押さない」前提が崩れて正しく押し出せなくなるため、必ず収束後に行う）。
 *
 * `maxRows` を渡すと、はみ出した分の y をページ1枚分の範囲内に収まるようクランプする。
 * ドラッグ・リサイズそのものは react-grid-layout の gridBounds 制約で maxRows を
 * 超えられないようになっているが（Grid.tsx の maxRows コメント参照）、それだけでは
 * 「押し出された側」が連鎖的にページの外まで追いやられるのは防げない
 * （動かした本人は画面内に収まっていても、その分だけ他のウィジェットが下へ
 * 押し出され続け、結果的にページがまた伸びてスクロールが復活してしまう）。
 * 置き場所が本当に無い極端なケースでは重なりが残ることもあるが、
 * 「ページの外まで押し出されて見えなくなる」よりは許容できる妥協としている。
 */
export function resolveOverlaps(
  current: Layout,
  movedId: string,
  before: ReadonlyArray<LayoutItem>,
  maxRows?: number,
): LayoutItem[] {
  const beforeById = new Map(before.map((item) => [item.i, item]));

  const working: LayoutItem[] = current.map((item) => {
    if (item.i === movedId) return { ...item };
    const prev = beforeById.get(item.i);
    return prev ? { ...item, x: prev.x, y: prev.y } : { ...item };
  });

  const maxIterations = working.length + 2;
  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;

    // movedId を最優先の「押す側」とし、それ以外は上（yが小さい方）を優先する。
    const pushers = [...working].sort((a, b) => {
      if (a.i === movedId) return -1;
      if (b.i === movedId) return 1;
      return a.y - b.y || a.x - b.x;
    });

    for (const pusher of pushers) {
      for (const other of working) {
        if (other.i === pusher.i) continue;
        if (!overlaps(pusher, other)) continue;

        // pusher が movedId 本人か、もともと other より上にいた場合だけ押し出す側になる。
        // （両方とも movedId ではない同士がたまたま重なる場合は、より上のものを優先）
        const pusherIsAuthoritative = pusher.i === movedId || pusher.y <= other.y;
        if (!pusherIsAuthoritative) continue;

        const pushedY = pusher.y + pusher.h;
        if (other.y < pushedY) {
          other.y = pushedY;
          changed = true;
        }
      }
    }

    if (!changed) break;
  }

  // 押し出しの連鎖ループの「途中」でこのクランプを混ぜると、クランプ後の位置が
  // 押し出す前の位置より上（小さいy）になり得て「down方向にしか押さない」前提が
  // 崩れ、正しく押し出されないケースがあった。そのため連鎖が収束しきった後に、
  // 最後の後処理として一括で「ページ1枚分（maxRows）をはみ出す分だけ」引き戻す。
  // 置き場所が本当に無い極端なケースでは重なりが残ることもあるが、
  // 「ページの外まで押し出されて見えなくなる」よりは許容できる妥協としている。
  if (maxRows !== undefined) {
    for (const item of working) {
      const maxY = Math.max(0, maxRows - item.h);
      if (item.y > maxY) item.y = maxY;
    }
  }

  return working;
}

/**
 * 現在のレイアウトの中で、実際に重なっている（誰かと重なっている）ウィジェットの
 * `.i` を集めて返す。
 *
 * `resolveOverlaps` の maxRows クランプは「置き場所が本当に無いケースでは重なりが
 * 残ることもある」を許容する設計にしているため、その残った重なりを画面上で
 * 静かに放置せず、警告として見えるようにするために使う（Grid.tsx / WidgetFrame 参照）。
 */
export function findOverlappingIds(layout: ReadonlyArray<LayoutItem>): Set<string> {
  const result = new Set<string>();
  for (let i = 0; i < layout.length; i++) {
    for (let j = i + 1; j < layout.length; j++) {
      const a = layout[i];
      const b = layout[j];
      if (a && b && overlaps(a, b)) {
        result.add(a.i);
        result.add(b.i);
      }
    }
  }
  return result;
}

/**
 * 新規追加・複製するウィジェットの置き場所を探す。
 *
 * 以前は「常に一番左の列、全ウィジェットの中の最下段」に固定で置いていたため、
 * 他の列に空きがあってもそこは無視され、置くたびにどんどん下へ伸びていき、
 * （maxRows を1画面ぶんに固定した今は特に）画面の外に置かれてしまうことがあった。
 * ここでは y の小さい行から順に、w×h の矩形が既存のどれとも重ならない
 * 最初の (x, y) を探す（いわゆる first-fit）。既存の配置の隙間を優先的に埋めるため、
 * 「空いている場所があるのに下へ追いやられる」ことがなくなる。
 *
 * `maxRows` を渡すと、まずその範囲内だけを探す。範囲内に置き場所が無い場合だけ、
 * 範囲を超えてでも（見えなくなるとしても）どこかに置けるよう探索を続ける
 * （「置けない」よりは「1画面に収まらないが存在はする」方を優先する）。
 */
export function findFirstFitPosition(
  layout: ReadonlyArray<LayoutItem>,
  cols: number,
  w: number,
  h: number,
  maxRows?: number,
): { x: number; y: number } {
  const currentBottom = layout.reduce((max, item) => Math.max(max, item.y + item.h), 0);
  const hardLimit = currentBottom + h + 1;

  const search = (limitY: number): { x: number; y: number } | null => {
    for (let y = 0; y <= limitY; y++) {
      for (let x = 0; x <= cols - w; x++) {
        const candidate: Rect = { x, y, w, h };
        if (!layout.some((item) => overlaps(candidate, item))) {
          return { x, y };
        }
      }
    }
    return null;
  };

  if (maxRows !== undefined) {
    const withinBounds = search(Math.max(0, maxRows - h));
    if (withinBounds) return withinBounds;
  }

  return search(hardLimit) ?? { x: 0, y: currentBottom };
}

/**
 * 空いている隙間を上へ詰める（テーマ設定「上に詰める」用）。
 *
 * resolveOverlaps の後に適用する前提。y の小さい順に処理し、既に確定した
 * ウィジェットとぶつからない範囲でできるだけ上へ移動させるだけなので、
 * 新たな重なりを作らず、順序が入れ替わって大きくジャンプすることもない。
 */
export function floatUp(layout: ReadonlyArray<LayoutItem>): LayoutItem[] {
  const sorted = [...layout].sort((a, b) => a.y - b.y || a.x - b.x);
  const placed: LayoutItem[] = [];

  for (const item of sorted) {
    let y = item.y;
    while (y > 0) {
      const candidate: Rect = { x: item.x, y: y - 1, w: item.w, h: item.h };
      if (placed.some((p) => overlaps(candidate, p))) break;
      y -= 1;
    }
    placed.push({ ...item, y });
  }

  return placed;
}

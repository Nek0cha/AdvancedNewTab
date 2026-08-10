import { forwardRef, type HTMLAttributes } from 'react';
import type { ResizeHandleAxis } from 'react-grid-layout';

import { cx } from '@/lib/cx';

import styles from './resize-handle.module.css';

interface ResizeHandleProps extends HTMLAttributes<HTMLSpanElement> {
  axis: ResizeHandleAxis;
}

/**
 * リサイズハンドルの自前レンダラー（Grid.tsx の resizeConfig.handleComponent から使う）。
 *
 * 以前は react-resizable の既定ハンドル（`.react-resizable-handle-se` 等、既定の
 * 背景画像とCSSでの位置決め）を CSS の上書きだけで差し替えようとしていたが、
 * 左下（sw）側だけ白い残留物が出たり右下と縦位置がズレたりする不具合が
 * `!important` を足しても直らなかった。react-resizable は `handle` に関数を渡すと
 * 既定のクラス・スタイルを一切付けず完全にこちらの描画に委ねてくれる
 * （node_modules/react-resizable の Resizable.js `renderResizeHandle` 参照）ため、
 * 既定スタイルとの上書き合戦を避けてここで完全に自作している。
 *
 * 右下（se）と左下（sw）で見た目のCSSを別々に書くと、また左右で微妙にズレる
 * リスクがあるため、コーナーの角かっこ自体は1種類だけ定義し、sw 側は
 * `transform: scaleX(-1)` で丸ごと水平反転して使い回している（形も位置も
 * 完全に連動して反転するので、手で書き直すより確実にズレない）。
 *
 * `react-resizable-handle` クラスは見た目には使っていないが、react-grid-layout が
 * ドラッグ（移動）とリサイズを区別するための cancel セレクタ
 * （`DraggableCore` の `cancel: ".react-resizable-handle"`）として参照しているため、
 * 消さずに残す必要がある。
 *
 * react-resizable は `handle` に自作コンポーネントを渡すと、こちらが返した要素を
 * `React.cloneElement()` で複製し、実際にドラッグを検知するための onMouseDown 等の
 * イベントハンドラを props として注入してくる（DraggableCore の仕組み）。
 * components/WidgetFrame/WidgetFrame.tsx の冒頭コメントにある注意点と全く同じで、
 * 受け取った props（`...rest`）をルート要素にそのまま展開しないと、注入された
 * イベントハンドラが実DOMに一切届かず、見た目は直っても掴んでもリサイズが
 * 始まらない状態になる（実際にこれで一度ハマった）。
 */
export const ResizeHandle = forwardRef<HTMLSpanElement, ResizeHandleProps>(function ResizeHandle(
  { axis, className, ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      className={cx('react-resizable-handle', `react-resizable-handle-${axis}`, styles.handle, styles[axis], className)}
      {...rest}
    >
      <span className={styles.corner} aria-hidden />
    </span>
  );
});

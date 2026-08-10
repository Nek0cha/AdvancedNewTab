import type { ReactNode } from 'react';

import { getLinkIconOption } from '@/lib/link-icons';
import { svgToDataUrl, tintSvgCode, type IconValue } from '@/lib/icon-value';

interface IconValueDisplayProps {
  value: IconValue;
  /** source: 'default' のときに表示するもの（favicon など、呼び出し側が用意する） */
  fallback: ReactNode;
  size: number;
  className?: string;
  /**
   * source: 'svg' のアイコンにだけ適用する一括の色（hex）。
   * 個々のアイコンごとではなく、呼び出し側（ウィジェット単位）で指定する想定。
   * 未指定なら SVG に埋め込まれた元の色のまま描画する。
   */
  svgTint?: string;
}

/** widgets/types.ts の kind:'icon' フィールドで選ばれた値を実際に描画する。 */
export function IconValueDisplay({ value, fallback, size, className, svgTint }: IconValueDisplayProps) {
  switch (value.source) {
    case 'lucide': {
      const option = getLinkIconOption(value.id);
      if (!option) return <>{fallback}</>;
      const Icon = option.Icon;
      return <Icon size={size} className={className} />;
    }
    case 'image':
      return (
        <img
          className={className}
          src={value.dataUrl}
          alt=""
          width={size}
          height={size}
          style={{ objectFit: 'contain' }}
        />
      );
    case 'svg':
      return (
        <img
          className={className}
          // SVGコードは dangerouslySetInnerHTML ではなく data URL 化した <img src> で描画する。
          // <img> はマークアップ内のスクリプトを実行しないため、ユーザーが貼り付けた
          // SVGコードに何が含まれていても実行されるおそれがない。
          // 色の一括変更（svgTint）も、CSSではなくSVG文字列自体を書き換えて実現している
          // （<img> はページのCSSを継承しない独立した描画コンテキストのため）。
          src={svgToDataUrl(svgTint ? tintSvgCode(value.code, svgTint) : value.code)}
          alt=""
          width={size}
          height={size}
          style={{ objectFit: 'contain' }}
        />
      );
    case 'url':
      return (
        <img
          className={className}
          src={value.url}
          alt=""
          width={size}
          height={size}
          style={{ objectFit: 'contain' }}
        />
      );
    default:
      return <>{fallback}</>;
  }
}

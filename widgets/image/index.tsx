import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';

import { cx } from '@/lib/cx';
import { defineWidget, type WidgetProps } from '@/widgets/types';

import styles from './image.module.css';

interface ImageSettings extends Record<string, unknown> {
  mode: 'single' | 'shuffle';
  /** dataURL の配列。single モードでは images[0] だけを使う */
  images: string[];
  /** shuffle モードでの切り替え間隔（秒） */
  intervalSeconds: number;
  fit: 'cover' | 'contain';
}

/** フェード用に画面へ積む1枚分。id はDOMノードを安定させるためだけの通し番号。 */
interface Layer {
  id: number;
  src: string;
}

/** フェードの所要時間（image.module.css の transition と揃える） */
const FADE_MS = 600;

/** シャッフル用に、直前と同じ画像を連続で選ばないランダムindexを返す。1枚しかなければ0固定。 */
function pickNextIndex(count: number, current: number): number {
  if (count <= 1) return 0;
  let next = current;
  while (next === current) {
    next = Math.floor(Math.random() * count);
  }
  return next;
}

function ImageWidget({ settings }: WidgetProps<ImageSettings>) {
  const [index, setIndex] = useState(0);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [visibleId, setVisibleId] = useState<number | null>(null);
  const nextIdRef = useRef(0);

  useEffect(() => {
    setIndex((prev) => (prev >= settings.images.length ? 0 : prev));
  }, [settings.images.length]);

  useEffect(() => {
    if (settings.mode !== 'shuffle' || settings.images.length <= 1) return;
    const id = setInterval(() => {
      setIndex((prev) => pickNextIndex(settings.images.length, prev));
    }, Math.max(3, settings.intervalSeconds) * 1000);
    return () => clearInterval(id);
  }, [settings.mode, settings.images.length, settings.intervalSeconds]);

  const src = settings.images[index];

  /*
   * 画像が変わるたびに、まだ不可視（opacity: 0、image.module.css既定）のまま
   * 新しいレイヤーを積む。次のフレームで visibleId をそのレイヤーに切り替えると、
   * 新しいレイヤーは 0→1 に、直前まで表示されていたレイヤーは（.imageVisible が
   * 外れるので）1→0 に、同時にCSSトランジションが走ってクロスフェードして見える。
   * 同じ<img>ノードのopacityをその場で変えるのではなく「もう1枚重ねて後から消す」
   * 方式にしているのは、切り替わる直前の画像を表示させたまま次の画像を
   * フェードインさせたい（一瞬透けて背景が見える空白を作りたくない）ため。
   */
  useEffect(() => {
    if (!src) return;
    const id = nextIdRef.current;
    nextIdRef.current += 1;
    setLayers((prev) => [...prev, { id, src }]);
    const raf = requestAnimationFrame(() => setVisibleId(id));
    return () => cancelAnimationFrame(raf);
  }, [src]);

  // 不可視になったレイヤーは、フェードが終わる頃合いでDOMから取り除く
  useEffect(() => {
    if (visibleId === null) return;
    const id = setTimeout(() => {
      setLayers((prev) => prev.filter((l) => l.id === visibleId));
    }, FADE_MS + 100);
    return () => clearTimeout(id);
  }, [visibleId]);

  if (settings.images.length === 0) {
    return (
      <div className={styles.empty}>
        <ImageIcon size={20} />
        <span>ウィジェットの設定から画像を追加してください。</span>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {layers.map((layer) => (
        <img
          key={layer.id}
          className={cx(styles.image, layer.id === visibleId && styles.imageVisible)}
          style={{ objectFit: settings.fit }}
          src={layer.src}
          alt=""
        />
      ))}
    </div>
  );
}

export const imageWidget = defineWidget<ImageSettings>({
  type: 'image',
  name: '画像表示',
  description: '1枚の画像、またはアップロードした複数の画像をシャッフル表示します。',
  icon: ImageIcon,
  defaultLayout: { w: 4, h: 3, minW: 2, minH: 2 },
  defaultSettings: {
    mode: 'single',
    images: [],
    intervalSeconds: 30,
    fit: 'cover',
  },
  settingsSchema: [
    { kind: 'imageList', key: 'images', label: '画像' },
    {
      kind: 'select',
      key: 'mode',
      label: '表示方法',
      options: [
        { value: 'single', label: '1枚だけ表示（先頭の画像）' },
        { value: 'shuffle', label: 'シャッフル表示' },
      ],
    },
    {
      kind: 'number',
      key: 'intervalSeconds',
      label: '切り替え間隔（秒・シャッフル時のみ）',
      min: 3,
      max: 3600,
      step: 1,
    },
    {
      kind: 'select',
      key: 'fit',
      label: '画像のフィット方法',
      options: [
        { value: 'cover', label: '枠いっぱいに埋める（はみ出た部分は切れる）' },
        { value: 'contain', label: '全体を収める（余白ができることがある）' },
      ],
    },
  ],
  Component: ImageWidget,
});

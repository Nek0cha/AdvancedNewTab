import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Image as ImageIcon, Plus, Trash2 } from 'lucide-react';

import { ColorPicker } from '@/components/ColorPicker/ColorPicker';
import { Dropdown } from '@/components/Dropdown/Dropdown';
import { IconValueDisplay } from '@/components/IconValueDisplay/IconValueDisplay';
import { NumberStepper } from '@/components/NumberStepper/NumberStepper';
import { cx } from '@/lib/cx';
import { DARK_UI_ICON_TINT, DEFAULT_ICON_VALUE, normalizeIconValue } from '@/lib/icon-value';
import { isFieldVisible, type FieldSchema, type ListPreset } from '@/widgets/types';

import { AddWithPresets } from './AddWithPresets';
import { IconPickerField } from './IconPickerField';
import { ImageListField } from './ImageListField';
import styles from './field.module.css';
import tabStyles from '../SettingsPanel/background-editor.module.css';

interface FieldProps {
  schema: FieldSchema;
  value: unknown;
  onChange: (value: unknown) => void;
}

/** itemFields の宣言から、リストに追加する新規項目の初期値を組み立てる。 */
function createEmptyItem(fields: ReadonlyArray<FieldSchema>): Record<string, unknown> {
  const item: Record<string, unknown> = {};
  for (const field of fields) {
    switch (field.kind) {
      case 'number':
        item[field.key] = field.min ?? 0;
        break;
      case 'toggle':
        item[field.key] = false;
        break;
      case 'select':
        item[field.key] = field.options[0]?.value ?? '';
        break;
      case 'color':
        item[field.key] = '#888888';
        break;
      case 'icon':
        item[field.key] = DEFAULT_ICON_VALUE;
        break;
      case 'list':
      case 'imageList':
        item[field.key] = [];
        break;
      default:
        item[field.key] = '';
    }
  }
  return item;
}

/**
 * FieldSchema 1件を入力欄として描画する。
 *
 * ウィジェット側もテーマ設定側もこのコンポーネントを共有するため、
 * 設定項目を増やすときにフォームのJSXを書く必要がない。
 */
export function Field({ schema, value, onChange }: FieldProps) {
  const id = useId();
  // リスト項目の折りたたみ状態。項目の「内容」ではなく「その時点の並び順」に対して
  // 持たせている（並べ替え・削除のたびに index を追従させる。項目自体に安定したIDが
  // 無く、この配列全体が並べ替え・削除でも位置ベースに扱われているのと同じ考え方）。
  const [openIndexes, setOpenIndexes] = useState<Set<number>>(() => new Set());

  if (schema.kind === 'toggle') {
    const checked = Boolean(value);
    return (
      <div className={styles.toggleRow}>
        <label className={styles.label} htmlFor={id}>
          {schema.label}
        </label>
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={checked}
          className={cx(styles.switch, checked && styles.switchOn)}
          onClick={() => onChange(!checked)}
        />
      </div>
    );
  }

  if (schema.kind === 'list') {
    const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];

    const replace = (next: Record<string, unknown>[]): void => onChange(next);

    // 折りたたみ表示の「アイコン」「名前」は、itemFields の宣言順から推測する
    // （リンク集の icon/label、世界時計の label のように、最初のicon欄・最初のtext欄を
    // その項目の見出しとみなす。ウィジェット側は itemFields の並びだけ書けばよく、
    // 折りたたみ用の宣言を別途増やさなくていい）。
    const iconField = schema.itemFields.find((f) => f.kind === 'icon');
    const titleField = schema.itemFields.find((f) => f.kind === 'text');

    const addItem = (item: Record<string, unknown>): void => {
      // 追加した項目は閉じた状態で出す（一覧が伸びていくたびに毎回開いた
      // カードが増えると煩雑になるため、開くかどうかはユーザーの操作に委ねる）。
      replace([...items, item]);
    };

    const toggleOpen = (index: number): void => {
      setOpenIndexes((prev) => {
        const next = new Set(prev);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        return next;
      });
    };

    /**
     * 並べ替え（from → to への移動。ボタンでの隣接swapも、ドラッグでの任意距離の
     * 移動もこれ1つでまかなう）に合わせて、開閉状態も追従させる。
     * from と to の間にある項目は、移動方向と逆向きに1つずつ詰める（配列のsplice
     * と同じ挙動）。
     */
    const moveOpen = (from: number, to: number): void => {
      if (from === to) return;
      setOpenIndexes((prev) => {
        const wasOpen = prev.has(from);
        const next = new Set<number>();
        prev.forEach((i) => {
          if (i === from) return;
          if (from < to) {
            if (i > from && i <= to) next.add(i - 1);
            else next.add(i);
          } else if (i >= to && i < from) {
            next.add(i + 1);
          } else {
            next.add(i);
          }
        });
        if (wasOpen) next.add(to);
        return next;
      });
    };

    /** 削除（index が消える）に合わせて、それより後ろの開閉状態を1つずつ詰める */
    const removeOpen = (index: number): void => {
      setOpenIndexes((prev) => {
        const next = new Set<number>();
        prev.forEach((i) => {
          if (i < index) next.add(i);
          else if (i > index) next.add(i - 1);
        });
        return next;
      });
    };

    const showAddButton = schema.maxItems === undefined || items.length < schema.maxItems;

    // --- ドラッグ並べ替え -----------------------------------------------
    //
    // カード全体のどこを掴んでも動かせるようにしつつ、折りたたみトグルや削除
    // ボタンの「ただのクリック」は今まで通り効かせたいので、pointerdown した
    // 瞬間はまだドラッグを始めない。実際に数px動いてから初めて「ドラッグ」として
    // 扱う（pendingRef）。この閾値判定と、ドラッグ中の追従・確定処理はすべて
    // items の最新値を直接読める useRef 経由で行う（items は再レンダーのたびに
    // 作り直される配列なので、ドラッグ中ずっと張りっぱなしのイベントリスナーが
    // 古い items を掴んだままにならないようにするため）。
    //
    // ドラッグ中は実データ（items）はまだ書き換えず、指を離した瞬間
    // （finishDrag）に一度だけ onChange する。移動のたびに書き込むと、
    // キーストロークと同じく短時間に何度もstorage書き込みが走り、CLAUDE.md
    // 記載の「stale echoの取り違え」系の不具合を招く余地があるため避けている。
    // その代わり、ドラッグ中は「今つかんでいるカード」を指の位置へ縦方向にだけ
    // 追従させ（横方向には動かさない＝横軸固定）、他のカードの並びは元のまま、
    // どこに挿入されるかを示す細い挿入線だけを表示する。
    const [drag, setDrag] = useState<{
      from: number;
      overIndex: number;
      startY: number;
      pointerY: number;
    } | null>(null);
    const itemElsRef = useRef<Map<number, HTMLDivElement>>(new Map());
    const itemsRef = useRef(items);
    itemsRef.current = items;
    const pendingRef = useRef<{ index: number; startX: number; startY: number } | null>(null);

    // 「from を除いた配列（＝並べ替えの結果として挿入する先の配列）」上での
    // ポインタ位置から、挿入先の位置（結果配列での最終インデックス）を求める。
    // 各アイテムの中点より上ならその手前、どれよりも下なら末尾、という判定。
    const computeOverIndex = (clientY: number, dragFrom: number): number => {
      const current = itemsRef.current;
      const others: number[] = [];
      for (let i = 0; i < current.length; i += 1) {
        if (i !== dragFrom) others.push(i);
      }
      for (let postPos = 0; postPos < others.length; postPos += 1) {
        const originalIndex = others[postPos];
        if (originalIndex === undefined) continue;
        const el = itemElsRef.current.get(originalIndex);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (clientY < rect.top + rect.height / 2) return postPos;
      }
      return others.length;
    };

    // 挿入線をどのカードの手前（またはリスト末尾）に描くか。displayItems的な
    // 並べ替えはせず、DOM順は常に items のまま（＝実カード群は動かさない）で、
    // 挿入線だけがガイドとして動く。
    const dropBeforeIndex = (() => {
      if (!drag) return null;
      const others: number[] = [];
      for (let i = 0; i < items.length; i += 1) {
        if (i !== drag.from) others.push(i);
      }
      return drag.overIndex < others.length ? others[drag.overIndex] : null;
    })();

    useEffect(() => {
      const onMove = (e: PointerEvent): void => {
        const pending = pendingRef.current;
        if (pending) {
          const dx = e.clientX - pending.startX;
          const dy = e.clientY - pending.startY;
          if (Math.hypot(dx, dy) < 5) return; // まだクリック相当（閾値未満）
          pendingRef.current = null;
          document.body.style.cursor = 'grabbing';
          setDrag({
            from: pending.index,
            overIndex: computeOverIndex(e.clientY, pending.index),
            startY: e.clientY,
            pointerY: e.clientY,
          });
          return;
        }
        setDrag((prev) => {
          if (!prev) return prev;
          return { ...prev, overIndex: computeOverIndex(e.clientY, prev.from), pointerY: e.clientY };
        });
      };

      const finishDrag = (): void => {
        pendingRef.current = null;
        document.body.style.cursor = '';
        setDrag((prev) => {
          if (prev) {
            const current = itemsRef.current;
            const next = [...current];
            const [moved] = next.splice(prev.from, 1);
            if (moved) next.splice(prev.overIndex, 0, moved);
            replace(next);
            moveOpen(prev.from, prev.overIndex);
          }
          return null;
        });
      };

      const onKeyDown = (e: KeyboardEvent): void => {
        // Escapeで、まだ確定していない移動をキャンセルできるようにする
        if (e.key !== 'Escape') return;
        pendingRef.current = null;
        document.body.style.cursor = '';
        setDrag(null);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', finishDrag);
      window.addEventListener('pointercancel', finishDrag);
      document.addEventListener('keydown', onKeyDown);
      return () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', finishDrag);
        window.removeEventListener('pointercancel', finishDrag);
        document.removeEventListener('keydown', onKeyDown);
        document.body.style.cursor = '';
      };
      // items/replace/moveOpen は itemsRef 経由・安定した setter 経由でしか
      // 参照しないため、リスナーの張り直しは不要（マウント中ずっと同じでよい）。
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <div className={styles.field}>
        <span className={styles.label}>{schema.label}</span>
        {schema.help && <span className={styles.help}>{schema.help}</span>}

        {/* 項目数が増えるほど下の一覧が長くなるため、追加ボタンは一覧の上に固定する
            （毎回スクロールして下まで辿り着かなくても追加できるように） */}
        {showAddButton &&
          (schema.presets && schema.presets.length > 0 ? (
            <AddWithPresets
              addLabel={schema.addLabel ?? '追加'}
              presets={schema.presets}
              onAddBlank={() => addItem(createEmptyItem(schema.itemFields))}
              onAddPreset={(preset: ListPreset) => addItem({ ...preset.value })}
            />
          ) : (
            <button
              type="button"
              className={styles.addButton}
              onClick={() => addItem(createEmptyItem(schema.itemFields))}
            >
              <Plus size={14} /> {schema.addLabel ?? '追加'}
            </button>
          ))}
        {schema.maxItems !== undefined && items.length >= schema.maxItems && (
          <span className={styles.help}>最大{schema.maxItems}件まで登録できます。</span>
        )}

        {items.length === 0 ? (
          <div className={styles.empty}>まだ項目がありません</div>
        ) : (
          <div className={styles.listItems}>
            {items.map((item, index) => {
              const isOpen = openIndexes.has(index);
              const isDragging = drag !== null && drag.from === index;
              const titleValue = titleField ? item[titleField.key] : undefined;
              const title = typeof titleValue === 'string' && titleValue ? titleValue : `項目 ${index + 1}`;

              return (
                <div key={index}>
                  {drag && dropBeforeIndex === index && <div className={styles.dropIndicator} />}
                  <div
                    ref={(el) => {
                      if (el) itemElsRef.current.set(index, el);
                      else itemElsRef.current.delete(index);
                    }}
                    className={cx(styles.listItem, isDragging && styles.listItemDragging)}
                    style={
                      isDragging && drag
                        ? // 横方向には一切動かさない（横軸固定）。縦方向だけ指の位置に追従させる。
                          { transform: `translateY(${drag.pointerY - drag.startY}px)` }
                        : undefined
                    }
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      const target = e.target as HTMLElement;
                      // input/textarea/select の上では、文字選択などのネイティブ操作を
                      // ドラッグ扱いにしてしまわないよう、並べ替えの起点にしない。
                      if (target.closest('input, textarea, select')) return;
                      // カード内のテキスト（表示名など）の上から動かし始めると、ブラウザの
                      // 既定動作でテキスト選択（青いハイライト）が始まってしまう。
                      // preventDefault でその既定動作だけを止める（ボタンのclickは
                      // pointerdown とは別イベントなので、これで押せなくなることはない）。
                      e.preventDefault();
                      pendingRef.current = { index, startX: e.clientX, startY: e.clientY };
                    }}
                  >
                    <div className={styles.listItemHeader}>
                      <button
                        type="button"
                        className={styles.listItemToggle}
                        aria-expanded={isOpen}
                        onClick={() => toggleOpen(index)}
                      >
                        <ChevronDown
                          size={13}
                          className={cx(styles.collapseIcon, isOpen && styles.collapseIconOpen)}
                        />
                        {iconField && (
                          <span className={styles.listItemIcon}>
                            <IconValueDisplay
                              value={normalizeIconValue(item[iconField.key])}
                              fallback={<ImageIcon size={14} />}
                              size={14}
                              svgTint={DARK_UI_ICON_TINT}
                            />
                          </span>
                        )}
                        <span className={styles.listItemTitle}>{title}</span>
                      </button>
                      <button
                        type="button"
                        className={styles.miniButton}
                        title="削除"
                        onClick={() => {
                          replace(items.filter((_, i) => i !== index));
                          removeOpen(index);
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {isOpen &&
                      schema.itemFields
                        .filter((itemField) => isFieldVisible(itemField, item))
                        .map((itemField) => (
                          <Field
                            key={itemField.key}
                            schema={itemField}
                            value={item[itemField.key]}
                            onChange={(fieldValue) => {
                              const next = [...items];
                              next[index] = { ...item, [itemField.key]: fieldValue };
                              replace(next);
                            }}
                          />
                        ))}
                  </div>
                </div>
              );
            })}
            {drag && dropBeforeIndex === null && <div className={styles.dropIndicator} />}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {schema.label}
      </label>

      {schema.kind === 'text' && (
        <input
          id={id}
          type="text"
          className={styles.control}
          value={typeof value === 'string' ? value : ''}
          placeholder={schema.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      {schema.kind === 'textarea' && (
        <textarea
          id={id}
          className={cx(styles.control, styles.textarea)}
          rows={schema.rows ?? 4}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      {schema.kind === 'number' && (
        <NumberStepper
          id={id}
          value={typeof value === 'number' ? value : (schema.min ?? 0)}
          min={schema.min}
          max={schema.max}
          step={schema.step}
          onChange={onChange}
        />
      )}

      {schema.kind === 'select' && schema.variant === 'tabs' && (
        <div className={tabStyles.tabs}>
          {schema.options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={cx(tabStyles.tab, value === option.value && tabStyles.tabActive)}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {schema.kind === 'select' && schema.variant !== 'tabs' && (
        <Dropdown
          id={id}
          value={typeof value === 'string' ? value : ''}
          options={schema.options}
          onChange={onChange}
        />
      )}

      {schema.kind === 'color' && (
        <ColorPicker
          id={id}
          value={typeof value === 'string' ? value : '#000000'}
          onChange={onChange}
        />
      )}

      {schema.kind === 'icon' && <IconPickerField value={value} onChange={onChange} />}

      {schema.kind === 'imageList' && <ImageListField value={value} onChange={onChange} />}

      {schema.help && <span className={styles.help}>{schema.help}</span>}
    </div>
  );
}

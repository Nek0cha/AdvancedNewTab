import { useEffect, useRef, useState } from 'react';
import { NotebookPen } from 'lucide-react';

import { useAppStore } from '@/lib/store';
import { defineWidget, type WidgetProps } from '@/widgets/types';

import styles from './memo.module.css';

interface MemoSettings extends Record<string, unknown> {
  /** 空文字なら見出し行そのものを表示しない（任意項目） */
  title: string;
  text: string;
  fontScale: number;
}

/** 保存の書き込み間隔（ms）。キー入力のたびに storage へ書くと重くなるため間引く。 */
const SAVE_DEBOUNCE_MS = 500;

function MemoWidget({ settings, instanceId, editMode }: WidgetProps<MemoSettings>) {
  const patchWidgetSettings = useAppStore((s) => s.patchWidgetSettings);
  const [titleDraft, setTitleDraft] = useState(settings.title);
  const [textDraft, setTextDraft] = useState(settings.text);
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const textTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // 他タブでの変更（インポート等）を反映する。自分の入力中は上書きしない。
  useEffect(() => {
    setTitleDraft(settings.title);
  }, [settings.title]);
  useEffect(() => {
    setTextDraft(settings.text);
  }, [settings.text]);

  const handleTitleChange = (value: string): void => {
    setTitleDraft(value);
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    titleTimerRef.current = setTimeout(() => {
      patchWidgetSettings(instanceId, { title: value });
    }, SAVE_DEBOUNCE_MS);
  };

  const handleTextChange = (value: string): void => {
    setTextDraft(value);
    if (textTimerRef.current) clearTimeout(textTimerRef.current);
    textTimerRef.current = setTimeout(() => {
      patchWidgetSettings(instanceId, { text: value });
    }, SAVE_DEBOUNCE_MS);
  };

  useEffect(
    () => () => {
      clearTimeout(titleTimerRef.current);
      clearTimeout(textTimerRef.current);
    },
    [],
  );

  // タイトルは「無し」を選べる任意項目。編集モード中で空のときは、
  // 存在に気づけるよう薄いプレースホルダー入力だけ出しておく。
  const showTitleRow = titleDraft.trim() !== '' || !editMode;

  return (
    <div className={styles.root}>
      {showTitleRow && (
        <input
          type="text"
          className={styles.title}
          placeholder="タイトル（任意）"
          value={titleDraft}
          readOnly={editMode}
          onChange={(e) => handleTitleChange(e.target.value)}
        />
      )}
      <textarea
        className={styles.textarea}
        style={{ fontSize: `${13 * settings.fontScale}px` }}
        placeholder="メモを入力..."
        value={textDraft}
        readOnly={editMode}
        onChange={(e) => handleTextChange(e.target.value)}
      />
    </div>
  );
}

export const memoWidget = defineWidget<MemoSettings>({
  type: 'memo',
  name: 'メモ',
  description: '簡単なメモを書き留めておけます。',
  icon: NotebookPen,
  defaultLayout: { w: 4, h: 3, minW: 2, minH: 2 },
  defaultSettings: { title: '', text: '', fontScale: 1 },
  settingsSchema: [
    { kind: 'text', key: 'title', label: 'タイトル（空欄で非表示）', placeholder: '例: 買い物リスト' },
    {
      kind: 'number',
      key: 'fontScale',
      label: '文字サイズ倍率',
      min: 0.6,
      max: 2.5,
      step: 0.1,
    },
  ],
  Component: MemoWidget,
});

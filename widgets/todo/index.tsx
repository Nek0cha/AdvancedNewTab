import { useEffect, useState } from 'react';
import { Check, ListTodo, Trash2, X } from 'lucide-react';

import { cx } from '@/lib/cx';
import { useT } from '@/lib/i18n';
import { useAppStore } from '@/lib/store';
import { defineWidget, type WidgetProps } from '@/widgets/types';

import styles from './todo.module.css';

interface TodoItem {
  /** 並べ替え・削除しても同じ項目を指し続けるための識別子（React の key にも使う） */
  id: string;
  text: string;
  done: boolean;
}

interface TodoSettings extends Record<string, unknown> {
  /** 空文字なら見出し行そのものを表示しない */
  title: string;
  /**
   * タスクの一覧。設定パネル（settingsSchema）には出さず、ウィジェット上で直接編集する。
   * メモの本文と同じく、日常的に書き換える「中身」であって「設定」ではないため。
   */
  items: TodoItem[];
  /** 完了したタスクを一覧に残すか。オフにすると完了した瞬間に見えなくなる（削除はされない） */
  showCompleted: boolean;
}

/** 保存データが手で編集されたり壊れたりしていても、描画で落ちないよう形を整える。 */
function normalizeItems(raw: unknown): TodoItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((it, i) => {
    if (!it || typeof it !== 'object') return [];
    const { id, text, done } = it as Partial<TodoItem>;
    if (typeof text !== 'string') return [];
    return [{ id: typeof id === 'string' ? id : `todo-legacy-${i}`, text, done: done === true }];
  });
}

const newId = (): string => `todo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/**
 * 1件分。文字の書き換えは1文字ごとに保存すると Undo の履歴が1文字ずつ積まれてしまうため、
 * 手元の下書きとして持ち、フォーカスが外れたときか Enter を押したときにだけ確定する。
 */
function TodoRow({
  item,
  readOnly,
  onToggle,
  onRename,
  onDelete,
}: {
  item: TodoItem;
  readOnly: boolean;
  onToggle: () => void;
  onRename: (text: string) => void;
  onDelete: () => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState(item.text);
  // Undo や別タブでの変更で外から書き換わったときは、入力欄も追従させる
  useEffect(() => setDraft(item.text), [item.text]);

  const commit = (): void => {
    const text = draft.trim();
    // 空にして確定したら、その項目を消したいという意思とみなす
    if (!text) onDelete();
    else if (text !== item.text) onRename(text);
  };

  return (
    <li className={cx(styles.item, item.done && styles.done)}>
      <button
        type="button"
        className={styles.check}
        role="checkbox"
        aria-checked={item.done}
        aria-label={item.done ? t('未完了に戻す') : t('完了にする')}
        disabled={readOnly}
        onClick={onToggle}
      >
        {item.done && <Check size={12} strokeWidth={3} />}
      </button>
      <input
        type="text"
        className={styles.text}
        value={draft}
        readOnly={readOnly}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setDraft(item.text);
            // blur 時の commit が、戻した後の値で走るよう次のフレームで外す
            const el = e.currentTarget;
            requestAnimationFrame(() => el.blur());
          }
        }}
      />
      {!readOnly && (
        <button type="button" className={styles.remove} title={t('削除')} aria-label={t('削除')} onClick={onDelete}>
          <X size={13} />
        </button>
      )}
    </li>
  );
}

function TodoWidget({ settings, instanceId, editMode }: WidgetProps<TodoSettings>) {
  const t = useT();
  const patchWidgetSettings = useAppStore((s) => s.patchWidgetSettings);
  const [newText, setNewText] = useState('');

  const items = normalizeItems(settings.items);
  const save = (next: TodoItem[]): void => patchWidgetSettings(instanceId, { items: next });

  const add = (): void => {
    const text = newText.trim();
    if (!text) return;
    save([...items, { id: newId(), text, done: false }]);
    setNewText('');
  };

  // 未完了を上、完了を下にまとめる。それぞれの中では追加した順を保つ。
  // 保存上の並びは変えずに表示だけ並べ替えるので、完了を外せば元の位置に戻る。
  const pending = items.filter((it) => !it.done);
  const completed = items.filter((it) => it.done);
  const visible = settings.showCompleted ? [...pending, ...completed] : pending;

  const update = (id: string, patch: Partial<TodoItem>): void =>
    save(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const remove = (id: string): void => save(items.filter((it) => it.id !== id));

  return (
    <div className={styles.root}>
      {settings.title.trim() !== '' && <div className={styles.title}>{settings.title}</div>}
      <ul className={styles.list}>
        {visible.map((item) => (
          <TodoRow
            key={item.id}
            item={item}
            readOnly={editMode}
            onToggle={() => update(item.id, { done: !item.done })}
            onRename={(text) => update(item.id, { text })}
            onDelete={() => remove(item.id)}
          />
        ))}
        {visible.length === 0 && (
          <li className={styles.empty}>
            {items.length === 0 ? t('タスクはまだありません。') : t('すべて完了しました。')}
          </li>
        )}
      </ul>
      {!editMode && (
        <div className={styles.footer}>
          <input
            type="text"
            className={styles.newInput}
            placeholder={t('タスクを追加…')}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => {
              // IME の変換確定の Enter で追加されてしまわないようにする
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) add();
            }}
          />
          {completed.length > 0 && (
            <button
              type="button"
              className={styles.clearDone}
              title={t('完了したタスクをまとめて削除')}
              onClick={() => save(pending)}
            >
              <Trash2 size={13} />
              {t('完了 {n} 件を削除', { n: completed.length })}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export const todoWidget = defineWidget<TodoSettings>({
  type: 'todo',
  category: 'tools',
  name: 'ToDo',
  description: 'チェックを付けて消していくタスクリストです。',
  icon: ListTodo,
  defaultLayout: { w: 4, h: 4, minW: 3, minH: 2 },
  defaultSettings: {
    title: '',
    items: [],
    showCompleted: true,
  },
  settingsSchema: [
    { kind: 'text', key: 'title', label: 'タイトル', placeholder: '例: 今日やること' },
    {
      kind: 'toggle',
      key: 'showCompleted',
      label: '完了したタスクを表示する',
      help: 'オフにすると、完了したタスクは一覧から隠れます（削除はされません）。',
    },
  ],
  Component: TodoWidget,
});

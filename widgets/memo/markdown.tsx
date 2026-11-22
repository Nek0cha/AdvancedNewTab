import type { ReactNode } from 'react';

import styles from './memo.module.css';

/**
 * メモ用の最小限の Markdown 表示。
 * 対応: 見出し(# 〜 ###)・箇条書き(- / * / 1.)・チェックボックス(- [ ] / - [x])・
 * 太字(**)・斜体(*)・インラインコード(`)・リンク([文字](https://...))。
 *
 * ライブラリを入れずに自前で持っているのは、メモ用途にはこの範囲で足りることと、
 * HTML 文字列を生成して innerHTML に流す方式を避けたいため。ここでは React 要素を
 * 直接組み立てるので、メモに <script> や onerror 付きの <img> を書かれても
 * ただの文字として表示されるだけで実行されない。リンクも http(s) 以外
 * （javascript: など）は通常の文字として扱う。
 */

const INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(INLINE)) {
    const token = m[0];
    const start = m.index ?? 0;
    if (start > last) nodes.push(text.slice(last, start));
    const key = `${keyPrefix}-${i++}`;
    if (token.startsWith('**')) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`')) {
      nodes.push(<code key={key} className={styles.mdCode}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith('[')) {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
      const href = link?.[2] ?? '';
      if (link && /^https?:\/\//i.test(href)) {
        nodes.push(
          <a key={key} href={href} target="_blank" rel="noopener noreferrer" className={styles.mdLink}>
            {link[1]}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    last = start + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

interface ListItem {
  line: number;
  content: string;
  /** チェックボックス行なら true/false、通常の箇条書きなら undefined */
  checked?: boolean;
}

interface MarkdownViewProps {
  text: string;
  /** チェックボックスを押したとき、その行番号を渡す（本文の書き換えは呼び出し側が行う） */
  onToggleTask: (line: number) => void;
}

export function MarkdownView({ text, onToggleTask }: MarkdownViewProps) {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: ListItem[] } | null = null;

  const flushList = (): void => {
    if (!list) return;
    const { ordered, items } = list;
    const Tag = ordered ? 'ol' : 'ul';
    blocks.push(
      <Tag key={`list-${items[0]?.line ?? 0}`} className={styles.mdList}>
        {items.map((item) => (
          <li key={item.line} className={item.checked !== undefined ? styles.mdTask : undefined}>
            {item.checked !== undefined && (
              <input
                type="checkbox"
                checked={item.checked}
                onChange={() => onToggleTask(item.line)}
                // プレビューのクリックで編集に切り替わる処理（MemoWidget）に拾われないようにする
                onClick={(e) => e.stopPropagation()}
              />
            )}
            <span className={item.checked ? styles.mdDone : undefined}>{renderInline(item.content, `li-${item.line}`)}</span>
          </li>
        ))}
      </Tag>,
    );
    list = null;
  };

  lines.forEach((raw, index) => {
    const heading = /^(#{1,3})\s+(.*)$/.exec(raw);
    const task = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/.exec(raw);
    const bullet = /^\s*[-*]\s+(.*)$/.exec(raw);
    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(raw);

    if (task || bullet || ordered) {
      const isOrdered = !task && !bullet && !!ordered;
      if (list && list.ordered !== isOrdered) flushList();
      list ??= { ordered: isOrdered, items: [] };
      if (task) list.items.push({ line: index, content: task[2] ?? '', checked: task[1] !== ' ' });
      else list.items.push({ line: index, content: (bullet ?? ordered)?.[1] ?? '' });
      return;
    }

    flushList();
    if (heading) {
      const level = heading[1]?.length ?? 1;
      const Tag = level === 1 ? 'h3' : level === 2 ? 'h4' : 'h5';
      blocks.push(
        <Tag key={index} className={styles.mdHeading}>
          {renderInline(heading[2] ?? '', `h-${index}`)}
        </Tag>,
      );
    } else if (raw.trim() === '') {
      blocks.push(<div key={index} className={styles.mdBlank} />);
    } else {
      blocks.push(
        <p key={index} className={styles.mdParagraph}>
          {renderInline(raw, `p-${index}`)}
        </p>,
      );
    }
  });
  flushList();

  return <>{blocks}</>;
}

/** 指定行のチェックボックス（[ ] / [x]）を反転した本文を返す */
export function toggleTaskLine(text: string, line: number): string {
  const lines = text.split('\n');
  const target = lines[line];
  if (target === undefined) return text;
  lines[line] = target.replace(/\[([ xX])\]/, (_m, c: string) => (c === ' ' ? '[x]' : '[ ]'));
  return lines.join('\n');
}

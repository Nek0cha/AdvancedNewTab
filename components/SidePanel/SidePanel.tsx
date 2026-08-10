import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

import styles from './side-panel.module.css';

interface SidePanelProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * 右から出るサイドシート。
 *
 * あえてモーダルの暗幕を敷いていない。テーマや設定を変えた結果が
 * 背後のダッシュボードに即座に反映される様子を見ながら調整できるようにするため。
 */
export function SidePanel({ title, onClose, children }: SidePanelProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <aside className={styles.panel} role="dialog" aria-label={title}>
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        <button type="button" className={styles.close} onClick={onClose} title="閉じる">
          <X size={16} />
        </button>
      </div>
      <div className={styles.body}>{children}</div>
    </aside>
  );
}

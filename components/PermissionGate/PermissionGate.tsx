import { useEffect, useState, type ReactNode } from 'react';
import { LockKeyhole } from 'lucide-react';

import { hasPermissions, requestPermissions, type PermissionSpec } from '@/lib/permissions';

import styles from './permission-gate.module.css';

interface PermissionGateProps {
  permissions: PermissionSpec;
  /** 権限が必要な理由をひとこと添える（例: 「よく使うサイトを読み込むには」） */
  reason: string;
  children: ReactNode;
}

/**
 * ウィジェットが必要とする権限を保有しているかどうかで表示を切り替える共通ラッパ。
 *
 * 権限は追加時に一度要求されるが、ユーザーが後から chrome://extensions で
 * 個別に取り消すこともできる。その場合でもウィジェットが空白やエラーにならず、
 * 再許可を促す導線を出せるようにこのコンポーネントを挟む。
 */
export function PermissionGate({ permissions, reason, children }: PermissionGateProps) {
  const [granted, setGranted] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void hasPermissions(permissions).then((result) => {
      if (!cancelled) setGranted(result);
    });
    return () => {
      cancelled = true;
    };
  }, [permissions]);

  if (granted === null) return null;
  if (granted) return <>{children}</>;

  return (
    <div className={styles.root}>
      <LockKeyhole size={20} className={styles.lockIcon} />
      <p className={styles.message}>{reason}</p>
      <button
        type="button"
        className={styles.button}
        onClick={() => {
          // ユーザー操作のコールスタック内から同期的に呼び出す
          void requestPermissions(permissions).then((result) => setGranted(result));
        }}
      >
        アクセスを許可する
      </button>
    </div>
  );
}

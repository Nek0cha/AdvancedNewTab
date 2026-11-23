import { FileText, Home, ShieldCheck } from 'lucide-react';

import { useT } from '@/lib/i18n';
import { SITE_LINKS } from '@/lib/site-links';

// ボタン自体の見た目（丸ピル）は隣の「レイアウト保存」セクションの .actionButton を
// そのまま借りている（widgets/topsites が widgets/links の links.module.css を
// そのまま使っているのと同じ考え方。見た目が完全に同じなら複製せず共有する）。
// 並べ方（縦積み）だけ about-section.module.css 側で持つ。
import styles from './layout-presets-editor.module.css';
import listStyles from './about-section.module.css';

/**
 * 見た目タブの最後に置く「このアプリについて」。外部サイトへのリンクだけを並べる。
 * 以前ここにあった「拡張機能の設定を開く」（JSONエクスポート/インポート）は、
 * 同じパネルの「バックアップ」（BackupSection）へ統合した。
 */
export function AboutSection() {
  const t = useT();

  return (
    <div className={listStyles.list}>
      <a className={styles.actionButton} href={SITE_LINKS.home} target="_blank" rel="noopener noreferrer">
        <Home size={14} />
        {t('ホームページ')}
      </a>
      <a className={styles.actionButton} href={SITE_LINKS.terms} target="_blank" rel="noopener noreferrer">
        <FileText size={14} />
        {t('利用規約')}
      </a>
      <a className={styles.actionButton} href={SITE_LINKS.privacy} target="_blank" rel="noopener noreferrer">
        <ShieldCheck size={14} />
        {t('プライバシーポリシー')}
      </a>
    </div>
  );
}

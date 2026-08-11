import { FileText, Home, Settings2, ShieldCheck } from 'lucide-react';

import { SITE_LINKS } from '@/lib/site-links';

// ボタン自体の見た目（丸ピル）は隣の「レイアウト保存」セクションの .actionButton を
// そのまま借りている（widgets/topsites が widgets/links の links.module.css を
// そのまま使っているのと同じ考え方。見た目が完全に同じなら複製せず共有する）。
// 並べ方（縦積み）だけ about-section.module.css 側で持つ。
import styles from './layout-presets-editor.module.css';
import listStyles from './about-section.module.css';

/**
 * 見た目タブの最後に置く「このアプリについて」。
 *
 * 「拡張機能の設定を開く」（JSONエクスポート/インポート等、entrypoints/options 側）は
 * browser.runtime.openOptionsPage() を呼ぶだけなので、拡張機能APIが存在しない
 * 静的サイト版（npm run build:web）では出さない（widgets/registry.ts と同じ
 * import.meta.env.VITE_TARGET による出し分け）。利用規約・プライバシー・ホームページへの
 * リンクは単なる外部リンクなので両ビルドで共通に出す。
 */
export function AboutSection() {
  const isExtension = import.meta.env.VITE_TARGET !== 'web';

  return (
    <div className={listStyles.list}>
      {isExtension && (
        <button
          type="button"
          className={styles.actionButton}
          onClick={() => void browser.runtime.openOptionsPage()}
        >
          <Settings2 size={14} />
          拡張機能の設定を開く（JSONエクスポート等）
        </button>
      )}
      <a className={styles.actionButton} href={SITE_LINKS.home} target="_blank" rel="noopener noreferrer">
        <Home size={14} />
        ホームページ
      </a>
      <a className={styles.actionButton} href={SITE_LINKS.terms} target="_blank" rel="noopener noreferrer">
        <FileText size={14} />
        利用規約
      </a>
      <a className={styles.actionButton} href={SITE_LINKS.privacy} target="_blank" rel="noopener noreferrer">
        <ShieldCheck size={14} />
        プライバシーポリシー
      </a>
    </div>
  );
}

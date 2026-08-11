import { useEffect, useState, type ReactNode } from 'react';

/**
 * ダッシュボードはウィジェットを自由配置するUIのため、モバイル幅では
 * まともに操作できない（編集モードのドラッグ操作もタッチだと厳しい）。
 * 拡張機能版はそもそもモバイルのChromeでは新しいタブの上書きが機能しないため
 * 問題にならないが、Web版（webapp/）はURLさえ知っていれば誰でもスマホから
 * 開けてしまうため、ここだけで案内を挟む。拡張機能版（entrypoints/newtab）には
 * このゲートを組み込んでいない。
 */
const MOBILE_MAX_WIDTH = 768;

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= MOBILE_MAX_WIDTH,
  );

  // matchMedia の 'change' イベントではなく、素朴な window 'resize' イベントで
  // window.innerWidth を直接見る。components/Grid/Grid.tsx の useIsResizing /
  // useViewportHeight と同じ書き味に揃えている。
  useEffect(() => {
    const onResize = (): void => setIsMobile(window.innerWidth <= MOBILE_MAX_WIDTH);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return isMobile;
}

const rootStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '14px',
  padding: '32px 24px',
  textAlign: 'center',
  background: 'linear-gradient(155deg, #241a2e, #0c0d14)',
  color: '#f1ecec',
  fontFamily:
    "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Hiragino Kaku Gothic ProN', 'Yu Gothic UI', sans-serif",
};

/** モバイル幅のときに <App/> の代わりに表示する案内画面。 */
function MobileNotice() {
  return (
    <div style={rootStyle}>
      <div style={{ fontSize: '40px' }} aria-hidden>
        🖥️
      </div>
      <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>PCのブラウザでご覧ください</h1>
      <p style={{ fontSize: '14px', lineHeight: 1.7, opacity: 0.75, maxWidth: '360px', margin: 0 }}>
        AdvancedNewTabはウィジェットを自由に配置するダッシュボードのため、スマートフォンの画面幅には対応していません。
        パソコンのブラウザで開き直してください。
      </p>
    </div>
  );
}

export function MobileGate({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  return isMobile ? <MobileNotice /> : <>{children}</>;
}

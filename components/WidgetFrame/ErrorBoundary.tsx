import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  /** エラー表示に添えるウィジェット名 */
  label: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * ウィジェット1個の例外でページ全体が落ちるのを防ぐ境界。
 *
 * 新規タブは「必ず開くもの」なので、ひとつのウィジェットの不具合で
 * 真っ白になる事態は避けなければならない。エラーは握りつぶさず画面に出し、
 * 該当ウィジェットを削除・設定変更できる状態を保つ。
 */
export class WidgetErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[AdvancedNewTab] ウィジェット「${this.props.label}」でエラーが発生しました`, error, info);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div style={{ padding: 12, fontSize: 13, lineHeight: 1.6 }}>
        <strong>{this.props.label} を表示できません</strong>
        <div style={{ opacity: 0.7, marginTop: 4, wordBreak: 'break-word' }}>{error.message}</div>
      </div>
    );
  }
}

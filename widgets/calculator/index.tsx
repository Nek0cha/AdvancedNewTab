import { useState } from 'react';
import { Calculator as CalculatorIcon } from 'lucide-react';

import { cx } from '@/lib/cx';
import { defineWidget, type WidgetProps } from '@/widgets/types';

import { evaluateExpression, ExpressionError } from './evaluate';
import styles from './calculator.module.css';

interface CalculatorSettings extends Record<string, unknown> {
  /** 結果表示の小数点以下の桁数（丸めのみ。内部計算はJSの標準精度のまま） */
  decimalPlaces: number;
}

const BUTTON_ROWS: ReadonlyArray<ReadonlyArray<string>> = [
  ['C', '⌫', '%', '/'],
  ['7', '8', '9', '*'],
  ['4', '5', '6', '-'],
  ['1', '2', '3', '+'],
  ['0', '.', '(', ')'],
];

function formatResult(value: number, decimalPlaces: number): string {
  // 丸めた上で末尾の0を落とす（3.0 ではなく 3 と出したい）。
  const rounded = Number(value.toFixed(decimalPlaces));
  return rounded.toLocaleString('en-US', { maximumFractionDigits: decimalPlaces });
}

/**
 * 文字での直接入力（"1*2+3="）とボタンでの入力、両方が同じ1本の式（expression）を
 * 操作する。「=」相当（Enterキー / = ボタン）で評価し、結果を次の式の起点にする
 * （一般的な電卓の「続けて計算」の挙動）。
 */
function CalculatorWidget({ settings }: WidgetProps<CalculatorSettings>) {
  const [expression, setExpression] = useState('');
  const [error, setError] = useState<string | null>(null);

  const evaluate = (): void => {
    if (!expression.trim()) return;
    try {
      const result = evaluateExpression(expression);
      setExpression(formatResult(result, settings.decimalPlaces));
      setError(null);
    } catch (e) {
      setError(e instanceof ExpressionError ? e.message : '計算できませんでした');
    }
  };

  const pressButton = (label: string): void => {
    setError(null);
    if (label === 'C') {
      setExpression('');
      return;
    }
    if (label === '⌫') {
      setExpression((prev) => prev.slice(0, -1));
      return;
    }
    setExpression((prev) => prev + label);
  };

  return (
    <div className={styles.root}>
      <input
        type="text"
        className={cx(styles.display, error && styles.displayError, 'ant-no-drag')}
        value={expression}
        placeholder="0"
        onChange={(e) => {
          setExpression(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === '=') {
            e.preventDefault();
            evaluate();
          }
        }}
      />
      {error && <div className={styles.errorText}>{error}</div>}

      <div className={styles.pad}>
        {BUTTON_ROWS.flat().map((label) => (
          <button
            key={label}
            type="button"
            className={cx(
              styles.key,
              'ant-no-drag',
              ['/', '*', '-', '+', '%'].includes(label) && styles.keyOperator,
              (label === 'C' || label === '⌫') && styles.keyClear,
            )}
            onClick={() => pressButton(label)}
          >
            {label}
          </button>
        ))}
        <button type="button" className={cx(styles.key, styles.keyEquals, 'ant-no-drag')} onClick={evaluate}>
          =
        </button>
      </div>
    </div>
  );
}

export const calculatorWidget = defineWidget<CalculatorSettings>({
  type: 'calculator',
  name: '電卓',
  description: '「1*2+3=」のように文字でもボタンでも計算できます。',
  icon: CalculatorIcon,
  defaultLayout: { w: 3, h: 4, minW: 1, minH: 2 },
  defaultSettings: {
    decimalPlaces: 6,
  },
  settingsSchema: [
    {
      kind: 'number',
      key: 'decimalPlaces',
      label: '結果の小数点以下の桁数',
      min: 0,
      max: 10,
      step: 1,
    },
  ],
  Component: CalculatorWidget,
});

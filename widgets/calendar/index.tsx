import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

import { cx } from '@/lib/cx';
import { defineWidget, type WidgetProps } from '@/widgets/types';

import styles from './calendar.module.css';
import { getJapaneseHolidayName } from './japanese-holidays';

interface CalendarSettings extends Record<string, unknown> {
  /** 週の始まりを月曜にするか（既定は日曜始まり） */
  startOnMonday: boolean;
  /** 土曜=青、日曜/祝日=赤で色分けするか */
  colorWeekendsAndHolidays: boolean;
}

const WEEKDAYS_SUN_FIRST = ['日', '月', '火', '水', '木', '金', '土'] as const;

/**
 * 指定した年月のカレンダーを「週の配列」として組み立てる。
 * 月初/月末の欠けはコマを埋めるため null にする（表示側は空セルにする）。
 */
function buildMonthGrid(year: number, month: number, startOnMonday: boolean): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const startOffset = startOnMonday ? (first.getDay() + 6) % 7 : first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function isSameDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function CalendarWidget({ settings }: WidgetProps<CalendarSettings>) {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const weeks = useMemo(
    () => buildMonthGrid(cursor.getFullYear(), cursor.getMonth(), settings.startOnMonday),
    [cursor, settings.startOnMonday],
  );

  const weekdayLabels = settings.startOnMonday
    ? [...WEEKDAYS_SUN_FIRST.slice(1), WEEKDAYS_SUN_FIRST[0]]
    : WEEKDAYS_SUN_FIRST;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <button
          type="button"
          className={cx(styles.navButton, 'ant-no-drag')}
          title="前の月"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
        >
          <ChevronLeft size={14} />
        </button>
        <button
          type="button"
          className={cx(styles.monthLabel, 'ant-no-drag')}
          title="今月に戻る"
          onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
        >
          {cursor.getFullYear()}年 {cursor.getMonth() + 1}月
        </button>
        <button
          type="button"
          className={cx(styles.navButton, 'ant-no-drag')}
          title="次の月"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className={styles.grid}>
        {weekdayLabels.map((w, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <div key={i} className={styles.weekdayCell}>
            {w}
          </div>
        ))}
        {weeks.flatMap((week, wi) =>
          week.map((d, di) => {
            const holidayName = d && settings.colorWeekendsAndHolidays ? getJapaneseHolidayName(d) : null;
            const isSunday = d ? d.getDay() === 0 : false;
            const isSaturday = d ? d.getDay() === 6 : false;
            const isRed = settings.colorWeekendsAndHolidays && (isSunday || !!holidayName);
            const isBlue = settings.colorWeekendsAndHolidays && isSaturday && !holidayName;

            return (
              // eslint-disable-next-line react/no-array-index-key
              <div key={`${wi}-${di}`} className={cx(styles.dayCell, !d && styles.emptyCell)}>
                {d && (
                  <span
                    className={cx(
                      styles.dayNumber,
                      isSameDate(d, today) && styles.today,
                      !isSameDate(d, today) && isRed && styles.red,
                      !isSameDate(d, today) && isBlue && styles.blue,
                    )}
                    title={holidayName ?? undefined}
                  >
                    {d.getDate()}
                  </span>
                )}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}

export const calendarWidget = defineWidget<CalendarSettings>({
  type: 'calendar',
  name: 'カレンダー',
  description: '月表示のシンプルなカレンダーです。',
  icon: CalendarDays,
  defaultLayout: { w: 4, h: 4, minW: 2, minH: 3 },
  defaultSettings: {
    startOnMonday: false,
    colorWeekendsAndHolidays: true,
  },
  settingsSchema: [
    { kind: 'toggle', key: 'startOnMonday', label: '月曜始まりにする' },
    {
      kind: 'toggle',
      key: 'colorWeekendsAndHolidays',
      label: '土日・祝日を色分けする',
      help: '土曜は青、日曜と祝日は赤で表示します（祝日名はマウスオーバーで確認できます）。',
    },
  ],
  Component: CalendarWidget,
});

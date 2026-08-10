export type DateFormat = 'en-long' | 'slash-numeric' | 'ja-long' | 'slash-short';

export const DATE_FORMAT_OPTIONS: ReadonlyArray<{ value: DateFormat; label: string }> = [
  { value: 'en-long', label: 'Aug 20, Friday' },
  { value: 'slash-numeric', label: '2026/8/20' },
  { value: 'ja-long', label: '2026年8月20日' },
  { value: 'slash-short', label: '8/20' },
];

export function formatClockDate(date: Date, format: DateFormat): string {
  switch (format) {
    case 'en-long': {
      const md = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
      return `${md}, ${weekday}`;
    }
    case 'slash-numeric':
      return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
    case 'ja-long':
      return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    case 'slash-short':
      return `${date.getMonth() + 1}/${date.getDate()}`;
  }
}

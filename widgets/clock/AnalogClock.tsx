import styles from './clock.module.css';

interface AnalogClockProps {
  now: Date;
  showSeconds: boolean;
}

const TICKS = Array.from({ length: 12 }, (_, i) => i);

/** シンプルな文字盤のアナログ時計。SVGの回転で針を表現する。 */
export function AnalogClock({ now, showSeconds }: AnalogClockProps) {
  const hours = now.getHours() % 12;
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  const hourAngle = (hours + minutes / 60) * 30;
  const minuteAngle = (minutes + seconds / 60) * 6;
  const secondAngle = seconds * 6;

  return (
    <svg className={styles.analogFace} viewBox="0 0 100 100" role="img" aria-label="アナログ時計">
      <circle className={styles.analogRim} cx="50" cy="50" r="47" />
      {TICKS.map((i) => {
        const isMajor = i % 3 === 0;
        const angle = i * 30;
        return (
          <line
            key={i}
            className={isMajor ? styles.tickMajor : styles.tickMinor}
            x1="50"
            y1={isMajor ? 8 : 10}
            x2="50"
            y2="14"
            transform={`rotate(${angle} 50 50)`}
          />
        );
      })}
      <line
        className={styles.hourHand}
        x1="50"
        y1="54"
        x2="50"
        y2="27"
        transform={`rotate(${hourAngle} 50 50)`}
      />
      <line
        className={styles.minuteHand}
        x1="50"
        y1="56"
        x2="50"
        y2="17"
        transform={`rotate(${minuteAngle} 50 50)`}
      />
      {showSeconds && (
        <line
          className={styles.secondHand}
          x1="50"
          y1="60"
          x2="50"
          y2="13"
          transform={`rotate(${secondAngle} 50 50)`}
        />
      )}
      <circle className={styles.centerDot} cx="50" cy="50" r="2.6" />
    </svg>
  );
}

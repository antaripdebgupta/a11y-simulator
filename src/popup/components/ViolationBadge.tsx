import React, { useEffect, useRef, useState } from 'react';

interface ViolationBadgeProps {
  count: number;
}

type Severity = 'green' | 'amber' | 'red';

const getSeverity = (count: number): Severity => {
  if (count === 0) return 'green';
  if (count < 5) return 'amber';
  return 'red';
};

const SEVERITY_COLORS: Record<Severity, string> = {
  green: '#15803d',
  amber: '#b45309',
  red: '#b91c1c',
};

export const ViolationBadge: React.FC<ViolationBadgeProps> = ({ count }) => {
  const [isPulsing, setIsPulsing] = useState(false);
  const prevCountRef = useRef<number | null>(null);

  useEffect(() => {
    if (prevCountRef.current !== null && prevCountRef.current !== count) {
      setIsPulsing(true);
    }
    prevCountRef.current = count;
  }, [count]);

  const severity = getSeverity(count);
  const color = SEVERITY_COLORS[severity];

  return (
    <div
      className="violation-badge"
      role="status"
      aria-live="polite"
      aria-label={`${count} WCAG violations on this page`}
    >
      <span
        className={`violation-count${isPulsing ? ' violation-count--pulse' : ''}`}
        style={{ color }}
        onAnimationEnd={() => setIsPulsing(false)}
      >
        {count}
      </span>
      <span className="violation-label" style={{ color }}>
        WCAG violations on this page
      </span>
    </div>
  );
};

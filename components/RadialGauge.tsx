/** A circular stroke-dasharray gauge - a score in the middle of a ring that fills clockwise from empty (grey)
 * to full (orange), plus a short label. A different read on the same progress a segmented meter shows: one
 * number instead of a fraction of blocks. */
export function RadialGauge({
  progress,
  score,
  label,
  size = 84,
}: {
  progress: number;
  score: string;
  label: string;
  size?: number;
}) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = Math.min(1, Math.max(0, progress)) * c;

  return (
    <div className="radial-gauge">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.2}
          strokeWidth={stroke}
        />
        <circle
          className="radial-gauge-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={`${filled} ${c - filled}`}
          strokeLinecap="square"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div>
        <span className="radial-gauge-score">{score}</span>
        <span className="radial-gauge-label">{label}</span>
      </div>
    </div>
  );
}

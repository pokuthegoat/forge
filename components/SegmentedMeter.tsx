/** A progress bar made of discrete blocks instead of a smooth fill - reads as a counted meter
 * (like a battery level or a loading strip) rather than a gradient bar. */
export function SegmentedMeter({
  progress,
  segments = 10,
}: {
  progress: number;
  segments?: number;
}) {
  const filled = Math.round(Math.min(1, Math.max(0, progress)) * segments);
  return (
    <div className="seg-meter">
      {Array.from({ length: segments }).map((_, i) => (
        <span key={i} className={`seg-meter-cell${i < filled ? " is-filled" : ""}`} />
      ))}
    </div>
  );
}

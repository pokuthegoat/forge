/** Renders a grid of coloured cells as crisp, blocky pixel art (nearest-neighbour, no smoothing) - the same
 * "chunky pixels" look as the background blob, used here for small decorative illustrations instead of photos. */
export function PixelArt({
  size,
  grid,
  cell,
}: {
  size: number;
  grid: number;
  cell: (x: number, y: number, grid: number) => string | null;
}) {
  const cells: { x: number; y: number; color: string }[] = [];
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      const color = cell(x, y, grid);
      if (color) cells.push({ x, y, color });
    }
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${grid} ${grid}`}
      shapeRendering="crispEdges"
      style={{ imageRendering: "pixelated", flex: "none" }}
      aria-hidden="true"
    >
      {cells.map((c, i) => (
        <rect key={i} x={c.x} y={c.y} width={1} height={1} fill={c.color} />
      ))}
    </svg>
  );
}

/** A classic casino poker chip: alternating rim notches, a black ring, and a red inner ring around a white
 * centre - built from the grid's own geometry (radius + angle) rather than hand-placed pixels, so it's always
 * a clean circle no matter the resolution. */
export function pokerChipCell(x: number, y: number, grid: number): string | null {
  const cx = ((x + 0.5) / grid) * 2 - 1;
  const cy = ((y + 0.5) / grid) * 2 - 1;
  const r = Math.sqrt(cx * cx + cy * cy);
  if (r > 1) return null;

  if (r > 0.86) {
    const angle = Math.atan2(cy, cx);
    const sector = Math.floor(((angle + Math.PI) / (Math.PI * 2)) * 12) % 12;
    return sector % 2 === 0 ? "#ff6a2c" : "#f2f2f2";
  }
  if (r > 0.76) return "#0a0a0a";
  if (r > 0.3) return "#0a0a0a";
  if (r > 0.2) return "#ff6a2c";
  return "#f2f2f2";
}

/** A playing card silhouette with a diamond pip, for a small table-top scene alongside the chip. A diamond is
 * just |x| + |y| <= r, so it stays a clean, unambiguous shape even at this low a pixel resolution - a spade's
 * two-lobed top reads as a blob once it's this chunky. */
export function diamondCardCell(x: number, y: number, grid: number): string | null {
  const w = grid * 0.62;
  const h = grid;
  const left = (grid - w) / 2;
  if (x < left || x >= left + w) return null;

  const cx = (x - left - w / 2) / (w / 2); // -1 (left) .. 1 (right)
  const cy = (y - h / 2) / (h / 2); // -1 (top) .. 1 (bottom)

  const inDiamond = Math.abs(cx) * 1.4 + Math.abs(cy) < 0.55;

  return inDiamond ? "#ff6a2c" : "#f2f2f2";
}

/** A six-sided die showing five pips - a square body (rounded by nothing, this resolution doesn't support real
 * corner rounding) with a fixed 5-dot pattern, built the same way as the chip and card: from geometry, not
 * hand-placed pixels, so it holds up at any grid size. */
export function diceCell(x: number, y: number, grid: number): string | null {
  const s = grid * 0.84;
  const left = (grid - s) / 2;
  const top = (grid - s) / 2;
  if (x < left || x >= left + s || y < top || y >= top + s) return null;

  const cx = (x - left) / s; // 0..1 across the die's own body
  const cy = (y - top) / s;

  const edge = 0.07;
  if (cx < edge || cx > 1 - edge || cy < edge || cy > 1 - edge) return "#0a0a0a";

  const pipR = 0.1;
  const pips: [number, number][] = [
    [0.24, 0.24], [0.76, 0.24],
    [0.5, 0.5],
    [0.24, 0.76], [0.76, 0.76],
  ];
  for (const [px, py] of pips) {
    const dx = cx - px, dy = cy - py;
    if (dx * dx + dy * dy < pipR * pipR) return "#ff6a2c";
  }
  return "#f2f2f2";
}

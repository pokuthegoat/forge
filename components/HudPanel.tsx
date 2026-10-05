import type { CSSProperties, ReactNode } from "react";

/** A bordered readout panel with corner tick-marks instead of a title bar - this page's terminal/HUD language,
 * used in place of the Windows-chrome `Window` component here specifically. */
export function HudPanel({
  label,
  tag,
  children,
  style,
  bodyStyle,
}: {
  label: string;
  tag?: string;
  children: ReactNode;
  style?: CSSProperties;
  bodyStyle?: CSSProperties;
}) {
  return (
    <div className="hud-panel" style={style}>
      <div className="hud-header">
        <span>{label}</span>
        {tag && <span className="hud-tag">{tag}</span>}
      </div>
      <div className="hud-body" style={bodyStyle}>{children}</div>
    </div>
  );
}

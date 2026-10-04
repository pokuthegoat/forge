import type { CSSProperties, ReactNode } from "react";

/** An old-OS window frame (title bar + beveled body), used in place of a plain box wherever the app shows a
 * form or a stat readout - part of the gothic-terminal theme, so even a settings panel looks like a program
 * running on a haunted computer. */
export function Window({
  title,
  children,
  style,
  bodyStyle,
}: {
  title: string;
  children: ReactNode;
  style?: CSSProperties;
  bodyStyle?: CSSProperties;
}) {
  return (
    <div className="window" style={style}>
      <div className="window-titlebar">
        <span className="window-titlebar-label">♦ {title}</span>
        <span className="window-titlebar-buttons">
          <span className="window-titlebar-btn">_</span>
          <span className="window-titlebar-btn">×</span>
        </span>
      </div>
      <div className="window-body" style={bodyStyle}>
        {children}
      </div>
    </div>
  );
}

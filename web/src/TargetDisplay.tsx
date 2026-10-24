import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { OptionRef, Theme } from "./types";
import { hexToRgb, optionAccent } from "./theme";
import { isBrowser } from "./nui";
import { GameRender } from "./GameRender";
type TargetDisplayProps = {
  items: OptionRef[];
  mode: string;
  theme: Theme;
  anchor: { visible: boolean; x: number; y: number };
  holding?: number | null;
  status?: { type: string; message?: string };
  preview?: boolean;
  showCursorHint?: boolean;
  opacity?: number;
  onBegin?: (option: OptionRef) => void;
  onCancel?: () => void;
};

export function TargetDisplay({
  items,
  mode,
  theme,
  anchor,
  holding,
  status,
  preview = false,
  showCursorHint = false,
  opacity = 1,
  onBegin,
  onCancel,
}: TargetDisplayProps) {
  const menuRef = useRef<HTMLElement>(null);
  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  useLayoutEffect(() => {
    const resize = () =>
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const [panelSize, setPanelSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const measure = () =>
      setPanelSize({ width: menu.offsetWidth, height: menu.offsetHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(menu);
    return () => observer.disconnect();
  }, [items.length, mode, anchor.visible]);
  if (
    (items.length === 0 && mode !== "classic") ||
    (mode === "dui" && !anchor.visible)
  )
    return null;
  const anchorY = anchor.y * viewport.height;
  const menuY = preview
    ? -18
    : Math.max(
        (12 - anchorY) / theme.scale,
        Math.min(
          -18,
          (viewport.height - 12 - anchorY) / theme.scale - panelSize.height,
        ),
      );
  const panelWidth =
    mode === "dui"
      ? (theme.width * (theme.preset === "minimal" ? 240 : 260)) / 280
      : theme.preset === "minimal"
        ? (theme.width * 248) / 280
        : theme.width;
  const anchorX =
    mode === "dui"
      ? anchor.x
      : theme.position === "left"
        ? 0.27
        : theme.position === "right"
          ? 0.73
          : 0.5;
  const side =
    !preview &&
    anchorX * viewport.width +
      (22 + (panelSize.width || panelWidth)) * theme.scale >
      viewport.width - 12
      ? "left"
      : "right";
  const connectorX = side === "left" ? -20 : 20;
  const connectorY = menuY + 18;
  const connectorLength = Math.sqrt(connectorX ** 2 + connectorY ** 2);
  const connectorAngle = Math.atan2(connectorY, connectorX) * (180 / Math.PI);
  const shellStyle = {
    "--anchor-x": `${anchor.x * 100}%`,
    "--anchor-y": `${anchor.y * 100}%`,
    "--menu-y": `${menuY}px`,
    "--connector-length": `${connectorLength}px`,
    "--connector-angle": `${connectorAngle}deg`,
    opacity,
  } as CSSProperties;

  return (
    <div
      className={`target-shell side-${side} ${preview ? "target-preview" : ""}`}
      style={shellStyle}
    >
      {theme.indicator && (
        <div
          className={`reticle indicator-${theme.indicatorStyle} ${items.length > 0 ? "ready" : ""}`}
          aria-hidden="true"
        >
          {theme.indicatorStyle === "dot" ? (
            <i />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              {theme.indicatorStyle === "ring" ? (
                <>
                  <circle
                    cx="12"
                    cy="12"
                    r="8.5"
                    stroke="#090a0e"
                    strokeWidth="2.8"
                    vectorEffect="non-scaling-stroke"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="8.5"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    vectorEffect="non-scaling-stroke"
                  />
                </>
              ) : (
                <>
                  <path
                    d="M6 4.5H18Q19.5 4.5 19.5 6V18Q19.5 19.5 18 19.5H6Q4.5 19.5 4.5 18V6Q4.5 4.5 6 4.5Z"
                    stroke="#090a0e"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  <path
                    d="M6 4.5H18Q19.5 4.5 19.5 6V18Q19.5 19.5 18 19.5H6Q4.5 19.5 4.5 18V6Q4.5 4.5 6 4.5Z"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                </>
              )}
            </svg>
          )}
        </div>
      )}
      {mode === "dui" && items.length > 0 && (
        <span className="dui-connector" aria-hidden="true" />
      )}
      {items.length > 0 && (
        <section
          ref={menuRef}
          className={`target-menu ${!isBrowser ? "game-surface" : ""}`}
        >
          {!isBrowser &&
            !preview &&
            theme.preset === "glass" &&
            !theme.highContrast &&
            theme.blur > 0 && <GameRender blur={theme.blur} />}
          {showCursorHint && (
            <small className="cursor-hint">ALT + CLICK FOR CURSOR</small>
          )}
          <div className="option-list">
            {items.map((option, index) => (
              <button
                className={`option ${option.description || option.interactionState?.reason ? "has-description" : ""} ${holding === option.slot ? "holding" : ""} state-${option.interactionState?.status ?? "available"}`}
                disabled={
                  option.interactionState?.status !== undefined &&
                  option.interactionState.status !== "available"
                }
                title={[
                  option.label,
                  option.interactionState?.reason ?? option.description,
                ]
                  .filter(Boolean)
                  .join(" — ")}
                style={
                  {
                    "--hold": `${option.hold ?? 0}ms`,
                    "--option-accent": optionAccent(
                      theme,
                      option.accent,
                      option.category,
                    ),
                    "--option-accent-rgb": hexToRgb(
                      optionAccent(theme, option.accent, option.category),
                    ),
                  } as CSSProperties
                }
                key={`${option.targetType}-${option.targetId}-${option.zoneId ?? 0}`}
                onMouseDown={() => onBegin?.(option)}
                onMouseUp={onCancel}
                onMouseLeave={onCancel}
                type="button"
              >
                {(option.key || index < 5) && (
                  <span className="keycap">{option.key ?? index + 1}</span>
                )}
                <i
                  className={option.icon ?? "fa-solid fa-circle-dot"}
                  style={{
                    color:
                      theme.highContrast ||
                      theme.colorVision !== "normal" ||
                      (option.interactionState?.status !== undefined &&
                        option.interactionState.status !== "available")
                        ? undefined
                        : option.iconColor,
                  }}
                />
                <span className="copy">
                  <strong>{option.label}</strong>
                  {(option.interactionState?.reason || option.description) && (
                    <small>
                      {option.interactionState?.reason ?? option.description}
                    </small>
                  )}
                </span>
                {option.badge && <b className="badge">{option.badge}</b>}
                <span className="hold-ring" />
              </button>
            ))}
          </div>
          {status?.type && (
            <div className={`feedback ${status.type}`}>
              {status.type === "pending" && (
                <i className="fa-solid fa-spinner fa-spin" />
              )}
              {status.message ?? status.type}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

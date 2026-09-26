import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { fetchNui, isBrowser } from "./nui";
import type {
  FontDefinition,
  NuiMessage,
  OptionRef,
  TargetOption,
  Theme,
} from "./types";

const fallbackTheme: Theme = {
  preset: "precision",
  accent: "#7c5cff",
  surface: "#111217",
  text: "#f7f7fb",
  mutedText: "#9a9baa",
  opacity: 0.92,
  radius: 10,
  scale: 1,
  position: "center",
  font: "montserrat",
  animations: true,
  indicator: true,
  highlight: true,
};

const fallbackFonts: FontDefinition[] = [
  {
    id: "montserrat",
    label: "Montserrat",
    family: "Montserrat",
    file: "Montserrat-Variable.woff2",
    weight: "100 900",
  },
  { id: "system", label: "System", family: "Segoe UI" },
  { id: "condensed", label: "Condensed", family: "Arial Narrow" },
];

const presetThemes: Record<string, Partial<Theme>> = {
  precision: {
    surface: "#111217",
    text: "#f7f7fb",
    mutedText: "#9a9baa",
    opacity: 0.92,
    radius: 10,
    scale: 1,
  },
  minimal: {
    surface: "#0c0d10",
    text: "#ffffff",
    mutedText: "#a5a7af",
    opacity: 0.78,
    radius: 6,
    scale: 0.96,
  },
  glass: {
    surface: "#171923",
    text: "#ffffff",
    mutedText: "#b5b8c8",
    opacity: 0.68,
    radius: 16,
    scale: 1.02,
  },
  compact: {
    surface: "#101116",
    text: "#f7f7fb",
    mutedText: "#8e909d",
    opacity: 0.94,
    radius: 8,
    scale: 0.88,
  },
  classic: {
    surface: "#090a0d",
    text: "#ffffff",
    mutedText: "#b1b1b8",
    opacity: 0.96,
    radius: 2,
    scale: 1,
  },
};

const previewItems: OptionRef[] = [
  {
    label: "Open vehicle",
    description: "Driver door",
    icon: "fa-solid fa-lock-open",
    key: "E",
    targetType: "preview",
    targetId: 1,
    slot: 1,
    badge: "NEW",
  },
  {
    label: "Inspect engine",
    description: "Hold to interact",
    icon: "fa-solid fa-wrench",
    targetType: "preview",
    targetId: 2,
    slot: 2,
  },
];

function flatten(
  options?: Record<string, TargetOption[]>,
  zones?: TargetOption[][],
) {
  const result: OptionRef[] = [];
  Object.entries(options ?? {}).forEach(([type, list]) =>
    list?.forEach((option, index) => {
      if (!option.hide)
        result.push({
          ...option,
          targetType: type,
          targetId: index + 1,
          slot: result.length + 1,
        });
    }),
  );
  zones?.forEach((list, zoneIndex) =>
    list.forEach((option, index) => {
      if (!option.hide)
        result.push({
          ...option,
          targetType: "zones",
          targetId: index + 1,
          zoneId: zoneIndex + 1,
          slot: result.length + 1,
        });
    }),
  );
  return result;
}

function hexToRgb(value: string) {
  const hex = value.replace("#", "");
  const parsed = Number.parseInt(hex, 16);
  if (hex.length !== 6 || Number.isNaN(parsed)) return "124, 92, 255";
  return `${(parsed >> 16) & 255}, ${(parsed >> 8) & 255}, ${parsed & 255}`;
}

function themeVariables(theme: Theme, fonts: FontDefinition[]) {
  const selectedFont = fonts.find((font) => font.id === theme.font);
  return {
    "--accent": theme.accent,
    "--accent-rgb": hexToRgb(theme.accent),
    "--surface": theme.surface,
    "--surface-rgb": hexToRgb(theme.surface),
    "--surface-alpha": theme.opacity,
    "--text": theme.text,
    "--text-rgb": hexToRgb(theme.text),
    "--muted": theme.mutedText,
    "--muted-rgb": hexToRgb(theme.mutedText),
    "--radius": `${theme.radius}px`,
    "--scale": theme.scale,
    "--font-ui": `"${selectedFont?.family ?? "Montserrat"}", "Segoe UI", sans-serif`,
  } as CSSProperties;
}

function useFontCatalog(fonts: FontDefinition[]) {
  useEffect(() => {
    if (!("FontFace" in window)) return;
    fonts.forEach((font) => {
      if (!font.file) return;
      const face = new FontFace(
        font.family,
        `url("./fonts/${encodeURIComponent(font.file)}") format("woff2")`,
        {
          weight: font.weight ?? "400 800",
          style: "normal",
        },
      );
      void face
        .load()
        .then((loaded) =>
          (
            document.fonts as FontFaceSet & { add(face: FontFace): FontFaceSet }
          ).add(loaded),
        )
        .catch(() => undefined);
    });
  }, [fonts]);
}

type TargetDisplayProps = {
  items: OptionRef[];
  mode: string;
  theme: Theme;
  anchor: { visible: boolean; x: number; y: number };
  holding?: number | null;
  status?: { type: string; message?: string };
  preview?: boolean;
  onBegin?: (option: OptionRef) => void;
  onCancel?: () => void;
};

function TargetDisplay({
  items,
  mode,
  theme,
  anchor,
  holding,
  status,
  preview = false,
  onBegin,
  onCancel,
}: TargetDisplayProps) {
  if (
    (items.length === 0 && mode !== "classic") ||
    (mode === "dui" && !anchor.visible)
  )
    return null;
  const panelHeight =
    items.length === 1 ? 54 : Math.min(330, 42 + items.length * 44);
  const anchorY = anchor.y * window.innerHeight;
  const menuY = Math.max(
    12 - anchorY,
    Math.min(-20, window.innerHeight - 12 - panelHeight - anchorY),
  );
  const side = mode === "dui" && anchor.x > 0.72 ? "left" : "right";
  const connectorX = side === "left" ? -20 : 20;
  const connectorY = menuY + 20;
  const connectorLength = Math.sqrt(connectorX ** 2 + connectorY ** 2);
  const connectorAngle = Math.atan2(connectorY, connectorX) * (180 / Math.PI);
  const shellStyle = {
    "--anchor-x": `${anchor.x * 100}%`,
    "--anchor-y": `${anchor.y * 100}%`,
    "--menu-y": `${menuY}px`,
    "--connector-length": `${connectorLength}px`,
    "--connector-angle": `${connectorAngle}deg`,
  } as CSSProperties;

  return (
    <div
      className={`target-shell side-${side} ${preview ? "target-preview" : ""}`}
      style={shellStyle}
    >
      {theme.indicator && (
        <div
          className={`reticle ${items.length > 0 ? "ready" : ""}`}
          aria-hidden="true"
        >
          <i />
        </div>
      )}
      {mode === "dui" && items.length > 0 && (
        <span className="dui-connector" aria-hidden="true" />
      )}
      {items.length > 0 && (
        <section
          className={`target-menu ${items.length === 1 ? "single" : ""}`}
        >
          <div className="menu-title">
            <span>INTERACTION</span>
            <small>ALT + CLICK FOR CURSOR</small>
          </div>
          <div className="option-list">
            {items.map((option, index) => (
              <button
                className={`option ${holding === option.slot ? "holding" : ""}`}
                style={
                  {
                    "--hold": `${option.hold ?? 0}ms`,
                    "--option-accent": option.accent ?? theme.accent,
                    "--option-accent-rgb": hexToRgb(
                      option.accent ?? theme.accent,
                    ),
                  } as CSSProperties
                }
                key={`${option.targetType}-${option.targetId}-${option.zoneId ?? 0}`}
                onMouseDown={() => onBegin?.(option)}
                onMouseUp={onCancel}
                onMouseLeave={onCancel}
                type="button"
              >
                <span
                  className={`keycap ${index > 4 && !option.key ? "empty" : ""}`}
                >
                  {option.key ?? (index < 5 ? index + 1 : "·")}
                </span>
                <i
                  className={option.icon ?? "fa-solid fa-circle-dot"}
                  style={{ color: option.iconColor }}
                />
                <span className="copy">
                  <strong>{option.label}</strong>
                  {option.description && <small>{option.description}</small>}
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

function RangeField({
  label,
  value,
  min,
  max,
  step,
  display,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const progress = ((value - min) / (max - min)) * 100;
  return (
    <label className={`field range-field ${disabled ? "disabled" : ""}`}>
      <span>
        {label} <b>{display}</b>
      </span>
      <span
        className="range-control"
        style={{ "--range": `${progress}%` } as CSSProperties}
      >
        <span className="range-track">
          <i />
        </span>
        <input
          aria-label={label}
          disabled={disabled}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </span>
    </label>
  );
}

function SwitchField({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className={`field switch-field ${disabled ? "disabled" : ""}`}>
      <span>{label}</span>
      <button
        aria-checked={checked}
        aria-label={label}
        className="switch"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        role="switch"
        type="button"
      >
        <span />
      </button>
    </div>
  );
}

function Dropdown({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const currentIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selectAt = (index: number) =>
    onChange(options[(index + options.length) % options.length].value);
  const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      selectAt(currentIndex + (event.key === "ArrowDown" ? 1 : -1));
      setOpen(true);
    } else if (event.key === "Escape") setOpen(false);
  };
  return (
    <div
      className={`field dropdown-field ${disabled ? "disabled" : ""}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <span>{label}</span>
      <div className="dropdown">
        <button
          aria-expanded={open}
          aria-haspopup="listbox"
          className="dropdown-trigger"
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
          onKeyDown={onKeyDown}
          type="button"
        >
          {options[currentIndex]?.label ?? value}
          <i className="fa-solid fa-chevron-down" />
        </button>
        {open && (
          <div className="dropdown-menu" role="listbox" aria-label={label}>
            {options.map((option) => (
              <button
                aria-selected={option.value === value}
                className={option.value === value ? "selected" : ""}
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                role="option"
                type="button"
              >
                {option.label}
                {option.value === value && <i className="fa-solid fa-check" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type EditorState = {
  admin: boolean;
  allowed: Record<string, boolean>;
  presets: string[];
  snapshot: Theme;
  resetTheme: Theme;
};

function ThemeEditor({
  state,
  fonts,
  onClose,
}: {
  state: EditorState;
  fonts: FontDefinition[];
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(state.snapshot);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">(
    "idle",
  );
  const can = (key: string) => state.admin || state.allowed[key] === true;
  const updateTheme = (next: Theme) => {
    setDraft(next);
    setSaveState("idle");
    void fetchNui("previewTheme", next);
  };
  const update = <K extends keyof Theme>(key: K, value: Theme[K]) => {
    if (can(key)) updateTheme({ ...draft, [key]: value });
  };
  const applyPreset = (preset: string) => {
    if (!can("preset")) return;
    const values = presetThemes[preset] ?? {};
    const next = { ...draft, preset };
    (Object.keys(values) as (keyof Theme)[]).forEach((key) => {
      if (can(key)) Object.assign(next, { [key]: values[key] });
    });
    updateTheme(next);
  };
  const editorVars = themeVariables(draft, fonts);
  return (
    <div className="editor-backdrop">
      <section className="editor" style={editorVars} aria-label="Theme creator">
        <header>
          <div>
            <h2>{state.admin ? "Server theme" : "Your interface"}</h2>
            <p>Preview and tune the interaction system in real time.</p>
          </div>
          <button
            className="icon-btn"
            aria-label="Close theme editor"
            onClick={onClose}
            type="button"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </header>
        <div
          className={`preview-stage app mode-focus preset-${draft.preset} ${draft.animations ? "motion" : ""}`}
          style={editorVars}
        >
          <span className="preview-label">LIVE PREVIEW</span>
          <TargetDisplay
            anchor={{ visible: true, x: 0.5, y: 0.55 }}
            items={previewItems}
            mode="focus"
            preview
            theme={draft}
          />
        </div>
        <div className="preset-grid" aria-label="Theme presets">
          {state.presets.map((preset) => (
            <button
              disabled={!can("preset")}
              className={draft.preset === preset ? "active" : ""}
              onClick={() => applyPreset(preset)}
              key={preset}
              type="button"
            >
              {preset}
            </button>
          ))}
        </div>
        <div className="fields">
          {(["accent", "surface", "text", "mutedText"] as const).map((key) => (
            <label
              className={`field color-field ${!can(key) ? "disabled" : ""}`}
              key={key}
            >
              <span>
                {key === "mutedText"
                  ? "Muted text"
                  : key[0].toUpperCase() + key.slice(1)}
                <small>{draft[key]}</small>
              </span>
              <span
                className="color-control"
                style={{ backgroundColor: draft[key] }}
              >
                <input
                  aria-label={key}
                  disabled={!can(key)}
                  type="color"
                  value={draft[key]}
                  onChange={(event) => update(key, event.target.value)}
                />
              </span>
            </label>
          ))}
          <RangeField
            label="Opacity"
            value={draft.opacity}
            min={0.45}
            max={1}
            step={0.01}
            display={`${Math.round(draft.opacity * 100)}%`}
            disabled={!can("opacity")}
            onChange={(value) => update("opacity", value)}
          />
          <RangeField
            label="Radius"
            value={draft.radius}
            min={0}
            max={24}
            step={1}
            display={`${draft.radius}px`}
            disabled={!can("radius")}
            onChange={(value) => update("radius", value)}
          />
          <RangeField
            label="Scale"
            value={draft.scale}
            min={0.75}
            max={1.35}
            step={0.01}
            display={`${Math.round(draft.scale * 100)}%`}
            disabled={!can("scale")}
            onChange={(value) => update("scale", value)}
          />
          <Dropdown
            label="Position"
            value={draft.position}
            disabled={!can("position")}
            onChange={(value) => update("position", value as Theme["position"])}
            options={[
              { value: "left", label: "Left" },
              { value: "center", label: "Center" },
              { value: "right", label: "Right" },
            ]}
          />
          <Dropdown
            label="Typeface"
            value={draft.font}
            disabled={!can("font")}
            onChange={(value) => update("font", value)}
            options={fonts.map((font) => ({
              value: font.id,
              label: font.label,
            }))}
          />
          <SwitchField
            label="Animations"
            checked={draft.animations}
            disabled={!can("animations")}
            onChange={(value) => update("animations", value)}
          />
          <SwitchField
            label="Indicator"
            checked={draft.indicator}
            disabled={!can("indicator")}
            onChange={(value) => update("indicator", value)}
          />
          <SwitchField
            label="Entity highlight"
            checked={draft.highlight}
            disabled={!can("highlight")}
            onChange={(value) => update("highlight", value)}
          />
        </div>
        <footer>
          {saveState === "error" && (
            <span className="save-error">Theme could not be saved.</span>
          )}
          <button onClick={() => updateTheme(state.resetTheme)} type="button">
            Reset
          </button>
          <button onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className="primary"
            disabled={saveState === "saving"}
            onClick={async () => {
              setSaveState("saving");
              try {
                const response = await fetchNui<{ ok?: boolean }>(
                  "saveTheme",
                  draft,
                );
                if (response?.ok === false) throw new Error("save failed");
              } catch {
                setSaveState("error");
              }
            }}
            type="button"
          >
            {saveState === "saving" ? "Saving…" : "Save theme"}
          </button>
        </footer>
      </section>
    </div>
  );
}

export function App() {
  const params = new URLSearchParams(window.location.search);
  const [visible, setVisible] = useState(isBrowser);
  const [mode, setMode] = useState(
    isBrowser && params.has("dui") ? "dui" : "focus",
  );
  const [anchor, setAnchor] = useState({ visible: isBrowser, x: 0.5, y: 0.5 });
  const [items, setItems] = useState<OptionRef[]>(
    isBrowser ? previewItems : [],
  );
  const [theme, setTheme] = useState(fallbackTheme);
  const [fonts, setFonts] = useState<FontDefinition[]>(fallbackFonts);
  const [status, setStatus] = useState<{ type: string; message?: string }>({
    type: "",
  });
  const [holding, setHolding] = useState<number | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(
    isBrowser && params.has("theme")
      ? {
          admin: true,
          allowed: {},
          presets: ["precision", "minimal", "glass", "compact", "classic"],
          snapshot: fallbackTheme,
          resetTheme: fallbackTheme,
        }
      : null,
  );
  const holdTimer = useRef<number | undefined>(undefined);
  useFontCatalog(fonts);
  const select = useCallback(
    (option: OptionRef) =>
      void fetchNui("select", [
        option.targetType,
        option.targetId,
        option.zoneId,
      ]),
    [],
  );
  const cancelHold = useCallback(() => {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    holdTimer.current = undefined;
    setHolding(null);
  }, []);
  const begin = useCallback(
    (option: OptionRef) => {
      if (!option.hold) return select(option);
      cancelHold();
      setHolding(option.slot);
      holdTimer.current = window.setTimeout(() => {
        setHolding(null);
        holdTimer.current = undefined;
        select(option);
      }, option.hold);
    },
    [cancelHold, select],
  );
  const clearTarget = useCallback(() => {
    setItems([]);
    setStatus({ type: "" });
    setAnchor({ visible: false, x: 0.5, y: 0.5 });
    cancelHold();
  }, [cancelHold]);

  useEffect(() => {
    const listener = (event: MessageEvent<NuiMessage>) => {
      const data = event.data;
      if (data.event === "visible") {
        setVisible(Boolean(data.state));
        if (!data.state) clearTarget();
      } else if (data.event === "leftTarget") clearTarget();
      else if (data.event === "setTarget") {
        const nextItems = flatten(data.options, data.zones);
        setItems(nextItems);
        setStatus({ type: "" });
        setVisible(true);
        if (data.mode) setMode(data.mode);
        setAnchor({
          visible:
            data.hasTarget !== false &&
            nextItems.length > 0 &&
            data.anchor?.visible !== false,
          x: data.anchor?.x ?? 0.5,
          y: data.anchor?.y ?? 0.5,
        });
        if (data.theme) setTheme(data.theme);
        if (data.fonts?.length) setFonts(data.fonts);
      } else if (data.event === "targetAnchor" && data.anchor)
        setAnchor((current) => ({
          visible: data.anchor?.visible !== false && items.length > 0,
          x: data.anchor?.x ?? current.x,
          y: data.anchor?.y ?? current.y,
        }));
      else if (data.event === "theme" && data.theme) {
        setTheme(data.theme);
        if (data.fonts?.length) setFonts(data.fonts);
      } else if (data.event === "holdVisual")
        setHolding(data.pressed && data.slot ? data.slot : null);
      else if (data.event === "actionResult")
        setStatus({ type: data.status ?? "", message: data.message });
      else if (data.event === "themeEditor") {
        if (data.state && data.theme) {
          if (data.fonts?.length) setFonts(data.fonts);
          setTheme(data.theme);
          setEditor({
            admin: Boolean(data.admin),
            allowed: data.allowed ?? {},
            presets: data.presets ?? [],
            snapshot: data.theme,
            resetTheme: data.resetTheme ?? data.theme,
          });
        } else setEditor(null);
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [clearTarget, items.length]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (editor && event.key === "Escape") {
        void fetchNui("cancelTheme");
        setEditor(null);
        return;
      }
      if (event.key === "Escape" || event.key === "Backspace") {
        void fetchNui("setCursor", { state: false });
        return;
      }
      if (!isBrowser || !visible) return;
      const custom = items.find(
        (item) => item.key?.toLowerCase() === event.key.toLowerCase(),
      );
      if (custom) {
        begin(custom);
        return;
      }
      const slot = Number(event.key);
      const slotItem = slot >= 1 && slot <= 5 ? items[slot - 1] : undefined;
      if (slotItem && !slotItem.key) begin(slotItem);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", cancelHold);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", cancelHold);
    };
  }, [begin, cancelHold, editor, items, visible]);

  const vars = useMemo(() => themeVariables(theme, fonts), [fonts, theme]);
  return (
    <main
      style={vars}
      className={`app mode-${mode} pos-${theme.position} preset-${theme.preset} ${theme.animations ? "motion" : ""}`}
      onMouseDown={(event) => {
        if (!editor && event.currentTarget === event.target) {
          cancelHold();
          void fetchNui("setCursor", { state: false });
        }
      }}
    >
      {visible && (
        <TargetDisplay
          anchor={
            mode === "dui"
              ? anchor
              : { visible: items.length > 0, x: 0.5, y: 0.5 }
          }
          holding={holding}
          items={items}
          mode={mode}
          onBegin={begin}
          onCancel={cancelHold}
          status={status}
          theme={theme}
        />
      )}
      {editor && (
        <ThemeEditor
          state={editor}
          fonts={fonts}
          onClose={() => {
            void fetchNui("cancelTheme");
            setEditor(null);
          }}
        />
      )}
    </main>
  );
}

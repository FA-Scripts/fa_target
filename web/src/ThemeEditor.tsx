import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fetchNui, isBrowser } from "./nui";
import type { FontDefinition, OptionRef, Theme } from "./types";
import {
  normalizeTheme,
  palettes,
  presetLabels,
  presetThemes,
  presets,
  ranges,
  themeVariables,
  modeLabels,
} from "./theme";
import { ColorField, NumberField, Choice, Toggle } from "./Controls";
import { TargetDisplay } from "./TargetDisplay";
import { playSound } from "./sound";

export type EditorState = {
  admin: boolean;
  allowed: Record<string, boolean>;
  presets: string[];
  snapshot: Theme;
  resetTheme: Theme;
  interactionMode?: string;
  allowModeSwitch?: boolean;
};
const screenshotFiles = Object.keys(
  import.meta.glob("/public/preview/game.{jpg,png,webp}"),
);
const screenshot = screenshotFiles[0]?.replace("/public/", "./");
const sectionNames = ["Colors", "Shape", "Layout", "Behavior", "Accessibility"];
const storage = {
  get(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string) {
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* storage may be unavailable */
    }
  },
};
function previewOptions(
  count: number,
  long: boolean,
  states: boolean,
): OptionRef[] {
  return Array.from({ length: count }, (_, index) => ({
    label: long
      ? "Inspect vehicle registration and ownership details"
      : [
          "Open vehicle",
          "Inspect engine",
          "View documents",
          "Repair vehicle",
          "Check storage",
          "Talk to mechanic",
        ][index],
    description: index === 1 ? "Hold to interact" : undefined,
    icon: [
      "fa-solid fa-lock-open",
      "fa-solid fa-wrench",
      "fa-solid fa-file-lines",
    ][index % 3],
    key: index === 0 ? "E" : undefined,
    hold: index === 1 ? 1200 : undefined,
    badge: index === 2 ? "NEW" : undefined,
    category: index === 1 ? "vehicle" : "general",
    targetType: "preview",
    targetId: index + 1,
    slot: index + 1,
    interactionState:
      states && index > 0
        ? {
            status: (
              [
                "missingItem",
                "noPermission",
                "cooldown",
                "disabled",
                "available",
              ] as const
            )[index - 1],
            reason: [
              "Required item missing",
              "Access restricted",
              "Available in 5 seconds",
              "Unavailable",
              "",
            ][index - 1],
            remainingMs: index === 3 ? 5000 : undefined,
          }
        : undefined,
  }));
}
export function ThemeEditor({
  state,
  fonts,
  onClose,
}: {
  state: EditorState;
  fonts: FontDefinition[];
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(() =>
    normalizeTheme(state.snapshot, undefined, fonts),
  );
  const [mode, setMode] = useState("focus");
  const [gameMode, setGameMode] = useState(state.interactionMode ?? "focus");
  const [background, setBackground] = useState("dark");
  const [count, setCount] = useState(3);
  const [long, setLong] = useState(false);
  const [states, setStates] = useState(false);
  const [section, setSection] = useState("Colors");
  const [confirmReset, setConfirmReset] = useState(false);
  const [onboarding, setOnboarding] = useState(
    !storage.get("fa_target:onboarding:v1"),
  );
  const [saveState, setSaveState] = useState("idle");
  const [notice, setNotice] = useState("");
  const [exchange, setExchange] = useState<"import" | "export" | null>(null);
  const [jsonText, setJsonText] = useState("");
  const [category, setCategory] = useState("general");
  const [holding, setHolding] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: string; message?: string }>({
    type: "",
  });
  const holdTimer = useRef<number | undefined>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>(".icon-btn")?.focus();
    return () => previous?.focus();
  }, []);
  const can = (key: keyof Theme) => state.admin || state.allowed[key] === true;
  const updateTheme = (input: Partial<Theme>) => {
    const next = { ...draft };
    (Object.keys(input) as (keyof Theme)[]).forEach((key) => {
      if (can(key)) Object.assign(next, { [key]: input[key] });
    });
    setDraft(normalizeTheme(next, draft, fonts));
    setSaveState("idle");
    setNotice("");
    void fetchNui("previewTheme", next);
  };
  const cancelHold = () => {
    clearTimeout(holdTimer.current);
    holdTimer.current = undefined;
    setHolding(null);
  };
  useEffect(() => {
    cancelHold();
    setFeedback({ type: "" });
  }, [count, long, states, mode, draft.preset]);
  useEffect(() => () => clearTimeout(holdTimer.current), []);
  const begin = (option: OptionRef) => {
    if (
      option.interactionState &&
      option.interactionState.status !== "available"
    )
      return;
    cancelHold();
    const complete = () => {
      setHolding(null);
      setFeedback({ type: "success", message: "Preview complete" });
      playSound("success", draft);
    };
    if (option.hold) {
      setHolding(option.slot);
      playSound("hold", draft);
      holdTimer.current = window.setTimeout(complete, option.hold);
    } else complete();
  };
  const number = (key: keyof typeof ranges, label: string, unit = "") => {
    const [min, max, step] = ranges[key];
    return (
      <NumberField
        key={key}
        label={label}
        value={draft[key]}
        min={min}
        max={max}
        step={step}
        unit={unit}
        disabled={!can(key)}
        onChange={(value) => updateTheme({ [key]: value })}
      />
    );
  };
  const toggle = (
    key:
      | "animations"
      | "indicator"
      | "highlight"
      | "fade"
      | "sound"
      | "highContrast",
    label: string,
  ) => (
    <Toggle
      key={key}
      label={label}
      checked={draft[key]}
      disabled={!can(key)}
      onChange={(value) => updateTheme({ [key]: value })}
    />
  );
  const select = (
    key: "position" | "font" | "indicatorStyle" | "cursorHint" | "colorVision",
    label: string,
    values: { value: string; label: string }[],
  ) => (
    <Choice
      key={key}
      label={label}
      value={draft[key]}
      options={values}
      disabled={!can(key)}
      onChange={(value) => updateTheme({ [key]: value })}
    />
  );
  const dismissOnboarding = () => {
    storage.set("fa_target:onboarding:v1");
    setOnboarding(false);
  };
  const applyImport = (text: string) => {
    try {
      if (new TextEncoder().encode(text).length > 65536)
        throw new Error("Theme files must be smaller than 64 KB.");
      const data = JSON.parse(text);
      if (!data || Array.isArray(data) || typeof data !== "object")
        throw new Error("Invalid theme file.");
      if (data.version !== undefined && data.version !== 1)
        throw new Error("Unsupported theme version.");
      const source = data.theme ?? data;
      if (
        !source ||
        typeof source !== "object" ||
        Array.isArray(source) ||
        !Object.keys(source).some((key) => key in draft)
      )
        throw new Error("No theme settings found.");
      updateTheme(normalizeTheme(source, draft, fonts));
      setNotice("Imported into preview. Save theme to keep it.");
      setExchange(null);
    } catch (error) {
      setNotice(
        error instanceof SyntaxError
          ? "Invalid JSON. Check the file and try again."
          : error instanceof Error
            ? error.message
            : "Could not import theme.",
      );
    }
  };
  const importTheme = async (file?: File) => {
    if (!file) return;
    if (file.size > 65536) {
      setNotice("Theme files must be smaller than 64 KB.");
    } else {
      try {
        applyImport(await file.text());
      } catch {
        setNotice("Could not read theme file.");
      }
    }
    if (fileInput.current) fileInput.current.value = "";
  };
  const downloadTheme = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ version: 1, theme: draft }, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "fa-target-theme.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return createPortal(
    <div className="editor-backdrop">
      <section
        ref={dialog}
        className="editor creator"
        role="dialog"
        aria-modal="true"
        aria-label="Theme creator"
        onKeyDown={(event) => {
          if (event.key === "Escape" && saveState === "saving") {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          if (event.key !== "Tab") return;
          const controls = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              "button:not(:disabled), input:not(:disabled):not([hidden]), select:not(:disabled), textarea:not(:disabled)",
            ),
          ).filter(
            (element) => element.offsetParent !== null && element.tabIndex >= 0,
          );
          const first = controls[0],
            last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <header>
          <div>
            <h2>{state.admin ? "Server theme" : "Your interface"}</h2>
            <p>Make interactions feel at home on your server.</p>
          </div>
          <button
            className="icon-btn"
            aria-label="Close theme editor"
            disabled={saveState === "saving"}
            onClick={onClose}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </header>
        {onboarding && (
          <div className="onboarding">
            <strong>Three ways to interact</strong>
            <p>
              <b>Focus</b> reveals nearby actions and uses keys. <b>Cursor</b>{" "}
              uses the targeting key and mouse. <b>World</b> anchors actions to
              the object. Hold the displayed key when an action requires it.
              {state.allowModeSwitch
                ? " Choose your gameplay mode in Behavior and save it with your theme."
                : " Your server owner chooses the gameplay mode. The buttons here only change the preview."}
            </p>
            <button onClick={dismissOnboarding}>Got it</button>
          </div>
        )}
        <div className="creator-body">
          <aside className="preview-column">
            <div className="preview-toolbar" aria-label="Preview mode">
              {Object.entries(modeLabels).map(([id, label]) => (
                <button
                  key={id}
                  aria-pressed={mode === id}
                  onClick={() => {
                    setMode(id);
                    playSound("open", draft);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="setting-note preview-context">
              Preview only · Gameplay:{" "}
              {modeLabels[state.interactionMode ?? "focus"]}.{" "}
              {state.allowModeSwitch
                ? "Change your mode in Behavior."
                : "Selected by the server owner."}
            </p>
            <div
              className={`preview-stage app mode-${mode} preset-${draft.preset} ${draft.animations ? "motion" : ""} ${draft.highContrast ? "high-contrast" : ""} background-${background}`}
              style={{
                ...themeVariables(draft, fonts),
                ...(background === "game" && screenshot
                  ? { backgroundImage: `url("${screenshot}")` }
                  : {}),
              }}
            >
              <TargetDisplay
                items={previewOptions(count, long, states)}
                mode={mode}
                theme={draft}
                showCursorHint={
                  mode === "classic" && draft.cursorHint !== "never"
                }
                anchor={{ visible: true, x: 0.08, y: 0.18 }}
                preview
                holding={holding}
                status={feedback}
                onBegin={begin}
                onCancel={cancelHold}
              />
            </div>
            <div className="preview-settings">
              <Choice
                label="Background"
                value={background}
                options={[
                  { value: "dark", label: "Dark" },
                  { value: "light", label: "Light" },
                  ...(screenshot
                    ? [{ value: "game", label: "Game screenshot" }]
                    : []),
                ]}
                onChange={setBackground}
              />
              {!screenshot && (
                <p className="setting-note">
                  Game background is awaiting the supplied screenshot.
                </p>
              )}
              <Choice
                label="Options"
                value={String(count)}
                options={[1, 3, 6].map((n) => ({
                  value: String(n),
                  label: String(n),
                }))}
                onChange={(v) => setCount(Number(v))}
              />
              <Toggle
                label="Long labels"
                checked={long}
                disabled={false}
                onChange={setLong}
              />
              <Toggle
                label="Interaction states"
                checked={states}
                disabled={false}
                onChange={setStates}
              />
            </div>
            <div className="preset-grid" aria-label="Theme presets">
              {presets
                .filter(
                  (p) =>
                    state.presets.includes(p) ||
                    (p === "minimal" && state.presets.includes("compact")),
                )
                .map((p) => (
                  <button
                    key={p}
                    aria-pressed={draft.preset === p}
                    className={draft.preset === p ? "active" : ""}
                    disabled={!can("preset")}
                    onClick={() =>
                      updateTheme({ ...presetThemes[p], preset: p })
                    }
                  >
                    {presetLabels[p]}
                  </button>
                ))}
            </div>
            <button className="text-button" onClick={() => setOnboarding(true)}>
              How interaction modes work
            </button>
          </aside>
          <div className="settings-column">
            <nav className="section-tabs" aria-label="Settings sections">
              {sectionNames.map((name) => (
                <button
                  key={name}
                  aria-pressed={section === name}
                  onClick={() => setSection(name)}
                >
                  {name}
                </button>
              ))}
            </nav>
            <section className="settings-content" aria-label={section}>
              <h3>{section}</h3>
              {section === "Colors" && (
                <>
                  <div className="palette-list">
                    {Object.keys(palettes).map((name) => (
                      <button
                        key={name}
                        disabled={
                          !["accent", "surface", "text", "mutedText"].some(
                            (key) => can(key as keyof Theme),
                          )
                        }
                        onClick={() => updateTheme(palettes[name])}
                      >
                        <i style={{ background: palettes[name].accent }} />
                        {name}
                      </button>
                    ))}
                  </div>
                  {(["accent", "surface", "text", "mutedText"] as const).map(
                    (key) => (
                      <ColorField
                        key={key}
                        label={
                          {
                            accent: "Accent",
                            surface: "Surface",
                            text: "Text",
                            mutedText: "Secondary text",
                          }[key]
                        }
                        value={draft[key]}
                        disabled={!can(key)}
                        onChange={(value) => updateTheme({ [key]: value })}
                      />
                    ),
                  )}
                  <h4>Interaction categories</h4>
                  <label className="category-name">
                    Category
                    <input
                      aria-label="Category name"
                      value={category}
                      maxLength={32}
                      disabled={!can("categoryColors")}
                      onChange={(e) =>
                        setCategory(
                          e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""),
                        )
                      }
                    />
                  </label>
                  <ColorField
                    label="Category color"
                    value={
                      Object.hasOwn(draft.categoryColors, category)
                        ? draft.categoryColors[category]
                        : draft.accent
                    }
                    disabled={!can("categoryColors") || !category}
                    onChange={(value) =>
                      updateTheme({
                        categoryColors: {
                          ...draft.categoryColors,
                          [category]: value,
                        },
                      })
                    }
                  />
                  <div className="category-list">
                    {Object.entries(draft.categoryColors).map(
                      ([name, color]) => (
                        <button
                          key={name}
                          disabled={!can("categoryColors")}
                          onClick={() => {
                            const next = { ...draft.categoryColors };
                            delete next[name];
                            updateTheme({ categoryColors: next });
                          }}
                        >
                          <i style={{ background: color }} />
                          {name}
                          <span aria-label="Remove">×</span>
                        </button>
                      ),
                    )}
                  </div>
                </>
              )}
              {section === "Shape" && (
                <>
                  {number("opacity", "Opacity")}
                  {number("radius", "Radius", "px")}
                  {number("blur", "Glass blur", "px")}
                  <p className="setting-note">
                    Blur applies to the Glass surface. Readability also comes
                    from its tinted background.
                  </p>
                  {toggle("indicator", "Show indicator")}
                  {select(
                    "indicatorStyle",
                    "Indicator style",
                    ["ring", "dot", "crosshair"].map((v) => ({
                      value: v,
                      label: v[0].toUpperCase() + v.slice(1),
                    })),
                  )}
                  {number("indicatorSize", "Indicator size", "px")}
                </>
              )}
              {section === "Layout" && (
                <>
                  {number("scale", "Scale", "×")}
                  {number("width", "Maximum card width", "px")}
                  {select(
                    "position",
                    "Position",
                    ["left", "center", "right"].map((v) => ({
                      value: v,
                      label: v[0].toUpperCase() + v.slice(1),
                    })),
                  )}
                  {select(
                    "font",
                    "Typeface",
                    fonts.map((f) => ({ value: f.id, label: f.label })),
                  )}
                </>
              )}
              {section === "Behavior" && (
                <>
                  {state.allowModeSwitch ? (
                    <>
                      <Choice
                        label="Your gameplay mode"
                        value={gameMode}
                        options={Object.entries(modeLabels).map(
                          ([value, label]) => ({ value, label }),
                        )}
                        disabled={saveState === "saving"}
                        onChange={setGameMode}
                      />
                      <p className="setting-note">
                        Saved for this player when you save the theme. This is
                        separate from the preview.
                      </p>
                    </>
                  ) : (
                    <p className="setting-note">
                      Gameplay mode is selected by the server owner:{" "}
                      {modeLabels[state.interactionMode ?? "focus"]}.
                    </p>
                  )}
                  {toggle("animations", "Animations")}
                  {toggle("highlight", "Highlight target")}
                  {select("cursorHint", "Cursor hint", [
                    { value: "always", label: "Always" },
                    { value: "first", label: "Until first use" },
                    { value: "never", label: "Never" },
                  ])}
                  {toggle("fade", "Fade with distance")}
                  {toggle("sound", "Interaction sounds")}
                  {number("soundVolume", "Volume")}
                  <button
                    className="text-button"
                    disabled={!draft.sound}
                    onClick={() => playSound("success", draft)}
                  >
                    Play sample
                  </button>
                </>
              )}
              {section === "Accessibility" && (
                <>
                  {toggle("highContrast", "High contrast")}
                  {number("textSize", "Text size", "px")}
                  {select("colorVision", "Color vision", [
                    { value: "normal", label: "Original colors" },
                    { value: "protanopia", label: "Protanopia" },
                    { value: "deuteranopia", label: "Deuteranopia" },
                    { value: "tritanopia", label: "Tritanopia" },
                  ])}
                  <p className="setting-note">
                    Unavailable actions always include a written reason. High
                    contrast overrides display colors without changing your
                    saved palette.
                  </p>
                </>
              )}
            </section>
          </div>
        </div>
        <footer>
          <div className="theme-files">
            <button
              onClick={() => {
                setExchange("export");
                setJsonText(
                  JSON.stringify({ version: 1, theme: draft }, null, 2),
                );
              }}
            >
              Export JSON
            </button>
            <button
              onClick={() => {
                setExchange("import");
                setJsonText("");
              }}
            >
              Import JSON
            </button>
            <input
              ref={fileInput}
              aria-label="Import theme file"
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => void importTheme(e.target.files?.[0])}
            />
          </div>
          <button
            className="reset-button"
            disabled={saveState === "saving"}
            onClick={() => setConfirmReset(!confirmReset)}
          >
            Reset
          </button>
          <button disabled={saveState === "saving"} onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary"
            disabled={saveState === "saving"}
            onClick={async () => {
              setSaveState("saving");
              try {
                const response = await fetchNui<{ ok?: boolean }>("saveTheme", {
                  ...draft,
                  interactionMode: gameMode,
                });
                if (response?.ok === false) throw new Error();
                if (isBrowser) onClose();
              } catch {
                setSaveState("error");
                setNotice("Could not save. Try again.");
              }
            }}
          >
            {saveState === "saving" ? "Saving…" : "Save theme"}
          </button>
        </footer>
        {exchange && (
          <div className="json-exchange" aria-label={`${exchange} theme JSON`}>
            <label>
              {exchange === "export" ? "Theme JSON" : "Paste theme JSON"}
              <textarea
                aria-label="Theme JSON"
                value={jsonText}
                readOnly={exchange === "export"}
                onChange={(e) => setJsonText(e.target.value)}
                maxLength={65536}
              />
            </label>
            <div>
              {exchange === "export" ? (
                <>
                  <button onClick={downloadTheme}>Download file</button>
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(jsonText);
                        setNotice("Theme JSON copied.");
                      } catch {
                        setNotice("Select the JSON and press Ctrl+C to copy.");
                      }
                    }}
                  >
                    Copy JSON
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => fileInput.current?.click()}>
                    Choose file
                  </button>
                  <button onClick={() => applyImport(jsonText)}>
                    Preview import
                  </button>
                </>
              )}
              <button onClick={() => setExchange(null)}>Close JSON</button>
            </div>
          </div>
        )}
        {confirmReset && (
          <div className="reset-confirm" role="alert">
            <span>Restore the default settings you are allowed to edit?</span>
            <button
              onClick={() => {
                updateTheme(state.resetTheme);
                setConfirmReset(false);
              }}
            >
              Restore defaults
            </button>
            <button onClick={() => setConfirmReset(false)}>Keep changes</button>
          </div>
        )}
        {notice && (
          <p className="editor-notice" role="status">
            {notice}
          </p>
        )}
      </section>
    </div>,
    document.body,
  );
}

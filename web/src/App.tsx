import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchNui, isBrowser } from "./nui";
import type {
  FontDefinition,
  NuiMessage,
  OptionRef,
  TargetOption,
} from "./types";
import {
  fallbackTheme,
  fallbackFonts,
  themeVariables,
  normalizeTheme,
  presets,
} from "./theme";
import { TargetDisplay } from "./TargetDisplay";
import { ThemeEditor, type EditorState } from "./ThemeEditor";
import { playSound } from "./sound";
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
  const holdingRef = useRef<number | null>(null);
  holdingRef.current = holding;
  const [distanceFade, setDistanceFade] = useState(1);
  const [cursorUsed, setCursorUsed] = useState(() => {
    try {
      return localStorage.getItem("fa_target:cursorUsed") === "1";
    } catch {
      return false;
    }
  });
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const targetSignature = useRef("");
  const [editor, setEditor] = useState<EditorState | null>(
    isBrowser && params.has("theme")
      ? {
          admin: true,
          allowed: {},
          presets,
          snapshot: fallbackTheme,
          resetTheme: fallbackTheme,
          interactionMode: "focus",
          allowModeSwitch: params.has("modeSwitch"),
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
      if (
        option.interactionState &&
        option.interactionState.status !== "available"
      )
        return;
      if (!option.hold) return select(option);
      cancelHold();
      playSound("hold", themeRef.current);
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
    targetSignature.current = "";
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
        const signature = nextItems
          .map(
            (item) =>
              `${item.targetType}:${item.targetId}:${item.zoneId ?? 0}:${item.label}`,
          )
          .join("|");
        if (signature !== targetSignature.current) {
          if (!targetSignature.current && signature)
            playSound("open", themeRef.current);
          setStatus({ type: "" });
        }
        const held = nextItems.find((item) => item.slot === holdingRef.current);
        if (
          signature !== targetSignature.current ||
          !held ||
          (held.interactionState &&
            held.interactionState.status !== "available")
        )
          cancelHold();
        targetSignature.current = signature;
        setItems(nextItems);
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
        if (data.theme)
          setTheme(
            normalizeTheme(data.theme, fallbackTheme, data.fonts ?? fonts),
          );
        if (data.fonts?.length) setFonts(data.fonts);
      } else if (data.event === "targetDistance") {
        const near = data.expandDistance ?? 2.5;
        const far = Math.max(near + 0.1, data.revealDistance ?? 8);
        setDistanceFade(
          1 -
            Math.min(
              1,
              Math.max(0, ((data.distance ?? near) - near) / (far - near)),
            ) *
              0.65,
        );
      } else if (data.event === "interactionMode" && data.mode) {
        clearTarget();
        setMode(data.mode);
      } else if (data.event === "cursor" && data.cursor) {
        setCursorUsed(true);
        try {
          localStorage.setItem("fa_target:cursorUsed", "1");
        } catch {
          /* unavailable storage */
        }
      } else if (data.event === "targetAnchor" && data.anchor)
        setAnchor((current) => ({
          visible: data.anchor?.visible !== false && items.length > 0,
          x: data.anchor?.x ?? current.x,
          y: data.anchor?.y ?? current.y,
        }));
      else if (data.event === "theme" && data.theme) {
        setTheme(
          normalizeTheme(data.theme, fallbackTheme, data.fonts ?? fonts),
        );
        if (data.fonts?.length) setFonts(data.fonts);
      } else if (data.event === "holdVisual") {
        setHolding(data.pressed && data.slot ? data.slot : null);
        if (data.pressed) playSound("hold", themeRef.current);
      } else if (data.event === "actionResult") {
        setStatus({ type: data.status ?? "", message: data.message });
        if (data.status === "success" || data.status === "error")
          playSound(data.status, themeRef.current);
      } else if (data.event === "themeEditor") {
        if (data.state && data.theme) {
          if (data.fonts?.length) setFonts(data.fonts);
          setTheme(
            normalizeTheme(data.theme, fallbackTheme, data.fonts ?? fonts),
          );
          setEditor({
            admin: Boolean(data.admin),
            allowed: data.allowed ?? {},
            presets: data.presets ?? [],
            snapshot: normalizeTheme(
              data.theme,
              fallbackTheme,
              data.fonts ?? fonts,
            ),
            resetTheme: normalizeTheme(
              data.resetTheme ?? data.theme,
              fallbackTheme,
              data.fonts ?? fonts,
            ),
            interactionMode: data.interactionMode ?? "focus",
            allowModeSwitch: data.allowModeSwitch === true,
          });
        } else setEditor(null);
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [clearTarget, cancelHold, items.length, fonts]);
  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    },
    [],
  );

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (editor) {
        if (event.key === "Escape") {
          void fetchNui("cancelTheme");
          setEditor(null);
        }
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
      className={`app mode-${mode} pos-${theme.position} preset-${theme.preset} ${theme.animations ? "motion" : ""} ${theme.highContrast ? "high-contrast" : ""}`}
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
          opacity={theme.fade ? distanceFade : 1}
          showCursorHint={
            mode === "classic" &&
            (theme.cursorHint === "always" ||
              (theme.cursorHint === "first" && !cursorUsed))
          }
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

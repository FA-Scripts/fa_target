import { useEffect, useLayoutEffect, useState, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { hexToHsv, hsvToHex } from "./color";

export function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));
  const inputId = useId();
  useEffect(() => setText(String(Number(value.toFixed(2)))), [value]);
  const commit = () => {
    const parsed = Number(text);
    if (text.trim() && Number.isFinite(parsed))
      onChange(
        Number(
          (
            Math.round(Math.min(max, Math.max(min, parsed)) / step) * step
          ).toFixed(2),
        ),
      );
    else setText(String(value));
  };
  return (
    <div className={`setting number-setting ${disabled ? "disabled" : ""}`}>
      <label htmlFor={inputId}>{label}</label>
      <div className="number-entry">
        <input
          id={inputId}
          aria-label={`${label} value`}
          type="number"
          min={min}
          max={max}
          step={step}
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commit();
              e.currentTarget.blur();
            }
          }}
        />
        <span>{unit}</span>
      </div>
      <div className="slider-line">
        <span>
          {min}
          {unit}
        </span>
        <input
          aria-label={label}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span>
          {max}
          {unit}
        </span>
      </div>
    </div>
  );
}
export function Toggle({
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
    <label className={`setting toggle-setting ${disabled ? "disabled" : ""}`}>
      <span>{label}</span>
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
export function Choice({
  label,
  value,
  options,
  disabled = false,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const floating = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState({
    left: 0,
    top: 0,
    width: 0,
    maxHeight: 190,
  });
  const menuId = useId();
  const current = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (
        !root.current?.contains(event.target as Node) &&
        !floating.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useLayoutEffect(() => {
    if (!open || !trigger.current) return;
    const position = () => {
      const rect = trigger.current!.getBoundingClientRect();
      const width = Math.min(rect.width, window.innerWidth - 16);
      if (floating.current) floating.current.style.width = `${width}px`;
      const height = Math.min(190, (floating.current?.scrollHeight ?? 188) + 2);
      const below = window.innerHeight - rect.bottom - 12,
        above = rect.top - 12;
      const upward = below < height && above > below;
      const maxHeight = Math.max(40, Math.min(190, upward ? above : below));
      setPlacement({
        width,
        maxHeight,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        top: upward
          ? rect.top - Math.min(height, maxHeight) - 6
          : rect.bottom + 6,
      });
    };
    position();
    const scroll = (event: Event) => {
      if (!floating.current?.contains(event.target as Node)) position();
    };
    window.addEventListener("resize", position);
    window.addEventListener("scroll", scroll, true);
    return () => {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", scroll, true);
    };
  }, [open, options.length]);
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  const choose = (index: number) => {
    if (options[index]) onChange(options[index].value);
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  };
  return (
    <div
      ref={root}
      className={`setting choice-setting ${disabled ? "disabled" : ""}`}
      onBlur={(event) => {
        if (
          !event.currentTarget.contains(event.relatedTarget) &&
          !floating.current?.contains(event.relatedTarget)
        )
          setOpen(false);
      }}
    >
      <span>{label}</span>
      <div className="custom-choice">
        <button
          ref={trigger}
          type="button"
          role="combobox"
          aria-label={label}
          aria-haspopup="listbox"
          aria-controls={menuId}
          aria-expanded={open}
          aria-activedescendant={open ? `${menuId}-${active}` : undefined}
          disabled={disabled || !options.length}
          className="choice-trigger"
          onMouseDown={(event) => {
            event.preventDefault();
            trigger.current?.focus({ preventScroll: true });
          }}
          onClick={() => {
            setActive(current);
            setOpen(!open);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && open) {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
              return;
            }
            if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
              event.preventDefault();
              setOpen(true);
              setActive(
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? options.length - 1
                    : Math.max(
                        0,
                        Math.min(
                          options.length - 1,
                          (open ? active : current) +
                            (event.key === "ArrowDown" ? 1 : -1),
                        ),
                      ),
              );
            } else if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              if (open) choose(active);
              else {
                setActive(current);
                setOpen(true);
              }
            } else if (
              event.key.length === 1 &&
              !event.ctrlKey &&
              !event.metaKey
            ) {
              const index = options.findIndex((option) =>
                option.label.toLowerCase().startsWith(event.key.toLowerCase()),
              );
              if (index >= 0) {
                event.preventDefault();
                setOpen(true);
                setActive(index);
              }
            }
          }}
        >
          <span>{options[current]?.label ?? value}</span>
          <i className="fa-solid fa-chevron-down" aria-hidden="true" />
        </button>
        {open &&
          createPortal(
            <div
              ref={floating}
              style={placement}
              id={menuId}
              role="listbox"
              aria-label={label}
              className="choice-menu"
            >
              {options.map((option, index) => (
                <button
                  type="button"
                  tabIndex={-1}
                  role="option"
                  key={option.value}
                  id={`${menuId}-${index}`}
                  aria-selected={option.value === value}
                  className={active === index ? "highlighted" : ""}
                  onPointerMove={() => setActive(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(index)}
                >
                  <span>{option.label}</span>
                  {option.value === value && (
                    <i className="fa-solid fa-check" aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>,
            document.body,
          )}
      </div>
    </div>
  );
}
export function ColorField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const lastEmitted = useRef(value);
  useEffect(() => {
    if (value === lastEmitted.current) return;
    const next = hexToHsv(value);
    setHsv((previous) => ({ ...next, h: next.s === 0 ? previous.h : next.h }));
    lastEmitted.current = value;
  }, [value]);
  const updateHsv = (next: typeof hsv) => {
    const hex = hsvToHex(next.h, next.s, next.v);
    setHsv(next);
    lastEmitted.current = hex;
    onChange(hex);
  };
  const samples = [
    "#9b85ff",
    "#77d9ef",
    "#f5bd64",
    "#ffffff",
    "#b8bac7",
    "#111217",
  ];
  return (
    <div className={`setting color-setting ${disabled ? "disabled" : ""}`}>
      <span>{label}</span>
      <button
        className="color-swatch"
        type="button"
        disabled={disabled}
        aria-label={`Edit ${label}`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <i style={{ backgroundColor: value }} />
        <span>{value.toUpperCase()}</span>
      </button>
      {open && !disabled && (
        <div className="inline-color">
          <div
            className="color-plane"
            role="group"
            aria-label={`${label} saturation and brightness`}
            style={{ backgroundColor: `hsl(${hsv.h}, 100%, 50%)` }}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              const rect = event.currentTarget.getBoundingClientRect();
              updateHsv({
                ...hsv,
                s: Math.min(
                  1,
                  Math.max(0, (event.clientX - rect.left) / rect.width),
                ),
                v:
                  1 -
                  Math.min(
                    1,
                    Math.max(0, (event.clientY - rect.top) / rect.height),
                  ),
              });
            }}
            onPointerMove={(event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId))
                return;
              const rect = event.currentTarget.getBoundingClientRect();
              updateHsv({
                ...hsv,
                s: Math.min(
                  1,
                  Math.max(0, (event.clientX - rect.left) / rect.width),
                ),
                v:
                  1 -
                  Math.min(
                    1,
                    Math.max(0, (event.clientY - rect.top) / rect.height),
                  ),
              });
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId);
            }}
          >
            <button
              type="button"
              className="color-plane-thumb"
              aria-label={`${label} saturation and brightness control`}
              style={{
                left: `${hsv.s * 100}%`,
                top: `${(1 - hsv.v) * 100}%`,
                backgroundColor: value,
              }}
              onKeyDown={(event) => {
                if (
                  !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                    event.key,
                  )
                )
                  return;
                event.preventDefault();
                const step = event.shiftKey ? 0.1 : 0.01;
                updateHsv({
                  ...hsv,
                  s: Math.min(
                    1,
                    Math.max(
                      0,
                      hsv.s +
                        (event.key === "ArrowRight"
                          ? step
                          : event.key === "ArrowLeft"
                            ? -step
                            : 0),
                    ),
                  ),
                  v: Math.min(
                    1,
                    Math.max(
                      0,
                      hsv.v +
                        (event.key === "ArrowUp"
                          ? step
                          : event.key === "ArrowDown"
                            ? -step
                            : 0),
                    ),
                  ),
                });
              }}
            />
          </div>
          <div className="hue-control">
            <input
              aria-label={`${label} hue`}
              className="hue-input"
              type="range"
              min={0}
              max={360}
              step={1}
              value={hsv.h}
              onChange={(event) =>
                updateHsv({ ...hsv, h: Number(event.target.value) })
              }
            />
          </div>
          <label>
            HEX
            <input
              aria-label={`${label} HEX`}
              value={text}
              maxLength={7}
              onChange={(e) => {
                setText(e.target.value);
                if (/^#[0-9a-f]{6}$/i.test(e.target.value))
                  onChange(e.target.value);
              }}
              onBlur={() => setText(value)}
            />
          </label>
          <div className="color-samples">
            {samples.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`${label} ${color}`}
                style={{ backgroundColor: color }}
                onClick={() => onChange(color)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

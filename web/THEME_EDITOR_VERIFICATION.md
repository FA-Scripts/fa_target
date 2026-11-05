# Theme editor verification — 2026-11-05

Passed locally:

- `npm run test:editor`: contrast ratios, HEX validation, palette matching,
  canonical dirty-state comparison, section defaults and restricted permissions.
- `npm run build`: TypeScript compilation and production bundle.
- Browser checks at 1366×768, 1920×1080 and 480×800: layout, all three preview
  modes and four style presets, 1/3/6 actions, long labels and unavailable states.
- Browser interaction checks: invalid HEX feedback, palette selection, reset
  restoring a clean draft, picker Escape retaining the editor, JSON import,
  copying HEX, Behavior reset restoring the initial gameplay mode, Ctrl+S closing
  after successful save.

The existing `npm test` command references the absent `scripts/validate.mjs`.
It was not run or reported as passing. Use the explicit `test:editor` suite for
the checks added in this change.

Still requiring acceptance:

- Save failure/retry and in-flight close protection against a real NUI callback;
  the browser demo always returns success.
- Live FiveM/CEF preview, persistence, cancellation, clipboard, keyboard focus
  and readability against gameplay backgrounds.
- Optional screenshot background (no screenshot is supplied in this checkout).

Contrast badges measure the saved text color against the opaque Surface color.
They do not certify translucent Glass surfaces against arbitrary game imagery.

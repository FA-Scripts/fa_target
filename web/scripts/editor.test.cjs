const { readFileSync } = require("node:fs");
const { resolve, dirname } = require("node:path");
const { strict: assert } = require("node:assert");
const ts = require("typescript");
const cache = new Map();
function load(path) {
  path = resolve(__dirname, path);
  if (cache.has(path)) return cache.get(path);
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function("require", "module", "exports", code)(
    (name) => load(resolve(dirname(path), name + ".ts")),
    module,
    module.exports,
  );
  cache.set(path, module.exports);
  return module.exports;
}
const { contrastRatio, isHexColor } = load("../src/color.ts");
const { fallbackTheme, normalizeTheme, palettes } = load("../src/theme.ts");
const { themeKey, activePalette, sectionDefaults, sectionFields } = load(
  "../src/editorState.ts",
);
assert.equal(contrastRatio("#000000", "#ffffff"), 21);
assert.equal(contrastRatio("#ffffff", "#ffffff"), 1);
assert.equal(
  contrastRatio("#123456", "#abcdef"),
  contrastRatio("#abcdef", "#123456"),
);
for (const hex of ["#ABCdef", "#000000", "#ffffff"]) assert.ok(isHexColor(hex));
for (const hex of ["#abc", "ABCDEF", "#gggggg", "#1234567", ""])
  assert.ok(!isHexColor(hex));
assert.equal(
  activePalette({ ...fallbackTheme, ...palettes.Violet, accent: "#9B85FF" }),
  "Violet",
);
assert.equal(
  activePalette({ ...fallbackTheme, ...palettes.Violet, text: "#000000" }),
  undefined,
);
const base = normalizeTheme(fallbackTheme);
assert.equal(themeKey(base), themeKey(normalizeTheme(base)));
assert.equal(
  themeKey(base),
  themeKey({ ...base, accent: base.accent.toUpperCase() }),
);
assert.notEqual(themeKey(base), themeKey({ ...base, radius: base.radius + 1 }));
assert.equal(
  themeKey({ ...base, categoryColors: { b: "#ffffff", a: "#000000" } }),
  themeKey({ ...base, categoryColors: { a: "#000000", b: "#ffffff" } }),
);
for (const section of Object.keys(sectionFields)) {
  const reset = sectionDefaults(section, base, () => true);
  assert.deepEqual(Object.keys(reset), sectionFields[section]);
  assert.deepEqual(
    sectionDefaults(section, base, () => false),
    {},
  );
}
assert.deepEqual(
  sectionDefaults("Colors", base, (key) => key === "accent"),
  { accent: base.accent },
);
console.log(
  "Editor logic checks passed: contrast, HEX, palettes, dirty state, section resets and permissions.",
);

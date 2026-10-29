import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readTheme, saveTheme, THEME_KEY } from "../src/shared/theme/theme.js";

test("appearance defaults to the existing dark theme and rejects unknown values", () => {
  for (const value of [null, "system", "invalid", "<script>"]) {
    assert.equal(readTheme({ getItem: () => value }), "dark");
  }
});

test("appearance persists only the chosen theme independently of the session", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  };
  for (const theme of ["light", "dark"]) {
    saveTheme(theme, storage);
    assert.equal(values.get(THEME_KEY), theme);
    assert.equal(readTheme(storage), theme);
  }
  assert.deepEqual([...values.keys()], [THEME_KEY]);
});

test("blocked storage cannot prevent using the application", () => {
  const blocked = {
    getItem() {
      throw new Error("Disabled");
    },
    setItem() {
      throw new Error("Disabled");
    },
  };
  assert.equal(readTheme(blocked), "dark");
  assert.doesNotThrow(() => saveTheme("light", blocked));
});

test("light theme text tokens keep readable contrast on its shared surfaces", async () => {
  const css = await readFile(
    new URL("../src/shared/theme/theme.css", import.meta.url),
    "utf8",
  );
  const tokens = Object.fromEntries(
    [...css.matchAll(/--fg-([\w-]+):\s*(#[\da-f]{6});/g)].map((match) => [
      match[1],
      match[2],
    ]),
  );
  function luminance(color) {
    const [r, g, b] = color
      .slice(1)
      .match(/../g)
      .map((channel) => {
        const value = parseInt(channel, 16) / 255;
        return value <= 0.04045
          ? value / 12.92
          : ((value + 0.055) / 1.055) ** 2.4;
      });
    return r * 0.2126 + g * 0.7152 + b * 0.0722;
  }
  for (const [name, color] of Object.entries(tokens).filter(
    ([name]) => name.endsWith("ink") || name === "accent",
  )) {
    for (const background of [
      "surface",
      "page",
      "surface-soft",
      "surface-raised",
    ]) {
      const first = luminance(color),
        second = luminance(tokens[background]);
      const ratio =
        (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
      assert.ok(ratio >= 4.5, `${name} on ${background}: ${ratio.toFixed(2)}`);
    }
  }
});

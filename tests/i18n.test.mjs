import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const folder = mkdtempSync(join(tmpdir(), "sigma-i18n-tests-"));
writeFileSync(join(folder, "package.json"), '{"type":"commonjs"}');
const source = readFileSync(new URL("../lib/i18n.ts", import.meta.url), "utf8");
writeFileSync(join(folder, "i18n.js"), ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText);
const require = createRequire(import.meta.url);
const { resolveLocale } = require(join(folder, "i18n.js"));
after(() => rmSync(folder, { recursive: true, force: true }));

test("Korean traffic defaults to Korean and other traffic defaults to English", () => {
  assert.equal(resolveLocale(undefined, "KR", "en-US,en;q=0.9"), "ko");
  assert.equal(resolveLocale(undefined, "US", "ko-KR,ko;q=0.9"), "ko");
  assert.equal(resolveLocale(undefined, "US", "en-US,en;q=0.9"), "en");
});

test("a saved language choice overrides country and browser language", () => {
  assert.equal(resolveLocale("en", "KR", "ko-KR"), "en");
  assert.equal(resolveLocale("ko", "US", "en-US"), "ko");
});

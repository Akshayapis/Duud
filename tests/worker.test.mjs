import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

test("worker notebook has the UAPP_JOB_PAYLOAD marker cell and compiles as Python", () => {
  const nb = JSON.parse(fs.readFileSync(path.join(root, "kaggle/worker/worker.ipynb"), "utf8"));
  const marker = nb.cells.find((c) => String(Array.isArray(c.source) ? c.source.join("") : c.source).includes("UAPP_JOB_PAYLOAD"));
  assert.ok(marker, "missing UAPP_JOB_PAYLOAD cell");
  const workerCell = nb.cells.map((c) => String(Array.isArray(c.source) ? c.source.join("") : c.source)).find((s) => s.includes("def main():"));
  assert.ok(workerCell, "missing worker code cell");
  try {
    execFileSync("python3", ["-c", "import sys; compile(sys.stdin.read(), 'worker', 'exec')"], { input: workerCell });
  } catch (e) {
    // Python may be unavailable in some CI images; the notebook shape is still asserted.
    if (e.code !== "ENOENT") throw e;
  }
});

test("worker templates exist and contain required placeholders", () => {
  const dir = path.join(root, "kaggle/worker/templates");
  for (const name of ["MainActivity.java", "AdsController.java", "AdsInitProvider.java", "offline.xml"]) {
    assert.ok(fs.existsSync(path.join(dir, name)), `missing ${name}`);
  }
  const main = fs.readFileSync(path.join(dir, "MainActivity.java"), "utf8");
  assert.match(main, /__PACKAGE__/);
  assert.match(main, /__SOURCE_URL__/);
  assert.match(main, /__SPLASH_COLOR__/);
  const ads = fs.readFileSync(path.join(dir, "AdsController.java"), "utf8");
  assert.match(ads, /UserMessagingPlatform/);
  assert.match(ads, /MobileAds\.initialize/);
  assert.match(ads, /JavascriptInterface/);
});

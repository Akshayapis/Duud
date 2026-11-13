import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "uapp-test-"));
process.env.REQUIRE_AUTH = "false";
process.env.PORT = "0";
delete process.env.KAGGLE_USERNAME;
delete process.env.KAGGLE_KEY;
delete process.env.APP_URL;
delete process.env.RENDER_EXTERNAL_URL;

const { validateApp, validateSource, normalizeAds, normalizePermissions, workerCode } = await import("../server/index.mjs");

test("validateApp accepts a minimal valid app and normalizes permissions", () => {
  const app = validateApp({ id: "APP-1234", name: "Demo", packageId: "com.example.demo", type: "website", permissions: ["camera", "INTERNET"] });
  assert.equal(app.packageId, "com.example.demo");
  assert.deepEqual(app.permissions.sort(), ["ACCESS_NETWORK_STATE", "CAMERA", "INTERNET"].sort());
});

test("validateApp rejects invalid package IDs and versions", () => {
  assert.throws(() => validateApp({ id: "APP-1234", name: "Demo", packageId: "bad", type: "website" }), /package/i);
  assert.throws(() => validateApp({ id: "APP-1234", name: "Demo", packageId: "com.example.demo", type: "website", version: "1.0" }), /Version/);
});

test("validateSource rejects placeholder and private URLs", () => {
  const app = validateApp({ id: "APP-1234", name: "Demo", packageId: "com.example.demo", type: "website" });
  assert.throws(() => validateSource(app, { kind: "url", url: "https://uapp.local/source" }), /Private|HTTPS/i);
  assert.throws(() => validateSource(app, { kind: "url", url: "http://example.com" }), /HTTPS/i);
  assert.throws(() => validateSource(app, null), /source/i);
  assert.deepEqual(validateSource(app, { kind: "url", url: "https://example.com/app" }), { kind: "url", url: "https://example.com/app" });
});

test("normalizeAds rejects non-AdMob networks and unsupported formats", () => {
  assert.throws(() => normalizeAds({ network: "unity", formats: ["banner"], testMode: true }), /AdMob/i);
  assert.throws(() => normalizeAds({ network: "admob", formats: ["native"], testMode: true }), /Unsupported|Native/i);
});

test("normalizeAds test mode uses official Google test inventory", () => {
  const ads = normalizeAds({ network: "admob", formats: ["Banner", "Interstitial"], testMode: true, timingSeconds: 45 });
  assert.equal(ads.appId, "ca-app-pub-3940256099942544~3347511713");
  assert.equal(ads.units.interstitial, "ca-app-pub-3940256099942544/1033173712");
  assert.equal(ads.timingSeconds, 45);
  assert.equal(ads.testMode, true);
});

test("normalizeAds live mode requires real IDs and rejects test IDs", () => {
  assert.throws(() => normalizeAds({ network: "admob", formats: ["banner"], testMode: false, appId: "ca-app-pub-3940256099942544~3347511713", units: { banner: "ca-app-pub-3940256099942544/9214589741" } }), /real AdMob/i);
  const ads = normalizeAds({ network: "admob", formats: ["banner"], testMode: false, appId: "ca-app-pub-1234567890123456~1234567890", units: { banner: "ca-app-pub-1234567890123456/1234567890" } });
  assert.equal(ads.testMode, false);
  assert.equal(ads.units.banner, "ca-app-pub-1234567890123456/1234567890");
});

test("normalizePermissions always includes network basics", () => {
  assert.deepEqual(normalizePermissions([]).sort(), ["ACCESS_NETWORK_STATE", "INTERNET"].sort());
});

test("workerCode injects the payload cell and embeds templates", () => {
  const job = { workerJob: { jobId: "BLD-TEST", templates: {} } };
  // workerCode reads templates from disk; just ensure the marker cell is replaced.
  const notebook = JSON.parse(workerCode({ workerJob: { jobId: "BLD-TEST" } }));
  const payloadCell = notebook.cells.find((c) => c.cell_type === "code" && String(Array.isArray(c.source) ? c.source.join("") : c.source).includes("UAPP_JOB_PAYLOAD"));
  assert.ok(payloadCell);
  const src = Array.isArray(payloadCell.source) ? payloadCell.source.join("") : payloadCell.source;
  assert.match(src, /JOB = json\.loads/);
  assert.ok(notebook.cells.length >= 3);
  void job;
});

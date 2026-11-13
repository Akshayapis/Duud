import test from "node:test";
import assert from "node:assert/strict";
import { KaggleClient, normalizeKernelStatus } from "../server/kaggle.mjs";

test("normalizeKernelStatus maps numeric and string enum values", () => {
  assert.equal(normalizeKernelStatus({ status: 0 }), "queued");
  assert.equal(normalizeKernelStatus({ status: 1 }), "running");
  assert.equal(normalizeKernelStatus({ status: 2 }), "complete");
  assert.equal(normalizeKernelStatus({ status: 3 }), "error");
  assert.equal(normalizeKernelStatus({ status: 5 }), "cancelled");
  assert.equal(normalizeKernelStatus({ status: "KERNEL_WORKER_STATUS_RUNNING" }), "running");
  assert.equal(normalizeKernelStatus({ status: "complete" }), "complete");
});

test("kernelOutput sends a v-prefixed versionLabel", async () => {
  const originalFetch = globalThis.fetch;
  let captured = null;
  globalThis.fetch = async (url, options) => {
    captured = { url: String(url), body: JSON.parse(options.body) };
    return new Response(JSON.stringify({ files: [{ fileName: "app-debug.apk", url: "https://signed.example/apk", totalBytes: 123 }], log: "ok" }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const client = new KaggleClient("user", "key");
    const out = await client.kernelOutput("user", "slug", 7);
    assert.equal(captured.body.versionLabel, "v7");
    assert.equal(captured.body.userName, "user");
    assert.equal(captured.body.kernelSlug, "slug");
    assert.equal(out.files[0].name, "app-debug.apk");
    assert.equal(out.files[0].size, 123);
    const out2 = await client.kernelOutput("user", "slug", "v9");
    assert.equal(out2.files.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("pushKernel slugifies title to match slug and enables internet", async () => {
  const originalFetch = globalThis.fetch;
  let captured = null;
  globalThis.fetch = async (url, options) => {
    captured = { url: String(url), body: JSON.parse(options.body) };
    return new Response(JSON.stringify({ ref: "user/my-kernel", versionNumber: 1 }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const client = new KaggleClient("user", "key");
    const kernel = await client.pushKernel("My Kernel!!", { notebook: { cells: [], metadata: {}, nbformat: 4, nbformat_minor: 5 } });
    assert.equal(captured.body.slug, "user/my-kernel");
    assert.equal(captured.body.newTitle, "my-kernel");
    assert.equal(captured.body.enableInternet, true);
    assert.equal(captured.body.isPrivate, true);
    assert.equal(kernel.ref, "user/my-kernel");
    assert.equal(kernel.version, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

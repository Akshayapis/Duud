// Live build-engine smoke test. Runs where Kaggle is reachable (e.g. GitHub Actions).
// Pushes a tiny private notebook, polls status, lists output, then deletes the kernel.
import { KaggleClient, normalizeKernelStatus } from "../server/kaggle.mjs";

const client = KaggleClient.fromEnv();
if (!client) {
  console.error("KAGGLE_USERNAME / KAGGLE_KEY are not configured.");
  process.exit(1);
}

const slug = `uapp-smoke-${Date.now().toString(36)}`;
const notebook = {
  cells: [
    { cell_type: "code", execution_count: null, metadata: {}, outputs: [], source: "print('uapp smoke ok')\nwith open('smoke.txt', 'w') as f:\n    f.write('ok')\n" },
  ],
  metadata: { kernelspec: { display_name: "Python 3", language: "python", name: "python3" }, language_info: { name: "python" } },
  nbformat: 4,
  nbformat_minor: 5,
};

const verified = await client.verifyCredentials();
console.log("credentials verified:", verified.ok);
const kernel = await client.pushKernel(slug, { notebook, timeoutSeconds: 300 });
console.log("pushed:", kernel.ref, "version", kernel.version);
const [owner, kernelSlug] = kernel.ref.split("/");
const deadline = Date.now() + 10 * 60_000;
let status = "queued";
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 10_000));
  const raw = await client.kernelStatus(owner, kernelSlug);
  status = normalizeKernelStatus(raw);
  console.log("status:", status);
  if (["complete", "error", "cancelled"].includes(status)) break;
}
if (status !== "complete") throw new Error(`Smoke notebook did not complete: ${status}`);
const output = await client.kernelOutput(owner, kernelSlug, kernel.version);
console.log("output files:", output.files.map((f) => f.name).join(", ") || "(none)");
await client.deleteKernel(owner, kernelSlug).catch((e) => console.warn("cleanup:", e.message));
console.log("smoke test passed");

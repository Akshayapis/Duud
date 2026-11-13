/**
 * Kaggle kernel-session client.
 *
 * IMPORTANT: kernel session RPCs (SaveKernel / GetKernelSessionStatus /
 * ListKernelSessionOutput) are served from https://www.kaggle.com/api/v1,
 * NOT https://api.kaggle.com/v1 (that host rejects session operations).
 * Request bodies use camelCase, matching the official kagglesdk protocol.
 * Credentials live on the server only and are never returned to browsers.
 */
const BASE = process.env.KAGGLE_API_BASE || "https://www.kaggle.com/api/v1/kernels.KernelsApiService";
const UA = "uapp-build-service/3.0";

export class KaggleError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "KaggleError";
    this.status = status;
    this.body = body;
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 60_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export class KaggleClient {
  constructor(username, key) {
    if (!username || !key) throw new Error("Kaggle username and key are required");
    this.username = username;
    this.key = key;
    this.auth = `Basic ${Buffer.from(`${username}:${key}`).toString("base64")}`;
  }

  static fromEnv(env = process.env) {
    const username = env.KAGGLE_USERNAME;
    const key = env.KAGGLE_KEY;
    if (!username || !key) return null;
    return new KaggleClient(username, key);
  }

  async call(method, body, { retries = 2, timeoutMs = 90_000 } = {}) {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetchWithTimeout(`${BASE}/${method}`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: this.auth,
            "User-Agent": UA,
          },
          body: JSON.stringify(body ?? {}),
        }, timeoutMs);
        const text = await res.text().catch(() => "");
        let data = null;
        try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 300) }; }
        if (!res.ok || (data && typeof data.code === "number" && data.code >= 400)) {
          const message = String(data?.message || data?.error || `Kaggle API ${res.status}`).slice(0, 400);
          const err = new KaggleError(message, res.status || data?.code, data);
          // Retry transient gateway/rate-limit failures, never auth/validation errors.
          if (res.status >= 500 || res.status === 429) { lastError = err; }
          else throw err;
        } else {
          return data;
        }
      } catch (e) {
        if (e instanceof KaggleError && e.status < 500 && e.status !== 429) throw e;
        lastError = e;
      }
      if (attempt < retries) await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
    throw lastError instanceof KaggleError ? lastError : new KaggleError(`Kaggle request failed: ${lastError?.message || "network error"}`, 502, null);
  }

  async verifyCredentials() {
    const data = await this.call("ListKernels", { user: this.username, pageSize: 1 }, { retries: 1, timeoutMs: 30_000 });
    return { ok: true, kernels: (data.kernels ?? data.items ?? []).length };
  }

  /**
   * Save + run a private notebook. The kernel title MUST slugify to the same
   * slug as `slug`, otherwise session status/output calls return 403/409.
   */
  async pushKernel(slug, { notebook, datasetSources = [], timeoutSeconds = 1800 }) {
    const clean = JSON.parse(typeof notebook === "string" ? notebook : JSON.stringify(notebook));
    if (Array.isArray(clean.cells)) {
      for (const cell of clean.cells) {
        if (Array.isArray(cell.source)) cell.source = cell.source.join("");
        if (cell.cell_type === "code") { cell.outputs = []; cell.execution_count = null; }
      }
    }
    const safeSlug = String(slug).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
    if (safeSlug.length < 5) throw new KaggleError("Kernel slug must be at least 5 characters", 400, null);
    const data = await this.call("SaveKernel", {
      slug: `${this.username}/${safeSlug}`,
      newTitle: safeSlug,
      text: JSON.stringify(clean),
      language: "python",
      kernelType: "notebook",
      isPrivate: true,
      enableGpu: false,
      enableInternet: true,
      datasetDataSources: datasetSources,
      competitionDataSources: [],
      kernelDataSources: [],
      sessionTimeoutSeconds: timeoutSeconds,
    });
    if (data.error) throw new KaggleError(String(data.error).slice(0, 400), 400, data);
    const ref = String(data.ref || `${this.username}/${safeSlug}`).replace(/^\/?code\//, "");
    return {
      ref,
      owner: ref.split("/")[0],
      slug: ref.split("/")[1],
      url: data.url || `https://www.kaggle.com/code/${ref}`,
      version: data.versionNumber ?? null,
      kernelId: data.kernelId ?? null,
    };
  }

  async kernelStatus(owner, slug) {
    return this.call("GetKernelSessionStatus", { userName: owner, kernelSlug: slug }, { retries: 1, timeoutMs: 30_000 });
  }

  /** Output listing returns signed download URLs once the session completes. */
  async kernelOutput(owner, slug, versionNumber) {
    const body = { userName: owner, kernelSlug: slug, pageSize: 200 };
    // The CLI requires a v-prefixed version label (bare numbers return 404).
    if (versionNumber != null) {
      const s = String(versionNumber);
      body.versionLabel = /^v\d+$/.test(s) ? s : `v${s}`;
    }
    const data = await this.call("ListKernelSessionOutput", body);
    const files = data.files || [];
    return {
      files: files.map((f) => ({
        name: f.fileName || f.name || "",
        url: f.url || null,
        size: f.totalBytes || f.size || 0,
      })).filter((f) => f.name),
      log: typeof data.log === "string" ? data.log : "",
      nextPageToken: data.nextPageToken || null,
    };
  }

  /** Download an output file using the signed URL from the listing. */
  async downloadOutputFile(file, { timeoutMs = 300_000, maxBytes = 300 * 1024 * 1024 } = {}) {
    if (!file?.url) throw new KaggleError("Output file has no download URL yet", 409, null);
    const res = await fetchWithTimeout(file.url, { headers: { "User-Agent": UA }, redirect: "follow" }, timeoutMs);
    if (!res.ok) throw new KaggleError(`Output download failed (${res.status})`, res.status, null);
    const chunks = [];
    let size = 0;
    const reader = res.body?.getReader();
    if (!reader) return Buffer.from(await res.arrayBuffer());
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) { reader.cancel().catch(() => {}); throw new KaggleError("Output file exceeds size limit", 413, null); }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  }

  async deleteKernel(owner, slug) {
    return this.call("DeleteKernel", { userName: owner, kernelSlug: slug }, { retries: 0, timeoutMs: 30_000 });
  }
}

/**
 * Kaggle KernelWorkerStatus enum:
 * 0 QUEUED, 1 RUNNING, 2 COMPLETE, 3 ERROR, 4 CANCEL_REQUESTED,
 * 5 CANCEL_ACKNOWLEDGED, 6 NEW_SCRIPT. Also tolerate string variants.
 */
export function normalizeKernelStatus(raw) {
  const value = raw?.status ?? raw?.state ?? "unknown";
  if (typeof value === "number") {
    return ({ 0: "queued", 1: "running", 2: "complete", 3: "error", 4: "cancelled", 5: "cancelled", 6: "queued" })[value] ?? "unknown";
  }
  const status = String(value).toUpperCase().replace(/^KERNEL_WORKER_STATUS_/, "");
  if (status.includes("COMPLETE") || status === "HAS_READ_ACCESS") return "complete";
  if (status.includes("ERROR") || status.includes("FAIL")) return "error";
  if (status.includes("CANCEL")) return "cancelled";
  if (status.includes("RUNNING") || status.includes("START")) return "running";
  if (status.includes("QUEUE") || status.includes("NEW_SCRIPT")) return "queued";
  return status.toLowerCase() || "unknown";
}

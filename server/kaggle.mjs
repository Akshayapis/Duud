/**
 * Kaggle Android build API client — uses the current Kaggle API:
 *   POST https://api.kaggle.com/v1/kernels.KernelsApiService/<Method>
 * Auth: HTTP Basic KAGGLE_USERNAME:KAGGLE_KEY.
 * Credentials live on the server only and are never returned to browsers.
 * Kaggle docs: https://www.kaggle.com/docs/api
 */
const BASE = "https://api.kaggle.com/v1/kernels.KernelsApiService";

export class KaggleError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "KaggleError";
    this.status = status;
    this.body = body;
  }
}

export class KaggleClient {
  constructor(username, key) {
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

  async call(method, body) {
    const res = await fetch(`${BASE}/${method}`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: this.auth, "User-Agent": "uapp-build-service/2.1" },
      body: JSON.stringify(body ?? {}),
    });
    const text = await res.text().catch(() => "");
    let data = null;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 300) }; }
    if (!res.ok || (data && typeof data.code === "number" && data.code >= 400)) {
      throw new KaggleError(String(data?.message || data?.error || `Kaggle API ${res.status}`).slice(0, 400), res.status, data);
    }
    return data;
  }

  async verifyCredentials() {
    const data = await this.call("ListKernels", { user: this.username, page_size: 1 });
    return { ok: true, username: this.username, kernels: (data.kernels ?? data.items ?? []).length };
  }

  /** Save + run a notebook. Returns the canonical ref, URL, version and kernel id. */
  async pushKernel(slug, { title, notebook, datasetSources = [] }) {
    const clean = JSON.parse(typeof notebook === "string" ? notebook : JSON.stringify(notebook));
    if (Array.isArray(clean.cells)) {
      for (const cell of clean.cells) {
        if (Array.isArray(cell.source)) cell.source = cell.source.join("");
        if (cell.cell_type === "code") cell.outputs = [];
      }
    }
    const data = await this.call("SaveKernel", {
      slug: `${this.username}/${slug}`,
      new_title: (title || slug).slice(0, 60),
      text: JSON.stringify(clean),
      language: "python",
      kernel_type: "notebook",
      is_private: true,
      enable_gpu: false,
      enable_internet: true,
      dataset_data_sources: datasetSources,
      competition_data_sources: [],
      kernel_data_sources: [],
    });
    const ref = String(data.ref || `${this.username}/${slug}`).replace(/^\/?code\//, "");
    return {
      ref,
      owner: ref.split("/")[0],
      slug: ref.split("/")[1],
      url: data.url || `https://www.kaggle.com/code/${ref}`,
      version: data.versionNumber ?? null,
      kernelId: data.kernelId ?? null,
      slugTitle: slug,
    };
  }

  async kernelStatus(owner, slug) {
    return this.call("GetKernelSessionStatus", { user_name: owner, kernel_slug: slug });
  }

  /** Tolerant parser for the output listing (the endpoint returns files once complete). */
  async kernelOutput(owner, slug, versionLabel) {
    const data = await this.call("ListKernelSessionOutput", { user_name: owner, kernel_slug: slug, page_size: 100, ...(versionLabel ? { version_label: versionLabel } : {}) });
    const files = data.files || data.entries || data.output || (Array.isArray(data) ? data : []);
    return {
      files: (files || []).map((f) => ({
        name: f.name || f.fileName || f.path || "",
        size: f.size || f.totalBytes || 0,
        token: f.token || f.url || f.downloadUrl || null,
        ref: f.ref || null,
        raw: f,
      })).filter((f) => f.name),
      log: typeof data.log === "string" ? data.log : "",
      raw: data,
    };
  }

  async downloadOutput(owner, slug, filePath, versionNumber) {
    const res = await fetch(`${BASE}/DownloadKernelOutput`, {
      method: "POST",
      headers: { Accept: "application/json, application/octet-stream", "Content-Type": "application/json", Authorization: this.auth, "User-Agent": "uapp-build-service/2.1" },
      body: JSON.stringify({ owner_slug: owner, kernel_slug: slug, file_path: filePath, ...(versionNumber ? { version_number: versionNumber } : {}) }),
      redirect: "follow",
    });
    if (!res.ok) throw new KaggleError(`Kaggle output download failed (${res.status})`, res.status, null);
    const type = res.headers.get("content-type") || "";
    if (type.includes("application/json")) {
      const data = await res.json();
      const url = data.url || data.downloadUrl || data.redirectUrl;
      if (!url) throw new KaggleError("Kaggle did not return a download location for this output.", 502, data);
      const file = await fetch(url);
      if (!file.ok) throw new KaggleError(`Kaggle output file download failed (${file.status})`, file.status, null);
      return Buffer.from(await file.arrayBuffer());
    }
    return Buffer.from(await res.arrayBuffer());
  }
}

/** Kaggle statuses: QUEUED, RUNNING, COMPLETE, ERROR, CANCEL_REQUESTED, CANCELED. */
export function normalizeKernelStatus(raw) {
  const status = String(raw?.status ?? raw?.state ?? "unknown").toUpperCase();
  if (status.includes("COMPLETE")) return "complete";
  if (status.includes("ERROR") || status.includes("FAIL")) return "error";
  if (status.includes("CANCEL")) return "cancelled";
  if (status.includes("RUNNING") || status.includes("START")) return "running";
  if (status.includes("QUEUE")) return "queued";
  return status.toLowerCase();
}

/**
 * U APP build engine client — Kaggle.
 *
 * The browser never talks to Kaggle directly and never receives Kaggle credentials.
 * All calls go to the U APP server, which owns KAGGLE_USERNAME / KAGGLE_KEY and runs
 * the queue, the notebook, polling, log capture and temporary artifact storage.
 */
import type { AppRecord } from "@/lib/store";
import { authToken } from "@/lib/firebase";

export { generateInstallableApp, openInstallablePreview, saveInstallable } from "@/lib/installable";
export type { InstallableApp } from "@/lib/installable";

export const BUILD_TIMEOUT_MS = 30 * 60 * 1000;
export const BUILD_NORMAL_MS = 8 * 60 * 1000;

export type BuildArtifact = { id?: number; name: string; size_in_bytes: number; expired: boolean; url?: string };
export type PlatformArtifact = BuildArtifact;

export type KaggleJob = {
  id: string;
  appId: string;
  status: "queued" | "running" | "ready" | "failed" | "expired" | "timeout" | "cancelled";
  kernelStatus: string | null;
  kernelUrl: string | null;
  createdAt: string;
  startedAt: string | null;
  expiresAt: number | null;
  error: string | null;
  queuePosition: number;
  artifacts: { name: string; size: number; url: string }[];
  logs: string[];
};

export type EngineHealth = {
  ok: boolean;
  engine: "kaggle" | "unavailable";
  buildEnabled: boolean;
  credentials: "verified" | "not-configured" | "rejected" | string;
  activeJob: string | null;
  queue: number;
  timeoutMinutes: number;
  downloadTtlSeconds: number;
  authRequired: boolean;
  firebaseProject: string;
  message?: string;
};

export async function engineHealth(): Promise<EngineHealth> {
  try {
    const res = await fetch("/api/health", { headers: { Accept: "application/json" } });
    const data = (await res.json()) as EngineHealth;
    return { ...data, engine: "kaggle" };
  } catch (e) {
    return {
      ok: false, engine: "unavailable", buildEnabled: false, credentials: "not-configured",
      activeJob: null, queue: 0, timeoutMinutes: 30, downloadTtlSeconds: 540,
      authRequired: true, firebaseProject: "dmakenow",
      message: `The build server is unreachable from this deployment (${(e as Error).message}). The static app still works and installable packages are generated in the browser.`,
    };
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await authToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as T & { ok?: boolean; error?: string; code?: string; message?: string };
  if (!res.ok) {
    const error = new Error(data.error || data.message || `Request failed (HTTP ${res.status})`);
    Object.assign(error, { status: res.status, code: data.code });
    throw error;
  }
  return data;
}

/** Uploads a ZIP project for persistent preservation (server disk + Kaggle dataset). */
export async function uploadSource(appId: string, file: File): Promise<{ sourceId: string; size: number }> {
  const token = await authToken();
  const form = new FormData();
  form.append("appId", appId);
  form.append("file", file, file.name);
  const res = await fetch("/api/source", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; sourceId?: string; size?: number; error?: string };
  if (!res.ok || !data.ok || !data.sourceId) throw new Error(data.error || `Source upload failed (HTTP ${res.status})`);
  return { sourceId: data.sourceId, size: data.size ?? file.size };
}

export type QueueResult = { job: KaggleJob; queuePosition: number; engine: "kaggle" };

export async function queueKaggleBuild(app: AppRecord, sourceId?: string): Promise<QueueResult> {
  const data = await request<QueueResult>("/api/build", {
    method: "POST",
    body: JSON.stringify({
      sourceId,
      app: {
        id: app.id,
        name: app.name,
        packageId: app.packageId,
        version: app.version,
        type: app.type,
        source: app.sourceLabel.startsWith("https://") ? app.sourceLabel : "https://uapp.local/source",
        splash: app.splashColor,
        permissions: app.permissions,
        ads: app.adsEnabled ? { network: app.adNetwork, formats: app.adFormats, timing: app.adTiming } : null,
        template: app.template,
      },
    }),
  });
  return { ...data, engine: "kaggle" };
}

export async function kaggleBuildStatus(jobId: string): Promise<KaggleJob> {
  const data = await request<{ ok: boolean; job: KaggleJob }>(`/api/build/${encodeURIComponent(jobId)}/status`);
  return data.job;
}

export async function cancelKaggleBuild(jobId: string): Promise<{ ok: boolean; status?: string; error?: string }> {
  try {
    return await request<{ ok: boolean; status?: string }>(`/api/build/${encodeURIComponent(jobId)}/cancel`, { method: "POST" });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function downloadKaggleArtifact(job: KaggleJob, artifact: BuildArtifact, packageId: string): Promise<void> {
  const token = await authToken();
  const url = artifact.url || `/api/build/${encodeURIComponent(job.id)}/artifact/${encodeURIComponent(artifact.name)}`;
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (res.status === 410) throw new Error("Download link expired after nine minutes. Use Create Again to rebuild from preserved source (no credit).");
  if (!res.ok) throw new Error(`Artifact download failed (HTTP ${res.status}).`);
  const blob = await res.blob();
  const saveUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = saveUrl;
  a.download = `${packageId}-${artifact.name.replace(/^\d+-/, "")}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(saveUrl), 30000);
}

export async function fetchBuildLogs(jobId: string): Promise<string[]> {
  try {
    const job = await kaggleBuildStatus(jobId);
    return job.logs || [];
  } catch {
    return [];
  }
}

export function artifactsFromJob(job: KaggleJob | null): BuildArtifact[] {
  if (!job) return [];
  return job.artifacts.map((a, index) => ({ id: index, name: a.name, size_in_bytes: a.size, expired: Boolean(job.expiresAt && Date.now() > job.expiresAt), url: a.url }));
}

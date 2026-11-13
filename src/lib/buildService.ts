/**
 * U APP build engine client.
 *
 * The browser never talks to the build provider directly and never receives
 * provider credentials or kernel URLs. All calls go to the U APP server.
 */
import type { AppRecord } from "@/lib/store";
import { authToken } from "@/lib/firebase";

export { generateInstallableApp, openInstallablePreview, saveInstallable } from "@/lib/installable";
export type { InstallableApp } from "@/lib/installable";

export const BUILD_TIMEOUT_MS = 35 * 60 * 1000;

export type BuildArtifact = { id?: number; name: string; size_in_bytes: number; expired: boolean; url?: string; sha256?: string };
export type PlatformArtifact = BuildArtifact;

export type BuildJob = {
  id: string;
  appId: string;
  status: "queued" | "running" | "ready" | "failed" | "expired" | "timeout" | "cancelled";
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  expiresAt: number | null;
  error: string | null;
  queuePosition: number;
  artifacts: { name: string; size: number; sha256?: string; url: string }[];
  logs: string[];
};
/** @deprecated alias kept for existing imports */
export type KaggleJob = BuildJob;

export type EngineHealth = {
  ok: boolean;
  buildEnabled: boolean;
  engineStatus: "verified" | "checking" | "not-configured" | "rejected" | "unreachable";
  queue: number;
  active: boolean;
  timeoutMinutes: number;
  downloadTtlSeconds: number;
  authRequired: boolean;
  message?: string;
};

export async function engineHealth(): Promise<EngineHealth> {
  try {
    const res = await fetch("/api/health", { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as EngineHealth;
  } catch (e) {
    return {
      ok: false, buildEnabled: false, engineStatus: "unreachable", queue: 0, active: false,
      timeoutMinutes: 30, downloadTtlSeconds: 540, authRequired: true,
      message: `The build server is unreachable (${(e as Error).message}). Your project is saved; retry the build when the server is back.`,
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
  const data = (await res.json().catch(() => ({}))) as T & { ok?: boolean; error?: string; code?: string };
  if (!res.ok) {
    const error = new Error(data.error || `Request failed (HTTP ${res.status})`);
    Object.assign(error, { status: res.status, code: data.code });
    throw error;
  }
  return data;
}

/** Uploads a ZIP project to persistent server storage. Throws on failure — never silently skipped. */
export async function uploadSource(appId: string, file: File): Promise<{ sourceId: string; size: number; hasGradle: boolean; hasIndex: boolean }> {
  const token = await authToken();
  const form = new FormData();
  form.append("appId", appId);
  form.append("file", file, file.name);
  const res = await fetch("/api/source", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; sourceId?: string; size?: number; hasGradle?: boolean; hasIndex?: boolean; error?: string };
  if (!res.ok || !data.ok || !data.sourceId) throw new Error(data.error || `Source upload failed (HTTP ${res.status})`);
  return { sourceId: data.sourceId, size: data.size ?? file.size, hasGradle: Boolean(data.hasGradle), hasIndex: Boolean(data.hasIndex) };
}

export type QueueResult = { job: BuildJob; queuePosition: number };

export function adTimingSeconds(timing?: string): number {
  const m = /^(\d+)/.exec(timing || "");
  return m ? Math.min(300, Math.max(10, Number(m[1]))) : 60;
}

export async function queueBuild(app: AppRecord): Promise<QueueResult> {
  const isUrl = /^https:\/\//i.test(app.sourceLabel);
  const source = isUrl ? { kind: "url", url: app.sourceLabel } : app.sourceId ? { kind: "zip", sourceId: app.sourceId } : null;
  if (!source) throw new Error("This project has no preserved source. Re-upload the ZIP or HTML before building.");
  return request<QueueResult>("/api/build", {
    method: "POST",
    body: JSON.stringify({
      source,
      app: {
        id: app.id,
        name: app.name,
        packageId: app.packageId,
        version: app.version,
        type: app.type,
        splash: app.splashColor,
        permissions: app.permissions,
      },
      ads: app.adsEnabled ? {
        network: "admob",
        formats: app.adFormats,
        timingSeconds: adTimingSeconds(app.adTiming),
        testMode: app.adTestMode !== false,
        appId: app.adAppId,
        units: app.adUnits,
      } : null,
    }),
  });
}
/** @deprecated alias */
export const queueKaggleBuild = (app: AppRecord, _sourceId?: string) => queueBuild(app);

export async function buildStatus(jobId: string): Promise<BuildJob> {
  const data = await request<{ ok: boolean; job: BuildJob }>(`/api/build/${encodeURIComponent(jobId)}/status`);
  return data.job;
}
export const kaggleBuildStatus = buildStatus;

export async function cancelBuild(jobId: string): Promise<{ ok: boolean; status?: string; error?: string }> {
  try {
    return await request<{ ok: boolean; status?: string }>(`/api/build/${encodeURIComponent(jobId)}/cancel`, { method: "POST" });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
export const cancelKaggleBuild = cancelBuild;

export async function downloadArtifact(job: BuildJob, artifact: BuildArtifact, packageId: string): Promise<void> {
  const token = await authToken();
  const url = artifact.url || `/api/build/${encodeURIComponent(job.id)}/artifact/${encodeURIComponent(artifact.name)}`;
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (res.status === 410) throw new Error("Download link expired. Rebuild from the preserved source.");
  if (!res.ok) throw new Error(`Artifact download failed (HTTP ${res.status}).`);
  const blob = await res.blob();
  const saveUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = saveUrl;
  a.download = `${packageId}-${artifact.name.replace(/^\d+-/, "")}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(saveUrl), 30_000);
}
export const downloadKaggleArtifact = downloadArtifact;

export async function fetchBuildLogs(jobId: string): Promise<string[]> {
  try {
    const job = await buildStatus(jobId);
    return job.logs || [];
  } catch {
    return [];
  }
}

export function artifactsFromJob(job: BuildJob | null): BuildArtifact[] {
  if (!job) return [];
  return job.artifacts.map((a, index) => ({ id: index, name: a.name, size_in_bytes: a.size, sha256: a.sha256, expired: Boolean(job.expiresAt && Date.now() > job.expiresAt), url: a.url }));
}

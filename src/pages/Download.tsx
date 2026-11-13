import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download as DownloadIcon,
  FileArchive,
  FileCode2,
  FileText,
  Code2,
  Info,
  Lock,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Timer,
  Globe2,
  Zap,
} from "lucide-react";
import { Badge, Button, buttonClass, Card, CopyButton, Progress, useToast } from "@/components/ui";
import { PageHeader } from "@/components/Shell";
import { PERMISSIONS, TEMPLATES } from "@/data/catalog";
import { formatDate, useStore } from "@/lib/store";
import { downloadArtifact, buildStatus, generateInstallableApp, openInstallablePreview, saveInstallable, type PlatformArtifact } from "@/lib/buildService";
import { allAdTagsHtml, type AdTagFormat } from "@/lib/ads";
import { NETWORKS } from "@/data/catalog";
import { mmss, useCountdown } from "@/lib/useCountdown";
import { cn } from "@/utils/cn";

function BuildTimer({ startedAt, deadline }: { startedAt?: string; deadline: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const started = startedAt ? new Date(startedAt).getTime() : now;
  const elapsed = Math.max(0, now - started);
  const left = Math.max(0, deadline - now);
  const over = elapsed > 10 * 60 * 1000;
  const failed = left === 0;
  const mmss = (ms: number) => `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
  return (
    <div className={cn("mb-4 rounded-xl border p-3.5", failed ? "border-rose-500/30 bg-rose-500/[0.06]" : over ? "border-amber-500/30 bg-amber-500/[0.06]" : "border-sky-500/25 bg-sky-500/[0.05]")}>
      <div className="flex flex-wrap items-center gap-3">
        <span className={cn("h-2 w-2 rounded-full", failed ? "bg-rose-500" : "animate-pulse-dot bg-sky-400")} />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold text-ink">
            {failed ? "Build limit reached" : over ? "Build is taking longer than usual" : "Building your APK on the isolated Android worker"}
          </div>
          <div className="mt-0.5 text-[9.5px] leading-relaxed text-muted">
            {failed ? "The build execution limit has passed. Use Rebuild to compile again from the preserved source." : `Typical build 5–12 minutes. ${over ? "This build is in overtime and may run up to the 30-minute execution limit." : "You can leave this page — the build continues in the background."}`}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[8px] uppercase tracking-wider text-muted">Elapsed</div>
            <div className="font-mono text-[15px] font-semibold text-ink">{mmss(elapsed)}</div>
          </div>
          <div className="text-right">
            <div className="text-[8px] uppercase tracking-wider text-muted">Limit left</div>
            <div className={cn("font-mono text-[15px] font-semibold", left < 300000 ? "text-amber-500" : "text-ink")}>{failed ? "00:00" : mmss(left)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const PERM_MAP: Record<string, string> = {
  internet: "android.permission.INTERNET",
  network: "android.permission.ACCESS_NETWORK_STATE",
  notifications: "android.permission.POST_NOTIFICATIONS",
  camera: "android.permission.CAMERA",
  microphone: "android.permission.RECORD_AUDIO",
  location: "android.permission.ACCESS_FINE_LOCATION",
  bluetooth: "android.permission.BLUETOOTH_CONNECT",
  nfc: "android.permission.NFC",
  media: "android.permission.READ_MEDIA_IMAGES",
  contacts: "android.permission.READ_CONTACTS",
  calendar: "android.permission.READ_CALENDAR",
  vibration: "android.permission.VIBRATE",
  wakelock: "android.permission.WAKE_LOCK",
  foreground: "android.permission.FOREGROUND_SERVICE",
  storage: "android.permission.READ_EXTERNAL_STORAGE",
  biometric: "android.permission.USE_BIOMETRIC",
};

export default function DownloadPage() {
  const { id } = useParams();
  const { state, rebuildApp, checkApkBuild, cancelBuild } = useStore();
  const { toast } = useToast();
  const app = state.apps.find((a) => a.id === id);
  const remaining = useCountdown(app?.linkExpiresAt);
  const [busy, setBusy] = useState(false);
  const [pkgBusy, setPkgBusy] = useState(false);
  const [apkBusy, setApkBusy] = useState(false);
  const [apkStatus, setApkStatus] = useState<string>("");
  const apkArtifacts: PlatformArtifact[] = app?.artifactList ?? [];
  const expired = remaining <= 0;
  const template = TEMPLATES.find((t) => t.id === app?.templateId) ?? TEMPLATES[0];


  const downloadInstallable = async () => {
    if (!app) return;
    setPkgBusy(true);
    try {
      const pkg = await generateInstallableApp(app);
      saveInstallable(pkg);
      setApkStatus(`Installable package generated in ${(pkg.ms / 1000).toFixed(1)}s · ${pkg.sizeMb} MB`);
      toast("Installable app package downloaded.", "success");
    } catch {
      toast("Could not generate the installable package. Try again.", "error");
    } finally {
      setPkgBusy(false);
    }
  };

  const checkApk = async () => {
    if (!app) return;
    setApkBusy(true);
    const res = await checkApkBuild(app.id);
    setApkStatus(res.message);
    setApkBusy(false);
    toast(res.message, res.ok ? "success" : "info");
  };

  const grabApk = async (a: PlatformArtifact) => {
    if (!app?.buildJobId) return toast("No build job is linked. Use Rebuild to compile a real APK.", "error");
    setApkBusy(true);
    try {
      const job = await buildStatus(app.buildJobId);
      await downloadArtifact(job, a, app.packageId);
      toast("APK downloaded from the verified build.", "success");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setApkBusy(false);
    }
  };

  if (!app) {
    return (
      <div>
        <PageHeader title="Download not found" subtitle="This project or temporary artifact no longer exists." />
        <Link to="/app/apps" className={buttonClass("primary", "md")}><ArrowLeft className="h-4 w-4" /> Back to My Apps</Link>
      </div>
    );
  }

  const permissionText = `# U APP generated permissions\n# Project: ${app.name}\n# Package: ${app.packageId}\n# Generated: ${new Date().toISOString()}\n# Selected permissions: ${app.permissions.length}\n\n${app.permissions
    .map((p) => {
      const perm = PERMISSIONS.find((x) => x.id === p);
      return `# ${perm?.name ?? p} — ${perm?.why ?? ""}\n<uses-permission android:name="${PERM_MAP[p] ?? p}" />`;
    })
    .join("\n\n")}\n`;

  const config = {
    app: {
      name: app.name,
      package_id: app.packageId,
      version: app.version,
      type: app.type,
      source: app.sourceLabel,
      build_type: app.buildType,
      template: { id: app.templateId, name: app.template },
      offline: app.offline,
      splash_color: app.splashColor,
      icon_color: app.iconColor,
    },
    permissions: app.permissions,
    ads: app.adsEnabled ? { network: app.adNetwork, formats: app.adFormats, timing: app.adTiming } : null,
    artifact: {
      project_id: app.id,
      status: app.buildStatus,
      runner: "isolated server-side Android build engine",
      expires_at: app.linkExpiresAt ? new Date(app.linkExpiresAt).toISOString() : null,
    },
    generated_at: new Date().toISOString(),
  };

  const saveBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  const downloadPermissions = () => {
    if (expired) return toast("The link expired. Rebuild to generate a new one.", "error");
    saveBlob(new Blob([permissionText], { type: "text/plain" }), `${app.packageId}-permission.txt`);
    toast("permission.txt downloaded.", "success");
  };

  const downloadAdTags = () => {
    if (!app.adsEnabled) return toast("Ads were skipped for this project.", "info");
    const network = NETWORKS.find((n) => n.name === app.adNetwork) ?? NETWORKS[0];
    const map: Record<string, AdTagFormat> = { "Banner": "banner", "Adaptive Banner": "banner", "MREC": "mrec", "Interstitial": "interstitial", "Rewarded": "rewarded", "Rewarded Interstitial": "rewarded-interstitial", "App Open": "app-open" };
    const html = allAdTagsHtml(network.id, app.id, (app.adFormats.length ? app.adFormats : ["Banner"]).map((f) => map[f] ?? "banner"));
    saveBlob(new Blob([html], { type: "text/html" }), `${app.packageId}-ads-tags.html`);
    toast("Ad load tags downloaded. Paste them into your HTML, then rebuild.", "success");
  };

  const downloadConfig = () => {
    if (expired) return toast("The link expired. Rebuild to generate a new one.", "error");
    saveBlob(new Blob([JSON.stringify(config, null, 2)], { type: "application/json" }), `${app.packageId}-config.json`);
    toast("Project configuration JSON downloaded.", "success");
  };

  const downloadZip = async () => {
    if (expired) return toast("The link expired. Rebuild to generate a new one.", "error");
    setBusy(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const root = zip.folder("uapp-project")!;
      root.file("project-config.json", JSON.stringify(config, null, 2));
      root.file("permission.txt", permissionText);
      root.file(
        "README.md",
        `# ${app.name}\n\nPackage: ${app.packageId}\nVersion: ${app.version}\nProject: ${app.id}\nTemplate: ${app.template}\n\n## Artifact status\n\nThe Android APK/AAB is produced by the isolated server-side Android build worker. This project archive contains the validated configuration, permission manifest and source notes. It is not an APK and is not presented as one.\n\n## Source\n${app.sourceLabel}\n\n## Timeline\nCreated ${app.createdAt}\nTemporary link expiry ${app.linkExpiresAt ? new Date(app.linkExpiresAt).toISOString() : "—"}\n\n## Build notes\n${app.notes.map((n) => `- ${n}`).join("\n")}\n`
      );
      root.file(
        "android/app/src/main/AndroidManifest.xml",
        `<?xml version="1.0" encoding="utf-8"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android"\n    package="${app.packageId}">\n${app.permissions.map((p) => `    <uses-permission android:name="${PERM_MAP[p] ?? p}" />`).join("\n")}\n    <application android:label="${app.name}">\n        <activity android:name=".MainActivity" android:exported="true">\n            <intent-filter>\n                <action android:name="android.intent.action.MAIN" />\n                <category android:name="android.intent.category.LAUNCHER" />\n            </intent-filter>\n        </activity>\n    </application>\n</manifest>\n`
      );
      if (app.type === "website" || app.type === "webview" || app.sourceLabel.startsWith("http")) {
        root.file(
          "www/index.html",
          `<!doctype html>\n<html lang="en">\n  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n  <title>${app.name}</title><style>html,body,iframe{height:100%;margin:0;border:0;width:100%}body{background:${app.splashColor}}</style></head>\n  <body>\n    <iframe src="${app.sourceLabel}" title="${app.name}" allow="camera; microphone; geolocation"></iframe>\n  </body>\n</html>\n`
        );
      } else {
        root.file("www/source-note.txt", "Paste or add your HTML/static source files here, then rerun the build pipeline.");
      }
      const blob = await zip.generateAsync({ type: "blob" });
      saveBlob(blob, `${app.packageId}-source-package.zip`);
      toast("Source package ZIP generated and downloaded.", "success");
    } catch {
      toast("Could not generate the source package. Try again.", "error");
    } finally {
      setBusy(false);
    }
  };

  const rebuild = () => {
    void rebuildApp(app.id);
    toast("Create again dispatched. No app creation credit consumed.", "success");
  };

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}#/app/apps/${app.id}/download` : "";
  const elapsed = app.buildStartedAt ? Math.max(1, Math.round((new Date(app.buildStartedAt).getTime() - new Date(app.createdAt).getTime()) / 1000)) : 0;

  return (
    <div>
      <Link to={`/app/apps/${app.id}`} className="mb-4 inline-flex items-center gap-1.5 text-[11px] font-medium text-muted hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> Project details</Link>
      <PageHeader
        title="Download"
        subtitle="APK/AAB artifacts are compiled by the isolated Android worker and appear here when verified. Temporary download links expire after nine minutes. A separate web/PWA package is available for browser installation."
        eyebrow={app.id}
        actions={<><Button variant="secondary" size="md" onClick={rebuild}><RefreshCw className="h-4 w-4" /> Create again</Button><Link to="/app/apps" className={buttonClass("lime", "md")}>My apps</Link></>}
      />

      {(app.buildStatus === "building" || app.buildStatus === "queued") && app.buildDeadline && (
        <BuildTimer startedAt={app.buildStartedAt} deadline={app.buildDeadline} />
      )}
      {app.buildError && app.buildStatus === "failed" && (
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3.5 sm:flex-row sm:items-center">
          <Timer className="h-4 w-4 shrink-0 text-amber-500" />
          <p className="flex-1 text-[10px] leading-relaxed text-muted"><span className="font-semibold text-ink">Build did not produce an APK.</span> {app.buildError}</p>
          <Button variant="lime" size="sm" onClick={rebuild}><RefreshCw className="h-3.5 w-3.5" /> Retry APK</Button>
        </div>
      )}
      {app.buildState !== "timeout" && expired ? (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-500"><Timer className="h-5 w-5" /></div>
            <div className="flex-1">
              <div className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-amber-600 dark:text-amber-400">Download link expired</div>
              <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted">The nine-minute window closed. Create again to rebuild your app from preserved source and generate a fresh link. No app creation credit is consumed.</p>
            </div>
            <Button variant="lime" size="sm" onClick={rebuild}><RefreshCw className="h-3.5 w-3.5" /> Create again</Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.5fr_.9fr]">
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl font-display text-[18px] font-bold" style={{ background: app.iconColor, color: "#111605" }}>{app.name.slice(0, 1).toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-[17px] font-bold text-ink">{app.name}</h2>
                  <Badge tone={app.buildStatus === "ready" ? "green" : app.buildStatus === "failed" ? "rose" : "sky"}>{app.buildStatus}</Badge>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9.5px] text-muted">
                  <span className="font-mono">{app.packageId}</span><span>·</span><span>v{app.version}</span><span>·</span><span>{app.buildType}</span>
                </div>
              </div>
              <div className="rounded-xl border border-line bg-panel2/60 px-3 py-2 text-center">
                <div className="text-[8px] font-semibold uppercase tracking-wider text-muted">Expiry</div>
                <div className={cn("font-mono text-[19px] font-semibold leading-tight", expired ? "text-rose-500" : "text-ink")}>{expired ? "00:00" : mmss(remaining)}</div>
              </div>
            </div>

            <div className="p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Temporary storage window</span>
                <span className="text-[9px] text-muted">{expired ? "Expired" : `${mmss(remaining)} remaining`}</span>
              </div>
              <Progress value={(remaining / 540) * 100} className="mt-1.5" tone={expired ? "rose" : remaining < 120 ? "violet" : "lime"} />
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {[
                  { name: "Download installable app", meta: "Working PWA package · manifest, icons, offline shell", icon: Smartphone, enabled: true, action: () => void downloadInstallable() },
                  { name: "Open live app", meta: "Launch this app in your browser now", icon: Globe2, enabled: true, action: () => openInstallablePreview(app) },
                  { name: "Download APK", meta: app.artifactKind === "apk" ? "Verified APK from the Android build engine" : "APK build starts automatically", icon: Smartphone, enabled: (app.artifactList?.length ?? 0) > 0, note: app.buildJobId ? "Check build status below" : "Build queued", action: () => { const first = app.artifactList?.[0]; if (first) void grabApk(first); else void checkApk(); } },
                  { name: "Download AAB", meta: "Release bundle from the Android build (unsigned unless signing is configured)", icon: FileArchive, enabled: (app.artifactList ?? []).some((a) => /\.aab$/i.test(a.name)), note: app.buildJobId ? "Check build status" : "Build queued", action: () => { const aab = app.artifactList?.find((a) => /\.aab$/i.test(a.name)); if (aab) void grabApk(aab); } },
                  { name: "Download project package", meta: "Source shell, config, manifest and icons", icon: FileCode2, enabled: true, action: () => void downloadZip() },
                  { name: "Download permission.txt", meta: `${app.permissions.length} selected permissions`, icon: FileText, enabled: true, action: downloadPermissions },
                  { name: "Download project JSON", meta: "Machine-readable project config", icon: FileText, enabled: true, action: downloadConfig },
                  { name: "Download ad load tags", meta: app.adsEnabled ? `${app.adNetwork} · ${app.adFormats.length} format(s)` : "Ads skipped for this build", icon: Code2, enabled: app.adsEnabled, action: downloadAdTags },
                ].map((f) => (
                  <button
                    key={f.name}
                    onClick={() => f.action?.()}
                    disabled={!f.enabled || expired || busy}
                    className={cn(
                      "flex items-start gap-2.5 rounded-xl border p-3 text-left transition",
                      f.enabled ? "border-line bg-panel2/40 hover:border-lime/40 hover:bg-lime/[0.03]" : "cursor-not-allowed border-dashed border-line bg-panel2/20 opacity-65"
                    )}
                  >
                    <div className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", f.enabled ? "bg-lime/10 text-lime" : "bg-panel2 text-muted")}><f.icon className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink">{f.name}{!f.enabled && <Lock className="h-3 w-3 text-muted" />}</div>
                      <div className="mt-0.5 text-[9px] leading-relaxed text-muted">{f.meta}</div>
                      {!f.enabled && <span className="mt-1 inline-block rounded bg-amber-500/10 px-1.5 py-0.5 text-[7.5px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">{f.note}</span>}
                    </div>
                    {f.enabled && <DownloadIcon className="mt-1 h-3.5 w-3.5 shrink-0 text-muted" />}
                  </button>
                ))}
              </div>
              <div className={cn("mt-3 rounded-xl border p-3", app.buildJobId ? "border-lime/25 bg-lime/[0.04]" : "border-line bg-panel2/40")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[10.5px] font-semibold text-ink">APK / AAB build</div>
                    <div className="text-[9px] leading-relaxed text-muted">
                      {app.buildStatus === "ready" && (app.artifactList?.length ?? 0) > 0 ? "APK/AAB is ready. The download window closes 9 minutes after it was generated." : app.buildStatus === "building" || app.buildStatus === "queued" ? "Building on the isolated Android worker — usually 5–12 minutes." : app.buildStatus === "failed" || app.buildStatus === "cancelled" ? "No verified APK artifact. Rebuild from the preserved source." : "Waiting for a verified build artifact."}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <Button variant="lime" size="sm" loading={pkgBusy} onClick={() => void downloadInstallable()}><DownloadIcon className="h-3.5 w-3.5" /> Installable app</Button>
                    {app.buildJobId && <Button variant="secondary" size="sm" loading={apkBusy} onClick={() => void checkApk()}><RefreshCw className="h-3.5 w-3.5" /> Check build status</Button>}
                    {app.buildJobId && app.buildStatus === "building" && <Button variant="ghost" size="sm" onClick={async () => { const r = await cancelBuild(app.id); toast(r.message, r.ok ? "success" : "info"); }}>Cancel</Button>}
                  </div>
                </div>
                <p className="mt-1.5 text-[8.5px] text-muted">APK builds run on the isolated server-side Android engine. Provider credentials never reach the browser.</p>
                {apkStatus && <p className="mt-2 rounded-lg border border-line bg-panel px-2 py-1.5 font-mono text-[9px] text-muted">{apkStatus}</p>}
                {apkArtifacts.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {apkArtifacts.map((a) => (
                      <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-panel px-2.5 py-2">
                        <FileArchive className="h-3.5 w-3.5 text-muted" />
                        <div className="min-w-0 flex-1"><div className="truncate font-mono text-[9.5px] text-ink">{a.name}</div><div className="text-[8px] text-muted">{(a.size_in_bytes / 1024 / 1024).toFixed(2)} MB · {a.expired ? "expired" : "available"}</div></div>
                        <Button variant="lime" size="sm" disabled={a.expired} loading={apkBusy} onClick={() => void grabApk(a)}><DownloadIcon className="h-3 w-3" /> APK</Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="text-[12.5px] font-semibold text-ink">Build metadata</h2><span className="inline-flex items-center gap-1.5 text-[8.5px] text-muted"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Account synced</span></div>
            <div className="grid gap-x-6 gap-y-0 p-4 sm:grid-cols-2">
              {[
                ["Project ID", app.id],
                ["Build type", app.buildType],
                ["Version", app.version],
                ["Configuration size", `${app.artifactMb.toFixed(1)} MB`],
                ["Requested", formatDate(app.createdAt)],
                ["Prepared in", elapsed > 0 ? `${elapsed}s` : "pending"],
                ["Status", app.buildStatus],
                ["Link expiry", app.linkExpiresAt ? new Date(app.linkExpiresAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3 border-b border-line/60 py-1.5 text-[10px] last:border-0">
                  <span className="text-muted">{k}</span>
                  <span className="font-medium text-ink">{v}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-line p-4">
              <div className="text-[9px] font-semibold uppercase tracking-wider text-muted">Build notes</div>
              <div className="mt-1.5 space-y-1">
                {app.notes.map((n, i) => (
                  <div key={i} className="flex items-start gap-1.5 font-mono text-[9px] leading-relaxed text-muted">
                    <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-lime" /> {n}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4 text-center">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-semibold text-ink">Scan to open</h2>
              <QrCode className="h-4 w-4 text-muted" />
            </div>
            <div className="mx-auto mt-3 inline-block rounded-xl border border-line bg-white p-2.5">
              <QRCodeSVG value={shareUrl} size={140} bgColor="#ffffff" fgColor="#0a0c10" level="M" />
            </div>
            <p className="mt-2.5 text-[9px] leading-relaxed text-muted">Scan this session link to open the same download page on a phone. The QR opens the same download page on a phone.</p>
            <div className="mt-2 rounded-lg border border-line bg-panel2/50 px-2 py-1.5 font-mono text-[8px] text-muted break-all">{app.packageId} · {app.id}</div>
          </Card>

          <Card className="p-4">
            <h2 className="text-[11px] font-semibold text-ink">Share this download page</h2>
            <p className="mt-1 text-[9px] leading-relaxed text-muted">Send the link from your history. It always opens the current build status and a fresh 9-minute window after Create again.</p>
            <div className="mt-2 flex items-center gap-1.5">
              <code className="min-w-0 flex-1 truncate rounded-md border border-line bg-panel2/60 px-2 py-1.5 font-mono text-[8.5px] text-muted">{shareUrl}</code>
              <CopyButton text={shareUrl} label="Copy" />
            </div>
            <div className="mt-2 flex gap-1.5">
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => { navigator.clipboard.writeText(shareUrl); toast("Download link copied.", "success"); }}>Copy link</Button>
              <Button variant="lime" size="sm" className="flex-1" onClick={rebuild}><RefreshCw className="h-3 w-3" /> Re-create</Button>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-[11px] font-semibold text-ink">Artifact rules</h2>
            <div className="mt-2 space-y-2">
              {[
                { icon: Clock, t: "9 minutes only", d: "Signed link expires and the artifact is deleted." },
                { icon: RefreshCw, t: "Create again", d: "Rebuild from preserved source for a new window." },
                { icon: Zap, t: "0 credits to rebuild", d: "Only a brand-new app consumes a creation credit." },
                { icon: ShieldCheck, t: "Never in the database", d: "APKs and source archives stay out of the account database." },
              ].map((x) => (
                <div key={x.t} className="flex items-start gap-2">
                  <x.icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
                  <div><div className="text-[10px] font-semibold text-ink">{x.t}</div><div className="text-[9px] leading-relaxed text-muted">{x.d}</div></div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-line px-3.5 py-2.5"><h2 className="text-[11px] font-semibold text-ink">App appearance</h2></div>
            <div className="p-3.5" style={{ background: template.bg }}>
              <div className="rounded-lg border p-2.5" style={{ borderColor: "rgba(255,255,255,.1)" }}>
                <div className="h-5 w-5 rounded-md" style={{ background: app.iconColor }} />
                <div className="mt-2 font-display text-[13px] font-semibold text-white">{app.name}</div>
                <div className="mt-0.5 text-[8.5px]" style={{ color: template.accent }}>{app.template} · {template.category}</div>
                <div className="mt-2 flex gap-1">
                  {app.permissions.slice(0, 3).map((p) => <span key={p} className="rounded bg-white/10 px-1 py-0.5 font-mono text-[7px] text-white/60">{p}</span>)}
                </div>
              </div>
            </div>
          </Card>

          <div className="flex items-start gap-2 rounded-xl border border-line bg-panel/50 p-3">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
            <p className="text-[9px] leading-relaxed text-muted">Artifact storage is temporary. Missing or expired files are handled gracefully with an expiry message — never a broken claim of availability.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

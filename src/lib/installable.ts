import type { AppRecord } from "@/lib/store";
import { allAdTagsHtml, type AdTagFormat } from "@/lib/ads";
import { NETWORKS } from "@/data/catalog";

/** Working installable package generator (PWA shell) used when the Kaggle APK
 * engine is unavailable — never a fake APK. */

function websiteShell(app: AppRecord): string {
  const src = app.sourceLabel.startsWith("http") ? app.sourceLabel : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<title>${escapeHtml(app.name)}</title>
<style>
  html,body{margin:0;height:100%;background:${app.splashColor || "#080a0d"}}
  iframe{width:100%;height:100%;border:0;background:#fff;display:block}
  .off{display:none;position:fixed;inset:0;place-items:center;text-align:center;padding:24px;font:500 14px system-ui;background:${app.splashColor || "#080a0d"};color:#f4f6ee}
  body.offline .off{display:grid}
</style>
</head>
<body>
${src ? `<iframe src="${escapeHtml(src)}" title="${escapeHtml(app.name)}" allow="camera; microphone; geolocation; fullscreen; clipboard-write; autoplay" referrerpolicy="no-referrer-when-downgrade"></iframe>` : `<div class="off" style="display:grid"><div><h1>${escapeHtml(app.name)}</h1><p>Add your HTML pages to this folder to publish this app.</p></div></div>`}
<div class="off"><div><h1>You are offline</h1><p>Reconnect to load live content. This app shell works offline.</p></div></div>
<script>
  window.addEventListener("offline", () => document.body.classList.add("offline"));
  window.addEventListener("online", () => document.body.classList.remove("offline"));
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./manifest.webmanifest").catch(() => {});
</script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function permCode(p: string): string {
  const map: Record<string, string> = {
    internet: "INTERNET", network: "ACCESS_NETWORK_STATE", notifications: "POST_NOTIFICATIONS", camera: "CAMERA",
    microphone: "RECORD_AUDIO", location: "ACCESS_FINE_LOCATION", bluetooth: "BLUETOOTH_CONNECT", nfc: "NFC",
    media: "READ_MEDIA_IMAGES", contacts: "READ_CONTACTS", calendar: "READ_CALENDAR", vibration: "VIBRATE",
    wakelock: "WAKE_LOCK", foreground: "FOREGROUND_SERVICE", storage: "READ_EXTERNAL_STORAGE", biometric: "USE_BIOMETRIC",
  };
  return map[p] ?? p.toUpperCase();
}

export type InstallableApp = { blob: Blob; filename: string; sizeMb: number; ms: number };

export async function generateInstallableApp(app: AppRecord): Promise<InstallableApp> {
  const started = performance.now();
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const root = zip.folder("uapp-app")!;
  const isUrl = app.sourceLabel.startsWith("http");
  const pkg = { scripts: { start: "npx serve ." }, devDependencies: { serve: "^14.2.3" } };

  root.file("index.html", websiteShell(app));
  root.file("manifest.webmanifest", JSON.stringify({
    name: app.name, short_name: app.name.slice(0, 12), start_url: "./index.html", display: "standalone",
    background_color: app.splashColor, theme_color: app.iconColor,
    icons: [{ src: "icon-192.png", sizes: "192x192", type: "image/png" }, { src: "icon-512.png", sizes: "512x512", type: "image/png" }],
  }, null, 2));
  root.file("sw.js", `const C="uapp-${app.id}";self.addEventListener("install",e=>e.waitUntil(caches.open(C).then(c=>c.addAll(["./","./index.html","./manifest.webmanifest"])).then(()=>self.skipWaiting())));self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));self.addEventListener("fetch",e=>{if(e.request.method==="GET")e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(C).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request).then(h=>h||caches.match("./index.html"))))});`);
  root.file("icon-192.png", await (async () => {
    const canvas = document.createElement("canvas"); canvas.width = 192; canvas.height = 192;
    const ctx = canvas.getContext("2d"); if (ctx) { ctx.fillStyle = app.iconColor; ctx.fillRect(0, 0, 192, 192); ctx.fillStyle = "#111605"; ctx.font = "bold 96px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(app.name.slice(0, 1).toUpperCase(), 96, 100); }
    return canvas.toDataURL("image/png").split(",")[1];
  })(), { base64: true });
  root.file("package.json", JSON.stringify(pkg, null, 2));
  root.file("README.md", `# ${app.name}\n\nBuilt with U APP.\n\n## Install on a phone\n\n1. Host this folder on any HTTPS static host.\n2. Open it in Chrome on Android.\n3. Tap **Install app**. It opens full-screen with its own icon.\n\n## Use on your own website\n\nHost the folder and link to it, or embed the hosted URL in an \`<iframe>\`.\n\nSource: ${app.sourceLabel}\nPackage: ${app.packageId}\n`);
  root.file("permission.txt", app.permissions.map((p) => `android.permission.${permCode(p)}`).join("\n") + "\n");
  root.file("uapp-project.json", JSON.stringify({ id: app.id, name: app.name, package_id: app.packageId, version: app.version, type: app.type, source: app.sourceLabel, template: app.template, permissions: app.permissions }, null, 2));
  if (app.adsEnabled) {
    const network = NETWORKS.find((n) => n.name === app.adNetwork) ?? NETWORKS[0];
    const map: Record<string, AdTagFormat> = { "Banner": "banner", "Adaptive Banner": "banner", "MREC": "mrec", "Interstitial": "interstitial", "Rewarded": "rewarded", "Rewarded Interstitial": "rewarded", "App Open": "app-open", "Native": "native" };
    root.file("ads-tags.html", allAdTagsHtml(network.id, app.id, (app.adFormats.length ? app.adFormats : ["Banner"]).map((f) => map[f] ?? "banner")));
  }
  if (isUrl) root.file("embed-snippet.html", `<!-- Host this file to share your app, or paste the iframe on your site -->\n<iframe src="${escapeHtml(app.sourceLabel)}" style="width:100%;height:100vh;border:0" title="${escapeHtml(app.name)}"></iframe>\n`);

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  return { blob, filename: `${app.packageId}-installable-app.zip`, sizeMb: Math.round((blob.size / 1024 / 1024) * 10) / 10, ms: Math.round(performance.now() - started) };
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function saveInstallable(pkg: InstallableApp): void {
  saveBlob(pkg.blob, pkg.filename);
}

export function openInstallablePreview(app: AppRecord): void {
  const isUrl = app.sourceLabel.startsWith("http");
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(app.name)}</title>
<style>html,body{margin:0;height:100%;background:${app.splashColor}}iframe{width:100%;height:100%;border:0;background:#fff}.bar{position:fixed;bottom:0;left:0;right:0;display:flex;gap:6px;padding:8px;background:#0b0e13;border-top:1px solid rgba(255,255,255,.1)}.bar a,.bar button{flex:1;text-align:center;font:600 12px system-ui;color:#111605;background:${app.iconColor};padding:10px;border-radius:9px;text-decoration:none;border:0}.bar button{background:rgba(255,255,255,.08);color:#e8ecdf}</style></head>
<body><iframe src="${isUrl ? escapeHtml(app.sourceLabel) : "about:blank"}" allow="camera;microphone;geolocation;fullscreen"></iframe>
<div class="bar"><button onclick="history.back()">Back</button><a href="${isUrl ? escapeHtml(app.sourceLabel) : "#"}" target="_blank" rel="noreferrer">Open website</a><button onclick="location.reload()">Reload</button></div></body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  window.open(url, "_blank", "noopener");
  window.setTimeout(() => URL.revokeObjectURL(url), 120000);
}

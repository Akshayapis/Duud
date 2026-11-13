/**
 * U APP — production server (Render Docker).
 *
 * Static site host + authenticated build queue. The browser never receives
 * build-provider credentials, kernel URLs or other users' jobs.
 *
 * Storage: mount a persistent Render disk at DATA_DIR (default /var/uapp-data).
 * Sources are streamed to disk and served to the worker over a short-lived,
 * per-job signed URL, so notebook payload limits never truncate a project.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import Busboy from "busboy";
import yauzl from "yauzl";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { KaggleClient, KaggleError, normalizeKernelStatus } from "./kaggle.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8080);
const DATA_DIR = process.env.DATA_DIR || "/var/uapp-data";
const DIST = path.join(__dirname, "..", "dist");
const TTL = Math.max(60, Number(process.env.DOWNLOAD_TTL_SECONDS || 540));
const TIMEOUT_MIN = Math.max(5, Number(process.env.KAGGLE_TIMEOUT_MINUTES || 30));
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "";
const DB_URL = process.env.FIREBASE_DATABASE_URL || "";
const REQUIRE_AUTH = process.env.REQUIRE_AUTH !== "false";
const WORKER_SLUG = (process.env.KAGGLE_WORKER_SLUG || "uapp-android-build-worker").toLowerCase().replace(/[^a-z0-9-]/g, "-");
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const PUBLIC_UPI_ID = process.env.UPI_ID || "";
const PUBLIC_UPI_NAME = process.env.UPI_PAYEE_NAME || "";
const MAX_SOURCE_MB = Math.max(1, Number(process.env.MAX_SOURCE_MB || 150));
const MAX_ARTIFACT_MB = Math.max(1, Number(process.env.MAX_ARTIFACT_MB || 250));
const APP_TYPES = new Set(["website", "html", "cssjs", "php", "pwa", "android", "apk", "custom", "game", "webview", "advanced", "other"]);
const URL_TYPES = new Set(["website", "php", "pwa", "game", "webview"]);
const GRADLE_TYPES = new Set(["android", "custom", "apk"]);
const AD_FORMATS = new Set(["banner", "adaptive banner", "mrec", "interstitial", "rewarded", "rewarded interstitial", "app open"]);
const PERMISSIONS = new Set(["INTERNET", "ACCESS_NETWORK_STATE", "POST_NOTIFICATIONS", "CAMERA", "RECORD_AUDIO", "ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION", "BLUETOOTH_CONNECT", "NFC", "READ_MEDIA_IMAGES", "READ_CONTACTS", "READ_CALENDAR", "VIBRATE", "WAKE_LOCK", "FOREGROUND_SERVICE", "READ_EXTERNAL_STORAGE", "USE_BIOMETRIC"]);
const PERMISSION_ALIASES = { internet: "INTERNET", network: "ACCESS_NETWORK_STATE", notifications: "POST_NOTIFICATIONS", camera: "CAMERA", microphone: "RECORD_AUDIO", location: "ACCESS_FINE_LOCATION", bluetooth: "BLUETOOTH_CONNECT", nfc: "NFC", media: "READ_MEDIA_IMAGES", contacts: "READ_CONTACTS", calendar: "READ_CALENDAR", vibration: "VIBRATE", wakelock: "WAKE_LOCK", foreground: "FOREGROUND_SERVICE", storage: "READ_EXTERNAL_STORAGE", biometric: "USE_BIOMETRIC" };

/* ------------------------------------------------------------------ storage */
let DATA = DATA_DIR;
try {
  fs.mkdirSync(DATA, { recursive: true });
  fs.accessSync(DATA, fs.constants.W_OK);
} catch {
  DATA = path.join("/tmp", "uapp-data");
  fs.mkdirSync(DATA, { recursive: true });
  console.warn(`[storage] DATA_DIR ${DATA_DIR} is not writable; using ${DATA}. Mount a persistent Render disk at ${DATA_DIR} for restart-safe builds.`);
}
const SOURCES = path.join(DATA, "sources");
const ARTIFACTS = path.join(DATA, "artifacts");
const JOBS_FILE = path.join(DATA, "jobs.json");
const SETTINGS_FILE = path.join(DATA, "settings.json");
const PAYMENTS_FILE = path.join(DATA, "payments.json");
const PLANS_FILE = path.join(DATA, "plans.json");
for (const dir of [SOURCES, ARTIFACTS]) fs.mkdirSync(dir, { recursive: true });

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}
function atomicWrite(file, value) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

let jobs = readJson(JOBS_FILE, []);
if (!Array.isArray(jobs)) jobs = [];
let settings = readJson(SETTINGS_FILE, {});
let payments = readJson(PAYMENTS_FILE, []);
if (!Array.isArray(payments)) payments = [];
const planOverrides = readJson(PLANS_FILE, {});
const sourceIndex = readJson(path.join(SOURCES, "index.json"), {});

function persistJobs() {
  try { atomicWrite(JOBS_FILE, jobs.slice(0, 1000)); } catch (e) { console.error("[storage] job persist failed:", e.message); }
}
function persistSources() {
  try { atomicWrite(path.join(SOURCES, "index.json"), sourceIndex); } catch (e) { console.error("[storage] source index persist failed:", e.message); }
}
function persistSettings() {
  try { atomicWrite(SETTINGS_FILE, settings); } catch (e) { console.error("[storage] settings persist failed:", e.message); }
}
function persistPayments() {
  try { atomicWrite(PAYMENTS_FILE, payments.slice(0, 5000)); } catch (e) { console.error("[storage] payment persist failed:", e.message); }
}
function persistPlans() {
  try { atomicWrite(PLANS_FILE, planOverrides); } catch (e) { console.error("[storage] plan persist failed:", e.message); }
}
function save(job) {
  const i = jobs.findIndex((j) => j.id === job.id);
  if (i >= 0) jobs[i] = job; else jobs.unshift(job);
  persistJobs();
}
const findJob = (id) => jobs.find((j) => j.id === id);
function log(job, line) {
  const stamp = new Date().toISOString().slice(11, 19);
  job.logs = [...(job.logs || []), `${stamp} ${String(line).slice(0, 500)}`].slice(-200);
  job.updatedAt = new Date().toISOString();
  save(job);
}

/* ------------------------------------------------------------------ auth */
let adminApp = null;
try {
  if (PROJECT_ID) {
    // Token verification only needs the project ID (public signing keys).
    // A service account is optional and only used for future admin writes.
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    adminApp = getApps()[0] || initializeApp({
      credential: serviceAccount ? cert(JSON.parse(serviceAccount)) : undefined,
      projectId: PROJECT_ID,
      databaseURL: DB_URL || undefined,
    });
  }
} catch (e) {
  console.error("[auth] Firebase Admin init failed:", e.message);
}

async function verifyIdToken(token) {
  if (!adminApp) throw Object.assign(new Error("Authentication is not configured on the server."), { status: 503, code: "AUTH_NOT_CONFIGURED" });
  try {
    const decoded = await getAuth(adminApp).verifyIdToken(token, false);
    return { uid: decoded.uid, email: decoded.email || "", emailVerified: Boolean(decoded.email_verified), name: decoded.name || "" };
  } catch {
    throw Object.assign(new Error("Your session expired or is invalid. Sign in again."), { status: 401, code: "AUTH_REQUIRED" });
  }
}
async function requireUser(req) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) throw Object.assign(new Error("Sign in to continue."), { status: 401, code: "AUTH_REQUIRED" });
  return verifyIdToken(token);
}
function requireAdmin(req) {
  if (!ADMIN_TOKEN || ADMIN_TOKEN.length < 24) throw Object.assign(new Error("Admin API is disabled. Set a strong ADMIN_TOKEN on the server."), { status: 503, code: "ADMIN_NOT_CONFIGURED" });
  const token = req.headers["x-admin-token"] || req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const a = Buffer.from(String(token || ""));
  const b = Buffer.from(ADMIN_TOKEN);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw Object.assign(new Error("Admin token required."), { status: 401, code: "ADMIN_REQUIRED" });
}

const PLAN_LIMITS = { free: 3, creator: 15, studio: 50, scale: 250 };
const PLAN_DAYS = { creator: 30, studio: 90, scale: 180 };

/** Plan overrides written by the admin payment API are authoritative. */
async function resolvePlan(uid, idToken) {
  const override = planOverrides[uid];
  if (override && override.planId && override.planId !== "free") {
    const expired = override.planExpiresAt ? new Date(override.planExpiresAt).getTime() <= Date.now() : false;
    if (!expired) return override;
  }
  if (!DB_URL || !idToken) return { planId: "free" };
  try {
    const base = DB_URL.replace(/\/$/, "");
    const res = await fetch(`${base}/users/${encodeURIComponent(uid)}/profile.json?auth=${encodeURIComponent(idToken)}`, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return { planId: "free" };
    const p = (await res.json()) || {};
    const rawPlan = p.planId || "free";
    const expired = p.planExpiresAt ? new Date(p.planExpiresAt).getTime() <= Date.now() : rawPlan !== "free";
    if (rawPlan !== "free" && !expired && PLAN_LIMITS[rawPlan]) {
      return { planId: rawPlan, planActivatedAt: p.planActivatedAt || null, planExpiresAt: p.planExpiresAt || null };
    }
  } catch { /* fall through to free */ }
  return { planId: "free" };
}

function quotaWindow(plan) {
  const now = new Date();
  if (plan.planId === "free") {
    const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
    const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
    return { start, end };
  }
  const start = plan.planActivatedAt ? new Date(plan.planActivatedAt).getTime() : 0;
  const end = plan.planExpiresAt ? new Date(plan.planExpiresAt).getTime() : Infinity;
  return { start, end };
}

/**
 * Server-side quota. Counts distinct app IDs accepted by THIS server in the
 * current period (rebuilds of the same app are free). Fails closed: a database
 * outage never grants unlimited builds, and client-writable project metadata
 * is never trusted for the count.
 */
async function enforceQuota(uid, idToken, appId) {
  const plan = await resolvePlan(uid, idToken);
  const limit = PLAN_LIMITS[plan.planId] ?? 3;
  const { start, end } = quotaWindow(plan);
  const apps = new Set();
  for (const j of jobs) {
    if (j.uid !== uid || !j.appId) continue;
    const t = new Date(j.createdAt).getTime();
    if (Number.isNaN(t) || t < start || t >= end) continue;
    apps.add(j.appId);
  }
  const isRebuild = appId ? apps.has(appId) : false;
  if (!isRebuild && apps.size >= limit) {
    throw Object.assign(new Error("Your app allowance for this period has been reached. Upgrade or wait for the reset."), { status: 402, code: "QUOTA_EXCEEDED" });
  }
  return { plan: plan.planId, count: apps.size, limit, remaining: Math.max(0, limit - apps.size), isRebuild, periodStart: start, periodEnd: Number.isFinite(end) ? end : null };
}

/* ------------------------------------------------------------------ helpers */
function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}
function httpError(message, status, code) { return Object.assign(new Error(message), { status, code }); }
const slugify = (v) => String(v).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "app";
const UPLOAD_SECRET = process.env.BUILD_UPLOAD_SECRET || crypto.randomBytes(32).toString("hex");
if (!process.env.BUILD_UPLOAD_SECRET) console.warn("[security] BUILD_UPLOAD_SECRET is not set; worker upload/source tokens rotate on restart. Set it in Render env.");
const jobToken = (jobId, purpose) => crypto.createHmac("sha256", UPLOAD_SECRET).update(`${purpose}:${jobId}`).digest("hex");
function safeEqual(a, b) {
  const x = Buffer.from(String(a || "")); const y = Buffer.from(String(b || ""));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function readBody(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) { reject(httpError("Payload too large", 413, "PAYLOAD_TOO_LARGE")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
async function parseJson(req, limit) {
  const raw = await readBody(req, limit);
  try { return JSON.parse(raw.toString("utf8") || "{}"); } catch { throw httpError("Invalid JSON body", 400, "INVALID_JSON"); }
}
function publicOrigin(req) {
  const configured = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || "";
  if (configured) return configured.replace(/\/$/, "");
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  return `${proto}://${host}`;
}

/** Stream multipart uploads to disk with hard size limits (no full-buffer parsing). */
function receiveUpload(req, destDir, { maxBytes, allow }) {
  return new Promise((resolve, reject) => {
    let bb;
    try {
      bb = Busboy({ headers: req.headers, limits: { fileSize: maxBytes, files: 20, fields: 10, fieldSize: 64_000 } });
    } catch (e) { reject(httpError("Expected multipart/form-data upload", 400, "INVALID_UPLOAD")); return; }
    fs.mkdirSync(destDir, { recursive: true });
    const files = []; const fields = {}; const writes = [];
    let failed = false;
    const fail = (err) => { if (!failed) { failed = true; req.unpipe(bb); req.destroy(); reject(err); } };
    bb.on("field", (name, value) => { fields[name] = value; });
    bb.on("file", (name, stream, info) => {
      const original = path.basename(info.filename || "");
      if (!original || (allow && !allow(original))) { stream.resume(); fail(httpError(`File type not allowed: ${original || name}`, 400, "FILE_NOT_ALLOWED")); return; }
      const stored = `${crypto.randomBytes(6).toString("hex")}-${original.replace(/[^A-Za-z0-9._-]/g, "_")}`;
      const target = path.join(destDir, stored);
      const record = { field: name, name: original, file: stored, size: 0, truncated: false };
      files.push(record);
      stream.on("data", (c) => { record.size += c.length; });
      stream.on("limit", () => { record.truncated = true; fail(httpError(`Upload exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit`, 413, "FILE_TOO_LARGE")); });
      const ws = fs.createWriteStream(target, { mode: 0o600 });
      writes.push(pipeline(stream, ws).catch((e) => { if (!failed) fail(e); }));
    });
    bb.on("error", fail);
    bb.on("close", async () => {
      await Promise.all(writes);
      if (failed) return;
      resolve({ files, fields });
    });
    req.pipe(bb);
  });
}

/** Validate a ZIP without extracting: traversal, symlinks, entry count, expansion ratio. */
function validateZip(file, maxEntries = 20_000) {
  return new Promise((resolve, reject) => {
    yauzl.open(file, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(httpError("Upload is not a readable ZIP archive", 400, "INVALID_ZIP"));
      let entries = 0; let total = 0; let hasGradle = false; let hasIndex = false;
      const compressed = fs.statSync(file).size;
      zip.on("entry", (entry) => {
        entries += 1;
        const name = entry.fileName;
        const mode = (entry.externalFileAttributes >>> 16) & 0o170000;
        if (entries > maxEntries || name.length > 512 || name.startsWith("/") || name.includes("\\") || name.split("/").includes("..") || mode === 0o120000) {
          zip.close(); return reject(httpError("Archive contains unsafe entries (path traversal, symlink or too many files)", 400, "UNSAFE_ZIP"));
        }
        total += entry.uncompressedSize;
        if (total > Math.max(compressed * 100, 512 * 1024 * 1024)) { zip.close(); return reject(httpError("Archive expands too much (possible zip bomb)", 400, "UNSAFE_ZIP")); }
        if (/(^|\/)settings\.gradle(\.kts)?$/.test(name)) hasGradle = true;
        if (/(^|\/)index\.html?$/.test(name)) hasIndex = true;
        zip.readEntry();
      });
      zip.on("end", () => resolve({ entries, total, hasGradle, hasIndex }));
      zip.on("error", () => reject(httpError("Could not read ZIP archive", 400, "INVALID_ZIP")));
      zip.readEntry();
    });
  });
}

function normalizePermissions(input) {
  const out = new Set(["INTERNET", "ACCESS_NETWORK_STATE"]);
  for (const p of Array.isArray(input) ? input : []) {
    const key = String(p).trim();
    const name = PERMISSION_ALIASES[key.toLowerCase()] || key.toUpperCase().replace(/^ANDROID\.PERMISSION\./, "");
    if (PERMISSIONS.has(name)) out.add(name);
  }
  return [...out];
}
const TEST_AD_APP_ID = "ca-app-pub-3940256099942544~3347511713";
const TEST_AD_UNITS = {
  "banner": "ca-app-pub-3940256099942544/9214589741",
  "adaptive banner": "ca-app-pub-3940256099942544/9214589741",
  "mrec": "ca-app-pub-3940256099942544/6300978111",
  "interstitial": "ca-app-pub-3940256099942544/1033173712",
  "rewarded": "ca-app-pub-3940256099942544/5224354917",
  "rewarded interstitial": "ca-app-pub-3940256099942544/5354046379",
  "app open": "ca-app-pub-3940256099942544/9257395921",
};
function normalizeAds(input) {
  if (!input) return null;
  const network = String(input.network || "admob").toLowerCase();
  if (network !== "admob" && network !== "google admob") throw httpError("Only Google AdMob is compiled into builds. Other networks are not silently faked.", 400, "UNSUPPORTED_AD_NETWORK");
  const requested = [...new Set((Array.isArray(input.formats) ? input.formats : []).map((f) => String(f).toLowerCase().trim()).filter(Boolean))];
  if (!requested.length) throw httpError("Select at least one supported ad format", 400, "INVALID_ADS");
  const unsupported = requested.filter((f) => !AD_FORMATS.has(f));
  if (unsupported.length) throw httpError(`Unsupported ad format(s): ${unsupported.join(", ")}. Native ads are not compiled into builds.`, 400, "UNSUPPORTED_AD_FORMAT");
  const formats = requested;
  const testMode = Boolean(input.testMode);
  const timingSeconds = Math.min(300, Math.max(10, Number(input.timingSeconds) || 60));
  if (testMode) {
    const units = {};
    for (const f of formats) units[f] = TEST_AD_UNITS[f] || TEST_AD_UNITS.banner;
    return { network: "admob", appId: TEST_AD_APP_ID, formats, units, timingSeconds, testMode: true };
  }
  const appId = String(input.appId || "").trim();
  if (!/^ca-app-pub-\d{16}~\d{10}$/.test(appId) || appId === TEST_AD_APP_ID) throw httpError("A real AdMob App ID is required for live ads (ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY). Use test mode for test inventory.", 400, "INVALID_AD_APP_ID");
  const units = {};
  for (const f of formats) {
    const unit = String(input.units?.[f] || "").trim();
    if (!/^ca-app-pub-\d{16}\/\d{10}$/.test(unit) || Object.values(TEST_AD_UNITS).includes(unit)) throw httpError(`A real AdMob ad unit ID is required for ${f}. Use test mode for test inventory.`, 400, "INVALID_AD_UNIT_ID");
    units[f] = unit;
  }
  return { network: "admob", appId, formats, units, timingSeconds, testMode: false };
}
function validateApp(app) {
  if (!app?.id || !/^[A-Za-z0-9-]{4,64}$/.test(app.id)) throw httpError("Valid app id is required", 400, "INVALID_APP");
  if (!app?.name || String(app.name).trim().length < 2 || String(app.name).length > 80) throw httpError("App name must be 2–80 characters", 400, "INVALID_APP");
  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(app.packageId || "") || app.packageId.length > 120) throw httpError("Invalid Android package ID", 400, "INVALID_PACKAGE");
  const type = String(app.type || "website").toLowerCase();
  if (!APP_TYPES.has(type)) throw httpError("Unsupported app type", 400, "INVALID_APP_TYPE");
  if (!/^\d+\.\d+\.\d+$/.test(app.version || "1.0.0")) throw httpError("Version must look like 1.0.0", 400, "INVALID_VERSION");
  const splash = /^#[0-9a-fA-F]{6}$/.test(app.splash || "") ? app.splash : "#080a0d";
  return { id: app.id, name: String(app.name).trim(), packageId: app.packageId, type, version: app.version || "1.0.0", splash, permissions: normalizePermissions(app.permissions) };
}
function validateSource(app, source) {
  if (URL_TYPES.has(app.type) || app.type === "advanced" || app.type === "other") {
    if (source?.kind === "url") {
      let url;
      try { url = new URL(source.url); } catch { throw httpError("A valid HTTPS source URL is required", 400, "INVALID_SOURCE"); }
      if (url.protocol !== "https:" || url.username || url.password) throw httpError("Source URL must be HTTPS without embedded credentials", 400, "INVALID_SOURCE");
      const host = url.hostname.toLowerCase();
      if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || host === "0.0.0.0" || host === "[::1]") throw httpError("Private/internal source URLs are not allowed", 400, "INVALID_SOURCE");
      return { kind: "url", url: url.toString() };
    }
  }
  if (source?.kind === "zip" && source.sourceId) return { kind: "zip", sourceId: String(source.sourceId) };
  if (GRADLE_TYPES.has(app.type) || app.type === "apk") throw httpError("This app type requires an uploaded project ZIP", 400, "SOURCE_REQUIRED");
  throw httpError("A source URL or preserved ZIP is required. Placeholder sources are never accepted.", 400, "SOURCE_REQUIRED");
}

/* ------------------------------------------------------------------ worker notebook */
function workerNotebookTemplate() {
  const file = path.join(__dirname, "..", "kaggle", "worker", "worker.ipynb");
  if (!fs.existsSync(file)) throw new Error("kaggle/worker/worker.ipynb is missing from this deployment.");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function workerTemplates() {
  const dir = path.join(__dirname, "..", "kaggle", "worker", "templates");
  const out = {};
  for (const name of fs.readdirSync(dir)) out[name] = fs.readFileSync(path.join(dir, name), "utf8");
  return out;
}
function workerCode(job) {
  const base = workerNotebookTemplate();
  // Replace the placeholder JOB cell in-place; never shift/overwrite the build cell.
  const cells = base.cells.map((cell) => {
    const src = Array.isArray(cell.source) ? cell.source.join("") : String(cell.source || "");
    if (cell.cell_type === "code" && /JOB\s*=\s*None/.test(src) && /UAPP_JOB_PAYLOAD/.test(src)) {
      return { ...cell, execution_count: null, outputs: [], source: `# UAPP_JOB_PAYLOAD\nimport base64, json\nJOB = json.loads(base64.b64decode(${JSON.stringify(Buffer.from(JSON.stringify(job.workerJob)).toString("base64"))}).decode())\n` };
    }
    return cell;
  });
  if (!cells.some((c) => String(Array.isArray(c.source) ? c.source.join("") : c.source).includes("UAPP_JOB_PAYLOAD"))) throw new Error("Worker notebook is missing the UAPP_JOB_PAYLOAD cell.");
  return JSON.stringify({ ...base, cells });
}

/* ------------------------------------------------------------------ engine */
const kaggle = KaggleClient.fromEnv();
const engineState = { at: 0, status: kaggle ? "checking" : "not-configured" };
let probePromise = null;
function probeEngine() {
  if (!kaggle || probePromise) return;
  if (engineState.at && Date.now() - engineState.at < 10 * 60_000) return;
  probePromise = kaggle.verifyCredentials()
    .then(() => { engineState.status = "verified"; })
    .catch((e) => { engineState.status = e.status === 401 || e.status === 403 ? "rejected" : "unreachable"; })
    .finally(() => { engineState.at = Date.now(); probePromise = null; });
}
function buildEnabled() { return Boolean(kaggle) && engineState.status === "verified"; }

const quotaLocks = new Map();
async function withQuotaLock(uid, fn) {
  const prev = quotaLocks.get(uid) || Promise.resolve();
  let release;
  const gate = new Promise((r) => { release = r; });
  const chain = prev.then(() => gate);
  quotaLocks.set(uid, chain);
  await prev;
  try { return await fn(); }
  finally {
    release();
    if (quotaLocks.get(uid) === chain) quotaLocks.delete(uid);
  }
}

let activeJobId = null;
function nextQueued() { return [...jobs].reverse().find((j) => j.status === "queued"); }

async function startJob(job) {
  activeJobId = job.id;
  job.status = "running"; job.startedAt = new Date().toISOString(); save(job);
  try {
    log(job, "Preparing isolated Android build…");
    const slugBase = `${WORKER_SLUG}-${job.id.toLowerCase()}`.replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 50);
    const kernel = await kaggle.pushKernel(slugBase, { notebook: workerCode(job), timeoutSeconds: TIMEOUT_MIN * 60 });
    job.kernelRef = kernel.ref; job.kernelVersion = kernel.version; save(job);
    log(job, "Build runner started.");
    await pollKernel(job);
  } catch (e) {
    job.status = "failed";
    job.error = e instanceof KaggleError ? `Build engine error: ${e.message}` : (e.message || "Build failed");
    log(job, job.error);
  } finally {
    activeJobId = null;
    save(job);
    setImmediate(tick);
  }
}

async function pollKernel(job) {
  const deadline = Date.now() + TIMEOUT_MIN * 60_000;
  let delay = 12_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay + 4000, 30_000);
    if (job.status === "cancelled") return;
    const [owner, slug] = String(job.kernelRef).split("/");
    let raw;
    try { raw = await kaggle.kernelStatus(owner, slug); }
    catch (e) { log(job, "Runner status check failed; retrying…"); continue; }
    const status = normalizeKernelStatus(raw);
    job.kernelStatus = status; save(job);
    if (status === "complete") { await collectArtifacts(job); return; }
    if (status === "error" || status === "cancelled") {
      job.status = status === "cancelled" ? "cancelled" : "failed";
      job.error = raw?.failureMessage ? String(raw.failureMessage).slice(0, 400) : `Build runner ${status}. See build log for details.`;
      await collectLogsOnly(job);
      log(job, job.error);
      return;
    }
  }
  job.status = "timeout";
  job.error = `Build exceeded the ${TIMEOUT_MIN}-minute execution limit. Retry from the preserved source.`;
  log(job, job.error);
}

async function collectLogsOnly(job) {
  try {
    const [owner, slug] = String(job.kernelRef).split("/");
    const listing = await kaggle.kernelOutput(owner, slug, job.kernelVersion ?? undefined);
    if (listing.log) {
      const lines = listing.log.split(/\r?\n/).filter(Boolean).slice(-60);
      job.logs = [...(job.logs || []), ...lines.map((l) => l.slice(0, 500))].slice(-200);
    }
  } catch { /* logs are best-effort */ }
}

async function collectArtifacts(job) {
  log(job, "Build finished. Collecting artifacts…");
  const dir = path.join(ARTIFACTS, job.id);
  fs.mkdirSync(dir, { recursive: true });
  // Prefer artifacts the worker already streamed back; fall back to kernel output.
  const existing = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  if (!existing.some((f) => /\.(apk|aab)$/i.test(f))) {
    try {
      const [owner, slug] = String(job.kernelRef).split("/");
      const listing = await kaggle.kernelOutput(owner, slug, job.kernelVersion ?? undefined);
      for (const file of listing.files) {
        const name = path.basename(file.name);
        if (!/\.(apk|aab|log|txt|json)$/i.test(name)) continue;
        try {
          const buffer = await kaggle.downloadOutputFile(file);
          fs.writeFileSync(path.join(dir, name), buffer);
          log(job, `Artifact retrieved · ${name} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
        } catch (e) { log(job, `Could not fetch ${name}: ${e.message}`); }
      }
      if (listing.log) fs.writeFileSync(path.join(dir, "build.log"), listing.log);
    } catch (e) { log(job, `Could not list runner output: ${e.message}`); }
  }
  const files = fs.readdirSync(dir);
  const binaries = files.filter((f) => /\.(apk|aab)$/i.test(f));
  if (!binaries.length) {
    job.status = "failed";
    job.error = "Build completed but produced no APK/AAB. Check the build log for the Gradle error.";
    await collectLogsOnly(job);
    return;
  }
  // Verify ZIP magic for APK/AAB and record checksums.
  job.artifacts = [];
  for (const f of binaries) {
    const full = path.join(dir, f);
    const fd = fs.openSync(full, "r"); const magic = Buffer.alloc(4); fs.readSync(fd, magic, 0, 4, 0); fs.closeSync(fd);
    if (magic.subarray(0, 2).toString() !== "PK") { log(job, `Rejected invalid artifact ${f}`); continue; }
    const size = fs.statSync(full).size;
    const sha256 = await new Promise((resolve, reject) => {
      const h = crypto.createHash("sha256");
      fs.createReadStream(full).on("data", (c) => h.update(c)).on("end", () => resolve(h.digest("hex"))).on("error", reject);
    });
    job.artifacts.push({ name: f, file: f, size, sha256 });
  }
  if (!job.artifacts.length) { job.status = "failed"; job.error = "No valid APK/AAB artifact survived validation."; return; }
  const logFile = files.find((f) => /build\.log$/i.test(f));
  if (logFile) {
    const lines = fs.readFileSync(path.join(dir, logFile), "utf8").split(/\r?\n/).filter(Boolean).slice(-60);
    job.logs = [...(job.logs || []), ...lines.map((l) => l.slice(0, 500))].slice(-200);
  }
  job.status = "ready";
  job.completedAt = new Date().toISOString();
  job.expiresAt = Date.now() + TTL * 1000;
  job.workerJob = null;
  log(job, `Build ready · ${job.artifacts.length} artifact(s) · download window ${TTL}s`);
  setTimeout(() => cleanupJob(job.id), TTL * 1000 + 5000).unref?.();
  // Best-effort private kernel cleanup; artifacts are already on the server.
  try { const [owner, slug] = String(job.kernelRef).split("/"); await kaggle.deleteKernel(owner, slug); } catch { /* keep going */ }
}

function cleanupJob(jobId) {
  const job = findJob(jobId);
  const dir = path.join(ARTIFACTS, jobId);
  try { if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  if (job && job.status === "ready") { job.status = "expired"; job.artifacts = []; save(job); }
}
function tick() {
  if (activeJobId) return;
  const job = nextQueued();
  if (!job) return;
  if (!buildEnabled()) {
    if (!kaggle) { job.status = "failed"; job.error = "Build engine is not configured on the server."; log(job, job.error); save(job); }
    return;
  }
  void startJob(job);
}
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
let workerTimer = null;
if (isMain) {
  workerTimer = setInterval(tick, 5000);
  workerTimer.unref?.();
}

/* ------------------------------------------------------------------ restart recovery */
if (isMain) {
  for (const job of jobs) {
    if (job.status === "ready" && job.expiresAt && Date.now() > job.expiresAt) {
      job.status = "expired"; job.artifacts = [];
      try { fs.rmSync(path.join(ARTIFACTS, job.id), { recursive: true, force: true }); } catch { /* ignore */ }
    }
    if (job.status === "running") {
      if (job.kernelRef && kaggle) {
        log(job, "Server restarted; reconnecting to the running build…");
        void pollKernel(job).catch((e) => { job.status = "failed"; job.error = e.message; save(job); }).finally(() => { activeJobId = null; setImmediate(tick); });
        activeJobId = job.id;
      } else {
        job.status = "failed";
        job.error = "Server restarted before the build runner started. Rebuild from the preserved source.";
        save(job);
      }
    }
  }
  persistJobs();

}

/* ------------------------------------------------------------------ public views */
function publicJob(job) {
  return {
    id: job.id, appId: job.appId, status: job.status,
    createdAt: job.createdAt, startedAt: job.startedAt ?? null, completedAt: job.completedAt ?? null,
    expiresAt: job.expiresAt ?? null, error: job.error ?? null,
    queuePosition: job.status === "queued" ? [...jobs].reverse().filter((j) => j.status === "queued").findIndex((j) => j.id === job.id) + 1 : 0,
    artifacts: (job.artifacts || []).map((a) => ({ name: a.name, size: a.size, sha256: a.sha256, url: `/api/build/${job.id}/artifact/${encodeURIComponent(a.name)}` })),
    logs: job.logs || [],
  };
}
async function authorizeJob(req, job) {
  if (!REQUIRE_AUTH) return null;
  const user = await requireUser(req);
  if (job.uid && user.uid !== job.uid) throw httpError("You do not own this build.", 403, "FORBIDDEN");
  return user;
}

/* ------------------------------------------------------------------ API */
const server = http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url || "/", "http://localhost"); } catch { return json(res, 400, { ok: false, error: "Bad request" }); }
  const route = url.pathname;
  try {
    if (route === "/api/health") {
      probeEngine();
      return json(res, 200, {
        ok: true, service: "uapp-build", version: "3.0.0",
        buildEnabled: buildEnabled(),
        engineStatus: !kaggle ? "not-configured" : engineState.status,
        queue: jobs.filter((j) => j.status === "queued").length,
        active: Boolean(activeJobId),
        timeoutMinutes: TIMEOUT_MIN, downloadTtlSeconds: TTL, authRequired: REQUIRE_AUTH,
      });
    }

    if (route === "/api/account" && req.method === "GET") {
      const user = REQUIRE_AUTH ? await requireUser(req) : null;
      if (!user) return json(res, 200, { ok: true, plan: { planId: "free" }, quota: null });
      const token = req.headers.authorization.replace(/^Bearer\s+/i, "");
      const plan = await resolvePlan(user.uid, token);
      const limit = PLAN_LIMITS[plan.planId] ?? 3;
      const { start, end } = quotaWindow(plan);
      const apps = new Set(jobs.filter((j) => j.uid === user.uid && j.appId && new Date(j.createdAt).getTime() >= start && new Date(j.createdAt).getTime() < end).map((j) => j.appId));
      return json(res, 200, { ok: true, plan, quota: { used: apps.size, limit, remaining: Math.max(0, limit - apps.size), periodStart: start, periodEnd: Number.isFinite(end) ? end : null } });
    }

    if (route === "/api/payments" && req.method === "POST") {
      const user = REQUIRE_AUTH ? await requireUser(req) : null;
      if (!user) throw httpError("Sign in to submit a payment request.", 401, "AUTH_REQUIRED");
      const body = await parseJson(req);
      const planId = String(body.planId || "");
      if (!PLAN_DAYS[planId]) throw httpError("Choose a paid plan.", 400, "INVALID_PLAN");
      const utr = String(body.utr || "").replace(/\s+/g, "");
      if (!/^[A-Za-z0-9]{8,22}$/.test(utr)) throw httpError("Enter the UTR / UPI reference number (8–22 letters or digits).", 400, "INVALID_UTR");
      if (payments.some((p) => p.utr === utr && p.status !== "rejected")) throw httpError("This UTR was already submitted.", 409, "UTR_EXISTS");
      const id = `PAY-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
      const payment = { id, orderId: `ORD-${id.slice(4)}`, uid: user.uid, email: user.email, planId, method: String(body.method || "UPI").slice(0, 40), utr, status: "pending", createdAt: new Date().toISOString() };
      payments.unshift(payment); persistPayments();
      return json(res, 201, { ok: true, payment });
    }
    if (route === "/api/payments" && req.method === "GET") {
      const user = REQUIRE_AUTH ? await requireUser(req) : null;
      if (!user) throw httpError("Sign in to view payments.", 401, "AUTH_REQUIRED");
      return json(res, 200, { ok: true, payments: payments.filter((p) => p.uid === user.uid).slice(0, 100) });
    }
    if (route === "/api/admin/payments" && req.method === "GET") {
      requireAdmin(req);
      return json(res, 200, { ok: true, payments: payments.slice(0, 500) });
    }
    const paymentDecision = route.match(/^\/api\/admin\/payments\/([A-Za-z0-9-]+)\/(approve|reject)$/);
    if (paymentDecision && req.method === "POST") {
      requireAdmin(req);
      const payment = payments.find((p) => p.id === paymentDecision[1]);
      if (!payment) throw httpError("Payment not found", 404, "NOT_FOUND");
      if (payment.status !== "pending") throw httpError(`Payment is already ${payment.status}.`, 409, "ALREADY_DECIDED");
      const body = await parseJson(req).catch(() => ({}));
      if (paymentDecision[2] === "approve") {
        const days = Math.max(1, Math.min(365, Number(body.days) || PLAN_DAYS[payment.planId] || 30));
        const now = Date.now();
        planOverrides[payment.uid] = { planId: payment.planId, planActivatedAt: new Date(now).toISOString(), planExpiresAt: new Date(now + days * 86400000).toISOString(), paymentId: payment.id };
        persistPlans();
        payment.status = "active"; payment.approvedAt = new Date().toISOString(); payment.days = days;
      } else {
        payment.status = "rejected"; payment.rejectedAt = new Date().toISOString(); payment.rejectionReason = String(body.reason || "UTR could not be verified.").slice(0, 300);
      }
      persistPayments();
      return json(res, 200, { ok: true, payment });
    }

    if (route === "/api/settings/public" && req.method === "GET") {
      const upi = settings.upiId && settings.upiName ? { upiId: settings.upiId, payeeName: settings.upiName }
        : PUBLIC_UPI_ID && PUBLIC_UPI_NAME ? { upiId: PUBLIC_UPI_ID, payeeName: PUBLIC_UPI_NAME } : null;
      return json(res, 200, { ok: true, upi });
    }
    if (route === "/api/settings/payment" && req.method === "PUT") {
      requireAdmin(req);
      const body = await parseJson(req);
      if (!/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(body.upiId || "")) throw httpError("Invalid UPI ID", 400, "INVALID_UPI");
      if (String(body.payeeName || "").trim().length < 2) throw httpError("Payee name is required", 400, "INVALID_UPI");
      settings.upiId = body.upiId.trim(); settings.upiName = body.payeeName.trim(); settings.updatedAt = new Date().toISOString();
      persistSettings();
      return json(res, 200, { ok: true, upi: { upiId: settings.upiId, payeeName: settings.upiName } });
    }

    if (route === "/api/source" && req.method === "POST") {
      const user = REQUIRE_AUTH ? await requireUser(req) : null;
      const dest = fs.mkdtempSync(path.join(SOURCES, "upload-"));
      let received;
      try { received = await receiveUpload(req, dest, { maxBytes: MAX_SOURCE_MB * 1024 * 1024, allow: (n) => /\.zip$/i.test(n) }); }
      catch (e) { fs.rmSync(dest, { recursive: true, force: true }); throw e; }
      const file = received.files.find((f) => f.field === "file");
      if (!file) { fs.rmSync(dest, { recursive: true, force: true }); throw httpError("ZIP file is required", 400, "SOURCE_REQUIRED"); }
      const full = path.join(dest, file.file);
      const report = await validateZip(full).catch((e) => { fs.rmSync(dest, { recursive: true, force: true }); throw e; });
      const sourceId = `src-${crypto.randomBytes(10).toString("hex")}`;
      const stored = path.join(SOURCES, `${sourceId}.zip`);
      fs.renameSync(full, stored); fs.rmSync(dest, { recursive: true, force: true });
      sourceIndex[sourceId] = { uid: user?.uid ?? null, appId: String(received.fields.appId || "").slice(0, 64), size: file.size, entries: report.entries, hasGradle: report.hasGradle, hasIndex: report.hasIndex, createdAt: new Date().toISOString() };
      persistSources();
      return json(res, 200, { ok: true, sourceId, size: file.size, hasGradle: report.hasGradle, hasIndex: report.hasIndex });
    }

    if (route === "/api/build" && req.method === "POST") {
      const user = REQUIRE_AUTH ? await requireUser(req) : null;
      if (REQUIRE_AUTH && user && !user.emailVerified) throw httpError("Verify your email before building apps.", 403, "EMAIL_NOT_VERIFIED");
      const body = await parseJson(req, 2_000_000);
      const app = validateApp(body.app || body);
      const source = validateSource(app, body.source || (body.sourceId ? { kind: "zip", sourceId: body.sourceId } : app.source ? { kind: "url", url: app.source } : null));
      const ads = normalizeAds(body.ads ?? body.app?.ads ?? null);
      if (source.kind === "zip") {
        const meta = sourceIndex[source.sourceId];
        if (!meta || !fs.existsSync(path.join(SOURCES, `${source.sourceId}.zip`))) throw httpError("Preserved source not found. Upload the ZIP again.", 409, "SOURCE_MISSING");
        if (REQUIRE_AUTH && meta.uid && meta.uid !== user.uid) throw httpError("You do not own this source upload.", 403, "FORBIDDEN");
        if (GRADLE_TYPES.has(app.type) && !meta.hasGradle) throw httpError("Android project ZIP must contain settings.gradle(.kts).", 400, "INVALID_ANDROID_PROJECT");
        if (!GRADLE_TYPES.has(app.type) && app.type !== "apk" && !meta.hasGradle && !meta.hasIndex) throw httpError("Web/HTML ZIP must contain index.html (or a Gradle project).", 400, "INVALID_WEB_PROJECT");
      }
      const existing = jobs.find((j) => j.appId === app.id && (!user || j.uid === user.uid) && ["queued", "running"].includes(j.status));
      if (existing) return json(res, 409, { ok: false, code: "BUILD_IN_PROGRESS", error: "A build for this app is already queued or running.", job: publicJob(existing) });
      if (!buildEnabled()) throw httpError("Build engine is unavailable right now. Your source is preserved; retry shortly.", 503, "BUILD_NOT_READY");
      const token = req.headers.authorization.replace(/^Bearer\s+/i, "");
      const jobId = `BLD-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
      const origin = publicOrigin(req);
      if (REQUIRE_AUTH && !process.env.APP_URL && !process.env.RENDER_EXTERNAL_URL) {
        throw httpError("Server public URL is not configured. Set APP_URL so the build worker can fetch source and upload artifacts safely.", 503, "SERVER_URL_NOT_CONFIGURED");
      }
      const uploadToken = jobToken(jobId, "upload");
      const sourceToken = jobToken(jobId, "source");
      const workerJob = {
        jobId, appId: app.id, name: app.name, packageId: app.packageId, version: app.version,
        type: app.type, source, splash: app.splash, permissions: app.permissions, ads,
        sourceUrl: source.kind === "zip" ? `${origin}/api/build/${jobId}/source?token=${sourceToken}` : null,
        uploadUrl: `${origin}/api/build/${jobId}/upload`, uploadToken,
        templates: workerTemplates(),
        buildTools: { agp: "8.13.0", compileSdk: 36, targetSdk: 36, minSdk: 24, gradle: "8.13", adsSdk: "1.6.0", umpSdk: "4.0.0" },
      };
      const job = {
        id: jobId, appId: app.id, uid: user?.uid ?? null, status: "queued",
        createdAt: new Date().toISOString(), source, workerJob,
        logs: [`${new Date().toISOString().slice(11, 19)} Build request accepted`, `${new Date().toISOString().slice(11, 19)} Queued for the Android build runner`],
      };
      const quota = REQUIRE_AUTH
        ? await withQuotaLock(user.uid, async () => {
            const q = await enforceQuota(user.uid, token, app.id);
            if (ads && !ads.testMode && q.plan === "free") throw httpError("Live ads require a paid plan. Test-mode ads are available on every plan.", 402, "PLAN_REQUIRED");
            save(job);
            return q;
          })
        : (save(job), { plan: "free" });
      void quota;
      setImmediate(tick);
      return json(res, 202, { ok: true, job: publicJob(job), queuePosition: jobs.filter((j) => j.status === "queued").length });
    }

    const sourceMatch = route.match(/^\/api\/build\/([A-Za-z0-9-]+)\/source$/);
    if (sourceMatch && req.method === "GET") {
      const job = findJob(sourceMatch[1]);
      if (!job) throw httpError("Build job not found", 404, "NOT_FOUND");
      const token = url.searchParams.get("token") || "";
      if (!safeEqual(token, jobToken(job.id, "source"))) throw httpError("Invalid source token", 401, "FORBIDDEN");
      if (job.source?.kind !== "zip") throw httpError("This build has no ZIP source", 404, "NOT_FOUND");
      const file = path.join(SOURCES, `${job.source.sourceId}.zip`);
      if (!fs.existsSync(file)) throw httpError("Source file missing", 404, "SOURCE_MISSING");
      res.writeHead(200, { "Content-Type": "application/zip", "Content-Length": fs.statSync(file).size, "Content-Disposition": 'attachment; filename="source.zip"', "Cache-Control": "no-store" });
      return fs.createReadStream(file).pipe(res);
    }

    const uploadMatch = route.match(/^\/api\/build\/([A-Za-z0-9-]+)\/upload$/);
    if (uploadMatch && req.method === "POST") {
      const job = findJob(uploadMatch[1]);
      if (!job) throw httpError("Build job not found", 404, "NOT_FOUND");
      const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
      if (!safeEqual(token, jobToken(job.id, "upload"))) throw httpError("Invalid upload token", 401, "FORBIDDEN");
      if (!["queued", "running"].includes(job.status)) throw httpError("Build is not accepting artifacts", 409, "NOT_RUNNING");
      const { files } = await receiveUpload(req, path.join(ARTIFACTS, job.id), { maxBytes: MAX_ARTIFACT_MB * 1024 * 1024, allow: (n) => /\.(apk|aab|log|txt|json)$/i.test(n) });
      for (const f of files) log(job, `Artifact received · ${f.name} (${(f.size / 1024 / 1024).toFixed(2)} MB)`);
      return json(res, 200, { ok: true, received: files.length });
    }

    const statusMatch = route.match(/^\/api\/build\/([A-Za-z0-9-]+)\/status$/);
    if (statusMatch && req.method === "GET") {
      const job = findJob(statusMatch[1]);
      if (!job) throw httpError("Build job not found", 404, "NOT_FOUND");
      await authorizeJob(req, job);
      if (job.status === "ready" && job.expiresAt && Date.now() > job.expiresAt) cleanupJob(job.id);
      return json(res, 200, { ok: true, job: publicJob(job) });
    }

    const artifactMatch = route.match(/^\/api\/build\/([A-Za-z0-9-]+)\/artifact\/(.+)$/);
    if (artifactMatch && req.method === "GET") {
      const job = findJob(artifactMatch[1]);
      if (!job) throw httpError("Build job not found", 404, "NOT_FOUND");
      await authorizeJob(req, job);
      if (job.status === "expired" || (job.expiresAt && Date.now() > job.expiresAt)) { cleanupJob(job.id); throw httpError("Download link expired. Rebuild from the preserved source.", 410, "LINK_EXPIRED"); }
      if (job.status !== "ready") throw httpError("Build is not ready yet.", 409, "NOT_READY");
      let name; try { name = decodeURIComponent(artifactMatch[2]); } catch { throw httpError("Bad artifact name", 400, "INVALID_REQUEST"); }
      const artifact = (job.artifacts || []).find((a) => a.name === name);
      if (!artifact) throw httpError("Artifact not found", 404, "NOT_FOUND");
      const filePath = path.join(ARTIFACTS, job.id, artifact.file);
      if (!filePath.startsWith(path.join(ARTIFACTS, job.id) + path.sep) || !fs.existsSync(filePath)) throw httpError("Artifact file is missing", 404, "NOT_FOUND");
      res.writeHead(200, {
        "Content-Type": /\.aab$/i.test(name) ? "application/octet-stream" : "application/vnd.android.package-archive",
        "Content-Disposition": `attachment; filename="${path.basename(name).replace(/[^A-Za-z0-9._-]/g, "_")}"`,
        "Content-Length": fs.statSync(filePath).size, "Cache-Control": "no-store",
        "X-Content-SHA256": artifact.sha256 || "",
      });
      return fs.createReadStream(filePath).pipe(res);
    }

    const cancelMatch = route.match(/^\/api\/build\/([A-Za-z0-9-]+)\/cancel$/);
    if (cancelMatch && req.method === "POST") {
      const job = findJob(cancelMatch[1]);
      if (!job) throw httpError("Build job not found", 404, "NOT_FOUND");
      await authorizeJob(req, job);
      if (job.status === "queued") { job.status = "cancelled"; job.error = "Cancelled before execution."; log(job, job.error); save(job); return json(res, 200, { ok: true, status: "cancelled" }); }
      if (job.status === "running") { job.status = "cancelled"; job.error = "Cancellation requested. The runner may finish its current step; no artifact will be published."; log(job, job.error); save(job); return json(res, 200, { ok: true, status: "cancelled" }); }
      throw httpError(`Cannot cancel a ${job.status} job.`, 409, "NOT_CANCELLABLE");
    }

    if (route === "/api/builds" && req.method === "GET") {
      const user = REQUIRE_AUTH ? await requireUser(req) : null;
      const appId = url.searchParams.get("appId");
      const list = jobs.filter((j) => (!user || j.uid === user.uid) && (!appId || j.appId === appId)).slice(0, 50).map(publicJob);
      return json(res, 200, { ok: true, jobs: list });
    }

    if (route.startsWith("/api/")) return json(res, 404, { ok: false, error: "Not found" });

    // static site (path-safe)
    let decoded; try { decoded = decodeURIComponent(route); } catch { throw httpError("Bad path", 400, "INVALID_REQUEST"); }
    const safePath = path.normalize(decoded).replace(/^([/\\])+/, "");
    let filePath = path.resolve(DIST, safePath);
    if (!filePath.startsWith(path.resolve(DIST) + path.sep) && filePath !== path.resolve(DIST)) filePath = path.join(DIST, "index.html");
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) filePath = path.join(DIST, "index.html");
    if (!fs.existsSync(filePath)) { res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("Frontend build is missing. Run npm run build before starting the server."); }
    const ext = path.extname(filePath);
    const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" }[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime, "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin", "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=31536000, immutable" });
    fs.createReadStream(filePath).pipe(res);
  } catch (e) {
    const status = e.status || 500;
    if (status >= 500) console.error("[api]", route, e.message);
    return json(res, status, { ok: false, code: e.code || "INTERNAL_ERROR", error: status >= 500 && !e.status ? "Internal server error" : e.message });
  }
});

server.keepAliveTimeout = 65_000;
server.headersTimeout = 70_000;
server.requestTimeout = 120_000;
if (isMain) {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`U APP server on :${PORT} · data ${DATA} · auth ${REQUIRE_AUTH ? "required" : "DISABLED (dev only)"}`);
    probeEngine();
  });
  for (const signal of ["SIGTERM", "SIGINT"]) {
    process.on(signal, () => {
      persistJobs(); persistSources(); persistPayments(); persistPlans();
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 4000).unref();
    });
  }
}

export { server, validateApp, validateSource, normalizeAds, normalizePermissions, validateZip, workerCode };

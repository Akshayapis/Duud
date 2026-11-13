/**
 * U APP — Render server
 * Static site host + Kaggle-powered Android build engine.
 *
 * No GitHub. No browser credentials. Kaggle credentials exist only in server env.
 * Queue is persisted on disk (mount a Render disk at DATA_DIR for restart safety).
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";
import { KaggleClient, KaggleError, normalizeKernelStatus } from "./kaggle.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8080);
const DATA_DIR = process.env.DATA_DIR || "/var/uapp-data";
const DIST = path.join(__dirname, "..", "dist");
const TTL = Number(process.env.DOWNLOAD_TTL_SECONDS || 540);
const TIMEOUT_MIN = Number(process.env.KAGGLE_TIMEOUT_MINUTES || 30);
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "dmakenow";
const DB_URL = process.env.FIREBASE_DATABASE_URL || "https://dmakenow-default-rtdb.firebaseio.com";
const REQUIRE_AUTH = process.env.REQUIRE_AUTH !== "false";
const UPLOAD_SECRET = process.env.BUILD_UPLOAD_SECRET || crypto.randomBytes(32).toString("hex");
const WORKER_SLUG = process.env.KAGGLE_WORKER_SLUG || "uapp-android-build-worker";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "uapp-admin-change-me";
const PUBLIC_UPI_ID = process.env.UPI_ID || "";
const PUBLIC_UPI_NAME = process.env.UPI_PAYEE_NAME || "";
// Kaggle credentials: Render env wins. Built-in platform credentials keep the
// engine working with zero setup; they stay on the server and are never bundled
// into the browser build or returned by an unauthenticated response.
const kaggleUsername = process.env.KAGGLE_USERNAME || "akshaysbjfj";
const kaggleKey = process.env.KAGGLE_KEY || "0898301a73cf7fd67d6e94c7c3f2af87";
const kaggle = kaggleUsername && kaggleKey ? new KaggleClient(kaggleUsername, kaggleKey) : null;

const kaggleState = { at: 0, credentials: kaggle ? "checking" : "not-configured", checked: false };
let kaggleProbe = null;
function probeKaggle() {
  if (!kaggle || kaggleProbe) return;
  if (kaggleState.checked && Date.now() - kaggleState.at < 10 * 60 * 1000) return;
  kaggleProbe = kaggle
    .verifyCredentials()
    .then(() => { kaggleState.credentials = "verified"; })
    .catch((e) => {
      kaggleState.credentials = e.status === 401 || e.status === 403 ? "rejected" : `error: ${String(e.message).slice(0, 120)}`;
    })
    .finally(() => { kaggleState.at = Date.now(); kaggleState.checked = true; kaggleProbe = null; });
}

let dataRoot = DATA_DIR;
try {
  fs.mkdirSync(dataRoot, { recursive: true });
  fs.accessSync(dataRoot, fs.constants.W_OK);
} catch {
  dataRoot = path.join("/tmp", "uapp-data");
  fs.mkdirSync(dataRoot, { recursive: true });
  console.warn(`DATA_DIR ${DATA_DIR} is not writable; using ${dataRoot}. Mount a Render disk for restart-safe sources.`);
}
const DATA = dataRoot;
const SOURCES = path.join(DATA, "sources");
const ARTIFACTS = path.join(DATA, "artifacts");
const JOBS = path.join(DATA, "jobs.json");
const SETTINGS_FILE = path.join(DATA, "settings.json");
for (const dir of [DATA, SOURCES, ARTIFACTS]) fs.mkdirSync(dir, { recursive: true });

function workerNotebook() {
  const candidates = [
    path.join(__dirname, "..", "kaggle", "worker", "worker.ipynb"),
    path.join(__dirname, "kaggle", "worker", "worker.ipynb"),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) return fs.readFileSync(file, "utf8");
  }
  throw new Error("kaggle/worker/worker.ipynb is missing from this deployment. Check the Docker build.");
}

let jobs = [];
try { jobs = JSON.parse(fs.readFileSync(JOBS, "utf8")); } catch { jobs = []; }
let settings = {};
try { settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8")); } catch { settings = {}; }
function persistSettings() { try { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2)); } catch { /* best effort */ } }
// Recover queue state after a restart and expire stale download windows.
for (const job of jobs) {
  if (job.status === "ready" && job.expiresAt && Date.now() > job.expiresAt) {
    job.status = "expired";
    job.artifacts = [];
    try { const dir = path.join(ARTIFACTS, job.id); if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
  if (job.status === "running") {
    // The Kaggle notebook keeps running, but this process lost the poller.
    // Mark it interrupted so the user can rebuild from preserved source (no credit).
    job.status = "failed";
    job.error = "Server restarted while the Kaggle notebook was running. The notebook may still finish on Kaggle; use Create Again to requeue from preserved source. No credit is charged.";
  }
}
let lastPersist = 0;
function persist(force = false) {
  const now = Date.now();
  if (!force && now - lastPersist < 1500) return;
  lastPersist = now;
  fs.writeFileSync(JOBS, JSON.stringify(jobs.slice(0, 300), null, 2));
}
const save = (job) => {
  const i = jobs.findIndex((j) => j.id === job.id);
  const persisted = { ...job };
  delete persisted.sourceB64;
  if (i >= 0) jobs[i] = { ...job, sourceB64: jobs[i].sourceB64 ?? job.sourceB64 };
  else jobs.unshift(job);
  const target = jobs.find((j) => j.id === job.id);
  if (target) {
    const trimmed = jobs.map((j) => { const copy = { ...j }; delete copy.sourceB64; return copy; });
    try { fs.writeFileSync(JOBS, JSON.stringify(trimmed.slice(0, 300), null, 2)); } catch { /* best effort */ }
  }
  persist();
};
const findJob = (id) => jobs.find((j) => j.id === id);
const log = (job, line) => { job.logs = [...(job.logs || []), `${new Date().toISOString().slice(11, 19)} ${line}`].slice(-160); job.updatedAt = new Date().toISOString(); save(job); };

/* ------------------------------------------------------------------ Firebase auth */
const JWK_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
let jwkCache = { at: 0, keys: [] };
async function googleKeys() {
  if (Date.now() - jwkCache.at < 3600000 && jwkCache.keys.length) return jwkCache.keys;
  const res = await fetch(JWK_URL);
  if (!res.ok) throw new Error("Could not download Google signing keys");
  const data = await res.json();
  jwkCache = { at: Date.now(), keys: data.keys || [] };
  return jwkCache.keys;
}
export function b64url(input) { return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64"); }
async function verifyIdToken(token) {
  const [rawHeader, rawPayload, rawSignature] = String(token).split(".");
  if (!rawHeader || !rawPayload || !rawSignature) throw new Error("Malformed Firebase ID token");
  const header = JSON.parse(b64url(rawHeader).toString("utf8"));
  const payload = JSON.parse(b64url(rawPayload).toString("utf8"));
  if (!header.kid) throw new Error("Firebase token has no key id");
  const keys = await googleKeys();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk?.n || !jwk?.e) throw new Error("Firebase signing key not recognised");
  const key = crypto.createPublicKey({ key: { kty: "RSA", n: jwk.n, e: jwk.e }, format: "jwk" });
  const ok = crypto.verify("RSA-SHA256", Buffer.from(`${rawHeader}.${rawPayload}`), key, b64url(rawSignature));
  if (!ok) throw new Error("Firebase ID token signature is invalid");
  if (payload.aud !== PROJECT_ID) throw new Error("Firebase token was issued for a different project");
  if (payload.iss !== `https://securetoken.google.com/${PROJECT_ID}`) throw new Error("Firebase token issuer mismatch");
  if (!payload.sub || payload.exp * 1000 < Date.now()) throw new Error("Firebase session expired. Sign in again.");
  return { uid: payload.sub, email: payload.email, emailVerified: Boolean(payload.email_verified), name: payload.name };
}
async function rtdb(pathName, token) {
  const url = `${DB_URL.replace(/\/$/, "")}/${pathName}.json?auth=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Realtime Database read failed (${res.status})`);
  return res.json();
}
async function enforceQuota(uid, token) {
  try {
    const profile = await rtdb(`users/${uid}/profile`, token);
    const projects = await rtdb(`users/${uid}/projects`, token);
    const rawPlan = profile?.planId || "free";
    const expired = profile?.planExpiresAt ? new Date(profile.planExpiresAt).getTime() <= Date.now() : false;
    const plan = rawPlan !== "free" && !expired ? rawPlan : "free";
    const now = new Date();
    const list = projects ? Object.values(projects) : [];
    const count = list.filter((p) => {
      const created = p?.createdAt ? new Date(p.createdAt) : null;
      return created && created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
    }).length;
    if (plan === "free" && count >= 3) {
      const err = new Error("Your monthly free app limit has been reached. Upgrade your plan to continue creating apps.");
      err.status = 402; err.code = "QUOTA_EXCEEDED"; throw err;
    }
    return { plan, count };
  } catch (e) {
    if (e.code === "QUOTA_EXCEEDED") throw e;
    // Database rules may not allow preview paths yet: do not block a real build on metadata reads.
    return { plan: "unknown", count: 0 };
  }
}

/* ------------------------------------------------------------------ helpers */
const json = (res, status, body) => { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify(body)); };
const slug = (v) => String(v).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "app";
const uploadToken = (jobId) => crypto.createHmac("sha256", UPLOAD_SECRET).update(jobId).digest("hex");

function readBody(req, limit = 2_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on("data", (c) => { size += c.length; if (size > limit) { reject(Object.assign(new Error("Payload too large"), { status: 413 })); req.destroy(); return; } chunks.push(c); });
    req.on("end", () => { try { resolve(Buffer.concat(chunks)); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}
async function parseJson(req) { const raw = await readBody(req); try { return JSON.parse(raw.toString("utf8") || "{}"); } catch { throw Object.assign(new Error("Invalid JSON body"), { status: 400 }); } }

function parseMultipart(buffer, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || "");
  if (!m) throw Object.assign(new Error("multipart boundary missing"), { status: 400 });
  const boundary = Buffer.from(`--${(m[1] || m[2]).trim()}`);
  const parts = [];
  let index = buffer.indexOf(boundary);
  while (index !== -1) {
    const start = index + boundary.length;
    const end = buffer.indexOf(boundary, start);
    if (end === -1) break;
    const chunk = buffer.subarray(start + 2, end - 2);
    const sep = chunk.indexOf("\r\n\r\n");
    if (sep !== -1) {
      const head = chunk.subarray(0, sep).toString("utf8");
      const body = chunk.subarray(sep + 4);
      const name = /name="([^"]+)"/i.exec(head)?.[1];
      const filename = /filename="([^"]*)"/i.exec(head)?.[1];
      if (name) parts.push({ name, filename, data: body });
    }
    index = end;
  }
  return parts;
}

/* ------------------------------------------------------------------ worker loop */
let activeJobId = null;
let workerTimer = null;
const datasetBySource = new Map();

function nextQueued() {
  return [...jobs].reverse().find((j) => j.status === "queued");
}

function workerCode(job) {
  const base = JSON.parse(workerNotebook());
  const jobCell = {
    cell_type: "code",
    execution_count: null,
    metadata: {},
    outputs: [],
    source: [
      "import base64, json\n",
      `JOB = json.loads(base64.b64decode(${JSON.stringify(Buffer.from(JSON.stringify(job.kaggleJob)).toString("base64"))}).decode())\n`,
      `SOURCE_B64 = ${JSON.stringify(job.sourceB64 || "")}\n`,
    ],
  };
  const cells = [base.cells[0], jobCell, ...base.cells.slice(1)];
  return JSON.stringify({ ...base, cells });
}

async function startJob(job) {
  activeJobId = job.id;
  job.status = "running"; job.startedAt = new Date().toISOString(); save(job);
  try {
    if (job.sourceId) log(job, "Original source preserved on server storage · embedding for the worker");
    log(job, "Pushing the Android build notebook to Kaggle…");
    const slugBase = `${WORKER_SLUG}-${job.id.toLowerCase()}`.replace(/[^a-z0-9-]/g, "-").slice(0, 50);
    const kernel = await kaggle.pushKernel(slugBase, {
      title: `UAPP ${job.appId} ${job.id}`,
      notebook: workerCode(job),
      datasetSources: [],
    });
    job.kernelRef = kernel.ref; job.kernelUrl = kernel.url; job.kernelVersion = kernel.version;
    log(job, `Kaggle kernel started · ${kernel.url}`);
    job.status = "running"; save(job);
    await pollKernel(job);
  } catch (e) {
    job.status = "failed";
    job.error = e instanceof KaggleError ? `Kaggle: ${e.message}` : e.message;
    log(job, `Build failed: ${job.error}`);
    if (e.status === 401) log(job, "Kaggle credentials were rejected. Check KAGGLE_USERNAME / KAGGLE_KEY on Render.");
    if (/internet/i.test(job.error)) log(job, "Enable Internet in the Kaggle notebook settings (phone verification required).");
  } finally {
    activeJobId = null;
    save(job, true);
    setImmediate(tick);
  }
}

async function pollKernel(job) {
  const deadline = Date.now() + TIMEOUT_MIN * 60000;
  let delay = 15000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay + 5000, 30000);
    if (job.status === "cancelled") return;
    const [owner, slug] = String(job.kernelRef).split("/");
    const raw = await kaggle.kernelStatus(owner, slug);
    const status = normalizeKernelStatus(raw);
    job.kernelStatus = status; save(job);
    const minutes = ((Date.now() - new Date(job.startedAt).getTime()) / 60000).toFixed(1);
    log(job, `Kaggle worker: ${status} · ${minutes} min elapsed`);
    if (status === "complete") { await collectArtifacts(job); return; }
    if (status === "error" || status === "cancelled") { job.status = status === "cancelled" ? "cancelled" : "failed"; job.error = `Kaggle notebook ${status}. Open the kernel log for the actual build error.`; return; }
    if (!job.uploadedAny) await tryUploadedArtifacts(job);
  }
  job.status = "timeout";
  job.error = `Build exceeded the ${TIMEOUT_MIN}-minute Kaggle execution limit. No credit is charged. Retry from preserved source.`;
  log(job, job.error);
}

async function tryUploadedArtifacts(job) {
  const dir = path.join(ARTIFACTS, job.id);
  if (fs.existsSync(dir) && fs.readdirSync(dir).some((f) => /\.(apk|aab)$/i.test(f))) {
    job.uploadedAny = true;
    await finalizeReady(job);
  }
}

async function collectArtifacts(job) {
  log(job, "Kaggle finished. Collecting build artifacts…");
  const dir = path.join(ARTIFACTS, job.id);
  fs.mkdirSync(dir, { recursive: true });
  try {
    const [owner, slug] = String(job.kernelRef).split("/");
    const listing = await kaggle.kernelOutput(owner, slug);
    let count = 0;
    for (const file of listing.files) {
      const name = path.basename(file.name);
      if (!/\.(apk|aab|log|txt)$/i.test(name)) continue;
      try {
        const buffer = await kaggle.downloadOutput(owner, slug, file.name, job.kernelVersion ?? undefined);
        fs.writeFileSync(path.join(dir, `${count}-${name}`), buffer);
        log(job, `Kaggle output fetched · ${name} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
        count += 1;
      } catch (e) {
        log(job, `Could not fetch ${name}: ${e.message}`);
      }
    }
    if (listing.log) fs.writeFileSync(path.join(dir, "kaggle-run.log"), listing.log);
    log(job, `Retrieved ${count} output file(s) from Kaggle.`);
  } catch (e) {
    log(job, `Could not download Kaggle output: ${e.message}`);
  }
  const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  const apk = files.filter((f) => /\.(apk|aab)$/i.test(f));
  if (!apk.length) {
    job.status = "failed";
    job.error = "Kaggle completed but returned no APK/AAB. Check the kernel output and build.log for the real Gradle error.";
    return;
  }
  await finalizeReady(job);
}

async function finalizeReady(job) {
  const dir = path.join(ARTIFACTS, job.id);
  const files = fs.readdirSync(dir);
  job.artifacts = files.map((f) => ({ name: f.replace(/^\d+-/, ""), file: f, size: fs.statSync(path.join(dir, f)).size })).filter((f) => /\.(apk|aab)$/i.test(f.name));
  const logFile = files.find((f) => /build\.log$/i.test(f));
  if (logFile) {
    const lines = fs.readFileSync(path.join(dir, logFile), "utf8").split(/\r?\n/).filter(Boolean).slice(-80);
    job.logs = [...(job.logs || []), ...lines].slice(-220);
  }
  job.status = "ready";
  job.completedAt = new Date().toISOString();
  job.expiresAt = Date.now() + TTL * 1000;
  job.uploadUrl = null; job.uploadToken = null;
  log(job, `Build ready · ${job.artifacts.length} artifact(s) · download window ${TTL}s`);
  setTimeout(() => cleanupJob(job.id), TTL * 1000 + 5000).unref?.();
}

function cleanupJob(jobId) {
  const dir = path.join(ARTIFACTS, jobId);
  try { if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  const job = findJob(jobId);
  if (job && job.status === "ready") { job.status = "expired"; job.artifacts = []; save(job, true); }
}

function tick() {
  if (activeJobId) return;
  const job = nextQueued();
  if (!job) return;
  if (!kaggle) { job.status = "failed"; job.error = "Kaggle credentials are not configured on the server (KAGGLE_USERNAME / KAGGLE_KEY)."; log(job, job.error); save(job, true); return; }
  void startJob(job);
}
workerTimer = setInterval(tick, 5000);
workerTimer.unref?.();

/* ------------------------------------------------------------------ API */
async function authorizeJob(req, job) {
  if (!REQUIRE_AUTH || !job.uid) return null;
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) throw Object.assign(new Error("Sign in to access this build"), { status: 401 });
    const user = await verifyIdToken(token);
    if (user.uid !== job.uid) throw Object.assign(new Error("You do not own this build job"), { status: 403 });
    return null;
  } catch (e) {
    return { status: e.status || 401, error: e.message };
  }
}

function publicJob(job) {
  return {
    id: job.id, appId: job.appId, status: job.status, kernelStatus: job.kernelStatus ?? null,
    kernelUrl: job.kernelUrl ?? null, createdAt: job.createdAt, startedAt: job.startedAt ?? null,
    expiresAt: job.expiresAt ?? null, error: job.error ?? null,
    queuePosition: job.status === "queued" ? [...jobs].reverse().filter((j) => j.status === "queued").findIndex((j) => j.id === job.id) + 1 : 0,
    artifacts: (job.artifacts || []).map((a) => ({ name: a.name, size: a.size, url: `/api/build/${job.id}/artifact/${encodeURIComponent(a.name)}` })),
    logs: job.logs || [],
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  const route = url.pathname;

  if (route === "/api/health") {
    // Render health checks must answer fast. Kaggle verification runs in the
    // background and is cached, so a slow Kaggle response can never fail a deploy.
    probeKaggle();
    return json(res, 200, {
      ok: true,
      service: "uapp-kaggle-build",
      engine: "kaggle",
      buildEnabled: Boolean(kaggle) && kaggleState.credentials === "verified",
      credentials: kaggle ? kaggleState.credentials : "not-configured",
      activeJob: activeJobId,
      queue: jobs.filter((j) => j.status === "queued").length,
      timeoutMinutes: TIMEOUT_MIN,
      downloadTtlSeconds: TTL,
      authRequired: REQUIRE_AUTH,
      firebaseProject: PROJECT_ID,
      dataDir: DATA,
      version: "2.2.0",
    });
  }

  if (route === "/api/settings/public" && req.method === "GET") {
    return json(res, 200, {
      ok: true,
      upi: settings.upiId && settings.upiName
        ? { upiId: settings.upiId, payeeName: settings.upiName }
        : PUBLIC_UPI_ID && PUBLIC_UPI_NAME
          ? { upiId: PUBLIC_UPI_ID, payeeName: PUBLIC_UPI_NAME }
          : null,
    });
  }

  if (route === "/api/settings/payment" && req.method === "PUT") {
    const token = req.headers["x-admin-token"] || req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token || token !== ADMIN_TOKEN) return json(res, 401, { ok: false, error: "Admin token required. Set ADMIN_TOKEN in Render." });
    try {
      const body = await parseJson(req);
      if (!/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(body.upiId || "")) return json(res, 400, { ok: false, error: "Invalid UPI ID" });
      if ((body.payeeName || "").trim().length < 2) return json(res, 400, { ok: false, error: "Payee name is required" });
      settings.upiId = body.upiId.trim();
      settings.upiName = body.payeeName.trim();
      settings.updatedAt = new Date().toISOString();
      persistSettings();
      return json(res, 200, { ok: true, upi: { upiId: settings.upiId, payeeName: settings.upiName } });
    } catch (e) {
      return json(res, e.status || 500, { ok: false, error: e.message });
    }
  }

  if (route === "/api/source" && req.method === "POST") {
    try {
      const auth = req.headers.authorization?.replace(/^Bearer\s+/i, "");
      if (REQUIRE_AUTH) { if (!auth) throw Object.assign(new Error("Sign in required"), { status: 401 }); await verifyIdToken(auth); }
      const parts = parseMultipart(await readBody(req, 60 * 1024 * 1024), req.headers["content-type"]);
      const file = parts.find((p) => p.name === "file" && p.filename);
      const appId = parts.find((p) => p.name === "appId")?.data?.toString("utf8") || "unknown";
      if (!file) throw Object.assign(new Error("ZIP file is required"), { status: 400 });
      if (!/\.zip$/i.test(file.filename) || file.data.subarray(0, 2).toString() !== "PK") throw Object.assign(new Error("Upload a valid .zip project"), { status: 400 });
      const sourceId = `${slug(appId)}-${crypto.randomBytes(4).toString("hex")}`;
      fs.writeFileSync(path.join(SOURCES, `${sourceId}.zip`), file.data);
      return json(res, 200, { ok: true, sourceId, size: file.data.length, preservedAt: "server-disk+kaggle-dataset" });
    } catch (e) {
      return json(res, e.status || 500, { ok: false, error: e.message });
    }
  }

  if (route === "/api/build" && req.method === "POST") {
    try {
      const auth = req.headers.authorization?.replace(/^Bearer\s+/i, "");
      let user = null;
      if (REQUIRE_AUTH) {
        if (!auth) throw Object.assign(new Error("Sign in to submit a build"), { status: 401, code: "AUTH_REQUIRED" });
        user = await verifyIdToken(auth);
        await enforceQuota(user.uid, auth);
      }
      const body = await parseJson(req);
      const app = body.app || body;
      if (!app?.id || !app?.name) throw Object.assign(new Error("App id and name are required"), { status: 400 });
      if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(app.packageId || "")) throw Object.assign(new Error("Invalid Android package ID"), { status: 400 });
      if (!app.source || !/^https:\/\//.test(app.source)) throw Object.assign(new Error("A valid HTTPS source URL (or preserved ZIP source) is required"), { status: 400 });
      const existing = jobs.find((j) => j.appId === app.id && ["queued", "running"].includes(j.status));
      if (existing) return json(res, 409, { ok: false, code: "BUILD_IN_PROGRESS", error: "A build for this app is already queued or running.", job: publicJob(existing) });
      if (!kaggle) throw Object.assign(new Error("Kaggle build engine is not configured on the server. An installable app package is still available."), { status: 503, code: "BUILD_NOT_CONFIGURED" });
      const jobId = `BLD-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
      let sourceB64 = "";
      if (body.sourceId) {
        const zipPath = path.join(SOURCES, `${body.sourceId}.zip`);
        if (!fs.existsSync(zipPath)) throw Object.assign(new Error("Preserved source not found. Upload the ZIP again to rebuild the APK."), { status: 409, code: "SOURCE_MISSING" });
        const size = fs.statSync(zipPath).size;
        if (size > 12 * 1024 * 1024) throw Object.assign(new Error(`ZIP is ${(size / 1024 / 1024).toFixed(1)} MB. Kaggle notebook payloads are limited to 12 MB for this engine; use a website URL source or reduce the archive.`), { status: 413, code: "SOURCE_TOO_LARGE" });
        sourceB64 = fs.readFileSync(zipPath).toString("base64");
      }
      const origin = process.env.APP_URL || `${req.headers["x-forwarded-proto"] || "https"}://${req.headers["x-forwarded-host"] || req.headers.host}`;
      const token = uploadToken(jobId);
      const job = {
        id: jobId, appId: app.id, uid: user?.uid ?? null, status: "queued",
        createdAt: new Date().toISOString(), sourceId: body.sourceId ?? null, sourceB64,
        packageId: app.packageId, appName: app.name,
        kaggleJob: {
          jobId, appId: app.id, name: app.name, packageId: app.packageId,
          version: app.version || "1.0.0", type: app.type || "website", source: app.source,
          splash: app.splash || "#080a0d", permissions: app.permissions || ["INTERNET", "ACCESS_NETWORK_STATE"],
          ads: app.ads ?? null, sourceFile: body.sourceId ? "source.zip" : null,
          uploadUrl: `${origin}/api/build/${jobId}/upload`, uploadToken: token,
        },
        logs: ["Build request accepted", "Queued for the Kaggle Android worker"],
      };
      save(job);
      const position = jobs.filter((j) => j.status === "queued").length;
      return json(res, 202, { ok: true, job: publicJob(job), queuePosition: position, engine: "kaggle" });
    } catch (e) {
      return json(res, e.status || 500, { ok: false, code: e.code, error: e.message });
    }
  }

  const uploadMatch = route.match(/^\/api\/build\/([A-Za-z0-9-]+)\/upload$/);
  if (uploadMatch && req.method === "POST") {
    const job = findJob(uploadMatch[1]);
    if (!job) return json(res, 404, { ok: false, error: "Unknown build job" });
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token || token !== job.kaggleJob?.uploadToken) return json(res, 401, { ok: false, error: "Invalid upload token" });
    try {
      const parts = parseMultipart(await readBody(req, 250 * 1024 * 1024), req.headers["content-type"]);
      const file = parts.find((p) => p.name === "file" && p.filename);
      if (!file) throw new Error("No artifact file in upload");
      const dir = path.join(ARTIFACTS, job.id);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${Date.now()}-${path.basename(file.filename)}`), file.data);
      log(job, `Artifact received from Kaggle · ${file.filename}`);
      return json(res, 200, { ok: true });
    } catch (e) {
      return json(res, 500, { ok: false, error: e.message });
    }
  }

  const statusMatch = route.match(/^\/api\/build\/([A-Za-z0-9-]+)\/status$/);
  if (statusMatch && req.method === "GET") {
    const job = findJob(statusMatch[1]);
    if (!job) return json(res, 404, { ok: false, error: "Build job not found" });
    const denied = await authorizeJob(req, job);
    if (denied) return json(res, denied.status, { ok: false, code: "AUTH_REQUIRED", error: denied.error });
    if (job.status === "ready" && job.expiresAt && Date.now() > job.expiresAt) { cleanupJob(job.id); }
    return json(res, 200, { ok: true, job: publicJob(job) });
  }

  const artifactMatch = route.match(/^\/api\/build\/([A-Za-z0-9-]+)\/artifact\/(.+)$/);
  if (artifactMatch && req.method === "GET") {
    const job = findJob(artifactMatch[1]);
    if (!job) return json(res, 404, { ok: false, error: "Build job not found" });
    const denied = await authorizeJob(req, job);
    if (denied) return json(res, denied.status, { ok: false, code: "AUTH_REQUIRED", error: denied.error });
    if (job.status !== "ready") return json(res, 409, { ok: false, code: job.status === "expired" ? "LINK_EXPIRED" : "NOT_READY", error: job.status === "expired" ? "Download link expired. Use Create Again." : "Build is not ready yet." });
    if (job.expiresAt && Date.now() > job.expiresAt) { cleanupJob(job.id); return json(res, 410, { ok: false, code: "LINK_EXPIRED", error: "Download link expired after nine minutes. Use Create Again." }); }
    const name = decodeURIComponent(artifactMatch[2]);
    const artifact = (job.artifacts || []).find((a) => a.name === name);
    if (!artifact) return json(res, 404, { ok: false, error: "Artifact not found" });
    const filePath = path.join(ARTIFACTS, job.id, artifact.file);
    if (!filePath.startsWith(path.join(ARTIFACTS, job.id)) || !fs.existsSync(filePath)) return json(res, 404, { ok: false, error: "Artifact file is missing" });
    const expiresIn = Math.max(0, Math.floor(((job.expiresAt || 0) - Date.now()) / 1000));
    res.writeHead(200, { "Content-Type": /\.aab$/i.test(name) ? "application/octet-stream" : "application/vnd.android.package-archive", "Content-Disposition": `attachment; filename="${path.basename(name)}"`, "Content-Length": fs.statSync(filePath).size, "Cache-Control": "no-store", "X-UAPP-Expires-In": String(expiresIn) });
    return fs.createReadStream(filePath).pipe(res);
  }

  const cancelMatch = route.match(/^\/api\/build\/([A-Za-z0-9-]+)\/cancel$/);
  if (cancelMatch && req.method === "POST") {
    const job = findJob(cancelMatch[1]);
    if (!job) return json(res, 404, { ok: false, error: "Build job not found" });
    if (job.status === "queued") { job.status = "cancelled"; job.error = "Cancelled before execution."; log(job, job.error); save(job, true); return json(res, 200, { ok: true, status: "cancelled" }); }
    if (job.status === "running") return json(res, 409, { ok: false, error: "Kaggle's public API does not provide cancellation for a running notebook. The job will finish or hit the execution timeout; no credit is charged on failure." });
    return json(res, 409, { ok: false, error: `Cannot cancel a ${job.status} job.` });
  }

  if (route === "/api/builds" && req.method === "GET") {
    const uid = url.searchParams.get("uid");
    const appId = url.searchParams.get("appId");
    if (REQUIRE_AUTH) {
      try {
        const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
        if (!token) throw Object.assign(new Error("Sign in required"), { status: 401 });
        const user = await verifyIdToken(token);
        if (uid && uid !== user.uid) throw Object.assign(new Error("You can only read your own builds"), { status: 403 });
      } catch (e) {
        return json(res, e.status || 401, { ok: false, error: e.message });
      }
    }
    const list = jobs.filter((j) => (!appId || j.appId === appId) && (!uid || j.uid === uid)).slice(0, 50).map(publicJob);
    return json(res, 200, { ok: true, jobs: list });
  }

  // static site
  const safePath = path.normalize(decodeURIComponent(route)).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(DIST, safePath);
  if (!filePath.startsWith(DIST) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) filePath = path.join(DIST, "index.html");
  const ext = path.extname(filePath);
  const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".woff2": "font/woff2" }[ext] || "application/octet-stream";
  if (!fs.existsSync(filePath)) {
    res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("U APP frontend build is missing. Run npm run build before starting the server.");
  }
  res.writeHead(200, { "Content-Type": mime, "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin", "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=31536000, immutable" });
  fs.createReadStream(filePath).pipe(res);
});

server.keepAliveTimeout = 65000;
server.headersTimeout = 70000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`U APP ${PORT} · engine kaggle · data ${DATA} · credentials withheld from browser`);
  probeKaggle();
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    try { persist(true); } catch { /* ignore */ }
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 4000).unref();
  });
}

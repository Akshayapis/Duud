# U APP — Build Anything. Launch Everywhere.

Premium app-creation platform: React 19 + Vite + Tailwind on the front end, a Node server,
Firebase Authentication / Realtime Database, and an **isolated Android build engine** that
compiles real APK/AAB files.

## What is implemented

- Premium landing site, dark/light themes, animated product demos, 54 UI templates.
- Firebase Authentication (Google + Email/Password), password reset, real email verification.
- Free plan: 3 app creation credits per calendar month, **server-checked**; paid plans; fail-closed
  quota; rebuilds of the same app never consume a new credit.
- Manual UPI payments with a real UPI-intent QR, UTR submission, server-side pending → approved
  history. The merchant payee is configured **only** on the server (admin API / deployment env);
  browsers can never set or override it.
- Full builder: 12 project types, website URL-only flow, HTML paste, real ZIP analysis with
  supported / partial / unsupported classification, permissions + `permission.txt`, 54 templates.
- Ads: **Google AdMob only**, compiled with the official GMA Next-Gen SDK `1.6.0` + UMP `4.0.0`.
  Test inventory is available on every plan; live ads require the owner's real AdMob App ID and
  per-format ad unit IDs plus a paid plan. Other networks are rejected truthfully, never faked.
- Developer portal: REST endpoint contracts, Python/PHP/JS samples, SHA-256 hashed API keys.
- Support centre, activity log, settings, downloads with a live build terminal.
- White-label UI: provider names and credentials are not exposed to end users.

## Build engine

`server/kaggle.mjs` uses the current Kaggle kernel-session API
(`https://www.kaggle.com/api/v1/kernels.KernelsApiService/…`) with HTTP Basic auth. It calls
`SaveKernel` to save and run a private worker notebook, `GetKernelSessionStatus` to poll real
execution state, and `ListKernelSessionOutput` to retrieve artifacts. Output version labels are
`v<N>` (bare numbers return 404).

Source ZIPs are streamed to persistent server storage and fetched by the worker over a short-lived,
per-job signed URL. Notebook payload limits never truncate a project. Artifacts are uploaded back
over a per-job HMAC token, verified (ZIP magic + SHA-256), and deleted after the download TTL.

`kaggle/worker/worker.py` is the single source of truth for the worker. `npm run sync:worker`
(regenerated automatically before `npm run build`) embeds it into `kaggle/worker/worker.ipynb`
with a `UAPP_JOB_PAYLOAD` marker cell. The server injects the job payload and Java/XML templates
into that cell before pushing.

Worker steps:

1. Download and safely extract the preserved source (ZIP-slip / symlink / bomb checks).
2. Use an uploaded Gradle project if present; otherwise generate a real Android WebView shell
   (AGP 8.13.0, Gradle 8.13, compileSdk/targetSdk 36, minSdk 24, JDK 17).
3. Inject the AdMob Next-Gen runtime + UMP consent when ads are configured.
4. Run `assembleDebug` and `bundleRelease` (AAB is unsigned unless signing is configured).
5. Upload the APK/AAB and real `build.log` back to the server; outputs also remain in the notebook.

### Server API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | White-label engine status, queue length, active job, timeouts |
| `GET /api/account` | Server-authoritative plan + quota for the signed-in user |
| `POST /api/source` | Streamed ZIP upload (150 MB default), ownership recorded |
| `POST /api/build` | ID-token verification, email verification, fail-closed quota, queue a job |
| `GET /api/build/:jobId/status` | Real status, logs, artifacts, expiry |
| `GET /api/build/:jobId/source?token=…` | Worker-only signed source download |
| `GET /api/build/:jobId/artifact/:name` | Owner-only streamed APK/AAB while the link is valid |
| `POST /api/build/:jobId/upload` | Worker → server artifact upload (HMAC job token) |
| `POST /api/build/:jobId/cancel` | Cancel queued/running job; running runner may finish its current step but no artifact is published |
| `POST /api/payments` | Submit a UPI payment request (pending) |
| `GET /api/payments` | Signed-in user's payment history |
| `GET /api/admin/payments` | Admin: list payment requests |
| `POST /api/admin/payments/:id/approve` | Admin: activate plan after UTR verification |
| `POST /api/admin/payments/:id/reject` | Admin: reject a payment request |
| `GET /api/settings/public` | Public merchant UPI payee (read-only) |
| `PUT /api/settings/payment` | Admin: set merchant UPI payee |

Queue rules: one active worker, duplicate-request prevention per app, persisted queue on disk,
execution timeout (`KAGGLE_TIMEOUT_MINUTES`, default 30), restart re-poll of running jobs, real
error reporting. No fake status, logs, APKs or "installable fallback success" is produced. A
separate web/PWA package is available for browser installation and is never presented as an APK.

### Build engine prerequisites

- The worker account must allow **internet-enabled** notebooks (phone verification) to download
  the Android SDK / Gradle.
- The engine is not an always-on server. Jobs run per build, are polled through the API, and can
  take several minutes.
- Cancellation stops artifact publication; a runner already executing may finish its current step.
- Set `APP_URL` (or `RENDER_EXTERNAL_URL`) so the worker can fetch source and upload artifacts
  safely. Authenticated builds fail closed if no public server URL is configured.

## Deployment (Render Docker)

1. Deploy this repository as a Docker service (Blueprint uses `render.yaml`).
2. Mount a persistent disk at `/var/uapp-data` (`DATA_DIR`). Sources, jobs, payments and plan
   overrides survive restarts. Artifacts are deleted after `DOWNLOAD_TTL_SECONDS` (default 540).
3. Set server environment variables (see `.env.example`):
   - `APP_URL`, `DATA_DIR`, `REQUIRE_AUTH=true`
   - `FIREBASE_PROJECT_ID`, `FIREBASE_DATABASE_URL`
   - `KAGGLE_USERNAME`, `KAGGLE_KEY`, `KAGGLE_TIMEOUT_MINUTES`, `KAGGLE_WORKER_SLUG`
   - `BUILD_UPLOAD_SECRET`, `ADMIN_TOKEN` (≥ 24 chars)
   - `UPI_ID`, `UPI_PAYEE_NAME` (optional fallback; admin API can override)
   - `FIREBASE_SERVICE_ACCOUNT_JSON` is optional; ID-token verification works with the project ID
     alone. It is only needed for future admin SDK writes.
4. In Firebase Console → Authentication → Settings → Authorized domains, add the deployment
   hostname. Enable Google and Email/Password providers. Publish `firebase.rules.json` (plan/quota
   fields are server/admin-only; browsers cannot write them).

Credentials are read only by the server. They are never bundled into the frontend, returned by the
API, or written to logs.

## Local commands

```bash
npm install
npm run sync:worker   # regenerate worker.ipynb from worker.py
npm run dev           # Vite front end (proxies /api to 127.0.0.1:8080)
npm run dev:server    # build server on :8080
npm run build         # production bundle (runs sync:worker first)
npm start             # serve dist/ + API
npm test              # node:test suite
npm run check         # tsc + build + tests
```

## Directory notes

- `server/index.mjs` — queue, auth, quota, payments, artifacts and static hosting.
- `server/kaggle.mjs` — build-engine API client.
- `kaggle/worker/worker.py` — worker source of truth.
- `kaggle/worker/worker.ipynb` — generated notebook (do not hand-edit).
- `kaggle/worker/templates/` — Android shell / ads runtime templates embedded into each job.
- `scripts/sync-worker.mjs` — notebook generator.
- `firebase.rules.json` — Realtime Database rules.
- `Dockerfile` / `render.yaml` — deployment.
- `tests/` — server, API-client and worker shape tests.

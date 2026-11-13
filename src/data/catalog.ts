export const SUPPORT_EMAIL = "akshay123fagg@gmail.com";
export const EMAIL_API = "https://otpapi-seven.vercel.app/api/send-email";
export const FREE_MONTHLY_CREDITS = 3;
export const OTP_TTL_SECONDS = 300;
export const OTP_RESEND_SECONDS = 60;
export const OTP_MAX_ATTEMPTS = 5;
export const DOWNLOAD_TTL_SECONDS = 540;

export const firebaseConfig = {
  apiKey: "AIzaSyBW-ouFRYPCYM-UnZyBE41D3-uFlaarGbc",
  authDomain: "dmakenow.firebaseapp.com",
  databaseURL: "https://dmakenow-default-rtdb.firebaseio.com",
  projectId: "dmakenow",
  storageBucket: "dmakenow.firebasestorage.app",
  messagingSenderId: "388458456292",
  appId: "1:388458456292:web:5579319a0e6206e0b478f1",
};

export type Plan = {
  id: string;
  name: string;
  price: number;
  duration: string;
  days: number;
  credits: number;
  period: "monthly" | "fixed";
  ads: boolean;
  api: boolean;
  maxProjectMb: number;
  builds: string[];
  description: string;
  features: string[];
  highlight?: boolean;
  active: boolean;
};

/* Plan configuration service. Admin-managed in the production system. */
export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    duration: "Monthly · resets every calendar month",
    days: 30,
    credits: 3,
    period: "monthly",
    ads: false,
    api: false,
    maxProjectMb: 25,
    builds: ["Debug APK"],
    description: "Everything you need to turn your first idea into an installable app.",
    features: [
      "3 app creation credits every month",
      "Basic app builder",
      "Website, HTML & ZIP imports",
      "All 54 UI templates",
      "Debug APK builds",
      "9-minute temporary download links",
      "Ad SDK integration disabled",
      "Community support",
    ],
    active: true,
  },
  {
    id: "creator",
    name: "Creator",
    price: 499,
    duration: "30 days",
    days: 30,
    credits: 15,
    period: "fixed",
    ads: true,
    api: true,
    maxProjectMb: 150,
    builds: ["Debug APK", "Release APK"],
    description: "For indie makers shipping real products and monetising with ads.",
    features: [
      "15 app creation credits per 30 days",
      "Ad network integration enabled",
      "Public developer API access",
      "Release + debug APK builds",
      "150 MB project size",
      "Priority build queue",
      "Email support",
    ],
    highlight: true,
    active: true,
  },
  {
    id: "studio",
    name: "Studio",
    price: 1299,
    duration: "90 days",
    days: 90,
    credits: 50,
    period: "fixed",
    ads: true,
    api: true,
    maxProjectMb: 400,
    builds: ["Debug APK", "Release APK", "AAB"],
    description: "For studios and agencies managing a portfolio of client applications.",
    features: [
      "50 app creation credits per 90 days",
      "All supported ad networks",
      "AAB + APK production builds",
      "400 MB project size",
      "Advanced custom apps",
      "API request history export",
      "Priority support",
    ],
    active: true,
  },
  {
    id: "scale",
    name: "Scale",
    price: 4999,
    duration: "180 days",
    days: 180,
    credits: 250,
    period: "fixed",
    ads: true,
    api: true,
    maxProjectMb: 1024,
    builds: ["Debug APK", "Release APK", "AAB"],
    description: "High-volume creation credits with the deepest project allowances.",
    features: [
      "250 app creation credits per 180 days",
      "Highest build priority",
      "1 GB project size",
      "All premium builder features",
      "Dedicated onboarding",
      "Invoice on request",
    ],
    active: true,
  },
];

export type AppType = {
  id: string;
  name: string;
  icon: string;
  blurb: string;
  tag: string;
};

export const APP_TYPES: AppType[] = [
  { id: "website", name: "Website to App", icon: "globe", blurb: "Wrap any valid HTTPS website in a native Android WebView shell.", tag: "Most popular" },
  { id: "html", name: "HTML App", icon: "code", blurb: "Ship a single-page HTML experience as an installable Android app.", tag: "" },
  { id: "cssjs", name: "CSS / JavaScript App", icon: "braces", blurb: "Bundle a static frontend with assets, styles and scripts.", tag: "" },
  { id: "php", name: "PHP Web Application", icon: "server", blurb: "Pair your PHP web app with an Android client. PHP stays server-side.", tag: "Hybrid" },
  { id: "pwa", name: "Progressive Web App", icon: "layers", blurb: "Turn an installable PWA into a Play-ready application.", tag: "" },
  { id: "android", name: "Android Studio Project", icon: "smartphone", blurb: "Build an existing Gradle project through the isolated build pipeline.", tag: "Pro" },
  { id: "apk", name: "Analyse Existing APK", icon: "search", blurb: "Inspect an APK's manifest, permissions and package metadata.", tag: "" },
  { id: "custom", name: "Custom Android Project", icon: "sparkles", blurb: "Configure a custom Gradle project from the ground up.", tag: "" },
  { id: "game", name: "Game Companion App", icon: "gamepad", blurb: "Companion app shell with push alerts and community links.", tag: "" },
  { id: "webview", name: "WebView Application", icon: "panel", blurb: "Advanced WebView with offline page, pull-to-refresh and file access.", tag: "" },
  { id: "advanced", name: "Advanced Custom App", icon: "terminal", blurb: "Full builder control: navigation, ads, permissions and splash.", tag: "Pro" },
  { id: "other", name: "Other Supported Project", icon: "box", blurb: "React Native, Flutter and static exports with configuration review.", tag: "" },
];

export type Template = {
  id: number;
  name: string;
  category: string;
  mode: "dark" | "light" | "neon" | "glass" | "amoled" | "minimal";
  accent: string;
  bg: string;
  panel: string;
  layout: "bottom" | "top" | "grid" | "side" | "floating" | "full";
  blurb: string;
};

const t = (
  id: number,
  name: string,
  category: string,
  mode: Template["mode"],
  accent: string,
  bg: string,
  panel: string,
  layout: Template["layout"],
  blurb: string
): Template => ({ id, name, category, mode, accent, bg, panel, layout, blurb });

export const TEMPLATES: Template[] = [
  t(1, "Obsidian", "Dark", "dark", "#c9f65b", "#0a0c10", "#141821", "bottom", "Editorial dark shell with a lime accent rail."),
  t(2, "Paper", "Light", "light", "#111827", "#f6f5ef", "#ffffff", "bottom", "Calm off-white reading experience."),
  t(3, "AMOLED Black", "AMOLED", "amoled", "#22d3ee", "#000000", "#0a0a0a", "grid", "True-black battery-friendly layout."),
  t(4, "Neon Arcade", "Neon", "neon", "#f472b6", "#12051c", "#221030", "floating", "Arcade glow with floating nav."),
  t(5, "Frost Glass", "Glass", "glass", "#a5f3fc", "#0b1220", "#16233b", "bottom", "Frosted panels over a cool gradient."),
  t(6, "Soft Rounded", "Light", "light", "#f97316", "#fff7ed", "#ffffff", "bottom", "Generous radii and warm surfaces."),
  t(7, "Sharp Square", "Minimal", "minimal", "#111111", "#eeeeea", "#ffffff", "top", "Zero radius, hard edges, bold type."),
  t(8, "Orbit", "Dark", "dark", "#b79cff", "#0c0a18", "#17132b", "floating", "Circular action dock and violet glow."),
  t(9, "Minimal Mono", "Minimal", "minimal", "#525252", "#fafafa", "#ffffff", "top", "Monochrome type-first interface."),
  t(10, "Turbo Gaming", "Gaming", "neon", "#84cc16", "#050b05", "#0e1b0d", "side", "Gaming HUD with stat panels."),
  t(11, "Executive", "Business", "light", "#1d4ed8", "#f8fafc", "#ffffff", "bottom", "Boardroom-ready business layout."),
  t(12, "Insight", "Dashboard", "dark", "#38bdf8", "#070e17", "#0e1a27", "side", "Analytics dashboard shell."),
  t(13, "Material You", "Material", "light", "#7c3aed", "#f5f0ff", "#ffffff", "bottom", "Tonal surfaces and pill controls."),
  t(14, "Mosaic", "Grid", "dark", "#fbbf24", "#0f0d08", "#1b170d", "grid", "Bento grid photography layout."),
  t(15, "Drift", "Light", "light", "#0d9488", "#f0fdfa", "#ffffff", "floating", "Soft teal gradients, floating dock."),
  t(16, "Sidebar Pro", "Business", "dark", "#60a5fa", "#0a1020", "#131c30", "side", "Persistent side navigation for power users."),
  t(17, "Fullscreen Story", "Immersive", "dark", "#f5f5f4", "#0a0a0a", "#171717", "full", "Full-bleed storytelling screens."),
  t(18, "Modern WebView", "WebView", "light", "#0f172a", "#ffffff", "#f8fafc", "bottom", "Clean browser chrome preview."),
  t(19, "Atelier", "Custom", "light", "#b45309", "#fdf6ec", "#ffffff", "top", "Couture-inspired cream and clay."),
  t(20, "Mint Finance", "Business", "light", "#059669", "#f0fdf4", "#ffffff", "bottom", "Trust-forward finance palette."),
  t(21, "Solar", "Dark", "dark", "#fb923c", "#120b06", "#1f130b", "floating", "Warm sunrise gradients."),
  t(22, "Night Club", "Neon", "neon", "#e879f9", "#0b0011", "#1b0626", "grid", "High-contrast nightlife grid."),
  t(23, "Notebook", "Minimal", "light", "#2563eb", "#f8fafc", "#ffffff", "top", "Notes app with ruled accents."),
  t(24, "Capsule", "Custom", "light", "#db2777", "#fff1f6", "#ffffff", "floating", "Pill-shaped cards and dock."),
  t(25, "Studio Dark", "Dark", "dark", "#f43f5e", "#0d0809", "#1a1114", "bottom", "Creative studio with rose accent."),
  t(26, "Nordic", "Minimal", "light", "#64748b", "#f1f5f9", "#ffffff", "side", "Scandinavian restrained layout."),
  t(27, "Cosmos", "Dark", "dark", "#818cf8", "#050615", "#0e1129", "floating", "Starfield gradients and orbit cards."),
  t(28, "Carbon", "Gaming", "amoled", "#f59e0b", "#050505", "#111111", "grid", "Carbon fibre-inspired gaming grid."),
  t(29, "Retail Rush", "Business", "light", "#ea580c", "#fff7ed", "#ffffff", "bottom", "Storefront cards and sticky cart."),
  t(30, "Bio Link", "Custom", "glass", "#e2e8f0", "#0f172a", "#1e293b", "full", "One-screen creator bio shell."),
  t(31, "Crypto Terminal", "Dashboard", "dark", "#22c55e", "#060f0a", "#0c1a12", "side", "Market board with ticker rows."),
  t(32, "Aqua", "Light", "light", "#0284c7", "#eff6ff", "#ffffff", "floating", "Blue water gradients and soft shadows."),
  t(33, "Bloom", "Custom", "light", "#ec4899", "#fdf2f8", "#ffffff", "top", "Floral pastel hero treatment."),
  t(34, "Velocity", "Gaming", "dark", "#facc15", "#0b0a06", "#171408", "bottom", "Racing game companion layout."),
  t(35, "Quiet", "Minimal", "light", "#78716c", "#fafaf9", "#ffffff", "top", "Stone-toned calm productivity."),
  t(36, "Glass Dock", "Glass", "glass", "#c4b5fd", "#0b0716", "#181026", "floating", "Floating glass capsule navigation."),
  t(37, "Matrix", "Neon", "neon", "#22c55e", "#020a05", "#07160c", "side", "Terminal green developer shell."),
  t(38, "Editorial", "Custom", "light", "#0c0a09", "#f5f5f4", "#ffffff", "top", "Magazine columns and serif contrast."),
  t(39, "Healthline", "Business", "light", "#16a34a", "#f0fdf4", "#ffffff", "bottom", "Health tracking with ring charts."),
  t(40, "Midnight Glass", "Glass", "glass", "#93c5fd", "#060a14", "#101a2c", "bottom", "Smoked glass over midnight blue."),
  t(41, "Pulse", "Dashboard", "dark", "#ef4444", "#0f0708", "#1b0d10", "grid", "Live metrics and alert cards."),
  t(42, "Mono Dark", "AMOLED", "amoled", "#e5e5e5", "#000000", "#0d0d0d", "side", "Strict black and white dashboard."),
  t(43, "Rounded Neon", "Neon", "neon", "#a3e635", "#0a1004", "#16210a", "floating", "Lime glow with oversized radii."),
  t(44, "Terra", "Custom", "light", "#92400e", "#fbf7f0", "#ffffff", "grid", "Earthy travel inspired bento."),
  t(45, "Aurora", "Dark", "dark", "#2dd4bf", "#04100f", "#0b1f1d", "full", "Aurora gradients across full display."),
  t(46, "Sleek Cards", "Grid", "light", "#4f46e5", "#eef2ff", "#ffffff", "grid", "Card-first discovery interface."),
  t(47, "Terminal Pro", "Custom", "dark", "#c9f65b", "#080a08", "#111511", "side", "Developer console with command bar."),
  t(48, "Candy", "Neon", "light", "#f472b6", "#fff1f2", "#ffffff", "bottom", "Playful candy palette with badges."),
  t(49, "Deep Space", "AMOLED", "amoled", "#818cf8", "#000000", "#0a0a12", "floating", "Black cosmos with indigo glows."),
  t(50, "Framework", "Material", "dark", "#0ea5e9", "#08111a", "#101c28", "top", "Systemised Material 3 style shell."),
  t(51, "Lumen", "Light", "light", "#eab308", "#fefce8", "#ffffff", "floating", "Bright lumen glow and warm cards."),
  t(52, "Noir", "Dark", "dark", "#e11d48", "#0a0a0b", "#17171a", "full", "Cinematic noir landing shell."),
  t(53, "Slate Pro", "Dashboard", "light", "#475569", "#f8fafc", "#ffffff", "side", "Enterprise dashboard with sidebar."),
  t(54, "Launchpad", "Custom", "glass", "#c9f65b", "#0a0f08", "#141d11", "bottom", "Product launch homepage shell."),
];

export const AD_FORMATS = [
  "Banner",
  "Adaptive Banner",
  "Interstitial",
  "Rewarded",
  "Rewarded Interstitial",
  "Native",
  "App Open",
  "MREC",
];

export const AD_TIMINGS = ["10 seconds", "20 seconds", "30 seconds", "40 seconds", "50 seconds", "60 seconds", "Custom"];

export type Network = {
  id: string;
  name: string;
  formats: string[];
  docs: string;
  fields: { label: string; key: string; hint: string }[];
};

const appIdField = { label: "App ID", key: "app_id", hint: "From the network dashboard" };
const adUnitField = { label: "Ad Unit ID", key: "ad_unit_id", hint: "Per placement / format" };

export const NETWORKS: Network[] = [
  { id: "admob", name: "Google AdMob", formats: ["Banner", "Interstitial", "Rewarded", "Rewarded Interstitial", "Native", "App Open", "Adaptive Banner", "MREC"], docs: "https://developers.google.com/admob/android/quick-start", fields: [appIdField, adUnitField] },
  { id: "unity", name: "Unity Ads / LevelPlay", formats: ["Banner", "Interstitial", "Rewarded"], docs: "https://docs.unity.com/ads/", fields: [appIdField, adUnitField] },
  { id: "applovin", name: "AppLovin MAX", formats: ["Banner", "Interstitial", "Rewarded", "Native", "MREC"], docs: "https://developers.applovin.com/en/android/overview/integration/", fields: [appIdField, adUnitField] },
  { id: "ironsource", name: "ironSource (LevelPlay)", formats: ["Banner", "Interstitial", "Rewarded"], docs: "https://developers.is.com/ironsource-mobile/android/android-sdk-integration/", fields: [appIdField, adUnitField] },
  { id: "startio", name: "Start.io", formats: ["Banner", "Interstitial", "Rewarded"], docs: "https://support.start.io/hc/en-us", fields: [appIdField, adUnitField] },
  { id: "yandex", name: "Yandex Ads", formats: ["Banner", "Interstitial", "Rewarded", "Native"], docs: "https://ads.yandex.com/helpcenter/en/dev/android/quick-start", fields: [appIdField, adUnitField] },
  { id: "meta", name: "Meta Audience Network", formats: ["Banner", "Interstitial", "Rewarded", "Native"], docs: "https://developers.facebook.com/docs/audience-network/", fields: [appIdField, { label: "Placement ID", key: "placement_id", hint: "Meta placement identifier" }] },
  { id: "inmobi", name: "InMobi", formats: ["Banner", "Interstitial", "Rewarded"], docs: "https://support.inmobi.com/", fields: [appIdField, adUnitField] },
  { id: "pangle", name: "Pangle", formats: ["Banner", "Interstitial", "Rewarded", "App Open"], docs: "https://www.pangleglobal.com/", fields: [appIdField, adUnitField] },
  { id: "mintegral", name: "Mintegral", formats: ["Banner", "Interstitial", "Rewarded", "Native"], docs: "https://www.mintegral.com/en/", fields: [appIdField, adUnitField] },
  { id: "chartboost", name: "Chartboost", formats: ["Banner", "Interstitial", "Rewarded"], docs: "https://docs.chartboost.com/", fields: [appIdField, adUnitField] },
  { id: "liftoff", name: "Liftoff Monetize", formats: ["Banner", "Interstitial", "Rewarded"], docs: "https://docs.liftoff.io/", fields: [appIdField, adUnitField] },
  { id: "vungle", name: "Vungle / Digital Turbine", formats: ["Banner", "Interstitial", "Rewarded"], docs: "https://support.vungle.com/", fields: [appIdField, adUnitField] },
  { id: "dtexchange", name: "DT Exchange", formats: ["Banner", "Interstitial", "Rewarded"], docs: "https://developer.digitalturbine.com/", fields: [appIdField, adUnitField] },
  { id: "aps", name: "Amazon Publisher Services", formats: ["Banner", "MREC"], docs: "https://aps.amazon.com/aps/documentation/", fields: [appIdField, adUnitField] },
  { id: "other", name: "Other compatible network", formats: ["Banner", "Interstitial", "Rewarded", "Native"], docs: "https://developer.android.com", fields: [{ label: "Network name", key: "network_name", hint: "Official SDK name" }, { label: "SDK documentation URL", key: "docs", hint: "Verified HTTPS documentation" }] },
];

export const PERMISSIONS = [
  { id: "internet", name: "Internet", level: "Normal", why: "Required for WebView content, APIs and loading remote assets." },
  { id: "network", name: "Network State", level: "Normal", why: "Detect offline state and show the offline screen." },
  { id: "notifications", name: "Notifications", level: "Runtime", why: "Deliver build and payment notifications." },
  { id: "camera", name: "Camera", level: "Runtime", why: "Only if your app captures photos or scans codes." },
  { id: "microphone", name: "Microphone", level: "Runtime", why: "Only if your app records audio." },
  { id: "location", name: "Location", level: "Runtime · sensitive", why: "Only for genuine location features. Never collected by U APP itself." },
  { id: "bluetooth", name: "Bluetooth", level: "Runtime", why: "Connect to nearby devices." },
  { id: "nfc", name: "NFC", level: "Normal", why: "Read NFC tags for supported experiences." },
  { id: "media", name: "Media Access", level: "Runtime · sensitive", why: "Pick files or images from device storage." },
  { id: "contacts", name: "Contacts", level: "Runtime · sensitive", why: "Only if your product genuinely needs contacts." },
  { id: "calendar", name: "Calendar", level: "Runtime", why: "Read or create calendar events." },
  { id: "vibration", name: "Vibration", level: "Normal", why: "Haptic feedback." },
  { id: "wakelock", name: "Wake Lock", level: "Normal", why: "Keep the screen on during media playback." },
  { id: "foreground", name: "Foreground Service", level: "Runtime", why: "Long-running uploads, downloads or playback." },
  { id: "storage", name: "Storage / Files", level: "Runtime", why: "Download files or save generated exports." },
  { id: "biometric", name: "Biometric", level: "Runtime", why: "Fingerprint or face unlock." },
];

export type Endpoint = {
  method: "POST" | "GET";
  path: string;
  title: string;
  description: string;
  auth: boolean;
  credits: boolean;
  body?: string;
  response: string;
};

export const ENDPOINTS: Endpoint[] = [
  {
    method: "POST",
    path: "/api/v1/apps/create",
    title: "Create an app",
    description: "Create a project and consume exactly one app creation credit. Failed validation does not consume a credit.",
    auth: true,
    credits: true,
    body: `{
  "type": "website",
  "name": "Nimbus",
  "package_id": "app.nimbus.client",
  "website_url": "https://nimbus.example.com",
  "template_id": 1
}`,
    response: `{
  "success": true,
  "message": "Build request accepted",
  "project_id": "APP-8F2K19",
  "remaining_credits": 2
}`,
  },
  { method: "GET", path: "/api/v1/apps/status?project_id=APP-8F2K19", title: "Build status", description: "Returns build state, queue position and artifact expiry for a project you own.", auth: true, credits: false, response: `{\n  "success": true,\n  "project_id": "APP-8F2K19",\n  "status": "queued",\n  "artifact_expires_in": null\n}` },
  { method: "GET", path: "/api/v1/apps/history", title: "App history", description: "Paginated creation and build history. Viewing history never consumes a credit.", auth: true, credits: false, response: `{\n  "success": true,\n  "page": 1,\n  "items": [],\n  "has_more": false\n}` },
  { method: "POST", path: "/api/v1/apps/rebuild", title: "Rebuild an app", description: "Re-run the build from preserved source. Rebuilding an existing app does not consume an app creation credit.", auth: true, credits: false, body: `{ "project_id": "APP-8F2K19" }`, response: `{\n  "success": true,\n  "build_id": "BLD-2201",\n  "credits_consumed": 0\n}` },
  { method: "GET", path: "/api/v1/apps/download", title: "Temporary download", description: "Returns a signed, single-use download URL valid for 9 minutes.", auth: true, credits: false, response: `{\n  "success": true,\n  "expires_in": 540,\n  "url": "https://…/dl/REDACTED"\n}` },
  { method: "GET", path: "/api/v1/account/plan", title: "Account plan", description: "Active plan, subscription state and duration.", auth: true, credits: false, response: `{\n  "success": true,\n  "plan": "free",\n  "status": "active",\n  "duration": "monthly"\n}` },
  { method: "GET", path: "/api/v1/account/usage", title: "Account usage", description: "Server-side quota ledger: allowance, used and remaining credits for the current period.", auth: true, credits: false, response: `{\n  "success": true,\n  "allowance": 3,\n  "used": 2,\n  "remaining": 1\n}` },
  { method: "GET", path: "/api/v1/networks", title: "Ad networks", description: "The supported ad network registry, formats and required credential keys.", auth: true, credits: false, response: `{\n  "success": true,\n  "networks": [{ "id": "admob", "name": "Google AdMob" }]\n}` },
  { method: "GET", path: "/api/v1/builds/status?build_id=BLD-2201", title: "Build pipeline status", description: "Detailed pipeline logs and artifact metadata. Tokens and secrets are never returned.", auth: true, credits: false, response: `{\n  "success": true,\n  "build_id": "BLD-2201",\n  "state": "failed",\n  "reason": "BUILD_RUNNER_NOT_CONFIGURED"\n}` },
  { method: "POST", path: "/api/v1/ads/configure", title: "Configure ads", description: "Save ad network configuration for a project. Requires an active plan with ad eligibility.", auth: true, credits: false, body: `{\n  "project_id": "APP-8F2K19",\n  "network": "admob",\n  "format": "banner"\n}`, response: `{\n  "success": false,\n  "code": "PLAN_REQUIRED",\n  "message": "Ad integration requires an active paid plan."\n}` },
  { method: "POST", path: "/api/v1/ads/load", title: "Load an ad", description: "Trigger an official SDK load request in a configured app build.", auth: true, credits: false, body: `{ "project_id": "APP-8F2K19", "placement": "home_banner" }`, response: `{\n  "success": true,\n  "queued": true\n}` },
  { method: "POST", path: "/api/v1/ads/reload", title: "Reload an ad", description: "Request a fresh ad load after an error or dismissal.", auth: true, credits: false, body: `{ "placement": "home_banner" }`, response: `{\n  "success": true,\n  "queued": true\n}` },
  { method: "POST", path: "/api/v1/notifications/send", title: "Send a notification", description: "Send an FCM push to device tokens registered to your own account or project.", auth: true, credits: false, body: `{\n  "project_id": "APP-8F2K19",\n  "title": "Your build is ready",\n  "body": "Download within 9 minutes."\n}`, response: `{\n  "success": false,\n  "code": "FCM_NOT_CONFIGURED"\n}` },
];

export const FAQS = [
  { q: "Can I really convert any website into an app?", a: "Any valid HTTPS website can be wrapped in a native Android WebView shell. Sites that set frame-blocking headers, rely on unsupported browser APIs, or require complex authentication may not work fully. U APP tests the URL and explains limitations before you build." },
  { q: "What happens when I use all 3 free credits?", a: "App creation is paused until your free quota resets at the start of the next calendar month, or until you activate a paid plan. The counter is enforced server-side per Firebase UID, so logging out or using a new browser never resets it." },
  { q: "Do failed builds consume an app credit?", a: "No. Credits follow a reservation-and-commit model. A credit is reserved when you submit a valid new app and only committed when app creation succeeds. Failed validation or a failed build releases the reservation automatically." },
  { q: "Does rebuilding cost another credit?", a: "No. Rebuilding an existing app from its preserved source never consumes a new app creation credit. The 9-minute download window restarts when the new artifact is ready." },
  { q: "Can I integrate AdMob on the free plan?", a: "Ad SDK integration is disabled on the free plan. Your app can be created within the free quota, but ad credentials cannot be activated and ad configuration is excluded from free builds. Paid plans enable ad integration while active." },
  { q: "How are paid plans activated?", a: "Select a plan, create a payment request, pay using the configured UPI details and submit the UTR. The request becomes PENDING. Your plan activates only after an authorised administrator verifies the payment — never because a browser reported success." },
  { q: "Why can't I download my APK after a while?", a: "Build artifacts are stored temporarily. Download links expire after exactly 9 minutes and the artifact is deleted. From My Apps choose Create Again to rebuild from the preserved source and generate a fresh 9-minute link." },
  { q: "Are PHP, Python or C# files converted into native Android code?", a: "No, and U APP never claims otherwise. Multi-language ZIP analysis classifies files into supported, partially supported and unsupported. PHP remains server-side and needs PHP hosting; native Android projects need Gradle configuration. You always review the exact file names and reasons first." },
];

export const CODE_SAMPLES: Record<string, string> = {
  Python: `import requests

API_KEY = "ua_live_••••••••"
BASE = "https://your-domain.example"

r = requests.post(
    f"{BASE}/api/v1/apps/create",
    headers={"Authorization": f"Bearer {API_KEY}"},
    json={
        "type": "website",
        "name": "Nimbus",
        "package_id": "app.nimbus.client",
        "website_url": "https://nimbus.example.com",
        "template_id": 1,
    },
    timeout=30,
)
print(r.status_code, r.json())`,
  PHP: `<?php
$ch = curl_init("https://your-domain.example/api/v1/apps/create");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer " . getenv("UAPP_API_KEY"),
        "Content-Type: application/json",
    ],
    CURLOPT_POSTFIELDS => json_encode([
        "type" => "website",
        "name" => "Nimbus",
        "package_id" => "app.nimbus.client",
        "website_url" => "https://nimbus.example.com",
        "template_id" => 1,
    ]),
]);
$response = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
echo $status . " " . $response;`,
  JavaScript: `const res = await fetch("https://your-domain.example/api/v1/apps/create", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.UAPP_API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    type: "website",
    name: "Nimbus",
    package_id: "app.nimbus.client",
    website_url: "https://nimbus.example.com",
    template_id: 1,
  }),
});

console.log(res.status, await res.json());`,
};

export const STATUS_COLORS: Record<string, string> = {
  active: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  pending: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20",
  rejected: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20",
  success: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  queued: "text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/20",
  building: "text-violet-600 dark:text-violet-400 bg-violet-500/10 border-violet-500/20",
  failed: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20",
  expired: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20",
  ready: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
};

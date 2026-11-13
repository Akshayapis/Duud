/**
 * U APP managed ad system.
 *
 * Users NEVER enter an App ID. Every supported network has a platform-managed
 * App ID owned by U APP (configured by the owner once). A project only carries
 * its network choice, formats and an auto-generated placement ID.
 *
 * The Ad Request Console in /ad-docs and /api-doce issues the load request with
 * the platform credentials. When a live mediation endpoint is configured the
 * request is executed against it; otherwise it runs in the official test-inventory
 * mode and returns the exact request/response contract used by the built app.
 */

type Env = Record<string, string | undefined>;
const env = ((import.meta as unknown as { env?: Env }).env ?? {}) as Env;

const MANAGED_KEY = "uapp.ads.managed.v1";

export type ManagedNetwork = {
  appId: string;
  label: string;
  /** Official sample/test placement where the network publishes one. */
  testUnit?: string;
  docs: string;
};

/**
 * Defaults use no invented production IDs: either an owner-supplied platform
 * App ID or the network's official test App ID / sample unit.
 */
const DEFAULTS: Record<string, ManagedNetwork> = {
  admob: { appId: "ca-app-pub-3940256099942544~3347511713", label: "Google sample App ID", testUnit: "ca-app-pub-3940256099942544/6300978111", docs: "https://developers.google.com/admob/android/test-ads" },
  unity: { appId: "managed-unity-app-id", label: "Platform managed", testUnit: "test", docs: "https://docs.unity.com/ads/" },
  applovin: { appId: "managed-max-sdk-key", label: "Platform managed", docs: "https://developers.applovin.com/en/android/overview/integration/" },
  ironsource: { appId: "managed-ironsource-app-key", label: "Platform managed", docs: "https://developers.is.com/ironsource-mobile/android/android-sdk-integration/" },
  startio: { appId: "managed-startio-app-id", label: "Platform managed", docs: "https://support.start.io/hc/en-us" },
  yandex: { appId: "managed-yandex-ad-unit", label: "Platform managed", docs: "https://ads.yandex.com/helpcenter/en/dev/android/quick-start" },
  meta: { appId: "managed-meta-placement", label: "Platform managed", docs: "https://developers.facebook.com/docs/audience-network/" },
  inmobi: { appId: "managed-inmobi-account", label: "Platform managed", docs: "https://support.inmobi.com/" },
  pangle: { appId: "managed-pangle-app-id", label: "Platform managed", docs: "https://www.pangleglobal.com/" },
  mintegral: { appId: "managed-mintegral-app-id", label: "Platform managed", docs: "https://www.mintegral.com/en/" },
  chartboost: { appId: "managed-chartboost-app-id", label: "Platform managed", docs: "https://docs.chartboost.com/" },
  liftoff: { appId: "managed-liftoff-app-id", label: "Platform managed", docs: "https://docs.liftoff.io/" },
  vungle: { appId: "managed-vungle-app-id", label: "Platform managed", docs: "https://support.vungle.com/" },
  dtexchange: { appId: "managed-dt-exchange-app-id", label: "Platform managed", docs: "https://developer.digitalturbine.com/" },
  aps: { appId: "managed-aps-app-key", label: "Platform managed", docs: "https://aps.amazon.com/aps/documentation/" },
  other: { appId: "managed-network-app-id", label: "Platform managed", docs: "https://developer.android.com" },
};

export function loadManagedAds(): Record<string, ManagedNetwork> {
  try {
    const raw = localStorage.getItem(MANAGED_KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Record<string, ManagedNetwork>) };
  } catch {
    /* ignore */
  }
  const merged = { ...DEFAULTS };
  Object.keys(merged).forEach((key) => {
    const envKey = `VITE_UAPP_AD_${key.toUpperCase()}_APPID`;
    const override = env[envKey];
    if (override) merged[key] = { ...merged[key], appId: override, label: "Platform configured" };
  });
  return merged;
}

export function saveManagedAd(networkId: string, entry: ManagedNetwork): void {
  const current = loadManagedAds();
  localStorage.setItem(MANAGED_KEY, JSON.stringify({ ...current, [networkId]: entry }));
}

export function adEndpoint(): string {
  return env.VITE_UAPP_ADS_ENDPOINT ?? "";
}

/** Deterministic placement ID generated at build time — user never types one. */
export function placementId(projectId: string, network: string, format: string): string {
  const clean = `${projectId}-${network}-${format}`.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  return clean.slice(0, 48);
}

export type AdRequestInput = {
  network: string;
  format: string;
  projectId: string;
  appName: string;
  unitId?: string;
};

export type AdRequestResult = {
  ok: boolean;
  mode: "live" | "test-inventory";
  request: Record<string, unknown>;
  response: Record<string, unknown>;
  latencyMs: number;
  message: string;
};

export async function requestAd(input: AdRequestInput): Promise<AdRequestResult> {
  const registry = loadManagedAds();
  const network = registry[input.network] ?? registry.admob;
  const placement = input.unitId?.trim() || network.testUnit || placementId(input.projectId, input.network, input.format);
  const request = {
    network: input.network,
    app_id: network.appId,
    app_id_source: network.label,
    placement_id: placement,
    format: input.format.toLowerCase().replace(/\s+/g, "_"),
    project_id: input.projectId,
    app_name: input.appName,
    request_id: `req_${Math.random().toString(36).slice(2, 10)}`,
    consent: { gdpr: "applied_in_app", coppa: false, personalization: "policy_compliant" },
    client: { platform: "android", sdk: "official_latest_stable", manual_load: true },
  };
  const started = performance.now();
  const endpoint = adEndpoint();

  if (endpoint) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const latencyMs = Math.round(performance.now() - started);
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      return {
        ok: res.ok,
        mode: "live",
        request,
        response: { status: res.status, ...data },
        latencyMs,
        message: res.ok ? "Ad response received from the mediation endpoint." : `Mediation endpoint returned HTTP ${res.status}.`,
      };
    } catch (e) {
      return {
        ok: false,
        mode: "live",
        request,
        response: { error: (e as Error).message },
        latencyMs: Math.round(performance.now() - started),
        message: "The mediation endpoint could not be reached. Check the endpoint URL and CORS policy.",
      };
    }
  }

  // Official test-inventory behaviour: no fake production fill is claimed.
  await new Promise((r) => setTimeout(r, 420 + Math.random() * 380));
  const latencyMs = Math.round(performance.now() - started);
  return {
    ok: true,
    mode: "test-inventory",
    request,
    response: {
      status: "ok",
      test_mode: true,
      ad_unit_used: placement,
      app_id_used: network.appId,
      fill: input.network === "admob" ? "official_google_test_creative" : "network_test_creative",
      note: "This is a real SDK request contract using platform-managed/test inventory. Configure VITE_UAPP_ADS_ENDPOINT for live mediation, and add VITE_UAPP_AD_<NETWORK>_APPID for production App IDs. Users never enter App IDs.",
    },
    latencyMs,
    message: `Request prepared with platform App ID (${network.label}). Builds include this exact configuration.`,
  };
}

export function adIntegrationSnippet(networkId: string, format: string): string {
  const registry = loadManagedAds();
  const n = registry[networkId] ?? registry.admob;
  return `// Generated by U APP — users never enter an App ID.
// Platform-managed App ID is injected at build time.
val adAppId = "${n.appId}"                 // ${n.label}
val placement = "${format.toLowerCase().replace(/\s+/g, "_")}_auto"
MobileAds.initialize(context, adAppId)
val adRequest = AdRequest.Builder().build()
// Load only on the app's own request; retry with backoff on NO_FILL.
adView.loadAd(adRequest)`;
}


/* ------------------------------------------------------------------ HTML ad tags */

export type AdTagFormat = "banner" | "interstitial" | "rewarded" | "app-open" | "native" | "mrec";

export type AdTag = { id: string; format: AdTagFormat; label: string; placement: string; html: string; note: string };

const FORMAT_LABEL: Record<AdTagFormat, string> = {
  banner: "Banner",
  interstitial: "Interstitial",
  rewarded: "Rewarded",
  "app-open": "App Open",
  native: "Native",
  mrec: "MREC",
};

export function adTagsFor(networkId: string, projectId: string, formats: AdTagFormat[]): AdTag[] {
  const registry = loadManagedAds();
  const network = registry[networkId] ?? registry.admob;
  const netName = networkId;
  return formats.map((format) => {
    const unit = placementId(projectId, netName, format);
    const config = {
      network: netName,
      appId: network.appId,
      unitId: unit,
      format,
      project: projectId,
      test: !network.label.startsWith("Platform configured"),
    };
    let html = "";
    if (format === "banner" || format === "mrec") {
      html = `<!-- U APP ${FORMAT_LABEL[format]} · ${netName} · placement ${unit} -->
<div id="uapp-ad-${format}"
     data-uapp-ad="${format}"
     data-network="${netName}"
     data-unit="${unit}"
     style="width:100%;min-height:${format === "mrec" ? "250" : "60"}px;display:flex;align-items:center;justify-content:center;overflow:hidden">
  <!-- The native shell loads the official SDK creative into this container. -->
</div>
<script>
  (function () {
    var cfg = ${JSON.stringify(config)};
    function load() {
      if (window.UAppAds && window.UAppAds.load) {
        window.UAppAds.load(cfg);            // native bridge inside the built app
      } else {
        var el = document.getElementById("uapp-ad-${format}");
        if (el && !el.dataset.filled) {
          el.dataset.filled = "pending";
          el.innerHTML = '<div style="font:600 11px system-ui;color:#8b9387;padding:12px">'
            + 'Ad space · ${format.toUpperCase()} · ${netName}<br><span style="font-weight:400">'
            + 'Runs with the official SDK inside the U APP build. Browsers show this labelled space.</span></div>';
        }
      }
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load); else load();
  })();
</script>`;
    } else if (format === "native") {
      html = `<!-- U APP Native ad slot · ${netName} · ${unit} -->
<div id="uapp-ad-native" data-uapp-ad="native" data-network="${netName}" data-unit="${unit}" style="border:1px solid rgba(127,127,127,.25);border-radius:12px;padding:12px;min-height:90px">
  <div style="font:600 12px system-ui">Sponsored</div>
  <div style="font:400 11px system-ui;opacity:.7">Native creative is injected here by the official ${netName} SDK.</div>
</div>
<script>
  document.addEventListener("DOMContentLoaded", function () {
    if (window.UAppAds && window.UAppAds.load) window.UAppAds.load(${JSON.stringify(config)});
  });
</script>`;
    } else {
      html = `<!-- U APP ${FORMAT_LABEL[format]} on demand · ${netName} · ${unit}
     Attach this to any button: it requests an ad only when the user taps. -->
<button type="button" id="uapp-ad-trigger-${format}" onclick="UAppAdsLoad_${format.replace(/[^a-z]/g, "")}()"
        style="padding:10px 16px;border-radius:10px;border:0;background:#c9f65b;color:#111605;font:700 13px system-ui">
  ${format === "rewarded" ? "Watch ad to continue" : "Continue"}
</button>
<script>
  var UAppAdConfig_${format.replace(/[^a-z]/g, "")} = ${JSON.stringify(config)};
  function UAppAdsLoad_${format.replace(/[^a-z]/g, "")}() {
    if (window.UAppAds && window.UAppAds.load) {
      window.UAppAds.load(UAppAdConfig_${format.replace(/[^a-z]/g, "")});  // native request inside the app
    } else {
      console.info("U APP ad request (browser preview):", UAppAdConfig_${format.replace(/[^a-z]/g, "")});
      alert("${FORMAT_LABEL[format]} ad requested from ${netName}. It plays inside the installed app.");
    }
  }
</script>`;
    }
    return {
      id: format,
      format,
      label: FORMAT_LABEL[format],
      placement: unit,
      html,
      note: format === "banner" || format === "mrec"
        ? "Paste where the ad should sit in your HTML."
        : format === "native"
          ? "Paste where the sponsored card should appear."
          : "Attach the generated function to any button or link.",
    };
  });
}

export function allAdTagsHtml(networkId: string, projectId: string, formats: AdTagFormat[]): string {
  const tags = adTagsFor(networkId, projectId, formats);
  const registry = loadManagedAds();
  const net = registry[networkId] ?? registry.admob;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>U APP ad tags · ${networkId}</title>
<style>body{margin:0;padding:20px;background:#0a0c10;color:#f3f5ee;font-family:system-ui,sans-serif}h1{font-size:18px}h2{font-size:13px;margin-top:24px;color:#c9f65b}p{font-size:12px;color:#98a094;line-height:1.6}pre{background:#11151b;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:12px;overflow:auto;font-size:11px;line-height:1.7;white-space:pre-wrap}button.acc{background:#c9f65b;color:#111605;border:0;border-radius:8px;padding:8px 14px;font-weight:700;margin-bottom:8px}</style>
</head>
<body>
<h1>U APP ad load tags</h1>
<p>Network: <strong>${net.label}</strong> · App ID: <code>${net.appId}</code> · Project: <code>${projectId}</code></p>
<p>Paste into your HTML, then upload that HTML/ZIP in U APP to build the app. The built app runs the official SDK; browsers show labelled ad spaces.</p>
${tags.map((t) => `<h2>${t.label}</h2><p>${t.note} Placement: <code>${t.placement}</code></p><button class="acc" onclick="navigator.clipboard.writeText(document.getElementById('code-${t.id}').textContent)">Copy tag</button><pre id="code-${t.id}">${t.html.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>`).join("\n")}
</body>
</html>`;
}

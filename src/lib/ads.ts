/**
 * U APP ads integration (Google AdMob — GMA Next-Gen SDK).
 *
 * Built apps compile the official Next-Gen SDK (ads-mobile-sdk 1.6.0) plus
 * UMP 4.0.0 for consent. The native runtime reads assets/uapp-ads.json and
 * exposes this JS bridge inside the app WebView:
 *
 *   window.UAppAds.request(format)        → load/show a placement
 *   window.UAppAds.isReady(format)        → boolean
 *   window.UAppAds.privacyOptions()       → reopen the consent form
 *   window.UAppAds.privacyOptionsRequired → boolean
 *   window.UAppAdsEvents.dispatch({format,event}) ← native events
 *
 * No fake networks, no invented production IDs. Debug builds can use the
 * official Google test inventory; live ads need the owner's real IDs.
 */

export const AD_SDK = { id: "gma-next-gen", version: "1.6.0", consent: "ump-4.0.0" } as const;

export const TEST_AD_APP_ID = "ca-app-pub-3940256099942544~3347511713";
export const TEST_AD_UNITS: Record<string, string> = {
  banner: "ca-app-pub-3940256099942544/9214589741",
  "adaptive banner": "ca-app-pub-3940256099942544/9214589741",
  mrec: "ca-app-pub-3940256099942544/6300978111",
  interstitial: "ca-app-pub-3940256099942544/1033173712",
  rewarded: "ca-app-pub-3940256099942544/5224354917",
  "rewarded interstitial": "ca-app-pub-3940256099942544/5354046379",
  "app open": "ca-app-pub-3940256099942544/9257395921",
  native: "ca-app-pub-3940256099942544/2247696110",
};

export type ManagedNetwork = { appId: string; label: string; testUnit?: string; docs: string };

/** Only AdMob is compiled into builds. Kept as a map for existing callers. */
export function loadManagedAds(): Record<string, ManagedNetwork> {
  return {
    admob: { appId: TEST_AD_APP_ID, label: "Google test App ID (debug only)", testUnit: TEST_AD_UNITS.banner, docs: "https://developers.google.com/admob/android/next-gen/quick-start" },
  };
}

export function placementId(projectId: string, _network: string, format: string): string {
  return `${projectId}-${format}`.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 48);
}

export type AdRequestInput = { network: string; format: string; projectId: string; appName: string; unitId?: string };
export type AdRequestResult = {
  ok: boolean;
  mode: "config-preview";
  request: Record<string, unknown>;
  response: Record<string, unknown>;
  latencyMs: number;
  message: string;
};

/**
 * The browser cannot serve native ads. This produces the exact configuration
 * contract the build will compile — clearly labelled as a preview, never a
 * fake "fill" or invented latency.
 */
export async function requestAd(input: AdRequestInput): Promise<AdRequestResult> {
  const started = performance.now();
  const format = input.format.toLowerCase().replace(/\s+/g, " ");
  const supported = input.network === "admob" && Object.keys(TEST_AD_UNITS).includes(format);
  const request = {
    network: "admob",
    sdk: `com.google.android.libraries.ads.mobile.sdk:ads-mobile-sdk:${AD_SDK.version}`,
    consent: `com.google.android.ump:user-messaging-platform:${AD_SDK.consent}`,
    app_id: TEST_AD_APP_ID,
    ad_unit_id: input.unitId?.trim() || TEST_AD_UNITS[format] || TEST_AD_UNITS.banner,
    format,
    project_id: input.projectId,
    mode: "official-test-inventory",
  };
  await Promise.resolve();
  return {
    ok: supported,
    mode: "config-preview",
    request,
    response: supported
      ? { compiled_into_build: true, note: "This configuration is compiled into the APK. Real ad requests happen only inside the installed app after UMP consent. Browsers cannot serve native ads." }
      : { error: "unsupported", note: "Only Google AdMob with the listed formats is compiled into builds." },
    latencyMs: Math.round(performance.now() - started),
    message: supported
      ? "Configuration preview ready. The installed app loads this placement through the official SDK after consent."
      : "Unsupported network/format. Builds compile Google AdMob only.",
  };
}

export function adIntegrationSnippet(_networkId: string, format: string): string {
  const f = format.toLowerCase();
  return `// Compiled into every U APP build (GMA Next-Gen ${AD_SDK.version} + UMP ${AD_SDK.consent})
// Initialization happens on a background thread after UMP consent:
new Thread(() -> MobileAds.initialize(context,
    new InitializationConfig.Builder(appId).build(),
    status -> { /* load configured placements */ })).start();

// Inside the app WebView, request a placement from your own UI:
window.UAppAds.request("${f}");
// Listen for native events:
window.UAppAdsEvents = { dispatch: (e) => console.log(e.format, e.event) };`;
}

/* ------------------------------------------------------------------ HTML ad tags */

export type AdTagFormat = "banner" | "interstitial" | "rewarded" | "app-open" | "mrec" | "rewarded-interstitial";

export type AdTag = { id: string; format: AdTagFormat; label: string; placement: string; html: string; note: string };

const FORMAT_LABEL: Record<AdTagFormat, string> = {
  banner: "Banner", interstitial: "Interstitial", rewarded: "Rewarded", "app-open": "App Open",
  mrec: "MREC", "rewarded-interstitial": "Rewarded Interstitial",
};

function bridgeFormat(format: AdTagFormat): string {
  return format === "app-open" ? "app open" : format === "rewarded-interstitial" ? "rewarded interstitial" : format;
}

export function adTagsFor(_networkId: string, projectId: string, formats: AdTagFormat[]): AdTag[] {
  return formats.map((format) => {
    const unit = placementId(projectId, "admob", format);
    const bf = bridgeFormat(format);
    const isBanner = format === "banner" || format === "mrec";
    const html = isBanner
      ? `<!-- U APP ${FORMAT_LABEL[format]} · placement ${unit} -->
<div id="uapp-ad-${format}" data-uapp-ad="${format}" style="width:100%;min-height:${format === "mrec" ? "250" : "60"}px;display:flex;align-items:center;justify-content:center">
  <!-- The native SDK renders the banner at the bottom of the app screen. -->
</div>
<script>
  (function () {
    function load() {
      if (window.UAppAds) window.UAppAds.request(${JSON.stringify(bf)});
      else {
        var el = document.getElementById("uapp-ad-${format}");
        if (el) el.innerHTML = '<div style="font:600 11px system-ui;color:#8b9387;padding:12px">Ad space · ${FORMAT_LABEL[format]} — renders inside the installed app</div>';
      }
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load); else load();
  })();
</script>`
      : `<!-- U APP ${FORMAT_LABEL[format]} on demand · placement ${unit} -->
<button type="button" onclick="window.UAppAds ? window.UAppAds.request(${JSON.stringify(bf)}) : alert('Ad placements run inside the installed app.')"
        style="padding:10px 16px;border-radius:10px;border:0;background:#c9f65b;color:#111605;font:700 13px system-ui">
  ${format === "rewarded" || format === "rewarded-interstitial" ? "Watch ad to continue" : "Continue"}
</button>
<script>
  window.UAppAdsEvents = window.UAppAdsEvents || { dispatch: function (e) { console.log("ad event", e); } };
</script>`;
    return {
      id: format, format, label: FORMAT_LABEL[format], placement: unit, html,
      note: isBanner ? "Paste where the ad should sit. The native banner anchors to the screen bottom." : "Attach to any button. The ad shows only on user action, after consent.",
    };
  });
}

export function allAdTagsHtml(networkId: string, projectId: string, formats: AdTagFormat[]): string {
  const tags = adTagsFor(networkId, projectId, formats);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>U APP ad tags · AdMob</title>
<style>body{margin:0;padding:20px;background:#0a0c10;color:#f3f5ee;font-family:system-ui,sans-serif}h1{font-size:18px}h2{font-size:13px;margin-top:24px;color:#c9f65b}p{font-size:12px;color:#98a094;line-height:1.6}pre{background:#11151b;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:12px;overflow:auto;font-size:11px;line-height:1.7;white-space:pre-wrap}</style>
</head>
<body>
<h1>U APP ad load tags</h1>
<p>Network: <strong>Google AdMob</strong> · SDK: <code>ads-mobile-sdk ${AD_SDK.version}</code> · Consent: <code>UMP ${AD_SDK.consent}</code> · Project: <code>${projectId}</code></p>
<p>Paste into your HTML, then build the app. Tags call the native bridge inside the installed app; browsers show a labelled placeholder. Ads never auto-play without consent.</p>
${tags.map((t) => `<h2>${t.label}</h2><p>${t.note} Placement: <code>${t.placement}</code></p><pre>${t.html.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>`).join("\n")}
</body>
</html>`;
}

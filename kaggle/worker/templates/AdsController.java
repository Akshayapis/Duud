package __PACKAGE__;

import android.app.Activity;
import android.app.Application;
import android.content.Context;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.FrameLayout;

import com.google.android.libraries.ads.mobile.sdk.MobileAds;
import com.google.android.libraries.ads.mobile.sdk.appopen.AppOpenAd;
import com.google.android.libraries.ads.mobile.sdk.appopen.AppOpenAdEventCallback;
import com.google.android.libraries.ads.mobile.sdk.banner.AdSize;
import com.google.android.libraries.ads.mobile.sdk.banner.AdView;
import com.google.android.libraries.ads.mobile.sdk.banner.BannerAd;
import com.google.android.libraries.ads.mobile.sdk.banner.BannerAdEventCallback;
import com.google.android.libraries.ads.mobile.sdk.banner.BannerAdRequest;
import com.google.android.libraries.ads.mobile.sdk.common.AdLoadCallback;
import com.google.android.libraries.ads.mobile.sdk.common.AdRequest;
import com.google.android.libraries.ads.mobile.sdk.common.FullScreenContentError;
import com.google.android.libraries.ads.mobile.sdk.common.LoadAdError;
import com.google.android.libraries.ads.mobile.sdk.initialization.InitializationConfig;
import com.google.android.libraries.ads.mobile.sdk.interstitial.InterstitialAd;
import com.google.android.libraries.ads.mobile.sdk.interstitial.InterstitialAdEventCallback;
import com.google.android.libraries.ads.mobile.sdk.rewarded.RewardedAd;
import com.google.android.libraries.ads.mobile.sdk.rewarded.RewardedAdEventCallback;
import com.google.android.libraries.ads.mobile.sdk.rewardedinterstitial.RewardedInterstitialAd;
import com.google.android.libraries.ads.mobile.sdk.rewardedinterstitial.RewardedInterstitialAdEventCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

import org.json.JSONObject;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * U APP ads runtime — GMA Next-Gen SDK 1.6.0 + UMP 4.0.0.
 * Reads assets/uapp-ads.json. Consent is gathered before any ad request.
 * Full-screen ads are shown only on explicit user/placement requests or app
 * foreground transitions, never on a blind timer.
 */
public final class AdsController implements Application.ActivityLifecycleCallbacks {
    private static final String TAG = "UAppAds";
    private static AdsController instance;

    private final Application app;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final AtomicBoolean consentStarted = new AtomicBoolean(false);
    private final AtomicBoolean sdkStarted = new AtomicBoolean(false);
    private volatile boolean initialized = false;
    private volatile boolean privacyOptionsRequired = false;
    private volatile boolean canRequestAds = false;
    private ConsentInformation consentInformation;

    private String appId = "";
    private boolean testMode = false;
    private int timingSeconds = 60;
    private final Map<String, String> units = new HashMap<>();
    private final java.util.Set<String> formats = new java.util.HashSet<>();

    private AdView bannerView;
    private InterstitialAd interstitialAd;
    private RewardedAd rewardedAd;
    private RewardedInterstitialAd rewardedInterstitialAd;
    private AppOpenAd appOpenAd;
    private Activity currentActivity;
    private WebView bridgeWebView;
    private long lastInterstitialAt = 0;
    private long appOpenLoadedAt = 0;
    private boolean appForegroundedOnce = false;
    private boolean loadingInterstitial = false;
    private boolean loadingRewarded = false;
    private boolean loadingRewardedInterstitial = false;
    private boolean loadingAppOpen = false;

    private AdsController(Application app) { this.app = app; }

    public static synchronized AdsController init(Application app) {
        if (instance == null) {
            instance = new AdsController(app);
            instance.loadConfig();
            app.registerActivityLifecycleCallbacks(instance);
        }
        return instance;
    }

    public static synchronized AdsController get() { return instance; }

    private void loadConfig() {
        try (InputStream in = app.getAssets().open("uapp-ads.json")) {
            byte[] buf = new byte[in.available()];
            int read = in.read(buf);
            JSONObject cfg = new JSONObject(new String(buf, 0, Math.max(read, 0), StandardCharsets.UTF_8));
            appId = cfg.optString("appId", "");
            testMode = cfg.optBoolean("testMode", false);
            timingSeconds = Math.max(10, cfg.optInt("timingSeconds", 60));
            JSONObject u = cfg.optJSONObject("units");
            if (u != null) for (java.util.Iterator<String> it = u.keys(); it.hasNext(); ) { String k = it.next(); units.put(k, u.optString(k)); }
            org.json.JSONArray f = cfg.optJSONArray("formats");
            if (f != null) for (int i = 0; i < f.length(); i++) formats.add(f.optString(i).toLowerCase(Locale.US));
        } catch (Exception e) { Log.w(TAG, "No ads config; ads disabled."); }
    }

    public boolean enabled() { return !appId.isEmpty() && !formats.isEmpty(); }
    public boolean privacyOptionsRequired() { return privacyOptionsRequired; }

    public void attachBridge(WebView web) {
        this.bridgeWebView = web;
        web.addJavascriptInterface(new Bridge(), "UAppAds");
    }

    private void gatherConsent(Activity activity) {
        if (!enabled() || !consentStarted.compareAndSet(false, true)) return;
        consentInformation = UserMessagingPlatform.getConsentInformation(activity);
        ConsentRequestParameters params = new ConsentRequestParameters.Builder().build();
        consentInformation.requestConsentInfoUpdate(activity, params,
            () -> {
                canRequestAds = consentInformation.canRequestAds();
                privacyOptionsRequired = consentInformation.getPrivacyOptionsRequirementStatus() == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED;
                UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity, formError -> {
                    canRequestAds = consentInformation.canRequestAds();
                    privacyOptionsRequired = consentInformation.getPrivacyOptionsRequirementStatus() == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED;
                    if (canRequestAds) startSdk();
                    dispatch("consent", canRequestAds ? "ready" : "unavailable");
                });
                if (canRequestAds) startSdk();
            },
            error -> {
                canRequestAds = consentInformation != null && consentInformation.canRequestAds();
                if (canRequestAds) startSdk();
                dispatch("consent", "error");
            });
    }

    private void startSdk() {
        if (!canRequestAds || !sdkStarted.compareAndSet(false, true)) return;
        // Next-Gen SDK requires initialization on a background thread.
        new Thread(() -> {
            try {
                MobileAds.initialize(app, new InitializationConfig.Builder(appId).build(), status -> {
                    initialized = true;
                    main.post(this::loadConfiguredAds);
                });
            } catch (Throwable t) {
                sdkStarted.set(false);
                Log.e(TAG, "SDK init failed", t);
                dispatch("init", "failed");
            }
        }, "uapp-ads-init").start();
    }

    private void loadConfiguredAds() {
        if (!initialized || !canRequestAds) return;
        if (hasFormat("banner") || hasFormat("adaptive banner") || hasFormat("mrec")) loadBanner();
        if (hasFormat("interstitial")) loadInterstitial();
        if (hasFormat("rewarded")) loadRewarded();
        if (hasFormat("rewarded interstitial")) loadRewardedInterstitial();
        if (hasFormat("app open")) loadAppOpen();
    }

    private boolean hasFormat(String f) { return formats.contains(f); }
    private String unit(String f) { return units.getOrDefault(f, units.getOrDefault("banner", "")); }

    private void loadBanner() {
        Activity activity = currentActivity;
        if (activity == null || activity.isFinishing()) return;
        String unitId = hasFormat("mrec") && !hasFormat("banner") && !hasFormat("adaptive banner") ? unit("mrec") : (hasFormat("adaptive banner") ? unit("adaptive banner") : unit("banner"));
        if (unitId.isEmpty()) return;
        if (bannerView != null) { bannerView.destroy(); bannerView = null; }
        bannerView = new AdView(activity);
        AdSize size;
        if (hasFormat("mrec") && !hasFormat("banner") && !hasFormat("adaptive banner")) size = AdSize.MEDIUM_RECTANGLE;
        else if (hasFormat("adaptive banner")) {
            DisplayMetrics dm = activity.getResources().getDisplayMetrics();
            int widthDp = Math.max(320, (int) (dm.widthPixels / dm.density));
            size = AdSize.getLargeAnchoredAdaptiveBannerAdSize(activity, widthDp);
        } else size = AdSize.BANNER;
        bannerView.loadAd(new BannerAdRequest.Builder(unitId, size).build(), new AdLoadCallback<BannerAd>() {
            @Override public void onAdLoaded(BannerAd ad) {
                main.post(() -> {
                    ad.setAdEventCallback(new BannerAdEventCallback() {
                        @Override public void onAdImpression() { dispatch("banner", "impression"); }
                        @Override public void onAdClicked() { dispatch("banner", "click"); }
                    });
                    showBannerView(activity);
                    dispatch("banner", "loaded");
                });
            }
            @Override public void onAdFailedToLoad(LoadAdError error) { dispatch("banner", "failed:" + error.getMessage()); }
        });
    }

    private void showBannerView(Activity activity) {
        if (bannerView == null) return;
        ViewGroup content = activity.findViewById(android.R.id.content);
        if (content == null) return;
        if (bannerView.getParent() instanceof ViewGroup) ((ViewGroup) bannerView.getParent()).removeView(bannerView);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM);
        content.addView(bannerView, lp);
        final View root = content.getChildCount() > 1 ? content.getChildAt(0) : null;
        if (root != null) bannerView.post(() -> root.setPadding(root.getPaddingLeft(), root.getPaddingTop(), root.getPaddingRight(), bannerView.getHeight()));
    }

    private void loadInterstitial() {
        if (loadingInterstitial || interstitialAd != null || !hasFormat("interstitial")) return;
        String id = unit("interstitial"); if (id.isEmpty()) return;
        loadingInterstitial = true;
        InterstitialAd.load(new AdRequest.Builder(id).build(), new AdLoadCallback<InterstitialAd>() {
            @Override public void onAdLoaded(InterstitialAd ad) {
                main.post(() -> {
                    loadingInterstitial = false;
                    interstitialAd = ad;
                    ad.setAdEventCallback(new InterstitialAdEventCallback() {
                        @Override public void onAdShowedFullScreenContent() { dispatch("interstitial", "show"); }
                        @Override public void onAdDismissedFullScreenContent() { interstitialAd = null; dispatch("interstitial", "dismiss"); main.postDelayed(() -> loadInterstitial(), 1500); }
                        @Override public void onAdFailedToShowFullScreenContent(FullScreenContentError e) { interstitialAd = null; loadingInterstitial = false; dispatch("interstitial", "show-failed"); loadInterstitial(); }
                    });
                    dispatch("interstitial", "ready");
                });
            }
            @Override public void onAdFailedToLoad(LoadAdError error) { main.post(() -> { loadingInterstitial = false; dispatch("interstitial", "failed:" + error.getMessage()); }); }
        });
    }

    private void loadRewarded() {
        if (loadingRewarded || rewardedAd != null || !hasFormat("rewarded")) return;
        String id = unit("rewarded"); if (id.isEmpty()) return;
        loadingRewarded = true;
        RewardedAd.load(new AdRequest.Builder(id).build(), new AdLoadCallback<RewardedAd>() {
            @Override public void onAdLoaded(RewardedAd ad) {
                main.post(() -> {
                    loadingRewarded = false;
                    rewardedAd = ad;
                    ad.setAdEventCallback(new RewardedAdEventCallback() {
                        @Override public void onAdDismissedFullScreenContent() { rewardedAd = null; dispatch("rewarded", "dismiss"); main.postDelayed(() -> loadRewarded(), 1500); }
                        @Override public void onAdFailedToShowFullScreenContent(FullScreenContentError e) { rewardedAd = null; loadingRewarded = false; dispatch("rewarded", "show-failed"); loadRewarded(); }
                    });
                    dispatch("rewarded", "ready");
                });
            }
            @Override public void onAdFailedToLoad(LoadAdError error) { main.post(() -> { loadingRewarded = false; dispatch("rewarded", "failed:" + error.getMessage()); }); }
        });
    }

    private void loadRewardedInterstitial() {
        if (loadingRewardedInterstitial || rewardedInterstitialAd != null || !hasFormat("rewarded interstitial")) return;
        String id = unit("rewarded interstitial"); if (id.isEmpty()) return;
        loadingRewardedInterstitial = true;
        RewardedInterstitialAd.load(new AdRequest.Builder(id).build(), new AdLoadCallback<RewardedInterstitialAd>() {
            @Override public void onAdLoaded(RewardedInterstitialAd ad) {
                main.post(() -> {
                    loadingRewardedInterstitial = false;
                    rewardedInterstitialAd = ad;
                    ad.setAdEventCallback(new RewardedInterstitialAdEventCallback() {
                        @Override public void onAdDismissedFullScreenContent() { rewardedInterstitialAd = null; dispatch("rewarded-interstitial", "dismiss"); main.postDelayed(() -> loadRewardedInterstitial(), 1500); }
                        @Override public void onAdFailedToShowFullScreenContent(FullScreenContentError e) { rewardedInterstitialAd = null; loadingRewardedInterstitial = false; dispatch("rewarded-interstitial", "show-failed"); loadRewardedInterstitial(); }
                    });
                    dispatch("rewarded-interstitial", "ready");
                });
            }
            @Override public void onAdFailedToLoad(LoadAdError error) { main.post(() -> { loadingRewardedInterstitial = false; dispatch("rewarded-interstitial", "failed:" + error.getMessage()); }); }
        });
    }

    private void loadAppOpen() {
        if (loadingAppOpen || appOpenAd != null || !hasFormat("app open")) return;
        String id = unit("app open"); if (id.isEmpty()) return;
        loadingAppOpen = true;
        AppOpenAd.load(new AdRequest.Builder(id).build(), new AdLoadCallback<AppOpenAd>() {
            @Override public void onAdLoaded(AppOpenAd ad) {
                main.post(() -> {
                    loadingAppOpen = false;
                    appOpenAd = ad;
                    appOpenLoadedAt = System.currentTimeMillis();
                    ad.setAdEventCallback(new AppOpenAdEventCallback() {
                        @Override public void onAdDismissedFullScreenContent() { appOpenAd = null; dispatch("app-open", "dismiss"); main.postDelayed(() -> loadAppOpen(), 1500); }
                        @Override public void onAdFailedToShowFullScreenContent(FullScreenContentError e) { appOpenAd = null; loadingAppOpen = false; dispatch("app-open", "show-failed"); loadAppOpen(); }
                    });
                    dispatch("app-open", "ready");
                });
            }
            @Override public void onAdFailedToLoad(LoadAdError error) { main.post(() -> { loadingAppOpen = false; dispatch("app-open", "failed:" + error.getMessage()); }); }
        });
    }

    public void request(String format) {
        main.post(() -> {
            String f = format == null ? "" : format.toLowerCase(Locale.US).replace('_', ' ').trim();
            if (!enabled() || !canRequestAds || !initialized) { dispatch(f, "not-ready"); return; }
            Activity activity = currentActivity;
            if (activity == null || activity.isFinishing()) { dispatch(f, "no-activity"); return; }
            switch (f) {
                case "banner": case "adaptive banner": case "mrec": loadBanner(); break;
                case "interstitial":
                    long now = System.currentTimeMillis();
                    if (interstitialAd != null && now - lastInterstitialAt >= timingSeconds * 1000L) { lastInterstitialAt = now; interstitialAd.show(activity); }
                    else { loadInterstitial(); dispatch(f, "not-ready"); }
                    break;
                case "rewarded":
                    if (rewardedAd != null) rewardedAd.show(activity, reward -> dispatch("rewarded", "reward:" + reward.getAmount() + ":" + reward.getType()));
                    else { loadRewarded(); dispatch(f, "not-ready"); }
                    break;
                case "rewarded interstitial": case "rewarded-interstitial":
                    if (rewardedInterstitialAd != null) rewardedInterstitialAd.show(activity, reward -> dispatch("rewarded-interstitial", "reward:" + reward.getAmount() + ":" + reward.getType()));
                    else { loadRewardedInterstitial(); dispatch(f, "not-ready"); }
                    break;
                case "app open": case "app-open":
                    if (appOpenAd != null && System.currentTimeMillis() - appOpenLoadedAt < 4 * 3600_000L) appOpenAd.show(activity);
                    else { appOpenAd = null; loadAppOpen(); dispatch(f, "not-ready"); }
                    break;
                default: dispatch(f, "unsupported-format");
            }
        });
    }

    public boolean isReady(String format) {
        String f = format == null ? "" : format.toLowerCase(Locale.US).replace('_', ' ').trim();
        switch (f) {
            case "banner": case "adaptive banner": case "mrec": return bannerView != null;
            case "interstitial": return interstitialAd != null;
            case "rewarded": return rewardedAd != null;
            case "rewarded interstitial": case "rewarded-interstitial": return rewardedInterstitialAd != null;
            case "app open": case "app-open": return appOpenAd != null && System.currentTimeMillis() - appOpenLoadedAt < 4 * 3600_000L;
            default: return false;
        }
    }

    public void showPrivacyOptions() {
        main.post(() -> {
            Activity activity = currentActivity;
            if (activity == null || consentInformation == null) return;
            UserMessagingPlatform.showPrivacyOptionsForm(activity, error -> {
                canRequestAds = consentInformation.canRequestAds();
                privacyOptionsRequired = consentInformation.getPrivacyOptionsRequirementStatus() == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED;
                dispatch("privacy", error == null ? "updated" : "error");
            });
        });
    }

    private void dispatch(String format, String event) {
        WebView web = bridgeWebView;
        if (web == null) return;
        String payload = "{\"format\":\"" + escape(format) + "\",\"event\":\"" + escape(event) + "\"}";
        main.post(() -> web.evaluateJavascript("window.UAppAdsEvents&&window.UAppAdsEvents.dispatch(" + payload + ");", null));
    }
    private static String escape(String s) { return s == null ? "" : s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " "); }

    @Override public void onActivityResumed(Activity activity) {
        currentActivity = activity;
        if (enabled()) {
            gatherConsent(activity);
            if (initialized && canRequestAds) {
                if (hasFormat("banner") || hasFormat("adaptive banner") || hasFormat("mrec")) showBannerView(activity);
                if (appForegroundedOnce && hasFormat("app open") && appOpenAd != null && System.currentTimeMillis() - appOpenLoadedAt < 4 * 3600_000L) appOpenAd.show(activity);
                else if (appOpenAd != null && System.currentTimeMillis() - appOpenLoadedAt >= 4 * 3600_000L) { appOpenAd = null; loadAppOpen(); }
            }
            appForegroundedOnce = true;
        }
    }
    @Override public void onActivityPaused(Activity activity) { if (currentActivity == activity) currentActivity = null; }
    @Override public void onActivityCreated(Activity activity, Bundle savedInstanceState) {}
    @Override public void onActivityStarted(Activity activity) {}
    @Override public void onActivityStopped(Activity activity) {}
    @Override public void onActivitySaveInstanceState(Activity activity, Bundle outState) {}
    @Override public void onActivityDestroyed(Activity activity) {
        if (bannerView != null && bannerView.getContext() == activity) { bannerView.destroy(); bannerView = null; }
    }

    /** JS bridge: window.UAppAds.request('rewarded'), .isReady('interstitial'), .privacyOptions(). */
    public final class Bridge {
        @JavascriptInterface public void load(String json) { try { request(new JSONObject(json).optString("format")); } catch (Exception e) { request(json); } }
        @JavascriptInterface public void request(String format) { AdsController.this.request(format); }
        @JavascriptInterface public boolean isReady(String format) { return AdsController.this.isReady(format); }
        @JavascriptInterface public void privacyOptions() { showPrivacyOptions(); }
        @JavascriptInterface public boolean privacyOptionsRequired() { return privacyOptionsRequired; }
    }
}

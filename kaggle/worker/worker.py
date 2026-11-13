# U APP Android build worker (runs inside a private Kaggle notebook).
# The server injects JOB via the UAPP_JOB_PAYLOAD cell. This file is the
# single source of truth; scripts/sync-worker.mjs regenerates worker.ipynb.
import base64
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.request
import zipfile

WORK = "/kaggle/working"
OUT = os.path.join(WORK, "out")
LOG_PATH = os.path.join(WORK, "build.log")
try:
    TEMPLATES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates")
except NameError:  # executed inside a notebook cell
    TEMPLATES = os.path.join(WORK, "templates")
MAX_SOURCE_BYTES = 200 * 1024 * 1024

PERM_MAP = {
    "internet": "INTERNET", "network": "ACCESS_NETWORK_STATE", "notifications": "POST_NOTIFICATIONS",
    "camera": "CAMERA", "microphone": "RECORD_AUDIO", "location": "ACCESS_FINE_LOCATION",
    "bluetooth": "BLUETOOTH_CONNECT", "nfc": "NFC", "media": "READ_MEDIA_IMAGES",
    "contacts": "READ_CONTACTS", "calendar": "READ_CALENDAR", "vibration": "VIBRATE",
    "wakelock": "WAKE_LOCK", "foreground": "FOREGROUND_SERVICE", "storage": "READ_EXTERNAL_STORAGE",
    "biometric": "USE_BIOMETRIC",
}
JAVA_KEYWORDS = {"abstract", "assert", "boolean", "break", "byte", "case", "catch", "char", "class", "const", "continue", "default", "do", "double", "else", "enum", "extends", "final", "finally", "float", "for", "goto", "if", "implements", "import", "instanceof", "int", "interface", "long", "native", "new", "package", "private", "protected", "public", "return", "short", "static", "strictfp", "super", "switch", "synchronized", "this", "throw", "throws", "transient", "try", "void", "volatile", "while", "true", "false", "null"}


def log(line):
    text = str(line)
    print(text, flush=True)
    with open(LOG_PATH, "a", encoding="utf-8") as fh:
        fh.write(text + "\n")


def run(cmd, cwd=None, check=True, env=None, tail=80):
    log("$ " + (cmd if isinstance(cmd, str) else " ".join(cmd)))
    proc = subprocess.run(cmd, shell=isinstance(cmd, str), cwd=cwd, env=env,
                          stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    for line in (proc.stdout or "").splitlines()[-tail:]:
        log(line)
    if check and proc.returncode != 0:
        raise RuntimeError("Command failed (%s): %s" % (proc.returncode, cmd if isinstance(cmd, str) else cmd[0]))
    return proc.returncode


def perm_name(value):
    key = str(value).lower().replace("android.permission.", "")
    return PERM_MAP.get(key, str(value).upper())


def xml_escape(value):
    return (str(value).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;").replace("'", "&apos;"))


def java_string(value):
    return json.dumps(str(value))


def color_int(value):
    v = str(value or "#080a0d").lstrip("#")
    if not re.fullmatch(r"[0-9a-fA-F]{6}", v):
        v = "080a0d"
    return "0xFF" + v.upper()


def safe_package_parts(package_id):
    parts = []
    for part in package_id.split("."):
        if part in JAVA_KEYWORDS or not re.fullmatch(r"[a-z][a-z0-9_]*", part):
            part = "app_" + part
        parts.append(part)
    return ".".join(parts)


def download_source(job):
    url = job.get("sourceUrl")
    if not url:
        return None
    dest = os.path.join(WORK, "source.zip")
    log("Downloading preserved source archive…")
    req = urllib.request.Request(url, headers={"User-Agent": "uapp-worker/3.0"})
    total = 0
    with urllib.request.urlopen(req, timeout=300) as resp, open(dest, "wb") as fh:
        while True:
            chunk = resp.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > MAX_SOURCE_BYTES:
                raise RuntimeError("Source archive exceeds the worker size limit")
            fh.write(chunk)
    log("Source downloaded (%.2f MB)" % (total / 1024 / 1024))
    return dest


def safe_extract(zip_path, dest):
    os.makedirs(dest, exist_ok=True)
    dest_real = os.path.realpath(dest)
    with zipfile.ZipFile(zip_path) as z:
        infos = z.infolist()
        if len(infos) > 20000:
            raise RuntimeError("Archive has too many entries")
        total = sum(i.file_size for i in infos)
        if total > max(os.path.getsize(zip_path) * 100, 512 * 1024 * 1024):
            raise RuntimeError("Archive expansion ratio is unsafe")
        for member in infos:
            name = member.filename
            if name.startswith("/") or ".." in name.split("/") or "\\" in name:
                raise RuntimeError("Unsafe ZIP entry rejected: " + name)
            mode = (member.external_attr >> 16) & 0o170000
            if mode == 0o120000:
                raise RuntimeError("Symlink ZIP entry rejected: " + name)
            target = os.path.realpath(os.path.join(dest, name))
            if target != dest_real and not target.startswith(dest_real + os.sep):
                raise RuntimeError("Unsafe ZIP entry rejected: " + name)
        z.extractall(dest)
    return dest


def find_project_root(root):
    candidates = glob.glob(os.path.join(root, "**", "settings.gradle"), recursive=True) + \
                 glob.glob(os.path.join(root, "**", "settings.gradle.kts"), recursive=True)
    candidates = [c for c in candidates if "/build/" not in c and "/.gradle/" not in c and "/node_modules/" not in c]
    if not candidates:
        return None
    candidates.sort(key=lambda p: (p.count(os.sep), len(p)))
    return os.path.dirname(candidates[0])


def find_web_root(root):
    candidates = glob.glob(os.path.join(root, "**", "index.html"), recursive=True) + \
                 glob.glob(os.path.join(root, "**", "index.htm"), recursive=True)
    candidates = [c for c in candidates if "/node_modules/" not in c and "/build/" not in c and "/.gradle/" not in c]
    if not candidates:
        return None
    candidates.sort(key=lambda p: (p.count(os.sep), len(p)))
    return os.path.dirname(candidates[0])


def template(name):
    # In the notebook, templates are embedded in the JOB payload by the server.
    job = globals().get("JOB") or {}
    embedded = (job.get("templates") or {}).get(name)
    if embedded is not None:
        return embedded
    with open(os.path.join(TEMPLATES, name), encoding="utf-8") as fh:
        return fh.read()


def write_shell_project(project, job, web_root=None):
    """Generate the Android shell around a URL or bundled web assets."""
    pkg = safe_package_parts(job["packageId"])
    job["resolvedPackage"] = pkg
    java_dir = os.path.join(project, "app", "src", "main", "java", pkg.replace(".", "/"))
    res_dir = os.path.join(project, "app", "src", "main", "res")
    assets = os.path.join(project, "app", "src", "main", "assets")
    os.makedirs(java_dir, exist_ok=True)
    os.makedirs(os.path.join(res_dir, "layout"), exist_ok=True)
    os.makedirs(os.path.join(res_dir, "values"), exist_ok=True)
    os.makedirs(os.path.join(res_dir, "mipmap-anydpi-v26"), exist_ok=True)
    os.makedirs(os.path.join(res_dir, "drawable"), exist_ok=True)
    os.makedirs(assets, exist_ok=True)

    with open(os.path.join(project, "settings.gradle"), "w", encoding="utf-8") as fh:
        fh.write("rootProject.name = %s\ninclude ':app'\n" % java_string(re.sub(r"[^A-Za-z0-9 _-]", "", job["name"])[:40] or "UApp"))
    with open(os.path.join(project, "build.gradle"), "w", encoding="utf-8") as fh:
        fh.write("""buildscript {
    repositories { google(); mavenCentral() }
    dependencies { classpath 'com.android.tools.build:gradle:8.13.0' }
}
allprojects { repositories { google(); mavenCentral() } }
""")
    with open(os.path.join(project, "gradle.properties"), "w", encoding="utf-8") as fh:
        fh.write("org.gradle.jvmargs=-Xmx3g -Dfile.encoding=UTF-8\nandroid.useAndroidX=true\nandroid.nonTransitiveRClass=true\n")

    ads = job.get("ads")
    # The ads runtime is always compiled in; without a config it stays inert.
    deps = """
    implementation 'com.google.android.libraries.ads.mobile.sdk:ads-mobile-sdk:1.6.0'
    implementation 'com.google.android.ump:user-messaging-platform:4.0.0'
"""
    with open(os.path.join(project, "app", "build.gradle"), "w", encoding="utf-8") as fh:
        fh.write("""apply plugin: 'com.android.application'
android {
    namespace '%s'
    compileSdk 36
    defaultConfig {
        applicationId '%s'
        minSdk 24
        targetSdk 36
        versionCode 1
        versionName %s
    }
    buildTypes {
        release { minifyEnabled false }
    }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
}
dependencies {%s}
""" % (pkg, pkg, java_string(job.get("version", "1.0.0")), deps))

    perms = sorted({perm_name(p) for p in (job.get("permissions") or ["internet", "network"])} | {"INTERNET", "ACCESS_NETWORK_STATE"})
    perm_xml = "\n".join('    <uses-permission android:name="android.permission.%s" />' % p for p in perms)
    ads_meta = ""
    ads_provider = ""
    if ads:
        ads_meta = '\n        <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="%s" />' % xml_escape(ads["appId"])
        ads_provider = """
        <provider
            android:name=".AdsInitProvider"
            android:authorities="${applicationId}.adsinit"
            android:exported="false" />"""
    manifest = """<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
%s
    <application
        android:label="%s"
        android:icon="@mipmap/ic_launcher"
        android:roundIcon="@mipmap/ic_launcher"
        android:theme="@style/AppTheme"
        android:usesCleartextTraffic="false"
        android:hardwareAccelerated="true">
        <activity android:name=".MainActivity" android:exported="true" android:configChanges="orientation|screenSize|keyboardHidden">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>%s%s
    </application>
</manifest>
""" % (perm_xml, xml_escape(job["name"]), ads_meta, ads_provider)
    with open(os.path.join(project, "app", "src", "main", "AndroidManifest.xml"), "w", encoding="utf-8") as fh:
        fh.write(manifest)

    source = job.get("source") or {}
    source_url = source.get("url", "") if source.get("kind") == "url" else ""
    main_java = template("MainActivity.java").replace("__PACKAGE__", pkg).replace("__SOURCE_URL__", source_url.replace("\\", "\\\\").replace('"', '\\"')).replace("__SPLASH_COLOR__", color_int(job.get("splash")))
    with open(os.path.join(java_dir, "MainActivity.java"), "w", encoding="utf-8") as fh:
        fh.write(main_java)
    with open(os.path.join(java_dir, "AdsController.java"), "w", encoding="utf-8") as fh:
        fh.write(template("AdsController.java").replace("__PACKAGE__", pkg))
    with open(os.path.join(java_dir, "AdsInitProvider.java"), "w", encoding="utf-8") as fh:
        fh.write(template("AdsInitProvider.java").replace("__PACKAGE__", pkg))
    with open(os.path.join(res_dir, "layout", "offline.xml"), "w", encoding="utf-8") as fh:
        fh.write(template("offline.xml"))
    with open(os.path.join(res_dir, "values", "styles.xml"), "w", encoding="utf-8") as fh:
        fh.write("""<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="android:Theme.Material.Light.NoActionBar">
        <item name="android:windowBackground">%s</item>
        <item name="android:statusBarColor">%s</item>
    </style>
</resources>
""" % (color_int(job.get("splash")), color_int(job.get("splash"))))
    icon_color = job.get("iconColor") or job.get("splash") or "#c9f65b"
    with open(os.path.join(res_dir, "drawable", "ic_launcher_foreground.xml"), "w", encoding="utf-8") as fh:
        fh.write("""<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">
    <path android:fillColor="#111605" android:pathData="M34,30v26a20,20 0 0 0 40,0V30h-9v26a11,11 0 0 1 -22,0V30z"/>
</vector>
""")
    with open(os.path.join(res_dir, "values", "ic_launcher_background.xml"), "w", encoding="utf-8") as fh:
        fh.write('<?xml version="1.0" encoding="utf-8"?>\n<resources><color name="ic_launcher_background">%s</color></resources>\n' % (str(icon_color) if re.fullmatch(r"#[0-9a-fA-F]{6}", str(icon_color)) else "#c9f65b"))
    with open(os.path.join(res_dir, "mipmap-anydpi-v26", "ic_launcher.xml"), "w", encoding="utf-8") as fh:
        fh.write("""<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>
""")
    # Pre-26 launcher icon: layer-list in mipmap-anydpi (valid on all API levels).
    os.makedirs(os.path.join(res_dir, "mipmap-anydpi"), exist_ok=True)
    with open(os.path.join(res_dir, "mipmap-anydpi", "ic_launcher.xml"), "w", encoding="utf-8") as fh:
        fh.write("""<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/ic_launcher_background"/>
    <item android:drawable="@drawable/ic_launcher_foreground"/>
</layer-list>
""")

    if ads:
        with open(os.path.join(assets, "uapp-ads.json"), "w", encoding="utf-8") as fh:
            json.dump({"appId": ads["appId"], "formats": ads["formats"], "units": ads["units"], "timingSeconds": ads.get("timingSeconds", 60), "testMode": ads.get("testMode", False), "sdk": "gma-next-gen-1.6.0"}, fh)

    www = os.path.join(assets, "www")
    os.makedirs(www, exist_ok=True)
    if web_root:
        for root, dirs, files in os.walk(web_root):
            dirs[:] = [d for d in dirs if d not in {"node_modules", ".git", ".gradle", "build"}]
            rel = os.path.relpath(root, web_root)
            target_dir = www if rel == "." else os.path.join(www, rel)
            os.makedirs(target_dir, exist_ok=True)
            for name in files:
                if name.startswith(".env") or name in {"package-lock.json", "yarn.lock"}:
                    continue
                shutil.copy2(os.path.join(root, name), os.path.join(target_dir, name))
        log("Bundled web assets from " + os.path.relpath(web_root, WORK))
    elif not source_url:
        with open(os.path.join(www, "index.html"), "w", encoding="utf-8") as fh:
            fh.write("<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>%s</title></head><body style='font-family:system-ui;padding:24px'><h1>%s</h1><p>No web source was provided.</p></body></html>" % (xml_escape(job["name"]), xml_escape(job["name"])))


def inject_ads_into_gradle(project, job):
    """Best-effort ads injection for uploaded Gradle projects.

    Adds the Next-Gen SDK + UMP dependencies and the ads runtime to the first
    application module. If the module layout is unusual, fails loudly instead
    of silently shipping an APK without the requested ads.
    """
    ads = job.get("ads")
    if not ads:
        return
    app_gradles = glob.glob(os.path.join(project, "**", "build.gradle"), recursive=True) + \
                  glob.glob(os.path.join(project, "**", "build.gradle.kts"), recursive=True)
    app_gradles = [g for g in app_gradles if "com.android.application" in open(g, encoding="utf-8", errors="ignore").read()]
    if not app_gradles:
        raise RuntimeError("Ads were requested but no Android application module was found in the uploaded project")
    app_gradles.sort(key=lambda p: (p.count(os.sep), len(p)))
    gradle_file = app_gradles[0]
    module_dir = os.path.dirname(gradle_file)
    text = open(gradle_file, encoding="utf-8").read()
    if "ads-mobile-sdk" not in text:
        if gradle_file.endswith(".kts"):
            deps_block = '\ndependencies {\n    implementation("com.google.android.libraries.ads.mobile.sdk:ads-mobile-sdk:1.6.0")\n    implementation("com.google.android.ump:user-messaging-platform:4.0.0")\n}\n'
        else:
            deps_block = "\ndependencies {\n    implementation 'com.google.android.libraries.ads.mobile.sdk:ads-mobile-sdk:1.6.0'\n    implementation 'com.google.android.ump:user-messaging-platform:4.0.0'\n}\n"
        with open(gradle_file, "a", encoding="utf-8") as fh:
            fh.write(deps_block)
    main_dir = os.path.join(module_dir, "src", "main")
    manifest_path = os.path.join(main_dir, "AndroidManifest.xml")
    if not os.path.exists(manifest_path):
        raise RuntimeError("Ads injection failed: application AndroidManifest.xml not found")
    manifest = open(manifest_path, encoding="utf-8").read()
    if "com.google.android.gms.ads.APPLICATION_ID" not in manifest:
        meta = '<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="%s" />' % xml_escape(ads["appId"])
        manifest = re.sub(r"(<application[^>]*>)", r"\1\n        " + meta.replace("\\", "\\\\"), manifest, count=1)
    # Determine package/namespace for generated classes.
    namespace = None
    m = re.search(r"namespace\s*=?\s*['\"]([A-Za-z0-9_.]+)['\"]", text)
    if m:
        namespace = m.group(1)
    if not namespace:
        m = re.search(r'package="([A-Za-z0-9_.]+)"', manifest)
        namespace = m.group(1) if m else job["packageId"]
    pkg = safe_package_parts(namespace)
    java_dir = os.path.join(main_dir, "java", pkg.replace(".", "/"))
    os.makedirs(java_dir, exist_ok=True)
    for name in ("AdsController.java", "AdsInitProvider.java"):
        with open(os.path.join(java_dir, name), "w", encoding="utf-8") as fh:
            fh.write(template(name).replace("__PACKAGE__", pkg))
    if "AdsInitProvider" not in manifest:
        provider = '\n        <provider android:name="%s.AdsInitProvider" android:authorities="${applicationId}.adsinit" android:exported="false" />' % pkg
        manifest = manifest.replace("</application>", provider + "\n    </application>", 1)
    with open(manifest_path, "w", encoding="utf-8") as fh:
        fh.write(manifest)
    assets = os.path.join(main_dir, "assets")
    os.makedirs(assets, exist_ok=True)
    with open(os.path.join(assets, "uapp-ads.json"), "w", encoding="utf-8") as fh:
        json.dump({"appId": ads["appId"], "formats": ads["formats"], "units": ads["units"], "timingSeconds": ads.get("timingSeconds", 60), "testMode": ads.get("testMode", False), "sdk": "gma-next-gen-1.6.0"}, fh)
    log("Ads runtime injected into module " + os.path.relpath(module_dir, project))


def setup_toolchain():
    log("Installing JDK 17 + Android SDK 36 + Gradle 8.13…")
    run("apt-get update -qq || sudo apt-get update -qq", check=False)
    run("(apt-get install -y -qq openjdk-17-jdk-headless unzip curl || sudo apt-get install -y -qq openjdk-17-jdk-headless unzip curl)", check=False)
    run("java -version", check=False)
    sdk = os.environ.get("ANDROID_SDK_ROOT") or os.environ.get("ANDROID_HOME") or "/opt/android-sdk"
    if not os.path.isdir(os.path.join(sdk, "cmdline-tools", "latest")):
        os.makedirs(sdk, exist_ok=True)
        url = "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
        run(f"curl -fsSL {url} -o /tmp/cmdline.zip && mkdir -p {sdk}/cmdline-tools && unzip -q -o /tmp/cmdline.zip -d {sdk}/cmdline-tools && rm -rf {sdk}/cmdline-tools/latest && mv {sdk}/cmdline-tools/cmdline-tools {sdk}/cmdline-tools/latest")
    env = dict(os.environ, ANDROID_SDK_ROOT=sdk, ANDROID_HOME=sdk)
    run(f"yes | {sdk}/cmdline-tools/latest/bin/sdkmanager --licenses >/dev/null 2>&1 || true", env=env, check=False)
    run(f"{sdk}/cmdline-tools/latest/bin/sdkmanager 'platform-tools' 'platforms;android-36' 'build-tools;36.0.0'", env=env)
    gradle_bin = shutil.which("gradle")
    if not gradle_bin or not os.path.isdir("/opt/gradle-8.13"):
        run("curl -fsSL https://services.gradle.org/distributions/gradle-8.13-bin.zip -o /tmp/gradle.zip && unzip -q -o /tmp/gradle.zip -d /opt")
        gradle_bin = "/opt/gradle-8.13/bin/gradle"
    run(f"{gradle_bin} --version", env=env, check=False)
    return env, sdk, gradle_bin


def upload_artifacts(job):
    url = job.get("uploadUrl")
    token = job.get("uploadToken")
    if not url or not token:
        return
    boundary = "----uappboundary%d" % int(time.time())
    files = [f for f in os.listdir(OUT) if re.search(r"\.(apk|aab|log|txt|json)$", f, re.I)]
    if not files:
        return
    body = b""
    for name in files:
        path = os.path.join(OUT, name)
        with open(path, "rb") as fh:
            data = fh.read()
        body += ("--%s\r\nContent-Disposition: form-data; name=\"file\"; filename=\"%s\"\r\nContent-Type: application/octet-stream\r\n\r\n" % (boundary, name)).encode() + data + b"\r\n"
    body += ("--%s--\r\n" % boundary).encode()
    req = urllib.request.Request(url, data=body, method="POST", headers={
        "Content-Type": "multipart/form-data; boundary=%s" % boundary,
        "Authorization": "Bearer %s" % token,
        "User-Agent": "uapp-worker/3.0",
    })
    try:
        with urllib.request.urlopen(req, timeout=600) as resp:
            log("Artifacts uploaded to the build server (HTTP %s)" % resp.status)
    except Exception as exc:
        log("Artifact upload failed (will fall back to kernel output): %s" % exc)


def main():
    os.makedirs(OUT, exist_ok=True)
    job = globals().get("JOB")
    if not isinstance(job, dict) or not job.get("jobId"):
        raise RuntimeError("JOB payload missing — server must inject the UAPP_JOB_PAYLOAD cell")
    log("U APP build start · job " + job["jobId"])
    log("App: %s · %s · %s" % (job["name"], job["packageId"], job.get("type")))
    env, sdk, gradle_bin = setup_toolchain()
    project_root = os.path.join(WORK, "project")
    os.makedirs(project_root, exist_ok=True)
    zip_path = download_source(job)
    is_gradle = False
    web_root = None
    if zip_path:
        extracted = safe_extract(zip_path, os.path.join(WORK, "source"))
        gradle_root = find_project_root(extracted)
        if gradle_root:
            is_gradle = True
            project_root = gradle_root
            log("Detected native Android project: " + os.path.relpath(gradle_root, WORK))
        else:
            web_root = find_web_root(extracted)
            if not web_root:
                raise RuntimeError("ZIP contains neither a Gradle project nor an index.html web entry point")
            log("Detected static web project: " + os.path.relpath(web_root, WORK))
    if not is_gradle:
        write_shell_project(project_root, job, web_root)
    else:
        inject_ads_into_gradle(project_root, job)
    with open(os.path.join(project_root, "local.properties"), "w", encoding="utf-8") as fh:
        fh.write("sdk.dir=%s\n" % sdk)
    wrapper = os.path.join(project_root, "gradlew")
    if os.path.exists(wrapper):
        os.chmod(wrapper, 0o755)
        build_cmd = ["./gradlew", "assembleDebug", "--no-daemon", "--stacktrace"]
        bundle_cmd = ["./gradlew", "bundleRelease", "--no-daemon", "--stacktrace"]
    else:
        build_cmd = [gradle_bin, "assembleDebug", "--no-daemon", "--stacktrace", "-p", project_root]
        bundle_cmd = [gradle_bin, "bundleRelease", "--no-daemon", "--stacktrace", "-p", project_root]
    log("Building debug APK…")
    run(build_cmd, cwd=project_root, env=env, tail=120)
    apks = glob.glob(os.path.join(project_root, "**", "build", "outputs", "apk", "**", "*.apk"), recursive=True)
    if not apks:
        raise RuntimeError("Gradle succeeded but no APK was produced")
    for apk in apks:
        dest = os.path.join(OUT, "app-debug.apk" if len(apks) == 1 else os.path.basename(apk))
        shutil.copy2(apk, dest)
        log("APK ready: %s (%.2f MB)" % (os.path.basename(dest), os.path.getsize(dest) / 1024 / 1024))
    log("Building release AAB (unsigned)…")
    try:
        run(bundle_cmd, cwd=project_root, env=env, tail=80)
        aabs = glob.glob(os.path.join(project_root, "**", "build", "outputs", "bundle", "**", "*.aab"), recursive=True)
        for aab in aabs:
            dest = os.path.join(OUT, "app-release-unsigned.aab")
            shutil.copy2(aab, dest)
            log("AAB ready: %s (%.2f MB)" % (os.path.basename(dest), os.path.getsize(dest) / 1024 / 1024))
    except Exception as exc:
        log("AAB build failed (APK is still valid): %s" % exc)
    shutil.copy2(LOG_PATH, os.path.join(OUT, "build.log"))
    with open(os.path.join(OUT, "build-meta.json"), "w", encoding="utf-8") as fh:
        json.dump({"jobId": job["jobId"], "packageId": job.get("resolvedPackage", job["packageId"]), "adsSdk": "com.google.android.libraries.ads.mobile.sdk:ads-mobile-sdk:1.6.0" if job.get("ads") else None, "umpSdk": "com.google.android.ump:user-messaging-platform:4.0.0" if job.get("ads") else None, "artifacts": os.listdir(OUT)}, fh, indent=2)
    upload_artifacts(job)
    log("Build complete.")


if __name__ in ("__main__", "__builtin__", "builtins"):
    main()

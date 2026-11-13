import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  Boxes,
  Braces,
  Check,
  CheckCircle2,
  ChevronDown,
  Code2,
  Download,
  FileArchive,
  GitBranch,
  Globe2,
  KeyRound,
  Layers,
  Lock,
  Mail,
  Play,
  Search,
  Server,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Terminal,
  Timer,
  Upload,
  Wand2,
} from "lucide-react";
import { PublicFooter, PublicNav } from "@/components/PublicChrome";
import { TemplateMini } from "@/components/TemplateMini";
import { PlanCard } from "@/components/PlanCard";
import { Badge, Button, buttonClass, Card, SectionLabel, CopyButton } from "@/components/ui";
import { APP_TYPES, CODE_SAMPLES, FAQS, PLANS, SUPPORT_EMAIL, TEMPLATES } from "@/data/catalog";
import { inr, useStore } from "@/lib/store";
import { cn } from "@/utils/cn";

export default function Landing() {
  const { state } = useStore();
  const navigate = useNavigate();
  const [faq, setFaq] = useState<number | null>(0);

  const start = () => {
    if (state.user) navigate("/app");
    else navigate("/register");
  };

  const openWorkspace = () => navigate("/app");

  const choosePlan = (id: string) => {
    if (id === "free") {
      if (state.user) navigate("/app");
      else navigate("/register");
      return;
    }
    navigate(state.user ? `/pay?plan=${id}` : `/register?plan=${id}`);
  };

  return (
    <div className="min-h-screen bg-bg">
      <PublicNav />
      <Hero start={start} openWorkspace={openWorkspace} />

      <section className="border-y border-line bg-panel/40">
        <div className="mx-auto grid max-w-[1240px] grid-cols-2 divide-x divide-line px-0 sm:grid-cols-4">
          {[
            ["12", "supported project types"],
            ["54", "production UI templates"],
            ["16", "ad network integrations"],
            ["9 min", "signed temporary downloads"],
          ].map(([n, l], i) => (
            <div key={l} className={cn("px-5 py-7 sm:px-8", i > 1 && "border-t border-line sm:border-t-0")}>
              <div className="font-display text-2xl font-bold tracking-tight text-ink sm:text-[28px]">{n}</div>
              <div className="mt-1 text-[11.5px] text-muted">{l}</div>
            </div>
          ))}
        </div>
      </section>

      <ProductSection />
      <FlowSection />
      <AdsSection />
      <BuildSection />
      <TemplateSection />
      <ApiSection />
      <PricingSection onChoose={choosePlan} />
      <SupportFaq faq={faq} setFaq={setFaq} />

      <section className="px-5 pb-20 pt-6 sm:px-8">
        <div className="noise relative mx-auto max-w-[1240px] overflow-hidden rounded-[28px] border border-line bg-[#0a0c10] px-6 py-14 text-center sm:px-12 sm:py-20">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,rgba(201,246,91,.18),transparent_70%)]" />
          <div className="pointer-events-none absolute inset-0 dot-bg opacity-[0.07]" />
          <div className="relative mx-auto max-w-2xl">
            <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl border border-lime/25 bg-lime/10">
              <Wand2 className="h-6 w-6 text-lime" />
            </div>
            <h2 className="font-display text-3xl font-bold leading-[1.05] tracking-tight text-[#f4f6ef] sm:text-5xl">
              Your idea is already an app.
              <br />
              <span className="text-gradient">It just needs a launch button.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-[13.5px] leading-relaxed text-[#99a096]">
              Start with three free app credits every month. Configure, build and download from one premium workspace.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button variant="lime" size="lg" onClick={start}>
                Start building free <ArrowRight className="h-4 w-4" />
              </Button>
              <button onClick={openWorkspace} className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/15 px-6 text-sm font-semibold text-[#e9ede2] transition hover:bg-white/5">
                <Play className="h-3.5 w-3.5 text-lime" /> Open your workspace
              </button>
            </div>
            <p className="mt-5 text-[11px] text-[#778073]">No credit card required · Free plan includes 3 apps every calendar month</p>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}

/* ------------------------------------------------------------------ Hero */

function Hero({ start, openWorkspace }: { start: () => void; openWorkspace: () => void }) {
  return (
    <section className="hero-glow relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-[0.28] [mask-image:linear-gradient(to_bottom,black,transparent_88%)]" />
      <div className="relative mx-auto grid max-w-[1240px] gap-16 px-5 pb-20 pt-14 sm:px-8 lg:grid-cols-[1.03fr_.97fr] lg:items-center lg:pt-20">
        <div className="animate-rise">
          <Badge tone="lime" className="mb-6 backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-lime" /> Premium app creation platform
          </Badge>
          <h1 className="font-display text-[42px] font-bold leading-[0.98] tracking-[-0.045em] text-ink sm:text-[62px] lg:text-[66px]">
            Build anything.
            <br />
            <span className="relative inline-block">
              <span className="text-gradient-hero">Launch everywhere.</span>
              <svg className="absolute -bottom-2 left-0 w-full" height="8" viewBox="0 0 400 8" fill="none" preserveAspectRatio="none" aria-hidden="true">
                <path d="M2 6C90 1 250 1 398 5" stroke="#c9f65b" strokeWidth="2.4" strokeLinecap="round" opacity=".65" />
              </svg>
            </span>
          </h1>
          <p className="mt-7 max-w-xl text-[14.5px] leading-relaxed text-muted sm:text-[15.5px]">
            Turn a website, HTML bundle, ZIP archive or Android project into a real, installable mobile app. One premium
            builder, a real build pipeline and a download that lands in minutes.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button variant="lime" size="lg" onClick={start} className="group">
              Start building free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
            <button
              onClick={openWorkspace}
              className={buttonClass("secondary", "lg", "bg-panel/60 backdrop-blur")}
            >
              <Play className="h-4 w-4 text-lime" /> Open workspace
            </button>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px] text-muted">
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-lime" /> 3 free apps every month</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-lime" /> No credit card</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-lime" /> Cancel anytime</span>
          </div>
          <div className="mt-9 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Build from</span>
            {["Website", "HTML", "ZIP", "Android", "PWA", "React Native"].map((t) => (
              <span key={t} className="rounded-full border border-line bg-panel/60 px-2.5 py-1 text-[10.5px] font-medium text-ink/80 backdrop-blur">{t}</span>
            ))}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-lime/30 bg-lime/10 px-2.5 py-1 text-[10.5px] font-semibold text-limeink dark:text-lime">
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-lime" /> Android build engine
            </span>
          </div>
        </div>
        <PhoneDemo />
      </div>
    </section>
  );
}

function PhoneDemo() {
  return (
    <div className="relative mx-auto w-full max-w-[460px] animate-rise" style={{ animationDelay: ".12s" }}>
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[430px] w-[430px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(201,246,91,.18),transparent_65%)] blur-2xl" />
      <div className="pointer-events-none absolute inset-x-8 bottom-4 top-16 rounded-[48px] border border-line bg-panel/40 backdrop-blur-sm" style={{ transform: "rotate(-5deg)" }} />
      <div className="relative mx-auto w-[286px] sm:w-[312px]" style={{ transform: "rotate(1.4deg)" }}>
        <div className="rounded-[42px] border-[7px] border-[#22252b] bg-[#0a0c10] p-0 shadow-[0_50px_100px_-30px_rgba(0,0,0,.7),inset_0_1px_0_rgba(255,255,255,.15)] ring-1 ring-white/10">
          <div className="relative overflow-hidden rounded-[35px]">
            <div className="absolute left-1/2 top-2 z-20 h-[22px] w-[92px] -translate-x-1/2 rounded-full bg-black" />
            <div className="px-4 pb-3 pt-2.5">
              <div className="flex items-center justify-between px-1 pb-2 text-[8.5px] font-medium text-[#8e958a]">
                <span>9:41</span>
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-3 rounded-sm bg-[#8e958a]" />
                  <span className="h-2 w-1 rounded-sm bg-[#8e958a]/60" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#c9f65b] text-[11px] font-extrabold text-[#121704]">U</div>
                  <div>
                    <div className="text-[10px] font-semibold text-[#f3f5ee]">Aarav Sharma</div>
                    <div className="text-[7.5px] text-[#8e958a]">Free plan · 1 credit left</div>
                  </div>
                </div>
                <div className="relative grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-[#141820] text-[9px] font-bold text-[#cfd4c8]">
                  AS
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-[#0a0c10] bg-lime" />
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-[#c9f65b]/20 bg-[linear-gradient(140deg,rgba(201,246,91,.13),rgba(201,246,91,.02))] p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[7px] font-semibold uppercase tracking-[0.15em] text-[#b6c09c]">Monthly allowance</div>
                    <div className="mt-1 flex items-end gap-1">
                      <span className="font-display text-[26px] font-bold leading-none text-[#f3f5ee]">1</span>
                      <span className="pb-0.5 text-[8px] text-[#8e958a]">of 3 credits left</span>
                    </div>
                  </div>
                  <div className="rounded-md bg-[#c9f65b] px-1.5 py-1 text-[7px] font-bold text-[#121704]">FREE</div>
                </div>
                <div className="mt-2.5 flex gap-1">
                  {[true, true, false].map((filled, i) => (
                    <span key={i} className={cn("h-1 flex-1 rounded-full", filled ? "bg-lime" : "bg-white/12")} />
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between text-[7px] text-[#9aa394]">
                  <span>Resets 1 December</span>
                  <span className="font-semibold text-lime">Upgrade →</span>
                </div>
              </div>

              <div className="mt-2.5 flex items-center justify-between">
                <span className="text-[8.5px] font-semibold text-[#e8ece2]">Latest build</span>
                <span className="text-[7px] text-[#8e958a]">View all</span>
              </div>
              <div className="mt-1.5 rounded-lg border border-white/10 bg-[#11151b] p-2.5">
                <div className="flex items-center gap-2">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-[linear-gradient(135deg,#c9f65b,#8ee03c)] text-[12px] font-extrabold text-[#121704]">N</div>
                  <div className="flex-1">
                    <div className="text-[8.5px] font-semibold text-[#f3f5ee]">Nimbus Store</div>
                    <div className="font-mono text-[6.5px] text-[#7c847b]">app.nimbus.store · 8.4 MB</div>
                  </div>
                  <div className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-1.5 py-0.5 text-[6.5px] font-bold uppercase tracking-wide text-emerald-300">Ready</div>
                </div>
                <div className="mt-2 flex gap-1.5">
                  <div className="flex flex-1 items-center justify-center gap-1 rounded-md bg-lime py-1.5 text-[7px] font-bold text-[#121704]">
                    <Download className="h-2.5 w-2.5" /> Download
                  </div>
                  <div className="flex items-center justify-center rounded-md border border-white/10 px-2 text-[7px] font-medium text-[#c5cbbc]">08:42 left</div>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {[
                  { icon: Globe2, label: "Website" },
                  { icon: FileArchive, label: "ZIP" },
                  { icon: Layers, label: "Template" },
                ].map(({ icon: Ico, label }) => (
                  <div key={label} className="rounded-lg border border-white/10 bg-[#0f1318] px-1.5 py-2 text-center">
                    <Ico className="mx-auto h-3 w-3 text-lime" />
                    <div className="mt-1 text-[6.5px] font-medium text-[#b6bdb0]">{label}</div>
                  </div>
                ))}
              </div>

              <div className="mt-2 flex items-center justify-around rounded-xl border border-white/10 bg-[#11151b] px-2 py-2">
                {["Home", "Apps", "Create", "API"].map((t, i) => (
                  <div key={t} className="flex flex-col items-center gap-0.5">
                    <div className={cn("h-3 w-3 rounded-[3px]", i === 0 ? "bg-lime" : "bg-white/15")} />
                    <span className={cn("text-[6px]", i === 0 ? "font-semibold text-lime" : "text-[#7c847b]")}>{t}</span>
                  </div>
                ))}
              </div>
              <div className="mx-auto mt-2 h-1 w-24 rounded-full bg-white/20" />
            </div>
          </div>
        </div>
      </div>

      <div className="animate-float absolute -left-2 top-24 hidden w-[168px] rounded-xl border border-line bg-panel/90 p-3 shadow-xl backdrop-blur-md sm:block">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/12 text-emerald-500"><CheckCircle2 className="h-3.5 w-3.5" /></div>
          <div>
            <div className="text-[10px] font-semibold text-ink">Build complete</div>
            <div className="text-[8px] text-muted">Debug APK · 01:48</div>
          </div>
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-panel2"><div className="h-full w-full rounded-full bg-lime" /></div>
      </div>

      <div className="animate-float-slow absolute -right-1 bottom-24 hidden w-[178px] rounded-xl border border-line bg-panel/90 p-3 shadow-xl backdrop-blur-md sm:block">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-muted">Temporary link</span>
          <Timer className="h-3 w-3 text-amber-400" />
        </div>
        <div className="mt-1 font-mono text-[19px] font-semibold tracking-tight text-ink">08:42</div>
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-panel2"><div className="h-full w-[88%] rounded-full bg-amber-400" /></div>
        <div className="mt-1.5 text-[8px] text-muted">Expires automatically after 9 minutes</div>
      </div>

      <div className="animate-float absolute -left-6 bottom-8 hidden items-center gap-2 rounded-xl border border-line bg-panel/90 px-3 py-2 shadow-lg backdrop-blur-md sm:flex" style={{ animationDelay: "1.2s" }}>
        <Layers className="h-3.5 w-3.5 text-lilac" />
        <span className="text-[10px] font-semibold text-ink">54 UI templates</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Product */

function ProductSection() {
  return (
    <section id="product" className="mx-auto max-w-[1240px] scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28">
      <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <SectionLabel>The builder</SectionLabel>
          <h2 className="mt-4 max-w-xl font-display text-3xl font-bold leading-[1.06] tracking-tight text-ink sm:text-[42px]">
            One engine. <span className="text-muted">Every way in.</span>
          </h2>
        </div>
        <p className="max-w-sm text-[13px] leading-relaxed text-muted">
          Bring what you already have. U APP handles validation, the Android shell, permissions and the build pipeline.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="group relative overflow-hidden p-6 lg:col-span-2">
          <div className="flex flex-col justify-between gap-8 sm:flex-row">
            <div className="max-w-sm">
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-lime/25 bg-lime/10 text-lime"><Globe2 className="h-5 w-5" /></div>
              <h3 className="mt-4 font-display text-xl font-semibold text-ink">Website to App</h3>
              <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
                Paste a valid HTTPS URL. U APP validates the destination and wraps it in a native Android shell with your
                navigation, splash screen and offline behaviour.
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {["WebView shell", "Pull to refresh", "Custom offline page", "File uploads"].map((x) => (
                  <span key={x} className="rounded-md border border-line bg-panel2 px-2 py-1 text-[10px] font-medium text-muted">{x}</span>
                ))}
              </div>
            </div>
            <div className="w-full rounded-xl border border-line bg-panel2/60 p-3 sm:max-w-[270px]">
              <div className="flex items-center gap-1.5 rounded-lg border border-line bg-panel px-2.5 py-2">
                <Lock className="h-3 w-3 text-emerald-500" />
                <span className="truncate font-mono text-[10px] text-ink">https://nimbus.example.com</span>
                <span className="ml-auto rounded bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-bold text-emerald-500">VALID</span>
              </div>
              <div className="mt-2 space-y-1.5">
                {[
                  ["App name", "Nimbus Store"],
                  ["Package ID", "app.nimbus.store"],
                  ["Back button", "History aware"],
                  ["Offline", "Built-in screen"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between rounded-md bg-panel px-2 py-1.5 text-[9.5px]">
                    <span className="text-muted">{k}</span>
                    <span className="font-medium text-ink">{v}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-lime/10 px-2 py-1.5 text-[9px] font-medium text-limeink dark:text-lime">
                <CheckCircle2 className="h-3 w-3" /> Configuration validated
              </div>
            </div>
          </div>
        </Card>

        <Card className="group overflow-hidden p-6">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-lilac/25 bg-lilac/10 text-violet-600 dark:text-lilac"><Braces className="h-5 w-5" /></div>
          <h3 className="mt-4 font-display text-xl font-semibold text-ink">HTML to App</h3>
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted">Bundle a static HTML, CSS and JS project. Assets stay intact and load from the local shell.</p>
          <div className="mt-5 overflow-hidden rounded-lg border border-line bg-[#0b0d11]">
            <div className="flex items-center gap-1 border-b border-white/8 px-2.5 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#ff5f57]" /><span className="h-1.5 w-1.5 rounded-full bg-[#febc2e]" /><span className="h-1.5 w-1.5 rounded-full bg-[#28c840]" />
              <span className="ml-1 font-mono text-[8px] text-white/40">index.html</span>
            </div>
            <pre className="overflow-x-auto p-2.5 font-mono text-[9px] leading-[1.7] text-[#c9d1c2]">{`<main class="app">
  <h1>Your product</h1>
  <button>Get started</button>
</main>`}</pre>
          </div>
        </Card>

        <Card className="group overflow-hidden p-6">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-500"><FileArchive className="h-5 w-5" /></div>
          <h3 className="mt-4 font-display text-xl font-semibold text-ink">ZIP to App</h3>
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted">Upload a project archive. Every file is scanned and classified before anything is built.</p>
          <div className="mt-5 space-y-1.5">
            {[
              ["src/App.tsx", "Supported", "green"],
              ["assets/logo.png", "Supported", "green"],
              ["api/checkout.php", "Server-side", "amber"],
              ["model.py", "Unsupported", "rose"],
            ].map(([f, s, tone]) => (
              <div key={f} className="flex items-center justify-between gap-2 rounded-md border border-line bg-panel2/60 px-2 py-1.5">
                <span className="truncate font-mono text-[9px] text-ink">{f}</span>
                <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[7.5px] font-bold uppercase tracking-wide", tone === "green" ? "bg-emerald-500/10 text-emerald-500" : tone === "amber" ? "bg-amber-500/10 text-amber-500" : "bg-rose-500/10 text-rose-500")}>{s}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[8.5px] leading-relaxed text-muted">Unsupported files are never silently deleted. You decide how to continue.</div>
        </Card>

        <Card className="group overflow-hidden p-6 lg:col-span-2">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="flex-1">
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-sky-500/25 bg-sky-500/10 text-sky-500"><Terminal className="h-5 w-5" /></div>
              <h3 className="mt-4 font-display text-xl font-semibold text-ink">Android project & advanced builds</h3>
              <p className="mt-2 max-w-md text-[12.5px] leading-relaxed text-muted">
                Gradle projects, React Native exports, Flutter and custom Gradle shells run through the isolated Android build engine with real Gradle logs and real APK/AAB artifacts.
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {["APK", "AAB", "Debug", "Release", "Source ZIP", "permission.txt"].map((x) => (
                  <span key={x} className="rounded-md border border-line bg-panel2 px-2 py-1 text-[10px] font-medium text-muted">{x}</span>
                ))}
              </div>
            </div>
            <div className="w-full overflow-hidden rounded-xl border border-line bg-[#0b0d11] sm:max-w-[330px]">
              <div className="flex items-center justify-between border-b border-white/8 px-3 py-2">
                <span className="font-mono text-[8.5px] text-white/40">worker · android-build</span>
                <span className="flex items-center gap-1 rounded bg-lime/10 px-1.5 py-0.5 text-[7px] font-bold text-lime">RUNNING</span>
              </div>
              <div className="space-y-1.5 p-3 font-mono text-[8.5px] leading-relaxed">
                <p className="text-white/40">$ ./gradlew assembleRelease</p>
                <p className="text-emerald-400">✓ source validated</p>
                <p className="text-emerald-400">✓ permissions generated</p>
                <p className="text-[#c9f65b]">→ signing artifact…</p>
                <p className="text-white/30">• artifact window 9 minutes</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { icon: Smartphone, label: "WebView & PWA" },
          { icon: Server, label: "PHP hybrid apps" },
          { icon: Boxes, label: "React Native / Flutter" },
          { icon: Wand2, label: "Custom Gradle" },
        ].map(({ icon: Ico, label }) => (
          <div key={label} className="flex items-center gap-2.5 rounded-xl border border-line bg-panel/50 px-3.5 py-3">
            <Ico className="h-4 w-4 shrink-0 text-muted" /><span className="text-[11px] font-medium text-ink/80">{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Flow */

function FlowSection() {
  const steps = [
    { n: "01", t: "Pick your source", d: "Website URL, HTML, ZIP, PWA, Android project or one of 12 supported project types. Validation happens before a credit is reserved.", icon: Globe2 },
    { n: "02", t: "Configure the shell", d: "Name, package ID, icon, splash screen, navigation, back-button behaviour, offline mode, network settings and Android permissions.", icon: Smartphone },
    { n: "03", t: "Pick a template & ads", d: "Choose from 54 working UI templates. On eligible plans, add a supported ad network, formats and placement timing — or skip ads entirely.", icon: Layers },
    { n: "04", t: "Build & download", d: "Your source enters the isolated pipeline. Download the APK, AAB, source ZIP and permission.txt from a signed link valid for nine minutes.", icon: Download },
  ];
  return (
    <section id="how" className="scroll-mt-24 border-y border-line bg-panel/35">
      <div className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 sm:py-28">
        <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionLabel>How it works</SectionLabel>
            <h2 className="mt-4 font-display text-3xl font-bold leading-[1.06] tracking-tight text-ink sm:text-[42px]">
              From raw material to installed app in four moves.
            </h2>
            <p className="mt-4 max-w-md text-[13px] leading-relaxed text-muted">
              No SDK downloads, no Android Studio, no Gradle debugging. Upload, configure, build, install.
            </p>
            <Link to="/register" className={buttonClass("primary", "md", "mt-6")}>
              Start your first build <ArrowUpRight className="h-4 w-4" />
            </Link>
            <div className="mt-8 rounded-xl border border-line bg-panel/60 p-4">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-ink"><ShieldCheck className="h-4 w-4 text-lime" /> Fail-safe credits</div>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
                A credit is reserved when a valid app is submitted and only committed on success. Failed builds release
                the reservation; rebuilds never cost a new credit.
              </p>
            </div>
          </div>
          <div className="relative">
            <div className="absolute bottom-6 left-[27px] top-6 hidden w-px bg-gradient-to-b from-lime/50 via-line to-transparent sm:block" />
            <div className="space-y-4">
              {steps.map((s, i) => (
                <div key={s.n} className={cn("relative flex gap-5 rounded-2xl border border-line bg-panel p-5 transition hover:border-ink/20", i === 0 && "border-lime/25")}>
                  <div className="relative z-10 grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-line bg-panel2">
                    <s.icon className="h-5 w-5 text-lime" />
                    <span className="absolute -right-1.5 -top-1.5 rounded-md bg-ink px-1 py-0.5 font-mono text-[8px] font-bold text-bg">{s.n}</span>
                  </div>
                  <div>
                    <h3 className="font-display text-[15px] font-semibold text-ink">{s.t}</h3>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted">{s.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Ads */

function AdsSection() {
  return (
    <section className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 sm:py-28">
      <div className="grid items-stretch gap-4 lg:grid-cols-[1.05fr_.95fr]">
        <div className="relative overflow-hidden rounded-2xl border border-line bg-panel p-6 sm:p-9">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-lilac/10 blur-3xl" />
          <Badge tone="violet"><Sparkles className="h-3 w-3" /> Monetisation built in</Badge>
          <h2 className="mt-5 font-display text-3xl font-bold leading-[1.08] tracking-tight text-ink sm:text-[38px]">
            Connect the ad networks.<br /><span className="text-muted">We place the SDK.</span>
          </h2>
          <p className="mt-4 max-w-md text-[13px] leading-relaxed text-muted">
            Add real network credentials, pick supported formats and control when an ad appears. Every configuration is
            tied to the placement rules and consent requirements of the official SDK.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {["Google AdMob", "Unity / LevelPlay", "AppLovin MAX", "ironSource", "Start.io", "Yandex Ads", "Meta", "InMobi", "Pangle", "Mintegral", "Chartboost", "Liftoff", "+4 more"].map((n) => (
              <span key={n} className="rounded-lg border border-line bg-panel2/70 px-2.5 py-1.5 text-[10.5px] font-medium text-ink/75">{n}</span>
            ))}
          </div>
          <div className="mt-6 flex flex-col gap-3 rounded-xl border border-line bg-panel2/50 p-4 sm:flex-row sm:items-center">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-500"><Lock className="h-4 w-4" /></div>
            <p className="flex-1 text-[11.5px] leading-relaxed text-muted">
              <span className="font-semibold text-ink">Free plan:</span> app creation is included, but ad SDK integration and ad credentials are disabled. Ads unlock on an active paid plan.
            </p>
            <Link to="/plans" className={buttonClass("secondary", "sm")}>See plans</Link>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <Link to="/ad-docs" className={buttonClass("primary", "md")}>Open Ad SDK reference <ArrowRight className="h-4 w-4" /></Link>
            <span className="text-[11px] text-muted">Formats · timing · diagnostics · error codes</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#262b22] bg-[#0a0c10] p-5 sm:p-7">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-white/40">ads/config.ts</span>
            <span className="rounded border border-lime/25 bg-lime/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-lime">Creator plan</span>
          </div>
          <div className="mt-4 rounded-xl border border-white/10 bg-[#10141a] p-4">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-[9px] font-bold text-white">Ad</div>
              <div>
                <div className="text-[11px] font-semibold text-[#eef2e8]">Google AdMob</div>
                <div className="text-[9px] text-white/40">Official Android SDK · verified in console</div>
              </div>
              <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-lime text-[#131a04]"><Check className="h-3 w-3" /></span>
            </div>
            <div className="mt-3 space-y-1.5">
              {[
                ["App ID", "ca-app-pub-••••/••••"],
                ["Ad unit", "ca-app-pub-••••/home_banner"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 rounded-md border border-white/8 bg-[#0a0d12] px-2.5 py-2">
                  <span className="text-[9px] text-white/40">{k}</span>
                  <span className="truncate font-mono text-[9px] text-white/70">{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {["Banner", "Interstitial", "Rewarded", "Native", "App Open", "MREC"].map((f, i) => (
              <div key={f} className="flex items-center justify-between rounded-lg border border-white/8 bg-[#10141a] px-2.5 py-2">
                <span className="text-[9.5px] text-[#d4dacb]">{f}</span>
                <span className={cn("h-3 w-5 rounded-full p-0.5", i < 3 ? "bg-lime/80" : "bg-white/10")}>
                  <span className={cn("block h-2 w-2 rounded-full", i < 3 ? "ml-auto bg-[#131a04]" : "bg-white/30")} />
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between rounded-lg border border-white/8 bg-[#10141a] px-3 py-2.5">
            <span className="text-[9.5px] text-[#aab2a3]">Auto timing</span>
            <span className="rounded bg-white/5 px-2 py-1 font-mono text-[9px] text-[#d4dacb]">every 30 seconds</span>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-400/15 bg-amber-400/5 px-3 py-2.5">
            <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
            <p className="text-[8.5px] leading-relaxed text-[#aab2a3]">SDK versions are never invented — each network is configured against its official, current documentation and consent policy.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Build lifecycle */

function BuildSection() {
  return (
    <section className="border-y border-line bg-panel/35">
      <div className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <SectionLabel className="justify-center">Build lifecycle</SectionLabel>
          <h2 className="mt-4 font-display text-3xl font-bold leading-[1.06] tracking-tight text-ink sm:text-[42px]">
            Build → artifact → <span className="text-gradient-hero">nine minutes.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[13px] leading-relaxed text-muted">
            Artifacts are never hoarded. Your download link is signed, time-limited and automatically deleted. Rebuild
            later from preserved source without spending another credit.
          </p>
        </div>
        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          <div className="overflow-hidden rounded-2xl border border-line bg-[#0a0c10] lg:col-span-2">
            <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
              <div className="flex items-center gap-2">
                <GitBranch className="h-3.5 w-3.5 text-white/50" />
                <span className="font-mono text-[10px] text-white/50">u-app / build-pipeline</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-lime" />
                <span className="font-mono text-[8.5px] uppercase tracking-wider text-lime">isolated runner</span>
              </div>
            </div>
            <div className="p-5 font-mono text-[11px] leading-[2.1] sm:p-6">
              {[
                ["✓", "Quota reserved", "credit ledger · atomic", "text-emerald-400"],
                ["✓", "Source validated", "ZIP slip & archive bomb checks", "text-emerald-400"],
                ["✓", "Android shell generated", "permissions · splash · WebView", "text-emerald-400"],
                ["✓", "Gradle build executed", "assembleDebug · bundleRelease", "text-emerald-400"],
                ["→", "Artifact stored temporarily", "Server · expires in 540 seconds", "text-[#c9f65b]"],
                ["○", "Secrets rotated & logs purged", "tokens never exposed", "text-white/35"],
              ].map(([mark, label, detail, color]) => (
                <div key={label} className="flex flex-wrap items-baseline gap-x-3 border-b border-white/5 py-0.5 last:border-0">
                  <span className={cn("w-3", color)}>{mark}</span>
                  <span className="text-[#e7ebdf]">{label}</span>
                  <span className="ml-auto text-[9px] text-white/30">{detail}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/8 px-5 py-3 sm:px-6">
              <span className="font-mono text-[9px] text-white/35">APK · AAB · source ZIP · permission.txt</span>
              <span className="rounded bg-lime/10 px-2 py-1 font-mono text-[9px] text-lime">temporary storage · 9 min</span>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-line bg-panel p-5">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-lime/10 text-lime"><Bell className="h-4 w-4" /></div>
                <span className="text-[11px] font-semibold text-ink">Build notification</span>
                <span className="ml-auto text-[9px] text-muted">now</span>
              </div>
              <p className="mt-2.5 text-[11.5px] leading-relaxed text-muted">“Nimbus Store is ready. Download your APK within 9 minutes.”</p>
              <div className="mt-3 flex gap-2">
                <span className="rounded-md bg-lime px-2 py-1 text-[9px] font-bold text-limeink">Download APK</span>
                <span className="rounded-md border border-line px-2 py-1 text-[9px] font-medium text-muted">Later</span>
              </div>
            </div>
            <div className="flex-1 rounded-2xl border border-line bg-panel p-5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Link expired?</span>
                <Timer className="h-3.5 w-3.5 text-amber-400" />
              </div>
              <div className="mt-3 rounded-xl border border-dashed border-amber-500/25 bg-amber-500/5 px-3 py-4 text-center">
                <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-500">Download link expired</div>
                <Link to="/register" className={buttonClass("lime", "sm", "mt-2.5")}>Create again</Link>
              </div>
              <p className="mt-3 text-[10.5px] leading-relaxed text-muted">
                Rebuild pulls the preserved source and reruns the pipeline. No new creation credit is consumed.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Templates */

function TemplateSection() {
  const row1 = TEMPLATES.slice(0, 18);
  const row2 = TEMPLATES.slice(18, 36);
  return (
    <section id="templates" className="scroll-mt-24 overflow-hidden px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-[1240px]">
        <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <SectionLabel>UI templates</SectionLabel>
            <h2 className="mt-4 font-display text-3xl font-bold leading-[1.06] tracking-tight text-ink sm:text-[42px]">
              54 starting points.<br /><span className="text-muted">Zero blank screens.</span>
            </h2>
          </div>
          <div className="flex max-w-sm flex-col gap-3">
            <p className="text-[13px] leading-relaxed text-muted">
              Dark, light, AMOLED, neon, glass, gaming, dashboards, floating navigation and more. Every template is a real
              preview with a working selection.
            </p>
            <div className="flex gap-2">
              <Link to="/register" className={buttonClass("primary", "sm")}>Explore all templates <ArrowRight className="h-3.5 w-3.5" /></Link>
              <Link to="/login" className={buttonClass("ghost", "sm")}>Sign in</Link>
            </div>
          </div>
        </div>
      </div>
      <div className="marquee-wrap relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-bg to-transparent sm:w-32" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-bg to-transparent sm:w-32" />
        <div className="marquee-track flex w-max gap-3">
          {[...row1, ...row1].map((tpl, i) => (
            <TemplateCard key={`a${i}`} tpl={tpl} />
          ))}
        </div>
      </div>
      <div className="marquee-wrap relative mt-3">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-bg to-transparent sm:w-32" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-bg to-transparent sm:w-32" />
        <div className="marquee-track flex w-max gap-3" style={{ animationDirection: "reverse", animationDuration: "42s" }}>
          {[...row2, ...row2].map((tpl, i) => (
            <TemplateCard key={`b${i}`} tpl={tpl} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TemplateCard({ tpl }: { tpl: (typeof TEMPLATES)[number] }) {
  return (
    <div className="w-[168px] shrink-0 rounded-xl border border-line bg-panel p-2.5 sm:w-[184px]">
      <TemplateMini template={tpl} compact />
      <div className="mt-2 flex items-center justify-between gap-1 px-0.5">
        <span className="truncate text-[10.5px] font-semibold text-ink">{tpl.name}</span>
        <span className="shrink-0 text-[8.5px] text-muted">{tpl.category}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ API */

function ApiSection() {
  return (
    <section id="api" className="scroll-mt-24 border-y border-line bg-panel/35">
      <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-2 lg:items-center">
        <div>
          <Badge tone="sky"><Code2 className="h-3 w-3" /> Public developer API</Badge>
          <h2 className="mt-4 font-display text-3xl font-bold leading-[1.06] tracking-tight text-ink sm:text-[40px]">
            Your software.<br />Our build engine.
          </h2>
          <p className="mt-4 max-w-md text-[13px] leading-relaxed text-muted">
            Create apps from your own website, backend or tooling with a standard REST API. Server-side keys, hashed at
            rest, with the same quota as the website builder.
          </p>
          <div className="mt-6 space-y-1.5">
            {[
              ["POST", "/api/v1/apps/create"],
              ["GET", "/api/v1/apps/status"],
              ["POST", "/api/v1/apps/rebuild"],
              ["GET", "/api/v1/account/usage"],
            ].map(([m, p]) => (
              <div key={p} className="flex items-center gap-2.5 rounded-lg border border-line bg-panel px-3 py-2">
                <span className={cn("rounded px-1.5 py-0.5 font-mono text-[8px] font-bold", m === "POST" ? "bg-lime/15 text-limeink dark:text-lime" : "bg-sky-500/10 text-sky-500")}>{m}</span>
                <span className="font-mono text-[10.5px] text-ink/80">{p}</span>
                <ArrowUpRight className="ml-auto h-3 w-3 text-muted" />
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link to="/api-docs" className={buttonClass("primary", "md")}>Developer portal <ArrowRight className="h-4 w-4" /></Link>
            <Link to="/api-docs" className={buttonClass("secondary", "md")}><KeyRound className="h-4 w-4" /> Create an API key</Link>
          </div>
          <p className="mt-3 text-[10.5px] text-muted">13 documented endpoints · Python, PHP, JavaScript & any HTTP client</p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-line bg-[#0a0c10]">
          <div className="flex items-center justify-between border-b border-white/8 px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#ff5f57]" /><span className="h-2 w-2 rounded-full bg-[#febc2e]" /><span className="h-2 w-2 rounded-full bg-[#28c840]" />
              <span className="ml-2 font-mono text-[9px] text-white/40">create-app.js</span>
            </div>
            <CopyButton text={CODE_SAMPLES.JavaScript} />
          </div>
          <pre className="overflow-x-auto p-4 font-mono text-[10px] leading-[1.85] text-[#c7d0bf] sm:p-5 sm:text-[10.5px]">{CODE_SAMPLES.JavaScript}</pre>
          <div className="flex items-center justify-between border-t border-white/8 px-4 py-2.5">
            <span className="font-mono text-[8.5px] text-white/35">application/json · bearer auth</span>
            <span className="flex items-center gap-1 font-mono text-[8.5px] text-lime"><span className="h-1.5 w-1.5 rounded-full bg-lime" /> REST v1</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Pricing */

function PricingSection({ onChoose }: { onChoose: (id: string) => void }) {
  const { state } = useStore();
  const creator = PLANS.find((p) => p.id === "creator");
  return (
    <section id="pricing" className="mx-auto max-w-[1240px] scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <SectionLabel className="justify-center">Plans & pricing</SectionLabel>
        <h2 className="mt-4 font-display text-3xl font-bold leading-[1.06] tracking-tight text-ink sm:text-[42px]">
          Start free. Upgrade when you ship.
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-[13px] leading-relaxed text-muted">
          Every account begins with 3 app creation credits per calendar month. Paid plans add credits, ad integration,
          API access and bigger builds.
        </p>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p) => (
          <PlanCard key={p.id} plan={p} current={state.user ? p.id === state.user.planId : false} compact onChoose={() => onChoose(p.id)} />
        ))}
      </div>
      <div className="mt-6 flex flex-col items-start justify-between gap-3 rounded-xl border border-line bg-panel/50 px-4 py-3.5 sm:flex-row sm:items-center">
        <p className="text-[11.5px] leading-relaxed text-muted">
          Plan catalogue is served from a configuration service. Prices are in INR. Plans activate only after manual UPI
          payment approval.
        </p>
        <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-ink hover:text-lime">
          <Mail className="h-3.5 w-3.5" /> {SUPPORT_EMAIL}
        </a>
      </div>
      {state.user && state.user.planId !== "free" && (
        <p className="mt-3 text-center text-[11px] text-muted">You are on {state.user.planId}. Manage it from your workspace.</p>
      )}
      {creator && <p className="mt-3 text-center text-[10.5px] text-muted">Paid example: {creator.name} {inr(creator.price)} for {creator.credits} credits / {creator.days} days · Billed manually via UPI</p>}
    </section>
  );
}

/* ------------------------------------------------------------------ Support / FAQ */

function SupportFaq({ faq, setFaq }: { faq: number | null; setFaq: (n: number | null) => void }) {
  return (
    <section className="border-y border-line bg-panel/35">
      <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[.8fr_1.2fr]">
        <div>
          <SectionLabel>Support</SectionLabel>
          <h2 className="mt-4 font-display text-3xl font-bold leading-[1.06] tracking-tight text-ink sm:text-[38px]">
            Real people.<br /><span className="text-muted">Build answers.</span>
          </h2>
          <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-muted">
            Questions about payments, activation, build errors, conversion or the API? Send a message and it reaches the
            U APP support inbox.
          </p>
          <Card className="mt-6 p-4">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-lime text-[11px] font-bold text-limeink">UA</div>
              <div>
                <div className="text-[12px] font-semibold text-ink">U APP Support</div>
                <div className="flex items-center gap-1 text-[10px] text-muted"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Typically replies within a day</div>
              </div>
            </div>
            <div className="mt-4 rounded-xl rounded-tl-sm border border-line bg-panel2 px-3 py-2.5 text-[11.5px] leading-relaxed text-ink/80">
              Hi! Tell us what you&apos;re building and where you got stuck. Include your order ID for payment questions.
            </div>
            <div className="mt-2 rounded-xl rounded-tr-sm border border-lime/20 bg-lime/10 px-3 py-2.5 text-[11.5px] leading-relaxed text-ink/80">
              My ZIP build failed at Gradle. What should I check?
            </div>
            <Link to="/support" className={buttonClass("lime", "md", "mt-4 w-full")}>
              <Mail className="h-4 w-4" /> Open a support conversation
            </Link>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="mt-2.5 block text-center text-[10.5px] text-muted hover:text-ink">{SUPPORT_EMAIL}</a>
          </Card>
        </div>
        <div>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-display text-2xl font-semibold text-ink">Frequently asked</h2>
            <span className="text-[11px] text-muted">{FAQS.length} answers</span>
          </div>
          <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
            {FAQS.map((f, i) => (
              <div key={f.q}>
                <button onClick={() => setFaq(faq === i ? null : i)} className="flex w-full items-center gap-4 px-5 py-4 text-left">
                  <span className="font-mono text-[10px] text-muted">{String(i + 1).padStart(2, "0")}</span>
                  <span className="flex-1 text-[12.5px] font-semibold text-ink">{f.q}</span>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", faq === i && "rotate-180 text-lime")} />
                </button>
                {faq === i && <p className="animate-rise px-5 pb-5 pl-[3.1rem] text-[12px] leading-relaxed text-muted">{f.a}</p>}
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-panel/50 px-4 py-3 text-[11px] text-muted">
            <Search className="h-3.5 w-3.5" /> Still stuck? <Link to="/support" className="font-semibold text-ink hover:text-lime">Send us a message</Link>
            <span className="ml-auto inline-flex items-center gap-1.5"><Upload className="h-3 w-3" /> Text-only delivery</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AppTypesStrip() {
  return (
    <div className="flex flex-wrap gap-2">
      {APP_TYPES.slice(0, 6).map((t) => (
        <span key={t.id} className="rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[10.5px] text-muted">{t.name}</span>
      ))}
    </div>
  );
}


import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Code2,
  CreditCard,
  Download,
  FileArchive,
  FileCode2,
  FileText,
  Globe2,
  Layers,
  LifeBuoy,
  Lock,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Timer,
  Trash2,
  TriangleAlert,
  Zap,
} from "lucide-react";
import { Badge, Button, buttonClass, Card, Empty, Input, Modal, Progress, Ring, useToast } from "@/components/ui";
import { Link2 as LinkIcon } from "lucide-react";
import { PageHeader } from "@/components/Shell";
import { SUPPORT_EMAIL, TEMPLATES } from "@/data/catalog";
import { formatDate, relativeTime, useStore, type AppRecord } from "@/lib/store";
import { engineHealth, type EngineHealth } from "@/lib/buildService";
import { getUpiConfig, hydrateUpiFromServer } from "@/lib/payments";
import { mmss, useCountdown } from "@/lib/useCountdown";
import { cn } from "@/utils/cn";

function statusTone(s: AppRecord["buildStatus"]): "green" | "sky" | "violet" | "rose" {
  return s === "ready" ? "green" : s === "queued" ? "sky" : s === "building" ? "violet" : "rose";
}
const STATUS_LABEL: Record<AppRecord["buildStatus"], string> = { ready: "Ready", queued: "Queued", building: "Building", failed: "Failed", cancelled: "Cancelled" };

export function AppIcon({ app, size = 40 }: { app: AppRecord; size?: number }) {
  return (
    <div
      className="grid shrink-0 place-items-center rounded-xl font-display font-bold"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(140deg, ${app.iconColor}, ${app.iconColor}66)`,
        color: "#111605",
        fontSize: size * 0.36,
        boxShadow: `0 6px 20px -8px ${app.iconColor}88`,
      }}
    >
      {app.name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function ExpiryPill({ expiresAt }: { expiresAt?: number }) {
  const seconds = useCountdown(expiresAt);
  if (seconds <= 0) return <span className="inline-flex items-center gap-1 rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">Expired</span>;
  return <span className="inline-flex items-center gap-1 rounded border border-line bg-panel2 px-1.5 py-0.5 font-mono text-[9px] text-muted"><Timer className="h-2.5 w-2.5" />{mmss(seconds)}</span>;
}

/* ------------------------------------------------------------------ Dashboard */

export function DashboardPage() {
  const [engine, setEngine] = useState<EngineHealth | null>(null);
  const [upiReady, setUpiReady] = useState(Boolean(getUpiConfig()));
  useEffect(() => {
    let live = true;
    void engineHealth().then((h) => { if (live) setEngine(h); });
    void hydrateUpiFromServer().then((cfg) => { if (live) setUpiReady(Boolean(cfg)); });
    return () => { live = false; };
  }, []);

  const { state, quota } = useStore();
  const user = state.user!;
  const apps = state.apps;
  const ready = apps.filter((a) => a.buildStatus === "ready").length;
  const firstName = user.name.split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const recent = apps.slice(0, 4);
  const quotaPct = quota.allowance ? (quota.remaining / quota.allowance) * 100 : 0;

  const stats = [
    { label: "App credits left", value: `${quota.remaining}`, sub: `of ${quota.allowance} · ${quota.plan.name}`, icon: Zap, tint: "text-lime", to: "/app/plans" },
    { label: "Apps created", value: `${apps.length}`, sub: `${apps.filter((a) => a.countAsCredit).length} credits committed`, icon: Package, tint: "text-sky-500", to: "/app/apps" },
    { label: "Builds ready", value: `${ready}`, sub: `${apps.filter((a) => a.buildStatus === "failed").length} failed · credits safe`, icon: CheckCircle2, tint: "text-emerald-500", to: "/app/apps" },
    { label: "API calls", value: `${state.apiUsage}`, sub: `${state.apiKeys.filter((k) => !k.revokedAt).length} active keys`, icon: Code2, tint: "text-lilac", to: "/app/api" },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-lime" /> Workspace overview
          <span className="text-line">/</span>
          <span>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</span>
        </div>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h1 className="mt-1 font-display text-[26px] font-bold tracking-tight text-ink sm:text-[30px]">{greeting}, {firstName}.</h1>
            <p className="mt-1 text-[12.5px] text-muted">Here&apos;s what&apos;s happening in your app workspace.</p>
          </div>
          <div className="flex gap-2">
            <Link to="/app/apps" className={buttonClass("secondary", "sm")}>My apps</Link>
            <Link to="/app/create" className={buttonClass("lime", "sm")}><Plus className="h-3.5 w-3.5" /> Create new app</Link>
          </div>
        </div>
      </div>

      {quota.remaining === 0 ? (
        <Link to="/app/plans" className="mb-4 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3 transition hover:border-amber-500/50">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500/12 text-amber-500"><Zap className="h-4 w-4" /></div>
          <div className="flex-1">
            <div className="text-[12px] font-semibold text-ink">Your monthly free app limit has been reached</div>
            <div className="mt-0.5 text-[10.5px] text-muted">Upgrade your plan to continue creating apps, or wait for the allowance to reset on {quota.resetLabel}.</div>
          </div>
          <ArrowRight className="h-4 w-4 text-amber-500" />
        </Link>
      ) : (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-line bg-panel/60 px-4 py-2.5">
          <div className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-lime/10 text-lime"><Check className="h-3.5 w-3.5" /></div>
          <p className="text-[10.5px] leading-relaxed text-muted">
            <span className="font-semibold text-ink">{quota.remaining} app creation credit{quota.remaining === 1 ? "" : "s"} available.</span>{" "}
            Server-side quota is calculated per UID. Failed validation and rebuilds never consume a credit.
            {" "}<Link to="/app/plans" className="font-semibold text-ink underline decoration-line underline-offset-2 hover:text-lime">View plans</Link>
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} to={s.to} className="group rounded-xl border border-line bg-panel p-4 transition hover:border-ink/20">
            <div className="flex items-center justify-between">
              <s.icon className={cn("h-4 w-4", s.tint)} />
              <ArrowUpRight className="h-3 w-3 text-muted opacity-0 transition group-hover:opacity-100" />
            </div>
            <div className="mt-2.5 font-display text-[25px] font-bold leading-none tracking-tight text-ink">{s.value}</div>
            <div className="mt-1 text-[10.5px] font-medium text-ink/70">{s.label}</div>
            <div className="mt-0.5 truncate text-[9px] text-muted">{s.sub}</div>
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.55fr_.95fr]">
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div>
                <h2 className="text-[12.5px] font-semibold text-ink">Recent apps</h2>
                <p className="text-[10px] text-muted">Creation history and build status</p>
              </div>
              <Link to="/app/apps" className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-muted hover:text-ink">View all <ArrowRight className="h-3 w-3" /></Link>
            </div>
            {recent.length === 0 ? (
              <div className="p-5">
                <Empty
                  icon={<Smartphone className="h-5 w-5" />}
                  title="No apps yet"
                  body="Your first app is three credits away. Start with a website URL or upload a ZIP project."
                  action={<Link to="/app/create" className={buttonClass("lime", "sm")}><Plus className="h-3.5 w-3.5" /> Create your first app</Link>}
                />
              </div>
            ) : (
              <div className="divide-y divide-line">
                {recent.map((app) => (
                  <div key={app.id} className="flex items-center gap-3 px-4 py-3 transition hover:bg-panel2/40">
                    <AppIcon app={app} size={38} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link to={`/app/apps/${app.id}`} className="truncate text-[12px] font-semibold text-ink hover:text-lime">{app.name}</Link>
                        <Badge tone={statusTone(app.buildStatus)} className="px-1.5 py-0.5 text-[8.5px]">{STATUS_LABEL[app.buildStatus]}</Badge>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[9.5px] text-muted">
                        <span className="truncate font-mono">{app.packageId}</span>
                        <span>·</span>
                        <span>{app.template}</span>
                        <span>·</span>
                        <span>{relativeTime(app.createdAt)}</span>
                      </div>
                    </div>
                    <div className="hidden sm:block"><ExpiryPill expiresAt={app.linkExpiresAt} /></div>
                    <Link to={`/app/apps/${app.id}`} className="rounded-lg border border-line p-1.5 text-muted hover:text-ink" aria-label={`Open ${app.name}`}><ArrowUpRight className="h-3.5 w-3.5" /></Link>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-[12.5px] font-semibold text-ink">Build pipeline</h2>
                <p className="text-[10px] text-muted">Integration readiness for this environment</p>
              </div>
              <Badge tone={engine?.buildEnabled ? "green" : "amber"}>{engine?.buildEnabled ? <><CheckCircle2 className="h-3 w-3" /> Engine verified</> : <><TriangleAlert className="h-3 w-3" /> {engine ? "Setup required" : "Checking…"}</>}</Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { label: "Account & project sync", note: "Identity provider", state: "ok" },
                { label: "Android build engine", note: engine ? engine.engineStatus : "Checking server…", state: engine?.buildEnabled ? "ok" : "setup" },
                { label: "Build queue", note: engine ? `${engine.queue} waiting · ${engine.active ? "1 active" : "idle"}` : "—", state: engine?.buildEnabled ? "ok" : "setup" },
                { label: "Temporary artifact storage", note: engine ? `${engine.downloadTtlSeconds}s download window` : "Persistent server volume", state: engine ? "ok" : "setup" },
                { label: "UPI merchant details", note: upiReady ? "Server-configured payee" : "Admin configuration required", state: upiReady ? "ok" : "setup" },
                { label: "Source package export", note: "Available in workspace", state: "ok" },
              ].map((i) => (
                <div key={i.label} className="flex items-center gap-2 rounded-lg border border-line bg-panel2/40 px-2.5 py-2">
                  <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", i.state === "ok" ? "bg-emerald-400" : "bg-amber-400")} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[10.5px] font-medium text-ink/85">{i.label}</div>
                    <div className="truncate text-[9px] text-muted">{i.note}</div>
                  </div>
                </div>
              ))}
            </div>
            <Link to="/app/settings" className="mt-2.5 inline-flex items-center gap-1 text-[10px] font-semibold text-ink hover:text-lime">Open runtime configuration <ArrowRight className="h-3 w-3" /></Link>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[12.5px] font-semibold text-ink">Monthly allowance</h2>
              <Badge tone={quota.plan.id === "free" ? "neutral" : "lime"}>{quota.plan.name}</Badge>
            </div>
            <div className="mt-3 flex items-center gap-4">
              <Ring value={quotaPct} size={104} label={`${quota.remaining}`} sub="left" />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">{quota.periodLabel}</div>
                <div className="mt-1 font-display text-[20px] font-bold leading-none text-ink">{quota.used}<span className="text-[13px] font-medium text-muted"> / {quota.allowance} used</span></div>
                <Progress value={quotaPct} className="mt-2" tone={quota.remaining === 0 ? "rose" : "lime"} />
                <div className="mt-2 text-[9.5px] leading-relaxed text-muted">Resets {quota.resetLabel}. Rebooting sessions never resets quota.</div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg bg-panel2/60 px-3 py-2">
              <span className="text-[10px] text-muted">Ads integration</span>
              <span className={cn("text-[10px] font-semibold", quota.plan.ads ? "text-emerald-500" : "text-muted")}>{quota.plan.ads ? "Eligible" : "Upgrade required"}</span>
            </div>
            <Link to="/app/plans" className={buttonClass("primary", "sm", "mt-2.5 w-full")}><Sparkles className="h-3.5 w-3.5" /> {quota.plan.id === "free" ? "Unlock more credits" : "Manage subscription"}</Link>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-[12.5px] font-semibold text-ink">Activity</h2>
              <Link to="/app/activity" className="text-[10px] text-muted hover:text-ink">All</Link>
            </div>
            <div className="px-4 py-3">
              {state.activities.slice(0, 5).map((a, i) => (
                <div key={a.id} className="relative flex gap-2.5 pb-3 last:pb-0">
                  {i < 4 && <span className="absolute bottom-0 left-[5px] top-3.5 w-px bg-line" />}
                  <span className={cn("relative z-10 mt-1 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-panel", a.kind === "build" ? "bg-lime" : a.kind === "billing" ? "bg-amber-400" : a.kind === "auth" ? "bg-sky-400" : a.kind === "api" ? "bg-lilac" : "bg-muted")} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10.5px] font-semibold leading-tight text-ink">{a.title}</div>
                    <div className="mt-0.5 truncate text-[9.5px] text-muted">{a.detail}</div>
                  </div>
                  <span className="shrink-0 text-[8.5px] text-muted">{relativeTime(a.at)}</span>
                </div>
              ))}
              {state.activities.length === 0 && <p className="py-5 text-center text-[10.5px] text-muted">Activity appears here as you build.</p>}
            </div>
          </Card>

          <Card className="border-lime/25 bg-[linear-gradient(140deg,rgba(201,246,91,.09),transparent)] p-4">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-lime/15 text-lime"><LifeBuoy className="h-4 w-4" /></div>
              <div>
                <div className="text-[11.5px] font-semibold text-ink">Need a hand?</div>
                <div className="text-[9.5px] text-muted">Support is one message away</div>
              </div>
            </div>
            <p className="mt-2 text-[10.5px] leading-relaxed text-muted">Payments, activation, conversion and build errors — include your project or order ID.</p>
            <Link to="/app/support" className={buttonClass("secondary", "sm", "mt-2.5 w-full")}>Contact support</Link>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ My Apps */

export function MyAppsPage() {
  const { state, rebuildApp } = useStore();
  const { toast } = useToast();
  const [filter, setFilter] = useState<"all" | AppRecord["buildStatus"]>("all");
  const [q, setQ] = useState("");
  const apps = useMemo(
    () => state.apps.filter((a) => (filter === "all" || a.buildStatus === filter) && (a.name.toLowerCase().includes(q.toLowerCase()) || a.packageId.toLowerCase().includes(q.toLowerCase()))),
    [state.apps, filter, q]
  );

  return (
    <div>
      <PageHeader
        title="My Apps"
        subtitle="Every project, its build status and the state of its temporary download link."
        eyebrow="App library"
        actions={<><Link to="/app/plans" className={buttonClass("secondary", "md")}><Zap className="h-4 w-4 text-lime" /> View credits</Link><Link to="/app/create" className={buttonClass("lime", "md")}><Plus className="h-4 w-4" /> Create app</Link></>}
      />
      <Card className="mb-4 flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by app name or package ID…" className="pl-9" />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {(["all", "ready", "queued", "failed"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cn("rounded-lg px-2.5 py-1.5 text-[10.5px] font-semibold capitalize transition", filter === f ? "bg-ink text-bg" : "text-muted hover:bg-panel2 hover:text-ink")}>
              {f === "all" ? `All (${state.apps.length})` : f}
            </button>
          ))}
        </div>
      </Card>

      {apps.length === 0 ? (
        <Card className="p-5">
          <Empty
            icon={<Package className="h-5 w-5" />}
            title={state.apps.length === 0 ? "No apps in your workspace yet" : "No apps match this filter"}
            body={state.apps.length === 0 ? "Start from a website URL, HTML bundle, ZIP archive or Android project. Your first build uses one creation credit." : "Try another status or clear the search to see everything."}
            action={<Link to="/app/create" className={buttonClass("lime", "sm")}><Plus className="h-3.5 w-3.5" /> Create an app</Link>}
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {apps.map((app) => (
            <Card key={app.id} className="p-3.5 transition hover:border-ink/20 sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <AppIcon app={app} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/app/apps/${app.id}`} className="font-display text-[14px] font-semibold text-ink hover:text-lime">{app.name}</Link>
                    <Badge tone={statusTone(app.buildStatus)}>{STATUS_LABEL[app.buildStatus]}</Badge>
                    {!app.adsEnabled && <Badge tone="neutral">Ads off</Badge>}{app.buildState === "timeout" && <Badge tone="amber">Build timeout</Badge>}{app.buildStatus === "failed" && app.buildError && <Badge tone="rose">Build failed</Badge>}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted">
                    <span className="font-mono">{app.packageId}</span>
                    <span className="inline-flex items-center gap-1"><Globe2 className="h-3 w-3" /> {app.type}</span>
                    <span className="inline-flex items-center gap-1"><Layers className="h-3 w-3" /> {app.template}</span>
                    <span>{formatDate(app.createdAt)}</span>
                    <span className="rounded bg-panel2 px-1.5 py-0.5 font-mono text-[8.5px]">{app.buildType}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {app.buildStatus === "ready" ? <ExpiryPill expiresAt={app.linkExpiresAt} /> : <span className="text-[9.5px] text-muted">Build pending</span>}
                  <Link to={`/app/apps/${app.id}/download`} className={buttonClass("secondary", "sm")}><Download className="h-3.5 w-3.5" /> Download</Link>
                  <Button variant="ghost" size="sm" aria-label={`Rebuild ${app.name}`} onClick={() => { void rebuildApp(app.id); toast("Rebuild queued. No app creation credit consumed.", "success"); }}><RefreshCw className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" aria-label={`Copy download link for ${app.name}`} onClick={() => { const link = `${window.location.origin}${window.location.pathname}#/app/apps/${app.id}/download`; void navigator.clipboard.writeText(link); toast("Download link copied. Share it from history anytime.", "success"); }}><LinkIcon className="h-3.5 w-3.5" /></Button>
                  <Link to={`/app/apps/${app.id}`} className={buttonClass("ghost", "sm")} aria-label="Open app"><ArrowUpRight className="h-3.5 w-3.5" /></Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          { icon: ShieldCheck, t: "Credit safety", b: "Failed builds release the reserved credit. Rebuilds never consume a new credit." },
          { icon: Timer, t: "Nine-minute links", b: "Artifacts live for exactly 540 seconds, then the link and file expire." },
          { icon: RefreshCw, t: "Create again", b: "Rebuild any expired project from preserved source and get a fresh link." },
        ].map((x) => (
          <div key={x.t} className="rounded-xl border border-line bg-panel/50 p-3.5">
            <x.icon className="h-3.5 w-3.5 text-lime" />
            <div className="mt-1.5 text-[10.5px] font-semibold text-ink">{x.t}</div>
            <div className="mt-0.5 text-[9.5px] leading-relaxed text-muted">{x.b}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ App detail */

export function AppDetailPage() {
  const { id } = useParams();
  const { state, rebuildApp, deleteApp } = useStore();
  const { toast } = useToast();
  const navigate = useNavigate();
  const app = state.apps.find((a) => a.id === id);
  const [confirm, setConfirm] = useState(false);

  if (!app) {
    return (
      <div>
        <PageHeader title="App not found" subtitle="This project may have been deleted, or the link is incorrect." />
        <Link to="/app/apps" className={buttonClass("primary", "md")}><ArrowLeft className="h-4 w-4" /> Back to My Apps</Link>
      </div>
    );
  }

  const template = TEMPLATES.find((t) => t.id === app.templateId) ?? TEMPLATES[0];

  return (
    <div>
      <Link to="/app/apps" className="mb-4 inline-flex items-center gap-1.5 text-[11px] font-medium text-muted hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> All apps</Link>
      <div className="mb-5 flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <AppIcon app={app} size={52} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-[22px] font-bold tracking-tight text-ink">{app.name}</h1>
              <Badge tone={statusTone(app.buildStatus)}>{STATUS_LABEL[app.buildStatus]}</Badge>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-muted">
              <span className="font-mono">{app.packageId}</span>
              <span>·</span><span>v{app.version}</span>
              <span>·</span><span>{app.id}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => { void rebuildApp(app.id); toast("Rebuild requested. No new credit consumed.", "success"); }}><RefreshCw className="h-3.5 w-3.5" /> Rebuild</Button>
          <Link to={`/app/apps/${app.id}/download`} className={buttonClass("lime", "sm")}><Download className="h-3.5 w-3.5" /> Downloads</Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[12.5px] font-semibold text-ink">Configuration</h2>
              <Badge tone="neutral">{app.type}</Badge>
            </div>
            <div className="mt-3 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
              {[
                ["Source", app.sourceLabel],
                ["Template", `${app.template} (#${app.templateId})`],
                ["Build type", app.buildType],
                ["Version", app.version],
                ["Ads", app.adsEnabled ? `${app.adNetwork} · ${app.adFormats.length} formats` : "Not configured"],
                ["Ad timing", app.adTiming || "—"],
                ["Offline behavior", app.offline],
                ["Splash colour", app.splashColor],
                ["Created", formatDate(app.createdAt)],
                ["Credit committed", app.countAsCredit ? "Yes · 1" : "No"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-3 border-b border-line/70 pb-2 text-[10.5px] last:border-0">
                  <span className="text-muted">{k}</span>
                  <span className="max-w-[60%] break-words text-right font-medium text-ink">{v}</span>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">Permissions ({app.permissions.length})</div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {app.permissions.length ? app.permissions.map((p) => <span key={p} className="rounded border border-line bg-panel2 px-1.5 py-0.5 font-mono text-[8.5px] text-muted">{p}</span>) : <span className="text-[10px] text-muted">None requested</span>}
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-line px-4 py-3">
              <h2 className="text-[12.5px] font-semibold text-ink">Build log</h2>
              <p className="text-[10px] text-muted">Server-side build metadata and runner notes</p>
            </div>
            <div className="space-y-2 p-4">
              {app.buildError && (
                <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-2.5 py-2 text-[9px] leading-relaxed text-amber-600 dark:text-amber-400">
                  {app.buildError}
                </div>
              )}
              {app.buildJobId && (
                <div className="flex items-center gap-2 rounded-lg border border-line bg-panel2/50 px-2.5 py-2 text-[9px] font-medium text-ink">
                  <Layers className="h-3 w-3 text-muted" /> Build job · {app.buildJobId}
                </div>
              )}
              {(app.buildLog ?? []).length > 0 && (
                <div className="rounded-lg border border-line bg-[#0a0c10] p-2.5">
                  <div className="mb-1 font-mono text-[8px] uppercase tracking-wider text-white/35">runner log</div>
                  {app.buildLog!.map((line, i) => (
                    <div key={i} className="font-mono text-[9px] leading-relaxed text-[#c9d1c2]"><span className="text-lime">›</span> {line}</div>
                  ))}
                </div>
              )}
              {app.notes.map((n, i) => (
                <div key={i} className="flex items-start gap-2 font-mono text-[10px] leading-relaxed">
                  <span className="text-muted">{String(i + 1).padStart(2, "0")}</span>
                  <span className={cn(n.toLowerCase().includes("fail") ? "text-rose-500" : n.toLowerCase().includes("credit") ? "text-limeink dark:text-lime" : "text-ink/80")}>{n}</span>
                </div>
              ))}
              <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-2 font-mono text-[9px] leading-relaxed text-amber-600 dark:text-amber-400">
                <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
                APK/AAB is compiled by the isolated Android build engine. If the worker is unavailable, the build is reported as failed — never a fake APK.
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[12.5px] font-semibold text-ink">Artifacts</h2>
              <Badge tone={app.buildStatus === "ready" ? "green" : "amber"}>{app.buildStatus === "ready" ? "Temporary link" : "Awaiting runner"}</Badge>
            </div>
            <div className="mt-3 rounded-xl border border-line bg-panel2/50 p-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] uppercase tracking-wider text-muted">APK · AAB · source ZIP</span>
                <ExpiryPill expiresAt={app.linkExpiresAt} />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="font-display text-[22px] font-bold text-ink">{app.artifactMb.toFixed(1)}</span>
                <span className="text-[10px] text-muted">MB configuration bundle</span>
              </div>
              <Progress value={app.linkExpiresAt ? Math.max(0, Math.min(100, ((app.linkExpiresAt - Date.now()) / 540000) * 100)) : 0} className="mt-2" tone={app.buildStatus === "ready" ? "lime" : "violet"} />
              <Link to={`/app/apps/${app.id}/download`} className={buttonClass("lime", "sm", "mt-2.5 w-full")}><Download className="h-3.5 w-3.5" /> Open download page</Link>
            </div>
            <p className="mt-2 text-[9.5px] leading-relaxed text-muted">Links expire exactly 9 minutes after generation. Rebuilding never consumes another app creation credit.</p>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-line px-4 py-3"><h2 className="text-[12.5px] font-semibold text-ink">Selected template</h2></div>
            <div className="p-4">
              <div className="rounded-xl border border-line p-2" style={{ background: template.bg }}>
                <div className="h-1.5 w-full rounded-full" style={{ background: template.accent }} />
                <div className="mt-2 text-[12px] font-semibold" style={{ color: "#f4f6ef" }}>{template.name}</div>
                <div className="mt-0.5 text-[9px]" style={{ color: template.accent }}>{template.category} · {template.layout} navigation</div>
                <p className="mt-2 text-[9px] leading-relaxed text-white/50">{template.blurb}</p>
              </div>
              <Link to={`/app/create`} className={buttonClass("secondary", "sm", "mt-2.5 w-full")}><Layers className="h-3.5 w-3.5" /> Browse templates</Link>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-[12.5px] font-semibold text-ink">Danger zone</h2>
            <p className="mt-1 text-[10px] leading-relaxed text-muted">Deleting removes this project from the workspace. Preserve a copy of your source first.</p>
            <Button variant="danger" size="sm" className="mt-2.5 w-full" onClick={() => setConfirm(true)}><Trash2 className="h-3.5 w-3.5" /> Delete app</Button>
          </Card>
        </div>
      </div>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Delete this app?" subtitle="This cannot be undone. Artifact links will stop working immediately.">
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirm(false)}>Cancel</Button>
          <Button variant="danger" className="flex-1" onClick={() => { deleteApp(app.id); setConfirm(false); toast("App deleted from the workspace.", "success"); navigate("/app/apps"); }}>Delete permanently</Button>
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ Activity */

export function ActivityPage() {
  const { state } = useStore();
  const [kind, setKind] = useState<"all" | "app" | "build" | "auth" | "billing" | "api" | "support">("all");
  const items = state.activities.filter((a) => kind === "all" || a.kind === kind);
  const kinds: { id: typeof kind; label: string; icon: typeof Activity }[] = [
    { id: "all", label: "All", icon: Activity },
    { id: "build", label: "Builds", icon: CheckCircle2 },
    { id: "auth", label: "Auth", icon: Lock },
    { id: "billing", label: "Billing", icon: CreditCard },
    { id: "api", label: "API", icon: Code2 },
    { id: "support", label: "Support", icon: LifeBuoy },
  ];
  return (
    <div>
      <PageHeader
        title="Activity"
        subtitle="A paginated, indexed trail of account and project metadata. Passwords, OTPs and tokens are never recorded."
        eyebrow="Audit trail"
        actions={<a href={`mailto:${SUPPORT_EMAIL}`} className={buttonClass("secondary", "md")}><LifeBuoy className="h-4 w-4" /> Request export</a>}
      />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {kinds.map((k) => (
          <button key={k.id} onClick={() => setKind(k.id)} className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10.5px] font-semibold transition", kind === k.id ? "border-ink/20 bg-ink text-bg" : "border-line bg-panel text-muted hover:text-ink")}>
            <k.icon className="h-3 w-3" /> {k.label}
          </button>
        ))}
      </div>
      <Card className="overflow-hidden">
        {items.length === 0 ? (
          <div className="p-6"><Empty icon={<Activity className="h-5 w-5" />} title="Nothing recorded yet" body="Build, billing and account events will appear here with timestamps." /></div>
        ) : (
          <div className="divide-y divide-line">
            {items.map((a) => (
              <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                <div className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg", a.kind === "build" ? "bg-lime/10 text-lime" : a.kind === "billing" ? "bg-amber-500/10 text-amber-500" : a.kind === "auth" ? "bg-sky-500/10 text-sky-500" : a.kind === "api" ? "bg-lilac/10 text-lilac" : "bg-panel2 text-muted")}>
                  {a.kind === "build" ? <CheckCircle2 className="h-3.5 w-3.5" /> : a.kind === "billing" ? <CreditCard className="h-3.5 w-3.5" /> : a.kind === "auth" ? <Lock className="h-3.5 w-3.5" /> : a.kind === "api" ? <Code2 className="h-3.5 w-3.5" /> : a.kind === "support" ? <LifeBuoy className="h-3.5 w-3.5" /> : <Smartphone className="h-3.5 w-3.5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11.5px] font-semibold text-ink">{a.title}</span>
                    <Badge tone="neutral" className="px-1.5 py-0.5 text-[8px]">{a.kind}</Badge>
                  </div>
                  <p className="mt-0.5 break-words text-[10.5px] text-muted">{a.detail}</p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[9.5px] text-muted">{relativeTime(a.at)}</div>
                  <div className="font-mono text-[8px] text-muted/70">{new Date(a.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <p className="mt-3 text-center text-[10px] text-muted">Showing {items.length} events · activity metadata is retained separately from project source.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ Download index */

export function DownloadsIndexPage() {
  const { state } = useStore();
  return (
    <div>
      <PageHeader
        title="Downloads"
        subtitle="Every temporary artifact link in one place. Artifacts expire exactly nine minutes after generation."
        eyebrow="Artifact centre"
        actions={<Link to="/app/apps" className={buttonClass("secondary", "md")}><Package className="h-4 w-4" /> All apps</Link>}
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {[
          { icon: FileArchive, t: "APK / AAB", b: "Compiled by the isolated Android worker (Android SDK + Gradle).", status: "Server-side build" },
          { icon: FileCode2, t: "Source ZIP", b: "Generated from your preserved project configuration.", status: "Available" },
          { icon: FileText, t: "permission.txt", b: "Exported from your selected Android permissions.", status: "Available" },
        ].map((x) => (
          <div key={x.t} className="rounded-xl border border-line bg-panel p-3.5">
            <x.icon className="h-4 w-4 text-lime" />
            <div className="mt-2 text-[11px] font-semibold text-ink">{x.t}</div>
            <p className="mt-0.5 text-[9.5px] leading-relaxed text-muted">{x.b}</p>
            <div className={cn("mt-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[8.5px] font-semibold", x.status === "Available" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400")}>
              {x.status === "Available" ? <CheckCircle2 className="h-2.5 w-2.5" /> : <TriangleAlert className="h-2.5 w-2.5" />} {x.status}
            </div>
          </div>
        ))}
      </div>
      {state.apps.length === 0 ? (
        <Card className="p-5"><Empty icon={<Download className="h-5 w-5" />} title="No artifacts yet" body="Create an app to generate a download page and a nine-minute signed link." action={<Link to="/app/create" className={buttonClass("lime", "sm")}><Plus className="h-3.5 w-3.5" /> Create app</Link>} /></Card>
      ) : (
        <div className="space-y-2.5">
          {state.apps.map((app) => (
            <Card key={app.id} className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center">
              <AppIcon app={app} size={38} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/app/apps/${app.id}/download`} className="text-[12px] font-semibold text-ink hover:text-lime">{app.name}</Link>
                  <Badge tone={statusTone(app.buildStatus)}>{STATUS_LABEL[app.buildStatus]}</Badge>
                </div>
                <div className="mt-0.5 truncate font-mono text-[9.5px] text-muted">{app.packageId} · {app.buildType} · {app.artifactMb.toFixed(1)} MB bundle</div>
              </div>
              <ExpiryPill expiresAt={app.linkExpiresAt} />
              <Link to={`/app/apps/${app.id}/download`} className={buttonClass("secondary", "sm")}>Open <ArrowUpRight className="h-3.5 w-3.5" /></Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}


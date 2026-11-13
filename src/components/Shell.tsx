import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  Bell,
  BookOpen,
  ChevronRight,
  Code2,
  CreditCard,
  FileCode2,
  HelpCircle,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  Moon,
  Package,
  PanelLeftClose,
  Plus,
  Search,
  Settings,
  Smartphone,
  Sparkles,
  Sun,
  X,
  Zap,
} from "lucide-react";
import { Badge, buttonClass, Logo, Progress } from "@/components/ui";
import { BuildTerminal } from "@/components/BuildTerminal";
import { SUPPORT_EMAIL } from "@/data/catalog";
import { useStore } from "@/lib/store";
import { cn } from "@/utils/cn";

const NAV = [
  { label: "Workspace", items: [
    { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/app/apps", label: "My Apps", icon: Smartphone },
    { to: "/app/create", label: "Create App", icon: Plus, accent: true },
  ]},
  { label: "Account", items: [
    { to: "/app/plans", label: "Plans & credits", icon: Zap },
    { to: "/app/payments", label: "Payment History", icon: CreditCard },
    { to: "/app/activity", label: "Activity", icon: Activity },
  ]},
  { label: "Developers", items: [
    { to: "/api-docs", label: "API Documentation", icon: Code2 },
    { to: "/ad-docs", label: "Ad SDK Reference", icon: BookOpen },
    { to: "/app/downloads", label: "Downloads", icon: FileCode2 },
  ]},
  { label: "Help", items: [
    { to: "/app/support", label: "Support", icon: LifeBuoy },
    { to: "/app/settings", label: "Settings", icon: Settings },
  ]},
];

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { state } = useStore();
  const location = useLocation();
  if (!state.user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <>{children}</>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{eyebrow}</div>}
        <h1 className="font-display text-[25px] font-bold tracking-tight text-ink sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function AppShell() {
  const { state, quota, theme, toggleTheme, logout, markNotificationsRead } = useStore();
  const [drawer, setDrawer] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const user = state.user!;
  const unread = state.notifications.filter((n) => !n.read).length;
  const initials = user.name.split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase();
  const quotaPct = quota.allowance > 0 ? (quota.remaining / quota.allowance) * 100 : 0;

  useEffect(() => {
    setDrawer(false);
    setNotifOpen(false);
    setUserOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [location.pathname]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, []);

  const sidebar = (
    <aside className="flex h-full w-[252px] shrink-0 flex-col border-r border-line bg-panel/70">
      <div className="flex h-16 items-center justify-between border-b border-line px-4">
        <Link to="/"><Logo size={32} /></Link>
        <button className="rounded-lg p-1.5 text-muted hover:bg-panel2 hover:text-ink lg:hidden" onClick={() => setDrawer(false)} aria-label="Close navigation"><X className="h-4 w-4" /></button>
      </div>

      <div className="border-b border-line px-3 py-3">
        <button onClick={() => navigate("/app/settings")} className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-panel px-2.5 py-2 text-left transition hover:border-ink/20">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-lime font-display text-[11px] font-bold text-limeink">{initials}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11.5px] font-semibold text-ink">{user.name}</div>
            <div className="truncate text-[9.5px] text-muted">{quota.plan.name} plan · {quota.remaining} credits</div>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-muted" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {NAV.map((group) => (
          <div key={group.label} className="mb-4">
            <div className="mb-1.5 px-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted/80">{group.label}</div>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={"end" in item ? item.end : false}
                  className={({ isActive }) =>
                    cn(
                      "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-medium transition",
                      isActive ? "bg-lime/12 text-ink shadow-[inset_2px_0_0_0_#c9f65b]" : "text-muted hover:bg-panel2 hover:text-ink"
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon className={cn("h-[15px] w-[15px] shrink-0", isActive ? "text-lime" : "text-muted group-hover:text-ink")} />
                      <span className="flex-1">{item.label}</span>
                      {item.accent && <span className="rounded bg-lime px-1.5 py-0.5 text-[8px] font-bold uppercase text-limeink">New</span>}
                      {isActive && <span className="h-1 w-1 rounded-full bg-lime" />}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-line p-3">
        <div className="rounded-xl border border-line bg-panel p-3">
          <div className="flex items-center justify-between">
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">App credits</span>
            <Badge tone={quota.remaining > 0 ? "lime" : "rose"} className="px-1.5 py-0.5">{quota.remaining}/{quota.allowance}</Badge>
          </div>
          <div className="mt-2 flex items-end justify-between">
            <div className="font-display text-[19px] font-bold leading-none text-ink">{quota.remaining}</div>
            <span className="text-[9px] text-muted">remaining</span>
          </div>
          <Progress value={quotaPct} className="mt-2" tone={quota.remaining === 0 ? "rose" : "lime"} />
          <div className="mt-2 text-[9px] leading-relaxed text-muted">Resets {quota.resetLabel}</div>
          <Link to="/app/plans" className={buttonClass(quota.remaining === 0 ? "lime" : "secondary", "sm", "mt-2.5 w-full")}>
            <Sparkles className="h-3 w-3" /> {quota.plan.id === "free" ? "Upgrade plan" : "Manage plan"}
          </Link>
        </div>
        <div className="mt-2 flex items-center justify-between px-1">
          <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex items-center gap-1.5 text-[9.5px] text-muted hover:text-ink"><HelpCircle className="h-3 w-3" /> Help & support</a>
          <button onClick={() => { logout(); navigate("/"); }} className="inline-flex items-center gap-1.5 text-[9.5px] text-muted hover:text-rose-500"><LogOut className="h-3 w-3" /> Log out</button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-bg">
      <div className="sticky top-0 hidden h-screen lg:block">{sidebar}</div>
      {drawer && (
        <div className="fixed inset-0 z-[70] flex lg:hidden">
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setDrawer(false)} />
          <div className="relative h-full animate-rise">{sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-2 border-b border-line bg-bg/80 px-4 backdrop-blur-xl sm:px-6">
          <button className="rounded-lg border border-line p-2 text-muted hover:text-ink lg:hidden" onClick={() => setDrawer(true)} aria-label="Open navigation"><Menu className="h-4 w-4" /></button>
          <div className="hidden items-center gap-2 text-[11px] text-muted sm:flex">
            <Link to="/app" className="hover:text-ink">Workspace</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-ink">{location.pathname === "/app" ? "Dashboard" : location.pathname.split("/").filter(Boolean).slice(1).map((x) => x.replace(/-/g, " ")).join(" / ") || "Dashboard"}</span>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Link to="/app/create" className={buttonClass("lime", "sm", "hidden sm:inline-flex")}><Plus className="h-3.5 w-3.5" /> Create app</Link>
            <button className="hidden rounded-lg border border-line p-2 text-muted transition hover:text-ink md:block" onClick={() => navigate("/app/search")} aria-label="Search workspace"><Search className="h-4 w-4" /></button>
            <button onClick={toggleTheme} className="rounded-lg border border-line p-2 text-muted transition hover:text-ink" aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <div className="relative" ref={notifRef}>
              <button onClick={() => { setNotifOpen(!notifOpen); if (!notifOpen) setTimeout(markNotificationsRead, 2500); }} className="relative rounded-lg border border-line p-2 text-muted transition hover:text-ink" aria-label="Notifications">
                <Bell className="h-4 w-4" />
                {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-lime px-1 text-[8px] font-bold text-limeink">{unread}</span>}
              </button>
              {notifOpen && (
                <div className="animate-rise absolute right-0 top-11 z-50 w-[310px] overflow-hidden rounded-xl border border-line bg-panel shadow-2xl">
                  <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
                    <span className="text-[11.5px] font-semibold text-ink">Notifications</span>
                    <span className="text-[9px] text-muted">{state.notifications.length} total</span>
                  </div>
                  <div className="max-h-[320px] overflow-y-auto">
                    {state.notifications.length === 0 ? (
                      <p className="px-4 py-8 text-center text-[11px] text-muted">You&apos;re all caught up.</p>
                    ) : state.notifications.slice(0, 6).map((n) => (
                      <div key={n.id} className={cn("border-b border-line px-3.5 py-2.5 last:border-0", !n.read && "bg-lime/[0.035]")}>
                        <div className="flex items-center gap-2">
                          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", n.kind === "billing" ? "bg-amber-400" : n.kind === "build" ? "bg-lime" : "bg-sky-400")} />
                          <span className="text-[11px] font-semibold text-ink">{n.title}</span>
                        </div>
                        <p className="mt-0.5 pl-3.5 text-[10.5px] leading-relaxed text-muted">{n.body}</p>
                      </div>
                    ))}
                  </div>
                  <Link to="/app/activity" className="block border-t border-line px-3.5 py-2.5 text-center text-[10.5px] font-semibold text-ink hover:bg-panel2" onClick={() => setNotifOpen(false)}>View all activity</Link>
                </div>
              )}
            </div>
            <div className="relative" ref={userRef}>
              <button onClick={() => setUserOpen(!userOpen)} className="ml-0.5 grid h-9 w-9 place-items-center rounded-full border border-line bg-panel2 font-display text-[11px] font-bold text-ink" aria-label="Account menu">{initials}</button>
              {userOpen && (
                <div className="animate-rise absolute right-0 top-11 z-50 w-[220px] overflow-hidden rounded-xl border border-line bg-panel p-1.5 shadow-2xl">
                  <div className="border-b border-line px-2.5 py-2">
                    <div className="truncate text-[11.5px] font-semibold text-ink">{user.name}</div>
                    <div className="truncate text-[9.5px] text-muted">{user.email}</div>
                    <div className="mt-1.5 flex items-center gap-1.5"><Badge tone={user.emailVerified ? "green" : "amber"} className="px-1.5 py-0.5">{user.emailVerified ? "Verified" : "Unverified"}</Badge><Badge className="px-1.5 py-0.5">{quota.plan.name}</Badge></div>
                  </div>
                  {[
                    { label: "Profile & settings", icon: Settings, to: "/app/settings" },
                    { label: "My apps", icon: Package, to: "/app/apps" },
                    { label: "Plans & credits", icon: Zap, to: "/app/plans" },
                    { label: "API documentation", icon: Code2, to: "/api-docs" },
                  ].map((i) => (
                    <Link key={i.to} to={i.to} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] text-muted hover:bg-panel2 hover:text-ink" onClick={() => setUserOpen(false)}>
                      <i.icon className="h-3.5 w-3.5" /> {i.label}
                    </Link>
                  ))}
                  <button onClick={() => { logout(); navigate("/"); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] text-muted hover:bg-rose-500/10 hover:text-rose-500">
                    <LogOut className="h-3.5 w-3.5" /> Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-6 sm:px-6 sm:py-7">
          <Outlet />
        </main>
        <BuildTerminal />
        <footer className="border-t border-line px-4 py-4 sm:px-6">
          <div className="mx-auto flex max-w-[1240px] flex-col items-start justify-between gap-2 text-[10px] text-muted sm:flex-row sm:items-center">
            <span>U APP workspace · Build anything. Launch everywhere.</span>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Website operational</span>
              <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Build runner setup required</span>
              <Link to="/app/settings" className="hover:text-ink">System status</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export function SidebarCollapseHint() {
  return <span className="hidden"><PanelLeftClose className="h-3 w-3" /></span>;
}

export function ExternalLinkPill({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-line bg-panel px-2 py-1 text-[10px] font-medium text-muted transition hover:text-ink">
      {children} <ArrowUpRight className="h-3 w-3" />
    </a>
  );
}

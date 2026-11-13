import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Code2, Mail, Menu, Moon, Sun, X } from "lucide-react";
import { Logo, buttonClass } from "@/components/ui";
import { SUPPORT_EMAIL } from "@/data/catalog";
import { useStore } from "@/lib/store";
import { cn } from "@/utils/cn";

const LINKS = [
  { label: "Product", to: "/", anchor: "product" },
  { label: "How it works", to: "/", anchor: "how" },
  { label: "Templates", to: "/", anchor: "templates" },
  { label: "Ad SDK", to: "/ad-docs" },
  { label: "Developers", to: "/api-docs" },
  { label: "Pricing", to: "/plans" },
];

export function PublicNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { theme, toggleTheme, state } = useStore();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const go = (l: (typeof LINKS)[number]) => {
    setOpen(false);
    if (l.anchor) {
      if (location.pathname === "/") {
        document.getElementById(l.anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        navigate("/");
        window.setTimeout(() => document.getElementById(l.anchor!)?.scrollIntoView({ behavior: "smooth" }), 220);
      }
    } else {
      navigate(l.to);
    }
  };

  return (
    <header className={cn("sticky top-0 z-50 transition-all duration-300", scrolled ? "border-b border-line bg-bg/80 backdrop-blur-xl" : "bg-transparent")}>
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-4 px-5 sm:px-8">
        <Link to="/" aria-label="U APP home" className="shrink-0">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <button
              key={l.label}
              onClick={() => go(l)}
              className="rounded-lg px-3 py-2 text-[12.5px] font-medium text-muted transition hover:bg-panel2 hover:text-ink"
            >
              {l.label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="grid h-9 w-9 place-items-center rounded-lg border border-line text-muted transition hover:text-ink"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          {state.user ? (
            <Link to="/app" className={buttonClass("lime", "sm", "hidden sm:inline-flex")}>
              Open workspace <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <>
              <Link to="/login" className={buttonClass("ghost", "sm", "hidden sm:inline-flex")}>Log in</Link>
              <Link to="/register" className={buttonClass("lime", "sm", "hidden sm:inline-flex")}>Start building</Link>
            </>
          )}
          <button onClick={() => setOpen(!open)} className="grid h-9 w-9 place-items-center rounded-lg border border-line text-ink lg:hidden" aria-label="Toggle menu">
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-line bg-bg/95 px-5 pb-5 pt-3 backdrop-blur-xl lg:hidden">
          <div className="flex flex-col">
            {LINKS.map((l) => (
              <button key={l.label} onClick={() => go(l)} className="border-b border-line py-3 text-left text-sm font-medium text-ink">
                {l.label}
              </button>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <Link to="/login" className={buttonClass("secondary", "md", "flex-1")} onClick={() => setOpen(false)}>Log in</Link>
            <Link to="/register" className={buttonClass("lime", "md", "flex-1")} onClick={() => setOpen(false)}>Start free</Link>
          </div>
        </div>
      )}
    </header>
  );
}

export function PublicFooter() {
  const { theme, toggleTheme } = useStore();
  const cols = [
    { title: "Product", items: [{ label: "App builder", to: "/register" }, { label: "UI templates", to: "/", anchor: "templates" }, { label: "Plans & pricing", to: "/plans" }, { label: "Downloads", to: "/apps" }] },
    { title: "Build", items: [{ label: "Website to app", to: "/register" }, { label: "HTML to app", to: "/register" }, { label: "ZIP to app", to: "/register" }, { label: "Android project", to: "/register" }] },
    { title: "Developers", items: [{ label: "Public API", to: "/api-docs" }, { label: "Ad SDK reference", to: "/ad-docs" }, { label: "API keys", to: "/api-docs" }, { label: "Build status", to: "/apps" }] },
    { title: "Account", items: [{ label: "Dashboard", to: "/app" }, { label: "Payment history", to: "/app/payments" }, { label: "Support", to: "/support" }, { label: "Settings", to: "/settings" }] },
  ];
  return (
    <footer className="border-t border-line bg-panel/40">
      <div className="mx-auto max-w-[1240px] px-5 py-14 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <Logo size={36} />
            <p className="mt-4 max-w-xs text-[12.5px] leading-relaxed text-muted">
              U APP turns websites, HTML, ZIPs and Android projects into real installable apps. Build anything. Launch everywhere.
            </p>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="mt-4 inline-flex items-center gap-2 text-[12.5px] font-medium text-ink hover:text-lime">
              <Mail className="h-3.5 w-3.5" /> {SUPPORT_EMAIL}
            </a>
            <div className="mt-5 flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="inline-flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-medium text-muted transition hover:text-ink"
              >
                {theme === "dark" ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
                {theme === "dark" ? "Light theme" : "Dark theme"}
              </button>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-medium text-muted">
                <Code2 className="h-3 w-3" /> Android build engine
              </span>
            </div>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{c.title}</h4>
              <ul className="mt-3 space-y-2.5">
                {c.items.map((i) => (
                  <li key={i.label}>
                    <Link to={i.to} className="text-[12.5px] text-muted transition hover:text-ink">{i.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11.5px] text-muted">© 2026 U APP. All rights reserved. Build anything. Launch everywhere.</p>
          <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-emerald-400" /> Website operational
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Build runner: setup required
            </span>
            <Link to="/verify-id" className="hover:text-ink">Verification</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

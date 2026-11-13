import { useEffect, useState } from "react";
import { HashRouter, Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ArrowLeft, Compass } from "lucide-react";
import { StoreProvider } from "@/lib/store";
import { ToastProvider, buttonClass, Logo } from "@/components/ui";
import { cn } from "@/utils/cn";
import { AppShell, ProtectedRoute } from "@/components/Shell";
import Landing from "@/pages/Landing";
import { LoginPage, RegisterPage, VerifyMagicPage } from "@/pages/Auth";
import { DashboardPage, MyAppsPage, AppDetailPage, ActivityPage, DownloadsIndexPage } from "@/pages/Dashboard";
import BuilderPage from "@/pages/Builder";
import { PublicPlansPage, WorkspacePlansPage, PaymentPage, PaymentHistoryPage } from "@/pages/Billing";
import { ApiDocsPage, AdDocsPage } from "@/pages/Docs";
import { SupportPage, SettingsPage } from "@/pages/SupportSettings";
import DownloadPage from "@/pages/Download";

const TITLES: Record<string, string> = {
  "/": "U APP — Build Anything. Launch Everywhere.",
  "/plans": "Plans & credits — U APP",
  "/login": "Log in — U APP",
  "/register": "Create your account — U APP",
  "/verify-id": "Verify your identity — U APP",
  "/api-docs": "Developer API — U APP",
  "/ad-docs": "Ad SDK reference — U APP",
  "/app": "Dashboard — U APP",
  "/app/create": "Create App — U APP",
  "/app/apps": "My Apps — U APP",
  "/app/payments": "Payment History — U APP",
  "/app/activity": "Activity — U APP",
  "/app/support": "Support — U APP",
  "/app/settings": "Settings — U APP",
  "/pay": "Payment — U APP",
};

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    document.title = TITLES[pathname] ?? "U APP — Build Anything. Launch Everywhere.";
  }, [pathname]);
  return null;
}

function BootSplash() {
  const [gone, setGone] = useState(false);
  const [fading, setFading] = useState(false);
  useEffect(() => {
    const fade = window.setTimeout(() => setFading(true), 520);
    const remove = window.setTimeout(() => setGone(true), 1000);
    return () => { window.clearTimeout(fade); window.clearTimeout(remove); };
  }, []);
  if (gone) return null;
  return (
    <div className={cn("fixed inset-0 z-[200] grid place-items-center bg-bg transition-opacity duration-500", fading && "pointer-events-none opacity-0")}>
      <div className="flex flex-col items-center">
        <div className="animate-pulse-dot"><Logo size={52} withWord={false} /></div>
        <div className="mt-4 font-display text-[14px] font-semibold tracking-tight text-ink">U APP</div>
        <div className="mt-1 text-[9px] uppercase tracking-[0.24em] text-muted">Build anything · launch everywhere</div>
        <div className="mt-4 h-0.5 w-28 overflow-hidden rounded-full bg-panel2"><div className="shimmer h-full w-full" /></div>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 text-center">
      <Logo size={40} />
      <div className="mt-8 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Error 404</div>
      <h1 className="mt-2 font-display text-[32px] font-bold tracking-tight text-ink">This route doesn&apos;t exist.</h1>
      <p className="mt-2 max-w-sm text-[12.5px] leading-relaxed text-muted">The build may have moved, or the link is incomplete. Head back to the workspace or the platform home.</p>
      <div className="mt-5 flex gap-2">
        <Link to="/" className={buttonClass("secondary", "md")}><ArrowLeft className="h-4 w-4" /> Home</Link>
        <Link to="/app" className={buttonClass("lime", "md")}><Compass className="h-4 w-4" /> Open workspace</Link>
      </div>
    </div>
  );
}

const Protected = ({ children }: { children: React.ReactNode }) => <ProtectedRoute>{children}</ProtectedRoute>;

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <HashRouter>
          <BootSplash />
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/plans" element={<PublicPlansPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify-id" element={<VerifyMagicPage />} />
            <Route path="/verify-id.php" element={<VerifyMagicPage />} />
            <Route path="/api-docs" element={<ApiDocsPage />} />
            <Route path="/api-doce-app" element={<ApiDocsPage />} />
            <Route path="/api-doce-app.php" element={<ApiDocsPage />} />
            <Route path="/ad-docs" element={<AdDocsPage />} />
            <Route path="/api-doce" element={<AdDocsPage />} />
            <Route path="/api-doce.php" element={<AdDocsPage />} />

            <Route path="/app" element={<Protected><AppShell /></Protected>}>
              <Route index element={<DashboardPage />} />
              <Route path="apps" element={<MyAppsPage />} />
              <Route path="apps/:id" element={<AppDetailPage />} />
              <Route path="apps/:id/download" element={<DownloadPage />} />
              <Route path="create" element={<BuilderPage />} />
              <Route path="plans" element={<WorkspacePlansPage />} />
              <Route path="payments" element={<PaymentHistoryPage />} />
              <Route path="activity" element={<ActivityPage />} />
              <Route path="downloads" element={<DownloadsIndexPage />} />
              <Route path="support" element={<SupportPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            <Route path="/pay" element={<Protected><AppShell /></Protected>}>
              <Route index element={<PaymentPage />} />
            </Route>
            <Route path="/pay.php" element={<Protected><AppShell /></Protected>}>
              <Route index element={<PaymentPage />} />
            </Route>
            <Route path="/dashboard" element={<Navigate to="/app" replace />} />
            <Route path="/apps" element={<Navigate to="/app/apps" replace />} />
            <Route path="/support" element={<Navigate to="/app/support" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </HashRouter>
      </ToastProvider>
    </StoreProvider>
  );
}

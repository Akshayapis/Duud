import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  Lock,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  WifiOff,
  Zap,
} from "lucide-react";
import { Badge, Button, buttonClass, Field, Input, Logo, useToast } from "@/components/ui";
import { FREE_MONTHLY_CREDITS } from "@/data/catalog";
import { useStore } from "@/lib/store";
import { isFirebaseReady } from "@/lib/firebase";
import { cn } from "@/utils/cn";

function AuthFrame({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <div className="grid min-h-screen lg:grid-cols-[1.02fr_.98fr]">
        <div className="relative hidden overflow-hidden border-r border-line bg-[#080a0d] lg:flex lg:flex-col lg:justify-between">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_25%_10%,rgba(201,246,91,.16),transparent_65%),radial-gradient(50%_50%_at_90%_80%,rgba(183,156,255,.13),transparent_70%)]" />
          <div className="pointer-events-none absolute inset-0 dot-bg opacity-[0.08]" />
          <div className="relative z-10 p-9">
            <Link to="/"><Logo size={38} /></Link>
          </div>
          <div className="relative z-10 px-9 pb-10">
            <Badge tone="lime" className="mb-6"><span className="h-1.5 w-1.5 rounded-full bg-lime animate-pulse-dot" /> Build anything. Launch everywhere.</Badge>
            <h1 className="max-w-md font-display text-[38px] font-bold leading-[1.04] tracking-[-0.04em] text-[#f3f5ee]">
              One workspace.
              <br />
              <span className="text-gradient">Every app idea.</span>
            </h1>
            <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-[#99a096]">
              Sign in to create apps, track builds, manage your API keys and download artifacts while the nine-minute
              window is open.
            </p>
            <div className="mt-8 max-w-sm rounded-2xl border border-white/10 bg-white/[0.035] p-4 backdrop-blur">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#aab2a3]">Free monthly allowance</div>
                <span className="rounded bg-lime px-1.5 py-0.5 text-[8px] font-bold text-[#131a04]">FREE</span>
              </div>
              <div className="mt-3 flex items-end gap-2">
                <span className="font-display text-4xl font-bold leading-none text-[#f3f5ee]">{FREE_MONTHLY_CREDITS}</span>
                <span className="pb-1 text-[11px] text-[#99a096]">app creation credits / month</span>
              </div>
              <div className="mt-3 flex gap-1.5">
                {Array.from({ length: FREE_MONTHLY_CREDITS }).map((_, i) => <span key={i} className="h-1.5 flex-1 rounded-full bg-lime/80" />)}
              </div>
              <p className="mt-3 text-[10.5px] leading-relaxed text-[#7c847b]">Enforced per Firebase UID. Resets automatically at the start of every calendar month.</p>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[10.5px] text-[#8b9387]">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3 w-3 text-lime" /> Firebase Authentication</span>
              <span className="inline-flex items-center gap-1.5"><Lock className="h-3 w-3 text-lime" /> Passwords never stored here</span>
              <span className="inline-flex items-center gap-1.5"><Zap className="h-3 w-3 text-lime" /> 3 free builds</span>
            </div>
          </div>
          <div className="relative z-10 border-t border-white/8 px-9 py-4 text-[9.5px] text-[#6f776c]">
            U APP · Premium app creation platform · 2026
          </div>
        </div>

        <div className="flex flex-col bg-bg">
          <div className="flex items-center justify-between px-5 py-5 sm:px-8">
            <Link to="/" className="lg:hidden"><Logo size={32} /></Link>
            <Link to="/" className="ml-auto inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted transition hover:text-ink">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to site
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-center px-5 pb-12 sm:px-8">
            <div className="w-full max-w-[400px] animate-rise">
              <h2 className="font-display text-[26px] font-bold tracking-tight text-ink">{title}</h2>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{subtitle}</p>
              <div className="mt-7">{children}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type AuthError = { message: string; kind?: string } | null;

function AuthErrorCard({ error, onOffline, offlineEmail, offlineName }: { error: AuthError; onOffline: () => void; offlineEmail?: string; offlineName?: string }) {
  if (!error) return null;
  const recoverable = error.kind === "domain" || error.kind === "config" || error.kind === "network";
  return (
    <div className="mt-3 rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-3">
      <div className="flex items-start gap-2">
        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
        <p className="text-[11px] leading-relaxed text-ink">{error.message}</p>
      </div>
      {recoverable && (
        <div className="mt-2.5 border-t border-rose-500/15 pt-2.5">
          <p className="text-[9.5px] leading-relaxed text-muted">
            Firebase Console → Authentication → Settings → Authorized domains. Add this exact host:{" "}
            <code className="rounded bg-panel px-1 py-0.5 font-mono text-[9px] text-ink">{typeof window !== "undefined" ? window.location.hostname : "your-domain"}</code>
          </p>
          <button onClick={onOffline} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[10px] font-semibold text-ink transition hover:border-lime/40">
            <WifiOff className="h-3 w-3 text-amber-500" /> Continue on this device instead
          </button>
          <p className="mt-1 text-[8.5px] leading-relaxed text-muted">
            {offlineName ? `Creates a device-local workspace (${offlineEmail || "no email"}) without cloud sign-in. Your projects stay in this browser.` : "Creates a device-local workspace without cloud sign-in."}
          </p>
        </div>
      )}
    </div>
  );
}

function GoogleButton({ onError, label = "Continue with Google" }: { onError: (e: AuthError) => void; label?: string }) {
  const { googleLogin } = useStore();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        onError(null);
        setBusy(true);
        const res = await googleLogin();
        setBusy(false);
        if (!res.ok) {
          onError({ message: res.message ?? "Google sign-in failed.", kind: res.kind });
          return;
        }
        toast(`Signed in as ${res.email}`, "success");
        navigate("/app");
      }}
      className={buttonClass("secondary", "md", "w-full bg-panel")}
    >
      {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-ink" /> : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.8Z" />
          <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.2 0-5.9-2.1-6.8-5H1.2v3.1A12 12 0 0 0 12 24Z" />
          <path fill="#FBBC05" d="M5.2 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.2a12 12 0 0 0 0 10.8l4-3.1Z" />
          <path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.5-3.5A12 12 0 0 0 1.2 6.6l4 3.1C6.1 6.8 8.8 4.8 12 4.8Z" />
        </svg>
      )}
      {busy ? "Opening Google…" : label}
    </button>
  );
}

function Divider() {
  return (
    <div className="my-5 flex items-center gap-3">
      <span className="h-px flex-1 bg-line" />
      <span className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-muted">or with email</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/* ------------------------------------------------------------------ Login */

export function LoginPage() {
  const { state, login, continueOffline } = useStore();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/app";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthError>(null);
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => {
    if (state.user && state.authReady) {
      const t = window.setTimeout(() => navigate(next, { replace: true }), 350);
      return () => window.clearTimeout(t);
    }
  }, [state.user, state.authReady, navigate, next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await login({ email, password });
    setBusy(false);
    if (!res.ok) {
      setError({ message: res.message ?? "Unable to sign in.", kind: res.kind });
      return;
    }
    toast(res.needsVerification ? "Signed in — verify your email to unlock the workspace." : "Signed in successfully.", res.needsVerification ? "info" : "success");
    navigate(res.needsVerification ? "/verify-id" : next);
  };

  return (
    <AuthFrame title="Welcome back" subtitle="Sign in with Google or your email. Authentication is handled by Firebase.">
      {state.user && state.authReady && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-lime/25 bg-lime/5 px-3 py-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-lime" />
          <span className="text-[10.5px] text-ink">Already signed in as {state.user.email}. Opening workspace…</span>
        </div>
      )}
      <GoogleButton onError={setError} />
      <Divider />
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="Email address">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="email" placeholder="you@example.com" className="pl-9" />
          </div>
        </Field>
        <Field label="Password">
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <Input value={password} onChange={(e) => setPassword(e.target.value)} type={show ? "text" : "password"} required autoComplete="current-password" placeholder="Your password" className="px-9" />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted hover:text-ink" aria-label="Toggle password">
              {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </Field>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-[10px] text-muted"><ShieldCheck className="h-3 w-3 text-lime" /> Firebase secured</span>
          <button type="button" onClick={() => setResetOpen(true)} className="text-[11px] font-semibold text-ink hover:text-lime">Forgot password?</button>
        </div>
        <AuthErrorCard error={error} onOffline={() => { continueOffline({ name: email.split("@")[0] || "Builder", email }); toast("Device-local workspace opened. Data stays in this browser.", "info"); navigate("/app"); }} offlineEmail={email} />
        <Button type="submit" variant="lime" className="w-full" loading={busy}>Sign in <ArrowRight className="h-4 w-4" /></Button>
      </form>
      {resetOpen && <ResetPassword email={email} onClose={() => setResetOpen(false)} />}
      <p className="mt-5 text-center text-[11.5px] text-muted">
        New to U APP? <Link to="/register" className="font-semibold text-ink hover:text-lime">Create an account</Link>
      </p>
      <div className="mt-4 flex items-center justify-center gap-1.5 text-[9px] text-muted">
        {isFirebaseReady ? <><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Firebase project connected</> : <><span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> Firebase configuration error</>}
      </div>
    </AuthFrame>
  );
}

function ResetPassword({ email, onClose }: { email: string; onClose: () => void }) {
  const { resetPassword } = useStore();
  const [value, setValue] = useState(email);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="mt-3 rounded-xl border border-line bg-panel p-3.5">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink"><KeyRound className="h-3.5 w-3.5 text-lime" /> Reset password</span>
        <button onClick={onClose} className="text-[9.5px] text-muted hover:text-ink">Close</button>
      </div>
      <p className="mt-1 text-[10px] leading-relaxed text-muted">Firebase will email a secure reset link to this address.</p>
      <div className="mt-2 flex gap-2">
        <Input value={value} onChange={(e) => setValue(e.target.value)} type="email" placeholder="you@example.com" />
        <Button
          variant="secondary"
          size="md"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            const res = await resetPassword(value);
            setBusy(false);
            setMsg({ ok: res.ok, text: res.message ?? "" });
          }}
        >Send</Button>
      </div>
      {msg && <p className={cn("mt-2 text-[10px] leading-relaxed", msg.ok ? "text-emerald-500" : "text-rose-500")}>{msg.text}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ Register */

export function RegisterPage() {
  const { register, continueOffline } = useStore();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const plan = params.get("plan");
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthError>(null);

  const strength = useMemo(() => {
    const p = form.password;
    let sc = 0;
    if (p.length >= 8) sc++;
    if (/[A-Z]/.test(p)) sc++;
    if (/[0-9]/.test(p)) sc++;
    if (/[^A-Za-z0-9]/.test(p)) sc++;
    return sc;
  }, [form.password]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = "Enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Enter a valid email address.";
    if (form.password.length < 8) next.password = "Use at least 8 characters.";
    if (form.password !== form.confirm) next.confirm = "Passwords do not match.";
    setErrs(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    const res = await register({ name: form.name, email: form.email, password: form.password });
    setBusy(false);
    if (!res.ok) {
      setError({ message: res.message ?? "Registration failed.", kind: res.kind });
      return;
    }
    toast("Account created. Verify your email to unlock every feature.", "success");
    navigate(plan ? `/verify-id?next=${encodeURIComponent(`/pay?plan=${plan}`)}` : "/verify-id");
  };

  return (
    <AuthFrame title="Create your account" subtitle="A real Firebase account with 3 free app creation credits every calendar month.">
      <GoogleButton label="Sign up with Google" onError={setError} />
      <Divider />
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="Full name" error={errs.name}>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Aarav Sharma" required autoComplete="name" />
        </Field>
        <Field label="Email address" error={errs.email}>
          <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" placeholder="you@example.com" required autoComplete="email" />
        </Field>
        <Field label="Password" hint="Handled by Firebase Authentication. U APP never receives or stores your password." error={errs.password}>
          <div className="relative">
            <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} type={show ? "text" : "password"} placeholder="Create a strong password" className="pr-10" required autoComplete="new-password" />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted hover:text-ink" aria-label="Toggle password">
              {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </Field>
        {form.password && (
          <div className="flex gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={cn("h-1 flex-1 rounded-full", i < strength ? (strength < 2 ? "bg-rose-400" : strength < 4 ? "bg-amber-400" : "bg-lime") : "bg-panel2")} />
            ))}
          </div>
        )}
        <Field label="Confirm password" error={errs.confirm}>
          <Input value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} type="password" placeholder="Repeat your password" required autoComplete="new-password" />
        </Field>
        {plan && (
          <div className="flex items-center justify-between rounded-lg border border-lime/25 bg-lime/5 px-3 py-2">
            <span className="text-[11px] font-medium text-ink">Selected plan: {plan}</span>
            <Badge tone="lime">After registration</Badge>
          </div>
        )}
        <label className="flex items-start gap-2.5 text-[10.5px] leading-relaxed text-muted">
          <input type="checkbox" required className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-line accent-lime" />
          <span>I agree to the acceptable-use rules for app creation and understand that paid plans activate only after manual UPI approval.</span>
        </label>
        <AuthErrorCard error={error} onOffline={() => { continueOffline({ name: form.name, email: form.email }); toast("Device-local workspace opened. Firebase sign-in is unavailable.", "info"); navigate("/app"); }} offlineName={form.name} offlineEmail={form.email} />
        <Button type="submit" variant="lime" className="w-full" loading={busy}>Create Firebase account <ArrowRight className="h-4 w-4" /></Button>
      </form>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {[
          [CheckCircle2, "3 free apps / month"],
          [ShieldCheck, "Firebase secured"],
          [Zap, "54 UI templates"],
          [Lock, "No card required"],
        ].map(([Ico, label]) => {
          const Icon = Ico as typeof CheckCircle2;
          return <span key={label as string} className="flex items-center gap-1.5 text-[10.5px] text-muted"><Icon className="h-3.5 w-3.5 text-lime" /> {label as string}</span>;
        })}
      </div>
      <p className="mt-5 text-center text-[11.5px] text-muted">
        Already have an account? <Link to="/login" className="font-semibold text-ink hover:text-lime">Sign in</Link>
      </p>
    </AuthFrame>
  );
}

/* ------------------------------------------------------------------ Email verification */

export function VerifyMagicPage() {
  const { state, resendVerification, refreshVerification, continueOffline, updateUser } = useStore();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/app";
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const user = state.user;

  useEffect(() => {
    if (!state.authReady) return;
    if (!user) return;
    if (user.emailVerified) {
      const t = window.setTimeout(() => navigate(next, { replace: true }), 900);
      return () => window.clearTimeout(t);
    }
  }, [state.authReady, user, navigate, next]);

  const check = async () => {
    setChecking(true);
    const res = await refreshVerification();
    setChecking(false);
    setNotice({ ok: res.ok, text: res.message ?? "" });
    toast(res.message ?? "Checked verification status.", res.ok ? "success" : "error");
    if (res.ok) {
      if (state.user) updateUser({ emailVerified: true });
      window.setTimeout(() => navigate(next, { replace: true }), 700);
    }
  };

  const resend = async () => {
    setSending(true);
    const res = await resendVerification();
    setSending(false);
    setNotice({ ok: res.ok, text: res.message ?? "" });
    toast(res.message ?? "Verification email requested.", res.ok ? "success" : "error");
  };

  return (
    <AuthFrame title="Verify your email" subtitle="Firebase sent a secure verification link to your inbox. Open it once, then confirm here.">
      <div className="rounded-2xl border border-line bg-panel p-5">
        {!state.authReady ? (
          <div className="flex items-center gap-3">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-lime" />
            <p className="text-[12.5px] font-medium text-ink">Checking your secure session…</p>
          </div>
        ) : !user ? (
          <div className="text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-rose-500/10 text-rose-500"><Lock className="h-5 w-5" /></div>
            <h3 className="mt-3 font-display text-[18px] font-semibold text-ink">No active session</h3>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">Sign in again to continue email verification.</p>
            <Button variant="lime" className="mt-4 w-full" onClick={() => navigate("/login")}>Go to sign in</Button>
          </div>
        ) : user.emailVerified ? (
          <div className="text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-lime/15 text-lime"><Check className="h-6 w-6" /></div>
            <h3 className="mt-3 font-display text-[18px] font-semibold text-ink">Email verified</h3>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">Your account is fully unlocked. Taking you to the workspace…</p>
            <Button variant="lime" className="mt-4 w-full" onClick={() => navigate(next)}>Continue to workspace <ArrowRight className="h-4 w-4" /></Button>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 rounded-xl border border-line bg-panel2/50 px-3.5 py-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-lime/10 text-lime"><Mail className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">Verification link sent to</div>
                <div className="truncate text-[12.5px] font-semibold text-ink">{user.email}</div>
              </div>
              <Badge tone="amber">Unverified</Badge>
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-line bg-panel2/40 p-2.5">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
              <p className="text-[10px] leading-relaxed text-muted">
                Open the link in the Firebase email (check spam). The link belongs to the Firebase project, and returns to
                this app. If it does not arrive, resend below. Verification is a real Firebase check — never a simulated flag.
              </p>
            </div>
            {notice && <p className={cn("mt-2 rounded-lg border px-3 py-2 text-[10.5px] leading-relaxed", notice.ok ? "border-emerald-500/25 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400" : "border-amber-500/25 bg-amber-500/5 text-amber-600 dark:text-amber-400")}>{notice.text}</p>}
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Button variant="lime" onClick={check} loading={checking}><RefreshCw className="h-4 w-4" /> I&apos;ve verified</Button>
              <Button variant="secondary" onClick={resend} loading={sending}><Mail className="h-4 w-4" /> Resend email</Button>
            </div>
            <button onClick={() => navigate("/app")} className={buttonClass("ghost", "sm", "mt-2 w-full")}>
              Continue to workspace (verification reminder will remain)
            </button>
          </div>
        )}
      </div>
      <div className="mt-4 rounded-xl border border-line bg-panel/60 p-3">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted"><Clock className="h-3 w-3" /> What Firebase handles</div>
        <ul className="mt-1.5 space-y-1">
          {["Cryptographically signed verification link", "Single-use email action", "Password reset without exposing passwords", "Google and email providers in the same UID space"].map((x) => (
            <li key={x} className="flex items-start gap-1.5 text-[9.5px] leading-relaxed text-muted"><CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-lime" /> {x}</li>
          ))}
        </ul>
      </div>
      {state.authMode === "offline" && user && (
        <button onClick={() => { continueOffline({ name: user.name, email: user.email }); toast("Device session refreshed.", "info"); navigate("/app"); }} className={buttonClass("secondary", "sm", "mt-3 w-full")}>
          <WifiOff className="h-3.5 w-3.5" /> Refresh device-local session
        </button>
      )}
      <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[10px] text-muted">
        <Sparkles className="h-3 w-3 text-lime" /> Need help? <a href="mailto:akshay123fagg@gmail.com" className="font-semibold text-ink hover:text-lime">akshay123fagg@gmail.com</a>
      </p>
    </AuthFrame>
  );
}

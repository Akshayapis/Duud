import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DOWNLOAD_TTL_SECONDS,
  FREE_MONTHLY_CREDITS,
  PLANS,
  type Plan,
} from "@/data/catalog";
import { BUILD_TIMEOUT_MS, artifactsFromJob, cancelBuild as cancelServerBuild, buildStatus, queueBuild, type PlatformArtifact } from "@/lib/buildService";
import { fetchPaymentRequests, submitPaymentRequest } from "@/lib/payments";
import {
  emailLogin,
  emailRegister,
  fbLogout,
  firebaseErrorMessage,
  googleSignIn,
  hasVerifiedEmail,
  isFirebaseReady,
  passwordReset,
  readProfile,
  resendVerificationEmail,
  watchAuth,
  writeActivity,
  writeProfile,
  writeProjectMeta,
} from "@/lib/firebase";

export type User = {
  uid: string;
  name: string;
  email: string;
  provider: "password" | "google";
  emailVerified: boolean;
  createdAt: string;
  planId: string;
  planActivatedAt?: string;
  planExpiresAt?: string;
  photo?: string;
  bio?: string;
  company?: string;
  notifyBuilds: boolean;
  notifyPayments: boolean;
  notifyProduct: boolean;
};

export type AppRecord = {
  id: string;
  name: string;
  packageId: string;
  type: string;
  sourceLabel: string;
  template: string;
  templateId: number;
  permissions: string[];
  adsEnabled: boolean;
  adNetwork?: string;
  adFormats: string[];
  adTiming?: string;
  adTestMode?: boolean;
  adAppId?: string;
  adUnits?: Record<string, string>;
  version: string;
  buildStatus: "queued" | "building" | "ready" | "failed" | "cancelled";
  buildType: string;
  createdAt: string;
  buildStartedAt?: string;
  linkExpiresAt?: number;
  artifactMb: number;
  countAsCredit: boolean;
  iconColor: string;
  offline: string;
  splashColor: string;
  notes: string[];
  icon?: string;
  buildJobId?: string;
  kernelUrl?: string;
  kernelStatus?: string;
  sourceId?: string;
  engine?: "server" | "none";
  queuePosition?: number;
  buildLog?: string[];
  artifactReady?: boolean;
  artifactKind?: "apk" | "pwa";
  buildMs?: number;
  artifactList?: PlatformArtifact[];
  buildDeadline?: number;
  buildState?: "queued" | "pushing" | "building" | "apk-ready" | "timeout" | "apk-failed" | "cancelled";
  buildError?: string;
  shareUrl?: string;
};

export type Payment = {
  id: string;
  orderId: string;
  planId: string;
  planName: string;
  amount: number;
  method: string;
  utr: string;
  createdAt: string;
  status: "pending" | "active" | "rejected";
  approvedAt?: string;
  rejectionReason?: string;
};

export type Activity = {
  id: string;
  title: string;
  detail: string;
  at: string;
  kind: "build" | "auth" | "billing" | "api" | "support" | "app";
};

export type SupportRequest = {
  id: string;
  subject: string;
  email: string;
  message: string;
  attachments: { name: string; size: number }[];
  createdAt: string;
  delivery: "not_sent" | "delivered" | "failed";
  attempts: number;
  replies?: { from: "user" | "support"; text: string; at: string }[];
};

export type ApiKey = {
  id: string;
  label: string;
  prefix: string;
  hash: string;
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
};

export type Notification = {
  id: string;
  title: string;
  body: string;
  at: string;
  read: boolean;
  kind: "build" | "billing" | "system";
};

export type ApiLog = {
  id: string;
  method: "GET" | "POST";
  path: string;
  status: number;
  at: string;
  durationMs: number;
  credits: number;
  message: string;
};

export type MagicToken = {
  token: string;
  uid: string;
  email: string;
  expiresAt: number;
  used: boolean;
};

type Account = { email: string; name: string; uid: string; provider: User["provider"] };

type State = {
  user: User | null;
  accounts: Account[];
  apps: AppRecord[];
  payments: Payment[];
  activities: Activity[];
  support: SupportRequest[];
  apiKeys: ApiKey[];
  notifications: Notification[];
  magicTokens: MagicToken[];
  apiUsage: number;
  apiLogs: ApiLog[];
  seededDemo: boolean;
  authReady: boolean;
  authMode: "firebase" | "none";
  authNotice: string;
};

const emptyState: State = {
  user: null,
  accounts: [],
  apps: [],
  payments: [],
  activities: [],
  support: [],
  apiKeys: [],
  notifications: [],
  magicTokens: [],
  apiUsage: 0,
  apiLogs: [],
  seededDemo: false,
  authReady: false,
  authMode: "none",
  authNotice: "",
};

const STORAGE_KEY = "uapp.workspace.v2";
const THEME_KEY = "uapp.theme";

function loadState(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = { ...emptyState, ...(JSON.parse(raw) as State) } as State;
      parsed.apps = (parsed.apps ?? []).map((a) => {
        // A "ready" app must have real artifacts. Legacy fallback records that
        // claimed success without an APK are corrected to a truthful state.
        if (a.buildStatus === "ready" && a.artifactKind !== "apk") {
          return { ...a, buildStatus: "failed", artifactReady: false, buildState: "apk-failed", buildError: a.buildError || "No verified APK artifact exists for this project. Rebuild to produce one." };
        }
        return a;
      });
      return parsed;
    }
  } catch {
    /* ignore corrupt storage */
  }
  return emptyState;
}

export async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function makeOtp(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(100000000 + (arr[0] % 900000000));
}

export function makeToken(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function makeUid(): string {
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  return "U" + Array.from(arr).map((b) => b.toString(16)).join("").toUpperCase();
}

export function makeId(prefix: string): string {
  const arr = new Uint8Array(3);
  crypto.getRandomValues(arr);
  return prefix + "-" + Array.from(arr).map((b) => b.toString(16)).join("").toUpperCase();
}

export const days = (n: number) => n * 24 * 60 * 60 * 1000;

export function planById(id: string | undefined): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

export type Quota = {
  allowance: number;
  used: number;
  remaining: number;
  plan: Plan;
  periodLabel: string;
  resetLabel: string;
  state: "free" | "active" | "expired" | "none";
};

export function getQuota(state: State): Quota {
  const user = state.user;
  if (!user) {
    return {
      allowance: 0,
      used: 0,
      remaining: 0,
      plan: PLANS[0],
      periodLabel: "No session",
      resetLabel: "Sign in to view quota",
      state: "none",
    };
  }
  const plan = planById(user.planId);
  const now = Date.now();
  const paidActive =
    plan.id !== "free" && user.planExpiresAt && new Date(user.planExpiresAt).getTime() > now;
  const paidExpired =
    plan.id !== "free" && user.planExpiresAt && new Date(user.planExpiresAt).getTime() <= now;

  if (paidActive) {
    const start = new Date(user.planActivatedAt ?? user.createdAt).getTime();
    const end = new Date(user.planExpiresAt!).getTime();
    const used = state.apps.filter(
      (a) => a.countAsCredit && new Date(a.createdAt).getTime() >= start && new Date(a.createdAt).getTime() <= end
    ).length;
    return {
      allowance: plan.credits,
      used,
      remaining: Math.max(0, plan.credits - used),
      plan,
      periodLabel: "Current subscription period",
      resetLabel: new Date(end).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      state: "active",
    };
  }

  const used = state.apps.filter((a) => {
    if (!a.countAsCredit) return false;
    const d = new Date(a.createdAt);
    const n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }).length;
  const reset = new Date();
  reset.setMonth(reset.getMonth() + 1, 1);
  return {
    allowance: FREE_MONTHLY_CREDITS,
    used,
    remaining: Math.max(0, FREE_MONTHLY_CREDITS - used),
    plan: PLANS[0],
    periodLabel: "Free monthly allowance",
    resetLabel: reset.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }),
    state: paidExpired ? "expired" : "free",
  };
}

type AuthResult = {
  ok: boolean;
  message?: string;
  needsVerification?: boolean;
  kind?: "domain" | "config" | "credential" | "network" | "other";
  email?: string;
};

type StoreValue = {
  state: State;
  theme: "dark" | "light";
  toggleTheme: () => void;
  register: (data: { name: string; email: string; password: string }) => Promise<AuthResult>;
  login: (data: { email: string; password: string }) => Promise<AuthResult>;
  googleLogin: () => Promise<AuthResult>;
  logout: () => Promise<void>;
  resendVerification: () => Promise<AuthResult>;
  refreshVerification: () => Promise<AuthResult>;
  resetPassword: (email: string) => Promise<AuthResult>;
  updateUser: (patch: Partial<User>) => void;
  quota: Quota;
  createApp: (data: Omit<AppRecord, "id" | "createdAt" | "buildStatus" | "countAsCredit" | "linkExpiresAt">) => {
    ok: boolean;
    message?: string;
    appId?: string;
  };
  rebuildApp: (id: string) => Promise<void>;
  startBuild: (id: string, force?: boolean) => Promise<void>;
  cancelBuild: (id: string) => Promise<{ ok: boolean; message: string }>;
  checkApkBuild: (id: string) => Promise<{ ok: boolean; message: string }>;
  updateApp: (id: string, patch: Partial<AppRecord>) => void;
  deleteApp: (id: string) => void;
  submitPayment: (data: { planId: string; method: string; utr: string }) => Promise<{ ok: boolean; orderId: string; message?: string }>;
  createApiKey: (label: string) => Promise<{ ok: boolean; secret?: string; message?: string }>;
  revokeApiKey: (id: string) => void;
  pushActivity: (a: Omit<Activity, "id" | "at">) => void;
  addSupport: (data: { subject: string; email: string; message: string; attachments: { name: string; size: number }[] }) => string;
  retrySupport: (id: string) => void;
  markNotificationsRead: () => void;
  resetWorkspace: () => void;
};

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(() => loadState());
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const bootedBuilds = useRef<Set<string>>(new Set());
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try {
      return (localStorage.getItem(THEME_KEY) as "dark" | "light") || "dark";
    } catch {
      return "dark";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage may be unavailable */
    }
  }, [state]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    const uid = state.user?.uid;
    if (!uid) return;
    let live = true;
    void fetchPaymentRequests().then((list) => {
      if (!live || !list) return;
      setState((s) => ({
        ...s,
        payments: list.map((p) => ({
          id: p.id, orderId: p.orderId, planId: p.planId, planName: planById(p.planId).name,
          amount: planById(p.planId).price, method: p.method,
          utr: p.utr.length > 6 ? `${p.utr.slice(0, 4)}••••${p.utr.slice(-4)}` : p.utr,
          createdAt: p.createdAt, status: p.status, approvedAt: p.approvedAt, rejectionReason: p.rejectionReason,
        })),
      }));
    });
    void (async () => {
      const token = await import("@/lib/firebase").then((m) => m.authToken());
      const res = await fetch("/api/account", { headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } }).catch(() => null);
      if (!live || !res?.ok) return;
      const data = (await res.json()) as { plan?: { planId?: string; planActivatedAt?: string; planExpiresAt?: string } };
      if (data.plan?.planId) {
        setState((s) => s.user ? { ...s, user: { ...s.user, planId: data.plan!.planId!, planActivatedAt: data.plan!.planActivatedAt, planExpiresAt: data.plan!.planExpiresAt } } : s);
      }
    })();
    return () => { live = false; };
  }, [state.user?.uid]);

  const pushActivity = useCallback((a: Omit<Activity, "id" | "at">) => {
    setState((s) => ({
      ...s,
      activities: [{ ...a, id: makeId("ACT"), at: new Date().toISOString() }, ...s.activities].slice(0, 200),
    }));
  }, []);

  useEffect(() => {
    let active = true;
    const unsubscribe = watchAuth(async (identity) => {
      if (!active) return;
      if (!identity) {
        setState((s) => ({ ...s, user: null, authReady: true, authMode: "none" }));
        return;
      }
      const remote = await readProfile(identity.uid);
      if (!active) return;
      setState((s) => {
        const cached = s.user?.uid === identity.uid ? s.user : null;
        const user: User = {
          uid: identity.uid,
          name: remote?.name || identity.name || cached?.name || "Builder",
          email: identity.email || cached?.email || "",
          provider: identity.provider,
          emailVerified: identity.emailVerified,
          createdAt: remote?.createdAt || cached?.createdAt || identity.createdAt,
          planId: remote?.planId || cached?.planId || "free",
          planActivatedAt: remote?.planActivatedAt || cached?.planActivatedAt,
          planExpiresAt: remote?.planExpiresAt || cached?.planExpiresAt,
          notifyBuilds: remote?.notifyBuilds ?? cached?.notifyBuilds ?? true,
          notifyPayments: remote?.notifyPayments ?? cached?.notifyPayments ?? true,
          notifyProduct: remote?.notifyProduct ?? cached?.notifyProduct ?? false,
          bio: remote?.bio ?? cached?.bio,
          company: remote?.company ?? cached?.company,
          photo: identity.photo ?? cached?.photo,
        };
        const sameUser = s.user?.uid === identity.uid;
        return {
          ...s,
          user,
          apps: sameUser ? s.apps : [],
          payments: sameUser ? s.payments : [],
          support: sameUser ? s.support : [],
          apiKeys: sameUser ? s.apiKeys : [],
          apiLogs: sameUser ? s.apiLogs : [],
          apiUsage: sameUser ? s.apiUsage : 0,
          authReady: true,
          authMode: "firebase",
          authNotice: "",
          activities: sameUser ? s.activities : [{ id: makeId("ACT"), title: "Signed in", detail: "Secure sign-in session established", at: new Date().toISOString(), kind: "auth" }],
          notifications: sameUser ? s.notifications : [],
        };
      });
      if (!remote?.createdAt) {
        void writeProfile(identity.uid, {
          uid: identity.uid,
          name: identity.name,
          email: identity.email,
          provider: identity.provider,
          emailVerified: identity.emailVerified,
          createdAt: identity.createdAt,
        });
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const finishFirebaseAuth = useCallback((identity: { uid: string; name: string; email: string; provider: "google" | "password"; emailVerified: boolean; createdAt: string; photo?: string }) => {
    setState((s) => {
      const cached = s.user?.uid === identity.uid ? s.user : null;
      const user: User = {
        uid: identity.uid,
        name: identity.name || cached?.name || "Builder",
        email: identity.email,
        provider: identity.provider,
        emailVerified: identity.emailVerified,
        createdAt: cached?.createdAt ?? identity.createdAt,
        planId: cached?.planId ?? "free",
        planActivatedAt: cached?.planActivatedAt,
        planExpiresAt: cached?.planExpiresAt,
        notifyBuilds: cached?.notifyBuilds ?? true,
        notifyPayments: cached?.notifyPayments ?? true,
        notifyProduct: cached?.notifyProduct ?? false,
        photo: identity.photo ?? cached?.photo,
      };
      return {
        ...s,
        user,
        authReady: true,
        authMode: "firebase",
        authNotice: "",
        activities: [
          { id: makeId("ACT"), title: identity.provider === "google" ? "Google login" : "Login", detail: "Sign-in session verified", at: new Date().toISOString(), kind: "auth" },
          ...s.activities,
        ],
      };
    });
    void writeProfile(identity.uid, {
      uid: identity.uid,
      name: identity.name,
      email: identity.email,
      provider: identity.provider,
      emailVerified: identity.emailVerified,
      createdAt: identity.createdAt,
    });
    void writeActivity(identity.uid, makeId("ACT"), { type: "login", provider: identity.provider, at: new Date().toISOString() });
  }, []);

  const register = useCallback(async (data: { name: string; email: string; password: string }): Promise<AuthResult> => {
    if (data.name.trim().length < 2) return { ok: false, message: "Enter your full name.", kind: "credential" };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) return { ok: false, message: "Enter a valid email address.", kind: "credential" };
    if (data.password.length < 8) return { ok: false, message: "The identity provider requires at least 8 characters for a password.", kind: "credential" };
    try {
      const identity = await emailRegister(data.name.trim(), data.email.trim(), data.password);
      finishFirebaseAuth(identity);
      return { ok: true, needsVerification: !identity.emailVerified, email: identity.email };
    } catch (error) {
      const mapped = firebaseErrorMessage(error);
      return { ok: false, message: mapped.message, kind: mapped.kind };
    }
  }, [finishFirebaseAuth]);

  const login = useCallback(async (data: { email: string; password: string }): Promise<AuthResult> => {
    if (!data.email.trim() || !data.password) return { ok: false, message: "Enter your email and password.", kind: "credential" };
    try {
      const identity = await emailLogin(data.email.trim(), data.password);
      finishFirebaseAuth(identity);
      return { ok: true, needsVerification: !identity.emailVerified, email: identity.email };
    } catch (error) {
      const mapped = firebaseErrorMessage(error);
      return { ok: false, message: mapped.message, kind: mapped.kind };
    }
  }, [finishFirebaseAuth]);

  const googleLogin = useCallback(async (): Promise<AuthResult> => {
    try {
      const identity = await googleSignIn();
      finishFirebaseAuth(identity);
      return { ok: true, needsVerification: false, email: identity.email };
    } catch (error) {
      const mapped = firebaseErrorMessage(error);
      return { ok: false, message: mapped.message, kind: mapped.kind };
    }
  }, [finishFirebaseAuth]);

  const logout = useCallback(async () => {
    try {
      await fbLogout();
    } catch {
      /* session already ended */
    }
    setState((s) => ({
      ...s,
      user: null,
      authMode: "none",
      authNotice: "",
      activities: s.user
        ? [{ id: makeId("ACT"), title: "Logout", detail: "Session ended", at: new Date().toISOString(), kind: "auth" }, ...s.activities]
        : s.activities,
    }));
  }, []);

  const resendVerification = useCallback(async (): Promise<AuthResult> => {
    try {
      await resendVerificationEmail();
      return { ok: true, message: "A fresh verification email was sent by the identity provider." };
    } catch (error) {
      return { ok: false, message: firebaseErrorMessage(error).message };
    }
  }, []);

  const refreshVerification = useCallback(async (): Promise<AuthResult> => {
    try {
      const verified = await hasVerifiedEmail();
      if (!verified) return { ok: false, message: "Email is still unverified. Open the link in the verification email, then check again." };
      setState((s) => ({
        ...s,
        user: s.user ? { ...s.user, emailVerified: true } : s.user,
        activities: [{ id: makeId("ACT"), title: "Email verified", detail: "Email verification confirmed", at: new Date().toISOString(), kind: "auth" }, ...s.activities],
      }));
      if (state.user) void writeProfile(state.user.uid, { emailVerified: true });
      return { ok: true, message: "Email verified. Your workspace is unlocked." };
    } catch (error) {
      return { ok: false, message: firebaseErrorMessage(error).message };
    }
  }, [state.user]);

  const resetPassword = useCallback(async (email: string): Promise<AuthResult> => {
    try {
      await passwordReset(email.trim());
      return { ok: true, message: "Password reset email sent by the identity provider. Check your inbox and spam folder." };
    } catch (error) {
      const mapped = firebaseErrorMessage(error);
      return { ok: false, message: mapped.message };
    }
  }, []);

  const updateUser = useCallback((patch: Partial<User>) => {
    setState((s) => ({ ...s, user: s.user ? { ...s.user, ...patch } : s.user }));
    if (state.user) void writeProfile(state.user.uid, patch as Record<string, unknown>);
  }, [state.user]);

  const createApp = useCallback<StoreValue["createApp"]>((data) => {
    if (!state.user) return { ok: false, message: "Sign in to create an app." };
    const q = getQuota(state);
    if (q.remaining <= 0) {
      return {
        ok: false,
        message:
          q.state === "active"
            ? "Your current plan has no app creation credits remaining. Activate a plan to continue creating apps."
            : "Your monthly free app limit has been reached. Upgrade your plan to continue creating apps.",
      };
    }
    const id = makeId("APP");
    const now = new Date().toISOString();
    const app: AppRecord = {
      ...data,
      id,
      createdAt: now,
      buildStatus: "queued",
      countAsCredit: true,
      linkExpiresAt: Date.now() + DOWNLOAD_TTL_SECONDS * 1000,
      iconColor: data.iconColor || "#c9f65b",
      notes: [...data.notes, "Credit reserved for this app creation", "Build queued in the isolated pipeline"],
    };
    setState((s) => ({
      ...s,
      apps: [app, ...s.apps],
      activities: [
        { id: makeId("ACT"), title: "Build queued", detail: `${id} · ${app.name} · credit reserved`, at: now, kind: "build" },
        { id: makeId("ACT"), title: "App created", detail: `${app.name} created from ${app.type}`, at: now, kind: "app" },
        ...s.activities,
      ],
      notifications: [
        { id: makeId("NTF"), title: "Build queued", body: `${app.name} is waiting for the build runner. Source package is available for 9 minutes.`, at: now, read: false, kind: "build" },
        ...s.notifications,
      ],
    }));
    if (state.user) {
      void writeProjectMeta(state.user.uid, id, {
        id,
        name: app.name,
        packageId: app.packageId,
        type: app.type,
        template: app.template,
        templateId: app.templateId,
        buildType: app.buildType,
        buildStatus: app.buildStatus,
        createdAt: app.createdAt,
        source: app.sourceLabel,
        permissions: app.permissions,
        ads: app.adsEnabled ? { network: app.adNetwork, formats: app.adFormats, timing: app.adTiming } : null,
        quotaCharged: true,
      });
      void writeActivity(state.user.uid, id, { type: "app_created", project: id, name: app.name, at: now });
    }
    return { ok: true, appId: id };
  }, [state]);

  const applyJob = useCallback((id: string, job: import("@/lib/buildService").BuildJob, startedAt: number) => {
    const artifacts = artifactsFromJob(job);
    const terminal = ["ready", "failed", "timeout", "expired", "cancelled"].includes(job.status);
    const ready = job.status === "ready" && artifacts.length > 0;
    setState((s) => ({
      ...s,
      apps: s.apps.map((a) => a.id === id ? {
        ...a,
        buildJobId: job.id,
        buildStatus: ready ? "ready" : job.status === "cancelled" ? "cancelled" : terminal ? "failed" : job.status === "queued" ? "queued" : "building",
        buildState: ready ? "apk-ready" : job.status === "cancelled" ? "cancelled" : terminal ? (job.status === "timeout" ? "timeout" : "apk-failed") : "building",
        engine: "server",
        artifactKind: ready ? "apk" : a.artifactKind,
        artifactReady: ready,
        artifactList: artifacts.length ? artifacts : terminal ? [] : a.artifactList,
        artifactMb: ready ? Math.round(((artifacts.find((x) => /\.apk$/i.test(x.name)) ?? artifacts[0]).size_in_bytes / 1024 / 1024) * 10) / 10 : a.artifactMb,
        queuePosition: job.queuePosition,
        linkExpiresAt: job.expiresAt ?? a.linkExpiresAt,
        buildMs: terminal ? Date.now() - startedAt : a.buildMs,
        buildError: job.error ?? (terminal && !ready ? `Build ${job.status}.` : undefined),
        buildLog: job.logs?.length ? job.logs.slice(-160) : a.buildLog,
      } : a),
    }));
    return { ready, terminal };
  }, []);

  const startBuild = useCallback(async (id: string, force = false) => {
    const app = stateRef.current.apps.find((a) => a.id === id);
    if (!app) return;
    if (!force && bootedBuilds.current.has(id)) return;
    bootedBuilds.current.add(id);
    const startedAt = Date.now();
    setState((s) => ({
      ...s,
      apps: s.apps.map((a) => a.id === id ? {
        ...a, buildStatus: "building", buildStartedAt: new Date(startedAt).toISOString(),
        buildDeadline: startedAt + BUILD_TIMEOUT_MS, buildError: undefined, artifactReady: false,
        artifactList: [], buildState: "queued", engine: "server",
        buildLog: ["Validating project…", "Submitting to the secure build pipeline…"],
      } : a),
    }));
    try {
      const queued = await queueBuild(app);
      if (stateRef.current.user) {
        void writeProjectMeta(stateRef.current.user.uid, id, {
          id, name: app.name, packageId: app.packageId, type: app.type, template: app.template,
          buildType: app.buildType, buildStatus: "building", createdAt: app.createdAt, source: app.sourceLabel,
          permissions: app.permissions, buildJobId: queued.job.id,
          ads: app.adsEnabled ? { network: "admob", formats: app.adFormats, timing: app.adTiming, testMode: app.adTestMode !== false } : null,
          quotaCharged: true, updatedAt: new Date().toISOString(),
        });
      }
      setState((s) => ({
        ...s,
        apps: s.apps.map((a) => a.id === id ? {
          ...a, buildJobId: queued.job.id, queuePosition: queued.queuePosition,
          buildLog: [...(queued.job.logs ?? []), `Queue position ${queued.queuePosition}`],
        } : a),
      }));
      await pollBuild(id, queued.job.id, startedAt);
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === "BUILD_IN_PROGRESS") {
        setState((s) => ({ ...s, apps: s.apps.map((a) => a.id === id ? { ...a, buildStatus: "building", buildLog: [...(a.buildLog ?? []), err.message] } : a) }));
        return;
      }
      bootedBuilds.current.delete(id);
      setState((s) => ({
        ...s,
        apps: s.apps.map((a) => a.id === id ? {
          ...a, buildStatus: "failed", buildState: "apk-failed", artifactReady: false,
          buildError: err.message, buildLog: [...(a.buildLog ?? []), `Build failed: ${err.message}`],
        } : a),
      }));
    }
  }, []);

  const pollBuild = useCallback(async (id: string, jobId: string, startedAt: number): Promise<boolean> => {
    let consecutiveErrors = 0;
    while (Date.now() - startedAt < BUILD_TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, 8000));
      const current = stateRef.current.apps.find((a) => a.id === id);
      if (!current || current.buildStatus === "cancelled") return false;
      try {
        const job = await buildStatus(jobId);
        consecutiveErrors = 0;
        const { ready, terminal } = applyJob(id, job, startedAt);
        if (ready) {
          if (stateRef.current.user) void writeProjectMeta(stateRef.current.user.uid, id, { buildStatus: "ready", updatedAt: new Date().toISOString() });
          return true;
        }
        if (terminal) {
          bootedBuilds.current.delete(id);
          if (stateRef.current.user) void writeProjectMeta(stateRef.current.user.uid, id, { buildStatus: job.status === "cancelled" ? "cancelled" : "failed", updatedAt: new Date().toISOString() });
          return false;
        }
      } catch (e) {
        consecutiveErrors += 1;
        setState((s) => ({ ...s, apps: s.apps.map((a) => a.id === id ? { ...a, buildLog: [...(a.buildLog ?? []), `Status check ${consecutiveErrors}: ${(e as Error).message}`].slice(-160) } : a) }));
        if (consecutiveErrors >= 10) {
          bootedBuilds.current.delete(id);
          setState((s) => ({ ...s, apps: s.apps.map((a) => a.id === id ? { ...a, buildStatus: "failed", buildState: "apk-failed", buildError: `Lost contact with the build server: ${(e as Error).message}. Use Check build status to reconnect.` } : a) }));
          return false;
        }
      }
    }
    bootedBuilds.current.delete(id);
    setState((s) => ({ ...s, apps: s.apps.map((a) => a.id === id ? { ...a, buildStatus: "failed", buildState: "timeout", buildError: `Build exceeded the ${Math.round(BUILD_TIMEOUT_MS / 60000)}-minute window. Check build status or rebuild.` } : a) }));
    return false;
  }, [applyJob]);

  const checkApkBuild = useCallback(async (id: string): Promise<{ ok: boolean; message: string }> => {
    const app = stateRef.current.apps.find((a) => a.id === id);
    if (!app?.buildJobId) return { ok: false, message: "No build job is linked. Use Rebuild to start a real APK build." };
    try {
      const job = await buildStatus(app.buildJobId);
      const { ready } = applyJob(id, job, app.buildStartedAt ? new Date(app.buildStartedAt).getTime() : Date.now());
      return {
        ok: ready,
        message: ready ? `${job.artifacts.length} verified APK/AAB artifact(s) ready.` : (job.error ?? `Build status: ${job.status}`),
      };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  }, [applyJob]);

  const cancelBuild = useCallback(async (id: string): Promise<{ ok: boolean; message: string }> => {
    const app = stateRef.current.apps.find((a) => a.id === id);
    if (!app?.buildJobId) return { ok: false, message: "No build job to cancel." };
    const res = await cancelServerBuild(app.buildJobId);
    if (res.ok) {
      setState((s) => ({ ...s, apps: s.apps.map((a) => (a.id === id ? { ...a, buildStatus: "cancelled", buildState: "cancelled", artifactReady: false, buildError: "Build cancelled.", buildLog: [...(a.buildLog ?? []), "Build cancelled"] } : a)) }));
      return { ok: true, message: "Build cancelled." };
    }
    return { ok: false, message: res.error ?? "Could not cancel the build." };
  }, []);

  const rebuildApp = useCallback(async (id: string) => {
    bootedBuilds.current.delete(id);
    setState((s) => ({
      ...s,
      apps: s.apps.map((a) => (a.id === id ? { ...a, notes: [...a.notes, "Rebuild requested · no new credit consumed"] } : a)),
      activities: [{ id: makeId("ACT"), title: "Rebuild requested", detail: `${id} · 0 credits consumed`, at: new Date().toISOString(), kind: "build" }, ...s.activities],
    }));
    await startBuild(id, true);
  }, [startBuild]);

  // Resume polling for in-flight builds after a reload (never auto-requeue).
  useEffect(() => {
    if (!state.authReady) return;
    state.apps
      .filter((a) => (a.buildStatus === "building" || a.buildStatus === "queued") && a.buildJobId && !bootedBuilds.current.has(a.id))
      .slice(0, 3)
      .forEach((a) => {
        bootedBuilds.current.add(a.id);
        void pollBuild(a.id, a.buildJobId!, a.buildStartedAt ? new Date(a.buildStartedAt).getTime() : Date.now());
      });
    state.apps
      .filter((a) => a.buildStatus === "queued" && !a.buildJobId && !bootedBuilds.current.has(a.id))
      .slice(0, 3)
      .forEach((a) => { void startBuild(a.id); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.apps, state.authReady]);

  const updateApp = useCallback((id: string, patch: Partial<AppRecord>) => {
    setState((s) => ({ ...s, apps: s.apps.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
  }, []);

  const deleteApp = useCallback((id: string) => {
    setState((s) => ({ ...s, apps: s.apps.filter((a) => a.id !== id) }));
  }, []);

  const submitPayment = useCallback<StoreValue["submitPayment"]>(async (data) => {
    const plan = planById(data.planId);
    const clean = data.utr.replace(/\s+/g, "");
    const res = await submitPaymentRequest({ planId: plan.id, method: data.method, utr: clean });
    if (!res.ok || !res.payment) return { ok: false, orderId: "", message: res.message || "Could not submit the payment request." };
    const p = res.payment;
    const payment: Payment = {
      id: p.id,
      orderId: p.orderId,
      planId: p.planId,
      planName: planById(p.planId).name,
      amount: planById(p.planId).price,
      method: p.method,
      utr: p.utr.length > 6 ? `${p.utr.slice(0, 4)}••••${p.utr.slice(-4)}` : p.utr,
      createdAt: p.createdAt,
      status: p.status,
    };
    setState((s) => ({
      ...s,
      payments: [payment, ...s.payments.filter((x) => x.id !== payment.id)],
      activities: [
        { id: makeId("ACT"), title: "Payment submitted", detail: `${payment.orderId} · ${plan.name} · pending approval`, at: new Date().toISOString(), kind: "billing" },
        ...s.activities,
      ],
      notifications: [
        { id: makeId("NTF"), title: "Payment request pending", body: `${payment.orderId} for ${plan.name} awaits administrator verification.`, at: new Date().toISOString(), read: false, kind: "billing" },
        ...s.notifications,
      ],
    }));
    return { ok: true, orderId: payment.orderId };
  }, []);

  const createApiKey = useCallback<StoreValue["createApiKey"]>(async (label) => {
    if (!state.user) return { ok: false, message: "Sign in to create API keys." };
    const active = state.apiKeys.filter((k) => !k.revokedAt);
    if (active.length >= 5) return { ok: false, message: "You have reached the 5 active key limit. Revoke a key first." };
    const q = getQuota(state);
    if (q.state !== "active" || !q.plan.api) return { ok: false, message: "API access requires an active paid plan with API permission." };
    const secret = `ua_live_${makeToken().slice(0, 32)}`;
    const hash = await sha256(secret);
    setState((s) => ({
      ...s,
      apiKeys: [
        { id: makeId("KEY"), label, prefix: secret.slice(0, 14), hash, createdAt: new Date().toISOString() },
        ...s.apiKeys,
      ],
      activities: [{ id: makeId("ACT"), title: "API key created", detail: `${label} · only the hash is stored`, at: new Date().toISOString(), kind: "api" }, ...s.activities],
    }));
    return { ok: true, secret };
  }, [state]);

  const revokeApiKey = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      apiKeys: s.apiKeys.map((k) => (k.id === id ? { ...k, revokedAt: new Date().toISOString() } : k)),
      activities: [{ id: makeId("ACT"), title: "API key revoked", detail: id, at: new Date().toISOString(), kind: "api" }, ...s.activities],
    }));
  }, []);

  const addSupport = useCallback<StoreValue["addSupport"]>((data) => {
    const id = makeId("SUP");
    const req: SupportRequest = {
      ...data,
      id,
      createdAt: new Date().toISOString(),
      delivery: "not_sent",
      attempts: 1,
      replies: [{ from: "user", text: data.message, at: new Date().toISOString() }],
    };
    setState((s) => ({
      ...s,
      support: [req, ...s.support],
      activities: [{ id: makeId("ACT"), title: "Support request submitted", detail: `${id} · delivery pending email API configuration`, at: new Date().toISOString(), kind: "support" }, ...s.activities],
    }));
    return id;
  }, []);

  const retrySupport = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      support: s.support.map((r) => (r.id === id ? { ...r, attempts: r.attempts + 1, delivery: "not_sent" } : r)),
    }));
  }, []);

  const markNotificationsRead = useCallback(() => {
    setState((s) => ({ ...s, notifications: s.notifications.map((n) => ({ ...n, read: true })) }));
  }, []);

  const resetWorkspace = useCallback(() => {
    setState((s) => ({ ...s, apps: [], payments: [], support: [], apiKeys: [], apiLogs: [], apiUsage: 0, activities: [], notifications: [] }));
  }, []);

  const toggleTheme = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);

  const value = useMemo<StoreValue>(
    () => ({
      state,
      theme,
      toggleTheme,
      register,
      login,
      googleLogin,
      logout,
      resendVerification,
      refreshVerification,
      resetPassword,
      updateUser,
      quota: getQuota(state),
      createApp,
      rebuildApp,
      startBuild,
      cancelBuild,
      checkApkBuild,
      updateApp,
      deleteApp,
      submitPayment,
      createApiKey,
      revokeApiKey,
      pushActivity,
      addSupport,
      retrySupport,
      markNotificationsRead,
      resetWorkspace,
    }),
    [state, theme, toggleTheme, register, login, googleLogin, logout, resendVerification, refreshVerification, resetPassword, updateUser, createApp, rebuildApp, startBuild, cancelBuild, checkApkBuild, updateApp, deleteApp, submitPayment, createApiKey, revokeApiKey, pushActivity, addSupport, retrySupport, markNotificationsRead, resetWorkspace]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const d = Math.floor(hours / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function inr(n: number): string {
  return "₹" + n.toLocaleString("en-IN");
}

export function planState(user: User | null): "free" | "active" | "expired" | "none" {
  if (!user) return "none";
  if (user.planId === "free") return "free";
  if (!user.planExpiresAt) return "active";
  return new Date(user.planExpiresAt).getTime() > Date.now() ? "active" : "expired";
}

export function canUseAds(state: State): boolean {
  const q = getQuota(state);
  return q.plan.ads && q.state === "active";
}

export { isFirebaseReady };
export type { Plan };

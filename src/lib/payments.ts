/**
 * UPI payment configuration.
 *
 * The merchant payee is configured ONLY on the server (admin API / deployment
 * env). Browsers can read the public payee but can never set or override it —
 * that would let anyone redirect plan payments to their own UPI ID.
 */
const env = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {});

export type UpiConfig = { upiId: string; payeeName: string };

let serverConfig: UpiConfig | null = null;

export function getUpiConfig(): UpiConfig | null {
  if (serverConfig) return serverConfig;
  const envId = env.VITE_UAPP_UPI_ID;
  const envName = env.VITE_UAPP_UPI_NAME;
  if (envId && envName && /^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(envId)) return { upiId: envId, payeeName: envName };
  return null;
}

/** Official UPI deep-link intent. Any UPI app can resolve this. */
export function upiIntent(amount: number, note: string): string {
  const cfg = getUpiConfig();
  if (!cfg) return "";
  const params = new URLSearchParams({ pa: cfg.upiId, pn: cfg.payeeName, am: amount.toFixed(2), cu: "INR", tn: note.slice(0, 50) });
  return `upi://pay?${params.toString()}`;
}

export function appIntent(app: "gpay" | "phonepe" | "paytm", amount: number, note: string): string {
  const cfg = getUpiConfig();
  if (!cfg) return "";
  const params = new URLSearchParams({ pa: cfg.upiId, pn: cfg.payeeName, am: amount.toFixed(2), cu: "INR", tn: note.slice(0, 50) });
  const packages: Record<typeof app, string> = {
    gpay: "com.google.android.apps.nbu.paisa.user",
    phonepe: "com.phonepe.app",
    paytm: "net.one97.paytm",
  };
  return `intent://pay?${params.toString()}#Intent;scheme=upi;package=${packages[app]};end`;
}

/** Fetch the merchant payee from the server. Never trusts browser storage. */
export async function hydrateUpiFromServer(): Promise<UpiConfig | null> {
  try {
    const res = await fetch("/api/settings/public", { headers: { Accept: "application/json" } });
    if (res.ok) {
      const data = (await res.json()) as { upi?: UpiConfig | null };
      if (data.upi?.upiId && data.upi?.payeeName && /^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(data.upi.upiId)) {
        serverConfig = data.upi;
        return serverConfig;
      }
      serverConfig = null;
    }
  } catch {
    /* offline — keep last known server value */
  }
  return getUpiConfig();
}


export type ServerPayment = {
  id: string;
  orderId: string;
  planId: string;
  method: string;
  utr: string;
  status: "pending" | "active" | "rejected";
  createdAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
};

async function authHeaders(): Promise<Record<string, string>> {
  const { authToken } = await import("@/lib/firebase");
  const token = await authToken();
  return { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export async function submitPaymentRequest(data: { planId: string; method: string; utr: string }): Promise<{ ok: boolean; payment?: ServerPayment; message?: string }> {
  try {
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { ...(await authHeaders()), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; payment?: ServerPayment; error?: string };
    if (!res.ok || !body.ok) return { ok: false, message: body.error || `Payment request failed (HTTP ${res.status})` };
    return { ok: true, payment: body.payment };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function fetchPaymentRequests(): Promise<ServerPayment[] | null> {
  try {
    const res = await fetch("/api/payments", { headers: await authHeaders() });
    if (!res.ok) return null;
    const body = (await res.json()) as { ok?: boolean; payments?: ServerPayment[] };
    return body.ok && Array.isArray(body.payments) ? body.payments : null;
  } catch {
    return null;
  }
}

/** Owner-only: requires the server ADMIN_TOKEN. Never stored in the browser. */
export async function saveUpiToServer(cfg: UpiConfig, adminToken: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch("/api/settings/payment", {
      method: "PUT",
      headers: { Accept: "application/json", "Content-Type": "application/json", "x-admin-token": adminToken },
      body: JSON.stringify(cfg),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; upi?: UpiConfig };
    if (!res.ok || !body.ok) return { ok: false, message: body.error || `Save failed (HTTP ${res.status})` };
    if (body.upi) serverConfig = body.upi;
    return { ok: true, message: "Merchant UPI saved on the server." };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

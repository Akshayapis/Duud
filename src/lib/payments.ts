type Env = Record<string, string | undefined>;
const env = ((import.meta as unknown as { env?: Env }).env ?? {}) as Env;

const KEY = "uapp.upi.merchant.v1";

export type UpiConfig = { upiId: string; payeeName: string };

export function getUpiConfig(): UpiConfig | null {
  const envId = env.VITE_UAPP_UPI_ID;
  const envName = env.VITE_UAPP_UPI_NAME;
  if (envId && envName) return { upiId: envId, payeeName: envName };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const cfg = JSON.parse(raw) as UpiConfig;
    if (!/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(cfg.upiId ?? "")) return null;
    return cfg;
  } catch {
    return null;
  }
}

export function saveUpiConfig(cfg: UpiConfig): { ok: boolean; message: string } {
  const upiId = cfg.upiId.trim();
  const payeeName = cfg.payeeName.trim();
  if (!/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upiId)) return { ok: false, message: "Enter a valid UPI ID, for example business@okhdfcbank." };
  if (payeeName.length < 2) return { ok: false, message: "Enter the payee / business name exactly as registered." };
  localStorage.setItem(KEY, JSON.stringify({ upiId, payeeName }));
  return { ok: true, message: "Merchant UPI configured on this device. QR payments are now enabled." };
}

export function clearUpiConfig(): void {
  localStorage.removeItem(KEY);
}

/** Official UPI deep-link intent. Any UPI app can resolve this. */
export function upiIntent(amount: number, note: string): string {
  const cfg = getUpiConfig();
  if (!cfg) return "";
  const params = new URLSearchParams({
    pa: cfg.upiId,
    pn: cfg.payeeName,
    am: amount.toFixed(2),
    cu: "INR",
    tn: note.slice(0, 50),
  });
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


/**
 * Pulls the merchant UPI configured on the server (Render env or the future
 * admin panel API) so the QR works without any local setup. Cached locally so
 * the payment page can render instantly and still work offline.
 */
export async function hydrateUpiFromServer(): Promise<UpiConfig | null> {
  try {
    const res = await fetch("/api/settings/public", { headers: { Accept: "application/json" } });
    if (!res.ok) return getUpiConfig();
    const data = (await res.json()) as { upi?: UpiConfig | null };
    if (data.upi?.upiId && data.upi?.payeeName) {
      localStorage.setItem(KEY, JSON.stringify(data.upi));
      return data.upi;
    }
  } catch {
    /* offline or static-only hosting */
  }
  return getUpiConfig();
}

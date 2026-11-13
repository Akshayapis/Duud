import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  Clock,
  CreditCard,
  HelpCircle,
  Info,
  Landmark,
  Lock,
  Mail,
  Receipt,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TriangleAlert,
  Upload,
  Zap,
} from "lucide-react";
import { Badge, Button, buttonClass, Card, CopyButton, Empty, Field, Input, useToast } from "@/components/ui";
import { PageHeader } from "@/components/Shell";
import { PlanCard } from "@/components/PlanCard";
import { PublicFooter, PublicNav } from "@/components/PublicChrome";
import { PLANS, SUPPORT_EMAIL } from "@/data/catalog";
import { getUpiConfig, appIntent, upiIntent, hydrateUpiFromServer } from "@/lib/payments";
import { QRCodeSVG } from "qrcode.react";
import { formatDate, inr, planById, relativeTime, useStore } from "@/lib/store";
import { cn } from "@/utils/cn";

const METHOD_OPTIONS = ["Google Pay", "PhonePe", "Paytm", "Other UPI app"];

export function PlansContent({ embedded }: { embedded?: boolean }) {
  const { state, quota } = useStore();
  const { toast } = useToast();
  const navigate = useNavigate();
  const user = state.user;

  const choose = (id: string) => {
    if (!user) {
      navigate(id === "free" ? "/register" : `/register?plan=${id}`);
      return;
    }
    if (id === "free") {
      toast(user.planId === "free" ? "You are already on the Free plan." : "To move to Free, contact support. Your paid plan stays active until it expires.", "info");
      return;
    }
    if (user.planId === id && quota.state === "active") {
      toast("This plan is already active on your account.", "info");
      return;
    }
    navigate(`/pay?plan=${id}`);
  };

  return (
    <div>
      <PageHeader
        title="Plans & credits"
        subtitle="The plan catalogue is loaded from a configuration service. Paid plans activate only after manual UPI approval."
        eyebrow="Subscription"
        actions={user ? <Link to="/app/apps" className={buttonClass("secondary", "md")}>My apps</Link> : <Link to="/register" className={buttonClass("lime", "md")}>Create account</Link>}
      />

      {user && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Card className="p-4">
            <div className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted">Current plan</div>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="font-display text-[19px] font-bold text-ink">{quota.plan.name}</span>
              <Badge tone={quota.state === "active" ? "green" : quota.state === "free" ? "neutral" : "amber"}>{quota.state}</Badge>
            </div>
            <p className="mt-1 text-[10px] text-muted">{user.planExpiresAt ? `Ends ${formatDate(user.planExpiresAt)}` : "No expiry · monthly allowance"}</p>
          </Card>
          <Card className="p-4">
            <div className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted">Creation credits</div>
            <div className="mt-1.5 flex items-end gap-1.5">
              <span className="font-display text-[22px] font-bold leading-none text-ink">{quota.remaining}</span>
              <span className="pb-0.5 text-[10px] text-muted">of {quota.allowance} remaining</span>
            </div>
            <p className="mt-1 text-[10px] text-muted">Resets {quota.resetLabel}</p>
          </Card>
          <Card className="p-4">
            <div className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted">Plan permissions</div>
            <div className="mt-2 flex flex-wrap gap-1">
              <Badge tone={quota.plan.ads && quota.state === "active" ? "green" : "neutral"}>Ads {quota.plan.ads ? "✓" : "✕"}</Badge>
              <Badge tone={quota.plan.api && quota.state === "active" ? "green" : "neutral"}>API {quota.plan.api ? "✓" : "✕"}</Badge>
              <Badge tone="neutral">{quota.plan.maxProjectMb} MB</Badge>
            </div>
            <p className="mt-1.5 text-[10px] text-muted">{quota.state === "expired" ? "Subscription expired — paid-only features disabled for new operations." : "Limits are enforced server-side."}</p>
          </Card>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {PLANS.filter((p) => p.active).map((p) => (
          <PlanCard key={p.id} plan={p} current={!!user && user.planId === p.id} onChoose={() => choose(p.id)} />
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <h3 className="text-[12.5px] font-semibold text-ink">What changes with a paid plan</h3>
            <p className="text-[10px] text-muted">Same builder, more capacity and monetisation.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-[10.5px]">
              <thead>
                <tr className="border-b border-line text-left text-[9px] uppercase tracking-wider text-muted">
                  <th className="px-4 py-2 font-semibold">Capability</th>
                  <th className="px-3 py-2 font-semibold">Free</th>
                  <th className="px-3 py-2 font-semibold">Creator</th>
                  <th className="px-3 py-2 font-semibold">Studio</th>
                  <th className="px-3 py-2 font-semibold">Scale</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Monthly/period credits", "3 / month", "15 / 30d", "50 / 90d", "250 / 180d"],
                  ["Ad SDK integration", "—", "✓", "✓", "✓"],
                  ["Public developer API", "—", "✓", "✓", "✓"],
                  ["Max project size", "25 MB", "150 MB", "400 MB", "1 GB"],
                  ["Release APK", "—", "✓", "✓", "✓"],
                  ["AAB build", "—", "—", "✓", "✓"],
                  ["Priority queue", "—", "✓", "✓", "✓"],
                  ["9-minute downloads", "✓", "✓", "✓", "✓"],
                ].map((row) => (
                  <tr key={row[0]} className="border-b border-line/70 last:border-0">
                    <td className="px-4 py-2 font-medium text-ink/80">{row[0]}</td>
                    {row.slice(1).map((v, i) => (
                      <td key={i} className={cn("px-3 py-2", v === "—" ? "text-muted" : "font-medium text-ink")}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2.5">
            <Info className="h-3.5 w-3.5 text-muted" />
            <p className="text-[9.5px] text-muted">Example prices are configuration values in INR. Administrator-managed plan data is not editable by users.</p>
          </div>
        </Card>

        <div className="space-y-3">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-lime/10 text-lime"><Landmark className="h-4 w-4" /></div>
              <div>
                <h3 className="text-[11.5px] font-semibold text-ink">Manual UPI payment</h3>
                <p className="text-[9.5px] text-muted">Plan activates after approval only</p>
              </div>
            </div>
            <ol className="mt-3 space-y-2">
              {["Choose a paid plan", "Create a payment request & order ID", "Pay using the configured UPI details", "Submit the UTR for verification", "Plan activates after admin approval"].map((s, i) => (
                <li key={s} className="flex items-start gap-2 text-[10px] leading-relaxed text-muted">
                  <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full border border-line bg-panel2 font-mono text-[8px] text-ink">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
            <div className="mt-3 flex items-start gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2">
              <Lock className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
              <p className="text-[9px] leading-relaxed text-muted">Merchant UPI details are not configured by the administrator. Payment collection stays disabled until configured — no placeholder UPI ID is ever shown as real.</p>
            </div>
          </Card>
          <Card className="p-4">
            <h3 className="text-[11.5px] font-semibold text-ink">Plan support</h3>
            <p className="mt-1 text-[10px] leading-relaxed text-muted">Questions about payments, activation, credits, build errors or API integration?</p>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="mt-2 inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-ink hover:text-lime"><Mail className="h-3.5 w-3.5" /> {SUPPORT_EMAIL}</a>
            <div className="mt-1.5 flex items-center gap-1.5 text-[9px] text-muted"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Support inbox monitored</div>
          </Card>
          {embedded && (
            <div className="rounded-xl border border-line bg-panel/50 p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-ink"><ShieldCheck className="h-3.5 w-3.5 text-lime" /> Quota integrity</div>
              <p className="mt-1 text-[9.5px] leading-relaxed text-muted">Credits are atomic and per UID. Logging out, clearing storage or using the API never resets them.</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-line bg-panel/40 px-4 py-3 text-center">
        <p className="text-[10px] text-muted">
          Support: <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-ink hover:text-lime">{SUPPORT_EMAIL}</a> · Payment approvals are handled by a separate future administrator application. No admin panel is included here.
        </p>
      </div>
    </div>
  );
}

export function PublicPlansPage() {
  return (
    <div className="min-h-screen bg-bg">
      <PublicNav />
      <div className="mx-auto max-w-[1240px] px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-8 max-w-2xl">
          <Badge tone="lime"><Zap className="h-3 w-3" /> Transparent credits</Badge>
          <h1 className="mt-4 font-display text-[34px] font-bold leading-[1.04] tracking-tight text-ink sm:text-[46px]">Plans built for shipping,<br /><span className="text-muted">not for surprises.</span></h1>
          <p className="mt-4 max-w-lg text-[13px] leading-relaxed text-muted">Start with three free app credits every calendar month. Upgrade only when you need more creations, ads or API access. Prices shown in INR.</p>
        </div>
        <PlansContent />
      </div>
      <PublicFooter />
    </div>
  );
}

export function WorkspacePlansPage() {
  return <PlansContent embedded />;
}

/* ------------------------------------------------------------------ Payment */

export function PaymentPage() {
  const [params] = useSearchParams();
  const { state, quota, submitPayment } = useStore();
  const { toast } = useToast();
  const [method, setMethod] = useState("Google Pay");
  const [utr, setUtr] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState<{ orderId: string; planName: string; amount: number } | null>(null);
  const selected = planById(params.get("plan") ?? "creator");
  const current = state.user?.planId === selected.id && quota.state === "active";
  const total = selected.price;
  const [upi, setUpi] = useState<{ upiId: string; payeeName: string } | null>(() => getUpiConfig());
  useEffect(() => { let live = true; void hydrateUpiFromServer().then((cfg) => { if (live && cfg) setUpi(cfg); }); return () => { live = false; }; }, []);
  const intent = upi ? upiIntent(total, `U APP ${selected.name} plan`) : "";

  const pay = async () => {
    setError("");
    if (!state.user) return;
    const clean = utr.replace(/\s/g, "");
    if (!/^[A-Za-z0-9]{8,22}$/.test(clean)) {
      setError("Enter the UTR / UPI reference number from your payment app (8–22 letters or digits).");
      return;
    }
    if (!agree) {
      setError("Confirm that you paid the exact plan amount before submitting.");
      return;
    }
    const res = await submitPayment({ planId: selected.id, method, utr: clean });
    if (!res.ok) {
      setError(res.message ?? "Could not create this payment request.");
      return;
    }
    setSubmitted({ orderId: res.orderId, planName: selected.name, amount: total });
    toast("Payment request submitted. Status: PENDING approval.", "success");
  };

  if (selected.id === "free" || selected.price === 0) {
    return (
      <div>
        <PageHeader title="Payment" subtitle="Free plan requires no payment." />
        <Card className="p-6 text-center">
          <p className="text-[12px] text-muted">The Free plan is active without payment. Choose a paid plan to create a payment request.</p>
          <Link to="/app/plans" className={buttonClass("lime", "md", "mt-3")}>View plans</Link>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="overflow-hidden">
          <div className="border-b border-line bg-[linear-gradient(140deg,rgba(201,246,91,.08),transparent)] px-5 py-6 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-lime/15 text-lime"><Clock className="h-6 w-6" /></div>
            <h1 className="mt-3 font-display text-[22px] font-bold text-ink">Payment request pending</h1>
            <p className="mx-auto mt-1 max-w-sm text-[11.5px] leading-relaxed text-muted">Your request is recorded. The {submitted.planName} plan is <span className="font-semibold text-ink">not active yet</span> — it activates only after an authorised administrator verifies the UTR.</p>
          </div>
          <div className="p-5">
            <div className="overflow-hidden rounded-xl border border-line">
              {[
                ["Order ID", submitted.orderId],
                ["Plan", submitted.planName],
                ["Amount", inr(submitted.amount)],
                ["Method", method],
                ["UTR", utr.length > 8 ? `${utr.slice(0, 4)}••••${utr.slice(-4)}` : utr],
                ["Status", "PENDING"],
                ["Requested", new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between border-b border-line px-3 py-2 text-[10.5px] last:border-0">
                  <span className="text-muted">{k}</span>
                  <span className={cn("font-medium text-ink", k === "Status" && "text-amber-600 dark:text-amber-400")}>{v}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-line bg-panel2/50 p-2.5">
              <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
              <p className="text-[9.5px] leading-relaxed text-muted">Need to fix the UTR or speed up activation? Email <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-ink">{SUPPORT_EMAIL}</a> with your order ID. Never submit a second payment for the same request.</p>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Link to="/app/payments" className={buttonClass("lime", "md", "flex-1")}><Receipt className="h-4 w-4" /> View payment history</Link>
              <Link to="/app/plans" className={buttonClass("secondary", "md", "flex-1")}>Back to plans</Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Payment"
        subtitle="Manual UPI payment with administrator verification. No card data is collected."
        eyebrow="Checkout"
        actions={<Link to="/app/plans" className={buttonClass("ghost", "md")}>Back to plans</Link>}
      />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_.85fr]">
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-full bg-lime text-[10px] font-bold text-limeink">1</span><h2 className="text-[12.5px] font-semibold text-ink">Pay with UPI</h2></div>
              <Badge tone={upi ? "green" : "amber"}><Lock className="h-3 w-3" /> {upi ? "Server-configured payee" : "Collection not configured"}</Badge>
            </div>
            {upi ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-[auto_1fr]">
                <div className="mx-auto rounded-2xl border border-line bg-white p-3 text-center">
                  <QRCodeSVG value={intent} size={168} bgColor="#ffffff" fgColor="#0a0c10" level="M" />
                  <div className="mt-2 text-[9px] font-semibold text-[#3c443a]">Scan with any UPI app</div>
                </div>
                <div>
                  <div className="rounded-xl border border-lime/25 bg-lime/[0.05] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[8px] font-semibold uppercase tracking-wider text-muted">Paying to</div>
                        <div className="text-[12px] font-semibold text-ink">{upi.payeeName}</div>
                        <div className="font-mono text-[10px] text-muted">{upi.upiId}</div>
                      </div>
                      <CopyButton text={upi.upiId} label="Copy UPI ID" />
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
                      <span className="text-[10px] text-muted">Exact amount</span>
                      <span className="font-display text-[16px] font-bold text-ink">{inr(total)}</span>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {([
                      { id: "gpay", label: "Google Pay" },
                      { id: "phonepe", label: "PhonePe" },
                      { id: "paytm", label: "Paytm" },
                    ] as const).map((app) => (
                      <a key={app.id} href={appIntent(app.id, total, `U APP ${selected.name}`)} className={buttonClass("secondary", "sm", "justify-center px-1 text-[9.5px]")}>{app.label}</a>
                    ))}
                  </div>
                  <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-line bg-panel2/50 p-2">
                    <Lock className="mt-0.5 h-3 w-3 shrink-0 text-muted" />
                    <p className="text-[8.5px] leading-relaxed text-muted">The QR encodes the official UPI intent with the exact plan amount. Pay in your UPI app, then paste the UTR below. Your plan activates only after administrator verification.</p>
                  </div>

                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3.5">
                <div className="flex items-start gap-2">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold text-ink">Merchant UPI is not configured on the server</div>
                    <p className="mt-1 text-[10px] leading-relaxed text-muted">The owner must set the real merchant UPI through the admin API or deployment environment. Browsers cannot set or override the payee. U APP never invents a UPI address.</p>
                  </div>
                </div>
              </div>
            )}
            <div className="mt-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">Payment app used</div>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {METHOD_OPTIONS.map((m) => (
                  <button key={m} onClick={() => setMethod(m)} className={cn("flex items-center gap-1.5 rounded-lg border px-2 py-2 text-[10px] font-medium transition", method === m ? "border-lime/50 bg-lime/[0.05] text-ink" : "border-line bg-panel text-muted hover:text-ink")}>
                    <Smartphone className="h-3.5 w-3.5" /> {m}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-line bg-panel2/40 px-3 py-2 text-[9.5px] leading-relaxed text-muted">
              UPI options shown are compatible app choices. U APP does not process the payment itself; the merchant receives
              it directly and verifies the UTR. Never trust a browser-reported “payment success”.
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-full bg-lime text-[10px] font-bold text-limeink">2</span><h2 className="text-[12.5px] font-semibold text-ink">Submit payment proof</h2></div>
            <div className="mt-3 space-y-3">
              <Field label="UTR / UPI reference number" hint="Exactly as shown in your payment app. Stored masked in payment history." error={error}>
                <Input value={utr} onChange={(e) => setUtr(e.target.value.toUpperCase().replace(/\s/g, "").slice(0, 22))} placeholder="e.g. 425190218821" className="font-mono tracking-wider" />
              </Field>
              <div className="rounded-lg border border-line bg-panel2/40 p-2.5">
                <div className="flex items-center justify-between"><span className="text-[9.5px] text-muted">Plan</span><span className="text-[10px] font-semibold text-ink">{selected.name}</span></div>
                <div className="mt-1 flex items-center justify-between"><span className="text-[9.5px] text-muted">Amount paid</span><span className="text-[10px] font-semibold text-ink">{inr(total)} INR</span></div>
                <div className="mt-1 flex items-center justify-between"><span className="text-[9.5px] text-muted">Credits after activation</span><span className="text-[10px] font-semibold text-ink">{selected.credits} app credits · {selected.days} days</span></div>
              </div>
              <label className="flex items-start gap-2 text-[10px] leading-relaxed text-muted">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 accent-lime" />
                I confirm I paid the exact amount of {inr(total)} to the official merchant details provided by support, and I understand my plan stays inactive until verification.
              </label>
              <Button variant="lime" className="w-full" onClick={pay} disabled={!utr || !agree}><Upload className="h-4 w-4" /> Submit payment request</Button>
              <p className="text-center text-[9px] text-muted">Payment status becomes PENDING. No automatic activation occurs from frontend data.</p>
            </div>
          </Card>
        </div>

        <div className="space-y-3">
          <Card className="overflow-hidden">
            <div className="border-b border-line px-4 py-3"><h3 className="text-[12px] font-semibold text-ink">Order summary</h3></div>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-display text-[17px] font-bold text-ink">{selected.name}</div>
                  <div className="text-[9.5px] text-muted">{selected.duration}</div>
                </div>
                {current && <Badge tone="green">Active</Badge>}
              </div>
              <div className="mt-3 space-y-1.5">
                {[["App credits", `${selected.credits}`], ["Max project size", `${selected.maxProjectMb} MB`], ["Ad integration", selected.ads ? "Included" : "Not included"], ["Public API", selected.api ? "Included" : "Not included"], ["Builds", selected.builds.join(", ")]].map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-3 text-[10px]"><span className="text-muted">{k}</span><span className="max-w-[60%] text-right font-medium text-ink">{v}</span></div>
                ))}
              </div>
              <div className="mt-3 space-y-1 border-t border-line pt-3 text-[10.5px]">
                <div className="flex justify-between"><span className="text-muted">Subtotal</span><span className="text-ink">{inr(selected.price)}</span></div>
                <div className="flex justify-between"><span className="text-muted">Platform fee</span><span className="text-ink">₹0</span></div>
                <div className="flex justify-between pt-1 text-[13px] font-bold"><span className="text-ink">Total payable</span><span className="text-ink">{inr(selected.price)}</span></div>
              </div>
              <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-panel2/60 px-2.5 py-2">
                <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-lime" />
                <p className="text-[9px] leading-relaxed text-muted">Price is loaded from the plan configuration service, never from browser input. A changed plan price cannot be forced by the client.</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <h3 className="text-[11px] font-semibold text-ink">What happens next?</h3>
            <ol className="mt-2 space-y-2">
              {["Request is saved as PENDING", "Administrator checks the UTR", "Subscription becomes ACTIVE", "Credits appear in your workspace"].map((s, i) => (
                <li key={s} className="flex items-start gap-2 text-[9.5px] leading-relaxed text-muted"><span className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-panel2 font-mono text-[7px] text-ink">{i + 1}</span>{s}</li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ History */

export function PaymentHistoryPage() {
  const { state, quota } = useStore();
  const payments = state.payments;
  const pending = payments.filter((p) => p.status === "pending");
  const approved = payments.filter((p) => p.status === "active");
  const total = approved.reduce((a, p) => a + p.amount, 0);

  const tone = (s: string) => (s === "active" ? "green" : s === "pending" ? "amber" : "rose") as "green" | "amber" | "rose";
  const label = (s: string) => (s === "active" ? "Approved" : s === "pending" ? "Pending" : "Rejected");

  return (
    <div>
      <PageHeader
        title="Payment History"
        subtitle="Every manual UPI request, its masked UTR and its verification outcome. Approvals happen only in the administrator system."
        eyebrow="Billing"
        actions={<><a href={`mailto:${SUPPORT_EMAIL}`} className={buttonClass("secondary", "md")}><Mail className="h-4 w-4" /> Contact billing</a><Link to="/app/plans" className={buttonClass("lime", "md")}><Zap className="h-4 w-4" /> Plans</Link></>}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Current plan", v: quota.plan.name, s: quota.state, icon: Sparkles },
          { label: "Pending requests", v: String(pending.length), s: pending.length ? "Awaiting verification" : "Nothing pending", icon: Clock },
          { label: "Approved payments", v: String(approved.length), s: `${inr(total)} approved`, icon: CheckCircle2 },
          { label: "Rejected", v: String(payments.filter((p) => p.status === "rejected").length), s: "Reasons on record", icon: TriangleAlert },
        ].map((s) => (
          <Card key={s.label} className="p-3.5">
            <div className="flex items-center justify-between"><s.icon className="h-4 w-4 text-muted" /><span className="text-[9px] text-muted">{s.s}</span></div>
            <div className="mt-2 font-display text-[18px] font-bold text-ink">{s.v}</div>
            <div className="text-[9.5px] text-muted">{s.label}</div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-[12.5px] font-semibold text-ink">Payment requests</h2>
            <p className="text-[10px] text-muted">{payments.length} record{payments.length === 1 ? "" : "s"} · newest first</p>
          </div>
          <Badge tone="neutral"><Receipt className="h-3 w-3" /> INR · UPI</Badge>
        </div>
        {payments.length === 0 ? (
          <div className="p-5">
            <Empty icon={<CreditCard className="h-5 w-5" />} title="No payment history yet" body="When you submit a UPI payment request, its order ID, amount, UTR and approval status appear here." action={<Link to="/app/plans" className={buttonClass("lime", "sm")}>View paid plans</Link>} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[10.5px]">
              <thead>
                <tr className="border-b border-line text-[8.5px] uppercase tracking-wider text-muted">
                  <th className="px-4 py-2.5 font-semibold">Order</th>
                  <th className="px-3 py-2.5 font-semibold">Plan</th>
                  <th className="px-3 py-2.5 font-semibold">Amount</th>
                  <th className="px-3 py-2.5 font-semibold">Method</th>
                  <th className="px-3 py-2.5 font-semibold">UTR</th>
                  <th className="px-3 py-2.5 font-semibold">Requested</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-line/70 last:border-0">
                    <td className="px-4 py-3"><div className="font-mono text-[9.5px] font-semibold text-ink">{p.orderId}</div><div className="text-[8.5px] text-muted">{p.id}</div></td>
                    <td className="px-3 py-3 font-medium text-ink">{p.planName}</td>
                    <td className="px-3 py-3 font-semibold text-ink">{inr(p.amount)}</td>
                    <td className="px-3 py-3 text-muted">{p.method}</td>
                    <td className="px-3 py-3 font-mono text-[9px] text-muted">{p.utr}</td>
                    <td className="px-3 py-3 text-muted">{formatDate(p.createdAt)}<div className="text-[8px]">{relativeTime(p.createdAt)}</div></td>
                    <td className="px-3 py-3"><Badge tone={tone(p.status)}>{label(p.status)}</Badge></td>
                    <td className="max-w-[210px] px-4 py-3 text-[9px] leading-relaxed text-muted">
                      {p.status === "pending" && "Awaiting administrator verification. The plan is not active yet."}
                      {p.status === "active" && `Approved ${p.approvedAt ? formatDate(p.approvedAt) : ""}`}
                      {p.status === "rejected" && (p.rejectionReason ?? "Payment could not be verified. Contact support.")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-panel/50 px-3.5 py-2.5">
        <p className="text-[9.5px] text-muted"><Lock className="mr-1 inline h-3 w-3" /> Frontend payment success parameters are never trusted. Plans activate from verified server-side approval only.</p>
        <div className="flex items-center gap-2">
          <CopyButton text={state.user?.uid ?? ""} label="Copy account UID" />
          <span className="font-mono text-[8.5px] text-muted">{state.user?.uid}</span>
        </div>
      </div>
    </div>
  );
}


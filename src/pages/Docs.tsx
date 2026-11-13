import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Code2,
  ExternalLink,
  KeyRound,
  Layers,
  Lock,
  Mail,
  Moon,
  Play,
  Plus,
  Search,
  Server,
  ShieldCheck,
  Sun,
  Terminal,
  Trash2,
  TriangleAlert,
  Zap,
} from "lucide-react";
import { Badge, Button, buttonClass, Card, CopyButton, Empty, Field, Input, Logo, Modal, Progress, Select, useToast } from "@/components/ui";
import { AD_FORMATS, AD_TIMINGS, CODE_SAMPLES, ENDPOINTS, NETWORKS, SUPPORT_EMAIL, type Endpoint } from "@/data/catalog";
import { formatDate, relativeTime, useStore } from "@/lib/store";
import { cn } from "@/utils/cn";
import { adIntegrationSnippet, adTagsFor, allAdTagsHtml, loadManagedAds, requestAd, type AdRequestResult, type AdTagFormat } from "@/lib/ads";

function DocsHeader({ backTo = "/app" }: { backTo?: string }) {
  const { state, theme, toggleTheme } = useStore();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-3 px-4 sm:px-6">
        <Link to="/"><Logo size={30} /></Link>
        <span className="rounded border border-line bg-panel px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-muted">docs</span>
        <div className="ml-auto flex items-center gap-2">
          <Link to={state.user ? backTo : "/"} className="inline-flex items-center gap-1.5 text-[10.5px] font-medium text-muted hover:text-ink">
            {state.user ? <><ArrowLeft className="h-3 w-3" /> Workspace</> : <><ArrowLeft className="h-3 w-3" /> Home</>}
          </Link>
          <button onClick={toggleTheme} className="rounded-lg border border-line p-1.5 text-muted hover:text-ink" aria-label="Toggle theme">{theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}</button>
          {state.user ? (
            <Link to="/app" className={buttonClass("lime", "sm")}>Dashboard</Link>
          ) : (
            <>
              <Link to="/login" className="hidden text-[10.5px] font-semibold text-muted hover:text-ink sm:block">Log in</Link>
              <Link to="/register" className={buttonClass("lime", "sm")}>Create account</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ API Docs */

const API_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "account", label: "Account & quota" },
  { id: "auth", label: "Authentication" },
  { id: "endpoints", label: "Endpoints" },
  { id: "keys", label: "API keys" },
  { id: "errors", label: "Error codes" },
  { id: "samples", label: "Code samples" },
  { id: "history", label: "Request history" },
];

export function ApiDocsPage() {
  const { state, quota, createApiKey, revokeApiKey } = useStore();
  const { toast } = useToast();
  const [modal, setModal] = useState(false);
  const [label, setLabel] = useState("Production key");
  const [secret, setSecret] = useState<string | null>(null);
  const [keyError, setKeyError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(ENDPOINTS[0].path);
  const [lang, setLang] = useState<"JavaScript" | "Python" | "PHP">("JavaScript");
  const [q, setQ] = useState("");
  const activePlan = quota.plan;
  const apiAllowed = !!state.user && quota.state === "active" && activePlan.api;
  const keys = state.apiKeys.filter((k) => !k.revokedAt);
  const endpoints = useMemo(() => ENDPOINTS.filter((e) => (e.path + e.title + e.description).toLowerCase().includes(q.toLowerCase())), [q]);

  const createKey = async () => {
    setKeyError("");
    if (label.trim().length < 2) { setKeyError("Give this key a recognisable label."); return; }
    const res = await createApiKey(label.trim());
    if (!res.ok) { setKeyError(res.message ?? "Could not create key."); return; }
    setSecret(res.secret ?? null);
    setLabel("Production key");
    toast("API key created. Copy it now — it is shown once.", "success");
  };

  const scroll = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="min-h-screen bg-bg">
      <DocsHeader />
      <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col gap-4 border-b border-line pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="sky"><Code2 className="h-3 w-3" /> Public developer API</Badge>
              <Badge tone="amber"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Spec ready · REST backend deployment required</Badge>
            </div>
            <h1 className="mt-3 font-display text-[30px] font-bold leading-[1.05] tracking-tight text-ink sm:text-[38px]">Build U APP into<br className="sm:hidden" /> your own software.</h1>
            <p className="mt-2.5 max-w-xl text-[12.5px] leading-relaxed text-muted">
              Create, rebuild and download apps over authenticated REST. The same server-side quota applies to API calls
              and the website builder. API keys are hashed at rest.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`mailto:${SUPPORT_EMAIL}?subject=U%20APP%20API%20integration`} className={buttonClass("secondary", "md")}><Mail className="h-4 w-4" /> API support</a>
            {apiAllowed ? (
              <Button variant="lime" size="md" onClick={() => { setModal(true); setSecret(null); setKeyError(""); }}><Plus className="h-4 w-4" /> Create API key</Button>
            ) : (
              <Link to={state.user ? "/app/plans" : "/register"} className={buttonClass("lime", "md")}><Zap className="h-4 w-4" /> Unlock API access</Link>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted">On this page</div>
              <nav className="mt-2 space-y-0.5">
                {API_SECTIONS.map((s) => (
                  <button key={s.id} onClick={() => scroll(s.id)} className="block w-full rounded-md px-2 py-1.5 text-left text-[11px] font-medium text-muted transition hover:bg-panel2 hover:text-ink">{s.label}</button>
                ))}
              </nav>
              <div className="mt-4 rounded-lg border border-line bg-panel p-2.5">
                <div className="flex items-center gap-1.5 text-[9.5px] font-semibold text-ink"><Server className="h-3 w-3 text-muted" /> Base URL</div>
                <div className="mt-1 break-all font-mono text-[8.5px] leading-relaxed text-muted">https://your-domain.example</div>
                <div className="mt-1.5 text-[8px] text-muted">Set APP_URL at deployment. Domains are never hardcoded.</div>
              </div>
            </div>
          </aside>

          <div className="min-w-0 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" id="overview">
              {[
                { label: "API status", value: "v1 spec", sub: "Backend deployment required", tone: "amber" as const, icon: Server },
                { label: "Active plan", value: state.user ? activePlan.name : "—", sub: state.user ? `${quota.state}` : "Sign in required", tone: "neutral" as const, icon: Zap },
                { label: "App credits", value: state.user ? `${quota.remaining}/${quota.allowance}` : "—", sub: state.user ? `Resets ${quota.resetLabel}` : "Per Firebase UID", tone: quota.remaining > 0 ? "green" as const : "rose" as const, icon: Layers },
                { label: "API usage", value: String(state.apiUsage), sub: `${keys.length} active keys`, tone: "sky" as const, icon: Code2 },
              ].map((s) => (
                <Card key={s.label} className="p-3.5">
                  <div className="flex items-center justify-between"><s.icon className="h-4 w-4 text-muted" /><Badge tone={s.tone} className="px-1.5 py-0.5 text-[7.5px]">{s.sub}</Badge></div>
                  <div className="mt-2.5 font-display text-[20px] font-bold leading-none text-ink">{s.value}</div>
                  <div className="mt-1 text-[9.5px] text-muted">{s.label}</div>
                </Card>
              ))}
            </div>

            <Card className="p-4" id="account">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-panel2 text-muted"><ShieldCheck className="h-4 w-4" /></div>
                  <div>
                    <h2 className="text-[12.5px] font-semibold text-ink">Account & monthly quota</h2>
                    <p className="text-[10px] text-muted">The API can never bypass subscription or quota checks.</p>
                  </div>
                </div>
                <Badge tone={apiAllowed ? "green" : "amber"}>{apiAllowed ? "API access active" : "API access locked"}</Badge>
              </div>
              {state.user ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-muted">Account</div>
                    <div className="mt-0.5 text-[11px] font-semibold text-ink">{state.user.name}</div>
                    <div className="text-[9.5px] text-muted">{state.user.email}</div>
                    <div className="mt-1 font-mono text-[8.5px] text-muted">UID {state.user.uid}</div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[9px] text-muted"><span>{quota.used} used of {quota.allowance}</span><span>{quota.remaining} left</span></div>
                    <Progress value={quota.allowance ? (quota.remaining / quota.allowance) * 100 : 0} className="mt-1.5" tone={quota.remaining === 0 ? "rose" : "lime"} />
                    <div className="mt-1.5 flex items-center justify-between text-[8.5px] text-muted"><span>Resets {quota.resetLabel}</span><span>{quota.periodLabel}</span></div>
                    <Link to="/app/plans" className="mt-1.5 inline-flex items-center gap-1 text-[9px] font-semibold text-ink hover:text-lime">{apiAllowed ? "Manage plan" : "Activate an API plan"} <ArrowRight className="h-2.5 w-2.5" /></Link>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-col items-start justify-between gap-2 rounded-lg border border-line bg-panel2/50 p-3 sm:flex-row sm:items-center">
                  <p className="text-[10.5px] text-muted">Sign in to view your real allowance, keys and request history.</p>
                  <div className="flex gap-2"><Link to="/login?next=/api-docs" className={buttonClass("secondary", "sm")}>Log in</Link><Link to="/register" className={buttonClass("lime", "sm")}>Create account</Link></div>
                </div>
              )}
              <div className="mt-3 grid gap-1.5 sm:grid-cols-3">
                {["API access requires an active paid plan.", "Creating apps consumes one credit per app.", "Reading usage or history never consumes a credit."].map((x) => (
                  <div key={x} className="flex items-start gap-1.5 rounded-lg bg-panel2/50 px-2 py-1.5 text-[8.5px] leading-relaxed text-muted"><Check className="mt-0.5 h-2.5 w-2.5 shrink-0 text-lime" /> {x}</div>
                ))}
              </div>
            </Card>

            <Card className="p-4" id="auth">
              <h2 className="text-[12.5px] font-semibold text-ink">Authentication</h2>
              <p className="mt-1 text-[10.5px] leading-relaxed text-muted">Send a server-side bearer key with every request. Never ship a key in browser code or a mobile binary.</p>
              <div className="mt-2.5 overflow-hidden rounded-lg border border-line bg-[#0a0c10]">
                <div className="flex items-center justify-between border-b border-white/8 px-3 py-1.5"><span className="font-mono text-[8.5px] text-white/40">Request header</span><CopyButton text="Authorization: Bearer ua_live_REPLACE_WITH_YOUR_KEY" /></div>
                <pre className="overflow-x-auto p-3 font-mono text-[10px] text-[#c9d1c2]">Authorization: Bearer ua_live_REPLACE_WITH_YOUR_KEY</pre>
              </div>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
                {[["Hashing", "SHA-256 at rest"], ["Rate limits", "Per key + per UID"], ["Ownership", "Every resource checked"]].map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-line px-2 py-1.5"><div className="text-[8px] uppercase tracking-wider text-muted">{k}</div><div className="text-[9.5px] font-semibold text-ink">{v}</div></div>
                ))}
              </div>
            </Card>

            <div id="endpoints">
              <div className="mb-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div><h2 className="font-display text-[17px] font-semibold text-ink">Endpoints</h2><p className="text-[10px] text-muted">{ENDPOINTS.length} authenticated REST endpoints · JSON request and response</p></div>
                <div className="relative sm:w-56"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter endpoints…" className="h-9 pl-8 text-[11px]" /></div>
              </div>
              <div className="space-y-2">
                {endpoints.map((e) => <EndpointCard key={e.path} endpoint={e} open={expanded === e.path} toggle={() => setExpanded(expanded === e.path ? null : e.path)} />)}
                {endpoints.length === 0 && <p className="rounded-xl border border-line px-4 py-8 text-center text-[11px] text-muted">No endpoints match “{q}”.</p>}
              </div>
            </div>

            <Card className="p-4" id="keys">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-[12.5px] font-semibold text-ink">API keys</h2>
                  <p className="text-[10px] text-muted">{keys.length} of 5 active keys · maximum 5 to prevent quota evasion</p>
                </div>
                <Button variant={apiAllowed ? "lime" : "secondary"} size="sm" onClick={() => { if (apiAllowed) { setModal(true); setSecret(null); setKeyError(""); } else toast(state.user ? "API access requires an active plan with API permission." : "Sign in to create API keys.", "error"); }}>
                  <Plus className="h-3.5 w-3.5" /> New key
                </Button>
              </div>
              {keys.length === 0 ? (
                <div className="mt-2.5 rounded-xl border border-dashed border-line px-4 py-6 text-center">
                  <KeyRound className="mx-auto h-5 w-5 text-muted" />
                  <p className="mt-1.5 text-[11px] font-semibold text-ink">No active API keys</p>
                  <p className="mt-0.5 text-[9.5px] text-muted">{apiAllowed ? "Create your first key. The secret is displayed exactly once." : "Activate a plan with API access to create a key."}</p>
                </div>
              ) : (
                <div className="mt-2.5 overflow-hidden rounded-xl border border-line">
                  {state.apiKeys.map((k) => (
                    <div key={k.id} className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5 last:border-0">
                      <div className="grid h-7 w-7 place-items-center rounded-lg bg-panel2 text-muted"><KeyRound className="h-3.5 w-3.5" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5"><span className="text-[10.5px] font-semibold text-ink">{k.label}</span>{k.revokedAt && <Badge tone="rose">Revoked</Badge>}</div>
                        <div className="font-mono text-[8.5px] text-muted">{k.prefix}•••••••••••• · created {formatDate(k.createdAt)} · SHA-256 only</div>
                      </div>
                      {!k.revokedAt ? (
                        <Button variant="danger" size="sm" onClick={() => { revokeApiKey(k.id); toast("API key revoked. Existing requests will fail.", "success"); }}><Trash2 className="h-3 w-3" /> Revoke</Button>
                      ) : <span className="text-[8.5px] text-muted">{relativeTime(k.revokedAt)}</span>}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <div className="grid gap-4 sm:grid-cols-2" id="errors">
              <Card className="p-4">
                <h2 className="text-[12.5px] font-semibold text-ink">Error codes</h2>
                <div className="mt-2 divide-y divide-line">
                  {[
                    ["PLAN_REQUIRED", "No active plan or credit for this operation."],
                    ["QUOTA_EXCEEDED", "Monthly or period allowance exhausted."],
                    ["INVALID_API_KEY", "Missing, revoked or unrecognised bearer key."],
                    ["FORBIDDEN", "Authenticated, but you do not own this resource."],
                    ["PLAN_ADS_LOCKED", "Ad configuration requires an eligible active plan."],
                    ["RATE_LIMITED", "Too many requests. Respect Retry-After."],
                    ["VALIDATION_ERROR", "A field failed server-side validation."],
                    ["RUNNER_NOT_CONFIGURED", "Build credentials are missing on the server."],
                  ].map(([code, meaning]) => (
                    <div key={code} className="flex items-start gap-2 py-1.5">
                      <code className="shrink-0 rounded bg-panel2 px-1.5 py-0.5 font-mono text-[8px] font-semibold text-rose-500">{code}</code>
                      <span className="text-[9px] leading-relaxed text-muted">{meaning}</span>
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="p-4" id="history">
                <div className="flex items-center justify-between"><h2 className="text-[12.5px] font-semibold text-ink">Request history</h2><Badge tone="neutral">{state.apiUsage} total</Badge></div>
                <div className="mt-2">
                  {state.apiLogs.length === 0 ? (
                    <Empty icon={<Code2 className="h-4 w-4" />} title="No requests recorded" body="Authenticated API calls will appear here with status, latency and response metadata. No keys or secrets are ever logged." />
                  ) : (
                    <div className="space-y-1.5">
                      {state.apiLogs.slice(0, 5).map((log) => (
                        <div key={log.id} className="rounded-lg border border-line bg-panel2/30 px-2.5 py-2">
                          <div className="flex items-center gap-1.5">
                            <span className={cn("rounded px-1 py-0.5 font-mono text-[7px] font-bold", log.method === "POST" ? "bg-lime/15 text-limeink dark:text-lime" : "bg-sky-500/10 text-sky-500")}>{log.method}</span>
                            <code className="min-w-0 flex-1 truncate font-mono text-[8.5px] text-ink/80">{log.path}</code>
                            <span className={cn("font-mono text-[8px] font-bold", log.status < 300 ? "text-emerald-500" : log.status < 500 ? "text-amber-500" : "text-rose-500")}>{log.status}</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2 text-[7.5px] text-muted">
                            <span className="truncate">{log.message}</span>
                            <span className="shrink-0 font-mono">{log.durationMs}ms · {log.credits} cr · {relativeTime(log.at)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <p className="mt-1.5 text-[8.5px] leading-relaxed text-muted">Usage history is preserved when a plan ends; new API requests require an active plan with API permission.</p>
                <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-2 text-[8.5px] leading-relaxed text-muted">
                  <TriangleAlert className="mr-1 inline h-2.5 w-2.5 text-amber-500" />
                  REST v1 requires the PHP backend deployment. Until it is connected, responses shown are documented contracts rather than live API calls.
                </div>
              </Card>
            </div>

            <Card className="overflow-hidden" id="samples">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
                <div><h2 className="text-[12.5px] font-semibold text-ink">Create an app</h2><p className="font-mono text-[9px] text-muted">POST /api/v1/apps/create</p></div>
                <div className="flex gap-1 rounded-lg bg-panel2 p-1">
                  {(Object.keys(CODE_SAMPLES) as ("JavaScript" | "Python" | "PHP")[]).map((l) => (
                    <button key={l} onClick={() => setLang(l)} className={cn("rounded px-2 py-1 text-[9px] font-semibold", lang === l ? "bg-panel text-ink shadow-sm" : "text-muted hover:text-ink")}>{l}</button>
                  ))}
                </div>
              </div>
              <div className="relative">
                <pre className="max-h-[340px] overflow-auto bg-[#0a0c10] p-4 font-mono text-[9.5px] leading-[1.85] text-[#c7d0bf]">{CODE_SAMPLES[lang]}</pre>
                <div className="absolute right-2 top-2"><CopyButton text={CODE_SAMPLES[lang]} /></div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5">
                <p className="text-[9px] text-muted">Python · PHP · JavaScript · HTML · XML-compatible · any HTTP-capable language</p>
                <a href={`mailto:${SUPPORT_EMAIL}?subject=U%20APP%20API%20question`} className="text-[9px] font-semibold text-ink hover:text-lime">Integration help</a>
              </div>
            </Card>

            <div className="flex flex-col items-start justify-between gap-2 rounded-xl border border-line bg-panel/50 px-4 py-3 sm:flex-row sm:items-center">
              <p className="text-[10px] text-muted">Need more than 5 keys or a higher API rate? Plan permissions are managed server-side.</p>
              <Link to="/app/plans" className="inline-flex items-center gap-1 text-[10px] font-semibold text-ink hover:text-lime">Compare plans <ArrowRight className="h-3 w-3" /></Link>
            </div>
          </div>
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={secret ? "API key created" : "Create an API key"} subtitle={secret ? "This is the only time the full key will ever be shown. Store it in your server secret manager." : "Keys are stored as SHA-256 hashes. A maximum of five active keys keeps quota controls meaningful."}>
        {secret ? (
          <div>
            <div className="flex items-center gap-2 rounded-xl border border-lime/30 bg-lime/5 px-3 py-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-lime" />
              <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink">{secret}</code>
              <CopyButton text={secret} label="Copy key" />
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              <p className="text-[10px] leading-relaxed text-muted">If you lose this key you cannot recover it. Revoke it and create a new one. Never put it in frontend JavaScript.</p>
            </div>
            <Button variant="lime" className="mt-4 w-full" onClick={() => { setSecret(null); setModal(false); }}>I have stored the key</Button>
          </div>
        ) : (
          <div>
            <Field label="Key label" hint="For example: Production server, CI pipeline, Reporting job.">
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Production server" maxLength={40} />
            </Field>
            {keyError && <p className="mt-2 text-[10.5px] font-medium text-rose-500">{keyError}</p>}
            <div className="mt-3 rounded-lg border border-line bg-panel2/50 p-2.5">
              <div className="text-[9.5px] font-semibold text-ink">Plan check</div>
              <div className="mt-1 grid grid-cols-2 gap-1 text-[9px] text-muted"><span>Plan</span><span className="text-right font-medium text-ink">{activePlan?.name}</span><span>API permission</span><span className="text-right font-medium text-ink">{apiAllowed ? "Granted" : "Not available"}</span><span>Credits</span><span className="text-right font-medium text-ink">{quota.remaining} left</span></div>
            </div>
            <div className="mt-4 flex gap-2"><Button variant="secondary" className="flex-1" onClick={() => setModal(false)}>Cancel</Button><Button variant="lime" className="flex-1" onClick={createKey} disabled={!apiAllowed}><KeyRound className="h-3.5 w-3.5" /> Create key</Button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function EndpointCard({ endpoint, open, toggle }: { endpoint: Endpoint; open: boolean; toggle: () => void }) {
  return (
    <Card className="overflow-hidden">
      <button onClick={toggle} className="flex w-full items-center gap-2.5 px-3 py-3 text-left">
        <span className={cn("rounded px-1.5 py-0.5 font-mono text-[8px] font-bold", endpoint.method === "POST" ? "bg-lime/15 text-limeink dark:text-lime" : "bg-sky-500/10 text-sky-500")}>{endpoint.method}</span>
        <code className="min-w-0 flex-1 truncate font-mono text-[10px] text-ink">{endpoint.path}</code>
        <span className="hidden text-[9px] text-muted sm:block">{endpoint.title}</span>
        {endpoint.credits ? <Badge tone="amber" className="hidden px-1.5 py-0.5 text-[7px] sm:inline-flex">1 credit</Badge> : <Badge tone="neutral" className="hidden px-1.5 py-0.5 text-[7px] sm:inline-flex">No credit</Badge>}
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="animate-rise border-t border-line bg-panel2/20 px-3 py-3">
          <p className="text-[10px] leading-relaxed text-muted">{endpoint.description}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {endpoint.body && (
              <div className="overflow-hidden rounded-lg border border-line bg-[#0a0c10]">
                <div className="border-b border-white/8 px-2 py-1 font-mono text-[8px] text-white/40">request.json</div>
                <pre className="max-h-40 overflow-auto p-2 font-mono text-[8.5px] leading-relaxed text-[#c9d1c2]">{endpoint.body}</pre>
              </div>
            )}
            <div className="overflow-hidden rounded-lg border border-line bg-[#0a0c10]">
              <div className="flex items-center justify-between border-b border-white/8 px-2 py-1"><span className="font-mono text-[8px] text-white/40">response.json · contract preview</span><CopyButton text={endpoint.response} /></div>
              <pre className="max-h-40 overflow-auto p-2 font-mono text-[8.5px] leading-relaxed text-[#c9d1c2]">{endpoint.response}</pre>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-[8px] text-muted">
            <span className="inline-flex items-center gap-1"><Lock className="h-2.5 w-2.5" /> Bearer auth</span>
            <span className="inline-flex items-center gap-1"><ShieldCheck className="h-2.5 w-2.5" /> Ownership checked</span>
            <span className="inline-flex items-center gap-1"><Zap className="h-2.5 w-2.5" /> Rate limited</span>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ Ad Docs */

export function AdDocsPage() {
  const { state, quota } = useStore();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>("admob");
  const managed = loadManagedAds();
  const [adFormat, setAdFormat] = useState("Banner");
  const [adProject, setAdProject] = useState("APP-DEMO01");
  const [adBusy, setAdBusy] = useState(false);
  const [adResult, setAdResult] = useState<AdRequestResult | null>(null);
  const [adError, setAdError] = useState("");
  const [tagFormat, setTagFormat] = useState<AdTagFormat>("banner");
  const [tagProject, setTagProject] = useState("APP-DEMO01");
  const [tagCopied, setTagCopied] = useState(false);
  const networks = NETWORKS.filter((n) => (n.name + n.formats.join(" ")).toLowerCase().includes(q.toLowerCase()));
  const selectedNet = NETWORKS.find((n) => n.id === selected) ?? NETWORKS[0];
  const adsAllowed = quota.plan.ads && quota.state === "active";
  return (
    <div className="min-h-screen bg-bg">
      <DocsHeader />
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        <div className="flex flex-col justify-between gap-4 border-b border-line pb-6 lg:flex-row lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="violet"><BookOpen className="h-3 w-3" /> Ad SDK reference</Badge>
              <Badge tone="neutral">/api-doce · /ad-docs</Badge>
            </div>
            <h1 className="mt-3 font-display text-[30px] font-bold leading-[1.05] tracking-tight text-ink sm:text-[38px]">Monetise with official SDKs.</h1>
            <p className="mt-2.5 max-w-2xl text-[12.5px] leading-relaxed text-muted">
              Network catalogue, required credentials, supported formats, placement timing and diagnostics. U APP never
              invents SDK versions — always confirm the current version in the network&apos;s official console and docs.
            </p>
          </div>
          <Link to="/app/create" className={buttonClass("lime", "md")}>Configure in builder <ArrowRight className="h-4 w-4" /></Link>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
          <div className="space-y-4">
            <Card className="p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div><h2 className="text-[12.5px] font-semibold text-ink">Network catalogue</h2><p className="text-[10px] text-muted">{NETWORKS.length} integrations · credentials are configured per project</p></div>
                <div className="relative sm:w-52"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search networks…" className="h-9 pl-8 text-[11px]" /></div>
              </div>
              <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
                {networks.map((n) => (
                  <button key={n.id} onClick={() => setSelected(n.id)} className={cn("rounded-lg border p-2.5 text-left transition", selected === n.id ? "border-lime/50 bg-lime/[0.04]" : "border-line bg-panel hover:bg-panel2/50")}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[10.5px] font-semibold text-ink">{n.name}</span>
                      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", selected === n.id ? "bg-lime" : "bg-muted/40")} />
                    </div>
                    <div className="mt-1 line-clamp-2 text-[8.5px] leading-relaxed text-muted">{n.formats.slice(0, 4).join(" · ")}{n.formats.length > 4 ? ` +${n.formats.length - 4}` : ""}</div>
                  </button>
                ))}
                {networks.length === 0 && <p className="col-span-full py-6 text-center text-[10.5px] text-muted">No networks match “{q}”.</p>}
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h2 className="font-display text-[16px] font-semibold text-ink">{selectedNet.name}</h2><p className="text-[9.5px] text-muted">Configuration reference · verify everything in the official console</p></div>
                <a href={selectedNet.docs} target="_blank" rel="noreferrer" className={buttonClass("secondary", "sm")}>Official docs <ExternalLink className="h-3 w-3" /></a>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-lime/25 bg-lime/[0.04] p-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-[10px] font-semibold text-ink">Platform-managed App ID</div>
                      <div className="text-[8.5px] text-muted">You never enter an App ID. The platform injects its verified network App ID.</div>
                    </div>
                    <span className="rounded bg-lime px-1.5 py-0.5 text-[7px] font-bold uppercase text-limeink">managed</span>
                  </div>
                  <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                    <div className="rounded-lg border border-line bg-panel px-2 py-1.5">
                      <div className="text-[7.5px] uppercase tracking-wider text-muted">App ID in use</div>
                      <div className="truncate font-mono text-[9px] text-ink">{managed[selectedNet.id]?.appId ?? "platform-managed"}</div>
                      <div className="text-[7.5px] text-muted">{managed[selectedNet.id]?.label}</div>
                    </div>
                    <div className="rounded-lg border border-line bg-panel px-2 py-1.5">
                      <div className="text-[7.5px] uppercase tracking-wider text-muted">Placement</div>
                      <div className="truncate font-mono text-[9px] text-ink">{managed[selectedNet.id]?.testUnit ?? "auto-generated"}</div>
                      <div className="text-[7.5px] text-muted">Auto-generated per format</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <div className="text-[9px] font-semibold uppercase tracking-wider text-muted">Supported formats</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">{selectedNet.formats.map((f) => <span key={f} className="rounded-md border border-line bg-panel px-2 py-1 text-[9px] font-medium text-ink/75">{f}</span>)}</div>
              </div>
              <div className="mt-3 overflow-hidden rounded-lg border border-line bg-[#0a0c10]">
                <div className="flex items-center justify-between border-b border-white/8 px-3 py-1.5"><span className="font-mono text-[8.5px] text-white/40">generated-sdk-integration.kt · auto App ID</span><CopyButton text={adIntegrationSnippet(selectedNet.id, adFormat)} /></div>
                <pre className="overflow-auto p-3 font-mono text-[8.5px] leading-relaxed text-[#c9d1c2]">{adIntegrationSnippet(selectedNet.id, adFormat)}</pre>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-[12.5px] font-semibold text-ink">HTML ad load tags</h2>
                  <p className="text-[10px] leading-relaxed text-muted">Yeh tags apne HTML mein paste karo, phir wahi HTML/ZIP U APP mein upload karke app banao. Banner wahan dikhega jahan div rakha hai; reward/interstitial button click par load hoga.</p>
                </div>
                <Badge tone="lime">{selectedNet.name}</Badge>
              </div>
              <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
                <Select value={tagFormat} onChange={(e) => setTagFormat(e.target.value as AdTagFormat)} className="h-9 text-[10.5px]">
                  {(["banner", "mrec", "interstitial", "rewarded", "app-open", "native"] as AdTagFormat[]).map((f) => <option key={f} value={f}>{f.replace("-", " ")}</option>)}
                </Select>
                <Input value={tagProject} onChange={(e) => setTagProject(e.target.value.toUpperCase())} placeholder="Project ID" className="h-9 font-mono text-[10px]" aria-label="Project ID for ad tags" />
              </div>
              {(() => {
                const tag = adTagsFor(selectedNet.id, tagProject || "APP-LOCAL01", [tagFormat])[0];
                return (
                  <div className="mt-2 overflow-hidden rounded-lg border border-line bg-[#0a0c10]">
                    <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-white/8 px-2.5 py-1.5">
                      <span className="font-mono text-[8px] text-white/40">{tagFormat} · {tag?.placement}</span>
                      <div className="flex gap-1.5">
                        <button onClick={() => { void navigator.clipboard.writeText(tag?.html ?? ""); setTagCopied(true); window.setTimeout(() => setTagCopied(false), 1500); }} className="rounded border border-white/15 px-1.5 py-0.5 text-[8px] font-semibold text-white/70">{tagCopied ? "Copied" : "Copy tag"}</button>
                        <button onClick={() => {
                          const blob = new Blob([allAdTagsHtml(selectedNet.id, tagProject || "APP-LOCAL01", (["banner", "mrec", "interstitial", "rewarded", "native"] as AdTagFormat[]))], { type: "text/html" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a"); a.href = url; a.download = `${selectedNet.id}-ad-tags.html`; a.click();
                          window.setTimeout(() => URL.revokeObjectURL(url), 20000);
                        }} className="rounded bg-lime px-1.5 py-0.5 text-[8px] font-bold text-limeink">Download all</button>
                      </div>
                    </div>
                    <pre className="max-h-[260px] overflow-auto p-2.5 font-mono text-[8px] leading-relaxed text-[#c9d1c2]">{tag?.html}</pre>
                  </div>
                );
              })()}
              <p className="mt-1.5 text-[8.5px] leading-relaxed text-muted">{adTagsFor(selectedNet.id, tagProject || "APP-LOCAL01", [tagFormat])[0]?.note} Har tag platform-managed App ID aur auto placement ID ke saath aata hai.</p>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className={cn("p-4", adsAllowed ? "border-emerald-500/25" : "border-amber-500/25")}>
              <div className="flex items-center gap-2">
                <div className={cn("grid h-8 w-8 place-items-center rounded-lg", adsAllowed ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500")}><Lock className="h-4 w-4" /></div>
                <div><div className="text-[11px] font-semibold text-ink">Your plan: {quota.plan.name}</div><div className="text-[9px] text-muted">{adsAllowed ? "Ad integration is enabled" : "Ad integration is locked"}</div></div>
              </div>
              <p className="mt-2 text-[9.5px] leading-relaxed text-muted">
                {adsAllowed ? "Configure credentials in the builder. Existing builds retain their project history if your subscription later expires." : "Free plan: app creation is allowed within quota, but ad credentials cannot be activated and ads are excluded from builds. Upgrade to enable."}
              </p>
              {!adsAllowed && <Link to={state.user ? "/app/plans" : "/register"} className={buttonClass("lime", "sm", "mt-2.5 w-full")}>Unlock ad integration</Link>}
            </Card>

            <Card className="p-4">
              <h2 className="text-[11.5px] font-semibold text-ink">Formats & timing</h2>
              <div className="mt-2 flex flex-wrap gap-1">{AD_FORMATS.map((f) => <span key={f} className="rounded border border-line bg-panel2 px-1.5 py-0.5 text-[8.5px] text-muted">{f}</span>)}</div>
              <div className="mt-3 text-[8.5px] font-semibold uppercase tracking-wider text-muted">Automatic timing</div>
              <div className="mt-1 flex flex-wrap gap-1">{AD_TIMINGS.map((t) => <span key={t} className="rounded bg-panel2 px-1.5 py-0.5 text-[8.5px] text-muted">{t}</span>)}</div>
              <p className="mt-2 text-[8.5px] leading-relaxed text-muted">Custom seconds, minutes or hours supported. Manual load and reload always available. Follow official placement and consent policies.</p>
            </Card>

            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-3 py-2">
                <div className="flex items-center gap-1.5"><Terminal className="h-3.5 w-3.5 text-muted" /><span className="text-[10.5px] font-semibold text-ink">Load ad request</span></div>
                <Badge tone={adResult?.mode === "live" ? "green" : "lime"}>{adResult?.mode === "live" ? "live mediation" : "test inventory"}</Badge>
              </div>
              <div className="space-y-2 p-3">
                <div className="grid grid-cols-2 gap-1.5">
                  <Select value={selectedNet.id} onChange={(e) => setSelected(e.target.value)} className="h-8 text-[10px]">
                    {NETWORKS.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                  </Select>
                  <Select value={adFormat} onChange={(e) => setAdFormat(e.target.value)} className="h-8 text-[10px]">
                    {AD_FORMATS.map((f) => <option key={f}>{f}</option>)}
                  </Select>
                </div>
                <Input value={adProject} onChange={(e) => setAdProject(e.target.value.toUpperCase())} placeholder="Project ID" className="h-8 font-mono text-[10px]" aria-label="Project ID for the ad request" />
                <Button
                  variant="lime"
                  size="sm"
                  className="w-full"
                  loading={adBusy}
                  onClick={async () => {
                    setAdError("");
                    setAdBusy(true);
                    const res = await requestAd({ network: selectedNet.id, format: adFormat, projectId: adProject || "APP-LOCAL01", appName: adProject || "U APP build" });
                    setAdResult(res);
                    setAdBusy(false);
                    if (!res.ok) setAdError(res.message);
                    else toast(res.message, "success");
                  }}
                >
                  <Play className="h-3 w-3" /> Send ad load request
                </Button>
                {adError && <p className="rounded border border-rose-500/25 bg-rose-500/5 px-2 py-1.5 text-[8.5px] leading-relaxed text-rose-500">{adError}</p>}
                {adResult && (
                  <div className="overflow-hidden rounded-lg border border-line bg-[#080a0d]">
                    <div className="flex items-center justify-between border-b border-white/8 px-2 py-1">
                      <span className="font-mono text-[7.5px] text-white/40">request → response · {adResult.latencyMs}ms</span>
                      <CopyButton text={JSON.stringify({ request: adResult.request, response: adResult.response }, null, 2)} />
                    </div>
                    <pre className="max-h-[220px] overflow-auto p-2 font-mono text-[8px] leading-relaxed text-[#c9d1c2]">{JSON.stringify({ request: adResult.request, response: adResult.response }, null, 2)}</pre>
                  </div>
                )}
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2">
                  <p className="text-[8px] leading-relaxed text-muted">
                    Request always uses the platform-managed App ID above — never a user-entered App ID. This is a real
                    request contract in official test-inventory mode. Add <span className="font-mono">VITE_UAPP_ADS_ENDPOINT</span> to
                    execute against live mediation, and <span className="font-mono">VITE_UAPP_AD_&lt;NETWORK&gt;_APPID</span> for production IDs.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h2 className="text-[11.5px] font-semibold text-ink">Error codes</h2>
              <div className="mt-1.5 space-y-1.5">
                {[["PLAN_REQUIRED", "No active plan for ad configuration."], ["PLAN_ADS_LOCKED", "Current plan forbids ads."], ["SDK_NOT_INITIALIZED", "Network consent/init incomplete."], ["NO_FILL", "No ad inventory returned."], ["NETWORK_ERROR", "Connectivity or SDK failure."], ["CONSENT_REQUIRED", "User consent must be captured first."]].map(([c, d]) => (
                  <div key={c} className="flex items-start gap-2"><code className="shrink-0 rounded bg-panel2 px-1 py-0.5 font-mono text-[7.5px] font-semibold text-rose-500">{c}</code><span className="text-[8px] leading-relaxed text-muted">{d}</span></div>
                ))}
              </div>
            </Card>

            <div className="flex items-start gap-2 rounded-xl border border-line bg-panel/50 p-3">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
              <p className="text-[8.5px] leading-relaxed text-muted">Ad operations shown are documentation contracts. Actual placement requires app credentials, a configured build runner and official SDK behaviour.</p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col items-start justify-between gap-2 rounded-xl border border-line bg-panel/50 px-4 py-3 sm:flex-row sm:items-center">
          <p className="text-[10px] text-muted">Questions about networks, placement policies or build errors?</p>
          <a href={`mailto:${SUPPORT_EMAIL}?subject=U%20APP%20Ad%20SDK%20help`} className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-ink hover:text-lime"><Mail className="h-3 w-3" /> {SUPPORT_EMAIL}</a>
        </div>
      </div>
    </div>
  );
}


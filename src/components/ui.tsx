import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Check, CheckCircle2, Info, Loader2, X } from "lucide-react";
import { cn } from "@/utils/cn";

/* ------------------------------------------------------------------ Brand */

export function Logo({ size = 34, withWord = true, className }: { size?: number; withWord?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className="relative inline-grid place-items-center overflow-hidden rounded-[10px] bg-[#0a0c0f] ring-1 ring-white/10"
        style={{ width: size, height: size, boxShadow: "inset 0 1px 0 rgba(255,255,255,.14)" }}
      >
        <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_0%,rgba(201,246,91,.35),transparent_60%)]" />
        <svg viewBox="0 0 32 32" width={size * 0.62} height={size * 0.62} fill="none" aria-hidden="true">
          <path d="M8 6v10a8 8 0 0 0 16 0V6" stroke="#c9f65b" strokeWidth="4" strokeLinecap="round" />
          <circle cx="24" cy="7" r="2.2" fill="#c9f65b" />
        </svg>
      </span>
      {withWord && (
        <span className="font-display text-[17px] font-bold tracking-[-0.04em] text-ink">
          U<span className="text-muted">APP</span>
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ Buttons */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "lime";
type Size = "sm" | "md" | "lg";

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 focus-ring disabled:cursor-not-allowed disabled:opacity-45 select-none whitespace-nowrap";
  const sizes: Record<Size, string> = {
    sm: "h-9 px-3.5 text-[12.5px]",
    md: "h-11 px-5 text-[13.5px]",
    lg: "h-12 px-6 text-sm",
  };
  const variants: Record<Variant, string> = {
    primary:
      "bg-ink text-bg hover:opacity-88 active:scale-[0.985] shadow-[0_10px_30px_-12px_rgba(0,0,0,.45)]",
    lime: "bg-lime text-limeink hover:brightness-[1.06] active:scale-[0.985] shadow-[0_14px_40px_-16px_rgba(201,246,91,.8)]",
    secondary: "bg-panel text-ink border border-line hover:bg-panel2 active:scale-[0.985]",
    ghost: "text-muted hover:text-ink hover:bg-panel2",
    danger: "bg-rose-500/10 text-rose-500 border border-rose-500/25 hover:bg-rose-500/15",
  };
  return cn(base, sizes[size], variants[variant], extra);
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button className={buttonClass(variant, size, className)} disabled={rest.disabled || loading} {...rest}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ Surfaces */

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("card", className)} {...rest}>
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "lime" | "violet" | "amber" | "rose" | "sky" | "green";
  className?: string;
}) {
  const tones = {
    neutral: "border-line bg-panel2 text-muted",
    lime: "border-lime/30 bg-lime/10 text-limeink dark:text-lime",
    violet: "border-lilac/30 bg-lilac/10 text-violet-700 dark:text-lilac",
    amber: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    rose: "border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-300",
    sky: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    green: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.09em]",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted", className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-lime" />
      {children}
    </div>
  );
}

export function Progress({ value, className, tone = "lime" }: { value: number; className?: string; tone?: "lime" | "violet" | "rose" }) {
  const colors = { lime: "bg-lime", violet: "bg-lilac", rose: "bg-rose-400" };
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-panel2", className)}>
      <div className={cn("h-full rounded-full transition-all duration-700", colors[tone])} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function Ring({ value, size = 120, label, sub }: { value: number; size?: number; label?: string; sub?: string }) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#c9f65b"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (Math.min(100, Math.max(0, value)) / 100) * c}
          style={{ transition: "stroke-dashoffset .8s cubic-bezier(.22,1,.36,1)" }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="font-display text-2xl font-bold text-ink">{label}</div>
        {sub && <div className="mt-0.5 text-[10px] font-medium uppercase tracking-widest text-muted">{sub}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Forms */

export function Field({
  label,
  hint,
  error,
  children,
  optional,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  optional?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between gap-3 text-[12px] font-semibold text-ink">
        {label}
        {optional && <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted">Optional</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1.5 block text-[11.5px] leading-relaxed text-muted">{hint}</span>}
      {error && <span className="mt-1.5 flex items-center gap-1 text-[11.5px] font-medium text-rose-500"><AlertCircle className="h-3 w-3" />{error}</span>}
    </label>
  );
}

const inputBase =
  "w-full rounded-xl border border-line bg-panel2/60 px-3.5 text-[13.5px] text-ink placeholder:text-muted/65 outline-none transition focus:border-lime/60 focus:bg-panel focus:ring-2 focus:ring-lime/15";

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> }) {
  return <input className={cn(inputBase, "h-11", className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputBase, "min-h-28 py-3 leading-relaxed", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputBase, "h-11 appearance-none pr-9", className)} {...rest}>
      {children}
    </select>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full border transition-colors focus-ring",
        checked ? "border-lime/50 bg-lime/90" : "border-line bg-panel2"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-4.5 w-4.5 rounded-full shadow transition-all",
          checked ? "left-[22px] bg-[#111605]" : "left-0.5 bg-muted/70"
        )}
        style={{ height: 18, width: 18 }}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ Modal */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div
        className={cn(
          "animate-rise max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-panel shadow-2xl sm:rounded-3xl",
          wide ? "sm:max-w-3xl" : "sm:max-w-lg"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-panel/95 px-5 py-4 backdrop-blur sm:px-6">
          <div>
            <h3 className="font-display text-[17px] font-semibold text-ink">{title}</h3>
            {subtitle && <p className="mt-1 text-[12px] leading-relaxed text-muted">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted transition hover:bg-panel2 hover:text-ink" aria-label="Close dialog">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 sm:p-6">{children}</div>
      </div>
    </div>,
    document.body
  );
}

/* ------------------------------------------------------------------ Toasts */

type Toast = { id: number; message: string; tone: "success" | "error" | "info" };
type ToastCtx = { toast: (message: string, tone?: Toast["tone"]) => void };
const ToastContext = createContext<ToastCtx>({ toast: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4600);
  }, []);
  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-[120] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="animate-rise pointer-events-auto flex items-start gap-2.5 rounded-xl border border-line bg-panel/95 px-3.5 py-3 text-[12.5px] font-medium text-ink shadow-xl backdrop-blur"
            >
              {t.tone === "success" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              ) : t.tone === "error" ? (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
              ) : (
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
              )}
              <span className="leading-relaxed">{t.message}</span>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

/* ------------------------------------------------------------------ Misc */

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-panel px-2 py-1 text-[10.5px] font-semibold text-muted transition hover:text-ink"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          window.setTimeout(() => setDone(false), 1600);
        } catch {
          setDone(false);
        }
      }}
    >
      {done ? <Check className="h-3 w-3 text-emerald-500" /> : null}
      {done ? "Copied" : label}
    </button>
  );
}

export function Empty({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-14 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-panel2 text-muted">{icon}</div>
      <h4 className="font-display text-[15px] font-semibold text-ink">{title}</h4>
      <p className="mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-muted">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

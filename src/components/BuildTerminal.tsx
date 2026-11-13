import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, Download, Loader2, RefreshCw, Terminal, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/utils/cn";

/**
 * Global live build terminal. Stays mounted for the whole workspace so a build
 * started on the create page keeps streaming while the user navigates.
 */
export function BuildTerminal() {
  const { state } = useStore();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const builds = useMemo(
    () => state.apps.filter((a) => a.buildStatus === "building" || a.buildStatus === "queued").slice(0, 4),
    [state.apps]
  );
  const active = builds[0];
  const recent = state.apps[0];

  useEffect(() => {
    if (builds.length > 0) {
      setOpen(true);
      setDismissed(false);
    }
  }, [builds.length]);

  if (!state.user) return null;
  if (!active && dismissed) return null;
  if (!active && !recent) return null;
  if (location.pathname.endsWith("/download")) return null;

  const target = active ?? recent;
  const started = target.buildStartedAt ? new Date(target.buildStartedAt).getTime() : Date.now();
  const elapsed = Math.max(0, Date.now() - started);
  const fmt = (ms: number) => `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
  const logs = target.buildLog?.length ? target.buildLog : ["Waiting for the build to start…"];
  const building = target.buildStatus === "building" || target.buildStatus === "queued";

  if (building && !open) {
    return (
      <button
        onClick={() => { setOpen(true); setDismissed(false); }}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[11px] font-semibold text-bg shadow-2xl"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin text-lime" /> Building {target.name} · {fmt(elapsed)}
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 right-0 z-50 w-full px-2 pb-2 sm:bottom-3 sm:right-3 sm:w-[420px] sm:px-0 sm:pb-0">
      <div className="overflow-hidden rounded-t-xl border border-line bg-[#080a0d] shadow-2xl sm:rounded-xl">
        <div className="flex items-center gap-2 border-b border-white/8 px-3 py-2">
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", building ? "animate-pulse-dot bg-lime" : target.buildStatus === "ready" ? "bg-emerald-400" : "bg-amber-400")} />
          <Terminal className="h-3 w-3 text-white/50" />
          <button onClick={() => setOpen((o) => !o)} className="min-w-0 flex-1 text-left">
            <div className="truncate text-[10.5px] font-semibold text-[#eef2e8]">{building ? `Building ${target.name}` : `${target.name} · ${target.buildStatus}`}</div>
            <div className="truncate font-mono text-[8px] text-white/35">{target.id} · {building ? `${fmt(elapsed)} elapsed` : target.buildError ? "completed with note" : "build finished"} · {builds.length > 0 ? `${builds.length} active` : "live log"}</div>
          </button>
          <Link to={`/app/apps/${target.id}/download`} className="rounded bg-lime/15 p-1 text-lime" aria-label="Downloads"><Download className="h-3 w-3" /></Link>
          <button onClick={() => { setOpen(false); setDismissed(true); }} className="rounded p-1 text-white/40 hover:text-white" aria-label="Close terminal"><X className="h-3 w-3" /></button>
          <button onClick={() => setOpen((o) => !o)} className="rounded p-1 text-white/40 hover:text-white" aria-label="Toggle terminal"><ChevronDown className={cn("h-3 w-3 transition", open && "rotate-180")} /></button>
        </div>
        {open && (
          <div className="max-h-[210px] overflow-auto p-2.5 font-mono text-[8.5px] leading-[1.85]">
            {logs.slice(-40).map((line, i) => (
              <div key={i} className="flex gap-2">
                <span className="shrink-0 text-white/20">{String(i + 1).padStart(2, "0")}</span>
                <span className={/error|fail|note|timeout/i.test(line) ? "text-amber-300" : /ready|complete|success|generated|pushed|created/i.test(line) ? "text-lime" : "text-[#b9c2b0]"}>{line}</span>
              </div>
            ))}
            {building && <div className="mt-1 flex items-center gap-2 text-white/35"><Loader2 className="h-2.5 w-2.5 animate-spin" /> waiting for the next build event…</div>}
            {!building && target.buildStatus === "ready" && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Link to={`/app/apps/${target.id}/download`} className="rounded bg-lime px-2 py-1 text-[8px] font-bold text-limeink">Download / install</Link>
                <Link to={`/app/apps/${target.id}`} className="rounded border border-white/15 px-2 py-1 text-[8px] font-semibold text-white/70">Project details</Link>
              </div>
            )}
          </div>
        )}
        <div className="flex items-center justify-between border-t border-white/8 px-3 py-1.5">
          <span className="flex items-center gap-1 font-mono text-[7.5px] text-white/30">
            <RefreshCw className={cn("h-2 w-2", building && "animate-spin")} /> {tick % 2 === 0 ? "live" : "stream"} · {state.user.uid.slice(0, 8)}
          </span>
          <Link to="/app/apps" className="text-[8px] font-semibold text-white/45 hover:text-white">My apps</Link>
        </div>
      </div>
    </div>
  );
}

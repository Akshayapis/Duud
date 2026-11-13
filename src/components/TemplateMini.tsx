import { Bell, Bookmark, Compass, Home, LayoutGrid, Play, Search, Settings, User } from "lucide-react";
import type { Template } from "@/data/catalog";
import { cn } from "@/utils/cn";

export function TemplateMini({
  template,
  className,
  compact,
  showChrome = true,
}: {
  template: Template;
  className?: string;
  compact?: boolean;
  showChrome?: boolean;
}) {
  const { accent, bg, panel, mode, layout } = template;
  const isLight = mode === "light" || mode === "minimal";
  const line = isLight ? "rgba(0,0,0,.08)" : "rgba(255,255,255,.09)";
  const text = isLight ? "#141712" : "#f4f6ef";
  const muted = isLight ? "#7a8177" : "#959caa";
  const pad = compact ? 8 : 11;

  const bars = (n: number, h = 5) => (
    <div className="flex flex-col gap-1">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} style={{ height: h, width: `${90 - i * 15}%`, background: line, borderRadius: 999 }} />
      ))}
    </div>
  );

  const header = (
    <div className="flex items-center justify-between" style={{ padding: `${pad}px ${pad}px ${pad - 2}px` }}>
      <div>
        <div style={{ width: compact ? 42 : 58, height: 6, borderRadius: 99, background: accent }} />
        <div style={{ width: compact ? 30 : 42, height: 3, borderRadius: 99, background: muted, opacity: 0.55, marginTop: 5 }} />
      </div>
      <div className="flex gap-1.5">
        <div className="grid place-items-center rounded-full" style={{ width: compact ? 15 : 19, height: compact ? 15 : 19, background: panel, border: `1px solid ${line}` }}>
          <Search size={compact ? 7 : 9} color={muted} />
        </div>
        <div className="grid place-items-center rounded-full" style={{ width: compact ? 15 : 19, height: compact ? 15 : 19, background: panel, border: `1px solid ${line}` }}>
          <Bell size={compact ? 7 : 9} color={muted} />
        </div>
      </div>
    </div>
  );

  const hero = (
    <div style={{ margin: `0 ${pad}px`, borderRadius: layout === "full" ? 2 : compact ? 8 : 12, overflow: "hidden", position: "relative", background: `linear-gradient(135deg, ${accent}26, ${panel})`, border: `1px solid ${line}`, padding: compact ? 8 : 12, minHeight: compact ? 47 : 64 }}>
      <div style={{ width: "66%", height: compact ? 6 : 8, borderRadius: 99, background: text, opacity: 0.9 }} />
      <div style={{ width: "44%", height: compact ? 6 : 8, borderRadius: 99, background: accent, marginTop: 4 }} />
      <div className="mt-1.5 flex gap-1">
        <div style={{ width: compact ? 26 : 36, height: compact ? 9 : 12, borderRadius: 5, background: accent }} />
        <div style={{ width: compact ? 20 : 28, height: compact ? 9 : 12, borderRadius: 5, border: `1px solid ${line}` }} />
      </div>
      <div style={{ position: "absolute", right: 8, top: 8, width: compact ? 22 : 32, height: compact ? 34 : 48, borderRadius: 6, background: `linear-gradient(160deg, ${accent}bb, ${accent}22)`, transform: "rotate(8deg)", opacity: 0.9 }} />
    </div>
  );

  const cardGrid = (
    <div className="grid grid-cols-2 gap-1.5" style={{ padding: `0 ${pad}px`, marginTop: 7 }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ borderRadius: compact ? 6 : 9, background: panel, border: `1px solid ${line}`, padding: compact ? 5 : 7 }}>
          <div style={{ height: compact ? 16 : 22, borderRadius: 4, background: i === 0 ? `${accent}44` : line }} />
          <div style={{ height: 3, width: "70%", borderRadius: 99, background: text, opacity: 0.65, marginTop: 5 }} />
          <div style={{ height: 3, width: "45%", borderRadius: 99, background: muted, opacity: 0.4, marginTop: 3 }} />
        </div>
      ))}
    </div>
  );

  const list = (
    <div className="flex flex-col" style={{ padding: `0 ${pad}px`, marginTop: 7, gap: 5 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-2" style={{ borderRadius: compact ? 6 : 8, background: panel, border: `1px solid ${line}`, padding: compact ? 5 : 7 }}>
          <div style={{ width: compact ? 16 : 21, height: compact ? 16 : 21, borderRadius: 5, background: i === 0 ? `${accent}55` : line, flexShrink: 0 }} />
          <div className="flex-1">{bars(2, 3)}</div>
          <div style={{ width: compact ? 13 : 17, height: compact ? 9 : 12, borderRadius: 4, background: i === 0 ? accent : "transparent", border: i === 0 ? "none" : `1px solid ${line}` }} />
        </div>
      ))}
    </div>
  );

  const bottomNav = (
    <div className="flex items-center justify-around" style={{ marginTop: "auto", background: panel, borderTop: `1px solid ${line}`, padding: `${compact ? 5 : 7}px ${pad}px` }}>
      {[Home, Compass, LayoutGrid, User].map((Ico, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5">
          <Ico size={compact ? 8 : 10} color={i === 0 ? accent : muted} />
          <div style={{ width: 7, height: 2, borderRadius: 99, background: i === 0 ? accent : "transparent" }} />
        </div>
      ))}
    </div>
  );

  const floatingNav = (
    <div style={{ margin: "auto 10px 8px", background: isLight ? "#141712" : panel, border: `1px solid ${line}`, borderRadius: 99, padding: compact ? 4 : 5, display: "flex", justifyContent: "space-around", boxShadow: "0 8px 20px rgba(0,0,0,.25)" }}>
      {[Home, Compass, Play, User].map((Ico, i) => (
        <div key={i} className="grid place-items-center rounded-full" style={{ width: compact ? 13 : 17, height: compact ? 13 : 17, background: i === 2 ? accent : "transparent" }}>
          <Ico size={compact ? 7 : 9} color={i === 2 ? (isLight ? "#0c0f0a" : "#131a04") : isLight ? "#f5f5f0" : muted} />
        </div>
      ))}
    </div>
  );

  const topNav = (
    <div className="flex items-center justify-between" style={{ padding: `0 ${pad}px 6px`, marginTop: 2 }}>
      <div className="flex gap-1.5">
        {["Home", "Explore", "Saved"].map((s, i) => (
          <span key={s} style={{ fontSize: compact ? 4.5 : 5.5, color: i === 0 ? text : muted, fontWeight: 600, borderBottom: i === 0 ? `1.5px solid ${accent}` : "1.5px solid transparent", paddingBottom: 2 }}>{s}</span>
        ))}
      </div>
      <Bookmark size={compact ? 7 : 9} color={muted} />
    </div>
  );

  return (
    <div
      className={cn("relative flex flex-col overflow-hidden", className)}
      style={{ background: bg, borderRadius: 14, border: `1px solid ${line}`, minHeight: 150 }}
    >
      {showChrome && (
        <div className="flex items-center justify-between px-2" style={{ paddingTop: compact ? 4 : 6, paddingBottom: 2 }}>
          <span style={{ fontSize: compact ? 4.5 : 5.5, color: muted, fontFamily: "monospace" }}>9:41</span>
          <div className="flex items-center gap-1">
            <span style={{ width: compact ? 8 : 11, height: 3, borderRadius: 2, background: muted, opacity: 0.5 }} />
            <span style={{ width: compact ? 4 : 6, height: compact ? 4 : 6, borderRadius: 99, background: muted, opacity: 0.5 }} />
          </div>
        </div>
      )}

      {layout === "side" ? (
        <div className="flex flex-1" style={{ minHeight: 0 }}>
          <div className="flex flex-col items-center gap-2 py-2" style={{ width: compact ? 22 : 30, background: panel, borderRight: `1px solid ${line}` }}>
            <span style={{ width: compact ? 9 : 11, height: compact ? 9 : 11, borderRadius: 4, background: accent }} />
            {[Home, Compass, LayoutGrid, Settings].map((Ico, i) => (
              <Ico key={i} size={compact ? 7 : 9} color={i === 0 ? accent : muted} />
            ))}
          </div>
          <div className="flex flex-1 flex-col pb-2" style={{ minWidth: 0 }}>
            {header}
            {hero}
            {list}
          </div>
        </div>
      ) : (
        <>
          {header}
          {layout === "top" && topNav}
          {hero}
          {layout === "grid" ? cardGrid : list}
          {layout === "full" ? (
            <div style={{ padding: `0 ${pad}px`, marginTop: 6, marginBottom: 6 }}>
              <div style={{ height: compact ? 18 : 24, borderRadius: 7, background: `linear-gradient(90deg, ${accent}88, ${accent}22)`, border: `1px solid ${line}` }} />
            </div>
          ) : null}
          {layout === "floating" && floatingNav}
        </>
      )}
      {(layout === "bottom" || layout === "grid" || layout === "top" || layout === "full" || layout === "side") && <div style={{ marginTop: "auto" }}>{bottomNav}</div>}
    </div>
  );
}

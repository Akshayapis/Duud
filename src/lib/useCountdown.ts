import { useEffect, useState } from "react";

export function useCountdown(expiresAt?: number): number {
  const calc = () => (expiresAt ? Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)) : 0);
  const [seconds, setSeconds] = useState(calc);

  useEffect(() => {
    setSeconds(calc());
    const id = window.setInterval(() => setSeconds(calc()), 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt]);

  return seconds;
}

export function mmss(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

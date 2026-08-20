"use client";

import { useEffect, useState } from "react";

const VISITOR_KEY = "preto-no-branco:presence-id";

export type LivePlayersCount = { current: number; total: number };

function anonymousId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function visitorId() {
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const next = anonymousId();
    window.localStorage.setItem(VISITOR_KEY, next);
    return next;
  } catch { return anonymousId(); }
}

/** O número só existe quando o Redis responde. Ninguém precisa se identificar. */
export function useLivePlayers() {
  const [players, setPlayers] = useState<LivePlayersCount>();
  useEffect(() => {
    let alive = true;
    const id = visitorId();
    const beat = async () => {
      try {
        const response = await fetch("/api/presence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visitor: id }), cache: "no-store" });
        const data = await response.json() as { available?: boolean; current?: number; total?: number };
        if (alive && data.available && typeof data.current === "number" && typeof data.total === "number" && Number.isInteger(data.current) && Number.isInteger(data.total)) setPlayers({ current: data.current, total: data.total });
      } catch { /* presença é complementar; a home não depende dela */ }
    };
    const leave = () => {
      const payload = JSON.stringify({ visitor: id, leaving: true });
      if (navigator.sendBeacon) navigator.sendBeacon("/api/presence", new Blob([payload], { type: "application/json" }));
      else void fetch("/api/presence", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(() => undefined);
    };
    void beat();
    const interval = window.setInterval(() => void beat(), 30_000);
    window.addEventListener("pagehide", leave);
    return () => { alive = false; window.clearInterval(interval); window.removeEventListener("pagehide", leave); };
  }, []);
  return players;
}

export function LivePlayers({ players }: { players?: LivePlayersCount }) {
  if (!players) return null;
  return <p className="live-players" role="status">
    <i aria-hidden="true"/>
    <span>{players.current === 1 ? "1 pessoa jogando agora" : `${players.current} pessoas jogando agora`}</span>
  </p>;
}

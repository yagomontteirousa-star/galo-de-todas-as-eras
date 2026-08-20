"use client";

import { useEffect, useRef, useState } from "react";

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
export function useLivePlayers(isPlaying: boolean) {
  const [players, setPlayers] = useState<LivePlayersCount>();
  const visitor = useRef<string | null>(null);
  useEffect(() => {
    let alive = true;
    const beat = async () => {
      try {
        if (!isPlaying) {
          const response = await fetch("/api/presence", { cache: "no-store" });
          const data = await response.json() as { available?: boolean; current?: number; total?: number };
          if (alive && data.available && typeof data.current === "number" && typeof data.total === "number" && Number.isInteger(data.current) && Number.isInteger(data.total)) setPlayers({ current: data.current, total: data.total });
          return;
        }
        const id = visitor.current ?? visitorId();
        visitor.current = id;
        const response = await fetch("/api/presence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visitor: id }), cache: "no-store" });
        const data = await response.json() as { available?: boolean; current?: number; total?: number };
        if (alive && data.available && typeof data.current === "number" && typeof data.total === "number" && Number.isInteger(data.current) && Number.isInteger(data.total)) setPlayers({ current: data.current, total: data.total });
      } catch { /* presença é complementar; a home não depende dela */ }
    };
    void beat();
    const interval = window.setInterval(() => void beat(), 30_000);
    return () => { alive = false; window.clearInterval(interval); };
  }, [isPlaying]);
  return players;
}

export function LivePlayers({ players }: { players?: LivePlayersCount }) {
  if (!players) return null;
  return <p className="live-players" role="status">
    <i aria-hidden="true"/>
    <span>{players.current === 1 ? "1 pessoa jogando agora" : `${players.current} pessoas jogando agora`}</span>
    {players.total > 0 && <small>{players.total === 1 ? "1 pessoa já entrou em campo" : `${players.total} pessoas já entraram em campo`}</small>}
  </p>;
}

"use client";

import { useEffect, useRef, useState } from "react";

const VISITOR_KEY = "preto-no-branco:presence-id";

function visitorId() {
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const next = crypto.randomUUID();
    window.localStorage.setItem(VISITOR_KEY, next);
    return next;
  } catch { return crypto.randomUUID(); }
}

/** Não há número de enfeite: se a presença não responder, o balão não aparece. */
export function useLivePlayers() {
  const [count, setCount] = useState<number>();
  const visitor = useRef<string | null>(null);
  useEffect(() => {
    let alive = true;
    const beat = async () => {
      try {
        const id = visitor.current ?? visitorId();
        visitor.current = id;
        const response = await fetch("/api/presence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visitor: id }), cache: "no-store" });
        const data = await response.json() as { available?: boolean; count?: number };
        if (alive && data.available && Number.isInteger(data.count)) setCount(data.count);
      } catch { /* presença é complementar; a home não depende dela */ }
    };
    void beat();
    const interval = window.setInterval(() => void beat(), 30_000);
    return () => { alive = false; window.clearInterval(interval); };
  }, []);
  return count;
}

export function LivePlayers({ count }: { count?: number }) {
  if (count === undefined) return null;
  return <p className="live-players" role="status"><i aria-hidden="true"/>{count === 1 ? "1 pessoa jogando agora" : `${count} pessoas jogando agora`}</p>;
}

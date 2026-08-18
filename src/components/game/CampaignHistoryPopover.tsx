"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { roundLabels } from "@/lib/bracket";
import type { CampaignRecord } from "@/types/game";
import { CloseIcon } from "@/components/ui/Icons";

const shortDate = (value: string) => new Date(value).toLocaleDateString("pt-BR", {
  day: "2-digit", month: "2-digit", year: "2-digit",
});

function resultLabel(record: CampaignRecord) {
  if (record.outcome === "champion") return "Campeão";
  if (record.snapshot?.runnerUp) return "Vice-campeão";
  if (record.roundReached === "semifinal") return "Semifinalista";
  return `Eliminado nas ${roundLabels[record.roundReached].toLowerCase()}`;
}

export function CampaignHistoryPopover({ history, onReview, onStart }: {
  history: CampaignRecord[];
  onReview: (record: CampaignRecord) => void;
  onStart: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const panelId = useId();

  const placePanel = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const edge = 12;
    if (window.innerWidth <= 640) {
      setPosition({ top: 70, left: edge, width: window.innerWidth - edge * 2, maxHeight: window.innerHeight - 82 });
      return;
    }
    const width = Math.min(680, window.innerWidth - edge * 2);
    const maxHeight = Math.min(560, window.innerHeight - edge * 2);
    const roomBelow = window.innerHeight - rect.bottom - edge;
    const roomAbove = rect.top - edge;
    const left = Math.max(edge, Math.min(rect.left, window.innerWidth - width - edge));
    if (roomBelow >= Math.min(360, maxHeight) || roomBelow >= roomAbove) {
      setPosition({ top: rect.bottom + 8, left, width, maxHeight: Math.max(240, Math.min(maxHeight, roomBelow - 8)) });
    } else {
      setPosition({ bottom: window.innerHeight - rect.top + 8, left, width, maxHeight: Math.max(240, Math.min(maxHeight, roomAbove - 8)) });
    }
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const close = () => setOpen(false);
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !trigger?.contains(target)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", placePanel);
    window.addEventListener("scroll", placePanel, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", placePanel);
      window.removeEventListener("scroll", placePanel, true);
      trigger?.focus();
    };
  }, [open, placePanel]);

  const act = (action: () => void) => {
    setOpen(false);
    action();
  };

  const toggle = () => {
    if (!open) placePanel();
    setOpen((value) => !value);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="home-archive-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
      >
        <span>Histórico de campanhas</span>
        <b>{history.length} {history.length === 1 ? "registro" : "registros"}</b>
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <section
          ref={panelRef}
          className="history-popover"
          id={panelId}
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          style={position}
        >
          <header className="history-popover__head">
            <div><span>Arquivo recente</span><h2 id={titleId}>Histórico de campanhas</h2></div>
            <button ref={closeRef} type="button" aria-label="Fechar histórico" onClick={() => setOpen(false)}><CloseIcon/></button>
          </header>
          <ul className="home-history" aria-label="Campanhas anteriores">
            {history.map((record) => (
              <li key={record.id} className={record.outcome === "champion" ? "is-champion" : ""}>
                <div className="home-history__title">
                  <b>{resultLabel(record)}</b>
                  <time dateTime={record.finishedAt}>{shortDate(record.finishedAt)}</time>
                </div>
                <dl>
                  {record.lastScore && <div><dt>Placar</dt><dd>{record.lastScore}</dd></div>}
                  {record.lastOpponent && <div><dt>Contra</dt><dd>{record.lastOpponent}</dd></div>}
                  <div><dt>Vitórias</dt><dd>{record.wins}</dd></div>
                  {record.overall !== undefined && <div><dt>Overall</dt><dd>{record.overall}</dd></div>}
                </dl>
                <div className="home-history__actions">
                  <button type="button" disabled={!record.snapshot} title={record.snapshot ? undefined : "Resumo completo indisponível neste registro antigo"}
                    onClick={() => act(() => onReview(record))}>Ver campanha</button>
                  <button type="button" onClick={() => act(onStart)}>Começar nova campanha</button>
                </div>
              </li>
            ))}
          </ul>
        </section>,
        document.body,
      )}
    </>
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { roundLabels } from "@/lib/bracket";
import type { SharedCampaign, SharedMatch } from "@/lib/share";
import { CloseIcon } from "@/components/ui/Icons";

const pensLabel = (match: SharedMatch) =>
  match.pens ? ` (${match.pens.user} a ${match.pens.rival} nos pênaltis)` : "";

export function CampaignDetailsDialog({ data }: { data: SharedCampaign }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const highlighted = new Set(
    [...data.squad]
      .sort((left, right) => right.overall - left.overall)
      .slice(0, 4)
      .map((player) => `${player.slot}-${player.name}`),
  );

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => !element.hasAttribute("hidden"));
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        className="report-details-trigger"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(true)}
      >
        Jogos e elenco
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          className="campaign-details-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={panelRef}
            className="campaign-details-panel"
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
          >
            <header className="campaign-details-head">
              <div>
                <span>Arquivo da campanha</span>
                <h2 id={titleId}>Jogos e elenco</h2>
              </div>
              <button ref={closeRef} className="campaign-details-close" type="button" aria-label="Fechar jogos e elenco" onClick={() => setOpen(false)}>
                <CloseIcon/>
              </button>
            </header>

            <div className="campaign-details-body">
              <section className="report-block">
                <h2>O onze completo</h2>
                <ul className="report-squad">
                  {data.squad.map((player) => (
                    <li key={`${player.slot}-${player.name}`}
                      className={`${highlighted.has(`${player.slot}-${player.name}`) ? "is-top" : ""} ${player.special ? "is-special" : ""}`}>
                      <em>{player.slot}</em>
                      <b>{player.name}</b>
                      <small>{player.season}</small>
                      <strong>{player.overall}</strong>
                    </li>
                  ))}
                  {!data.squad.length && <li><b>Escalação não registrada.</b></li>}
                </ul>
              </section>

              <section className="report-block">
                <h2>A campanha</h2>
                <ul className="report-runs">
                  {data.matches.map((match, matchIndex) => (
                    <li key={`${match.round}-${match.rivalName}-${matchIndex}`} className={match.won ? "is-win" : "is-loss"}>
                      <em>{roundLabels[match.round]}</em>
                      <b>{match.user} a {match.rival}</b>
                      <span>{match.rivalName} {match.rivalYear}{pensLabel(match)}</span>
                      {match.goals.length > 0 && (
                        <ul className="report-scorers">
                          {match.goals.map((goal, index) => (
                            <li key={`${goal.name}-${goal.minute}-${index}`} className={goal.forUser ? "is-user" : ""}>
                              <time>{goal.minute}′</time>{goal.name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                  {!data.matches.length && <li><span>Nenhum jogo disputado.</span></li>}
                </ul>
              </section>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

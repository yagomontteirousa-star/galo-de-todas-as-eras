"use client";

import { useId, useState } from "react";
import { roundLabels } from "@/lib/bracket";
import { rivalRosterFromShared } from "@/lib/rival-roster";
import type { SharedCampaign, SharedMatch } from "@/lib/share";
import { RivalSquadDisclosure } from "@/components/game/RivalSquadDisclosure";

const pensLabel = (match: SharedMatch) =>
  match.pens ? ` (${match.pens.user} a ${match.pens.rival} nos pênaltis)` : "";

/** Detalhes pertencem ao documento: abrem no fluxo, sem portal, backdrop ou bloqueio. */
export function CampaignDetailsDialog({ data }: { data: SharedCampaign }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const highlighted = new Set(
    [...data.squad]
      .sort((left, right) => right.overall - left.overall)
      .slice(0, 4)
      .map((player) => `${player.slot}-${player.name}`),
  );

  return (
    <section className={`campaign-details-inline ${open ? "is-open" : ""}`}>
      <button
        className="report-details-trigger"
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Fechar jogos e elenco" : "Jogos e elenco"}
      </button>

      <div className="campaign-details-expansion" id={panelId} aria-hidden={!open} inert={!open}>
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

          {data.bench?.length ? <section className="report-block">
            <h2>Banco da campanha</h2>
            <ul className="report-squad">
              {data.bench.map((player) => (
                <li key={`${player.name}-${player.season}`}>
                  <em>RES</em><b>{player.name}</b><small>{player.season}</small><strong>{player.overall}</strong>
                </li>
              ))}
            </ul>
          </section> : null}

          <section className="report-block">
            <h2>Jogos da campanha</h2>
            <ul className="report-runs">
              {data.matches.map((match, matchIndex) => {
                const rival = rivalRosterFromShared(match);
                return (
                  <li key={`${match.round}-${match.rivalName}-${matchIndex}`} className={match.won ? "is-win" : "is-loss"}>
                    <em>{roundLabels[match.round]}</em>
                    <b>{match.user} a {match.rival}</b>
                    <span>{match.rivalName} {match.rivalYear}{pensLabel(match)}</span>
                    {match.goals.length > 0 && (
                      <ul className="report-scorers">
                        {match.goals.map((goal, index) => (
                          <li key={`${goal.name}-${goal.minute}-${index}`} className={goal.forUser ? "is-user" : ""}>
                            <time>{goal.minute}′</time>{goal.name}{goal.assist ? <small>Assistência: {goal.assist}</small> : null}
                          </li>
                        ))}
                      </ul>
                    )}
                    {rival && <RivalSquadDisclosure rival={rival} className="rival-roster--report"/>}
                  </li>
                );
              })}
              {!data.matches.length && <li><span>Nenhum jogo disputado.</span></li>}
            </ul>
          </section>
        </div>
      </div>
    </section>
  );
}

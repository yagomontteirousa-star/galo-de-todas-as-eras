import { roundLabels } from "@/lib/bracket";
import { eliminator, type SharedCampaign, type SharedMatch } from "@/lib/share";
import { tacticLabels } from "@/data/formations";
import type { CSSProperties } from "react";
import { BrandMark } from "@/components/ui/Brand";
import { CampaignDetailsDialog } from "@/components/game/CampaignDetailsDialog";

/**
 * A arte da campanha. A tela final e a página pública do link renderizam este mesmo
 * componente a partir do mesmo retrato, então o que a pessoa compartilha é o que ela viu.
 */
/** A frase dos pênaltis é remontada aqui: no link viajam só os dois números. */
const pensLabel = (match: SharedMatch) =>
  match.pens ? ` (${match.pens.user} a ${match.pens.rival} nos pênaltis)` : "";

export function CampaignArt({ data, children }: { data: SharedCampaign; children?: React.ReactNode }) {
  const champion = data.outcome === "champion";
  const phase = champion ? "Campeão" : data.runnerUp ? "Vice-campeão"
    : data.round === "semifinal" ? "Semifinalista" : roundLabels[data.round];
  const last = eliminator(data) ?? data.matches.at(-1);
  const best = [...data.squad].sort((left, right) => right.overall - left.overall).slice(0, 4);
  const topRating = best[0]?.overall ?? 99;

  return (
    <>
      <header className="report-head">
        <BrandMark size={44}/>
        <div className="report-title">
          <span className="report-eyebrow">{champion ? "Campeão" : data.runnerUp ? "Vice-campeão" : "Fim de campanha"}</span>
          <h1>{champion ? "A taça é do Galo." : data.runnerUp ? "Faltou o último passo." : "O arquivo fecha aqui."}</h1>
        </div>
        <div className="report-summary-rail">
          {last && (
            <div className="report-final">
              <small>{roundLabels[last.round]}</small>
              <b>{last.user}<i>×</i>{last.rival}</b>
              <span>{last.rivalName} {last.rivalYear}{pensLabel(last)}</span>
            </div>
          )}
          <CampaignDetailsDialog data={data}/>
        </div>
      </header>

      <dl className="report-facts">
        <div className="is-wide"><dt>Fase</dt><dd className="is-text">{phase}</dd></div>
        <div><dt>Vitórias</dt><dd>{data.wins}</dd></div>
        <div><dt>Overall</dt><dd>{data.overall}</dd></div>
        <div><dt>Formação</dt><dd>{data.formation}</dd></div>
        <div className="is-wide"><dt>Perfil</dt><dd className="is-text">{tacticLabels[data.tactic].name}</dd></div>
      </dl>

      <div className="report-primary">
        <section className="report-block report-block--stars">
          <h2>Destaques da campanha</h2>
          <ul className="report-stars">
            {best.map((player) => (
              <li key={`${player.slot}-${player.name}`} style={{ "--force": `${Math.round((player.overall / topRating) * 100)}%` } as CSSProperties}>
                <b>{player.name}{player.special && <i className="report-flag">★</i>}</b>
                <em>{player.slot} · {player.season}</em>
                <strong>{player.overall}</strong>
                <span className="report-bar" aria-hidden="true"/>
              </li>
            ))}
            {!best.length && <li><b>Elenco não registrado.</b></li>}
          </ul>
        </section>
        {children}
      </div>
    </>
  );
}

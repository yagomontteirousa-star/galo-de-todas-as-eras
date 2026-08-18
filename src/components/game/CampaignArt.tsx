import { roundLabels } from "@/lib/bracket";
import { eliminator, type SharedCampaign } from "@/lib/share";
import type { CSSProperties } from "react";
import { BrandMark } from "@/components/ui/Brand";

/**
 * A arte da campanha. A tela final e a página pública do link renderizam este mesmo
 * componente a partir do mesmo retrato, então o que a pessoa compartilha é o que ela viu.
 */
export function CampaignArt({ data }: { data: SharedCampaign }) {
  const champion = data.outcome === "champion";
  const phase = champion ? "Campeão" : data.runnerUp ? "Vice-campeão" : roundLabels[data.round];
  const last = eliminator(data) ?? data.matches.at(-1);
  const best = [...data.squad].sort((left, right) => right.overall - left.overall).slice(0, 4);
  const topRating = best[0]?.overall ?? 99;
  const highlighted = new Set(best.map((player) => `${player.slot}-${player.name}`));
  const years = data.matches.map((match) => match.rivalYear);

  return (
    <>
      <header className="report-head">
        <BrandMark size={44}/>
        <div>
          <span className="report-eyebrow">{champion ? "Campeão" : data.runnerUp ? "Vice-campeão" : "Fim de campanha"}</span>
          <h1>{champion ? "A taça é do Galo." : data.runnerUp ? "Faltou o último passo." : "O arquivo fecha aqui."}</h1>
        </div>
        {last && (
          <div className="report-final">
            <small>{roundLabels[last.round]}</small>
            <b>{last.user}<i>×</i>{last.rival}</b>
            <span>{last.rivalName} {last.rivalYear}{last.pens ?? ""}</span>
          </div>
        )}
      </header>

      <dl className="report-facts">
        <div><dt>Fase</dt><dd>{phase}</dd></div>
        <div><dt>Vitórias</dt><dd>{data.wins}</dd></div>
        <div><dt>Overall</dt><dd>{data.overall}</dd></div>
        <div><dt>Formação</dt><dd>{data.formation}</dd></div>
        <div><dt>Perfil</dt><dd>{data.tactic}</dd></div>
      </dl>

      <div className="report-grid">
        <section className="report-block">
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
            {data.matches.map((match) => (
              <li key={`${match.round}-${match.rivalName}`} className={match.won ? "is-win" : "is-loss"}>
                <em>{roundLabels[match.round]}</em>
                <b>{match.user} a {match.rival}</b>
                <span>{match.rivalName} {match.rivalYear}{match.pens ?? ""}</span>
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
          {years.length > 0 && <p className="report-years">Anos enfrentados: {years.join(", ")}.</p>}
        </section>
      </div>
    </>
  );
}

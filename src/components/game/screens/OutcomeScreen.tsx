import { getCurrentUserMatch, roundLabels } from "@/lib/bracket";
import type { Campaign } from "@/types/game";
import { ArrowIcon } from "@/components/ui/Icons";

export function OutcomeScreen({ campaign, outcome, onContinue, onRestart }: {
  campaign: Campaign;
  outcome: "victory" | "eliminated" | "champion";
  onContinue: () => void;
  onRestart: () => void;
}) {
  const next = campaign.bracket ? getCurrentUserMatch(campaign.bracket) : undefined;
  const lastMatch = campaign.bracket?.rounds.flatMap((round) => round.matches).find((match) => match.id === campaign.lastMatchId);
  const result = lastMatch?.result;
  const homeTotal = result ? result.homeScore + result.homeExtra : 0;
  const awayTotal = result ? result.awayScore + result.awayExtra : 0;
  const userTeam = lastMatch?.home.isUser ? lastMatch.home : lastMatch?.away;
  const opponent = lastMatch?.home.isUser ? lastMatch.away : lastMatch?.home;
  const copy = outcome === "champion"
    ? { title: "A história termina em título.", text: "Cinco confrontos, um onze impossível e uma campanha que agora existe no papel." }
    : outcome === "eliminated"
      ? { title: "O arquivo fecha por aqui.", text: `Foram ${campaign.wins} ${campaign.wins === 1 ? "vitória" : "vitórias"}. Outra combinação pode mudar toda a súmula.` }
      : { title: "Classificado.", text: next ? `A próxima página é ${roundLabels[campaign.bracket!.currentRound]} contra ${next.home.isUser ? next.away.name : next.home.name}.` : "A próxima fase já está definida." };
  const goals = result?.events.filter((event) => event.type === "goal") ?? [];
  const homeName = lastMatch?.home.name ?? "Mandante";
  const awayName = lastMatch?.away.name ?? "Visitante";

  return (
    <main className={`outcome-screen outcome-screen--${outcome}`} id="main">
      <section className="outcome-summary">
        <div className="outcome-monogram" aria-hidden="true">PB</div>
        <span>{outcome === "champion" ? "CAMPEÃO" : outcome === "eliminated" ? "FIM DE CAMPANHA" : `${campaign.wins}ª VITÓRIA`}</span>
        <h1>{copy.title}</h1><p>{copy.text}</p>
        <div className="outcome-actions">
          <button type="button" className="button button--primary" onClick={onContinue}>{outcome === "victory" ? "Próxima fase" : "Ver campanha"}<ArrowIcon/></button>
          <button type="button" className="button button--quiet" onClick={onRestart}>Nova campanha</button>
        </div>
      </section>
      <aside className="result-sheet">
        <header><span>{lastMatch ? roundLabels[lastMatch.round] : "RESULTADO"}</span><b>{lastMatch?.home.year} · {lastMatch?.away.year}</b></header>
        <div className="result-score"><div><small>{lastMatch?.home.name}</small><strong>{homeTotal}</strong></div><i>×</i><div><small>{lastMatch?.away.name}</small><strong>{awayTotal}</strong></div></div>
        {result?.wentToPenalties && <p className="penalty-result">Pênaltis · {result.homePenalties} × {result.awayPenalties}</p>}
        <div className="result-facts">
          <div><span>Overall</span><b>{userTeam?.overall.final ?? "—"} × {opponent?.overall.final ?? "—"}</b></div>
          <div><span>Melhor em campo</span><b>{result?.playerOfMatch ?? "—"}</b></div>
          <div><span>Impacto tático</span><b>{result?.instructionImpact ?? "Plano mantido durante o confronto."}</b></div>
          <div><span>Improvisos</span><b>{userTeam?.overall.improvisationPenalty ? `−${userTeam.overall.improvisationPenalty} no cálculo` : "Sem impacto relevante"}</b></div>
        </div>
        <div className="result-goals"><span>Gols</span>{goals.length ? goals.map((goal) => <p key={goal.id}><time>{goal.minute}′</time><b>{goal.playerName}</b><small>{goal.teamId === lastMatch?.home.id ? homeName : awayName}</small></p>) : <p>Sem gols no tempo de jogo.</p>}</div>
      </aside>
    </main>
  );
}

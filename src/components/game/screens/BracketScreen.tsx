import { getCurrentUserMatch, roundLabels, roundOrder } from "@/lib/bracket";
import type { BracketState, RatingsMode, TournamentRound } from "@/types/game";
import { ArrowIcon } from "@/components/ui/Icons";

const roundCounts: Record<TournamentRound, number> = { round32: 16, round16: 8, quarterfinal: 4, semifinal: 2, final: 1 };

export function BracketScreen({ bracket, ratingsMode, onPlay }: { bracket: BracketState; ratingsMode: RatingsMode; onPlay: () => void }) {
  const currentMatch = getCurrentUserMatch(bracket);
  const current = currentMatch?.result ? undefined : currentMatch;
  const opponent = current && (current.home.isUser ? current.away : current.home);
  return (
    <main className="screen bracket-screen" id="main">
      <div className="bracket-heading"><div><h1>{bracket.champion ? "Campanha encerrada." : current ? "Próxima fase." : "O caminho percorrido."}</h1><p>{opponent ? `Próximo: ${opponent.name} ${opponent.year} · ${ratingsMode === "visible" ? `OVR ${opponent.overall.final}` : "força desconhecida"}` : bracket.champion ? `Campeão: ${bracket.champion.name}` : "A chave inteira evolui a cada confronto."}</p></div>{current && <button type="button" className="button button--primary" onClick={onPlay}>Jogar contra {opponent?.name}<ArrowIcon/></button>}</div>
      <div className="bracket-scroll" tabIndex={0} aria-label="Chave do mata-mata, role horizontal">
        <div className="bracket-grid">
          {roundOrder.map((roundId) => {
            const round = bracket.rounds.find((item) => item.id === roundId);
            return <section className="bracket-round" key={roundId}><h2>{roundLabels[roundId]}<span>{roundCounts[roundId]} {roundCounts[roundId] === 1 ? "jogo" : "jogos"}</span></h2><div className="bracket-round__matches">
              {Array.from({ length: roundCounts[roundId] }, (_, index) => {
                const match = round?.matches[index];
                if (!match) return <div className="bracket-match is-future" key={index}><span>A definir</span><span>A definir</span></div>;
                const isCurrent = match.id === current?.id;
                const homeTotal = match.result ? match.result.homeScore + match.result.homeExtra : undefined;
                const awayTotal = match.result ? match.result.awayScore + match.result.awayExtra : undefined;
                return <article className={`bracket-match ${isCurrent ? "is-current" : ""}`} key={match.id}>
                  <div className={match.result?.winnerId === match.home.id ? "is-winner" : ""}><span><small>{match.home.year}</small>{match.home.name}</span><b>{homeTotal ?? "—"}</b></div>
                  <div className={match.result?.winnerId === match.away.id ? "is-winner" : ""}><span><small>{match.away.year}</small>{match.away.name}</span><b>{awayTotal ?? "—"}</b></div>
                  {match.result && <small className="bracket-match__scorers">{match.result.events.filter((item) => item.type === "goal").map((item) => item.playerName).filter(Boolean).join(", ") || "Sem gols"}</small>}
                  {match.result?.wentToPenalties && <em>pên. {match.result.homePenalties}–{match.result.awayPenalties}</em>}
                </article>;
              })}
            </div></section>;
          })}
        </div>
      </div>
      <p className="mobile-scroll-hint">Deslize a chave para ver as próximas fases.</p>
    </main>
  );
}

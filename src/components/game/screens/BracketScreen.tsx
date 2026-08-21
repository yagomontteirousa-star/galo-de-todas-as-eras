import { getCurrentUserMatch, roundCounts, roundLabels, roundOrder, teamEra } from "@/lib/bracket";
import { useState } from "react";
import type { BracketMatch, BracketState, RatingsMode, TeamSnapshot } from "@/types/game";
import { ArrowIcon } from "@/components/ui/Icons";
import { RivalSquadDisclosure } from "@/components/game/RivalSquadDisclosure";
import { rivalRosterFromTeam } from "@/lib/rival-roster";

function TeamLine({ team, score, isWinner, decided }: { team: TeamSnapshot; score?: number; isWinner: boolean; decided: boolean }) {
  return (
    <div className={`bracket-team ${isWinner ? "is-winner" : decided ? "is-out" : ""} ${team.isUser ? "is-user" : ""}`}>
      <small>{teamEra(team)}</small>
      <span>{team.name}{team.isUser && <em>você</em>}{team.controller === "cpu" && <em>CPU</em>}</span>
      <b>{score ?? "—"}</b>
    </div>
  );
}

export function BracketScreen({ bracket, ratingsMode, onPlay, onBackToResult }: {
  bracket: BracketState;
  ratingsMode: RatingsMode;
  onPlay: () => void;
  /** Só chega preenchido quando a chave foi aberta a partir de uma campanha encerrada. */
  onBackToResult?: () => void;
}) {
  const currentMatch = getCurrentUserMatch(bracket);
  const current = currentMatch?.result ? undefined : currentMatch;
  /** No celular a chave vira uma fase por vez: quatro colunas não cabem sem virar letra miúda. */
  const [phase, setPhase] = useState(bracket.currentRound);
  const opponent = current && (current.home.isUser ? current.away : current.home);
  const goalsOf = (match: BracketMatch) => match.result?.events.filter((item) => item.type === "goal") ?? [];

  return (
    <main className="screen bracket-screen" id="main">
      <div className="bracket-heading">
        <div>
          <span className="bracket-heading__phase">{roundLabels[bracket.currentRound]} · 16 equipes na chave</span>
          <h1>{bracket.champion ? "Campanha encerrada." : current ? "Próxima fase." : "O caminho percorrido."}</h1>
          <p>{opponent
            ? `Você enfrenta ${opponent.name} ${teamEra(opponent)} · ${ratingsMode === "visible" ? `overall ${opponent.overall.final}` : "força desconhecida"}`
            : bracket.champion ? `Campeão: ${bracket.champion.name}` : "A chave inteira evolui a cada confronto."}</p>
        </div>
        <div className="bracket-heading__actions">
          {onBackToResult && (
            <button type="button" className="button button--primary" onClick={onBackToResult}>
              <ArrowIcon className="icon--back"/>Voltar ao resultado
            </button>
          )}
          {current && <button type="button" className="button button--primary" onClick={onPlay}>Jogar contra {opponent?.name}<ArrowIcon/></button>}
        </div>
      </div>
      <nav className="bracket-phases" aria-label="Fases do mata-mata">
        {roundOrder.map((roundId) => (
          <button type="button" key={roundId} aria-current={phase === roundId ? "page" : undefined}
            className={phase === roundId ? "is-active" : ""} onClick={() => setPhase(roundId)}>
            {roundLabels[roundId]}
          </button>
        ))}
      </nav>
      <div className="bracket-scroll" tabIndex={0} aria-label="Chave do mata-mata">
        <div className="bracket-grid">
          {roundOrder.map((roundId) => {
            const round = bracket.rounds.find((item) => item.id === roundId);
            const isCurrentRound = roundId === bracket.currentRound;
            return <section className={`bracket-round ${isCurrentRound ? "is-current-round" : ""} ${phase === roundId ? "is-phase-active" : ""}`} key={roundId}>
              <h2>{roundLabels[roundId]}<span>{roundCounts[roundId]} {roundCounts[roundId] === 1 ? "jogo" : "jogos"}</span></h2>
              <div className="bracket-round__matches">
                {Array.from({ length: roundCounts[roundId] }, (_, index) => {
                  const match = round?.matches[index];
                  if (!match) return <div className="bracket-match is-future" key={index}><span>A definir</span></div>;
                  const isCurrent = match.id === current?.id;
                  const hasUser = match.home.isUser || match.away.isUser;
                  const decided = Boolean(match.result);
                  const facedRival = hasUser && decided
                    ? rivalRosterFromTeam(match.home.isUser ? match.away : match.home)
                    : undefined;
                  const homeTotal = match.result ? match.result.homeScore + match.result.homeExtra : undefined;
                  const awayTotal = match.result ? match.result.awayScore + match.result.awayExtra : undefined;
                  return <article className={`bracket-match ${isCurrent ? "is-current" : ""} ${hasUser ? "has-user" : ""}`} key={match.id}>
                    <TeamLine team={match.home} score={homeTotal} isWinner={match.result?.winnerId === match.home.id} decided={decided}/>
                    <TeamLine team={match.away} score={awayTotal} isWinner={match.result?.winnerId === match.away.id} decided={decided}/>
                    {match.result?.wentToPenalties && <em className="bracket-match__note">Pênaltis {match.result.homePenalties}–{match.result.awayPenalties}</em>}
                    {hasUser && decided && (
                      goalsOf(match).length
                        ? <ul className="bracket-match__goals">
                          {goalsOf(match).map((goal) => (
                            <li key={goal.id} className={goal.teamId === match.home.id ? "is-home" : "is-away"}>
                              <time>{goal.minute}′</time>{goal.playerName}
                            </li>
                          ))}
                        </ul>
                        : <small className="bracket-match__scorers">Sem gols</small>
                    )}
                    {facedRival && <RivalSquadDisclosure rival={facedRival} className="rival-roster--bracket"/>}
                    {isCurrent && <span className="bracket-match__flag">Seu próximo jogo</span>}
                  </article>;
                })}
              </div>
            </section>;
          })}
        </div>
      </div>
    </main>
  );
}

import { opponents } from "@/data/opponents";
import { simulateMatch, type RandomSource } from "@/lib/simulation";
import type { BracketMatch, BracketRound, BracketState, MatchResult, TeamSnapshot, TournamentRound } from "@/types/game";

export const roundOrder: TournamentRound[] = ["round16", "quarterfinal", "semifinal", "final"];
export const roundLabels: Record<TournamentRound, string> = {
  round16: "Oitavas", quarterfinal: "Quartas", semifinal: "Semifinal", final: "Final",
};
export const roundCounts: Record<TournamentRound, number> = { round16: 8, quarterfinal: 4, semifinal: 2, final: 1 };
export const BRACKET_SIZE = 16;

/** O onze do usuário atravessa eras, então mostrar um ano só seria mentira. */
export const USER_TEAM_ERA = "Seleção histórica";
export const teamEra = (team: TeamSnapshot): string => team.eraLabel ?? String(team.year);

function shuffle<T>(items: T[], random: RandomSource): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

function pairTeams(teams: TeamSnapshot[], round: TournamentRound): BracketRound {
  const matches: BracketMatch[] = [];
  for (let index = 0; index < teams.length; index += 2) {
    matches.push({ id: `${round}-${index / 2}-${teams[index].id}-${teams[index + 1].id}`, round, index: index / 2, home: teams[index], away: teams[index + 1] });
  }
  return { id: round, matches };
}

/**
 * A chave é montada por faixas de força para a campanha endurecer a cada fase: o
 * adversário das oitavas sai da faixa mais fraca, e os mais fortes ficam presos na outra
 * metade, onde só podem ser encontrados na final. As faixas seguem o pareamento de
 * `pairTeams`, que junta os índices dois a dois e mantém a ordem nas fases seguintes.
 */
export function createBracket(userTeam: TeamSnapshot, random: RandomSource = Math.random): BracketState {
  const field = shuffle<TeamSnapshot>(opponents, random)
    .slice(0, BRACKET_SIZE - 1)
    .sort((left, right) => left.overall.final - right.overall.final);
  // O jogo de abertura não pega mais sempre o pior time da amostra. A segunda força mais
  // baixa abre a campanha; as subchaves seguintes sobem de média sem colocar um gigante
  // logo nas oitavas nem reservar um adversário fraco para a final.
  const ordered = [
    field[1],
    ...shuffle([field[0], field[4]], random),
    ...shuffle([field[2], field[3], field[5], field[6]], random),
    ...shuffle(field.slice(7), random),
  ];
  const userIsHome = random() < 0.5;
  const teams = userIsHome ? [userTeam, ...ordered] : [ordered[0], userTeam, ...ordered.slice(1)];
  return { rounds: [pairTeams(teams, "round16")], currentRound: "round16" };
}

export const rivalOf = (match: BracketMatch) => match.home.isUser ? match.away : match.home;

/** Jogos do usuário já decididos, na ordem em que aconteceram. */
export function userMatches(bracket?: BracketState): BracketMatch[] {
  return (bracket?.rounds ?? [])
    .flatMap((round) => round.matches)
    .filter((match) => (match.home.isUser || match.away.isUser) && match.result);
}

/** Placar sempre do ponto de vista do usuário, prorrogação incluída. */
export function scoreOf(match: BracketMatch) {
  const result = match.result!;
  const user = match.home.isUser ? result.homeScore + result.homeExtra : result.awayScore + result.awayExtra;
  const rival = match.home.isUser ? result.awayScore + result.awayExtra : result.homeScore + result.homeExtra;
  const userPens = match.home.isUser ? result.homePenalties : result.awayPenalties;
  const rivalPens = match.home.isUser ? result.awayPenalties : result.homePenalties;
  const pens = result.wentToPenalties ? ` (${userPens} a ${rivalPens} nos pênaltis)` : "";
  return { user, rival, pens, userPens, rivalPens, won: result.winnerId === "user-team" };
}

export function getCurrentUserMatch(bracket: BracketState): BracketMatch | undefined {
  return bracket.rounds.find((round) => round.id === bracket.currentRound)?.matches.find((match) => match.home.isUser || match.away.isUser);
}

/** A mesma campanha pode escalar outra combinação dos 18 antes de cada confronto. */
export function withCurrentUserTeam(bracket: BracketState, userTeam: TeamSnapshot): BracketState {
  return {
    ...bracket,
    rounds: bracket.rounds.map((round) => round.id !== bracket.currentRound ? round : {
      ...round,
      matches: round.matches.map((match) => match.home.isUser ? { ...match, home: userTeam } : match.away.isUser ? { ...match, away: userTeam } : match),
    }),
  };
}

export function resolveCurrentRound(bracket: BracketState, userResult: MatchResult, random: RandomSource = Math.random): BracketState {
  const currentIndex = roundOrder.indexOf(bracket.currentRound);
  const currentRound = bracket.rounds.find((round) => round.id === bracket.currentRound);
  if (!currentRound) throw new Error("Fase atual não encontrada");
  const resolvedMatches = currentRound.matches.map((match) => ({
    ...match,
    result: match.home.isUser || match.away.isUser ? userResult : match.result ?? simulateMatch(match.home, match.away, random),
  }));
  const winners = resolvedMatches.map((match) => match.result?.winnerId === match.home.id ? match.home : match.away);
  const userAlive = winners.some((team) => team.isUser);
  const rounds = bracket.rounds.map((round) => round.id === currentRound.id ? { ...round, matches: resolvedMatches } : round);
  if (currentIndex === roundOrder.length - 1) return { rounds, currentRound: bracket.currentRound, champion: winners[0] };
  if (!userAlive) return { rounds, currentRound: bracket.currentRound };
  const nextRoundId = roundOrder[currentIndex + 1];
  return { rounds: [...rounds, pairTeams(winners, nextRoundId)], currentRound: nextRoundId };
}

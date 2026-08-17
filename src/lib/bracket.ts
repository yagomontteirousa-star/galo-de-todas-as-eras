import { opponents } from "@/data/opponents";
import { simulateMatch, type RandomSource } from "@/lib/simulation";
import type { BracketMatch, BracketRound, BracketState, MatchResult, TeamSnapshot, TournamentRound } from "@/types/game";

export const roundOrder: TournamentRound[] = ["round16", "quarterfinal", "semifinal", "final"];
export const roundLabels: Record<TournamentRound, string> = {
  round16: "Oitavas", quarterfinal: "Quartas", semifinal: "Semifinal", final: "Final",
};
export const roundCounts: Record<TournamentRound, number> = { round16: 8, quarterfinal: 4, semifinal: 2, final: 1 };
export const BRACKET_SIZE = 16;

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

export function createBracket(userTeam: TeamSnapshot, random: RandomSource = Math.random): BracketState {
  const field = shuffle<TeamSnapshot>(opponents, random).slice(0, BRACKET_SIZE - 1);
  const teams = shuffle<TeamSnapshot>([userTeam, ...field], random);
  return { rounds: [pairTeams(teams, "round16")], currentRound: "round16" };
}

export function getCurrentUserMatch(bracket: BracketState): BracketMatch | undefined {
  return bracket.rounds.find((round) => round.id === bracket.currentRound)?.matches.find((match) => match.home.isUser || match.away.isUser);
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

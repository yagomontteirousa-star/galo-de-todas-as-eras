import { opponents } from "@/data/opponents";
import { BRACKET_SIZE, roundCounts, roundOrder } from "@/lib/bracket";
import { seededRandom, simulateMatch } from "@/lib/simulation";
import type { BracketMatch, BracketRound, BracketState, TeamSnapshot, TournamentRound } from "@/types/game";
import type { MultiplayerMatch, MultiplayerParticipant, MultiplayerRoom } from "@/types/multiplayer";

function shuffled<T>(source: T[], random: () => number): T[] {
  const result = [...source];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function multiplayerTeam(participant: MultiplayerParticipant): TeamSnapshot {
  if (!participant.team) throw new Error(`${participant.nickname} ainda não concluiu o elenco.`);
  return { ...participant.team, id: `multiplayer-${participant.id}`, name: participant.nickname, isUser: false, controller: "human", participantId: participant.id, eraLabel: "Seleção histórica" };
}

export function createMultiplayerBracket(participants: MultiplayerParticipant[], seed: number): BracketState {
  const random = seededRandom(seed);
  const humans = participants.map(multiplayerTeam);
  const used = new Set(humans.map((team) => team.id));
  const cpus = shuffled(opponents, random)
    .filter((team) => !used.has(team.id))
    .slice(0, BRACKET_SIZE - humans.length)
    .map((team) => ({ ...team, isUser: false, controller: "cpu" as const }));
  const teams = shuffled([...humans, ...cpus], random);
  const matches: BracketMatch[] = Array.from({ length: 8 }, (_, index) => ({
    id: crypto.randomUUID(), round: "round16", index, home: teams[index * 2], away: teams[index * 2 + 1],
  }));
  return { rounds: [{ id: "round16", matches }], currentRound: "round16" };
}

function ownerFor(team: TeamSnapshot, participants: MultiplayerParticipant[]) {
  return team.participantId ? participants.find((item) => item.id === team.participantId) : undefined;
}

export function multiplayerMatchesForRound(room: MultiplayerRoom, round: BracketRound, participants: MultiplayerParticipant[]): MultiplayerMatch[] {
  return round.matches.map((match) => {
    const home = ownerFor(match.home, participants);
    const away = ownerFor(match.away, participants);
    const controller = home ?? away ?? participants.find((item) => item.userId === room.hostUserId) ?? participants[0];
    const seed = Math.floor(Math.random() * 2147483647);
    const cpuOnly = !home && !away;
    const simulationHome = { ...match.home, isUser: Boolean(home) };
    const simulationAway = { ...match.away, isUser: !home && Boolean(away) };
    const result = simulateMatch(simulationHome, simulationAway, seededRandom(seed));
    const controllingParticipant = home ?? away;
    const progress = controllingParticipant?.campaign ? {
      matchId: match.id, minute: 0,
      lineup: controllingParticipant.campaign.lineup,
      bench: controllingParticipant.campaign.bench,
      substitutions: [], kickStep: 0, kickRevealed: false, shootoutComplete: false,
    } : undefined;
    return {
      id: match.id, roomId: room.id, round: round.id, index: match.index,
      homeTeam: match.home, awayTeam: match.away,
      homeParticipantId: home?.id, awayParticipantId: away?.id,
      controllerUserId: controller.userId, seed,
      status: cpuOnly ? "finished" : "waiting", result, progress,
      homeReady: false, awayReady: false,
      homeCpu: !home, awayCpu: !away,
      officialMinute: 0, phaseBaseMinute: 0,
      updatedAt: new Date().toISOString(),
    };
  });
}

export function viewedBracket(room: MultiplayerRoom, matches: MultiplayerMatch[], participantId: string): BracketState {
  const rounds: BracketRound[] = roundOrder.flatMap((round) => {
    const rows = matches.filter((match) => match.round === round).sort((left, right) => left.index - right.index);
    if (!rows.length) return [];
    return [{ id: round, matches: rows.map((match) => ({
      id: match.id, round, index: match.index,
      home: { ...match.homeTeam, isUser: match.homeParticipantId === participantId },
      away: { ...match.awayTeam, isUser: match.awayParticipantId === participantId },
      result: match.status === "finished" ? match.result : undefined,
    })) }];
  });
  const final = rounds.find((item) => item.id === "final")?.matches[0];
  const champion = final?.result ? (final.result.winnerId === final.home.id ? final.home : final.away) : undefined;
  return { rounds, currentRound: room.currentRound, champion };
}

export function nextMultiplayerRound(room: MultiplayerRoom, matches: MultiplayerMatch[]): BracketRound | undefined {
  const currentIndex = roundOrder.indexOf(room.currentRound);
  if (currentIndex < 0 || currentIndex >= roundOrder.length - 1) return undefined;
  const current = matches.filter((item) => item.round === room.currentRound).sort((left, right) => left.index - right.index);
  if (current.length !== roundCounts[room.currentRound] || current.some((item) => item.status !== "finished" || !item.result)) return undefined;
  const winners = current.map((match) => match.result!.winnerId === match.homeTeam.id ? match.homeTeam : match.awayTeam);
  const nextId: TournamentRound = roundOrder[currentIndex + 1];
  return { id: nextId, matches: Array.from({ length: winners.length / 2 }, (_, index) => ({ id: crypto.randomUUID(), round: nextId, index, home: winners[index * 2], away: winners[index * 2 + 1] })) };
}

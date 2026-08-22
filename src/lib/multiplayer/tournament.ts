import { opponents } from "@/data/opponents";
import { roundOrder } from "@/lib/bracket";
import { seededRandom, simulateMatch } from "@/lib/simulation";
import type { BracketMatch, BracketRound, BracketState, TeamSnapshot, TournamentRound } from "@/types/game";
import type { MultiplayerBracketSize, MultiplayerMatch, MultiplayerParticipant, MultiplayerRoom } from "@/types/multiplayer";

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

export function multiplayerMatchCanStart(match: MultiplayerMatch): boolean {
  return (match.homeCpu || match.homeReady || !match.homeParticipantId)
    && (match.awayCpu || match.awayReady || !match.awayParticipantId);
}

export function multiplayerShootoutProgress(match: MultiplayerMatch) {
  const kickCount = match.result?.penaltyKicks?.length ?? 0;
  const finished = match.status === "finished";
  return {
    kickStep: finished ? kickCount : match.shootoutStep,
    kickRevealed: finished || match.shootoutRevealed,
    shootoutComplete: finished,
  };
}

export function firstRoundForSize(size: MultiplayerBracketSize): TournamentRound {
  return size === 2 ? "final" : size === 4 ? "semifinal" : size === 8 ? "quarterfinal" : "round16";
}

export function createMultiplayerBracket(participants: MultiplayerParticipant[], seed: number, size: MultiplayerBracketSize = 16): BracketState {
  const random = seededRandom(seed);
  const humans = participants.map(multiplayerTeam);
  const used = new Set(humans.map((team) => team.id));
  const cpus = shuffled(opponents, random)
    .filter((team) => !used.has(team.id))
    .slice(0, size - humans.length)
    .map((team) => ({ ...team, isUser: false, controller: "cpu" as const }));
  const teams = shuffled([...humans, ...cpus], random);
  const firstRound = firstRoundForSize(size);
  const matches: BracketMatch[] = Array.from({ length: size / 2 }, (_, index) => ({
    id: crypto.randomUUID(), round: firstRound, index, home: teams[index * 2], away: teams[index * 2 + 1],
  }));
  return { rounds: [{ id: firstRound, matches }], currentRound: firstRound };
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
      bench: [],
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
      shootoutStep: 0, shootoutRevealed: false,
      updatedAt: new Date().toISOString(),
    };
  });
}

export function viewedBracket(room: MultiplayerRoom, matches: MultiplayerMatch[], participantId: string): BracketState {
  const start = roundOrder.indexOf(firstRoundForSize(room.bracketSize));
  const rounds: BracketRound[] = roundOrder.slice(start).flatMap((round) => {
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
  const expected = room.currentRound === firstRoundForSize(room.bracketSize) ? room.bracketSize / 2 : Math.max(1, current.length);
  if (current.length !== expected || current.some((item) => item.status !== "finished" || !item.result)) return undefined;
  const winners = current.map((match) => match.result!.winnerId === match.homeTeam.id ? match.homeTeam : match.awayTeam);
  const nextId: TournamentRound = roundOrder[currentIndex + 1];
  return { id: nextId, matches: Array.from({ length: winners.length / 2 }, (_, index) => ({ id: crypto.randomUUID(), round: nextId, index, home: winners[index * 2], away: winners[index * 2 + 1] })) };
}

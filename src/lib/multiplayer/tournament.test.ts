import { describe, expect, it } from "vitest";
import { opponents } from "@/data/opponents";
import { createMultiplayerBracket, multiplayerMatchCanStart, multiplayerMatchesForRound, multiplayerShootoutProgress, nextMultiplayerRound, viewedBracket } from "@/lib/multiplayer/tournament";
import type { MultiplayerParticipant, MultiplayerRoom } from "@/types/multiplayer";

const createdAt = "2026-08-20T12:00:00.000Z";
const room: MultiplayerRoom = { id: "room", code: "AB3XK9MQ", hostUserId: "user-1", status: "waiting", ratingsMode: "visible", currentRound: "round16", createdAt, updatedAt: createdAt };
const participant = (index: number): MultiplayerParticipant => ({
  id: `player-${index}`, roomId: room.id, userId: `user-${index}`, nickname: `Jogador ${index}`,
  slotIndex: index - 1, status: "ready", team: { ...opponents[index], id: `draft-${index}`, isUser: true },
  draftSchedule: [], draftRound: 0, draftPick: 0, connected: true, lobbyReady: true,
  createdAt, updatedAt: createdAt,
});

describe("multiplayer tournament", () => {
  it("preenche as 16 vagas sem duplicar o time de um participante", () => {
    const players = [participant(1), participant(2), participant(3)];
    const bracket = createMultiplayerBracket(players, 42);
    const teams = bracket.rounds[0].matches.flatMap((match) => [match.home, match.away]);
    expect(teams).toHaveLength(16);
    expect(teams.filter((team) => team.controller === "human")).toHaveLength(3);
    expect(teams.filter((team) => team.controller === "cpu")).toHaveLength(13);
    expect(new Set(teams.map((team) => team.id)).size).toBe(16);
  });

  it("mostra como usuário somente o time do participante que abriu a chave", () => {
    const players = [participant(1), participant(2)];
    const bracket = createMultiplayerBracket(players, 7);
    const matches = multiplayerMatchesForRound(room, bracket.rounds[0], players);
    const viewed = viewedBracket(room, matches, players[1].id);
    const userTeams = viewed.rounds.flatMap((round) => round.matches).flatMap((match) => [match.home, match.away]).filter((team) => team.isUser);
    expect(userTeams.map((team) => team.participantId)).toEqual([players[1].id]);
  });

  it("avança somente quando todos os jogos da fase terminaram", () => {
    const players = [participant(1)];
    const bracket = createMultiplayerBracket(players, 19);
    const matches = multiplayerMatchesForRound(room, bracket.rounds[0], players);
    expect(nextMultiplayerRound(room, matches)).toBeUndefined();
    const finished = matches.map((match) => ({ ...match, status: "finished" as const }));
    expect(nextMultiplayerRound(room, finished)?.matches).toHaveLength(4);
  });

  it("libera imediatamente uma partida humana contra CPU quando o humano confirma", () => {
    const players = [participant(1)];
    const bracket = createMultiplayerBracket(players, 31);
    const match = multiplayerMatchesForRound(room, bracket.rounds[0], players)
      .find((item) => item.homeParticipantId || item.awayParticipantId)!;
    const confirmed = {
      ...match,
      homeReady: match.homeReady || match.homeParticipantId === players[0].id,
      awayReady: match.awayReady || match.awayParticipantId === players[0].id,
    };
    expect(match.homeCpu || match.awayCpu).toBe(true);
    expect(multiplayerMatchCanStart(confirmed)).toBe(true);
  });

  it("não revela a disputa de pênaltis antes do fim da prorrogação", () => {
    expect(multiplayerShootoutProgress("playing", 9)).toEqual({ kickStep: 0, kickRevealed: false, shootoutComplete: false });
    expect(multiplayerShootoutProgress("finished", 9)).toEqual({ kickStep: 9, kickRevealed: true, shootoutComplete: true });
  });
});

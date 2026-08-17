import { describe, expect, it } from "vitest";
import { atleticoSquads } from "@/data/atletico-squads";
import { formations } from "@/data/formations";
import { createBracket, getCurrentUserMatch, resolveCurrentRound, roundOrder } from "@/lib/bracket";
import { calculateTeamOverall } from "@/lib/overall";
import { seededRandom, simulateMatch } from "@/lib/simulation";
import type { TeamSnapshot } from "@/types/game";

function userTeam(): TeamSnapshot {
  const formation = formations["4-3-3"];
  const lineup = atleticoSquads[0].players.slice(0, 11);
  return { id: "user-team", name: "Preto no Branco", year: 2026, formation: "4-3-3", tactic: "balanced", lineup, overall: calculateTeamOverall(lineup.map((player, index) => ({ player, slotId: formation.slots[index].id })), "4-3-3", "balanced"), isUser: true };
}

describe("bracket", () => {
  it("começa nas oitavas com 8 confrontos e 16 equipes sem IDs repetidos", () => {
    const bracket = createBracket(userTeam(), () => 0.42);
    const teams = bracket.rounds[0].matches.flatMap((match) => [match.home, match.away]);
    expect(bracket.currentRound).toBe("round16");
    expect(bracket.rounds[0].matches).toHaveLength(8);
    expect(new Set(teams.map((team) => team.id)).size).toBe(16);
    expect(teams.filter((team) => team.isUser)).toHaveLength(1);
  });

  it("leva o usuário das oitavas ao título em quatro vitórias", () => {
    let bracket = createBracket(userTeam(), seededRandom(7));
    const visited: string[] = [];
    for (let round = 0; round < roundOrder.length; round += 1) {
      const match = getCurrentUserMatch(bracket)!;
      visited.push(bracket.currentRound);
      const userWin = { ...simulateMatch(match.home, match.away, seededRandom(3)), winnerId: "user-team" };
      bracket = resolveCurrentRound(bracket, userWin, seededRandom(round + 1));
    }
    expect(visited).toEqual(roundOrder);
    expect(bracket.champion?.isUser).toBe(true);
    expect(bracket.rounds.at(-1)?.matches).toHaveLength(1);
  });

  it("sorteia adversários diferentes entre campanhas", () => {
    const names = (seed: number) => createBracket(userTeam(), seededRandom(seed)).rounds[0].matches
      .flatMap((match) => [match.home.id, match.away.id]).filter((id) => id !== "user-team").sort().join();
    expect(names(11)).not.toBe(names(9001));
  });
});

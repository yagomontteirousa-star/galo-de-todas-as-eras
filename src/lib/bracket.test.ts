import { describe, expect, it } from "vitest";
import { atleticoSquads } from "@/data/atletico-squads";
import { formations } from "@/data/formations";
import { createBracket } from "@/lib/bracket";
import { calculateTeamOverall } from "@/lib/overall";
import type { TeamSnapshot } from "@/types/game";

function userTeam(): TeamSnapshot {
  const formation = formations["4-3-3"];
  const lineup = atleticoSquads[0].players.slice(0, 11);
  return { id: "user-team", name: "Preto no Branco", year: 2026, formation: "4-3-3", tactic: "balanced", lineup, overall: calculateTeamOverall(lineup.map((player, index) => ({ player, slotId: formation.slots[index].id })), "4-3-3", "balanced"), isUser: true };
}

describe("bracket", () => {
  it("cria 16 confrontos com 32 equipes sem IDs repetidos", () => {
    const bracket = createBracket(userTeam(), () => 0.42);
    const teams = bracket.rounds[0].matches.flatMap((match) => [match.home, match.away]);
    expect(bracket.rounds[0].matches).toHaveLength(16);
    expect(new Set(teams.map((team) => team.id)).size).toBe(32);
    expect(teams.filter((team) => team.isUser)).toHaveLength(1);
  });
});

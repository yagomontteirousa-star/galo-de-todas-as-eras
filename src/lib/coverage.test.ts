import { describe, expect, it } from "vitest";
import { atleticoSquads } from "@/data/atletico-squads";
import { formations } from "@/data/formations";
import { evaluatePosition } from "@/lib/overall";
import type { FormationId } from "@/types/game";

/**
 * A escalação só aceita posição natural ou secundária. Se algum elenco não cobrisse
 * uma vaga da formação, a campanha travaria sem escolha possível — este teste é a trava.
 */
describe("cobertura de posições", () => {
  it("todo elenco cobre toda vaga de toda formação", () => {
    const gaps: string[] = [];
    for (const formation of Object.values(formations)) {
      for (const slot of formation.slots) {
        for (const squad of atleticoSquads) {
          const covered = squad.players.some((player) => evaluatePosition(player, slot).fit !== "improvised");
          if (!covered) gaps.push(`${formation.id} ${slot.id} (${slot.position}) — ${squad.year}`);
        }
      }
    }
    expect(gaps).toEqual([]);
  });

  it("cada elenco tem ao menos 11 atletas", () => {
    const short = atleticoSquads.filter((squad) => squad.players.length < 11).map((squad) => squad.year);
    expect(short).toEqual([]);
  });

  it("toda formação tem 11 vagas", () => {
    const wrong = (Object.keys(formations) as FormationId[]).filter((id) => formations[id].slots.length !== 11);
    expect(wrong).toEqual([]);
  });
});

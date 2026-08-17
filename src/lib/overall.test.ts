import { describe, expect, it } from "vitest";
import { atleticoSquads } from "@/data/atletico-squads";
import { formations } from "@/data/formations";
import { calculateTeamOverall, evaluatePosition } from "@/lib/overall";

describe("overall", () => {
  it("penaliza uma improvisação mais do que uma posição secundária", () => {
    const squad = atleticoSquads.find((item) => item.year === 2021)!;
    const hulk = squad.players.find((player) => player.name === "Hulk")!;
    const formation = formations["4-3-3"];
    expect(evaluatePosition(hulk, formation.slots.find((slot) => slot.position === "ST")!).penalty).toBe(0);
    expect(evaluatePosition(hulk, formation.slots.find((slot) => slot.position === "RW")!).penalty).toBe(2);
    expect(evaluatePosition(hulk, formation.slots.find((slot) => slot.position === "CB")!).penalty).toBeGreaterThan(2);
  });

  it("produz overall limitado e não usa média simples", () => {
    const formation = formations["4-3-3"];
    const players = atleticoSquads.find((item) => item.year === 2013)!.players.slice(0, 11);
    const result = calculateTeamOverall(players.map((player, index) => ({ player, slotId: formation.slots[index].id })), "4-3-3", "attacking");
    const simple = Math.round(players.reduce((sum, player) => sum + player.overall, 0) / 11);
    expect(result.final).toBeGreaterThanOrEqual(60);
    expect(result.final).toBeLessThanOrEqual(99);
    expect(result.final).not.toBe(simple);
  });

  it("mantém ao menos 18 atletas em cada elenco", () => {
    expect(atleticoSquads.length).toBeGreaterThanOrEqual(11);
    expect(atleticoSquads.every((squad) => squad.players.length >= 18)).toBe(true);
  });
});

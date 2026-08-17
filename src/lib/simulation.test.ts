import { describe, expect, it } from "vitest";
import { opponents } from "@/data/opponents";
import { seededRandom, simulateMatch } from "@/lib/simulation";

function seeded(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
}

describe("simulation", () => {
  it("sempre declara um vencedor e registra eventos coerentes", () => {
    const home = opponents[0];
    const away = opponents[1];
    const result = simulateMatch(home, away, seeded(7));
    expect([home.id, away.id]).toContain(result.winnerId);
    expect(result.events.some((event) => event.type === "kickoff")).toBe(true);
    expect(result.events.some((event) => event.type === "halftime")).toBe(true);
    expect(result.events.some((event) => event.type === "full_time")).toBe(true);
    expect(result.events.filter((event) => event.type === "goal").every((event) => Boolean(event.playerName) && event.minute > 0)).toBe(true);
    if (result.wentToPenalties) expect(result.homePenalties).not.toBe(result.awayPenalties);
  });

  it("mantém o primeiro tempo determinístico ao mudar instruções posteriores", () => {
    const base = simulateMatch(opponents[0], opponents[1], seededRandom(42));
    const changed = simulateMatch(opponents[0], opponents[1], seededRandom(42), { halftime: "attack" });
    expect(changed.events.filter((event) => event.minute <= 45)).toEqual(base.events.filter((event) => event.minute <= 45));
  });

  it("mantém chance de zebra contra um time superior", () => {
    let underdogWins = 0;
    for (let seed = 1; seed <= 120; seed += 1) {
      const result = simulateMatch(opponents[28], opponents[7], seeded(seed));
      if (result.winnerId === opponents[7].id) underdogWins += 1;
    }
    expect(underdogWins).toBeGreaterThan(0);
    expect(underdogWins).toBeLessThan(100);
  });
});

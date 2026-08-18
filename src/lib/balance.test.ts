import { describe, expect, it } from "vitest";
import { opponents } from "@/data/opponents";

/**
 * A curva de dificuldade foi calibrada contra o melhor onze possível (overall 94).
 * Se um adversário escapar desta faixa, a campanha volta a ficar injusta.
 */
describe("balanceamento dos adversários", () => {
  const finals = opponents.map((team) => team.overall.final);
  const media = finals.reduce((sum, value) => sum + value, 0) / finals.length;

  it("mantém a faixa entre 76 e 93", () => {
    const fora = opponents.filter((team) => team.overall.final < 76 || team.overall.final > 93)
      .map((team) => `${team.name} ${team.year}: ${team.overall.final}`);
    expect(fora).toEqual([]);
  });

  it("mantém a média por volta de 85", () => {
    expect(media).toBeGreaterThan(82);
    expect(media).toBeLessThan(87);
  });

  it("distribui a chave entre fracos, médios e fortes", () => {
    expect(finals.filter((value) => value < 82).length).toBeGreaterThanOrEqual(5);
    expect(finals.filter((value) => value >= 89).length).toBeGreaterThanOrEqual(3);
  });
});

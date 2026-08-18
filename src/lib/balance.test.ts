import { describe, expect, it } from "vitest";
import { opponents } from "@/data/opponents";

/**
 * A curva fica abaixo do teto do melhor onze possível, mas os elencos históricos fortes
 * precisam entrar no jogo como favoritos reais, não como times medianos com nome famoso.
 */
describe("balanceamento dos adversários", () => {
  const finals = opponents.map((team) => team.overall.final);
  const media = finals.reduce((sum, value) => sum + value, 0) / finals.length;

  it("mantém a faixa entre 79 e 94", () => {
    const fora = opponents.filter((team) => team.overall.final < 79 || team.overall.final > 94)
      .map((team) => `${team.name} ${team.year}: ${team.overall.final}`);
    expect(fora).toEqual([]);
  });

  it("mantém a média competitiva sem nivelar todos por cima", () => {
    expect(media).toBeGreaterThan(84);
    expect(media).toBeLessThan(89);
  });

  it("distribui a chave entre fracos, médios e fortes", () => {
    expect(finals.filter((value) => value < 84).length).toBeGreaterThanOrEqual(5);
    expect(finals.filter((value) => value >= 91).length).toBeGreaterThanOrEqual(5);
  });

  it("mantém os grandes elencos no topo sem bônus de 99", () => {
    const grandes = [["Flamengo", 2019], ["Santos", 1962], ["São Paulo", 1992], ["Cruzeiro", 2003], ["Palmeiras", 2021]];
    const notas = grandes.map(([name, year]) => opponents.find((team) => team.name === name && team.year === year)?.overall.final);
    expect(notas.every((value) => value !== undefined && value >= 91)).toBe(true);
    expect(Math.max(...finals)).toBeLessThanOrEqual(94);
  });
});

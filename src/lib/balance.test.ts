import { describe, expect, it } from "vitest";
import { opponents } from "@/data/opponents";
import { createBracket, getCurrentUserMatch, resolveCurrentRound } from "@/lib/bracket";
import { seededRandom, simulateMatch } from "@/lib/simulation";
import type { Player, TeamSnapshot } from "@/types/game";

const clampRating = (value: number) => Math.max(0, Math.min(99, Math.round(value)));

function userAt(target: number): TeamSnapshot {
  const source = opponents.find((team) => team.name === "Palmeiras" && team.year === 1972)!;
  const delta = target - source.overall.final;
  const lineup = source.lineup.map((player): Player => ({
    ...player,
    id: `user-${player.id}`,
    personId: `user-${player.personId}`,
    overall: clampRating(player.overall + delta),
    attributes: {
      finishing: clampRating(player.attributes.finishing + delta),
      creation: clampRating(player.attributes.creation + delta),
      pace: clampRating(player.attributes.pace + delta),
      physical: clampRating(player.attributes.physical + delta),
      defending: clampRating(player.attributes.defending + delta),
      positioning: clampRating(player.attributes.positioning + delta),
      reflexes: clampRating(player.attributes.reflexes + delta),
    },
    styleFit: {
      balanced: clampRating(player.styleFit.balanced + delta),
      attacking: clampRating(player.styleFit.attacking + delta),
      defensive: clampRating(player.styleFit.defensive + delta),
      pressing: clampRating(player.styleFit.pressing + delta),
    },
  }));
  const shiftSector = (value: number) => clampRating(value + delta);
  return {
    ...source,
    id: "user-team",
    name: "Preto no Branco",
    year: 2026,
    isUser: true,
    lineup,
    overall: {
      ...source.overall,
      final: target,
      base: shiftSector(source.overall.base),
      goalkeeper: shiftSector(source.overall.goalkeeper),
      defense: shiftSector(source.overall.defense),
      midfield: shiftSector(source.overall.midfield),
      attack: shiftSector(source.overall.attack),
    },
  };
}

/**
 * A curva fica abaixo do teto do melhor onze possível, mas os elencos históricos fortes
 * precisam entrar no jogo como favoritos reais, não como times medianos com nome famoso.
 */
describe("balanceamento dos adversários", () => {
  const finals = opponents.map((team) => team.overall.final);
  const media = finals.reduce((sum, value) => sum + value, 0) / finals.length;

  it("mantém a escala histórica entre 80 e 93", () => {
    const fora = opponents.filter((team) => team.overall.final < 80 || team.overall.final > 93)
      .map((team) => `${team.name} ${team.year}: ${team.overall.final}`);
    expect(fora).toEqual([]);
  });

  it("mantém a média competitiva sem nivelar todos por cima", () => {
    expect(media).toBeGreaterThan(86);
    expect(media).toBeLessThan(90);
  });

  it("distribui a chave entre fracos, médios e fortes", () => {
    expect(finals.filter((value) => value <= 83).length).toBeGreaterThanOrEqual(3);
    expect(finals.filter((value) => value >= 84 && value <= 88).length).toBeGreaterThanOrEqual(10);
    expect(finals.filter((value) => value >= 89).length).toBeGreaterThanOrEqual(8);
  });

  it("mantém os grandes elencos no topo sem bônus de 99", () => {
    const grandes = [["Flamengo", 2019], ["Santos", 1962], ["São Paulo", 1992], ["Cruzeiro", 2003], ["Palmeiras", 2021]];
    const notas = grandes.map(([name, year]) => opponents.find((team) => team.name === name && team.year === year)?.overall.final);
    expect(notas.every((value) => value !== undefined && value >= 91)).toBe(true);
    expect(Math.max(...finals)).toBeLessThanOrEqual(93);
  });

  it("preserva zebra e favoritismo entre elencos 87–92 e três faixas rivais", () => {
    const rivals = [
      opponents.find((team) => team.name === "Coritiba" && team.year === 1985)!,
      opponents.find((team) => team.name === "Cruzeiro" && team.year === 2014)!,
      opponents.find((team) => team.name === "Cruzeiro" && team.year === 2003)!,
    ];
    const wins = [87, 90, 92].map((rating) => rivals.map((rival) => {
      const user = userAt(rating);
      let total = 0;
      for (let seed = 1; seed <= 60; seed += 1) {
        if (simulateMatch(user, rival, seededRandom(seed * 101 + rating)).winnerId === user.id) total += 1;
      }
      return total;
    }));

    for (const row of wins) {
      expect(row[0]).toBeGreaterThan(row[1]);
      expect(row[1]).toBeGreaterThan(row[2]);
      expect(row[0]).toBeLessThan(60);
      expect(row[2]).toBeGreaterThan(0);
    }
    expect(wins[2][2]).toBeGreaterThan(wins[0][2]);
  });

  it("produz títulos e eliminações em mata-matas completos", () => {
    let titles = 0;
    let eliminations = 0;
    for (const rating of [87, 90, 92]) {
      for (let seed = 1; seed <= 8; seed += 1) {
        let bracket = createBracket(userAt(rating), seededRandom(rating * 100 + seed));
        for (let round = 0; round < 4; round += 1) {
          const match = getCurrentUserMatch(bracket);
          if (!match) break;
          const result = simulateMatch(match.home, match.away, seededRandom(rating * 1000 + seed * 10 + round), { halftime: round % 2 ? "press" : "keep" });
          bracket = resolveCurrentRound(bracket, result, seededRandom(rating + seed + round));
          if (result.winnerId !== "user-team") break;
        }
        if (bracket.champion?.isUser) titles += 1;
        else eliminations += 1;
      }
    }
    expect(titles).toBeGreaterThan(0);
    expect(eliminations).toBeGreaterThan(0);
  });
});

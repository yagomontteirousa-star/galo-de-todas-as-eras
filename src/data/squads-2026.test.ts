import { describe, expect, it } from "vitest";
import { atleticoSquads } from "@/data/atletico-squads";
import { opponents } from "@/data/opponents";

describe("novas eras históricas", () => {
  it("inclui as quatro novas opções do Galo", () => {
    expect([2008, 2018, 2025, 2026].every((year) => atleticoSquads.some((squad) => squad.year === year))).toBe(true);
  });

  it("preserva as notas editoriais aprovadas para 2026", () => {
    const squad = atleticoSquads.find((item) => item.year === 2026)!;
    const rating = (name: string) => squad.players.find((player) => player.name === name)?.overall;
    expect(rating("Lyanco")).toBe(88);
    expect(rating("Renan Lodi")).toBe(89);
    expect(rating("Fred")).toBe(89);
    expect(rating("Dudu")).toBe(84);
    expect(squad.players.some((player) => player.name === "Cauã Soares")).toBe(false);
  });

  it("dá estádio a todos os rivais históricos", () => {
    expect(opponents.every((team) => Boolean(team.stadium))).toBe(true);
    expect(opponents.find((team) => team.name === "Grêmio" && team.year === 2017)?.stadium).toBe("Arena do Grêmio");
  });
});

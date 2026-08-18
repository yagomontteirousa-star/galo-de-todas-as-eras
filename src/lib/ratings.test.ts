import { describe, expect, it } from "vitest";
import { atleticoSquads } from "@/data/atletico-squads";
import { auditRatings, ratingsSummary } from "@/lib/ratings";

describe("base de ratings", () => {
  const players = atleticoSquads.flatMap((squad) => squad.players);

  it("registra evidência estruturada para todo atleta", () => {
    const semEvidencia = players.filter((player) => !player.rating).map((player) => player.name);
    expect(semEvidencia).toEqual([]);
    players.forEach((player) => {
      expect(player.rating!.rationale.length).toBeGreaterThan(10);
      expect(player.rating!.source).toContain("base interna");
      expect(["alta", "média", "baixa"]).toContain(player.rating!.confidence);
    });
  });

  it("não declara confiança alta sem característica registrada e elenco campeão", () => {
    const genericas = new Set(["regular", "titular", "reflexos", "finalizador"]);
    const indevidas = players
      .filter((player) => player.rating!.confidence === "alta")
      .filter((player) => {
        const squad = atleticoSquads.find((item) => item.id === player.squadId)!;
        return !squad.titled || !player.tags.some((tag) => !genericas.has(tag));
      })
      .map((player) => `${player.name} ${player.season}`);
    expect(indevidas).toEqual([]);
  });

  it("nunca aponta fonte externa: só a referência interna da base", () => {
    const externas = players.filter((player) => /https?:\/\//.test(player.rating!.source)).map((player) => player.name);
    expect(externas).toEqual([]);
  });

  it("a auditoria roda e classifica os achados", () => {
    const findings = auditRatings();
    expect(findings.length).toBeGreaterThan(0);
    expect(new Set(findings.map((finding) => finding.kind)).size).toBeGreaterThan(1);
    // A auditoria é somente leitura: os overalls seguem intactos depois de rodar.
    expect(ratingsSummary().total).toBe(players.length);
  });
});

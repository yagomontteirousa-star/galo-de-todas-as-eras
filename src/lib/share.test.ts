import { describe, expect, it } from "vitest";
import { campaignUrl, decodeCampaign, encodeCampaign, shareMessage, shareText, type SharedCampaign } from "@/lib/share";

const base: SharedCampaign = {
  outcome: "eliminated", runnerUp: false, round: "quarterfinal", wins: 1, overall: 88,
  formation: "4-3-3", tactic: "Equilibrado",
  squad: [
    { slot: "GOL", name: "Victor", season: 2013, overall: 94, special: true },
    { slot: "ZAG", name: "Réver", season: 2013, overall: 91, special: true },
    { slot: "ATA", name: "Hulk", season: 2021, overall: 94, special: true },
    { slot: "PE", name: "Éder Aleixo", season: 1995, overall: 83, special: false },
  ],
  matches: [
    { round: "round16", user: 2, rival: 0, rivalName: "Coritiba", rivalYear: 1985, won: true, goals: [{ name: "Hulk", minute: 22, forUser: true }] },
    { round: "quarterfinal", user: 1, rival: 3, rivalName: "Cruzeiro", rivalYear: 2003, won: false, goals: [{ name: "Alex", minute: 70, forUser: false }] },
  ],
};

describe("compartilhamento", () => {
  it("volta igual depois de codificar e decodificar", () => {
    expect(decodeCampaign(encodeCampaign(base))).toEqual(base);
  });

  it("sobrevive a acentos e a nomes com espaço", () => {
    const back = decodeCampaign(encodeCampaign(base))!;
    expect(back.squad.map((player) => player.name)).toContain("Éder Aleixo");
    expect(back.tactic).toBe("Equilibrado");
  });

  it("gera um link com segmento seguro para URL", () => {
    const url = campaignUrl(base);
    expect(url.startsWith("https://pretonobranco.app/c/")).toBe(true);
    const payload = url.split("/c/")[1];
    expect(payload).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCampaign(payload)).toEqual(base);
  });

  it("recusa payload ausente, quebrado ou de outro formato", () => {
    expect(decodeCampaign("")).toBeNull();
    expect(decodeCampaign("nao-e-base64!!")).toBeNull();
    expect(decodeCampaign(btoa("{}"))).toBeNull();
    expect(decodeCampaign(btoa(JSON.stringify([99, 1, 0, "final", 4, 90, "4-3-3", "x", [], []])))).toBeNull();
    // fase inexistente e formação inválida têm de cair
    expect(decodeCampaign(btoa(JSON.stringify([1, 0, 0, "oitavas", 1, 88, "4-3-3", "x", [], []])))).toBeNull();
    expect(decodeCampaign(btoa(JSON.stringify([1, 0, 0, "final", 1, 88, "5-5-5", "x", [], []])))).toBeNull();
    // link cortado ao colar
    expect(decodeCampaign(encodeCampaign(base).slice(0, 40))).toBeNull();
  });

  it("escreve a mensagem do campeão", () => {
    const { title, description } = shareMessage({ ...base, outcome: "champion", round: "final", wins: 4 });
    expect(title).toBe("Fui campeão no Preto no Branco");
    expect(description).toContain("conquistei o título");
  });

  it("escreve a mensagem do vice com o time e o ano da decisão", () => {
    const { title, description } = shareMessage({
      ...base, runnerUp: true, round: "final",
      matches: [{ round: "final", user: 0, rival: 2, rivalName: "Flamengo", rivalYear: 2019, won: false, goals: [] }],
    });
    expect(title).toBe("Cheguei à final no Preto no Branco");
    expect(description).toBe("Fui vice-campeão e perdi a decisão para o Flamengo, do ano 2019.");
  });

  it("escreve a mensagem da eliminação com fase, adversário e ano", () => {
    const { title, description } = shareMessage(base);
    expect(title).toBe("Minha campanha no Preto no Branco terminou");
    expect(description).toBe("Fui eliminado nas quartas pelo Cruzeiro, do ano 2003.");
  });

  it("não usa travessão em nenhuma mensagem", () => {
    const variants: SharedCampaign[] = [
      base,
      { ...base, outcome: "champion", round: "final" },
      { ...base, runnerUp: true, round: "final" },
    ];
    variants.forEach((data) => {
      const { title, description } = shareMessage(data);
      expect(`${title} ${description} ${shareText(data, "https://x")}`).not.toMatch(/[—–]/);
    });
  });

  it("põe o link no fim do texto compartilhado", () => {
    const url = campaignUrl(base);
    expect(shareText(base, url).endsWith(url)).toBe(true);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { formations } from "@/data/formations";
import { campaignUrl, decodeCampaign, encodeCampaign, isSharedCampaign, shareMessage, shareText, shortCampaignUrl, type SharedCampaign } from "@/lib/share";

/** Onze completo, na ordem da formação: é assim que a campanha real monta o retrato. */
const eleven = [
  ["Victor", 2013, 94, true], ["Jorge Valença", 1985, 82, false], ["Réver", 2013, 91, true],
  ["Grapete", 1969, 83, true], ["Getúlio", 1969, 80, false], ["Leandro Donizete", 2014, 87, false],
  ["Dátolo", 2014, 86, true], ["Valdir", 1995, 80, false], ["Clayton", 1999, 80, false],
  ["Euller", 1995, 83, true], ["Edivaldo", 1985, 81, false],
] as const;

const base: SharedCampaign = {
  outcome: "eliminated", runnerUp: false, round: "quarterfinal", wins: 1, overall: 84,
  formation: "4-3-3", tactic: "balanced",
  squad: eleven.map(([name, season, overall, special], index) => ({
    slot: formations["4-3-3"].slots[index].label, name, season, overall, special,
  })),
  matches: [
    {
      round: "round16", user: 3, rival: 0, rivalName: "Athletico Paranaense", rivalYear: 2001, won: true,
      goals: [{ name: "Euller", minute: 10, forUser: true }, { name: "Clayton", minute: 40, forUser: true }, { name: "Réver", minute: 81, forUser: true }],
    },
    {
      round: "quarterfinal", user: 0, rival: 2, rivalName: "Internacional", rivalYear: 1975, won: false,
      goals: [{ name: "Escurinho", minute: 30, forUser: false }, { name: "Falcão", minute: 54, forUser: false }],
    },
  ],
};

/** Link real gerado pelo formato antigo, guardado para travar a compatibilidade. */
const LEGACY = "WzEsMCwxLCJmaW5hbCIsMyw5MCwiNC0yLTMtMSIsIkVxdWlsaWJyYWRvIixbWyJHT0wiLCJWaWN0b3IiLDIwMTMsOTQsMV0sWyJaQUciLCJSw6l2ZXIiLDIwMTMsOTEsMV0sWyJBVEEiLCJIdWxrIiwyMDIxLDk0LDFdLFsiUEUiLCLDiWRlciBBbGVpeG8iLDE5OTUsODMsMF1dLFtbImZpbmFsIiwwLDIsIiIsIkZsYW1lbmdvIiwyMDE5LDAsW1siR2FiaWdvbCIsNTUsMF1dXV1d";

describe("compartilhamento", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("aceita o retrato válido e recusa listas ou placares abusivos", () => {
    expect(isSharedCampaign(base)).toBe(true);
    expect(isSharedCampaign({ ...base, matches: Array.from({ length: 5 }, () => base.matches[0]) })).toBe(false);
    expect(isSharedCampaign({ ...base, matches: [{ ...base.matches[0], user: 999 }] })).toBe(false);
  });

  it("não cria link longo quando o store está desligado", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "store-off" }), { status: 501 })));
    await expect(shortCampaignUrl(base)).rejects.toThrow("store-off");
  });

  it("informa quando o limite de links foi atingido sem criar fallback longo", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "muitas-tentativas" }), { status: 429 })));
    await expect(shortCampaignUrl(base)).rejects.toThrow("store-limited");
  });

  it("aceita somente o id curto devolvido pelo servidor", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "Ab3xK9mQ" }), { status: 200 }));
    vi.stubGlobal("fetch", request);
    await expect(shortCampaignUrl(base)).resolves.toBe("https://pretonobranco.app/c/Ab3xK9mQ");
    expect(request).toHaveBeenCalledWith("/api/c", expect.objectContaining({ method: "POST" }));

    request.mockResolvedValueOnce(new Response(JSON.stringify({ id: "payload-muito-longo-e-invalido" }), { status: 200 }));
    await expect(shortCampaignUrl(base)).rejects.toThrow("store-failed");
  });
  it("volta igual depois de codificar e decodificar", async () => {
    expect(await decodeCampaign(await encodeCampaign(base))).toEqual(base);
  });

  it("sobrevive a acentos, espaços e cedilha", async () => {
    const back = (await decodeCampaign(await encodeCampaign(base)))!;
    expect(back.squad.map((player) => player.name)).toContain("Jorge Valença");
    expect(back.squad.map((player) => player.name)).toContain("Dátolo");
    expect(back.matches[1].goals[1].name).toBe("Falcão");
    expect(back.tactic).toBe("balanced");
  });

  it("guarda os pênaltis quando existem, e só então", async () => {
    const comPenaltis: SharedCampaign = {
      ...base,
      matches: [{ ...base.matches[0], pens: { user: 4, rival: 3 } }, base.matches[1]],
    };
    const back = (await decodeCampaign(await encodeCampaign(comPenaltis)))!;
    expect(back.matches[0].pens).toEqual({ user: 4, rival: 3 });
    expect(back.matches[1].pens).toBeUndefined();
  });

  it("preserva o onze do rival enfrentado no snapshot", async () => {
    const rivalSquad = eleven.map(([name, , overall], index) => ({
      position: formations["4-3-3"].slots[index].label,
      name: `Rival ${name}`,
      overall,
    }));
    const withRival: SharedCampaign = {
      ...base,
      matches: [{
        ...base.matches[0],
        rivalFormation: "4-3-3",
        rivalOverall: 89,
        rivalSquad,
      }],
    };
    expect(isSharedCampaign(withRival)).toBe(true);
    expect(await decodeCampaign(await encodeCampaign(withRival))).toEqual(withRival);
    expect(isSharedCampaign({ ...withRival, matches: [{ ...withRival.matches[0], rivalSquad: rivalSquad.slice(0, 10) }] })).toBe(false);
  });

  it("encurta o link de verdade, medindo a mesma campanha nos dois formatos", async () => {
    // Reproduz o formato antigo para a comparação ser do mesmo dado, não de outro exemplo.
    const legacyTuple = [
      1, 0, 0, base.round, base.wins, base.overall, base.formation, "Equilibrado",
      base.squad.map((player) => [player.slot, player.name, player.season, player.overall, player.special ? 1 : 0]),
      base.matches.map((match) => [
        match.round, match.user, match.rival, "", match.rivalName, match.rivalYear, match.won ? 1 : 0,
        match.goals.map((goal) => [goal.name, goal.minute, goal.forUser ? 1 : 0]),
      ]),
    ];
    const antigo = Buffer.from(JSON.stringify(legacyTuple), "utf8").toString("base64").replace(/=+$/, "");
    const novo = await encodeCampaign(base);
    expect(novo.length).toBeLessThan(antigo.length * 0.6);
    expect((await campaignUrl(base)).length).toBeLessThan(400);
  });

  it("gera um link com segmento seguro para URL", async () => {
    const url = await campaignUrl(base);
    expect(url.startsWith("https://pretonobranco.app/c/")).toBe(true);
    const payload = url.split("/c/")[1];
    expect(payload).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await decodeCampaign(payload)).toEqual(base);
  });

  it("continua abrindo um link do formato antigo", async () => {
    const antigo = (await decodeCampaign(LEGACY))!;
    expect(antigo).not.toBeNull();
    expect(antigo.runnerUp).toBe(true);
    expect(antigo.round).toBe("final");
    expect(antigo.formation).toBe("4-2-3-1");
    expect(antigo.tactic).toBe("balanced");
    expect(antigo.squad.map((player) => player.name)).toEqual(["Victor", "Réver", "Hulk", "Éder Aleixo"]);
    expect(antigo.matches[0].rivalName).toBe("Flamengo");
    expect(antigo.matches[0].goals[0]).toEqual({ name: "Gabigol", minute: 55, forUser: false });
    expect(shareMessage(antigo).title).toBe("Cheguei à final no Preto no Branco");
  });

  it("recusa payload ausente, quebrado ou de outro formato", async () => {
    expect(await decodeCampaign("")).toBeNull();
    expect(await decodeCampaign("nao-e-base64!!")).toBeNull();
    expect(await decodeCampaign(btoa("{}"))).toBeNull();
    // versão desconhecida no formato antigo
    expect(await decodeCampaign(btoa(JSON.stringify([99, 1, 0, "final", 4, 90, "4-3-3", "x", [], []])))).toBeNull();
    // fase e formação inválidas
    expect(await decodeCampaign(btoa(JSON.stringify([1, 0, 0, "oitavas", 1, 88, "4-3-3", "x", [], []])))).toBeNull();
    expect(await decodeCampaign(btoa(JSON.stringify([1, 0, 0, "final", 1, 88, "5-5-5", "x", [], []])))).toBeNull();
    // link cortado ao colar, nos dois formatos
    expect(await decodeCampaign(LEGACY.slice(0, 40))).toBeNull();
    expect(await decodeCampaign((await encodeCampaign(base)).slice(0, 20))).toBeNull();
    // formato novo com índices fora da tabela
    expect(await decodeCampaign("2" + btoa("0|0|9|1|88|0|0||"))).toBeNull();
  });

  it("escreve a mensagem do campeão", async () => {
    const { title, description } = shareMessage({ ...base, outcome: "champion", round: "final", wins: 4 });
    expect(title).toBe("Fui campeão no Preto no Branco");
    expect(description).toContain("conquistei o título");
  });

  it("escreve a mensagem do vice com o time e o ano da decisão", async () => {
    const { title, description } = shareMessage({
      ...base, runnerUp: true, round: "final",
      matches: [{ round: "final", user: 0, rival: 2, rivalName: "Flamengo", rivalYear: 2019, won: false, goals: [] }],
    });
    expect(title).toBe("Cheguei à final no Preto no Branco");
    expect(description).toBe("Fui vice-campeão e perdi a decisão para o Flamengo, do ano 2019.");
  });

  it("escreve a mensagem da eliminação com fase, adversário e ano", async () => {
    const { title, description } = shareMessage(base);
    expect(title).toBe("Minha campanha no Preto no Branco terminou");
    expect(description).toBe("Fui eliminado nas quartas pelo Internacional, do ano 1975.");
  });

  it("não usa travessão em nenhuma mensagem", async () => {
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

  it("põe o link no fim do texto compartilhado", async () => {
    const url = await campaignUrl(base);
    expect(shareText(base, url).endsWith(url)).toBe(true);
  });
});

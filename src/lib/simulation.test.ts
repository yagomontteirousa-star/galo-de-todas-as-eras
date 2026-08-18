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

  it("a postura do intervalo muda o segundo tempo, e só ele", () => {
    const segundoTempo = (result: ReturnType<typeof simulateMatch>) =>
      JSON.stringify(result.events.filter((event) => event.minute > 45).map((event) => `${event.minute}${event.type}${event.description}`));
    const primeiroTempo = (result: ReturnType<typeof simulateMatch>) =>
      JSON.stringify(result.events.filter((event) => event.minute <= 45));

    // Numa semente isolada as posturas podem coincidir; o que não pode é nunca mudarem.
    let mudaram = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      const atacar = simulateMatch(opponents[0], opponents[1], seededRandom(seed), { halftime: "attack" });
      const defender = simulateMatch(opponents[0], opponents[1], seededRandom(seed), { halftime: "defend" });
      if (segundoTempo(atacar) !== segundoTempo(defender)) mudaram += 1;
      // o primeiro tempo já aconteceu: a decisão não pode reescrevê-lo em nenhuma semente
      expect(primeiroTempo(atacar)).toBe(primeiroTempo(defender));
    }
    expect(mudaram).toBeGreaterThan(10);

    // e a leitura pós-jogo conta ao jogador o que a decisão provocou
    const atacar = simulateMatch(opponents[0], opponents[1], seededRandom(7), { halftime: "attack" });
    const defender = simulateMatch(opponents[0], opponents[1], seededRandom(7), { halftime: "defend" });
    expect(atacar.instructionImpact).toBeTruthy();
    expect(atacar.instructionImpact).not.toBe(defender.instructionImpact);
  });

  it("empurra o time para frente ao atacar e o segura ao defender", () => {
    // Média sobre muitos jogos: atacar tem de produzir mais gols do que defender.
    const golsNoSegundoTempo = (halftime: "attack" | "defend") => {
      let total = 0;
      for (let seed = 1; seed <= 150; seed += 1) {
        const result = simulateMatch(opponents[0], opponents[1], seededRandom(seed), { halftime });
        total += result.events.filter((event) => event.type === "goal" && event.minute > 45).length;
      }
      return total;
    };
    expect(golsNoSegundoTempo("attack")).toBeGreaterThan(golsNoSegundoTempo("defend"));
  });

  it("bate os pênaltis alternando e para quando o placar já está definido", () => {
    let disputas = 0;
    for (let seed = 1; seed <= 400 && disputas < 12; seed += 1) {
      const result = simulateMatch(opponents[0], opponents[1], seeded(seed));
      if (!result.wentToPenalties) continue;
      disputas += 1;
      const kicks = result.penaltyKicks!;
      expect(kicks.length).toBeGreaterThan(0);
      // alterna os lados dentro de cada rodada
      kicks.forEach((kick, index) => expect(kick.side).toBe(index % 2 === 0 ? "home" : "away"));
      // o placar de cada cobrança bate com o acumulado
      let home = 0;
      let away = 0;
      kicks.forEach((kick) => {
        if (kick.scored) { if (kick.side === "home") home += 1; else away += 1; }
        expect(kick.homeScore).toBe(home);
        expect(kick.awayScore).toBe(away);
      });
      expect(result.homePenalties).toBe(home);
      expect(result.awayPenalties).toBe(away);
      expect(home).not.toBe(away);
      // ninguém bate mais de 5 antes da morte súbita
      const regulares = kicks.filter((kick) => !kick.suddenDeath);
      expect(regulares.filter((kick) => kick.side === "home").length).toBeLessThanOrEqual(5);
      expect(regulares.filter((kick) => kick.side === "away").length).toBeLessThanOrEqual(5);
    }
    expect(disputas).toBeGreaterThan(0);
  });

  it("não coloca o goleiro em lances que não são dele", () => {
    const home = opponents[0];
    const away = opponents[5];
    const keepers = new Set([...home.lineup, ...away.lineup].filter((player) => player.primaryPosition === "GK").map((player) => player.name));
    // O goleiro só protagoniza reposição e defesa; nunca pressão, chute, impedimento ou gol.
    const proibidos = new Set(["pressure", "shot_off", "shot_saved", "offside", "goal", "corner"]);
    const infracoes: string[] = [];
    for (let seed = 1; seed <= 60; seed += 1) {
      for (const event of simulateMatch(home, away, seeded(seed)).events) {
        if (event.playerName && keepers.has(event.playerName) && proibidos.has(event.type)) {
          infracoes.push(`${event.type}: ${event.description}`);
        }
      }
    }
    expect(infracoes).toEqual([]);
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

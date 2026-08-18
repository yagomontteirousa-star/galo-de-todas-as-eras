import { atleticoSquads } from "@/data/atletico-squads";
import type { HistoricalSquad, Player, Position } from "@/types/game";

/**
 * Auditoria da base de ratings. Só lê: nenhum overall é reescrito aqui, porque mexer nos
 * números sem medir o efeito na chave quebraria o equilíbrio travado por `balance.test.ts`.
 */
export interface RatingFinding { kind: string; player: string; season: number; detail: string }

/** Posições que disputam a mesma vaga, para comparar quem é de fato comparável. */
const positionGroup: Record<Position, string> = {
  GK: "goleiro", CB: "zaga", LB: "lateral", RB: "lateral", LWB: "lateral", RWB: "lateral",
  DM: "volante", CM: "meia", AM: "meia", LW: "ponta", RW: "ponta", ST: "atacante",
};

/** Décadas mantêm as comparações dentro do mesmo contexto de futebol. */
const eraOf = (year: number) => `${Math.floor(year / 10) * 10}s`;

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

function deviation(values: number[]): number {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

const starters = (squad: HistoricalSquad) =>
  new Set([...squad.players].sort((left, right) => right.overall - left.overall).slice(0, 11).map((player) => player.id));

export function auditRatings(squads: HistoricalSquad[] = atleticoSquads): RatingFinding[] {
  const all = squads.flatMap((squad) => squad.players);
  const findings: RatingFinding[] = [];
  const note = (kind: string, player: Player, detail: string) =>
    findings.push({ kind, player: player.name, season: player.season, detail });

  // 1. Discrepantes: fora de dois desvios dentro da mesma posição e década.
  const buckets = new Map<string, Player[]>();
  all.forEach((player) => {
    const key = `${positionGroup[player.primaryPosition]}·${eraOf(player.season)}`;
    buckets.set(key, [...(buckets.get(key) ?? []), player]);
  });
  buckets.forEach((players, key) => {
    if (players.length < 4) return;
    const values = players.map((player) => player.overall);
    const average = mean(values);
    const spread = deviation(values);
    if (spread === 0) return;
    players
      .filter((player) => Math.abs(player.overall - average) > spread * 2)
      .forEach((player) => note("discrepante", player,
        `${player.overall} contra média ${average.toFixed(1)} em ${key} (desvio ${spread.toFixed(1)})`));
  });

  // 2. Pouca informação: a própria base declara confiança baixa.
  all.filter((player) => player.rating?.confidence === "baixa")
    .forEach((player) => note("pouca-informacao", player, `overall ${player.overall} sem sinal que o sustente`));

  // 3. Reservas altas demais: fora dos onze e ainda assim colado no titular da mesma posição.
  squads.forEach((squad) => {
    const titulares = starters(squad);
    squad.players.filter((player) => !titulares.has(player.id)).forEach((reserve) => {
      const rival = squad.players
        .filter((player) => titulares.has(player.id) && positionGroup[player.primaryPosition] === positionGroup[reserve.primaryPosition])
        .sort((left, right) => right.overall - left.overall)[0];
      if (rival && reserve.overall >= rival.overall - 1) {
        note("reserva-alta", reserve, `${reserve.overall} contra ${rival.name} (${rival.overall}), titular na mesma função`);
      }
    });
  });

  // 4. Ídolos abaixo do esperado: característica própria registrada, mas nota de coadjuvante.
  squads.forEach((squad) => {
    const average = mean(squad.players.map((player) => player.overall));
    squad.players
      .filter((player) => player.rating?.confidence !== "baixa" && player.overall < average)
      .filter((player) => player.tags.some((tag) => ["gênio", "decisivo", "artilheiro", "maestro", "liderança", "capitão", "santo"].includes(tag)))
      .forEach((player) => note("idolo-baixo", player, `${player.overall} abaixo da média ${average.toFixed(1)} do próprio elenco`));
  });

  // 5. Distância injustificada entre pares diretos da mesma posição e temporada.
  squads.forEach((squad) => {
    const groups = new Map<string, Player[]>();
    squad.players.forEach((player) => {
      const key = positionGroup[player.primaryPosition];
      groups.set(key, [...(groups.get(key) ?? []), player]);
    });
    groups.forEach((players, key) => {
      if (players.length < 2) return;
      const sorted = [...players].sort((left, right) => right.overall - left.overall);
      sorted.slice(0, -1).forEach((player, index) => {
        const next = sorted[index + 1];
        const gap = player.overall - next.overall;
        if (gap >= 10) note("salto-interno", next, `${next.overall} contra ${player.name} (${player.overall}), ${gap} pontos em ${key}`);
      });
    });
  });

  return findings;
}

export function ratingsSummary(squads: HistoricalSquad[] = atleticoSquads) {
  const all = squads.flatMap((squad) => squad.players);
  const byConfidence = (level: string) => all.filter((player) => player.rating?.confidence === level).length;
  return {
    total: all.length,
    alta: byConfidence("alta"),
    media: byConfidence("média"),
    baixa: byConfidence("baixa"),
    min: Math.min(...all.map((player) => player.overall)),
    max: Math.max(...all.map((player) => player.overall)),
    media_overall: Number(mean(all.map((player) => player.overall)).toFixed(1)),
  };
}

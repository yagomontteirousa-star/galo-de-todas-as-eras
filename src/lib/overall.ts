import { formations } from "@/data/formations";
import type { FormationId, FormationSlot, Player, Position, PositionFit, Sector, TacticId, TeamOverall } from "@/types/game";

export interface PositionedPlayer { slotId: string; player: Player }

const positionSector: Record<Position, Sector> = {
  GK: "goalkeeper", CB: "defense", LB: "defense", RB: "defense", LWB: "midfield", RWB: "midfield",
  DM: "midfield", CM: "midfield", AM: "midfield", LW: "attack", RW: "attack", ST: "attack",
};

const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function evaluatePosition(player: Player, slot: FormationSlot): { fit: PositionFit; penalty: number } {
  if (player.primaryPosition === slot.position) return { fit: "natural", penalty: 0 };
  if (player.secondaryPositions.includes(slot.position)) return { fit: "secondary", penalty: 2 };
  const sameSector = positionSector[player.primaryPosition] === slot.sector;
  const goalkeeperMismatch = player.primaryPosition === "GK" || slot.position === "GK";
  return { fit: "improvised", penalty: goalkeeperMismatch ? 14 : sameSector ? 6 : 9 };
}

export function calculateTeamOverall(positioned: PositionedPlayer[], formationId: FormationId, tactic: TacticId): TeamOverall {
  const formation = formations[formationId];
  const evaluations = positioned.map(({ slotId, player }) => {
    const slot = formation.slots.find((item) => item.id === slotId);
    if (!slot) throw new Error(`Posição inválida: ${slotId}`);
    const { fit, penalty } = evaluatePosition(player, slot);
    return { player, slot, fit, penalty, adjustedOverall: clamp(player.overall - penalty, 40, 99) };
  });

  const sectorAverage = (sector: Sector) => Math.round(average(evaluations.filter((entry) => entry.slot.sector === sector).map((entry) => entry.adjustedOverall)));
  const goalkeeper = sectorAverage("goalkeeper");
  const defense = sectorAverage("defense");
  const midfield = sectorAverage("midfield");
  const attack = sectorAverage("attack");
  const presentSectors = [goalkeeper, defense, midfield, attack].filter(Boolean);
  const base = Math.round(goalkeeper * 0.1 + defense * 0.31 + midfield * 0.32 + attack * 0.27);
  const styleAverage = average(evaluations.map((entry) => entry.player.styleFit[tactic]));
  const naturalCount = evaluations.filter((entry) => entry.fit === "natural").length;
  const secondaryCount = evaluations.filter((entry) => entry.fit === "secondary").length;
  const cohesion = Math.round(clamp(((naturalCount + secondaryCount * 0.55) / 11) * 4 - 2, -2, 2));
  const tacticBonus = Math.round(clamp((styleAverage - 78) / 8 + formation.tacticAffinity[tactic] / 2, -1, 3));
  const improvisationPenalty = Math.round(clamp(evaluations.reduce((sum, entry) => sum + entry.penalty, 0) / 6, 0, 7));
  const spread = presentSectors.length ? Math.max(...presentSectors) - Math.min(...presentSectors) : 0;
  const balancePenalty = spread > 15 ? 3 : spread > 10 ? 2 : spread > 7 ? 1 : 0;
  const final = Math.round(clamp(base + cohesion + tacticBonus - improvisationPenalty - balancePenalty, 60, 99));

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const strongest = Math.max(defense, midfield, attack);
  if (attack === strongest) strengths.push("Poder de decisão no último terço");
  if (midfield === strongest) strengths.push("Controle e criação no meio-campo");
  if (defense === strongest) strengths.push("Estrutura defensiva confiável");
  if (styleAverage >= 86) strengths.push("Alta adesão ao perfil tático");
  if (improvisationPenalty >= 2) weaknesses.push("Improvisações reduzem a estabilidade");
  if (balancePenalty >= 2) weaknesses.push("Há uma diferença sensível entre os setores");
  if (defense && defense < 80) weaknesses.push("A linha defensiva pode sofrer sob pressão");
  if (attack && attack < 80) weaknesses.push("Falta poder de fogo contra blocos fechados");
  if (!weaknesses.length) weaknesses.push("O risco está nos detalhes de cada confronto");
  if (!strengths.length) strengths.push("Equipe funcional e sem dependência de um único setor");

  return { final, base, goalkeeper, defense, midfield, attack, cohesion, tacticBonus, improvisationPenalty, balancePenalty, evaluations, strengths, weaknesses };
}

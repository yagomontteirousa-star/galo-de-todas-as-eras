import { formations } from "@/data/formations";
import type { SharedMatch, SharedRivalPlayer, TeamSnapshot } from "@/types/game";

export interface RivalRosterData {
  name: string;
  year: number;
  formation: TeamSnapshot["formation"];
  overall: number;
  squad: SharedRivalPlayer[];
}

/** Ordena o rival pelas vagas da formação, não pela força, para preservar o onze histórico. */
export function rivalRosterFromTeam(team: TeamSnapshot): RivalRosterData {
  const order = formations[team.formation].slots;
  const squad = [...team.overall.evaluations]
    .sort((left, right) => order.findIndex((slot) => slot.id === left.slot.id)
      - order.findIndex((slot) => slot.id === right.slot.id))
    .map((entry) => ({
      position: entry.slot.label,
      name: entry.player.name,
      overall: entry.adjustedOverall,
    }));

  return { name: team.name, year: team.year, formation: team.formation, overall: team.overall.final, squad };
}

/** Links antigos não têm o onze rival; nesse caso a interface simplesmente não promete o dado. */
export function rivalRosterFromShared(match: SharedMatch): RivalRosterData | null {
  if (!match.rivalFormation || match.rivalOverall === undefined || !match.rivalSquad?.length) return null;
  return {
    name: match.rivalName,
    year: match.rivalYear,
    formation: match.rivalFormation,
    overall: match.rivalOverall,
    squad: match.rivalSquad,
  };
}

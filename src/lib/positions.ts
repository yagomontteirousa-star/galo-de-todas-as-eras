import type { Position } from "@/types/game";

/** Siglas usadas na leitura de jogo, sempre em português. */
export const positionLabels: Record<Position, string> = {
  GK: "GOL",
  CB: "ZAG",
  LB: "LE",
  RB: "LD",
  LWB: "ALA",
  RWB: "ALA",
  DM: "VOL",
  CM: "MC",
  AM: "MEI",
  LW: "PE",
  RW: "PD",
  ST: "ATA",
};

export const positionLabel = (position: Position) => positionLabels[position];

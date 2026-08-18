import type { Attributes, Position, TacticId } from "@/types/game";

const clamp = (value: number) => Math.max(0, Math.min(99, Math.round(value)));

/**
 * Converte o overall editorial em atributos de posição. Atlético e adversários usam
 * exatamente esta régua; o clube de origem não altera o perfil nem o encaixe tático.
 */
export function attributesForOverall(position: Position, overall: number): Attributes {
  const delta = overall - 80;
  const profiles: Record<Position, Attributes> = {
    GK: { finishing: 8, creation: 42, pace: 40, physical: 75, defending: 30, positioning: 84, reflexes: 86 },
    CB: { finishing: 38, creation: 57, pace: 68, physical: 84, defending: 86, positioning: 82, reflexes: 0 },
    LB: { finishing: 52, creation: 72, pace: 82, physical: 76, defending: 77, positioning: 78, reflexes: 0 },
    RB: { finishing: 52, creation: 72, pace: 82, physical: 76, defending: 77, positioning: 78, reflexes: 0 },
    LWB: { finishing: 61, creation: 76, pace: 84, physical: 77, defending: 70, positioning: 78, reflexes: 0 },
    RWB: { finishing: 61, creation: 76, pace: 84, physical: 77, defending: 70, positioning: 78, reflexes: 0 },
    DM: { finishing: 55, creation: 75, pace: 70, physical: 82, defending: 83, positioning: 83, reflexes: 0 },
    CM: { finishing: 68, creation: 84, pace: 73, physical: 76, defending: 71, positioning: 82, reflexes: 0 },
    AM: { finishing: 78, creation: 88, pace: 79, physical: 68, defending: 42, positioning: 85, reflexes: 0 },
    LW: { finishing: 80, creation: 84, pace: 87, physical: 69, defending: 38, positioning: 84, reflexes: 0 },
    RW: { finishing: 80, creation: 84, pace: 87, physical: 69, defending: 38, positioning: 84, reflexes: 0 },
    ST: { finishing: 89, creation: 72, pace: 80, physical: 83, defending: 30, positioning: 88, reflexes: 0 },
  };
  return Object.fromEntries(Object.entries(profiles[position]).map(([key, value]) => [key, clamp(value + delta)])) as unknown as Attributes;
}

export function styleFitFor(attributes: Attributes): Record<TacticId, number> {
  return {
    balanced: clamp((attributes.positioning + attributes.creation + attributes.physical) / 3),
    attacking: clamp((attributes.finishing + attributes.creation + attributes.pace) / 3),
    defensive: clamp((attributes.defending + attributes.positioning + attributes.physical) / 3),
    pressing: clamp((attributes.pace + attributes.physical + attributes.positioning) / 3),
  };
}

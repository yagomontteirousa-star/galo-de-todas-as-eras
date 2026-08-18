import type { Formation, FormationId, FormationSlot, Position, Sector, TacticId } from "@/types/game";

const slot = (id: string, label: string, position: Position, sector: Sector, x: number, y: number): FormationSlot => ({ id, label, position, sector, x, y });
const affinity = (balanced: number, attacking: number, defensive: number, pressing: number): Record<TacticId, number> => ({ balanced, attacking, defensive, pressing });

export const formations: Record<FormationId, Formation> = {
  "4-3-3": {
    id: "4-3-3", name: "4-3-3", description: "Amplitude, criação por dentro e três referências no último terço.", tacticAffinity: affinity(2, 3, 0, 2),
    slots: [
      slot("gk", "GOL", "GK", "goalkeeper", 50, 89), slot("lb", "LE", "LB", "defense", 16, 69), slot("lcb", "ZAG", "CB", "defense", 38, 73),
      slot("rcb", "ZAG", "CB", "defense", 62, 73), slot("rb", "LD", "RB", "defense", 84, 69), slot("dm", "VOL", "DM", "midfield", 50, 53),
      slot("lcm", "MC", "CM", "midfield", 31, 43), slot("rcm", "MC", "CM", "midfield", 69, 43), slot("lw", "PE", "LW", "attack", 18, 20),
      slot("st", "ATA", "ST", "attack", 50, 13), slot("rw", "PD", "RW", "attack", 82, 20),
    ],
  },
  "4-4-2": {
    id: "4-4-2", name: "4-4-2", description: "Duas linhas sólidas e dupla de ataque com presença de área.", tacticAffinity: affinity(3, 1, 2, 1),
    slots: [
      slot("gk", "GOL", "GK", "goalkeeper", 50, 89), slot("lb", "LE", "LB", "defense", 16, 69), slot("lcb", "ZAG", "CB", "defense", 38, 73),
      slot("rcb", "ZAG", "CB", "defense", 62, 73), slot("rb", "LD", "RB", "defense", 84, 69), slot("lm", "ME", "LW", "midfield", 17, 44),
      slot("lcm", "MC", "CM", "midfield", 39, 49), slot("rcm", "MC", "CM", "midfield", 61, 49), slot("rm", "MD", "RW", "midfield", 83, 44),
      slot("lst", "ATA", "ST", "attack", 37, 18), slot("rst", "ATA", "ST", "attack", 63, 18),
    ],
  },
  "4-2-3-1": {
    id: "4-2-3-1", name: "4-2-3-1", description: "Proteção central, um articulador e pontas atacando o espaço.", tacticAffinity: affinity(3, 2, 2, 2),
    slots: [
      slot("gk", "GOL", "GK", "goalkeeper", 50, 89), slot("lb", "LE", "LB", "defense", 16, 69), slot("lcb", "ZAG", "CB", "defense", 38, 73),
      slot("rcb", "ZAG", "CB", "defense", 62, 73), slot("rb", "LD", "RB", "defense", 84, 69), slot("ldm", "VOL", "DM", "midfield", 38, 54),
      slot("rdm", "VOL", "DM", "midfield", 62, 54), slot("lw", "PE", "LW", "midfield", 18, 33), slot("am", "MEI", "AM", "midfield", 50, 36),
      slot("rw", "PD", "RW", "midfield", 82, 33), slot("st", "ATA", "ST", "attack", 50, 14),
    ],
  },
  "3-5-2": {
    id: "3-5-2", name: "3-5-2", description: "Superioridade no meio e alas com grande responsabilidade física.", tacticAffinity: affinity(1, 2, 3, 2),
    slots: [
      slot("gk", "GOL", "GK", "goalkeeper", 50, 89), slot("lcb", "ZAG", "CB", "defense", 27, 70), slot("cb", "ZAG", "CB", "defense", 50, 75),
      slot("rcb", "ZAG", "CB", "defense", 73, 70), slot("lwb", "ALA", "LWB", "midfield", 13, 46), slot("ldm", "VOL", "DM", "midfield", 37, 54),
      slot("rdm", "MC", "CM", "midfield", 63, 54), slot("rwb", "ALA", "RWB", "midfield", 87, 46), slot("am", "MEI", "AM", "midfield", 50, 35),
      slot("lst", "ATA", "ST", "attack", 36, 16), slot("rst", "ATA", "ST", "attack", 64, 16),
    ],
  },
};

/**
 * Cada perfil desloca as linhas sem mexer na estrutura da formação: o eixo y cresce
 * na direção do próprio gol, então valor positivo recua e negativo adianta.
 */
type Shape = { defense: number; midfield: number; attack: number; width: number };

const tacticShape: Record<TacticId, Shape> = {
  balanced: { defense: 0, midfield: 0, attack: 0, width: 0 },
  defensive: { defense: 4, midfield: 7, attack: 5, width: -4 },
  attacking: { defense: -5, midfield: -6, attack: -4, width: 4 },
  pressing: { defense: -8, midfield: -5, attack: -2, width: 1 },
};

const clampAxis = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Mesmos onze jogadores e as mesmas funções, só que mais recuados ou mais adiantados. */
export function tacticalSlots(formationId: FormationId, tactic?: TacticId): FormationSlot[] {
  const slots = formations[formationId].slots;
  if (!tactic || tactic === "balanced") return slots;
  const shape = tacticShape[tactic];
  return slots.map((slot) => {
    if (slot.sector === "goalkeeper") return slot;
    const dx = slot.x < 40 ? -shape.width : slot.x > 60 ? shape.width : 0;
    return { ...slot, x: clampAxis(slot.x + dx, 9, 91), y: clampAxis(slot.y + shape[slot.sector], 9, 84) };
  });
}

export const tacticLabels: Record<TacticId, { name: string; description: string; risk: string }> = {
  balanced: { name: "Equilibrado", description: "Distribui força entre os setores.", risk: "Poucos extremos, poucas brechas." },
  attacking: { name: "Ofensivo", description: "Mais presença e criação no ataque.", risk: "Concede espaço às transições." },
  defensive: { name: "Defensivo", description: "Compacta linhas e protege a área.", risk: "Produz menos volume ofensivo." },
  pressing: { name: "Pressão alta", description: "Recupera a bola perto do gol rival.", risk: "Exige físico e expõe a última linha." },
};

import { describe, expect, it } from "vitest";
import { formations, tacticalSlots } from "@/data/formations";
import type { FormationId, TacticId } from "@/types/game";

const ids = Object.keys(formations) as FormationId[];
const tactics: TacticId[] = ["balanced", "attacking", "defensive", "pressing"];
const lineHeight = (formationId: FormationId, tactic: TacticId) => {
  const slots = tacticalSlots(formationId, tactic).filter((slot) => slot.sector !== "goalkeeper");
  return slots.reduce((sum, slot) => sum + slot.y, 0) / slots.length;
};

describe("perfil tático no campo", () => {
  it("preserva a estrutura da formação", () => {
    for (const id of ids) {
      for (const tactic of tactics) {
        const slots = tacticalSlots(id, tactic);
        expect(slots).toHaveLength(11);
        expect(slots.map((slot) => slot.id)).toEqual(formations[id].slots.map((slot) => slot.id));
        expect(slots.map((slot) => slot.position)).toEqual(formations[id].slots.map((slot) => slot.position));
      }
    }
  });

  it("recua no defensivo e adianta no ofensivo", () => {
    for (const id of ids) {
      expect(lineHeight(id, "defensive")).toBeGreaterThan(lineHeight(id, "balanced"));
      expect(lineHeight(id, "attacking")).toBeLessThan(lineHeight(id, "balanced"));
      expect(lineHeight(id, "pressing")).toBeLessThan(lineHeight(id, "balanced"));
    }
  });

  it("mantém todo mundo dentro do campo", () => {
    for (const id of ids) {
      for (const tactic of tactics) {
        for (const slot of tacticalSlots(id, tactic)) {
          expect(slot.x).toBeGreaterThanOrEqual(9);
          expect(slot.x).toBeLessThanOrEqual(91);
          expect(slot.y).toBeGreaterThanOrEqual(9);
          expect(slot.y).toBeLessThanOrEqual(91);
        }
      }
    }
  });

  it("o goleiro não sai do lugar", () => {
    for (const id of ids) {
      const base = formations[id].slots.find((slot) => slot.sector === "goalkeeper")!;
      for (const tactic of tactics) {
        const gk = tacticalSlots(id, tactic).find((slot) => slot.sector === "goalkeeper")!;
        expect([gk.x, gk.y]).toEqual([base.x, base.y]);
      }
    }
  });
});

import { describe, expect, it } from "vitest";
import { looksLikeShareId, newShareId } from "@/lib/share-store";

describe("id curto de compartilhamento", () => {
  it("tem dez caracteres e não é sequencial", () => {
    const ids = Array.from({ length: 400 }, () => newShareId());
    ids.forEach((id) => expect(id).toHaveLength(10));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("evita caracteres que se confundem ao ditar ou digitar", () => {
    const amostra = Array.from({ length: 200 }, () => newShareId()).join("");
    expect(amostra).not.toMatch(/[0O1lI]/);
  });

  it("reconhece o próprio formato e recusa payload longo", () => {
    expect(looksLikeShareId(newShareId())).toBe(true);
    expect(looksLikeShareId("Ab3xK9mQ")).toBe(true);
    expect(looksLikeShareId("3H4sIAAAAAAAAA-1TS27CMBC9")).toBe(false);
    expect(looksLikeShareId("curto")).toBe(false);
    expect(looksLikeShareId("com-hifen-e-longo")).toBe(false);
  });
});

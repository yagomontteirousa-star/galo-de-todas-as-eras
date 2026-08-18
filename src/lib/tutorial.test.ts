import { describe, expect, it } from "vitest";
import { nextTip, TUTORIAL_STEPS, tutorialTips, tutorialTouched } from "@/lib/tutorial";

describe("tutorial", () => {
  it("entrega uma dica por vez e some quando a tela já foi vista", () => {
    const state = { dismissed: false, seen: [] as string[] };
    expect(nextTip(state, "setup")?.id).toBe("mode");
    expect(nextTip({ ...state, seen: ["mode"] }, "setup")).toBeUndefined();
    expect(nextTip({ ...state, seen: ["mode"] }, "draft")?.id).toBe("roster");
    expect(nextTip({ ...state, seen: ["mode", "roster"] }, "draft")?.id).toBe("slots");
  });

  it("não reaparece depois de dispensado", () => {
    expect(nextTip({ dismissed: true, seen: [] }, "setup")).toBeUndefined();
    expect(tutorialTouched({ dismissed: true, seen: [] })).toBe(true);
    expect(tutorialTouched({ dismissed: false, seen: [] })).toBe(false);
  });

  it("numera os passos sem buracos", () => {
    expect(tutorialTips.map((tip) => tip.step)).toEqual(Array.from({ length: TUTORIAL_STEPS }, (_, index) => index + 1));
  });
});

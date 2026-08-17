import { describe, expect, it } from "vitest";
import { appendHistory, createCampaign, hydrateCampaign, toRecord } from "@/lib/campaign";
import type { Campaign } from "@/types/game";

function finished(id: string, outcome: "champion" | "eliminated"): Campaign {
  return { ...createCampaign(), id, wins: 2, outcome, finishedAt: "2026-08-17T12:00:00.000Z", screen: outcome };
}

describe("campanha", () => {
  it("rejeita saves de versões anteriores às oitavas", () => {
    const legacy = JSON.stringify({ ...createCampaign(), version: 1 });
    expect(hydrateCampaign(legacy)).toBeNull();
  });

  it("rejeita chave com fase que não existe mais", () => {
    const stale = JSON.stringify({ ...createCampaign(), bracket: { rounds: [], currentRound: "round32" } });
    expect(hydrateCampaign(stale)).toBeNull();
  });

  it("registra o histórico sem duplicar a mesma campanha", () => {
    const first = toRecord(finished("camp-a", "eliminated"));
    const again = toRecord(finished("camp-a", "champion"));
    const second = toRecord(finished("camp-b", "champion"));
    const history = appendHistory(second, appendHistory(again, appendHistory(first, [])));
    expect(history.map((item) => item.id)).toEqual(["camp-b", "camp-a"]);
    expect(history[1].outcome).toBe("champion");
  });
});

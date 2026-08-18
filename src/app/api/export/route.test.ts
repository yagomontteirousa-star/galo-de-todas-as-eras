import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/export/route";
import type { SharedCampaign } from "@/lib/share";

const base: SharedCampaign = {
  outcome: "eliminated", runnerUp: false, round: "semifinal", wins: 2, overall: 89,
  formation: "4-3-3", tactic: "balanced",
  squad: [
    { slot: "GOL", name: "Victor", season: 2013, overall: 94, special: true },
    { slot: "ATA", name: "Reinaldo", season: 1980, overall: 95, special: true },
  ],
  matches: [{
    round: "semifinal", user: 1, rival: 2, rivalName: "Flamengo", rivalYear: 2019, won: false,
    goals: [{ name: "Reinaldo", minute: 54, forUser: true }],
  }],
};

const pngSize = async (response: Response) => {
  const bytes = new Uint8Array(await response.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { signature: Array.from(bytes.slice(1, 4)), width: view.getUint32(16), height: view.getUint32(20), bytes: bytes.length };
};

describe("PNG da campanha", () => {
  it.each([
    ["campeão", { ...base, outcome: "champion" as const, round: "final" as const, wins: 4 }],
    ["vice", { ...base, runnerUp: true, round: "final" as const, wins: 3 }],
    ["eliminado", base],
  ])("gera %s em 1080 por 1350", async (_label, data) => {
    const response = await POST(new Request("http://localhost/api/export", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/png");
    const image = await pngSize(response);
    expect(image.signature).toEqual([80, 78, 71]);
    expect(image.width).toBe(1080);
    expect(image.height).toBe(1350);
    expect(image.bytes).toBeGreaterThan(30_000);
  }, 20_000);
});

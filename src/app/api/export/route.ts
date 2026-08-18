import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { campaignExportElement } from "@/lib/campaign-export";
import { isSharedCampaign } from "@/lib/share";

export const runtime = "nodejs";

const archiveFont = readFile(join(process.cwd(), "public/fonts/archive-display.ttf"));
const championImage = readFile(join(process.cwd(), "public/champion.jpg"))
  .then((buffer) => `data:image/jpeg;base64,${buffer.toString("base64")}`);

export async function POST(request: Request) {
  try {
    const data: unknown = await request.json();
    if (!isSharedCampaign(data)) return Response.json({ error: "payload-invalido" }, { status: 400 });
    const [font, image] = await Promise.all([archiveFont, championImage]);
    return new ImageResponse(campaignExportElement(data, image), {
      width: 1080,
      height: 1350,
      fonts: [{ name: "Archive", data: font, weight: 400, style: "normal" }],
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="preto-no-branco-${data.outcome}.png"`,
      },
    });
  } catch {
    return Response.json({ error: "falha-ao-gerar" }, { status: 500 });
  }
}

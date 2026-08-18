import { NextResponse } from "next/server";
import { saveSharedCampaign, shareStoreReady } from "@/lib/share-store";
import type { SharedCampaign } from "@/lib/share";

/** Grava o snapshot e devolve o id curto. Sem store configurado responde 501 e o cliente
 *  mantém o link longo, que continua funcionando. */
export async function POST(request: Request) {
  if (!shareStoreReady) {
    return NextResponse.json({ error: "store-off" }, { status: 501 });
  }
  try {
    const data = await request.json() as SharedCampaign;
    if (!data || typeof data.overall !== "number" || !Array.isArray(data.squad)) {
      return NextResponse.json({ error: "payload-invalido" }, { status: 400 });
    }
    const id = await saveSharedCampaign(data);
    return NextResponse.json({ id });
  } catch {
    return NextResponse.json({ error: "falha-ao-salvar" }, { status: 502 });
  }
}

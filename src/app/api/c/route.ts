import { NextResponse } from "next/server";
import { saveSharedCampaign, shareStoreReady, takeShareWriteSlot } from "@/lib/share-store";
import { isSharedCampaign } from "@/lib/share";

/** Grava o snapshot e devolve o id curto. Sem store configurado responde 501; links novos
 *  nunca carregam o snapshot inteiro no endereço. */
export async function POST(request: Request) {
  if (!shareStoreReady) {
    return NextResponse.json({ error: "store-off" }, { status: 501 });
  }
  try {
    if (!(await takeShareWriteSlot())) {
      return NextResponse.json({ error: "muitas-tentativas" }, { status: 429, headers: { "Retry-After": "60" } });
    }
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 250_000) return NextResponse.json({ error: "payload-muito-grande" }, { status: 413 });
    const data: unknown = await request.json();
    if (!isSharedCampaign(data)) {
      return NextResponse.json({ error: "payload-invalido" }, { status: 400 });
    }
    const id = await saveSharedCampaign(data);
    return NextResponse.json({ id });
  } catch {
    return NextResponse.json({ error: "falha-ao-salvar" }, { status: 502 });
  }
}

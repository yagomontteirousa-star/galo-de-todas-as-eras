import type { Metadata } from "next";
import { MultiplayerRoomGame } from "@/components/multiplayer/MultiplayerRoomGame";

export const metadata: Metadata = { title: "Sala multiplayer | Preto no Branco", description: "Entre em uma sala do Preto no Branco e monte seu elenco em tempo real." };
export default async function MultiplayerRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <MultiplayerRoomGame code={code.toUpperCase()}/>;
}

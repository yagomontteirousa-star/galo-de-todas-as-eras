import type { Metadata } from "next";
import { MultiplayerRoomGame } from "@/components/multiplayer/MultiplayerRoomGame";

export const metadata: Metadata = { title: "Sala privada | Preto no Branco", description: "Entre em uma sala privada do Preto no Branco." };
export default async function MultiplayerRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <MultiplayerRoomGame code={code.toUpperCase()}/>;
}

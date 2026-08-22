import type { Metadata } from "next";
import { LocalMultiplayerGame } from "@/components/multiplayer/LocalMultiplayerGame";

export const metadata: Metadata = {
  title: "Multiplayer local | Preto no Branco",
  description: "Monte elencos com amigos no mesmo dispositivo e dispute uma chave histórica.",
};

export default function LocalMultiplayerPage() {
  return <LocalMultiplayerGame/>;
}

import type { Metadata } from "next";
import { MultiplayerEntry } from "@/components/multiplayer/MultiplayerEntry";

export const metadata: Metadata = { title: "Multiplayer privado | Preto no Branco", description: "Crie uma sala privada, monte seu time histórico do Galo e dispute o mata-mata com amigos." };
export default function MultiplayerPage() { return <MultiplayerEntry/>; }

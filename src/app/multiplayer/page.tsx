import type { Metadata } from "next";
import { MultiplayerEntry } from "@/components/multiplayer/MultiplayerEntry";

export const metadata: Metadata = { title: "Jogar com amigos | Preto no Branco", description: "Jogue no mesmo dispositivo ou crie uma sala online para uma final ou um mata-mata histórico." };
export default function MultiplayerPage() { return <MultiplayerEntry/>; }

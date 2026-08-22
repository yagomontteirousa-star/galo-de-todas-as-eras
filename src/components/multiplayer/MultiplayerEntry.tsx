"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  createMultiplayerRoom,
  joinRandomMultiplayerRoom,
  listOpenMultiplayerRooms,
  multiplayerConfigured,
  multiplayerLocalDevelopment,
} from "@/lib/multiplayer/client";
import type { MultiplayerOpenRoom, MultiplayerRoomMode } from "@/types/multiplayer";
import { ArrowIcon } from "@/components/ui/Icons";
import { BrandMark, SiteFooter } from "@/components/ui/Brand";

const modeLabels: Record<MultiplayerRoomMode, string> = { final: "Final direta", knockout: "Mata-mata" };

export function MultiplayerEntry() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<MultiplayerRoomMode>("knockout");
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [password, setPassword] = useState("");
  const [rooms, setRooms] = useState<MultiplayerOpenRoom[]>([]);
  const [roomFilter, setRoomFilter] = useState<"all" | MultiplayerRoomMode>("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!multiplayerConfigured && !multiplayerLocalDevelopment) return;
    let active = true;
    const load = async () => {
      try {
        const next = await listOpenMultiplayerRooms(roomFilter === "all" ? undefined : roomFilter);
        if (active) setRooms(next);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "As salas abertas não puderam ser carregadas.");
      }
    };
    void load();
    const timer = window.setInterval(load, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [roomFilter]);

  const requireNickname = () => {
    if (nickname.trim().length >= 2) return true;
    setError("Escolha um apelido com pelo menos 2 caracteres.");
    return false;
  };
  const create = async () => {
    if (!requireNickname()) return;
    setBusy(true); setError(undefined);
    try {
      const roomCode = await createMultiplayerRoom(nickname.trim(), mode, visibility === "public", password);
      router.push(`/m/${roomCode}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar a sala.");
      setBusy(false);
    }
  };
  const enter = () => {
    const normalized = code.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 8);
    if (normalized.length !== 8) { setError("Digite o código de 8 caracteres da sala."); return; }
    router.push(`/m/${normalized}`);
  };
  const random = async () => {
    if (!requireNickname()) return;
    setBusy(true); setError(undefined);
    try { router.push(`/m/${await joinRandomMultiplayerRoom(nickname.trim(), roomFilter === "all" ? undefined : roomFilter)}`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Nenhuma sala disponível agora."); setBusy(false); }
  };

  return <main className="multiplayer-entry multiplayer-entry--rooms" id="main">
    <header className="multiplayer-entry__top">
      <Link className="multiplayer-brand" href="/" aria-label="Voltar ao Preto no Branco"><BrandMark size={46}/><span>Preto no Branco</span></Link>
      <p>Jogar com amigos</p>
    </header>

    <section className="multiplayer-modes" aria-labelledby="multiplayer-title">
      <div className="multiplayer-entry__intro"><h1 id="multiplayer-title">Escolha como a bola vai rolar.</h1><p>Mesmo aparelho, uma final rápida ou uma chave inteira com amigos e CPU.</p></div>
      <div className="multiplayer-mode-list">
        <Link href="/multiplayer/local" className="multiplayer-mode"><span>Mesmo dispositivo</span><h2>Local</h2><p>Dois ou mais jogadores montam seus times alternando o controle.</p><b>Começar localmente <ArrowIcon/></b></Link>
        <button type="button" className={`multiplayer-mode ${mode === "final" ? "is-selected" : ""}`} aria-pressed={mode === "final"} onClick={() => setMode("final")}><span>Online · 2 vagas</span><h2>Final direta</h2><p>Dois elencos, uma decisão e nenhum jogo anterior.</p><b>Selecionar modo <ArrowIcon/></b></button>
        <button type="button" className={`multiplayer-mode ${mode === "knockout" ? "is-selected" : ""}`} aria-pressed={mode === "knockout"} onClick={() => setMode("knockout")}><span>Online · até 16 vagas</span><h2>Mata-mata</h2><p>Chave ajustável, participantes humanos e vagas preenchidas por CPU.</p><b>Selecionar modo <ArrowIcon/></b></button>
      </div>
    </section>

    <div className="multiplayer-entry__workspace">
      <section className="multiplayer-create" aria-labelledby="create-room-title">
        <div><h2 id="create-room-title">Criar sala {modeLabels[mode].toLowerCase()}</h2><p>O tamanho da chave e o overall são definidos no lobby.</p></div>
        <label className="multiplayer-field"><span>Seu apelido</span><input name="multiplayer-nickname" value={nickname} maxLength={24} autoComplete="nickname" onChange={(event) => setNickname(event.target.value)} placeholder="Como você aparece na sala"/></label>
        <fieldset className="multiplayer-visibility"><legend>Entrada na sala</legend><button type="button" className={visibility === "private" ? "is-selected" : ""} aria-pressed={visibility === "private"} onClick={() => setVisibility("private")}><b>Privada</b><small>Somente por código ou link</small></button><button type="button" className={visibility === "public" ? "is-selected" : ""} aria-pressed={visibility === "public"} onClick={() => setVisibility("public")}><b>Pública</b><small>Aparece na lista de salas</small></button></fieldset>
        <label className="multiplayer-field"><span>Senha opcional</span><input name="multiplayer-password" type="password" value={password} minLength={4} maxLength={32} autoComplete="new-password" onChange={(event) => setPassword(event.target.value)} placeholder="Deixe vazio para entrar sem senha"/></label>
        <button type="button" className="button button--primary button--wide" disabled={busy || (!multiplayerConfigured && !multiplayerLocalDevelopment)} onClick={create}>{busy ? "Criando sala" : "Criar sala"}<ArrowIcon/></button>
        <div className="multiplayer-code"><input name="multiplayer-room-code" aria-label="Código da sala" disabled={!multiplayerConfigured && !multiplayerLocalDevelopment} value={code} maxLength={8} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ""))} placeholder="AB3XK9MQ"/><button type="button" className="button button--quiet" disabled={!multiplayerConfigured && !multiplayerLocalDevelopment} onClick={enter}>Entrar por código</button></div>
      </section>

      <section className="multiplayer-open" aria-labelledby="open-room-title">
        <header><div><h2 id="open-room-title">Salas abertas</h2><p>Entre numa sala pública ou encontre adversários automaticamente.</p></div><button type="button" className="button button--primary" disabled={busy || (!multiplayerConfigured && !multiplayerLocalDevelopment)} onClick={random}>Jogar com aleatórios<ArrowIcon/></button></header>
        <nav aria-label="Filtrar salas"><button type="button" className={roomFilter === "all" ? "is-active" : ""} onClick={() => setRoomFilter("all")}>Todas</button><button type="button" className={roomFilter === "final" ? "is-active" : ""} onClick={() => setRoomFilter("final")}>Final</button><button type="button" className={roomFilter === "knockout" ? "is-active" : ""} onClick={() => setRoomFilter("knockout")}>Mata-mata</button></nav>
        <div className="multiplayer-open__list">
          {rooms.length ? rooms.map((room) => <article key={room.code}><div><span>{modeLabels[room.mode]}</span><b>{room.code}</b></div><dl><div><dt>Vagas</dt><dd>{room.slotsLeft} livres</dd></div><div><dt>Chave</dt><dd>{room.bracketSize}</dd></div><div><dt>Acesso</dt><dd>{room.passwordRequired ? "Com senha" : "Livre"}</dd></div></dl><Link href={`/m/${room.code}`} className="button button--quiet">Entrar<ArrowIcon/></Link></article>) : <p className="multiplayer-open__empty">Nenhuma sala pública aberta neste modo.</p>}
        </div>
      </section>
    </div>

    {!multiplayerConfigured && <p className="multiplayer-dev-note" role="status"><b>{multiplayerLocalDevelopment ? "Modo local de desenvolvimento" : "Integração indisponível"}</b>{multiplayerLocalDevelopment ? " Salas online ficam restritas a esta execução do navegador." : " O Supabase precisa estar conectado para abrir salas online."}</p>}
    {error && <p className="multiplayer-error" role="alert">{error}</p>}
    <SiteFooter/>
  </main>;
}

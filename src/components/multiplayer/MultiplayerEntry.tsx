"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createMultiplayerRoom, multiplayerConfigured, multiplayerLocalDevelopment } from "@/lib/multiplayer/client";
import type { RatingsMode } from "@/types/game";
import { ArrowIcon } from "@/components/ui/Icons";
import { BrandMark, SiteFooter } from "@/components/ui/Brand";

export function MultiplayerEntry() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const [ratingsMode, setRatingsMode] = useState<RatingsMode>("visible");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const create = async () => {
    if (nickname.trim().length < 2) { setError("Escolha um apelido com pelo menos 2 caracteres."); return; }
    setBusy(true); setError(undefined);
    try { router.push(`/m/${await createMultiplayerRoom(nickname.trim(), ratingsMode)}`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível criar a sala."); setBusy(false); }
  };
  const enter = () => {
    const normalized = code.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 8);
    if (normalized.length !== 8) { setError("Digite o código de 8 caracteres da sala."); return; }
    router.push(`/m/${normalized}`);
  };
  return <main className="multiplayer-entry" id="main">
    <section className="multiplayer-entry__card">
      <Link className="multiplayer-brand" href="/" aria-label="Voltar ao Preto no Branco"><BrandMark size={46}/><span>Preto no Branco</span></Link>
      <div className="multiplayer-entry__intro"><span>Multiplayer privado</span><h1>Monte a sua sala.</h1><p>Cada amigo escala o próprio time. As vagas livres entram no mata-mata como CPU.</p></div>
      {!multiplayerConfigured && <p className="multiplayer-dev-note" role="status"><b>{multiplayerLocalDevelopment ? "Modo local de desenvolvimento" : "Integração em preparação"}</b>{multiplayerLocalDevelopment ? " A interface funciona para teste, mas o convite não atravessa dispositivos." : " O multiplayer será liberado assim que o Supabase for conectado ao projeto."}</p>}
      <label className="multiplayer-field"><span>Seu apelido</span><input value={nickname} maxLength={24} autoComplete="nickname" onChange={(event) => setNickname(event.target.value)} placeholder="Como você aparece na sala"/></label>
      <fieldset className="multiplayer-ratings"><legend>Overall para todos</legend>
        <button type="button" className={ratingsMode === "visible" ? "is-selected" : ""} onClick={() => setRatingsMode("visible")}><b>Visível</b><small>Notas aparecem no draft e nos jogos</small></button>
        <button type="button" className={ratingsMode === "memory" ? "is-selected" : ""} onClick={() => setRatingsMode("memory")}><b>Oculto</b><small>Todos jogam pela memória</small></button>
      </fieldset>
      <button type="button" className="button button--primary button--wide" disabled={busy || (!multiplayerConfigured && !multiplayerLocalDevelopment)} onClick={create}>{busy ? "Criando sala" : "Criar sala privada"}<ArrowIcon/></button>
      <div className="multiplayer-divider"><span>ou entre com um convite</span></div>
      <div className="multiplayer-code"><input aria-label="Código da sala" disabled={!multiplayerConfigured && !multiplayerLocalDevelopment} value={code} maxLength={8} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ""))} placeholder="AB3XK9MQ"/><button type="button" className="button button--quiet" disabled={!multiplayerConfigured && !multiplayerLocalDevelopment} onClick={enter}>Entrar</button></div>
      {error && <p className="multiplayer-error" role="alert">{error}</p>}
    </section>
    <SiteFooter/>
  </main>;
}

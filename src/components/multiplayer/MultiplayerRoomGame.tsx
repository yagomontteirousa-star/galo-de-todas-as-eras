"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnalysisScreen } from "@/components/game/screens/AnalysisScreen";
import { BracketScreen } from "@/components/game/screens/BracketScreen";
import { DraftScreen } from "@/components/game/screens/DraftScreen";
import { MatchScreen } from "@/components/game/screens/MatchScreen";
import { SetupScreen } from "@/components/game/screens/SetupScreen";
import { BrandMark } from "@/components/ui/Brand";
import { ArrowIcon } from "@/components/ui/Icons";
import { squadsById } from "@/data/atletico-squads";
import { buildUserTeam, createCampaign, nextAvailableSquad, startDraft, touchCampaign } from "@/lib/campaign";
import { mergeMatchFuture, seededRandom, simulateMatch } from "@/lib/simulation";
import { advanceMultiplayerRoom, completeMultiplayerRoom, joinMultiplayerRoom, loadMultiplayerRoom, multiplayerConfigured, multiplayerLocalDevelopment, saveMultiplayerDecision, saveMultiplayerDraft, saveMultiplayerMatch, startMultiplayerRoom, subscribeMultiplayerRoom } from "@/lib/multiplayer/client";
import { createMultiplayerBracket, multiplayerMatchesForRound, nextMultiplayerRound, viewedBracket } from "@/lib/multiplayer/tournament";
import type { Campaign, FormationId, LineupEntry, MatchInstructions, MatchMomentInstruction, MatchProgress, RatingsMode, SquadPlayerEntry, TacticId } from "@/types/game";
import type { MultiplayerParticipant, MultiplayerPlayerStatus, MultiplayerSnapshot } from "@/types/multiplayer";

const statusLabels: Record<MultiplayerPlayerStatus, string> = { waiting: "Aguardando", drafting: "Montando elenco", ready: "Pronto", playing: "Jogando", eliminated: "Eliminado", qualified: "Classificado" };
const halftimeWeight = { defend: -1, keep: 0, press: 1, attack: 2 } as const;
const momentWeight: Record<MatchMomentInstruction, number> = { protect: -2, hold: -2, calm: -1, restart_safe: -1, counter: 0, set_pieces: 0, wide: 1, inside: 1, direct: 1, shots: 1, press: 2, restart_fast: 2 };

function relativeInstructions(home?: MatchInstructions, away?: MatchInstructions): MatchInstructions {
  const result: MatchInstructions = {};
  if (home?.halftime && away?.halftime) {
    const edge = halftimeWeight[home.halftime] - halftimeWeight[away.halftime];
    result.halftime = edge >= 2 ? "attack" : edge >= 1 ? "press" : edge <= -2 ? "defend" : "keep";
  }
  if (home?.moment && away?.moment) {
    const edge = momentWeight[home.moment] - momentWeight[away.moment];
    result.moment = edge >= 2 ? "press" : edge >= 1 ? "wide" : edge <= -2 ? "protect" : "calm";
  }
  return result;
}

function participantStatus(participant: MultiplayerParticipant, snapshot: MultiplayerSnapshot): MultiplayerPlayerStatus {
  if (snapshot.room.status !== "playing") return participant.status;
  const played = snapshot.matches.filter((match) => match.status === "finished" && (match.homeParticipantId === participant.id || match.awayParticipantId === participant.id));
  if (played.some((match) => match.result && match.result.winnerId !== `multiplayer-${participant.id}`)) return "eliminated";
  const current = snapshot.matches.find((match) => match.round === snapshot.room.currentRound && (match.homeParticipantId === participant.id || match.awayParticipantId === participant.id));
  return current?.status === "finished" ? "qualified" : "playing";
}

export function MultiplayerRoomGame({ code }: { code: string }) {
  const [snapshot, setSnapshot] = useState<MultiplayerSnapshot>();
  const [loading, setLoading] = useState(true);
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [view, setView] = useState<"bracket" | "match">("bracket");
  const advancingRef = useRef<string | undefined>(undefined);
  const resolvingRef = useRef<string | undefined>(undefined);

  const refresh = useCallback(async () => {
    try { setSnapshot(await loadMultiplayerRoom(code)); setError(undefined); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "A sala não pôde ser carregada."); }
    finally { setLoading(false); }
  }, [code]);
  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    const unsubscribe = subscribeMultiplayerRoom(code, () => void refresh());
    return () => { window.clearTimeout(timer); unsubscribe(); };
  }, [code, refresh]);

  const participant = snapshot?.participants.find((item) => item.userId === snapshot.userId);
  const host = Boolean(snapshot && snapshot.room.hostUserId === snapshot.userId);
  const campaign = participant?.campaign;
  const team = campaign?.lineup.length === 11 ? buildUserTeam(campaign) : undefined;

  const storeCampaign = async (next: Campaign, status: MultiplayerParticipant["status"] = "drafting", nextTeam = team) => {
    if (!participant) return;
    await saveMultiplayerDraft(participant, touchCampaign(next), nextTeam, status);
    await refresh();
  };
  const beginDraft = () => void storeCampaign({ ...createCampaign(), ratingsMode: snapshot!.room.ratingsMode, screen: "setup" });
  const setup = (formation: FormationId, tactic: TacticId, ratingsMode: RatingsMode) => campaign && void storeCampaign(startDraft(campaign, formation, tactic, ratingsMode));
  const confirmPicks = (picks: LineupEntry[], benchPicks: SquadPlayerEntry[]) => {
    if (!campaign) return;
    const usedSquadIds = campaign.currentSquadId && !campaign.usedSquadIds.includes(campaign.currentSquadId) ? [...campaign.usedSquadIds, campaign.currentSquadId] : campaign.usedSquadIds;
    const base: Campaign = { ...campaign, lineup: [...campaign.lineup, ...picks], bench: [...campaign.bench, ...benchPicks], usedSquadIds, currentSquadId: undefined };
    if (base.lineup.length === 11 && base.bench.length === 7) { void storeCampaign({ ...base, screen: "analysis" }, "drafting", buildUserTeam(base)); return; }
    const next = nextAvailableSquad(base);
    void storeCampaign({ ...base, currentSquadId: next?.id, screen: "draft" });
  };
  const reroll = () => {
    if (!campaign?.rerollsLeft || !campaign.currentSquadId) return;
    const usedSquadIds = campaign.usedSquadIds.includes(campaign.currentSquadId) ? campaign.usedSquadIds : [...campaign.usedSquadIds, campaign.currentSquadId];
    const base = { ...campaign, usedSquadIds, currentSquadId: undefined, rerollsLeft: campaign.rerollsLeft - 1 };
    void storeCampaign({ ...base, currentSquadId: nextAvailableSquad(base)?.id });
  };
  const relocate = (fromSlotId: string, toSlotId: string) => campaign && void storeCampaign({ ...campaign, lineup: campaign.lineup.map((entry) => entry.slotId === fromSlotId ? { ...entry, slotId: toSlotId } : entry.slotId === toSlotId ? { ...entry, slotId: fromSlotId } : entry) });
  const markReady = () => campaign && team && void storeCampaign(campaign, "ready", team);

  const join = async () => {
    try { await joinMultiplayerRoom(code, nickname.trim()); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível entrar na sala."); }
  };
  const copyInvite = async () => {
    const link = `${window.location.origin}/m/${code}`;
    try { await navigator.clipboard.writeText(link); setNotice("Convite copiado."); }
    catch { setNotice(`Código da sala: ${code}`); }
  };
  const launch = async () => {
    if (!snapshot || !host || snapshot.participants.some((item) => !item.team)) return;
    try {
      const bracket = createMultiplayerBracket(snapshot.participants, Math.floor(Math.random() * 2147483647));
      const matches = multiplayerMatchesForRound(snapshot.room, bracket.rounds[0], snapshot.participants);
      await startMultiplayerRoom(snapshot.room, bracket, matches);
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "A sala não pôde começar."); }
  };

  const bracket = snapshot && participant ? viewedBracket(snapshot.room, snapshot.matches, participant.id) : undefined;
  const currentMatch = snapshot && participant ? snapshot.matches.find((match) => match.round === snapshot.room.currentRound && match.status !== "finished" && (match.homeParticipantId === participant.id || match.awayParticipantId === participant.id)) : undefined;
  const displayMatch = currentMatch && participant ? {
    id: currentMatch.id, round: currentMatch.round, index: currentMatch.index,
    home: { ...currentMatch.homeTeam, isUser: currentMatch.homeParticipantId === participant.id },
    away: { ...currentMatch.awayTeam, isUser: currentMatch.awayParticipantId === participant.id },
  } : undefined;
  const isController = Boolean(snapshot && currentMatch?.controllerUserId === snapshot.userId);
  const humanVersusHuman = Boolean(currentMatch?.homeParticipantId && currentMatch.awayParticipantId);

  useEffect(() => {
    if (!snapshot || !host || snapshot.room.status !== "playing") return;
    const final = snapshot.matches.find((match) => match.round === "final" && match.status === "finished");
    if (final) {
      const finalBracket = viewedBracket(snapshot.room, snapshot.matches, participant?.id ?? "");
      if (advancingRef.current !== "finished") {
        advancingRef.current = "finished";
        void completeMultiplayerRoom(snapshot.room, finalBracket).then(refresh).catch((cause) => setError(cause instanceof Error ? cause.message : "A sala não foi encerrada."));
      }
      return;
    }
    const next = nextMultiplayerRound(snapshot.room, snapshot.matches);
    if (!next || advancingRef.current === next.id) return;
    advancingRef.current = next.id;
    const nextBracket = viewedBracket({ ...snapshot.room, currentRound: next.id }, snapshot.matches, participant?.id ?? "");
    nextBracket.rounds.push(next);
    const matches = multiplayerMatchesForRound(snapshot.room, next, snapshot.participants);
    void advanceMultiplayerRoom(snapshot.room, nextBracket, matches).then(refresh).catch((cause) => setError(cause instanceof Error ? cause.message : "A chave não avançou."));
  }, [host, participant?.id, refresh, snapshot]);

  useEffect(() => {
    if (!snapshot || !currentMatch || !currentMatch.result || !currentMatch.progress || !isController || !humanVersusHuman) return;
    const homeUser = snapshot.participants.find((item) => item.id === currentMatch.homeParticipantId)?.userId;
    const awayUser = snapshot.participants.find((item) => item.id === currentMatch.awayParticipantId)?.userId;
    const home = snapshot.decisions.find((item) => item.matchId === currentMatch.id && item.userId === homeUser)?.instructions;
    const away = snapshot.decisions.find((item) => item.matchId === currentMatch.id && item.userId === awayUser)?.instructions;
    const combined = relativeInstructions(home, away);
    const gate = !currentMatch.result.instructions.halftime && combined.halftime ? "halftime" : !currentMatch.result.instructions.moment && combined.moment ? "moment" : undefined;
    if (!gate || resolvingRef.current === `${currentMatch.id}:${gate}`) return;
    resolvingRef.current = `${currentMatch.id}:${gate}`;
    const simulationHome = { ...currentMatch.homeTeam, isUser: true };
    const simulationAway = { ...currentMatch.awayTeam, isUser: false };
    const revised = simulateMatch(simulationHome, simulationAway, seededRandom(currentMatch.seed), { ...currentMatch.result.instructions, ...combined });
    const result = mergeMatchFuture(simulationHome, simulationAway, currentMatch.result, revised, currentMatch.progress.minute, seededRandom((currentMatch.seed ^ currentMatch.progress.minute) >>> 0));
    void saveMultiplayerMatch(currentMatch, result, currentMatch.progress, "playing").then(refresh).catch((cause) => setError(cause instanceof Error ? cause.message : "A decisão não foi sincronizada."));
  }, [currentMatch, humanVersusHuman, isController, refresh, snapshot]);

  const instruction = async (instructions: MatchInstructions) => {
    if (!snapshot || !currentMatch || !currentMatch.result || !currentMatch.progress) return;
    const own = snapshot.decisions.find((item) => item.matchId === currentMatch.id && item.userId === snapshot.userId)?.instructions ?? {};
    const personal: MatchInstructions = { ...own };
    if (!currentMatch.result.instructions.halftime && instructions.halftime) personal.halftime = instructions.halftime;
    if (!currentMatch.result.instructions.moment && instructions.moment) personal.moment = instructions.moment;
    await saveMultiplayerDecision(currentMatch.id, personal);
    if (!humanVersusHuman && isController) {
      const userHome = currentMatch.homeParticipantId === participant?.id;
      const home = { ...currentMatch.homeTeam, isUser: userHome };
      const away = { ...currentMatch.awayTeam, isUser: !userHome };
      const revised = simulateMatch(home, away, seededRandom(currentMatch.seed), instructions);
      const result = mergeMatchFuture(home, away, currentMatch.result, revised, currentMatch.progress.minute, seededRandom((currentMatch.seed ^ currentMatch.progress.minute) >>> 0));
      await saveMultiplayerMatch(currentMatch, result, currentMatch.progress, "playing");
    }
    await refresh();
  };
  const progress = (value: Pick<MatchProgress, "minute" | "kickStep" | "kickRevealed" | "shootoutComplete">) => {
    if (!currentMatch?.result || !currentMatch.progress || !isController) return;
    if (value.minute % 3 && value.minute !== 45 && value.minute !== 65 && value.minute < 90 && !value.kickRevealed) return;
    void saveMultiplayerMatch(currentMatch, currentMatch.result, { ...currentMatch.progress, ...value }, "playing");
  };
  const finish = async () => {
    if (!currentMatch?.result || !currentMatch.progress) return;
    if (isController) await saveMultiplayerMatch(currentMatch, currentMatch.result, currentMatch.progress, "finished");
    setView("bracket"); await refresh();
  };

  if (loading) return <main className="loading-screen"><BrandMark size={64}/><div/><span>Abrindo a sala privada</span></main>;
  if (!snapshot) return <JoinRoom code={code} nickname={nickname} setNickname={setNickname} onJoin={join} error={error}/>;
  if (!participant) return <JoinRoom code={code} nickname={nickname} setNickname={setNickname} onJoin={join} error={error}/>;

  if (snapshot.room.status === "waiting" && participant.status !== "ready" && campaign?.screen === "setup") return <SetupScreen fixedRatingsMode={snapshot.room.ratingsMode} onContinue={setup}/>;
  const squad = campaign?.currentSquadId ? squadsById.get(campaign.currentSquadId) : undefined;
  if (snapshot.room.status === "waiting" && participant.status !== "ready" && campaign?.screen === "draft" && squad) return <DraftScreen key={squad.id} campaign={campaign} squad={squad} onConfirm={confirmPicks} onReroll={reroll} onRelocateLineupEntry={relocate}/>;
  if (snapshot.room.status === "waiting" && participant.status !== "ready" && campaign?.screen === "analysis" && team) return <AnalysisScreen campaign={campaign} team={team} onStart={markReady}/>;

  if (snapshot.room.status === "playing" && view === "match" && currentMatch?.result && currentMatch.progress && displayMatch) return <MatchScreen key={`${currentMatch.id}-${isController ? "control" : `${currentMatch.progress.minute}-${currentMatch.progress.kickStep}-${currentMatch.progress.kickRevealed}`}`} match={displayMatch} result={currentMatch.result} progress={currentMatch.progress} ratingsMode={snapshot.room.ratingsMode} onInstruction={instruction} onLineupChange={() => {}} onProgress={progress} onFinish={finish} playbackMode={isController ? "controller" : "follower"}/>;
  if ((snapshot.room.status === "playing" || snapshot.room.status === "finished") && bracket) return <div className="multiplayer-shell"><RoomBar snapshot={snapshot} onCopy={copyInvite}/><BracketScreen bracket={bracket} ratingsMode={snapshot.room.ratingsMode} onPlay={() => setView("match")}/>{notice && <p className="multiplayer-notice" role="status">{notice}</p>}</div>;

  const allReady = snapshot.participants.length > 0 && snapshot.participants.every((item) => item.status === "ready" && item.team);
  return <main className="multiplayer-lobby" id="main">
    <RoomBar snapshot={snapshot} onCopy={copyInvite}/>
    <section className="multiplayer-lobby__hero"><div><span>Sala privada</span><h1>A chave espera os times.</h1><p>Quando o anfitrião iniciar, as vagas livres serão ocupadas por equipes CPU.</p></div><dl><div><dt>Jogadores</dt><dd>{snapshot.participants.length}/16</dd></div><div><dt>Overall</dt><dd>{snapshot.room.ratingsMode === "visible" ? "Visível" : "Oculto"}</dd></div></dl></section>
    {snapshot.localDevelopment && <p className="multiplayer-dev-note"><b>Teste local</b> Esta sala existe apenas nesta execução do navegador.</p>}
    <section className="multiplayer-slots" aria-label="Participantes e vagas">
      {Array.from({ length: 16 }, (_, index) => {
        const player = snapshot.participants.find((item) => item.slotIndex === index);
        return <article key={index} className={player ? "is-filled" : "is-empty"}><span>{String(index + 1).padStart(2, "0")}</span>{player ? <div><b>{player.nickname}{player.userId === snapshot.room.hostUserId && <em>Anfitrião</em>}</b><small>{statusLabels[participantStatus(player, snapshot)]}</small></div> : <div><b>Vaga livre</b><small>Será preenchida por CPU</small></div>}</article>;
      })}
    </section>
    <footer className="multiplayer-lobby__actions">
      <button type="button" className="button button--quiet" onClick={copyInvite}>Copiar convite</button>
      {participant.status !== "ready" && <button type="button" className="button button--primary" onClick={beginDraft}>{campaign ? "Continuar meu elenco" : "Montar meu time"}<ArrowIcon/></button>}
      {participant.status === "ready" && <span className="multiplayer-ready">Seu time está pronto</span>}
      {host && <button type="button" className="button button--primary" disabled={!allReady} onClick={launch}>Iniciar mata-mata<ArrowIcon/></button>}
    </footer>
    {!allReady && host && <p className="multiplayer-lobby__hint">Você pode iniciar com vagas livres. Amigos que já entraram precisam terminar o próprio elenco.</p>}
    {notice && <p className="multiplayer-notice" role="status">{notice}</p>}{error && <p className="multiplayer-error" role="alert">{error}</p>}
  </main>;
}

function RoomBar({ snapshot, onCopy }: { snapshot: MultiplayerSnapshot; onCopy: () => void }) {
  return <header className="multiplayer-roombar"><Link href="/" aria-label="Ir para a página inicial"><BrandMark size={38}/></Link><div><span>Sala privada</span><b>{snapshot.room.code}</b></div><button type="button" onClick={onCopy}>Copiar convite</button></header>;
}

function JoinRoom({ code, nickname, setNickname, onJoin, error }: { code: string; nickname: string; setNickname: (value: string) => void; onJoin: () => void; error?: string }) {
  return <main className="multiplayer-join" id="main"><section><Link href="/multiplayer" className="multiplayer-brand"><BrandMark size={44}/><span>Multiplayer privado</span></Link><span>Convite {code}</span><h1>Entre em campo.</h1><p>Use apenas um apelido. Nenhum dado pessoal é necessário.</p><label className="multiplayer-field"><span>Seu apelido</span><input value={nickname} maxLength={24} autoFocus onChange={(event) => setNickname(event.target.value)} placeholder="Nome na sala"/></label><button type="button" className="button button--primary button--wide" disabled={nickname.trim().length < 2 || (!multiplayerConfigured && !multiplayerLocalDevelopment)} onClick={onJoin}>Entrar na sala<ArrowIcon/></button>{!multiplayerConfigured && <p className="multiplayer-dev-note">{multiplayerLocalDevelopment ? "Sem Supabase, somente salas criadas nesta mesma execução podem ser abertas." : "Esta sala será liberada quando o Supabase estiver conectado ao projeto."}</p>}{error && <p className="multiplayer-error" role="alert">{error}</p>}</section></main>;
}

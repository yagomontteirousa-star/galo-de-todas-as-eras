"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnalysisScreen } from "@/components/game/screens/AnalysisScreen";
import { BracketScreen } from "@/components/game/screens/BracketScreen";
import { DraftScreen } from "@/components/game/screens/DraftScreen";
import { MatchScreen } from "@/components/game/screens/MatchScreen";
import { SetupScreen } from "@/components/game/screens/SetupScreen";
import { TacticalEditor } from "@/components/game/screens/TacticsScreen";
import { BrandMark } from "@/components/ui/Brand";
import { ArrowIcon, CheckIcon } from "@/components/ui/Icons";
import { atleticoSquads, playersById, squadsById } from "@/data/atletico-squads";
import { matchMoments } from "@/data/match-moments";
import { buildUserTeam, createCampaign, startDraft, touchCampaign } from "@/lib/campaign";
import { mergeMatchFuture, seededRandom, simulateMatch } from "@/lib/simulation";
import { advanceMultiplayerRoom, beginMultiplayerDraft, completeMultiplayerRoom, joinMultiplayerRoom, kickMultiplayerParticipant, leaveMultiplayerRoom, loadMultiplayerRoom, multiplayerConfigured, multiplayerLocalDevelopment, readyMultiplayerMatch, saveMultiplayerDecision, saveMultiplayerDraft, saveMultiplayerMatch, setMultiplayerLobbyReady, startMultiplayerRoom, subscribeMultiplayerRoom, syncMultiplayerMatch } from "@/lib/multiplayer/client";
import { createMultiplayerBracket, multiplayerMatchesForRound, multiplayerShootoutProgress, nextMultiplayerRound, viewedBracket } from "@/lib/multiplayer/tournament";
import type { Campaign, FormationId, HalftimeInstruction, LineupEntry, MatchInstructions, MatchMomentInstruction, MatchProgress, RatingsMode, SquadPlayerEntry, TacticId } from "@/types/game";
import type { MultiplayerMatch, MultiplayerParticipant, MultiplayerPlayerStatus, MultiplayerSnapshot } from "@/types/multiplayer";

const DRAFT_SECONDS = 15;
const ANALYSIS_SECONDS = 8;
const TRANSITION_SECONDS = 5;
const newDraftDeadline = () => new Date(Date.now() + DRAFT_SECONDS * 1000).toISOString();
const transitionDelay = (updatedAt: string) => Math.max(0, Date.parse(updatedAt) + TRANSITION_SECONDS * 1000 - Date.now());
const statusLabels: Record<MultiplayerPlayerStatus, string> = { waiting: "Aguardando", drafting: "Montando elenco", ready: "Pronto", playing: "Jogando", eliminated: "Eliminado", qualified: "Classificado" };
const halftimeOptions: { id: HalftimeInstruction; label: string; detail: string }[] = [
  { id: "keep", label: "Manter o plano", detail: "Equilíbrio e controle" },
  { id: "press", label: "Pressionar", detail: "Mais recuperação, mais risco" },
  { id: "attack", label: "Atacar", detail: "Mais volume, linha exposta" },
  { id: "defend", label: "Defender", detail: "Protege a área, cria menos" },
];
const halftimeWeight = { defend: -1, keep: 0, press: 1, attack: 2 } as const;
const momentWeight: Record<MatchMomentInstruction, number> = { protect: -2, hold: -2, calm: -1, restart_safe: -1, counter: 0, set_pieces: 0, wide: 1, inside: 1, direct: 1, shots: 1, press: 2, restart_fast: 2 };

function shuffled<T>(source: T[]) {
  const result = [...source];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function draftSchedules(participants: MultiplayerParticipant[]) {
  const schedules: Record<string, string[]> = Object.fromEntries(participants.map((item) => [item.id, []]));
  for (let round = 0; round < 9; round += 1) {
    const years = shuffled(atleticoSquads.map((squad) => squad.id));
    participants.forEach((participant, index) => schedules[participant.id].push(years[index]));
  }
  return schedules;
}

function relativeInstructions(home?: MatchInstructions, away?: MatchInstructions): MatchInstructions {
  const result: MatchInstructions = {};
  if (home?.halftime || away?.halftime) {
    const edge = halftimeWeight[home?.halftime ?? "keep"] - halftimeWeight[away?.halftime ?? "keep"];
    result.halftime = edge >= 2 ? "attack" : edge >= 1 ? "press" : edge <= -2 ? "defend" : "keep";
  }
  if (home?.moment || away?.moment) {
    const edge = momentWeight[home?.moment ?? "calm"] - momentWeight[away?.moment ?? "calm"];
    result.moment = edge >= 2 ? "press" : edge >= 1 ? "wide" : edge <= -2 ? "protect" : "calm";
  }
  return result;
}

function participantStatus(participant: MultiplayerParticipant, snapshot: MultiplayerSnapshot): MultiplayerPlayerStatus {
  if (snapshot.room.status !== "playing" && snapshot.room.status !== "finished") return participant.status;
  const played = snapshot.matches.filter((match) => match.status === "finished" && (match.homeParticipantId === participant.id || match.awayParticipantId === participant.id));
  if (played.some((match) => match.result && match.result.winnerId !== `multiplayer-${participant.id}`)) return "eliminated";
  const current = snapshot.matches.find((match) => match.round === snapshot.room.currentRound && (match.homeParticipantId === participant.id || match.awayParticipantId === participant.id));
  return current?.status === "finished" ? "qualified" : "playing";
}

export function MultiplayerRoomGame({ code }: { code: string }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<MultiplayerSnapshot>();
  const [loading, setLoading] = useState(true);
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [actionPending, setActionPending] = useState(false);
  const [dismissedResultId, setDismissedResultId] = useState<string>();
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
  }, [code, refresh, snapshot?.room.id]);

  const participant = snapshot?.participants.find((item) => item.userId === snapshot.userId);
  const host = Boolean(snapshot && snapshot.room.hostUserId === snapshot.userId);
  const campaign = participant?.campaign;
  const team = campaign?.lineup.length === 11 ? buildUserTeam(campaign) : undefined;
  const bracket = snapshot && participant ? viewedBracket(snapshot.room, snapshot.matches, participant.id) : undefined;
  const currentMatch = snapshot && participant ? snapshot.matches.find((match) => match.round === snapshot.room.currentRound && (match.homeParticipantId === participant.id || match.awayParticipantId === participant.id)) : undefined;
  const currentMatchId = currentMatch?.id;
  const currentMatchStatus = currentMatch?.status;
  const ownReady = Boolean(currentMatch && participant && (currentMatch.homeParticipantId === participant.id ? currentMatch.homeReady : currentMatch.awayReady));
  const allLobbyReady = Boolean(snapshot?.participants.length && snapshot.participants.every((item) => item.lobbyReady));

  useEffect(() => {
    if (!currentMatchId || !currentMatchStatus || !["playing", "halftime", "moment"].includes(currentMatchStatus)) return;
    const sync = () => void syncMultiplayerMatch(currentMatchId).catch((cause) => setError(cause instanceof Error ? cause.message : "A partida não sincronizou."));
    sync();
    const timer = window.setInterval(sync, 500);
    return () => window.clearInterval(timer);
  }, [currentMatchId, currentMatchStatus]);

  const storeCampaign = async (next: Campaign, status: MultiplayerParticipant["status"] = "drafting", nextTeam = team, draft?: { round: number; pick: number; deadline?: string }) => {
    if (!participant) return;
    await saveMultiplayerDraft(participant, touchCampaign(next), nextTeam, status, draft); await refresh();
  };

  const setup = (formation: FormationId, tactic: TacticId, ratingsMode: RatingsMode) => {
    if (!participant || !snapshot) return;
    const base = campaign ?? { ...createCampaign(), ratingsMode: snapshot.room.ratingsMode };
    const next = { ...startDraft(base, formation, tactic, ratingsMode), currentSquadId: participant.draftSchedule[0], rerollsLeft: 0 };
    void storeCampaign(next, "drafting", undefined, { round: 0, pick: 0, deadline: newDraftDeadline() });
  };

  const confirmPick = (picks: LineupEntry[], benchPicks: SquadPlayerEntry[]) => {
    if (!campaign || !participant || (!picks.length && !benchPicks.length)) return;
    const base: Campaign = { ...campaign, lineup: [...campaign.lineup, ...picks], bench: [...campaign.bench, ...benchPicks] };
    if (participant.draftPick === 0) {
      void storeCampaign(base, "drafting", undefined, { round: participant.draftRound, pick: 1, deadline: newDraftDeadline() }); return;
    }
    const usedSquadIds = campaign.currentSquadId && !campaign.usedSquadIds.includes(campaign.currentSquadId) ? [...campaign.usedSquadIds, campaign.currentSquadId] : campaign.usedSquadIds;
    const complete = base.lineup.length === 11 && base.bench.length === 7;
    if (complete) {
      const finalCampaign = { ...base, usedSquadIds, currentSquadId: undefined, screen: "analysis" as const };
      void storeCampaign(finalCampaign, "drafting", buildUserTeam(finalCampaign), { round: participant.draftRound, pick: 2 }); return;
    }
    const nextRound = participant.draftRound + 1;
    void storeCampaign({ ...base, usedSquadIds, currentSquadId: participant.draftSchedule[nextRound], screen: "draft" }, "drafting", undefined, { round: nextRound, pick: 0, deadline: newDraftDeadline() });
  };

  const relocate = (fromSlotId: string, toSlotId: string) => campaign && void storeCampaign({ ...campaign, lineup: campaign.lineup.map((entry) => entry.slotId === fromSlotId ? { ...entry, slotId: toSlotId } : entry.slotId === toSlotId ? { ...entry, slotId: fromSlotId } : entry) });
  const markReady = () => campaign && team && void storeCampaign(campaign, "ready", team, participant ? { round: participant.draftRound, pick: 2 } : undefined);
  const join = async () => { try { await joinMultiplayerRoom(code, nickname.trim()); await refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível entrar na sala."); } };
  const copyInvite = async () => { const link = `${window.location.origin}/m/${code}`; try { await navigator.clipboard.writeText(link); setNotice("Convite copiado."); } catch { setNotice(`Código da sala: ${code}`); } };
  const toggleLobbyReady = async () => {
    if (!snapshot || !participant || actionPending) return;
    setActionPending(true);
    try { await setMultiplayerLobbyReady(snapshot.room.id, !participant.lobbyReady); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "A confirmação não pôde ser atualizada."); }
    finally { setActionPending(false); }
  };
  const beginDraft = async () => { if (!snapshot || !host) return; try { await beginMultiplayerDraft(snapshot.room, draftSchedules(snapshot.participants)); await refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "A montagem não pôde começar."); } };
  const kick = async (player: MultiplayerParticipant) => { if (!snapshot || !window.confirm(`Remover ${player.nickname} desta sala?`)) return; try { await kickMultiplayerParticipant(snapshot.room.id, player.id); await refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "O participante não pôde ser removido."); } };
  const leave = async () => { if (!snapshot || !window.confirm(snapshot.room.status === "playing" ? "Sair agora entrega seu time para a CPU. Deseja continuar?" : "Deseja sair desta sala?")) return; try { await leaveMultiplayerRoom(snapshot.room.id); router.push("/multiplayer"); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível sair da sala."); } };
  const launch = async () => {
    if (!snapshot || !host || snapshot.participants.some((item) => !item.team || item.status !== "ready")) return;
    try { const nextBracket = createMultiplayerBracket(snapshot.participants, Math.floor(Math.random() * 2147483647)); const matches = multiplayerMatchesForRound(snapshot.room, nextBracket.rounds[0], snapshot.participants); await startMultiplayerRoom(snapshot.room, nextBracket, matches); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "A sala não pôde começar."); }
  };
  const prepareMatch = async () => { if (!currentMatch) return; if (["playing", "halftime", "moment"].includes(currentMatch.status)) return; try { await readyMultiplayerMatch(currentMatch.id); await refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "A partida não pôde ser liberada."); } };

  useEffect(() => {
    if (!snapshot || snapshot.room.status !== "playing") return;
    const final = snapshot.matches.find((match) => match.round === "final" && match.status === "finished");
    const next = nextMultiplayerRound(snapshot.room, snapshot.matches);
    if ((!final && !next) || !host) return;
    const targetId = final ? "finished" : next!.id;
    if (advancingRef.current === targetId) return;
    const finishedThisRound = snapshot.matches.filter((match) => match.round === snapshot.room.currentRound && match.status === "finished");
    const latestFinish = Math.max(...finishedThisRound.map((match) => Date.parse(match.updatedAt)));
    const delay = transitionDelay(new Date(latestFinish).toISOString());
    const timer = window.setTimeout(() => {
      advancingRef.current = targetId;
      if (final) {
        void completeMultiplayerRoom(snapshot.room, viewedBracket(snapshot.room, snapshot.matches, participant?.id ?? "")).then(refresh).catch((cause) => setError(cause instanceof Error ? cause.message : "A sala não foi encerrada."));
        return;
      }
      const nextBracket = viewedBracket({ ...snapshot.room, currentRound: next!.id }, snapshot.matches, participant?.id ?? ""); nextBracket.rounds.push(next!);
      void advanceMultiplayerRoom(snapshot.room, nextBracket, multiplayerMatchesForRound(snapshot.room, next!, snapshot.participants)).then(refresh).catch((cause) => setError(cause instanceof Error ? cause.message : "A chave não avançou."));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [host, participant?.id, refresh, snapshot]);

  useEffect(() => {
    if (!snapshot || !currentMatch?.result || !currentMatch.progress || currentMatch.officialMinute < 45) return;
    const homeUser = snapshot.participants.find((item) => item.id === currentMatch.homeParticipantId)?.userId;
    const awayUser = snapshot.participants.find((item) => item.id === currentMatch.awayParticipantId)?.userId;
    const home = snapshot.decisions.find((item) => item.matchId === currentMatch.id && item.userId === homeUser)?.instructions;
    const away = snapshot.decisions.find((item) => item.matchId === currentMatch.id && item.userId === awayUser)?.instructions;
    const combined = relativeInstructions(home, away);
    const gate = !currentMatch.result.instructions.halftime && combined.halftime ? "halftime" : currentMatch.officialMinute >= 65 && !currentMatch.result.instructions.moment && combined.moment ? "moment" : undefined;
    if (!gate || resolvingRef.current === `${currentMatch.id}:${gate}`) return;
    resolvingRef.current = `${currentMatch.id}:${gate}`;
    const revised = simulateMatch({ ...currentMatch.homeTeam, isUser: true }, { ...currentMatch.awayTeam, isUser: false }, seededRandom(currentMatch.seed), { ...currentMatch.result.instructions, ...combined });
    const result = mergeMatchFuture(currentMatch.homeTeam, currentMatch.awayTeam, currentMatch.result, revised, currentMatch.officialMinute, seededRandom((currentMatch.seed ^ currentMatch.officialMinute) >>> 0));
    void saveMultiplayerMatch(currentMatch, result, currentMatch.progress, currentMatch.status).then(refresh).catch(() => undefined);
  }, [currentMatch, refresh, snapshot]);

  if (loading) return <main className="loading-screen"><BrandMark size={64}/><div/><span>Abrindo a sala privada</span></main>;
  if (!snapshot || !participant) return <JoinRoom code={code} nickname={nickname} setNickname={setNickname} onJoin={join} error={error}/>;
  if (snapshot.room.status === "drafting" && !campaign) return <SetupScreen fixedRatingsMode={snapshot.room.ratingsMode} onContinue={setup}/>;
  const squad = campaign?.currentSquadId ? squadsById.get(campaign.currentSquadId) : undefined;
  if (snapshot.room.status === "drafting" && participant.status !== "ready" && campaign?.screen === "draft" && squad) return <div className="multiplayer-draft"><DraftScreen key={`${squad.id}-${participant.draftPick}`} campaign={campaign} squad={squad} onConfirm={confirmPick} onReroll={() => {}} onRelocateLineupEntry={relocate} pickLimit={1} deadline={participant.draftDeadline} pickNumber={(participant.draftPick + 1) as 1 | 2} disableReroll/></div>;
  if (snapshot.room.status === "drafting" && participant.status !== "ready" && campaign?.screen === "analysis" && team) return <AnalysisScreen campaign={campaign} team={team} onStart={markReady} autoStartSeconds={ANALYSIS_SECONDS}/>;
  if (currentMatch && (currentMatch.status === "halftime" || currentMatch.status === "moment")) return <MultiplayerDecisionBreak snapshot={snapshot} participant={participant} match={currentMatch} onDone={refresh}/>;

  if (currentMatch?.result && (currentMatch.status === "playing" || (currentMatch.status === "finished" && dismissedResultId !== currentMatch.id))) {
    const home = { ...currentMatch.homeTeam, isUser: currentMatch.homeParticipantId === participant.id }; const away = { ...currentMatch.awayTeam, isUser: currentMatch.awayParticipantId === participant.id };
    const ownDecision = snapshot.decisions.find((item) => item.matchId === currentMatch.id && item.userId === snapshot.userId); const ownCampaign = participant.campaign!;
    const shootout = multiplayerShootoutProgress(currentMatch.status, currentMatch.result.penaltyKicks?.length ?? 0);
    const progress: MatchProgress = { matchId: currentMatch.id, minute: currentMatch.officialMinute, lineup: ownDecision?.lineup ?? ownCampaign.lineup, bench: ownDecision?.bench ?? ownCampaign.bench, substitutions: ownDecision?.substitutions ?? [], ...shootout };
    const displayResult = { ...currentMatch.result, instructions: { ...currentMatch.result.instructions, ...(currentMatch.officialMinute > 45 ? { halftime: currentMatch.result.instructions.halftime ?? "keep" as const } : {}), ...(currentMatch.officialMinute > 65 ? { moment: currentMatch.result.instructions.moment ?? "calm" as const } : {}) } };
    return <MatchScreen key={`${currentMatch.id}-${currentMatch.officialMinute}`} match={{ id: currentMatch.id, round: currentMatch.round, index: currentMatch.index, home, away }} result={displayResult} progress={progress} ratingsMode={snapshot.room.ratingsMode} onInstruction={() => {}} onLineupChange={() => {}} onProgress={() => {}} onFinish={() => setDismissedResultId(currentMatch.id)} playbackMode="follower" autoFinishAt={currentMatch.status === "finished" ? new Date(Date.parse(currentMatch.updatedAt) + TRANSITION_SECONDS * 1000).toISOString() : undefined}/>;
  }

  const allReady = snapshot.participants.length > 0 && snapshot.participants.every((item) => item.status === "ready" && item.team);
  if ((snapshot.room.status === "playing" || snapshot.room.status === "finished") && bracket) {
    const matchLabel = currentMatch?.status === "finished" ? "Aguardando os demais jogos" : currentMatch?.status === "ready" && ownReady ? "Aguardando rival" : currentMatch?.status === "waiting" || currentMatch?.status === "ready" ? (currentMatch.homeParticipantId && currentMatch.awayParticipantId ? "Pronto para jogar" : "Iniciar partida") : "Abrir partida";
    return <div className="multiplayer-shell"><RoomBar snapshot={snapshot} onCopy={copyInvite} onLeave={leave}/><BracketScreen bracket={bracket} ratingsMode={snapshot.room.ratingsMode} onPlay={prepareMatch} playLabel={matchLabel} playDisabled={currentMatch?.status === "finished" || (currentMatch?.status === "ready" && ownReady)}/>{notice && <p className="multiplayer-notice" role="status">{notice}</p>}</div>;
  }

  return <main className="multiplayer-lobby" id="main"><RoomBar snapshot={snapshot} onCopy={copyInvite} onLeave={leave}/><section className="multiplayer-lobby__hero"><div><h1>{snapshot.room.status === "waiting" ? "A sala espera o apito." : "Os elencos estão em montagem."}</h1><p>{snapshot.room.status === "waiting" ? "Confirme sua presença. Quando todos estiverem prontos, o anfitrião libera o draft para a sala inteira." : "Cada escolha tem 15 segundos. Quem terminar fica pronto para o mata-mata."}</p></div><dl><div><dt>Jogadores</dt><dd>{snapshot.participants.length}/16</dd></div><div><dt>Overall</dt><dd>{snapshot.room.ratingsMode === "visible" ? "Visível" : "Oculto"}</dd></div></dl></section>{snapshot.localDevelopment && <p className="multiplayer-dev-note"><b>Teste local</b> Esta sala existe apenas nesta execução do navegador.</p>}<section className="multiplayer-slots" aria-label="Participantes e vagas">{Array.from({ length: 16 }, (_, index) => { const player = snapshot.participants.find((item) => item.slotIndex === index); const status = player && participantStatus(player, snapshot); return <article key={index} className={player ? "is-filled" : "is-empty"}><span>{String(index + 1).padStart(2, "0")}</span>{player ? <div><b>{player.nickname}{player.userId === snapshot.room.hostUserId && <em>Anfitrião</em>}</b>{snapshot.room.status === "waiting" ? <small className={`multiplayer-status ${player.lobbyReady ? "is-ready" : "is-waiting"}`}>{player.lobbyReady && <CheckIcon/>}{player.lobbyReady ? "Pronto para começar" : "Aguardando confirmação"}</small> : <small className={`multiplayer-status is-${status}`}>{status === "drafting" ? <i/> : status === "ready" ? <CheckIcon/> : null}{statusLabels[status!]}</small>}</div> : <div><b>Vaga livre</b><small>Será preenchida por CPU</small></div>}{host && player && player.id !== participant.id && snapshot.room.status !== "playing" && <button type="button" className="multiplayer-kick" onClick={() => void kick(player)} aria-label={`Remover ${player.nickname}`}>Remover</button>}</article>; })}</section><footer className="multiplayer-lobby__actions"><button type="button" className="button button--quiet" onClick={copyInvite}>Copiar convite</button>{snapshot.room.status === "waiting" && <button type="button" className={participant.lobbyReady ? "button button--quiet multiplayer-presence-button is-ready" : "button button--primary multiplayer-presence-button"} disabled={actionPending} onClick={() => void toggleLobbyReady()}>{participant.lobbyReady && <CheckIcon/>}{participant.lobbyReady ? "Desfazer confirmação" : "Estou pronto"}</button>}{snapshot.room.status === "waiting" && host && <button type="button" className="button button--primary" disabled={!allLobbyReady || actionPending} onClick={beginDraft}>Iniciar montagem dos elencos<ArrowIcon/></button>}{snapshot.room.status === "drafting" && participant.status === "ready" && <span className="multiplayer-ready"><CheckIcon/> Elenco pronto</span>}{snapshot.room.status === "drafting" && allReady && <AutoAdvanceTimer seconds={TRANSITION_SECONDS} label="chaveamento" onComplete={host ? launch : undefined}/>} {snapshot.room.status === "drafting" && host && <button type="button" className="button button--primary" disabled={!allReady} onClick={launch}>{allReady ? "Iniciar agora" : "Iniciar torneio"}<ArrowIcon/></button>}</footer>{snapshot.room.status === "waiting" && host && !allLobbyReady && <p className="multiplayer-lobby__hint">O draft será liberado quando todos os participantes confirmarem presença.</p>}{snapshot.room.status === "drafting" && host && !allReady && <p className="multiplayer-lobby__hint">Participantes que entraram precisam concluir o elenco ou ser removidos antes do início.</p>}{notice && <p className="multiplayer-notice" role="status">{notice}</p>}{error && <p className="multiplayer-error" role="alert">{error}</p>}</main>;
}

function AutoAdvanceTimer({ seconds, label, onComplete }: { seconds: number; label: string; onComplete?: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState(seconds);
  const completed = useRef(false);
  const completeRef = useRef(onComplete);
  useEffect(() => { completeRef.current = onComplete; }, [onComplete]);
  useEffect(() => {
    const deadline = Date.now() + seconds * 1000;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0 && !completed.current) {
        completed.current = true;
        window.clearInterval(timer);
        completeRef.current?.();
      }
    }, 200);
    return () => window.clearInterval(timer);
  }, [seconds]);
  return <span className="auto-advance-timer" role="timer" aria-label={`${label} em ${secondsLeft} segundos`}><b>{secondsLeft}</b><small>{label}</small></span>;
}

function MultiplayerDecisionBreak({ snapshot, participant, match, onDone }: { snapshot: MultiplayerSnapshot; participant: MultiplayerParticipant; match: MultiplayerMatch; onDone: () => Promise<void> }) {
  const own = snapshot.decisions.find((item) => item.matchId === match.id && item.userId === snapshot.userId);
  const [lineup, setLineup] = useState(own?.lineup ?? participant.campaign?.lineup ?? []); const [bench, setBench] = useState(own?.bench ?? participant.campaign?.bench ?? []); const [substitutions, setSubstitutions] = useState(own?.substitutions ?? []); const [choice, setChoice] = useState<HalftimeInstruction | MatchMomentInstruction>(); const [seconds, setSeconds] = useState(15);
  const submitted = match.status === "halftime" ? Boolean(own?.instructions.halftime) : Boolean(own?.instructions.moment); const team = match.homeParticipantId === participant.id ? match.homeTeam : match.awayTeam; const moment = match.result?.matchMoment ? matchMoments[match.result.matchMoment] : undefined; const options = match.status === "halftime" ? halftimeOptions : moment?.choices ?? [];
  useEffect(() => { const update = () => setSeconds(Math.max(0, Math.ceil((Date.parse(match.decisionDeadline ?? new Date().toISOString()) - Date.now()) / 1000))); update(); const timer = window.setInterval(update, 200); return () => window.clearInterval(timer); }, [match.decisionDeadline]);
  const changeLineup = (nextLineup: LineupEntry[], nextBench: SquadPlayerEntry[]) => { const oldIds = new Set(lineup.map((item) => item.playerId)); const nextIds = new Set(nextLineup.map((item) => item.playerId)); const outgoing = lineup.find((item) => !nextIds.has(item.playerId)); const incoming = nextLineup.find((item) => !oldIds.has(item.playerId)); if (outgoing && incoming && substitutions.length < 5) setSubstitutions((current) => [...current, { minute: match.officialMinute, outPlayerId: outgoing.playerId, inPlayerId: incoming.playerId, outName: playersById.get(outgoing.playerId)?.name ?? "Titular", inName: playersById.get(incoming.playerId)?.name ?? "Reserva" }]); setLineup(nextLineup); setBench(nextBench); };
  const submit = async () => { if (!choice || submitted) return; const previous = own?.instructions ?? {}; const instructions = match.status === "halftime" ? { ...previous, halftime: choice as HalftimeInstruction } : { ...previous, moment: choice as MatchMomentInstruction }; await saveMultiplayerDecision(match.id, instructions, { lineup, bench, substitutions }); await onDone(); };
  return <main className="multiplayer-break" id="main"><header><div><span>{match.status === "halftime" ? "INTERVALO" : "65 MINUTOS"}</span><h1>Tempo para alterações.</h1><p>A partida está parada para os dois jogadores.</p></div><Countdown seconds={seconds}/></header>{submitted ? <section className="multiplayer-break__waiting"><CheckIcon/><h2>Decisão confirmada</h2><p>Aguardando o rival ou o fim do cronômetro.</p></section> : <><section className="multiplayer-break__choices" aria-label="Orientação tática">{options.map((option) => <button type="button" key={option.id} className={choice === option.id ? "is-selected" : ""} onClick={() => setChoice(option.id)}><b>{option.label}</b><small>{option.detail}</small></button>)}</section><TacticalEditor formationId={team.formation} tactic={team.tactic} lineup={lineup} bench={bench} compact showRatings={snapshot.room.ratingsMode === "visible"} unavailablePlayerIds={substitutions.map((item) => item.outPlayerId)} unavailableLabel="Já saiu" onChange={changeLineup}/><button type="button" className="button button--primary multiplayer-break__confirm" disabled={!choice || seconds === 0} onClick={() => void submit()}>Confirmar alterações<ArrowIcon/></button></>}</main>;
}

function Countdown({ seconds }: { seconds: number }) { return <div className="multiplayer-countdown" role="timer" aria-label={`${seconds} segundos restantes`}><svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="21"/><circle cx="26" cy="26" r="21" style={{ strokeDashoffset: 132 - (132 * seconds) / 15 }}/></svg><strong>{seconds}</strong><small>segundos</small></div>; }
function RoomBar({ snapshot, onCopy, onLeave }: { snapshot: MultiplayerSnapshot; onCopy: () => void; onLeave: () => void }) { return <header className="multiplayer-roombar"><Link href="/" aria-label="Ir para a página inicial"><BrandMark size={38}/></Link><div><span>Sala privada</span><b>{snapshot.room.code}</b></div><button type="button" onClick={onCopy}>Copiar convite</button><button type="button" onClick={onLeave}>Sair da sala</button></header>; }
function JoinRoom({ code, nickname, setNickname, onJoin, error }: { code: string; nickname: string; setNickname: (value: string) => void; onJoin: () => void; error?: string }) { return <main className="multiplayer-join" id="main"><section><Link href="/multiplayer" className="multiplayer-brand"><BrandMark size={44}/><span>Multiplayer privado</span></Link><span>Convite {code}</span><h1>Entre em campo.</h1><p>Use apenas um apelido. Nenhum dado pessoal é necessário.</p><label className="multiplayer-field"><span>Seu apelido</span><input value={nickname} maxLength={24} autoFocus onChange={(event) => setNickname(event.target.value)} placeholder="Nome na sala"/></label><button type="button" className="button button--primary button--wide" disabled={nickname.trim().length < 2 || (!multiplayerConfigured && !multiplayerLocalDevelopment)} onClick={onJoin}>Entrar na sala<ArrowIcon/></button>{!multiplayerConfigured && <p className="multiplayer-dev-note">{multiplayerLocalDevelopment ? "Sem Supabase, somente salas criadas nesta mesma execução podem ser abertas." : "Esta sala será liberada quando o Supabase estiver conectado ao projeto."}</p>}{error && <p className="multiplayer-error" role="alert">{error}</p>}</section></main>; }

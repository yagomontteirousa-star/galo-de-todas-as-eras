"use client";

import { useEffect, useMemo, useState } from "react";
import { squadsById } from "@/data/atletico-squads";
import { GameHeader } from "@/components/game/GameHeader";
import { HomeScreen } from "@/components/game/screens/HomeScreen";
import { SetupScreen } from "@/components/game/screens/SetupScreen";
import { DraftScreen } from "@/components/game/screens/DraftScreen";
import { AnalysisScreen } from "@/components/game/screens/AnalysisScreen";
import { BracketScreen } from "@/components/game/screens/BracketScreen";
import { TacticsScreen } from "@/components/game/screens/TacticsScreen";
import { MatchScreen } from "@/components/game/screens/MatchScreen";
import { OutcomeScreen } from "@/components/game/screens/OutcomeScreen";
import { CampaignSnapshotScreen } from "@/components/game/screens/CampaignSnapshotScreen";
import { appendHistory, archiveCampaign, buildUserTeam, CAMPAIGN_STORAGE_KEY, clearLegacyStorage, createCampaign, LAST_CAMPAIGN_STORAGE_KEY, nextAvailableSquad, readHistory, readStoredCampaign, startDraft, toRecord, touchCampaign } from "@/lib/campaign";
import { createBracket, getCurrentUserMatch, resolveCurrentRound, withCurrentUserTeam } from "@/lib/bracket";
import { seededRandom, simulateMatch } from "@/lib/simulation";
import { TutorialCoach } from "@/components/game/TutorialCoach";
import { BrandMark } from "@/components/ui/Brand";
import { useLivePlayers } from "@/components/game/LivePlayers";
import { nextTip, readTutorial, restartTutorial, saveTutorial, tutorialTouched, type TutorialState } from "@/lib/tutorial";
import type { Campaign, CampaignRecord, FormationId, LineupEntry, MatchInstructions, RatingsMode, SharedCampaign, SquadPlayerEntry, TacticId } from "@/types/game";

function homeCampaign(): Campaign { return { ...createCampaign(), screen: "home" }; }

export function Game() {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [lastCampaign, setLastCampaign] = useState<Campaign | null>(null);
  const [history, setHistory] = useState<CampaignRecord[]>([]);
  const [reviewedSnapshot, setReviewedSnapshot] = useState<SharedCampaign>();
  const [tutorial, setTutorial] = useState<TutorialState>({ dismissed: true, seen: [] });
  const [storageWarning, setStorageWarning] = useState(false);
  const livePlayers = useLivePlayers(Boolean(campaign && campaign.screen !== "home"));
  const activeScreen = campaign?.screen;
  const activeSquadId = campaign?.currentSquadId;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      clearLegacyStorage();
      const storedLast = readStoredCampaign(LAST_CAMPAIGN_STORAGE_KEY);
      const storedHistory = readHistory();
      const storedLastRecord = storedLast ? toRecord(storedLast) : undefined;
      setLastCampaign(storedLast);
      setHistory(storedLast
        ? storedHistory.map((record) => record.id === storedLast.id && !record.snapshot
          ? { ...record, snapshot: storedLastRecord?.snapshot }
          : record)
        : storedHistory);
      setTutorial(readTutorial());
      // Chegou de um link compartilhado pedindo campanha nova: começa do zero neste
      // aparelho, sem tocar no resultado que o link carrega.
      if (new URLSearchParams(window.location.search).has("nova")) {
        window.history.replaceState(null, "", window.location.pathname);
        setCampaign(createCampaign());
        return;
      }
      setCampaign(readStoredCampaign(CAMPAIGN_STORAGE_KEY) ?? homeCampaign());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Campanha encerrada já foi arquivada em finishMatch; o slot ativo fica livre para a próxima.
    if (!campaign || campaign.finishedAt) return;
    try { window.localStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(campaign)); }
    catch { window.setTimeout(() => setStorageWarning(true), 0); }
  }, [campaign]);

  useEffect(() => {
    if (activeScreen) window.scrollTo(0, 0);
  }, [activeScreen, activeSquadId]);

  const team = useMemo(() => campaign?.lineup.length === 11 ? buildUserTeam(campaign) : undefined, [campaign]);
  if (!campaign) return <main className="loading-screen"><BrandMark size={72}/><div/><span>Abrindo o arquivo do Galo</span></main>;

  const update = (next: Campaign) => setCampaign(touchCampaign(next));
  const restart = () => { setReviewedSnapshot(undefined); setCampaign(createCampaign()); };
  // Campanha encerrada só navega; nada é reescrito no armazenamento ativo.
  const show = (screen: Campaign["screen"]) => campaign.finishedAt ? setCampaign({ ...campaign, screen }) : update({ ...campaign, screen });
  const goHome = () => { setReviewedSnapshot(undefined); show("home"); };
  const canResume = !campaign.finishedAt && Boolean(campaign.formation || campaign.lineup.length || campaign.bench.length || campaign.bracket);
  const reviewLast = () => {
    if (!lastCampaign) return;
    setReviewedSnapshot(undefined);
    setCampaign({ ...lastCampaign, screen: lastCampaign.outcome === "champion" ? "champion" : "eliminated" });
  };
  const resume = () => {
    const screen = campaign.pendingResult ? "match" : campaign.bracket ? "bracket" : campaign.lineup.length === 11 && campaign.bench.length === 7 ? "analysis" : campaign.formation ? "draft" : "setup";
    update({ ...campaign, screen });
  };
  const setup = (formation: FormationId, tactic: TacticId, ratingsMode: RatingsMode) => update(startDraft(campaign, formation, tactic, ratingsMode));
  const confirmPicks = (picks: LineupEntry[], benchPicks: SquadPlayerEntry[]) => {
    const usedSquadIds = campaign.currentSquadId && !campaign.usedSquadIds.includes(campaign.currentSquadId) ? [...campaign.usedSquadIds, campaign.currentSquadId] : campaign.usedSquadIds;
    const lineup = [...campaign.lineup, ...picks];
    const bench = [...campaign.bench, ...benchPicks];
    const base: Campaign = { ...campaign, lineup, bench, usedSquadIds, currentSquadId: undefined };
    if (lineup.length === 11 && bench.length === 7) { update({ ...base, screen: "analysis" }); return; }
    const next = nextAvailableSquad(base);
    update({ ...base, currentSquadId: next?.id, screen: "draft" });
  };
  const reroll = () => {
    if (!campaign.rerollsLeft || !campaign.currentSquadId) return;
    const usedSquadIds = campaign.usedSquadIds.includes(campaign.currentSquadId) ? campaign.usedSquadIds : [...campaign.usedSquadIds, campaign.currentSquadId];
    const base = { ...campaign, usedSquadIds, currentSquadId: undefined, rerollsLeft: campaign.rerollsLeft - 1 };
    update({ ...base, currentSquadId: nextAvailableSquad(base)?.id });
  };
  /** Troca as vagas de duas peças já fechadas; se o destino estiver livre, a peça só muda de lugar. */
  const relocateLineupEntry = (fromSlotId: string, toSlotId: string) => update({
    ...campaign,
    lineup: campaign.lineup.map((entry) =>
      entry.slotId === fromSlotId ? { ...entry, slotId: toSlotId }
        : entry.slotId === toSlotId ? { ...entry, slotId: fromSlotId } : entry),
  });
  const storeTutorial = (next: TutorialState) => { setTutorial(next); saveTutorial(next); };
  const markTip = (id: string) => storeTutorial({ ...tutorial, seen: [...tutorial.seen, id] });
  const dismissTutorial = () => storeTutorial({ ...tutorial, dismissed: true });
  const replayTutorial = () => storeTutorial(restartTutorial());
  const startTournament = () => {
    if (!team) return;
    update({ ...campaign, bracket: createBracket(team), screen: "bracket" });
  };
  const beginMatch = () => {
    if (!campaign.bracket) return;
    const match = getCurrentUserMatch(campaign.bracket);
    if (!match) return;
    update({ ...campaign, screen: "tactics" });
  };
  const startPreparedMatch = (lineup: LineupEntry[], bench: SquadPlayerEntry[]) => {
    if (!campaign.bracket) return;
    const preparedCampaign = { ...campaign, lineup, bench };
    const preparedTeam = buildUserTeam(preparedCampaign);
    const bracket = withCurrentUserTeam(campaign.bracket, preparedTeam);
    const match = getCurrentUserMatch(bracket);
    if (!match) return;
    const sameMatch = campaign.lastMatchId === match.id;
    const pendingMatchSeed = sameMatch && campaign.pendingMatchSeed !== undefined ? campaign.pendingMatchSeed : Math.floor(Math.random() * 4294967296);
    const matchInstructions = sameMatch ? campaign.matchInstructions ?? {} : {};
    const pendingResult = sameMatch && campaign.pendingResult
      ? campaign.pendingResult
      : simulateMatch(match.home, match.away, seededRandom(pendingMatchSeed), matchInstructions);
    update({ ...preparedCampaign, bracket, suspendedPlayerIds: [], screen: "match", lastMatchId: match.id, pendingMatchSeed, matchInstructions, pendingResult });
  };
  const applyInstruction = (instructions: MatchInstructions) => {
    if (!campaign.bracket || campaign.pendingMatchSeed === undefined) return;
    const match = getCurrentUserMatch(campaign.bracket);
    if (!match) return;
    update({
      ...campaign,
      matchInstructions: instructions,
      pendingResult: simulateMatch(match.home, match.away, seededRandom(campaign.pendingMatchSeed), instructions),
    });
  };
  const finishMatch = () => {
    if (!campaign.bracket || !campaign.pendingResult) return;
    const userWon = campaign.pendingResult.winnerId === "user-team";
    const bracket = resolveCurrentRound(campaign.bracket, campaign.pendingResult);
    const wins = campaign.wins + (userWon ? 1 : 0);
    const isChampion = Boolean(bracket.champion?.isUser);
    const screen = !userWon ? "eliminated" : isChampion ? "champion" : "victory";
    const suspendedPlayerIds = campaign.pendingResult.events
      .filter((event) => event.type === "red_card" && event.teamId === "user-team" && event.playerId)
      .map((event) => event.playerId!);
    const next: Campaign = { ...campaign, bracket, wins, screen, pendingResult: undefined, pendingMatchSeed: undefined, matchInstructions: undefined, suspendedPlayerIds };
    if (userWon && !isChampion) { update(next); return; }
    const finished = touchCampaign({ ...next, finishedAt: new Date().toISOString(), outcome: isChampion ? "champion" : "eliminated" });
    const nextHistory = appendHistory(toRecord(finished), history);
    setHistory(nextHistory);
    setLastCampaign(finished);
    archiveCampaign(finished, nextHistory);
    setCampaign(finished);
  };

  const currentSquad = campaign.currentSquadId ? squadsById.get(campaign.currentSquadId) : undefined;
  const currentMatch = campaign.bracket ? getCurrentUserMatch(campaign.bracket) : undefined;
  const tip = nextTip(tutorial, campaign.screen);

  return <div className="game-app">
    <a className="skip-link" href="#main">Pular para o conteúdo</a>
    <GameHeader campaign={campaign} overall={team?.overall.final} onHome={goHome} onRestart={restart}/>
    {storageWarning && <div className="storage-warning" role="status">O navegador bloqueou o salvamento. Você pode jogar, mas esta campanha pode não continuar após fechar a aba.</div>}
    {campaign.screen === "home" && reviewedSnapshot && <CampaignSnapshotScreen data={reviewedSnapshot} onBack={() => setReviewedSnapshot(undefined)} onRestart={restart}/>}
    {campaign.screen === "home" && !reviewedSnapshot && <HomeScreen onStart={restart} onResume={resume} canResume={canResume} onReviewLast={reviewLast} lastOutcome={lastCampaign?.outcome} history={history} livePlayers={livePlayers} onReplayTutorial={tutorialTouched(tutorial) ? replayTutorial : undefined}/>}
    {campaign.screen === "setup" && <SetupScreen onContinue={setup}/>}
    {campaign.screen === "draft" && currentSquad && (
      <DraftScreen key={currentSquad.id} campaign={campaign} squad={currentSquad} onConfirm={confirmPicks} onReroll={reroll} onRelocateLineupEntry={relocateLineupEntry}/>
    )}
    {campaign.screen === "draft" && !currentSquad && <main className="error-screen" id="main"><h1>O arquivo desta era não abriu.</h1><p>A campanha foi preservada. Sorteie outro elenco para continuar.</p><button type="button" className="button button--primary" onClick={() => { const next = nextAvailableSquad(campaign); update({ ...campaign, currentSquadId: next?.id }); }}>Tentar outro elenco</button></main>}
    {campaign.screen === "analysis" && team && <AnalysisScreen campaign={campaign} team={team} onStart={startTournament}/>} 
    {campaign.screen === "bracket" && campaign.bracket && (
      <BracketScreen bracket={campaign.bracket} ratingsMode={campaign.ratingsMode ?? "visible"} onPlay={beginMatch}
        onBackToResult={campaign.finishedAt && campaign.outcome ? () => show(campaign.outcome!) : undefined}/>
    )} 
    {campaign.screen === "tactics" && currentMatch && campaign.bracket && (
      <TacticsScreen campaign={campaign} match={currentMatch} onBack={() => show("bracket")} onStart={startPreparedMatch}/>
    )}
    {campaign.screen === "match" && currentMatch && campaign.pendingResult && <MatchScreen key={currentMatch.id} match={currentMatch} result={campaign.pendingResult} ratingsMode={campaign.ratingsMode ?? "visible"} onInstruction={applyInstruction} onFinish={finishMatch}/>} 
    {campaign.screen === "victory" && <OutcomeScreen campaign={campaign} outcome="victory" onContinue={() => show("bracket")} onRestart={restart}/>}
    {campaign.screen === "eliminated" && (
      <OutcomeScreen campaign={campaign} outcome="eliminated" onContinue={() => show("bracket")} onRestart={restart}/>
    )}
    {campaign.screen === "champion" && (
      <OutcomeScreen campaign={campaign} outcome="champion" onContinue={() => show("bracket")} onRestart={restart}/>
    )}
    {tip && <TutorialCoach key={tip.id} tip={tip} onNext={() => markTip(tip.id)} onDismiss={dismissTutorial}/>}
  </div>;
}

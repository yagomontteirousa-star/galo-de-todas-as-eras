"use client";

import { useEffect, useMemo, useState } from "react";
import { squadsById } from "@/data/atletico-squads";
import { GameHeader } from "@/components/game/GameHeader";
import { HomeScreen } from "@/components/game/screens/HomeScreen";
import { SetupScreen } from "@/components/game/screens/SetupScreen";
import { DraftScreen } from "@/components/game/screens/DraftScreen";
import { AnalysisScreen } from "@/components/game/screens/AnalysisScreen";
import { BracketScreen } from "@/components/game/screens/BracketScreen";
import { MatchScreen } from "@/components/game/screens/MatchScreen";
import { OutcomeScreen } from "@/components/game/screens/OutcomeScreen";
import { buildUserTeam, CAMPAIGN_STORAGE_KEY, createCampaign, hydrateCampaign, LEGACY_CAMPAIGN_STORAGE_KEY, nextAvailableSquad, startDraft, touchCampaign } from "@/lib/campaign";
import { createBracket, getCurrentUserMatch, resolveCurrentRound } from "@/lib/bracket";
import { seededRandom, simulateMatch } from "@/lib/simulation";
import type { Campaign, FormationId, LineupEntry, MatchInstructions, RatingsMode, TacticId } from "@/types/game";

function homeCampaign(): Campaign { return { ...createCampaign(), screen: "home" }; }

export function Game() {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [storageWarning, setStorageWarning] = useState(false);
  const activeScreen = campaign?.screen;
  const activeSquadId = campaign?.currentSquadId;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(CAMPAIGN_STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_CAMPAIGN_STORAGE_KEY);
        setCampaign(hydrateCampaign(saved) ?? homeCampaign());
      }
      catch { setStorageWarning(true); setCampaign(homeCampaign()); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!campaign) return;
    try { window.localStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(campaign)); }
    catch { window.setTimeout(() => setStorageWarning(true), 0); }
  }, [campaign]);

  useEffect(() => {
    if (activeScreen) window.scrollTo(0, 0);
  }, [activeScreen, activeSquadId]);

  const team = useMemo(() => campaign?.lineup.length === 11 ? buildUserTeam(campaign) : undefined, [campaign]);
  if (!campaign) return <main className="loading-screen"><div/><span>Preparando o arquivo histórico…</span></main>;

  const update = (next: Campaign) => setCampaign(touchCampaign(next));
  const restart = () => setCampaign(createCampaign());
  const goHome = () => update({ ...campaign, screen: "home" });
  const canResume = Boolean(campaign.formation || campaign.lineup.length || campaign.bracket);
  const resume = () => {
    const screen = campaign.pendingResult ? "match" : campaign.bracket ? "bracket" : campaign.lineup.length === 11 ? "analysis" : campaign.formation ? "draft" : "setup";
    update({ ...campaign, screen });
  };
  const setup = (formation: FormationId, tactic: TacticId, ratingsMode: RatingsMode) => update(startDraft(campaign, formation, tactic, ratingsMode));
  const confirmPicks = (picks: LineupEntry[]) => {
    const usedSquadIds = campaign.currentSquadId && !campaign.usedSquadIds.includes(campaign.currentSquadId) ? [...campaign.usedSquadIds, campaign.currentSquadId] : campaign.usedSquadIds;
    const lineup = [...campaign.lineup, ...picks];
    const base: Campaign = { ...campaign, lineup, usedSquadIds, currentSquadId: undefined };
    if (lineup.length === 11) { update({ ...base, screen: "analysis" }); return; }
    const next = nextAvailableSquad(base);
    update({ ...base, currentSquadId: next?.id, screen: "draft" });
  };
  const reroll = () => {
    if (!campaign.rerollsLeft || !campaign.currentSquadId) return;
    const usedSquadIds = campaign.usedSquadIds.includes(campaign.currentSquadId) ? campaign.usedSquadIds : [...campaign.usedSquadIds, campaign.currentSquadId];
    const base = { ...campaign, usedSquadIds, currentSquadId: undefined, rerollsLeft: campaign.rerollsLeft - 1 };
    update({ ...base, currentSquadId: nextAvailableSquad(base)?.id });
  };
  const removeLineupEntry = (slotId: string) => update({ ...campaign, lineup: campaign.lineup.filter((entry) => entry.slotId !== slotId) });
  const startTournament = () => {
    if (!team) return;
    update({ ...campaign, bracket: createBracket(team), screen: "bracket" });
  };
  const beginMatch = () => {
    if (!campaign.bracket) return;
    const match = getCurrentUserMatch(campaign.bracket);
    if (!match) return;
    const sameMatch = campaign.lastMatchId === match.id;
    const pendingMatchSeed = sameMatch && campaign.pendingMatchSeed !== undefined ? campaign.pendingMatchSeed : Math.floor(Math.random() * 4294967296);
    const matchInstructions = sameMatch ? campaign.matchInstructions ?? {} : {};
    const pendingResult = sameMatch && campaign.pendingResult
      ? campaign.pendingResult
      : simulateMatch(match.home, match.away, seededRandom(pendingMatchSeed), matchInstructions);
    update({ ...campaign, screen: "match", lastMatchId: match.id, pendingMatchSeed, matchInstructions, pendingResult });
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
    const screen = !userWon ? "eliminated" : bracket.champion?.isUser ? "champion" : "victory";
    update({ ...campaign, bracket, wins, screen, pendingResult: undefined, pendingMatchSeed: undefined, matchInstructions: undefined });
  };

  const currentSquad = campaign.currentSquadId ? squadsById.get(campaign.currentSquadId) : undefined;
  const currentMatch = campaign.bracket ? getCurrentUserMatch(campaign.bracket) : undefined;

  return <div className="game-app">
    <a className="skip-link" href="#main">Pular para o conteúdo</a>
    <GameHeader campaign={campaign} onHome={goHome} onRestart={restart}/>
    {storageWarning && <div className="storage-warning" role="status">O navegador bloqueou o salvamento. Você pode jogar, mas esta campanha pode não continuar após fechar a aba.</div>}
    {campaign.screen === "home" && <HomeScreen onStart={restart} onResume={resume} canResume={canResume}/>} 
    {campaign.screen === "setup" && <SetupScreen onContinue={setup}/>} 
    {campaign.screen === "draft" && currentSquad && (
      <DraftScreen key={currentSquad.id} campaign={campaign} squad={currentSquad} onConfirm={confirmPicks} onReroll={reroll} onRemoveLineupEntry={removeLineupEntry}/>
    )}
    {campaign.screen === "draft" && !currentSquad && <main className="error-screen" id="main"><h1>O arquivo desta era não abriu.</h1><p>A campanha foi preservada. Sorteie outro elenco para continuar.</p><button type="button" className="button button--primary" onClick={() => { const next = nextAvailableSquad(campaign); update({ ...campaign, currentSquadId: next?.id }); }}>Tentar outro elenco</button></main>}
    {campaign.screen === "analysis" && team && <AnalysisScreen campaign={campaign} team={team} onStart={startTournament}/>} 
    {campaign.screen === "bracket" && campaign.bracket && <BracketScreen bracket={campaign.bracket} ratingsMode={campaign.ratingsMode ?? "visible"} onPlay={beginMatch}/>} 
    {campaign.screen === "match" && currentMatch && campaign.pendingResult && <MatchScreen key={currentMatch.id} match={currentMatch} result={campaign.pendingResult} ratingsMode={campaign.ratingsMode ?? "visible"} onInstruction={applyInstruction} onFinish={finishMatch}/>} 
    {campaign.screen === "victory" && <OutcomeScreen campaign={campaign} outcome="victory" onContinue={() => update({ ...campaign, screen: "bracket" })} onRestart={restart}/>} 
    {campaign.screen === "eliminated" && (
      <OutcomeScreen campaign={campaign} outcome="eliminated" onContinue={() => update({ ...campaign, screen: "bracket" })} onRestart={restart}/>
    )}
    {campaign.screen === "champion" && (
      <OutcomeScreen campaign={campaign} outcome="champion" onContinue={() => update({ ...campaign, screen: "bracket" })} onRestart={restart}/>
    )}
  </div>;
}

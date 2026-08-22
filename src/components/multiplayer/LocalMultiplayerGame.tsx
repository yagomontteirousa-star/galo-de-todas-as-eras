"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnalysisScreen } from "@/components/game/screens/AnalysisScreen";
import { BracketScreen } from "@/components/game/screens/BracketScreen";
import { DraftScreen } from "@/components/game/screens/DraftScreen";
import { MatchScreen } from "@/components/game/screens/MatchScreen";
import { SetupScreen } from "@/components/game/screens/SetupScreen";
import { BrandMark } from "@/components/ui/Brand";
import { ArrowIcon } from "@/components/ui/Icons";
import { atleticoSquads, playersById, squadsById } from "@/data/atletico-squads";
import { buildUserTeam, createCampaign, startDraft, touchCampaign } from "@/lib/campaign";
import { createMultiplayerBracket } from "@/lib/multiplayer/tournament";
import { seededRandom, simulateMatch } from "@/lib/simulation";
import { roundOrder } from "@/lib/bracket";
import type { BracketMatch, BracketState, Campaign, FormationId, LineupEntry, MatchInstructions, MatchProgress, RatingsMode, TacticId, TeamSnapshot } from "@/types/game";
import type { MultiplayerBracketSize, MultiplayerParticipant } from "@/types/multiplayer";

type LocalPlayer = {
  id: string;
  name: string;
  schedule: string[];
  campaign?: Campaign;
  team?: TeamSnapshot;
  round: number;
  pick: 0 | 1;
  deadline?: string;
};

type LocalStage = "players" | "setup" | "draft" | "analysis" | "bracket" | "match" | "finished";

const deadline = () => new Date(Date.now() + 15_000).toISOString();

function schedulesFor(count: number) {
  const schedules = Array.from({ length: count }, () => [] as string[]);
  for (let round = 0; round < 6; round += 1) {
    const pool = [...atleticoSquads].sort(() => Math.random() - 0.5);
    schedules.forEach((schedule, index) => schedule.push(pool[index % pool.length].id));
  }
  return schedules;
}

function personIds(campaign: Campaign) {
  return campaign.lineup.map((entry) => playersById.get(entry.playerId)?.personId).filter((value): value is string => Boolean(value));
}

function localParticipants(players: LocalPlayer[]): MultiplayerParticipant[] {
  const now = new Date().toISOString();
  return players.map((player, index) => ({
    id: player.id,
    roomId: "local",
    userId: player.id,
    nickname: player.name,
    slotIndex: index,
    status: "ready",
    campaign: player.campaign,
    team: player.team,
    draftSchedule: player.schedule,
    draftRound: player.round,
    draftPick: player.pick,
    draftedPersonIds: player.campaign ? personIds(player.campaign) : [],
    connected: true,
    lobbyReady: true,
    createdAt: now,
    updatedAt: now,
  }));
}

function markLocalHumans(bracket: BracketState): BracketState {
  return {
    ...bracket,
    rounds: bracket.rounds.map((round) => ({
      ...round,
      matches: round.matches.map((match) => ({
        ...match,
        home: { ...match.home, isUser: match.home.controller === "human" },
        away: { ...match.away, isUser: match.away.controller === "human" },
      })),
    })),
  };
}

function resultFor(match: BracketMatch) {
  const home = { ...match.home, isUser: match.home.controller === "human" };
  const away = { ...match.away, isUser: match.home.controller !== "human" && match.away.controller === "human" };
  return simulateMatch(home, away, seededRandom(Math.floor(Math.random() * 2_147_483_647)));
}

function settleCpuMatches(bracket: BracketState): BracketState {
  const rounds = bracket.rounds.map((round) => round.id !== bracket.currentRound ? round : {
    ...round,
    matches: round.matches.map((match) => match.result || match.home.controller !== "cpu" || match.away.controller !== "cpu"
      ? match
      : { ...match, result: resultFor(match) }),
  });
  return { ...bracket, rounds };
}

function advanceBracket(bracket: BracketState): BracketState {
  const settled = settleCpuMatches(bracket);
  const current = settled.rounds.find((round) => round.id === settled.currentRound);
  if (!current || current.matches.some((match) => !match.result)) return settled;
  if (current.id === "final") {
    const final = current.matches[0];
    return { ...settled, champion: final.result?.winnerId === final.home.id ? final.home : final.away };
  }
  const winners = current.matches.map((match) => match.result?.winnerId === match.home.id ? match.home : match.away);
  const nextId = roundOrder[roundOrder.indexOf(current.id) + 1];
  const nextRound = {
    id: nextId,
    matches: Array.from({ length: winners.length / 2 }, (_, index): BracketMatch => ({
      id: crypto.randomUUID(),
      round: nextId,
      index,
      home: winners[index * 2],
      away: winners[index * 2 + 1],
    })),
  };
  return settleCpuMatches({ ...settled, currentRound: nextId, rounds: [...settled.rounds, nextRound] });
}

export function LocalMultiplayerGame() {
  const [stage, setStage] = useState<LocalStage>("players");
  const [names, setNames] = useState(["Jogador 1", "Jogador 2"]);
  const [ratingsMode, setRatingsMode] = useState<RatingsMode>("visible");
  const [bracketSize, setBracketSize] = useState<MultiplayerBracketSize>(4);
  const [players, setPlayers] = useState<LocalPlayer[]>([]);
  const [playerIndex, setPlayerIndex] = useState(0);
  const [bracket, setBracket] = useState<BracketState>();
  const [activeMatch, setActiveMatch] = useState<BracketMatch>();
  const [activeResult, setActiveResult] = useState<ReturnType<typeof resultFor>>();
  const currentPlayer = players[playerIndex];
  const campaign = currentPlayer?.campaign;
  const squad = campaign?.currentSquadId ? squadsById.get(campaign.currentSquadId) : undefined;

  const pendingMatch = useMemo(() => {
    const current = bracket?.rounds.find((round) => round.id === bracket.currentRound);
    return current?.matches.find((match) => !match.result && (match.home.controller === "human" || match.away.controller === "human"));
  }, [bracket]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [playerIndex, stage]);

  const begin = () => {
    const clean = names.map((name, index) => name.trim() || `Jogador ${index + 1}`);
    const schedules = schedulesFor(clean.length);
    setPlayers(clean.map((name, index) => ({ id: crypto.randomUUID(), name, schedule: schedules[index], round: 0, pick: 0, deadline: deadline() })));
    setPlayerIndex(0);
    setStage("setup");
  };

  const setup = (formation: FormationId, tactic: TacticId) => {
    setPlayers((current) => current.map((player, index) => index !== playerIndex ? player : {
      ...player,
      campaign: touchCampaign({
        ...startDraft({ ...createCampaign(), ratingsMode }, formation, tactic, ratingsMode),
        currentSquadId: player.schedule[0],
        rerollsLeft: 0,
        bench: [],
      }),
      deadline: deadline(),
    }));
    setStage("draft");
  };

  const confirmPick = (picks: LineupEntry[]) => {
    if (!currentPlayer || !campaign || picks.length !== 1) return;
    const base = touchCampaign({ ...campaign, lineup: [...campaign.lineup, ...picks], bench: [] });
    const complete = base.lineup.length === 11;
    const closesYear = currentPlayer.pick === 1 || complete;
    const nextRound = closesYear ? currentPlayer.round + 1 : currentPlayer.round;
    const nextPick = (closesYear ? 0 : 1) as 0 | 1;
    const nextCampaign = touchCampaign({
      ...base,
      usedSquadIds: closesYear && campaign.currentSquadId && !campaign.usedSquadIds.includes(campaign.currentSquadId)
        ? [...campaign.usedSquadIds, campaign.currentSquadId]
        : campaign.usedSquadIds,
      currentSquadId: complete ? undefined : currentPlayer.schedule[nextRound],
      screen: complete ? "analysis" : "draft",
    });
    setPlayers((current) => current.map((player, index) => index !== playerIndex ? player : {
      ...player,
      campaign: nextCampaign,
      team: complete ? { ...buildUserTeam(nextCampaign), id: `local-${player.id}`, name: player.name, participantId: player.id, controller: "human" } : undefined,
      round: nextRound,
      pick: nextPick,
      deadline: complete ? undefined : deadline(),
    }));
    setStage(complete ? "analysis" : "draft");
  };

  const relocate = (fromSlotId: string, toSlotId: string) => {
    if (!campaign) return;
    setPlayers((current) => current.map((player, index) => index !== playerIndex ? player : {
      ...player,
      campaign: touchCampaign({ ...campaign, lineup: campaign.lineup.map((entry) => entry.slotId === fromSlotId ? { ...entry, slotId: toSlotId } : entry.slotId === toSlotId ? { ...entry, slotId: fromSlotId } : entry) }),
    }));
  };

  const finishPlayer = () => {
    if (playerIndex < players.length - 1) {
      setPlayerIndex((value) => value + 1);
      setStage("setup");
      return;
    }
    const next = markLocalHumans(createMultiplayerBracket(localParticipants(players), Math.floor(Math.random() * 2_147_483_647), bracketSize));
    setBracket(settleCpuMatches(next));
    setStage("bracket");
  };

  const play = () => {
    if (!pendingMatch) return;
    setActiveMatch(pendingMatch);
    setActiveResult(resultFor(pendingMatch));
    setStage("match");
  };

  const saveInstruction = (instructions: MatchInstructions) => {
    if (!activeMatch || !activeResult) return;
    setActiveResult(simulateMatch(
      { ...activeMatch.home, isUser: activeMatch.home.controller === "human" },
      { ...activeMatch.away, isUser: activeMatch.home.controller !== "human" && activeMatch.away.controller === "human" },
      seededRandom(activeMatch.id.split("").reduce((total, value) => total + value.charCodeAt(0), 0)),
      instructions,
    ));
  };

  const finishMatch = () => {
    if (!bracket || !activeMatch || !activeResult) return;
    const updated: BracketState = {
      ...bracket,
      rounds: bracket.rounds.map((round) => ({
        ...round,
        matches: round.matches.map((match) => match.id === activeMatch.id ? { ...match, result: activeResult } : match),
      })),
    };
    const next = advanceBracket(updated);
    setBracket(next);
    setActiveMatch(undefined);
    setActiveResult(undefined);
    setStage(next.champion ? "finished" : "bracket");
  };

  if (stage === "players") return <main className="local-multiplayer" id="main"><section className="local-multiplayer__setup"><Link href="/multiplayer" className="multiplayer-brand"><BrandMark size={44}/><span>Jogar com amigos</span></Link><span>Mesmo dispositivo</span><h1>Monte a roda.</h1><p>Cada pessoa recebe o aparelho para montar o próprio time. Depois, os confrontos seguem pela chave.</p><div className="local-player-fields">{names.map((name, index) => <label key={index} htmlFor={`local-player-${index}`}><span>Jogador {index + 1}</span><input id={`local-player-${index}`} name={`local-player-${index}`} value={name} maxLength={24} onChange={(event) => setNames((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}/>{names.length > 2 && <button type="button" onClick={() => setNames((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remover</button>}</label>)}</div><button type="button" className="button button--quiet" disabled={names.length >= 8} onClick={() => setNames((current) => [...current, `Jogador ${current.length + 1}`])}>Adicionar jogador</button><fieldset className="local-rules"><legend>Regra da partida</legend><button type="button" className={ratingsMode === "visible" ? "is-selected" : ""} onClick={() => setRatingsMode("visible")}><b>Quero uma ajuda</b><small>Overall visível</small></button><button type="button" className={ratingsMode === "memory" ? "is-selected" : ""} onClick={() => setRatingsMode("memory")}><b>Tenho cabedal</b><small>Overall oculto</small></button></fieldset><fieldset className="local-rules"><legend>Tamanho da chave</legend>{([4, 8, 16] as MultiplayerBracketSize[]).map((size) => <button type="button" key={size} disabled={size < names.length} className={bracketSize === size ? "is-selected" : ""} onClick={() => setBracketSize(size)}><b>{size}</b><small>equipes</small></button>)}</fieldset><button type="button" className="button button--primary button--wide" onClick={begin}>Começar montagem<ArrowIcon/></button></section></main>;

  if (stage === "setup" && currentPlayer) return <div className="local-pass"><PassDevice player={currentPlayer.name} action="definir formação e tática"/><SetupScreen fixedRatingsMode={ratingsMode} deadline={currentPlayer.deadline} onContinue={setup}/></div>;
  if (stage === "draft" && currentPlayer && campaign && squad) return <div className="multiplayer-draft local-pass"><PassDevice player={currentPlayer.name} action={`escolher atleta ${currentPlayer.pick + 1} de 2`}/><DraftScreen key={`${currentPlayer.id}-${squad.id}-${currentPlayer.pick}`} campaign={campaign} squad={squad} onConfirm={confirmPick} onReroll={() => {}} onRelocateLineupEntry={relocate} pickLimit={1} reserveLimit={0} deadline={currentPlayer.deadline} pickNumber={(currentPlayer.pick + 1) as 1 | 2} disableReroll/></div>;
  if (stage === "analysis" && currentPlayer?.campaign && currentPlayer.team) return <div className="local-pass"><PassDevice player={currentPlayer.name} action="revisar o onze"/><AnalysisScreen campaign={currentPlayer.campaign} team={currentPlayer.team} onStart={finishPlayer} autoStartSeconds={5}/></div>;
  if ((stage === "bracket" || stage === "finished") && bracket) return <div className="multiplayer-shell"><header className="local-roombar"><Link href="/multiplayer"><BrandMark size={38}/></Link><div><span>Multiplayer local</span><b>{players.length} jogadores · chave {bracketSize}</b></div></header><BracketScreen bracket={bracket} ratingsMode={ratingsMode} onPlay={play} playLabel={pendingMatch ? `Jogar ${pendingMatch.home.name} × ${pendingMatch.away.name}` : undefined} playDisabled={!pendingMatch}/></div>;
  if (stage === "match" && activeMatch && activeResult) {
    const human = activeMatch.home.controller === "human" ? activeMatch.home : activeMatch.away;
    const owner = players.find((player) => player.id === human.participantId);
    const progress: MatchProgress = { matchId: activeMatch.id, minute: 0, lineup: owner?.campaign?.lineup ?? [], bench: [], substitutions: [], kickStep: 0, kickRevealed: false, shootoutComplete: false };
    return <div className="local-pass"><PassDevice player={human.name} action="jogar a partida"/><MatchScreen match={activeMatch} result={activeResult} progress={progress} ratingsMode={ratingsMode} onInstruction={saveInstruction} onLineupChange={() => {}} onProgress={() => {}} onFinish={finishMatch} multiplayerRules/></div>;
  }
  return null;
}

function PassDevice({ player, action }: { player: string; action: string }) {
  return <div className="local-pass__bar" role="status"><b>Vez de {player}</b><span>Passe o controle para {action}.</span></div>;
}

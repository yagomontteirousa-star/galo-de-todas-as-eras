import { atleticoSquads, playersById, squadsById } from "@/data/atletico-squads";
import { formations } from "@/data/formations";
import { rivalOf, roundOrder, scoreOf, userMatches, USER_TEAM_ERA } from "@/lib/bracket";
import { calculateTeamOverall } from "@/lib/overall";
import type { Campaign, CampaignRecord, FormationId, HistoricalSquad, MatchEvent, MatchResult, RatingsMode, TacticId, TeamSnapshot } from "@/types/game";

/** Campanha em andamento. Some assim que a campanha termina. */
export const CAMPAIGN_STORAGE_KEY = "preto-no-branco:campaign:v2";
/** Última campanha encerrada, completa, para o retrospecto. */
export const LAST_CAMPAIGN_STORAGE_KEY = "preto-no-branco:last-campaign:v2";
/** Histórico enxuto das campanhas anteriores. */
export const HISTORY_STORAGE_KEY = "preto-no-branco:history:v2";
const HISTORY_LIMIT = 12;
const LEGACY_STORAGE_KEYS = ["preto-no-branco:campaign:v1", "galo-todas-eras:campaign:v1"];

export function createCampaign(): Campaign {
  const now = new Date().toISOString();
  return { version: 2, id: `camp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: now, updatedAt: now, screen: "setup", lineup: [], usedSquadIds: [], rerollsLeft: 2, ratingsMode: "visible", wins: 0 };
}

export function toRecord(campaign: Campaign): CampaignRecord {
  const last = userMatches(campaign.bracket).at(-1);
  const score = last && scoreOf(last);
  return {
    id: campaign.id,
    finishedAt: campaign.finishedAt ?? new Date().toISOString(),
    outcome: campaign.outcome ?? "eliminated",
    wins: campaign.wins,
    roundReached: campaign.bracket?.currentRound ?? "round16",
    formation: campaign.formation,
    overall: campaign.bracket?.rounds[0]?.matches.flatMap((match) => [match.home, match.away]).find((team) => team.isUser)?.overall.final,
    lastOpponent: last && rivalOf(last).name,
    lastScore: score && `${score.user} a ${score.rival}${score.pens}`,
  };
}

/** Encerra a campanha: arquiva o retrospecto completo, registra o histórico e libera o slot ativo. */
export function archiveCampaign(campaign: Campaign, history: CampaignRecord[]): void {
  try {
    window.localStorage.setItem(LAST_CAMPAIGN_STORAGE_KEY, JSON.stringify(campaign));
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    window.localStorage.removeItem(CAMPAIGN_STORAGE_KEY);
  } catch { /* armazenamento bloqueado: a sessão continua, o retrospecto não persiste */ }
}

export function readStoredCampaign(key: string): Campaign | null {
  try { return hydrateCampaign(window.localStorage.getItem(key)); }
  catch { return null; }
}

export function readHistory(): CampaignRecord[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(HISTORY_STORAGE_KEY) ?? "[]") as CampaignRecord[];
    return Array.isArray(value) ? value.filter((item) => item && roundOrder.includes(item.roundReached)).slice(0, HISTORY_LIMIT) : [];
  } catch { return []; }
}

export function appendHistory(record: CampaignRecord, history: CampaignRecord[]): CampaignRecord[] {
  return [record, ...history.filter((item) => item.id !== record.id)].slice(0, HISTORY_LIMIT);
}

/** As regras do torneio mudaram (a chave começa nas oitavas); campanhas v1 não têm como continuar. */
export function clearLegacyStorage(): void {
  try { LEGACY_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key)); }
  catch { /* sem storage, nada a limpar */ }
}

export function touchCampaign(campaign: Campaign): Campaign {
  return { ...campaign, updatedAt: new Date().toISOString() };
}

export function nextAvailableSquad(campaign: Campaign, random = Math.random): HistoricalSquad | undefined {
  const available = atleticoSquads.filter((squad) => !campaign.usedSquadIds.includes(squad.id) && squad.id !== campaign.currentSquadId);
  return available[Math.floor(random() * available.length)];
}

export function startDraft(campaign: Campaign, formation: FormationId, tactic: TacticId, ratingsMode: RatingsMode, random = Math.random): Campaign {
  const base = { ...campaign, formation, tactic, ratingsMode, screen: "draft" as const };
  const squad = nextAvailableSquad(base, random);
  return touchCampaign({ ...base, currentSquadId: squad?.id });
}

export function buildUserTeam(campaign: Campaign): TeamSnapshot {
  if (!campaign.formation || !campaign.tactic || campaign.lineup.length !== 11) throw new Error("Escalação incompleta");
  const positioned = campaign.lineup.map((entry) => {
    const player = playersById.get(entry.playerId);
    if (!player) throw new Error(`Jogador não encontrado: ${entry.playerId}`);
    return { player, slotId: entry.slotId };
  });
  return {
    id: "user-team", name: "Preto no Branco", year: 2026, eraLabel: USER_TEAM_ERA, formation: campaign.formation, tactic: campaign.tactic,
    lineup: positioned.map((entry) => entry.player), overall: calculateTeamOverall(positioned, campaign.formation, campaign.tactic), isUser: true,
  };
}

export function hydrateCampaign(raw: string | null): Campaign | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Campaign;
    if (value.version !== 2 || !Array.isArray(value.lineup) || !Array.isArray(value.usedSquadIds)) return null;
    if (value.formation && !formations[value.formation]) return null;
    if (value.bracket && !roundOrder.includes(value.bracket.currentRound)) return null;
    value.ratingsMode ??= "visible";
    if (value.pendingResult) value.pendingResult = migrateResult(value.pendingResult);
    value.bracket?.rounds.forEach((round) => round.matches.forEach((match) => {
      if (match.result) match.result = migrateResult(match.result);
    }));
    if (value.currentSquadId && !squadsById.has(value.currentSquadId)) value.currentSquadId = undefined;
    value.lineup = value.lineup.filter((entry) => playersById.has(entry.playerId));
    return value;
  } catch { return null; }
}

function migrateResult(result: MatchResult): MatchResult {
  result.instructions ??= {};
  result.events = result.events.map((item, index) => {
    const legacy = item as MatchEvent & { scorer?: string };
    const playerName = item.playerName ?? legacy.scorer;
    return {
      ...item,
      id: item.id ?? `legacy-${item.minute}-${index}`,
      description: item.description ?? (playerName ? `Gol de ${playerName}.` : "Evento de partida."),
      playerName,
      highlight: item.highlight ?? item.type === "goal",
    };
  });
  return result;
}

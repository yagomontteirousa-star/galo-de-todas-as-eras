import { atleticoSquads, playersById, squadsById } from "@/data/atletico-squads";
import { formations } from "@/data/formations";
import { calculateTeamOverall } from "@/lib/overall";
import type { Campaign, FormationId, HistoricalSquad, MatchEvent, MatchResult, RatingsMode, TacticId, TeamSnapshot } from "@/types/game";

export const CAMPAIGN_STORAGE_KEY = "preto-no-branco:campaign:v1";
export const LEGACY_CAMPAIGN_STORAGE_KEY = "galo-todas-eras:campaign:v1";

export function createCampaign(): Campaign {
  const now = new Date().toISOString();
  return { version: 1, id: `camp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: now, updatedAt: now, screen: "setup", lineup: [], usedSquadIds: [], rerollsLeft: 2, ratingsMode: "visible", wins: 0 };
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
    id: "user-team", name: "Preto no Branco", year: 2026, formation: campaign.formation, tactic: campaign.tactic,
    lineup: positioned.map((entry) => entry.player), overall: calculateTeamOverall(positioned, campaign.formation, campaign.tactic), isUser: true,
  };
}

export function hydrateCampaign(raw: string | null): Campaign | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Campaign;
    if (value.version !== 1 || !Array.isArray(value.lineup) || !Array.isArray(value.usedSquadIds)) return null;
    if (value.formation && !formations[value.formation]) return null;
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

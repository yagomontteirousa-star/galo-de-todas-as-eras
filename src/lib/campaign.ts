import { atleticoSquads, playersById, squadsById } from "@/data/atletico-squads";
import { formations } from "@/data/formations";
import type { SharedCampaign } from "@/lib/share";
import { rivalOf, roundOrder, scoreOf, userMatches, USER_TEAM_ERA } from "@/lib/bracket";
import { calculateTeamOverall, evaluatePosition } from "@/lib/overall";
import type { Campaign, CampaignRecord, FormationId, HistoricalSquad, LineupEntry, MatchEvent, MatchResult, RatingsMode, TacticId, TeamSnapshot } from "@/types/game";

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

/** Tags que todo atleta recebe: não marcam ninguém como especial. */
const GENERIC_TAGS = new Set(["regular", "titular", "reflexos", "finalizador"]);

/**
 * Retrato da campanha que cabe num link. Tudo o que a tela compartilhada mostra sai daqui,
 * porque o aparelho de quem abre o link não tem o armazenamento de quem jogou.
 */
export function buildSharedCampaign(campaign: Campaign, userTeam: TeamSnapshot): SharedCampaign | null {
  if (!campaign.formation || !campaign.tactic) return null;
  const played = userMatches(campaign.bracket);
  const order = formations[campaign.formation].slots;
  const squad = [...userTeam.overall.evaluations]
    .sort((left, right) => order.findIndex((slot) => slot.id === left.slot.id) - order.findIndex((slot) => slot.id === right.slot.id))
    .map((entry) => ({
      slot: entry.slot.label, name: entry.player.name, season: entry.player.season,
      overall: entry.adjustedOverall, special: entry.player.tags.some((tag) => !GENERIC_TAGS.has(tag)),
    }));

  const matches = played.map((match) => {
    const score = scoreOf(match);
    const rival = rivalOf(match);
    const userTeamId = match.home.isUser ? match.home.id : match.away.id;
    return {
      round: match.round, user: score.user, rival: score.rival,
      pens: score.userPens !== undefined && score.rivalPens !== undefined
        ? { user: score.userPens, rival: score.rivalPens }
        : undefined,
      rivalName: rival.name, rivalYear: rival.year, won: score.won,
      goals: (match.result?.events ?? [])
        .filter((event) => event.type === "goal" && event.playerName)
        .map((event) => ({ name: event.playerName!, minute: event.minute, forUser: event.teamId === userTeamId })),
    };
  });

  const champion = campaign.outcome === "champion";
  const round = campaign.bracket?.currentRound ?? "round16";
  return {
    outcome: champion ? "champion" : "eliminated",
    // Vice é quem chegou à decisão e perdeu; a fase sozinha não distingue.
    runnerUp: !champion && round === "final",
    round, wins: campaign.wins, overall: userTeam.overall.final,
    formation: campaign.formation, tactic: campaign.tactic,
    squad, matches,
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

/**
 * Atletas já usados na campanha, por identidade histórica. Sai da própria escalação, que
 * já é persistida: uma lista paralela só criaria uma segunda verdade para dessincronizar.
 * Campanha nova nasce com a escalação vazia, então a lista se limpa sozinha.
 */
export function usedPersonIds(lineup: LineupEntry[]): Set<string> {
  return new Set(lineup.map((entry) => playersById.get(entry.playerId)?.personId).filter((id): id is string => Boolean(id)));
}

/** Vagas ainda abertas na formação escolhida. */
function openSlots(campaign: Campaign) {
  if (!campaign.formation) return [];
  const taken = new Set(campaign.lineup.map((entry) => entry.slotId));
  return formations[campaign.formation].slots.filter((slot) => !taken.has(slot.id));
}

/**
 * Sortear um ano cujos atletas já foram todos usados travaria a campanha, porque não
 * sobraria escolha possível. O sorteio só considera elencos que ainda somam alguma coisa.
 */
function contributes(squad: HistoricalSquad, campaign: Campaign, used: Set<string>): boolean {
  const slots = openSlots(campaign);
  if (!slots.length) return true;
  return squad.players.some((player) =>
    !used.has(player.personId) && slots.some((slot) => evaluatePosition(player, slot).fit !== "improvised"));
}

export function nextAvailableSquad(campaign: Campaign, random = Math.random): HistoricalSquad | undefined {
  const available = atleticoSquads.filter((squad) => !campaign.usedSquadIds.includes(squad.id) && squad.id !== campaign.currentSquadId);
  const used = usedPersonIds(campaign.lineup);
  const usable = available.filter((squad) => contributes(squad, campaign, used));
  const pool = usable.length ? usable : available;
  return pool[Math.floor(random() * pool.length)];
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

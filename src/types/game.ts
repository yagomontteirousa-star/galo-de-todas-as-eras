export type Position = "GK" | "CB" | "LB" | "RB" | "LWB" | "RWB" | "DM" | "CM" | "AM" | "LW" | "RW" | "ST";
export type Sector = "goalkeeper" | "defense" | "midfield" | "attack";
export type FormationId = "4-3-3" | "4-4-2" | "4-2-3-1" | "3-5-2";
export type TacticId = "balanced" | "attacking" | "defensive" | "pressing";
export type RatingsMode = "visible" | "memory";
export type HalftimeInstruction = "keep" | "press" | "attack" | "defend";
export type MatchMomentInstruction = "wide" | "inside" | "direct" | "calm" | "press" | "protect" | "counter" | "set_pieces" | "shots" | "hold" | "restart_fast" | "restart_safe";
export type MatchMomentId = "trailing-control" | "trailing-break" | "draw-open" | "draw-keeper" | "lead-pressure" | "lead-control" | "rival-tired-right" | "rival-tired-left" | "rain" | "heavy-pitch" | "floodlights" | "wind";
export type MatchEventType = "kickoff" | "pressure" | "possession" | "shot_off" | "shot_saved" | "big_save" | "corner" | "dangerous_foul" | "offside" | "yellow_card" | "red_card" | "penalty" | "goal" | "decision" | "halftime" | "second_half" | "extra_time" | "shootout" | "full_time";

export interface Attributes {
  finishing: number; creation: number; pace: number; physical: number;
  defending: number; positioning: number; reflexes: number;
}

export type RatingConfidence = "alta" | "média" | "baixa";

/**
 * Por que o overall é o que é. A fonte aponta para o registro do próprio elenco na base:
 * não citamos referência externa que não tenhamos conferido, e sem evidência a confiança cai.
 */
export interface RatingEvidence {
  confidence: RatingConfidence; rationale: string; source: string;
}

export interface Player {
  id: string; name: string; season: number; squadId: string;
  /** Mesma pessoa em elencos diferentes compartilha esta chave. Ver `player-identity.ts`. */
  personId: string;
  primaryPosition: Position; secondaryPositions: Position[]; overall: number;
  attributes: Attributes; tags: string[]; styleFit: Record<TacticId, number>;
  rating?: RatingEvidence;
}

export interface HistoricalSquad {
  id: string; year: number; name: string; context: string; players: Player[];
  /** Conquista declarada pelo próprio registro do elenco; sustenta a confiança dos titulares. */
  titled?: boolean;
}

export interface FormationSlot {
  id: string; label: string; position: Position; sector: Sector; x: number; y: number;
}

export interface Formation {
  id: FormationId; name: string; description: string;
  tacticAffinity: Record<TacticId, number>; slots: FormationSlot[];
}

export interface LineupEntry { slotId: string; playerId: string; squadId: string }
export type PositionFit = "natural" | "secondary" | "improvised";

export interface PlayerEvaluation {
  player: Player; slot: FormationSlot; fit: PositionFit; penalty: number; adjustedOverall: number;
}

export interface TeamOverall {
  final: number; base: number; goalkeeper: number; defense: number; midfield: number; attack: number;
  cohesion: number; tacticBonus: number; improvisationPenalty: number; balancePenalty: number;
  evaluations: PlayerEvaluation[]; strengths: string[]; weaknesses: string[];
}

export interface TeamSnapshot {
  id: string; name: string; year: number; formation: FormationId; tactic: TacticId;
  lineup: Player[]; overall: TeamOverall; isUser?: boolean;
  /** Casa do mandante no recorte histórico daquele elenco. */
  stadium?: string;
  /** Substitui o ano na interface quando o elenco não pertence a uma única temporada. */
  eraLabel?: string;
}

export type Opponent = TeamSnapshot;
export type TournamentRound = "round16" | "quarterfinal" | "semifinal" | "final";

export interface MatchInstructions {
  halftime?: HalftimeInstruction;
  moment?: MatchMomentInstruction;
}

export interface MatchEvent {
  id: string; type: MatchEventType; minute: number; description: string;
  teamId?: string; playerName?: string; period: "regular" | "extra" | "shootout";
  homeScore?: number; awayScore?: number; highlight?: boolean;
}

/** Uma cobrança da disputa, na ordem em que foi batida. */
export interface PenaltyKick {
  order: number; side: "home" | "away"; taker: string; scored: boolean;
  homeScore: number; awayScore: number; suddenDeath: boolean;
}

export interface MatchResult {
  homeScore: number; awayScore: number; homeExtra: number; awayExtra: number;
  homePenalties?: number; awayPenalties?: number; penaltyKicks?: PenaltyKick[];
  wentToExtraTime: boolean; wentToPenalties: boolean;
  winnerId: string; events: MatchEvent[]; playerOfMatch: string; summary: string;
  instructions: MatchInstructions; instructionImpact?: string; matchMoment?: MatchMomentId;
}

export interface BracketMatch {
  id: string; round: TournamentRound; index: number; home: TeamSnapshot; away: TeamSnapshot; result?: MatchResult;
}
export interface BracketRound { id: TournamentRound; matches: BracketMatch[] }
export interface BracketState { rounds: BracketRound[]; currentRound: TournamentRound; champion?: TeamSnapshot }

export type GameScreen = "home" | "setup" | "draft" | "analysis" | "bracket" | "match" | "victory" | "eliminated" | "champion";
export type CampaignOutcome = "champion" | "eliminated";

export interface SharedPlayer { slot: string; name: string; season: number; overall: number; special: boolean }
export interface SharedGoal { name: string; minute: number; forUser: boolean }
export interface SharedRivalPlayer { position: string; name: string; overall: number }
export interface SharedMatch {
  round: TournamentRound; user: number; rival: number;
  /** Só existe quando a partida foi para a marca da cal. */
  pens?: { user: number; rival: number };
  rivalName: string; rivalYear: number; won: boolean; goals: SharedGoal[];
  /** Disponível apenas para adversários que já foram enfrentados. */
  rivalFormation?: FormationId; rivalOverall?: number; rivalSquad?: SharedRivalPlayer[];
}

export interface SharedCampaign {
  outcome: CampaignOutcome;
  /** Perdeu a decisão: muda o texto e o tom da prévia. */
  runnerUp: boolean;
  round: TournamentRound;
  wins: number;
  overall: number;
  formation: FormationId;
  tactic: TacticId;
  squad: SharedPlayer[];
  matches: SharedMatch[];
}

export interface Campaign {
  version: 2; id: string; createdAt: string; updatedAt: string; screen: GameScreen;
  formation?: FormationId; tactic?: TacticId; ratingsMode?: RatingsMode; lineup: LineupEntry[]; usedSquadIds: string[];
  currentSquadId?: string; rerollsLeft: number; bracket?: BracketState; lastMatchId?: string;
  pendingResult?: MatchResult; pendingMatchSeed?: number; matchInstructions?: MatchInstructions; wins: number;
  finishedAt?: string; outcome?: CampaignOutcome;
}

/** Linha do histórico. Campanhas novas guardam também o retrato público completo. */
export interface CampaignRecord {
  id: string; finishedAt: string; outcome: CampaignOutcome; wins: number;
  roundReached: TournamentRound; formation?: FormationId; overall?: number;
  /** Retrato do último jogo, para o card do histórico não precisar do elenco inteiro. */
  lastOpponent?: string; lastScore?: string;
  /** Registros antigos podem não ter este campo; nunca inventamos dados ausentes. */
  snapshot?: SharedCampaign;
}

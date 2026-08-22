import type { BracketState, Campaign, MatchInstructions, MatchProgress, MatchResult, RatingsMode, TeamSnapshot, TournamentRound } from "@/types/game";

export type MultiplayerRoomStatus = "waiting" | "drafting" | "playing" | "finished";
export type MultiplayerPlayerStatus = "waiting" | "drafting" | "ready" | "playing" | "eliminated" | "qualified";
export type MultiplayerRoomMode = "final" | "knockout";
export type MultiplayerBracketSize = 2 | 4 | 8 | 16;
export type MultiplayerTacticalInstructions = Pick<MatchInstructions, "halftime" | "moment">;

export interface MultiplayerRoom {
  id: string;
  code: string;
  hostUserId: string;
  status: MultiplayerRoomStatus;
  mode: MultiplayerRoomMode;
  bracketSize: MultiplayerBracketSize;
  isPublic: boolean;
  passwordRequired: boolean;
  ratingsMode: RatingsMode;
  currentRound: TournamentRound;
  bracket?: BracketState;
  draftStartedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MultiplayerParticipant {
  id: string;
  roomId: string;
  userId: string;
  nickname: string;
  slotIndex: number;
  status: MultiplayerPlayerStatus;
  campaign?: Campaign;
  team?: TeamSnapshot;
  draftSchedule: string[];
  draftRound: number;
  draftPick: number;
  draftDeadline?: string;
  draftedPersonIds: string[];
  connected: boolean;
  lobbyReady: boolean;
  leftAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MultiplayerDecision {
  matchId: string;
  userId: string;
  instructions: MultiplayerTacticalInstructions;
  updatedAt: string;
}

export interface MultiplayerMatch {
  id: string;
  roomId: string;
  round: TournamentRound;
  index: number;
  homeTeam: TeamSnapshot;
  awayTeam: TeamSnapshot;
  homeParticipantId?: string;
  awayParticipantId?: string;
  controllerUserId: string;
  seed: number;
  status: "waiting" | "ready" | "playing" | "halftime" | "moment" | "shootout" | "finished";
  homeReady: boolean;
  awayReady: boolean;
  homeCpu: boolean;
  awayCpu: boolean;
  officialMinute: number;
  phaseStartedAt?: string;
  phaseBaseMinute: number;
  decisionDeadline?: string;
  shootoutStep: number;
  shootoutRevealed: boolean;
  result?: MatchResult;
  progress?: MatchProgress;
  updatedAt: string;
}

export interface MultiplayerSnapshot {
  room: MultiplayerRoom;
  participants: MultiplayerParticipant[];
  matches: MultiplayerMatch[];
  decisions: MultiplayerDecision[];
  userId: string;
  connected: boolean;
  localDevelopment: boolean;
}

export interface MultiplayerPresence {
  userId: string;
  onlineAt: string;
}

export interface MultiplayerOpenRoom {
  code: string;
  mode: MultiplayerRoomMode;
  bracketSize: MultiplayerBracketSize;
  passwordRequired: boolean;
  playerCount: number;
  slotsLeft: number;
  createdAt: string;
}

export interface MultiplayerRoomPreview {
  code: string;
  mode: MultiplayerRoomMode;
  bracketSize: MultiplayerBracketSize;
  isPublic: boolean;
  passwordRequired: boolean;
  playerCount: number;
  status: MultiplayerRoomStatus;
}

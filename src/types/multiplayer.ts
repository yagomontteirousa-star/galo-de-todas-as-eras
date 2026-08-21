import type { BracketState, Campaign, MatchInstructions, MatchProgress, MatchResult, RatingsMode, TeamSnapshot, TournamentRound } from "@/types/game";

export type MultiplayerRoomStatus = "waiting" | "drafting" | "playing" | "finished";
export type MultiplayerPlayerStatus = "waiting" | "drafting" | "ready" | "playing" | "eliminated" | "qualified";

export interface MultiplayerRoom {
  id: string;
  code: string;
  hostUserId: string;
  status: MultiplayerRoomStatus;
  ratingsMode: RatingsMode;
  currentRound: TournamentRound;
  bracket?: BracketState;
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
  createdAt: string;
  updatedAt: string;
}

export interface MultiplayerDecision {
  matchId: string;
  userId: string;
  instructions: MatchInstructions;
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
  status: "waiting" | "playing" | "finished";
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

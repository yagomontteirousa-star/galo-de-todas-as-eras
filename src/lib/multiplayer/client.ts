"use client";

import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import type { BracketState, Campaign, MatchInstructions, MatchProgress, MatchResult, RatingsMode, TeamSnapshot, TournamentRound } from "@/types/game";
import type { MultiplayerDecision, MultiplayerMatch, MultiplayerParticipant, MultiplayerRoom, MultiplayerSnapshot } from "@/types/multiplayer";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const multiplayerConfigured = Boolean(url && publishableKey);
export const multiplayerLocalDevelopment = !multiplayerConfigured && process.env.NODE_ENV === "development";

let supabase: SupabaseClient | undefined;
let multiplayerUserPromise: Promise<string> | undefined;
function db() {
  if (!multiplayerConfigured) return undefined;
  supabase ??= createClient(url!, publishableKey!, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return supabase;
}

type RoomRow = { id: string; code: string; host_user_id: string; status: MultiplayerRoom["status"]; ratings_mode: RatingsMode; current_round: TournamentRound; bracket: MultiplayerRoom["bracket"] | null; created_at: string; updated_at: string };
type PlayerRow = { id: string; room_id: string; user_id: string; nickname: string; slot_index: number; status: MultiplayerParticipant["status"]; campaign: Campaign | null; team: TeamSnapshot | null; created_at: string; updated_at: string };
type MatchRow = { id: string; room_id: string; round: TournamentRound; match_index: number; home_team: TeamSnapshot; away_team: TeamSnapshot; home_participant_id: string | null; away_participant_id: string | null; controller_user_id: string; seed: number; status: MultiplayerMatch["status"]; result: MatchResult | null; progress: MatchProgress | null; updated_at: string };
type DecisionRow = { match_id: string; user_id: string; instructions: MatchInstructions; updated_at: string };

const roomFrom = (row: RoomRow): MultiplayerRoom => ({ id: row.id, code: row.code, hostUserId: row.host_user_id, status: row.status, ratingsMode: row.ratings_mode, currentRound: row.current_round, bracket: row.bracket ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at });
const playerFrom = (row: PlayerRow): MultiplayerParticipant => ({ id: row.id, roomId: row.room_id, userId: row.user_id, nickname: row.nickname, slotIndex: row.slot_index, status: row.status, campaign: row.campaign ?? undefined, team: row.team ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at });
const matchFrom = (row: MatchRow): MultiplayerMatch => ({ id: row.id, roomId: row.room_id, round: row.round, index: row.match_index, homeTeam: row.home_team, awayTeam: row.away_team, homeParticipantId: row.home_participant_id ?? undefined, awayParticipantId: row.away_participant_id ?? undefined, controllerUserId: row.controller_user_id, seed: row.seed, status: row.status, result: row.result ?? undefined, progress: row.progress ?? undefined, updatedAt: row.updated_at });
const decisionFrom = (row: DecisionRow): MultiplayerDecision => ({ matchId: row.match_id, userId: row.user_id, instructions: row.instructions, updatedAt: row.updated_at });

type LocalState = { userId: string; rooms: Map<string, MultiplayerRoom>; players: MultiplayerParticipant[]; matches: MultiplayerMatch[]; decisions: MultiplayerDecision[]; listeners: Set<() => void> };
declare global { var __pretoNoBrancoMultiplayer: LocalState | undefined; }
function local(): LocalState {
  globalThis.__pretoNoBrancoMultiplayer ??= { userId: crypto.randomUUID(), rooms: new Map(), players: [], matches: [], decisions: [], listeners: new Set() };
  return globalThis.__pretoNoBrancoMultiplayer;
}
const notifyLocal = () => local().listeners.forEach((listener) => listener());
const now = () => new Date().toISOString();
const roomCode = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (value) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[value % 32]).join("");

export async function ensureMultiplayerUser(): Promise<string> {
  const client = db();
  if (!client) {
    if (!multiplayerLocalDevelopment) throw new Error("Multiplayer temporariamente indisponível. O Supabase ainda não está conectado.");
    return local().userId;
  }
  multiplayerUserPromise ??= (async () => {
    const { data: session } = await client.auth.getSession();
    if (session.session?.user.id) return session.session.user.id;
    const { data, error } = await client.auth.signInAnonymously();
    if (error || !data.user) throw new Error("Não foi possível abrir sua sessão privada. Tente novamente.");
    return data.user.id;
  })();
  try { return await multiplayerUserPromise; }
  catch (error) { multiplayerUserPromise = undefined; throw error; }
}

export async function createMultiplayerRoom(nickname: string, ratingsMode: RatingsMode): Promise<string> {
  const userId = await ensureMultiplayerUser();
  const client = db();
  if (!client) {
    const createdAt = now();
    const room: MultiplayerRoom = { id: crypto.randomUUID(), code: roomCode(), hostUserId: userId, status: "waiting", ratingsMode, currentRound: "round16", createdAt, updatedAt: createdAt };
    local().rooms.set(room.code, room);
    local().players.push({ id: crypto.randomUUID(), roomId: room.id, userId, nickname, slotIndex: 0, status: "waiting", createdAt, updatedAt: createdAt });
    notifyLocal();
    return room.code;
  }
  const { data, error } = await client.rpc("create_multiplayer_room", { p_nickname: nickname, p_ratings_mode: ratingsMode });
  if (error || typeof data !== "string") throw new Error(error?.message ?? "Não foi possível criar a sala.");
  return data;
}

export async function joinMultiplayerRoom(code: string, nickname: string): Promise<void> {
  const userId = await ensureMultiplayerUser();
  const normalized = code.toUpperCase();
  const client = db();
  if (!client) {
    const room = local().rooms.get(normalized);
    if (!room) throw new Error("Esta sala local não existe mais. Crie outra sala neste navegador.");
    if (local().players.some((player) => player.roomId === room.id && player.userId === userId)) return;
    const count = local().players.filter((player) => player.roomId === room.id).length;
    if (count >= 16 || room.status !== "waiting") throw new Error("Esta sala não aceita novos jogadores.");
    local().players.push({ id: crypto.randomUUID(), roomId: room.id, userId, nickname, slotIndex: count, status: "waiting", createdAt: now(), updatedAt: now() });
    notifyLocal();
    return;
  }
  const { error } = await client.rpc("join_multiplayer_room", { p_code: normalized, p_nickname: nickname });
  if (error) throw new Error(error.message);
}

export async function loadMultiplayerRoom(code: string): Promise<MultiplayerSnapshot | undefined> {
  const userId = await ensureMultiplayerUser();
  const normalized = code.toUpperCase();
  const client = db();
  if (!client) {
    const room = local().rooms.get(normalized);
    if (!room) return undefined;
    return { room, participants: local().players.filter((item) => item.roomId === room.id), matches: local().matches.filter((item) => item.roomId === room.id), decisions: local().decisions.filter((item) => local().matches.some((match) => match.roomId === room.id && match.id === item.matchId)), userId, connected: true, localDevelopment: true };
  }
  const { data: roomData, error: roomError } = await client.from("multiplayer_rooms").select("*").eq("code", normalized).maybeSingle();
  if (roomError) throw new Error(roomError.message);
  if (!roomData) return undefined;
  const [players, matches] = await Promise.all([
    client.from("multiplayer_players").select("*").eq("room_id", roomData.id).order("slot_index"),
    client.from("multiplayer_matches").select("*").eq("room_id", roomData.id).order("match_index"),
  ]);
  if (players.error || matches.error) throw new Error(players.error?.message ?? matches.error?.message ?? "A sala não pôde ser carregada.");
  const matchIds = (matches.data ?? []).map((item) => item.id);
  const decisions = matchIds.length ? await client.from("multiplayer_decisions").select("*").in("match_id", matchIds) : { data: [], error: null };
  if (decisions.error) throw new Error(decisions.error.message);
  return { room: roomFrom(roomData as RoomRow), participants: (players.data as PlayerRow[]).map(playerFrom), matches: (matches.data as MatchRow[]).map(matchFrom), decisions: (decisions.data as DecisionRow[]).map(decisionFrom), userId, connected: true, localDevelopment: false };
}

export function subscribeMultiplayerRoom(code: string, refresh: () => void): () => void {
  const client = db();
  if (!client) {
    if (!multiplayerLocalDevelopment) return () => {};
    local().listeners.add(refresh); return () => local().listeners.delete(refresh);
  }
  let active = true;
  let channel: RealtimeChannel | undefined;
  void loadMultiplayerRoom(code).then((snapshot) => {
    if (!snapshot || !active) return;
    channel = client.channel(`room:${snapshot.room.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "multiplayer_rooms", filter: `id=eq.${snapshot.room.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "multiplayer_players", filter: `room_id=eq.${snapshot.room.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "multiplayer_matches", filter: `room_id=eq.${snapshot.room.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "multiplayer_decisions" }, refresh)
      .subscribe();
  }).catch(() => undefined);
  return () => {
    active = false;
    if (channel) void client.removeChannel(channel);
  };
}

export async function saveMultiplayerDraft(participant: MultiplayerParticipant, campaign: Campaign, team?: TeamSnapshot, status: MultiplayerParticipant["status"] = "drafting") {
  const client = db();
  if (!client) {
    local().players = local().players.map((item) => item.id === participant.id ? { ...item, campaign, team, status, updatedAt: now() } : item);
    notifyLocal(); return;
  }
  const { error } = await client.from("multiplayer_players").update({ campaign, team: team ?? null, status }).eq("id", participant.id);
  if (error) throw new Error(error.message);
}

export async function startMultiplayerRoom(room: MultiplayerRoom, bracket: BracketState, matches: MultiplayerMatch[]) {
  const client = db();
  if (!client) {
    local().rooms.set(room.code, { ...room, status: "playing", bracket, updatedAt: now() });
    local().matches.push(...matches);
    local().players = local().players.map((item) => item.roomId === room.id ? { ...item, status: "playing" } : item);
    notifyLocal(); return;
  }
  const payload = matches.map((match) => ({ id: match.id, room_id: room.id, round: match.round, match_index: match.index, home_team: match.homeTeam, away_team: match.awayTeam, home_participant_id: match.homeParticipantId ?? null, away_participant_id: match.awayParticipantId ?? null, controller_user_id: match.controllerUserId, seed: match.seed, status: match.status, result: match.result ?? null, progress: match.progress ?? null }));
  const { error } = await client.rpc("start_multiplayer_room", { p_room_id: room.id, p_bracket: bracket, p_matches: payload });
  if (error) throw new Error(error.message);
}

export async function saveMultiplayerMatch(match: MultiplayerMatch, result: MatchResult, progress: MatchProgress, status: MultiplayerMatch["status"] = "playing") {
  const client = db();
  if (!client) {
    local().matches = local().matches.map((item) => item.id === match.id ? { ...item, result, progress, status, updatedAt: now() } : item);
    notifyLocal(); return;
  }
  const { error } = await client.from("multiplayer_matches").update({ result, progress, status }).eq("id", match.id);
  if (error) throw new Error(error.message);
}

export async function advanceMultiplayerRoom(room: MultiplayerRoom, bracket: BracketState, matches: MultiplayerMatch[]) {
  const client = db();
  if (!client) {
    local().matches.push(...matches);
    local().rooms.set(room.code, { ...room, currentRound: matches[0].round, bracket, status: matches[0].round === "final" ? "playing" : room.status, updatedAt: now() });
    notifyLocal(); return;
  }
  const payload = matches.map((match) => ({ id: match.id, room_id: room.id, round: match.round, match_index: match.index, home_team: match.homeTeam, away_team: match.awayTeam, home_participant_id: match.homeParticipantId ?? null, away_participant_id: match.awayParticipantId ?? null, controller_user_id: match.controllerUserId, seed: match.seed, status: match.status, result: match.result ?? null, progress: match.progress ?? null }));
  const { error } = await client.rpc("advance_multiplayer_room", { p_room_id: room.id, p_round: matches[0].round, p_bracket: bracket, p_matches: payload });
  if (error) throw new Error(error.message);
}

export async function completeMultiplayerRoom(room: MultiplayerRoom, bracket: BracketState) {
  const client = db();
  if (!client) {
    local().rooms.set(room.code, { ...room, status: "finished", bracket, updatedAt: now() });
    notifyLocal(); return;
  }
  const { error } = await client.from("multiplayer_rooms").update({ status: "finished", bracket }).eq("id", room.id);
  if (error) throw new Error(error.message);
}

export async function saveMultiplayerDecision(matchId: string, instructions: MatchInstructions) {
  const userId = await ensureMultiplayerUser();
  const client = db();
  if (!client) {
    const entry: MultiplayerDecision = { matchId, userId, instructions, updatedAt: now() };
    local().decisions = [...local().decisions.filter((item) => !(item.matchId === matchId && item.userId === userId)), entry];
    notifyLocal(); return;
  }
  const { error } = await client.from("multiplayer_decisions").upsert({ match_id: matchId, user_id: userId, instructions }, { onConflict: "match_id,user_id" });
  if (error) throw new Error(error.message);
}

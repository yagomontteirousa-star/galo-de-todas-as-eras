"use client";

import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import type { BracketState, Campaign, MatchInstructions, MatchProgress, MatchResult, RatingsMode, TeamSnapshot, TournamentRound } from "@/types/game";
import type {
  MultiplayerBracketSize,
  MultiplayerDecision,
  MultiplayerMatch,
  MultiplayerOpenRoom,
  MultiplayerParticipant,
  MultiplayerRoom,
  MultiplayerRoomMode,
  MultiplayerRoomPreview,
  MultiplayerSnapshot,
  MultiplayerTacticalInstructions,
} from "@/types/multiplayer";
import { multiplayerMatchCanStart } from "@/lib/multiplayer/tournament";

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

type RoomRow = {
  id: string; code: string; host_user_id: string; status: MultiplayerRoom["status"];
  mode: MultiplayerRoomMode; bracket_size: MultiplayerBracketSize; is_public: boolean; password_required: boolean;
  ratings_mode: RatingsMode; current_round: TournamentRound; bracket: MultiplayerRoom["bracket"] | null;
  draft_started_at: string | null; created_at: string; updated_at: string;
};
type PlayerRow = {
  id: string; room_id: string; user_id: string; nickname: string; slot_index: number; status: MultiplayerParticipant["status"];
  campaign: Campaign | null; team: TeamSnapshot | null; draft_schedule: string[]; draft_round: number; draft_pick: number;
  draft_deadline: string | null; drafted_person_ids: string[]; connected: boolean; lobby_ready: boolean; left_at: string | null;
  created_at: string; updated_at: string;
};
type MatchRow = {
  id: string; room_id: string; round: TournamentRound; match_index: number; home_team: TeamSnapshot; away_team: TeamSnapshot;
  home_participant_id: string | null; away_participant_id: string | null; controller_user_id: string; seed: number;
  status: MultiplayerMatch["status"]; result: MatchResult | null; progress: MatchProgress | null; home_ready: boolean; away_ready: boolean;
  home_cpu: boolean; away_cpu: boolean; official_minute: number; phase_started_at: string | null; phase_base_minute: number;
  decision_deadline: string | null; shootout_step: number; shootout_revealed: boolean; updated_at: string;
};
type DecisionRow = { match_id: string; user_id: string; instructions: MatchInstructions; updated_at: string };
type OpenRoomRow = { code: string; mode: MultiplayerRoomMode; bracket_size: MultiplayerBracketSize; password_required: boolean; player_count: number; slots_left: number; created_at: string };
type PreviewRow = { code: string; mode: MultiplayerRoomMode; bracket_size: MultiplayerBracketSize; is_public: boolean; password_required: boolean; player_count: number; status: MultiplayerRoom["status"] };

const roomFrom = (row: RoomRow): MultiplayerRoom => ({
  id: row.id, code: row.code, hostUserId: row.host_user_id, status: row.status, mode: row.mode,
  bracketSize: row.bracket_size, isPublic: row.is_public, passwordRequired: row.password_required,
  ratingsMode: row.ratings_mode, currentRound: row.current_round, bracket: row.bracket ?? undefined,
  draftStartedAt: row.draft_started_at ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at,
});
const playerFrom = (row: PlayerRow): MultiplayerParticipant => ({
  id: row.id, roomId: row.room_id, userId: row.user_id, nickname: row.nickname, slotIndex: row.slot_index,
  status: row.status, campaign: row.campaign ?? undefined, team: row.team ?? undefined, draftSchedule: row.draft_schedule ?? [],
  draftRound: row.draft_round ?? 0, draftPick: row.draft_pick ?? 0, draftDeadline: row.draft_deadline ?? undefined,
  draftedPersonIds: row.drafted_person_ids ?? [], connected: row.connected ?? false, lobbyReady: row.lobby_ready ?? false,
  leftAt: row.left_at ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at,
});
const matchFrom = (row: MatchRow): MultiplayerMatch => ({
  id: row.id, roomId: row.room_id, round: row.round, index: row.match_index, homeTeam: row.home_team, awayTeam: row.away_team,
  homeParticipantId: row.home_participant_id ?? undefined, awayParticipantId: row.away_participant_id ?? undefined,
  controllerUserId: row.controller_user_id, seed: row.seed, status: row.status, result: row.result ?? undefined,
  progress: row.progress ?? undefined, homeReady: row.home_ready ?? false, awayReady: row.away_ready ?? false,
  homeCpu: row.home_cpu ?? !row.home_participant_id, awayCpu: row.away_cpu ?? !row.away_participant_id,
  officialMinute: row.official_minute ?? 0, phaseStartedAt: row.phase_started_at ?? undefined,
  phaseBaseMinute: row.phase_base_minute ?? 0, decisionDeadline: row.decision_deadline ?? undefined,
  shootoutStep: row.shootout_step ?? 0, shootoutRevealed: row.shootout_revealed ?? false, updatedAt: row.updated_at,
});
const decisionFrom = (row: DecisionRow): MultiplayerDecision => ({ matchId: row.match_id, userId: row.user_id, instructions: row.instructions, updatedAt: row.updated_at });

type LocalState = { userId: string; rooms: Map<string, MultiplayerRoom>; players: MultiplayerParticipant[]; matches: MultiplayerMatch[]; decisions: MultiplayerDecision[]; listeners: Set<() => void> };
declare global { var __pretoNoBrancoMultiplayer: LocalState | undefined; }
function local(): LocalState {
  globalThis.__pretoNoBrancoMultiplayer ??= { userId: crypto.randomUUID(), rooms: new Map(), players: [], matches: [], decisions: [], listeners: new Set() };
  return globalThis.__pretoNoBrancoMultiplayer;
}
const notifyLocal = () => local().listeners.forEach((listener) => listener());
const now = () => new Date().toISOString();
const deadline = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();
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
    if (error || !data.user) throw new Error("Não foi possível abrir sua sessão anônima. Tente novamente.");
    return data.user.id;
  })();
  try { return await multiplayerUserPromise; }
  catch (error) { multiplayerUserPromise = undefined; throw error; }
}

export async function createMultiplayerRoom(nickname: string, mode: MultiplayerRoomMode, isPublic: boolean, password?: string): Promise<string> {
  const userId = await ensureMultiplayerUser();
  const client = db();
  if (!client) {
    const createdAt = now();
    const bracketSize: MultiplayerBracketSize = mode === "final" ? 2 : 16;
    const code = roomCode();
    const room: MultiplayerRoom = { id: crypto.randomUUID(), code, hostUserId: userId, status: "waiting", mode, bracketSize, isPublic, passwordRequired: Boolean(password), ratingsMode: "visible", currentRound: mode === "final" ? "final" : "round16", createdAt, updatedAt: createdAt };
    local().rooms.set(code, room);
    local().players.push({ id: crypto.randomUUID(), roomId: room.id, userId, nickname, slotIndex: 0, status: "waiting", draftSchedule: [], draftRound: 0, draftPick: 0, draftedPersonIds: [], connected: true, lobbyReady: false, createdAt, updatedAt: createdAt });
    notifyLocal();
    return code;
  }
  const { data, error } = await client.rpc("create_multiplayer_room", { p_nickname: nickname, p_mode: mode, p_is_public: isPublic, p_password: password?.trim() || null });
  if (error || typeof data !== "string") throw new Error(error?.message ?? "Não foi possível criar a sala.");
  return data;
}

export async function listOpenMultiplayerRooms(mode?: MultiplayerRoomMode): Promise<MultiplayerOpenRoom[]> {
  await ensureMultiplayerUser();
  const client = db();
  if (!client) return Array.from(local().rooms.values()).filter((room) => room.isPublic && room.status === "waiting" && (!mode || room.mode === mode)).map((room) => {
    const playerCount = local().players.filter((player) => player.roomId === room.id).length;
    return { code: room.code, mode: room.mode, bracketSize: room.bracketSize, passwordRequired: room.passwordRequired, playerCount, slotsLeft: room.bracketSize - playerCount, createdAt: room.createdAt };
  });
  const { data, error } = await client.rpc("list_open_multiplayer_rooms", { p_mode: mode ?? null });
  if (error) throw new Error(error.message);
  return ((data ?? []) as OpenRoomRow[]).map((row) => ({ code: row.code, mode: row.mode, bracketSize: row.bracket_size, passwordRequired: row.password_required, playerCount: Number(row.player_count), slotsLeft: Number(row.slots_left), createdAt: row.created_at }));
}

export async function getMultiplayerRoomPreview(code: string): Promise<MultiplayerRoomPreview | undefined> {
  await ensureMultiplayerUser();
  const normalized = code.toUpperCase();
  const client = db();
  if (!client) {
    const room = local().rooms.get(normalized);
    if (!room || room.status !== "waiting") return undefined;
    return { code: room.code, mode: room.mode, bracketSize: room.bracketSize, isPublic: room.isPublic, passwordRequired: room.passwordRequired, playerCount: local().players.filter((player) => player.roomId === room.id).length, status: room.status };
  }
  const { data, error } = await client.rpc("get_multiplayer_room_preview", { p_code: normalized });
  if (error) throw new Error(error.message);
  const row = (data as PreviewRow[] | null)?.[0];
  return row ? { code: row.code, mode: row.mode, bracketSize: row.bracket_size, isPublic: row.is_public, passwordRequired: row.password_required, playerCount: Number(row.player_count), status: row.status } : undefined;
}

export async function joinMultiplayerRoom(code: string, nickname: string, password?: string): Promise<void> {
  const userId = await ensureMultiplayerUser();
  const normalized = code.toUpperCase();
  const client = db();
  if (!client) {
    const room = local().rooms.get(normalized);
    if (!room) throw new Error("Esta sala local não existe mais. Crie outra sala neste navegador.");
    if (local().players.some((player) => player.roomId === room.id && player.userId === userId)) return;
    const count = local().players.filter((player) => player.roomId === room.id).length;
    if (count >= room.bracketSize || room.status !== "waiting") throw new Error("Esta sala não aceita novos jogadores.");
    local().players.push({ id: crypto.randomUUID(), roomId: room.id, userId, nickname, slotIndex: count, status: "waiting", draftSchedule: [], draftRound: 0, draftPick: 0, draftedPersonIds: [], connected: true, lobbyReady: false, createdAt: now(), updatedAt: now() });
    notifyLocal(); return;
  }
  const { error } = await client.rpc("join_multiplayer_room", { p_code: normalized, p_nickname: nickname, p_password: password?.trim() || null });
  if (error) throw new Error(error.message);
}

export async function joinRandomMultiplayerRoom(nickname: string, mode?: MultiplayerRoomMode): Promise<string> {
  await ensureMultiplayerUser();
  const client = db();
  if (!client) {
    const room = Array.from(local().rooms.values()).find((item) => item.isPublic && !item.passwordRequired && item.status === "waiting" && (!mode || item.mode === mode));
    if (!room) throw new Error("Nenhuma sala pública disponível agora.");
    await joinMultiplayerRoom(room.code, nickname);
    return room.code;
  }
  const { data, error } = await client.rpc("join_random_multiplayer_room", { p_nickname: nickname, p_mode: mode ?? null });
  if (error || typeof data !== "string") throw new Error(error?.message ?? "Nenhuma sala pública disponível agora.");
  return data;
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
  const { data: roomData, error: roomError } = await client.from("multiplayer_rooms").select("id,code,host_user_id,status,mode,bracket_size,is_public,password_required,ratings_mode,current_round,bracket,draft_started_at,created_at,updated_at").eq("code", normalized).maybeSingle();
  if (roomError) throw new Error(roomError.message);
  if (!roomData) return undefined;
  const [players, matches] = await Promise.all([
    client.from("multiplayer_players").select("*").eq("room_id", roomData.id).order("slot_index"),
    client.from("multiplayer_matches").select("*").eq("room_id", roomData.id).order("match_index"),
  ]);
  if (players.error || matches.error) throw new Error(players.error?.message ?? matches.error?.message ?? "A sala não pôde ser carregada.");
  const matchIds = (matches.data ?? []).map((item) => item.id);
  const decisions = matchIds.length ? await client.from("multiplayer_decisions").select("match_id,user_id,instructions,updated_at").in("match_id", matchIds) : { data: [], error: null };
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
  let handlePageHide: (() => void) | undefined;
  void loadMultiplayerRoom(code).then((snapshot) => {
    if (!snapshot || !active) return;
    const markDisconnected = (userId: string) => void client.rpc("mark_multiplayer_disconnected", { p_room_id: snapshot.room.id, p_user_id: userId });
    channel = client.channel(`room:${snapshot.room.id}`, { config: { presence: { key: snapshot.userId } } })
      .on("postgres_changes", { event: "*", schema: "public", table: "multiplayer_rooms", filter: `id=eq.${snapshot.room.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "multiplayer_players", filter: `room_id=eq.${snapshot.room.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "multiplayer_matches", filter: `room_id=eq.${snapshot.room.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "multiplayer_decisions" }, refresh)
      .on("presence", { event: "sync" }, refresh)
      .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
        const userId = key || leftPresences.find((presence) => typeof presence.userId === "string")?.userId;
        if (typeof userId === "string") markDisconnected(userId);
        refresh();
      })
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        await channel?.track({ userId: snapshot.userId, onlineAt: now() });
        await client.rpc("set_multiplayer_presence", { p_room_id: snapshot.room.id, p_connected: true });
      });
    void client.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token;
      if (!token || !active) return;
      handlePageHide = () => void fetch(`${url}/rest/v1/rpc/set_multiplayer_presence`, {
        method: "POST", headers: { apikey: publishableKey!, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_room_id: snapshot.room.id, p_connected: false }), keepalive: true,
      });
      window.addEventListener("pagehide", handlePageHide);
    });
  }).catch(() => undefined);
  return () => {
    active = false;
    if (handlePageHide) window.removeEventListener("pagehide", handlePageHide);
    if (channel) void client.removeChannel(channel);
  };
}

export async function configureMultiplayerRoom(roomId: string, ratingsMode: RatingsMode, bracketSize: MultiplayerBracketSize) {
  const client = db();
  if (!client) {
    const room = Array.from(local().rooms.values()).find((item) => item.id === roomId);
    if (!room) return;
    local().rooms.set(room.code, { ...room, ratingsMode, bracketSize, currentRound: bracketSize === 2 ? "final" : bracketSize === 4 ? "semifinal" : bracketSize === 8 ? "quarterfinal" : "round16", updatedAt: now() });
    notifyLocal(); return;
  }
  const { error } = await client.rpc("configure_multiplayer_room", { p_room_id: roomId, p_ratings_mode: ratingsMode, p_bracket_size: bracketSize });
  if (error) throw new Error(error.message);
}

export async function beginMultiplayerDraft(room: MultiplayerRoom, schedules: Record<string, string[]>) {
  const client = db();
  if (!client) {
    if (local().players.some((item) => item.roomId === room.id && !item.lobbyReady)) throw new Error("Todos os participantes precisam confirmar presença.");
    local().rooms.set(room.code, { ...room, status: "drafting", draftStartedAt: now(), updatedAt: now() });
    local().players = local().players.map((item) => item.roomId === room.id ? { ...item, status: "drafting", campaign: undefined, team: undefined, draftSchedule: schedules[item.id] ?? [], draftRound: 0, draftPick: 0, draftDeadline: deadline(15), draftedPersonIds: [] } : item);
    notifyLocal(); return;
  }
  const { error } = await client.rpc("begin_multiplayer_draft", { p_room_id: room.id, p_schedules: schedules });
  if (error) throw new Error(error.message);
}

export async function startMultiplayerPlayerDraft(participantId: string, campaign: Campaign, nextDeadline: string, auto = false) {
  const client = db();
  if (!client) { local().players = local().players.map((item) => item.id === participantId ? { ...item, campaign, draftDeadline: nextDeadline, updatedAt: now() } : item); notifyLocal(); return; }
  const { error } = await client.rpc("start_multiplayer_player_draft", { p_player_id: participantId, p_campaign: campaign, p_deadline: nextDeadline, p_auto: auto });
  if (error) throw new Error(error.message);
}

export async function saveMultiplayerDraftPick(participant: MultiplayerParticipant, campaign: Campaign, team: TeamSnapshot | undefined, status: "drafting" | "ready", next: { round: number; pick: number; deadline?: string }, personIds: string[], auto = false) {
  const client = db();
  if (!client) { local().players = local().players.map((item) => item.id === participant.id ? { ...item, campaign, team, status, draftRound: next.round, draftPick: next.pick, draftDeadline: next.deadline, draftedPersonIds: personIds, updatedAt: now() } : item); notifyLocal(); return; }
  const { error } = await client.rpc("save_multiplayer_draft_pick", {
    p_player_id: participant.id, p_campaign: campaign, p_team: team ?? null, p_status: status,
    p_expected_round: participant.draftRound, p_expected_pick: participant.draftPick,
    p_next_round: next.round, p_next_pick: next.pick, p_next_deadline: next.deadline ?? null,
    p_person_ids: personIds, p_auto: auto,
  });
  if (error) throw new Error(error.message);
}

export async function relocateMultiplayerDraftLineup(participantId: string, campaign: Campaign, team?: TeamSnapshot) {
  const client = db();
  if (!client) {
    local().players = local().players.map((item) => item.id === participantId ? { ...item, campaign, team, updatedAt: now() } : item);
    notifyLocal();
    return;
  }
  const { error } = await client.rpc("relocate_multiplayer_draft_lineup", {
    p_player_id: participantId,
    p_campaign: campaign,
    p_team: team ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function finalizeMultiplayerDraft(participantId: string, campaign: Campaign, team: TeamSnapshot) {
  const client = db();
  if (!client) { local().players = local().players.map((item) => item.id === participantId ? { ...item, campaign, team, status: "ready", draftDeadline: undefined, updatedAt: now() } : item); notifyLocal(); return; }
  const { error } = await client.rpc("finalize_multiplayer_draft", { p_player_id: participantId, p_campaign: campaign, p_team: team });
  if (error) throw new Error(error.message);
}

export async function setMultiplayerLobbyReady(roomId: string, ready: boolean) {
  const client = db();
  if (!client) { local().players = local().players.map((item) => item.roomId === roomId && item.userId === local().userId ? { ...item, lobbyReady: ready, updatedAt: now() } : item); notifyLocal(); return; }
  const { error } = await client.rpc("toggle_multiplayer_lobby_ready", { p_room_id: roomId, p_ready: ready });
  if (error) throw new Error(error.message);
}

export async function kickMultiplayerParticipant(roomId: string, participantId: string) {
  const client = db();
  if (!client) { local().players = local().players.filter((item) => item.id !== participantId); notifyLocal(); return; }
  const { error } = await client.rpc("kick_multiplayer_player", { p_room_id: roomId, p_player_id: participantId });
  if (error) throw new Error(error.message);
}

export async function leaveMultiplayerRoom(roomId: string) {
  const client = db();
  if (!client) { local().players = local().players.filter((item) => !(item.roomId === roomId && item.userId === local().userId)); notifyLocal(); return; }
  const { error } = await client.rpc("leave_multiplayer_room", { p_room_id: roomId });
  if (error) throw new Error(error.message);
}

export async function readyMultiplayerMatch(matchId: string) {
  const client = db();
  if (!client) {
    const match = local().matches.find((item) => item.id === matchId); if (!match) return;
    const own = local().players.find((item) => item.userId === local().userId);
    const next = { ...match, homeReady: match.homeReady || match.homeParticipantId === own?.id, awayReady: match.awayReady || match.awayParticipantId === own?.id };
    const starts = multiplayerMatchCanStart(next);
    local().matches = local().matches.map((item) => item.id === matchId ? { ...next, status: starts ? "playing" : "ready", phaseStartedAt: starts ? now() : undefined } : item); notifyLocal(); return;
  }
  const { error } = await client.rpc("ready_multiplayer_match", { p_match_id: matchId });
  if (error) throw new Error(error.message);
}

export async function claimMultiplayerMatchResult(matchId: string, result: MatchResult, progress: MatchProgress) {
  const client = db();
  if (!client) { local().matches = local().matches.map((item) => item.id === matchId && !item.result ? { ...item, result, progress, status: item.homeCpu && item.awayCpu ? "finished" : item.status, updatedAt: now() } : item); notifyLocal(); return; }
  const { error } = await client.rpc("claim_multiplayer_match_result", { p_match_id: matchId, p_result: result, p_progress: progress });
  if (error) throw new Error(error.message);
}

export async function syncMultiplayerMatch(matchId: string) {
  const client = db();
  if (!client) return;
  const { error } = await client.rpc("sync_multiplayer_match", { p_match_id: matchId });
  if (error) throw new Error(error.message);
}

export async function updateMultiplayerMatchResult(matchId: string, result: MatchResult) {
  const client = db();
  if (!client) { local().matches = local().matches.map((item) => item.id === matchId ? { ...item, result, updatedAt: now() } : item); notifyLocal(); return; }
  const { error } = await client.rpc("update_multiplayer_match_result", { p_match_id: matchId, p_result: result });
  if (error) throw new Error(error.message);
}

function matchPayload(match: MultiplayerMatch) {
  return { id: match.id, room_id: match.roomId, round: match.round, match_index: match.index, home_team: match.homeTeam, away_team: match.awayTeam, home_participant_id: match.homeParticipantId ?? null, away_participant_id: match.awayParticipantId ?? null, controller_user_id: match.controllerUserId, seed: match.seed, status: match.status, result: match.result ?? null, progress: match.progress ?? null, home_cpu: match.homeCpu, away_cpu: match.awayCpu };
}

export async function startMultiplayerRoom(room: MultiplayerRoom, bracket: BracketState, matches: MultiplayerMatch[]) {
  const client = db();
  if (!client) { local().rooms.set(room.code, { ...room, status: "playing", bracket, currentRound: matches[0].round, updatedAt: now() }); local().matches.push(...matches); local().players = local().players.map((item) => item.roomId === room.id ? { ...item, status: "playing" } : item); notifyLocal(); return; }
  const { error } = await client.rpc("start_multiplayer_room", { p_room_id: room.id, p_bracket: bracket, p_matches: matches.map(matchPayload) });
  if (error) throw new Error(error.message);
}

export async function advanceMultiplayerRoom(room: MultiplayerRoom, bracket: BracketState, matches: MultiplayerMatch[]) {
  const client = db();
  if (!client) { local().matches.push(...matches); local().rooms.set(room.code, { ...room, currentRound: matches[0].round, bracket, updatedAt: now() }); notifyLocal(); return; }
  const { error } = await client.rpc("advance_multiplayer_room", { p_room_id: room.id, p_round: matches[0].round, p_bracket: bracket, p_matches: matches.map(matchPayload) });
  if (error) throw new Error(error.message);
}

export async function completeMultiplayerRoom(room: MultiplayerRoom, bracket: BracketState) {
  const client = db();
  if (!client) { local().rooms.set(room.code, { ...room, status: "finished", bracket, updatedAt: now() }); notifyLocal(); return; }
  const { error } = await client.rpc("complete_multiplayer_room", { p_room_id: room.id, p_bracket: bracket });
  if (error) throw new Error(error.message);
}

export async function saveMultiplayerDecision(matchId: string, instructions: MultiplayerTacticalInstructions) {
  const userId = await ensureMultiplayerUser();
  const client = db();
  if (!client) { const entry: MultiplayerDecision = { matchId, userId, instructions, updatedAt: now() }; local().decisions = [...local().decisions.filter((item) => !(item.matchId === matchId && item.userId === userId)), entry]; notifyLocal(); return; }
  const { error } = await client.rpc("submit_multiplayer_decision", { p_match_id: matchId, p_instructions: instructions });
  if (error) throw new Error(error.message);
}

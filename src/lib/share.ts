import { roundLabels } from "@/lib/bracket";
import type { CampaignOutcome, FormationId, TournamentRound } from "@/types/game";

export const SITE_URL = "https://pretonobranco.app";
export const SITE_TITLE = "Preto no Branco";
export const SITE_DESCRIPTION = "Monte seu elenco histórico, atravesse as eras e faça história.";

/** Versão do formato: um link antigo precisa ser recusado com jeito, não renderizado torto. */
const VERSION = 1;

export interface SharedPlayer { slot: string; name: string; season: number; overall: number; special: boolean }
export interface SharedGoal { name: string; minute: number; forUser: boolean }
export interface SharedMatch {
  round: TournamentRound; user: number; rival: number; pens?: string;
  rivalName: string; rivalYear: number; won: boolean; goals: SharedGoal[];
}

export interface SharedCampaign {
  outcome: CampaignOutcome;
  /** Perdeu a decisão: muda o texto e o tom da prévia. */
  runnerUp: boolean;
  round: TournamentRound;
  wins: number;
  overall: number;
  formation: FormationId;
  tactic: string;
  squad: SharedPlayer[];
  matches: SharedMatch[];
}

/* Formato compacto: o link viaja em mensagem, então cada campo vira posição num array. */
type Tuple = [
  v: number, outcome: 0 | 1, runnerUp: 0 | 1, round: TournamentRound, wins: number, overall: number,
  formation: FormationId, tactic: string,
  squad: [string, string, number, number, 0 | 1][],
  matches: [TournamentRound, number, number, string, string, number, 0 | 1, [string, number, 0 | 1][]][],
];

function toTuple(data: SharedCampaign): Tuple {
  return [
    VERSION, data.outcome === "champion" ? 1 : 0, data.runnerUp ? 1 : 0, data.round, data.wins, data.overall,
    data.formation, data.tactic,
    data.squad.map((player) => [player.slot, player.name, player.season, player.overall, player.special ? 1 : 0]),
    data.matches.map((match) => [
      match.round, match.user, match.rival, match.pens ?? "", match.rivalName, match.rivalYear, match.won ? 1 : 0,
      match.goals.map((goal) => [goal.name, goal.minute, goal.forUser ? 1 : 0]),
    ]),
  ];
}

const ROUNDS: TournamentRound[] = ["round16", "quarterfinal", "semifinal", "final"];
const FORMATIONS: FormationId[] = ["4-3-3", "4-4-2", "4-2-3-1", "3-5-2"];

const isRound = (value: unknown): value is TournamentRound => ROUNDS.includes(value as TournamentRound);
const isFormation = (value: unknown): value is FormationId => FORMATIONS.includes(value as FormationId);
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isText = (value: unknown): value is string => typeof value === "string";

/** Valida campo a campo: o payload vem da URL, então nada nele é confiável. */
function fromTuple(raw: unknown): SharedCampaign | null {
  if (!Array.isArray(raw) || raw.length < 10 || raw[0] !== VERSION) return null;
  const [, outcome, runnerUp, round, wins, overall, formation, tactic, squad, matches] = raw as Tuple;
  if (!isRound(round) || !isFormation(formation) || !isNumber(wins) || !isNumber(overall) || !isText(tactic)) return null;
  if (!Array.isArray(squad) || !Array.isArray(matches)) return null;

  const players: SharedPlayer[] = [];
  for (const entry of squad) {
    if (!Array.isArray(entry) || entry.length < 5) return null;
    const [slot, name, season, playerOverall, special] = entry;
    if (!isText(slot) || !isText(name) || !isNumber(season) || !isNumber(playerOverall)) return null;
    players.push({ slot, name, season, overall: playerOverall, special: special === 1 });
  }

  const games: SharedMatch[] = [];
  for (const entry of matches) {
    if (!Array.isArray(entry) || entry.length < 8) return null;
    const [matchRound, user, rival, pens, rivalName, rivalYear, won, goals] = entry;
    if (!isRound(matchRound) || !isNumber(user) || !isNumber(rival) || !isText(rivalName) || !isNumber(rivalYear)) return null;
    if (!Array.isArray(goals)) return null;
    const scorers: SharedGoal[] = [];
    for (const goal of goals) {
      if (!Array.isArray(goal) || goal.length < 3) return null;
      const [name, minute, forUser] = goal;
      if (!isText(name) || !isNumber(minute)) return null;
      scorers.push({ name, minute, forUser: forUser === 1 });
    }
    games.push({
      round: matchRound, user, rival, pens: isText(pens) && pens ? pens : undefined,
      rivalName, rivalYear, won: won === 1, goals: scorers,
    });
  }

  return {
    outcome: outcome === 1 ? "champion" : "eliminated",
    runnerUp: runnerUp === 1,
    round, wins, overall, formation, tactic, squad: players, matches: games,
  };
}

/* base64url: o payload vive num segmento de caminho, então "+", "/" e "=" ficam de fora. */
const toBase64Url = (value: string) => value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromBase64Url = (value: string) => value.replace(/-/g, "+").replace(/_/g, "/");

export function encodeCampaign(data: SharedCampaign): string {
  const json = JSON.stringify(toTuple(data));
  const bytes = new TextEncoder().encode(json);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return toBase64Url(typeof btoa === "function" ? btoa(binary) : Buffer.from(json, "utf8").toString("base64"));
}

export function decodeCampaign(payload: string): SharedCampaign | null {
  try {
    const normalized = fromBase64Url(payload);
    const binary = typeof atob === "function"
      ? atob(normalized)
      : Buffer.from(normalized, "base64").toString("binary");
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return fromTuple(JSON.parse(new TextDecoder().decode(bytes)));
  } catch { return null; }
}

export const campaignUrl = (data: SharedCampaign, origin = SITE_URL) => `${origin}/c/${encodeCampaign(data)}`;

/** Quem tirou a campanha do caminho: o adversário da última partida perdida. */
export const eliminator = (data: SharedCampaign) => data.matches.find((match) => !match.won) ?? data.matches.at(-1);

export const topPlayer = (data: SharedCampaign): SharedPlayer | undefined =>
  [...data.squad].sort((left, right) => right.overall - left.overall)[0];

/**
 * Título e descrição da prévia. Tom de torcida, frase curta, sempre com o dado real do
 * jogo: fase, adversário e ano de quem eliminou.
 */
export function shareMessage(data: SharedCampaign): { title: string; description: string } {
  const star = topPlayer(data);
  const rival = eliminator(data);
  const phase = roundLabels[data.round].toLowerCase();

  if (data.outcome === "champion") {
    const detail = star ? ` ${star.name} puxou o time no ${data.formation}, overall ${data.overall}.` : "";
    return {
      title: "Fui campeão no Preto no Branco",
      description: `Montei meu elenco histórico, atravessei as eras e conquistei o título.${detail}`,
    };
  }

  if (data.runnerUp) {
    return {
      title: "Cheguei à final no Preto no Branco",
      description: rival
        ? `Fui vice-campeão e perdi a decisão para o ${rival.rivalName}, do ano ${rival.rivalYear}.`
        : "Fui vice-campeão e perdi a decisão no último jogo.",
    };
  }

  return {
    title: "Minha campanha no Preto no Branco terminou",
    description: rival
      ? `Fui eliminado nas ${phase} pelo ${rival.rivalName}, do ano ${rival.rivalYear}.`
      : `Minha campanha parou nas ${phase}.`,
  };
}

/** Texto do Web Share e do "copiar": a mesma história, com o link no fim. */
export function shareText(data: SharedCampaign, url: string): string {
  const { title, description } = shareMessage(data);
  const star = topPlayer(data);
  const line = data.outcome === "champion"
    ? `${data.wins} ${data.wins === 1 ? "vitória" : "vitórias"} no ${data.formation}, overall ${data.overall}.`
    : `${data.wins} ${data.wins === 1 ? "vitória" : "vitórias"} até ali, overall ${data.overall} no ${data.formation}.`;
  const highlight = star && data.outcome !== "champion" ? `Meu melhor foi ${star.name}, de ${star.season}.` : "";
  return [`${title}.`, description, line, highlight, url].filter(Boolean).join("\n");
}

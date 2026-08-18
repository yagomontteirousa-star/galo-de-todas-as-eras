import { formations, tacticLabels } from "@/data/formations";
import { roundLabels } from "@/lib/bracket";
import type { CampaignOutcome, FormationId, TacticId, TournamentRound } from "@/types/game";

export const SITE_URL = "https://pretonobranco.app";
export const SITE_TITLE = "Preto no Branco";
export const SITE_DESCRIPTION = "Monte seu elenco histórico, atravesse as eras e faça história.";

export interface SharedPlayer { slot: string; name: string; season: number; overall: number; special: boolean }
export interface SharedGoal { name: string; minute: number; forUser: boolean }
export interface SharedMatch {
  round: TournamentRound; user: number; rival: number;
  /** Só existe quando a partida foi para a marca da cal. */
  pens?: { user: number; rival: number };
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
  tactic: TacticId;
  squad: SharedPlayer[];
  matches: SharedMatch[];
}

const ROUNDS: TournamentRound[] = ["round16", "quarterfinal", "semifinal", "final"];
const FORMATIONS: FormationId[] = ["4-3-3", "4-4-2", "4-2-3-1", "3-5-2"];
const TACTICS: TacticId[] = ["balanced", "attacking", "defensive", "pressing"];
/** Ano vira deslocamento a partir daqui: 2013 cabe em três dígitos em vez de quatro. */
const YEAR_BASE = 1900;

/* base64url: o payload vive num segmento de caminho, então "+", "/" e "=" ficam de fora. */
const toBase64Url = (value: string) => value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromBase64Url = (value: string) => value.replace(/-/g, "+").replace(/_/g, "/");

const bytesToBase64Url = (bytes: Uint8Array) =>
  toBase64Url(typeof btoa === "function"
    ? btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""))
    : Buffer.from(bytes).toString("base64"));

function base64UrlToBytes(payload: string): Uint8Array {
  const normalized = fromBase64Url(payload);
  const binary = typeof atob === "function" ? atob(normalized) : Buffer.from(normalized, "base64").toString("binary");
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

const encodeText = (text: string) => bytesToBase64Url(new TextEncoder().encode(text));
const decodeText = (payload: string) => new TextDecoder().decode(base64UrlToBytes(payload));

/**
 * Compressão pela API nativa do navegador e do Node, sem dependência. Onde ela não existir,
 * o link simplesmente sai no formato 2, maior mas igualmente válido.
 */
async function deflate(text: string): Promise<Uint8Array | null> {
  if (typeof CompressionStream === "undefined") return null;
  try {
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch { return null; }
}

async function inflate(bytes: Uint8Array): Promise<string | null> {
  if (typeof DecompressionStream === "undefined") return null;
  try {
    const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return await new Response(stream).text();
  } catch { return null; }
}

/* Separadores do formato compacto. Nenhum nome da base os contém, mas limpamos por garantia. */
const SEP = { field: "|", item: ";", part: ",", goal: "+", goalPart: "~" };
const clean = (name: string) => name.replace(/[|;,+~]/g, " ").trim();

/**
 * Formato 2: texto delimitado em vez de JSON. Fases, formações e perfis viram índices, o
 * ano vira deslocamento e a sigla da posição sai do payload porque a formação já a define.
 * O que sobra é o que só o jogador sabe: os nomes.
 */
function toCompactText(data: SharedCampaign): string {
  const squad = data.squad
    .map((player) => [clean(player.name), player.season - YEAR_BASE, player.overall, player.special ? 1 : 0].join(SEP.part))
    .join(SEP.item);
  const matches = data.matches
    .map((match) => [
      ROUNDS.indexOf(match.round), match.user, match.rival,
      match.pens ? match.pens.user : "", match.pens ? match.pens.rival : "",
      clean(match.rivalName), match.rivalYear - YEAR_BASE, match.won ? 1 : 0,
      match.goals.map((goal) => [clean(goal.name), goal.minute, goal.forUser ? 1 : 0].join(SEP.goalPart)).join(SEP.goal),
    ].join(SEP.part))
    .join(SEP.item);
  return [
    data.outcome === "champion" ? 1 : 0, data.runnerUp ? 1 : 0, ROUNDS.indexOf(data.round),
    data.wins, data.overall, FORMATIONS.indexOf(data.formation), TACTICS.indexOf(data.tactic),
    squad, matches,
  ].join(SEP.field);
}

const toInt = (value: string) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

function fromCompactText(text: string): SharedCampaign | null {
  const fields = text.split(SEP.field);
  if (fields.length < 9) return null;
  const [rawOutcome, rawRunnerUp, rawRound, rawWins, rawOverall, rawFormation, rawTactic, rawSquad, rawMatches] = fields;

  const round = ROUNDS[toInt(rawRound) ?? -1];
  const formation = FORMATIONS[toInt(rawFormation) ?? -1];
  const tactic = TACTICS[toInt(rawTactic) ?? -1];
  const wins = toInt(rawWins);
  const overall = toInt(rawOverall);
  if (!round || !formation || !tactic || wins === null || overall === null) return null;

  // A sigla da vaga volta da formação: mesma ordem com que a escalação foi guardada.
  const slots = formations[formation].slots;
  const squad: SharedPlayer[] = [];
  const squadEntries = rawSquad ? rawSquad.split(SEP.item) : [];
  for (let index = 0; index < squadEntries.length; index += 1) {
    const [name, season, playerOverall, special] = squadEntries[index].split(SEP.part);
    const seasonValue = toInt(season);
    const overallValue = toInt(playerOverall);
    if (!name || seasonValue === null || overallValue === null) return null;
    squad.push({
      slot: slots[index]?.label ?? "—", name, season: seasonValue + YEAR_BASE,
      overall: overallValue, special: special === "1",
    });
  }

  const matches: SharedMatch[] = [];
  for (const entry of rawMatches ? rawMatches.split(SEP.item) : []) {
    const [matchRound, user, rival, pensUser, pensRival, rivalName, rivalYear, won, goals] = entry.split(SEP.part);
    const roundValue = ROUNDS[toInt(matchRound) ?? -1];
    const userValue = toInt(user);
    const rivalValue = toInt(rival);
    const yearValue = toInt(rivalYear);
    if (!roundValue || userValue === null || rivalValue === null || !rivalName || yearValue === null) return null;
    const penUser = toInt(pensUser ?? "");
    const penRival = toInt(pensRival ?? "");
    matches.push({
      round: roundValue, user: userValue, rival: rivalValue,
      pens: penUser !== null && penRival !== null ? { user: penUser, rival: penRival } : undefined,
      rivalName, rivalYear: yearValue + YEAR_BASE, won: won === "1",
      goals: (goals ? goals.split(SEP.goal) : []).flatMap((raw) => {
        const [name, minute, forUser] = raw.split(SEP.goalPart);
        const minuteValue = toInt(minute ?? "");
        return name && minuteValue !== null ? [{ name, minute: minuteValue, forUser: forUser === "1" }] : [];
      }),
    });
  }

  return {
    outcome: rawOutcome === "1" ? "champion" : "eliminated",
    runnerUp: rawRunnerUp === "1",
    round, wins, overall, formation, tactic, squad, matches,
  };
}

/* Formato 1: array JSON em base64. Links já compartilhados continuam abrindo. */
const LEGACY_VERSION = 1;
const isRound = (value: unknown): value is TournamentRound => ROUNDS.includes(value as TournamentRound);
const isFormation = (value: unknown): value is FormationId => FORMATIONS.includes(value as FormationId);
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isText = (value: unknown): value is string => typeof value === "string";
/** O formato antigo guardava o nome do perfil; aqui ele volta a ser um id. */
const tacticFromLabel = (label: unknown): TacticId =>
  TACTICS.find((id) => tacticLabels[id].name === label) ?? "balanced";

function decodeLegacy(payload: string): SharedCampaign | null {
  const raw: unknown = JSON.parse(decodeText(payload));
  if (!Array.isArray(raw) || raw.length < 10 || raw[0] !== LEGACY_VERSION) return null;
  const [, outcome, runnerUp, round, wins, overall, formation, tactic, squad, matches] = raw;
  if (!isRound(round) || !isFormation(formation) || !isNumber(wins) || !isNumber(overall)) return null;
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
    // A frase " (4 a 3 nos pênaltis)" volta a ser dois números.
    const shootout = isText(pens) ? /\((\d+) a (\d+)/.exec(pens) : null;
    games.push({
      round: matchRound, user, rival,
      pens: shootout ? { user: Number(shootout[1]), rival: Number(shootout[2]) } : undefined,
      rivalName, rivalYear, won: won === 1, goals: scorers,
    });
  }

  return {
    outcome: outcome === 1 ? "champion" : "eliminated",
    runnerUp: runnerUp === 1,
    round, wins, overall, formation, tactic: tacticFromLabel(tactic), squad: players, matches: games,
  };
}

/**
 * Três formatos convivem, distinguidos pelo primeiro caractere:
 * `3` texto compacto comprimido (o padrão de hoje), `2` texto compacto puro (usado quando
 * o aparelho não tem compressão) e, sem prefixo, o array JSON dos primeiros links.
 */
export async function encodeCampaign(data: SharedCampaign): Promise<string> {
  const text = toCompactText(data);
  const compressed = await deflate(text);
  return compressed ? `3${bytesToBase64Url(compressed)}` : `2${encodeText(text)}`;
}

export async function decodeCampaign(payload: string): Promise<SharedCampaign | null> {
  if (!payload) return null;
  try {
    if (payload.startsWith("3")) {
      const text = await inflate(base64UrlToBytes(payload.slice(1)));
      return text ? fromCompactText(text) : null;
    }
    if (payload.startsWith("2")) return fromCompactText(decodeText(payload.slice(1)));
    return decodeLegacy(payload);
  } catch { return null; }
}

export const campaignUrl = async (data: SharedCampaign, origin = SITE_URL) =>
  `${origin}/c/${await encodeCampaign(data)}`;

/**
 * Tenta o link curto: o servidor guarda o snapshot e devolve um id de dez caracteres.
 * Se o store não estiver ligado ou a gravação falhar, devolve o link longo, que abre do
 * mesmo jeito. Quem chama nunca recebe um endereço quebrado.
 */
export async function shortCampaignUrl(data: SharedCampaign, origin = SITE_URL): Promise<{ url: string; short: boolean }> {
  try {
    const response = await fetch("/api/c", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (response.ok) {
      const { id } = await response.json() as { id?: string };
      if (id) return { url: `${origin}/c/${id}`, short: true };
    }
  } catch { /* offline ou store fora do ar: cai no formato longo */ }
  return { url: await campaignUrl(data, origin), short: false };
}

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

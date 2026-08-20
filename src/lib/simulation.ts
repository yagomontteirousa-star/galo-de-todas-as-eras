import type {
  HalftimeInstruction,
  MatchMomentId,
  MatchMomentInstruction,
  MatchEvent,
  MatchInstructions,
  MatchResult,
  PenaltyKick,
  Player,
  TeamSnapshot,
  TacticId,
} from "@/types/game";
import { matchMoments } from "@/data/match-moments";
import { calculateTeamOverall } from "@/lib/overall";

export type RandomSource = () => number;
type Modifier = { attack: number; defense: number; midfield: number; volatility: number };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const tacticModifiers: Record<TacticId, Modifier> = {
  balanced: { attack: 0, defense: 0, midfield: 1, volatility: 0 },
  attacking: { attack: 3, defense: -2, midfield: 0, volatility: 0.12 },
  defensive: { attack: -2, defense: 3, midfield: 0, volatility: -0.08 },
  pressing: { attack: 1, defense: -1, midfield: 3, volatility: 0.16 },
};

const halftimeModifiers: Record<HalftimeInstruction, Modifier> = {
  keep: { attack: 0, defense: 0, midfield: 1, volatility: 0 },
  press: { attack: 2, defense: -2, midfield: 3, volatility: 0.12 },
  attack: { attack: 4, defense: -3, midfield: 0, volatility: 0.18 },
  defend: { attack: -3, defense: 4, midfield: -1, volatility: -0.12 },
};

/** Escolhas aos 65': pequenas inclinações, nunca uma garantia de gol ou resultado. */
const momentModifiers: Record<MatchMomentInstruction, Modifier> = {
  wide: { attack: 2, defense: -1, midfield: 1, volatility: 0.08 },
  inside: { attack: 2, defense: 0, midfield: 2, volatility: 0.05 },
  direct: { attack: 1, defense: -1, midfield: -1, volatility: 0.14 },
  calm: { attack: -1, defense: 1, midfield: 2, volatility: -0.04 },
  press: { attack: 2, defense: -2, midfield: 3, volatility: 0.13 },
  protect: { attack: -2, defense: 3, midfield: -1, volatility: -0.1 },
  counter: { attack: 1, defense: 1, midfield: 0, volatility: 0.09 },
  set_pieces: { attack: 1, defense: 0, midfield: 0, volatility: 0.08 },
  shots: { attack: 2, defense: -1, midfield: 0, volatility: 0.12 },
  hold: { attack: -1, defense: 1, midfield: 2, volatility: -0.06 },
  restart_fast: { attack: 2, defense: -1, midfield: 1, volatility: 0.1 },
  restart_safe: { attack: -1, defense: 2, midfield: 1, volatility: -0.05 },
};

export function seededRandom(seed: number): RandomSource {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function poisson(lambda: number, random: RandomSource): number {
  const limit = Math.exp(-lambda);
  let product = 1;
  let count = 0;
  do {
    count += 1;
    product *= random();
  } while (product > limit && count < 7);
  return count - 1;
}

function average(team: TeamSnapshot, key: keyof Player["attributes"]): number {
  return team.lineup.reduce((sum, player) => sum + player.attributes[key], 0) / team.lineup.length;
}

function profile(team: TeamSnapshot) {
  const mod = tacticModifiers[team.tactic];
  return {
    attack: team.overall.attack * 0.6 + average(team, "finishing") * 0.22 + average(team, "creation") * 0.18 + mod.attack,
    defense: team.overall.defense * 0.68 + team.overall.goalkeeper * 0.18 + average(team, "defending") * 0.14 + mod.defense,
    midfield: team.overall.midfield * 0.74 + average(team, "creation") * 0.26 + mod.midfield,
    volatility: mod.volatility,
  };
}

/** Função em campo, e não a sigla da vaga: é ela que decide quem pode protagonizar cada lance. */
type Role = "keeper" | "centreBack" | "fullBack" | "holding" | "midfield" | "winger" | "forward";

const roleOf: Record<Player["primaryPosition"], Role> = {
  GK: "keeper", CB: "centreBack", LB: "fullBack", RB: "fullBack", LWB: "fullBack", RWB: "fullBack",
  DM: "holding", CM: "midfield", AM: "midfield", LW: "winger", RW: "winger", ST: "forward",
};

const OUTFIELD: Role[] = ["centreBack", "fullBack", "holding", "midfield", "winger", "forward"];
const FINISHERS: Role[] = ["forward", "winger", "midfield"];
const STOPPERS: Role[] = ["centreBack", "fullBack", "holding"];
const FLANKS: Role[] = ["winger", "fullBack"];

function pickFrom(pool: Player[], random: RandomSource, weight: (player: Player) => number): Player {
  const weights = pool.map((player) => Math.max(1, weight(player)));
  let cursor = random() * weights.reduce((sum, value) => sum + value, 0);
  for (let index = 0; index < pool.length; index += 1) {
    cursor -= weights[index];
    if (cursor <= 0) return pool[index];
  }
  return pool.at(-1)!;
}

/**
 * Uma formação pode não ter ponta nem volante, então a lista de funções é uma preferência:
 * sem ninguém elegível, o lance cai para a linha inteira em vez de sumir.
 */
function pickByRole(team: TeamSnapshot, random: RandomSource, roles: Role[], weight: (player: Player) => number): Player {
  const pool = team.lineup.filter((player) => roles.includes(roleOf[player.primaryPosition]));
  const outfield = team.lineup.filter((player) => player.primaryPosition !== "GK");
  return pickFrom(pool.length ? pool : outfield.length ? outfield : team.lineup, random, weight);
}

const finishingWeight = (player: Player) => {
  const bonus = roleOf[player.primaryPosition] === "forward" ? 1.45 : roleOf[player.primaryPosition] === "winger" ? 1.2 : 0.8;
  return (player.attributes.finishing * 0.62 + player.attributes.positioning * 0.38) * bonus;
};
const creationWeight = (player: Player) => player.attributes.creation + player.attributes.pace * 0.25;
const defendingWeight = (player: Player) => player.attributes.defending + player.attributes.physical * 0.35;

/** Gol de zagueiro em bola parada existe; gol de goleiro, não. */
function attackingWeight(player: Player): number {
  if (player.primaryPosition === "GK") return 0;
  const role = roleOf[player.primaryPosition];
  const positionWeight = role === "forward" ? 1.45 : role === "winger" || player.primaryPosition === "AM" ? 1.2
    : role === "midfield" || role === "fullBack" ? 0.72 : 0.28;
  return Math.max(1, (player.attributes.finishing * 0.62 + player.attributes.positioning * 0.38) * positionWeight);
}

const pickScorer = (team: TeamSnapshot, random: RandomSource) =>
  pickFrom(team.lineup.filter((player) => player.primaryPosition !== "GK"), random, attackingWeight);
const pickFinisher = (team: TeamSnapshot, random: RandomSource) => pickByRole(team, random, FINISHERS, finishingWeight);
const pickCreator = (team: TeamSnapshot, random: RandomSource) => pickByRole(team, random, OUTFIELD, creationWeight);
const pickDefender = (team: TeamSnapshot, random: RandomSource) => pickByRole(team, random, STOPPERS, defendingWeight);
const pickFlank = (team: TeamSnapshot, random: RandomSource) => pickByRole(team, random, FLANKS, creationWeight);
const pickKeeper = (team: TeamSnapshot) => team.lineup.find((player) => player.primaryPosition === "GK") ?? team.lineup[0];

/** Construção de jogada narrada pela função de quem está com a bola. */
const buildUpLine: Record<Role, (name: string) => string> = {
  keeper: (name) => `${name} recompõe a saída de bola.`,
  centreBack: (name) => `${name} sobe a linha e dá cobertura.`,
  fullBack: (name) => `${name} apoia pela lateral.`,
  holding: (name) => `${name} pressiona e devolve o passe.`,
  midfield: (name) => `${name} controla o ritmo do jogo.`,
  winger: (name) => `${name} acelera pela ponta.`,
  forward: (name) => `${name} se movimenta entre os zagueiros.`,
};

const finishLine: Record<Role, (name: string) => string> = {
  keeper: (name) => `${name} arrisca de longe.`,
  centreBack: (name) => `${name} sobe na bola parada e cabeceia para fora.`,
  fullBack: (name) => `${name} chega da lateral e manda por cima.`,
  holding: (name) => `${name} arrisca de fora da área.`,
  midfield: (name) => `${name} finaliza da entrada da área.`,
  winger: (name) => `${name} corta para o meio e chuta para fora.`,
  forward: (name) => `${name} finaliza e leva perigo.`,
};

const stopLine: Record<Role, (name: string) => string> = {
  keeper: (name) => `${name} sai do gol e afasta o perigo.`,
  centreBack: (name) => `${name} corta o cruzamento no duelo aéreo.`,
  fullBack: (name) => `${name} recupera a bola pelo lado.`,
  holding: (name) => `${name} desarma no meio-campo.`,
  midfield: (name) => `${name} bloqueia a linha de passe.`,
  winger: (name) => `${name} volta e ajuda na marcação.`,
  forward: (name) => `${name} pressiona a saída de bola.`,
};

const foulLine: Record<Role, (name: string) => string> = {
  keeper: (name) => `${name} derruba o atacante na saída.`,
  centreBack: (name) => `${name} chega atrasado no duelo aéreo.`,
  fullBack: (name) => `${name} comete falta na disputa pelo lado.`,
  holding: (name) => `${name} para o contra-ataque com falta.`,
  midfield: (name) => `${name} faz falta tática no meio.`,
  winger: (name) => `${name} erra o tempo do carrinho.`,
  forward: (name) => `${name} empurra o zagueiro na disputa.`,
};

const role = (player: Player) => roleOf[player.primaryPosition];

function matchEvent(
  type: MatchEvent["type"],
  minute: number,
  description: string,
  period: MatchEvent["period"],
  team?: TeamSnapshot,
  player?: Player,
  highlight = false,
): MatchEvent {
  return {
    id: `${type}-${minute}-${team?.id ?? "match"}-${player?.id ?? "event"}`,
    type,
    minute,
    description,
    period,
    teamId: team?.id,
    playerId: player?.id,
    playerName: player?.name,
    highlight,
  };
}

const randomMinute = (start: number, end: number, random: RandomSource) => Math.round(start + random() * (end - start));

function ambientEvents(
  home: TeamSnapshot,
  away: TeamSnapshot,
  start: number,
  end: number,
  period: MatchEvent["period"],
  random: RandomSource,
  intensity = 1,
): MatchEvent[] {
  const profiles = [profile(home), profile(away)];
  const teams = [home, away];
  return Array.from({ length: Math.max(2, Math.round((end - start) / 9 * intensity)) }, () => {
    const teamIndex = random() < clamp(0.5 + (profiles[0].midfield - profiles[1].midfield) / 120, 0.32, 0.68) ? 0 : 1;
    const team = teams[teamIndex];
    const opponent = teams[1 - teamIndex];
    const minute = randomMinute(start, end, random);
    const roll = random();
    // Cada faixa escolhe primeiro a função que faria o lance, e só depois o nome.
    if (roll < 0.15) {
      const player = pickCreator(team, random);
      return matchEvent("pressure", minute, buildUpLine[role(player)](player.name), period, team, player);
    }
    if (roll < 0.24) {
      const keeper = pickKeeper(team);
      return matchEvent("possession", minute, `${keeper.name} repõe a bola e ${team.name} recomeça.`, period, team, keeper);
    }
    if (roll < 0.33) {
      const player = pickDefender(opponent, random);
      return matchEvent("possession", minute, stopLine[role(player)](player.name), period, opponent, player);
    }
    if (roll < 0.47) {
      const player = pickFinisher(team, random);
      return matchEvent("shot_off", minute, finishLine[role(player)](player.name), period, team, player);
    }
    if (roll < 0.62) {
      const player = pickFinisher(team, random);
      return matchEvent("shot_saved", minute, `${player.name} bate, ${pickKeeper(opponent).name} defende.`, period, team, player);
    }
    if (roll < 0.72) {
      const keeper = pickKeeper(opponent);
      const shooter = pickFinisher(team, random);
      return matchEvent("big_save", minute, `Defesaça de ${keeper.name} em ${shooter.name}.`, period, opponent, keeper, true);
    }
    if (roll < 0.8) {
      const player = pickFlank(team, random);
      return matchEvent("corner", minute, `${player.name} cobra o escanteio para ${team.name}.`, period, team, player);
    }
    if (roll < 0.87) {
      const player = pickDefender(opponent, random);
      return matchEvent("dangerous_foul", minute, foulLine[role(player)](player.name), period, opponent, player);
    }
    if (roll < 0.94) {
      const player = pickByRole(team, random, ["forward", "winger"], finishingWeight);
      return matchEvent("offside", minute, `${player.name} sai antes e fica em impedimento.`, period, team, player);
    }
    const player = pickDefender(opponent, random);
    return matchEvent("yellow_card", minute, `Amarelo para ${player.name}.`, period, opponent, player);
  });
}

function instructionModifier(instruction?: HalftimeInstruction): Modifier {
  return instruction ? halftimeModifiers[instruction] : { attack: 0, defense: 0, midfield: 0, volatility: 0 };
}

function momentModifier(instruction?: MatchMomentInstruction): Modifier {
  return instruction ? momentModifiers[instruction] : { attack: 0, defense: 0, midfield: 0, volatility: 0 };
}

function mergeModifiers(...modifiers: Modifier[]): Modifier {
  return modifiers.reduce((merged, item) => ({
    attack: merged.attack + item.attack, defense: merged.defense + item.defense,
    midfield: merged.midfield + item.midfield, volatility: merged.volatility + item.volatility,
  }), { attack: 0, defense: 0, midfield: 0, volatility: 0 });
}

function substitutionsAt(instructions: MatchInstructions, at: 45 | 65) {
  return (instructions.substitutions ?? []).filter((item) => item.at === at);
}

/** Só o elenco do jogador traz banco e vagas persistentes. O rival segue com seu onze histórico. */
function teamAfterSubstitutions(team: TeamSnapshot, substitutions: ReturnType<typeof substitutionsAt>): TeamSnapshot {
  if (!team.isUser || !team.bench?.length || !team.lineupEntries?.length || !substitutions.length) return team;
  const lineup = [...team.lineup];
  const bench = [...team.bench];
  let entries = [...team.lineupEntries];
  for (const change of substitutions) {
    const outIndex = lineup.findIndex((player) => player.id === change.outPlayerId);
    const inIndex = bench.findIndex((player) => player.id === change.inPlayerId);
    if (outIndex < 0 || inIndex < 0) continue;
    const outgoing = lineup[outIndex];
    const incoming = bench[inIndex];
    lineup[outIndex] = incoming;
    bench[inIndex] = outgoing;
    entries = entries.map((entry) => entry.playerId === outgoing.id ? { ...entry, playerId: incoming.id, squadId: incoming.squadId } : entry);
  }
  const positioned = entries.map((entry) => ({ player: lineup.find((player) => player.id === entry.playerId)!, slotId: entry.slotId }));
  return { ...team, lineup, bench, lineupEntries: entries, overall: calculateTeamOverall(positioned, team.formation, team.tactic) };
}

function substitutionEvents(team: TeamSnapshot, next: TeamSnapshot, substitutions: ReturnType<typeof substitutionsAt>, minute: number, period: MatchEvent["period"]): MatchEvent[] {
  if (!team.isUser || !substitutions.length) return [];
  return substitutions.flatMap((change) => {
    const outgoing = team.lineup.find((player) => player.id === change.outPlayerId);
    const incoming = next.lineup.find((player) => player.id === change.inPlayerId);
    return outgoing && incoming
      ? [matchEvent("substitution", minute, `${outgoing.name} sai, ${incoming.name} entra.`, period, team, incoming, true)]
      : [];
  });
}

/**
 * A ocorrência é determinada por placar e lances que já existiam antes de 65'. O hash
 * só alterna entre leituras compatíveis; ele não inventa posse, pressão ou reclamação.
 */
function matchMomentFor(home: TeamSnapshot, away: TeamSnapshot, events: MatchEvent[]): MatchMomentId | undefined {
  const user = home.isUser ? home : away.isUser ? away : undefined;
  if (!user) return undefined;
  const rival = user.id === home.id ? away : home;
  const score = scoreAt(events, home.id, 65);
  const userScore = user.id === home.id ? score.home : score.away;
  const rivalScore = user.id === home.id ? score.away : score.home;
  const attacks = events.filter((event) => event.minute >= 47 && event.minute <= 64 && ["pressure", "corner", "shot_off", "shot_saved", "big_save", "goal", "penalty"].includes(event.type));
  const rivalPressure = attacks.filter((event) => event.teamId === rival.id).length;
  const userAttempts = attacks.filter((event) => event.teamId === user.id && ["shot_saved", "big_save", "goal"].includes(event.type)).length;
  const hash = Array.from(`${home.id}-${away.id}-${score.home}-${score.away}`).reduce((total, char) => total + char.charCodeAt(0), 0);

  if (userScore < rivalScore) return rivalPressure > 1 ? "trailing-control" : "trailing-break";
  if (userScore > rivalScore) return rivalPressure > 1 ? "lead-pressure" : "lead-control";
  if (userAttempts >= 2) return "draw-keeper";
  const tied: MatchMomentId[] = ["draw-open", "rival-tired-right", "rival-tired-left", "rain", "heavy-pitch", "floodlights", "wind"];
  return tied[hash % tied.length];
}

function segmentLambdas(
  home: TeamSnapshot,
  away: TeamSnapshot,
  factor: number,
  mod: Modifier,
  red: { home: number; away: number },
) {
  const a = profile(home);
  const b = profile(away);
  const edge = home.overall.final - away.overall.final;
  // A diferença de força pesa, mas continua menor que o conjunto de setores e que a
  // variância do Poisson. O favorito ganha vantagem real sem receber resultado pronto.
  const boundedEdge = clamp(edge, -12, 12) / 52;
  const homeBase = 1.2 + (a.attack + mod.attack - b.defense) / 24 + (a.midfield + mod.midfield - b.midfield) / 42 + boundedEdge + a.volatility + mod.volatility;
  const awayBase = 1.14 + (b.attack - (a.defense + mod.defense)) / 24 + (b.midfield - (a.midfield + mod.midfield)) / 42 - boundedEdge + b.volatility;
  return {
    home: clamp((homeBase - red.home + red.away * 0.45) * factor, 0.08, 2.25),
    away: clamp((awayBase - red.away + red.home * 0.45) * factor, 0.08, 2.25),
  };
}

function goalEvents(team: TeamSnapshot, count: number, start: number, end: number, period: MatchEvent["period"], random: RandomSource): MatchEvent[] {
  return Array.from({ length: count }, () => {
    const scorer = pickScorer(team, random);
    const creator = random() < 0.78 ? pickCreator(team, random) : undefined;
    const assist = creator && creator.id !== scorer.id ? creator : undefined;
    return { ...matchEvent("goal", randomMinute(start, end, random), "", period, team, scorer, true), assistPlayerId: assist?.id, assistName: assist?.name };
  });
}

function discipline(
  home: TeamSnapshot,
  away: TeamSnapshot,
  start: number,
  end: number,
  period: MatchEvent["period"],
  random: RandomSource,
): { events: MatchEvent[]; red?: "home" | "away" } {
  if (random() > 0.075) return { events: [] };
  const red = random() < 0.5 ? "home" : "away";
  const team = red === "home" ? home : away;
  const player = pickDefender(team, random);
  return {
    red,
    events: [matchEvent("red_card", randomMinute(start, end, random), `Vermelho para ${player.name}. ${team.name} com dez.`, period, team, player, true)],
  };
}

function maybePenalty(home: TeamSnapshot, away: TeamSnapshot, start: number, end: number, period: MatchEvent["period"], random: RandomSource): MatchEvent[] {
  if (random() > 0.045) return [];
  const team = random() < 0.5 ? home : away;
  const opponent = team.id === home.id ? away : home;
  const taker = pickFinisher(team, random);
  const keeper = pickKeeper(opponent);
  const minute = randomMinute(start, end, random);
  const awarded = matchEvent("penalty", minute, `Pênalti para ${team.name}. ${taker.name} cobra.`, period, team, taker, true);
  return random() < clamp(0.67 + taker.attributes.finishing / 500, 0.72, 0.88)
    ? [awarded, matchEvent("goal", minute + 1, "", period, team, taker, true)]
    : [awarded, matchEvent("big_save", minute + 1, `${keeper.name} pega o pênalti.`, period, opponent, keeper, true)];
}

function playSegment(
  home: TeamSnapshot,
  away: TeamSnapshot,
  start: number,
  end: number,
  factor: number,
  period: MatchEvent["period"],
  random: RandomSource,
  mod: Modifier,
  red: { home: number; away: number },
): MatchEvent[] {
  const cards = discipline(home, away, start, end, period, random);
  if (cards.red) red[cards.red] += 0.5;
  const lambda = segmentLambdas(home, away, factor, mod, red);
  return [
    ...ambientEvents(home, away, start, end, period, random, factor / 0.25),
    ...cards.events,
    ...maybePenalty(home, away, start, end - 1, period, random),
    ...goalEvents(home, poisson(lambda.home, random), start, end, period, random),
    ...goalEvents(away, poisson(lambda.away, random), start, end, period, random),
  ];
}

function penaltyQuality(team: TeamSnapshot): number {
  const takers = [...team.lineup]
    .sort((left, right) => right.attributes.finishing + right.attributes.positioning - left.attributes.finishing - left.attributes.positioning)
    .slice(0, 5);
  return takers.reduce((sum, player) => sum + player.attributes.finishing + player.attributes.positioning, 0) / (takers.length * 200);
}

function penaltyOrder(team: TeamSnapshot): Player[] {
  return [...team.lineup].sort((left, right) =>
    right.attributes.finishing + right.attributes.positioning - left.attributes.finishing - left.attributes.positioning);
}

/** Alterna as cobranças e encerra assim que o placar fica matematicamente definido. */
function shootout(home: TeamSnapshot, away: TeamSnapshot, random: RandomSource): { kicks: PenaltyKick[]; home: number; away: number } {
  const chance = (team: TeamSnapshot, opponent: TeamSnapshot) => clamp(0.65 + penaltyQuality(team) * 0.23 - pickKeeper(opponent).attributes.reflexes / 1250, 0.68, 0.88);
  const takers = { home: penaltyOrder(home), away: penaltyOrder(away) };
  const taken = { home: 0, away: 0 };
  const score = { home: 0, away: 0 };
  const kicks: PenaltyKick[] = [];
  const decided = () => {
    const left = { home: Math.max(0, 5 - taken.home), away: Math.max(0, 5 - taken.away) };
    return score.home > score.away + left.away || score.away > score.home + left.home;
  };

  const kick = (side: "home" | "away", suddenDeath: boolean) => {
    const team = side === "home" ? home : away;
    const rival = side === "home" ? away : home;
    const taker = takers[side][taken[side] % takers[side].length];
    const scored = random() < chance(team, rival);
    taken[side] += 1;
    if (scored) score[side] += 1;
    kicks.push({ order: kicks.length + 1, side, taker: taker.name, scored, homeScore: score.home, awayScore: score.away, suddenDeath });
  };

  for (let round = 0; round < 5 && !decided(); round += 1) {
    kick("home", false);
    if (decided()) break;
    kick("away", false);
  }
  while (score.home === score.away) {
    kick("home", true);
    kick("away", true);
  }
  return { kicks, home: score.home, away: score.away };
}

function scoreAt(events: MatchEvent[], homeId: string, endMinute: number) {
  return events.filter((item) => item.type === "goal" && item.minute <= endMinute).reduce(
    (score, item) => {
      if (item.teamId === homeId) score.home += 1;
      else score.away += 1;
      return score;
    },
    { home: 0, away: 0 },
  );
}

function finalizeEvents(events: MatchEvent[], home: TeamSnapshot): MatchEvent[] {
  let homeScore = 0;
  let awayScore = 0;
  return events
    .sort((left, right) => left.minute - right.minute || (left.type === "penalty" ? -1 : 1))
    .map((item, index) => {
      const finalized = { ...item, id: `${item.id}-${index}` };
      if (item.type === "goal") {
        if (item.teamId === home.id) homeScore += 1;
        else awayScore += 1;
        finalized.homeScore = homeScore;
        finalized.awayScore = awayScore;
        finalized.description = `GOL de ${item.playerName}. ${homeScore}×${awayScore}.`;
      }
      return finalized;
    });
}

function instructionImpact(instructions: MatchInstructions): string | undefined {
  const half: Record<HalftimeInstruction, string> = {
    keep: "Plano mantido: equilíbrio preservado no segundo tempo.",
    press: "Pressão alta: mais recuperação no campo rival, risco nas costas.",
    attack: "Postura ofensiva: mais volume, linha defensiva exposta.",
    defend: "Bloco baixo: área protegida, saída para o ataque reduzida.",
  };
  const moment: Record<MatchMomentInstruction, string> = {
    wide: "Corredor explorado: o time ganhou amplitude na reta final.",
    inside: "Jogo por dentro: mais aproximação entre meia e ataque.",
    direct: "Bola mais longa: transições ficaram mais rápidas e instáveis.",
    calm: "Ritmo controlado: o time diminuiu perdas e encontrou melhores passes.",
    press: "Pressão acionada: mais recuperação no campo rival, com risco nas costas.",
    protect: "Resultado protegido: linhas mais compactas na frente da área.",
    counter: "Transição preparada: o rival passou a encontrar menos campo livre.",
    set_pieces: "Bola parada valorizada na reta final.",
    shots: "Mais tentativas de média distância na busca pelo gol.",
    hold: "Posse administrada para tirar o ritmo do adversário.",
    restart_fast: "Retomada intensa depois da pausa.",
    restart_safe: "Reinício seguro para reorganizar o time.",
  };
  return [instructions.halftime && half[instructions.halftime], instructions.moment && moment[instructions.moment]].filter(Boolean).join(" ") || undefined;
}

const withoutClosingMarkers = (event: MatchEvent) => event.type !== "full_time" && event.type !== "shootout";

/**
 * Mantém tudo que o jogador já viu e usa uma nova simulação apenas dali em diante.
 * Isso permite que escalação e decisões alterem o jogo sem reescrever gols anteriores.
 */
export function mergeMatchFuture(
  home: TeamSnapshot,
  away: TeamSnapshot,
  previous: MatchResult,
  revised: MatchResult,
  fromMinute: number,
  random: RandomSource = Math.random,
): MatchResult {
  const regularPrefix = previous.events.filter((event) => event.period === "regular" && event.minute <= Math.min(fromMinute, 90) && withoutClosingMarkers(event));
  const regularFuture = fromMinute < 90
    ? revised.events.filter((event) => event.period === "regular" && event.minute > fromMinute && event.minute <= 90 && withoutClosingMarkers(event))
    : [];
  const regularEvents = [...regularPrefix, ...regularFuture];
  const regular = scoreAt(regularEvents, home.id, 90);
  const wentToExtraTime = regular.home === regular.away || fromMinute > 90;
  const events = [...regularEvents];
  let homeExtra = 0;
  let awayExtra = 0;
  let homePenalties: number | undefined;
  let awayPenalties: number | undefined;
  let penaltyKicks: PenaltyKick[] | undefined;
  let wentToPenalties = false;

  if (wentToExtraTime) {
    if (!events.some((event) => event.type === "extra_time")) {
      events.push(matchEvent("extra_time", 91, "A partida vai para a prorrogação.", "extra", undefined, undefined, true));
    }
    const extraPrefix = fromMinute > 90
      ? previous.events.filter((event) => event.period === "extra" && event.minute <= fromMinute && event.type !== "full_time" && event.type !== "extra_time")
      : [];
    let extraFuture = revised.events.filter((event) => event.period === "extra" && event.minute > Math.max(91, fromMinute) && event.minute <= 120 && event.type !== "full_time" && event.type !== "extra_time");
    if (!extraFuture.length && fromMinute < 119) {
      const start = Math.max(93, fromMinute + 1);
      const factor = 0.3 * Math.max(0, 120 - start) / 27;
      const red = {
        home: events.filter((event) => event.type === "red_card" && event.teamId === home.id).length * 0.5,
        away: events.filter((event) => event.type === "red_card" && event.teamId === away.id).length * 0.5,
      };
      extraFuture = playSegment(home, away, start, 119, factor, "extra", random, instructionModifier(revised.instructions.halftime), red);
    }
    events.push(...extraPrefix, ...extraFuture);
    const totals = scoreAt(events, home.id, 120);
    homeExtra = totals.home - regular.home;
    awayExtra = totals.away - regular.away;
    if (totals.home === totals.away) {
      wentToPenalties = true;
      const disputa = shootout(home, away, random);
      homePenalties = disputa.home;
      awayPenalties = disputa.away;
      penaltyKicks = disputa.kicks;
      events.push(matchEvent("shootout", 121, `Pênaltis: ${home.name} ${homePenalties} a ${awayPenalties} ${away.name}.`, "shootout", undefined, undefined, true));
    }
  }

  events.push(matchEvent("full_time", wentToExtraTime ? 122 : 90, "Fim de jogo.", wentToExtraTime ? "extra" : "regular", undefined, undefined, true));
  const homeTotal = regular.home + homeExtra;
  const awayTotal = regular.away + awayExtra;
  const winnerId = homeTotal > awayTotal || (homeTotal === awayTotal && (homePenalties ?? 0) > (awayPenalties ?? 0)) ? home.id : away.id;
  const finalizedEvents = finalizeEvents(events, home);
  const winner = winnerId === home.id ? home : away;
  const playerOfMatch = finalizedEvents.find((event) => event.type === "goal" && event.teamId === winnerId)?.playerName
    ?? winner.lineup.reduce((best, player) => player.overall > best.overall ? player : best).name;

  return {
    homeScore: regular.home,
    awayScore: regular.away,
    homeExtra,
    awayExtra,
    homePenalties,
    awayPenalties,
    penaltyKicks,
    wentToExtraTime,
    wentToPenalties,
    winnerId,
    events: finalizedEvents,
    playerOfMatch,
    summary: summary(home, away, winnerId),
    instructions: revised.instructions,
    instructionImpact: revised.instructionImpact,
    matchMoment: fromMinute >= 65 ? previous.matchMoment : revised.matchMoment,
  };
}

function summary(home: TeamSnapshot, away: TeamSnapshot, winnerId: string): string {
  const winner = winnerId === home.id ? home : away;
  const loser = winnerId === home.id ? away : home;
  if (loser.isUser && loser.overall.improvisationPenalty >= 2) return "As improvisações pesaram contra um adversário que atacou os espaços certos.";
  if ((home.tactic === "pressing" && home.isUser) || (away.tactic === "pressing" && away.isUser)) {
    return winner.isUser ? "A pressão alta criou recuperações decisivas, mesmo deixando espaços atrás." : "A pressão alta criou chances, mas expôs a última linha nos momentos decisivos.";
  }
  if (winner.isUser && winner.overall.attack >= winner.overall.midfield) return "Seu ataque foi decisivo nos momentos de maior pressão.";
  if (loser.isUser && winner.overall.midfield > loser.overall.midfield) return "O adversário dominou o meio-campo e limitou sua criação.";
  if (winner.overall.defense > loser.overall.attack) return `${winner.name} protegeu bem a área e controlou as melhores chances.`;
  return `${winner.name} foi mais eficiente em um duelo equilibrado.`;
}

export function simulateMatch(
  home: TeamSnapshot,
  away: TeamSnapshot,
  random: RandomSource = Math.random,
  instructions: MatchInstructions = {},
): MatchResult {
  const events: MatchEvent[] = [matchEvent("kickoff", 0, `A bola rola: ${home.name} × ${away.name}.`, "regular", undefined, undefined, true)];
  const red = { home: 0, away: 0 };
  events.push(...playSegment(home, away, 2, 44, 0.46, "regular", random, instructionModifier(), red));
  events.push(matchEvent("halftime", 45, "Intervalo.", "regular", undefined, undefined, true));
  events.push(matchEvent("second_half", 46, "Começa o segundo tempo.", "regular"));

  const halftime = instructionModifier(instructions.halftime);
  const homeAfterHalftime = teamAfterSubstitutions(home, substitutionsAt(instructions, 45));
  const awayAfterHalftime = teamAfterSubstitutions(away, substitutionsAt(instructions, 45));
  events.push(...substitutionEvents(home, homeAfterHalftime, substitutionsAt(instructions, 45), 46, "regular"));
  events.push(...substitutionEvents(away, awayAfterHalftime, substitutionsAt(instructions, 45), 46, "regular"));
  events.push(...playSegment(homeAfterHalftime, awayAfterHalftime, 47, 64, 0.2, "regular", random, halftime, red));
  const matchMoment = matchMomentFor(home, away, events);
  const homeLate = teamAfterSubstitutions(homeAfterHalftime, substitutionsAt(instructions, 65));
  const awayLate = teamAfterSubstitutions(awayAfterHalftime, substitutionsAt(instructions, 65));
  events.push(...substitutionEvents(homeAfterHalftime, homeLate, substitutionsAt(instructions, 65), 65, "regular"));
  events.push(...substitutionEvents(awayAfterHalftime, awayLate, substitutionsAt(instructions, 65), 65, "regular"));
  if (matchMoment && instructions.moment) {
    const choice = matchMoments[matchMoment].choices.find(({ id }) => id === instructions.moment);
    events.push(matchEvent("decision", 65, `Decisão aos 65': ${choice?.label ?? "ajuste confirmado"}.`, "regular", undefined, undefined, true));
  }
  const lateGame = mergeModifiers(halftime, momentModifier(instructions.moment));
  events.push(...playSegment(homeLate, awayLate, 66, 69, 0.05, "regular", random, lateGame, red));
  events.push(...playSegment(homeLate, awayLate, 70, 89, 0.29, "regular", random, lateGame, red));

  const regular = scoreAt(events, home.id, 90);
  let homeExtra = 0;
  let awayExtra = 0;
  let homePenalties: number | undefined;
  let awayPenalties: number | undefined;
  let penaltyKicks: PenaltyKick[] | undefined;
  const wentToExtraTime = regular.home === regular.away;
  let wentToPenalties = false;

  if (wentToExtraTime) {
    events.push(matchEvent("extra_time", 91, "A partida vai para a prorrogação.", "extra", undefined, undefined, true));
    events.push(...playSegment(homeLate, awayLate, 93, 119, 0.3, "extra", random, halftime, red));
    const totals = scoreAt(events, home.id, 120);
    homeExtra = totals.home - regular.home;
    awayExtra = totals.away - regular.away;
    if (totals.home === totals.away) {
      wentToPenalties = true;
      const disputa = shootout(homeLate, awayLate, random);
      homePenalties = disputa.home;
      awayPenalties = disputa.away;
      penaltyKicks = disputa.kicks;
      events.push(matchEvent("shootout", 121, `Pênaltis: ${home.name} ${homePenalties} a ${awayPenalties} ${away.name}.`, "shootout", undefined, undefined, true));
    }
  }

  events.push(matchEvent("full_time", wentToExtraTime ? 122 : 90, "Fim de jogo.", wentToExtraTime ? "extra" : "regular", undefined, undefined, true));
  const homeTotal = regular.home + homeExtra;
  const awayTotal = regular.away + awayExtra;
  const winnerId = homeTotal > awayTotal || (homeTotal === awayTotal && (homePenalties ?? 0) > (awayPenalties ?? 0)) ? home.id : away.id;
  const finalizedEvents = finalizeEvents(events, home);
  const winner = winnerId === home.id ? homeLate : awayLate;
  const playerOfMatch = finalizedEvents.find((item) => item.type === "goal" && item.teamId === winnerId)?.playerName
    ?? winner.lineup.reduce((best, player) => player.overall > best.overall ? player : best).name;

  return {
    homeScore: regular.home,
    awayScore: regular.away,
    homeExtra,
    awayExtra,
    homePenalties,
    awayPenalties,
    penaltyKicks,
    wentToExtraTime,
    wentToPenalties,
    winnerId,
    events: finalizedEvents,
    playerOfMatch,
    summary: summary(home, away, winnerId),
    instructions,
    instructionImpact: instructionImpact(instructions),
    matchMoment,
  };
}

import type {
  ContextInstruction,
  HalftimeInstruction,
  MatchEvent,
  MatchInstructions,
  MatchResult,
  Player,
  TeamSnapshot,
  TacticId,
} from "@/types/game";

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

const contextModifiers: Record<ContextInstruction, Modifier> = {
  chase: { attack: 5, defense: -4, midfield: 1, volatility: 0.24 },
  balance: { attack: 0, defense: 0, midfield: 1, volatility: 0 },
  protect: { attack: -4, defense: 5, midfield: -1, volatility: -0.16 },
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

function weightedPlayer(team: TeamSnapshot, random: RandomSource, weight: (player: Player) => number): Player {
  const weights = team.lineup.map(weight);
  let cursor = random() * weights.reduce((sum, value) => sum + value, 0);
  for (let index = 0; index < team.lineup.length; index += 1) {
    cursor -= weights[index];
    if (cursor <= 0) return team.lineup[index];
  }
  return team.lineup.at(-1)!;
}

function attackingWeight(player: Player): number {
  const positionWeight = player.primaryPosition === "ST"
    ? 1.45
    : ["LW", "RW", "AM"].includes(player.primaryPosition)
      ? 1.2
      : ["CM", "LWB", "RWB"].includes(player.primaryPosition)
        ? 0.72
        : 0.28;
  return Math.max(1, (player.attributes.finishing * 0.62 + player.attributes.positioning * 0.38) * positionWeight);
}

const pickScorer = (team: TeamSnapshot, random: RandomSource) => weightedPlayer(team, random, attackingWeight);
const pickCreator = (team: TeamSnapshot, random: RandomSource) => weightedPlayer(team, random, (player) => Math.max(4, player.attributes.creation + player.attributes.pace * 0.25));
const pickDefender = (team: TeamSnapshot, random: RandomSource) => weightedPlayer(team, random, (player) => Math.max(4, player.attributes.defending + player.attributes.physical * 0.35));
const pickKeeper = (team: TeamSnapshot) => team.lineup.find((player) => player.primaryPosition === "GK") ?? team.lineup[0];

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
    if (roll < 0.17) {
      const player = pickCreator(team, random);
      return matchEvent("pressure", minute, `${team.name} sobe a pressão com ${player.name}.`, period, team, player);
    }
    if (roll < 0.31) return matchEvent("possession", minute, `${team.name} controla a posse e procura espaços.`, period, team);
    if (roll < 0.47) {
      const player = pickScorer(team, random);
      return matchEvent("shot_off", minute, `${player.name} finaliza para fora.`, period, team, player);
    }
    if (roll < 0.62) {
      const player = pickScorer(team, random);
      return matchEvent("shot_saved", minute, `${player.name} bate; ${pickKeeper(opponent).name} segura.`, period, team, player);
    }
    if (roll < 0.72) {
      const keeper = pickKeeper(opponent);
      const shooter = pickScorer(team, random);
      return matchEvent("big_save", minute, `Grande defesa de ${keeper.name} na tentativa de ${shooter.name}.`, period, opponent, keeper, true);
    }
    if (roll < 0.8) return matchEvent("corner", minute, `Escanteio para ${team.name}.`, period, team);
    if (roll < 0.87) {
      const player = pickDefender(opponent, random);
      return matchEvent("dangerous_foul", minute, `Falta perigosa cometida por ${player.name}.`, period, opponent, player);
    }
    if (roll < 0.94) {
      const player = pickScorer(team, random);
      return matchEvent("offside", minute, `${player.name} é flagrado em impedimento.`, period, team, player);
    }
    const player = pickDefender(opponent, random);
    return matchEvent("yellow_card", minute, `Cartão amarelo para ${player.name}.`, period, opponent, player);
  });
}

function instructionModifier(instruction?: HalftimeInstruction | ContextInstruction): Modifier {
  if (!instruction) return { attack: 0, defense: 0, midfield: 0, volatility: 0 };
  return instruction in halftimeModifiers
    ? halftimeModifiers[instruction as HalftimeInstruction]
    : contextModifiers[instruction as ContextInstruction];
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
  const homeBase = 1.2 + (a.attack + mod.attack - b.defense) / 24 + (a.midfield + mod.midfield - b.midfield) / 42 + edge / 55 + a.volatility + mod.volatility;
  const awayBase = 1.14 + (b.attack - (a.defense + mod.defense)) / 24 + (b.midfield - (a.midfield + mod.midfield)) / 42 - edge / 55 + b.volatility;
  return {
    home: clamp((homeBase - red.home + red.away * 0.45) * factor, 0.08, 2.25),
    away: clamp((awayBase - red.away + red.home * 0.45) * factor, 0.08, 2.25),
  };
}

function goalEvents(team: TeamSnapshot, count: number, start: number, end: number, period: MatchEvent["period"], random: RandomSource): MatchEvent[] {
  return Array.from({ length: count }, () => {
    const scorer = pickScorer(team, random);
    return matchEvent("goal", randomMinute(start, end, random), "", period, team, scorer, true);
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
    events: [matchEvent("red_card", randomMinute(start, end, random), `Cartão vermelho para ${player.name}. ${team.name} fica com dez.`, period, team, player, true)],
  };
}

function maybePenalty(home: TeamSnapshot, away: TeamSnapshot, start: number, end: number, period: MatchEvent["period"], random: RandomSource): MatchEvent[] {
  if (random() > 0.045) return [];
  const team = random() < 0.5 ? home : away;
  const opponent = team.id === home.id ? away : home;
  const taker = pickScorer(team, random);
  const keeper = pickKeeper(opponent);
  const minute = randomMinute(start, end, random);
  const awarded = matchEvent("penalty", minute, `Pênalti para ${team.name}. ${taker.name} assume a cobrança.`, period, team, taker, true);
  return random() < clamp(0.67 + taker.attributes.finishing / 500, 0.72, 0.88)
    ? [awarded, matchEvent("goal", minute + 1, "", period, team, taker, true)]
    : [awarded, matchEvent("big_save", minute + 1, `${keeper.name} defende o pênalti de ${taker.name}.`, period, opponent, keeper, true)];
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

function shootout(home: TeamSnapshot, away: TeamSnapshot, random: RandomSource): [number, number] {
  const chance = (team: TeamSnapshot, opponent: TeamSnapshot) => clamp(0.65 + penaltyQuality(team) * 0.23 - pickKeeper(opponent).attributes.reflexes / 1250, 0.68, 0.88);
  let homePens = 0;
  let awayPens = 0;
  for (let kick = 0; kick < 5; kick += 1) {
    if (random() < chance(home, away)) homePens += 1;
    if (random() < chance(away, home)) awayPens += 1;
  }
  while (homePens === awayPens) {
    if (random() < chance(home, away)) homePens += 1;
    if (random() < chance(away, home)) awayPens += 1;
  }
  return [homePens, awayPens];
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

function finalizeEvents(events: MatchEvent[], home: TeamSnapshot, away: TeamSnapshot): MatchEvent[] {
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
        finalized.description = `GOL — ${item.playerName}, para ${item.teamId === home.id ? home.name : away.name}. ${homeScore} × ${awayScore}.`;
      }
      return finalized;
    });
}

function instructionImpact(instructions: MatchInstructions): string | undefined {
  const half: Record<HalftimeInstruction, string> = {
    keep: "A manutenção do plano preservou o equilíbrio da equipe.",
    press: "A pressão após o intervalo aumentou a presença no campo rival, com risco nas costas.",
    attack: "A postura ofensiva criou mais volume, mas abriu espaço para transições.",
    defend: "O bloco mais baixo protegeu a área e reduziu a saída para o ataque.",
  };
  const context: Record<ContextInstruction, string> = {
    chase: "Na reta final, buscar o resultado elevou as chances e também a exposição defensiva.",
    balance: "Na reta final, o time manteve distâncias seguras sem abandonar o ataque.",
    protect: "Na reta final, proteger o placar reforçou a defesa e limitou a criação.",
  };
  return [instructions.halftime && half[instructions.halftime], instructions.contextual && context[instructions.contextual]].filter(Boolean).join(" ") || undefined;
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
  const events: MatchEvent[] = [matchEvent("kickoff", 0, "A bola rola.", "regular", undefined, undefined, true)];
  const red = { home: 0, away: 0 };
  events.push(...playSegment(home, away, 2, 44, 0.46, "regular", random, instructionModifier(), red));
  events.push(matchEvent("halftime", 45, "Intervalo.", "regular", undefined, undefined, true));
  events.push(matchEvent("second_half", 46, "Começa o segundo tempo.", "regular"));

  const halftime = instructionModifier(instructions.halftime);
  events.push(...playSegment(home, away, 47, 69, 0.25, "regular", random, halftime, red));
  const contextual = instructionModifier(instructions.contextual);
  const late = {
    attack: halftime.attack + contextual.attack,
    defense: halftime.defense + contextual.defense,
    midfield: halftime.midfield + contextual.midfield,
    volatility: halftime.volatility + contextual.volatility,
  };
  events.push(...playSegment(home, away, 70, 89, 0.29, "regular", random, late, red));

  const regular = scoreAt(events, home.id, 90);
  let homeExtra = 0;
  let awayExtra = 0;
  let homePenalties: number | undefined;
  let awayPenalties: number | undefined;
  const wentToExtraTime = regular.home === regular.away;
  let wentToPenalties = false;

  if (wentToExtraTime) {
    events.push(matchEvent("extra_time", 91, "A partida vai para a prorrogação.", "extra", undefined, undefined, true));
    events.push(...playSegment(home, away, 93, 119, 0.3, "extra", random, late, red));
    const totals = scoreAt(events, home.id, 120);
    homeExtra = totals.home - regular.home;
    awayExtra = totals.away - regular.away;
    if (totals.home === totals.away) {
      wentToPenalties = true;
      [homePenalties, awayPenalties] = shootout(home, away, random);
      events.push(matchEvent("shootout", 121, `Pênaltis: ${home.name} ${homePenalties} × ${awayPenalties} ${away.name}.`, "shootout", undefined, undefined, true));
    }
  }

  events.push(matchEvent("full_time", wentToExtraTime ? 122 : 90, "Fim de jogo.", wentToExtraTime ? "extra" : "regular", undefined, undefined, true));
  const homeTotal = regular.home + homeExtra;
  const awayTotal = regular.away + awayExtra;
  const winnerId = homeTotal > awayTotal || (homeTotal === awayTotal && (homePenalties ?? 0) > (awayPenalties ?? 0)) ? home.id : away.id;
  const finalizedEvents = finalizeEvents(events, home, away);
  const winner = winnerId === home.id ? home : away;
  const playerOfMatch = finalizedEvents.find((item) => item.type === "goal" && item.teamId === winnerId)?.playerName
    ?? winner.lineup.reduce((best, player) => player.overall > best.overall ? player : best).name;

  return {
    homeScore: regular.home,
    awayScore: regular.away,
    homeExtra,
    awayExtra,
    homePenalties,
    awayPenalties,
    wentToExtraTime,
    wentToPenalties,
    winnerId,
    events: finalizedEvents,
    playerOfMatch,
    summary: summary(home, away, winnerId),
    instructions,
    instructionImpact: instructionImpact(instructions),
  };
}

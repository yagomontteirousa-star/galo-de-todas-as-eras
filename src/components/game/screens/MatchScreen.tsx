import type {
  BracketMatch,
  HalftimeInstruction,
  MatchMomentInstruction,
  MatchEvent,
  MatchEventType,
  MatchInstructions,
  MatchProgress,
  MatchResult,
  PenaltyKick,
  RatingsMode,
  LineupEntry,
  SquadPlayerEntry,
  TeamSnapshot,
} from "@/types/game";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowIcon } from "@/components/ui/Icons";
import { roundLabels, teamEra } from "@/lib/bracket";
import { TacticalEditor } from "@/components/game/screens/TacticsScreen";
import { RivalSquadDisclosure } from "@/components/game/RivalSquadDisclosure";
import { rivalRosterFromTeam } from "@/lib/rival-roster";
import { matchMoments } from "@/data/match-moments";
import { playersById } from "@/data/atletico-squads";

const eventLabels: Record<MatchEventType, string> = {
  kickoff: "Início de jogo", pressure: "Pressão", possession: "Posse de bola", shot_off: "Finalização para fora", shot_saved: "Defesa", big_save: "Grande defesa",
  corner: "Escanteio", dangerous_foul: "Falta", offside: "Impedimento", yellow_card: "Cartão amarelo", red_card: "Cartão vermelho", penalty: "Pênalti",
  goal: "Gol", substitution: "Substituição", decision: "Decisão", halftime: "Intervalo", second_half: "Segundo tempo", extra_time: "Prorrogação", shootout: "Pênaltis", full_time: "Fim de jogo",
};

/** Cada família de lance tem a sua cor, para a leitura ser instantânea. */
const eventTone: Partial<Record<MatchEventType, string>> = {
  penalty: "is-penalty", yellow_card: "is-card", red_card: "is-card",
  substitution: "is-substitution",
  decision: "is-break", halftime: "is-break", second_half: "is-break", extra_time: "is-break", full_time: "is-break", shootout: "is-break",
  kickoff: "is-break", big_save: "is-save",
};

const halftimeOptions: { id: HalftimeInstruction; label: string; detail: string }[] = [
  { id: "keep", label: "Manter o plano", detail: "Equilíbrio e controle" },
  { id: "press", label: "Pressionar", detail: "Mais recuperação, mais risco" },
  { id: "attack", label: "Atacar", detail: "Mais volume, linha exposta" },
  { id: "defend", label: "Defender", detail: "Protege a área, cria menos" },
];

/** A partida abre em ritmo lento para dar tempo de acompanhar o relógio. */
const speeds = [
  { id: "slow", label: "Lento", ms: 340 },
  { id: "normal", label: "Normal", ms: 165 },
  { id: "fast", label: "Rápido", ms: 65 },
];
const TIMELINE_ROWS = 4;
const KICK_REVEAL_MS = 1250;
const KICK_RESULT_MS = 760;
/** Pausa final: a série completa fica na tela antes de liberar o resultado. */
const CONCLUSION_MS = 2200;

export function MatchScreen({
  match,
  result,
  progress,
  ratingsMode,
  onInstruction,
  onLineupChange,
  onProgress,
  onFinish,
  playbackMode = "local",
  autoFinishAt,
  multiplayerRules = false,
}: {
  match: BracketMatch;
  result: MatchResult;
  progress?: MatchProgress;
  ratingsMode: RatingsMode;
  onInstruction: (instructions: MatchInstructions) => void;
  onLineupChange: (lineup: LineupEntry[], bench: SquadPlayerEntry[], substitution?: MatchProgress["substitutions"][number]) => void;
  onProgress: (playback: Pick<MatchProgress, "minute" | "kickStep" | "kickRevealed" | "shootoutComplete">) => void;
  onFinish: () => void;
  playbackMode?: "local" | "controller" | "follower";
  autoFinishAt?: string;
  multiplayerRules?: boolean;
}) {
  const maxMinute = result.wentToExtraTime ? 122 : 90;
  const kicks = useMemo(() => result.penaltyKicks ?? [], [result.penaltyKicks]);
  const savedProgress = progress?.matchId === match.id ? progress : undefined;
  const [localMinute, setMinute] = useState(savedProgress?.minute ?? 0);
  const [speedIndex, setSpeedIndex] = useState(multiplayerRules ? 1 : 0);
  const [paused, setPaused] = useState(false);
  /** Postura escolhida no intervalo, ainda não confirmada. */
  const [halftimePick, setHalftimePick] = useState<HalftimeInstruction>();
  const [momentPick, setMomentPick] = useState<MatchMomentInstruction>();
  /** Passo da disputa: a cobrança anuncia o nome antes de revelar o resultado. */
  const [localKickStep, setKickStep] = useState(savedProgress?.kickStep ?? 0);
  const [localKickRevealed, setKickRevealed] = useState(savedProgress?.kickRevealed ?? false);
  const [localShootoutComplete, setShootoutComplete] = useState(savedProgress?.shootoutComplete ?? false);
  const [goalFlash, setGoalFlash] = useState(false);
  const [boxOpen, setBoxOpen] = useState(true);
  const [substitutionOpen, setSubstitutionOpen] = useState(false);
  const [autoFinishSeconds, setAutoFinishSeconds] = useState(() => autoFinishAt ? Math.max(0, Math.ceil((Date.parse(autoFinishAt) - Date.now()) / 1000)) : undefined);
  const autoFinishCompleted = useRef(false);
  const decisionExpired = useRef("");
  const [decisionSeconds, setDecisionSeconds] = useState<number>();
  const userTeam = match.home.isUser ? match.home : match.away;
  const opponent = match.home.isUser ? match.away : match.home;
  const [liveLineup, setLiveLineup] = useState(() => savedProgress?.lineup ?? userTeam.lineupEntries ?? []);
  const [liveBench, setLiveBench] = useState(() => savedProgress?.bench ?? (userTeam.bench ?? []).map(({ id: playerId, squadId }) => ({ playerId, squadId })));
  const [liveSubstitutions, setLiveSubstitutions] = useState(() => savedProgress?.substitutions ?? []);
  const progressCallback = useRef(onProgress);
  const finishCallback = useRef(onFinish);
  const instructionCallback = useRef(onInstruction);
  const instructionsRef = useRef(result.instructions);
  const halftimePickRef = useRef(halftimePick);
  const momentPickRef = useRef(momentPick);
  const minute = playbackMode === "follower" ? savedProgress?.minute ?? localMinute : localMinute;
  const kickStep = playbackMode === "follower" ? savedProgress?.kickStep ?? localKickStep : localKickStep;
  const kickRevealed = playbackMode === "follower" ? savedProgress?.kickRevealed ?? localKickRevealed : localKickRevealed;
  const shootoutComplete = playbackMode === "follower" ? savedProgress?.shootoutComplete ?? localShootoutComplete : localShootoutComplete;
  useEffect(() => { progressCallback.current = onProgress; }, [onProgress]);
  useEffect(() => { finishCallback.current = onFinish; }, [onFinish]);
  useEffect(() => { instructionCallback.current = onInstruction; }, [onInstruction]);
  useEffect(() => { instructionsRef.current = result.instructions; }, [result.instructions]);
  useEffect(() => { halftimePickRef.current = halftimePick; }, [halftimePick]);
  useEffect(() => { momentPickRef.current = momentPick; }, [momentPick]);
  useEffect(() => {
    if (playbackMode === "follower") return;
    progressCallback.current({ minute, kickStep, kickRevealed, shootoutComplete });
  }, [kickRevealed, kickStep, minute, playbackMode, shootoutComplete]);
  const needsHalftime = minute >= 45 && !result.instructions.halftime;
  const moment = result.matchMoment ? matchMoments[result.matchMoment] : undefined;
  const needsMoment = minute >= 65 && !result.instructions.moment && Boolean(moment);
  const clockDone = minute >= maxMinute;
  /** A disputa segue no ar até um passo além da última cobrança, para a conclusão ser lida. */
  const inShootout = clockDone && result.wentToPenalties && !shootoutComplete;
  const concluded = kickStep >= kicks.length;
  const finished = clockDone && !inShootout;
  const running = playbackMode !== "follower" && !needsHalftime && !needsMoment && (multiplayerRules || !paused) && !clockDone;

  useEffect(() => {
    if (!finished || !autoFinishAt) return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((Date.parse(autoFinishAt) - Date.now()) / 1000));
      setAutoFinishSeconds(remaining);
      if (remaining === 0 && !autoFinishCompleted.current) {
        autoFinishCompleted.current = true;
        window.clearInterval(timer);
        finishCallback.current();
      }
    }, 200);
    return () => window.clearInterval(timer);
  }, [autoFinishAt, finished]);

  useEffect(() => {
    if (!running) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const step = reduce ? 3 : 1;
    const timer = window.setInterval(() => setMinute((value) => Math.min(maxMinute, value + step)), speeds[speedIndex].ms);
    return () => window.clearInterval(timer);
  }, [maxMinute, running, speedIndex]);

  // No desktop o box score horizontal completa a largura da composição. Em celular,
  // começa recolhido para placar, controles e lances terem prioridade.
  useEffect(() => {
    const constrained = window.matchMedia("(max-width: 920px)");
    const collapse = () => { if (constrained.matches) setBoxOpen(false); };
    collapse();
    constrained.addEventListener("change", collapse);
    return () => constrained.removeEventListener("change", collapse);
  }, []);

  // O painel do intervalo tem que nascer à vista, mesmo se a página estava rolada.
  useEffect(() => {
    if (needsHalftime) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [needsHalftime]);

  useEffect(() => {
    if (needsMoment) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [needsMoment]);

  // Disputa: primeiro o nome do cobrador, depois o resultado. A pausa cria suspense
  // sem alterar a sequência já definida pelo motor.
  useEffect(() => {
    if (!inShootout || playbackMode === "follower") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (kickStep >= kicks.length) {
      const timer = window.setTimeout(() => setShootoutComplete(true), reduce ? 100 : CONCLUSION_MS);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      if (!kickRevealed) setKickRevealed(true);
      else {
        setKickStep((value) => value + 1);
        setKickRevealed(false);
      }
    }, reduce ? 100 : kickRevealed ? KICK_RESULT_MS : KICK_REVEAL_MS);
    return () => window.clearTimeout(timer);
  }, [inShootout, kickRevealed, kickStep, kicks.length, playbackMode]);

  const visibleEvents = useMemo(() => result.events
    .filter((item) => item.minute <= minute)
    .sort((left, right) => left.minute - right.minute || left.id.localeCompare(right.id)), [minute, result.events]);
  const lastUserGoal = useMemo(() => {
    const goals = visibleEvents.filter((item) => item.type === "goal" && item.teamId === userTeam.id);
    return goals.length ? goals[goals.length - 1].id : undefined;
  }, [visibleEvents, userTeam.id]);

  // Gol do time do usuário: acende o placar por um instante e apaga sozinho.
  useEffect(() => {
    if (!lastUserGoal) return;
    const on = window.setTimeout(() => setGoalFlash(true), 0);
    const off = window.setTimeout(() => setGoalFlash(false), 1400);
    return () => { window.clearTimeout(on); window.clearTimeout(off); };
  }, [lastUserGoal]);

  const visibleGoals = visibleEvents.filter((item) => item.type === "goal");
  const homeVisible = visibleGoals.filter((item) => item.teamId === match.home.id).length;
  const awayVisible = visibleGoals.filter((item) => item.teamId === match.away.id).length;
  const userVisible = visibleGoals.filter((item) => item.teamId === userTeam.id).length;
  const rivalVisible = visibleGoals.filter((item) => item.teamId === opponent.id).length;
  const matchStats = useMemo(
    () => matchSummary(visibleEvents, userTeam, opponent),
    [opponent, userTeam, visibleEvents],
  );
  const finalHome = result.homeScore + result.homeExtra;
  const finalAway = result.awayScore + result.awayExtra;
  const currentKick = kicks[kickStep];
  const shownKicks = kicks.slice(0, Math.min(kickStep + (kickRevealed ? 1 : 0), kicks.length));
  const penaltyTally = shownKicks.length ? shownKicks[shownKicks.length - 1] : undefined;
  const status = clockDone
    ? result.wentToPenalties ? (inShootout ? "Pênaltis" : "Fim nos pênaltis") : result.wentToExtraTime ? "Fim na prorrogação" : "Fim de jogo"
    : minute > 90 ? "Prorrogação" : minute > 45 ? "Segundo tempo" : "Primeiro tempo";
  const showRatings = ratingsMode === "visible";
  const chosen = halftimeOptions.find((option) => option.id === result.instructions.halftime);
  const allGoals = result.events.filter((item) => item.type === "goal");
  // Fila invertida: o lance mais novo encabeça a lista e o mais antigo cai no fim.
  const timeline = visibleEvents.slice(-TIMELINE_ROWS).reverse();

  // O segundo tempo só começa depois da confirmação, e o intervalo não volta a abrir.
  const confirmHalftime = () => halftimePick && onInstruction({ ...result.instructions, halftime: halftimePick });
  const confirmMoment = () => momentPick && onInstruction({ ...result.instructions, moment: momentPick });
  const skip = () => { setPaused(false); setMinute(!result.instructions.halftime ? 45 : !result.instructions.moment ? 65 : maxMinute); };

  useEffect(() => {
    const gate = needsHalftime ? "halftime" : needsMoment ? "moment" : "";
    if (!multiplayerRules || !gate) {
      decisionExpired.current = "";
      return;
    }
    const maximum = gate === "moment" ? 10 : 15;
    const target = Date.now() + maximum * 1000;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((target - Date.now()) / 1000));
      setDecisionSeconds(remaining);
      if (remaining || decisionExpired.current === gate) return;
      decisionExpired.current = gate;
      window.clearInterval(timer);
      if (gate === "halftime") instructionCallback.current({ ...instructionsRef.current, halftime: halftimePickRef.current ?? "keep" });
      else instructionCallback.current({ ...instructionsRef.current, moment: momentPickRef.current ?? "calm" });
    }, 200);
    return () => window.clearInterval(timer);
  }, [multiplayerRules, needsHalftime, needsMoment]);
  const applyLiveLineup = (nextLineup: typeof liveLineup, nextBench: typeof liveBench) => {
    const nextIds = new Set(nextLineup.map((entry) => entry.playerId));
    const currentIds = new Set(liveLineup.map((entry) => entry.playerId));
    const outgoingEntry = liveLineup.find((entry) => !nextIds.has(entry.playerId));
    const incomingEntry = nextLineup.find((entry) => !currentIds.has(entry.playerId));
    const outgoing = outgoingEntry ? playersById.get(outgoingEntry.playerId) : undefined;
    const incoming = incomingEntry ? playersById.get(incomingEntry.playerId) : undefined;
    let substitution: MatchProgress["substitutions"][number] | undefined;
    if (outgoing && incoming) {
      if (liveSubstitutions.length >= 5) return;
      if (liveSubstitutions.some((item) => item.outPlayerId === incoming.id)) return;
      substitution = { outPlayerId: outgoing.id, inPlayerId: incoming.id, outName: outgoing.name, inName: incoming.name, minute };
      setLiveSubstitutions((current) => [...current, substitution!]);
    }
    setLiveLineup(nextLineup);
    setLiveBench(nextBench);
    onLineupChange(nextLineup, nextBench, substitution);
  };

  return (
    <main className="screen match-screen" id="main">
      {/* No intervalo o painel ocupa exatamente o espaço do placar: relógio, placar e
          controles saem de cena para a decisão ficar visível sem rolagem. */}
      {needsHalftime ? (
        <HalftimePanel round={roundLabels[match.round]} picked={halftimePick} seconds={decisionSeconds} onPick={setHalftimePick} onConfirm={confirmHalftime}/>
      ) : (
        <>
          <div className="match-stage"><span>{roundLabels[match.round]} · {status}</span><b>{clockDone ? "ENCERRADO" : `${minute}′`}</b><small>{match.home.stadium ?? "Casa do mandante"}</small></div>
          <section className={`scoreboard ${goalFlash ? "is-goal-flash" : ""}`} aria-live="polite">
            <div className="score-team">
              <span>{teamEra(match.home)}</span><h1>{match.home.name}</h1>
              <small>{showRatings ? `OVR ${match.home.overall.final} · ` : ""}{match.home.formation}</small>
            </div>
            <div className="score-numbers">
              <strong>{clockDone ? finalHome : homeVisible}</strong><i>×</i><strong>{clockDone ? finalAway : awayVisible}</strong>
              {penaltyTally && <span>PÊNALTIS {penaltyTally.homeScore} a {penaltyTally.awayScore}</span>}
            </div>
            <div className="score-team score-team--away">
              <span>{teamEra(match.away)}</span><h1>{match.away.name}</h1>
              <small>{showRatings ? `OVR ${match.away.overall.final} · ` : ""}{match.away.formation}</small>
            </div>
          </section>
          <div className="match-progress" aria-hidden="true">
            <span style={{ transform: `scaleX(${Math.min(1, minute / maxMinute)})` }}/>
            <i style={{ left: `${Math.min(100, (minute / maxMinute) * 100)}%` }}/>
          </div>
          {needsMoment && moment && (
            <MatchMomentPanel
              moment={moment}
              score={`${userVisible} × ${rivalVisible}`}
              picked={momentPick}
              seconds={decisionSeconds}
              onPick={setMomentPick}
              onConfirm={confirmMoment}
            />
          )}
          {finished && (
            <section className="match-finish-action" aria-label="Partida encerrada">
              <div>
                <span>Partida encerrada</span>
                <b>{result.winnerId === userTeam.id ? "Vitória confirmada" : "Resultado confirmado"}</b>
              </div>
              {autoFinishSeconds !== undefined && <span className="auto-advance-timer" role="timer" aria-label={`Chaveamento em ${autoFinishSeconds} segundos`}><b>{autoFinishSeconds}</b><small>chaveamento</small></span>}
              <button type="button" className="button button--primary" onClick={() => { if (autoFinishCompleted.current) return; autoFinishCompleted.current = true; onFinish(); }}>{autoFinishAt ? "Ir para a chave" : "Ver resultado"}<ArrowIcon/></button>
            </section>
          )}
          {!clockDone && !needsMoment && (
            <div className="match-controls">
              {playbackMode === "follower" ? <span className="match-sync-status">Partida sincronizada em ritmo normal</span> : multiplayerRules ? <span className="match-sync-status">Ritmo normal · controles compartilhados</span> : <>
              <button type="button" className="match-control" onClick={() => setPaused((value) => !value)} aria-pressed={paused}>
                {paused ? "▶ Retomar" : "❚❚ Pausar"}
              </button>
              <button type="button" className="match-control match-control--substitution" onClick={() => { setPaused(true); setSubstitutionOpen(true); }}>
                Banco e substituições <b>{liveSubstitutions.length}/5</b>
              </button>
              <div className="match-speeds" role="group" aria-label="Velocidade da simulação">
                <span>Velocidade</span>
                {speeds.map((speed, index) => (
                  <button type="button" key={speed.id} className={index === speedIndex ? "is-active" : ""} aria-pressed={index === speedIndex}
                    onClick={() => { setSpeedIndex(index); setPaused(false); }}>{speed.label}</button>
                ))}
              </div>
              <button type="button" className="match-control" onClick={skip}>
                {result.instructions.halftime ? "Avançar até o fim" : "Avançar até o intervalo"}
              </button>
              </>}
            </div>
          )}
        </>
      )}
      <div className={`match-content ${needsHalftime ? "is-break" : ""} ${finished ? "is-finished" : ""}`}>
        {substitutionOpen ? (
          <LiveSubstitutionBoard team={userTeam} lineup={liveLineup} bench={liveBench} used={liveSubstitutions.length}
            unavailablePlayerIds={liveSubstitutions.map((item) => item.outPlayerId)}
            onChange={applyLiveLineup} onClose={() => { setSubstitutionOpen(false); setPaused(false); }}/>
        ) : <>
        {/* Na disputa, a marca da cal substitui os últimos lances: mesma região, sem
            empilhar um painel embaixo do outro. */}
        {inShootout ? (
          <Shootout kicks={shownKicks} current={currentKick} revealed={kickRevealed} total={kicks.length} match={match} decided={concluded}/>
        ) : (
          <section className="timeline" aria-label="Últimos lances" aria-live="polite">
            <h2>Últimos lances</h2>
            <div className="timeline__rows">
              {timeline.map((item, index) => (
                <article key={item.id} className={`${item.type === "goal" ? item.teamId === userTeam.id ? "is-goal is-user-goal" : "is-goal is-rival-goal" : eventTone[item.type] ?? ""} ${index === timeline.length - 1 && timeline.length === TIMELINE_ROWS ? "is-fading" : ""}`}>
                  <time>{item.minute ? `${item.minute}′` : "0′"}</time>
                  <span role="img" className={`event-icon event-icon--${item.type} ${item.teamId === userTeam.id ? "is-user" : item.teamId ? "is-rival" : ""}`} aria-label={eventLabels[item.type]} title={eventLabels[item.type]}><EventGlyph type={item.type}/></span>
                  <div className="timeline__event-copy"><b>{item.description}</b>{item.type === "goal" && item.assistName && <small>Assistência: {item.assistName}</small>}</div>
                  {item.teamId && <small>{item.teamId === match.home.id ? match.home.name : match.away.name}</small>}
                </article>
              ))}
            </div>
          </section>
        )}
        <aside className="match-side">
          <div className={`post-match ${finished ? "is-visible" : ""}`}>
            {finished ? (
              <>
                <span>LEITURA PÓS-JOGO</span>
                <div className="result-compact"><b>{finalHome} × {finalAway}</b>{showRatings && <small>OVR {match.home.overall.final} × {match.away.overall.final}</small>}</div>
                <p>{result.summary}</p>
                {result.wentToPenalties && <PenaltySummary kicks={kicks} match={match}/>}
                <GoalSheet goals={allGoals} match={match}/>
                {result.instructionImpact && <p className="instruction-impact">{result.instructionImpact}</p>}
                <dl>
                  <div><dt>Melhor em campo</dt><dd>{result.playerOfMatch}</dd></div>
                  <div><dt>Decisão</dt><dd>{result.wentToPenalties ? "Pênaltis" : result.wentToExtraTime ? "Prorrogação" : "90 minutos"}</dd></div>
                </dl>
              </>
            ) : (
              <>
                <span>EM CAMPO</span>
                <dl className="post-match__live">
                  <div><dt>Adversário</dt><dd>{opponent.name} {teamEra(opponent)}</dd></div>
                  <div><dt>Orientação</dt><dd>{chosen ? chosen.label : "No intervalo"}</dd></div>
                  <div><dt>Ritmo</dt><dd>{playbackMode === "follower" ? "Normal" : paused ? "Pausado" : speeds[speedIndex].label}</dd></div>
                </dl>
              </>
            )}
          </div>
        </aside>
        {finished && <RivalSquadDisclosure rival={rivalRosterFromTeam(opponent)} className="rival-roster--match"/>}
        {!finished && !needsHalftime && (
          <details className="boxscore-collapse" open={boxOpen} onToggle={(event) => setBoxOpen(event.currentTarget.open)}>
            <summary>Resumo da partida</summary>
            <BoxScore
              goals={visibleGoals}
              userTeamId={userTeam.id}
              stats={matchStats}
            />
          </details>
        )}
        </>}
      </div>
    </main>
  );
}

/**
 * Intervalo: ocupa o lugar do placar, exige uma escolha e só então devolve o jogo. O botão
 * de seguir mora aqui dentro, para a decisão inteira caber num campo de visão só.
 */
function HalftimePanel({ round, picked, seconds, onPick, onConfirm }: {
  round: string;
  picked?: HalftimeInstruction;
  seconds?: number;
  onPick: (choice: HalftimeInstruction) => void;
  onConfirm: () => void;
}) {
  return (
    <section className="halftime" role="group" aria-label="Decisão do intervalo">
      <header>
        <span>{round} · INTERVALO</span>
        <h2>Como o time volta?</h2>
        <p>A partida está parada. Escolha a postura para o segundo tempo.</p>
        {seconds !== undefined && <b className="decision-quick-timer" role="timer">{seconds}s</b>}
      </header>
      <div className="halftime__options">
        {halftimeOptions.map((option) => (
          <button type="button" key={option.id} className={picked === option.id ? "is-picked" : ""}
            aria-pressed={picked === option.id} onClick={() => onPick(option.id)}>
            <b>{option.label}</b><small>{option.detail}</small>
          </button>
        ))}
      </div>
      <button type="button" className="button button--primary button--wide" disabled={!picked} onClick={onConfirm}>
        {picked ? "Começar o segundo tempo" : "Escolha uma postura"}<ArrowIcon/>
      </button>
    </section>
  );
}

/** Decisão única da reta final: mantém placar e contexto na tela, sem modal ou camada. */
function MatchMomentPanel({ moment, score, picked, seconds, onPick, onConfirm }: {
  moment: (typeof matchMoments)[keyof typeof matchMoments];
  score: string;
  picked?: MatchMomentInstruction;
  seconds?: number;
  onPick: (choice: MatchMomentInstruction) => void;
  onConfirm: () => void;
}) {
  return (
    <section className="match-moment" aria-label="Decisão aos 65 minutos">
      <header>
        <span>65′ · decisão de jogo</span>
        <h2>{moment.question}</h2>
        <p><b>Placar: {score}.</b> {moment.detail}</p>
        {seconds !== undefined && <b className="decision-quick-timer" role="timer">{seconds}s</b>}
      </header>
      <div className="match-moment__options" role="group" aria-label={moment.question}>
        {moment.choices.map((choice) => (
          <button type="button" key={choice.id} className={picked === choice.id ? "is-picked" : ""}
            aria-pressed={picked === choice.id} onClick={() => onPick(choice.id)}>
            <b>{choice.label}</b><small>{choice.detail}</small>
          </button>
        ))}
      </div>
      <button type="button" className="button button--primary" disabled={!picked} onClick={onConfirm}>
        {picked ? "Confirmar decisão" : "Escolha uma resposta"}<ArrowIcon/>
      </button>
    </section>
  );
}

/** A mesa abre dentro do fluxo da partida, com o relógio pausado e sem cobrir o placar. */
function LiveSubstitutionBoard({ team, lineup, bench, used, unavailablePlayerIds, onChange, onClose }: {
  team: TeamSnapshot;
  lineup: LineupEntry[];
  bench: SquadPlayerEntry[];
  used: number;
  unavailablePlayerIds: string[];
  onChange: (lineup: LineupEntry[], bench: SquadPlayerEntry[]) => void;
  onClose: () => void;
}) {
  return (
    <section className="live-substitution-board" aria-label="Banco e substituições">
      <header>
        <div><span>Jogo pausado</span><h2>Faça a substituição.</h2><p>Toque num titular e escolha no banco quem entra. A partida só recomeça quando você confirmar.</p></div>
        <aside><b>{used}/5 usadas</b><button type="button" className="button button--primary" onClick={onClose}>Retomar jogo<ArrowIcon/></button></aside>
      </header>
      <TacticalEditor formationId={team.formation} tactic={team.tactic} lineup={lineup} bench={bench} compact
        unavailablePlayerIds={unavailablePlayerIds} unavailableLabel="Já saiu" onChange={onChange}/>
    </section>
  );
}

/** Ícones geométricos próprios: a leitura vem antes do texto, sem recorrer a emoji. */
function EventGlyph({ type }: { type: MatchEventType }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const ball = <><circle cx="12" cy="12" r="8" {...common}/><path d="m12 8 3 2.2-1.2 3.5h-3.6L9 10.2 12 8Zm0-4v4m-7.6 1.4L9 10.2m-2.7 7.6 3.9-4.1m7.5 4.1-3.9-4.1m5.8-4.3L15 10.2" {...common}/></>;
  if (type === "goal") return <svg viewBox="0 0 24 24" aria-hidden="true">{ball}</svg>;
  if (type === "offside" || type === "corner") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V3m0 2h11l-3 4 3 4H6" {...common}/></svg>;
  if (type === "dangerous_foul") return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="3" width="10" height="18" rx="1.5" {...common} fill="currentColor" fillOpacity=".12"/><path d="M12 7v6m0 4h.01" {...common}/></svg>;
  if (type === "yellow_card" || type === "red_card") return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="3" width="10" height="18" rx="1.5" fill={type === "yellow_card" ? "#f5c542" : "#e49a80"} stroke="currentColor" strokeWidth="1.3"/></svg>;
  if (type === "shot_saved" || type === "big_save") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 12V8.5a1.4 1.4 0 0 1 2.8 0V11 6.8a1.4 1.4 0 0 1 2.8 0V11 7.8a1.4 1.4 0 0 1 2.8 0V12 10a1.4 1.4 0 0 1 2.8 0v4.2c0 4-2.4 6.3-6.3 6.3h-.8c-3.5 0-5.9-2.5-5.9-5.8v-2.2c0-1 .8-1.8 1.8-1.8Z" {...common}/></svg>;
  if (type === "penalty") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 20V7h17v13M7 7V4h10v3" {...common}/><circle cx="12" cy="15.5" r="2" {...common}/></svg>;
  if (type === "shot_off") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="7" cy="17" r="3" {...common}/><path d="m10 14 8-8m-4 0h4v4" {...common}/></svg>;
  if (type === "pressure") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 17 7-7 7 7M5 11l7-7 7 7" {...common}/></svg>;
  if (type === "possession") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" {...common}/><path d="M5.2 9A7.3 7.3 0 0 1 17 5.8L19 8M18.8 15A7.3 7.3 0 0 1 7 18.2L5 16" {...common}/></svg>;
  if (type === "substitution") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h14m-4-4 4 4-4 4M20 16H6m4 4-4-4 4-4" {...common}/></svg>;
  if (type === "decision") return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4" width="12" height="17" rx="2" {...common}/><path d="M9 4V2h6v2M9 9h6m-6 4h6m-6 4h4" {...common}/></svg>;
  if (type === "kickoff") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" {...common}/><path d="m10 8 6 4-6 4Z" fill="currentColor" stroke="none"/></svg>;
  if (type === "halftime") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" {...common}/><path d="M9.5 8v8m5-8v8" {...common}/></svg>;
  if (type === "full_time") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V3m0 2h11v8H6m5-8v8m6-4H6" {...common}/></svg>;
  if (type === "second_half" || type === "extra_time") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" {...common}/><path d="M12 7v5l3.5 2M5 4l2 2m10-2-2 2" {...common}/></svg>;
  if (type === "shootout") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 20V7h17v13M7 7V4h10v3" {...common}/><circle cx="12" cy="16" r="2.2" fill="currentColor"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" {...common}/><path d="M12 7v5l3.5 2" {...common}/></svg>;
}

/** A disputa ocupa a timeline. O cobrador entra na sua coluna antes do resultado. */
function Shootout({ kicks, current, revealed, total, match, decided }: {
  kicks: PenaltyKick[];
  current?: PenaltyKick;
  revealed: boolean;
  total: number;
  match: BracketMatch;
  decided: boolean;
}) {
  const scoreKick = kicks.at(-1);
  const userSide = match.home.isUser ? "home" : "away";
  const columns = (["home", "away"] as const).map((side) => ({
    side,
    team: side === "home" ? match.home : match.away,
    kicks: kicks.filter((kick) => kick.side === side),
  }));

  return (
    <section className="shootout" aria-label="Disputa de pênaltis" aria-live="polite">
      <h2>Disputa de pênaltis</h2>
      <div className="shootout__body">
        <div className="shootout__scoreline">
          <b>{scoreKick ? scoreKick.homeScore : 0}</b><i>a</i><b>{scoreKick ? scoreKick.awayScore : 0}</b>
        </div>
        <p className="shootout__now">
          {decided
            ? <strong>Disputa encerrada.</strong>
            : current
              ? <><strong>{current.taker}</strong> {revealed ? current.scored ? "converteu" : "parou no goleiro" : "se prepara para bater"}</>
              : "As equipes vão para a marca da cal."}
        </p>
        <div className="shootout__grid">
          {columns.map(({ side, team, kicks: sideKicks }) => (
            <ol key={side} className={`shootout__column ${side === userSide ? "is-user" : ""}`} aria-label={`Cobranças de ${team.name}`}>
              <li className="shootout__team"><b>{team.name}</b></li>
              {sideKicks.map((kick) => (
                <li key={kick.order}
                  className={`${kick.scored ? "is-scored" : "is-missed"} ${kick.order === scoreKick?.order ? "is-latest" : ""} ${kick.suddenDeath ? "is-sudden" : ""}`}>
                  <i aria-hidden="true"/>
                  <b>{kick.taker}</b>
                  <em>{kick.homeScore}–{kick.awayScore}</em>
                </li>
              ))}
              {current && !revealed && current.side === side && (
                <li className="is-pending" aria-label={`${current.taker} se prepara para bater`}>
                  <i aria-hidden="true"/>
                  <b>{current.taker}</b>
                  <em>na marca</em>
                </li>
              )}
              {!sideKicks.length && !(current && !revealed && current.side === side) && <li className="shootout__waiting"><b>Aguardando</b></li>}
            </ol>
          ))}
        </div>
        <small className="shootout__count">
          {decided ? `${kicks.length} cobranças até a decisão` : `${kicks.length} de ${total} cobranças`}
        </small>
      </div>
    </section>
  );
}

function PenaltySummary({ kicks, match }: { kicks: PenaltyKick[]; match: BracketMatch }) {
  const line = (side: "home" | "away") => kicks.filter((kick) => kick.side === side).map((kick) => kick.scored ? "●" : "○").join(" ");
  return (
    <div className="penalty-summary">
      <span>Pênaltis</span>
      <div><b>{match.home.name}</b><i>{line("home")}</i></div>
      <div><b>{match.away.name}</b><i>{line("away")}</i></div>
    </div>
  );
}

function GoalSheet({ goals, match }: { goals: MatchEvent[]; match: BracketMatch }) {
  if (!goals.length) return <p className="goal-sheet__empty">Sem gols no tempo de jogo.</p>;
  return (
    <div className="goal-sheet">
      <span>Gols</span>
      <ul>
        {goals.map((goal) => (
          <li key={goal.id} className={goal.teamId === match.home.id ? "is-home" : "is-away"}>
            <time>{goal.minute}′</time>
            <b>{goal.playerName}</b>
            <small>{goal.teamId === match.home.id ? match.home.name : match.away.name}{goal.assistName ? ` · Assistência: ${goal.assistName}` : ""}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

type MatchSummary = {
  possession: [number, number];
  shots: [number, number];
  onTarget: [number, number];
  corners: [number, number];
};

/**
 * O motor não guarda uma planilha paralela de estatísticas. O resumo usa somente os
 * lances já gerados. Posse combina ações de controle e ataque, enquanto finalizações,
 * chutes no alvo e escanteios vêm diretamente dos respectivos lances da partida.
 */
function matchSummary(events: MatchEvent[], userTeam: TeamSnapshot, rivalTeam: TeamSnapshot): MatchSummary {
  const userTeamId = userTeam.id;
  const rivalTeamId = rivalTeam.id;
  const midfieldEdge = Math.max(-12, Math.min(12, userTeam.overall.midfield - rivalTeam.overall.midfield));
  const baseShare = Math.max(42, Math.min(58, 50 + midfieldEdge * 0.55));
  const priorWeight = 8;
  const values = { user: priorWeight * baseShare / 100, rival: priorWeight * (100 - baseShare) / 100 };
  const add = (teamId: string | undefined, weight = 1) => {
    if (teamId === userTeamId) values.user += weight;
    if (teamId === rivalTeamId) values.rival += weight;
  };
  const attackingTeam = (event: MatchEvent) => event.type === "big_save"
    ? event.teamId === userTeamId ? rivalTeamId : userTeamId
    : event.teamId;
  const controlEvents = events.filter((event) => ["possession", "pressure", "corner", "offside", "shot_off", "shot_saved", "big_save", "penalty", "goal"].includes(event.type));
  for (const event of controlEvents) add(attackingTeam(event), event.type === "possession" ? 2 : 1);
  const possessionTotal = values.user + values.rival;
  const userPossession = Math.round(values.user / possessionTotal * 100);
  const possession: [number, number] = [userPossession, 100 - userPossession];

  const shots = { user: 0, rival: 0 };
  const onTarget = { user: 0, rival: 0 };
  const corners = { user: 0, rival: 0 };
  const attacks = events.filter((event) => ["pressure", "corner", "offside", "shot_off", "shot_saved", "big_save", "penalty", "goal"].includes(event.type));
  for (const event of attacks) {
    const side = attackingTeam(event) === userTeamId ? "user" : attackingTeam(event) === rivalTeamId ? "rival" : undefined;
    if (!side) continue;
    if (["shot_off", "shot_saved", "big_save", "goal"].includes(event.type)) shots[side] += 1;
    if (["shot_saved", "big_save", "goal"].includes(event.type)) onTarget[side] += 1;
    if (event.type === "corner") corners[side] += 1;
  }
  return { possession, shots: [shots.user, shots.rival], onTarget: [onTarget.user, onTarget.rival], corners: [corners.user, corners.rival] };
}

function BoxScore({ goals, userTeamId, stats }: {
  goals: MatchEvent[];
  userTeamId: string;
  stats: MatchSummary;
}) {
  return (
    <section className="boxscore-card" aria-label="Resumo da partida">
      <div className="match-boxscore__goals">
        <span>Gols</span>
        {goals.length ? (
          <ul>
            {goals.map((goal) => (
              <li key={goal.id} className={goal.teamId === userTeamId ? "is-user" : "is-rival"}>
                <i aria-hidden="true"/><div><b>{goal.playerName}</b>{goal.assistName && <small>Assistência: {goal.assistName}</small>}</div><time>{goal.minute}′</time>
              </li>
            ))}
          </ul>
        ) : <p>Sem gols até agora.</p>}
      </div>
      <div className="match-boxscore__stats">
        <span>Você <i>×</i> rival</span>
        <dl>
          <Stat label="Posse" values={stats.possession} suffix="%" hint="Calculada pelas ações de controle e ataque da partida."/>
          <Stat label="Finalizações" values={stats.shots}/>
          <Stat label="No alvo" values={stats.onTarget}/>
          <Stat label="Escanteios" values={stats.corners}/>
        </dl>
      </div>
    </section>
  );
}

function Stat({ label, values, suffix = "", hint }: { label: string; values: [number | null, number | null]; suffix?: string; hint?: string }) {
  return <div title={hint}>
    <dt>{label}</dt>
    <dd><b>{values[0] ?? "—"}{values[0] === null ? "" : suffix}</b><i>×</i><b>{values[1] ?? "—"}{values[1] === null ? "" : suffix}</b></dd>
  </div>;
}


import type {
  BracketMatch,
  HalftimeInstruction,
  MatchMomentInstruction,
  MatchEvent,
  MatchEventType,
  MatchInstructions,
  MatchResult,
  MatchSubstitution,
  PenaltyKick,
  RatingsMode,
  TeamSnapshot,
} from "@/types/game";
import { useEffect, useMemo, useState } from "react";
import { ArrowIcon } from "@/components/ui/Icons";
import { roundLabels, teamEra } from "@/lib/bracket";
import { RivalSquadDisclosure } from "@/components/game/RivalSquadDisclosure";
import { rivalRosterFromTeam } from "@/lib/rival-roster";
import { matchMoments } from "@/data/match-moments";

const eventCodes: Record<MatchEventType, string> = {
  kickoff: "INI", pressure: "PRE", possession: "POS", shot_off: "FOR", shot_saved: "DEF", big_save: "DEF",
  corner: "ESC", dangerous_foul: "FAL", offside: "IMP", yellow_card: "AMA", red_card: "VER", penalty: "PEN",
  goal: "GOL", substitution: "TRO", decision: "DEC", halftime: "INT", second_half: "2T", extra_time: "PRO", shootout: "PEN", full_time: "FIM",
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
  ratingsMode,
  onInstruction,
  onFinish,
}: {
  match: BracketMatch;
  result: MatchResult;
  ratingsMode: RatingsMode;
  onInstruction: (instructions: MatchInstructions) => void;
  onFinish: () => void;
}) {
  const maxMinute = result.wentToExtraTime ? 122 : 90;
  const kicks = useMemo(() => result.penaltyKicks ?? [], [result.penaltyKicks]);
  const [minute, setMinute] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  /** Postura escolhida no intervalo, ainda não confirmada. */
  const [halftimePick, setHalftimePick] = useState<HalftimeInstruction>();
  const [halftimeSubs, setHalftimeSubs] = useState<MatchSubstitution[]>(() => result.instructions.substitutions?.filter((item) => item.at === 45) ?? []);
  const [momentPick, setMomentPick] = useState<MatchMomentInstruction>();
  /** Passo da disputa: a cobrança anuncia o nome antes de revelar o resultado. */
  const [kickStep, setKickStep] = useState(0);
  const [kickRevealed, setKickRevealed] = useState(false);
  const [shootoutComplete, setShootoutComplete] = useState(false);
  const [goalFlash, setGoalFlash] = useState(false);
  const [boxOpen, setBoxOpen] = useState(true);
  const userTeam = match.home.isUser ? match.home : match.away;
  const opponent = match.home.isUser ? match.away : match.home;
  const needsHalftime = minute >= 45 && !result.instructions.halftime;
  const moment = result.matchMoment ? matchMoments[result.matchMoment] : undefined;
  const needsMoment = minute >= 65 && !result.instructions.moment && Boolean(moment);
  const clockDone = minute >= maxMinute;
  /** A disputa segue no ar até um passo além da última cobrança, para a conclusão ser lida. */
  const inShootout = clockDone && result.wentToPenalties && !shootoutComplete;
  const concluded = kickStep >= kicks.length;
  const finished = clockDone && !inShootout;
  const running = !needsHalftime && !needsMoment && !paused && !clockDone;

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
    if (!inShootout) return;
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
  }, [inShootout, kickRevealed, kickStep, kicks.length]);

  const visibleEvents = useMemo(() => result.events.filter((item) => item.minute <= minute), [minute, result.events]);
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
    () => matchSummary(visibleEvents, userTeam.id, opponent.id),
    [opponent.id, userTeam.id, visibleEvents],
  );
  const finalHome = result.homeScore + result.homeExtra;
  const finalAway = result.awayScore + result.awayExtra;
  const currentKick = kicks[kickStep];
  const shownKicks = kicks.slice(0, Math.min(kickStep + (kickRevealed ? 1 : 0), kicks.length));
  const penaltyTally = shownKicks.length ? shownKicks[shownKicks.length - 1] : undefined;
  const status = clockDone
    ? result.wentToPenalties ? (inShootout ? "Pênaltis" : "Fim nos pênaltis") : result.wentToExtraTime ? "Fim na prorrogação" : "Fim de jogo"
    : minute > 90 ? "Prorrogação" : minute > 45 ? "Segundo tempo" : "Primeiro tempo";
  const revealOpponent = ratingsMode === "visible" || clockDone;
  const chosen = halftimeOptions.find((option) => option.id === result.instructions.halftime);
  const allGoals = result.events.filter((item) => item.type === "goal");
  // Fila invertida: o lance mais novo encabeça a lista e o mais antigo cai no fim.
  const timeline = visibleEvents.slice(-TIMELINE_ROWS).reverse();

  // O segundo tempo só começa depois da confirmação, e o intervalo não volta a abrir.
  const confirmHalftime = () => halftimePick && onInstruction({ ...result.instructions, halftime: halftimePick, substitutions: halftimeSubs });
  const confirmMoment = () => momentPick && onInstruction({ ...result.instructions, moment: momentPick });
  const skip = () => { setPaused(false); setMinute(!result.instructions.halftime ? 45 : !result.instructions.moment ? 65 : maxMinute); };

  return (
    <main className="screen match-screen" id="main">
      {/* No intervalo o painel ocupa exatamente o espaço do placar: relógio, placar e
          controles saem de cena para a decisão ficar visível sem rolagem. */}
      {needsHalftime ? (
        <HalftimePanel round={roundLabels[match.round]} team={userTeam} substitutions={halftimeSubs} onSubstitutionsChange={setHalftimeSubs} picked={halftimePick} onPick={setHalftimePick} onConfirm={confirmHalftime}/>
      ) : (
        <>
          <div className="match-stage"><span>{roundLabels[match.round]} · {status}</span><b>{clockDone ? "ENCERRADO" : `${minute}′`}</b><small>{match.home.stadium ?? "Casa do mandante"}</small></div>
          <section className={`scoreboard ${goalFlash ? "is-goal-flash" : ""}`} aria-live="polite">
            <div className="score-team">
              <span>{teamEra(match.home)}</span><h1>{match.home.name}</h1>
              <small>{match.home.isUser || revealOpponent ? `OVR ${match.home.overall.final} · ` : ""}{match.home.formation}</small>
            </div>
            <div className="score-numbers">
              <strong>{clockDone ? finalHome : homeVisible}</strong><i>×</i><strong>{clockDone ? finalAway : awayVisible}</strong>
              {penaltyTally && <span>PÊNALTIS {penaltyTally.homeScore} a {penaltyTally.awayScore}</span>}
            </div>
            <div className="score-team score-team--away">
              <span>{teamEra(match.away)}</span><h1>{match.away.name}</h1>
              <small>{match.away.isUser || revealOpponent ? `OVR ${match.away.overall.final} · ` : ""}{match.away.formation}</small>
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
              <button type="button" className="button button--primary" onClick={onFinish}>Ver resultado<ArrowIcon/></button>
            </section>
          )}
          {!clockDone && !needsMoment && (
            <div className="match-controls">
              <button type="button" className="match-control" onClick={() => setPaused((value) => !value)} aria-pressed={paused}>
                {paused ? "▶ Retomar" : "❚❚ Pausar"}
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
            </div>
          )}
        </>
      )}
      <div className={`match-content ${needsHalftime ? "is-break" : ""}`}>
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
                  <span className={item.teamId === userTeam.id ? "is-user" : item.teamId ? "is-rival" : ""}><EventGlyph type={item.type}/><em>{eventCodes[item.type]}</em></span>
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
                <div className="result-compact"><b>{finalHome} × {finalAway}</b><small>OVR {match.home.overall.final} × {match.away.overall.final}</small></div>
                <p>{result.summary}</p>
                {result.wentToPenalties && <PenaltySummary kicks={kicks} match={match}/>}
                <GoalSheet goals={allGoals} match={match}/>
                {result.instructionImpact && <p className="instruction-impact">{result.instructionImpact}</p>}
                <dl>
                  <div><dt>Melhor em campo</dt><dd>{result.playerOfMatch}</dd></div>
                  <div><dt>Decisão</dt><dd>{result.wentToPenalties ? "Pênaltis" : result.wentToExtraTime ? "Prorrogação" : "90 minutos"}</dd></div>
                </dl>
                <RivalSquadDisclosure rival={rivalRosterFromTeam(opponent)} className="rival-roster--match"/>
              </>
            ) : (
              <>
                <span>EM CAMPO</span>
                <dl className="post-match__live">
                  <div><dt>Adversário</dt><dd>{opponent.name} {teamEra(opponent)}</dd></div>
                  <div><dt>Orientação</dt><dd>{chosen ? chosen.label : "No intervalo"}</dd></div>
                  <div><dt>Ritmo</dt><dd>{paused ? "Pausado" : speeds[speedIndex].label}</dd></div>
                </dl>
              </>
            )}
          </div>
        </aside>
        {!finished && !needsHalftime && (
          <details className="boxscore-collapse" open={boxOpen} onToggle={(event) => setBoxOpen(event.currentTarget.open)}>
            <summary>Resumo da partida</summary>
            <BoxScore
              minute={minute}
              status={status}
              userScore={userVisible}
              rivalScore={rivalVisible}
              goals={visibleGoals}
              userTeamId={userTeam.id}
              stats={matchStats}
            />
          </details>
        )}
      </div>
    </main>
  );
}

/**
 * Intervalo: ocupa o lugar do placar, exige uma escolha e só então devolve o jogo. O botão
 * de seguir mora aqui dentro, para a decisão inteira caber num campo de visão só.
 */
function HalftimePanel({ round, team, substitutions, onSubstitutionsChange, picked, onPick, onConfirm }: {
  round: string;
  team: TeamSnapshot;
  substitutions: MatchSubstitution[];
  onSubstitutionsChange: (value: MatchSubstitution[]) => void;
  picked?: HalftimeInstruction;
  onPick: (choice: HalftimeInstruction) => void;
  onConfirm: () => void;
}) {
  return (
    <section className="halftime" role="group" aria-label="Decisão do intervalo">
      <header>
        <span>{round} · INTERVALO</span>
        <h2>Como o time volta?</h2>
        <p>A partida está parada. Escolha a postura para o segundo tempo.</p>
      </header>
      <div className="halftime__options">
        {halftimeOptions.map((option) => (
          <button type="button" key={option.id} className={picked === option.id ? "is-picked" : ""}
            aria-pressed={picked === option.id} onClick={() => onPick(option.id)}>
            <b>{option.label}</b><small>{option.detail}</small>
          </button>
        ))}
      </div>
      <SubstitutionPicker team={team} substitutions={substitutions} onChange={onSubstitutionsChange}/>
      <button type="button" className="button button--primary button--wide" disabled={!picked} onClick={onConfirm}>
        {picked ? "Começar o segundo tempo" : "Escolha uma postura"}<ArrowIcon/>
      </button>
    </section>
  );
}

/** Decisão única da reta final: mantém placar e contexto na tela, sem modal ou camada. */
function MatchMomentPanel({ moment, score, picked, onPick, onConfirm }: {
  moment: (typeof matchMoments)[keyof typeof matchMoments];
  score: string;
  picked?: MatchMomentInstruction;
  onPick: (choice: MatchMomentInstruction) => void;
  onConfirm: () => void;
}) {
  return (
    <section className="match-moment" aria-label="Decisão aos 65 minutos">
      <header>
        <span>65′ · decisão de jogo</span>
        <h2>{moment.question}</h2>
        <p><b>Placar: {score}.</b> {moment.detail}</p>
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

function SubstitutionPicker({ team, substitutions, onChange }: {
  team: TeamSnapshot;
  substitutions: MatchSubstitution[];
  onChange: (value: MatchSubstitution[]) => void;
}) {
  const [outPlayerId, setOutPlayerId] = useState("");
  const [inPlayerId, setInPlayerId] = useState("");
  const alreadyOut = new Set(substitutions.map((item) => item.outPlayerId));
  const alreadyIn = new Set(substitutions.map((item) => item.inPlayerId));
  const availableOut = team.lineup.filter((player) => !alreadyOut.has(player.id));
  const availableIn = (team.bench ?? []).filter((player) => !alreadyIn.has(player.id));
  const add = () => {
    if (!outPlayerId || !inPlayerId || substitutions.length >= 5) return;
    onChange([...substitutions, { at: 45, outPlayerId, inPlayerId }]);
    setOutPlayerId("");
    setInPlayerId("");
  };
  return (
    <details className="halftime-subs">
      <summary>Substituições <span>{substitutions.length}/5</span></summary>
      <div className="halftime-subs__picker">
        <label>Quem sai<select value={outPlayerId} onChange={(event) => setOutPlayerId(event.target.value)}><option value="">Escolha o titular</option>{availableOut.map((player) => <option key={player.id} value={player.id}>{player.name} · {player.primaryPosition} · {player.overall}</option>)}</select></label>
        <label>Quem entra<select value={inPlayerId} onChange={(event) => setInPlayerId(event.target.value)}><option value="">Escolha o reserva</option>{availableIn.map((player) => <option key={player.id} value={player.id}>{player.name} · {player.primaryPosition} · {player.overall}</option>)}</select></label>
        <button type="button" className="button button--quiet" disabled={!outPlayerId || !inPlayerId || substitutions.length >= 5} onClick={add}>Adicionar troca</button>
      </div>
      {substitutions.length > 0 && <ul>{substitutions.map((item) => <li key={`${item.outPlayerId}-${item.inPlayerId}`}><span>{team.lineup.find((player) => player.id === item.outPlayerId)?.name} sai</span><b>{team.bench?.find((player) => player.id === item.inPlayerId)?.name} entra</b><button type="button" aria-label="Remover substituição" onClick={() => onChange(substitutions.filter((entry) => entry !== item))}>×</button></li>)}</ul>}
    </details>
  );
}

/** Ícones geométricos próprios: a leitura vem antes do texto, sem recorrer a emoji. */
function EventGlyph({ type }: { type: MatchEventType }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (type === "goal") return <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.8" {...common}/><path d="m7.2 7.8 2.8-1.5 2.8 1.5-.4 3.1-2.4 1.5-2.4-1.5-.4-3.1Z" {...common}/></svg>;
  if (type === "offside" || type === "corner") return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 17V3m0 1h8l-2.2 3L13 10H5" {...common}/></svg>;
  if (type === "dangerous_foul") return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 5.5 5.5 10h3l.8 4.5L14.5 10h-3l-1-4.5Z" {...common}/></svg>;
  if (type === "yellow_card" || type === "red_card") return <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="6.5" y="3.5" width="7" height="13" rx="1" fill={type === "yellow_card" ? "#d7c38e" : "#e49a80"} stroke="currentColor" strokeWidth="1.2"/></svg>;
  if (type === "shot_saved" || type === "big_save") return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 16V9l1.7-4 1.2 3.2L10 4l1.1 4.2 1.4-3.1L14 9v7" {...common}/><path d="M6 11h8" {...common}/></svg>;
  if (type === "penalty") return <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6" {...common}/><circle cx="10" cy="10" r="1" fill="currentColor"/></svg>;
  if (type === "shot_off" || type === "pressure") return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 15 11-11M9 4h6v6" {...common}/></svg>;
  if (type === "possession") return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11m-3-3 3 3-3 3" {...common}/></svg>;
  if (type === "substitution") return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 7h10m-3-3 3 3-3 3M16 13H6m3 3-3-3 3-3" {...common}/></svg>;
  if (type === "decision") return <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="4" y="5" width="12" height="11" rx="1" {...common}/><path d="M7 3v4m6-4v4m-6 3h6m-6 3h4" {...common}/></svg>;
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v14M6 7h8M6 13h8" {...common}/></svg>;
}

/**
 * Disputa de pênaltis no lugar da timeline. Cada lado tem a sua coluna e toda cobrança
 * fica à vista de uma vez: nada de rolagem interna, porque o placar da série só se lê
 * inteiro. A última batida acende por um instante para o olho achar onde parou.
 */
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
              {!sideKicks.length && <li className="shootout__waiting"><b>Aguardando</b></li>}
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
  possession: [number | null, number | null];
  shots: [number, number];
  onTarget: [number, number];
  momentum: [number, number];
};

/**
 * O motor não guarda uma planilha paralela de estatísticas. O resumo usa somente os
 * lances já gerados: ações de posse para controle, finalizações para chutes e os seis
 * ataques mais recentes para o momento. Assim não há números decorativos na interface.
 */
function matchSummary(events: MatchEvent[], userTeamId: string, rivalTeamId: string): MatchSummary {
  const values = { user: 0, rival: 0 };
  const add = (teamId: string | undefined) => {
    if (teamId === userTeamId) values.user += 1;
    if (teamId === rivalTeamId) values.rival += 1;
  };
  const attackingTeam = (event: MatchEvent) => event.type === "big_save"
    ? event.teamId === userTeamId ? rivalTeamId : userTeamId
    : event.teamId;
  const possessionEvents = events.filter((event) => event.type === "possession");
  for (const event of possessionEvents) add(event.teamId);
  const possessionTotal = values.user + values.rival;
  const possession: [number | null, number | null] = possessionTotal >= 3
    ? [Math.round(values.user / possessionTotal * 100), Math.round(values.rival / possessionTotal * 100)]
    : [null, null];

  const shots = { user: 0, rival: 0 };
  const onTarget = { user: 0, rival: 0 };
  const attacks = events.filter((event) => ["pressure", "corner", "offside", "shot_off", "shot_saved", "big_save", "penalty", "goal"].includes(event.type));
  for (const event of attacks) {
    const side = attackingTeam(event) === userTeamId ? "user" : attackingTeam(event) === rivalTeamId ? "rival" : undefined;
    if (!side) continue;
    if (["shot_off", "shot_saved", "big_save", "goal"].includes(event.type)) shots[side] += 1;
    if (["shot_saved", "big_save", "goal"].includes(event.type)) onTarget[side] += 1;
  }
  const lastAttacks = attacks.slice(-6);
  const momentum: [number, number] = [
    lastAttacks.filter((event) => attackingTeam(event) === userTeamId).length,
    lastAttacks.filter((event) => attackingTeam(event) === rivalTeamId).length,
  ];
  return { possession, shots: [shots.user, shots.rival], onTarget: [onTarget.user, onTarget.rival], momentum };
}

function BoxScore({ minute, status, userScore, rivalScore, goals, userTeamId, stats }: {
  minute: number;
  status: string;
  userScore: number;
  rivalScore: number;
  goals: MatchEvent[];
  userTeamId: string;
  stats: MatchSummary;
}) {
  return (
    <section className="boxscore-card" aria-label="Resumo da partida">
      <header className="match-boxscore__score">
        <span>Placar</span>
        <strong>{userScore}<i>×</i>{rivalScore}</strong>
        <small>{minute}′ · {status}</small>
      </header>
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
          <Stat label="Posse" values={stats.possession} suffix="%" hint="A posse é calculada a partir dos lances de posse já gerados."/>
          <Stat label="Finalizações" values={stats.shots}/>
          <Stat label="No alvo" values={stats.onTarget}/>
          <Stat label="Momento" values={stats.momentum} hint="Ataques nos seis últimos lances relevantes."/>
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


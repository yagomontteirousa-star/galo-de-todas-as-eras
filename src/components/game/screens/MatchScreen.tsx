import type {
  BracketMatch,
  HalftimeInstruction,
  MatchEventType,
  MatchInstructions,
  MatchResult,
  RatingsMode,
} from "@/types/game";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowIcon } from "@/components/ui/Icons";
import { roundLabels } from "@/lib/bracket";

const eventCodes: Record<MatchEventType, string> = {
  kickoff: "INI",
  pressure: "PRE",
  possession: "POS",
  shot_off: "FOR",
  shot_saved: "DEF",
  big_save: "DEF",
  corner: "ESC",
  dangerous_foul: "FAL",
  offside: "IMP",
  yellow_card: "AMA",
  red_card: "VER",
  penalty: "PEN",
  goal: "GOL",
  halftime: "INT",
  second_half: "2T",
  extra_time: "PRO",
  shootout: "PEN",
  full_time: "FIM",
};

const halftimeOptions: { id: HalftimeInstruction; label: string; detail: string }[] = [
  { id: "keep", label: "Manter plano", detail: "Equilíbrio e controle" },
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
  const [minute, setMinute] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timelineRef = useRef<HTMLElement>(null);
  const opponent = match.home.isUser ? match.away : match.home;
  const needsHalftime = minute >= 45 && !result.instructions.halftime;
  const finished = minute >= maxMinute;
  const running = !needsHalftime && !paused && !finished;

  useEffect(() => {
    if (!running) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const step = reduce ? 3 : 1;
    const timer = window.setInterval(() => setMinute((value) => Math.min(maxMinute, value + step)), speeds[speedIndex].ms);
    return () => window.clearInterval(timer);
  }, [maxMinute, running, speedIndex]);

  const visibleEvents = useMemo(() => result.events.filter((item) => item.minute <= minute), [minute, result.events]);

  useEffect(() => {
    const node = timelineRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [visibleEvents.length]);

  const visibleGoals = visibleEvents.filter((item) => item.type === "goal");
  const homeVisible = visibleGoals.filter((item) => item.teamId === match.home.id).length;
  const awayVisible = visibleGoals.filter((item) => item.teamId === match.away.id).length;
  const finalHome = result.homeScore + result.homeExtra;
  const finalAway = result.awayScore + result.awayExtra;
  const status = finished
    ? result.wentToPenalties ? "Fim · pênaltis" : result.wentToExtraTime ? "Fim · prorrogação" : "Fim de jogo"
    : minute > 90 ? "Prorrogação" : minute > 45 ? "Segundo tempo" : "Primeiro tempo";
  const revealOpponent = ratingsMode === "visible" || finished;
  const chosen = halftimeOptions.find((option) => option.id === result.instructions.halftime);

  const chooseHalftime = (choice: HalftimeInstruction) => onInstruction({ ...result.instructions, halftime: choice });
  const skip = () => { setPaused(false); setMinute(result.instructions.halftime ? maxMinute : 45); };

  return (
    <main className="screen match-screen" id="main">
      <div className="match-stage"><span>{roundLabels[match.round]} · {status}</span><b>{finished ? "ENCERRADO" : `${minute}′`}</b></div>
      <section className="scoreboard" aria-live="polite">
        <div className="score-team">
          <span>{match.home.year}</span><h1>{match.home.name}</h1>
          <small>{match.home.isUser || revealOpponent ? `OVR ${match.home.overall.final} · ` : ""}{match.home.formation}</small>
        </div>
        <div className="score-numbers">
          <strong>{finished ? finalHome : homeVisible}</strong><i>×</i><strong>{finished ? finalAway : awayVisible}</strong>
          {finished && result.wentToPenalties && <span>PÊNALTIS {result.homePenalties} — {result.awayPenalties}</span>}
        </div>
        <div className="score-team score-team--away">
          <span>{match.away.year}</span><h1>{match.away.name}</h1>
          <small>{match.away.isUser || revealOpponent ? `OVR ${match.away.overall.final} · ` : ""}{match.away.formation}</small>
        </div>
      </section>
      <div className="match-progress" aria-hidden="true">
        <span style={{ transform: `scaleX(${Math.min(1, minute / maxMinute)})` }}/>
        <i style={{ left: `${Math.min(100, (minute / maxMinute) * 100)}%` }}/>
      </div>
      {!finished && (
        <div className="match-controls">
          <button type="button" className="match-control" onClick={() => setPaused((value) => !value)} disabled={needsHalftime} aria-pressed={paused}>
            {paused ? "▶ Retomar" : "❚❚ Pausar"}
          </button>
          <div className="match-speeds" role="group" aria-label="Velocidade da simulação">
            <span>Velocidade</span>
            {speeds.map((speed, index) => (
              <button type="button" key={speed.id} className={index === speedIndex ? "is-active" : ""} aria-pressed={index === speedIndex}
                onClick={() => { setSpeedIndex(index); setPaused(false); }}>{speed.label}</button>
            ))}
          </div>
          <button type="button" className="match-control" onClick={skip} disabled={needsHalftime}>
            {result.instructions.halftime ? "Avançar até o fim" : "Avançar até o intervalo"}
          </button>
        </div>
      )}
      <div className="match-content">
        <section className="timeline" aria-label="Linha do tempo da partida" ref={timelineRef}>
          <h2>Linha do tempo</h2>
          {visibleEvents.map((item) => (
            <article key={item.id} className={item.highlight ? "is-highlight" : ""}>
              <time>{item.minute ? `${item.minute}′` : "0′"}</time>
              <span className={item.teamId === match.home.id ? "is-home" : item.teamId === match.away.id ? "is-away" : ""}>{eventCodes[item.type]}</span>
              <b>{item.description}</b>
              {item.teamId && <small>{item.teamId === match.home.id ? match.home.name : match.away.name}</small>}
            </article>
          ))}
        </section>
        <aside className={`post-match ${finished ? "is-visible" : ""}`}>
          {needsHalftime ? (
            <DecisionPanel eyebrow="INTERVALO · SUA DECISÃO" title="Como o time volta?" options={halftimeOptions} onChoose={chooseHalftime}/>
          ) : finished ? (
            <>
              <span>LEITURA PÓS-JOGO</span>
              <div className="result-compact"><b>{finalHome} × {finalAway}</b><small>OVR {match.home.overall.final} × {match.away.overall.final}</small></div>
              <p>{result.summary}</p>
              {result.instructionImpact && <p className="instruction-impact">{result.instructionImpact}</p>}
              <dl>
                <div><dt>Melhor em campo</dt><dd>{result.playerOfMatch}</dd></div>
                <div><dt>Decisão</dt><dd>{result.wentToPenalties ? "Pênaltis" : result.wentToExtraTime ? "Prorrogação" : "90 minutos"}</dd></div>
              </dl>
              <button type="button" className="button button--primary button--wide" onClick={onFinish}>Confirmar resultado<ArrowIcon/></button>
            </>
          ) : (
            <>
              <span>SIMULAÇÃO EM ANDAMENTO</span>
              <p>O motor lê força por setor, encaixe tático, cartões e a sua orientação de intervalo.</p>
              <dl>
                <div><dt>Adversário</dt><dd>{opponent.name} {opponent.year}</dd></div>
                <div><dt>Orientação</dt><dd>{chosen ? chosen.label : "Definida no intervalo"}</dd></div>
                <div><dt>Ritmo</dt><dd>{paused ? "Pausado" : speeds[speedIndex].label}</dd></div>
              </dl>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}

function DecisionPanel<T extends string>({
  eyebrow,
  title,
  options,
  onChoose,
}: {
  eyebrow: string;
  title: string;
  options: { id: T; label: string; detail: string }[];
  onChoose: (choice: T) => void;
}) {
  return (
    <div className="decision-panel" role="group" aria-label={title}>
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      <div>
        {options.map((option) => (
          <button type="button" key={option.id} onClick={() => onChoose(option.id)}>
            <b>{option.label}</b><small>{option.detail}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

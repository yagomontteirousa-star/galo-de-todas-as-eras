import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Pitch } from "@/components/game/Pitch";
import { ArrowIcon } from "@/components/ui/Icons";
import { playersById } from "@/data/atletico-squads";
import { formations } from "@/data/formations";
import { evaluatePosition } from "@/lib/overall";
import { positionLabel } from "@/lib/positions";
import { roundLabels } from "@/lib/bracket";
import type { BracketMatch, Campaign, FormationId, LineupEntry, SquadPlayerEntry, TacticId } from "@/types/game";

const labelFor = (playerId: string) => playersById.get(playerId)?.name ?? "Atleta indisponível";
type DragSource = { kind: "slot"; slotId: string } | { kind: "bench"; index: number };
const dragDistance = 10;

/** Campo e banco compartilham o gesto de arrastar, mas o toque simples continua acessível. */
export function TacticalEditor({ formationId, tactic, lineup, bench, suspendedPlayerIds = [], unavailablePlayerIds = [], unavailableLabel = "Indisponível", onChange, compact = false }: {
  formationId: FormationId;
  tactic: TacticId;
  lineup: LineupEntry[];
  bench: SquadPlayerEntry[];
  suspendedPlayerIds?: string[];
  unavailablePlayerIds?: string[];
  unavailableLabel?: string;
  onChange: (lineup: LineupEntry[], bench: SquadPlayerEntry[]) => void;
  compact?: boolean;
}) {
  const [selectedSlotId, setSelectedSlotId] = useState<string>();
  const [selectedBenchIndex, setSelectedBenchIndex] = useState<number>();
  const [dragging, setDragging] = useState<DragSource>();
  const activePointer = useRef<{ source: DragSource; pointerId: number; x: number; y: number; moved: boolean } | undefined>(undefined);
  const ignoreClick = useRef(false);
  const suspended = useMemo(() => new Set(suspendedPlayerIds), [suspendedPlayerIds]);
  const unavailable = useMemo(() => new Set(unavailablePlayerIds), [unavailablePlayerIds]);
  const blocked = (playerId: string | undefined) => Boolean(playerId && (suspended.has(playerId) || unavailable.has(playerId)));
  const formation = formations[formationId];
  const clearChoice = () => { setSelectedSlotId(undefined); setSelectedBenchIndex(undefined); };

  const replaceSlotWithBench = (slotId: string, benchIndex: number) => {
    const incoming = bench[benchIndex];
    const leavingIndex = lineup.findIndex((entry) => entry.slotId === slotId);
    if (!incoming || leavingIndex < 0 || blocked(incoming.playerId)) return;
    const leaving = lineup[leavingIndex];
    onChange(
      lineup.map((entry) => entry.slotId === slotId ? { ...incoming, slotId } : entry),
      bench.map((entry, index) => index === benchIndex ? { playerId: leaving.playerId, squadId: leaving.squadId } : entry),
    );
    clearChoice();
  };
  const swapSlots = (first: string, second: string) => {
    if (first === second) return;
    const left = lineup.find((entry) => entry.slotId === first);
    const right = lineup.find((entry) => entry.slotId === second);
    if (!left || !right) return;
    onChange(lineup.map((entry) => entry.slotId === first ? { ...entry, slotId: second } : entry.slotId === second ? { ...entry, slotId: first } : entry), bench);
    clearChoice();
  };
  const swapBench = (first: number, second: number) => {
    if (first === second || !bench[first] || !bench[second]) return;
    const next = [...bench];
    [next[first], next[second]] = [next[second], next[first]];
    onChange(lineup, next);
    clearChoice();
  };
  const drop = (source: DragSource, target: DragSource) => {
    if (source.kind === "slot" && target.kind === "slot") return swapSlots(source.slotId, target.slotId);
    if (source.kind === "bench" && target.kind === "slot") return replaceSlotWithBench(target.slotId, source.index);
    if (source.kind === "slot" && target.kind === "bench") return replaceSlotWithBench(source.slotId, target.index);
    if (source.kind === "bench" && target.kind === "bench") return swapBench(source.index, target.index);
  };
  const startDrag = (source: DragSource, event: ReactPointerEvent<HTMLElement>) => {
    if (source.kind === "bench" && blocked(bench[source.index]?.playerId)) return;
    activePointer.current = { source, pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const moveDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const current = activePointer.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) >= dragDistance) {
      current.moved = true;
      setDragging(current.source);
    }
  };
  const finishDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const current = activePointer.current;
    if (!current || current.pointerId !== event.pointerId) return;
    activePointer.current = undefined;
    if (current.moved) {
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-tactics-slot], [data-tactics-bench]");
      if (target?.dataset.tacticsSlot) drop(current.source, { kind: "slot", slotId: target.dataset.tacticsSlot });
      else if (target?.dataset.tacticsBench !== undefined) drop(current.source, { kind: "bench", index: Number(target.dataset.tacticsBench) });
      ignoreClick.current = true;
      window.setTimeout(() => { ignoreClick.current = false; }, 0);
    }
    setDragging(undefined);
  };
  const onPitchSlot = (slotId: string) => {
    if (ignoreClick.current) return;
    if (selectedBenchIndex !== undefined) return replaceSlotWithBench(slotId, selectedBenchIndex);
    if (selectedSlotId) return swapSlots(selectedSlotId, slotId);
    setSelectedSlotId(slotId);
  };
  const onBenchPlayer = (index: number) => {
    if (ignoreClick.current || blocked(bench[index].playerId)) return;
    if (selectedSlotId) return replaceSlotWithBench(selectedSlotId, index);
    setSelectedBenchIndex((current) => current === index ? undefined : index);
  };
  const instruction = dragging
    ? "Solte sobre outro atleta para trocar."
    : selectedBenchIndex !== undefined ? "Toque na posição que recebe este reserva."
      : selectedSlotId ? "Agora escolha um atleta do banco ou outra posição."
        : "Toque num titular e escolha no banco quem entra.";

  return (
    <div className={`tactical-editor ${compact ? "tactical-editor--compact" : ""} ${dragging ? "is-dragging" : ""}`}>
      <div className="tactics-pitch">
        <Pitch formationId={formationId} tactic={tactic} lineup={lineup} selectedSlotId={selectedSlotId} draggedSlotId={dragging?.kind === "slot" ? dragging.slotId : undefined}
          onSlotClick={onPitchSlot} disabledPlayerIds={suspendedPlayerIds}
          onSlotPointerDown={(slotId, event) => startDrag({ kind: "slot", slotId }, event)}
          onSlotPointerMove={moveDrag} onSlotPointerUp={finishDrag}/>
        <p aria-live="polite">{instruction}</p>
      </div>
      <aside className="tactics-bench" aria-label="Banco de reservas">
        <header><h2>Banco de reservas</h2><span>{bench.length} disponíveis</span></header>
        <div className="tactics-bench__list">
          {bench.map((entry, index) => {
            const player = playersById.get(entry.playerId);
            if (!player) return null;
            const suspendedPlayer = suspended.has(player.id);
            const unavailablePlayer = unavailable.has(player.id);
            const disabledPlayer = suspendedPlayer || unavailablePlayer;
            const fit = selectedSlotId ? evaluatePosition(player, formation.slots.find((slot) => slot.id === selectedSlotId)!).fit : undefined;
            return <button type="button" key={player.id} data-tactics-bench={index} disabled={disabledPlayer}
              className={`${selectedBenchIndex === index ? "is-selected" : ""} ${fit && !disabledPlayer ? `is-fit-${fit}` : ""} ${disabledPlayer ? "is-suspended" : ""} ${dragging?.kind === "bench" && dragging.index === index ? "is-drag-source" : ""}`}
              aria-pressed={selectedBenchIndex === index} onClick={() => onBenchPlayer(index)}
              onPointerDown={(event) => startDrag({ kind: "bench", index }, event)} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={finishDrag}>
              <span>{positionLabel(player.primaryPosition)}</span><b>{player.name}</b><em>{player.overall}</em>
              {disabledPlayer ? <small>{suspendedPlayer ? "Suspenso" : unavailableLabel}</small> : fit && <small className={`fit--${fit}`}>{fit === "natural" ? "Natural" : fit === "secondary" ? "Alternativa" : "Improviso"}</small>}
            </button>;
          })}
        </div>
      </aside>
    </div>
  );
}

/** A prancheta pré-jogo trabalha só com as 18 escolhas já feitas na campanha. */
export function TacticsScreen({ campaign, match, onBack, onStart }: {
  campaign: Campaign;
  match: BracketMatch;
  onBack: () => void;
  onStart: (lineup: LineupEntry[], bench: SquadPlayerEntry[]) => void;
}) {
  const [lineup, setLineup] = useState(campaign.lineup);
  const [bench, setBench] = useState(campaign.bench);
  const suspended = useMemo(() => new Set(campaign.suspendedPlayerIds), [campaign.suspendedPlayerIds]);
  const opponent = match.home.isUser ? match.away : match.home;
  const suspendedNames = [...lineup, ...bench].filter((entry) => suspended.has(entry.playerId)).map((entry) => labelFor(entry.playerId));
  const invalidStarter = lineup.some((entry) => suspended.has(entry.playerId));

  return (
    <main className="screen tactics-screen" id="main">
      <header className="tactics-heading">
        <div>
          <span>{roundLabels[match.round]} · {opponent.name} {opponent.year}</span>
          <h1>Defina quem começa.</h1>
          <p>{match.home.stadium ?? "Casa do mandante"} · {campaign.formation} · cinco substituições disponíveis.</p>
        </div>
        <dl>
          <div><dt>Time</dt><dd>{lineup.length}/11</dd></div>
          <div><dt>Banco</dt><dd>{bench.length}/7</dd></div>
          <div><dt>Rival</dt><dd>{opponent.overall.final}</dd></div>
        </dl>
      </header>

      <TacticalEditor formationId={campaign.formation!} tactic={campaign.tactic ?? "balanced"} lineup={lineup} bench={bench}
        suspendedPlayerIds={campaign.suspendedPlayerIds} onChange={(nextLineup, nextBench) => { setLineup(nextLineup); setBench(nextBench); }}/>
      {suspendedNames.length > 0 && <p className="tactics-suspension">Suspenso nesta rodada: {suspendedNames.join(", ")}.</p>}

      <footer className="tactics-actions">
        <button type="button" className="button button--quiet" onClick={onBack}>Voltar à chave</button>
        <div>
          {invalidStarter && <p>Coloque o atleta suspenso no banco antes de iniciar.</p>}
          <button type="button" className="button button--primary" disabled={invalidStarter || lineup.length !== 11 || bench.length !== 7} onClick={() => onStart(lineup, bench)}>Iniciar jogo<ArrowIcon/></button>
        </div>
      </footer>
    </main>
  );
}

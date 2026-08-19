import { useMemo, useState } from "react";
import { Pitch } from "@/components/game/Pitch";
import { ArrowIcon } from "@/components/ui/Icons";
import { playersById } from "@/data/atletico-squads";
import { formations } from "@/data/formations";
import { evaluatePosition } from "@/lib/overall";
import { roundLabels } from "@/lib/bracket";
import type { BracketMatch, Campaign, LineupEntry, SquadPlayerEntry } from "@/types/game";

const labelFor = (playerId: string) => playersById.get(playerId)?.name ?? "Atleta indisponível";

/** A prancheta pré jogo trabalha só com as 18 escolhas já feitas na campanha. */
export function TacticsScreen({ campaign, match, onBack, onStart }: {
  campaign: Campaign;
  match: BracketMatch;
  onBack: () => void;
  onStart: (lineup: LineupEntry[], bench: SquadPlayerEntry[]) => void;
}) {
  const [lineup, setLineup] = useState(campaign.lineup);
  const [bench, setBench] = useState(campaign.bench);
  const [selectedSlotId, setSelectedSlotId] = useState<string>();
  const [selectedBenchIndex, setSelectedBenchIndex] = useState<number>();
  const formation = formations[campaign.formation!];
  const suspended = useMemo(() => new Set(campaign.suspendedPlayerIds), [campaign.suspendedPlayerIds]);
  const opponent = match.home.isUser ? match.away : match.home;
  const suspendedNames = [...lineup, ...bench].filter((entry) => suspended.has(entry.playerId)).map((entry) => labelFor(entry.playerId));
  const invalidStarter = lineup.some((entry) => suspended.has(entry.playerId));

  const swap = (slotId: string, benchIndex: number) => {
    const incoming = bench[benchIndex];
    const leavingIndex = lineup.findIndex((entry) => entry.slotId === slotId);
    if (!incoming || leavingIndex < 0 || suspended.has(incoming.playerId)) return;
    const leaving = lineup[leavingIndex];
    setLineup((current) => current.map((entry) => entry.slotId === slotId ? { ...incoming, slotId } : entry));
    setBench((current) => current.map((entry, index) => index === benchIndex ? { playerId: leaving.playerId, squadId: leaving.squadId } : entry));
    setSelectedSlotId(undefined);
    setSelectedBenchIndex(undefined);
  };

  const onPitchSlot = (slotId: string) => {
    if (selectedBenchIndex !== undefined) return swap(slotId, selectedBenchIndex);
    setSelectedSlotId((current) => current === slotId ? undefined : slotId);
  };

  const onBenchPlayer = (index: number) => {
    if (suspended.has(bench[index].playerId)) return;
    if (selectedSlotId) return swap(selectedSlotId, index);
    setSelectedBenchIndex((current) => current === index ? undefined : index);
  };

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

      <section className="tactics-board" aria-label="Mesa tática">
        <div className="tactics-pitch">
          <Pitch formationId={campaign.formation!} tactic={campaign.tactic} lineup={lineup} selectedSlotId={selectedSlotId}
            onSlotClick={onPitchSlot} disabledPlayerIds={campaign.suspendedPlayerIds}/>
          <p>{selectedBenchIndex !== undefined ? "Toque na posição que recebe este reserva." : selectedSlotId ? "Agora escolha um atleta do banco." : "Toque numa camisa e depois em um reserva para trocar antes do apito."}</p>
        </div>
        <aside className="tactics-bench">
          <header><h2>Banco de reservas</h2><span>7 disponíveis</span></header>
          <div className="tactics-bench__list">
            {bench.map((entry, index) => {
              const player = playersById.get(entry.playerId);
              if (!player) return null;
              const suspendedPlayer = suspended.has(player.id);
              const fit = selectedSlotId ? evaluatePosition(player, formation.slots.find((slot) => slot.id === selectedSlotId)!).fit : undefined;
              return <button type="button" key={player.id} disabled={suspendedPlayer} className={`${selectedBenchIndex === index ? "is-selected" : ""} ${suspendedPlayer ? "is-suspended" : ""}`}
                aria-pressed={selectedBenchIndex === index} onClick={() => onBenchPlayer(index)}>
                <span>{player.primaryPosition}</span><b>{player.name}</b><em>{player.overall}</em>
                {suspendedPlayer ? <small>Suspenso</small> : fit && <small className={`fit--${fit}`}>{fit === "natural" ? "Natural" : fit === "secondary" ? "Alternativa" : "Improviso"}</small>}
              </button>;
            })}
          </div>
          {suspendedNames.length > 0 && <p className="tactics-suspension">Suspenso nesta rodada: {suspendedNames.join(", ")}.</p>}
        </aside>
      </section>

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

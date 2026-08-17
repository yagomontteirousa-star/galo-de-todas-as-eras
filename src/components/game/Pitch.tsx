import { playersById } from "@/data/atletico-squads";
import { formations } from "@/data/formations";
import { evaluatePosition } from "@/lib/overall";
import type { FormationId, LineupEntry, Player } from "@/types/game";

interface PitchProps {
  formationId: FormationId;
  lineup?: LineupEntry[];
  previewPlayers?: Map<string, Player>;
  selectedPlayer?: Player;
  onSlotClick?: (slotId: string) => void;
  compact?: boolean;
  showRatings?: boolean;
}

export function Pitch({ formationId, lineup = [], previewPlayers = new Map(), selectedPlayer, onSlotClick, compact = false, showRatings = true }: PitchProps) {
  const formation = formations[formationId];
  return (
    <div className={`pitch ${compact ? "pitch--compact" : ""}`} aria-label={`Campo na formação ${formationId}`}>
      <div className="pitch__markings" aria-hidden="true"><span className="pitch__half"/><span className="pitch__circle"/><span className="pitch__box pitch__box--top"/><span className="pitch__box pitch__box--bottom"/></div>
      {formation.slots.map((slot) => {
        const entry = lineup.find((item) => item.slotId === slot.id);
        const player = previewPlayers.get(slot.id) ?? (entry ? playersById.get(entry.playerId) : undefined);
        const fit = selectedPlayer ? evaluatePosition(selectedPlayer, slot) : undefined;
        const interactive = Boolean(onSlotClick);
        const content = player ? <>{showRatings && <span className="pitch-player__rating">{player.overall}</span>}<span className="pitch-player__name">{player.name.split(" ").slice(-1)[0]}</span><span className="pitch-player__role">{slot.label}</span></> : <><span className="pitch-player__empty">{slot.label}</span>{selectedPlayer && <span className={`pitch-player__fit pitch-player__fit--${fit?.fit}`}>{fit?.penalty ? `−${fit.penalty}` : "OK"}</span>}</>;
        const className = `pitch-player ${player ? "is-filled" : "is-empty"} ${selectedPlayer && !player ? `is-${fit?.fit}` : ""}`;
        const style = { left: `${slot.x}%`, top: `${slot.y}%` };
        return interactive ? (
          <button key={slot.id} type="button" className={className} style={style} onClick={() => onSlotClick?.(slot.id)} aria-label={player ? `${player.name} em ${slot.label}` : `Vaga ${slot.label}${selectedPlayer ? `, penalidade ${fit?.penalty ?? 0}` : ""}`}>
            {content}
          </button>
        ) : <div key={slot.id} className={className} style={style}>{content}</div>;
      })}
    </div>
  );
}

import { playersById } from "@/data/atletico-squads";
import { tacticalSlots } from "@/data/formations";
import { evaluatePosition } from "@/lib/overall";
import type { FormationId, LineupEntry, Player, TacticId } from "@/types/game";

interface PitchProps {
  formationId: FormationId;
  /** Perfil tático: recua ou adianta as linhas sem mudar a formação. */
  tactic?: TacticId;
  lineup?: LineupEntry[];
  previewPlayers?: Map<string, Player>;
  selectedPlayer?: Player;
  selectedSlotId?: string;
  /** Vagas que aceitam o atleta em foco; as demais ficam apagadas. */
  targetSlotIds?: string[];
  /** Vaga recusada no último toque, para o feedback curto de bloqueio. */
  rejectedSlotId?: string;
  onSlotClick?: (slotId: string) => void;
  compact?: boolean;
  showRatings?: boolean;
}

export function Pitch({ formationId, tactic, lineup = [], previewPlayers = new Map(), selectedPlayer, selectedSlotId, targetSlotIds, rejectedSlotId, onSlotClick, compact = false, showRatings = true }: PitchProps) {
  const slots = tacticalSlots(formationId, tactic);
  const targets = targetSlotIds ? new Set(targetSlotIds) : undefined;
  return (
    <div className={`pitch-frame ${compact ? "pitch-frame--compact" : ""}`}>
      <div className="pitch" aria-label={`Campo na formação ${formationId}`}>
        <div className="pitch__markings" aria-hidden="true">
          <span className="pitch__half"/><span className="pitch__circle"/>
          <span className="pitch__box pitch__box--top"/><span className="pitch__box pitch__box--bottom"/>
        </div>
        {slots.map((slot) => {
          const entry = lineup.find((item) => item.slotId === slot.id);
          const player = previewPlayers.get(slot.id) ?? (entry ? playersById.get(entry.playerId) : undefined);
          const isTarget = Boolean(targets?.has(slot.id));
          const fit = selectedPlayer && isTarget ? evaluatePosition(selectedPlayer, slot).fit : undefined;
          const interactive = Boolean(onSlotClick);
          const content = player
            ? <>{showRatings && <span className="pitch-player__rating">{player.overall}</span>}<span className="pitch-player__name">{player.name.split(" ").slice(-1)[0]}</span><span className="pitch-player__role">{slot.label}</span></>
            : <><span className="pitch-player__empty">{slot.label}</span>{fit && <span className={`pitch-player__fit pitch-player__fit--${fit}`}>{fit === "natural" ? "natural" : "alt"}</span>}</>;
          const className = [
            "pitch-player",
            player ? "is-filled" : "is-empty",
            selectedSlotId === slot.id ? "is-slot-selected" : "",
            targets ? (isTarget ? "is-slot-target" : "is-slot-dimmed") : "",
            rejectedSlotId === slot.id ? "is-slot-rejected" : "",
          ].filter(Boolean).join(" ");
          const style = { left: `${slot.x}%`, top: `${slot.y}%` };
          const label = player
            ? `${player.name} em ${slot.label}. Mudar posição`
            : `Vaga ${slot.label}${selectedPlayer ? isTarget ? ", disponível para o atleta selecionado" : ", incompatível com o atleta selecionado" : ""}`;
          return interactive
            ? <button key={slot.id} type="button" className={className} style={style} onClick={() => onSlotClick?.(slot.id)} aria-label={label}>{content}</button>
            : <div key={slot.id} className={className} style={style}>{content}</div>;
        })}
      </div>
    </div>
  );
}

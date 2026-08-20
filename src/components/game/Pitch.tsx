import { playersById } from "@/data/atletico-squads";
import { tacticalSlots } from "@/data/formations";
import { evaluatePosition } from "@/lib/overall";
import type { FormationId, LineupEntry, Player, TacticId } from "@/types/game";
import type { PointerEvent as ReactPointerEvent } from "react";

interface PitchProps {
  formationId: FormationId;
  /** Perfil tático: recua ou adianta as linhas sem mudar a formação. */
  tactic?: TacticId;
  lineup?: LineupEntry[];
  previewPlayers?: Map<string, Player>;
  selectedPlayer?: Player;
  selectedSlotId?: string;
  draggedSlotId?: string;
  /** Vagas que aceitam o atleta em foco; as demais ficam apagadas. */
  targetSlotIds?: string[];
  /** Vaga recusada no último toque, para o feedback curto de bloqueio. */
  rejectedSlotId?: string;
  /** Suspenso fica visível, mas não pode ser selecionado para começar a partida. */
  disabledPlayerIds?: string[];
  onSlotClick?: (slotId: string) => void;
  onSlotPointerDown?: (slotId: string, event: ReactPointerEvent<HTMLDivElement>) => void;
  onSlotPointerMove?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onSlotPointerUp?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  compact?: boolean;
  showRatings?: boolean;
}

/**
 * O campo é estreito, então o nome inteiro só cabe quando é curto. Acima disso vale o
 * sobrenome, que é como o jogador é chamado, e o corte fica por conta do ellipsis do CSS.
 */
const displayName = (name: string) => (name.length <= 13 ? name : name.split(" ").at(-1)!);

export function Pitch({ formationId, tactic, lineup = [], previewPlayers = new Map(), selectedPlayer, selectedSlotId, draggedSlotId, targetSlotIds, rejectedSlotId, disabledPlayerIds = [], onSlotClick, onSlotPointerDown, onSlotPointerMove, onSlotPointerUp, compact = false, showRatings = true }: PitchProps) {
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
          const isSuspended = Boolean(player && disabledPlayerIds.includes(player.id));
          const fit = selectedPlayer && isTarget ? evaluatePosition(selectedPlayer, slot).fit : undefined;
          const interactive = Boolean(onSlotClick);
          const name = player ? displayName(player.name) : undefined;
          const className = [
            "pitch-slot",
            player ? "is-filled" : "is-empty",
            isSuspended ? "is-suspended" : "",
            selectedSlotId === slot.id ? "is-slot-selected" : "",
            draggedSlotId === slot.id ? "is-drag-source" : "",
            targets ? (isTarget ? "is-slot-target" : "is-slot-dimmed") : "",
            rejectedSlotId === slot.id ? "is-slot-rejected" : "",
          ].filter(Boolean).join(" ");
          const label = player
            ? `${player.name} em ${slot.label}${showRatings ? `, overall ${player.overall}` : ""}. Mudar posição`
            : `Vaga ${slot.label}${selectedPlayer ? isTarget ? ", disponível para o atleta selecionado" : ", incompatível com o atleta selecionado" : ""}`;
          // A sigla mora sozinha no botão; nome e overall ficam na etiqueta logo abaixo.
          const badge = interactive
            ? <button type="button" className="pitch-slot__badge" onClick={(event) => { event.stopPropagation(); onSlotClick?.(slot.id); }} aria-label={label} aria-disabled={isSuspended}>{slot.label}</button>
            : <span className="pitch-slot__badge">{slot.label}</span>;
          return (
            <div key={slot.id} className={className} data-tactics-slot={onSlotPointerDown ? slot.id : undefined}
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
              onClick={player && interactive ? () => onSlotClick?.(slot.id) : undefined}
              onPointerDown={player ? (event) => onSlotPointerDown?.(slot.id, event) : undefined}
              onPointerMove={onSlotPointerMove}
              onPointerUp={onSlotPointerUp}
              onPointerCancel={onSlotPointerUp}>
              {badge}
              {player
                ? <span className={`pitch-slot__tag ${name!.length > 10 ? "is-long" : ""}`}>
                    <b>{name}</b>{showRatings && <em>{player.overall}</em>}
                  </span>
                : fit && <span className={`pitch-slot__fit pitch-slot__fit--${fit}`}>{fit === "natural" ? "natural" : "alt"}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

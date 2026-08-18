import { Pitch } from "@/components/game/Pitch";
import { atleticoSquads, playersById } from "@/data/atletico-squads";
import { formations } from "@/data/formations";
import { evaluatePosition } from "@/lib/overall";
import { usedPersonIds } from "@/lib/campaign";
import type { Campaign, FormationSlot, HistoricalSquad, LineupEntry, Player, Position } from "@/types/game";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, ShuffleIcon } from "@/components/ui/Icons";

const positionLabels: Record<Position, string> = { GK: "GOL", CB: "ZAG", LB: "LE", RB: "LD", LWB: "ALA", RWB: "ALA", DM: "VOL", CM: "MC", AM: "MEI", LW: "PE", RW: "PD", ST: "ATA" };
const positionOrder: Position[] = ["GK", "RB", "CB", "LB", "RWB", "LWB", "DM", "CM", "AM", "RW", "LW", "ST"];
const groups: { title: string; positions: Position[] }[] = [
  { title: "Goleiros", positions: ["GK"] },
  { title: "Defensores", positions: ["CB", "LB", "RB", "LWB", "RWB"] },
  { title: "Meio-campistas", positions: ["DM", "CM", "AM"] },
  { title: "Atacantes", positions: ["LW", "RW", "ST"] },
];
const squadYears = atleticoSquads.map((squad) => squad.year);
const REVEAL_MS = 820;

type MobileTab = "roster" | "pitch";
interface PickToast { id: number; tone: "ok" | "block"; title: string; detail: string }

/** Uma vaga só aceita quem a cobre de forma natural ou secundária — improviso não escala. */
const canPlay = (player: Player, slot: FormationSlot) => evaluatePosition(player, slot).fit !== "improvised";
const compatibleSlots = (player: Player, slots: FormationSlot[], exceptSlotId?: string) =>
  slots.filter((slot) => slot.id !== exceptSlotId && canPlay(player, slot));

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isHandheld = () => typeof window !== "undefined" && window.matchMedia("(max-width: 920px)").matches;

export function DraftScreen({ campaign, squad, onConfirm, onReroll, onRelocateLineupEntry }: {
  campaign: Campaign;
  squad: HistoricalSquad;
  onConfirm: (picks: LineupEntry[]) => void;
  onReroll: () => void;
  onRelocateLineupEntry: (fromSlotId: string, toSlotId: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string>();
  const [hoverId, setHoverId] = useState<string>();
  const [selectedSlotId, setSelectedSlotId] = useState<string>();
  const [editingSlotId, setEditingSlotId] = useState<string>();
  const [rejectedSlotId, setRejectedSlotId] = useState<string>();
  const [picks, setPicks] = useState<LineupEntry[]>([]);
  const [mobileTab, setMobileTab] = useState<MobileTab>("roster");
  const [toast, setToast] = useState<PickToast>();
  const [spinYear, setSpinYear] = useState<number | undefined>(
    () => prefersReducedMotion() ? undefined : squadYears[Math.floor(Math.random() * squadYears.length)]);
  const toastSeq = useRef(0);
  const rosterRef = useRef<HTMLElement>(null);
  /** Toque que virou rolagem não seleciona: guardamos a origem e comparamos o deslocamento. */
  const gesture = useRef<{ id: number; x: number; y: number; dragged: boolean } | null>(null);
  const cancelClick = useRef(false);
  const DRAG_LIMIT = 10;

  const startGesture = (event: React.PointerEvent) => {
    cancelClick.current = false;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, dragged: false };
  };
  const trackGesture = (event: React.PointerEvent) => {
    const start = gesture.current;
    if (!start || start.id !== event.pointerId || start.dragged) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > DRAG_LIMIT) {
      start.dragged = true;
      cancelClick.current = true;
      setHoverId(undefined);
    }
  };
  const endGesture = () => { gesture.current = null; };
  const wasDrag = () => {
    const dragged = cancelClick.current;
    cancelClick.current = false;
    return dragged;
  };
  const fieldRef = useRef<HTMLElement>(null);

  /** No mobile o fluxo é lista, campo, posição e volta para a lista, sempre com rolagem suave. */
  const focusSection = (ref: React.RefObject<HTMLElement | null>) => {
    if (!isHandheld()) return;
    window.requestAnimationFrame(() =>
      ref.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" }));
  };
  const formation = formations[campaign.formation!];
  const showRatings = campaign.ratingsMode !== "memory";
  const selectedPlayer = squad.players.find((player) => player.id === selectedId);
  const activePlayer = squad.players.find((player) => player.id === (hoverId ?? selectedId));
  const combined = [...campaign.lineup, ...picks];
  const occupied = new Set(combined.map((entry) => entry.slotId));
  // Bloqueio pela identidade histórica: o Hulk de 2021 tranca o Hulk de 2024.
  const usedPeople = usedPersonIds(combined);
  const alreadyChosen = (player: Player) => usedPeople.has(player.personId);
  const openSlots = formation.slots.filter((slot) => !occupied.has(slot.id));
  const maxPicks = Math.min(2, 11 - campaign.lineup.length);
  const totalFilled = combined.length;
  const closesLineup = campaign.lineup.length + maxPicks === 11;
  const advancing = picks.length >= maxPicks;
  const revealing = spinYear !== undefined;

  // Revelação do ano: um giro curto entre as eras antes de parar no elenco sorteado.
  // A tela é remontada a cada ano (key do elenco), então o giro roda uma vez por sorteio.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let index = 0;
    const spin = window.setInterval(() => {
      index += 1;
      setSpinYear(squadYears[(index * 5) % squadYears.length]);
    }, 62);
    const stop = window.setTimeout(() => { window.clearInterval(spin); setSpinYear(undefined); }, REVEAL_MS);
    return () => { window.clearInterval(spin); window.clearTimeout(stop); };
  }, []);

  // Cota do ano preenchida: confirma sozinho, com uma pausa curta para a transição ser legível.
  useEffect(() => {
    if (!advancing) return;
    const timer = window.setTimeout(() => onConfirm(picks), 900);
    return () => window.clearTimeout(timer);
  }, [advancing, onConfirm, picks]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(undefined), toast.tone === "block" ? 1900 : 2300);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!rejectedSlotId) return;
    const timer = window.setTimeout(() => setRejectedSlotId(undefined), 520);
    return () => window.clearTimeout(timer);
  }, [rejectedSlotId]);

  const previewPlayers = useMemo(
    () => new Map(picks.map((entry) => [entry.slotId, squad.players.find((player) => player.id === entry.playerId)!])),
    [picks, squad.players],
  );
  const playerAt = (slotId: string) => {
    const entry = combined.find((item) => item.slotId === slotId);
    return entry ? previewPlayers.get(slotId) ?? playersById.get(entry.playerId) : undefined;
  };

  const players = useMemo(
    () => [...squad.players].sort((left, right) =>
      positionOrder.indexOf(left.primaryPosition) - positionOrder.indexOf(right.primaryPosition) || right.overall - left.overall),
    [squad.players],
  );

  const announce = (tone: PickToast["tone"], title: string, detail: string) =>
    setToast({ id: (toastSeq.current += 1), tone, title, detail });

  const assignPlayer = (player: Player, slot: FormationSlot) => {
    if (advancing || occupied.has(slot.id)) return;
    // Última barreira: nenhum caminho de escalação aceita um atleta já usado na campanha.
    if (alreadyChosen(player)) {
      setRejectedSlotId(slot.id);
      announce("block", "Jogador já utilizado", `${player.name} já entrou nesta campanha.`);
      return;
    }
    if (!canPlay(player, slot)) {
      setRejectedSlotId(slot.id);
      announce("block", "Posição incompatível", `${player.name} joga como ${positionLabels[player.primaryPosition]}.`);
      return;
    }
    if (picks.length >= maxPicks) return;
    // Uma vaga só aceita uma escolha: a decisão sai do estado atual, não do render, para nunca duplicar slotId.
    setPicks((current) => {
      const others = current.filter((entry) => entry.slotId !== slot.id);
      return others.length >= maxPicks ? current : [...others, { slotId: slot.id, playerId: player.id, squadId: squad.id }];
    });
    setSelectedId(undefined);
    setSelectedSlotId(undefined);
    setMobileTab("roster");
    focusSection(rosterRef);
    announce("ok", "Jogador confirmado", `${player.name} · ${slot.label}`);
  };

  /** Troca duas vagas de uma vez nas duas coleções: o onze já fechado e as escolhas deste ano. */
  const relocate = (fromSlotId: string, toSlotId: string) => {
    const player = playerAt(fromSlotId);
    const target = formation.slots.find((slot) => slot.id === toSlotId);
    if (!player || !target || fromSlotId === toSlotId) return;
    const swap = (entry: LineupEntry): LineupEntry =>
      entry.slotId === fromSlotId ? { ...entry, slotId: toSlotId }
        : entry.slotId === toSlotId ? { ...entry, slotId: fromSlotId } : entry;
    if (picks.some((entry) => entry.slotId === fromSlotId || entry.slotId === toSlotId)) setPicks((current) => current.map(swap));
    if (campaign.lineup.some((entry) => entry.slotId === fromSlotId || entry.slotId === toSlotId)) onRelocateLineupEntry(fromSlotId, toSlotId);
    setEditingSlotId(undefined);
    setMobileTab("roster");
    focusSection(rosterRef);
    announce("ok", "Posição atualizada", `${player.name} · ${target.label}`);
  };

  const releasePick = (slotId: string) => {
    setPicks((current) => current.filter((entry) => entry.slotId !== slotId));
    setEditingSlotId(undefined);
  };

  const handleSlot = (slotId: string) => {
    if (advancing || revealing) return;
    const slot = formation.slots.find((item) => item.id === slotId)!;
    if (occupied.has(slotId)) { setSelectedSlotId(undefined); setEditingSlotId(slotId); return; }
    if (selectedPlayer) return assignPlayer(selectedPlayer, slot);
    setSelectedSlotId((current) => current === slotId ? undefined : slotId);
  };

  const handlePlayer = (player: Player) => {
    if (wasDrag() || advancing || revealing || alreadyChosen(player)) return;
    if (selectedSlotId) {
      const slot = formation.slots.find((item) => item.id === selectedSlotId)!;
      return assignPlayer(player, slot);
    }
    setSelectedId((current) => current === player.id ? undefined : player.id);
    setMobileTab("pitch");
    focusSection(fieldRef);
  };

  const targetSlotIds = activePlayer
    ? compatibleSlots(activePlayer, openSlots).map((slot) => slot.id)
    : undefined;
  const editingPlayer = editingSlotId ? playerAt(editingSlotId) : undefined;
  const editingSlot = editingSlotId ? formation.slots.find((slot) => slot.id === editingSlotId) : undefined;
  const editingTargets = editingPlayer && editingSlot ? compatibleSlots(editingPlayer, formation.slots, editingSlot.id) : [];
  const advanceLabel = closesLineup
    ? "Escalação completa · abrindo a análise tática"
    : maxPicks === 1 ? "Escolha confirmada · sorteando o próximo ano" : "Dupla confirmada · sorteando o próximo ano";

  return (
    <main className="draft-screen" id="main">
      <nav className="draft-mobile-tabs" aria-label="Etapas da escalação">
        <button type="button" aria-current={mobileTab === "roster" ? "page" : undefined} className={mobileTab === "roster" ? "is-active" : ""} onClick={() => { setMobileTab("roster"); focusSection(rosterRef); }}>Elenco</button>
        <button type="button" aria-current={mobileTab === "pitch" ? "page" : undefined} className={mobileTab === "pitch" ? "is-active" : ""} onClick={() => { setMobileTab("pitch"); focusSection(fieldRef); }}>Campo · {totalFilled}/11</button>
      </nav>

      <div className={`draft-workspace ${advancing ? "is-advancing" : ""}`}>
        <section ref={rosterRef} className={`draft-column era-column ${mobileTab === "roster" ? "is-mobile-active" : ""}`} aria-label={`Elenco de ${squad.year}`}>
          <header className="era-header">
            <span>ANO SORTEADO</span>
            <div className={revealing ? "is-spinning" : ""}>
              <strong aria-live="polite">{spinYear ?? squad.year}</strong>
              <h1>{revealing ? "Girando o arquivo" : squad.name}</h1>
            </div>
          </header>

          {revealing ? (
            <div className="roster-draw" role="status">
              <span>Sorteando o ano</span>
              <p>O elenco aparece quando a roleta parar.</p>
            </div>
          ) : (<>
          <div className="roster-heading">
            <div><h2>{maxPicks === 1 ? "Escolha o jogador" : "Escolha 2 jogadores"}</h2><span>{picks.length} de {maxPicks} neste ano</span></div>
            <button type="button" className="reroll-action" disabled={!campaign.rerollsLeft || advancing} onClick={onReroll}>
              <ShuffleIcon/>Outro ano
              <em>{campaign.rerollsLeft}</em>
              <small>{campaign.rerollsLeft === 1 ? "sorteio restante" : "sorteios restantes"}</small>
            </button>
          </div>

          <div className="roster-scroll">
            {groups.map((group) => {
              const groupPlayers = players.filter((player) => group.positions.includes(player.primaryPosition));
              if (!groupPlayers.length) return null;
              return <section className="roster-group" key={group.title}>
                <h3>{group.title}<span>{groupPlayers.length}</span></h3>
                {groupPlayers.map((player) => {
                  const isPicked = alreadyChosen(player);
                  // Escalado neste ano é diferente de já usado num ano anterior.
                  const inThisSquad = combined.some((entry) => entry.playerId === player.id);
                  const hasRoom = openSlots.some((slot) => canPlay(player, slot));
                  const blockedLabel = isPicked
                    ? inThisSquad ? "escalado" : "já utilizado"
                    : !hasRoom ? "sem vaga" : undefined;
                  return <button type="button" key={player.id} disabled={isPicked || !hasRoom || advancing}
                    className={`player-row ${selectedId === player.id ? "is-selected" : ""} ${isPicked ? "is-picked" : ""} ${!hasRoom && !isPicked ? "is-blocked" : ""}`}
                    onClick={() => handlePlayer(player)}
                    onPointerDown={startGesture} onPointerMove={trackGesture} onPointerUp={endGesture} onPointerCancel={endGesture}
                    onPointerEnter={(event) => { if (event.pointerType === "mouse") setHoverId(player.id); }}
                    onPointerLeave={(event) => { if (event.pointerType === "mouse") setHoverId(undefined); }}
                    onFocus={() => setHoverId(player.id)} onBlur={() => setHoverId(undefined)} aria-pressed={selectedId === player.id}
                    aria-disabled={isPicked || !hasRoom || advancing}
                    title={isPicked && !inThisSquad ? "Jogador já utilizado nesta campanha" : undefined}>
                    <span className="player-row__position">{positionLabels[player.primaryPosition]}</span>
                    <span className="player-row__name">{player.name}</span>
                    {blockedLabel && <span className="player-row__state">{blockedLabel}</span>}
                    {showRatings && <strong className="player-row__ovr">{player.overall}</strong>}
                    {isPicked && <CheckIcon/>}
                  </button>;
                })}
              </section>;
            })}
          </div>
          </>)}
        </section>

        <section ref={fieldRef} className={`draft-column field-column ${mobileTab === "pitch" ? "is-mobile-active" : ""}`} aria-label="Campo e escalação">
          <header className="field-heading">
            <div><span>FORMAÇÃO {campaign.formation}</span><b>{selectedPlayer ? `Onde ${selectedPlayer.name} joga` : selectedSlotId ? "Agora escolha um jogador" : "Monte o seu onze"}</b></div>
            <strong>{totalFilled}<small>/11</small></strong>
          </header>
          <Pitch formationId={campaign.formation!} tactic={campaign.tactic} lineup={campaign.lineup} previewPlayers={previewPlayers} selectedPlayer={activePlayer}
            selectedSlotId={selectedSlotId} targetSlotIds={targetSlotIds} rejectedSlotId={rejectedSlotId} onSlotClick={handleSlot} showRatings={showRatings}/>
          <p className="field-hint">{activePlayer ? "As vagas acesas aceitam este atleta." : "Toque no atleta e depois na vaga. Tocar numa peça escalada muda a posição."}</p>
        </section>
      </div>

      {editingPlayer && editingSlot && (
        <div className="slot-dialog" role="dialog" aria-modal="true" aria-label={`Posição de ${editingPlayer.name}`}>
          <button type="button" className="slot-dialog__backdrop" aria-label="Fechar" onClick={() => setEditingSlotId(undefined)}/>
          <div className="slot-dialog__panel">
            <header>
              <span>MUDAR POSIÇÃO</span>
              <b>{editingPlayer.name}</b>
              <small>Hoje em {editingSlot.label} · natural {positionLabels[editingPlayer.primaryPosition]}</small>
            </header>
            {editingTargets.length ? (
              <div className="slot-dialog__options">
                {editingTargets.map((slot) => {
                  const occupant = playerAt(slot.id);
                  const evaluation = evaluatePosition(editingPlayer, slot);
                  return <button type="button" key={slot.id} onClick={() => relocate(editingSlot.id, slot.id)}>
                    <b>{slot.label}</b>
                    <span className={`fit--${evaluation.fit}`}>{evaluation.fit === "natural" ? "natural" : "secundária"}</span>
                    <small>{occupant ? `troca com ${occupant.name}` : "vaga livre"}</small>
                  </button>;
                })}
              </div>
            ) : <p className="slot-dialog__empty">Não há outra vaga compatível nesta formação. Ele segue em {editingSlot.label}.</p>}
            <footer>
              {picks.some((entry) => entry.slotId === editingSlot.id) && (
                <button type="button" className="slot-dialog__release" onClick={() => releasePick(editingSlot.id)}>Devolver ao elenco</button>
              )}
              <button type="button" className="button button--quiet" onClick={() => setEditingSlotId(undefined)}>Fechar</button>
            </footer>
          </div>
        </div>
      )}

      {toast && !advancing && (
        <div className={`pick-toast pick-toast--${toast.tone}`} role="status" key={toast.id}>
          {toast.tone === "ok" ? <CheckIcon/> : <span className="pick-toast__mark" aria-hidden="true">!</span>}
          <div><b>{toast.title}</b><span>{toast.detail}</span></div>
        </div>
      )}
      {advancing && <div className="draft-advance" role="status"><span>{advanceLabel}</span><i aria-hidden="true"/></div>}
    </main>
  );
}

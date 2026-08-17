import { Pitch } from "@/components/game/Pitch";
import { formations } from "@/data/formations";
import { evaluatePosition } from "@/lib/overall";
import type { Campaign, FormationSlot, HistoricalSquad, LineupEntry, Player, Position } from "@/types/game";
import { useMemo, useState } from "react";
import { CheckIcon, ShuffleIcon } from "@/components/ui/Icons";

const positionLabels: Record<Position, string> = { GK: "GOL", CB: "ZAG", LB: "LE", RB: "LD", LWB: "ALA", RWB: "ALA", DM: "VOL", CM: "MC", AM: "MEI", LW: "PE", RW: "PD", ST: "ATA" };
const positionOrder: Position[] = ["GK", "RB", "CB", "LB", "RWB", "LWB", "DM", "CM", "AM", "RW", "LW", "ST"];
const groups: { title: string; positions: Position[] }[] = [
  { title: "Goleiros", positions: ["GK"] },
  { title: "Defensores", positions: ["CB", "LB", "RB", "LWB", "RWB"] },
  { title: "Meio-campistas", positions: ["DM", "CM", "AM"] },
  { title: "Atacantes", positions: ["LW", "RW", "ST"] },
];

export function DraftScreen({
  campaign,
  squad,
  onConfirm,
  onReroll,
}: {
  campaign: Campaign;
  squad: HistoricalSquad;
  onConfirm: (picks: LineupEntry[]) => void;
  onReroll: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string>();
  const [picks, setPicks] = useState<LineupEntry[]>([]);
  const [filter, setFilter] = useState<"all" | "needed">("all");
  const [sort, setSort] = useState<"position" | "overall">("position");
  const formation = formations[campaign.formation!];
  const showRatings = campaign.ratingsMode !== "memory";
  const selectedPlayer = squad.players.find((player) => player.id === selectedId);
  const occupied = new Set([...campaign.lineup, ...picks].map((entry) => entry.slotId));
  const alreadyChosen = new Set([...campaign.lineup, ...picks].map((entry) => entry.playerId));
  const openSlots = formation.slots.filter((slot) => !occupied.has(slot.id));
  const remaining = 11 - campaign.lineup.length;
  const maxPicks = Math.min(2, remaining);
  const previewPlayers = useMemo(
    () => new Map(picks.map((entry) => [entry.slotId, squad.players.find((player) => player.id === entry.playerId)!])),
    [picks, squad.players],
  );
  const players = useMemo(() => {
    const filtered = filter === "all"
      ? squad.players
      : squad.players.filter((player) => openSlots.some((slot) => evaluatePosition(player, slot).fit !== "improvised"));
    return [...filtered].sort((left, right) => sort === "overall" && showRatings
      ? right.overall - left.overall
      : positionOrder.indexOf(left.primaryPosition) - positionOrder.indexOf(right.primaryPosition) || right.overall - left.overall);
  }, [filter, openSlots, showRatings, sort, squad.players]);

  const placePlayer = (slotId: string) => {
    const ownPick = picks.find((entry) => entry.slotId === slotId);
    if (ownPick) {
      setPicks((current) => current.filter((entry) => entry.slotId !== slotId));
      return;
    }
    if (!selectedPlayer || occupied.has(slotId) || picks.length >= maxPicks) return;
    setPicks((current) => [...current, { slotId, playerId: selectedPlayer.id, squadId: squad.id }]);
    setSelectedId(undefined);
  };

  const field = (
    <>
      <div className="draft-field-panel__head">
        <div><span>FORMAÇÃO {campaign.formation}</span><b>{selectedPlayer ? `Onde joga ${selectedPlayer.name}?` : picks.length ? "Escolha outro nome ou confirme" : "Selecione um atleta"}</b></div>
        <span>{campaign.lineup.length + picks.length}/11</span>
      </div>
      <Pitch formationId={campaign.formation!} lineup={campaign.lineup} previewPlayers={previewPlayers} selectedPlayer={selectedPlayer} onSlotClick={placePlayer} showRatings={showRatings}/>
    </>
  );

  return (
    <main className="screen draft-screen" id="main">
      <div className="draft-topline">
        <div><span>ELENCO SORTEADO</span><h1><b>{squad.year}</b> {squad.name}</h1><p>{squad.context}</p></div>
        <div className="draft-stats"><span><b>{remaining}</b> vagas</span><span><b>{campaign.usedSquadIds.length}</b> eras</span><span><b>{campaign.rerollsLeft}</b> rerolls</span></div>
      </div>

      <details className="mobile-lineup-summary">
        <summary><span>Escalação · {campaign.lineup.length + picks.length}/11</span><b>Ver campo</b></summary>
        {field}
        <div className="mobile-lineup-summary__controls">
          <PickReview picks={picks} squad={squad} formation={formation} onRemove={placePlayer}/>
          <div className="draft-actions">
            <button type="button" className="button button--quiet" disabled={!campaign.rerollsLeft} onClick={onReroll}><ShuffleIcon/>Reroll <span>{campaign.rerollsLeft}</span></button>
            <button type="button" className="button button--primary" disabled={picks.length < 1} onClick={() => onConfirm(picks)}>Confirmar {picks.length || ""}</button>
          </div>
        </div>
      </details>

      <div className="draft-layout">
        <aside className="draft-field-panel">
          {field}
          <PickReview picks={picks} squad={squad} formation={formation} onRemove={placePlayer}/>
          <div className="draft-actions">
            <button type="button" className="button button--quiet" disabled={!campaign.rerollsLeft} onClick={onReroll}><ShuffleIcon/>Reroll <span>{campaign.rerollsLeft}</span></button>
            <button type="button" className="button button--primary" disabled={picks.length < 1} onClick={() => onConfirm(picks)}>Confirmar {picks.length || ""} {picks.length === 1 ? "escolha" : "escolhas"}</button>
          </div>
        </aside>

        <section className="squad-panel" aria-label={`Jogadores do elenco de ${squad.year}`}>
          <div className="squad-panel__instructions"><b>{picks.length}/{maxPicks} escolhidos nesta era</b><span>Escolha o atleta e toque em uma vaga no campo.</span></div>
          <div className="roster-tools">
            <div role="group" aria-label="Filtro de jogadores">
              <button type="button" className={filter === "all" ? "is-active" : ""} onClick={() => setFilter("all")}>Todos</button>
              <button type="button" className={filter === "needed" ? "is-active" : ""} onClick={() => setFilter("needed")}>Posições livres</button>
            </div>
            <label>Ordenar
              <select value={sort} onChange={(event) => setSort(event.target.value as "position" | "overall")}>
                <option value="position">Posição</option>
                {showRatings && <option value="overall">Overall</option>}
              </select>
            </label>
          </div>

          {selectedPlayer && (
            <PlayerDetail player={selectedPlayer} openSlots={openSlots} showRatings={showRatings}/>
          )}

          <div className="player-groups">
            {groups.map((group) => {
              const groupPlayers = players.filter((player) => group.positions.includes(player.primaryPosition));
              if (!groupPlayers.length) return null;
              return (
                <div className="player-group" key={group.title}>
                  <h2>{group.title}<small>{groupPlayers.length}</small></h2>
                  <div>{groupPlayers.map((player) => {
                    const isPicked = alreadyChosen.has(player.id);
                    const bestFit = openSlots.reduce((best, slot) => Math.min(best, evaluatePosition(player, slot).penalty), 99);
                    return (
                      <button
                        type="button"
                        key={player.id}
                        disabled={isPicked || (picks.length >= maxPicks && !isPicked)}
                        className={`player-row ${selectedId === player.id ? "is-selected" : ""} ${isPicked ? "is-picked" : ""}`}
                        onClick={() => setSelectedId(selectedId === player.id ? undefined : player.id)}
                        aria-pressed={selectedId === player.id}
                      >
                        <span className="player-row__position">{positionLabels[player.primaryPosition]}</span>
                        <span className="player-row__identity"><b>{player.name}</b><small>{player.tags.slice(0, 2).join(" · ")}</small></span>
                        <span className={`player-row__fit fit--${bestFit === 0 ? "natural" : bestFit === 2 ? "secondary" : "improvised"}`}>{bestFit === 0 ? "ideal" : bestFit === 2 ? "opção" : "improviso"}</span>
                        {showRatings && <strong>{player.overall}</strong>}
                        {isPicked && <CheckIcon/>}
                      </button>
                    );
                  })}</div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

function PlayerDetail({ player, openSlots, showRatings }: { player: Player; openSlots: FormationSlot[]; showRatings: boolean }) {
  const best = openSlots.reduce((current, slot) => {
    const fit = evaluatePosition(player, slot);
    return !current || fit.penalty < current.penalty ? { ...fit, label: slot.label } : current;
  }, undefined as (ReturnType<typeof evaluatePosition> & { label: string }) | undefined);
  return (
    <article className="player-detail">
      <div><span>{positionLabels[player.primaryPosition]}</span><h3>{player.name}</h3><small>{player.tags.join(" · ")}</small></div>
      {showRatings ? (
        <dl>
          <div><dt>OVR</dt><dd>{player.overall}</dd></div>
          <div><dt>Finalização</dt><dd>{player.attributes.finishing}</dd></div>
          <div><dt>Criação</dt><dd>{player.attributes.creation}</dd></div>
          <div><dt>Defesa</dt><dd>{player.attributes.defending}</dd></div>
          <div><dt>Físico</dt><dd>{player.attributes.physical}</dd></div>
        </dl>
      ) : <p>Ratings ocultos no modo memória. Use posição, tags e contexto da era.</p>}
      {best && <b className={`fit fit--${best.fit}`}>Melhor encaixe: {best.label} · {best.fit === "natural" ? "natural" : best.fit === "secondary" ? "secundário −2" : `improviso −${best.penalty}`}</b>}
    </article>
  );
}

function PickReview({
  picks,
  squad,
  formation,
  onRemove,
}: {
  picks: LineupEntry[];
  squad: HistoricalSquad;
  formation: (typeof formations)[keyof typeof formations];
  onRemove: (slotId: string) => void;
}) {
  return (
    <div className="pick-review">
      {picks.length ? picks.map((pick) => {
        const player = squad.players.find((item) => item.id === pick.playerId)!;
        const slot = formation.slots.find((item) => item.id === pick.slotId)!;
        const fit = evaluatePosition(player, slot);
        return <button type="button" key={pick.slotId} onClick={() => onRemove(pick.slotId)}><span>{player.name} · {slot.label}</span><b className={`fit fit--${fit.fit}`}>{fit.fit === "natural" ? "Natural" : fit.fit === "secondary" ? "Secundária −2" : `Improvisado −${fit.penalty}`}</b><small>Remover</small></button>;
      }) : <p>Vagas compatíveis aparecem no campo. Improvisações são permitidas e têm custo tático.</p>}
    </div>
  );
}

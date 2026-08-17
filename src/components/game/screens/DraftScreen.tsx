import { Pitch } from "@/components/game/Pitch";
import { playersById } from "@/data/atletico-squads";
import { formations } from "@/data/formations";
import { opponents } from "@/data/opponents";
import { calculateTeamOverall, evaluatePosition } from "@/lib/overall";
import type { Campaign, HistoricalSquad, LineupEntry, Player, Position } from "@/types/game";
import { useEffect, useMemo, useState } from "react";
import { CheckIcon, ShuffleIcon } from "@/components/ui/Icons";

const positionLabels: Record<Position, string> = { GK: "GOL", CB: "ZAG", LB: "LE", RB: "LD", LWB: "ALA", RWB: "ALA", DM: "VOL", CM: "MC", AM: "MEI", LW: "PE", RW: "PD", ST: "ATA" };
const positionOrder: Position[] = ["GK", "RB", "CB", "LB", "RWB", "LWB", "DM", "CM", "AM", "RW", "LW", "ST"];
const groups: { title: string; positions: Position[] }[] = [
  { title: "Goleiros", positions: ["GK"] },
  { title: "Defensores", positions: ["CB", "LB", "RB", "LWB", "RWB"] },
  { title: "Meio-campistas", positions: ["DM", "CM", "AM"] },
  { title: "Atacantes", positions: ["LW", "RW", "ST"] },
];

type MobileTab = "roster" | "pitch" | "team";

export function DraftScreen({ campaign, squad, onConfirm, onReroll, onRemoveLineupEntry }: {
  campaign: Campaign;
  squad: HistoricalSquad;
  onConfirm: (picks: LineupEntry[]) => void;
  onReroll: () => void;
  onRemoveLineupEntry: (slotId: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string>();
  const [hoverId, setHoverId] = useState<string>();
  const [selectedSlotId, setSelectedSlotId] = useState<string>();
  const [picks, setPicks] = useState<LineupEntry[]>([]);
  const [filter, setFilter] = useState<"all" | "needed">("all");
  const [sort, setSort] = useState<"position" | "overall">("position");
  const [mobileTab, setMobileTab] = useState<MobileTab>("pitch");
  const formation = formations[campaign.formation!];
  const showRatings = campaign.ratingsMode !== "memory";
  const selectedPlayer = squad.players.find((player) => player.id === selectedId);
  const activePlayer = squad.players.find((player) => player.id === (hoverId ?? selectedId));
  const combined = [...campaign.lineup, ...picks];
  const occupied = new Set(combined.map((entry) => entry.slotId));
  const alreadyChosen = new Set(combined.map((entry) => entry.playerId));
  const openSlots = formation.slots.filter((slot) => !occupied.has(slot.id));
  const maxPicks = Math.min(2, 11 - campaign.lineup.length);
  const totalFilled = combined.length;
  const closesLineup = campaign.lineup.length + maxPicks === 11;
  const advancing = picks.length >= maxPicks;

  // Cota da era preenchida: confirma sozinho, com uma pausa curta para a transição ser legível.
  useEffect(() => {
    if (!advancing) return;
    const timer = window.setTimeout(() => onConfirm(picks), 820);
    return () => window.clearTimeout(timer);
  }, [advancing, onConfirm, picks]);

  const previewPlayers = useMemo(
    () => new Map(picks.map((entry) => [entry.slotId, squad.players.find((player) => player.id === entry.playerId)!])),
    [picks, squad.players],
  );
  const positioned = combined.flatMap((entry) => {
    const player = previewPlayers.get(entry.slotId) ?? playersById.get(entry.playerId);
    return player ? [{ player, slotId: entry.slotId }] : [];
  });
  const overall = positioned.length ? calculateTeamOverall(positioned, campaign.formation!, campaign.tactic!) : undefined;
  const rivalAverage = Math.round(opponents.reduce((sum, team) => sum + team.overall.final, 0) / opponents.length);
  const difficulty = !overall ? "A definir" : overall.final >= rivalAverage + 3 ? "Favorável" : overall.final >= rivalAverage - 2 ? "Equilibrado" : "Exigente";

  const players = useMemo(() => {
    const filtered = filter === "all"
      ? squad.players
      : squad.players.filter((player) => openSlots.some((slot) => evaluatePosition(player, slot).fit !== "improvised"));
    return [...filtered].sort((left, right) => sort === "overall" && showRatings
      ? right.overall - left.overall
      : positionOrder.indexOf(left.primaryPosition) - positionOrder.indexOf(right.primaryPosition) || right.overall - left.overall);
  }, [filter, openSlots, showRatings, sort, squad.players]);

  const assignPlayer = (player: Player, slotId: string) => {
    if (advancing) return;
    const lockedEntry = campaign.lineup.find((entry) => entry.slotId === slotId);
    if (!picks.some((entry) => entry.slotId === slotId) && picks.length >= maxPicks) return;
    if (lockedEntry) onRemoveLineupEntry(slotId);
    // Uma vaga só aceita uma escolha: a decisão sai do estado atual, não do render, para nunca duplicar slotId.
    setPicks((current) => {
      const others = current.filter((entry) => entry.slotId !== slotId);
      return others.length >= maxPicks ? current : [...others, { slotId, playerId: player.id, squadId: squad.id }];
    });
    setSelectedId(undefined);
    setSelectedSlotId(undefined);
  };

  const handleSlot = (slotId: string) => {
    if (advancing) return;
    const ownPick = picks.find((entry) => entry.slotId === slotId);
    const lockedEntry = campaign.lineup.find((entry) => entry.slotId === slotId);
    if (selectedPlayer) return assignPlayer(selectedPlayer, slotId);
    if (ownPick) setPicks((current) => current.filter((entry) => entry.slotId !== slotId));
    else if (lockedEntry) onRemoveLineupEntry(slotId);
    setSelectedSlotId((current) => current === slotId ? undefined : slotId);
  };

  const handlePlayer = (player: Player) => {
    if (advancing || alreadyChosen.has(player.id)) return;
    if (selectedSlotId) return assignPlayer(player, selectedSlotId);
    setSelectedId((current) => current === player.id ? undefined : player.id);
    setMobileTab("pitch");
  };

  const advanceLabel = closesLineup
    ? "Escalação completa · abrindo a análise tática"
    : maxPicks === 1 ? "Escolha confirmada · sorteando o próximo ano" : "Dupla confirmada · sorteando o próximo ano";

  return (
    <main className="draft-screen" id="main">
      <nav className="draft-mobile-tabs" aria-label="Etapas da escalação">
        <button type="button" aria-current={mobileTab === "roster" ? "page" : undefined} className={mobileTab === "roster" ? "is-active" : ""} onClick={() => setMobileTab("roster")}>Elenco</button>
        <button type="button" aria-current={mobileTab === "pitch" ? "page" : undefined} className={mobileTab === "pitch" ? "is-active" : ""} onClick={() => setMobileTab("pitch")}>Campo</button>
        <button type="button" aria-current={mobileTab === "team" ? "page" : undefined} className={mobileTab === "team" ? "is-active" : ""} onClick={() => setMobileTab("team")}>Time · {totalFilled}/11</button>
      </nav>

      <div className={`draft-workspace ${advancing ? "is-advancing" : ""}`}>
        <section className={`draft-column era-column ${mobileTab === "roster" ? "is-mobile-active" : ""}`} aria-label={`Era ${squad.year}`}>
          <header className="era-header">
            <span>ERA SORTEADA</span>
            <div><strong>{squad.year}</strong><h1>{squad.name}</h1></div>
            <p>{squad.context}</p>
          </header>

          <div className="roster-heading">
            <div className="roster-heading__top">
              <div><h2>{maxPicks === 1 ? "Escolha o jogador" : "Escolha 2 jogadores"}</h2><span>{picks.length} de {maxPicks} nesta era · avança sozinho ao completar</span></div>
              <button type="button" className="reroll-action" disabled={!campaign.rerollsLeft || advancing} onClick={onReroll}>
                <ShuffleIcon/>Sortear outro ano<em>{campaign.rerollsLeft}</em>
              </button>
            </div>
            <div className="roster-filters" role="group" aria-label="Filtrar jogadores">
              <button type="button" className={filter === "all" ? "is-active" : ""} onClick={() => setFilter("all")}>Todos</button>
              <button type="button" className={filter === "needed" ? "is-active" : ""} onClick={() => setFilter("needed")}>Posições livres</button>
              <label><span>Ordenar</span><select value={sort} onChange={(event) => setSort(event.target.value as "position" | "overall")}><option value="position">Posição</option>{showRatings && <option value="overall">Overall</option>}</select></label>
            </div>
          </div>

          <div className="roster-scroll">
            {groups.map((group) => {
              const groupPlayers = players.filter((player) => group.positions.includes(player.primaryPosition));
              if (!groupPlayers.length) return null;
              return <section className="roster-group" key={group.title}>
                <h3>{group.title}<span>{groupPlayers.length}</span></h3>
                {groupPlayers.map((player) => {
                  const isPicked = alreadyChosen.has(player.id);
                  const bestFit = openSlots.reduce((best, slot) => Math.min(best, evaluatePosition(player, slot).penalty), 99);
                  return <button type="button" key={player.id} disabled={isPicked || (picks.length >= maxPicks && !isPicked)}
                    className={`player-row ${selectedId === player.id ? "is-selected" : ""} ${isPicked ? "is-picked" : ""}`}
                    onClick={() => handlePlayer(player)} onMouseEnter={() => setHoverId(player.id)} onMouseLeave={() => setHoverId(undefined)}
                    onFocus={() => setHoverId(player.id)} onBlur={() => setHoverId(undefined)} aria-pressed={selectedId === player.id}>
                    <span className="player-row__position">{positionLabels[player.primaryPosition]}</span>
                    <span className="player-row__identity"><b>{player.name}</b><small>{player.secondaryPositions.map((position) => positionLabels[position]).join(" · ") || player.tags[0]}</small></span>
                    <span className={`player-row__fit fit--${bestFit === 0 ? "natural" : bestFit === 2 ? "secondary" : "improvised"}`}>{bestFit <= 2 ? "encaixa" : `−${bestFit}`}</span>
                    {showRatings && <strong>{player.overall}</strong>}{isPicked && <CheckIcon/>}
                  </button>;
                })}
              </section>;
            })}
          </div>
        </section>

        <section className={`draft-column field-column ${mobileTab === "pitch" ? "is-mobile-active" : ""}`} aria-label="Campo e escalação">
          <header className="field-heading"><div><span>FORMAÇÃO {campaign.formation}</span><b>{selectedPlayer ? `Escolha a vaga de ${selectedPlayer.name}` : selectedSlotId ? "Agora escolha um jogador" : "Monte o seu onze"}</b></div><strong>{totalFilled}<small>/11</small></strong></header>
          <Pitch formationId={campaign.formation!} lineup={campaign.lineup} previewPlayers={previewPlayers} selectedPlayer={activePlayer} selectedSlotId={selectedSlotId} onSlotClick={handleSlot} showRatings={showRatings}/>
          <p className="field-hint">Clique no atleta e depois na vaga — ou comece pela vaga. Clique numa peça para trocar ou remover.</p>
        </section>

        <aside className={`draft-column boxscore-column ${mobileTab === "team" ? "is-mobile-active" : ""}`}>
          <div className="boxscore-content">
            <header><span>BOX SCORE · {totalFilled}/11</span><strong>{overall?.final ?? "—"}</strong><small>overall geral</small></header>
            <div className="opponent-read"><span>Força média dos rivais <b>{showRatings ? rivalAverage : "?"}</b></span><span>Dificuldade <b>{difficulty}</b></span></div>
            <div className="sector-bars"><ScoreBar label="Defesa" value={overall?.defense}/><ScoreBar label="Meio" value={overall?.midfield}/><ScoreBar label="Ataque" value={overall?.attack}/><ScoreBar label="Tática" value={overall ? Math.max(0, Math.min(99, 80 + overall.cohesion * 4 + overall.tacticBonus * 3)) : undefined}/></div>
            <div className="lineup-sheet">{formation.slots.map((slot) => {
              const entry = combined.find((item) => item.slotId === slot.id);
              const player = entry ? previewPlayers.get(slot.id) ?? playersById.get(entry.playerId) : undefined;
              const evaluation = player ? evaluatePosition(player, slot) : undefined;
              return <button type="button" key={slot.id} onClick={() => handleSlot(slot.id)} className={evaluation?.fit === "improvised" ? "is-improvised" : ""}><span>{slot.label}</span><b>{player?.name ?? "—"}</b><strong>{showRatings && player ? player.overall - (evaluation?.penalty ?? 0) : player ? "•" : "—"}</strong></button>;
            })}</div>
            {overall && overall.improvisationPenalty > 0 && <p className="improvisation-note">Improvisações reduzem {overall.improvisationPenalty} ponto(s) do cálculo final.</p>}
          </div>
        </aside>
      </div>
      {advancing && <div className="draft-advance" role="status"><span>{advanceLabel}</span><i aria-hidden="true"/></div>}
    </main>
  );
}

function ScoreBar({ label, value }: { label: string; value?: number }) {
  return <div><span>{label}</span><i><b style={{ width: `${value ?? 0}%` }}/></i><strong>{value || "—"}</strong></div>;
}

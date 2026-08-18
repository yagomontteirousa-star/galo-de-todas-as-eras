import type { RivalRosterData } from "@/lib/rival-roster";

export function RivalSquadDisclosure({ rival, className = "" }: { rival: RivalRosterData; className?: string }) {
  return (
    <details className={`rival-roster ${className}`.trim()}>
      <summary>
        <span>Ver elenco do rival</span>
        <small>{rival.name} {rival.year}</small>
      </summary>
      <section className="rival-roster__sheet" aria-label={`Elenco de ${rival.name} em ${rival.year}`}>
        <header>
          <div><b>{rival.name}</b><span>{rival.year}</span></div>
          <dl>
            <div><dt>Formação</dt><dd>{rival.formation}</dd></div>
            <div><dt>Overall</dt><dd>{rival.overall}</dd></div>
          </dl>
        </header>
        <ol className="rival-roster__players">
          {rival.squad.map((player, index) => (
            <li key={`${player.position}-${player.name}-${index}`}>
              <em>{player.position}</em><b>{player.name}</b><strong>{player.overall}</strong>
            </li>
          ))}
        </ol>
      </section>
    </details>
  );
}

import { getCurrentUserMatch, roundLabels } from "@/lib/bracket";
import type { Campaign } from "@/types/game";
import { ArrowIcon, StarMark } from "@/components/ui/Icons";

export function OutcomeScreen({ campaign, outcome, onContinue, onRestart }: { campaign: Campaign; outcome: "victory" | "eliminated" | "champion"; onContinue: () => void; onRestart: () => void }) {
  const next = campaign.bracket ? getCurrentUserMatch(campaign.bracket) : undefined;
  const copy = outcome === "champion" ? { title: "Campeão de todas as eras.", text: "Seu onze impossível atravessou cinco confrontos e escreveu uma campanha que nunca existiu — até agora." } : outcome === "eliminated" ? { title: "A campanha termina aqui.", text: `Você venceu ${campaign.wins} ${campaign.wins === 1 ? "confronto" : "confrontos"}. O futebol cobrou seus detalhes; a próxima combinação pode mudar tudo.` } : { title: "Você segue vivo.", text: next ? `A próxima parada é ${roundLabels[campaign.bracket!.currentRound]} contra ${next.home.isUser ? next.away.name : next.home.name}.` : "A próxima fase já está definida." };
  return (
    <main className={`outcome-screen outcome-screen--${outcome}`} id="main">
      <StarMark className="outcome-mark"/><span>{outcome === "champion" ? "A TAÇA É SUA" : outcome === "eliminated" ? "FIM DE CAMPANHA" : `${campaign.wins}ª VITÓRIA`}</span><h1>{copy.title}</h1><p>{copy.text}</p>
      <div className="outcome-actions">{outcome === "victory" && <button type="button" className="button button--primary" onClick={onContinue}>Ver próxima fase<ArrowIcon/></button>}<button type="button" className={outcome === "victory" ? "button button--quiet" : "button button--primary"} onClick={onRestart}>Nova campanha</button></div>
      <div className="outcome-record"><span>Formação <b>{campaign.formation}</b></span><span>Vitórias <b>{campaign.wins}</b></span><span>Eras usadas <b>{campaign.usedSquadIds.length}</b></span></div>
    </main>
  );
}

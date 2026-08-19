import { getCurrentUserMatch, rivalOf, roundLabels, teamEra, userMatches } from "@/lib/bracket";
import { buildSharedCampaign } from "@/lib/campaign";
import { CampaignArt } from "@/components/game/CampaignArt";
import { ShareActions } from "@/components/game/ShareActions";
import type { Campaign, TeamSnapshot } from "@/types/game";
import { ArrowIcon } from "@/components/ui/Icons";
import { BrandMark, SiteFooter } from "@/components/ui/Brand";
import { RivalSquadDisclosure } from "@/components/game/RivalSquadDisclosure";
import { rivalRosterFromTeam } from "@/lib/rival-roster";

export function OutcomeScreen({ campaign, outcome, onContinue, onRestart }: {
  campaign: Campaign;
  outcome: "victory" | "eliminated" | "champion";
  onContinue: () => void;
  onRestart: () => void;
}) {
  const next = campaign.bracket ? getCurrentUserMatch(campaign.bracket) : undefined;
  const played = userMatches(campaign.bracket);
  const lastMatch = played.find((match) => match.id === campaign.lastMatchId) ?? played[played.length - 1];
  const result = lastMatch?.result;
  const homeTotal = result ? result.homeScore + result.homeExtra : 0;
  const awayTotal = result ? result.awayScore + result.awayExtra : 0;
  const userTeam: TeamSnapshot | undefined = lastMatch?.home.isUser ? lastMatch.home : lastMatch?.away;
  const opponent = lastMatch?.home.isUser ? lastMatch.away : lastMatch?.home;
  const goals = result?.events.filter((event) => event.type === "goal") ?? [];
  const goalLine = (teamId?: string) => teamId === lastMatch?.home.id ? lastMatch?.home.name : lastMatch?.away.name;

  if (outcome !== "victory") {
    return <CampaignReport campaign={campaign} outcome={outcome} userTeam={userTeam} onContinue={onContinue} onRestart={onRestart}/>;
  }

  return (
    <main className="outcome-screen outcome-screen--victory" id="main">
      <section className="outcome-summary">
        <div className="outcome-monogram"><BrandMark size={44}/></div>
        <span>{campaign.wins}ª vitória</span>
        <h1>Classificado.</h1>
        <p>{next ? `A próxima página é ${roundLabels[campaign.bracket!.currentRound]} contra ${rivalOf(next).name}.` : "A próxima fase já está definida."}</p>
        <div className="outcome-actions">
          <button type="button" className="button button--primary" onClick={onContinue}>Próxima fase<ArrowIcon/></button>
          <button type="button" className="button button--quiet" onClick={onRestart}>Nova campanha</button>
        </div>
      </section>
      <aside className="result-sheet">
        <header><span>{lastMatch ? roundLabels[lastMatch.round] : "Resultado"}</span><b>{lastMatch && `${teamEra(lastMatch.home)} · ${teamEra(lastMatch.away)}`}</b></header>
        <div className="result-score"><div><small>{lastMatch?.home.name}</small><strong>{homeTotal}</strong></div><i>×</i><div><small>{lastMatch?.away.name}</small><strong>{awayTotal}</strong></div></div>
        {result?.wentToPenalties && <p className="penalty-result">Pênaltis · {result.homePenalties} a {result.awayPenalties}</p>}
        <div className="result-facts">
          <div><span>Overall</span><b>{userTeam?.overall.final ?? "·"} × {opponent?.overall.final ?? "·"}</b></div>
          <div><span>Melhor em campo</span><b>{result?.playerOfMatch ?? "·"}</b></div>
          <div><span>Impacto tático</span><b>{result?.instructionImpact ?? "Plano mantido do começo ao fim."}</b></div>
        </div>
        <div className="result-goals"><span>Gols</span>{goals.length ? goals.map((goal) => <p key={goal.id}><time>{goal.minute}′</time><b>{goal.playerName}</b><small>{goalLine(goal.teamId)}{goal.assistName ? ` · Assistência: ${goal.assistName}` : ""}</small></p>) : <p>Sem gols no tempo de jogo.</p>}</div>
        {opponent && <RivalSquadDisclosure rival={rivalRosterFromTeam(opponent)} className="rival-roster--outcome"/>}
      </aside>
      <SiteFooter/>
    </main>
  );
}

function CampaignReport({ campaign, outcome, userTeam, onContinue, onRestart }: {
  campaign: Campaign;
  outcome: "eliminated" | "champion";
  userTeam?: TeamSnapshot;
  onContinue: () => void;
  onRestart: () => void;
}) {
  const champion = outcome === "champion";
  const shared = userTeam ? buildSharedCampaign(campaign, userTeam) : null;

  if (!shared) {
    return (
      <main className={`outcome-screen campaign-report campaign-report--${outcome}`} id="main">
        <div className={champion ? "champion-scene" : "farewell-scene"} aria-hidden="true"/>
        <section className="report-card">
          <header className="report-head">
            <BrandMark size={44}/>
            <div>
              <span className="report-eyebrow">Fim de campanha</span>
              <h1>O arquivo fecha aqui.</h1>
            </div>
          </header>
          <p className="report-years">Esta campanha não guardou a escalação, então o retrospecto não pôde ser montado.</p>
          <div className="outcome-actions">
            <button type="button" className="button button--quiet" onClick={onContinue}>Ver a chave</button>
            <button type="button" className="button button--primary" onClick={onRestart}>Nova campanha</button>
          </div>
          <SiteFooter/>
        </section>
      </main>
    );
  }

  return (
    <main className={`outcome-screen campaign-report campaign-report--${outcome}`} id="main">
      <div className={champion ? "champion-scene" : "farewell-scene"} aria-hidden="true"/>
      <section className="report-card">
        <CampaignArt data={shared}>
          <ShareActions data={shared}>
            <button type="button" className="button button--quiet" onClick={onContinue}>Ver a chave</button>
            <button type="button" className="button button--quiet" onClick={onRestart}>Começar nova campanha</button>
          </ShareActions>
        </CampaignArt>
        <SiteFooter/>
      </section>
    </main>
  );
}

import { getCurrentUserMatch, roundLabels } from "@/lib/bracket";
import { tacticLabels } from "@/data/formations";
import type { BracketMatch, Campaign, TeamSnapshot } from "@/types/game";
import type { CSSProperties } from "react";
import { useState } from "react";
import { ArrowIcon } from "@/components/ui/Icons";
import { BrandMark, SiteFooter } from "@/components/ui/Brand";

const SHARE_URL = "https://pretonobranco.app";

function userMatches(campaign: Campaign): BracketMatch[] {
  return (campaign.bracket?.rounds ?? [])
    .flatMap((round) => round.matches)
    .filter((match) => (match.home.isUser || match.away.isUser) && match.result);
}

const rivalOf = (match: BracketMatch) => match.home.isUser ? match.away : match.home;

function scoreOf(match: BracketMatch) {
  const result = match.result!;
  const user = match.home.isUser ? result.homeScore + result.homeExtra : result.awayScore + result.awayExtra;
  const rival = match.home.isUser ? result.awayScore + result.awayExtra : result.homeScore + result.homeExtra;
  const pens = result.wentToPenalties
    ? match.home.isUser
      ? ` (${result.homePenalties} a ${result.awayPenalties} nos pênaltis)`
      : ` (${result.awayPenalties} a ${result.homePenalties} nos pênaltis)`
    : "";
  return { user, rival, pens, won: result.winnerId === "user-team" };
}

export function OutcomeScreen({ campaign, outcome, onContinue, onRestart }: {
  campaign: Campaign;
  outcome: "victory" | "eliminated" | "champion";
  onContinue: () => void;
  onRestart: () => void;
}) {
  const next = campaign.bracket ? getCurrentUserMatch(campaign.bracket) : undefined;
  const played = userMatches(campaign);
  const lastMatch = played.find((match) => match.id === campaign.lastMatchId) ?? played[played.length - 1];
  const result = lastMatch?.result;
  const homeTotal = result ? result.homeScore + result.homeExtra : 0;
  const awayTotal = result ? result.awayScore + result.awayExtra : 0;
  const userTeam: TeamSnapshot | undefined = lastMatch?.home.isUser ? lastMatch.home : lastMatch?.away;
  const opponent = lastMatch?.home.isUser ? lastMatch.away : lastMatch?.home;
  const goals = result?.events.filter((event) => event.type === "goal") ?? [];
  const goalLine = (teamId?: string) => teamId === lastMatch?.home.id ? lastMatch?.home.name : lastMatch?.away.name;

  if (outcome !== "victory") {
    return <CampaignReport campaign={campaign} outcome={outcome} played={played} userTeam={userTeam} onContinue={onContinue} onRestart={onRestart}/>;
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
        <header><span>{lastMatch ? roundLabels[lastMatch.round] : "Resultado"}</span><b>{lastMatch?.home.year} · {lastMatch?.away.year}</b></header>
        <div className="result-score"><div><small>{lastMatch?.home.name}</small><strong>{homeTotal}</strong></div><i>×</i><div><small>{lastMatch?.away.name}</small><strong>{awayTotal}</strong></div></div>
        {result?.wentToPenalties && <p className="penalty-result">Pênaltis · {result.homePenalties} a {result.awayPenalties}</p>}
        <div className="result-facts">
          <div><span>Overall</span><b>{userTeam?.overall.final ?? "·"} × {opponent?.overall.final ?? "·"}</b></div>
          <div><span>Melhor em campo</span><b>{result?.playerOfMatch ?? "·"}</b></div>
          <div><span>Impacto tático</span><b>{result?.instructionImpact ?? "Plano mantido do começo ao fim."}</b></div>
        </div>
        <div className="result-goals"><span>Gols</span>{goals.length ? goals.map((goal) => <p key={goal.id}><time>{goal.minute}′</time><b>{goal.playerName}</b><small>{goalLine(goal.teamId)}</small></p>) : <p>Sem gols no tempo de jogo.</p>}</div>
      </aside>
      <SiteFooter/>
    </main>
  );
}

function CampaignReport({ campaign, outcome, played, userTeam, onContinue, onRestart }: {
  campaign: Campaign;
  outcome: "eliminated" | "champion";
  played: BracketMatch[];
  userTeam?: TeamSnapshot;
  onContinue: () => void;
  onRestart: () => void;
}) {
  const [shareState, setShareState] = useState<"idle" | "copied" | "failed">("idle");
  const champion = outcome === "champion";
  const phase = champion ? "Campeão" : roundLabels[campaign.bracket?.currentRound ?? "round16"];
  const tactic = campaign.tactic ? tacticLabels[campaign.tactic].name : "·";
  const years = played.map((match) => rivalOf(match).year);
  const best = [...(userTeam?.overall.evaluations ?? [])].sort((left, right) => right.adjustedOverall - left.adjustedOverall).slice(0, 4);
  const topRating = best[0]?.adjustedOverall ?? 99;

  const shareText = [
    champion ? "Campeão com o Galo no Preto no Branco." : `Caí nas ${phase.toLowerCase()} no Preto no Branco.`,
    `${campaign.wins} ${campaign.wins === 1 ? "vitória" : "vitórias"} · overall ${userTeam?.overall.final ?? "?"} · ${campaign.formation ?? ""} ${tactic.toLowerCase()}`,
    years.length ? `Peguei ${years.join(", ")}.` : "",
    SHARE_URL,
  ].filter(Boolean).join("\n");

  const share = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "Preto no Branco", text: shareText, url: SHARE_URL });
        return;
      }
      await navigator.clipboard.writeText(shareText);
      setShareState("copied");
    } catch { setShareState("failed"); }
  };

  return (
    <main className={`outcome-screen campaign-report campaign-report--${outcome}`} id="main">
      <div className={champion ? "champion-scene" : "farewell-scene"} aria-hidden="true"/>
      <section className="report-card">
        <header className="report-head">
          <BrandMark size={40}/>
          <div>
            <span className="report-eyebrow">{champion ? "Campeão" : "Fim de campanha"}</span>
            <h1>{champion ? "A taça é do Galo." : "O arquivo fecha aqui."}</h1>
          </div>
        </header>

        <dl className="report-facts">
          <div><dt>Fase</dt><dd>{phase}</dd></div>
          <div><dt>Vitórias</dt><dd>{campaign.wins}</dd></div>
          <div><dt>Overall</dt><dd>{userTeam?.overall.final ?? "·"}</dd></div>
          <div><dt>Formação</dt><dd>{campaign.formation ?? "·"}</dd></div>
          <div><dt>Perfil</dt><dd>{tactic}</dd></div>
        </dl>

        <div className="report-grid">
          <section className="report-block">
            <h2>A campanha</h2>
            <ul className="report-runs">
              {played.map((match) => {
                const { user, rival, pens, won } = scoreOf(match);
                return (
                  <li key={match.id} className={won ? "is-win" : "is-loss"}>
                    <em>{roundLabels[match.round]}</em>
                    <b>{user} a {rival}</b>
                    <span>{rivalOf(match).name} {rivalOf(match).year}{pens}</span>
                  </li>
                );
              })}
              {!played.length && <li><span>Nenhum jogo disputado.</span></li>}
            </ul>
          </section>

          <section className="report-block">
            <h2>Nomes da campanha</h2>
            <ul className="report-stars">
              {best.map((entry) => (
                <li key={entry.slot.id} style={{ "--force": `${Math.round((entry.adjustedOverall / topRating) * 100)}%` } as CSSProperties}>
                  <b>{entry.player.name}</b>
                  <em>{entry.slot.label} · {entry.player.season}</em>
                  <strong>{entry.adjustedOverall}</strong>
                  <i aria-hidden="true"/>
                </li>
              ))}
              {!best.length && <li><b>Elenco não registrado.</b></li>}
            </ul>
            {years.length > 0 && <p className="report-years">Anos enfrentados: {years.join(", ")}.</p>}
          </section>
        </div>

        <div className="outcome-actions">
          <button type="button" className="button button--primary" onClick={share}>
            {shareState === "copied" ? "Resultado copiado" : shareState === "failed" ? "Copie pela barra do navegador" : "Compartilhar resultado"}
          </button>
          <button type="button" className="button button--quiet" onClick={onContinue}>Ver a chave</button>
          <button type="button" className="button button--quiet" onClick={onRestart}>Nova campanha</button>
        </div>
        <SiteFooter/>
      </section>
    </main>
  );
}

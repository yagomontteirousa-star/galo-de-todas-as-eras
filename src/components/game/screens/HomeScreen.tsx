"use client";

import { useState, useSyncExternalStore } from "react";
import { Pitch } from "@/components/game/Pitch";
import { ArrowIcon, CloseIcon } from "@/components/ui/Icons";
import { SiteFooter } from "@/components/ui/Brand";
import { LivePlayers } from "@/components/game/LivePlayers";
import Image from "next/image";
import { atleticoSquads } from "@/data/atletico-squads";
import { formations } from "@/data/formations";
import { evaluatePosition } from "@/lib/overall";
import type { CampaignOutcome, CampaignRecord, LineupEntry } from "@/types/game";

/**
 * Vitrine da home: ídolos reais da base ocupando parte do 4-3-3 e o resto em aberto,
 * para a campanha parecer começada mas ainda por montar.
 */
const showcase: LineupEntry[] = (() => {
  const open = ["gk", "lcb", "lcm", "lw", "st"];
  const pool = atleticoSquads.flatMap((squad) => squad.players.map((player) => ({ player, squadId: squad.id })));
  const used = new Set<string>();
  return open.flatMap((slotId) => {
    const slot = formations["4-3-3"].slots.find((item) => item.id === slotId)!;
    const best = pool
      .filter((entry) => !used.has(entry.player.id) && evaluatePosition(entry.player, slot).fit === "natural")
      .sort((a, b) => b.player.overall - a.player.overall)[0];
    if (!best) return [];
    used.add(best.player.id);
    return [{ slotId, playerId: best.player.id, squadId: best.squadId }];
  });
})();

const RELEASE_KEY = "preto-no-branco:release-squad-v1";

export function HomeScreen({ onStart, onResume, canResume, onReviewLast, onReviewHistory, lastOutcome, history, livePlayers, onReplayTutorial }: {
  onStart: () => void;
  onResume: () => void;
  canResume: boolean;
  onReviewLast: () => void;
  onReviewHistory: (record: CampaignRecord) => void;
  lastOutcome?: CampaignOutcome;
  history: CampaignRecord[];
  livePlayers?: number;
  onReplayTutorial?: () => void;
}) {
  const releaseSeen = useSyncExternalStore(
    () => () => {},
    () => { try { return window.localStorage.getItem(RELEASE_KEY) === "seen"; } catch { return false; } },
    () => false,
  );
  const [dismissedRelease, setDismissedRelease] = useState(false);
  const showRelease = !releaseSeen && !dismissedRelease;
  const dismissRelease = () => {
    setDismissedRelease(true);
    try { window.localStorage.setItem(RELEASE_KEY, "seen"); } catch { /* o aviso não bloqueia quem navega sem armazenamento */ }
  };
  const finished = !canResume && Boolean(lastOutcome);
  const lead = canResume
    ? "Sua campanha está aberta. Volte para o ponto onde parou."
    : finished
      ? "A última campanha está guardada. Reveja o retrospecto ou comece outra."
      : "Sorteie anos do Galo, escolha os nomes certos e atravesse quatro fases até o título.";

  return (
    <main className="home-screen" id="main">
      <section className="home-panel">
        <div className="home-copy">
          <Image className="home-brand" src="/icon.svg" alt="" width={54} height={59} priority unoptimized/>
          <h1>Preto<br/>no Branco.</h1>
          <p className="home-signature">Monte elencos. Atravesse eras. Faça história.</p>
          <p className="home-lead">{lead}</p>

          <div className="home-actions">
            {canResume && <button className="button button--primary" type="button" onClick={onResume}>Continuar campanha<ArrowIcon/></button>}
            {finished && <button className="button button--primary" type="button" onClick={onReviewLast}>Última campanha<ArrowIcon/></button>}
            {!canResume && (
              <button className={`button ${finished ? "button--quiet" : "button--primary"}`} type="button" onClick={onStart}>
                Começar campanha{finished ? null : <ArrowIcon/>}
              </button>
            )}
            {canResume && <button className="button button--quiet" type="button" onClick={onStart}>Nova campanha</button>}
          </div>

          {showRelease && <aside className="release-note" aria-labelledby="release-note-title">
            <div className="release-note__head">
              <h2 id="release-note-title">Novidades em campo</h2>
              <button type="button" onClick={dismissRelease} aria-label="Fechar novidades"><CloseIcon/></button>
            </div>
            <p>Agora sua campanha tem banco de reservas e uma escalação antes de cada jogo.</p>
            <ul>
              <li>Escolha 11 titulares e 7 reservas.</li>
              <li>Faça até cinco substituições no intervalo.</li>
              <li>Expulsão deixa o atleta fora da rodada seguinte.</li>
              <li>Gols agora registram quem deu a assistência.</li>
            </ul>
          </aside>}

          <div className="home-links">
            {canResume && lastOutcome && <button type="button" className="new-run-link" onClick={onReviewLast}>Ver a última campanha</button>}
            {onReplayTutorial && <button type="button" className="new-run-link" onClick={onReplayTutorial}>Ver o tutorial</button>}
          </div>
          <LivePlayers count={livePlayers}/>

          {history.length === 0 && <p className="home-empty">{canResume ? "Nenhuma campanha concluída no arquivo ainda." : "Nenhuma campanha no arquivo ainda. A primeira súmula é sua."}</p>}
        </div>

        <div className="home-pitch">
          <Pitch formationId="4-3-3" lineup={showcase}/>
          <p>Onze em aberto. O sorteio decide quem entra.</p>
        </div>
      </section>

      <section className="how-it-works" id="como-funciona">
        <ol>
          <li><b>01</b><strong>Sorteie um ano</strong><span>Um elenco inteiro do Galo entra em jogo.</span></li>
          <li><b>02</b><strong>Escale os jogadores</strong><span>Encaixe talento, posição e tática.</span></li>
          <li><b>03</b><strong>Suba a campanha</strong><span>Das oitavas à final, quatro jogos até a taça.</span></li>
        </ol>
      </section>
      <SiteFooter/>
    </main>
  );
}

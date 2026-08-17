import { Pitch } from "@/components/game/Pitch";
import { ArrowIcon } from "@/components/ui/Icons";

export function HomeScreen({ onStart, onResume, canResume }: { onStart: () => void; onResume: () => void; canResume: boolean }) {
  return (
    <main className="home-screen" id="main">
      <section className="hero-game">
        <div className="hero-game__copy">
          <h1>Preto<br/>no Branco.</h1>
          <p className="hero-game__signature">Monte elencos. Atravesse eras. Faça história.</p>
          <p>Receba temporadas históricas, escolha os nomes certos e atravesse cinco fases contra grandes times brasileiros.</p>
          <div className="hero-game__actions">
            <button className="button button--primary" type="button" onClick={canResume ? onResume : onStart}>{canResume ? "Continuar campanha" : "Começar campanha"}<ArrowIcon/></button>
            <button className="button button--quiet" type="button" onClick={() => document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" })}>Como funciona</button>
          </div>
          {canResume && <button type="button" className="new-run-link" onClick={onStart}>Ou começar uma nova campanha</button>}
        </div>
        <div className="hero-game__visual" aria-hidden="true">
          <div className="era-stamp era-stamp--one">1971</div><div className="era-stamp era-stamp--two">2013</div><div className="era-stamp era-stamp--three">2021</div>
          <div className="hero-pitch"><Pitch formationId="4-3-3" compact/></div>
          <div className="hero-score"><span>FINAL</span><strong>?</strong><i>×</i><strong>?</strong></div>
          <div className="hero-bracket">{Array.from({ length: 10 }, (_, i) => <span key={i}/>)}</div>
        </div>
      </section>
      <section className="how-it-works" id="como-funciona">
        <ol>
          <li><b>01</b><strong>Sorteie uma era</strong><span>Um elenco completo entra em jogo.</span></li>
          <li><b>02</b><strong>Escale os jogadores</strong><span>Encaixe talento, posição e tática.</span></li>
          <li><b>03</b><strong>Simule a campanha</strong><span>Cinco jogos separam você do título.</span></li>
        </ol>
      </section>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowIcon } from "@/components/ui/Icons";
import { BrandMark, SiteFooter } from "@/components/ui/Brand";
import styles from "./multiplayer.module.css";

export const metadata: Metadata = {
  title: "Multiplayer em pausa | Preto no Branco",
  description: "O multiplayer está temporariamente pausado. A campanha solo continua disponível.",
};

export default function MultiplayerPage() {
  return (
    <main className={styles.page} id="main">
      <section className={styles.content} aria-labelledby="multiplayer-paused-title">
        <Link href="/" className="multiplayer-brand" aria-label="Voltar para a página inicial">
          <BrandMark size={44}/>
          <span>Preto no Branco</span>
        </Link>
        <div>
          <h1 id="multiplayer-paused-title">O multiplayer está no vestiário.</h1>
          <p>As salas estão pausadas enquanto preparamos a próxima versão. A campanha solo continua disponível normalmente.</p>
        </div>
        <Link href="/" className="button button--primary">Jogar campanha solo<ArrowIcon/></Link>
      </section>
      <SiteFooter/>
    </main>
  );
}

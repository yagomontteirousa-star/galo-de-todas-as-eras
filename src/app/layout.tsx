import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Preto no Branco",
  description: "Monte elencos, atravesse eras e faça história em um mata-mata de futebol brasileiro.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b0c0c" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>
    <template id="design-contract" dangerouslySetInnerHTML={{ __html: `<!--
THESIS: Uma súmula viva transforma arquivo histórico em decisão instantânea; recusamos o dashboard genérico e a landing longa.
OWN-WORLD: Grafite fosco, papel off-white, campo verde profundo, linhas de tabela e dourado reservado a anos e conquistas.
STORY: O jogador sorteia uma era, lê o elenco, ocupa o campo, entende sua força e avança sem perder o contexto.
FIRST VIEWPORT: Header baixo; elenco à esquerda, campo vertical dominante ao centro e box score com CTA fixo à direita.
FORM: Prancheta de transmissão e caderno de súmula, direção fixada pelo briefing; seed 142d43f7.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
-->` }}/>
    {children}
  </body></html>;
}

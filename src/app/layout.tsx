import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";

/** Grotesca esportiva para a operação; a condensada dá o tom de placar e súmula. */
const sans = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sans", display: "swap" });
const condensed = Barlow_Condensed({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-cond", display: "swap" });

const SITE_URL = "https://pretonobranco.app";
const TITLE = "Preto no Branco";
const DESCRIPTION = "Monte elencos, atravesse eras e faça história em um mata-mata de futebol brasileiro.";

/**
 * `metadataBase` resolve as URLs absolutas que as redes exigem, e as imagens de prévia
 * vêm das convenções `opengraph-image` e `twitter-image` na raiz de app/.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: TITLE,
  openGraph: {
    type: "website",
    siteName: TITLE,
    locale: "pt_BR",
    url: SITE_URL,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b0c0c" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" className={`${sans.variable} ${condensed.variable}`}><body>
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

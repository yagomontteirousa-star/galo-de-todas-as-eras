import type { Metadata } from "next";
import Link from "next/link";
import { CampaignArt } from "@/components/game/CampaignArt";
import { ShareActions } from "@/components/game/ShareActions";
import { BrandMark, SiteFooter } from "@/components/ui/Brand";
import { decodeCampaign, shareMessage, SITE_DESCRIPTION, SITE_TITLE } from "@/lib/share";
import { looksLikeShareId, readSharedCampaign } from "@/lib/share-store";
import type { SharedCampaign } from "@/lib/share";

/**
 * Dois formatos convivem no mesmo endereço: id curto guardado no servidor e o payload
 * longo dos links já enviados. O id é tentado primeiro porque é o formato novo.
 */
async function loadCampaign(token: string): Promise<SharedCampaign | null> {
  if (looksLikeShareId(token)) {
    const stored = await readSharedCampaign(token);
    if (stored) return stored;
  }
  return decodeCampaign(token);
}

type Params = { params: Promise<{ payload: string }> };

/**
 * A capa continua sendo a arte oficial do site; só o texto muda com o resultado, que é o
 * que aparece na prévia do WhatsApp, do Discord e das redes.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const data = await loadCampaign((await params).payload);
  const { title, description } = data ? shareMessage(data) : { title: SITE_TITLE, description: SITE_DESCRIPTION };
  // Declarar openGraph aqui substitui o do layout inteiro, então a capa volta explícita:
  // é sempre a arte oficial, só o texto muda com o resultado.
  const image = { url: "/opengraph-image", width: 1200, height: 630, alt: SITE_TITLE };
  return {
    title,
    description,
    openGraph: { type: "website", siteName: SITE_TITLE, locale: "pt_BR", title, description, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function SharedCampaignPage({ params }: Params) {
  const data = await loadCampaign((await params).payload);

  if (!data) {
    return (
      <main className="screen shared-error" id="main">
        <BrandMark size={64}/>
        <h1>Este link não abriu.</h1>
        <p>O endereço pode ter sido cortado ao ser colado, ou é de uma versão antiga do jogo. Peça o link de novo para quem compartilhou.</p>
        <Link className="button button--primary" href="/">Começar uma campanha</Link>
        <SiteFooter/>
      </main>
    );
  }

  const champion = data.outcome === "champion";
  return (
    <main className={`outcome-screen campaign-report campaign-report--${champion ? "champion" : "eliminated"} is-shared`} id="main">
      <div className={champion ? "champion-scene" : "farewell-scene"} aria-hidden="true"/>
      <section className="report-card">
        <CampaignArt data={data}>
          <ShareActions data={data}>
            {/* Campanha nova começa do zero no aparelho de quem abriu, sem tocar neste link. */}
            <Link className="button button--primary" href="/?nova=1">Começar nova campanha</Link>
          </ShareActions>
        </CampaignArt>
        <SiteFooter/>
      </section>
    </main>
  );
}

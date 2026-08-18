import { CampaignArt } from "@/components/game/CampaignArt";
import { ShareActions } from "@/components/game/ShareActions";
import { SiteFooter } from "@/components/ui/Brand";
import type { SharedCampaign } from "@/lib/share";

export function CampaignSnapshotScreen({ data, onBack, onRestart }: {
  data: SharedCampaign;
  onBack: () => void;
  onRestart: () => void;
}) {
  const champion = data.outcome === "champion";
  return (
    <main className={`outcome-screen campaign-report campaign-report--${champion ? "champion" : "eliminated"}`} id="main">
      <div className={champion ? "champion-scene" : "farewell-scene"} aria-hidden="true"/>
      <section className="report-card">
        <CampaignArt data={data}>
          <ShareActions data={data}>
            <button type="button" className="button button--quiet" onClick={onBack}>Voltar à home</button>
            <button type="button" className="button button--quiet" onClick={onRestart}>Começar nova campanha</button>
          </ShareActions>
        </CampaignArt>
        <SiteFooter/>
      </section>
    </main>
  );
}

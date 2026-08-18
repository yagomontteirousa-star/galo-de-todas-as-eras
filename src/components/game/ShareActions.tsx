"use client";

import { useState } from "react";
import { shareMessage, shareText, shortCampaignUrl, type SharedCampaign } from "@/lib/share";

type Feedback = "idle" | "copied" | "linked" | "image" | "link-failed" | "image-failed";

/**
 * Cópia que ainda funciona onde a Clipboard API não existe (http, WebView antiga). Sem
 * isso o botão de compartilhar teria só o caminho feliz.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* segue para o modo antigo */ }
  try {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.cssText = "position:fixed;top:0;left:-9999px;opacity:0";
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(field);
    return copied;
  } catch { return false; }
}

export function ShareActions({ data, children }: { data: SharedCampaign; children?: React.ReactNode }) {
  const [feedback, setFeedback] = useState<Feedback>("idle");
  const [busy, setBusy] = useState<"link" | "image">();

  const buildUrl = async () => {
    setBusy("link");
    try { return await shortCampaignUrl(data, window.location.origin); }
    finally { setBusy(undefined); }
  };

  const share = async () => {
    let url: string;
    try { url = await buildUrl(); }
    catch { setFeedback("link-failed"); return; }
    const text = shareText(data, url);
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: shareMessage(data).title, text, url });
        return;
      } catch (error) {
        // Fechar a folha de compartilhamento não é falha: não há nada a avisar.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    setFeedback(await copyText(text) ? "copied" : "link-failed");
  };

  const copyLink = async () => {
    try {
      const url = await buildUrl();
      setFeedback(await copyText(url) ? "linked" : "link-failed");
    } catch { setFeedback("link-failed"); }
  };

  const saveImage = async () => {
    setBusy("image");
    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("image-failed");
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `preto-no-branco-${data.outcome === "champion" ? "campeao" : data.runnerUp ? "vice" : "campanha"}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 1000);
      setFeedback("image");
    } catch { setFeedback("image-failed"); }
    finally { setBusy(undefined); }
  };

  return (
    <div className="share-panel">
      <div className="outcome-actions">
        <button type="button" className="button button--primary" disabled={Boolean(busy)} onClick={share}>{busy === "link" ? "Criando link curto" : "Compartilhar resultado"}</button>
        <button type="button" className="button button--quiet" disabled={Boolean(busy)} onClick={copyLink}>Copiar link</button>
        <button type="button" className="button button--quiet" disabled={Boolean(busy)} onClick={saveImage}>{busy === "image" ? "Gerando PNG" : "Baixar imagem"}</button>
        {children}
      </div>
      <p className="share-feedback" role="status" aria-live="polite">
        {feedback === "copied" && "Resultado copiado. É só colar."}
        {feedback === "linked" && "Link copiado. Quem abrir vê esta campanha."}
        {feedback === "image" && "Imagem pronta em PNG, 1080 × 1350."}
        {feedback === "link-failed" && "O link curto está indisponível. Nenhum endereço longo foi criado."}
        {feedback === "image-failed" && "A imagem não foi gerada. Tente novamente."}
      </p>
    </div>
  );
}

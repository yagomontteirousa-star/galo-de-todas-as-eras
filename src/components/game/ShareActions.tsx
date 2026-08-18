"use client";

import { useState } from "react";
import { shareMessage, shareText, shortCampaignUrl, type SharedCampaign } from "@/lib/share";

type Feedback = "idle" | "copied" | "linked" | "failed";

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
  const [link, setLink] = useState<string>();

  // O link é comprimido, então nasce assíncrono. Só os cliques precisam dele, e a origem
  // real do navegador faz o compartilhamento funcionar também fora de produção.
  const buildUrl = async () => {
    const { url } = await shortCampaignUrl(data, typeof window === "undefined" ? undefined : window.location.origin);
    setLink(url);
    return url;
  };

  const share = async () => {
    const url = await buildUrl();
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
    setFeedback(await copyText(text) ? "copied" : "failed");
  };

  const copyLink = async () => {
    const url = await buildUrl();
    setFeedback(await copyText(url) ? "linked" : "failed");
  };

  const saveImage = () => {
    // A capa é a arte oficial do site: abrir em aba própria deixa salvar ou compartilhar.
    window.open(`${window.location.origin}/opengraph-image`, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <div className="outcome-actions">
        <button type="button" className="button button--primary" onClick={share}>Compartilhar resultado</button>
        <button type="button" className="button button--quiet" onClick={copyLink}>Copiar link</button>
        <button type="button" className="button button--quiet" onClick={saveImage}>Baixar imagem</button>
        {children}
      </div>
      <p className="share-feedback" role="status" aria-live="polite">
        {feedback === "copied" && "Resultado copiado. É só colar."}
        {feedback === "linked" && "Link copiado. Quem abrir vê esta campanha."}
        {feedback === "failed" && <>Não deu para copiar aqui. O link é <code>{link}</code></>}
      </p>
    </>
  );
}

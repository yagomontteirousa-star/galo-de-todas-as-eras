import type { SharedCampaign } from "@/lib/share";

/**
 * Guarda o snapshot da campanha no servidor e devolve um id curto. Funciona com qualquer
 * store compatível com a API REST do Upstash, que é o que a Vercel injeta ao conectar
 * um KV: `KV_REST_API_URL` e `KV_REST_API_TOKEN`. Sem essas variáveis o recurso fica
 * desligado e quem chama cai no link longo, em vez de copiar um endereço quebrado.
 */
const STORE_URL = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const STORE_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

export const shareStoreReady = Boolean(STORE_URL && STORE_TOKEN);

const KEY_PREFIX = "pnb:c:";
/** Alfabeto sem 0/O e 1/l: o id é lido em voz alta e digitado à mão. */
const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ID_LENGTH = 10;

export function newShareId(): string {
  const bytes = new Uint8Array(ID_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

/** Um id de store nunca tem os prefixos de versão do payload longo (2 ou 3). */
export const looksLikeShareId = (value: string) =>
  value.length >= 8 && value.length <= 12 && /^[a-zA-Z2-9]+$/.test(value);

async function store(command: unknown[]): Promise<unknown> {
  if (!shareStoreReady) throw new Error("share store não configurado");
  const response = await fetch(STORE_URL!, {
    method: "POST",
    headers: { Authorization: `Bearer ${STORE_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`share store respondeu ${response.status}`);
  const payload = await response.json() as { result?: unknown };
  return payload.result;
}

/** O snapshot é imutável: gravamos só se o id ainda não existir. */
export async function saveSharedCampaign(data: SharedCampaign): Promise<string> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const id = newShareId();
    const created = await store(["SET", KEY_PREFIX + id, JSON.stringify(data), "NX"]);
    if (created) return id;
  }
  throw new Error("não foi possível gerar um id livre");
}

export async function readSharedCampaign(id: string): Promise<SharedCampaign | null> {
  if (!shareStoreReady || !looksLikeShareId(id)) return null;
  try {
    const raw = await store(["GET", KEY_PREFIX + id]);
    return typeof raw === "string" ? JSON.parse(raw) as SharedCampaign : null;
  } catch { return null; }
}

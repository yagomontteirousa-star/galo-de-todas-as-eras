import { NextResponse } from "next/server";

const STORE_URL = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const STORE_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const PRESENCE_KEY = "pnb:presence";
const ACTIVE_FOR_MS = 90_000;

const validVisitor = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9-]{16,64}$/.test(value);

async function command(args: (string | number)[]) {
  const response = await fetch(STORE_URL!, {
    method: "POST",
    headers: { Authorization: `Bearer ${STORE_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`presence store respondeu ${response.status}`);
  return (await response.json() as { result?: unknown }).result;
}

/** Presença anônima: apenas um id local temporário e uma janela curta no Redis. */
export async function POST(request: Request) {
  if (!STORE_URL || !STORE_TOKEN) return NextResponse.json({ available: false }, { headers: { "Cache-Control": "no-store" } });
  try {
    const body: unknown = await request.json();
    const visitor = body && typeof body === "object" ? (body as { visitor?: unknown }).visitor : undefined;
    if (!validVisitor(visitor)) return NextResponse.json({ error: "visitante-invalido" }, { status: 400 });
    const now = Date.now();
    await command(["ZADD", PRESENCE_KEY, now, visitor]);
    await command(["ZREMRANGEBYSCORE", PRESENCE_KEY, 0, now - ACTIVE_FOR_MS]);
    const count = await command(["ZCARD", PRESENCE_KEY]);
    await command(["EXPIRE", PRESENCE_KEY, 180]);
    return NextResponse.json({ available: true, count: typeof count === "number" ? count : Number(count) || 0 }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ available: false }, { headers: { "Cache-Control": "no-store" } });
  }
}

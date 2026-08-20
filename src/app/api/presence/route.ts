import { NextResponse } from "next/server";
import { createHash } from "node:crypto";

const STORE_URL = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const STORE_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const PRESENCE_KEY = "pnb:presence";
const PLAYERS_KEY = "pnb:players";
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

const headers = { "Cache-Control": "no-store" };
const anonymousVisitor = (visitor: string) => createHash("sha256").update(visitor).digest("hex");

async function totals(now = Date.now()) {
  await command(["ZREMRANGEBYSCORE", PRESENCE_KEY, 0, now - ACTIVE_FOR_MS]);
  const [current, total] = await Promise.all([
    command(["ZCARD", PRESENCE_KEY]),
    command(["SCARD", PLAYERS_KEY]),
  ]);
  return {
    current: typeof current === "number" ? current : Number(current) || 0,
    total: typeof total === "number" ? total : Number(total) || 0,
  };
}

/** Consulta complementar dos totais sem alterar a presença. */
export async function GET() {
  if (!STORE_URL || !STORE_TOKEN) return NextResponse.json({ available: false }, { headers });
  try {
    return NextResponse.json({ available: true, ...(await totals()) }, { headers });
  } catch {
    return NextResponse.json({ available: false }, { headers });
  }
}

/** Presença anônima: entrada, renovação e saída usam apenas um id aleatório local. */
export async function POST(request: Request) {
  if (!STORE_URL || !STORE_TOKEN) return NextResponse.json({ available: false }, { headers });
  try {
    const body: unknown = await request.json();
    const visitor = body && typeof body === "object" ? (body as { visitor?: unknown }).visitor : undefined;
    const leaving = body && typeof body === "object" && (body as { leaving?: unknown }).leaving === true;
    if (!validVisitor(visitor)) return NextResponse.json({ error: "visitante-invalido" }, { status: 400, headers });
    if (leaving) {
      await command(["ZREM", PRESENCE_KEY, visitor]);
      return NextResponse.json({ available: true, ...(await totals()) }, { headers });
    }
    const now = Date.now();
    await command(["ZADD", PRESENCE_KEY, now, visitor]);
    await command(["SADD", PLAYERS_KEY, anonymousVisitor(visitor)]);
    await command(["EXPIRE", PRESENCE_KEY, 180]);
    return NextResponse.json({ available: true, ...(await totals(now)) }, { headers });
  } catch {
    return NextResponse.json({ available: false }, { headers });
  }
}

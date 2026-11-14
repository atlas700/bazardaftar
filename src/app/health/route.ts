import { db } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$client.query({ text: "select 1", query_timeout: 5000 });
    return Response.json({ status: "ok" }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable" }, {
      status: 503, headers: { "cache-control": "no-store" },
    });
  }
}

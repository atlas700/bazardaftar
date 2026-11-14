import { db } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // pg supports per-query timeouts, but its QueryConfig types omit this option.
    const query = { text: "select 1", query_timeout: 5000 };
    await db.$client.query(query);
    return Response.json({ status: "ok" }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable" }, {
      status: 503, headers: { "cache-control": "no-store" },
    });
  }
}

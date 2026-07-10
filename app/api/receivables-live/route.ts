import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildReceivablesUrl(baseUrl: string) {
  const url = new URL(baseUrl);
  url.searchParams.set("mode", "receivables");
  return url.toString();
}

export async function GET() {
  const baseUrl = process.env.OPS_RECEIVABLES_WEBAPP_URL;

  if (!baseUrl) {
    return NextResponse.json(
      { ok: false, configured: false, message: "OPS_RECEIVABLES_WEBAPP_URL is not configured." },
      { status: 200 }
    );
  }

  try {
    const response = await fetch(buildReceivablesUrl(baseUrl), { cache: "no-store" });
    const text = await response.text();

    try {
      const payload = JSON.parse(text);
      return NextResponse.json({ ok: response.ok, configured: true, status: response.status, payload });
    } catch {
      return NextResponse.json(
        {
          ok: false,
          configured: true,
          status: response.status,
          message: "Receivables web app did not return JSON. Check Apps Script JSON mode deployment.",
          responseText: text.slice(0, 500)
        },
        { status: 200 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        configured: true,
        message: error instanceof Error ? error.message : "Failed to fetch receivables web app."
      },
      { status: 200 }
    );
  }
}

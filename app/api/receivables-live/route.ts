import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate"
};

function buildReceivablesUrl(baseUrl: string) {
  const url = new URL(baseUrl);
  if (!url.searchParams.has("mode")) {
    url.searchParams.set("mode", "receivables");
  }
  url.searchParams.set("_opsTs", String(Date.now()));
  return url.toString();
}

function getReceivablesWebAppUrl() {
  return (
    process.env.OPS_RECEIVABLES_WEBAPP_URL ||
    process.env.RECEIVABLES_WEBAPP_URL ||
    process.env.NEXT_PUBLIC_RECEIVABLES_WEBAPP_URL ||
    ""
  );
}

export async function GET() {
  const baseUrl = getReceivablesWebAppUrl();

  if (!baseUrl) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        message: "OPS_RECEIVABLES_WEBAPP_URL is not configured.",
        expectedEnv: "OPS_RECEIVABLES_WEBAPP_URL"
      },
      { status: 200, headers: noStoreHeaders }
    );
  }

  try {
    const requestUrl = buildReceivablesUrl(baseUrl);
    const response = await fetch(requestUrl, {
      cache: "no-store",
      headers: { Accept: "application/json" }
    });
    const text = await response.text();

    try {
      const payload = JSON.parse(text);
      const records =
        Array.isArray(payload?.records) ? payload.records :
        Array.isArray(payload?.data?.records) ? payload.data.records :
        [];
      return NextResponse.json(
        {
          ok: response.ok,
          configured: true,
          status: response.status,
          recordCount: records.length,
          updatedAt: payload?.updatedAt ?? payload?.data?.updatedAt ?? null,
          payload
        },
        { headers: noStoreHeaders }
      );
    } catch {
      return NextResponse.json(
        {
          ok: false,
          configured: true,
          status: response.status,
          message: "Receivables web app did not return JSON. Check Apps Script JSON mode deployment.",
          responseText: text.slice(0, 500)
        },
        { status: 200, headers: noStoreHeaders }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        configured: true,
        message: error instanceof Error ? error.message : "Failed to fetch receivables web app."
      },
      { status: 200, headers: noStoreHeaders }
    );
  }
}

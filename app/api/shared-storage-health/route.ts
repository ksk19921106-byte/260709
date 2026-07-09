import { NextResponse } from "next/server";
import { debugSharedStorageConnection } from "../../services/sharedStorageServer";

export const runtime = "nodejs";

export async function GET() {
  const result = await debugSharedStorageConnection("requests");
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

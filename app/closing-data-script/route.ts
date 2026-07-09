import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  buildTradeCloseSummary,
  getTradeCloseSummaryForUser,
  type TradeCloseRecord
} from "../services/tradeClose";

export const runtime = "nodejs";

const dataPath = path.join(process.cwd(), "data", "trade-close-records.json");

async function readRecords(): Promise<TradeCloseRecord[]> {
  try {
    return JSON.parse(await readFile(dataPath, "utf8")) as TradeCloseRecord[];
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const callback = url.searchParams.get("callback") ?? "__icbanqTradeCloseCallback";
  const user = url.searchParams.get("user");
  const dashboard = buildTradeCloseSummary(await readRecords());
  const payload = {
    ...dashboard,
    currentUser: user ? getTradeCloseSummaryForUser(dashboard, user) : undefined
  };

  return new Response(`window.${callback}(${JSON.stringify(payload)});`, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}


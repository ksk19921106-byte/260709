import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { MonthEndGateStatus } from "../../../services/monthEndGate";
import { buildTradeCloseSummary, getTradeCloseSummaryForUser, type TradeCloseRecord } from "../../../services/tradeClose";

export const runtime = "nodejs";

const blockedUsersPath = path.join(process.cwd(), "data", "blocked-users.json");
const tradeClosePath = path.join(process.cwd(), "data", "trade-close-records.json");
const monthEndSnapshotPath = path.join(process.cwd(), "data", "month-end-snapshot.json");

async function readBlockedUsers(): Promise<Record<string, MonthEndGateStatus>> {
  try {
    return JSON.parse(await readFile(blockedUsersPath, "utf8")) as Record<string, MonthEndGateStatus>;
  } catch {
    return {};
  }
}

async function readTradeCloseRecords(): Promise<TradeCloseRecord[]> {
  try {
    return JSON.parse(await readFile(tradeClosePath, "utf8")) as TradeCloseRecord[];
  } catch {
    return [];
  }
}

async function readMonthEndSnapshotIssues(): Promise<Array<{ fSales?: string; iSales?: string; status?: string; issueType?: string; amount?: number }>> {
  try {
    const snapshot = JSON.parse(await readFile(monthEndSnapshotPath, "utf8")) as {
      issues?: Array<{ fSales?: string; iSales?: string; status?: string; issueType?: string; amount?: number }>;
    };
    return snapshot.issues ?? [];
  } catch {
    return [];
  }
}

async function writeBlockedUsers(users: Record<string, MonthEndGateStatus>) {
  await mkdir(path.dirname(blockedUsersPath), { recursive: true });
  await writeFile(blockedUsersPath, JSON.stringify(users, null, 2), "utf8");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const user = url.searchParams.get("user");
  const users = await readBlockedUsers();
  const tradeCloseDashboard = buildTradeCloseSummary(await readTradeCloseRecords());
  const monthEndIssues = (await readMonthEndSnapshotIssues()).filter((issue) => issue.status !== "done" && issue.issueType !== "collection_check");

  if (!user) {
    const tradeBlockedUsers = Object.fromEntries(
      tradeCloseDashboard.users.filter((item) => item.unresolvedCount > 0).map((item) => [item.salesOwner, "BLOCK" as MonthEndGateStatus])
    );
    const monthEndBlockedUsers = Object.fromEntries(
      Array.from(new Set(monthEndIssues.flatMap((issue) => [issue.iSales, issue.fSales]).filter(Boolean) as string[])).map((salesName) => [salesName, "BLOCK" as MonthEndGateStatus])
    );
    return NextResponse.json({ users: { ...users, ...tradeBlockedUsers, ...monthEndBlockedUsers }, tradeClose: tradeCloseDashboard });
  }

  const tradeClose = getTradeCloseSummaryForUser(tradeCloseDashboard, user);
  const monthEndUserIssues = monthEndIssues.filter((issue) => issue.iSales === user || issue.fSales === user);
  const tradeBlocked = tradeClose.unresolvedCount > 0;
  const monthEndBlocked = monthEndUserIssues.length > 0;
  const manualBlocked = users[user] === "BLOCK";
  const status = manualBlocked || tradeBlocked || monthEndBlocked ? "BLOCK" : "OK";

  return NextResponse.json({
    user,
    status,
    isBlocked: status === "BLOCK",
    blockedReason: tradeBlocked || monthEndBlocked ? "tradeClose" : manualBlocked ? "manual" : undefined,
    unresolvedCount: tradeClose.unresolvedCount + monthEndUserIssues.length,
    healthScore: tradeClose.healthScore
  });
}

export async function PATCH(request: Request) {
  const payload = (await request.json()) as { user?: string; status?: MonthEndGateStatus };

  if (!payload.user || (payload.status !== "OK" && payload.status !== "BLOCK")) {
    return NextResponse.json({ message: "Invalid blocked user payload" }, { status: 400 });
  }

  const users = await readBlockedUsers();
  users[payload.user] = payload.status;
  await writeBlockedUsers(users);

  return NextResponse.json({
    users,
    item: {
      user: payload.user,
      status: payload.status,
      isBlocked: payload.status === "BLOCK"
    }
  });
}


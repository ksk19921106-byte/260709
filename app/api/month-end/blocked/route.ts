import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { MonthEndGateStatus } from "../../../services/monthEndGate";
import { buildTradeCloseSummary, getTradeCloseSummaryForUser, type TradeCloseRecord } from "../../../services/tradeClose";
import { readSharedCollection, writeSharedCollection } from "../../../services/sharedStorageServer";

export const runtime = "nodejs";

const blockedUsersPath = path.join(process.cwd(), "data", "blocked-users.json");
const tradeClosePath = path.join(process.cwd(), "data", "trade-close-records.json");
const monthEndSnapshotPath = path.join(process.cwd(), "data", "month-end-snapshot.json");
const visibleMonthEndIssueTypes = new Set(["invoice_required", "shipment_check", "long_pending"]);

async function readBlockedUsers(): Promise<Record<string, MonthEndGateStatus>> {
  const sharedUsers = await readSharedCollection<Record<string, MonthEndGateStatus>>("blockedUsers");
  if (sharedUsers && typeof sharedUsers === "object" && !Array.isArray(sharedUsers)) {
    return sharedUsers;
  }

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
  const sharedSnapshot = await readSharedCollection<{
    issues?: Array<{ fSales?: string; iSales?: string; status?: string; issueType?: string; amount?: number }>;
  }>("monthEndSnapshot");
  if (sharedSnapshot?.issues) {
    return sharedSnapshot.issues;
  }

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
  await writeSharedCollection("blockedUsers", users);

  try {
    await mkdir(path.dirname(blockedUsersPath), { recursive: true });
    await writeFile(blockedUsersPath, JSON.stringify(users, null, 2), "utf8");
  } catch {
    // Vercel file system is not persistent. Shared storage is used when configured.
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const user = url.searchParams.get("user");
  const users = await readBlockedUsers();
  const tradeCloseDashboard = buildTradeCloseSummary(await readTradeCloseRecords());
  const monthEndIssues = (await readMonthEndSnapshotIssues()).filter((issue) => issue.status === "open" && visibleMonthEndIssueTypes.has(String(issue.issueType)));

  if (!user) {
    return NextResponse.json({
      users,
      effectiveUsers: users,
      tradeClose: tradeCloseDashboard
    });
  }

  const tradeClose = getTradeCloseSummaryForUser(tradeCloseDashboard, user);
  const monthEndUserIssues = monthEndIssues.filter((issue) => issue.iSales === user || issue.fSales === user);
  const hasManualStatus = Object.prototype.hasOwnProperty.call(users, user);
  const manualStatus = users[user];
  const status: MonthEndGateStatus = hasManualStatus ? manualStatus : "OK";

  return NextResponse.json({
    user,
    status,
    isBlocked: status === "BLOCK",
    blockedReason: status === "BLOCK" ? "manual" : undefined,
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


import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import type { ClosingSnapshot } from "../../services/closingPasteParser";
import { readSharedCollection, writeSharedCollection } from "../../services/sharedStorageServer";

export const runtime = "nodejs";

const snapshotPath = path.join(process.cwd(), "data", "month-end-snapshot.json");
const historyPath = path.join(process.cwd(), "data", "month-end-snapshots.json");

async function readSnapshotFile() {
  const sharedSnapshot = await readSharedCollection<ClosingSnapshot>("monthEndSnapshot");
  if (isValidSnapshot(sharedSnapshot)) return sharedSnapshot;

  try {
    const raw = await readFile(snapshotPath, "utf8");
    return JSON.parse(raw) as ClosingSnapshot;
  } catch {
    return null;
  }
}

function snapshotMonth(snapshot: ClosingSnapshot) {
  const raw = String(snapshot.closingMonth || snapshot.uploadedAt || "");
  const match = raw.match(/(20\d{2})[-./년\s]*(0?[1-9]|1[0-2])/);
  if (!match) return "";
  return `${match[1]}-${String(Number(match[2])).padStart(2, "0")}`;
}

function latestSnapshot(snapshots: ClosingSnapshot[]) {
  return [...snapshots].sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)))[0] ?? null;
}

async function readHistoryFile() {
  const sharedHistory = await readSharedCollection<ClosingSnapshot[]>("monthEndSnapshots");
  if (Array.isArray(sharedHistory)) return sharedHistory.filter(isValidSnapshot);

  try {
    const raw = await readFile(historyPath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(isValidSnapshot);
  } catch {
    // Fall back to the legacy latest snapshot below.
  }

  const latest = await readSnapshotFile();
  return latest ? [latest] : [];
}

async function writeHistoryFile(history: ClosingSnapshot[]) {
  await writeSharedCollection("monthEndSnapshots", history);

  try {
    await mkdir(path.dirname(historyPath), { recursive: true });
    await writeFile(historyPath, JSON.stringify(history, null, 2), "utf8");
  } catch {
    // Vercel file system is not persistent. Shared storage is used when configured.
  }
}

function isValidSnapshot(value: unknown): value is ClosingSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<ClosingSnapshot>;
  return Boolean(snapshot.id && snapshot.uploadedAt && snapshot.uploadedBy && Array.isArray(snapshot.issues));
}

export async function GET(request: NextRequest) {
  const month = request.nextUrl.searchParams.get("month");
  const history = await readHistoryFile();
  const scopedHistory = month ? history.filter((snapshot) => snapshotMonth(snapshot) === month) : history;
  const snapshot = latestSnapshot(scopedHistory) ?? await readSnapshotFile();
  return NextResponse.json({ snapshot, history });
}

export async function POST(request: NextRequest) {
  const snapshot = await request.json();

  if (!isValidSnapshot(snapshot)) {
    return NextResponse.json({ message: "Invalid month-end snapshot" }, { status: 400 });
  }

  await writeSharedCollection("monthEndSnapshot", snapshot);
  const history = await readHistoryFile();
  const nextHistory = [snapshot, ...history.filter((item) => item.id !== snapshot.id)];
  await writeHistoryFile(nextHistory);

  try {
    await mkdir(path.dirname(snapshotPath), { recursive: true });
    await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2), "utf8");
  } catch {
    // Vercel file system is not persistent. Shared storage is used when configured.
  }

  return NextResponse.json({ ok: true, snapshot });
}


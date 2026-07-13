import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { readSharedCollection, writeSharedCollection } from "../../services/sharedStorageServer";

export const runtime = "nodejs";

type ReceivablesMatchingSnapshot = {
  id: string;
  uploadedAt: string;
  uploadedBy: string;
  demo: {
    orders: unknown[];
    payments: unknown[];
    matches: unknown[];
  };
  assignments: Record<string, string>;
};

const snapshotPath = path.join(process.cwd(), "data", "receivables-matching.json");

function isValidSnapshot(value: unknown): value is ReceivablesMatchingSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<ReceivablesMatchingSnapshot>;
  return Boolean(
    snapshot.id &&
    snapshot.uploadedAt &&
    snapshot.uploadedBy &&
    snapshot.demo &&
    Array.isArray(snapshot.demo.orders) &&
    Array.isArray(snapshot.demo.payments) &&
    Array.isArray(snapshot.demo.matches) &&
    snapshot.assignments &&
    typeof snapshot.assignments === "object"
  );
}

async function readSnapshotFile() {
  const sharedSnapshot = await readSharedCollection<ReceivablesMatchingSnapshot>("receivablesMatching");
  if (isValidSnapshot(sharedSnapshot)) return sharedSnapshot;

  try {
    const raw = await readFile(snapshotPath, "utf8");
    const snapshot = JSON.parse(raw);
    return isValidSnapshot(snapshot) ? snapshot : null;
  } catch {
    return null;
  }
}

async function writeSnapshotFile(snapshot: ReceivablesMatchingSnapshot) {
  await writeSharedCollection("receivablesMatching", snapshot);

  try {
    await mkdir(path.dirname(snapshotPath), { recursive: true });
    await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2), "utf8");
  } catch {
    // Vercel file system is not persistent. Shared storage is used when configured.
  }
}

export async function GET() {
  return NextResponse.json({ snapshot: await readSnapshotFile() });
}

export async function POST(request: NextRequest) {
  const snapshot = await request.json();

  if (!isValidSnapshot(snapshot)) {
    return NextResponse.json({ message: "Invalid receivables matching snapshot" }, { status: 400 });
  }

  await writeSnapshotFile(snapshot);
  return NextResponse.json({ ok: true, snapshot });
}

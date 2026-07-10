import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import type { ReceivableRecord } from "../../services/receivables";
import { readSharedCollection, writeSharedCollection } from "../../services/sharedStorageServer";

export const runtime = "nodejs";

type ReceivablesStatusSnapshot = {
  id: string;
  uploadedAt: string;
  uploadedBy: string;
  sourceType?: "paste" | "file";
  records: ReceivableRecord[];
};

const snapshotPath = path.join(process.cwd(), "data", "receivables-status.json");

function isValidSnapshot(value: unknown): value is ReceivablesStatusSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<ReceivablesStatusSnapshot>;
  return Boolean(snapshot.id && snapshot.uploadedAt && snapshot.uploadedBy && Array.isArray(snapshot.records));
}

async function readSnapshotFile() {
  const sharedSnapshot = await readSharedCollection<ReceivablesStatusSnapshot>("receivablesStatus");
  if (isValidSnapshot(sharedSnapshot)) return sharedSnapshot;

  try {
    const raw = await readFile(snapshotPath, "utf8");
    const snapshot = JSON.parse(raw);
    return isValidSnapshot(snapshot) ? snapshot : null;
  } catch {
    return null;
  }
}

async function writeSnapshotFile(snapshot: ReceivablesStatusSnapshot) {
  await writeSharedCollection("receivablesStatus", snapshot);

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
    return NextResponse.json({ message: "Invalid receivables status snapshot" }, { status: 400 });
  }

  await writeSnapshotFile(snapshot);
  return NextResponse.json({ ok: true, snapshot });
}

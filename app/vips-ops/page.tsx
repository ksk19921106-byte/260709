"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  PackageCheck,
  ShieldAlert,
  ShipWheel,
  Truck,
  UsersRound,
  WalletCards,
  X,
  type LucideIcon
} from "lucide-react";
import { AccessDenied } from "../components/AccessDenied";
import { ModulePage } from "../components/ModulePage";
import { TEST_USERS, useSelectedUser } from "../hooks/useSelectedUser";
import { REQUEST_FORM_CONFIGS } from "../services/formValidation";
import { fetchRequests, type RequestItem, type RequestStatus } from "../services/requestStorage";
import { buildCollectionComposition, normalizeSalesName, receivableRecords, type ReceivableRecord } from "../services/receivables";
import type { ClosingIssue, ClosingSnapshot } from "../services/closingPasteParser";
import { fetchBlockedUsers, updateBlockedUser, type BlockedUserMap, type MonthEndGateStatus } from "../services/monthEndGate";
import { fetchMonthEndRmaSnapshot, type MonthEndRmaSnapshot, type MonthEndRmaRecord } from "../services/monthEndRma";
import {
  fetchMonthEndActionRequests,
  updateMonthEndActionRequestStatus,
  type MonthEndActionRequest,
  type MonthEndActionStatus
} from "../services/monthEndActionStorage";

type StatusTone = "blue" | "orange" | "red" | "green" | "gray";
type IssueStatus = "normal" | "attention" | "needCheck";
type GatekeeperRow = {
  name: string;
  team: string;
  issueCount: number;
  issueAmount: number;
  manualStatus: MonthEndGateStatus;
  effectiveStatus: MonthEndGateStatus;
};

const salesMetrics = [
  {
    name: "Lauren",
    team: "B2D",
    monthEndCount: 4,
    monthEndAmount: 31594963,
    collectionCount: 2,
    collectionAmount: 8968520,
    status: "needCheck" as IssueStatus
  },
  {
    name: "Harvey",
    team: "B2D",
    monthEndCount: 1,
    monthEndAmount: 2508220,
    collectionCount: 1,
    collectionAmount: 3675419,
    status: "attention" as IssueStatus
  },
  {
    name: "Riley",
    team: "B2D",
    monthEndCount: 1,
    monthEndAmount: 1429024,
    collectionCount: 0,
    collectionAmount: 0,
    status: "attention" as IssueStatus
  },
  {
    name: "Jake",
    team: "S1",
    monthEndCount: 2,
    monthEndAmount: 75000,
    collectionCount: 1,
    collectionAmount: 1429024,
    status: "normal" as IssueStatus
  }
];

const teamMetrics = [
  {
    team: "B2D",
    members: ["Harvey", "Lauren", "Riley"],
    monthEndCount: 6,
    monthEndAmount: 79475205,
    collectionCount: 3,
    collectionAmount: 14367650,
    status: "needCheck" as IssueStatus,
    risk: "30일 이상 미수 존재"
  },
  {
    team: "S1",
    members: ["Jake", "Terry"],
    monthEndCount: 2,
    monthEndAmount: 75000,
    collectionCount: 1,
    collectionAmount: 1429024,
    status: "attention" as IssueStatus,
    risk: "월마감 확인 필요"
  }
];

const salesTeamMap: Record<string, string> = {
  Jake: "S1",
  Terry: "S1",
  Harvey: "B2D",
  Lauren: "B2D",
  Riley: "B2D",
  Chris: "S3",
  Robin: "S3"
};

const teamRoster = [
  { team: "S1", members: ["Jake", "Terry"] },
  { team: "S2", members: [] },
  { team: "S3", members: ["Chris", "Robin"] },
  { team: "B2D", members: ["Harvey", "Lauren", "Riley"] }
];

const highValueThreshold = 10000000;

function krw(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function requesterKey(value: string) {
  return String(value || "").trim().toLowerCase();
}

function requestForSales(requests: RequestItem[], salesName: string) {
  const user = TEST_USERS.find((item) => item.name === salesName);
  if (!user) return [];
  return requests.filter((item) => {
    const requester = requesterKey(item.requester);
    return requester === user.name.toLowerCase() || requester === user.email.toLowerCase();
  });
}

function requestsForTeam(requests: RequestItem[], members: string[]) {
  return requests.filter((item) => members.some((member) => requestForSales([item], member).length > 0));
}

function statusBucket(status: RequestStatus | string) {
  const text = String(status);
  if (text.includes("완료") || text.includes("?꾨즺")) return "done";
  if (text.includes("반려") || text.includes("諛섎젮")) return "rejected";
  if (text.includes("처리") || text.includes("확인") || text.includes("VIPS")) return "processing";
  return "received";
}

function countByStatus(items: RequestItem[]) {
  return items.reduce(
    (acc, item) => {
      acc[statusBucket(item.status)] += 1;
      return acc;
    },
    { received: 0, processing: 0, done: 0, rejected: 0 }
  );
}

function todayText() {
  const now = new Date();
  return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
}

function isToday(item: RequestItem) {
  return String(item.requestedAt || "").startsWith(todayText());
}

function toneClass(tone: StatusTone) {
  if (tone === "red") return "bg-[#fff5ec] text-[#F39945]";
  if (tone === "orange") return "bg-[#fff5ec] text-[#F39945]";
  if (tone === "green") return "bg-[#edf4ff] text-[#1D50A2]";
  if (tone === "gray") return "bg-[#f1f5f9] text-[#64748b]";
  return "bg-[#edf4ff] text-[#1D50A2]";
}

function statusLabel(status: IssueStatus) {
  if (status === "needCheck") return "확인 필요";
  if (status === "attention") return "주의";
  return "정상";
}

function statusTone(status: IssueStatus): StatusTone {
  if (status === "needCheck") return "red";
  if (status === "attention") return "orange";
  return "green";
}

function openRequestStatus(params: Record<string, string> = {}) {
  const search = new URLSearchParams({ user: "Sally", scope: "opsAll", ...params });
  window.location.href = `/request-status?${search.toString()}`;
}

function teamRequesterParam(members: string[]) {
  return TEST_USERS.filter((user) => members.includes(user.name)).map((user) => user.email).join(",");
}

function requestPersonParam(members: string[]) {
  return members.join(",");
}

function goMonthEnd(team?: string, sales?: string) {
  const search = new URLSearchParams({ user: "Sally" });
  if (team) search.set("team", team);
  if (sales) search.set("sales", sales);
  window.location.href = `/month-end?${search.toString()}`;
}

function goCollections(team?: string, sales?: string) {
  const search = new URLSearchParams({ user: "Sally" });
  if (team) search.set("team", team);
  if (sales) search.set("sales", sales);
  window.location.href = `/collections?${search.toString()}`;
}

function salesTeam(name: string) {
  return salesTeamMap[name] ?? "S3";
}

function openClosingIssues(snapshot: ClosingSnapshot | null) {
  return (snapshot?.issues ?? []).filter((issue) => issue.status === "open" && issue.issueType !== "collection_check");
}

function issuesForSales(issues: ClosingIssue[], salesName: string) {
  return issues.filter((issue) => issue.iSales === salesName || issue.fSales === salesName);
}

function collectionRecordsForSales(records: ReceivableRecord[], salesName: string) {
  return records.filter((record) => normalizeSalesName(record.sales) === salesName || normalizeSalesName(record.fSales) === salesName);
}

function collectionRiskRecords(records: ReceivableRecord[]) {
  return records.filter((record) => record.diff > 0 && (record.overdueDays >= 30 || record.diff >= highValueThreshold));
}

function rejectionRate(requests: RequestItem[]) {
  if (requests.length === 0) return 0;
  const rejected = requests.filter((item) => statusBucket(item.status) === "rejected").length;
  return Math.round((rejected / requests.length) * 1000) / 10;
}

function closingRate(issueCount: number) {
  return Math.max(0, Math.min(100, 100 - issueCount * 12));
}

function KpiCard({
  icon: Icon,
  label,
  value,
  helper,
  tone,
  onClick
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  helper: string;
  tone: StatusTone;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "article";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className="ops-card min-w-0 p-4 text-left transition hover:border-[#cfe0ff] hover:shadow-[0_10px_24px_rgba(15,23,42,0.06)]"
    >
      <div className={`ops-icon-circle ${toneClass(tone)}`}>
        <Icon size={23} />
      </div>
      <p className="mt-3 truncate text-[12px] font-[850] text-[#64748b]">{label}</p>
      <p className="mt-1 truncate text-[25px] font-[950] leading-none tracking-[-0.03em] text-[#111827]">{value}</p>
      <p className="mt-2 truncate text-[11px] font-[800] text-[#94a3b8]">{helper}</p>
    </Tag>
  );
}

type MonthEndOpsCardKey = "invoice_required" | "shipment_check" | "long_pending" | "rma" | "customs";

type MonthEndOpsCard = {
  key: MonthEndOpsCardKey;
  icon: LucideIcon;
  title: string;
  count: number;
  amount: number;
  helper?: string;
  issues?: ClosingIssue[];
  rmaRecords?: MonthEndRmaRecord[];
};

function issueAmount(issues: ClosingIssue[]) {
  return issues.reduce((sum, issue) => sum + issue.amount, 0);
}

function buildMonthEndOpsCards(issues: ClosingIssue[], rmaRecords: MonthEndRmaRecord[]): MonthEndOpsCard[] {
  const invoiceIssues = issues.filter((issue) => issue.issueType === "invoice_required");
  const shipmentIssues = issues.filter((issue) => issue.issueType === "shipment_check");
  const longPendingIssues = issues.filter((issue) => issue.issueType === "long_pending");

  return [
    {
      key: "invoice_required",
      icon: FileText,
      title: "세금계산서 미발행",
      count: invoiceIssues.length,
      amount: issueAmount(invoiceIssues),
      issues: invoiceIssues
    },
    {
      key: "shipment_check",
      icon: Truck,
      title: "미출고",
      count: shipmentIssues.length,
      amount: issueAmount(shipmentIssues),
      issues: shipmentIssues
    },
    {
      key: "long_pending",
      icon: PackageCheck,
      title: "출고/세금계산서 발행 대기",
      count: longPendingIssues.length,
      amount: issueAmount(longPendingIssues),
      helper: "상태: 입고 완료",
      issues: longPendingIssues
    },
    {
      key: "rma",
      icon: ShipWheel,
      title: "RMA 미처리 내역",
      count: rmaRecords.length,
      amount: 0,
      rmaRecords
    },
    {
      key: "customs",
      icon: ShieldAlert,
      title: "관세미수금",
      count: 0,
      amount: 0,
      issues: []
    }
  ];
}

function MonthEndOpsSummary({
  cards,
  onSelect
}: {
  cards: MonthEndOpsCard[];
  onSelect: (card: MonthEndOpsCard) => void;
}) {
  return (
    <section className="ops-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-[950] uppercase tracking-[0.08em] text-[#1D50A2]">MONTH-END CHECK</p>
          <h2 className="mt-1 text-[20px] font-[950] tracking-[-0.03em] text-[#111827]">월마감 체크</h2>
        </div>
        <p className="hidden text-[13px] font-[750] text-[#64748b] sm:block">카드를 클릭하면 하위 리스트가 열립니다.</p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;
          const isPrimary = card.key === "long_pending";
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => onSelect(card)}
              className={`min-h-[160px] rounded-[10px] border bg-white p-4 text-left transition hover:border-[#1D50A2] hover:shadow-[0_10px_24px_rgba(15,23,42,0.06)] ${
                isPrimary ? "border-[#2f80ff] bg-[#fbfdff]" : "border-[#eef2f7]"
              }`}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f8fafc] text-[#4b5563]">
                <Icon size={18} />
              </div>
              <p className="mt-4 min-h-[38px] text-[13px] font-[850] leading-[19px] text-[#374151]">{card.title}</p>
              <p className="mt-2 text-[28px] font-[950] tracking-[-0.04em] text-[#C7312E]">{card.count}건</p>
              <p className="mt-1 truncate text-[12px] font-[750] text-[#94a3b8]">{card.helper ?? krw(card.amount)}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MonthEndIssueModal({
  card,
  onClose
}: {
  card: MonthEndOpsCard | null;
  onClose: () => void;
}) {
  if (!card) return null;
  const isRma = card.key === "rma";
  const issues = card.issues ?? [];
  const rmaRecords = card.rmaRecords ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/35 px-4 py-6">
      <section className="max-h-[86vh] w-full max-w-[1080px] overflow-hidden rounded-[28px] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.24)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#edf2f8] px-6 py-5">
          <div>
            <p className="text-[11px] font-[950] uppercase tracking-[0.08em] text-[#1D50A2]">MONTH-END LIST</p>
            <h3 className="mt-1 text-[24px] font-[950] tracking-[-0.03em] text-[#111827]">{card.title}</h3>
            <p className="mt-1 text-[13px] font-[750] text-[#64748b]">총 {card.count}건 · {card.amount > 0 ? krw(card.amount) : "목록 확인"}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f8fafc] text-[#64748b] transition hover:bg-[#edf4ff] hover:text-[#1D50A2]">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[64vh] overflow-auto p-5">
          {isRma ? (
            <table className="w-full min-w-[760px] border-separate border-spacing-0 overflow-hidden rounded-[18px] border border-[#edf2f8] text-left">
              <thead className="bg-[#f8fafc] text-[12px] font-[900] text-[#475569]">
                <tr>
                  <th className="px-4 py-3">Sales</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">P.status</th>
                  <th className="px-4 py-3">W.status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf2f8] text-[13px] font-[750] text-[#334155]">
                {rmaRecords.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-10 text-center text-[#94a3b8]">표시할 RMA 미처리 내역이 없습니다.</td></tr>
                ) : (
                  rmaRecords.map((record) => (
                    <tr key={record.id}>
                      <td className="px-4 py-3 font-[950] text-[#111827]">{record.sales}</td>
                      <td className="px-4 py-3">{record.supplier}</td>
                      <td className="px-4 py-3">{record.purchaseStatus || "-"}</td>
                      <td className="px-4 py-3">{record.warehouseStatus || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[900px] border-separate border-spacing-0 overflow-hidden rounded-[18px] border border-[#edf2f8] text-left">
              <thead className="bg-[#f8fafc] text-[12px] font-[900] text-[#475569]">
                <tr>
                  <th className="px-4 py-3">ISales</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3">업체명</th>
                  <th className="px-4 py-3">금액</th>
                  <th className="px-4 py-3">GPD</th>
                  <th className="px-4 py-3">GP</th>
                  <th className="px-4 py-3">미출고기간</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf2f8] text-[13px] font-[750] text-[#334155]">
                {issues.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-[#94a3b8]">표시할 월마감 이슈가 없습니다.</td></tr>
                ) : (
                  issues.map((issue) => (
                    <tr key={issue.id}>
                      <td className="px-4 py-3 font-[950] text-[#111827]">{issue.iSales || "-"}</td>
                      <td className="px-4 py-3">{issue.issueLabel}</td>
                      <td className="px-4 py-3 font-[900] text-[#111827]">{issue.company}</td>
                      <td className="px-4 py-3">{krw(issue.amount)}</td>
                      <td className="px-4 py-3">{krw(issue.gpdAmount ?? 0)}</td>
                      <td className="px-4 py-3">{issue.gpRate != null ? `${issue.gpRate}%` : "-"}</td>
                      <td className="px-4 py-3">{issue.issueType === "invoice_required" ? "-" : `${issue.shipmentDays ?? 0}일`}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

type CollectionOpsCardKey = "total" | "unpaid" | "matching";

type CollectionOpsCard = {
  key: CollectionOpsCardKey;
  title: string;
  value: string;
  helper: string;
  records: ReceivableRecord[];
};

function matchingPendingRecords(records: ReceivableRecord[]) {
  return records.filter((record) => record.status === "부분수금" || record.gubun === "신규매칭" || record.gubun === "담당자미매칭");
}

function buildCollectionOpsCards(records: ReceivableRecord[]): CollectionOpsCard[] {
  const openRecords = records.filter((record) => record.status !== "완료" || record.diff > 0);
  const unpaidRecords = records.filter((record) => record.status === "미수" && record.diff > 0);
  const matchingRecords = matchingPendingRecords(records);
  const totalAmount = openRecords.reduce((sum, record) => sum + Math.max(record.diff, record.expected), 0);
  const unpaidAmount = unpaidRecords.reduce((sum, record) => sum + record.diff, 0);
  const allExpected = records.reduce((sum, record) => sum + record.expected, 0);

  return [
    {
      key: "total",
      title: "전체 금액 및 건수",
      value: krw(totalAmount),
      helper: `${openRecords.length}건`,
      records: openRecords
    },
    {
      key: "unpaid",
      title: "미수 금액 및 건수",
      value: krw(unpaidAmount),
      helper: `${unpaidRecords.length}건 · 전체 대비 ${allExpected > 0 ? Math.round((unpaidAmount / allExpected) * 100) : 0}%`,
      records: unpaidRecords
    },
    {
      key: "matching",
      title: "수금매칭 대기",
      value: `${matchingRecords.length}건`,
      helper: "무입금 확인 필요",
      records: matchingRecords
    }
  ];
}

function CollectionOpsSummary({
  cards,
  onSelect
}: {
  cards: CollectionOpsCard[];
  onSelect: (card: CollectionOpsCard) => void;
}) {
  return (
    <section className="ops-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-[950] uppercase tracking-[0.08em] text-[#1D50A2]">AR CHECK</p>
          <h2 className="mt-1 text-[20px] font-[950] tracking-[-0.03em] text-[#111827]">AR 체크</h2>
        </div>
        <p className="hidden text-[13px] font-[750] text-[#64748b] sm:block">전월말 수금 현황을 확인합니다.</p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {cards.map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => onSelect(card)}
            className="min-h-[140px] rounded-[10px] border border-[#eef2f7] bg-white p-5 text-left transition hover:border-[#1D50A2] hover:shadow-[0_10px_24px_rgba(15,23,42,0.06)]"
          >
            <p className="text-[15px] font-[850] text-[#64748b]">{card.title}</p>
            <p className={`mt-4 text-[28px] font-[950] tracking-[-0.04em] ${card.key === "unpaid" ? "text-[#A12A2A]" : "text-[#111827]"}`}>{card.value}</p>
            <p className="mt-1 text-[13px] font-[750] text-[#64748b]">{card.helper}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

function CollectionIssueModal({
  card,
  onClose
}: {
  card: CollectionOpsCard | null;
  onClose: () => void;
}) {
  if (!card) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/35 px-4 py-6">
      <section className="max-h-[86vh] w-full max-w-[1080px] overflow-hidden rounded-[28px] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.24)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#edf2f8] px-6 py-5">
          <div>
            <p className="text-[11px] font-[950] uppercase tracking-[0.08em] text-[#1D50A2]">AR LIST</p>
            <h3 className="mt-1 text-[24px] font-[950] tracking-[-0.03em] text-[#111827]">{card.title}</h3>
            <p className="mt-1 text-[13px] font-[750] text-[#64748b]">총 {card.records.length}건 · {card.value}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f8fafc] text-[#64748b] transition hover:bg-[#edf4ff] hover:text-[#1D50A2]">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[64vh] overflow-auto p-5">
          <table className="w-full min-w-[900px] border-separate border-spacing-0 overflow-hidden rounded-[18px] border border-[#edf2f8] text-left">
            <thead className="bg-[#f8fafc] text-[12px] font-[900] text-[#475569]">
              <tr>
                <th className="px-4 py-3">담당자</th>
                <th className="px-4 py-3">거래처</th>
                <th className="px-4 py-3">예정금액</th>
                <th className="px-4 py-3">입금액</th>
                <th className="px-4 py-3">차액</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">경과</th>
                <th className="px-4 py-3">근거</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf2f8] text-[13px] font-[750] text-[#334155]">
              {card.records.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-[#94a3b8]">표시할 수금 이슈가 없습니다.</td></tr>
              ) : (
                card.records.map((record) => (
                  <tr key={record.id}>
                    <td className="px-4 py-3 font-[950] text-[#111827]">{normalizeSalesName(record.sales) || "미매칭"}</td>
                    <td className="px-4 py-3 font-[900] text-[#111827]">{record.name}</td>
                    <td className="px-4 py-3">{krw(record.expected)}</td>
                    <td className="px-4 py-3">{krw(record.paid)}</td>
                    <td className="px-4 py-3 font-[950] text-[#A12A2A]">{krw(record.diff)}</td>
                    <td className="px-4 py-3">{record.status}</td>
                    <td className="px-4 py-3">{record.overdueDays}일</td>
                    <td className="px-4 py-3">{record.basis || record.gubun || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

type TeamOpsMetric = {
  team: string;
  members: string[];
  monthEndCount: number;
  monthEndAmount: number;
  monthEndRate: number;
  collectionIssueCount: number;
  collectionAmount: number;
  collectionRate: number;
  requests: RequestItem[];
  rejectedCount: number;
};

function TeamControlCard({ team }: { team: TeamOpsMetric }) {
  const teamRequests = team.requests;
  const counts = countByStatus(teamRequests);
  const person = requestPersonParam(team.members);
  const needCheck = team.monthEndRate < 50;

  return (
    <article className="rounded-[20px] border border-[#e9eef6] bg-white p-4 shadow-[0_4px_10px_rgba(15,23,42,0.02)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[22px] font-[950] tracking-[-0.03em] text-[#111827]">{team.team}</h3>
            <span className={`rounded-full px-3 py-1 text-[11px] font-[950] ${toneClass(needCheck ? "red" : "green")}`}>{needCheck ? "확인 필요" : "정상"}</span>
          </div>
          <p className="mt-1 truncate text-[12px] font-[750] text-[#64748b]">담당 Sales: {team.members.length > 0 ? team.members.join(" · ") : "미배정"}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={() => goMonthEnd(team.team)} className="rounded-[16px] border border-[#edf2f8] bg-[#fbfcff] p-3 text-left transition hover:border-[#1D50A2] hover:bg-white">
          <p className="text-[11px] font-[850] text-[#64748b]">월마감 이슈</p>
          <p className="mt-1 text-[21px] font-[950] text-[#F39945]">{team.monthEndCount}건</p>
          <p className="mt-1 truncate text-[11px] font-[750] text-[#94a3b8]">진행률 {team.monthEndRate}% · {krw(team.monthEndAmount)}</p>
        </button>
        <button type="button" onClick={() => goCollections(team.team)} className="rounded-[16px] border border-[#edf2f8] bg-[#fbfcff] p-3 text-left transition hover:border-[#1D50A2] hover:bg-white">
          <p className="text-[11px] font-[850] text-[#64748b]">수금 이슈</p>
          <p className="mt-1 text-[21px] font-[950] text-[#F39945]">{team.collectionIssueCount}건</p>
          <p className="mt-1 truncate text-[11px] font-[750] text-[#94a3b8]">{krw(team.collectionAmount)}</p>
        </button>
        <button type="button" onClick={() => openRequestStatus({ team: team.team, person })} className="rounded-[16px] border border-[#edf2f8] bg-[#fbfcff] p-3 text-left transition hover:border-[#1D50A2] hover:bg-white">
          <p className="text-[11px] font-[850] text-[#64748b]">VIPS 요청</p>
          <p className="mt-1 text-[21px] font-[950] text-[#1D50A2]">{teamRequests.length}건</p>
          <p className="mt-1 truncate text-[11px] font-[750] text-[#94a3b8]">접수 {counts.received} · 처리중 {counts.processing}</p>
        </button>
        <button type="button" onClick={() => openRequestStatus({ team: team.team, person, status: "rejected" })} className="rounded-[16px] border border-[#edf2f8] bg-[#fbfcff] p-3 text-left transition hover:border-[#1D50A2] hover:bg-white">
          <p className="text-[11px] font-[850] text-[#64748b]">반려/재확인</p>
          <p className="mt-1 text-[21px] font-[950] text-[#F39945]">{team.rejectedCount}건</p>
          <p className="mt-1 truncate text-[11px] font-[750] text-[#94a3b8]">요청현황에서 팀 필터 적용</p>
        </button>
      </div>
      <p className="mt-3 text-[11px] font-[750] text-[#94a3b8]">확인 필요팀 기준: 월마감 진행률 50% 미만</p>
    </article>
  );
}

type SalesOpsMetric = {
  name: string;
  team: string;
  monthEndCount: number;
  monthEndAmount: number;
  monthEndRate: number;
  collectionIssueCount: number;
  collectionAmount: number;
  collectionRate: number;
  requestCount: number;
  rejectedCount: number;
  rejectionRate: number;
};

function SalesStatusTable({ rows }: { rows: SalesOpsMetric[] }) {
  const sortedRows = [...rows].sort(
    (a, b) =>
      b.monthEndCount + b.collectionIssueCount - (a.monthEndCount + a.collectionIssueCount) ||
      b.monthEndAmount + b.collectionAmount - (a.monthEndAmount + a.collectionAmount)
  );

  return (
    <section className="ops-card overflow-hidden p-0">
      <div className="flex items-start justify-between gap-3 border-b border-[#eef2f7] px-5 py-5">
        <div>
          <h2 className="text-[18px] font-[950] text-[#111827]">Sales별 운영현황</h2>
          <p className="mt-0.5 text-[12px] font-[750] text-[#64748b]">월마감과 수금 구간을 나누어 Sales별 확인 필요 상태를 봅니다.</p>
        </div>
      </div>
      <div className="max-h-[760px] overflow-y-auto p-4">
        <div className="min-w-[1040px]">
          <div className="grid grid-cols-[1.05fr_0.6fr_1.55fr_1.55fr_0.95fr_0.8fr] gap-3 rounded-[18px] bg-[#f3f7fc] px-4 py-3 text-[11px] font-[900] text-[#5d6f89]">
            <span>Sales</span>
            <span>Team</span>
            <span>월마감</span>
            <span>수금</span>
            <span>VIPS 요청</span>
            <span>반려율</span>
          </div>

          <div className="mt-3 grid gap-2.5">
            {sortedRows.map((row) => {
              const user = TEST_USERS.find((item) => item.name === row.name);
              const hasRisk = row.monthEndCount > 0 || row.collectionIssueCount > 0 || row.rejectionRate > 0;
              return (
                <button
                  key={row.name}
                  type="button"
                  onClick={() => openRequestStatus({ person: user?.name ?? row.name })}
                  className="grid grid-cols-[1.05fr_0.6fr_1.55fr_1.55fr_0.95fr_0.8fr] items-center gap-3 rounded-[20px] border border-[#d9e4f2] bg-white px-4 py-3 text-left shadow-[0_4px_12px_rgba(15,23,42,0.025)] transition hover:border-[#bcd2f2] hover:bg-[#fbfdff] hover:shadow-[0_10px_22px_rgba(29,80,162,0.07)]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-[900] text-[#111827]">{row.name}</span>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-[900] ${toneClass(hasRisk ? "orange" : "blue")}`}>
                        {hasRisk ? "확인" : "정상"}
                      </span>
                    </div>
                  </div>

                  <span className="text-[12px] font-[850] text-[#5d6f89]">{row.team}</span>

                  <div className="grid grid-cols-[0.7fr_1fr] items-center gap-2 rounded-[16px] border border-[#d9e4f2] bg-[#fbfdff] px-3 py-2">
                    <div>
                      <p className="text-[10px] font-[850] text-[#64748b]">이슈</p>
                      <p className="mt-0.5 text-[18px] font-[950] text-[#F39945]">{row.monthEndCount}건</p>
                    </div>
                    <div className="min-w-0 text-right">
                      <p className="text-[12px] font-[900] text-[#1D50A2]">진행률 {row.monthEndRate}%</p>
                      <p className="mt-0.5 truncate text-[11px] font-[750] text-[#64748b]">{krw(row.monthEndAmount)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-[0.7fr_1fr] items-center gap-2 rounded-[16px] border border-[#d9e4f2] bg-[#fbfdff] px-3 py-2">
                    <div>
                      <p className="text-[10px] font-[850] text-[#64748b]">이슈</p>
                      <p className="mt-0.5 text-[18px] font-[950] text-[#F39945]">{row.collectionIssueCount}건</p>
                    </div>
                    <div className="min-w-0 text-right">
                      <p className="text-[12px] font-[900] text-[#1D50A2]">수금률 {row.collectionRate}%</p>
                      <p className="mt-0.5 truncate text-[11px] font-[750] text-[#64748b]">{krw(row.collectionAmount)}</p>
                    </div>
                  </div>

                  <div className="rounded-[16px] border border-[#e2eaf5] bg-white px-3 py-2">
                    <p className="text-[13px] font-[900] text-[#1D50A2]">{row.requestCount}건</p>
                    <p className="mt-0.5 text-[10px] font-[750] text-[#64748b]">요청현황 이동</p>
                  </div>

                  <div className="rounded-[16px] border border-[#e2eaf5] bg-white px-3 py-2 text-right">
                    <p className="text-[13px] font-[900] text-[#1D50A2]">{row.rejectionRate}%</p>
                    <p className="mt-0.5 text-[10px] font-[750] text-[#64748b]">반려 {row.rejectedCount}건</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function GatekeeperControlPanel({
  rows,
  onUpdate
}: {
  rows: GatekeeperRow[];
  onUpdate: (name: string, status: MonthEndGateStatus) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "BLOCK" | "OK">("all");
  const [savingUser, setSavingUser] = useState<string | null>(null);

  const visibleRows = rows
    .filter((row) => statusFilter === "all" || row.effectiveStatus === statusFilter)
    .filter((row) => !query.trim() || row.name.toLowerCase().includes(query.trim().toLowerCase()) || row.team.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => (b.effectiveStatus === "BLOCK" ? 1 : 0) - (a.effectiveStatus === "BLOCK" ? 1 : 0) || b.issueCount - a.issueCount || a.name.localeCompare(b.name));

  const blockedCount = rows.filter((row) => row.effectiveStatus === "BLOCK").length;

  const handleUpdate = async (name: string, status: MonthEndGateStatus) => {
    setSavingUser(name);
    try {
      await onUpdate(name, status);
    } finally {
      setSavingUser(null);
    }
  };

  return (
    <section className="ops-card overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eef2f7] px-5 py-5">
        <div>
          <p className="text-[11px] font-[950] uppercase tracking-[0.08em] text-[#F39945]">Month-End Gatekeeper</p>
          <h2 className="mt-1 text-[18px] font-[950] text-[#111827]">월마감 요청 차단 관리</h2>
          <p className="mt-0.5 text-[12px] font-[750] text-[#64748b]">
            월마감 미완료 Sales의 VIPS 요청 진입을 차단/해제합니다. 월마감 이슈 수는 업로드된 월마감 데이터 기준입니다.
          </p>
        </div>
        <span className="rounded-full bg-[#fff5ec] px-3 py-1.5 text-[12px] font-[950] text-[#F39945]">차단 {blockedCount}명</span>
      </div>

      <div className="grid gap-2 border-b border-[#eef2f7] bg-[#fbfcff] p-4 md:grid-cols-[1fr_140px_140px]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Sales 또는 팀 검색"
          className="h-11 rounded-[14px] border border-[#dce6f3] bg-white px-4 text-[13px] font-[750] text-[#111827] outline-none focus:border-[#1D50A2]"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as "all" | "BLOCK" | "OK")}
          className="h-11 rounded-[14px] border border-[#dce6f3] bg-white px-3 text-[13px] font-[850] text-[#111827] outline-none focus:border-[#1D50A2]"
        >
          <option value="all">전체 상태</option>
          <option value="BLOCK">차단</option>
          <option value="OK">정상</option>
        </select>
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setStatusFilter("all");
          }}
          className="h-11 rounded-[14px] border border-[#dce6f3] bg-white px-3 text-[13px] font-[900] text-[#1D50A2]"
        >
          필터 초기화
        </button>
      </div>

      <div className="max-h-[420px] overflow-y-auto p-4">
        <div className="min-w-[860px]">
          <div className="grid grid-cols-[1fr_0.7fr_1fr_0.8fr_1.2fr] rounded-[16px] bg-[#f3f7fc] px-4 py-3 text-[11px] font-[950] text-[#64748b]">
            <span>Sales</span>
            <span>Team</span>
            <span>월마감 이슈</span>
            <span>상태</span>
            <span>관리</span>
          </div>
          <div className="mt-2 grid gap-2">
            {visibleRows.map((row) => (
              <div key={row.name} className="grid grid-cols-[1fr_0.7fr_1fr_0.8fr_1.2fr] items-center rounded-[18px] border border-[#dce6f3] bg-white px-4 py-3 text-[13px]">
                <span className="font-[950] text-[#111827]">{row.name}</span>
                <span className="font-[850] text-[#64748b]">{row.team}</span>
                <span className="font-[850] text-[#334155]">
                  {row.issueCount}건 <span className="ml-1 text-[11px] font-[750] text-[#94a3b8]">{krw(row.issueAmount)}</span>
                </span>
                <span
                  className={`w-fit rounded-full px-3 py-1 text-[11px] font-[950] ${
                    row.effectiveStatus === "BLOCK" ? "bg-[#fff5ec] text-[#F39945]" : "bg-[#edf4ff] text-[#1D50A2]"
                  }`}
                >
                  {row.effectiveStatus === "BLOCK" ? "차단" : "정상"}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={savingUser === row.name}
                    onClick={() => handleUpdate(row.name, "BLOCK")}
                    className="h-9 rounded-xl bg-[#F39945] px-3 text-[12px] font-[950] text-white disabled:opacity-50"
                  >
                    차단
                  </button>
                  <button
                    type="button"
                    disabled={savingUser === row.name}
                    onClick={() => handleUpdate(row.name, "OK")}
                    className="h-9 rounded-xl border border-[#dce6f3] bg-white px-3 text-[12px] font-[950] text-[#1D50A2] disabled:opacity-50"
                  >
                    차단해제
                  </button>
                  <button
                    type="button"
                    onClick={() => goMonthEnd(row.team, row.name)}
                    className="h-9 rounded-xl bg-[#edf4ff] px-3 text-[12px] font-[950] text-[#1D50A2]"
                  >
                    이슈 보기
                  </button>
                </div>
              </div>
            ))}
            {visibleRows.length === 0 && (
              <div className="rounded-[18px] border border-[#dce6f3] bg-white px-4 py-8 text-center text-[13px] font-[850] text-[#64748b]">표시할 Sales가 없습니다.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function PendingRequests({ requests }: { requests: RequestItem[] }) {
  const waiting = requests.filter((item) => ["received", "processing"].includes(statusBucket(item.status)));
  const counts = countByStatus(requests);
  const typeSummary = waiting.reduce<Record<string, number>>((acc, item) => {
    const label = item.kind && REQUEST_FORM_CONFIGS[item.kind] ? REQUEST_FORM_CONFIGS[item.kind].title.replace(" 요청", "") : item.type || "VIPS 요청";
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <section className="ops-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-[950] text-[#111827]">VIPS 처리 대기</h2>
          <p className="mt-0.5 text-[12px] font-[750] text-[#64748b]">지금 VIPS팀이 처리해야 할 요청만 간단히 확인합니다.</p>
        </div>
        <button
          type="button"
          onClick={() => openRequestStatus({ status: "received" })}
          className="rounded-full bg-[#edf4ff] px-3 py-1.5 text-[12px] font-[950] text-[#1D50A2]"
        >
          요청 관리로 이동
        </button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {[
          ["접수", counts.received, "blue"],
          ["처리중", counts.processing, "orange"],
          ["오늘 완료", requests.filter((item) => statusBucket(item.status) === "done" && isToday(item)).length || counts.done, "green"]
        ].map(([label, value, tone]) => (
          <div key={label} className="rounded-[16px] border border-[#edf2f8] bg-[#fbfcff] p-3">
            <p className="text-[11px] font-[850] text-[#64748b]">{label}</p>
            <p className={`mt-1 text-[23px] font-[950] ${toneClass(String(tone) as StatusTone).split(" ")[1]}`}>{value}건</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {Object.entries(typeSummary).slice(0, 5).map(([label, count]) => (
          <span key={label} className="rounded-full bg-[#f8fbff] px-3 py-1.5 text-[12px] font-[850] text-[#64748b]">
            {label} {count}건
          </span>
        ))}
      </div>
    </section>
  );
}

function RejectionRateSection({ rows }: { rows: SalesOpsMetric[] }) {
  const riskRows = [...rows].filter((row) => row.requestCount > 0).sort((a, b) => b.rejectionRate - a.rejectionRate).slice(0, 6);
  return (
    <section className="ops-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-[950] text-[#111827]">Sales별 요청 반려율</h2>
          <p className="mt-0.5 text-[12px] font-[750] text-[#64748b]">반려율이 높은 Sales를 먼저 확인해 반복 실수를 줄입니다.</p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {riskRows.length === 0 ? (
          <p className="rounded-[16px] border border-[#edf2f8] bg-[#fbfcff] p-4 text-[13px] font-[800] text-[#64748b]">아직 반려율을 계산할 요청 데이터가 없습니다.</p>
        ) : riskRows.map((row) => (
          <button
            key={row.name}
            type="button"
            onClick={() => openRequestStatus({ person: row.name, status: "rejected" })}
            className="grid w-full grid-cols-[90px_1fr_80px] items-center rounded-[16px] border border-[#edf2f8] bg-[#fbfcff] px-4 py-3 text-left transition hover:border-[#1D50A2] hover:bg-white"
          >
            <span className="font-[950] text-[#111827]">{row.name}</span>
            <span className="text-[12px] font-[800] text-[#64748b]">반려 {row.rejectedCount}건 / 전체 요청 {row.requestCount}건</span>
            <span className={`rounded-full px-3 py-1 text-center text-[12px] font-[950] ${toneClass(row.rejectionRate > 20 ? "red" : "orange")}`}>{row.rejectionRate}%</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function actionStatusLabel(status: MonthEndActionStatus) {
  if (status === "done") return "완료";
  if (status === "inProgress") return "확인중";
  return "접수";
}

function actionStatusClass(status: MonthEndActionStatus) {
  if (status === "done") return "bg-[#edfdf5] text-[#15803d]";
  if (status === "inProgress") return "bg-[#fff5ec] text-[#F39945]";
  return "bg-[#edf4ff] text-[#1D50A2]";
}

function MonthEndActionRequestsSection({
  requests,
  onStatusChange
}: {
  requests: MonthEndActionRequest[];
  onStatusChange: (id: string, status: MonthEndActionStatus) => void;
}) {
  const openRequests = requests.filter((request) => request.status !== "done");
  const visibleRequests = requests.slice(0, 6);

  return (
    <section className="ops-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-[950] text-[#111827]">월마감 조치 요청</h2>
          <p className="mt-0.5 text-[12px] font-[750] text-[#64748b]">
            Sales가 월마감 화면에서 남긴 출고진행 요청입니다. 현재는 시연용 임시 저장이며, 추후 ERP API 출고요청으로 연결됩니다.
          </p>
        </div>
        <div className="rounded-full bg-[#edf4ff] px-3 py-1 text-[12px] font-[950] text-[#1D50A2]">
          미완료 {openRequests.length}건
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="mt-4 rounded-[18px] border border-dashed border-[#dce6f3] bg-[#fbfdff] px-4 py-6 text-center">
          <p className="text-[13px] font-[900] text-[#64748b]">아직 접수된 월마감 조치 요청이 없습니다.</p>
          <p className="mt-1 text-[12px] font-[750] text-[#94a3b8]">Sales가 월마감 이슈에서 출고진행을 저장하면 이곳에 표시됩니다.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {visibleRequests.map((request) => (
            <div key={request.id} className="grid gap-3 rounded-[18px] border border-[#edf2f8] bg-[#fbfcff] p-3 lg:grid-cols-[minmax(0,1fr)_150px_180px] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-[11px] font-[950] ${actionStatusClass(request.status)}`}>
                    {actionStatusLabel(request.status)}
                  </span>
                  <span className="text-[12px] font-[900] text-[#64748b]">{request.iSales} · {request.fSales}</span>
                  <span className="text-[11px] font-[750] text-[#94a3b8]">{new Date(request.requestedAt).toLocaleString("ko-KR")}</span>
                </div>
                <p className="mt-2 truncate text-[15px] font-[950] text-[#111827]">{request.company}</p>
                <p className="mt-1 line-clamp-2 text-[12px] font-[750] text-[#64748b]">
                  {request.memo || "출고 진행 확인"} · {krw(request.amount)}
                </p>
              </div>
              <div className="rounded-[14px] bg-white px-3 py-2">
                <p className="text-[11px] font-[850] text-[#94a3b8]">ERP 연동 상태</p>
                <p className="mt-1 text-[12px] font-[950] text-[#F39945]">API 연동 전</p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => onStatusChange(request.id, "inProgress")} className="ops-btn-secondary h-8 px-3 text-[11px]">
                  확인중
                </button>
                <button type="button" onClick={() => onStatusChange(request.id, "done")} className="ops-btn-primary h-8 px-3 text-[11px]">
                  완료
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function VipsOpsPage() {
  const { selectedUser } = useSelectedUser();
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [closingSnapshot, setClosingSnapshot] = useState<ClosingSnapshot | null>(null);
  const [rmaSnapshot, setRmaSnapshot] = useState<MonthEndRmaSnapshot | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUserMap>({});
  const [monthEndActionRequests, setMonthEndActionRequests] = useState<MonthEndActionRequest[]>([]);
  const [selectedMonthEndCard, setSelectedMonthEndCard] = useState<MonthEndOpsCard | null>(null);
  const [selectedCollectionCard, setSelectedCollectionCard] = useState<CollectionOpsCard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests()
      .then(setRequests)
      .finally(() => setLoading(false));

    fetchBlockedUsers()
      .then(setBlockedUsers)
      .catch(() => setBlockedUsers({}));

    fetch("/api/month-end-snapshot", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { snapshot?: ClosingSnapshot | null } | null) => setClosingSnapshot(data?.snapshot ?? null))
      .catch(() => setClosingSnapshot(null));

    fetchMonthEndRmaSnapshot()
      .then(setRmaSnapshot)
      .catch(() => setRmaSnapshot(null));

    const syncActionRequests = () => setMonthEndActionRequests(fetchMonthEndActionRequests());
    syncActionRequests();
    window.addEventListener("month-end-action-requests-updated", syncActionRequests);
    window.addEventListener("storage", syncActionRequests);
    return () => {
      window.removeEventListener("month-end-action-requests-updated", syncActionRequests);
      window.removeEventListener("storage", syncActionRequests);
    };
  }, []);

  const closingIssues = useMemo(() => openClosingIssues(closingSnapshot), [closingSnapshot]);
  const useSnapshotClosing = closingIssues.length > 0;
  const rmaRecords = useMemo(() => rmaSnapshot?.records ?? [], [rmaSnapshot]);
  const monthEndOpsCards = useMemo(() => buildMonthEndOpsCards(closingIssues, rmaRecords), [closingIssues, rmaRecords]);
  const collectionOpsCards = useMemo(() => buildCollectionOpsCards(receivableRecords), []);

  const salesRows = useMemo<SalesOpsMetric[]>(() => {
    return TEST_USERS.filter((user) => user.role === "SALES").map((user) => {
      const legacy = salesMetrics.find((row) => row.name === user.name);
      const userClosingIssues = useSnapshotClosing ? issuesForSales(closingIssues, user.salesName) : [];
      const monthEndCount = useSnapshotClosing ? userClosingIssues.length : legacy?.monthEndCount ?? 0;
      const monthEndAmount = useSnapshotClosing ? userClosingIssues.reduce((sum, issue) => sum + issue.amount, 0) : legacy?.monthEndAmount ?? 0;
      const collectionRecords = collectionRecordsForSales(receivableRecords, user.salesName);
      const collectionComposition = buildCollectionComposition(collectionRecords);
      const riskRecords = collectionRiskRecords(collectionRecords);
      const userRequests = requestForSales(requests, user.name);

      return {
        name: user.name,
        team: salesTeam(user.name),
        monthEndCount,
        monthEndAmount,
        monthEndRate: closingRate(monthEndCount),
        collectionIssueCount: riskRecords.length,
        collectionAmount: riskRecords.reduce((sum, record) => sum + record.diff, 0),
        collectionRate: collectionComposition.collectionRate,
        requestCount: userRequests.length,
        rejectedCount: countByStatus(userRequests).rejected,
        rejectionRate: rejectionRate(userRequests)
      };
    });
  }, [closingIssues, requests, useSnapshotClosing]);

  const teamRows = useMemo<TeamOpsMetric[]>(
    () =>
      teamRoster.map((team) => {
        const members = team.members;
        const memberRows = salesRows.filter((row) => members.includes(row.name));
        const teamRequests = requestsForTeam(requests, members);
        const teamCollectionRecords = receivableRecords.filter((record) => members.includes(normalizeSalesName(record.sales)) || members.includes(normalizeSalesName(record.fSales)));
        const teamCollectionComposition = buildCollectionComposition(teamCollectionRecords);
        const collectionRisk = collectionRiskRecords(teamCollectionRecords);
        const monthEndCount = memberRows.reduce((sum, row) => sum + row.monthEndCount, 0);
        const monthEndAmount = memberRows.reduce((sum, row) => sum + row.monthEndAmount, 0);

        return {
          team: team.team,
          members,
          monthEndCount,
          monthEndAmount,
          monthEndRate: memberRows.length > 0 ? Math.round(memberRows.reduce((sum, row) => sum + row.monthEndRate, 0) / memberRows.length) : 100,
          collectionIssueCount: collectionRisk.length,
          collectionAmount: collectionRisk.reduce((sum, record) => sum + record.diff, 0),
          collectionRate: teamCollectionComposition.collectionRate,
          requests: teamRequests,
          rejectedCount: countByStatus(teamRequests).rejected
        };
      }),
    [requests, salesRows]
  );

  const monthEndCount = salesRows.reduce((sum, row) => sum + row.monthEndCount, 0);
  const monthEndAmount = salesRows.reduce((sum, row) => sum + row.monthEndAmount, 0);
  const allCollectionComposition = useMemo(() => buildCollectionComposition(receivableRecords), []);
  const allCollectionRisk = useMemo(() => collectionRiskRecords(receivableRecords), []);
  const collectionCount = allCollectionRisk.length;
  const collectionAmount = allCollectionRisk.reduce((sum, record) => sum + record.diff, 0);
  const needCheckTeamNames = teamRows.filter((team) => team.monthEndRate < 50).map((team) => team.team);
  const overallClosingRate = salesRows.length > 0 ? Math.round(salesRows.reduce((sum, row) => sum + row.monthEndRate, 0) / salesRows.length) : 100;
  const gatekeeperRows = useMemo<GatekeeperRow[]>(() => {
    const names = new Set<string>();
    TEST_USERS.filter((user) => user.role === "SALES").forEach((user) => names.add(user.salesName));
    closingIssues.forEach((issue) => {
      if (issue.iSales) names.add(issue.iSales);
      if (issue.fSales) names.add(issue.fSales);
    });
    Object.keys(blockedUsers).forEach((name) => {
      if (name && !["Sally", "Vincent", "Gavin"].includes(name)) names.add(name);
    });

    return Array.from(names).map((name) => {
      const userIssues = issuesForSales(closingIssues, name);
      const manualStatus = blockedUsers[name] ?? "OK";
      const effectiveStatus: MonthEndGateStatus = manualStatus === "BLOCK" || userIssues.length > 0 ? "BLOCK" : "OK";
      return {
        name,
        team: salesTeam(name),
        issueCount: userIssues.length,
        issueAmount: userIssues.reduce((sum, issue) => sum + issue.amount, 0),
        manualStatus,
        effectiveStatus
      };
    });
  }, [blockedUsers, closingIssues]);

  const handleGateUpdate = async (name: string, status: MonthEndGateStatus) => {
    const nextUsers = await updateBlockedUser(name, status);
    setBlockedUsers(nextUsers);
  };

  const handleActionStatusChange = (id: string, status: MonthEndActionStatus) => {
    setMonthEndActionRequests(updateMonthEndActionRequestStatus(id, status));
  };

  const canAccess = selectedUser.accessRole === "admin";
  if (!canAccess) return <AccessDenied />;

  return (
    <ModulePage
      eyebrow="VIPS CONTROL TOWER"
      title="VIPS Control Tower"
      description="팀별 월마감·수금·요청 이슈를 한눈에 확인하고, 오늘 먼저 봐야 할 운영 이슈를 관리합니다."
    >
      <div className="mt-5 space-y-4">
        <MonthEndOpsSummary cards={monthEndOpsCards} onSelect={setSelectedMonthEndCard} />

        <CollectionOpsSummary cards={collectionOpsCards} onSelect={setSelectedCollectionCard} />
        <p className="text-[11px] font-[750] text-[#94a3b8]">
          수금 이슈 기준: 30일 이상 미수 또는 {krw(highValueThreshold)} 이상 고액미수입니다. 동일 거래가 두 조건에 모두 해당해도 1건으로만 계산합니다.
        </p>

        <section className="ops-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-[950] text-[#111827]">팀별 운영 현황</h2>
              <p className="mt-0.5 text-[12px] font-[750] text-[#64748b]">월마감, 수금, 요청 이슈를 팀 단위로 보고 우선순위를 판단합니다.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {teamRows.map((team) => (
              <TeamControlCard key={team.team} team={team} />
            ))}
          </div>
        </section>

        <SalesStatusTable rows={salesRows} />

        <GatekeeperControlPanel rows={gatekeeperRows} onUpdate={handleGateUpdate} />

        <MonthEndActionRequestsSection requests={monthEndActionRequests} onStatusChange={handleActionStatusChange} />

      </div>
      <MonthEndIssueModal card={selectedMonthEndCard} onClose={() => setSelectedMonthEndCard(null)} />
      <CollectionIssueModal card={selectedCollectionCard} onClose={() => setSelectedCollectionCard(null)} />
    </ModulePage>
  );
}


"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, CreditCard, WalletCards, X } from "lucide-react";
import { useSelectedUser } from "../hooks/useSelectedUser";
import { buildCollectionIssues, buildCollectionSummary, filterReceivablesByUser, formatKrwShort, receivableRecords, normalizeSalesName, type ReceivableRecord } from "../services/receivables";

const ACTION_STATUS_KEY = "icbanq.ops.collectionActionStatus";

type CollectionCardKey = "total" | "unpaid" | "matching";
type CollectionCardItem = {
  key: CollectionCardKey;
  label: string;
  count: string;
  sub: string;
  icon: typeof WalletCards;
  status: string;
  records: ReceivableRecord[];
};

function hasCount(value: string) {
  return Number(value.replace(/[^0-9]/g, "")) > 0;
}

function formatDuration(record: ReceivableRecord) {
  if (record.overdueDays <= 0) return "소요 0일";
  return record.status === "완료" ? `소요 ${record.overdueDays}일` : `지연 ${record.overdueDays}일`;
}

function CollectionIssueModal({
  item,
  onClose
}: {
  item: CollectionCardItem | null;
  onClose: () => void;
}) {
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#111827]/45 px-4 py-6">
      <section className="w-full max-w-[900px] overflow-hidden rounded-[24px] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
        <div className="flex items-center justify-between border-b border-[#edf2f8] px-6 py-5">
          <div>
            <h3 className="text-[20px] font-[950] tracking-[-0.03em] text-[#111827]">
              {item.label} · {item.records.length}건
            </h3>
            <p className="mt-1 text-[12px] font-[750] text-[#64748b]">HOME에서 바로 확인하는 AR 리스트입니다.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e9eef6] bg-white text-[#64748b] transition hover:bg-[#f8fafc]">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[58vh] overflow-auto px-6 py-5">
          <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left">
            <thead className="text-[12px] font-[900] text-[#64748b]">
              <tr>
                <th className="border-b border-[#e5e7eb] px-3 py-2">부서명</th>
                <th className="border-b border-[#e5e7eb] px-3 py-2">Sales</th>
                <th className="border-b border-[#e5e7eb] px-3 py-2">업체명</th>
                <th className="border-b border-[#e5e7eb] px-3 py-2">AR (VAT포함)</th>
                <th className="border-b border-[#e5e7eb] px-3 py-2">상태</th>
                <th className="border-b border-[#e5e7eb] px-3 py-2">지연/소요 기간</th>
              </tr>
            </thead>
            <tbody className="text-[13px] font-[750] text-[#111827]">
              {item.records.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-10 text-center text-[#94a3b8]">조건에 맞는 AR 데이터가 없습니다.</td></tr>
              ) : (
                item.records.map((record) => (
                  <tr key={record.id}>
                    <td className="border-b border-[#edf2f8] px-3 py-3">{record.team || "-"}</td>
                    <td className="border-b border-[#edf2f8] px-3 py-3 font-[950]">{normalizeSalesName(record.sales) || "미매칭"}</td>
                    <td className="border-b border-[#edf2f8] px-3 py-3">{record.name}</td>
                    <td className="border-b border-[#edf2f8] px-3 py-3">{formatKrwShort(record.diff > 0 ? record.diff : record.expected)}</td>
                    <td className="border-b border-[#edf2f8] px-3 py-3">{record.status}</td>
                    <td className="border-b border-[#edf2f8] px-3 py-3">{formatDuration(record)}</td>
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

export function CollectionCheckCard() {
  const { selectedUser } = useSelectedUser();
  const [checkedIssueIds, setCheckedIssueIds] = useState<string[]>([]);
  const [selectedItem, setSelectedItem] = useState<CollectionCardItem | null>(null);

  useEffect(() => {
    const sync = () => {
      try {
        const raw = window.localStorage.getItem(ACTION_STATUS_KEY);
        const statuses = raw ? (JSON.parse(raw) as Record<string, { status?: string }>) : {};
        setCheckedIssueIds(Object.entries(statuses).filter(([, value]) => value.status === "checked").map(([key]) => key));
      } catch {
        setCheckedIssueIds([]);
      }
    };

    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("icbanq:collection-action-change", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("icbanq:collection-action-change", sync);
    };
  }, []);

  const visibleRecords = filterReceivablesByUser(receivableRecords, selectedUser);
  const summary = buildCollectionSummary(visibleRecords);
  const issues = buildCollectionIssues(visibleRecords).filter((issue) => !checkedIssueIds.includes(issue.id));
  const unpaidRecords = visibleRecords.filter((record) => record.status === "미수" && record.diff > 0);
  const unpaidAmount = unpaidRecords.reduce((sum, record) => sum + record.diff, 0);
  const matchingRecords = visibleRecords.filter((record) => record.status === "부분수금" || record.gubun === "신규매칭" || record.gubun === "담당자미매칭");
  const unpaidRatio = summary.expected > 0 ? Math.round((unpaidAmount / summary.expected) * 100) : 0;
  const collectionItems: CollectionCardItem[] = useMemo(
    () => [
      { key: "total", label: "전체 금액 및 건수", count: formatKrwShort(summary.expected), sub: `${visibleRecords.length}건`, icon: WalletCards, status: "info", records: visibleRecords },
      { key: "unpaid", label: "미수 금액 및 건수", count: formatKrwShort(unpaidAmount), sub: `${unpaidRecords.length}건 · 전체 대비 ${unpaidRatio}%`, icon: Banknote, status: "needCheck", records: unpaidRecords },
      { key: "matching", label: "수금매칭 대기", count: `${matchingRecords.length}건`, sub: "무입금 확인 필요", icon: CreditCard, status: "inProgress", records: matchingRecords }
    ],
    [matchingRecords, summary.expected, unpaidAmount, unpaidRatio, unpaidRecords, visibleRecords]
  );

  return (
    <section className="min-w-0 overflow-hidden rounded-[20px] border border-[#e9eef6] bg-white p-5 shadow-[0_6px_16px_rgba(15,23,42,0.032)]">
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-[18px] font-[950] tracking-[-0.02em] text-[#111827]">AR 체크</h2>
          <p className="mt-1 truncate text-[12px] font-[750] text-[#64748b]">전월말 수금 현황을 확인합니다.</p>
        </div>
        <span className="shrink-0 rounded-full bg-[#fff5ec] px-3 py-1 text-[12px] font-[950] text-[#F39945]">{issues.length}건</span>
      </div>

      <div className="mt-4 grid min-w-0 grid-cols-2 gap-2.5 min-[1180px]:grid-cols-3">
        {collectionItems.map((item) => (
          <button
            type="button"
            key={item.label}
            onClick={() => setSelectedItem(item)}
            className={`flex h-[128px] min-w-0 flex-col justify-center overflow-hidden rounded-[16px] border bg-[#fbfcff] px-3.5 py-3 text-left shadow-[0_4px_10px_rgba(15,23,42,0.022)] transition hover:border-[#1D50A2] hover:bg-white ${
              hasCount(item.count) ? "border-[#cbd5e1] ring-1 ring-[#e2e8f0]" : "border-[#edf2f8]"
            }`}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f1f5f9] text-[#64748b]">
              <item.icon size={15} />
            </span>
            <p className="mt-1.5 truncate text-[11px] font-[800] leading-[1.2] text-[#475569]">{item.label}</p>
            <p className={`mt-0.5 truncate text-[18px] font-[900] leading-none tracking-[-0.02em] ${item.status === "needCheck" ? "text-[#F39945]" : "text-[#111827]"}`}>
              {item.count}
            </p>
            <p className="mt-1 truncate text-[9.5px] font-[650] leading-none text-[#64748b]">{item.sub}</p>
          </button>
        ))}
      </div>

      <button onClick={() => (window.location.href = "/collections")} className="mt-4 h-[44px] w-full rounded-[14px] border border-[#e9eef6] bg-[#f8fbff] text-[13px] font-[950] text-[#1D50A2] shadow-[0_4px_10px_rgba(15,23,42,0.025)] transition hover:bg-[#edf4ff]">
        수금관리 바로가기
      </button>
      <CollectionIssueModal item={selectedItem} onClose={() => setSelectedItem(null)} />
    </section>
  );
}

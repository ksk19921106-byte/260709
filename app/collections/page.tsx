"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowRight, Banknote, CheckCircle2, CircleDollarSign, Search, ShieldCheck, UserRound } from "lucide-react";
import { ModulePage } from "../components/ModulePage";
import { TEST_USERS, useSelectedUser } from "../hooks/useSelectedUser";
import {
  buildCollectionIssues,
  buildCollectionComposition,
  buildCollectionSummary,
  buildSalesStats,
  buildTeamStats,
  filterReceivablesByUser,
  formatKrwShort,
  normalizeSalesName,
  normalizeTeamName,
  receivableRecords,
  type CollectionIssue,
  type ReceivableRecord
} from "../services/receivables";

type TableFilter = "all" | "completed" | "partial" | "unpaid" | "long_overdue" | "unmatched_payment";
type CollectionSummaryFilter = "scheduled" | "completed" | "partial" | "unpaid" | "high" | "long";
type CollectionActionStatus = {
  issueId: string;
  status: "open" | "checked" | "request_vips";
  memo?: string;
  checkedAt?: string;
  checkedBy?: string;
};

const ACTION_STATUS_KEY = "icbanq.ops.collectionActionStatus";
const MATCHING_DEMO_KEY = "icbanq.ops.collectionMatchingDemo";
const AR_DEMO_KEY = "icbanq.ops.arAgingDemo";
const PAYMENT_ASSIGNMENT_KEY = "icbanq.ops.collectionPaymentAssignments";
const MATCH_CANDIDATE_THRESHOLD = 35;

type DemoOrder = {
  id: string;
  orderNo: string;
  trackingNo: string;
  company: string;
  sales: string;
  taxId: string;
  itemName: string;
  amount: number;
  ar: number;
  status: "open" | "matched";
};

type DemoPayment = {
  id: string;
  paymentNo: string;
  date: string;
  payerName: string;
  amount: number;
  originalAmount?: number;
  remainingAmount?: number;
  account: string;
  rawStatus?: string;
  status: "unmatched" | "matched";
};

type DemoArRecord = {
  id: string;
  company: string;
  sales: string;
  team: string;
  poid: string;
  poitemId: string;
  itemName: string;
  amount: number;
  ar: number;
  overdueDays: number;
  status: string;
};

type DemoCollectionMatch = {
  id: string;
  paymentId: string;
  orderIds: string[];
  amount: number;
  erpMatchingId: string;
  matchedAt: string;
  matchedBy: string;
};

type MatchingDemoState = {
  orders: DemoOrder[];
  payments: DemoPayment[];
  matches: DemoCollectionMatch[];
};

const filterOptions: Array<{ key: TableFilter; label: string }> = [
  { key: "all", label: "전체" },
  { key: "completed", label: "완료" },
  { key: "partial", label: "부분수금" },
  { key: "unpaid", label: "미수" },
  { key: "long_overdue", label: "장기미수" },
  { key: "unmatched_payment", label: "입금자명 확인" }
];

const collectionTeamOptions = ["S1", "S2", "S3", "B2D"];
const defaultSalesRoster = [
  "Harvey",
  "Lauren",
  "Riley",
  "Jake",
  "Terry",
  "Chris",
  "Robin",
  "William_S2",
  "Jenny",
  "Winnie",
  "Max"
];

const priorityStyle = {
  high: "bg-[#fff5ec] text-[#b85f18] border-[#f7c999]",
  medium: "bg-[#fff5ec] text-[#b85f18] border-[#f7c999]",
  low: "bg-[#edf4ff] text-[#1D50A2] border-[#cfe2ff]"
};

function priorityLabel(priority: CollectionIssue["priority"]) {
  if (priority === "high") return "높음";
  if (priority === "medium") return "보통";
  return "낮음";
}

function statusStyle(status: ReceivableRecord["status"]) {
  if (status === "완료") return "bg-[#edf4ff] text-[#1D50A2]";
  if (status === "부분수금") return "bg-[#fff5ec] text-[#b85f18]";
  return "bg-[#fff5ec] text-[#b85f18]";
}

function parseAmount(value: string) {
  return Number(String(value ?? "").replace(/[^0-9.-]/g, "") || 0);
}

function normalizeMatchText(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/주식회사|\(주\)|㈜|유한회사|\[.*?\]/g, "")
    .replace(/\([^)]*260\d+[^)]*\)/g, "")
    .replace(/[^가-힣a-z0-9]/g, "");
}

function splitPasteRows(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\t| {2,}/).map((cell) => cell.trim()));
}

function findColumn(headers: string[], aliases: string[], fallback: number) {
  const index = headers.findIndex((header) => aliases.some((alias) => header.toLowerCase().includes(alias.toLowerCase())));
  return index >= 0 ? index : fallback;
}

function tableRowsToText(rows: string[][]) {
  return rows.map((row) => row.join("\t")).join("\n");
}

function parseHtmlTableRows(text: string) {
  if (!/<table[\s>]/i.test(text)) return [];
  const doc = new DOMParser().parseFromString(text, "text/html");
  return Array.from(doc.querySelectorAll("tr"))
    .map((row) =>
      Array.from(row.querySelectorAll("th,td")).map((cell) =>
        (cell.textContent ?? "").replace(/\s+/g, " ").trim()
      )
    )
    .filter((row) => row.length > 0);
}

function columnLettersToIndex(ref: string) {
  const letters = ref.replace(/[^A-Z]/gi, "").toUpperCase();
  let index = 0;
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64);
  return Math.max(0, index - 1);
}

async function inflateZipEntry(bytes: Uint8Array, method: number) {
  if (method === 0) return new TextDecoder("utf-8").decode(bytes);
  if (method !== 8 || typeof DecompressionStream === "undefined") {
    throw new Error("이 XLSX 압축 방식을 브라우저에서 바로 읽을 수 없습니다.");
  }
  const safeBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const stream = new Blob([safeBuffer]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const buffer = await new Response(stream).arrayBuffer();
  return new TextDecoder("utf-8").decode(buffer);
}

async function readZipEntries(buffer: ArrayBuffer, names: string[]) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const wanted = new Set(names);
  const result: Record<string, string> = {};
  let offset = 0;

  while (offset + 30 < bytes.length && Object.keys(result).length < wanted.size) {
    const signature = view.getUint32(offset, true);
    if (signature !== 0x04034b50) {
      offset += 1;
      continue;
    }
    const method = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const fileNameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const name = new TextDecoder("utf-8").decode(bytes.slice(nameStart, nameStart + fileNameLength)).replace(/\\/g, "/");
    const dataStart = nameStart + fileNameLength + extraLength;
    const dataEnd = dataStart + compressedSize;

    if (wanted.has(name)) {
      result[name] = await inflateZipEntry(bytes.slice(dataStart, dataEnd), method);
    }
    offset = dataEnd;
  }
  return result;
}

async function parseXlsxRows(file: File) {
  const buffer = await file.arrayBuffer();
  const firstPass = await readZipEntries(buffer, ["xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/sharedStrings.xml"]);
  const workbook = firstPass["xl/workbook.xml"];
  const rels = firstPass["xl/_rels/workbook.xml.rels"];
  if (!workbook || !rels) throw new Error("XLSX workbook 구조를 읽지 못했습니다.");

  const workbookDoc = new DOMParser().parseFromString(workbook, "application/xml");
  const firstSheet = workbookDoc.querySelector("sheet");
  const rid = firstSheet?.getAttribute("r:id");
  const relDoc = new DOMParser().parseFromString(rels, "application/xml");
  const target = Array.from(relDoc.querySelectorAll("Relationship")).find((rel) => rel.getAttribute("Id") === rid)?.getAttribute("Target");
  const sheetPath = `xl/${(target || "worksheets/sheet1.xml").replace(/^\/?xl\//, "")}`.replace(/\\/g, "/");

  const secondPass = await readZipEntries(buffer, [sheetPath]);
  const sheetXml = secondPass[sheetPath];
  if (!sheetXml) throw new Error("XLSX 첫 번째 시트를 읽지 못했습니다.");

  const shared: string[] = [];
  if (firstPass["xl/sharedStrings.xml"]) {
    const sharedDoc = new DOMParser().parseFromString(firstPass["xl/sharedStrings.xml"], "application/xml");
    sharedDoc.querySelectorAll("si").forEach((si) => {
      shared.push(Array.from(si.querySelectorAll("t")).map((t) => t.textContent ?? "").join(""));
    });
  }

  const sheetDoc = new DOMParser().parseFromString(sheetXml, "application/xml");
  return Array.from(sheetDoc.querySelectorAll("sheetData row")).map((row) => {
    const cells: string[] = [];
    row.querySelectorAll("c").forEach((cell) => {
      const ref = cell.getAttribute("r") ?? "";
      const index = columnLettersToIndex(ref);
      const type = cell.getAttribute("t");
      let value = cell.querySelector("v")?.textContent ?? "";
      if (type === "s") value = shared[Number(value)] ?? "";
      if (type === "inlineStr") value = Array.from(cell.querySelectorAll("t")).map((t) => t.textContent ?? "").join("");
      cells[index] = value.replace(/\s+/g, " ").trim();
    });
    return cells.map((cell) => cell ?? "");
  }).filter((row) => row.some(Boolean));
}

async function parseSpreadsheetFile(file: File) {
  if (file.name.toLowerCase().endsWith(".xlsx")) return parseXlsxRows(file);
  const text = await file.text();
  const htmlRows = parseHtmlTableRows(text);
  if (htmlRows.length > 0) return htmlRows;
  return splitPasteRows(text);
}

function parseOrderPaste(text: string): DemoOrder[] {
  const rows = splitPasteRows(text);
  return parseOrderRows(rows);
}

function parseOrderRows(rows: string[][]): DemoOrder[] {
  if (rows.length === 0) return [];
  const hasHeader = rows[0].some((cell) => /poitem|주문|order|tracking|company|거래처|amount|ar|sales|customer/i.test(cell));
  const headers = hasHeader ? rows[0] : [];
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const orderIdx = findColumn(headers, ["POITEM_ID", "주문", "order", "order no"], 0);
  const trackingIdx = findColumn(headers, ["tracking", "트래킹"], 1);
  const companyIdx = findColumn(headers, ["Customer Company", "company", "거래처", "업체"], 2);
  const salesIdx = findColumn(headers, ["ISales", "sales", "담당"], 3);
  const taxIdx = findColumn(headers, ["tax", "계산서"], 4);
  const itemIdx = findColumn(headers, ["PN", "품목", "p/n", "item"], 5);
  const amountIdx = findColumn(headers, ["AMOUNT_KRW", "AMOUNT", "청구", "금액"], 6);
  const arIdx = findColumn(headers, ["AR AMOUNT", "ar", "미수", "잔액"], 7);

  return dataRows.map((cells, index) => {
    const orderNo = cells[orderIdx] || `ORDER-${String(index + 1).padStart(3, "0")}`;
    return {
      id: `order-${orderNo}-${index}`,
      orderNo,
      trackingNo: cells[trackingIdx] || "-",
      company: cells[companyIdx] || "-",
      sales: normalizeSalesName(cells[salesIdx]) || cells[salesIdx] || "-",
      taxId: cells[taxIdx] || "-",
      itemName: cells[itemIdx] || "-",
      amount: parseAmount(cells[amountIdx]),
      ar: parseAmount(cells[arIdx] || cells[amountIdx]),
      status: "open" as const
    };
  }).filter((order) => order.company !== "-" && order.ar > 0);
}

function parsePaymentPaste(text: string): DemoPayment[] {
  const rows = splitPasteRows(text);
  return parsePaymentRows(rows);
}

function parsePaymentRows(rows: string[][]): DemoPayment[] {
  if (rows.length === 0) return [];
  const hasHeader = rows[0].some((cell) => /idx|입금|payer|payment|계좌|amount|금액|stat|비고/i.test(cell));
  const headers = hasHeader ? rows[0] : [];
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const noIdx = findColumn(headers, ["IDX", "입금id", "payment", "no", "번호"], 0);
  const dateIdx = findColumn(headers, ["입금일", "date"], 1);
  const payerIdx = findColumn(headers, ["비고", "입금자", "payer", "예금주"], 2);
  const amountIdx = findColumn(headers, ["금액", "amount"], 3);
  const accountIdx = findColumn(headers, ["은행계좌", "계좌", "account"], 4);
  const statIdx = findColumn(headers, ["Stat", "상태"], 7);

  return dataRows.map((cells, index) => {
    const paymentNo = cells[noIdx] || `PAY-${String(index + 1).padStart(3, "0")}`;
    const rawStatus = cells[statIdx] || "";
    const remainingAmount = rawStatus.includes("남은") ? parseAmount(rawStatus) : undefined;
    const originalAmount = parseAmount(cells[amountIdx]);
    const amount = remainingAmount && remainingAmount > 0 ? remainingAmount : originalAmount;
    return {
      id: `payment-${paymentNo}-${index}`,
      paymentNo,
      date: cells[dateIdx] || "-",
      payerName: cells[payerIdx] || "-",
      amount,
      originalAmount,
      remainingAmount,
      account: cells[accountIdx] || "-",
      rawStatus,
      status: rawStatus.includes("매칭완료") ? "matched" as const : "unmatched" as const
    };
  }).filter((payment) => payment.payerName !== "-" && payment.amount > 0);
}

function parseArRows(rows: string[][]): DemoArRecord[] {
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => String(header ?? "").trim());
  const compactCompanyIdx = headers.findIndex((header) => /행\s*레이블|company|거래처|업체/i.test(header));
  const compactDaysIdx = headers.findIndex((header) => /경과|aging|overdue/i.test(header));
  const compactArIdx = headers.findIndex((header) => /ar|미수/i.test(header));

  if (compactCompanyIdx >= 0 && compactDaysIdx >= 0 && compactArIdx >= 0 && headers.length <= 5) {
    return rows
      .slice(1)
      .map((cells, index) => {
        const company = String(cells[compactCompanyIdx] ?? "").trim();
        const ar = parseAmount(cells[compactArIdx]);
        return {
          id: `compact-ar-${company}-${index}`,
          company,
          sales: "",
          team: "미매칭",
          poid: "회사별 AR",
          poitemId: "",
          itemName: "미수금 Aging",
          amount: ar,
          ar,
          overdueDays: parseAmount(cells[compactDaysIdx]),
          status: "미수"
        };
      })
      .filter((row) => row.company && !/총합계|합계|grand\s*total/i.test(row.company) && row.ar > 0);
  }

  const companyIdx = findColumn(headers, ["company", "거래처", "업체"], 0);
  const salesIdx = findColumn(headers, ["sales", "담당"], 1);
  const poidIdx = findColumn(headers, ["poid", "po id", "주문번호"], 3);
  const poitemIdx = findColumn(headers, ["poitem", "poitemid", "poitem_id"], 4);
  const daysIdx = findColumn(headers, ["경과", "aging", "overdue"], 7);
  const itemIdx = findColumn(headers, ["pn", "품목", "item"], 8);
  const amountIdx = findColumn(headers, ["amount", "공급", "금액"], 11);
  const arIdx = findColumn(headers, ["ar", "미수"], 12);
  const statusIdx = findColumn(headers, ["status", "상태"], 14);

  return rows
    .slice(1)
    .map((cells, index) => {
      const sales = String(cells[salesIdx] ?? "").trim();
      const company = String(cells[companyIdx] ?? "").trim();
      const poitemId = String(cells[poitemIdx] ?? "").trim();
      const ar = parseAmount(cells[arIdx]);
      return {
        id: poitemId || `${company}-${index}`,
        company,
        sales: normalizeSalesName(sales),
        team: normalizeTeamName(sales),
        poid: String(cells[poidIdx] ?? "").trim(),
        poitemId,
        itemName: String(cells[itemIdx] ?? "").trim(),
        amount: parseAmount(cells[amountIdx]),
        ar,
        overdueDays: parseAmount(cells[daysIdx]),
        status: String(cells[statusIdx] ?? "").trim()
      };
    })
    .filter((row) => row.company && row.ar > 0);
}

function formatOverdueMonths(days: number) {
  const safeDays = Math.max(0, Math.round(days || 0));
  if (safeDays < 30) return "1개월 미만";
  const months = Math.max(1, Math.floor(safeDays / 30));
  return `${months}개월`;
}

function candidateScore(payment: DemoPayment, order: DemoOrder) {
  const payer = normalizeMatchText(payment.payerName);
  const company = normalizeMatchText(order.company);
  let score = 0;
  if (payer && company && (payer.includes(company) || company.includes(payer))) score += 55;
  if (payment.amount === order.ar) score += 40;
  if (Math.abs(payment.amount - order.ar) <= Math.max(1000, payment.amount * 0.01)) score += 25;
  return score;
}

function getMatchingCandidates(payment: DemoPayment, orders: DemoOrder[], selectedIds: string[] = []) {
  return orders
    .filter((order) => order.status === "open" || selectedIds.includes(order.id))
    .map((order) => ({ order, score: candidateScore(payment, order) }))
    .filter((candidate) => candidate.score >= MATCH_CANDIDATE_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function paymentUnmatchedReason(payment: DemoPayment, orders: DemoOrder[]) {
  if (orders.length === 0) return "주문 RAW 미업로드";
  const payer = normalizeMatchText(payment.payerName);
  const hasNameHint = orders.some((order) => {
    const company = normalizeMatchText(order.company);
    return payer && company && (payer.includes(company) || company.includes(payer));
  });
  const hasAmountHint = orders.some((order) => Math.abs(payment.amount - order.ar) <= Math.max(1000, payment.amount * 0.01));
  if (!hasNameHint && !hasAmountHint) return "거래처명/금액 모두 불일치";
  if (!hasNameHint) return "거래처명 불일치";
  if (!hasAmountHint) return "금액 불일치";
  return "추천 기준 미달";
}

function inferPaymentSales(payment: DemoPayment, orders: DemoOrder[], arRows: DemoArRecord[]) {
  const payer = normalizeMatchText(payment.payerName);
  const orderHint = orders.find((order) => {
    const company = normalizeMatchText(order.company);
    return payer && company && (payer.includes(company) || company.includes(payer));
  });
  if (orderHint?.sales) return normalizeSalesName(orderHint.sales);

  const arHint = arRows.find((record) => {
    const company = normalizeMatchText(record.company);
    return payer && company && (payer.includes(company) || company.includes(payer));
  });
  return arHint?.sales ? normalizeSalesName(arHint.sales) : "";
}

export default function CollectionsPage() {
  const { selectedUser } = useSelectedUser();
  const topSectionRef = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TableFilter>("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [salesFilter, setSalesFilter] = useState("all");
  const [actionStatuses, setActionStatuses] = useState<Record<string, CollectionActionStatus>>({});
  const [activeIssue, setActiveIssue] = useState<CollectionIssue | null>(null);
  const [actionMemo, setActionMemo] = useState("");
  const [highlightTop, setHighlightTop] = useState(false);
  const [showAllRows, setShowAllRows] = useState(false);
  const [summaryFilter, setSummaryFilter] = useState<CollectionSummaryFilter>("scheduled");
  const [assignedSales, setAssignedSales] = useState<Record<string, string>>({});
  const [orderPaste, setOrderPaste] = useState("");
  const [paymentPaste, setPaymentPaste] = useState("");
  const [orderFileMessage, setOrderFileMessage] = useState("");
  const [paymentFileMessage, setPaymentFileMessage] = useState("");
  const [arFileMessage, setArFileMessage] = useState("");
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [matchingDemo, setMatchingDemo] = useState<MatchingDemoState>({ orders: [], payments: [], matches: [] });
  const [selectedOrderIds, setSelectedOrderIds] = useState<Record<string, string[]>>({});
  const [assignedPaymentSales, setAssignedPaymentSales] = useState<Record<string, string>>({});
  const [arRecords, setArRecords] = useState<DemoArRecord[]>([]);

  const isAdmin = selectedUser.accessRole === "admin" || selectedUser.team === "VIPS팀";
  const recordsWithAssignments = useMemo(
    () => receivableRecords.map((record) => ({ ...record, sales: assignedSales[record.id] ?? record.sales })),
    [assignedSales]
  );
  const visibleRecords = useMemo(() => filterReceivablesByUser(recordsWithAssignments, selectedUser), [recordsWithAssignments, selectedUser]);
  const salesFilterOptions = useMemo(() => {
    const source = isAdmin ? recordsWithAssignments : visibleRecords;
    const names = new Set<string>();
    for (const record of source) {
      const name = normalizeSalesName(record.sales);
      if (name) names.add(name);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [isAdmin, recordsWithAssignments, visibleRecords]);
  const paymentSalesOptions = useMemo(() => {
    const names = new Set<string>(salesFilterOptions);
    for (const order of matchingDemo.orders) {
      const name = normalizeSalesName(order.sales);
      if (name && name !== "미매칭") names.add(name);
    }
    for (const record of arRecords) {
      const name = normalizeSalesName(record.sales);
      if (name && name !== "미매칭") names.add(name);
    }
    ["Harvey", "Lauren", "Riley", "Jake", "Terry", "Chris", "Robin"].forEach((name) => names.add(name));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [arRecords, matchingDemo.orders, salesFilterOptions]);
  const scopedRecords = useMemo(
    () =>
      visibleRecords.filter((record) => {
        const matchTeam = teamFilter === "all" || normalizeTeamName(record.team) === teamFilter;
        const matchSales = salesFilter === "all" || normalizeSalesName(record.sales) === salesFilter;
        return matchTeam && matchSales;
      }),
    [salesFilter, teamFilter, visibleRecords]
  );
  const summary = useMemo(() => buildCollectionSummary(scopedRecords), [scopedRecords]);
  const composition = useMemo(() => buildCollectionComposition(scopedRecords), [scopedRecords]);
  const unmappedRecords = useMemo(() => recordsWithAssignments.filter((record) => !normalizeSalesName(record.sales)), [recordsWithAssignments]);
  const mappedRecordsCount = useMemo(() => recordsWithAssignments.filter((record) => Boolean(normalizeSalesName(record.sales))).length, [recordsWithAssignments]);
  const allIssues = useMemo(() => buildCollectionIssues(scopedRecords), [scopedRecords]);
  const openIssues = useMemo(
    () => allIssues.filter((issue) => actionStatuses[issue.id]?.status !== "checked"),
    [actionStatuses, allIssues]
  );
  const checkedCount = allIssues.filter((issue) => actionStatuses[issue.id]?.status === "checked").length;
  const todayTotal = allIssues.length;
  const todayProgress = todayTotal > 0 ? Math.round((checkedCount / todayTotal) * 100) : 100;
  const partialCount = composition.partialRecords.length;
  const collectionScore = Math.max(
    0,
    100 -
      (summary.unpaidAmount > 0 ? 20 : 0) -
      (summary.longOverdueCount > 0 ? 20 : 0) -
      (partialCount > 0 ? 10 : 0) -
      (openIssues.length > 0 ? 10 : 0)
  );
  const scoreLabel = collectionScore >= 90 ? "Healthy" : collectionScore >= 70 ? "Attention" : "Risk";
  const analyticsRecords = isAdmin ? recordsWithAssignments : visibleRecords;
  const reviewDemoPayments = useMemo(
    () =>
      matchingDemo.payments.filter((payment) => {
        if (payment.status === "matched") return false;
        return matchingDemo.orders.some((order) => order.status === "open" && candidateScore(payment, order) >= MATCH_CANDIDATE_THRESHOLD);
      }),
    [matchingDemo]
  );
  const unmatchedDemoPayments = useMemo(
    () =>
      matchingDemo.payments.filter((payment) => {
        if (payment.status === "matched") return false;
        return !matchingDemo.orders.some((order) => order.status === "open" && candidateScore(payment, order) >= MATCH_CANDIDATE_THRESHOLD);
      }),
    [matchingDemo]
  );
  const scopedArRecords = useMemo(() => {
    const source = arRecords.length
      ? arRecords
      : analyticsRecords.map((record) => ({
          id: record.id,
          company: record.name,
          sales: normalizeSalesName(record.sales),
          team: normalizeTeamName(record.team),
          poid: record.id,
          poitemId: record.id,
          itemName: record.gubun ?? "",
          amount: record.expected,
          ar: record.diff,
          overdueDays: record.overdueDays,
          status: record.status
        }));
    return source.filter((record) => {
      const matchTeam = teamFilter === "all" || record.team === teamFilter;
      const matchSales = salesFilter === "all" || record.sales === salesFilter;
      const matchUser = isAdmin || record.sales === normalizeSalesName(selectedUser.salesName);
      return matchTeam && matchSales && matchUser;
    });
  }, [analyticsRecords, arRecords, isAdmin, salesFilter, selectedUser.salesName, teamFilter]);
  const arSummary = useMemo(() => {
    const totalAr = scopedArRecords.reduce((sum, record) => sum + record.ar, 0);
    const over30 = scopedArRecords.filter((record) => record.overdueDays >= 30);
    const highValue = scopedArRecords.filter((record) => record.ar >= 1000000);
    return {
      totalCount: scopedArRecords.length,
      totalAr,
      over30Count: over30.length,
      over30Amount: over30.reduce((sum, record) => sum + record.ar, 0),
      highCount: highValue.length,
      highAmount: highValue.reduce((sum, record) => sum + record.ar, 0)
    };
  }, [scopedArRecords]);
  const collectionSummaryRows = useMemo(() => {
    const completed = scopedArRecords.filter((record) => record.status.includes("완료") || record.ar <= 0);
    const partial = scopedArRecords.filter((record) => record.status.includes("부분"));
    const unpaid = scopedArRecords.filter((record) => record.ar > 0);
    const high = scopedArRecords.filter((record) => record.ar >= 1000000);
    const long = scopedArRecords.filter((record) => record.overdueDays >= 30);
    return {
      scheduled: scopedArRecords,
      completed,
      partial,
      unpaid,
      high,
      long
    };
  }, [scopedArRecords]);
  const collectionSummaryMetrics = useMemo(() => {
    const sumAmount = (rows: DemoArRecord[]) => rows.reduce((sum, record) => sum + (record.amount || record.ar), 0);
    const sumAr = (rows: DemoArRecord[]) => rows.reduce((sum, record) => sum + record.ar, 0);
    return {
      scheduled: { count: collectionSummaryRows.scheduled.length, amount: sumAmount(collectionSummaryRows.scheduled) },
      completed: { count: collectionSummaryRows.completed.length, amount: sumAmount(collectionSummaryRows.completed) },
      partial: { count: collectionSummaryRows.partial.length, amount: sumAr(collectionSummaryRows.partial) },
      unpaid: { count: collectionSummaryRows.unpaid.length, amount: sumAr(collectionSummaryRows.unpaid) },
      high: { count: collectionSummaryRows.high.length, amount: sumAr(collectionSummaryRows.high) },
      long: { count: collectionSummaryRows.long.length, amount: sumAr(collectionSummaryRows.long) }
    };
  }, [collectionSummaryRows]);
  const summaryFilterOptions: Array<{ key: CollectionSummaryFilter; label: string; count: number; amount: string; tone: "blue" | "green" | "orange" | "red" }> = [
    { key: "scheduled", label: "수금예정액", count: collectionSummaryMetrics.scheduled.count, amount: formatKrwShort(collectionSummaryMetrics.scheduled.amount), tone: "blue" },
    { key: "completed", label: "수금 완료금액", count: collectionSummaryMetrics.completed.count, amount: formatKrwShort(collectionSummaryMetrics.completed.amount), tone: "green" },
    { key: "unpaid", label: "미수금액", count: collectionSummaryMetrics.unpaid.count, amount: formatKrwShort(collectionSummaryMetrics.unpaid.amount), tone: "red" }
  ];
  const selectedSummaryRows = useMemo(
    () => collectionSummaryRows[summaryFilter].slice().sort((a, b) => b.ar - a.ar || b.overdueDays - a.overdueDays),
    [collectionSummaryRows, summaryFilter]
  );
  const longOverdueRows = useMemo(
    () => scopedArRecords.filter((record) => record.overdueDays >= 30).sort((a, b) => b.overdueDays - a.overdueDays || b.ar - a.ar),
    [scopedArRecords]
  );
  const arAgingRows = useMemo(() => {
    const buckets = [
      { label: "7일이내", test: (days: number) => days <= 7 },
      { label: "14일이내", test: (days: number) => days > 7 && days <= 14 },
      { label: "21일이내", test: (days: number) => days > 14 && days <= 21 },
      { label: "30일이내", test: (days: number) => days > 21 && days <= 30 },
      { label: "30일초과", test: (days: number) => days > 30 }
    ];
    return buckets.map((bucket) => {
      const rows = scopedArRecords.filter((record) => bucket.test(record.overdueDays));
      return { bucket: bucket.label, count: rows.length, amount: rows.reduce((sum, record) => sum + record.ar, 0) };
    });
  }, [scopedArRecords]);
  const arHighValueRows = useMemo(() => scopedArRecords.filter((record) => record.ar >= 1000000).sort((a, b) => b.ar - a.ar).slice(0, 8), [scopedArRecords]);
  const visibleUnmatchedPayments = useMemo(() => {
    if (isAdmin) return unmatchedDemoPayments;
    const userSales = normalizeSalesName(selectedUser.salesName);
    return unmatchedDemoPayments.filter((payment) => {
      const assigned = normalizeSalesName(assignedPaymentSales[payment.id]);
      const recommended = normalizeSalesName(inferPaymentSales(payment, matchingDemo.orders, scopedArRecords));
      return assigned === userSales || (!assigned && recommended === userSales);
    });
  }, [assignedPaymentSales, isAdmin, matchingDemo.orders, scopedArRecords, selectedUser.salesName, unmatchedDemoPayments]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const team = params.get("team");
    const sales = params.get("sales");
    if (team && (collectionTeamOptions.includes(team) || team === "all")) setTeamFilter(team);
    if (sales) setSalesFilter(sales);

    try {
      const raw = window.localStorage.getItem(ACTION_STATUS_KEY);
      if (raw) setActionStatuses(JSON.parse(raw) as Record<string, CollectionActionStatus>);
    } catch {
      setActionStatuses({});
    }

    try {
      const rawDemo = window.localStorage.getItem(MATCHING_DEMO_KEY);
      if (rawDemo) setMatchingDemo(JSON.parse(rawDemo) as MatchingDemoState);
    } catch {
      setMatchingDemo({ orders: [], payments: [], matches: [] });
    }

    try {
      const rawAr = window.localStorage.getItem(AR_DEMO_KEY);
      if (rawAr) setArRecords(JSON.parse(rawAr) as DemoArRecord[]);
    } catch {
      setArRecords([]);
    }

    try {
      const rawPaymentAssignments = window.localStorage.getItem(PAYMENT_ASSIGNMENT_KEY);
      if (rawPaymentAssignments) setAssignedPaymentSales(JSON.parse(rawPaymentAssignments) as Record<string, string>);
    } catch {
      setAssignedPaymentSales({});
    }
  }, []);

  const saveActionStatuses = (next: Record<string, CollectionActionStatus>) => {
    setActionStatuses(next);
    try {
      window.localStorage.setItem(ACTION_STATUS_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("icbanq:collection-action-change"));
    } catch {
      // Local UI still updates even when browser storage is unavailable.
    }
  };

  const visibleRecordRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return scopedRecords.filter((record) => {
      const matchFilter =
        filter === "all" ||
        (filter === "completed" && record.status === "완료") ||
        (filter === "partial" && record.status === "부분수금") ||
        (filter === "unpaid" && record.status === "미수") ||
        (filter === "long_overdue" && record.status !== "완료" && record.overdueDays >= 30) ||
        (filter === "unmatched_payment" && record.gubun === "신규매칭");
      const matchKeyword =
        !keyword ||
        record.name.toLowerCase().includes(keyword) ||
        record.sales.toLowerCase().includes(keyword) ||
        normalizeSalesName(record.sales).toLowerCase().includes(keyword);
      return matchFilter && matchKeyword;
    });
  }, [filter, query, scopedRecords]);
  const displayedRecordRows = showAllRows ? visibleRecordRows : visibleRecordRows.slice(0, 10);

  const adminSummary = useMemo(() => buildCollectionSummary(recordsWithAssignments), [recordsWithAssignments]);
  const teamStats = useMemo(() => buildTeamStats(recordsWithAssignments), [recordsWithAssignments]);
  const salesStats = useMemo(() => buildSalesStats(recordsWithAssignments), [recordsWithAssignments]);
  const salesPerformanceRows = useMemo(() => {
    const statMap = new Map(salesStats.map((row) => [row.label, row]));
    const names = new Set<string>();
    defaultSalesRoster.forEach((name) => names.add(name));
    TEST_USERS.filter((user) => user.role === "SALES").forEach((user) => names.add(user.salesName));
    salesStats.forEach((row) => names.add(row.label));
    matchingDemo.orders.forEach((order) => {
      const name = normalizeSalesName(order.sales);
      if (name) names.add(name);
    });
    arRecords.forEach((record) => {
      const name = normalizeSalesName(record.sales);
      if (name) names.add(name);
    });
    return Array.from(names)
      .filter((name) => name && name !== "미매칭")
      .map((name) => {
        const stat = statMap.get(name);
        return {
          label: name,
          rate: stat?.rate ?? 0,
          count: stat?.count ?? 0,
          remain: stat?.remain ?? 0,
          expected: stat?.expected ?? 0
        };
      })
      .sort((a, b) => b.expected - a.expected || a.label.localeCompare(b.label));
  }, [arRecords, matchingDemo.orders, salesStats]);
  const highValue = useMemo(
    () => analyticsRecords.filter((record) => record.status !== "완료" && record.diff >= 1000000).sort((a, b) => b.diff - a.diff),
    [analyticsRecords]
  );
  const agingRows = useMemo(() => {
    const buckets = ["7일이내", "14일이내", "21일이내", "30일이내", "30일초과"];
    return buckets.map((bucket) => {
      const records = analyticsRecords.filter((record) => record.status !== "완료" && record.agingBucket === bucket);
      return {
        bucket,
        count: records.length,
        amount: records.reduce((sum, record) => sum + record.diff, 0)
      };
    });
  }, [analyticsRecords]);
  const matchingReviewRows = useMemo(
    () => analyticsRecords.filter((record) => record.gubun === "신규매칭" || !normalizeSalesName(record.sales)),
    [analyticsRecords]
  );

  const issueActionLabel = (issue: CollectionIssue) => issue.actionLabel;

  const completeIssue = (issue: CollectionIssue, status: CollectionActionStatus["status"] = "checked") => {
    const next = {
      ...actionStatuses,
      [issue.id]: {
        issueId: issue.id,
        status,
        memo: actionMemo,
        checkedAt: new Date().toISOString(),
        checkedBy: selectedUser.name
      }
    };
    saveActionStatuses(next);
    setActionMemo("");
    setActiveIssue(null);
  };

  const focusTopIssue = () => {
    topSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setHighlightTop(true);
    window.setTimeout(() => setHighlightTop(false), 1400);
  };

  const assignSales = (record: ReceivableRecord) => {
    const nextSales = window.prompt(`${record.name} 담당자를 입력해주세요.`, record.fSales || "");
    if (!nextSales?.trim()) return;
    setAssignedSales((current) => ({ ...current, [record.id]: nextSales.trim() }));
  };

  const assignPaymentSales = (paymentId: string, salesName: string) => {
    const next = { ...assignedPaymentSales, [paymentId]: salesName };
    if (!salesName) delete next[paymentId];
    setAssignedPaymentSales(next);
    try {
      window.localStorage.setItem(PAYMENT_ASSIGNMENT_KEY, JSON.stringify(next));
    } catch {
      // Assignment remains visible in the current session.
    }
  };

  const saveMatchingDemo = (next: MatchingDemoState) => {
    setMatchingDemo(next);
    try {
      window.localStorage.setItem(MATCHING_DEMO_KEY, JSON.stringify(next));
    } catch {
      // Demo remains available in the current session.
    }
  };

  const recognizeMatchingData = () => {
    const orders = parseOrderPaste(orderPaste);
    const payments = parsePaymentPaste(paymentPaste);
    saveMatchingDemo({ orders, payments, matches: [] });
    setSelectedOrderIds({});
    if (orders.length === 0 || payments.length === 0) {
      window.alert("주문 데이터와 입금 데이터를 모두 인식해야 매칭 후보를 만들 수 있습니다.");
      return;
    }
    window.alert(`주문 ${orders.length}건, 입금 ${payments.length}건을 인식했습니다.`);
  };

  const importMatchingFile = async (file: File | undefined, kind: "orders" | "payments") => {
    if (!file) return;
    setIsReadingFile(true);
    try {
      const rows = await parseSpreadsheetFile(file);
      const text = tableRowsToText(rows);
      if (kind === "orders") {
        const parsed = parseOrderRows(rows);
        setOrderPaste(text);
        setOrderFileMessage(`${file.name} · 주문/Tracking ${parsed.length}건 인식 가능`);
      } else {
        const parsed = parsePaymentRows(rows);
        setPaymentPaste(text);
        saveMatchingDemo({
          ...matchingDemo,
          payments: parsed,
          matches: matchingDemo.matches.filter((match) => parsed.some((payment) => payment.id === match.paymentId))
        });
        const leftCount = parsed.filter((payment) => payment.status === "unmatched").length;
        setPaymentFileMessage(`${file.name} · 수금 ${parsed.length}건 · 남은금액/미매칭 ${leftCount}건 반영`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "파일을 읽지 못했습니다.";
      if (kind === "orders") setOrderFileMessage(message);
      else setPaymentFileMessage(message);
    } finally {
      setIsReadingFile(false);
    }
  };

  const importArFile = async (file: File | undefined) => {
    if (!file) return;
    setIsReadingFile(true);
    try {
      const rows = await parseSpreadsheetFile(file);
      const parsed = parseArRows(rows);
      setArRecords(parsed);
      window.localStorage.setItem(AR_DEMO_KEY, JSON.stringify(parsed));
      setArFileMessage(`${file.name} · AR ${parsed.length}건 · ${formatKrwShort(parsed.reduce((sum, record) => sum + record.ar, 0))} 인식`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "AR 파일을 읽지 못했습니다.";
      setArFileMessage(message);
    } finally {
      setIsReadingFile(false);
    }
  };

  const toggleDemoOrder = (paymentId: string, orderId: string) => {
    setSelectedOrderIds((current) => {
      const currentIds = current[paymentId] ?? [];
      const nextIds = currentIds.includes(orderId) ? currentIds.filter((id) => id !== orderId) : [...currentIds, orderId];
      return { ...current, [paymentId]: nextIds };
    });
  };

  const completeDemoMatch = (payment: DemoPayment) => {
    const orderIds = selectedOrderIds[payment.id] ?? [];
    if (orderIds.length === 0) {
      window.alert("매칭할 주문건을 먼저 선택해주세요.");
      return;
    }
    const amount = matchingDemo.orders.filter((order) => orderIds.includes(order.id)).reduce((sum, order) => sum + order.ar, 0);
    const now = new Date().toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).replace(/\. /g, ".").replace(/\.$/, "");
    const nextMatch: DemoCollectionMatch = {
      id: `match-${Date.now()}`,
      paymentId: payment.id,
      orderIds,
      amount,
      erpMatchingId: `MOCK-MATCH-${String(matchingDemo.matches.length + 1).padStart(4, "0")}`,
      matchedAt: now,
      matchedBy: selectedUser.name
    };
    saveMatchingDemo({
      orders: matchingDemo.orders.map((order) => (orderIds.includes(order.id) ? { ...order, status: "matched" } : order)),
      payments: matchingDemo.payments.map((item) => (item.id === payment.id ? { ...item, status: "matched" } : item)),
      matches: [nextMatch, ...matchingDemo.matches]
    });
    setSelectedOrderIds((current) => ({ ...current, [payment.id]: [] }));
  };

  return (
    <ModulePage
      eyebrow="COLLECTION ACTION CENTER"
      title="수금관리"
      description="입금확인, 수금매칭, 미수금 이슈를 한 곳에서 확인합니다."
    >
      <div className="space-y-5">
        <section className="ops-card bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_58%,#fff7f3_100%)] p-5">
          <div className={`grid gap-5 ${isAdmin ? "lg:grid-cols-[minmax(360px,0.72fr)_minmax(520px,1.28fr)]" : "lg:grid-cols-[1fr_260px]"}`}>
            <div>
              <div className="flex items-center gap-2 text-[#1D50A2]">
                <ShieldCheck size={18} />
                <p className="text-[11px] font-[950] uppercase tracking-[0.08em]">{isAdmin ? "VIPS COLLECTION VIEW" : "MY COLLECTION VIEW"}</p>
              </div>
              <h2 className="mt-3 text-[28px] font-[950] leading-tight tracking-[-0.03em] text-[#111827]">
                {isAdmin
                  ? `${selectedUser.name}님, 회사 전체 수금 현황을 관제합니다.`
                  : `${selectedUser.name}님, 오늘 확인해야 할 수금이 ${openIssues.length}건 있습니다.`}
              </h2>
              <p className="mt-2 text-[14px] font-[750] text-[#64748b]">
                {isAdmin ? "전체 AR과 팀별/담당자별 수금률을 한 화면에서 확인합니다." : "미수, 부분수금, 입금자명 매칭 이슈를 우선순위대로 정리했습니다."}
              </p>
              <button
                type="button"
                onClick={focusTopIssue}
                className="ops-btn-primary mt-5 inline-flex h-10 items-center gap-2 px-5 text-[13px] transition hover:-translate-y-0.5 hover:bg-[#1d4ed8]"
              >
                지금 확인하기
                <ArrowRight size={17} />
              </button>
            </div>
            {isAdmin ? (
              <div className="flex min-h-[190px] flex-col justify-center rounded-[18px] border border-[#e5eaf3] bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[12px] font-[900] text-[#64748b]">회사 전체 수금 관제</p>
                    <p className="mt-2 max-w-[360px] text-[12px] font-[750] leading-5 text-[#64748b]">
                      Admin이 업로드한 Aging 데이터를 기준으로 전체 수금률, AR, 장기미수 병목을 확인합니다.
                    </p>
                  </div>
                  <span className="rounded-full bg-[#edf4ff] px-3 py-1 text-[11px] font-[950] text-[#1D50A2]">Admin View</span>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-4">
                  <MiniAmount label="전체 수금률" value={`${adminSummary.collectionRate}%`} strong />
                  <MiniAmount label="전체 AR" value={formatKrwShort(adminSummary.unpaidAmount)} strong />
                  <MiniAmount label="확인 필요" value={`${buildCollectionIssues(recordsWithAssignments).length}건`} />
                  <MiniAmount label="30일 이상" value={`${adminSummary.longOverdueCount}건`} />
                </div>
                <p className="mt-3 text-[12px] font-[800] leading-5 text-[#64748b]">Admin은 점수보다 전체 수금 흐름과 병목을 봅니다.</p>
              </div>
            ) : (
              <div className="rounded-[18px] border border-[#e5eaf3] bg-white p-4">
                <p className="text-[12px] font-[900] text-[#64748b]">오늘의 Collection Score</p>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <p className="text-[48px] font-[950] leading-none tracking-[-0.05em] text-[#111827]">{collectionScore}<span className="text-[20px]">점</span></p>
                  <span className={`rounded-full px-3 py-1 text-[12px] font-[950] ${scoreLabel === "Healthy" ? "bg-[#edf4ff] text-[#1D50A2]" : scoreLabel === "Attention" ? "bg-[#fff5ec] text-[#b85f18]" : "bg-[#fff5ec] text-[#b85f18]"}`}>
                    {scoreLabel}
                  </span>
                </div>
                <p className="mt-4 text-[12px] font-[800] leading-5 text-[#64748b]">현재 사용자 {selectedUser.name} · {selectedUser.accessRole.toUpperCase()}</p>
              </div>
            )}
          </div>
        </section>

        <section className="ops-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-[20px] font-[950] tracking-[-0.02em] text-[#111827]">전체 수금 현황</h3>
              <p className="mt-1 text-[13px] font-[750] text-[#64748b]">
                {isAdmin ? "전체 직원" : `${selectedUser.name}님`}의 수금 대상 {composition.totalRecords}건 중 완료 {composition.completedRecords.length}건, 부분수금 {composition.partialRecords.length}건, 미수 {composition.unpaidRecords.length}건입니다.
              </p>
            </div>
            <div className="rounded-full bg-[#f8fbff] px-3 py-1.5 text-[12px] font-[900] text-[#1D50A2]">전체 수금률 {composition.collectionRate}%</div>
          </div>
          {isAdmin ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[16px] border border-[#e5eaf3] bg-[#fbfdff] px-3 py-3">
              <span className="text-[12px] font-[950] text-[#64748b]">팀별</span>
              <select
                value={teamFilter}
                onChange={(event) => {
                  setTeamFilter(event.target.value);
                  setShowAllRows(false);
                }}
                className="h-9 rounded-full border border-[#dce6f3] bg-white px-3 text-[12px] font-[900] text-[#111827] outline-none"
              >
                <option value="all">전체 팀</option>
                {collectionTeamOptions.map((team) => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>
              <span className="ml-1 text-[12px] font-[950] text-[#64748b]">담당자별</span>
              <select
                value={salesFilter}
                onChange={(event) => {
                  setSalesFilter(event.target.value);
                  setShowAllRows(false);
                }}
                className="h-9 rounded-full border border-[#dce6f3] bg-white px-3 text-[12px] font-[900] text-[#111827] outline-none"
              >
                <option value="all">전체 직원</option>
                {salesFilterOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-[900] text-[#64748b]">
                필터 결과 {scopedRecords.length}건
              </span>
            </div>
          ) : null}
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {summaryFilterOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setSummaryFilter(option.key)}
                className={`min-w-0 rounded-[18px] border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-[#1D50A2] ${
                  summaryFilter === option.key ? "border-[#1D50A2] ring-4 ring-blue-50" : "border-[#e5eaf3]"
                }`}
              >
                <SummaryTile label={option.label} count={`${option.count}건`} amount={option.amount} tone={option.tone} compact />
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] font-[750] text-[#94a3b8]">
            장기미수는 Admin이 업로드한 수금/AR 파일의 수금예정일 기준 경과일이 30일 이상인 건만 집계합니다.
          </p>
          <div className="mt-4 overflow-hidden rounded-[18px] border border-[#e7ecf4]">
            <div className="grid grid-cols-[minmax(220px,1fr)_120px_120px_100px_96px_110px] gap-2 bg-[#f8fbff] px-4 py-3 text-[11px] font-[950] text-[#64748b]">
              <span>거래처</span>
              <span>담당 Sales</span>
              <span>수금예정액</span>
              <span>미수금액</span>
              <span>경과일</span>
              <span>상태</span>
            </div>
            <div className="max-h-[360px] overflow-auto">
              {selectedSummaryRows.length === 0 ? (
                <p className="p-6 text-center text-[13px] font-[850] text-[#64748b]">선택한 기준에 맞는 수금 데이터가 없습니다.</p>
              ) : (
                selectedSummaryRows.map((record) => (
                  <div key={`${record.id}-${record.company}`} className="grid grid-cols-[minmax(220px,1fr)_120px_120px_100px_96px_110px] items-center gap-2 border-t border-[#eef2f7] bg-white px-4 py-3 text-[12px]">
                    <span className="min-w-0">
                      <b className="block truncate font-[950] text-[#111827]">{record.company}</b>
                      <span className="mt-0.5 block truncate text-[11px] font-[750] text-[#64748b]">{record.poid || "수금/AR"} · {record.poitemId || record.itemName || "-"}</span>
                    </span>
                    <span className="truncate font-[850] text-[#475569]">{record.sales || "미매칭"}</span>
                    <span className="truncate font-[900] text-[#111827]">{formatKrwShort(record.amount || record.ar)}</span>
                    <span className="truncate font-[950] text-[#b85f18]">{formatKrwShort(record.ar)}</span>
                    <span className={record.overdueDays >= 30 ? "font-[950] text-[#b85f18]" : "font-[850] text-[#64748b]"}>{record.overdueDays}일</span>
                    <span className="rounded-full bg-[#f8fbff] px-3 py-1 text-center text-[11px] font-[950] text-[#64748b]">{record.status || (record.ar > 0 ? "미수" : "완료")}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {isAdmin ? <section className="ops-card bg-[#fbfdff] px-4 py-3 text-[12px] font-[800] text-[#64748b]">
          전체 {recordsWithAssignments.length}건 중 담당자 매핑 성공 {mappedRecordsCount}건 · 담당자 미매칭 {unmappedRecords.length}건 · 현재 사용자 {selectedUser.name} 기준 {visibleRecords.length}건 표시
        </section> : null}

        {isAdmin ? <section className="ops-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-[950] uppercase tracking-[0.08em] text-[#1D50A2]">AR CONTROL</p>
              <h3 className="mt-1 text-[20px] font-[950] tracking-[-0.02em] text-[#111827]">미수금 Aging 관제</h3>
              <p className="mt-1 text-[13px] font-[750] text-[#64748b]">
                ERP 미수금 내역을 업로드하면 경과일과 AR 금액 기준으로 연체 Aging과 고액 미수를 바로 확인합니다.
              </p>
            </div>
            <div className="min-w-[320px] rounded-[16px] border border-dashed border-[#cfe0f4] bg-[#fbfdff] p-3">
              <input
                type="file"
                accept=".xls,.xlsx,.csv,.tsv,.txt"
                onChange={(event) => importArFile(event.target.files?.[0])}
                className="block w-full text-[12px] font-[800] text-[#475569] file:mr-3 file:rounded-full file:border-0 file:bg-[#edf4ff] file:px-3 file:py-2 file:text-[12px] file:font-[950] file:text-[#1D50A2]"
              />
              <p className="mt-2 text-[11px] font-[750] text-[#64748b]">COMPANY, SALES, POID, POITEMID, 경과일, AR 컬럼을 인식합니다.</p>
              {arFileMessage ? <p className="mt-1 text-[11px] font-[900] text-[#1D50A2]">{arFileMessage}</p> : null}
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <SummaryTile label="전체 AR 대상" count={`${arSummary.totalCount}건`} amount={formatKrwShort(arSummary.totalAr)} tone="blue" />
            <SummaryTile label="30일 이상 연체" count={`${arSummary.over30Count}건`} amount={formatKrwShort(arSummary.over30Amount)} tone="red" />
            <SummaryTile label="고액 미수" count={`${arSummary.highCount}건`} amount={formatKrwShort(arSummary.highAmount)} tone="orange" />
            <SummaryTile label="업로드 상태" count={arRecords.length ? "업로드됨" : "샘플"} amount={arRecords.length ? `${arRecords.length}건` : "기본 데이터"} tone="green" />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-[18px] border border-[#e5eaf3] bg-[#fbfdff] p-4">
              <h4 className="text-[15px] font-[950] text-[#111827]">연체 Aging</h4>
              <div className="mt-3 space-y-2">
                {arAgingRows.map((row) => {
                  const width = arSummary.totalAr > 0 ? Math.max(8, Math.round((row.amount / arSummary.totalAr) * 100)) : 0;
                  return (
                    <div key={row.bucket} className="rounded-[14px] border border-[#e7ecf4] bg-white px-3 py-2">
                      <div className="flex items-center justify-between text-[12px] font-[850] text-[#475569]">
                        <span>{row.bucket}</span>
                        <span>{row.count}건 · {formatKrwShort(row.amount)}</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#edf2f7]">
                        <span className="block h-full rounded-full bg-[#1D50A2]" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[18px] border border-[#e5eaf3] bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-[15px] font-[950] text-[#111827]">고액 미수 TOP</h4>
                <span className="rounded-full bg-[#fff5ec] px-3 py-1 text-[12px] font-[950] text-[#b85f18]">AR 기준</span>
              </div>
              <div className="mt-3 overflow-hidden rounded-[16px] border border-[#edf2f7]">
                <div className="grid grid-cols-[1.2fr_100px_90px_110px] bg-[#f3f7fc] px-3 py-2 text-[11px] font-[950] text-[#64748b]">
                  <span>거래처 / 주문</span>
                  <span>담당</span>
                  <span>경과일</span>
                  <span className="text-right">AR</span>
                </div>
                <div className="max-h-[280px] overflow-y-auto">
                  {arHighValueRows.length === 0 ? (
                    <p className="p-4 text-center text-[12px] font-[800] text-[#64748b]">표시할 AR 데이터가 없습니다.</p>
                  ) : (
                    arHighValueRows.map((row) => (
                      <div key={row.id} className="grid grid-cols-[1.2fr_100px_90px_110px] items-center border-t border-[#edf2f7] px-3 py-3 text-[12px]">
                        <span className="min-w-0">
                          <b className="block truncate font-[950] text-[#111827]">{row.company}</b>
                          <span className="mt-0.5 block truncate font-[750] text-[#64748b]">{row.poid} · {row.poitemId}</span>
                        </span>
                        <span className="font-[850] text-[#475569]">{row.sales || "미매칭"}</span>
                        <span className={row.overdueDays >= 30 ? "font-[950] text-[#b85f18]" : "font-[850] text-[#475569]"}>{row.overdueDays}일</span>
                        <span className="text-right font-[950] text-[#111827]">{formatKrwShort(row.ar)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </section> : null}

        <section className="hidden">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-[20px] font-[950] tracking-[-0.02em] text-[#111827]">수금매칭 예외 검토</h3>
              <p className="mt-1 text-[13px] font-[750] text-[#64748b]">
                전체를 펼치지 않고 Stat이 남은금액인 입금건만 주문 RAW와 대조해 후보 여부를 보여줍니다.
              </p>
            </div>
            <span className="rounded-full bg-[#edf4ff] px-3 py-1 text-[12px] font-[950] text-[#1D50A2]">
              API 연동 전 MVP
            </span>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            <label className="block">
              <span className="text-[12px] font-[900] text-[#475569]">주문/Tracking/미수 대상 데이터</span>
              <div className="mt-2 rounded-[16px] border border-dashed border-[#cfe0f4] bg-white p-3">
                <input
                  type="file"
                  accept=".xls,.xlsx,.csv,.tsv,.txt"
                  onChange={(event) => importMatchingFile(event.target.files?.[0], "orders")}
                  className="block w-full text-[12px] font-[800] text-[#475569] file:mr-3 file:rounded-full file:border-0 file:bg-[#edf4ff] file:px-3 file:py-2 file:text-[12px] file:font-[950] file:text-[#1D50A2]"
                />
                <p className="mt-2 text-[11px] font-[750] text-[#64748b]">
                  POITEM_ID, Customer Company, AMOUNT_KRW, AR AMOUNT 컬럼을 우선 인식합니다.
                </p>
                {orderFileMessage ? <p className="mt-1 text-[11px] font-[900] text-[#1D50A2]">{orderFileMessage}</p> : null}
              </div>
              <textarea
                value={orderPaste}
                onChange={(event) => setOrderPaste(event.target.value)}
                className="mt-2 h-[140px] w-full resize-none rounded-[16px] border border-[#dce6f3] bg-[#fbfdff] p-3 text-[12px] font-[750] leading-5 text-[#10203f] outline-none focus:border-[#1D50A2]"
                placeholder={"주문번호\tTracking\t거래처명\tSales\t세금계산서\t품목\t청구금액\tAR\nB260707026503\tTRK-8821\t자유에이테크\tLauren\tTAX-20260707-003\tE2726DS QHD IPS\t528000\t528000"}
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-[900] text-[#475569]">입금/수금 데이터</span>
              <div className="mt-2 rounded-[16px] border border-dashed border-[#cfe0f4] bg-white p-3">
                <input
                  type="file"
                  accept=".xls,.xlsx,.csv,.tsv,.txt"
                  onChange={(event) => importMatchingFile(event.target.files?.[0], "payments")}
                  className="block w-full text-[12px] font-[800] text-[#475569] file:mr-3 file:rounded-full file:border-0 file:bg-[#fff5ec] file:px-3 file:py-2 file:text-[12px] file:font-[950] file:text-[#b85f18]"
                />
                <p className="mt-2 text-[11px] font-[750] text-[#64748b]">
                  IDX, 입금일자, 금액, 비고, Stat 컬럼을 인식하고 남은 금액을 매칭 대상으로 분류합니다.
                </p>
                {paymentFileMessage ? <p className="mt-1 text-[11px] font-[900] text-[#b85f18]">{paymentFileMessage}</p> : null}
              </div>
              <textarea
                value={paymentPaste}
                onChange={(event) => setPaymentPaste(event.target.value)}
                className="mt-2 h-[140px] w-full resize-none rounded-[16px] border border-[#dce6f3] bg-[#fbfdff] p-3 text-[12px] font-[750] leading-5 text-[#10203f] outline-none focus:border-[#1D50A2]"
                placeholder={"입금ID\t입금일\t입금자명\t입금금액\t입금계좌\nPAY-20260707-001\t2026-07-07\t김지유\t851290\t우리은행145961"}
              />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] font-[750] text-[#64748b]">
              인식된 주문 {matchingDemo.orders.length}건 · 입금 {matchingDemo.payments.length}건 · Mock ERP 매칭 {matchingDemo.matches.length}건
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setOrderPaste("");
                  setPaymentPaste("");
                  setSelectedOrderIds({});
                  saveMatchingDemo({ orders: [], payments: [], matches: [] });
                }}
                className="ops-btn-secondary h-9 px-4 text-[12px]"
              >
                초기화
              </button>
              <button type="button" onClick={recognizeMatchingData} className="ops-btn-primary h-9 px-4 text-[12px]">
                {isReadingFile ? "파일 읽는 중" : "데이터 인식하기"}
              </button>
            </div>
          </div>

          {matchingDemo.payments.length > 0 ? (
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <SummaryTile label="남은금액 입금" count={`${matchingDemo.payments.filter((payment) => payment.status !== "matched").length}건`} amount="검토 대상" tone="orange" />
              <SummaryTile label="추천 후보 있음" count={`${reviewDemoPayments.length}건`} amount="매칭 가능" tone="blue" />
              <SummaryTile label="후보 없음" count={`${unmatchedDemoPayments.length}건`} amount="담당자 지정" tone="red" />
              <SummaryTile label="Mock 완료" count={`${matchingDemo.matches.length}건`} amount="ERP 반영 시연" tone="green" />
            </div>
          ) : null}

          {reviewDemoPayments.length > 0 ? (
            <div className="mt-5 grid gap-4">
              {reviewDemoPayments.slice(0, 8).map((payment) => {
                const selectedIds = selectedOrderIds[payment.id] ?? [];
                const candidates = getMatchingCandidates(payment, matchingDemo.orders, selectedIds);
                const selectedAmount = matchingDemo.orders.filter((order) => selectedIds.includes(order.id)).reduce((sum, order) => sum + order.ar, 0);
                const remain = payment.amount - selectedAmount;
                const match = matchingDemo.matches.find((item) => item.paymentId === payment.id);

                return (
                  <article key={payment.id} className="overflow-hidden rounded-[20px] border border-[#dce6f3] bg-white">
                    <div className="grid gap-3 border-b border-[#edf2f8] bg-[#fbfdff] p-4 lg:grid-cols-[1fr_260px]">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-3 py-1 text-[11px] font-[950] ${payment.status === "matched" ? "bg-[#edf4ff] text-[#1D50A2]" : "bg-[#fff5ec] text-[#b85f18]"}`}>
                            {payment.status === "matched" ? "매칭 완료" : "남은금액"}
                          </span>
                          {payment.rawStatus ? <span className="rounded-full bg-white px-3 py-1 text-[11px] font-[850] text-[#64748b]">{payment.rawStatus}</span> : null}
                          <span className="text-[12px] font-[850] text-[#64748b]">{payment.date}</span>
                        </div>
                        <p className="mt-2 truncate text-[18px] font-[950] text-[#111827]">{payment.payerName}</p>
                        <p className="mt-1 text-[12px] font-[800] text-[#64748b]">{payment.paymentNo} · {payment.account}</p>
                      </div>
                      <div className="rounded-[16px] border border-[#e5eaf3] bg-white px-4 py-3">
                        <div className="flex justify-between text-[12px] font-[850] text-[#64748b]">
                          <span>{payment.remainingAmount ? "남은금액" : "입금금액"}</span>
                          <b className="text-[#111827]">{formatKrwShort(payment.amount)}</b>
                        </div>
                        {payment.remainingAmount && payment.originalAmount ? (
                          <div className="mt-2 flex justify-between text-[12px] font-[850] text-[#64748b]">
                            <span>원입금액</span>
                            <b className="text-[#475569]">{formatKrwShort(payment.originalAmount)}</b>
                          </div>
                        ) : null}
                        <div className="mt-2 flex justify-between text-[12px] font-[850] text-[#64748b]">
                          <span>선택합계</span>
                          <b className="text-[#1D50A2]">{formatKrwShort(selectedAmount)}</b>
                        </div>
                        <div className="mt-2 flex justify-between text-[12px] font-[850] text-[#64748b]">
                          <span>남은금액</span>
                          <b className={remain === 0 ? "text-[#1D50A2]" : "text-[#b85f18]"}>{formatKrwShort(remain)}</b>
                        </div>
                      </div>
                    </div>

                    {match ? (
                      <div className="border-b border-[#edf2f8] bg-[#edf4ff] px-4 py-3 text-[12px] font-[850] text-[#1D50A2]">
                        ERP 반영 완료: {match.erpMatchingId} · {match.matchedAt} · 처리자 {match.matchedBy}
                      </div>
                    ) : null}

                    <details className="p-4" open={candidates.length > 0 && candidates[0]?.score >= 90}>
                      <summary className="cursor-pointer rounded-[14px] bg-[#f8fbff] px-3 py-2 text-[12px] font-[950] text-[#1D50A2]">
                        후보 {candidates.length}건 보기 / 선택 매칭
                      </summary>
                      <div className="grid grid-cols-[40px_1fr_120px_120px_90px] gap-2 rounded-[14px] bg-[#f3f7fc] px-3 py-2 text-[11px] font-[950] text-[#64748b]">
                        <span>선택</span>
                        <span>추천 주문 후보</span>
                        <span>AR</span>
                        <span>Sales</span>
                        <span>추천도</span>
                      </div>
                      <div className="mt-2 max-h-[260px] overflow-auto">
                        {candidates.map(({ order, score }) => (
                            <label key={`${payment.id}-${order.id}`} className="grid cursor-pointer grid-cols-[40px_1fr_120px_120px_90px] items-center gap-2 border-b border-[#eef2f7] px-3 py-3 text-[12px] hover:bg-[#fbfdff]">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(order.id)}
                                disabled={payment.status === "matched"}
                                onChange={() => toggleDemoOrder(payment.id, order.id)}
                                className="h-4 w-4 accent-[#1D50A2]"
                              />
                              <span className="min-w-0">
                                <b className="block truncate text-[13px] font-[950] text-[#111827]">{order.company} · {order.orderNo}</b>
                                <span className="mt-0.5 block truncate text-[11px] font-[750] text-[#64748b]">{order.trackingNo} · {order.taxId} · {order.itemName}</span>
                              </span>
                              <span className="font-[900] text-[#b85f18]">{formatKrwShort(order.ar)}</span>
                              <span className="font-[850] text-[#475569]">{order.sales}</span>
                              <span className="rounded-full bg-[#edf4ff] px-2 py-1 text-center text-[11px] font-[950] text-[#1D50A2]">{score}점</span>
                            </label>
                          ))}
                      </div>
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          disabled={payment.status === "matched" || selectedIds.length === 0}
                          onClick={() => completeDemoMatch(payment)}
                          className="ops-btn-primary h-10 px-5 text-[13px] disabled:opacity-50"
                        >
                          매칭 완료(Mock ERP 반영)
                        </button>
                      </div>
                    </details>
                  </article>
                );
              })}
            </div>
          ) : matchingDemo.payments.length > 0 ? (
            <div className="mt-5 rounded-[18px] border border-dashed border-[#dce6f3] bg-[#fbfdff] p-5 text-center">
              <p className="text-[13px] font-[900] text-[#475569]">추천 후보가 있는 수금건이 없습니다.</p>
              <p className="mt-1 text-[12px] font-[750] text-[#64748b]">
                후보 없는 남은금액은 아래 담당자 미매칭 수금건에서 담당자를 지정해 Sales 검토로 넘겨주세요.
              </p>
            </div>
          ) : null}
        </section>

        <section className="hidden">
          <article
            ref={topSectionRef}
            className={`ops-card min-w-0 overflow-hidden p-4 transition ${
              highlightTop ? "border-[#1D50A2] ring-4 ring-blue-100" : "border-[#dce6f3]"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[20px] font-[950] tracking-[-0.02em] text-[#111827]">오늘 확인해야 할 수금 TOP5</h3>
                <p className="mt-1 text-[13px] font-[750] text-[#64748b]">우선순위와 확인 이유를 기준으로 먼저 볼 거래를 정리했습니다.</p>
              </div>
              <span className="rounded-full bg-[#fff5ec] px-3 py-1 text-[12px] font-[950] text-[#b85f18]">{openIssues.length}건</span>
            </div>
            <div className="mt-4 space-y-3">
              {openIssues.slice(0, 5).length === 0 ? (
                <p className="rounded-[18px] bg-[#f8fbff] p-5 text-center text-[13px] font-[850] text-[#64748b]">오늘 확인할 수금 이슈가 없습니다.</p>
              ) : (
                openIssues.slice(0, 5).map((issue) => (
                  <div
                    key={issue.id}
                    className="w-full min-w-0 rounded-[16px] border border-[#e5eaf3] bg-[#fbfdff] p-4 transition hover:-translate-y-0.5 hover:bg-white"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-[950] ${priorityStyle[issue.priority]}`}>{issue.priority.toUpperCase()}</span>
                          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-[900] text-[#475569]">{issue.status}</span>
                        </div>
                        <p className="mt-2 truncate text-[17px] font-[950] text-[#111827]">{issue.company}</p>
                        <p className="mt-1 text-[12px] font-[850] text-[#64748b]">이유: {issue.reason} · 경과일 {issue.overdueDays}일</p>
                      </div>
                      <button onClick={() => { setActiveIssue(issue); setActionMemo(""); }} className="ops-btn-primary h-9 shrink-0 px-3 text-[12px]">
                        {issueActionLabel(issue)}
                      </button>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <MiniAmount label="예정금액" value={formatKrwShort(issue.expected)} />
                      <MiniAmount label="입금금액" value={formatKrwShort(issue.paid)} />
                      <MiniAmount label="차액" value={formatKrwShort(issue.diff)} strong />
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button onClick={() => { setActiveIssue(issue); setActionMemo(""); }} className="text-[12px] font-[900] text-[#1D50A2]">
                        메모 / 완료 처리
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="ops-card min-w-0 overflow-hidden p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-[20px] font-[950] tracking-[-0.02em] text-[#111827]">{isAdmin ? "전체 수금현황" : "내 전체 수금현황"}</h3>
                <p className="mt-1 text-[13px] font-[750] text-[#64748b]">완료/부분수금/미수 상태를 거래처별로 확인합니다.</p>
              </div>
              <div className="flex h-10 min-w-[230px] items-center gap-2 rounded-xl border border-[#dce6f3] bg-[#fbfdff] px-3">
                <Search size={15} className="text-[#94a3b8]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="거래처명, 담당자 검색"
                  className="min-w-0 flex-1 bg-transparent text-[12px] font-[800] text-[#10203f] outline-none placeholder:text-[#94a3b8]"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {filterOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setFilter(option.key)}
                className={`h-9 rounded-full px-4 text-[12px] font-[900] transition ${
                    filter === option.key ? "bg-[#1D50A2] text-white" : "border border-[#e5eaf3] bg-white text-[#475569] hover:bg-[#f8fbff]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="mt-4 overflow-hidden rounded-[18px] border border-[#e7ecf4]">
              <div className="grid grid-cols-[minmax(180px,1fr)_108px_108px_108px_84px_76px_88px_112px] gap-2 bg-[#f8fbff] px-4 py-3 text-[11px] font-[950] text-[#64748b]">
                <span>거래처</span>
                <span>예정금액</span>
                <span>입금금액</span>
                <span>차액</span>
                <span>상태</span>
                <span>경과일</span>
                <span>Aging</span>
                <span>액션</span>
              </div>
              <div className="max-h-[440px] overflow-auto">
                {visibleRecordRows.length === 0 ? (
                  <p className="p-6 text-center text-[13px] font-[850] text-[#64748b]">조건에 맞는 수금 데이터가 없습니다.</p>
                ) : (
                  displayedRecordRows.map((record) => {
                    const issue = buildCollectionIssues([record])[0];
                    return (
                      <div key={record.id} className="grid grid-cols-[minmax(180px,1fr)_108px_108px_108px_84px_76px_88px_112px] items-center gap-2 border-t border-[#eef2f7] bg-white px-4 py-3 text-[12px]">
                        <div className="min-w-0">
                          <p className="truncate font-[950] text-[#111827]">{record.name}</p>
                          <p className="truncate text-[11px] font-[800] text-[#64748b]">{normalizeSalesName(record.sales) || "담당자 미매칭"} · {normalizeTeamName(record.team)}</p>
                        </div>
                        <span className="truncate font-[900] text-[#111827]">{formatKrwShort(record.expected)}</span>
                        <span className="truncate font-[850] text-[#475569]">{formatKrwShort(record.paid)}</span>
                        <span className="truncate font-[900] text-[#b85f18]">{formatKrwShort(record.diff)}</span>
                        <span className={`rounded-full px-2 py-1 text-center text-[11px] font-[950] ${statusStyle(record.status)}`}>{record.status}</span>
                        <span className="font-[850] text-[#64748b]">{record.overdueDays}일</span>
                        <span className="font-[850] text-[#64748b]">{record.agingBucket}</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (issue) {
                              setActiveIssue(issue);
                              setActionMemo("");
                            }
                          }}
                          disabled={!issue}
                          className="h-8 rounded-full bg-[#f3f7ff] px-3 text-[11px] font-[900] text-[#1D50A2] disabled:bg-[#f8fafc] disabled:text-[#94a3b8]"
                        >
                          {issue ? issueActionLabel(issue) : "완료됨"}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            {visibleRecordRows.length > 10 ? (
              <button
                type="button"
                onClick={() => setShowAllRows((current) => !current)}
                className="ops-btn-secondary mt-3 h-10 w-full text-[13px]"
              >
                {showAllRows ? "접기" : `더보기 ${visibleRecordRows.length - 10}건`}
              </button>
            ) : null}
          </article>
        </section>

        <section className="grid gap-5 xl:grid-cols-1">
          <AdminPanel
            title="장기미수"
            rows={longOverdueRows.slice(0, 8).map((row) => [row.company, formatOverdueMonths(row.overdueDays), formatKrwShort(row.ar)])}
          />
        </section>

        {isAdmin ? (
          <>
            <section className="grid gap-5 xl:grid-cols-2">
              <AdminPanel title="팀별 성과" rows={teamStats.map((row) => [row.label, `${row.rate}%`, formatKrwShort(row.remain)])} />
              <AdminPanel title="담당자별 성과" rows={salesPerformanceRows.map((row) => [row.label, `${row.rate}%`, `${row.count}건`])} />
            </section>
            <section className="ops-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[20px] font-[950] tracking-[-0.02em] text-[#111827]">담당자 미매칭 수금건</h3>
                  <p className="mt-1 text-[13px] font-[750] text-[#64748b]">수금 RAW에는 남은금액이 있지만 주문 후보가 없어 Sales 검토 담당자를 먼저 지정해야 하는 건입니다.</p>
                </div>
                <span className="rounded-full bg-[#fff5ec] px-3 py-1 text-[12px] font-[950] text-[#b85f18]">{unmatchedDemoPayments.length}건</span>
              </div>
              <div className="mt-4 rounded-[16px] border border-dashed border-[#cfe0f4] bg-[#fbfdff] p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-[950] text-[#111827]">미매칭 수금 파일 업로드</p>
                    <p className="mt-1 text-[11px] font-[750] text-[#64748b]">Admin이 수금 RAW 파일을 올리면 담당자 지정 후 Sales 화면에 배포됩니다.</p>
                  </div>
                  <input
                    type="file"
                    accept=".xls,.xlsx,.csv,.tsv,.txt"
                    onChange={(event) => importMatchingFile(event.target.files?.[0], "payments")}
                    className="block max-w-[360px] text-[12px] font-[800] text-[#475569] file:mr-3 file:rounded-full file:border-0 file:bg-[#edf4ff] file:px-3 file:py-2 file:text-[12px] file:font-[950] file:text-[#1D50A2]"
                  />
                </div>
                {paymentFileMessage ? <p className="mt-2 text-[11px] font-[900] text-[#1D50A2]">{paymentFileMessage}</p> : null}
              </div>
              <div className="mt-4 overflow-hidden rounded-[18px] border border-[#e7ecf4]">
                <div className="grid grid-cols-[minmax(240px,1.2fr)_120px_100px_minmax(170px,1fr)_160px_130px] gap-2 bg-[#f8fbff] px-4 py-3 text-[11px] font-[950] text-[#64748b]">
                  <span>수금건</span>
                  <span>남은금액</span>
                  <span>입금일</span>
                  <span>미매칭 사유</span>
                  <span>추천 담당자</span>
                  <span>관리</span>
                </div>
                <div className="max-h-[360px] overflow-auto">
                  {unmatchedDemoPayments.length === 0 ? (
                    <p className="p-5 text-center text-[13px] font-[850] text-[#64748b]">담당자 미매칭 수금건이 없습니다.</p>
                  ) : (
                    unmatchedDemoPayments.map((payment) => {
                      const recommendedSales = inferPaymentSales(payment, matchingDemo.orders, scopedArRecords);
                      const assigned = assignedPaymentSales[payment.id] ?? "";
                      const reason = paymentUnmatchedReason(payment, matchingDemo.orders);
                      return (
                        <div key={payment.id} className="grid grid-cols-[minmax(240px,1.2fr)_120px_100px_minmax(170px,1fr)_160px_130px] items-center gap-2 border-t border-[#eef2f7] bg-white px-4 py-3 text-[12px]">
                          <span className="min-w-0">
                            <b className="block truncate font-[950] text-[#111827]">{payment.payerName}</b>
                            <span className="mt-0.5 block truncate text-[11px] font-[750] text-[#64748b]">
                              {payment.paymentNo} · {payment.account} · {payment.rawStatus || "남은금액"}
                            </span>
                          </span>
                          <span className="truncate font-[900] text-[#b85f18]">{formatKrwShort(payment.amount)}</span>
                          <span className="truncate font-[850] text-[#475569]">{payment.date}</span>
                          <span className="truncate font-[850] text-[#64748b]" title={reason}>{reason}</span>
                          <span className="min-w-0">
                            <select
                              value={assigned}
                              onChange={(event) => assignPaymentSales(payment.id, event.target.value)}
                              className="h-9 w-full rounded-xl border border-[#dce6f3] bg-[#fbfdff] px-3 text-[12px] font-[850] text-[#10203f] outline-none focus:border-[#1D50A2]"
                            >
                              <option value="">{recommendedSales ? `추천: ${recommendedSales}` : "담당자 선택"}</option>
                              {paymentSalesOptions.map((salesName) => (
                                <option key={`${payment.id}-${salesName}`} value={salesName}>
                                  {salesName}
                                </option>
                              ))}
                            </select>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const target = assigned || recommendedSales;
                              if (!target) {
                                window.alert("담당자를 먼저 선택해주세요.");
                                return;
                              }
                              assignPaymentSales(payment.id, target);
                              window.alert(`${payment.payerName} 수금건을 ${target} 담당 검토로 지정했습니다.`);
                            }}
                            className="h-9 rounded-xl bg-[#1D50A2] px-3 text-[11px] font-[950] text-white"
                          >
                            검토 지정
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </section>
          </>
        ) : null}

        {!isAdmin ? (
          <section className="ops-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[20px] font-[950] tracking-[-0.02em] text-[#111827]">내 담당 미매칭 수금건</h3>
                <p className="mt-1 text-[13px] font-[750] text-[#64748b]">
                  VIPS/Admin이 업로드하고 담당자로 지정한 미매칭 수금건입니다.
                </p>
              </div>
              <span className="rounded-full bg-[#fff5ec] px-3 py-1 text-[12px] font-[950] text-[#b85f18]">{visibleUnmatchedPayments.length}건</span>
            </div>
            <div className="mt-4 overflow-hidden rounded-[18px] border border-[#e7ecf4]">
              <div className="grid grid-cols-[minmax(240px,1.2fr)_130px_110px_minmax(180px,1fr)] gap-2 bg-[#f8fbff] px-4 py-3 text-[11px] font-[950] text-[#64748b]">
                <span>수금건</span>
                <span>남은금액</span>
                <span>입금일</span>
                <span>확인 내용</span>
              </div>
              <div className="max-h-[320px] overflow-auto">
                {visibleUnmatchedPayments.length === 0 ? (
                  <p className="p-5 text-center text-[13px] font-[850] text-[#64748b]">내 담당으로 지정된 미매칭 수금건이 없습니다.</p>
                ) : (
                  visibleUnmatchedPayments.map((payment) => {
                    const reason = paymentUnmatchedReason(payment, matchingDemo.orders);
                    return (
                      <div key={payment.id} className="grid grid-cols-[minmax(240px,1.2fr)_130px_110px_minmax(180px,1fr)] items-center gap-2 border-t border-[#eef2f7] bg-white px-4 py-3 text-[12px]">
                        <span className="min-w-0">
                          <b className="block truncate font-[950] text-[#111827]">{payment.payerName}</b>
                          <span className="mt-0.5 block truncate text-[11px] font-[750] text-[#64748b]">
                            {payment.paymentNo} · {payment.account} · {payment.rawStatus || "남은금액"}
                          </span>
                        </span>
                        <span className="truncate font-[900] text-[#b85f18]">{formatKrwShort(payment.amount)}</span>
                        <span className="truncate font-[850] text-[#475569]">{payment.date}</span>
                        <span className="truncate font-[850] text-[#64748b]" title={reason}>{reason}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        ) : null}
      </div>

      {activeIssue ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/45 px-4">
          <div className="w-full max-w-[520px] rounded-[24px] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[12px] font-[950] uppercase tracking-[0.08em] text-[#1D50A2]">COLLECTION ACTION</p>
                <h3 className="mt-2 text-[24px] font-[950] tracking-[-0.02em] text-[#111827]">{activeIssue.company}</h3>
                <p className="mt-1 text-[13px] font-[800] text-[#64748b]">{activeIssue.reason}</p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-[12px] font-[950] ${priorityStyle[activeIssue.priority]}`}>{priorityLabel(activeIssue.priority)}</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <InfoTile label="예정금액" value={formatKrwShort(activeIssue.expected)} />
              <InfoTile label="입금금액" value={formatKrwShort(activeIssue.paid)} />
              <InfoTile label="차액" value={formatKrwShort(activeIssue.diff)} />
              <InfoTile label="경과일" value={`${activeIssue.overdueDays}일`} />
            </div>
            <label className="mt-4 block">
              <span className="text-[12px] font-[900] text-[#475569]">처리 메모</span>
              <textarea
                value={actionMemo}
                onChange={(event) => setActionMemo(event.target.value)}
                className="mt-2 h-24 w-full resize-none rounded-[16px] border border-[#dce6f3] bg-[#fbfdff] p-3 text-[13px] font-[750] outline-none focus:border-[#1D50A2]"
                placeholder="확인 내용이나 후속 액션을 남겨주세요."
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setActiveIssue(null)} className="h-10 rounded-xl border border-[#dce6f3] bg-white px-4 text-[13px] font-[900] text-[#475569]">닫기</button>
              <button onClick={() => completeIssue(activeIssue, "request_vips")} className="h-10 rounded-xl bg-[#edf4ff] px-4 text-[13px] font-[950] text-[#1D50A2]">
                VIPS 확인 요청
              </button>
              <button onClick={() => completeIssue(activeIssue)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#111827] px-4 text-[13px] font-[950] text-white">
                <CheckCircle2 size={16} />
                확인 완료
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ModulePage>
  );
}

function KpiCard({ icon: Icon, label, value, tone }: { icon: typeof AlertCircle; label: string; value: string; tone: "red" | "orange" | "blue" | "green" | "slate" }) {
  const toneClass = {
    red: "bg-[#fff5ec] text-[#b85f18]",
    orange: "bg-[#fff5ec] text-[#b85f18]",
    blue: "bg-[#edf4ff] text-[#1D50A2]",
    green: "bg-[#edf4ff] text-[#1D50A2]",
    slate: "bg-[#f8fafc] text-[#475569]"
  }[tone];

  return (
    <article className="ops-card min-w-0 overflow-hidden p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${toneClass}`}>
        <Icon size={24} />
      </div>
      <p className="mt-3 text-[12px] font-[850] text-[#64748b]">{label}</p>
      <p className="mt-1 truncate text-[27px] font-[950] tracking-[-0.03em] text-[#111827]">{value}</p>
    </article>
  );
}

function SummaryTile({ label, count, amount, tone, compact = false }: { label: string; count: string; amount: string; tone: "blue" | "green" | "orange" | "red"; compact?: boolean }) {
  const toneClass = {
    blue: "bg-[#edf4ff] text-[#1D50A2]",
    green: "bg-[#edf4ff] text-[#1D50A2]",
    orange: "bg-[#fff5ec] text-[#b85f18]",
    red: "bg-[#fff5ec] text-[#b85f18]"
  }[tone];

  if (compact) {
    return (
      <div className="min-w-0 overflow-hidden">
        <p className="truncate text-[12px] font-[900] text-[#64748b]">{label}</p>
        <p className={`mt-3 inline-flex rounded-full px-3 py-1 text-[12px] font-[950] ${toneClass}`}>{count}</p>
        <p className="mt-3 truncate text-[19px] font-[950] tracking-[-0.02em] text-[#111827]">{amount}</p>
      </div>
    );
  }

  return (
    <article className="min-w-0 overflow-hidden rounded-[16px] border border-[#e5eaf3] bg-[#fbfdff] p-4">
      <p className="text-[12px] font-[900] text-[#64748b]">{label}</p>
      <p className={`mt-3 inline-flex rounded-full px-3 py-1 text-[12px] font-[950] ${toneClass}`}>{count}</p>
      <p className="mt-3 truncate text-[19px] font-[950] tracking-[-0.02em] text-[#111827]">{amount}</p>
    </article>
  );
}

function MiniAmount({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0 rounded-[14px] border border-[#e5eaf3] bg-white px-3 py-2">
      <p className="text-[10px] font-[850] text-[#94a3b8]">{label}</p>
      <p className={`mt-1 truncate text-[12px] font-[950] ${strong ? "text-[#b85f18]" : "text-[#111827]"}`}>{value}</p>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border border-[#e5eaf3] bg-[#fbfdff] p-4">
      <p className="text-[11px] font-[850] text-[#64748b]">{label}</p>
      <p className="mt-1 truncate text-[17px] font-[950] text-[#111827]">{value}</p>
    </div>
  );
}

function AdminPanel({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <article className="ops-card min-w-0 overflow-hidden p-4">
      <div className="flex items-center gap-2">
        <UserRound size={17} className="text-[#1D50A2]" />
        <h3 className="truncate text-[17px] font-[950] text-[#111827]">{title}</h3>
      </div>
      <div className="mt-4 max-h-[282px] space-y-2 overflow-auto pr-1">
        {rows.length === 0 ? (
          <p className="rounded-[14px] bg-[#f8fbff] p-3 text-[12px] font-[800] text-[#64748b]">표시할 데이터가 없습니다.</p>
        ) : (
          rows.map((row, index) => (
            <div key={`${title}-${index}`} className="grid grid-cols-3 gap-2 rounded-[14px] border border-[#e5eaf3] bg-[#fbfdff] px-3 py-2 text-[12px] font-[850] text-[#475569]">
              <span className="truncate font-[950] text-[#111827]">{row[0]}</span>
              <span className="truncate">{row[1]}</span>
              <span className="truncate text-right">{row[2]}</span>
            </div>
          ))
        )}
      </div>
    </article>
  );
}



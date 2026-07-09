"use client";

import { AlertTriangle, CalendarCheck, Clock3, X } from "lucide-react";
import { weeklyWorkItems } from "./homeData";

type BriefingReason = {
  id: string;
  title: string;
  description: string;
  tone: "red" | "orange" | "blue";
  route: string;
};

type BriefingSummary = {
  monthlyNeedCount: number;
  collectionNeedCount: number;
  delayedRequestCount: number;
};

const userBriefingSummary: Record<string, BriefingSummary> = {
  Harvey: { monthlyNeedCount: 3, collectionNeedCount: 1, delayedRequestCount: 0 },
  Lauren: { monthlyNeedCount: 6, collectionNeedCount: 1, delayedRequestCount: 0 },
  Riley: { monthlyNeedCount: 4, collectionNeedCount: 0, delayedRequestCount: 1 },
  Jake: { monthlyNeedCount: 2, collectionNeedCount: 1, delayedRequestCount: 0 },
  Terry: { monthlyNeedCount: 1, collectionNeedCount: 0, delayedRequestCount: 0 },
  Chris: { monthlyNeedCount: 0, collectionNeedCount: 1, delayedRequestCount: 0 },
  Robin: { monthlyNeedCount: 0, collectionNeedCount: 0, delayedRequestCount: 0 },
  Sally: { monthlyNeedCount: 0, collectionNeedCount: 0, delayedRequestCount: 0 },
  Vincent: { monthlyNeedCount: 0, collectionNeedCount: 0, delayedRequestCount: 0 },
  Gavin: { monthlyNeedCount: 0, collectionNeedCount: 0, delayedRequestCount: 0 }
};

function toneClass(tone: BriefingReason["tone"]) {
  if (tone === "red") return "bg-[#fef2f2] text-[#dc2626]";
  if (tone === "orange") return "bg-[#fff5ec] text-[#F39945]";
  return "bg-[#edf4ff] text-[#1D50A2]";
}

function BriefingMetric({ label, value, tone }: { label: string; value: string; tone: "red" | "orange" | "blue" }) {
  return (
    <div className={`rounded-[16px] border px-4 py-3 ${tone === "red" ? "border-[#fecaca] bg-[#fef2f2]" : "border-[#edf2f8] bg-[#fbfcff]"}`}>
      <p className="text-[11px] font-[850] text-[#64748b]">{label}</p>
      <p className={`mt-1 text-[22px] font-[950] tracking-[-0.04em] ${tone === "blue" ? "text-[#1D50A2]" : tone === "red" ? "text-[#dc2626]" : "text-[#F39945]"}`}>{value}</p>
    </div>
  );
}

function todayLabel() {
  const dayOrder = ["월", "화", "수", "목", "금"];
  const index = new Date().getDay();
  if (index >= 1 && index <= 5) return dayOrder[index - 1];
  return "월";
}

function getUserBriefingSummary(userName: string): BriefingSummary {
  return userBriefingSummary[userName] ?? { monthlyNeedCount: 0, collectionNeedCount: 0, delayedRequestCount: 0 };
}

function goMonthEnd() {
  const params = new URLSearchParams(window.location.search);
  const user = params.get("user");
  window.location.href = `/month-end${user ? `?user=${encodeURIComponent(user)}` : ""}`;
}

export function getTodayBriefingReasons(userName: string) {
  const today = new Date();
  const day = today.getDate();
  const userSummary = getUserBriefingSummary(userName);
  const userTotal = userSummary.monthlyNeedCount + userSummary.collectionNeedCount + userSummary.delayedRequestCount;
  const reasons: BriefingReason[] = [];

  if (userTotal === 0) return [];

  const todayWork = weeklyWorkItems.find((item) => item.date === todayLabel());
  if (todayWork) {
    reasons.push({
      id: `calendar-${todayWork.id}`,
      title: `오늘은 ${todayWork.title} 확인일입니다.`,
      description: todayWork.description ?? "이번 주 운영 캘린더 기준으로 오늘 업무를 먼저 확인해주세요.",
      tone: todayWork.status === "delayed" ? "red" : todayWork.status === "needCheck" ? "orange" : "blue",
      route: todayWork.relatedRoute ?? "/"
    });
  }

  if (day === 3) {
    reasons.push({
      id: "month-start",
      title: "오늘부터 월마감이 시작되었습니다.",
      description: "이번 달 거래 중 아직 종료되지 않은 건을 먼저 확인해주세요.",
      tone: "orange",
      route: "/month-end"
    });
  }

  if (day === 9) {
    reasons.push({
      id: "month-deadline-d1",
      title: "월마감 마감 D-1입니다.",
      description: "마감일은 매월 10일입니다. 월마감 이슈를 먼저 정리해주세요.",
      tone: "red",
      route: "/month-end"
    });
  }

  if (userSummary.delayedRequestCount > 0) {
    reasons.push({
      id: "delayed-request",
      title: `반려/지연 요청이 ${userSummary.delayedRequestCount}건 있습니다.`,
      description: "VIPS 요청 처리 흐름이 멈춘 건을 확인해주세요.",
      tone: "orange",
      route: "/request-status"
    });
  }

  if (userSummary.monthlyNeedCount > 0) {
    reasons.push({
      id: "month-issue",
      title: `내 월마감 체크건이 ${userSummary.monthlyNeedCount}건 있습니다.`,
      description: "출고, 계산서, Deduct 등 종료되지 않은 거래를 확인해주세요.",
      tone: "red",
      route: "/month-end"
    });
  }

  return reasons;
}

export function TodayBriefingModal({
  userName,
  reasons,
  onClose,
  onDismissToday
}: {
  userName: string;
  reasons: BriefingReason[];
  onClose: () => void;
  onDismissToday: () => void;
}) {
  if (reasons.length === 0) return null;

  const userSummary = getUserBriefingSummary(userName);
  const userTotal = userSummary.monthlyNeedCount + userSummary.collectionNeedCount + userSummary.delayedRequestCount;
  const isGateBlocked = userSummary.monthlyNeedCount > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0f172a]/28 px-4 py-6 backdrop-blur-[2px]">
      <section className={`w-full max-w-[560px] overflow-hidden rounded-[28px] border bg-white shadow-[0_28px_80px_rgba(15,23,42,0.22)] ${isGateBlocked ? "border-[#ef4444] ring-4 ring-red-100" : "border-[#e5eaf3]"}`}>
        <div className={`flex items-start justify-between gap-4 border-b px-6 py-5 ${isGateBlocked ? "border-[#fecaca] bg-[#fff7f7]" : "border-[#eef2f7]"}`}>
          <div className="min-w-0">
            <p className={`text-[11px] font-[950] uppercase tracking-[0.1em] ${isGateBlocked ? "text-[#dc2626]" : "text-[#F39945]"}`}>Today Briefing</p>
            <h2 className="mt-1 text-[25px] font-[950] tracking-[-0.035em] text-[#111827]">{userName}님, 오늘 먼저 확인할 업무가 있어요.</h2>
            <p className="mt-2 text-[13px] font-[750] text-[#64748b]">내 거래와 오늘 운영 캘린더 기준으로 먼저 볼 항목만 정리했습니다.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f8fafc] text-[#64748b] transition hover:bg-[#eef2f7]">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2.5 px-6 pt-5">
          <BriefingMetric label="내 월마감 체크건" value={`${userSummary.monthlyNeedCount}건`} tone={isGateBlocked ? "red" : "orange"} />
          <BriefingMetric label="내 수금 체크건" value={`${userSummary.collectionNeedCount}건`} tone="blue" />
          <BriefingMetric label="반려·지연 요청건" value={`${userSummary.delayedRequestCount}건`} tone="red" />
        </div>

        <div className="space-y-2.5 px-6 py-5">
          {isGateBlocked ? (
            <button
              type="button"
              onClick={goMonthEnd}
              className="flex w-full min-w-0 items-start gap-3 rounded-[18px] border-2 border-[#ef4444] bg-[#fef2f2] p-4 text-left shadow-[0_10px_24px_rgba(220,38,38,0.08)] transition hover:bg-[#fee2e2]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#dc2626] shadow-sm">
                <AlertTriangle size={20} />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-[950] text-[#dc2626]">월마감 미완료로 VIPS팀 요청 진입이 불가합니다.</span>
                <span className="mt-1 block text-[12px] font-[850] leading-5 text-[#991b1b]">
                  내 월마감 체크건 {userSummary.monthlyNeedCount}건을 먼저 확인한 뒤 요청을 진행해주세요.
                </span>
              </span>
            </button>
          ) : null}
          {reasons.slice(0, 3).map((reason) => (
            <button
              key={reason.id}
              type="button"
              onClick={() => (window.location.href = reason.route)}
              className="flex w-full min-w-0 items-start gap-3 rounded-[18px] border border-[#edf2f8] bg-[#fbfcff] p-4 text-left transition hover:border-[#cfe0ff] hover:bg-[#f8fbff]"
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${toneClass(reason.tone)}`}>
                {reason.id.includes("request") ? <Clock3 size={18} /> : reason.tone === "red" ? <AlertTriangle size={18} /> : <CalendarCheck size={18} />}
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-[950] text-[#111827]">{reason.title}</span>
                <span className="mt-1 block text-[12px] font-[750] leading-5 text-[#64748b]">{reason.description}</span>
              </span>
            </button>
          ))}
          <div className="rounded-[18px] border border-[#edf2f8] bg-[#fbfcff] p-4">
            <p className="text-[13px] font-[950] text-[#111827]">오늘 내 확인 대상은 총 {userTotal}건입니다.</p>
            <p className="mt-1 text-[12px] font-[750] leading-5 text-[#64748b]">월마감 {userSummary.monthlyNeedCount}건 · 수금 {userSummary.collectionNeedCount}건 · 반려/지연 {userSummary.delayedRequestCount}건</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#f8fbff] px-6 py-4">
          <button type="button" onClick={onDismissToday} className="h-10 rounded-full border border-[#dce6f3] bg-white px-4 text-[12px] font-[900] text-[#64748b] transition hover:bg-[#f8fafc]">
            오늘 다시 보지 않기
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="h-10 rounded-full border border-[#dce6f3] bg-white px-4 text-[12px] font-[900] text-[#64748b] transition hover:bg-[#f8fafc]">
              나중에 보기
            </button>
            <button type="button" onClick={goMonthEnd} className="h-10 rounded-full bg-[#F39945] px-5 text-[12px] font-[950] text-white shadow-[0_10px_18px_rgba(239,68,68,0.18)] transition hover:bg-[#b85f18]">
              오늘 업무 시작하기
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}


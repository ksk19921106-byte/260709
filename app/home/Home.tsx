"use client";

import { Search } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { RequestKind } from "../services/formValidation";
import { routeWithUser, searchGlobal } from "../services/globalSearch";
import { searchChips } from "./homeData";
import { HeroSection } from "./HeroSection";
import { MonthlyCheckCard } from "./MonthlyCheckCard";
import { CollectionCheckCard } from "./CollectionCheckCard";
import { WeeklyOpsCalendar } from "./WeeklyOpsCalendar";
import { GatekeeperBanner } from "./GatekeeperBanner";
import { QuickRequestSection } from "./QuickRequestSection";
import { RequestStatusSection } from "./RequestStatusSection";
import { ExchangeRateMiniCard, type MiniExchangeRate } from "./ExchangeRateMiniCard";
import { PerformanceMiniCard } from "./PerformanceMiniCard";
import { OperationNoticeMiniCard } from "./OperationNoticeMiniCard";
import { getTodayBriefingReasons, TodayBriefingModal } from "./TodayBriefingModal";

function HomeGroup({
  eyebrow,
  title,
  description,
  children,
  compact = false
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <section className={`min-w-0 rounded-[28px] border border-[#edf2f8] bg-white/40 shadow-[0_4px_14px_rgba(15,23,42,0.016)] ${compact ? "space-y-2.5 p-3.5" : "space-y-4 p-5"}`}>
      <div className="flex min-w-0 items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="text-[10px] font-[950] uppercase tracking-[0.1em] text-[#1D50A2]">{eyebrow}</p>
          <h2 className="mt-0.5 truncate text-[19px] font-[950] tracking-[-0.03em] text-[#111827]">{title}</h2>
        </div>
        <p className="hidden max-w-[560px] truncate text-right text-[12px] font-[750] text-[#64748b] lg:block">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function Home({
  userName,
  exchange,
  onSelectRequestKind
}: {
  userName: string;
  exchange: MiniExchangeRate;
  onSelectRequestKind: (kind: RequestKind) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showBriefing, setShowBriefing] = useState(false);
  const results = useMemo(() => searchGlobal(query, 6), [query]);
  const briefingReasons = useMemo(() => getTodayBriefingReasons(userName), [userName]);
  const showResults = query.trim().length > 0;

  useEffect(() => {
    if (briefingReasons.length === 0) return;
    const todayKey = new Date().toISOString().slice(0, 10);
    const storageKey = `icbanq.ops.todayBriefing.v2.dismissed.${userName}.${todayKey}`;
    try {
      if (window.localStorage.getItem(storageKey) === "true") return;
    } catch {
      // If storage is unavailable, still show the briefing for this session.
    }
    setShowBriefing(true);
  }, [briefingReasons.length, userName]);

  const dismissBriefingToday = () => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const storageKey = `icbanq.ops.todayBriefing.v2.dismissed.${userName}.${todayKey}`;
    try {
      window.localStorage.setItem(storageKey, "true");
    } catch {
      // Closing still works even if localStorage is unavailable.
    }
    setShowBriefing(false);
  };

  const goToResult = (route: string) => {
    router.push(routeWithUser(route, userName));
    setQuery("");
  };

  const submitSearch = () => {
    if (results[0]) goToResult(results[0].route);
  };

  return (
    <main className="home-main w-full min-w-0 overflow-x-hidden bg-[#eaf3ff]">
      {showBriefing ? (
        <TodayBriefingModal
          userName={userName}
          reasons={briefingReasons}
          onClose={() => setShowBriefing(false)}
          onDismissToday={dismissBriefingToday}
        />
      ) : null}
      <div className="home-shell mx-auto flex w-full max-w-[1840px] flex-col gap-5 px-5 pb-7 pt-[18px] 2xl:px-6">
        <section className="sticky top-0 z-40 min-w-0 overflow-visible border-b border-[#d7e6f7]/80 bg-[#eaf3ff]/94 px-0 py-3 backdrop-blur-xl">
          <div className="relative mx-auto flex w-full max-w-[1840px] min-w-0 flex-col items-start gap-2">
            <div className="flex h-[46px] w-full max-w-[620px] items-center gap-3 rounded-full border border-[#d5dfec] bg-white px-5 shadow-[0_10px_26px_rgba(15,23,42,0.07)] ring-1 ring-white">
              <Search size={18} className="shrink-0 text-[#64748b]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") submitSearch();
                }}
                placeholder="무엇을 찾고 계신가요?"
                className="h-full min-w-0 flex-1 bg-transparent text-[14px] font-[750] text-[#10203f] outline-none placeholder:text-[#94a3b8]"
              />
              <span className="shrink-0 rounded-lg bg-[#f2f4f8] px-2 py-1 text-[11px] font-[900] text-[#64748b]">⌘K</span>
            </div>
            <div className="flex min-h-7 max-w-[780px] min-w-0 flex-wrap justify-start gap-2 overflow-hidden">
              {searchChips.map((chip) => (
                <button key={chip} onClick={() => setQuery(chip)} className="h-7 rounded-full border border-[#e7ecf4] bg-white px-3 text-[12px] font-[850] text-[#475569] shadow-sm">
                  {chip}
                </button>
              ))}
            </div>
            {showResults ? (
              <div className="absolute left-0 top-[54px] z-50 w-[620px] max-w-[calc(100vw-64px)] overflow-hidden rounded-[22px] border border-[#dce6f3] bg-white p-2 shadow-[0_24px_60px_rgba(15,23,42,0.16)]">
                {results.length === 0 ? (
                  <div className="px-4 py-5 text-center text-[13px] font-[850] text-[#64748b]">검색 결과가 없습니다. 다른 키워드로 찾아보세요.</div>
                ) : (
                  results.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => goToResult(result.route)}
                      className="flex w-full min-w-0 items-center gap-3 rounded-[16px] px-3 py-3 text-left transition hover:bg-[#f6f8fb]"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#f2f6ff] text-[17px]">{result.iconLabel}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-[950] text-[#1D50A2]">{result.categoryLabel}</span>
                        <span className="block truncate text-[14px] font-[950] text-[#111827]">{result.title}</span>
                        <span className="block truncate text-[12px] font-[750] text-[#64748b]">{result.description}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
        </section>
        <HomeGroup
          eyebrow="Today Priority"
          title="오늘 해야 할 업무"
          description="오늘 처리할 업무와 이번 주 운영 흐름을 먼저 확인합니다."
        >
          <HeroSection userName={userName} />
          <WeeklyOpsCalendar />
          <div className="grid min-w-0 gap-3 lg:grid-cols-2">
            <MonthlyCheckCard />
            <CollectionCheckCard />
          </div>
        </HomeGroup>

        <HomeGroup
          eyebrow="Request Work Center"
          title="업무 요청"
          description="월마감 상태를 먼저 확인하고 필요한 요청을 등록합니다."
        >
          <GatekeeperBanner />
          <div className="grid min-w-0 gap-3 lg:grid-cols-2">
            <QuickRequestSection onSelectRequestKind={onSelectRequestKind} />
            <RequestStatusSection />
          </div>
        </HomeGroup>

        <HomeGroup
          eyebrow="Reference"
          title="참고 정보"
          description="환율, 성과, 운영 공지는 업무 판단을 돕는 보조 정보입니다."
          compact
        >
          <div className="grid min-w-0 gap-3 lg:grid-cols-3">
            <ExchangeRateMiniCard exchange={exchange} />
            <PerformanceMiniCard />
            <OperationNoticeMiniCard />
          </div>
        </HomeGroup>
      </div>
    </main>
  );
}


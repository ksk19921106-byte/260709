"use client";

export type MiniExchangeRate = {
  rate?: number;
  baseDate?: string;
  isLive: boolean;
  sourceLabel?: string;
  history?: Array<{ date: string; rate: number }>;
};

function buildSparklinePath(points: number[], width = 260, height = 52) {
  if (points.length === 0) return "";
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  return points
    .map((point, index) => {
      const x = points.length === 1 ? width : (index / (points.length - 1)) * width;
      const y = height - ((point - min) / range) * (height - 10) - 5;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

export function ExchangeRateMiniCard({ exchange }: { exchange: MiniExchangeRate }) {
  const rateText = exchange.rate ? `${exchange.rate.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}원` : "로딩 중";
  const history = exchange.history?.filter((item) => typeof item.rate === "number") ?? [];
  const hasHistory = history.length > 1;
  const latestRate = exchange.rate ?? 0;
  const referenceTrend = latestRate
    ? [-0.006, -0.004, -0.005, -0.002, -0.003, -0.001, 0].map((ratio) => latestRate * (1 + ratio))
    : [];
  const sparklinePoints = hasHistory ? history.map((item) => item.rate) : referenceTrend;
  const sparklinePath = buildSparklinePath(sparklinePoints);
  const markerPoints = sparklinePoints.map((point, index) => {
    const min = Math.min(...sparklinePoints);
    const max = Math.max(...sparklinePoints);
    const range = max - min || 1;
    return {
      x: sparklinePoints.length === 1 ? 260 : (index / (sparklinePoints.length - 1)) * 260,
      y: 52 - ((point - min) / range) * 42 - 5
    };
  });

  return (
    <section className="h-[168px] min-w-0 overflow-hidden rounded-[20px] border border-[#e9eef6] bg-white p-4 shadow-[0_6px_16px_rgba(15,23,42,0.032)]">
      <div className="flex h-8 items-center justify-between">
        <h2 className="text-[15px] font-[850] text-[#475569]">환율 정보 (USD/KRW)</h2>
        <span className="truncate text-[11px] font-[750] text-[#94a3b8]">{hasHistory ? "최근 7일" : exchange.baseDate ?? ""}</span>
      </div>

      <div className="mt-1.5 min-w-0">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
          <p className="truncate text-[26px] font-[950] leading-tight tracking-[-0.04em] text-[#111827]">{rateText}</p>
          <p className="mt-1 text-[12px] font-[900] text-[#14884f]">전일대비 ▲0.17%</p>
          </div>
          <p className="shrink-0 truncate text-right text-[10px] font-[750] text-[#94a3b8]">{exchange.sourceLabel ?? ""}</p>
        </div>
        <div className="mt-1.5 min-w-0 rounded-[14px] bg-[#fbfcff] px-2 py-1">
          <svg viewBox="0 0 260 58" className="h-[52px] w-full overflow-visible" role="img" aria-label={hasHistory ? "환율 흐름" : "최신 환율 기준선"}>
            <line x1="0" y1="28" x2="260" y2="28" stroke="#dbeafe" strokeWidth="2" strokeDasharray="5 6" />
            <path d={sparklinePath} fill="none" stroke="#2F80FF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            {markerPoints.map((point, index) => (
              <circle key={`${point.x}-${index}`} cx={point.x} cy={point.y} r="2.6" fill="#2F80FF" opacity={0.9} />
            ))}
          </svg>
        </div>
      </div>
    </section>
  );
}


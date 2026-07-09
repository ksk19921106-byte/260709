import { Award, BadgeCheck, CheckCircle2, Medal, TrendingUp } from "lucide-react";
import { ModulePage } from "../components/ModulePage";

const performancePoints = [
  "월마감 확인",
  "수금 확인",
  "계산서 점검",
  "요청 정확도",
  "반려 없는 요청",
  "Deduct 확인",
  "매칭 점검",
  "장기 미진행 정리",
  "카드전표 확인",
  "거래 종료 완료"
];

const badges = [
  { title: "거래 완결 배지", note: "판매 후 출고, 계산서, 입금까지 흐름을 끝까지 닫은 기록입니다.", date: "2026 Q2" },
  { title: "정확 요청 배지", note: "반려 없이 필요한 증빙과 사유를 정확히 제출했습니다.", date: "2026 Q2" },
  { title: "수금 책임 배지", note: "입금 확인과 수금매칭 흐름을 안정적으로 관리했습니다.", date: "2026 Q1" }
];

const metrics = [
  { label: "거래 정리 완료건", value: "42건", note: "전월 대비 +8" },
  { label: "반려 없는 요청", value: "11일", note: "streak 유지 중" },
  { label: "최근 정확도", value: "96%", note: "보완/반려 제외" }
];

export default function PerformancePage() {
  const completed = 7;

  return (
    <ModulePage
      eyebrow="Performance & Badge"
      title="성과 / 배지"
      description="판매 이후 출고, 계산서, 수금, 매칭까지 끝까지 관리한 운영 습관을 기록합니다."
    >
      <div className="mt-6 grid grid-cols-3 gap-3">
        {metrics.map((metric) => (
          <article key={metric.label} className="rounded-[22px] border border-[#e7ecf4] bg-[#fbfdff] p-4">
            <p className="text-[12px] font-[850] text-[#5b6b84]">{metric.label}</p>
            <p className="mt-2 text-[26px] font-[950] tracking-[-0.02em] text-[#10203f]">{metric.value}</p>
            <p className="mt-1 text-[12px] font-[700] text-[#075bdc]">{metric.note}</p>
          </article>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-[1.05fr_0.95fr] gap-4">
        <section className="rounded-[24px] border border-[#e7ecf4] bg-white p-5 shadow-[0_10px_26px_rgba(21,31,53,0.045)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[13px] font-[900] text-[#075bdc]">운영 루틴</p>
              <h2 className="mt-1 text-[21px] font-[950] tracking-[-0.02em] text-[#10203f]">이번 분기 거래 관리 {completed}/10</h2>
              <p className="mt-2 text-[13px] font-[650] leading-5 text-[#5b6b84]">좋은 Sales는 판매 후 거래 종료까지 책임집니다.</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf4ff] text-[#075bdc]">
              <Award size={27} />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-5 gap-3">
            {performancePoints.map((label, index) => {
              const active = index < completed;
              return (
                <div key={label} className="rounded-[18px] border border-[#e7ecf4] bg-[#fbfdff] px-3 py-3 text-center">
                  <div className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full ${active ? "bg-[#1D50A2] text-white" : "bg-[#e7edf6] text-[#7a8ba4]"}`}>
                    {active ? <CheckCircle2 size={18} /> : index + 1}
                  </div>
                  <p className="mt-2 min-h-[34px] text-[11px] font-[800] leading-[17px] text-[#34496b]">{label}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-5 rounded-[18px] border border-[#dce6f3] bg-[#fbfdff] px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-[850] text-[#34496b]">운영 배지까지</span>
              <span className="text-[13px] font-[900] text-[#075bdc]">3개 체크 남음</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#dce6f3]">
              <div className="h-full w-[70%] rounded-full bg-[#1D50A2]" />
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-[#e7ecf4] bg-white p-5 shadow-[0_10px_26px_rgba(21,31,53,0.045)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-[900] text-[#075bdc]">획득 배지</p>
              <h2 className="mt-1 text-[21px] font-[950] tracking-[-0.02em] text-[#10203f]">운영 기여 기록</h2>
            </div>
            <Medal size={28} className="text-[#075bdc]" />
          </div>

          <div className="mt-5 space-y-3">
            {badges.map((badge) => (
              <article key={badge.title} className="flex items-center gap-3 rounded-[18px] border border-[#e7ecf4] bg-[#fbfdff] px-4 py-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#075bdc] shadow-sm">
                  <BadgeCheck size={23} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-[900] text-[#10203f]">{badge.title}</p>
                  <p className="mt-1 text-[12px] font-[650] text-[#5b6b84]">{badge.note}</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-[850] text-[#075bdc]">{badge.date}</span>
              </article>
            ))}
          </div>

          <div className="mt-5 rounded-[18px] border border-[#dce6f3] bg-[#fbfdff] p-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-[#075bdc]" />
              <p className="text-[14px] font-[900] text-[#10203f]">운영 인정 기준</p>
            </div>
            <p className="mt-2 text-[12px] font-[650] leading-5 text-[#5b6b84]">
              매출 성과와 함께 요청 정확도, 입금 확인, 수금매칭, 거래 종료까지 함께 보는 방향으로 확장할 예정입니다.
            </p>
          </div>
        </section>
      </div>
    </ModulePage>
  );
}

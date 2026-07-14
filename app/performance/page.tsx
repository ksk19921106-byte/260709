import {
  AlertTriangle,
  Award,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Medal,
  Target,
  TrendingUp,
  WalletCards
} from "lucide-react";
import { ModulePage } from "../components/ModulePage";

const operatingSummary = [
  { label: "월마감 확인 건", value: "18건", note: "전월 대비 +4", icon: FileCheck2 },
  { label: "수금 확인 건", value: "12건", note: "미수/부분수금 점검", icon: WalletCards },
  { label: "요청 정확도", value: "96%", note: "보완/반려 제외", icon: Target },
  { label: "반려 없는 요청", value: "11일", note: "streak 유지 중", icon: CheckCircle2 }
];

const habitRows = [
  { label: "세금계산서 미발행 확인", value: "29건", status: "좋음", tone: "blue" },
  { label: "미출고 흐름 점검", value: "13건", status: "확인 필요", tone: "orange" },
  { label: "수금매칭 대기 확인", value: "5건", status: "진행중", tone: "blue" },
  { label: "월마감 사유 입력", value: "8건", status: "정리됨", tone: "green" }
];

const badges = [
  { title: "거래 완결 메달", note: "출고, 계산서, 수금 흐름을 끝까지 확인한 기록입니다.", state: "획득" },
  { title: "정확 요청 인증", note: "필수 증빙과 사유를 빠짐없이 제출했습니다.", state: "진행중" },
  { title: "AR 클리너", note: "미수/부분수금 이슈를 꾸준히 확인했습니다.", state: "진행중" },
  { title: "월마감 클로저", note: "월마감 이슈를 기한 안에 정리했습니다.", state: "대기" }
];

const improvementNotes = [
  "미출고 건은 계산서보다 출고 상태 확인이 먼저입니다.",
  "부분입금은 완납으로 착각하기 쉬우니 차액을 먼저 보세요.",
  "수정세금계산서 요청은 기존 계산서 번호와 사유가 핵심입니다."
];

function toneClass(tone: string) {
  if (tone === "orange") return "bg-[#fff5ec] text-[#F39945]";
  if (tone === "green") return "bg-[#ecfdf5] text-[#12825f]";
  return "bg-[#edf4ff] text-[#1D50A2]";
}

export default function PerformancePage() {
  return (
    <ModulePage
      eyebrow="OPERATION REPORT"
      title="성과 / 배지"
      description="매출 순위가 아니라, 거래를 끝까지 닫는 운영 습관과 정확도를 확인합니다."
    >
      <div className="mt-6 space-y-4">
        <section className="rounded-[28px] border border-[#e7ecf4] bg-white p-5 shadow-[0_10px_26px_rgba(21,31,53,0.045)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-[950] uppercase tracking-[0.08em] text-[#1D50A2]">Monthly Operating Summary</p>
              <h2 className="mt-1 text-[24px] font-[950] tracking-[-0.03em] text-[#111827]">이번 달 운영 습관 리포트</h2>
              <p className="mt-1 text-[13px] font-[750] text-[#64748b]">월마감, 수금, 요청 정확도를 한 화면에서 봅니다.</p>
            </div>
            <span className="rounded-full bg-[#edf4ff] px-4 py-2 text-[13px] font-[950] text-[#1D50A2]">운영 안정도 86점</span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {operatingSummary.map((metric) => {
              const Icon = metric.icon;
              return (
                <article key={metric.label} className="rounded-[20px] border border-[#e7ecf4] bg-[#fbfdff] p-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#edf4ff] text-[#1D50A2]">
                    <Icon size={18} />
                  </div>
                  <p className="mt-3 text-[12px] font-[850] text-[#64748b]">{metric.label}</p>
                  <p className="mt-1 text-[28px] font-[950] tracking-[-0.03em] text-[#111827]">{metric.value}</p>
                  <p className="mt-1 text-[12px] font-[800] text-[#1D50A2]">{metric.note}</p>
                </article>
              );
            })}
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[28px] border border-[#e7ecf4] bg-white p-5 shadow-[0_10px_26px_rgba(21,31,53,0.045)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-[950] uppercase tracking-[0.08em] text-[#1D50A2]">Work Habit</p>
                <h2 className="mt-1 text-[22px] font-[950] text-[#111827]">내 운영 루틴</h2>
                <p className="mt-1 text-[13px] font-[750] text-[#64748b]">Sales가 매일 놓치기 쉬운 운영 흐름을 기준으로 봅니다.</p>
              </div>
              <Award className="text-[#1D50A2]" size={28} />
            </div>

            <div className="mt-5 space-y-2">
              {habitRows.map((row) => (
                <article key={row.label} className="grid grid-cols-[minmax(0,1fr)_100px_92px] items-center gap-3 rounded-[18px] border border-[#e7ecf4] bg-[#fbfdff] px-4 py-3">
                  <p className="truncate text-[14px] font-[900] text-[#111827]">{row.label}</p>
                  <p className="text-right text-[16px] font-[950] text-[#111827]">{row.value}</p>
                  <span className={`justify-self-end rounded-full px-3 py-1 text-[11px] font-[950] ${toneClass(row.tone)}`}>{row.status}</span>
                </article>
              ))}
            </div>

            <div className="mt-5 rounded-[20px] border border-[#dce6f3] bg-[#f8fbff] p-4">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-[950] text-[#111827]">거래 종료 습관</p>
                <p className="text-[13px] font-[950] text-[#1D50A2]">68%</p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#dce6f3]">
                <div className="h-full w-[68%] rounded-full bg-[#1D50A2]" />
              </div>
              <p className="mt-2 text-[12px] font-[750] text-[#64748b]">계산서, 출고, 수금 확인이 모두 이어질수록 운영 안정도가 올라갑니다.</p>
            </div>
          </section>

          <section className="rounded-[28px] border border-[#e7ecf4] bg-white p-5 shadow-[0_10px_26px_rgba(21,31,53,0.045)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-[950] uppercase tracking-[0.08em] text-[#1D50A2]">Badge</p>
                <h2 className="mt-1 text-[22px] font-[950] text-[#111827]">운영 배지</h2>
              </div>
              <Medal size={28} className="text-[#1D50A2]" />
            </div>

            <div className="mt-5 space-y-3">
              {badges.map((badge) => (
                <article key={badge.title} className="flex items-start gap-3 rounded-[18px] border border-[#e7ecf4] bg-[#fbfdff] px-4 py-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#1D50A2] shadow-sm">
                    <BadgeCheck size={22} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-[950] text-[#111827]">{badge.title}</p>
                    <p className="mt-1 text-[12px] font-[750] leading-5 text-[#64748b]">{badge.note}</p>
                  </div>
                  <span className="rounded-full bg-[#edf4ff] px-3 py-1 text-[11px] font-[950] text-[#1D50A2]">{badge.state}</span>
                </article>
              ))}
            </div>
          </section>
        </div>

        <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <article className="rounded-[28px] border border-[#e7ecf4] bg-white p-5 shadow-[0_10px_26px_rgba(21,31,53,0.045)]">
            <div className="flex items-center gap-2">
              <TrendingUp size={20} className="text-[#1D50A2]" />
              <h2 className="text-[20px] font-[950] text-[#111827]">이번 달 좋아진 점</h2>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {["반려율 감소", "수금 확인 증가", "월마감 누락 감소"].map((label, index) => (
                <div key={label} className="rounded-[18px] border border-[#e7ecf4] bg-[#fbfdff] p-4">
                  <p className="text-[12px] font-[850] text-[#64748b]">{label}</p>
                  <p className="mt-2 text-[24px] font-[950] text-[#1D50A2]">{["-12%", "+6건", "-3건"][index]}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[28px] border border-[#e7ecf4] bg-white p-5 shadow-[0_10px_26px_rgba(21,31,53,0.045)]">
            <div className="flex items-center gap-2">
              <AlertTriangle size={20} className="text-[#F39945]" />
              <h2 className="text-[20px] font-[950] text-[#111827]">다음에 줄이면 좋은 실수</h2>
            </div>
            <div className="mt-4 space-y-2">
              {improvementNotes.map((note) => (
                <div key={note} className="rounded-[16px] border border-[#f5dfc8] bg-[#fffaf4] px-4 py-3 text-[13px] font-[800] text-[#475569]">
                  {note}
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </ModulePage>
  );
}

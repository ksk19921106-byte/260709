"use client";

const statusItems = [
  { label: "접수", value: "12", color: "text-[#64748b]", bg: "bg-[#f1f5f9]" },
  { label: "처리중", value: "8", color: "text-[#F39945]", bg: "bg-[#fff5ec]" },
  { label: "완료", value: "23", color: "text-[#1D50A2]", bg: "bg-[#edf4ff]" },
  { label: "반려", value: "2", color: "text-[#F39945]", bg: "bg-[#fff5ec]" }
];

function goRequestStatus() {
  const params = new URLSearchParams(window.location.search);
  const user = params.get("user");
  window.location.href = `/request-status${user ? `?user=${encodeURIComponent(user)}` : ""}`;
}

export function RequestStatusSection() {
  return (
    <button
      type="button"
      onClick={goRequestStatus}
      className="h-[204px] min-w-0 cursor-pointer overflow-hidden rounded-[20px] border border-[#e9eef6] bg-white p-5 text-left shadow-[0_6px_16px_rgba(15,23,42,0.032)] transition hover:border-[#cfe0ff] hover:shadow-[0_10px_24px_rgba(15,23,42,0.06)]"
    >
      <div className="flex h-8 items-center justify-between">
        <div>
          <h2 className="text-[16px] font-[950] text-[#111827]">나의 요청현황</h2>
          <p className="mt-0.5 text-[11px] font-[750] text-[#64748b]">요청 상태를 한눈에 확인합니다.</p>
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e9eef6] bg-[#f8fbff] text-[15px] font-[950] text-[#1D50A2] shadow-sm">
          →
        </span>
      </div>

      <div className="mt-4 grid min-w-0 grid-cols-4 gap-2.5">
        {statusItems.map((item) => (
          <div key={item.label} className="flex h-[106px] min-w-0 flex-col items-start justify-center gap-2 overflow-hidden rounded-[16px] border border-[#edf2f8] bg-[#fbfcff] px-3.5 shadow-[0_4px_10px_rgba(15,23,42,0.022)]">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.bg}`} />
            <div className="min-w-0">
              <p className="truncate text-[11px] font-[850] text-[#64748b]">{item.label}</p>
              <p className={`mt-1 truncate text-[26px] font-[950] leading-none ${item.color}`}>{item.value}</p>
            </div>
          </div>
        ))}
      </div>
    </button>
  );
}


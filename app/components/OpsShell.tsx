"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useSelectedUser, type TestUserName, type UserRole } from "../hooks/useSelectedUser";
import {
  BadgeCheck,
  BarChart3,
  CalendarCheck,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  FileText,
  GraduationCap,
  Home,
  LogOut
} from "lucide-react";

const DALBAENG_CHALLENGE_URL = "https://script.google.com/macros/s/AKfycbxP-bK6z-aWZtNrBF-he1ljukZ_mMFZvK_Ejce98vvFur3pfnx5rxOX8_2KT_N2LQ4GpQ/exec";
const BOOKBAENG_TEAMS_URL = "https://teams.microsoft.com/l/chat/19:88655096fbd943189e74fc222f276f15@thread.v2/conversations?context=%7B%22contextType%22%3A%22chat%22%7D";

const navItems: Array<{ id: string; label: string; href: string; icon: typeof Home; roles: UserRole[]; adminOnly?: boolean; badge?: number }> = [
  { id: "home", label: "홈", href: "/", icon: Home, roles: ["SALES", "VIPS"] },
  { id: "requests", label: "VIPS팀 요청", href: "/requests", icon: FileText, roles: ["SALES", "VIPS"] },
  { id: "request-status", label: "나의 요청현황", href: "/request-status", icon: FileText, roles: ["SALES", "VIPS"] },
  { id: "month-end", label: "월마감 체크", href: "/month-end", icon: CalendarCheck, roles: ["SALES", "VIPS"], badge: 7 },
  { id: "collections", label: "수금관리", href: "/collections", icon: CircleDollarSign, roles: ["SALES", "VIPS"] },
  { id: "vips-ops", label: "VIPS 운영", href: "/vips-ops", icon: BarChart3, roles: ["VIPS"], adminOnly: true },
  { id: "education", label: "교육센터", href: "/guide", icon: GraduationCap, roles: ["SALES", "VIPS"] },
  { id: "performance", label: "성과 / 배지", href: "/performance", icon: BadgeCheck, roles: ["SALES", "VIPS"] }
];

function Logo() {
  return (
    <div className="rounded-[16px] bg-white px-3 py-2 shadow-[0_10px_24px_rgba(13,43,94,0.2)]">
      <div className="relative h-[30px] w-[150px]">
        <Image src="/assets/brand/icbanq-logo-en.png" alt="ICBANQ" fill sizes="150px" className="object-contain" />
      </div>
      <span className="mt-1 block text-[10px] font-[900] uppercase tracking-[0.1em] text-[#1D50A2]">OPS Portal</span>
    </div>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function TestUserSwitcher({
  selectedUser,
  users,
  onChange,
  pathname
}: {
  selectedUser: ReturnType<typeof useSelectedUser>["selectedUser"];
  users: ReturnType<typeof useSelectedUser>["users"];
  onChange: (name: TestUserName) => void;
  pathname: string;
}) {
  return (
    <div className="rounded-[18px] border border-white/15 bg-white/10 px-3 py-2.5 shadow-[0_10px_24px_rgba(8,47,126,0.18)]">
      <div className="flex items-center gap-3">
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white shadow-sm">
          <Image src="/assets/brand/bandol-face.png" alt="ICBANQ 반돌이" fill sizes="36px" className="object-contain p-1" />
        </div>
        <div className="min-w-0 flex-1">
          <p data-selected-user-name="true" className="truncate text-[13px] font-[850] text-white">
            {selectedUser.name}님
          </p>
          <p data-selected-user-meta="true" className="text-xs font-[650] text-white/70">
            {selectedUser.role === "VIPS" ? "VIPS팀" : "SALES"} · {selectedUser.role}
          </p>
        </div>
        <ChevronDown size={15} className="text-white/80" />
      </div>
      <div className="mt-2.5">
        <span className="mb-2 block text-[10px] font-[850] uppercase tracking-[0.08em] text-white/70/90">테스트 로그인</span>
        <div className="grid gap-1.5">
          {users.map((user) => {
            const active = selectedUser.name === user.name;
            const switchHref = `${pathname}?user=${encodeURIComponent(user.name)}`;
            return (
              <a
                key={user.name}
                href={switchHref}
                data-test-user={user.name}
                data-test-role={user.role}
                onClick={() => onChange(user.name)}
                className={`flex h-9 items-center justify-between rounded-xl px-3 text-left text-[12px] font-[850] transition ${
                  active ? "bg-white text-[#1D50A2] shadow-sm" : "bg-white/10 text-white/85 hover:bg-white/18"
                }`}
              >
                <span>{user.name}</span>
                <span className={active ? "text-[#1D50A2]/70" : "text-white/70/75"}>{user.role}</span>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SidebarChallengeCard() {
  return (
    <div className="overflow-hidden rounded-[18px] border border-white/15 bg-white/10 p-3.5 shadow-[0_10px_24px_rgba(8,47,126,0.18)]">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[13px] font-[950] text-white">사내 챌린지</p>
          <p className="mt-0.5 text-[11px] font-[750] text-white/70">운동 · 독서 캠페인</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <a
          href={DALBAENG_CHALLENGE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[122px] flex-col items-center justify-center rounded-[16px] border border-white/20 bg-white px-2 py-3 text-center transition hover:-translate-y-0.5 hover:border-white"
        >
          <div className="relative flex h-[82px] w-[82px] items-center justify-center">
            <Image src="/assets/brand/bandol-full.png" alt="달뱅 챌린지" fill sizes="90px" className="object-contain object-center drop-shadow-sm" />
          </div>
          <p className="mt-1 text-[12px] font-[950] text-[#1D50A2]">달뱅</p>
        </a>
        <a
          href={BOOKBAENG_TEAMS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[122px] flex-col items-center justify-center rounded-[16px] border border-white/20 bg-white px-2 py-3 text-center transition hover:-translate-y-0.5 hover:border-white"
        >
          <div className="relative flex h-[82px] w-[82px] items-center justify-center">
            <Image src="/assets/brand/bansoon-full.png" alt="북뱅 챌린지" fill sizes="90px" className="object-contain object-center drop-shadow-sm" />
          </div>
          <p className="mt-1 text-[12px] font-[950] text-[#1D50A2]">북뱅</p>
        </a>
      </div>
    </div>
  );
}

export function OpsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { selectedUser, setSelectedUser, users } = useSelectedUser();

  return (
    <main className="min-h-screen overflow-x-clip bg-[#eaf3ff] text-[#111827]">
      <div className="grid min-h-screen grid-cols-[252px_minmax(0,1fr)]">
        <aside className="sticky top-3 m-3 flex min-h-[calc(100vh-24px)] w-[228px] flex-col overflow-hidden rounded-[26px] bg-[#1D50A2] px-3.5 py-4 text-white shadow-[14px_0_34px_rgba(29,80,162,0.2)]">
          <Logo />
          <div className="mt-4">
            <TestUserSwitcher selectedUser={selectedUser} users={users} onChange={setSelectedUser} pathname={pathname} />
          </div>

          <nav className="mt-5 space-y-1">
            {navItems.filter((item) => item.roles.includes(selectedUser.role) && (!item.adminOnly || selectedUser.accessRole === "admin" || selectedUser.team === "VIPS팀" || selectedUser.role === "VIPS")).map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.id}
                  href={`${item.href}?user=${encodeURIComponent(selectedUser.name)}`}
                  onClick={(event) => {
                    if (item.id !== "home") return;
                    event.preventDefault();
                    window.location.href = `/?user=${encodeURIComponent(selectedUser.name)}&home-reset=${Date.now()}`;
                  }}
                  className={`group flex h-[40px] w-full items-center gap-2.5 rounded-[16px] border bg-white px-2.5 text-[12px] font-[850] text-[#1D50A2] transition ${
                    active ? "border-white shadow-[0_8px_18px_rgba(8,47,126,0.18)]" : "border-white/40 hover:border-white hover:shadow-sm"
                  }`}
                >
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full ${active ? "bg-[#eaf3ff] text-[#1D50A2]" : "bg-[#edf4ff] text-[#1D50A2] group-hover:bg-[#e4efff]"}`}>
                    <item.icon size={16} strokeWidth={2.2} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[#1D50A2]">{item.label}</span>
                  {item.badge ? (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F39945] px-1.5 text-[11px] font-[900] text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-3 pt-5">
            <SidebarChallengeCard />
            <button className="flex h-[40px] w-full items-center gap-3 rounded-[12px] bg-white/10 px-3 text-[12px] font-[850] text-white/85 hover:bg-white/18 hover:text-white">
              <LogOut size={16} />
              로그아웃
            </button>
          </div>
        </aside>

        {children}
      </div>
    </main>
  );
}



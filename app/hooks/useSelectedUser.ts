"use client";

import { useEffect, useState } from "react";

export type TestUserName = "Sally" | "Vincent" | "Gavin" | "Harvey" | "Lauren" | "Riley" | "Jake" | "Terry" | "Chris" | "Robin";
export type UserRole = "SALES" | "VIPS";
export type AccessRole = "admin" | "manager" | "sales";

export type TestUser = {
  name: TestUserName;
  email: string;
  team: string;
  role: UserRole;
  accessRole: AccessRole;
  salesName: string;
};

export const TEST_USERS: TestUser[] = [
  { name: "Sally", email: "sally@icbanq.com", team: "VIPS팀", role: "VIPS", accessRole: "admin", salesName: "Sally" },
  { name: "Vincent", email: "vincent@icbanq.com", team: "VIPS팀", role: "VIPS", accessRole: "admin", salesName: "Vincent" },
  { name: "Gavin", email: "gavin@icbanq.com", team: "VIPS팀", role: "VIPS", accessRole: "admin", salesName: "Gavin" },
  { name: "Harvey", email: "harvey@icbanq.com", team: "영업1팀", role: "SALES", accessRole: "sales", salesName: "Harvey" },
  { name: "Lauren", email: "lauren@icbanq.com", team: "영업1팀", role: "SALES", accessRole: "sales", salesName: "Lauren" },
  { name: "Riley", email: "riley@icbanq.com", team: "영업1팀", role: "SALES", accessRole: "sales", salesName: "Riley" },
  { name: "Jake", email: "jake@icbanq.com", team: "영업2팀", role: "SALES", accessRole: "sales", salesName: "Jake" },
  { name: "Terry", email: "terry@icbanq.com", team: "영업2팀", role: "SALES", accessRole: "sales", salesName: "Terry" },
  { name: "Chris", email: "chris@icbanq.com", team: "영업3팀", role: "SALES", accessRole: "sales", salesName: "Chris" },
  { name: "Robin", email: "robin@icbanq.com", team: "영업3팀", role: "SALES", accessRole: "sales", salesName: "Robin" }
];

const STORAGE_KEY = "icbanq.ops.selectedUser";
const EVENT_NAME = "icbanq:selected-user-change";

function normalizeUser(value: string | null): TestUserName {
  const matched = TEST_USERS.find((user) => user.name.toLowerCase() === String(value || "").toLowerCase());
  return matched ? matched.name : "Sally";
}

function readStoredUser() {
  try {
    return window.localStorage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function writeStoredUser(name: TestUserName) {
  try {
    window.localStorage?.setItem(STORAGE_KEY, name);
  } catch {
    // URL state still keeps login switching working.
  }
}

export function getTestUser(name: string | null) {
  const normalized = normalizeUser(name);
  return TEST_USERS.find((user) => user.name === normalized) ?? TEST_USERS[0];
}

export function useSelectedUser() {
  const [selectedUser, setSelectedUserState] = useState<TestUser>(TEST_USERS[0]);

  useEffect(() => {
    const sync = () => {
      if (typeof window === "undefined") return;
      const userFromUrl = new URLSearchParams(window.location.search).get("user");
      const normalizedUrlUser = normalizeUser(userFromUrl);
      if (userFromUrl && TEST_USERS.some((user) => user.name.toLowerCase() === userFromUrl.toLowerCase())) {
        writeStoredUser(normalizedUrlUser);
        setSelectedUserState(getTestUser(normalizedUrlUser));
        return;
      }

      setSelectedUserState(getTestUser(readStoredUser()));
    };

    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(EVENT_NAME, sync);
    window.addEventListener("popstate", sync);

    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(EVENT_NAME, sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);

  const setSelectedUser = (name: TestUserName) => {
    writeStoredUser(name);
    const url = new URL(window.location.href);
    url.searchParams.set("user", name);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
    setSelectedUserState(getTestUser(name));
  };

  return {
    selectedUser,
    setSelectedUser,
    users: TEST_USERS
  };
}


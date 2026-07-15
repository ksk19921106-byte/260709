"use client";

import { useEffect, useState } from "react";

export type TestUserName = string;
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
  { name: "Abel", email: "abel@icbanq.com", team: "B2D", role: "SALES", accessRole: "sales", salesName: "Abel" },
  { name: "Eric", email: "eric@icbanq.com", team: "B2D", role: "SALES", accessRole: "sales", salesName: "Eric" },
  { name: "Harvey", email: "harvey@icbanq.com", team: "B2D", role: "SALES", accessRole: "sales", salesName: "Harvey" },
  { name: "Lauren", email: "lauren@icbanq.com", team: "B2D", role: "SALES", accessRole: "sales", salesName: "Lauren" },
  { name: "Morgan", email: "morgan@icbanq.com", team: "B2D", role: "SALES", accessRole: "sales", salesName: "Morgan" },
  { name: "Riley", email: "riley@icbanq.com", team: "B2D", role: "SALES", accessRole: "sales", salesName: "Riley" },
  { name: "Swan", email: "swan@icbanq.com", team: "B2D", role: "SALES", accessRole: "sales", salesName: "Swan" },
  { name: "Zeke", email: "zeke@icbanq.com", team: "B2D", role: "SALES", accessRole: "sales", salesName: "Zeke" },
  { name: "Dan", email: "dan@icbanq.com", team: "B2D", role: "SALES", accessRole: "sales", salesName: "Dan" },
  { name: "Kelvin", email: "kelvin@icbanq.com", team: "B2D", role: "SALES", accessRole: "sales", salesName: "Kelvin" },
  { name: "Jacob", email: "jacob@icbanq.com", team: "S1", role: "SALES", accessRole: "sales", salesName: "Jacob" },
  { name: "Joel", email: "joel@icbanq.com", team: "S1", role: "SALES", accessRole: "sales", salesName: "Joel" },
  { name: "Max", email: "max@icbanq.com", team: "S1", role: "SALES", accessRole: "sales", salesName: "Max" },
  { name: "Oscar", email: "oscar@icbanq.com", team: "S1", role: "SALES", accessRole: "sales", salesName: "Oscar" },
  { name: "Sean", email: "sean@icbanq.com", team: "S1", role: "SALES", accessRole: "sales", salesName: "Sean" },
  { name: "Terry", email: "terry@icbanq.com", team: "S1", role: "SALES", accessRole: "sales", salesName: "Terry" },
  { name: "Victor", email: "victor@icbanq.com", team: "S1", role: "SALES", accessRole: "sales", salesName: "Victor" },
  { name: "Winnie", email: "winnie@icbanq.com", team: "S1", role: "SALES", accessRole: "sales", salesName: "Winnie" },
  { name: "Zeff", email: "zeff@icbanq.com", team: "S1", role: "SALES", accessRole: "sales", salesName: "Zeff" },
  { name: "Chris", email: "chris@icbanq.com", team: "S2", role: "SALES", accessRole: "sales", salesName: "Chris" },
  { name: "Junny", email: "junny@icbanq.com", team: "S2", role: "SALES", accessRole: "sales", salesName: "Junny" },
  { name: "Leo", email: "leo@icbanq.com", team: "S2", role: "SALES", accessRole: "sales", salesName: "Leo" },
  { name: "Sonny", email: "sonny@icbanq.com", team: "S2", role: "SALES", accessRole: "sales", salesName: "Sonny" },
  { name: "Teo", email: "teo@icbanq.com", team: "S2", role: "SALES", accessRole: "sales", salesName: "Teo" },
  { name: "Owen", email: "owen@icbanq.com", team: "S3", role: "SALES", accessRole: "sales", salesName: "Owen" },
  { name: "Robin", email: "robin@icbanq.com", team: "S3", role: "SALES", accessRole: "sales", salesName: "Robin" },
  { name: "Stacey", email: "stacey@icbanq.com", team: "S3", role: "SALES", accessRole: "sales", salesName: "Stacey" },
  { name: "Sunny", email: "sunny@icbanq.com", team: "S3", role: "SALES", accessRole: "sales", salesName: "Sunny" },
  { name: "Yena", email: "yena@icbanq.com", team: "S3", role: "SALES", accessRole: "sales", salesName: "Yena" }
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


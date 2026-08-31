import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Teacher } from "@/lib/types";

interface AuthStore {
  token: string | null;
  teacher: Teacher | null;
  setToken: (t: string) => void;
  setUser: (u: Teacher) => void;
  clearToken: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      teacher: null,
      setToken: (token) => set({ token }),
      setUser: (teacher) => set({ teacher }),
      clearToken: () => set({ token: null, teacher: null }),
    }),
    { name: "scriptgrade.auth" },
  ),
);

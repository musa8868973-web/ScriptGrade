import { create } from "zustand";

interface GradeStore {
  activeStudentId: string | null;
  activeDebuggerTab: number; // 1–8
  showFlaggedOnly: boolean;
  viewMode: "scan" | "ocr";
  search: string;
  setActiveStudent: (id: string) => void;
  setDebuggerTab: (n: number) => void;
  toggleFlaggedOnly: () => void;
  setViewMode: (m: "scan" | "ocr") => void;
  setSearch: (q: string) => void;
}

export const useGradeStore = create<GradeStore>((set) => ({
  activeStudentId: null,
  activeDebuggerTab: 1,
  showFlaggedOnly: false,
  viewMode: "scan",
  search: "",
  setActiveStudent: (activeStudentId) => set({ activeStudentId }),
  setDebuggerTab: (activeDebuggerTab) => set({ activeDebuggerTab }),
  toggleFlaggedOnly: () => set((s) => ({ showFlaggedOnly: !s.showFlaggedOnly })),
  setViewMode: (viewMode) => set({ viewMode }),
  setSearch: (search) => set({ search }),
}));

import { create } from "zustand";

interface StudentPaperRef {
  url?: string | null;
  blobUrl?: string | null;
  file?: File | null;
  studentId?: string | null;
}

interface GradeStore {
  activeStudentId: string | null;
  activeDebuggerTab: number; // 1–8
  showFlaggedOnly: boolean;
  viewMode: "scan" | "ocr";
  search: string;

  // Dynamically tracked student paper for SheetViewer
  studentPaperUrl: string | null;
  studentPaperBlobUrl: string | null;
  studentPaperFile: File | null;

  setActiveStudent: (id: string) => void;
  setDebuggerTab: (n: number) => void;
  toggleFlaggedOnly: () => void;
  setViewMode: (m: "scan" | "ocr") => void;
  setSearch: (q: string) => void;

  setStudentPaper: (ref: StudentPaperRef) => void;
  clearStudentPaper: () => void;
}

export const useGradeStore = create<GradeStore>((set) => ({
  activeStudentId: null,
  activeDebuggerTab: 1,
  showFlaggedOnly: false,
  viewMode: "scan",
  search: "",

  studentPaperUrl: null,
  studentPaperBlobUrl: null,
  studentPaperFile: null,

  setActiveStudent: (activeStudentId) => set({ activeStudentId }),
  setDebuggerTab: (activeDebuggerTab) => set({ activeDebuggerTab }),
  toggleFlaggedOnly: () => set((s) => ({ showFlaggedOnly: !s.showFlaggedOnly })),
  setViewMode: (viewMode) => set({ viewMode }),
  setSearch: (search) => set({ search }),

  setStudentPaper: ({ url, blobUrl, file, studentId }) => {
    let derivedBlobUrl = blobUrl ?? null;
    if (file && !derivedBlobUrl && typeof window !== "undefined" && window.URL) {
      try {
        derivedBlobUrl = URL.createObjectURL(file);
      } catch (e) {
        console.warn("Failed to create object URL for student paper file:", e);
      }
    }
    set((state) => ({
      studentPaperUrl: url !== undefined ? url : state.studentPaperUrl,
      studentPaperBlobUrl: derivedBlobUrl !== undefined ? derivedBlobUrl : state.studentPaperBlobUrl,
      studentPaperFile: file !== undefined ? file : state.studentPaperFile,
      activeStudentId: studentId ? studentId : state.activeStudentId,
    }));
  },

  clearStudentPaper: () => {
    set((state) => {
      if (state.studentPaperBlobUrl && typeof window !== "undefined" && window.URL) {
        try {
          URL.revokeObjectURL(state.studentPaperBlobUrl);
        } catch {
          // ignore
        }
      }
      return {
        studentPaperUrl: null,
        studentPaperBlobUrl: null,
        studentPaperFile: null,
      };
    });
  },
}));

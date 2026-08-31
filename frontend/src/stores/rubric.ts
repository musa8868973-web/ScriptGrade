import { create } from "zustand";
import type { EvaluationToggles, MagicConcept } from "@/lib/types";

interface RubricStore {
  examId: string | null;
  examName: string;
  concepts: MagicConcept[];
  toggles: EvaluationToggles;
  step: 1 | 2 | 3 | 4;
  setExam: (id: string | null, name?: string) => void;
  setStep: (s: 1 | 2 | 3 | 4) => void;
  hydrate: (concepts: Omit<MagicConcept, "id">[]) => void;
  addConcept: (c: MagicConcept) => void;
  removeConcept: (id: string) => void;
  updateConcept: (id: string, patch: Partial<MagicConcept>) => void;
  setToggle: (key: keyof EvaluationToggles, val: boolean) => void;
  reset: () => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);

export const useRubricStore = create<RubricStore>((set) => ({
  examId: null,
  examName: "",
  concepts: [],
  toggles: {
    spelling_correction: true,
    strict_dag_order: false,
    density_scoring: true,
  },
  step: 1,
  setExam: (examId, examName) => set((s) => ({ examId, examName: examName ?? s.examName })),
  setStep: (step) => set({ step }),
  hydrate: (concepts) =>
    set({ concepts: concepts.map((c) => ({ ...c, id: uid() })), step: 3 }),
  addConcept: (c) => set((s) => ({ concepts: [...s.concepts, c] })),
  removeConcept: (id) => set((s) => ({ concepts: s.concepts.filter((c) => c.id !== id) })),
  updateConcept: (id, patch) =>
    set((s) => ({
      concepts: s.concepts.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    })),
  setToggle: (key, val) => set((s) => ({ toggles: { ...s.toggles, [key]: val } })),
  reset: () => set({ examId: null, examName: "", concepts: [], step: 1 }),
}));

export const newConcept = (keyword: string, points: number): MagicConcept => ({
  id: uid(),
  keyword,
  points,
  synonyms: [],
});

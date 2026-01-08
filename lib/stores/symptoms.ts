import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SymptomLog, Symptom, SymptomCategory, SymptomSeverity } from "@/types";

// Predefined symptoms library
export const SYMPTOMS_LIBRARY: Symptom[] = [
  // Digestive
  { id: "bloating", name: "Bloating", category: "digestive" },
  { id: "nausea", name: "Nausea", category: "digestive" },
  { id: "heartburn", name: "Heartburn", category: "digestive" },
  { id: "constipation", name: "Constipation", category: "digestive" },
  { id: "diarrhea", name: "Diarrhea", category: "digestive" },
  { id: "stomach_pain", name: "Stomach Pain", category: "digestive" },
  { id: "gas", name: "Gas/Flatulence", category: "digestive" },

  // Energy
  { id: "fatigue", name: "Fatigue", category: "energy" },
  { id: "low_energy", name: "Low Energy", category: "energy" },
  { id: "insomnia", name: "Insomnia", category: "energy" },
  { id: "drowsiness", name: "Drowsiness", category: "energy" },

  // Mood
  { id: "anxiety", name: "Anxiety", category: "mood" },
  { id: "irritability", name: "Irritability", category: "mood" },
  { id: "brain_fog", name: "Brain Fog", category: "mood" },
  { id: "depression", name: "Low Mood", category: "mood" },
  { id: "stress", name: "Stress", category: "mood" },

  // Pain
  { id: "headache", name: "Headache", category: "pain" },
  { id: "migraine", name: "Migraine", category: "pain" },
  { id: "muscle_pain", name: "Muscle Pain", category: "pain" },
  { id: "joint_pain", name: "Joint Pain", category: "pain" },
  { id: "back_pain", name: "Back Pain", category: "pain" },

  // Skin
  { id: "acne", name: "Acne", category: "skin" },
  { id: "rash", name: "Rash", category: "skin" },
  { id: "dry_skin", name: "Dry Skin", category: "skin" },
  { id: "itching", name: "Itching", category: "skin" },

  // Respiratory
  { id: "congestion", name: "Congestion", category: "respiratory" },
  { id: "cough", name: "Cough", category: "respiratory" },
  { id: "shortness_breath", name: "Shortness of Breath", category: "respiratory" },

  // Other
  { id: "dizziness", name: "Dizziness", category: "other" },
  { id: "sweating", name: "Excessive Sweating", category: "other" },
  { id: "cravings", name: "Food Cravings", category: "other" },
];

interface SymptomsState {
  logs: SymptomLog[];
  customSymptoms: Symptom[];

  // Actions
  addSymptomLog: (log: Omit<SymptomLog, "id">) => void;
  updateSymptomLog: (id: string, updates: Partial<SymptomLog>) => void;
  deleteSymptomLog: (id: string) => void;
  addCustomSymptom: (symptom: Omit<Symptom, "id">) => void;
  getLogsByDate: (date: string) => SymptomLog[];
  getLogsByDateRange: (startDate: string, endDate: string) => SymptomLog[];
  getLogsBySymptom: (symptomId: string) => SymptomLog[];
  getAllSymptoms: () => Symptom[];
}

export const useSymptomsStore = create<SymptomsState>()(
  persist(
    (set, get) => ({
      logs: [],
      customSymptoms: [],

      addSymptomLog: (log) => {
        const newLog: SymptomLog = {
          ...log,
          id: crypto.randomUUID(),
        };
        set((state) => ({ logs: [...state.logs, newLog] }));
      },

      updateSymptomLog: (id, updates) => {
        set((state) => ({
          logs: state.logs.map((log) =>
            log.id === id ? { ...log, ...updates } : log
          ),
        }));
      },

      deleteSymptomLog: (id) => {
        set((state) => ({
          logs: state.logs.filter((log) => log.id !== id),
        }));
      },

      addCustomSymptom: (symptom) => {
        const newSymptom: Symptom = {
          ...symptom,
          id: `custom_${crypto.randomUUID()}`,
        };
        set((state) => ({
          customSymptoms: [...state.customSymptoms, newSymptom],
        }));
      },

      getLogsByDate: (date) => {
        const targetDate = new Date(date).toDateString();
        return get().logs.filter(
          (log) => new Date(log.dateTime).toDateString() === targetDate
        );
      },

      getLogsByDateRange: (startDate, endDate) => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        return get().logs.filter((log) => {
          const logDate = new Date(log.dateTime);
          return logDate >= start && logDate <= end;
        });
      },

      getLogsBySymptom: (symptomId) => {
        return get().logs.filter((log) => log.symptomId === symptomId);
      },

      getAllSymptoms: () => {
        return [...SYMPTOMS_LIBRARY, ...get().customSymptoms];
      },
    }),
    {
      name: "tibera-symptoms",
    }
  )
);

export function getCategoryLabel(category: SymptomCategory): string {
  const labels: Record<SymptomCategory, string> = {
    digestive: "Digestive",
    energy: "Energy",
    mood: "Mood",
    pain: "Pain",
    skin: "Skin",
    respiratory: "Respiratory",
    other: "Other",
  };
  return labels[category];
}

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Supplement, SupplementLog } from "@/types";

// Common supplements library
export const SUPPLEMENTS_LIBRARY: Supplement[] = [
  {
    id: "vitamin_d3",
    name: "Vitamin D3",
    nutrients: [{ nutrientId: "1114", amount: 1000, unit: "IU" }],
    dosageUnit: "IU",
    recommendedDosage: 1000,
  },
  {
    id: "vitamin_c",
    name: "Vitamin C",
    nutrients: [{ nutrientId: "1162", amount: 500, unit: "mg" }],
    dosageUnit: "mg",
    recommendedDosage: 500,
  },
  {
    id: "vitamin_b12",
    name: "Vitamin B12",
    nutrients: [{ nutrientId: "1178", amount: 1000, unit: "mcg" }],
    dosageUnit: "mcg",
    recommendedDosage: 1000,
  },
  {
    id: "iron",
    name: "Iron",
    nutrients: [{ nutrientId: "1089", amount: 18, unit: "mg" }],
    dosageUnit: "mg",
    recommendedDosage: 18,
  },
  {
    id: "calcium",
    name: "Calcium",
    nutrients: [{ nutrientId: "1087", amount: 500, unit: "mg" }],
    dosageUnit: "mg",
    recommendedDosage: 500,
  },
  {
    id: "magnesium",
    name: "Magnesium",
    nutrients: [{ nutrientId: "1090", amount: 400, unit: "mg" }],
    dosageUnit: "mg",
    recommendedDosage: 400,
  },
  {
    id: "zinc",
    name: "Zinc",
    nutrients: [{ nutrientId: "1095", amount: 15, unit: "mg" }],
    dosageUnit: "mg",
    recommendedDosage: 15,
  },
  {
    id: "omega3",
    name: "Omega-3 Fish Oil",
    nutrients: [],
    dosageUnit: "mg",
    recommendedDosage: 1000,
  },
  {
    id: "probiotics",
    name: "Probiotics",
    nutrients: [],
    dosageUnit: "CFU",
    recommendedDosage: 10000000000,
  },
  {
    id: "multivitamin",
    name: "Multivitamin",
    nutrients: [],
    dosageUnit: "tablet",
    recommendedDosage: 1,
  },
  {
    id: "folate",
    name: "Folate / Folic Acid",
    nutrients: [{ nutrientId: "1177", amount: 400, unit: "mcg" }],
    dosageUnit: "mcg",
    recommendedDosage: 400,
  },
  {
    id: "prenatal",
    name: "Prenatal Vitamin",
    nutrients: [],
    dosageUnit: "tablet",
    recommendedDosage: 1,
  },
];

interface SupplementsState {
  logs: SupplementLog[];
  customSupplements: Supplement[];

  // Actions
  addSupplementLog: (log: Omit<SupplementLog, "id">) => void;
  updateSupplementLog: (id: string, updates: Partial<SupplementLog>) => void;
  deleteSupplementLog: (id: string) => void;
  addCustomSupplement: (supplement: Omit<Supplement, "id">) => void;
  getLogsByDate: (date: string) => SupplementLog[];
  getLogsByDateRange: (startDate: string, endDate: string) => SupplementLog[];
  getAllSupplements: () => Supplement[];
}

export const useSupplementsStore = create<SupplementsState>()(
  persist(
    (set, get) => ({
      logs: [],
      customSupplements: [],

      addSupplementLog: (log) => {
        const newLog: SupplementLog = {
          ...log,
          id: crypto.randomUUID(),
        };
        set((state) => ({ logs: [...state.logs, newLog] }));
      },

      updateSupplementLog: (id, updates) => {
        set((state) => ({
          logs: state.logs.map((log) =>
            log.id === id ? { ...log, ...updates } : log
          ),
        }));
      },

      deleteSupplementLog: (id) => {
        set((state) => ({
          logs: state.logs.filter((log) => log.id !== id),
        }));
      },

      addCustomSupplement: (supplement) => {
        const newSupplement: Supplement = {
          ...supplement,
          id: `custom_${crypto.randomUUID()}`,
        };
        set((state) => ({
          customSupplements: [...state.customSupplements, newSupplement],
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

      getAllSupplements: () => {
        return [...SUPPLEMENTS_LIBRARY, ...get().customSupplements];
      },
    }),
    {
      name: "tibera-supplements",
    }
  )
);

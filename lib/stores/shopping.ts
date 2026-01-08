import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ShoppingList, ShoppingItem, ShoppingCategory } from "@/types";

interface ShoppingState {
  lists: ShoppingList[];
  activeListId: string | null;

  // Actions
  createList: (name: string) => string;
  deleteList: (id: string) => void;
  setActiveList: (id: string | null) => void;
  addItem: (listId: string, item: Omit<ShoppingItem, "id">) => void;
  updateItem: (listId: string, itemId: string, updates: Partial<ShoppingItem>) => void;
  deleteItem: (listId: string, itemId: string) => void;
  toggleItemChecked: (listId: string, itemId: string) => void;
  clearCheckedItems: (listId: string) => void;
  getActiveList: () => ShoppingList | undefined;
  getListById: (id: string) => ShoppingList | undefined;
}

export const useShoppingStore = create<ShoppingState>()(
  persist(
    (set, get) => ({
      lists: [],
      activeListId: null,

      createList: (name) => {
        const id = crypto.randomUUID();
        const newList: ShoppingList = {
          id,
          name,
          items: [],
          createdAt: new Date(),
        };
        set((state) => ({
          lists: [...state.lists, newList],
          activeListId: id,
        }));
        return id;
      },

      deleteList: (id) => {
        set((state) => ({
          lists: state.lists.filter((list) => list.id !== id),
          activeListId: state.activeListId === id ? null : state.activeListId,
        }));
      },

      setActiveList: (id) => {
        set({ activeListId: id });
      },

      addItem: (listId, item) => {
        const newItem: ShoppingItem = {
          ...item,
          id: crypto.randomUUID(),
        };
        set((state) => ({
          lists: state.lists.map((list) =>
            list.id === listId
              ? { ...list, items: [...list.items, newItem] }
              : list
          ),
        }));
      },

      updateItem: (listId, itemId, updates) => {
        set((state) => ({
          lists: state.lists.map((list) =>
            list.id === listId
              ? {
                  ...list,
                  items: list.items.map((item) =>
                    item.id === itemId ? { ...item, ...updates } : item
                  ),
                }
              : list
          ),
        }));
      },

      deleteItem: (listId, itemId) => {
        set((state) => ({
          lists: state.lists.map((list) =>
            list.id === listId
              ? { ...list, items: list.items.filter((item) => item.id !== itemId) }
              : list
          ),
        }));
      },

      toggleItemChecked: (listId, itemId) => {
        set((state) => ({
          lists: state.lists.map((list) =>
            list.id === listId
              ? {
                  ...list,
                  items: list.items.map((item) =>
                    item.id === itemId ? { ...item, checked: !item.checked } : item
                  ),
                }
              : list
          ),
        }));
      },

      clearCheckedItems: (listId) => {
        set((state) => ({
          lists: state.lists.map((list) =>
            list.id === listId
              ? { ...list, items: list.items.filter((item) => !item.checked) }
              : list
          ),
        }));
      },

      getActiveList: () => {
        const state = get();
        return state.lists.find((list) => list.id === state.activeListId);
      },

      getListById: (id) => {
        return get().lists.find((list) => list.id === id);
      },
    }),
    {
      name: "tibera-shopping",
    }
  )
);

export const CATEGORY_LABELS: Record<ShoppingCategory, string> = {
  produce: "Produce",
  dairy: "Dairy",
  meat: "Meat & Seafood",
  grains: "Grains & Bread",
  frozen: "Frozen",
  canned: "Canned Goods",
  snacks: "Snacks",
  beverages: "Beverages",
  household: "Household",
  other: "Other",
};

export const CATEGORY_ORDER: ShoppingCategory[] = [
  "produce",
  "dairy",
  "meat",
  "grains",
  "frozen",
  "canned",
  "snacks",
  "beverages",
  "household",
  "other",
];

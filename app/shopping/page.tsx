"use client";

import { useState, useMemo } from "react";
import {
  ShoppingCart,
  Plus,
  Trash2,
  Check,
  ListPlus,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  useShoppingLists,
  useCreateShoppingList,
  useDeleteShoppingList,
  useUpdateShoppingList,
  useAddShoppingItem,
  useToggleShoppingItem,
  useDeleteShoppingItem,
  useClearCheckedItems,
} from "@/lib/hooks";
import type { ShoppingCategory, ShoppingItem } from "@/types";
import { cn } from "@/lib/utils/cn";

// Database types
interface DatabaseShoppingItem {
  id: string;
  list_id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string;
  is_checked: boolean;
  from_meal_plan: boolean;
  meal_plan_id: string | null;
  sort_order: number;
  created_at: string;
}

interface DatabaseShoppingList {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  shopping_items: DatabaseShoppingItem[];
}

const CATEGORY_LABELS: Record<string, string> = {
  produce: "Produce",
  dairy: "Dairy",
  meat: "Meat & Seafood",
  grains: "Grains & Bakery",
  frozen: "Frozen",
  canned: "Canned & Packaged",
  snacks: "Snacks",
  beverages: "Beverages",
  household: "Household",
  other: "Other",
};

const CATEGORY_ORDER: string[] = [
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

export default function ShoppingListPage() {
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState<string>("other");
  const [showNewListForm, setShowNewListForm] = useState(false);
  const [newListName, setNewListName] = useState("");

  // Supabase hooks
  const { data: lists = [], isLoading } = useShoppingLists();

  // Mutations
  const createList = useCreateShoppingList();
  const deleteList = useDeleteShoppingList();
  const updateList = useUpdateShoppingList();
  const addItem = useAddShoppingItem();
  const toggleItem = useToggleShoppingItem();
  const deleteItem = useDeleteShoppingItem();
  const clearChecked = useClearCheckedItems();

  // Find the active list, or default to the first list
  const activeList = useMemo(() => {
    if (lists.length === 0) return null;
    const active = lists.find((l: DatabaseShoppingList) => l.is_active);
    return active || lists[0];
  }, [lists]);

  const activeListId = activeList?.id || null;

  if (isLoading) return <ShoppingSkeleton />;

  const handleCreateList = () => {
    if (!newListName.trim()) return;
    createList.mutate({
      name: newListName.trim(),
      setActive: true,
    });
    setNewListName("");
    setShowNewListForm(false);
  };

  const handleSetActiveList = (listId: string) => {
    updateList.mutate({
      id: listId,
      updates: { is_active: true },
    });
  };

  const handleAddItem = () => {
    if (!newItemName.trim() || !activeListId) return;
    addItem.mutate({
      listId: activeListId,
      item: {
        name: newItemName.trim(),
        category: newItemCategory,
      },
    });
    setNewItemName("");
  };

  // Group items by category
  const groupedItems = activeList
    ? CATEGORY_ORDER.reduce((acc, category) => {
        acc[category] = (activeList.shopping_items || []).filter(
          (item: DatabaseShoppingItem) => item.category === category
        );
        return acc;
      }, {} as Record<string, DatabaseShoppingItem[]>)
    : {};

  const uncheckedCount = activeList?.shopping_items?.filter((i: DatabaseShoppingItem) => !i.is_checked).length || 0;
  const checkedCount = activeList?.shopping_items?.filter((i: DatabaseShoppingItem) => i.is_checked).length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold">Shopping List</h1>
        </div>
        <Button onClick={() => setShowNewListForm(true)}>
          <ListPlus className="w-4 h-4 mr-2" />
          New List
        </Button>
      </div>

      {/* List Selector */}
      {lists.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {lists.map((list: DatabaseShoppingList) => (
            <button
              key={list.id}
              onClick={() => handleSetActiveList(list.id)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                activeListId === list.id
                  ? "bg-primary-600 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-100/80"
              )}
            >
              {list.name}
              <Badge variant="secondary" className="ml-2">
                {(list.shopping_items || []).filter((i: DatabaseShoppingItem) => !i.is_checked).length}
              </Badge>
            </button>
          ))}
        </div>
      )}

      {/* Active List Content */}
      {activeList ? (
        <>
          {/* Add Item Form */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Add item..."
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
                  className="flex-1"
                />
                <select
                  value={newItemCategory}
                  onChange={(e) => setNewItemCategory(e.target.value)}
                  className="px-3 py-2 rounded-md border border-gray-300 bg-white text-sm"
                >
                  {CATEGORY_ORDER.map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </option>
                  ))}
                </select>
                <Button
                  onClick={handleAddItem}
                  disabled={!newItemName.trim() || addItem.isPending}
                >
                  {addItem.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Progress */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              {uncheckedCount} items remaining
            </span>
            {checkedCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => clearChecked.mutate(activeListId!)}
                disabled={clearChecked.isPending}
              >
                {clearChecked.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : null}
                Clear checked ({checkedCount})
              </Button>
            )}
          </div>

          {/* Items by Category */}
          <div className="space-y-4">
            {CATEGORY_ORDER.map((category) => {
              const items = groupedItems[category];
              if (!items || items.length === 0) return null;

              return (
                <Card key={category}>
                  <CardHeader className="py-3 pb-0">
                    <CardTitle className="text-sm text-gray-500">
                      {CATEGORY_LABELS[category]}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <ul className="space-y-1">
                      {items
                        .sort((a: DatabaseShoppingItem, b: DatabaseShoppingItem) => a.sort_order - b.sort_order)
                        .map((item: DatabaseShoppingItem) => (
                          <li
                            key={item.id}
                            className="flex items-center gap-3 py-2"
                          >
                            <button
                              onClick={() => toggleItem.mutate(item.id)}
                              disabled={toggleItem.isPending}
                              className={cn(
                                "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                                item.is_checked
                                  ? "bg-primary-600 border-primary-600"
                                  : "border-gray-500"
                              )}
                            >
                              {item.is_checked && (
                                <Check className="w-4 h-4 text-white" />
                              )}
                            </button>
                            <span
                              className={cn(
                                "flex-1",
                                item.is_checked &&
                                  "line-through text-gray-500"
                              )}
                            >
                              {item.name}
                              {item.quantity && (
                                <span className="text-gray-500 ml-1">
                                  ({item.quantity} {item.unit})
                                </span>
                              )}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-500 hover:text-destructive"
                              onClick={() => deleteItem.mutate(item.id)}
                              disabled={deleteItem.isPending}
                            >
                              {deleteItem.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </Button>
                          </li>
                        ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Empty state for list with no items */}
          {(!activeList.shopping_items || activeList.shopping_items.length === 0) && (
            <Card>
              <CardContent className="py-8 text-center">
                <ShoppingCart className="w-10 h-10 mx-auto text-gray-500 mb-3" />
                <p className="text-gray-500">No items in this list yet</p>
                <p className="text-sm text-gray-400 mt-1">Add items using the form above</p>
              </CardContent>
            </Card>
          )}

          {/* Delete List */}
          <div className="pt-4">
            <Button
              variant="outline"
              className="w-full text-destructive hover:text-destructive"
              onClick={() => {
                if (confirm("Delete this shopping list?")) {
                  deleteList.mutate(activeListId!);
                }
              }}
              disabled={deleteList.isPending}
            >
              {deleteList.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete List
            </Button>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <ShoppingCart className="w-12 h-12 mx-auto text-gray-500 mb-4" />
            <p className="text-gray-500 mb-4">
              No shopping lists yet
            </p>
            <Button onClick={() => setShowNewListForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First List
            </Button>
          </CardContent>
        </Card>
      )}

      {/* New List Modal */}
      {showNewListForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Create New List</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                type="text"
                placeholder="List name (e.g., Weekly Groceries)"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateList()}
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowNewListForm(false);
                    setNewListName("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleCreateList}
                  disabled={!newListName.trim() || createList.isPending}
                >
                  {createList.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Create
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function ShoppingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 animate-pulse" />
          <div className="h-8 w-36 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="h-10 w-28 bg-gray-100 rounded animate-pulse" />
      </div>
      <div className="h-12 bg-gray-100 rounded-lg animate-pulse" />
      <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
    </div>
  );
}

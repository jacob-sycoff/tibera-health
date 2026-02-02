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
import { PageHeader } from "@/components/ui/page-header";
import {
  useShoppingLists,
  useCreateShoppingList,
  useDeleteShoppingList,
  useUpdateShoppingList,
  useAddShoppingItem,
  useToggleShoppingItem,
  useDeleteShoppingItem,
  useClearCheckedItems,
  useShoppingCategories,
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

export default function ShoppingListPage() {
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState<string>("other");
  const [showNewListForm, setShowNewListForm] = useState(false);
  const [newListName, setNewListName] = useState("");

  // Supabase hooks
  const { data: lists = [], isLoading: listsLoading } = useShoppingLists();
  const { data: categories = [], isLoading: categoriesLoading } = useShoppingCategories();

  const isLoading = listsLoading || categoriesLoading;

  // Helper to get category label
  const getCategoryLabel = (slug: string): string => {
    const category = categories.find(c => c.slug === slug);
    return category?.label || slug.charAt(0).toUpperCase() + slug.slice(1);
  };

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

  // Group items by category using fetched categories
  const groupedItems = activeList
    ? categories.reduce((acc, category) => {
        acc[category.slug] = (activeList.shopping_items || []).filter(
          (item: DatabaseShoppingItem) => item.category === category.slug
        );
        return acc;
      }, {} as Record<string, DatabaseShoppingItem[]>)
    : {};

  const uncheckedCount = activeList?.shopping_items?.filter((i: DatabaseShoppingItem) => !i.is_checked).length || 0;
  const checkedCount = activeList?.shopping_items?.filter((i: DatabaseShoppingItem) => i.is_checked).length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Shopping List"
        action={
          <Button onClick={() => setShowNewListForm(true)}>
            <ListPlus className="w-4 h-4 mr-2" />
            New List
          </Button>
        }
      />

      {/* List Selector */}
      {lists.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {lists.map((list: DatabaseShoppingList) => (
            <button
              key={list.id}
              onClick={() => handleSetActiveList(list.id)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                activeListId === list.id
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
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
                  className="h-11 px-4 rounded-2xl border border-black/10 bg-white/70 text-sm text-slate-900 dark:border-white/10 dark:bg-slate-800/70 dark:text-slate-100"
                >
                  {categories.map((cat) => (
                    <option key={cat.slug} value={cat.slug}>
                      {cat.label}
                    </option>
                  ))}
                </select>
                <Button
                  onClick={handleAddItem}
                  disabled={!newItemName.trim() || addItem.isPending}
                  size="icon"
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
            <span className="text-slate-500 dark:text-slate-400">
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
            {categories.map((category) => {
              const items = groupedItems[category.slug];
              if (!items || items.length === 0) return null;

              return (
                <Card key={category.slug}>
                  <CardHeader className="py-3 pb-0">
                    <CardTitle className="text-sm text-slate-500 dark:text-slate-400">
                      {category.label}
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
                                  ? "bg-slate-900 border-slate-900 dark:bg-slate-100 dark:border-slate-100"
                                  : "border-slate-400 dark:border-slate-500"
                              )}
                            >
                              {item.is_checked && (
                                <Check className="w-4 h-4 text-white dark:text-slate-900" />
                              )}
                            </button>
                            <span
                              className={cn(
                                "flex-1 text-slate-900 dark:text-slate-100",
                                item.is_checked &&
                                  "line-through text-slate-400 dark:text-slate-500"
                              )}
                            >
                              {item.name}
                              {item.quantity && (
                                <span className="text-slate-500 dark:text-slate-400 ml-1">
                                  ({item.quantity} {item.unit})
                                </span>
                              )}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-slate-400 hover:text-red-500"
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
                <ShoppingCart className="w-10 h-10 mx-auto text-slate-400 mb-3" />
                <p className="text-slate-500 dark:text-slate-400">No items in this list yet</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Add items using the form above</p>
              </CardContent>
            </Card>
          )}

          {/* Delete List */}
          <div className="pt-4">
            <Button
              variant="outline"
              className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
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
            <ShoppingCart className="w-12 h-12 mx-auto text-slate-400 mb-4" />
            <p className="text-slate-500 dark:text-slate-400 mb-4">
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <Card className="w-full max-w-md mx-4 animate-slide-up">
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
        <div className="h-10 w-48 bg-slate-100 dark:bg-slate-800 rounded-[28px] animate-pulse" />
        <div className="h-11 w-28 bg-slate-100 dark:bg-slate-800 rounded-full animate-pulse" />
      </div>
      <div className="h-12 bg-slate-100 dark:bg-slate-800 rounded-full animate-pulse" />
      <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-[28px] animate-pulse" />
    </div>
  );
}

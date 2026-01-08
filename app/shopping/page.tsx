"use client";

import { useState, useEffect } from "react";
import {
  ShoppingCart,
  Plus,
  Trash2,
  Check,
  MoreVertical,
  ListPlus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  useShoppingStore,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
} from "@/lib/stores/shopping";
import type { ShoppingCategory, ShoppingItem } from "@/types";
import { cn } from "@/lib/utils/cn";

export default function ShoppingListPage() {
  const [mounted, setMounted] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] =
    useState<ShoppingCategory>("other");
  const [showNewListForm, setShowNewListForm] = useState(false);
  const [newListName, setNewListName] = useState("");

  const {
    lists,
    activeListId,
    createList,
    deleteList,
    setActiveList,
    addItem,
    deleteItem,
    toggleItemChecked,
    clearCheckedItems,
    getActiveList,
  } = useShoppingStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <ShoppingSkeleton />;

  const activeList = getActiveList();

  const handleCreateList = () => {
    if (!newListName.trim()) return;
    createList(newListName.trim());
    setNewListName("");
    setShowNewListForm(false);
  };

  const handleAddItem = () => {
    if (!newItemName.trim() || !activeListId) return;
    addItem(activeListId, {
      name: newItemName.trim(),
      category: newItemCategory,
      checked: false,
    });
    setNewItemName("");
  };

  // Group items by category
  const groupedItems = activeList
    ? CATEGORY_ORDER.reduce((acc, category) => {
        acc[category] = activeList.items.filter(
          (item) => item.category === category
        );
        return acc;
      }, {} as Record<ShoppingCategory, ShoppingItem[]>)
    : {};

  const uncheckedCount = activeList?.items.filter((i) => !i.checked).length || 0;
  const checkedCount = activeList?.items.filter((i) => i.checked).length || 0;

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
          {lists.map((list) => (
            <button
              key={list.id}
              onClick={() => setActiveList(list.id)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                activeListId === list.id
                  ? "bg-primary-600 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {list.name}
              <Badge variant="secondary" className="ml-2">
                {list.items.filter((i) => !i.checked).length}
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
                  onChange={(e) =>
                    setNewItemCategory(e.target.value as ShoppingCategory)
                  }
                  className="px-3 py-2 rounded-md border border-input bg-background text-sm"
                >
                  {CATEGORY_ORDER.map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </option>
                  ))}
                </select>
                <Button onClick={handleAddItem} disabled={!newItemName.trim()}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Progress */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {uncheckedCount} items remaining
            </span>
            {checkedCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => clearCheckedItems(activeListId!)}
              >
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
                    <CardTitle className="text-sm text-muted-foreground">
                      {CATEGORY_LABELS[category]}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <ul className="space-y-1">
                      {items.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center gap-3 py-2"
                        >
                          <button
                            onClick={() =>
                              toggleItemChecked(activeListId!, item.id)
                            }
                            className={cn(
                              "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                              item.checked
                                ? "bg-primary-600 border-primary-600"
                                : "border-muted-foreground"
                            )}
                          >
                            {item.checked && (
                              <Check className="w-4 h-4 text-white" />
                            )}
                          </button>
                          <span
                            className={cn(
                              "flex-1",
                              item.checked &&
                                "line-through text-muted-foreground"
                            )}
                          >
                            {item.name}
                            {item.quantity && (
                              <span className="text-muted-foreground ml-1">
                                ({item.quantity} {item.unit})
                              </span>
                            )}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteItem(activeListId!, item.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Delete List */}
          <div className="pt-4">
            <Button
              variant="outline"
              className="w-full text-destructive hover:text-destructive"
              onClick={() => {
                if (confirm("Delete this shopping list?")) {
                  deleteList(activeListId!);
                }
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete List
            </Button>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
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
                  disabled={!newListName.trim()}
                >
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
      <div className="h-10 bg-muted rounded-lg animate-pulse w-48" />
      <div className="h-12 bg-muted rounded-lg animate-pulse" />
      <div className="h-64 bg-muted rounded-lg animate-pulse" />
    </div>
  );
}

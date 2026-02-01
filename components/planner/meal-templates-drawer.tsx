"use client";

import { useState } from "react";
import {
  X,
  Plus,
  Trash2,
  Star,
  Coffee,
  Sun,
  Moon,
  Cookie,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  useMealTemplates,
  useDeleteMealTemplate,
  type MealTemplate,
  type MealType,
} from "@/lib/hooks/use-meal-plans";
import { cn } from "@/lib/utils/cn";

interface MealTemplatesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: MealTemplate) => void;
}

const MEAL_TYPE_CONFIG: Record<
  MealType,
  { icon: typeof Coffee; label: string; color: string }
> = {
  breakfast: { icon: Coffee, label: "Breakfast", color: "text-amber-600 bg-amber-100" },
  lunch: { icon: Sun, label: "Lunch", color: "text-orange-600 bg-orange-100" },
  dinner: { icon: Moon, label: "Dinner", color: "text-indigo-600 bg-indigo-100" },
  snack: { icon: Cookie, label: "Snack", color: "text-pink-600 bg-pink-100" },
};

export function MealTemplatesDrawer({
  isOpen,
  onClose,
  onSelectTemplate,
}: MealTemplatesDrawerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: templates = [], isLoading } = useMealTemplates();
  const deleteTemplate = useDeleteMealTemplate();

  const filteredTemplates = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Delete this template?")) {
      await deleteTemplate.mutateAsync(id);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <Card className="relative w-full max-w-md h-full rounded-none border-l shadow-xl animate-in slide-in-from-right">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500" />
              My Templates
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mt-2"
          />
        </CardHeader>

        <CardContent className="p-0 overflow-auto h-[calc(100vh-140px)]">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-20 bg-muted rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="p-8 text-center">
              <Star className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">
                {searchQuery
                  ? "No templates match your search"
                  : "No templates yet"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Save meals as templates from the meal planner
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredTemplates.map((template) => {
                const mealTypeConfig = template.meal_type
                  ? MEAL_TYPE_CONFIG[template.meal_type]
                  : null;
                const MealIcon = mealTypeConfig?.icon;

                return (
                  <button
                    key={template.id}
                    onClick={() => onSelectTemplate(template)}
                    className="w-full p-4 text-left hover:bg-muted/50 transition-colors flex items-start gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">
                          {template.name}
                        </span>
                        {mealTypeConfig && MealIcon && (
                          <Badge
                            variant="secondary"
                            className={cn("text-xs", mealTypeConfig.color)}
                          >
                            <MealIcon className="w-3 h-3 mr-1" />
                            {mealTypeConfig.label}
                          </Badge>
                        )}
                      </div>
                      {template.description && (
                        <p className="text-sm text-muted-foreground truncate mb-1">
                          {template.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{template.total_calories} cal</span>
                        {template.items.length > 0 && (
                          <span>{template.items.length} item(s)</span>
                        )}
                        {template.use_count > 0 && (
                          <span>Used {template.use_count}x</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={(e) => handleDelete(e, template.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { Edit3, Plus, Loader2, Pill } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  usePillOrganizerItems,
  useRemovePillOrganizerItem,
  useReorderPillOrganizerItems,
} from "@/lib/hooks";
import { useToast } from "@/components/ui/toast";
import { SortableOrganizerItem } from "./sortable-organizer-item";
import { AddToOrganizerModal } from "./add-to-organizer-modal";

interface PillOrganizerProps {
  takenSupplements: Set<string>;
  onQuickLog: (supplement: {
    id: string;
    name: string;
    brand: string | null;
    serving_size: string | null;
  }) => void;
  isLogging: boolean;
}

export function PillOrganizer({
  takenSupplements,
  onQuickLog,
  isLogging,
}: PillOrganizerProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: organizerItems = [], isLoading } = usePillOrganizerItems();
  const removeMutation = useRemovePillOrganizerItem();
  const reorderMutation = useReorderPillOrganizerItems();
  const toast = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = organizerItems.findIndex(
      (item) => item.id === active.id
    );
    const newIndex = organizerItems.findIndex(
      (item) => item.id === over.id
    );

    const reordered = arrayMove(organizerItems, oldIndex, newIndex);
    reorderMutation.mutate(reordered.map((item) => item.id));
  }

  function handleRemove(id: string, name: string) {
    removeMutation.mutate(id, {
      onSuccess: () => {
        toast.success(`${name} removed from organizer`);
      },
      onError: () => {
        toast.error("Failed to remove supplement");
      },
    });
  }

  const gridContent = (
    <div className="grid grid-cols-2 gap-2">
      {organizerItems.map((item) => {
        const displayName = `${item.supplement.brand ? item.supplement.brand + " " : ""}${item.supplement.name}`;
        const taken = takenSupplements.has(displayName);

        return (
          <SortableOrganizerItem
            key={item.id}
            id={item.id}
            supplementName={item.supplement.name}
            isTaken={taken}
            isEditMode={isEditMode}
            onQuickLog={() =>
              onQuickLog({
                id: item.supplement.id,
                name: item.supplement.name,
                brand: item.supplement.brand,
                serving_size: item.supplement.serving_size,
              })
            }
            onRemove={() => handleRemove(item.id, item.supplement.name)}
            isLogging={isLogging}
          />
        );
      })}

      {isEditMode && (
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center p-3 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-500 dark:hover:text-slate-400 transition-colors"
        >
          <Plus className="w-5 h-5" />
        </button>
      )}
    </div>
  );

  return (
    <>
      <Card className="rounded-[28px]">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">My Pill Organizer</CardTitle>
            {organizerItems.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditMode(!isEditMode)}
              >
                {isEditMode ? (
                  "Done"
                ) : (
                  <Edit3 className="w-4 h-4" />
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400 dark:text-slate-500" />
            </div>
          ) : organizerItems.length === 0 ? (
            <EmptyState
              icon={Pill}
              title="No supplements yet"
              description="Add supplements to your organizer for quick daily logging."
              action={{
                label: "Add Supplements",
                onClick: () => setShowAddModal(true),
              }}
              className="py-4"
            />
          ) : isEditMode ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={organizerItems.map((item) => item.id)}
                strategy={rectSortingStrategy}
              >
                {gridContent}
              </SortableContext>
            </DndContext>
          ) : (
            gridContent
          )}
        </CardContent>
      </Card>

      <AddToOrganizerModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        existingItems={organizerItems}
      />
    </>
  );
}

"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface SortableOrganizerItemProps {
  id: string;
  supplementName: string;
  isTaken: boolean;
  isEditMode: boolean;
  onQuickLog: () => void;
  onRemove: () => void;
  isLogging: boolean;
}

export function SortableOrganizerItem({
  id,
  supplementName,
  isTaken,
  isEditMode,
  onQuickLog,
  onRemove,
  isLogging,
}: SortableOrganizerItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !isEditMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative flex items-center p-3 rounded-2xl text-left transition-colors border",
        isDragging && "z-10 shadow-lg opacity-80",
        isTaken && !isEditMode
          ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
          : "border-[color:var(--glass-border)] bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700"
      )}
    >
      {isEditMode && (
        <button
          className="mr-2 cursor-grab active:cursor-grabbing touch-none text-slate-400 dark:text-slate-500"
          {...attributes}
          {...listeners}
          aria-label={`Drag to reorder ${supplementName}`}
        >
          <GripVertical className="w-4 h-4" />
        </button>
      )}

      <button
        className="flex-1 text-left min-w-0"
        onClick={isEditMode ? undefined : onQuickLog}
        disabled={isEditMode || isTaken || isLogging}
      >
        <span className="font-medium text-sm truncate block">
          {supplementName}
        </span>
      </button>

      {isEditMode ? (
        <button
          onClick={onRemove}
          className="ml-1 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 transition-colors shrink-0"
          aria-label={`Remove ${supplementName} from organizer`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      ) : (
        isTaken && <Check className="w-4 h-4 shrink-0 ml-1" />
      )}
    </div>
  );
}

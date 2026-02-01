"use client";

import { useState } from "react";
import { Search, Plus, Loader2 } from "lucide-react";
import {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalContent,
} from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useSupplementsList, useAddPillOrganizerItem } from "@/lib/hooks";
import { useToast } from "@/components/ui/toast";
import type { PillOrganizerItem } from "@/lib/supabase/queries/supplements";

interface AddToOrganizerModalProps {
  open: boolean;
  onClose: () => void;
  existingItems: PillOrganizerItem[];
}

export function AddToOrganizerModal({
  open,
  onClose,
  existingItems,
}: AddToOrganizerModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: allSupplements = [], isLoading } = useSupplementsList();
  const addItem = useAddPillOrganizerItem();
  const toast = useToast();

  const existingSupplementIds = new Set(
    existingItems.map((item) => item.supplement_id)
  );

  const availableSupplements = allSupplements
    .filter((s: { id: string }) => !existingSupplementIds.has(s.id))
    .filter((s: { name: string; brand?: string | null }) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.brand?.toLowerCase().includes(q)
      );
    });

  const handleAdd = (supplementId: string, supplementName: string) => {
    addItem.mutate(supplementId, {
      onSuccess: () => {
        toast.success(`${supplementName} added to organizer`);
      },
      onError: () => {
        toast.error("Failed to add supplement");
      },
    });
  };

  return (
    <Modal open={open} onClose={onClose} size="md" position="responsive">
      <ModalHeader>
        <ModalTitle>Add to Organizer</ModalTitle>
      </ModalHeader>
      <ModalContent>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-slate-400" />
            <Input
              placeholder="Search supplements..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 rounded-2xl"
            />
          </div>

          <div className="max-h-[50vh] overflow-y-auto space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400 dark:text-slate-500" />
              </div>
            ) : availableSupplements.length === 0 ? (
              <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-6">
                {searchQuery
                  ? "No matching supplements found."
                  : "All supplements are already in your organizer."}
              </p>
            ) : (
              availableSupplements.map(
                (supplement: {
                  id: string;
                  name: string;
                  brand?: string | null;
                  type: string;
                }) => (
                  <button
                    key={supplement.id}
                    onClick={() => handleAdd(supplement.id, supplement.name)}
                    disabled={addItem.isPending}
                    className="w-full flex items-center justify-between p-3 rounded-2xl border border-[color:var(--glass-border)] bg-white dark:bg-slate-800 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                  >
                    <div className="min-w-0">
                      {supplement.brand && (
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {supplement.brand}{" "}
                        </span>
                      )}
                      <span className="font-medium text-sm">
                        {supplement.name}
                      </span>
                      <Badge
                        variant="secondary"
                        className="ml-2 capitalize text-xs"
                      >
                        {supplement.type}
                      </Badge>
                    </div>
                    <Plus className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
                  </button>
                )
              )
            )}
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}

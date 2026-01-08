"use client";

import { useState, useCallback } from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchFoods } from "@/lib/api/usda";
import type { FoodSearchResult } from "@/types";
import { cn } from "@/lib/utils/cn";

interface FoodSearchProps {
  onSelect: (food: FoodSearchResult) => void;
  className?: string;
}

export function FoodSearch({ onSelect, className }: FoodSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const foods = await searchFoods(searchQuery);
      setResults(foods);
      setShowResults(true);
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    // Debounce search
    const timeoutId = setTimeout(() => {
      handleSearch(value);
    }, 300);

    return () => clearTimeout(timeoutId);
  };

  const handleSelect = (food: FoodSearchResult) => {
    onSelect(food);
    setQuery("");
    setResults([]);
    setShowResults(false);
  };

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search foods..."
          value={query}
          onChange={handleInputChange}
          onFocus={() => results.length > 0 && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          className="pl-9"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Search Results Dropdown */}
      {showResults && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-64 overflow-auto">
          {results.map((food) => (
            <button
              key={food.fdcId}
              onClick={() => handleSelect(food)}
              className="w-full px-4 py-3 text-left hover:bg-muted transition-colors border-b border-border last:border-0"
            >
              <p className="font-medium text-sm text-foreground truncate">
                {food.description}
              </p>
              {food.brandOwner && (
                <p className="text-xs text-muted-foreground truncate">
                  {food.brandOwner}
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      {showResults && query.length >= 2 && results.length === 0 && !loading && (
        <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg p-4 text-center text-muted-foreground">
          No foods found
        </div>
      )}
    </div>
  );
}

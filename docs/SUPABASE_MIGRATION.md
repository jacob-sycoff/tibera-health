# Supabase Migration Guide

This document explains how to migrate from localStorage/Zustand stores to Supabase-backed React Query hooks.

## Current Architecture

The app currently uses:
- **Zustand stores** with `persist` middleware (saves to localStorage)
- **Hardcoded reference data** (SUPPLEMENTS_LIBRARY, SYMPTOMS_LIBRARY, etc.)

## New Architecture

The new architecture uses:
- **Supabase** for data persistence
- **React Query** for data fetching, caching, and mutations
- **Custom hooks** that abstract away the Supabase queries

## Files Created

```
lib/supabase/
├── client.ts              # Supabase client
├── types.ts               # Database types
├── constants.ts           # Demo user ID, auth helpers
└── queries/
    ├── index.ts           # Export all queries
    ├── reference.ts       # Read-only reference data
    ├── profile.ts         # User profile, preferences, goals
    ├── meals.ts           # Meal logs
    ├── sleep.ts           # Sleep logs
    ├── symptoms.ts        # Symptom logs
    ├── supplements.ts     # Supplement logs
    └── shopping.ts        # Shopping lists

lib/hooks/
├── index.ts               # Export all hooks
├── use-reference-data.ts  # Nutrients, symptoms list, supplements list
├── use-profile.ts         # Profile, preferences, goals, conditions
├── use-meals.ts           # Meal logs
├── use-sleep.ts           # Sleep logs
├── use-symptoms.ts        # Symptom logs
├── use-supplements.ts     # Supplement logs
└── use-shopping.ts        # Shopping lists
```

## Migration Pattern

### Before (Zustand Store)

```tsx
// Old way - using Zustand store
import { useSupplementsStore } from "@/lib/stores/supplements";

function SupplementsPage() {
  const logs = useSupplementsStore((state) => state.logs);
  const addSupplementLog = useSupplementsStore((state) => state.addSupplementLog);

  // Filter logs manually
  const todaysLogs = useMemo(() => {
    return logs.filter(log =>
      new Date(log.dateTime).toDateString() === new Date().toDateString()
    );
  }, [logs]);

  const handleAdd = () => {
    addSupplementLog({
      supplementId: "vitamin_d3",
      supplementName: "Vitamin D3",
      dosage: 1000,
      unit: "IU",
      dateTime: new Date(),
    });
  };
}
```

### After (Supabase + React Query)

```tsx
// New way - using Supabase hooks
import {
  useSupplementLogsByDate,
  useCreateSupplementLog,
  useDeleteSupplementLog,
  useSupplementsList
} from "@/lib/hooks";

function SupplementsPage() {
  const today = new Date().toISOString().split('T')[0];

  // Data fetching
  const { data: todaysLogs = [], isLoading } = useSupplementLogsByDate(today);
  const { data: supplements = [] } = useSupplementsList();

  // Mutations
  const createLog = useCreateSupplementLog();
  const deleteLog = useDeleteSupplementLog();

  const handleAdd = () => {
    createLog.mutate({
      supplement_name: "Vitamin D3",
      dosage: 1000,
      unit: "IU",
    });
  };

  const handleDelete = (id: string) => {
    deleteLog.mutate(id);
  };

  if (isLoading) return <Loading />;
}
```

## Key Differences

| Aspect | Zustand | React Query |
|--------|---------|-------------|
| Data Source | localStorage | Supabase |
| Caching | Manual | Automatic |
| Loading States | Manual | Built-in |
| Error Handling | Manual | Built-in |
| Refetching | Manual | Automatic |
| Optimistic Updates | Manual | Built-in |

## Migration Checklist

For each page/component:

1. [ ] Identify which Zustand stores are used
2. [ ] Replace with equivalent React Query hooks
3. [ ] Update mutation handlers to use `mutate()` or `mutateAsync()`
4. [ ] Add loading/error states if needed
5. [ ] Remove unused Zustand imports
6. [ ] Test all CRUD operations

## Pages to Migrate

| Page | Zustand Stores | New Hooks |
|------|---------------|-----------|
| `/supplements` | `useSupplementsStore`, `useSupplementDatabase` | `useSupplementLogsByDate`, `useSupplementsList`, `useCreateSupplementLog` |
| `/symptoms` | `useSymptomsStore` | `useSymptomLogsByDate`, `useSymptomsList`, `useCreateSymptomLog` |
| `/sleep` | `useSleepStore` | `useSleepLogs`, `useCreateSleepLog`, `useUpsertSleepLog` |
| `/food` | `useMealsStore` | `useMealLogsByDate`, `useCreateMealLog` |
| `/shopping` | `useShoppingStore` | `useShoppingLists`, `useActiveShoppingList`, `useCreateShoppingList` |
| `/settings` | `useProfileStore` | `useProfile`, `useGoals`, `useUserHealthConditions` |

## Reference Data Migration

Old hardcoded data:
- `SUPPLEMENTS_LIBRARY` → `useSupplementsList()`
- `SYMPTOMS_LIBRARY` → `useSymptomsList()`
- `CONDITION_LABELS` → `useHealthConditionsList()`

The database is seeded with:
- 47 nutrients
- 52 symptoms
- 14 health conditions
- 6 verified supplements

## Notes

- The old Zustand stores can be kept during migration for fallback
- React Query handles caching, so removed data will be reflected immediately
- Use `isLoading` states for better UX during data fetching

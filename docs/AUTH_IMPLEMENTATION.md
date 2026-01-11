# Authentication Implementation Guide

This document outlines how to implement user authentication when you're ready.

## Current State (Demo Mode)

The app currently uses:
- A fixed demo user ID (`00000000-0000-0000-0000-000000000001`)
- Permissive RLS policies (`demo_*` policies allow all operations)
- No actual authentication

## Files to Modify for Auth

### 1. Remove Demo Policies (Database)

Run this SQL to remove demo policies:

```sql
-- Remove all demo policies
DROP POLICY IF EXISTS "demo_profiles_all" ON public.profiles;
DROP POLICY IF EXISTS "demo_user_preferences_all" ON public.user_preferences;
DROP POLICY IF EXISTS "demo_user_goals_all" ON public.user_goals;
DROP POLICY IF EXISTS "demo_user_health_conditions_all" ON public.user_health_conditions;
DROP POLICY IF EXISTS "demo_meal_logs_all" ON public.meal_logs;
DROP POLICY IF EXISTS "demo_meal_items_all" ON public.meal_items;
DROP POLICY IF EXISTS "demo_sleep_logs_all" ON public.sleep_logs;
DROP POLICY IF EXISTS "demo_symptom_logs_all" ON public.symptom_logs;
DROP POLICY IF EXISTS "demo_symptom_correlations_all" ON public.symptom_correlations;
DROP POLICY IF EXISTS "demo_supplement_logs_all" ON public.supplement_logs;
DROP POLICY IF EXISTS "demo_meal_plans_all" ON public.meal_plans;
DROP POLICY IF EXISTS "demo_planned_meals_all" ON public.planned_meals;
DROP POLICY IF EXISTS "demo_shopping_lists_all" ON public.shopping_lists;
DROP POLICY IF EXISTS "demo_shopping_items_all" ON public.shopping_items;
```

The original RLS policies (using `auth.uid()`) will then take effect.

### 2. Update Constants File

```typescript
// lib/supabase/constants.ts

import { supabase } from './client';

// Remove DEMO_USER_ID constant

/**
 * Get the current authenticated user ID
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Get current user ID synchronously (for hooks)
 * This should be called after confirming user is authenticated
 */
export function getUserIdFromSession(session: Session | null): string | null {
  return session?.user?.id ?? null;
}

/**
 * Check if user is authenticated
 */
export function isDemoMode(): boolean {
  return false; // Change to false when auth is implemented
}
```

### 3. Create Auth Context

```typescript
// lib/contexts/auth-context.tsx

"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
```

### 4. Update Query Functions

Update all query functions to use the authenticated user ID:

```typescript
// lib/supabase/queries/supplements.ts

import { supabase } from '../client';
// Remove: import { getDemoUserId } from '../constants';

export async function getSupplementLogs(startDate?: string, endDate?: string) {
  // Get user ID from current session
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  let query = supabase
    .from('supplement_logs')
    .select(`...`)
    .eq('user_id', user.id)  // Use authenticated user
    .order('logged_at', { ascending: false });

  // ... rest of function
}
```

### 5. Add Auth Provider to Layout

```typescript
// app/layout.tsx

import { AuthProvider } from "@/lib/contexts/auth-context";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AuthProvider>
          <Providers>
            {children}
          </Providers>
        </AuthProvider>
      </body>
    </html>
  );
}
```

### 6. Create Auth Pages

Create these pages:
- `/auth/login` - Login form
- `/auth/register` - Registration form
- `/auth/forgot-password` - Password reset

### 7. Add Route Protection

```typescript
// middleware.ts

import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Protect all routes except auth pages
  if (!session && !req.nextUrl.pathname.startsWith("/auth")) {
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

## Supabase Dashboard Setup

1. Enable Email Auth in Supabase Dashboard → Authentication → Providers
2. Configure email templates (optional)
3. Set up OAuth providers if needed (Google, GitHub, etc.)
4. Configure redirect URLs

## Data Migration

When a user signs up, their profile is auto-created via the trigger:

```sql
-- This trigger already exists in the schema
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
```

For migrating demo data to a real user:
1. Export localStorage data before implementing auth
2. Create a migration endpoint/script that imports data for the authenticated user

## Testing Checklist

- [ ] Sign up creates user and profile
- [ ] Sign in works with email/password
- [ ] Sign out clears session
- [ ] Protected routes redirect to login
- [ ] User can only see their own data
- [ ] RLS policies work correctly
- [ ] Password reset flow works

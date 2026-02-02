'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';

export type UserRole = 'user' | 'admin' | 'anon';

interface AuthState {
  user: User | null;
  session: Session | null;
  role: UserRole;
  emailVerified: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    role: 'anon',
    emailVerified: false,
    isLoading: true,
  });

  const supabase = useMemo(() => createClient(), []);

  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) return;
      const data = await res.json();
      setState((prev) => ({
        ...prev,
        role: data.role ?? 'anon',
        emailVerified: data.emailVerified ?? false,
      }));
    } catch {
      // Ignore fetch errors
    }
  }, []);

  const refreshSession = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setState((prev) => ({
      ...prev,
      user: session?.user ?? null,
      session,
      isLoading: false,
    }));
    if (session?.user) {
      await fetchMe();
    } else {
      setState((prev) => ({
        ...prev,
        role: 'anon',
        emailVerified: false,
      }));
    }
  }, [supabase, fetchMe]);

  useEffect(() => {
    refreshSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setState((prev) => ({
        ...prev,
        user: session?.user ?? null,
        session,
        isLoading: false,
      }));
      if (session?.user) {
        fetchMe();
      } else {
        setState((prev) => ({
          ...prev,
          role: 'anon',
          emailVerified: false,
        }));
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, refreshSession, fetchMe]);

  const signOut = useCallback(async () => {
    await fetch('/api/auth/signout', { method: 'POST' });
    await supabase.auth.signOut();
    setState({
      user: null,
      session: null,
      role: 'anon',
      emailVerified: false,
      isLoading: false,
    });
  }, [supabase]);

  const value = useMemo(
    () => ({ ...state, signOut, refreshSession }),
    [state, signOut, refreshSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

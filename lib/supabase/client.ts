'use client';

import { createClient } from '@/utils/supabase/client';

// Single browser client using cookie-based storage (matches SSR auth + proxy).
export const supabase = createClient();

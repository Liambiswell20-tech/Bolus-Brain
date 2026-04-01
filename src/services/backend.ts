import { supabase } from './supabase';

let cachedUserId: string | null = null;

/** Returns true when the user is authenticated with Supabase. */
export function isSupabaseActive(): boolean {
  return cachedUserId !== null;
}

/** Returns the current Supabase user ID. Throws if not authenticated. */
export function getSupabaseUserId(): string {
  if (!cachedUserId) throw new Error('No Supabase user — call refreshBackendState() first');
  return cachedUserId;
}

/**
 * Call on app start and after sign-in / sign-out to sync the cached auth state.
 * While cachedUserId is null, all service functions fall back to local AsyncStorage.
 */
export async function refreshBackendState(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  cachedUserId = session?.user?.id ?? null;
}

// src/lib/auth.ts
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

/**
 * Waits briefly for a browser session to hydrate.
 * Returns `Session` if available, otherwise `null` after timeout.
 */
export async function waitForSession(timeoutMs = 1800): Promise<Session | null> {
  // First try the current session (fast path)
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;

  // Then wait briefly for onAuthStateChange to provide a session (e.g., after refresh)
  return await new Promise<Session | null>((resolve) => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (session) {
        sub.subscription.unsubscribe();
        resolve(session);
      }
    });

    // Fallback after a short grace period
    const t = setTimeout(() => {
      sub.subscription.unsubscribe();
      resolve(null);
    }, timeoutMs);

    // (Optional) safety cleanup if something else resolves first
    // resolve path above already unsubscribes & this timer will then be GC’d
    void t;
  });
}

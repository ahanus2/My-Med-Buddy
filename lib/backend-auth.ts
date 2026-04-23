import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export type AuthSession = {
  userId: string;
  fullName: string;
  email: string;
};

function mapSession(session: Session | null): AuthSession | null {
  const user = session?.user;
  if (!user?.email) {
    return null;
  }

  return {
    userId: user.id,
    fullName: user.user_metadata?.full_name ?? user.email.split("@")[0] ?? "Patient",
    email: user.email
  };
}

export async function loadSession() {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return mapSession(session);
}

export function listenForAuthChanges(callback: (session: AuthSession | null, event: AuthChangeEvent) => void) {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { subscription }
  } = supabase.auth.onAuthStateChange((event, session) => {
    callback(mapSession(session), event);
  });

  return () => {
    subscription.unsubscribe();
  };
}

export async function signUp(fullName: string, email: string, password: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: {
        full_name: fullName.trim()
      }
    }
  });

  if (error) {
    throw error;
  }

  return mapSession(data.session ?? null);
}

export async function signIn(email: string, password: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password
  });

  if (error) {
    throw error;
  }

  return mapSession(data.session);
}

export async function clearSession() {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

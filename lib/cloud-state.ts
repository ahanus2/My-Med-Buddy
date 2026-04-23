import {
  STORAGE_KEY,
  normalizeAppState,
  starterState,
  type AppState
} from "@/lib/medical-data";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type PatientDashboardRow = {
  user_id: string;
  state: AppState;
  updated_at?: string;
};

const DASHBOARD_TABLE = "patient_dashboards";

export async function loadUserDashboardState(userId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from(DASHBOARD_TABLE)
    .select("state")
    .eq("user_id", userId)
    .maybeSingle<{ state: AppState }>();

  if (error) {
    throw error;
  }

  if (!data?.state) {
    return null;
  }

  return normalizeAppState(data.state);
}

export async function saveUserDashboardState(userId: string, state: AppState) {
  const supabase = getSupabaseBrowserClient();
  const payload: PatientDashboardRow = {
    user_id: userId,
    state: normalizeAppState(state)
  };

  const { error } = await supabase.from(DASHBOARD_TABLE).upsert(payload, {
    onConflict: "user_id"
  });

  if (error) {
    throw error;
  }
}

export async function bootstrapUserDashboardState(userId: string) {
  const remoteState = await loadUserDashboardState(userId);
  if (remoteState) {
    return remoteState;
  }

  let nextState = starterState;
  if (typeof window !== "undefined") {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        nextState = normalizeAppState(JSON.parse(saved) as Partial<AppState>);
      } catch {
        nextState = starterState;
      }
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  await saveUserDashboardState(userId, nextState);
  return nextState;
}

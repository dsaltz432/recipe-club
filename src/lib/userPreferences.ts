import type { UserPreferences } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { isDevMode } from "@/lib/devMode";

// user_preferences table not in generated Supabase types — bypass with cast
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const DEFAULT_AI_MODEL = isDevMode() ? "claude-haiku-4-5-20251001" : "claude-sonnet-4-6";

const DEFAULT_PREFERENCES: UserPreferences = {
  mealTypes: ["breakfast", "lunch", "dinner"],
  weekStartDay: 0,
  householdSize: 2,
  aiModel: DEFAULT_AI_MODEL,
};

// Module-level cache so any call site can get the loaded model synchronously.
// Falls back to the env-aware default until preferences are loaded.
let _aiModelCache: string = DEFAULT_AI_MODEL;

export function getCachedAiModel(): string {
  return _aiModelCache;
}

export async function loadUserPreferences(
  userId: string
): Promise<UserPreferences> {
  try {
    const { data, error } = await db
      .from("user_preferences")
      .select("meal_types, week_start_day, household_size, ai_model_parse")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return { ...DEFAULT_PREFERENCES };

    const row = data as unknown as Record<string, unknown>;
    const prefs: UserPreferences = {
      mealTypes: (row.meal_types as string[]) ?? DEFAULT_PREFERENCES.mealTypes,
      weekStartDay:
        typeof row.week_start_day === "number"
          ? row.week_start_day
          : DEFAULT_PREFERENCES.weekStartDay,
      householdSize:
        typeof row.household_size === "number"
          ? row.household_size
          : DEFAULT_PREFERENCES.householdSize,
      aiModel:
        typeof row.ai_model_parse === "string"
          ? row.ai_model_parse
          : DEFAULT_PREFERENCES.aiModel,
    };
    _aiModelCache = prefs.aiModel;
    return prefs;
  } catch (error) {
    console.error("Error loading user preferences:", error);
    return { ...DEFAULT_PREFERENCES };
  }
}

export async function saveUserPreferences(
  userId: string,
  preferences: UserPreferences
): Promise<void> {
  try {
    const { error } = await db.from("user_preferences").upsert(
      {
        user_id: userId,
        meal_types: preferences.mealTypes,
        week_start_day: preferences.weekStartDay,
        household_size: preferences.householdSize,
        ai_model_parse: preferences.aiModel,
        ai_model_combine: preferences.aiModel,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (error) throw error;
    _aiModelCache = preferences.aiModel;
  } catch (error) {
    console.error("Error saving user preferences:", error);
    throw error;
  }
}

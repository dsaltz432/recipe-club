import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RecipeTip {
  id: string;
  recipeId: string;
  userId: string;
  tipText: string;
  createdAt: string;
}

// recipe_tips not yet in generated Supabase types — bypass with cast
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function useRecipeTips(recipeId: string) {
  const [tips, setTips] = useState<RecipeTip[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTips = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await db
        .from("recipe_tips")
        .select("*")
        .eq("recipe_id", recipeId)
        .order("created_at", { ascending: true });

      if (fetchError) throw fetchError;

      setTips(
        (data ?? []).map((row: {
          id: string;
          recipe_id: string;
          user_id: string;
          tip_text: string;
          created_at: string;
        }) => ({
          id: row.id,
          recipeId: row.recipe_id,
          userId: row.user_id,
          tipText: row.tip_text,
          createdAt: row.created_at,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tips");
    } finally {
      setLoading(false);
    }
  }, [recipeId]);

  const addTip = useCallback(async (tipText: string, userId: string): Promise<boolean> => {
    try {
      const { error: insertError } = await db
        .from("recipe_tips")
        .insert({ recipe_id: recipeId, user_id: userId, tip_text: tipText.trim() });

      if (insertError) throw insertError;
      await fetchTips();
      return true;
    } catch (err) {
      console.error("Error adding tip:", err);
      return false;
    }
  }, [recipeId, fetchTips]);

  const deleteTip = useCallback(async (tipId: string): Promise<boolean> => {
    try {
      const { error: deleteError } = await db
        .from("recipe_tips")
        .delete()
        .eq("id", tipId);

      if (deleteError) throw deleteError;
      setTips((prev) => prev.filter((t) => t.id !== tipId));
      return true;
    } catch (err) {
      console.error("Error deleting tip:", err);
      return false;
    }
  }, []);

  return { tips, loading, error, fetchTips, addTip, deleteTip };
}

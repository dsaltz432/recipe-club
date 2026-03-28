import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Use `any` cast since recipe_favorites is not yet in generated Supabase types
const db = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Manages the authenticated user's recipe favorites.
 *
 * Returns:
 *   - favoriteIds: Set of favorited recipe IDs
 *   - toggleFavorite(recipeId): optimistically add/remove a favorite
 */
export function useRecipeFavorites(userId: string | undefined) {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    db
      .from("recipe_favorites")
      .select("recipe_id")
      .eq("user_id", userId)
      .then(({ data, error }: { data: { recipe_id: string }[] | null; error: unknown }) => {
        if (cancelled) return;
        if (error) {
          console.error("Error loading favorites:", error);
        } else {
          setFavoriteIds(new Set((data ?? []).map((row) => row.recipe_id)));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const toggleFavorite = useCallback(
    async (recipeId: string) => {
      if (!userId) return;

      const wasFavorited = favoriteIds.has(recipeId);

      // Optimistic update
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorited) {
          next.delete(recipeId);
        } else {
          next.add(recipeId);
        }
        return next;
      });

      if (wasFavorited) {
        const { error } = await db
          .from("recipe_favorites")
          .delete()
          .eq("user_id", userId)
          .eq("recipe_id", recipeId);
        if (error) {
          console.error("Error removing favorite:", error);
          toast.error("Failed to remove favorite");
          // Revert
          setFavoriteIds((prev) => {
            const next = new Set(prev);
            next.add(recipeId);
            return next;
          });
        }
      } else {
        const { error } = await db
          .from("recipe_favorites")
          .insert({ user_id: userId, recipe_id: recipeId });
        if (error) {
          console.error("Error adding favorite:", error);
          toast.error("Failed to save favorite");
          // Revert
          setFavoriteIds((prev) => {
            const next = new Set(prev);
            next.delete(recipeId);
            return next;
          });
        }
      }
    },
    [userId, favoriteIds]
  );

  return { favoriteIds, toggleFavorite };
}

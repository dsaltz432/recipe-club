import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RecipeContent } from "@/types";

export function useRecipeContent(recipeIds: string[]) {
  const [contentMap, setContentMap] = useState<Map<string, RecipeContent>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (recipeIds.length === 0) {
      setContentMap(new Map());
      return;
    }

    let cancelled = false;

    const fetchContent = async () => {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("recipe_content")
        .select("*")
        .in("recipe_id", recipeIds);

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      const map = new Map<string, RecipeContent>();
      if (data) {
        for (const row of data) {
          map.set(row.recipe_id, {
            id: row.id,
            recipeId: row.recipe_id,
            description: row.description ?? undefined,
            servings: row.servings ?? undefined,
            prepTime: row.prep_time ?? undefined,
            cookTime: row.cook_time ?? undefined,
            totalTime: row.total_time ?? undefined,
            instructions: Array.isArray(row.instructions)
              ? (row.instructions as string[])
              : undefined,
            sourceTitle: row.source_title ?? undefined,
            parsedAt: row.parsed_at ?? undefined,
            status: row.status as RecipeContent["status"],
            errorMessage: row.error_message ?? undefined,
            createdAt: row.created_at,
          });
        }
      }

      setContentMap(map);
      setLoading(false);
    };

    fetchContent();

    return () => {
      cancelled = true;
    };
  }, [recipeIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return { contentMap, loading, error };
}

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RecipeContent } from "@/types";
import { parseInstructions } from "@/lib/recipeActions";

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

      let data, fetchError;
      try {
        const result = await supabase
          .from("recipe_content")
          .select("*")
          .in("recipe_id", recipeIds);
        data = result.data;
        fetchError = result.error;
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Unknown error");
          setLoading(false);
        }
        return;
      }

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
            instructions: parseInstructions(row.instructions),
            sourceTitle: row.source_title ?? undefined,
            parsedAt: row.parsed_at ?? undefined,
            status: row.status as RecipeContent["status"],
            errorMessage: row.error_message ?? undefined,
            createdAt: row.created_at ?? undefined,
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

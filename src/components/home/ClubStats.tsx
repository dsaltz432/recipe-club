import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Star, ChefHat, CalendarCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getIngredientColor, getLightBackgroundColor, getDarkerTextColor } from "@/lib/ingredientColors";

interface IngredientStat {
  id: string;
  name: string;
  usedCount: number;
  color?: string;
}

interface RecipeStat {
  recipeId: string;
  recipeName: string;
  averageRating: number;
  totalRatings: number;
}

interface ClubStatsData {
  totalEvents: number;
  totalRecipes: number;
  topIngredients: IngredientStat[];
  topRecipes: RecipeStat[];
}

const medalColors = ["text-yellow-500", "text-gray-400", "text-amber-600"];

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <span className={`text-lg leading-none ${medalColors[rank - 1]}`}>
        {rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉"}
      </span>
    );
  }
  return (
    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-purple-100 text-purple-700 text-xs font-semibold">
      {rank}
    </span>
  );
}

function renderStars(rating: number) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-3 w-3 ${
            rating >= star
              ? "fill-yellow-400 text-yellow-400"
              : rating >= star - 0.5
              ? "text-yellow-400"
              : "text-gray-300"
          }`}
        />
      ))}
    </div>
  );
}

const ClubStats = () => {
  const [stats, setStats] = useState<ClubStatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        // Fetch top ingredients by usedCount
        const { data: ingredientsData } = await supabase
          .from("ingredients")
          .select("id, name, used_count, color")
          .gt("used_count", 0)
          .order("used_count", { ascending: false })
          .limit(5);

        // Fetch total completed club events
        const { count: eventsCount } = await supabase
          .from("scheduled_events")
          .select("id", { count: "exact", head: true })
          .eq("status", "completed")
          .eq("type", "club");

        // Fetch all recipe ratings with recipe names
        const { data: ratingsData } = await supabase
          .from("recipe_ratings")
          .select("recipe_id, overall_rating, recipes:recipe_id (name)");

        // Fetch total unique club recipes
        const { count: recipesCount } = await supabase
          .from("recipes")
          .select("id", { count: "exact", head: true })
          .not("event_id", "is", null);

        // Aggregate ratings by recipe
        const ratingMap = new Map<string, { name: string; total: number; count: number }>();
        for (const row of ratingsData ?? []) {
          const name = (row.recipes as { name: string } | null)?.name;
          if (!name) continue;
          const existing = ratingMap.get(row.recipe_id);
          if (existing) {
            existing.total += row.overall_rating;
            existing.count += 1;
          } else {
            ratingMap.set(row.recipe_id, { name, total: row.overall_rating, count: 1 });
          }
        }

        const topRecipes: RecipeStat[] = Array.from(ratingMap.entries())
          .filter(([, v]) => v.count >= 2)
          .map(([recipeId, v]) => ({
            recipeId,
            recipeName: v.name,
            averageRating: v.total / v.count,
            totalRatings: v.count,
          }))
          .sort((a, b) => b.averageRating - a.averageRating || b.totalRatings - a.totalRatings)
          .slice(0, 5);

        const topIngredients: IngredientStat[] = (ingredientsData ?? []).map((i) => ({
          id: i.id,
          name: i.name,
          usedCount: i.used_count,
          color: i.color ?? undefined,
        }));

        setStats({
          totalEvents: eventsCount ?? 0,
          totalRecipes: recipesCount ?? 0,
          topIngredients,
          topRecipes,
        });
      } catch (err) {
        console.error("Error loading club stats:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-52 rounded-xl" />
          <Skeleton className="h-52 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!stats || (stats.totalEvents === 0 && stats.topIngredients.length === 0)) {
    return null;
  }

  return (
    <div className="space-y-4 pt-2">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-purple-600" />
        <h3 className="font-display text-lg font-semibold text-gray-900">Club History</h3>
      </div>

      {/* Milestone bubbles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="bg-purple-50 border-purple-100">
          <CardContent className="p-4 flex flex-col items-center text-center gap-1">
            <CalendarCheck className="h-5 w-5 text-purple-600" />
            <span className="text-2xl font-bold text-purple-800">{stats.totalEvents}</span>
            <span className="text-xs text-purple-600 font-medium">Events Completed</span>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-100">
          <CardContent className="p-4 flex flex-col items-center text-center gap-1">
            <ChefHat className="h-5 w-5 text-purple-600" />
            <span className="text-2xl font-bold text-purple-800">{stats.totalRecipes}</span>
            <span className="text-xs text-purple-600 font-medium">Recipes Cooked</span>
          </CardContent>
        </Card>
        {stats.topIngredients.length > 0 && (
          <Card className="bg-purple-50 border-purple-100 col-span-2 sm:col-span-1">
            <CardContent className="p-4 flex flex-col items-center text-center gap-1">
              <span className="text-lg">🌟</span>
              <span className="text-base font-bold text-purple-800 truncate w-full text-center">
                {stats.topIngredients[0].name}
              </span>
              <span className="text-xs text-purple-600 font-medium">Most Featured Ingredient</span>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Leaderboard panels */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Ingredient leaderboard */}
        {stats.topIngredients.length > 0 && (
          <Card className="bg-white/80 border-purple-100">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <span>🥄</span> Top Ingredients
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {stats.topIngredients.map((ing, idx) => {
                const colorHex = ing.color ? getIngredientColor(ing.color) : undefined;
                const bg = colorHex ? getLightBackgroundColor(colorHex) : "bg-purple-50";
                const text = colorHex ? getDarkerTextColor(colorHex) : "#7c3aed";
                return (
                  <div
                    key={ing.id}
                    className="flex items-center gap-3 rounded-lg px-3 py-2"
                    style={{ backgroundColor: bg }}
                  >
                    <RankBadge rank={idx + 1} />
                    <span
                      className="flex-1 text-sm font-medium truncate"
                      style={{ color: text }}
                    >
                      {ing.name}
                    </span>
                    <span className="text-xs font-semibold shrink-0" style={{ color: text }}>
                      {ing.usedCount}x
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Top-rated recipes */}
        {stats.topRecipes.length > 0 && (
          <Card className="bg-white/80 border-purple-100">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <span>⭐</span> Top-Rated Recipes
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {stats.topRecipes.map((recipe, idx) => (
                <div
                  key={recipe.recipeId}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 bg-yellow-50"
                >
                  <RankBadge rank={idx + 1} />
                  <span className="flex-1 text-sm font-medium text-gray-800 truncate">
                    {recipe.recipeName}
                  </span>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span className="sm:hidden text-xs font-semibold text-yellow-500">
                      {recipe.averageRating.toFixed(1)} ★
                    </span>
                    <div className="hidden sm:flex">{renderStars(recipe.averageRating)}</div>
                    <span className="text-xs text-gray-500">
                      <span className="hidden sm:inline">{recipe.averageRating.toFixed(1)} </span>
                      ({recipe.totalRatings})
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ClubStats;

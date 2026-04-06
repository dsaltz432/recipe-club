import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format, isToday, isYesterday, differenceInDays, parseISO, subDays } from "date-fns";
import { CheckCircle2, ArrowRight, Flame } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { loadUserPreferences } from "@/lib/userPreferences";
import { calculateStreak } from "@/lib/cookingStreak";

interface RecentlyCookedItem {
  id: string;
  recipeName?: string;
  customName?: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  cookedAt: string;
}

const MEAL_TYPE_LABEL: Record<RecentlyCookedItem["mealType"], string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

const MEAL_TYPE_COLOR: Record<RecentlyCookedItem["mealType"], string> = {
  breakfast: "bg-amber-50 text-amber-700 border-amber-200",
  lunch: "bg-sky-50 text-sky-700 border-sky-200",
  dinner: "bg-purple-50 text-purple-700 border-purple-200",
  snack: "bg-green-50 text-green-700 border-green-200",
};

function formatCookedDate(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  const daysAgo = differenceInDays(new Date(), date);
  if (daysAgo < 7) return `${daysAgo} days ago`;
  return format(date, "EEE, MMM d");
}

function getWeekStart(date: Date, weekStartDay = 0): Date {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  const diff = weekStartDay === 1 ? (dayOfWeek + 6) % 7 : dayOfWeek;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

interface CookingStats {
  streak: number;
  weekTotal: number;
  weekCooked: number;
}

interface RecentlyCookedCardProps {
  userId: string;
}

const RecentlyCookedCard = ({ userId }: RecentlyCookedCardProps) => {
  const navigate = useNavigate();
  const [items, setItems] = useState<RecentlyCookedItem[]>([]);
  const [stats, setStats] = useState<CookingStats>({ streak: 0, weekTotal: 0, weekCooked: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabase as any;

        // Load user preferences for weekStartDay
        const prefs = await loadUserPreferences(userId);
        const weekStartDay = prefs.weekStartDay ?? 0;
        const weekStart = getWeekStart(new Date(), weekStartDay);
        const weekStartStr = weekStart.toISOString().split("T")[0];

        // 1. Recent cooked meals for display list
        const { data: recentData } = await db
          .from("meal_plan_items")
          .select("id, custom_name, meal_type, cooked_at, recipes(name), meal_plans!inner(user_id)")
          .eq("meal_plans.user_id", userId)
          .not("cooked_at", "is", null)
          .order("cooked_at", { ascending: false })
          .limit(5);

        const mapped: RecentlyCookedItem[] = (recentData ?? []).map(
          (row: {
            id: string;
            custom_name: string | null;
            meal_type: string;
            cooked_at: string;
            recipes: { name: string } | null;
          }) => ({
            id: row.id,
            recipeName: row.recipes?.name,
            customName: row.custom_name ?? undefined,
            mealType: row.meal_type as RecentlyCookedItem["mealType"],
            cookedAt: row.cooked_at,
          })
        );
        setItems(mapped);

        // 2. All cooked timestamps (last 90 days) for streak calculation
        const since90Days = subDays(new Date(), 90).toISOString();
        const { data: allCookedData } = await db
          .from("meal_plan_items")
          .select("cooked_at, meal_plans!inner(user_id)")
          .eq("meal_plans.user_id", userId)
          .not("cooked_at", "is", null)
          .gte("cooked_at", since90Days);

        const allTimestamps: string[] = (allCookedData ?? []).map(
          (row: { cooked_at: string }) => row.cooked_at
        );
        const streak = calculateStreak(allTimestamps);

        // 3. This week's plan completion stats
        const { data: plans } = await supabase
          .from("meal_plans")
          .select("id")
          .eq("user_id", userId)
          .eq("week_start", weekStartStr)
          .order("created_at")
          .limit(1);

        let weekTotal = 0;
        let weekCooked = 0;

        if (plans && plans.length > 0) {
          const { data: weekItems } = await supabase
            .from("meal_plan_items")
            .select("id, cooked_at")
            .eq("plan_id", plans[0].id)
            .limit(100);

          weekTotal = (weekItems ?? []).length;
          weekCooked = (weekItems ?? []).filter(
            (i: { cooked_at: string | null }) => !!i.cooked_at
          ).length;
        }

        setStats({ streak, weekTotal, weekCooked });
      } catch (err) {
        console.error("Error loading recently cooked:", err);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [userId]);

  if (isLoading) {
    return (
      <Card className="bg-white/80 border-green-100">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-10 w-full rounded-lg" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const hasStats = stats.streak > 0 || stats.weekTotal > 0;

  if (items.length === 0 && !hasStats) {
    return (
      <Card className="bg-white/80 border-green-100">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Flame className="h-4 w-4 text-green-600" />
            <span className="font-semibold text-sm text-gray-800">Recently Cooked</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">No meals cooked yet</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Mark meals as cooked in your meal plan to track your progress
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/80 border-green-100">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-green-600" />
            <span className="font-semibold text-sm text-gray-800">Recently Cooked</span>
          </div>
          <button
            onClick={() => navigate("/dashboard/meals")}
            className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium transition-colors"
          >
            View plan
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {/* Cooking stats row: streak + week completion */}
        {hasStats && (
          <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-lg px-3 py-2.5 mb-3">
            {stats.streak > 0 && (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-base leading-none" aria-hidden="true">🔥</span>
                <div>
                  <p className="text-xs font-bold text-green-800 leading-tight tabular-nums">
                    {stats.streak}-day streak
                  </p>
                  <p className="text-[10px] text-green-600 leading-tight">Keep it up!</p>
                </div>
              </div>
            )}

            {stats.streak > 0 && stats.weekTotal > 0 && (
              <div className="w-px h-7 bg-green-200 shrink-0" />
            )}

            {stats.weekTotal > 0 && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-green-800 leading-tight tabular-nums">
                  {stats.weekCooked}/{stats.weekTotal} meals this week
                </p>
                <div className="mt-1 h-1.5 w-full bg-green-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.round((stats.weekCooked / stats.weekTotal) * 100)}%`,
                    }}
                    role="progressbar"
                    aria-valuenow={stats.weekCooked}
                    aria-valuemin={0}
                    aria-valuemax={stats.weekTotal}
                    aria-label={`${stats.weekCooked} of ${stats.weekTotal} meals cooked this week`}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recent meals list */}
        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((item) => {
              const name = item.recipeName || item.customName || "Untitled meal";
              const dateLabel = formatCookedDate(item.cookedAt);

              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 py-1 cursor-pointer rounded-lg px-1 hover:bg-gray-50 transition-colors"
                  onClick={() => navigate("/dashboard/meals")}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") navigate("/dashboard/meals");
                  }}
                >
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{name}</p>
                    <p className="text-xs text-muted-foreground">{dateLabel}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[11px] px-1.5 py-0 shrink-0 border ${MEAL_TYPE_COLOR[item.mealType]}`}
                  >
                    {MEAL_TYPE_LABEL[item.mealType]}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentlyCookedCard;

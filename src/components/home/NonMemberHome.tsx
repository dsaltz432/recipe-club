import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { CalendarDays, BookOpen, Plus, ChefHat, Clock, UtensilsCrossed } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface NextEvent {
  id: string;
  title: string;
  eventDate: string;
  eventTime?: string;
  recipeCount: number;
}

interface NonMemberHomeProps {
  userId: string;
}

const NonMemberHome = ({ userId }: NonMemberHomeProps) => {
  const navigate = useNavigate();
  const [nextEvent, setNextEvent] = useState<NextEvent | null | "loading">("loading");

  useEffect(() => {
    const load = async () => {
      // Fetch upcoming personal events (not meal-plan-created)
      const { data: eventsData } = await supabase
        .from("scheduled_events")
        .select("id, title, event_date, event_time")
        .eq("type", "personal")
        .eq("created_by", userId)
        .eq("status", "scheduled")
        .order("event_date", { ascending: true });

      if (!eventsData || eventsData.length === 0) {
        setNextEvent(null);
        return;
      }

      const first = eventsData[0];

      // Get recipe count for that event
      const { count } = await supabase
        .from("recipes")
        .select("id", { count: "exact", head: true })
        .eq("event_id", first.id);

      setNextEvent({
        id: first.id,
        title: first.title ?? "",
        eventDate: first.event_date,
        eventTime: first.event_time ?? undefined,
        recipeCount: count ?? 0,
      });
    };

    load();
  }, [userId]);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Next Event */}
      {nextEvent === "loading" ? (
        <div className="h-32 rounded-xl bg-white/60 animate-pulse" />
      ) : nextEvent ? (
        <Card
          className="bg-white/80 border-purple/20 hover:border-purple/40 hover:shadow-md transition-all cursor-pointer"
          onClick={() => navigate(`/meals/${nextEvent.id}`)}
        >
          <CardContent className="px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-purple mb-2">Next Up</p>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-purple/10 flex items-center justify-center shrink-0">
                  <ChefHat className="h-5 w-5 text-purple-600" />
                </div>
                <div className="min-w-0">
                  {nextEvent.title && (
                    <p className="font-semibold text-gray-900 truncate">{nextEvent.title}</p>
                  )}
                  <p className={`text-sm truncate ${nextEvent.title ? "text-muted-foreground" : "font-medium text-gray-900"}`}>
                    {format(parseISO(nextEvent.eventDate), "EEEE, MMMM d, yyyy")}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {nextEvent.eventTime && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {nextEvent.eventTime}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <BookOpen className="h-3 w-3" />
                      {nextEvent.recipeCount} {nextEvent.recipeCount === 1 ? "recipe" : "recipes"}
                    </span>
                  </div>
                </div>
              </div>
              <Badge variant="outline" className="border-purple/20 text-purple-700 bg-purple/5 text-xs shrink-0">
                Upcoming
              </Badge>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-white/80 border-purple/10">
          <CardContent className="px-5 py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-purple/10 flex items-center justify-center shrink-0">
                <CalendarDays className="h-4.5 w-4.5 text-purple" />
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-800">No upcoming events</p>
                <p className="text-xs text-muted-foreground">Plan recipes and build a grocery list</p>
              </div>
            </div>
            <Button
              size="sm"
              className="bg-purple hover:bg-purple-dark text-white shrink-0"
              onClick={() => navigate("/dashboard/events")}
            >
              <Plus className="h-4 w-4 mr-1" />
              Create
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Card
          className="bg-white/80 border-orange/20 hover:border-orange/40 hover:shadow-md transition-all cursor-pointer"
          onClick={() => navigate("/dashboard/recipes")}
        >
          <CardContent className="px-4 py-4 flex flex-col items-center text-center gap-2">
            <div className="w-10 h-10 rounded-full bg-orange/10 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-orange-500" />
            </div>
            <p className="font-semibold text-sm text-gray-800">My Recipes</p>
            <p className="text-xs text-muted-foreground">Browse and manage your recipe collection</p>
          </CardContent>
        </Card>

        <Card
          className="bg-white/80 border-green-200 hover:border-green-300 hover:shadow-md transition-all cursor-pointer"
          onClick={() => navigate("/dashboard/meals")}
        >
          <CardContent className="px-4 py-4 flex flex-col items-center text-center gap-2">
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
              <UtensilsCrossed className="h-5 w-5 text-green-600" />
            </div>
            <p className="font-semibold text-sm text-gray-800">Meal Planner</p>
            <p className="text-xs text-muted-foreground">Plan your week and generate grocery lists</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NonMemberHome;

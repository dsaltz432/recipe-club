import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Ingredient, ScheduledEvent, EventWithRecipes } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, isPast, parseISO } from "date-fns";
import {
  Calendar,
  Users,
  ExternalLink,
  X,
  ChefHat,
  Clock,
} from "lucide-react";
import AllRecipes from "@/components/recipes/AllRecipes";

interface RecipeClubEventsProps {
  userId: string;
  onLockIn?: (event: ScheduledEvent, ingredient: Ingredient) => void;
}

const RecipeClubEvents = ({ userId }: RecipeClubEventsProps) => {
  const [events, setEvents] = useState<EventWithRecipes[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadEvents = async () => {
    try {
      // Fetch all scheduled events with their ingredients
      const { data: eventsData, error: eventsError } = await supabase
        .from("scheduled_events")
        .select(
          `
          *,
          ingredients (*)
        `
        )
        .eq("status", "scheduled")
        .order("event_date", { ascending: true });

      if (eventsError) throw eventsError;

      // Fetch all recipes with user profiles
      const { data: recipesData, error: recipesError } = await supabase
        .from("recipes")
        .select(
          `
          *,
          profiles (name, avatar_url)
        `
        )
        .order("created_at", { ascending: true });

      if (recipesError) throw recipesError;

      // Group recipes by event date
      const eventMap = new Map<string, EventWithRecipes>();

      eventsData?.forEach((event) => {
        const dateKey = event.event_date;
        if (!eventMap.has(dateKey)) {
          eventMap.set(dateKey, {
            eventDate: dateKey,
            eventId: event.id,
            recipes: [],
            participantCount: 0,
          });
        }
      });

      recipesData?.forEach((recipe) => {
        if (recipe.event_date) {
          const dateKey = recipe.event_date;
          if (!eventMap.has(dateKey)) {
            eventMap.set(dateKey, {
              eventDate: dateKey,
              recipes: [],
              participantCount: 0,
            });
          }
          const eventData = eventMap.get(dateKey)!;
          eventData.recipes.push({
            id: recipe.id,
            name: recipe.name,
            url: recipe.url || undefined,
            notes: recipe.notes || undefined,
            userId: recipe.user_id || "",
            ingredientId: recipe.ingredient_id || "",
            eventDate: recipe.event_date,
            userName: recipe.profiles?.name || "Unknown",
            userAvatar: recipe.profiles?.avatar_url || undefined,
          });
        }
      });

      // Calculate participant counts
      eventMap.forEach((event) => {
        const uniqueUsers = new Set(event.recipes.map((r) => r.userId));
        event.participantCount = uniqueUsers.size;
      });

      setEvents(Array.from(eventMap.values()));
    } catch (error) {
      console.error("Error loading events:", error);
      toast.error("Failed to load events");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const cancelEvent = async (eventDate: string) => {
    try {
      // Find the event and ingredient
      const { data: eventData, error: findError } = await supabase
        .from("scheduled_events")
        .select("*, ingredients (*)")
        .eq("event_date", eventDate)
        .eq("created_by", userId)
        .single();

      if (findError) throw findError;

      // Update event status
      await supabase
        .from("scheduled_events")
        .update({ status: "canceled" })
        .eq("id", eventData.id);

      // Mark ingredient as available again
      await supabase
        .from("ingredients")
        .update({
          is_used: false,
          used_by: null,
          used_date: null,
        })
        .eq("id", eventData.ingredient_id as string);

      // Delete user's recipes for this event
      await supabase
        .from("recipes")
        .delete()
        .eq("user_id", userId)
        .eq("event_date", eventDate);

      toast.success("Event cancelled. Your ingredient is available again!");
      loadEvents();
    } catch (error) {
      console.error("Error cancelling event:", error);
      toast.error("Failed to cancel event");
    }
  };

  const upcomingEvents = events.filter(
    (e) => !isPast(parseISO(e.eventDate + "T23:59:59"))
  );
  const pastEvents = events.filter((e) =>
    isPast(parseISO(e.eventDate + "T23:59:59"))
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList className="grid w-full max-w-md mx-auto grid-cols-3 mb-6">
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
          <TabsTrigger value="recipes">All Recipes</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming">
          {upcomingEvents.length === 0 ? (
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  No upcoming events. Spin the wheel to create one!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {upcomingEvents.map((event) => (
                <EventCard
                  key={event.eventDate}
                  event={event}
                  userId={userId}
                  onCancel={() => cancelEvent(event.eventDate)}
                  isUpcoming
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="past">
          {pastEvents.length === 0 ? (
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  No past events yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {pastEvents.map((event) => (
                <EventCard
                  key={event.eventDate}
                  event={event}
                  userId={userId}
                  isUpcoming={false}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="recipes">
          <AllRecipes events={events} userId={userId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

interface EventCardProps {
  event: EventWithRecipes;
  userId: string;
  onCancel?: () => void;
  isUpcoming: boolean;
}

const EventCard = ({ event, userId, onCancel, isUpcoming }: EventCardProps) => {
  const userHasRecipe = event.recipes.some((r) => r.userId === userId);

  return (
    <Card className="bg-white/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-purple/10 flex items-center justify-center">
              <ChefHat className="h-6 w-6 text-purple" />
            </div>
            <div>
              <CardTitle className="font-display text-lg">
                {format(parseISO(event.eventDate), "MMMM d, yyyy")}
              </CardTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>
                  {event.participantCount} participant
                  {event.participantCount !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>
          {isUpcoming && userHasRecipe && onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {event.recipes.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No recipes locked in yet.
          </p>
        ) : (
          <ScrollArea className="max-h-64">
            <div className="space-y-3">
              {event.recipes.map((recipe, index) => (
                <div key={recipe.id}>
                  {index > 0 && <Separator className="my-3" />}
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={recipe.userAvatar} />
                      <AvatarFallback>
                        {recipe.userName?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {recipe.userName}
                        </span>
                        {recipe.userId === userId && (
                          <span className="text-xs bg-purple/10 text-purple px-2 py-0.5 rounded-full">
                            You
                          </span>
                        )}
                      </div>
                      <p className="font-medium">{recipe.name}</p>
                      {recipe.url && (
                        <a
                          href={recipe.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-purple hover:underline flex items-center gap-1"
                        >
                          View recipe
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {recipe.notes && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {recipe.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default RecipeClubEvents;

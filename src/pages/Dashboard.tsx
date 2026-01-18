import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser, signOut, getAllowedUser, isAdmin, type AllowedUser } from "@/lib/auth";
import type { User, Ingredient, ScheduledEvent } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { LogOut, Home, Dices, Calendar, BookOpen, Users, ShieldX, Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import IngredientWheel from "@/components/wheel/IngredientWheel";
import IngredientBank from "@/components/ingredients/IngredientBank";
import RecipeClubEvents from "@/components/events/RecipeClubEvents";
import HomeSection from "@/components/home/HomeSection";
import RecipeHub from "@/components/recipes/RecipeHub";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [, setAllowedUser] = useState<AllowedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [userIsAdmin, setUserIsAdmin] = useState(false);
  const [activeEvent, setActiveEvent] = useState<ScheduledEvent | null>(null);
  const [completedEventsCount, setCompletedEventsCount] = useState(0);
  const [userRecipesCount, setUserRecipesCount] = useState(0);

  const loadActiveEvent = async () => {
    try {
      const { data, error } = await supabase
        .from("scheduled_events")
        .select("*, ingredients (name)")
        .eq("status", "scheduled")
        .order("event_date", { ascending: true })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error loading active event:", error);
      }

      if (data) {
        setActiveEvent({
          id: data.id,
          ingredientId: data.ingredient_id || "",
          eventDate: data.event_date,
          eventTime: data.event_time || undefined,
          createdBy: data.created_by || "",
          status: data.status as "scheduled" | "completed" | "canceled",
          ingredientName: data.ingredients?.name,
        });
      } else {
        setActiveEvent(null);
      }
    } catch (error) {
      console.error("Error loading active event:", error);
    }
  };

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      if (currentUser?.email) {
        // Check if user is in allowed_users table
        const allowed = await getAllowedUser(currentUser.email);
        setAllowedUser(allowed);
        setIsAllowed(allowed !== null);
        setUserIsAdmin(isAdmin(allowed));

        if (allowed && currentUser.id) {
          loadStats(currentUser.id);
        }
      } else {
        setIsAllowed(false);
      }

      setIsLoading(false);
    };

    loadUser();
    loadActiveEvent();
  }, []);

  const handleSignOut = async () => {
    await signOut();
  };

  const loadIngredients = async () => {
    try {
      const { data, error } = await supabase
        .from("ingredients")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;

      if (data) {
        setIngredients(
          data.map((i) => ({
            id: i.id,
            name: i.name,
            usedCount: i.used_count,
            lastUsedBy: i.last_used_by || undefined,
            lastUsedDate: i.last_used_date || undefined,
            createdBy: i.created_by || undefined,
            inBank: i.in_bank,
          }))
        );
      }
    } catch (error) {
      console.error("Error loading ingredients:", error);
    }
  };

  const loadStats = async (userId: string) => {
    try {
      // Count completed events
      const { count: eventsCount } = await supabase
        .from("scheduled_events")
        .select("*", { count: "exact", head: true })
        .eq("status", "completed");

      // Count user's recipe contributions
      const { count: recipesCount } = await supabase
        .from("recipe_contributions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      setCompletedEventsCount(eventsCount || 0);
      setUserRecipesCount(recipesCount || 0);
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const handleEventCreated = () => {
    loadActiveEvent();
    loadIngredients();
  };

  const handleRecipeAdded = () => {
    if (user?.id) {
      loadStats(user.id);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple"></div>
      </div>
    );
  }

  // Access Denied screen for non-allowed users
  if (isAllowed === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-light/30 via-white to-orange-light/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center">
              <ShieldX className="h-8 w-8 text-red-500" />
            </div>
            <h1 className="font-display text-2xl font-bold">Access Denied</h1>
            <p className="text-muted-foreground">
              You don't have access to Recipe Club Hub yet. Please contact an admin to get invited.
            </p>
            {user?.email && (
              <p className="text-sm text-muted-foreground">
                Signed in as: {user.email}
              </p>
            )}
            <Button onClick={handleSignOut} variant="outline" className="mt-4">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-light/30 via-white to-orange-light/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="font-display text-2xl font-bold text-gray-900">
              Recipe Club Hub
            </h1>
            <div className="hidden sm:flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-purple">{completedEventsCount}</span>
                <span className="text-muted-foreground">Events</span>
              </div>
              <div className="w-px h-4 bg-border"></div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-orange">{userRecipesCount}</span>
                <span className="text-muted-foreground">Recipes</span>
              </div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.avatar_url} alt={user?.name} />
                  <AvatarFallback>
                    {user?.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium hidden sm:inline">
                  {user?.name}
                </span>
                <Menu className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {userIsAdmin && (
                <>
                  <DropdownMenuItem onClick={() => navigate("/users")}>
                    <Users className="h-4 w-4 mr-2" />
                    Manage Users
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="home" className="w-full">
          <TabsList className="grid w-full max-w-2xl mx-auto mb-8 grid-cols-4">
            <TabsTrigger value="home" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Home</span>
            </TabsTrigger>
            <TabsTrigger value="wheel" className="flex items-center gap-2">
              <Dices className="h-4 w-4" />
              <span className="hidden sm:inline">Spin</span>
            </TabsTrigger>
            <TabsTrigger value="events" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Events</span>
            </TabsTrigger>
            <TabsTrigger value="recipes" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Recipes</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="home">
            <HomeSection
              user={user}
              activeEvent={activeEvent}
              ingredients={ingredients}
              setIngredients={setIngredients}
              isAdmin={userIsAdmin}
              onEventCreated={handleEventCreated}
              onRecipeAdded={handleRecipeAdded}
              onEventUpdated={loadActiveEvent}
            />
          </TabsContent>

          <TabsContent value="wheel">
            <div className="grid lg:grid-cols-2 gap-8">
              <IngredientWheel
                ingredients={ingredients}
                onEventCreated={handleEventCreated}
                userId={user?.id || ""}
                disabled={!userIsAdmin || !!activeEvent}
                activeEvent={activeEvent}
              />
              <IngredientBank
                ingredients={ingredients}
                setIngredients={setIngredients}
                userId={user?.id || ""}
                isAdmin={userIsAdmin}
              />
            </div>
          </TabsContent>

          <TabsContent value="events">
            <RecipeClubEvents
              userId={user?.id || ""}
              isAdmin={userIsAdmin}
              onEventChange={loadActiveEvent}
            />
          </TabsContent>

          <TabsContent value="recipes">
            <RecipeHub userId={user?.id || ""} isAdmin={userIsAdmin} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;

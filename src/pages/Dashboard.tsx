import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getCurrentUser, signOut, getAllowedUser, isAdmin, type AllowedUser } from "@/lib/auth";
import type { User, Ingredient, ScheduledEvent } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { LogOut, Home, Calendar, BookOpen, Users, ShieldX, Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import RecipeClubEvents from "@/components/events/RecipeClubEvents";
import HomeSection from "@/components/home/HomeSection";
import RecipeHub from "@/components/recipes/RecipeHub";

const VALID_TABS = ["home", "events", "recipes"] as const;
type TabValue = typeof VALID_TABS[number];

const Dashboard = () => {
  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();
  const activeTab: TabValue = VALID_TABS.includes(tab as TabValue) ? (tab as TabValue) : "home";

  const handleTabChange = (value: string) => {
    navigate(value === "home" ? "/dashboard" : `/dashboard/${value}`);
  };

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
        .maybeSingle();

      if (error) {
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
          loadStats();
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

  const loadStats = async () => {
    try {
      // Count completed events
      const { count: eventsCount } = await supabase
        .from("scheduled_events")
        .select("*", { count: "exact", head: true })
        .eq("status", "completed");

      // Count all recipes in the system
      const { count: recipesCount } = await supabase
        .from("recipes")
        .select("*", { count: "exact", head: true });

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
      loadStats();
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
    <div className="min-h-screen bg-gradient-to-br from-purple-light/40 via-white to-orange-light/40">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-purple/10 shadow-sm">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-6">
            <h1 className="font-display text-lg sm:text-2xl font-bold text-gray-900">
              Recipe Club Hub
            </h1>
            <div className="hidden md:flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 bg-purple/5 px-3 py-1 rounded-full">
                <span className="font-bold text-purple">{completedEventsCount}</span>
                <span className="text-muted-foreground">Events</span>
              </div>
              <div className="flex items-center gap-1.5 bg-orange/5 px-3 py-1 rounded-full">
                <span className="font-bold text-orange">{userRecipesCount}</span>
                <span className="text-muted-foreground">Recipes</span>
              </div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center gap-2 hover:bg-purple/5">
                <Avatar className="h-8 w-8 ring-2 ring-purple/20">
                  <AvatarImage src={user?.avatar_url} alt={user?.name} />
                  <AvatarFallback className="bg-purple/10 text-purple font-semibold">
                    {user?.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium hidden sm:inline">
                  {user?.name}
                </span>
                <Menu className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {/* Mobile stats */}
              <div className="md:hidden px-2 py-2 border-b">
                <div className="flex justify-around text-xs">
                  <div className="text-center">
                    <div className="font-bold text-purple">{completedEventsCount}</div>
                    <div className="text-muted-foreground">Events</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-orange">{userRecipesCount}</div>
                    <div className="text-muted-foreground">Recipes</div>
                  </div>
                </div>
              </div>
              {userIsAdmin && (
                <>
                  <DropdownMenuItem onClick={() => navigate("/users")} className="cursor-pointer">
                    <Users className="h-4 w-4 mr-2" />
                    Manage Users
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto mb-4 grid-cols-3 bg-white/80 border border-purple/10 shadow-sm p-2 rounded-xl !h-16">
            <TabsTrigger value="home" className="flex items-center justify-center gap-1.5 sm:gap-2 data-[state=active]:bg-purple data-[state=active]:text-white rounded-lg py-2.5">
              <Home className="h-4 w-4" />
              <span className="text-sm">Home</span>
            </TabsTrigger>
            <TabsTrigger value="events" className="flex items-center justify-center gap-1.5 sm:gap-2 data-[state=active]:bg-purple data-[state=active]:text-white rounded-lg py-2.5">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">Events</span>
            </TabsTrigger>
            <TabsTrigger value="recipes" className="flex items-center justify-center gap-1.5 sm:gap-2 data-[state=active]:bg-purple data-[state=active]:text-white rounded-lg py-2.5">
              <BookOpen className="h-4 w-4" />
              <span className="text-sm">Recipes</span>
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

          <TabsContent value="events">
            <RecipeClubEvents
              userId={user?.id || ""}
              isAdmin={userIsAdmin}
              onEventChange={loadActiveEvent}
            />
          </TabsContent>

          <TabsContent value="recipes">
            <RecipeHub />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;

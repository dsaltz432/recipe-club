import { useEffect, useState } from "react";
import { getCurrentUser, signOut } from "@/lib/auth";
import type { User, Ingredient, ScheduledEvent } from "@/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut } from "lucide-react";
import IngredientWheel from "@/components/wheel/IngredientWheel";
import IngredientBank from "@/components/ingredients/IngredientBank";
import RecipeClubEvents from "@/components/events/RecipeClubEvents";
import RecipeLockInForm from "@/components/recipes/RecipeLockInForm";

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showLockInForm, setShowLockInForm] = useState(false);
  const [currentEvent, setCurrentEvent] = useState<ScheduledEvent | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      setIsLoading(false);
    };

    loadUser();
  }, []);

  const handleSignOut = async () => {
    await signOut();
  };

  const handleWheelResult = (ingredient: Ingredient, date: Date) => {
    setSelectedIngredient(ingredient);
    setSelectedDate(date);
    setShowLockInForm(true);
  };

  const handleLockInComplete = () => {
    setShowLockInForm(false);
    setSelectedIngredient(null);
    setSelectedDate(null);
    setCurrentEvent(null);
  };

  const handleLockInFromEvent = (event: ScheduledEvent, ingredient: Ingredient) => {
    setSelectedIngredient(ingredient);
    setSelectedDate(new Date(event.eventDate));
    setCurrentEvent(event);
    setShowLockInForm(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-light/30 via-white to-orange-light/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-gray-900">
            Recipe Club
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.avatar_url} alt={user?.name} />
                <AvatarFallback>
                  {user?.name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium hidden sm:inline">
                {user?.name}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {showLockInForm && selectedIngredient && selectedDate ? (
          <RecipeLockInForm
            ingredient={selectedIngredient}
            eventDate={selectedDate}
            event={currentEvent}
            userId={user?.id || ""}
            onComplete={handleLockInComplete}
            onCancel={handleLockInComplete}
          />
        ) : (
          <Tabs defaultValue="wheel" className="w-full">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
              <TabsTrigger value="wheel">Wheel Spin</TabsTrigger>
              <TabsTrigger value="events">Scheduled Events</TabsTrigger>
            </TabsList>

            <TabsContent value="wheel">
              <div className="grid lg:grid-cols-2 gap-8">
                <IngredientWheel
                  ingredients={ingredients}
                  onResult={handleWheelResult}
                />
                <IngredientBank
                  ingredients={ingredients}
                  setIngredients={setIngredients}
                  userId={user?.id || ""}
                />
              </div>
            </TabsContent>

            <TabsContent value="events">
              <RecipeClubEvents
                userId={user?.id || ""}
                onLockIn={handleLockInFromEvent}
              />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
};

export default Dashboard;

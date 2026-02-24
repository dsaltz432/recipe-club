import { useNavigate } from "react-router-dom";
import type { User, Ingredient, ScheduledEvent } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarClock, BookOpen } from "lucide-react";
import CountdownCard from "./CountdownCard";
import IngredientWheel from "@/components/wheel/IngredientWheel";
import IngredientBank from "@/components/ingredients/IngredientBank";

interface HomeSectionProps {
  user: User | null;
  activeEvent: ScheduledEvent | null;
  ingredients: Ingredient[];
  setIngredients: React.Dispatch<React.SetStateAction<Ingredient[]>>;
  isAdmin: boolean;
  onEventCreated: () => void;
  onRecipeAdded?: () => void;
  onEventUpdated?: () => void;
}

const HomeSection = ({
  user,
  activeEvent,
  ingredients,
  setIngredients,
  isAdmin,
  onEventCreated,
  onRecipeAdded,
  onEventUpdated,
}: HomeSectionProps) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      {/* Personalized Greeting */}
      <div className="text-center">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-gray-900">
          What's Cooking, {user?.name?.split(" ")[0] || "Chef"}?
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {activeEvent
            ? "You have an upcoming event!"
            : isAdmin
              ? "Ready to start a new culinary adventure?"
              : "Welcome back to Recipe Club!"}
        </p>
      </div>

      {/* Conditional Content */}
      {activeEvent ? (
        <CountdownCard
          event={activeEvent}
          userId={user?.id || ""}
          isAdmin={isAdmin}
          onRecipeAdded={onRecipeAdded}
          onEventUpdated={onEventUpdated}
          onEventCanceled={onEventUpdated}
        />
      ) : isAdmin ? (
        <div className="grid lg:grid-cols-2 gap-6">
          <IngredientWheel
            ingredients={ingredients}
            onEventCreated={onEventCreated}
            userId={user?.id || ""}
            disabled={false}
            activeEvent={null}
          />
          <IngredientBank
            ingredients={ingredients}
            setIngredients={setIngredients}
            userId={user?.id || ""}
            isAdmin={isAdmin}
          />
        </div>
      ) : (
        <Card className="max-w-lg mx-auto bg-white/80 backdrop-blur-sm">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-purple/10 flex items-center justify-center">
              <CalendarClock className="h-8 w-8 text-purple" />
            </div>
            <h3 className="font-display text-xl font-semibold">No Event Scheduled</h3>
            <p className="text-muted-foreground">
              There's no upcoming Recipe Club event at the moment.
              Check back soon or browse past recipes!
            </p>
            <Button
              onClick={() => navigate("/dashboard/recipes")}
              className="bg-gradient-to-r from-purple to-purple-dark hover:from-purple-dark hover:to-purple text-white"
            >
              <BookOpen className="h-4 w-4 mr-2" />
              Browse Recipes
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default HomeSection;

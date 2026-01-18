import type { User, Ingredient, ScheduledEvent } from "@/types";
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
  return (
    <div className="space-y-8">
      {/* Personalized Greeting */}
      <div className="text-center">
        <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900">
          What's Cooking, {user?.name?.split(" ")[0] || "Chef"}?
        </h2>
        <p className="text-muted-foreground mt-2">
          {activeEvent
            ? "You have an upcoming event!"
            : "Ready to start a new culinary adventure?"}
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
      ) : (
        <div className="grid lg:grid-cols-2 gap-8">
          <IngredientWheel
            ingredients={ingredients}
            onEventCreated={onEventCreated}
            userId={user?.id || ""}
            disabled={!isAdmin}
            activeEvent={null}
          />
          <IngredientBank
            ingredients={ingredients}
            setIngredients={setIngredients}
            userId={user?.id || ""}
            isAdmin={isAdmin}
          />
        </div>
      )}
    </div>
  );
};

export default HomeSection;

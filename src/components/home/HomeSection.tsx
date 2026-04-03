import { useState, useEffect } from "react";
import type { User, Ingredient, ScheduledEvent } from "@/types";
import CountdownCard from "./CountdownCard";
import ClubStats from "./ClubStats";
import NonMemberHome from "./NonMemberHome";
import WeeklyMealPreview from "./WeeklyMealPreview";
import RecentlyCookedCard from "./RecentlyCookedCard";
import { supabase } from "@/integrations/supabase/client";
import IngredientWheel from "@/components/wheel/IngredientWheel";
import IngredientBank from "@/components/ingredients/IngredientBank";

interface HomeSectionProps {
  user: User | null;
  activeEvent: ScheduledEvent | null;
  ingredients: Ingredient[];
  setIngredients: React.Dispatch<React.SetStateAction<Ingredient[]>>;
  isAdmin: boolean;
  isClubMember?: boolean;
  onEventCreated: () => void;
  onRecipeAdded?: () => void;
  onEventUpdated?: () => void;
  isEventLoading?: boolean;
}

const HomeSection = ({
  user,
  activeEvent,
  ingredients,
  setIngredients,
  isAdmin,
  isClubMember = false,
  onEventCreated,
  onRecipeAdded,
  onEventUpdated,
  isEventLoading = false,
}: HomeSectionProps) => {
  const [clubMemberNames, setClubMemberNames] = useState<string[]>([]);

  useEffect(() => {
    const fetchClubMemberNames = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("get_club_member_names");
      if (!error && Array.isArray(data)) {
        setClubMemberNames(data as string[]);
      }
    };
    fetchClubMemberNames();
  }, []);

  return (
    <div className="space-y-4">
      {/* Personalized Greeting */}
      <div className="text-center md:py-2">
        <h2 className="font-display text-xl md:text-4xl lg:text-5xl font-bold text-gray-900 md:leading-tight">
          What's Cooking, {user?.name?.split(" ")[0] || "Chef"}?
        </h2>
        <p className="text-muted-foreground mt-0.5 text-xs sm:text-sm md:text-base md:mt-2">
          {isClubMember && activeEvent
            ? "You have an upcoming event!"
            : isClubMember
              ? "Ready to start a new culinary adventure?"
              : "Your personal kitchen hub."}
        </p>
      </div>

      {/* Conditional Content */}
      {isEventLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple" />
        </div>
      ) : !isClubMember ? (
        <NonMemberHome userId={user?.id || ""} />
      ) : activeEvent ? (
        <CountdownCard
          event={activeEvent}
          userId={user?.id || ""}
          isAdmin={isAdmin}
          onRecipeAdded={onRecipeAdded}
          onEventUpdated={onEventUpdated}
          onEventCanceled={onEventUpdated}
          clubMemberNames={clubMemberNames}
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
      ) : null}

      {/* Club history — visible to club members once event loading is done */}
      {!isEventLoading && isClubMember && <ClubStats />}

      {/* Weekly meal plan preview — visible to all users once loading is done */}
      {!isEventLoading && user?.id && <WeeklyMealPreview userId={user.id} />}

      {/* Recently cooked — visible to all users once loading is done */}
      {!isEventLoading && user?.id && <RecentlyCookedCard userId={user.id} />}

    </div>
  );
};

export default HomeSection;

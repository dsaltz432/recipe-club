import { useState } from "react";
import { Button } from "@/components/ui/button";
import RecipeClubEvents from "./RecipeClubEvents";
import PersonalEventsList from "./PersonalEventsList";

type EventSubTab = "club" | "my-events";

interface EventsSectionProps {
  userId: string;
  isAdmin: boolean;
  isClubMember: boolean;
  onEventChange: () => void;
}

const EventsSection = ({ userId, isAdmin, isClubMember, onEventChange }: EventsSectionProps) => {
  const [subTab, setSubTab] = useState<EventSubTab>(isClubMember ? "club" : "my-events");

  return (
    <div className="space-y-4">
      {/* Sub-tab switcher */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={subTab === "club" ? "default" : "outline"}
          className={subTab === "club" ? "bg-purple hover:bg-purple-dark" : ""}
          onClick={() => setSubTab("club")}
        >
          Club
        </Button>
        <Button
          size="sm"
          variant={subTab === "my-events" ? "default" : "outline"}
          className={subTab === "my-events" ? "bg-purple hover:bg-purple-dark" : ""}
          onClick={() => setSubTab("my-events")}
        >
          My Events
        </Button>
      </div>

      {subTab === "club" ? (
        <RecipeClubEvents
          userId={userId}
          isAdmin={isAdmin}
          onEventChange={onEventChange}
        />
      ) : (
        <PersonalEventsList userId={userId} />
      )}
    </div>
  );
};

export default EventsSection;

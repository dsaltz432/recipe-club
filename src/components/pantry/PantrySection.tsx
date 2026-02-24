import { UtensilsCrossed } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import PantryContent from "./PantryContent";

interface PantrySectionProps {
  userId?: string;
  onPantryChange?: () => void;
}

const PantrySection = ({ userId, onPantryChange }: PantrySectionProps) => {
  if (!userId) {
    return null;
  }

  return (
    <Card className="bg-white/90 backdrop-blur-sm border border-purple/10">
      <CardContent className="pt-4 sm:pt-6 pb-4">
        <div className="flex items-center gap-2 mb-4">
          <UtensilsCrossed className="h-5 w-5 text-purple" />
          <h2 className="font-display text-lg sm:text-xl font-semibold">My Pantry</h2>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Items you already have at home. These will be excluded from grocery lists.
        </p>

        <PantryContent userId={userId} onPantryChange={onPantryChange} active={true} />
      </CardContent>
    </Card>
  );
};

export default PantrySection;

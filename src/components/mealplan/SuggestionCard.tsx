import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Clock, ExternalLink } from "lucide-react";
import type { MealSuggestion } from "@/types";

interface SuggestionCardProps {
  suggestion: MealSuggestion;
  onAddToPlan: (suggestion: MealSuggestion) => void;
}

const SuggestionCard = ({ suggestion, onAddToPlan }: SuggestionCardProps) => {
  return (
    <Card className="bg-white/80 backdrop-blur-sm">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="font-semibold text-sm leading-tight">{suggestion.name}</h4>
          <Badge variant="outline" className="text-xs shrink-0">
            {suggestion.cuisine}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Clock className="h-3 w-3" />
          <span>{suggestion.timeEstimate}</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">{suggestion.reason}</p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs"
            onClick={() => onAddToPlan(suggestion)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add to Plan
          </Button>
          {suggestion.url && (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs"
              asChild
            >
              <a href={suggestion.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SuggestionCard;

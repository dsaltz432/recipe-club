import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import SuggestionCard from "./SuggestionCard";
import type { MealSuggestion } from "@/types";

interface AISuggestionPanelProps {
  suggestions: MealSuggestion[];
  onAddToPlan: (suggestion: MealSuggestion) => void;
  isLoading: boolean;
}

const AISuggestionPanel = ({
  suggestions,
  onAddToPlan,
  isLoading,
}: AISuggestionPanelProps) => {
  if (isLoading) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple" />
            AI Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (suggestions.length === 0) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple" />
            AI Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Click &quot;Get Suggestions&quot; to receive AI-powered meal ideas based on your preferences.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/80 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple" />
          AI Suggestions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.map((suggestion) => (
          <SuggestionCard
            key={suggestion.id}
            suggestion={suggestion}
            onAddToPlan={onAddToPlan}
          />
        ))}
      </CardContent>
    </Card>
  );
};

export default AISuggestionPanel;

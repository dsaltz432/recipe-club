import { Clock, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface RecipeInstructionsProps {
  instructions?: string[];
  servings?: string;
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  description?: string;
}

const RecipeInstructions = ({
  instructions,
  servings,
  prepTime,
  cookTime,
  totalTime,
  description,
}: RecipeInstructionsProps) => {
  const hasMetadata = servings || prepTime || cookTime || totalTime;
  const hasInstructions = instructions && instructions.length > 0;

  return (
    <Card className="border-purple-100">
      <CardContent className="p-4 sm:p-6">
        {description && (
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            {description}
          </p>
        )}

        {hasMetadata && (
          <div className="flex flex-wrap gap-3 mb-5 p-3 bg-purple-50 rounded-lg">
            {servings && (
              <div className="flex items-center gap-1.5 text-sm text-purple-700">
                <Users className="h-4 w-4 text-purple-500" />
                <span className="font-medium">Servings:</span>
                <span>{servings}</span>
              </div>
            )}
            {prepTime && (
              <div className="flex items-center gap-1.5 text-sm text-purple-700">
                <Clock className="h-4 w-4 text-purple-500" />
                <span className="font-medium">Prep:</span>
                <span>{prepTime}</span>
              </div>
            )}
            {cookTime && (
              <div className="flex items-center gap-1.5 text-sm text-purple-700">
                <Clock className="h-4 w-4 text-purple-500" />
                <span className="font-medium">Cook:</span>
                <span>{cookTime}</span>
              </div>
            )}
            {totalTime && (
              <div className="flex items-center gap-1.5 text-sm text-purple-700">
                <Clock className="h-4 w-4 text-purple-500" />
                <span className="font-medium">Total:</span>
                <span>{totalTime}</span>
              </div>
            )}
          </div>
        )}

        {hasInstructions ? (
          <ol className="space-y-4">
            {instructions.map((step, index) => (
              <li key={index} className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-600 text-white text-sm font-semibold flex items-center justify-center mt-0.5">
                  {index + 1}
                </span>
                <p className="text-base leading-relaxed text-foreground pt-0.5">
                  {step}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground py-2">
            No instructions available
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default RecipeInstructions;

import { useState } from "react";
import { Clock, Users, Pencil, Check, X, Plus, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { saveInstructionsEdit } from "@/lib/recipeActions";

interface RecipeInstructionsProps {
  instructions?: string[];
  servings?: string;
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  description?: string;
  // Editing
  editable?: boolean;
  recipeId?: string;
  onInstructionsChange?: (instructions: string[]) => void;
}

const RecipeInstructions = ({
  instructions,
  servings,
  prepTime,
  cookTime,
  totalTime,
  editable,
  recipeId,
  onInstructionsChange,
}: RecipeInstructionsProps) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [localInstructions, setLocalInstructions] = useState<string[] | undefined>(instructions);

  const hasMetadata = servings || prepTime || cookTime || totalTime;
  const displayInstructions = localInstructions ?? instructions;
  const hasInstructions = displayInstructions && displayInstructions.length > 0;

  const handleEditClick = (index: number) => {
    setEditingIndex(index);
    setEditText(displayInstructions![index]);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditText("");
  };

  const handleSaveEdit = async () => {
    if (editingIndex === null || !recipeId) return;
    const newInstructions = [...(displayInstructions ?? [])];
    newInstructions[editingIndex] = editText;
    setIsSaving(true);
    const result = await saveInstructionsEdit(recipeId, newInstructions);
    setIsSaving(false);
    if (result.success) {
      setLocalInstructions(newInstructions);
      onInstructionsChange?.(newInstructions);
      toast.success("Step updated");
      setEditingIndex(null);
      setEditText("");
    } else {
      toast.error(result.error);
    }
  };

  const handleDeleteStep = async (index: number) => {
    if (!recipeId) return;
    const newInstructions = [...(displayInstructions ?? [])];
    newInstructions.splice(index, 1);
    const result = await saveInstructionsEdit(recipeId, newInstructions);
    if (result.success) {
      setLocalInstructions(newInstructions);
      onInstructionsChange?.(newInstructions);
      toast.success("Step removed");
    } else {
      toast.error(result.error);
    }
  };

  const handleAddStep = async () => {
    if (!recipeId) return;
    const newInstructions = [...(displayInstructions ?? []), ""];
    const newIndex = newInstructions.length - 1;
    const result = await saveInstructionsEdit(recipeId, newInstructions);
    if (result.success) {
      setLocalInstructions(newInstructions);
      onInstructionsChange?.(newInstructions);
      setEditingIndex(newIndex);
      setEditText("");
    } else {
      toast.error(result.error);
    }
  };

  return (
    <Card className="border-purple-100">
      <CardContent className="p-4 sm:p-6">
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
            {displayInstructions!.map((step, index) => (
              <li key={index} className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-600 text-white text-sm font-semibold flex items-center justify-center mt-0.5">
                  {index + 1}
                </span>
                {editable && editingIndex === index ? (
                  <div className="flex-1 flex flex-col gap-2">
                    <textarea
                      className="w-full border rounded p-2 text-base leading-relaxed resize-none"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="save step"
                        onClick={handleSaveEdit}
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="cancel edit"
                        onClick={handleCancelEdit}
                        disabled={isSaving}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-start justify-between gap-2">
                    <p className="text-base leading-relaxed text-foreground pt-0.5">
                      {step}
                    </p>
                    {editable && (
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`edit step ${index + 1}`}
                          onClick={() => handleEditClick(index)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`delete step ${index + 1}`}
                          onClick={() => handleDeleteStep(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground py-2">
            No instructions available
          </p>
        )}

        {editable && (
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddStep}
              className="flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              Add step
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecipeInstructions;
